import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.applicant_profile import ApplicantProfile
from app.models.audit import AuditLog
from app.models.notification import Notification
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.document import Document
from app.modules.atharva_veda.nivaran.models.efile import EFile
from app.modules.atharva_veda.nivaran.models.enums import (
    GrievanceStatus,
    HistoryActorType,
    NivaranRole,
)
from app.modules.atharva_veda.nivaran.models.grievance import (
    Grievance,
    GrievanceFeedback,
    GrievanceStatusHistory,
    StudentMasterRecord,
)
from app.modules.atharva_veda.nivaran.services.efile_service import EFileService
from app.modules.atharva_veda.nivaran.services.student_master_record_service import (
    StudentMasterRecordService,
)

logger = logging.getLogger("vyasa.atharva.nivaran.services.manager_closure")


class ManagerClosureService:
    @staticmethod
    def _lookup_grievance_for_update(db: Session, grievance_id_or_ref: str | uuid.UUID) -> Optional[Grievance]:
        """Locks the grievance row with SELECT ... FOR UPDATE to prevent concurrent double-closures."""
        stmt = select(Grievance).with_for_update()
        if isinstance(grievance_id_or_ref, uuid.UUID):
            return db.scalar(stmt.where(Grievance.id == grievance_id_or_ref))
        try:
            parsed = uuid.UUID(str(grievance_id_or_ref))
            return db.scalar(
                stmt.where((Grievance.id == parsed) | (Grievance.grievance_id == str(grievance_id_or_ref)))
            )
        except (ValueError, TypeError):
            return db.scalar(stmt.where(Grievance.grievance_id == str(grievance_id_or_ref)))

    @classmethod
    def get_closure_queue(
        cls,
        db: Session,
        page: int = 1,
        page_size: int = 15,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Retrieves cases eligible for Manager Final Closure.
        Eligibility requirement:
        Status MUST BE RESOLVED AND applicant feedback must have been submitted.
        """
        stmt = (
            select(Grievance, GrievanceFeedback, ApplicantProfile)
            .join(GrievanceFeedback, Grievance.id == GrievanceFeedback.grievance_id)
            .outerjoin(ApplicantProfile, Grievance.applicant_vyasa_user_id == ApplicantProfile.user_id)
            .where(Grievance.status == GrievanceStatus.RESOLVED)
            .order_by(GrievanceFeedback.created_at.desc())
        )

        count_stmt = (
            select(func.count(Grievance.id))
            .join(GrievanceFeedback, Grievance.id == GrievanceFeedback.grievance_id)
            .where(Grievance.status == GrievanceStatus.RESOLVED)
        )
        total = db.scalar(count_stmt) or 0

        offset = (page - 1) * page_size
        rows = db.execute(stmt.offset(offset).limit(page_size)).all()

        items = []
        for grv, fb, profile in rows:
            items.append({
                "id": grv.id,
                "grievance_id": grv.grievance_id,
                "title": grv.title,
                "priority": grv.priority.value,
                "applicant_name": grv.applicant.full_name if grv.applicant else "Scholar",
                "applicant_email": grv.applicant.email if grv.applicant else "scholar@csjmu.ac.in",
                "registration_number": profile.phd_registration_number if profile else None,
                "subject_name": grv.subject.name if grv.subject else "Unknown",
                "category_name": grv.category.name if grv.category else "Unknown",
                "resolved_by_name": grv.resolved_by.user.full_name if grv.resolved_by and grv.resolved_by.user else "Authority",
                "resolved_by_role": grv.resolved_by.role.value if grv.resolved_by else "AUTHORITY",
                "resolved_at": grv.resolved_at,
                "resolution_summary": grv.resolution_summary,
                "feedback_rating": fb.rating,
                "feedback_timeliness": fb.timeliness_rating,
                "feedback_fairness": fb.fairness_rating,
                "feedback_text": fb.feedback_text,
                "feedback_created_at": fb.created_at,
                "is_closure_ready": True,
                "created_at": grv.created_at,
            })

        return items, total

    @classmethod
    def get_closure_detail(
        cls,
        db: Session,
        grievance_id_or_ref: str | uuid.UUID,
    ) -> Dict[str, Any]:
        """
        Compiles complete authoritative case context for Manager closure inspection.
        """
        # Lookup without lock for inspection
        if isinstance(grievance_id_or_ref, uuid.UUID):
            grievance = db.scalar(select(Grievance).where(Grievance.id == grievance_id_or_ref))
        else:
            try:
                parsed = uuid.UUID(str(grievance_id_or_ref))
                grievance = db.scalar(
                    select(Grievance).where((Grievance.id == parsed) | (Grievance.grievance_id == str(grievance_id_or_ref)))
                )
            except (ValueError, TypeError):
                grievance = db.scalar(select(Grievance).where(Grievance.grievance_id == str(grievance_id_or_ref)))

        if not grievance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Grievance not found",
            )

        profile = db.scalar(
            select(ApplicantProfile).where(ApplicantProfile.user_id == grievance.applicant_vyasa_user_id)
        )
        smr = db.scalar(
            select(StudentMasterRecord).where(StudentMasterRecord.student_vyasa_user_id == grievance.applicant_vyasa_user_id)
        )
        feedback = db.scalar(
            select(GrievanceFeedback).where(GrievanceFeedback.grievance_id == grievance.id)
        )
        docs = db.scalars(
            select(Document).where(Document.grievance_id == grievance.id).order_by(Document.created_at.asc())
        ).all()
        history = db.scalars(
            select(GrievanceStatusHistory).where(GrievanceStatusHistory.grievance_id == grievance.id).order_by(GrievanceStatusHistory.created_at.asc())
        ).all()

        is_resolved = (grievance.status == GrievanceStatus.RESOLVED)
        has_feedback = (feedback is not None)
        is_already_closed = (grievance.status == GrievanceStatus.CLOSED)

        return {
            "grievance": {
                "id": str(grievance.id),
                "grievance_id": grievance.grievance_id,
                "title": grievance.title,
                "description": grievance.description,
                "status": grievance.status.value,
                "priority": grievance.priority.value,
                "subject_name": grievance.subject.name if grievance.subject else "Unknown",
                "category_name": grievance.category.name if grievance.category else "Unknown",
                "created_at": grievance.created_at.isoformat() if grievance.created_at else None,
                "resolved_at": grievance.resolved_at.isoformat() if grievance.resolved_at else None,
                "closed_at": grievance.closed_at.isoformat() if grievance.closed_at else None,
            },
            "applicant": {
                "user_id": str(grievance.applicant.id) if grievance.applicant else None,
                "full_name": grievance.applicant.full_name if grievance.applicant else "Scholar",
                "email": grievance.applicant.email if grievance.applicant else None,
                "registration_number": profile.phd_registration_number if profile else None,
                "department": getattr(profile, "department", None) or "General",
            },
            "student_record": {
                "id": str(smr.id),
                "record_number": smr.record_number,
                "status": smr.status.value,
            } if smr else None,
            "resolution": {
                "resolved_by_name": grievance.resolved_by.user.full_name if grievance.resolved_by and grievance.resolved_by.user else "Authority",
                "resolved_by_role": grievance.resolved_by.role.value if grievance.resolved_by else "AUTHORITY",
                "resolved_at": grievance.resolved_at.isoformat() if grievance.resolved_at else None,
                "resolution_summary": grievance.resolution_summary,
            },
            "feedback": {
                "rating": feedback.rating,
                "timeliness_rating": feedback.timeliness_rating,
                "fairness_rating": feedback.fairness_rating,
                "feedback_text": feedback.feedback_text,
                "created_at": feedback.created_at.isoformat(),
            } if feedback else None,
            "documents": [
                {
                    "id": str(d.id),
                    "file_name": d.file_name,
                    "file_size": d.file_size,
                    "mime_type": d.mime_type,
                    "content_hash": d.content_hash,
                }
                for d in docs
            ],
            "history": [
                {
                    "from_status": h.from_status,
                    "to_status": h.to_status,
                    "actor_type": h.actor_type.value,
                    "remarks": h.remarks,
                    "created_at": h.created_at.isoformat() if h.created_at else None,
                }
                for h in history
            ],
            "closure_eligibility": {
                "is_resolved": is_resolved,
                "has_feedback": has_feedback,
                "is_already_closed": is_already_closed,
                "can_finalize": is_resolved and has_feedback and not is_already_closed,
            },
        }

    @classmethod
    def finalize_closure(
        cls,
        db: Session,
        grievance_id_or_ref: str | uuid.UUID,
        closure_notes: Optional[str],
        manager_authority: NivaranAuthority,
    ) -> Dict[str, Any]:
        """
        Executes atomic final closure of a grievance under row-level database lock.
        Sequence:
        1. Lock grievance with SELECT ... FOR UPDATE.
        2. Verify status == RESOLVED (not already CLOSED).
        3. Verify applicant feedback exists.
        4. Transition status -> CLOSED.
        5. Set closed_by_authority_id and closed_at.
        6. Append GrievanceStatusHistory.
        7. Record structured AuditLog ("CLOSURE_FINALIZED", "GRIEVANCE_CLOSED").
        8. Dispatch applicant Notification ("GRIEVANCE_CLOSED").
        9. Trigger EFileService to compile, seal, and link official E-File.
        10. Update and link StudentMasterRecord.
        11. Commit atomically.
        """
        now = datetime.now(timezone.utc)

        # 1. Lock grievance row
        grievance = cls._lookup_grievance_for_update(db, grievance_id_or_ref)
        if not grievance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Grievance not found",
            )

        # 2. Concurrency guard: If already CLOSED, return clean 409 Conflict
        if grievance.status == GrievanceStatus.CLOSED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Grievance has already been closed. Duplicate closure rejected.",
            )

        # 3. Status precondition: Must be RESOLVED
        if grievance.status != GrievanceStatus.RESOLVED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Only resolved grievances can be closed. Current status: '{grievance.status.value}'",
            )

        # 4. Feedback precondition: Must have received applicant feedback
        feedback = db.scalar(
            select(GrievanceFeedback).where(GrievanceFeedback.grievance_id == grievance.id)
        )
        if not feedback:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot finalize closure: Applicant feedback has not been submitted yet.",
            )

        # 5. Atomically update grievance status
        previous_status = grievance.status.value
        grievance.status = GrievanceStatus.CLOSED
        grievance.closed_by_authority_id = manager_authority.id
        grievance.closed_at = now

        # 6. Append status history
        remarks_text = closure_notes.strip() if closure_notes else "Resolution verified and case formally closed by Manager."
        hist_entry = GrievanceStatusHistory(
            id=uuid.uuid4(),
            grievance_id=grievance.id,
            from_status=previous_status,
            to_status=GrievanceStatus.CLOSED.value,
            actor_authority_id=manager_authority.id,
            actor_type=HistoryActorType.USER,
            remarks=f"Closed by Manager {manager_authority.user.full_name}: {remarks_text}",
            created_at=now,
        )
        db.add(hist_entry)

        # 7. Record AuditLog
        audit_entry = AuditLog(
            id=uuid.uuid4(),
            user_id=manager_authority.vyasa_user_id,
            module="atharva_veda",
            action="CLOSURE_FINALIZED",
            entity_name="Grievance",
            entity_id=str(grievance.id),
            details={
                "grievance_id": grievance.grievance_id,
                "closed_by_authority_id": str(manager_authority.id),
                "closure_notes": remarks_text,
            },
            created_at=now,
        )
        db.add(audit_entry)

        # 8. Dispatch notification to applicant
        notif = Notification(
            id=uuid.uuid4(),
            user_id=grievance.applicant_vyasa_user_id,
            title="Grievance Formally Closed",
            message=(
                f"Your grievance {grievance.grievance_id} has been formally closed by institutional management. "
                f"The official sealed E-File dossier is now available."
            ),
            type="workflow",
            metadata_json={
                "module": "atharva_veda",
                "event": "GRIEVANCE_CLOSED",
                "grievance_id": str(grievance.id),
                "grievance_ref": grievance.grievance_id,
            },
            created_at=now,
        )
        db.add(notif)

        # 9. Trigger E-File generation
        try:
            efile = EFileService.generate_efile_dossier(
                db=db,
                grievance=grievance,
                sealed_by_authority=manager_authority,
                closure_remarks=remarks_text,
            )
        except Exception as e_err:
            logger.error(f"[CLOSURE] E-File compilation failed for {grievance.grievance_id}: {e_err}")
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate and seal official E-File: {str(e_err)}",
            )

        # 10. Commit transaction
        try:
            db.commit()
            db.refresh(grievance)
            db.refresh(efile)
        except Exception as commit_err:
            db.rollback()
            logger.error(f"[CLOSURE] Transaction commit failed for {grievance.grievance_id}: {commit_err}")
            if "unique" in str(commit_err).lower() or "duplicate" in str(commit_err).lower():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A conflicting closure or E-File already exists for this grievance.",
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to finalize grievance closure.",
            )

        smr_record = efile.student_record
        smr_num = smr_record.record_number if smr_record else "SMR-RECORD"

        return {
            "grievance_id": grievance.grievance_id,
            "status": grievance.status.value,
            "closed_at": grievance.closed_at,
            "closed_by_name": manager_authority.user.full_name,
            "e_file_id": efile.id,
            "e_file_number": efile.e_file_number,
            "student_record_id": efile.student_record_id,
            "student_record_number": smr_num,
            "content_hash": efile.content_hash,
            "page_count": efile.page_count,
        }
