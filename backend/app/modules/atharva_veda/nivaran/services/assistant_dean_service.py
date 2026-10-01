import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import select, and_, or_, desc, asc, func
from sqlalchemy.orm import Session, selectinload

from app.models.audit import AuditLog
from app.models.notification import Notification
from app.models.user import User
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.committee import (
    CommitteeCreationRequest,
    CommitteeRequestStatus,
)
from app.modules.atharva_veda.nivaran.models.document import (
    Document,
    DocumentRequest,
)
from app.modules.atharva_veda.nivaran.models.enums import (
    CategoryRoutingType,
    DocumentRequestStatus,
    GrievancePriority,
    GrievanceStatus,
    HistoryActorType,
    NivaranRole,
)
from app.modules.atharva_veda.nivaran.models.grievance import (
    Grievance,
    GrievanceStatusHistory,
)
from app.modules.atharva_veda.nivaran.models.routing import (
    Assignment,
    ForwardingConfirmation,
)
from app.modules.atharva_veda.nivaran.models.taxonomy import Category, Subject
from app.modules.atharva_veda.nivaran.schemas.assistant_dean import (
    AssistantDeanCommitteeRequestPayload,
    AssistantDeanDocumentRequestPayload,
    AssistantDeanForwardRequest,
    AssistantDeanResolveRequest,
    CommitteeRequestResponseItem,
    DocumentRequestResponseItem,
)
from app.modules.atharva_veda.nivaran.services.routing_service import (
    DynamicRoutingEngine,
    RoutingConfigurationError,
)

logger = logging.getLogger("vyasa.atharva.assistant_dean")


