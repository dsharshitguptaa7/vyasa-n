"""
AI Processing Service for NIVARAN Pillar.

Orchestrates local AI inference for grievances:
1. Validates lifecycle transition: SUBMITTED -> AI_PROCESSING.
2. Updates grievance status to AI_PROCESSING and records append-only status history (actor=SYSTEM).
3. Invokes NivaranAIPipeline singleton (TF-IDF + LogisticRegression) on title and description.
4. Resiliently resolves predicted category name to active Category DB record (exact, case-insensitive, normalized).
5. Persists telemetry and prediction in ai_processing_records (COMPLETED / FAILED).
6. Updates grievance (category_id, ai_confidence, final_category_id, category_reviewed=False, category_overridden=False).
7. Validates lifecycle transition: AI_PROCESSING -> PENDING_REVIEW.
8. Updates grievance status to PENDING_REVIEW and records append-only status history (actor=SYSTEM).
9. Records institutional security audit log.
10. On failure: sets ai_processing_records status to FAILED with controlled message, does not assign fake category,
    transitions grievance to PENDING_REVIEW with "AI processing failed. Manual review required."
"""

import logging
import time
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ai.pipeline import ai_pipeline
from app.models.ai_processing import AIProcessingRecord, AIProcessingStatus
from app.models.audit import AuditLog
from app.models.enums import GrievanceStatus, HistoryActorType
from app.models.grievance import Grievance, GrievanceStatusHistory
from app.models.taxonomy import Category
from app.services.lifecycle import LifecycleStateMachine

logger = logging.getLogger("nivaran.ai_processing")


