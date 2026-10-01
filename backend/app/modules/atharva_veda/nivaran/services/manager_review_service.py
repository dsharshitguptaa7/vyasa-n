import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import select, func, or_, and_, desc, asc
from sqlalchemy.orm import Session, selectinload

from app.models.audit import AuditLog
from app.models.notification import Notification
from app.models.user import User
from app.modules.atharva_veda.nivaran.models.ai_processing import AIProcessingRecord
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.enums import (
    CategoryRoutingType,
    GrievancePriority,
    GrievanceStatus,
    HistoryActorType,
    NivaranRole,
)
from app.modules.atharva_veda.nivaran.models.grievance import (
    Grievance,
    GrievanceStatusHistory,
)
from app.modules.atharva_veda.nivaran.models.routing import Assignment
from app.modules.atharva_veda.nivaran.models.taxonomy import Category, Subject
from app.modules.atharva_veda.nivaran.schemas.grievance import (
    AIReviewDecision,
    AIReviewRequest,
    ManagerReviewRequest,
    RoutingPreviewResponse,
)
from app.modules.atharva_veda.nivaran.services.routing_service import (
    DynamicRoutingEngine,
    RoutingConfigurationError,
)

logger = logging.getLogger("vyasa.atharva.manager_review")


class ManagerReviewService:
    @staticmethod
    def get_triage_queue(
        db: Session,
        status_filter: Optional[GrievanceStatus] = None,
        queue: Optional[str] = None,
        priority: Optional[GrievancePriority] = None,
        category_id: Optional[uuid.UUID] = None,
        subject_id: Optional[uuid.UUID] = None,
        search: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        page: int = 1,
        page_size: int = 50,
    ) -> List[Grievance]:
        """
        Retrieves the grievance triage queue for the Manager command center.
        Supports action queues (ai_review, reopened), status filters, and search.
        Defaults to cases in PENDING_REVIEW awaiting category confirmation and routing assignment.
        """
        conditions = []

        if queue:
            normalized_queue = queue.lower().strip().replace("-", "_")
            if normalized_queue in {"ai_review", "ai_review_pending"}:
                conditions.append(
                    or_(
                        Grievance.status == GrievanceStatus.PENDING_REVIEW,
                        and_(
                            Grievance.status.in_([GrievanceStatus.SUBMITTED, GrievanceStatus.ASSIGNED]),
                            Grievance.category_reviewed.is_(False),
                        ),
                    )
                )
            elif normalized_queue in {"reopened", "reopened_cases"}:
                conditions.append(Grievance.status == GrievanceStatus.REOPENED)
            elif normalized_queue in {"assigned"}:
                conditions.append(Grievance.status == GrievanceStatus.ASSIGNED)
        elif status_filter:
            conditions.append(Grievance.status == status_filter)
        else:
            conditions.append(Grievance.status == GrievanceStatus.PENDING_REVIEW)

        if priority:
            conditions.append(Grievance.priority == priority)

        if category_id:
            conditions.append(
                or_(
                    Grievance.final_category_id == category_id,
                    and_(Grievance.final_category_id.is_(None), Grievance.category_id == category_id),
                )
            )

        if subject_id:
            conditions.append(Grievance.subject_id == subject_id)

        if search and search.strip():
            term = f"%{search.strip()}%"
            conditions.append(
                or_(
                    Grievance.grievance_id.ilike(term),
                    Grievance.title.ilike(term),
                    Grievance.description.ilike(term),
                )
            )

        sort_col = Grievance.created_at
        if sort_by == "priority":
            sort_col = Grievance.priority
        order_clause = desc(sort_col) if str(sort_order).lower() == "desc" else asc(sort_col)

        stmt = (
            select(Grievance)
            .options(
                selectinload(Grievance.subject).selectinload(Subject.cluster),
                selectinload(Grievance.category),
                selectinload(Grievance.applicant),
                selectinload(Grievance.assigned_authority),
            )
            .where(and_(*conditions))
            .order_by(order_clause)
            .offset(max(0, (page - 1) * page_size))
            .limit(page_size)
        )
        return list(db.scalars(stmt).all())

    @staticmethod
    def preview_routing(
        db: Session,
        grievance_id: uuid.UUID,
        category_id: Optional[uuid.UUID] = None,
    ) -> RoutingPreviewResponse:
        """
        Calculates and previews the dynamically resolved authority before committing triage assignment.
        """
        grievance = db.scalar(
            select(Grievance)
            .options(
                selectinload(Grievance.subject),
                selectinload(Grievance.category),
            )
            .where(Grievance.id == grievance_id)
        )
        if not grievance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Grievance with identifier '{grievance_id}' was not found.",
            )

        target_cat_id = category_id or grievance.final_category_id or grievance.category_id
        category = db.scalar(
            select(Category).where(Category.id == target_cat_id)
        )
        if not category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target category '{target_cat_id}' does not exist.",
            )

        try:
            authority = DynamicRoutingEngine.resolve_subject_route(
                db=db,
                subject_id=grievance.subject_id,
            )
        except RoutingConfigurationError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Routing Configuration Error: {str(e)}",
            )

        return RoutingPreviewResponse(
            grievance_id=grievance.grievance_id,
            subject_name=grievance.subject.name if grievance.subject else "Unknown",
            category_name=category.name,
            routing_type=CategoryRoutingType.SUBJECT_ASSISTANT_DEAN.value,
            target_authority_id=authority.id,
            target_authority_name=authority.name_snapshot,
            target_authority_role=authority.role.value,
            target_authority_email=authority.email_snapshot,
            is_active=authority.is_active,
        )

    @classmethod
    def review_ai_recommendation(
        cls,
        db: Session,
        grievance_id_or_tracking: str,
        manager_user: User,
        review_data: AIReviewRequest,
    ) -> Grievance:
        """
        Implements reference parity for Manager review of AI classification (PATCH /grievances/{id}/ai-review):
        1. Resolves grievance by UUID or tracking ID.
        2. Validates that grievance is in PENDING_REVIEW or ASSIGNED status.
        3. Validates that AI processing record exists.
        4. Validates target category exists and is active.
        5. For CONFIRMED/ACCEPTED: verifies category matches AI suggestion.
        6. Preserves original ai_suggested_category_id while updating final_category_id.
        7. Sets category_reviewed=True and category_overridden=(decision == OVERRIDDEN).
        8. Records structured AuditLog ("AI_CATEGORY_CONFIRMED" or "AI_CATEGORY_OVERRIDDEN").
        """
        # Resolve manager authority
        manager_authority = db.scalar(
            select(NivaranAuthority).where(
                NivaranAuthority.vyasa_user_id == manager_user.id,
                NivaranAuthority.is_active.is_(True),
            )
        )
        if not manager_authority or manager_authority.role != NivaranRole.MANAGER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Manager can review AI category recommendations.",
            )

        # 1. Resolve grievance
        target_uuid = None
        try:
            target_uuid = uuid.UUID(grievance_id_or_tracking)
        except ValueError:
            target_uuid = None

        grievance = db.scalar(
            select(Grievance).where(
                (Grievance.id == target_uuid) if target_uuid else (Grievance.grievance_id == grievance_id_or_tracking)
            ).with_for_update()
        )
        if not grievance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Grievance '{grievance_id_or_tracking}' was not found.",
            )

        # 2. Status verification
        if grievance.category_reviewed and grievance.status not in {
            GrievanceStatus.PENDING_REVIEW,
            GrievanceStatus.ASSIGNED,
            GrievanceStatus.SUBMITTED,
        }:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="AI category cannot be reviewed in current status.",
            )

        # 3. AI record check
        ai_processing = db.scalar(
            select(AIProcessingRecord)
            .where(AIProcessingRecord.grievance_id == grievance.id)
            .order_by(AIProcessingRecord.created_at.desc())
        )
        if not ai_processing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="AI processing record not found for this grievance.",
            )

        # 4. Target category resolution
        target_cat_id = (
            review_data.category_id
            or ai_processing.predicted_category_id
            or grievance.category_id
        )
        if not target_cat_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category ID must be provided or predicted by AI.",
            )

        category = db.scalar(
            select(Category).where(
                Category.id == target_cat_id,
                Category.is_active.is_(True),
            )
        )
        if not category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or inactive category selected.",
            )

        # 5. Validate review decision
        is_confirmed = review_data.decision in {
            AIReviewDecision.CONFIRMED,
            AIReviewDecision.ACCEPTED,
        }

        if is_confirmed:
            if ai_processing.predicted_category_id and ai_processing.predicted_category_id != category.id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="For CONFIRMED/ACCEPTED decision, category must match the AI recommendation.",
                )
            grievance.category_overridden = False
            action = "AI_CATEGORY_CONFIRMED"
            desc_text = f"AI category confirmed by Manager. Final category: {category.name}."
        else:
            grievance.category_overridden = True
            action = "AI_CATEGORY_OVERRIDDEN"
            desc_text = f"AI category overridden by Manager. Final category: {category.name}."

        grievance.final_category_id = category.id
        grievance.category_reviewed = True

        audit_log = AuditLog(
            user_id=manager_user.id,
            module="atharva_veda",
            action=action,
            entity_name="Grievance",
            entity_id=str(grievance.id),
            details={
                "grievance_id": grievance.grievance_id,
                "action": action,
                "description": desc_text,
                "final_category": category.name,
                "category_overridden": grievance.category_overridden,
            },
        )
        db.add(audit_log)
        db.commit()
        db.refresh(grievance)

        logger.info(
            f"[AI Review Decision] Case {grievance.grievance_id} category reviewed as "
            f"'{category.name}' (decision: {review_data.decision.value}) by {manager_user.email}"
        )
        return grievance

    @classmethod
    def review_and_assign_grievance(
        cls,
        db: Session,
        grievance_id: uuid.UUID,
        manager_user: User,
        action_data: ManagerReviewRequest,
    ) -> Grievance:
        """
        Executes Manager triage review, category ratification/override, dynamic authority assignment, and notification dispatch:
        1. Validates grievance is in PENDING_REVIEW (or SUBMITTED/REOPENED) state using row locking.
        2. Resolves manager authority identity.
        3. Enforces idempotency: rejects already assigned cases.
        4. Ratifies category or sets override with mandatory audit reason (>= 5 chars).
        5. Dynamically routes to the accountable Assistant/Associate Dean or Fixed Authority using FINAL category.
        6. Preserves assignment history (deactivates old assignments, creates active assignment).
        7. Updates grievance status to ASSIGNED.
        8. Records status history and structured audit logs.
        9. Dispatches in-app notifications to assigned authority and applicant.
        """
        # Resolve manager authority record
        manager_authority = db.scalar(
            select(NivaranAuthority).where(
                NivaranAuthority.vyasa_user_id == manager_user.id,
                NivaranAuthority.is_active.is_(True),
            )
        )
        if not manager_authority or manager_authority.role != NivaranRole.MANAGER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only appointed Atharva Veda Managers can execute triage and case assignment.",
            )

        # Concurrency & row lock
        grievance = db.scalar(
            select(Grievance).where(Grievance.id == grievance_id).with_for_update()
        )
        if not grievance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Grievance '{grievance_id}' was not found.",
            )

        # Idempotency / State Verification
        if grievance.category_reviewed and grievance.status == GrievanceStatus.ASSIGNED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This grievance has already been reviewed and assigned.",
            )

        if grievance.status not in {
            GrievanceStatus.PENDING_REVIEW,
            GrievanceStatus.SUBMITTED,
            GrievanceStatus.REOPENED,
        }:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Grievance cannot be triaged in its current status: '{grievance.status.value}'. "
                    "Case must be in PENDING_REVIEW status."
                ),
            )

        # 1. Category Review & Override Logic
        decision_action = "AI_CATEGORY_CONFIRMED"
        if action_data.override_category_id:
            override_cat = db.scalar(
                select(Category).where(
                    Category.id == action_data.override_category_id,
                    Category.is_active.is_(True),
                )
            )
            if not override_cat:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Selected override category is invalid or inactive.",
                )
            if not action_data.override_reason or len(action_data.override_reason.strip()) < 5:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A valid institutional justification (minimum 5 characters) is required when overriding category.",
                )

            grievance.final_category_id = override_cat.id
            grievance.category_overridden = True
            grievance.category_override_reason = action_data.override_reason.strip()
            grievance.category_reviewed = True
            effective_category = override_cat
            decision_action = "AI_CATEGORY_OVERRIDDEN"
        else:
            grievance.final_category_id = grievance.category_id
            grievance.category_reviewed = True
            grievance.category_overridden = False
            effective_category = db.scalar(
                select(Category).where(Category.id == grievance.category_id)
            )

        # 2. Priority update if requested
        if action_data.priority:
            grievance.priority = action_data.priority

        # 3. Dynamic Routing: Stage 1 Subject Routing (Subject -> Cluster -> Assistant Dean)
        # In NIVARAN-AI sequential routing, Manager triage ALWAYS routes to the accountable Assistant Dean.
        # Downstream grievance-category routing (Associate Dean / Fixed Authority) is executed at Stage 2
        # when the Assistant Dean reviews and forwards the case.
        try:
            target_authority = DynamicRoutingEngine.resolve_subject_route(
                db=db,
                subject_id=grievance.subject_id,
            )
        except RoutingConfigurationError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Dynamic Routing Failure: {str(e)}",
            )

        now_utc = datetime.now(timezone.utc)

        # 4. Deactivate prior active assignments (preserve historical accountability)
        prior_assignments = db.scalars(
            select(Assignment).where(
                Assignment.grievance_id == grievance.id,
                Assignment.is_active.is_(True),
            )
        ).all()
        for prior in prior_assignments:
            prior.is_active = False
            prior.unassigned_at = now_utc
            db.add(prior)

        # 5. Create new active assignment
        new_assignment = Assignment(
            grievance_id=grievance.id,
            authority_id=target_authority.id,
            assigned_by_id=manager_authority.id if manager_authority else None,
            assignment_reason=action_data.remarks or "Triage review completed and assigned to accountable authority",
            is_active=True,
            assigned_at=now_utc,
        )
        db.add(new_assignment)

        # 6. Update grievance status and assigned authority
        from_status = grievance.status.value
        grievance.assigned_authority_id = target_authority.id
        grievance.status = GrievanceStatus.ASSIGNED

        # 7. Record Status History
        remarks_text = (
            f"Triage review completed by {manager_user.full_name}. "
            f"Assigned to {target_authority.name_snapshot} ({target_authority.role.value})."
        )
        if action_data.remarks:
            remarks_text += f" Remarks: {action_data.remarks.strip()}"

        history_entry = GrievanceStatusHistory(
            grievance_id=grievance.id,
            from_status=from_status,
            to_status=GrievanceStatus.ASSIGNED.value,
            actor_user_id=manager_user.id,
            actor_authority_id=manager_authority.id if manager_authority else None,
            actor_type=HistoryActorType.USER,
            remarks=remarks_text,
        )
        db.add(history_entry)

        # 8. Record Audit Logs (both review decision and assignment)
        review_audit = AuditLog(
            user_id=manager_user.id,
            module="atharva_veda",
            action=decision_action,
            entity_name="Grievance",
            entity_id=str(grievance.id),
            details={
                "grievance_id": grievance.grievance_id,
                "final_category": effective_category.name,
                "category_overridden": grievance.category_overridden,
                "override_reason": grievance.category_override_reason,
            },
        )
        db.add(review_audit)

        assign_audit = AuditLog(
            user_id=manager_user.id,
            module="atharva_veda",
            action="grievance.assigned",
            entity_name="Grievance",
            entity_id=str(grievance.id),
            details={
                "grievance_id": grievance.grievance_id,
                "assigned_authority": target_authority.name_snapshot,
                "assigned_authority_role": target_authority.role.value,
                "final_category": effective_category.name,
                "category_overridden": grievance.category_overridden,
            },
        )
        db.add(assign_audit)

        # 9. In-App Notifications
        # A. Notify assigned authority
        if target_authority.vyasa_user_id:
            notif_authority = Notification(
                user_id=target_authority.vyasa_user_id,
                title="New Grievance Assigned",
                message=f"Grievance {grievance.grievance_id} has been assigned to you by Manager.",
                type="GRIEVANCE_ASSIGNED",
                metadata_json={
                    "grievance_id": str(grievance.id),
                    "tracking_id": grievance.grievance_id,
                    "status": grievance.status.value,
                },
            )
            db.add(notif_authority)

        # B. Notify submitting applicant
        if grievance.applicant_vyasa_user_id:
            notif_applicant = Notification(
                user_id=grievance.applicant_vyasa_user_id,
                title="Grievance Assigned for Review",
                message=(
                    f"Your grievance {grievance.grievance_id} has been triaged and assigned to "
                    f"{target_authority.name_snapshot} ({target_authority.role.value}) for formal processing."
                ),
                type="GRIEVANCE_STATUS_CHANGED",
                metadata_json={
                    "grievance_id": str(grievance.id),
                    "tracking_id": grievance.grievance_id,
                    "status": grievance.status.value,
                    "assigned_authority": target_authority.name_snapshot,
                },
            )
            db.add(notif_applicant)

        db.commit()
        db.refresh(grievance)

        logger.info(
            f"[Grievance Assigned] Case {grievance.grievance_id} assigned to "
            f"{target_authority.name_snapshot} ({target_authority.role.value}) by {manager_user.email}"
        )
        return grievance