class AssistantDeanService:
    @staticmethod
    def get_assistant_dean_authority(db: Session, user: User) -> NivaranAuthority:
        """
        Validates caller identity as an active appointed ASSISTANT_DEAN authority.
        """
        authority = db.scalar(
            select(NivaranAuthority).where(
                NivaranAuthority.vyasa_user_id == user.id,
                NivaranAuthority.is_active.is_(True),
            )
        )
        if not authority or authority.role != NivaranRole.ASSISTANT_DEAN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access restricted to appointed Atharva Veda Assistant Deans.",
            )
        return authority

    @classmethod
    def get_assigned_queue(
        cls,
        db: Session,
        asst_dean_user: User,
        status_filter: Optional[str] = None,
        search: Optional[str] = None,
        priority: Optional[GrievancePriority] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[Grievance], int]:
        """
        Retrieves grievances assigned to this Assistant Dean.
        Enforces record-level jurisdiction: only grievances with an active assignment
        to this Assistant Dean are returned.
        """
        authority = cls.get_assistant_dean_authority(db, asst_dean_user)

        # Base query: active assignments or assigned authority for this Assistant Dean
        active_assigned_ids_stmt = select(Assignment.grievance_id).where(
            Assignment.authority_id == authority.id,
            Assignment.is_active.is_(True),
        )
        other_active_stmt = select(Assignment.grievance_id).where(
            Assignment.authority_id != authority.id,
            Assignment.is_active.is_(True),
        )

        conditions = [
            or_(
                Grievance.id.in_(active_assigned_ids_stmt),
                and_(
                    Grievance.assigned_authority_id == authority.id,
                    ~Grievance.id.in_(other_active_stmt),
                ),
            )
        ]

        if status_filter and status_filter.upper() != "ALL":
            sf = status_filter.upper()
            if sf == "PENDING":
                conditions.append(
                    Grievance.status.in_([GrievanceStatus.ASSIGNED, GrievanceStatus.PENDING_REVIEW])
                )
            elif sf == "IN_PROGRESS":
                conditions.append(Grievance.status == GrievanceStatus.IN_PROGRESS)
            elif sf == "RESOLVED":
                conditions.append(
                    Grievance.status.in_([GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED])
                )
            elif sf in [s.value for s in GrievanceStatus]:
                conditions.append(Grievance.status == GrievanceStatus(sf))

        if priority:
            conditions.append(Grievance.priority == priority)

        if search and search.strip():
            term = f"%{search.strip()}%"
            conditions.append(
                or_(
                    Grievance.grievance_id.ilike(term),
                    Grievance.title.ilike(term),
                    Grievance.description.ilike(term),
                )
            )

        # Count total
        count_stmt = select(func.count(Grievance.id)).where(and_(*conditions))
        total = db.scalar(count_stmt) or 0

        # Items query
        stmt = (
            select(Grievance)
            .options(
                selectinload(Grievance.subject).selectinload(Subject.cluster),
                selectinload(Grievance.category),
                selectinload(Grievance.applicant),
                selectinload(Grievance.assigned_authority),
            )
            .where(and_(*conditions))
            .order_by(desc(Grievance.created_at))
            .offset(max(0, (page - 1) * page_size))
            .limit(page_size)
        )
        items = list(db.scalars(stmt).all())
        return items, total

    @classmethod
    def get_grievance_detail(
        cls,
        db: Session,
        grievance_id_or_tracking: str,
        asst_dean_user: User,
    ) -> Tuple[Grievance, Optional[NivaranAuthority], bool]:
        """
        Retrieves the complete case dossier for the Assistant Dean.
        Enforces record-level jurisdiction: validates active assignment.
        Returns: (grievance, next_stage2_authority, can_forward)
        """
        authority = cls.get_assistant_dean_authority(db, asst_dean_user)

        target_uuid = None
        try:
            target_uuid = uuid.UUID(grievance_id_or_tracking)
        except ValueError:
            target_uuid = None

        grievance = db.scalar(
            select(Grievance)
            .options(
                selectinload(Grievance.subject).selectinload(Subject.cluster),
                selectinload(Grievance.category),
                selectinload(Grievance.applicant),
                selectinload(Grievance.assigned_authority),
            )
            .where(
                (Grievance.id == target_uuid)
                if target_uuid
                else (Grievance.grievance_id == grievance_id_or_tracking)
            )
        )
        if not grievance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Grievance '{grievance_id_or_tracking}' was not found.",
            )

        # Jurisdiction check: ensure this Assistant Dean holds jurisdiction
        active_assignment = db.scalar(
            select(Assignment).where(
                Assignment.grievance_id == grievance.id,
                Assignment.is_active.is_(True),
            )
        )
        if (active_assignment and active_assignment.authority_id != authority.id) or (
            not active_assignment and grievance.assigned_authority_id != authority.id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have jurisdiction to access this grievance. It is not currently assigned to you.",
            )

        # Evaluate Stage 2 destination preview
        next_authority = None
        can_forward = False

        if grievance.status not in {GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED}:
            effective_cat_id = grievance.final_category_id or grievance.category_id
            cat = db.scalar(select(Category).where(Category.id == effective_cat_id))
            if cat and cat.routing_type != CategoryRoutingType.SUBJECT_ASSISTANT_DEAN:
                try:
                    next_authority = DynamicRoutingEngine.resolve_category_route(
                        db=db,
                        category_id=cat.id,
                        subject_id=grievance.subject_id,
                    )
                    can_forward = (next_authority is not None and next_authority.id != authority.id)
                except Exception as e:
                    logger.warning(f"Stage 2 preview calculation error for {grievance.grievance_id}: {e}")

        return grievance, next_authority, can_forward

    @classmethod
    def resolve_grievance(
        cls,
        db: Session,
        grievance_id: uuid.UUID,
        asst_dean_user: User,
        payload: AssistantDeanResolveRequest,
    ) -> Grievance:
        """
        Direct resolution by Assistant Dean:
        1. Row-level concurrency lock on grievance.
        2. Validates active assignment jurisdiction.
        3. Enforces solvable status.
        4. Transitions status to RESOLVED.
        5. Persists resolution_summary, resolved_by_authority_id, resolved_at.
        6. Records status history and AuditLog.
        7. Dispatches in-app notifications to applicant and active Managers.
        """
        authority = cls.get_assistant_dean_authority(db, asst_dean_user)

        grievance = db.scalar(
            select(Grievance).where(Grievance.id == grievance_id).with_for_update()
        )
        if not grievance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Grievance '{grievance_id}' was not found.",
            )

        # Jurisdiction check
        active_assignment = db.scalar(
            select(Assignment).where(
                Assignment.grievance_id == grievance.id,
                Assignment.is_active.is_(True),
            )
        )
        if (active_assignment and active_assignment.authority_id != authority.id) or (
            not active_assignment and grievance.assigned_authority_id != authority.id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only resolve grievances currently assigned to your jurisdiction.",
            )

        # Status validation
        solvable_statuses = {
            GrievanceStatus.ASSIGNED,
            GrievanceStatus.IN_PROGRESS,
            GrievanceStatus.AWAITING_INFORMATION,
            GrievanceStatus.PENDING_REVIEW,
        }
        if grievance.status not in solvable_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Grievance cannot be resolved from its current status: '{grievance.status.value}'.",
            )

        now_utc = datetime.now(timezone.utc)
        from_status = grievance.status.value

        # Update resolution particulars
        grievance.status = GrievanceStatus.RESOLVED
        grievance.resolution_summary = payload.resolution_notes.strip()
        grievance.resolved_by_authority_id = authority.id
        grievance.resolved_at = now_utc

        # Record Status History
        remarks_text = f"Resolved by Assistant Dean {authority.name_snapshot}: {payload.resolution_notes.strip()}"
        history_entry = GrievanceStatusHistory(
            grievance_id=grievance.id,
            from_status=from_status,
            to_status=GrievanceStatus.RESOLVED.value,
            actor_user_id=asst_dean_user.id,
            actor_authority_id=authority.id,
            actor_type=HistoryActorType.USER,
            remarks=remarks_text,
        )
        db.add(history_entry)

        # Record AuditLog
        audit = AuditLog(
            user_id=asst_dean_user.id,
            module="atharva_veda",
            action="GRIEVANCE_RESOLVED",
            entity_name="Grievance",
            entity_id=str(grievance.id),
            details={
                "grievance_id": grievance.grievance_id,
                "resolved_by_authority": authority.name_snapshot,
                "resolved_by_role": authority.role.value,
                "resolution_notes": payload.resolution_notes.strip(),
            },
        )
        db.add(audit)

        # In-App Notifications
        # A. Notify submitting applicant
        if grievance.applicant_vyasa_user_id:
            notif_app = Notification(
                user_id=grievance.applicant_vyasa_user_id,
                title="Grievance Resolved — Feedback Required",
                message=f"Your grievance {grievance.grievance_id} has been resolved. Please review and submit your feedback.",
                type="GRIEVANCE_RESOLVED",
                metadata_json={
                    "grievance_id": str(grievance.id),
                    "tracking_id": grievance.grievance_id,
                    "status": GrievanceStatus.RESOLVED.value,
                },
            )
            db.add(notif_app)

        # B. Notify all active Managers for closure review
        managers = db.scalars(
            select(NivaranAuthority).where(
                NivaranAuthority.role == NivaranRole.MANAGER,
                NivaranAuthority.is_active.is_(True),
            )
        ).all()
        for mgr in managers:
            if mgr.vyasa_user_id:
                notif_mgr = Notification(
                    user_id=mgr.vyasa_user_id,
                    title="Grievance Resolved - Awaiting Closure Review",
                    message=(
                        f"Grievance {grievance.grievance_id} was resolved by "
                        f"{authority.name_snapshot} ({authority.role.value}). Please review and perform final closure."
                    ),
                    type="GRIEVANCE_RESOLVED",
                    metadata_json={
                        "grievance_id": str(grievance.id),
                        "tracking_id": grievance.grievance_id,
                        "status": GrievanceStatus.RESOLVED.value,
                    },
                )
                db.add(notif_mgr)

        db.commit()
        db.refresh(grievance)

        logger.info(
            f"[Grievance Resolved] Case {grievance.grievance_id} resolved by "
            f"Assistant Dean {authority.name_snapshot} ({asst_dean_user.email})"
        )
        return grievance

    @classmethod
    def forward_grievance(
        cls,
        db: Session,
        grievance_id: uuid.UUID,
        asst_dean_user: User,
        payload: AssistantDeanForwardRequest,
    ) -> Tuple[Grievance, NivaranAuthority]:
        """
        Stage 2 Category-Based Forwarding by Assistant Dean:
        1. Row-level concurrency lock on grievance.
        2. Validates active assignment jurisdiction.
        3. Enforces 6 mandatory checklist acknowledgments.
        4. Enforces 3 mandatory justification texts (min 5 chars).
        5. Executes Stage 2 Category Routing: resolves Associate Dean or Fixed Authority.
        6. Deactivates prior active Assistant Dean assignment.
        7. Creates new active Assignment targeting resolved Stage 2 authority.
        8. Persists ForwardingConfirmation record.
        9. Updates grievance.assigned_authority_id.
        10. Records status history and AuditLog.
        11. Dispatches notifications to target authority and applicant.
        """
        authority = cls.get_assistant_dean_authority(db, asst_dean_user)

        grievance = db.scalar(
            select(Grievance).where(Grievance.id == grievance_id).with_for_update()
        )
        if not grievance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Grievance '{grievance_id}' was not found.",
            )

        # Jurisdiction check
        active_assignment = db.scalar(
            select(Assignment).where(
                Assignment.grievance_id == grievance.id,
                Assignment.is_active.is_(True),
            )
        )
        if (active_assignment and active_assignment.authority_id != authority.id) or (
            not active_assignment and grievance.assigned_authority_id != authority.id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only forward grievances currently assigned to your jurisdiction.",
            )

        # Status check
        if grievance.status in {GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot forward a grievance that is already {grievance.status.value}.",
            )

        # 1. Validate 6 Checkboxes
        conf = payload.confirmation
        if not (
            conf.reviewed_details is True
            and conf.reviewed_documents is True
            and conf.understands_status is True
            and conf.action_taken_within_authority is True
            and conf.forwarding_necessary is True
            and conf.accepts_accountability is True
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All 6 forwarding accountability acknowledgments must be explicitly confirmed.",
            )

        # 2. Validate 3 Justifications
        if not (
            conf.forwarding_reason and len(conf.forwarding_reason.strip()) >= 5
            and conf.action_taken and len(conf.action_taken.strip()) >= 5
            and conf.why_higher_intervention_required and len(conf.why_higher_intervention_required.strip()) >= 5
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Forwarding reason, action taken, and higher authority intervention justification must be provided (minimum 5 characters each).",
            )

        # 3. Stage 2 Dynamic Category Routing Resolution
        effective_cat_id = grievance.final_category_id or grievance.category_id
        target_category = db.scalar(select(Category).where(Category.id == effective_cat_id))
        if not target_category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Grievance category not found or inactive.",
            )

        if target_category.routing_type == CategoryRoutingType.SUBJECT_ASSISTANT_DEAN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This grievance category is handled at Assistant Dean level and cannot be forwarded further.",
            )

        try:
            target_authority = DynamicRoutingEngine.resolve_category_route(
                db=db,
                category_id=target_category.id,
                subject_id=grievance.subject_id,
            )
        except RoutingConfigurationError as rce:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Stage 2 Routing Configuration Error: {str(rce)}",
            )

        if target_authority.id == authority.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Forwarding target resolves back to the current authority.",
            )

        now_utc = datetime.now(timezone.utc)

        # 4. Deactivate prior assignment
        if active_assignment:
            active_assignment.is_active = False
            active_assignment.unassigned_at = now_utc
            db.add(active_assignment)

        # 5. Create new active assignment
        new_assignment = Assignment(
            grievance_id=grievance.id,
            authority_id=target_authority.id,
            assigned_by_id=authority.id,
            assignment_reason=payload.remarks or conf.forwarding_reason.strip(),
            is_active=True,
            assigned_at=now_utc,
        )
        db.add(new_assignment)

        # 6. Record Forwarding Confirmation
        fwd_conf = ForwardingConfirmation(
            grievance_id=grievance.id,
            forwarded_by_authority_id=authority.id,
            forwarded_to_authority_id=target_authority.id,
            jurisdiction_verified=conf.reviewed_details,
            evidence_reviewed=conf.reviewed_documents,
            prior_actions_checked=conf.understands_status,
            urgency_assessed=conf.action_taken_within_authority,
            identity_confirmed=conf.forwarding_necessary,
            conflict_of_interest_cleared=conf.accepts_accountability,
            justification_reason=conf.forwarding_reason.strip(),
            actions_taken_summary=conf.action_taken.strip(),
            expected_outcome=conf.why_higher_intervention_required.strip(),
            created_at=now_utc,
        )
        db.add(fwd_conf)

        # 7. Update grievance assigned authority
        from_status = grievance.status.value
        grievance.assigned_authority_id = target_authority.id
        grievance.status = GrievanceStatus.ASSIGNED

        # 8. Record Status History
        fwd_reason = (
            f"Forwarded by {authority.name_snapshot} ({authority.role.value}) "
            f"to {target_authority.name_snapshot} ({target_authority.role.value}): {conf.forwarding_reason.strip()}"
        )
        if payload.remarks and payload.remarks.strip():
            fwd_reason += f" Remarks: {payload.remarks.strip()}"

        history_entry = GrievanceStatusHistory(
            grievance_id=grievance.id,
            from_status=from_status,
            to_status=GrievanceStatus.ASSIGNED.value,
            actor_user_id=asst_dean_user.id,
            actor_authority_id=authority.id,
            actor_type=HistoryActorType.USER,
            remarks=fwd_reason,
        )
        db.add(history_entry)

        # 9. Record AuditLog
        audit = AuditLog(
            user_id=asst_dean_user.id,
            module="atharva_veda",
            action="GRIEVANCE_FORWARDED",
            entity_name="Grievance",
            entity_id=str(grievance.id),
            details={
                "grievance_id": grievance.grievance_id,
                "forwarded_by": authority.name_snapshot,
                "forwarded_to": target_authority.name_snapshot,
                "forwarded_to_role": target_authority.role.value,
                "category": target_category.name,
                "routing_type": target_category.routing_type.value,
                "forwarding_reason": conf.forwarding_reason.strip(),
                "action_taken": conf.action_taken.strip(),
                "why_higher_intervention_required": conf.why_higher_intervention_required.strip(),
            },
        )
        db.add(audit)

        # 10. In-App Notifications
        # A. Notify target authority
        if target_authority.vyasa_user_id:
            notif_target = Notification(
                user_id=target_authority.vyasa_user_id,
                title="Grievance Forwarded to You",
                message=(
                    f"Grievance {grievance.grievance_id} has been forwarded to you by "
                    f"{authority.name_snapshot} ({authority.role.value})."
                ),
                type="GRIEVANCE_FORWARDED",
                metadata_json={
                    "grievance_id": str(grievance.id),
                    "tracking_id": grievance.grievance_id,
                    "assigned_authority": target_authority.name_snapshot,
                },
            )
            db.add(notif_target)

        # B. Notify applicant
        if grievance.applicant_vyasa_user_id:
            notif_app = Notification(
                user_id=grievance.applicant_vyasa_user_id,
                title="Grievance Forwarded",
                message=(
                    f"Your grievance {grievance.grievance_id} has been forwarded to "
                    f"{target_authority.name_snapshot} ({target_authority.role.value}) for further review."
                ),
                type="GRIEVANCE_STATUS_CHANGED",
                metadata_json={
                    "grievance_id": str(grievance.id),
                    "tracking_id": grievance.grievance_id,
                    "status": grievance.status.value,
                    "assigned_authority": target_authority.name_snapshot,
                },
            )
            db.add(notif_app)

        db.commit()
        db.refresh(grievance)

        logger.info(
            f"[Grievance Forwarded] Case {grievance.grievance_id} forwarded from "
            f"{authority.name_snapshot} to {target_authority.name_snapshot} ({target_authority.role.value})"
        )
        return grievance, target_authority

    @classmethod
    def request_documents(
        cls,
        db: Session,
        grievance_id: uuid.UUID,
        asst_dean_user: User,
        payload: AssistantDeanDocumentRequestPayload,
    ) -> List[DocumentRequest]:
        """
        Requests additional documents from applicant:
        1. Validates active assignment jurisdiction.
        2. Pauses grievance in AWAITING_INFORMATION.
        3. Preserves current active assignment.
        4. Inserts DocumentRequest records.
        5. Records StatusHistory and AuditLog.
        6. Dispatches notification to applicant.
        """
        authority = cls.get_assistant_dean_authority(db, asst_dean_user)

        grievance = db.scalar(
            select(Grievance).where(Grievance.id == grievance_id).with_for_update()
        )
        if not grievance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Grievance '{grievance_id}' was not found.",
            )

        active_assignment = db.scalar(
            select(Assignment).where(
                Assignment.grievance_id == grievance.id,
                Assignment.is_active.is_(True),
            )
        )
        if (active_assignment and active_assignment.authority_id != authority.id) or (
            not active_assignment and grievance.assigned_authority_id != authority.id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only request documents for grievances currently assigned to your jurisdiction.",
            )

        if grievance.status in {GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot request documents for a {grievance.status.value} grievance.",
            )

        group_id = uuid.uuid4()
        now_utc = datetime.now(timezone.utc)
        created_requests = []
        doc_names = []

        for item in payload.documents:
            dr = DocumentRequest(
                grievance_id=grievance.id,
                requested_by_id=authority.id,
                request_group_id=group_id,
                document_name=item.document_name.strip(),
                description=item.description.strip() if item.description else None,
                due_date=payload.deadline,
                status=DocumentRequestStatus.PENDING,
                created_at=now_utc,
            )
            db.add(dr)
            created_requests.append(dr)
            doc_names.append(item.document_name.strip())

        from_status = grievance.status.value
        grievance.status = GrievanceStatus.AWAITING_INFORMATION

        history_entry = GrievanceStatusHistory(
            grievance_id=grievance.id,
            from_status=from_status,
            to_status=GrievanceStatus.AWAITING_INFORMATION.value,
            actor_user_id=asst_dean_user.id,
            actor_authority_id=authority.id,
            actor_type=HistoryActorType.USER,
            remarks=f"Additional document(s) requested by {authority.name_snapshot}: {', '.join(doc_names)}",
        )
        db.add(history_entry)

        audit = AuditLog(
            user_id=asst_dean_user.id,
            module="atharva_veda",
            action="DOCUMENT_REQUESTED",
            entity_name="Grievance",
            entity_id=str(grievance.id),
            details={
                "grievance_id": grievance.grievance_id,
                "requested_by": authority.name_snapshot,
                "requested_documents": doc_names,
            },
        )
        db.add(audit)

        if grievance.applicant_vyasa_user_id:
            notif_app = Notification(
                user_id=grievance.applicant_vyasa_user_id,
                title="Additional Document(s) Required",
                message=(
                    f"Additional document(s) requested for grievance {grievance.grievance_id} by "
                    f"{authority.name_snapshot} ({authority.role.value}): {', '.join(doc_names)}. "
                    "Please upload the requested document(s) to proceed."
                ),
                type="DOCUMENT_REQUESTED",
                metadata_json={
                    "grievance_id": str(grievance.id),
                    "tracking_id": grievance.grievance_id,
                    "status": grievance.status.value,
                },
            )
            db.add(notif_app)

        db.commit()
        for r in created_requests:
            db.refresh(r)

        return created_requests

    @classmethod
    def request_committee(
        cls,
        db: Session,
        grievance_id: uuid.UUID,
        asst_dean_user: User,
        payload: AssistantDeanCommitteeRequestPayload,
    ) -> CommitteeCreationRequest:
        """
        Initiates a formal CommitteeCreationRequest:
        1. Validates active assignment jurisdiction.
        2. Prevents duplicate active requests.
        3. Identifies target higher authority (Associate Dean, Fixed Authority, or Dean).
        4. Inserts CommitteeCreationRequest.
        5. Records AuditLog.
        6. Dispatches notification to target authority.
        """
        authority = cls.get_assistant_dean_authority(db, asst_dean_user)

        grievance = db.scalar(
            select(Grievance).where(Grievance.id == grievance_id).with_for_update()
        )
        if not grievance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Grievance '{grievance_id}' was not found.",
            )

        active_assignment = db.scalar(
            select(Assignment).where(
                Assignment.grievance_id == grievance.id,
                Assignment.is_active.is_(True),
            )
        )
        if (active_assignment and active_assignment.authority_id != authority.id) or (
            not active_assignment and grievance.assigned_authority_id != authority.id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only request committee creation for grievances currently assigned to your jurisdiction.",
            )

        if grievance.status in {GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot request committee creation for a {grievance.status.value} grievance.",
            )

        # Check existing active pending request
        existing_req = db.scalar(
            select(CommitteeCreationRequest).where(
                CommitteeCreationRequest.grievance_id == grievance.id,
                CommitteeCreationRequest.request_status == CommitteeRequestStatus.PENDING,
            )
        )
        if existing_req:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An active committee creation request is already pending for this grievance.",
            )

        # Resolve target authority
        target_authority = None
        if payload.target_authority_id:
            target_authority = db.scalar(
                select(NivaranAuthority).where(
                    NivaranAuthority.id == payload.target_authority_id,
                    NivaranAuthority.is_active.is_(True),
                )
            )
        else:
            # Fallback to category Associate Dean or Dean
            effective_cat_id = grievance.final_category_id or grievance.category_id
            cat = db.scalar(select(Category).where(Category.id == effective_cat_id))
            if cat and cat.routing_type in {CategoryRoutingType.CLUSTER, CategoryRoutingType.GRIEVANCE_CLUSTER, CategoryRoutingType.FIXED_AUTHORITY}:
                try:
                    target_authority = DynamicRoutingEngine.resolve_category_route(db, cat.id, grievance.subject_id)
                except Exception:
                    pass

            if not target_authority:
                # Default to Dean
                target_authority = db.scalar(
                    select(NivaranAuthority).where(
                        NivaranAuthority.role == NivaranRole.DEAN,
                        NivaranAuthority.is_active.is_(True),
                    )
                )

        now_utc = datetime.now(timezone.utc)
        req = CommitteeCreationRequest(
            grievance_id=grievance.id,
            requested_by_id=authority.id,
            request_status=CommitteeRequestStatus.PENDING,
            justification=payload.justification.strip(),
            proposed_members_snapshot={
                "proposed_scope": payload.proposed_scope,
                "supporting_remarks": payload.supporting_remarks,
                "target_authority_id": str(target_authority.id) if target_authority else None,
                "target_authority_name": target_authority.name_snapshot if target_authority else None,
            },
            created_at=now_utc,
        )
        db.add(req)

        audit = AuditLog(
            user_id=asst_dean_user.id,
            module="atharva_veda",
            action="COMMITTEE_CREATION_REQUESTED",
            entity_name="Grievance",
            entity_id=str(grievance.id),
            details={
                "grievance_id": grievance.grievance_id,
                "requested_by": authority.name_snapshot,
                "justification": payload.justification.strip(),
                "target_authority": target_authority.name_snapshot if target_authority else "Dean",
            },
        )
        db.add(audit)

        if target_authority and target_authority.vyasa_user_id:
            notif_target = Notification(
                user_id=target_authority.vyasa_user_id,
                title="Committee Creation Requested",
                message=(
                    f"Assistant Dean {authority.name_snapshot} requested committee formation for "
                    f"grievance {grievance.grievance_id}."
                ),
                type="COMMITTEE_REQUEST_RECEIVED",
                metadata_json={
                    "grievance_id": str(grievance.id),
                    "tracking_id": grievance.grievance_id,
                },
            )
            db.add(notif_target)

        db.commit()
        db.refresh(req)

        return req
