"""
Grievance Submission Service for NIVARAN Pillar.

Handles transactional filing of grievances:
1. Validates subject from institutional taxonomy.
2. Enforces SUBMITTED lifecycle initial state.
3. Records append-only grievance status history.
4. Links initial evidence documents.
5. Records institutional security audit log.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.pipeline import ai_pipeline
from app.core.exceptions import SubjectInactiveError, SubjectNotFoundError
from app.core.timezone import now_ist, now_utc
from app.models.audit import AuditLog
from app.models.document import Document
from app.models.enums import GrievancePriority, GrievanceStatus, HistoryActorType
from app.models.grievance import Grievance, GrievanceStatusHistory, StudentMasterRecord
from app.models.taxonomy import Subject
from app.schemas.grievance import GrievanceSubmissionRequest
from app.services.ai_processing import AIProcessingService
from app.services.lifecycle import LifecycleStateMachine
from app.services.submission_restrictions import (
    acquire_submission_lock,
    check_daily_submission_limit,
    check_similar_active_grievance,
)

logger = logging.getLogger("nivaran.submission")


def generate_grievance_tracking_id() -> str:
    """Generate human-readable, unique grievance tracking code (e.g. G-20260927-A1B2C3)."""
    date_part = now_ist().strftime("%Y%m%d")
    suffix = uuid.uuid4().hex[:6].upper()
    return f"G-{date_part}-{suffix}"


class GrievanceSubmissionService:
    """Domain service managing the applicant grievance submission lifecycle."""

    @classmethod
    def submit_grievance(
        cls,
        db: Session,
        applicant_vyasa_user_id: uuid.UUID,
        payload: GrievanceSubmissionRequest,
        ip_address: Optional[str] = None,
    ) -> Grievance:
        """
        Execute transactional creation of a new grievance.
        All steps (grievance, initial status history, evidence, audit log) are committed atomically.
        """
        # 1. Subject validation against institutional master data
        stmt = select(Subject).where(Subject.id == payload.subject_id)
        subject = db.execute(stmt).scalar_one_or_none()

        if subject is None:
            raise SubjectNotFoundError(str(payload.subject_id))

        if not subject.is_active:
            raise SubjectInactiveError(subject.name)

        if subject.subject_cluster_id is None:
            raise SubjectNotFoundError(
                f"{payload.subject_id} (Subject '{subject.name}' is unassigned to a cluster)"
            )

        # 2. Enforce initial lifecycle transition (NULL -> SUBMITTED)
        LifecycleStateMachine.validate_initial_transition(GrievanceStatus.SUBMITTED)

        # 3. Concurrency serialization lock
        acquire_submission_lock(db=db, applicant_vyasa_user_id=applicant_vyasa_user_id)

        # 4. Daily Submission Throttle (3 per candidate per calendar day in Asia/Kolkata)
        check_daily_submission_limit(
            db=db,
            applicant_vyasa_user_id=applicant_vyasa_user_id,
            ip_address=ip_address,
        )

        # 5. Local AI Pre-classification for Category Duplicate Detection (Zero Gemini)
        predicted_cat_name: Optional[str] = None
        try:
            ai_pred = ai_pipeline.predict_category(payload.title, payload.description)
            predicted_cat_name = ai_pred.get("category")
        except Exception as e:
            logger.warning("Local AI pre-classification failed: %s", e)

        # 6. Duplicate Active Grievance Detection (Category, Subject, TF-IDF cosine similarity >= 0.85)
        check_similar_active_grievance(
            db=db,
            applicant_vyasa_user_id=applicant_vyasa_user_id,
            title=payload.title,
            description=payload.description,
            predicted_category_name=predicted_cat_name,
            ip_address=ip_address,
        )

        try:
            # 7. Lookup existing student master record if provisioned (do NOT invent data)
            student_stmt = select(StudentMasterRecord).where(
                StudentMasterRecord.student_vyasa_user_id == applicant_vyasa_user_id
            )
            student_record = db.execute(student_stmt).scalar_one_or_none()
            student_record_id = student_record.id if student_record else None

            # 8. Create Grievance record
            tracking_code = generate_grievance_tracking_id()
            now = now_utc()

            grievance = Grievance(
                grievance_id=tracking_code,
                applicant_vyasa_user_id=applicant_vyasa_user_id,
                student_record_id=student_record_id,
                subject_id=subject.id,
                title=payload.title.strip(),
                description=payload.description.strip(),
                status=GrievanceStatus.SUBMITTED,
                priority=payload.priority or GrievancePriority.MEDIUM,
                submitted_at=now,
                last_action_at=now,
            )
            db.add(grievance)
            db.flush()  # Obtain grievance.id for relational dependents

            # 5. Create initial append-only status history
            initial_history = GrievanceStatusHistory(
                grievance_id=grievance.id,
                previous_status=None,
                new_status=GrievanceStatus.SUBMITTED,
                changed_by_vyasa_user_id=applicant_vyasa_user_id,
                actor_type=HistoryActorType.USER,
                remarks="Initial grievance filing by applicant.",
                changed_at=now,
            )
            db.add(initial_history)

            # 6. Link initial evidentiary documents if supplied
            if payload.documents:
                for doc_spec in payload.documents:
                    doc = Document(
                        grievance_id=grievance.id,
                        uploaded_by_vyasa_user_id=applicant_vyasa_user_id,
                        file_name=doc_spec.file_name,
                        file_path=doc_spec.file_path,
                        mime_type=doc_spec.mime_type,
                        file_size=doc_spec.file_size,
                        document_type=doc_spec.document_type or "ATTACHMENT",
                        storage_key=doc_spec.storage_key,
                        content_hash=doc_spec.content_hash,
                        version=1,
                    )
                    db.add(doc)

            # 7. Create institutional security audit log
            audit_entry = AuditLog(
                user_vyasa_id=applicant_vyasa_user_id,
                grievance_id=grievance.id,
                action="GRIEVANCE_SUBMITTED",
                entity_type="Grievance",
                entity_id=grievance.id,
                description=f"Grievance {tracking_code} submitted under subject '{subject.name}'.",
                ip_address=ip_address,
                created_at=now,
            )
            db.add(audit_entry)

            # 8. Commit the initial submission transaction atomically
            db.commit()
            db.refresh(grievance)

            logger.info(
                "Successfully filed grievance %s for applicant %s in SUBMITTED state",
                tracking_code,
                applicant_vyasa_user_id,
            )

            # 9. Trigger automatic local AI Processing Pipeline (SUBMITTED -> AI_PROCESSING -> PENDING_REVIEW)
            try:
                AIProcessingService.process_grievance(
                    db=db,
                    grievance=grievance,
                    ip_address=ip_address,
                )
            except Exception as ai_err:
                logger.error(
                    "Background AI processing failed for grievance %s: %s",
                    tracking_code,
                    ai_err,
                )

            return grievance

        except Exception:
            db.rollback()
            raise
