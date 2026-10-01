import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.audit import AuditLog
from app.models.notification import Notification
from app.models.user import User
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.enums import (
    GrievanceStatus,
    HistoryActorType,
    NivaranRole,
)
from app.modules.atharva_veda.nivaran.models.grievance import (
    Grievance,
    GrievanceFeedback,
    GrievanceStatusHistory,
)
from app.modules.atharva_veda.nivaran.schemas.phase6d import GrievanceFeedbackCreate

logger = logging.getLogger("vyasa.atharva.nivaran.services.grievance_feedback")


class GrievanceFeedbackService:
    @staticmethod
    def _lookup_grievance(db: Session, grievance_id_or_ref: str | uuid.UUID) -> Optional[Grievance]:
        if isinstance(grievance_id_or_ref, uuid.UUID):
            return db.scalar(select(Grievance).where(Grievance.id == grievance_id_or_ref))
        try:
            parsed = uuid.UUID(str(grievance_id_or_ref))
            return db.scalar(
                select(Grievance).where(
                    (Grievance.id == parsed) | (Grievance.grievance_id == str(grievance_id_or_ref))
                )
            )
        except (ValueError, TypeError):
            return db.scalar(select(Grievance).where(Grievance.grievance_id == str(grievance_id_or_ref)))

    @classmethod
    def submit_feedback(
        cls,
        db: Session,
        grievance_id_or_ref: str | uuid.UUID,
        feedback_data: GrievanceFeedbackCreate,
        current_user: User,
    ) -> GrievanceFeedback:
        """
        Submits applicant satisfaction ratings (1-5 across Quality, Timeliness, Fairness).
        Enforces strict ownership, RESOLVED status precondition, duplicate prevention,
        Manager notifications, and structured audit logs.
        """
        # 1. Lookup grievance
        grievance = cls._lookup_grievance(db, grievance_id_or_ref)
        if not grievance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Grievance not found",
            )

        # 2. Ownership check: Must belong to current applicant
        if grievance.applicant_vyasa_user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to submit feedback for this grievance",
            )

        # 3. Status precondition: Grievance must be RESOLVED
        if grievance.status != GrievanceStatus.RESOLVED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Feedback can only be submitted for resolved grievances. Current status: '{grievance.status.value}'",
            )

        # 4. Duplicate check: Exactly ONE feedback record per grievance
        existing = db.scalar(
            select(GrievanceFeedback).where(GrievanceFeedback.grievance_id == grievance.id)
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Feedback has already been submitted for this grievance.",
            )

        # 5. Rating bounds validation (defense-in-depth)
        for field_name, val in [
            ("rating", feedback_data.rating),
            ("timeliness_rating", feedback_data.timeliness_rating),
            ("fairness_rating", feedback_data.fairness_rating),
        ]:
            if not isinstance(val, int) or val < 1 or val > 5:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Rating for {field_name} must be an integer between 1 and 5.",
                )

        now = datetime.now(timezone.utc)

        # 6. Create feedback record
        feedback = GrievanceFeedback(
            id=uuid.uuid4(),
            grievance_id=grievance.id,
            rating=feedback_data.rating,
            timeliness_rating=feedback_data.timeliness_rating,
            fairness_rating=feedback_data.fairness_rating,
            feedback_text=feedback_data.feedback_text.strip() if feedback_data.feedback_text else None,
            created_at=now,
        )
        db.add(feedback)

        # 7. Append status history note acknowledging feedback receipt
        history_entry = GrievanceStatusHistory(
            id=uuid.uuid4(),
            grievance_id=grievance.id,
            from_status=grievance.status.value,
            to_status=grievance.status.value,
            actor_user_id=current_user.id,
            actor_type=HistoryActorType.USER,
            remarks=(
                f"Applicant submitted resolution feedback: Quality {feedback_data.rating}/5, "
                f"Timeliness {feedback_data.timeliness_rating}/5, Fairness {feedback_data.fairness_rating}/5. "
                f"Case is ready for Manager Final Closure."
            ),
            created_at=now,
        )
        db.add(history_entry)

        # 8. Record structured AuditLog
        audit_entry = AuditLog(
            id=uuid.uuid4(),
            user_id=current_user.id,
            module="atharva_veda",
            action="FEEDBACK_SUBMITTED",
            entity_name="Grievance",
            entity_id=str(grievance.id),
            details={
                "grievance_id": grievance.grievance_id,
                "rating": feedback_data.rating,
                "timeliness_rating": feedback_data.timeliness_rating,
                "fairness_rating": feedback_data.fairness_rating,
                "has_comments": bool(feedback_data.feedback_text),
            },
            created_at=now,
        )
        db.add(audit_entry)

        # 9. Notify active Managers that case is awaiting final closure
        mgr_authorities = db.scalars(
            select(NivaranAuthority).where(
                NivaranAuthority.role == NivaranRole.MANAGER,
                NivaranAuthority.is_active.is_(True),
            )
        ).all()

        for mgr in mgr_authorities:
            notif = Notification(
                id=uuid.uuid4(),
                user_id=mgr.vyasa_user_id,
                title="Applicant Feedback Received",
                message=(
                    f"Applicant feedback has been submitted for grievance {grievance.grievance_id}. "
                    f"The case is now queued for Manager Final Closure."
                ),
                type="workflow",
                metadata_json={
                    "module": "atharva_veda",
                    "event": "CLOSURE_REVIEW_REQUIRED",
                    "grievance_id": str(grievance.id),
                    "grievance_ref": grievance.grievance_id,
                },
                created_at=now,
            )
            db.add(notif)

        try:
            db.commit()
            db.refresh(feedback)
        except Exception as e:
            db.rollback()
            logger.error(f"[FEEDBACK] Failed to persist feedback for {grievance.grievance_id}: {e}")
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Feedback has already been submitted for this grievance.",
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to submit feedback. Transaction safely rolled back.",
            )

        return feedback

    @classmethod
    def get_feedback(
        cls,
        db: Session,
        grievance_id_or_ref: str | uuid.UUID,
        current_user: User,
    ) -> Optional[GrievanceFeedback]:
        """
        Retrieves submitted feedback for a grievance with strict authorization check.
        Applicants may only view feedback for their own grievance.
        Authorities (Manager, Deans) may view feedback in line with governance.
        """
        grievance = cls._lookup_grievance(db, grievance_id_or_ref)
        if not grievance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Grievance not found",
            )

        # If user is an applicant, must be owner
        is_owner = grievance.applicant_vyasa_user_id == current_user.id
        is_authority = db.scalar(
            select(NivaranAuthority).where(
                NivaranAuthority.vyasa_user_id == current_user.id,
                NivaranAuthority.is_active.is_(True),
            )
        ) is not None

        if not is_owner and not is_authority:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view feedback for this grievance",
            )

        feedback = db.scalar(
            select(GrievanceFeedback).where(GrievanceFeedback.grievance_id == grievance.id)
        )
        if not feedback:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No feedback found for this grievance",
            )

        return feedback

    @classmethod
    def get_public_summary(cls, db: Session) -> Dict[str, Any]:
        """
        Aggregates public satisfaction ratings with zero PII.
        """
        total = db.scalar(select(func.count(GrievanceFeedback.id))) or 0
        if total == 0:
            return {
                "average_rating": None,
                "average_timeliness": None,
                "average_fairness": None,
                "total_feedback": 0,
            }

        avg_rating = db.scalar(select(func.avg(GrievanceFeedback.rating)))
        avg_timeliness = db.scalar(select(func.avg(GrievanceFeedback.timeliness_rating)))
        avg_fairness = db.scalar(select(func.avg(GrievanceFeedback.fairness_rating)))

        return {
            "average_rating": round(float(avg_rating), 1) if avg_rating is not None else None,
            "average_timeliness": round(float(avg_timeliness), 1) if avg_timeliness is not None else None,
            "average_fairness": round(float(avg_fairness), 1) if avg_fairness is not None else None,
            "total_feedback": total,
        }