class AIProcessingService:
    """Domain service managing local AI classification and grievance lifecycle progression."""

    @classmethod
    def resolve_db_category(
        cls,
        db: Session,
        predicted_name: Optional[str],
    ) -> Optional[Category]:
        """
        Resiliently resolves a predicted category name against active database categories.

        Strategy:
        1. Exact match (case-sensitive)
        2. Case-insensitive match
        3. Normalized space/underscore match ('Course Work' <-> 'Course_Work')

        Returns:
            Category instance if resolved, None if unresolvable (does NOT fabricate a category).
        """
        if not predicted_name:
            return None

        # 1. Exact match
        stmt_exact = select(Category).where(
            Category.name == predicted_name,
            Category.is_active.is_(True),
        )
        cat = db.execute(stmt_exact).scalar_one_or_none()
        if cat is not None:
            return cat

        # 2. Case-insensitive match
        stmt_case = select(Category).where(
            func.lower(Category.name) == predicted_name.lower(),
            Category.is_active.is_(True),
        )
        cat = db.execute(stmt_case).scalar_one_or_none()
        if cat is not None:
            return cat

        # 3. Space / underscore normalized match
        all_cats = db.execute(
            select(Category).where(Category.is_active.is_(True))
        ).scalars().all()

        norm_pred = predicted_name.replace("_", " ").strip().lower()
        for c in all_cats:
            if c.name.replace("_", " ").strip().lower() == norm_pred:
                return c

        return None

    @classmethod
    def process_grievance(
        cls,
        db: Session,
        grievance: Grievance,
        ip_address: Optional[str] = None,
    ) -> AIProcessingRecord:
        """
        Execute full local AI processing on a grievance:
        SUBMITTED -> AI_PROCESSING -> Local Inference -> ai_processing_records -> PENDING_REVIEW.

        Guarantees that the grievance ends in PENDING_REVIEW regardless of AI success or failure.
        """
        now_start = datetime.now(timezone.utc)

        # 1. Transition: SUBMITTED -> AI_PROCESSING
        if grievance.status == GrievanceStatus.SUBMITTED:
            LifecycleStateMachine.validate_transition(
                current_status=grievance.status,
                target_status=GrievanceStatus.AI_PROCESSING,
            )
            start_history = GrievanceStatusHistory(
                grievance_id=grievance.id,
                previous_status=GrievanceStatus.SUBMITTED,
                new_status=GrievanceStatus.AI_PROCESSING,
                changed_by_vyasa_user_id=None,
                actor_type=HistoryActorType.SYSTEM,
                remarks="AI processing started automatically",
                changed_at=now_start,
            )
            db.add(start_history)
            grievance.status = GrievanceStatus.AI_PROCESSING
            grievance.last_action_at = now_start
            db.flush()

        start_time = time.perf_counter()

        try:
            # 2. Run local AI inference
            prediction = ai_pipeline.predict_category(
                title=grievance.title,
                description=grievance.description,
            )
            predicted_cat_name = prediction.get("category")
            confidence = prediction.get("confidence")
            model_name = prediction.get("model_name", ai_pipeline.model_name)
            model_version = prediction.get("model_version", ai_pipeline.model_version)

            # 3. Resiliently resolve predicted category in database
            category = cls.resolve_db_category(db=db, predicted_name=predicted_cat_name)
            if category is None:
                raise ValueError(
                    f"Predicted category '{predicted_cat_name}' could not be resolved in database taxonomy."
                )

            processing_time_ms = int((time.perf_counter() - start_time) * 1000)
            now_complete = datetime.now(timezone.utc)

            # 4. Persist successful AI processing record
            record = AIProcessingRecord(
                grievance_id=grievance.id,
                model_name=model_name,
                model_version=model_version,
                predicted_category_id=category.id,
                confidence_score=confidence,
                status=AIProcessingStatus.COMPLETED,
                processing_time_ms=processing_time_ms,
                error_message=None,
                features_extracted=None,
                created_at=now_complete,
            )
            db.add(record)

            # 5. Update grievance with AI recommendation
            grievance.category_id = category.id
            grievance.ai_confidence = confidence
            grievance.final_category_id = category.id
            grievance.category_reviewed = False
            grievance.category_overridden = False
            grievance.last_action_at = now_complete

            # 6. Transition: AI_PROCESSING -> PENDING_REVIEW
            LifecycleStateMachine.validate_transition(
                current_status=grievance.status,
                target_status=GrievanceStatus.PENDING_REVIEW,
            )
            completion_history = GrievanceStatusHistory(
                grievance_id=grievance.id,
                previous_status=GrievanceStatus.AI_PROCESSING,
                new_status=GrievanceStatus.PENDING_REVIEW,
                changed_by_vyasa_user_id=None,
                actor_type=HistoryActorType.SYSTEM,
                remarks="AI processing completed automatically",
                changed_at=now_complete,
            )
            db.add(completion_history)
            grievance.status = GrievanceStatus.PENDING_REVIEW

            # 7. Record institutional audit log
            audit_entry = AuditLog(
                user_vyasa_id=None,
                grievance_id=grievance.id,
                action="AI_PROCESSING_COMPLETED",
                entity_type="Grievance",
                entity_id=grievance.id,
                description=f"AI categorization completed: {category.name} (confidence: {confidence:.4f}).",
                ip_address=ip_address,
                created_at=now_complete,
            )
            db.add(audit_entry)

            db.commit()
            db.refresh(record)
            db.refresh(grievance)

            logger.info(
                "AI processing completed for grievance %s -> %s (conf: %.4f, %dms)",
                grievance.grievance_id,
                category.name,
                confidence,
                processing_time_ms,
            )
            return record

        except Exception as exc:
            db.rollback()

            logger.error(
                "[AI Processing] Inference failed for grievance %s: %s",
                grievance.grievance_id,
                exc,
            )
            processing_time_ms = int((time.perf_counter() - start_time) * 1000)
            now_fail = datetime.now(timezone.utc)

            clean_error_msg = str(exc).split("\n")[0]
            if len(clean_error_msg) > 250:
                clean_error_msg = clean_error_msg[:247] + "..."

            # Ensure grievance is refreshed in active session after rollback
            grievance = db.get(Grievance, grievance.id)

            # Record initial AI_PROCESSING history if not already recorded
            fail_history_start = GrievanceStatusHistory(
                grievance_id=grievance.id,
                previous_status=GrievanceStatus.SUBMITTED,
                new_status=GrievanceStatus.AI_PROCESSING,
                changed_by_vyasa_user_id=None,
                actor_type=HistoryActorType.SYSTEM,
                remarks="AI processing started automatically",
                changed_at=now_start,
            )
            db.add(fail_history_start)

            # Persist FAILED record
            record = AIProcessingRecord(
                grievance_id=grievance.id,
                model_name=ai_pipeline.model_name,
                model_version=ai_pipeline.model_version,
                predicted_category_id=None,
                confidence_score=None,
                status=AIProcessingStatus.FAILED,
                processing_time_ms=processing_time_ms,
                error_message=clean_error_msg,
                features_extracted=None,
                created_at=now_fail,
            )
            db.add(record)

            # Do NOT assign a fake category or confidence
            grievance.category_id = None
            grievance.ai_confidence = None
            grievance.final_category_id = None
            grievance.category_reviewed = False
            grievance.category_overridden = False

            # Transition: AI_PROCESSING -> PENDING_REVIEW
            fail_history_end = GrievanceStatusHistory(
                grievance_id=grievance.id,
                previous_status=GrievanceStatus.AI_PROCESSING,
                new_status=GrievanceStatus.PENDING_REVIEW,
                changed_by_vyasa_user_id=None,
                actor_type=HistoryActorType.SYSTEM,
                remarks="AI processing failed. Manual review required.",
                changed_at=now_fail,
            )
            db.add(fail_history_end)
            grievance.status = GrievanceStatus.PENDING_REVIEW
            grievance.last_action_at = now_fail

            # Audit log
            audit_fail = AuditLog(
                user_vyasa_id=None,
                grievance_id=grievance.id,
                action="AI_PROCESSING_FAILED",
                entity_type="Grievance",
                entity_id=grievance.id,
                description=f"AI categorization failed: {clean_error_msg}. Sent to manual triage.",
                ip_address=ip_address,
                created_at=now_fail,
            )
            db.add(audit_fail)

            db.commit()
            db.refresh(record)
            db.refresh(grievance)

            return record
