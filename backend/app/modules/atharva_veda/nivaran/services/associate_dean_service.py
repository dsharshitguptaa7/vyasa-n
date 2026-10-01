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
from app.modules.atharva_veda.nivaran.models.taxonomy import Category, Subject, GrievanceCluster
from app.modules.atharva_veda.nivaran.schemas.associate_dean import (
    AssociateDeanCommitteeRequestPayload,
    AssociateDeanDocumentRequestPayload,
    AssociateDeanForwardRequest,
    AssociateDeanResolveRequest,
    CommitteeRequestResponseItem,
    DocumentRequestResponseItem,
)
from app.modules.atharva_veda.nivaran.services.routing_service import (
    DynamicRoutingEngine,
    RoutingConfigurationError,
)

logger = logging.getLogger("vyasa.atharva.associate_dean")


class AssociateDeanService:
    @staticmethod
    def get_associate_dean_authority(db: Session, user: User) -> NivaranAuthority:
        """
        Validates caller identity as an active appointed ASSOCIATE_DEAN authority.
        """
        authority = db.scalar(
            select(NivaranAuthority).where(
                NivaranAuthority.vyasa_user_id == user.id,
                NivaranAuthority.is_active.is_(True),
            )
        )
        if not authority or authority.role != NivaranRole.ASSOCIATE_DEAN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access restricted to appointed Atharva Veda Associate Deans.",
            )
        return authority

    @classmethod
    def get_assigned_queue(
        cls,
        db: Session,
        assoc_dean_user: User,
        status_filter: Optional[str] = None,
        search: Optional[str] = None,
        priority: Optional[GrievancePriority] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[Grievance], int]:
        """
        Retrieves grievances assigned to this Associate Dean.
        Enforces record-level jurisdiction: only grievances with an active assignment
        to this Associate Dean are returned.
        """
        authority = cls.get_associate_dean_authority(db, assoc_dean_user)

        # Base query: active assignments or assigned authority for this Associate Dean
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
            elif sf == "ESCALATED":
                conditions.append(Grievance.status == GrievanceStatus.ESCALATED)
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
    def get_dashboard_stats(
        cls,
        db: Session,
        assoc_dean_user: User,
    ) -> dict:
        """
        Calculates aggregate docket statistics for the Associate Dean.
        """
        authority = cls.get_associate_dean_authority(db, assoc_dean_user)

        cluster = db.scalar(
            select(GrievanceCluster).where(
                GrievanceCluster.associate_dean_id == authority.id,
                GrievanceCluster.is_active.is_(True),
            )
        )

        active_assigned_ids_stmt = select(Assignment.grievance_id).where(
            Assignment.authority_id == authority.id,
            Assignment.is_active.is_(True),
        )
        other_active_stmt = select(Assignment.grievance_id).where(
            Assignment.authority_id != authority.id,
            Assignment.is_active.is_(True),
        )

        base_condition = or_(
            Grievance.id.in_(active_assigned_ids_stmt),
            and_(
                Grievance.assigned_authority_id == authority.id,
                ~Grievance.id.in_(other_active_stmt),
            ),
        )

        total = db.scalar(select(func.count(Grievance.id)).where(base_condition)) or 0
        pending = db.scalar(
            select(func.count(Grievance.id)).where(
                and_(
                    base_condition,
                    Grievance.status.in_([GrievanceStatus.ASSIGNED, GrievanceStatus.PENDING_REVIEW]),
                )
            )
        ) or 0
        in_progress = db.scalar(
            select(func.count(Grievance.id)).where(
                and_(base_condition, Grievance.status == GrievanceStatus.IN_PROGRESS)
            )
        ) or 0
        resolved = db.scalar(
            select(func.count(Grievance.id)).where(
                and_(
                    base_condition,
                    Grievance.status.in_([GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED]),
                )
            )
        ) or 0
        escalated = db.scalar(
            select(func.count(Grievance.id)).where(
                and_(base_condition, Grievance.status == GrievanceStatus.ESCALATED)
            )
        ) or 0

        return {
            "total_assigned": total,
            "pending": pending,
            "in_progress": in_progress,
            "resolved": resolved,
            "escalated": escalated,
            "grievance_cluster_id": cluster.id if cluster else None,
            "grievance_cluster_name": cluster.name if cluster else None,
        }

    @classmethod
    def get_grievance_detail(
        cls,
        db: Session,
        grievance_id_or_tracking: str,
        assoc_dean_user: User,
    ) -> Tuple[Grievance, Optional[NivaranAuthority], bool]:
        """
        Retrieves the complete case dossier for the Associate Dean.
        Enforces record-level jurisdiction: validates active assignment.
        Returns: (grievance, next_stage3_dean_authority, can_forward)
        """
        authority = cls.get_associate_dean_authority(db, assoc_dean_user)

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

        # Jurisdiction check: ensure this Associate Dean holds jurisdiction
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

        # Evaluate Stage 3 destination preview (Dean R&D - Executive Tier)
        next_authority = None
        can_forward = False

        if grievance.status not in {GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED}:
            try:
                next_authority = DynamicRoutingEngine.resolve_dean_route(db)
                can_forward = (next_authority is not None and next_authority.id != authority.id)
            except Exception as e:
                logger.warning(f"Dean preview calculation error for {grievance.grievance_id}: {e}")

        return grievance, next_authority, can_forward

    @classmethod
    def resolve_grievance(
        cls,
        db: Session,
        grievance_id: uuid.UUID,
        assoc_dean_user: User,
        payload: AssociateDeanResolveRequest,
    ) -> Grievance:
        """
        Direct resolution by Associate Dean:
        1. Row-level concurrency lock on grievance.
        2. Validates active assignment jurisdiction.
        3. Enforces solvable status.
        4. Transitions status to RESOLVED.
        5. Persists resolution_summary, resolved_by_authority_id, resolved_at.
        6. Records status history and AuditLog.
        7. Dispatches in-app notifications to applicant and active Managers.
        """
        authority = cls.get_associate_dean_authority(db, assoc_dean_user)

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
            GrievanceStatus.ESCALATED,
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
        remarks_text = f"Resolved by Associate Dean {authority.name_snapshot}: {payload.resolution_notes.strip()}"
        history_entry = GrievanceStatusHistory(
            grievance_id=grievance.id,
            from_status=from_status,
            to_status=GrievanceStatus.RESOLVED.value,
            actor_user_id=assoc_dean_user.id,
            actor_authority_id=authority.id,
            actor_type=HistoryActorType.USER,
            remarks=remarks_text,
        )
        db.add(history_entry)

        # Record AuditLog
        audit = AuditLog(
            user_id=assoc_dean_user.id,
            module="atharva_veda",
            action="GRIEVANCE_RESOLVED",
            entity_name="Grievance",
            entity_id=str(grievance.id),
            details={
                "description": (
                    f"Associate Dean {authority.name_snapshot} resolved grievance {grievance.grievance_id}. "
                    f"Resolution summary: {payload.resolution_notes.strip()[:120]}..."
                ),
                "grievance_id": str(grievance.id),
                "tracking_id": grievance.grievance_id,
                "authority_id": str(authority.id),
                "authority_role": authority.role.value,
                "authority_name": authority.name_snapshot,
                "resolved_at": now_utc.isoformat(),
            },
        )
        db.add(audit)

        # Notify Applicant
        if grievance.applicant_vyasa_user_id:
            notif_app = Notification(
                user_id=grievance.applicant_vyasa_user_id,
                title="Grievance Resolved by Associate Dean",
                message=(
                    f"Your grievance {grievance.grievance_id} ('{grievance.title}') has been formally resolved by "
                    f"Associate Dean {authority.name_snapshot}."
                ),
                type="GRIEVANCE_RESOLVED",
                metadata_json={
                    "grievance_id": str(grievance.id),
                    "tracking_id": grievance.grievance_id,
                    "status": GrievanceStatus.RESOLVED.value,
                },
            )
            db.add(notif_app)

        # Notify active Atharva Veda Managers
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
            f"Associate Dean {authority.name_snapshot} ({assoc_dean_user.email})"
        )
        return grievance

    @classmethod
    def forward_grievance(
        cls,
        db: Session,
        grievance_id: uuid.UUID,
        assoc_dean_user: User,
        payload: AssociateDeanForwardRequest,
    ) -> Tuple[Grievance, NivaranAuthority]:
        """
        Stage 3 Forwarding / Escalation to Dean by Associate Dean:
        1. Row-level concurrency lock on grievance.
        2. Validates active assignment jurisdiction.
        3. Validates justification (reason/remarks or confirmation).
        4. Resolves downstream Dean target authority via DynamicRoutingEngine.
        5. Deactivates prior active Associate Dean assignment.
        6. Creates new active Assignment targeting Dean.
        7. Records ForwardingConfirmation record.
        8. Updates grievance.assigned_authority_id and sets status to ESCALATED.
        9. Records status history and AuditLog.
        10. Dispatches notifications to Dean and applicant.
        """
        authority = cls.get_associate_dean_authority(db, assoc_dean_user)

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
        if grievance.status in {GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED, GrievanceStatus.ESCALATED}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot forward a grievance that is already {grievance.status.value}.",
            )

        # Justification validation
        reason_text = payload.justification or payload.reason or payload.remarks
        conf = payload.confirmation

        if conf:
            # If confirmation payload provided, validate affirmations
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
            if not (
                conf.forwarding_reason and len(conf.forwarding_reason.strip()) >= 5
                and conf.action_taken and len(conf.action_taken.strip()) >= 5
                and conf.why_higher_intervention_required and len(conf.why_higher_intervention_required.strip()) >= 5
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Forwarding reason, action taken, and higher authority intervention justification must be provided (minimum 5 characters each).",
                )
            reason_text = conf.forwarding_reason.strip()
        else:
            if not reason_text or len(reason_text.strip()) < 5:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Institutional escalation remarks/reason must be provided (minimum 5 characters).",
                )
            reason_text = reason_text.strip()

        # Dynamic Dean Routing Resolution
        try:
            target_authority = DynamicRoutingEngine.resolve_dean_route(db)
        except RoutingConfigurationError as rce:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Dean Routing Configuration Error: {str(rce)}",
            )

        if target_authority.id == authority.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Forwarding target resolves back to the current authority.",
            )

        now_utc = datetime.now(timezone.utc)

        # Deactivate prior assignment
        if active_assignment:
            active_assignment.is_active = False
            active_assignment.unassigned_at = now_utc
            db.add(active_assignment)

        # Create new active assignment
        new_assignment = Assignment(
            grievance_id=grievance.id,
            authority_id=target_authority.id,
            assigned_by_id=authority.id,
            assignment_reason=payload.remarks or reason_text,
            is_active=True,
            assigned_at=now_utc,
        )
        db.add(new_assignment)

        # Record Forwarding Confirmation
        if conf:
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
        else:
            fwd_conf = ForwardingConfirmation(
                grievance_id=grievance.id,
                forwarded_by_authority_id=authority.id,
                forwarded_to_authority_id=target_authority.id,
                jurisdiction_verified=True,
                evidence_reviewed=True,
                prior_actions_checked=True,
                urgency_assessed=True,
                identity_confirmed=True,
                conflict_of_interest_cleared=True,
                justification_reason=reason_text,
                actions_taken_summary="Associate Dean review and high-tier escalation",
                expected_outcome="Executive determination by Dean R&D",
                created_at=now_utc,
            )
        db.add(fwd_conf)

        # Update grievance assigned authority & status
        from_status = grievance.status.value
        grievance.assigned_authority_id = target_authority.id
        grievance.status = GrievanceStatus.ESCALATED

        # Record Status History
        fwd_reason = (
            f"Escalated by {authority.name_snapshot} ({authority.role.value}) "
            f"to {target_authority.name_snapshot} ({target_authority.role.value}): {reason_text}"
        )
        history_entry = GrievanceStatusHistory(
            grievance_id=grievance.id,
            from_status=from_status,
            to_status=GrievanceStatus.ESCALATED.value,
            actor_user_id=assoc_dean_user.id,
            actor_authority_id=authority.id,
            actor_type=HistoryActorType.USER,
            remarks=fwd_reason,
        )
        db.add(history_entry)

        # Record AuditLog
        audit = AuditLog(
            user_id=assoc_dean_user.id,
            module="atharva_veda",
            action="GRIEVANCE_ESCALATED",
            entity_name="Grievance",
            entity_id=str(grievance.id),
            details={
                "description": (
                    f"Associate Dean {authority.name_snapshot} escalated grievance {grievance.grievance_id} "
                    f"to Dean {target_authority.name_snapshot}. Reason: {reason_text[:120]}..."
                ),
                "grievance_id": str(grievance.id),
                "tracking_id": grievance.grievance_id,
                "from_authority_id": str(authority.id),
                "from_authority_role": authority.role.value,
                "from_authority_name": authority.name_snapshot,
                "to_authority_id": str(target_authority.id),
                "to_authority_role": target_authority.role.value,
                "to_authority_name": target_authority.name_snapshot,
                "assignment_id": str(new_assignment.id),
                "escalated_at": now_utc.isoformat(),
            },
        )
        db.add(audit)

        # Notify Dean
        if target_authority.vyasa_user_id:
            notif_dean = Notification(
                user_id=target_authority.vyasa_user_id,
                title="Grievance Escalated to Dean R&D",
                message=(
                    f"Grievance {grievance.grievance_id} ('{grievance.title}') has been escalated to you by "
                    f"Associate Dean {authority.name_snapshot}. Reason: {reason_text}"
                ),
                type="GRIEVANCE_ESCALATED",
                metadata_json={
                    "grievance_id": str(grievance.id),
                    "tracking_id": grievance.grievance_id,
                    "from_authority": authority.name_snapshot,
                    "status": GrievanceStatus.ESCALATED.value,
                },
            )
            db.add(notif_dean)

        # Notify Applicant
        if grievance.applicant_vyasa_user_id:
            notif_app = Notification(
                user_id=grievance.applicant_vyasa_user_id,
                title="Grievance Escalated for Executive Review",
                message=(
                    f"Your grievance {grievance.grievance_id} has been escalated to "
                    f"Dean {target_authority.name_snapshot} for executive determination."
                ),
                type="GRIEVANCE_FORWARDED",
                metadata_json={
                    "grievance_id": str(grievance.id),
                    "tracking_id": grievance.grievance_id,
                    "status": GrievanceStatus.ESCALATED.value,
                },
            )
            db.add(notif_app)

        db.commit()
        db.refresh(grievance)

        logger.info(
            f"[Grievance Escalated] Case {grievance.grievance_id} escalated by "
            f"Associate Dean {authority.name_snapshot} to Dean {target_authority.name_snapshot}"
        )
        return grievance, target_authority

    @classmethod
    def request_documents(
        cls,
        db: Session,
        grievance_id: uuid.UUID,
        assoc_dean_user: User,
        payload: AssociateDeanDocumentRequestPayload,
    ) -> List[DocumentRequest]:
        """
        Creates document requests for evidentiary clarification.
        """
        authority = cls.get_associate_dean_authority(db, assoc_dean_user)

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
                detail="Cannot request documents for a resolved or closed grievance.",
            )

        req_group_id = uuid.uuid4()
        now_utc = datetime.now(timezone.utc)
        created_requests: List[DocumentRequest] = []

        for item in payload.documents:
            doc_req = DocumentRequest(
                id=uuid.uuid4(),
                grievance_id=grievance.id,
                request_group_id=req_group_id,
                requested_by_id=authority.id,
                document_name=item.document_name.strip(),
                description=item.description.strip() if item.description else None,
                due_date=payload.deadline,
                status=DocumentRequestStatus.PENDING,
                created_at=now_utc,
            )
            db.add(doc_req)
            created_requests.append(doc_req)

        from_status = grievance.status.value
        grievance.status = GrievanceStatus.AWAITING_INFORMATION

        history_entry = GrievanceStatusHistory(
            grievance_id=grievance.id,
            from_status=from_status,
            to_status=GrievanceStatus.AWAITING_INFORMATION.value,
            actor_user_id=assoc_dean_user.id,
            actor_authority_id=authority.id,
            actor_type=HistoryActorType.USER,
            remarks=f"Additional documents requested by Associate Dean {authority.name_snapshot}: {', '.join([d.document_name for d in payload.documents])}",
        )
        db.add(history_entry)

        audit = AuditLog(
            user_id=assoc_dean_user.id,
            module="atharva_veda",
            action="DOCUMENT_REQUESTED",
            entity_name="DocumentRequest",
            entity_id=str(req_group_id),
            details={
                "description": (
                    f"Associate Dean {authority.name_snapshot} requested {len(payload.documents)} document(s) "
                    f"for grievance {grievance.grievance_id}."
                ),
                "grievance_id": str(grievance.id),
                "tracking_id": grievance.grievance_id,
                "request_group_id": str(req_group_id),
                "documents": [d.document_name for d in payload.documents],
            },
        )
        db.add(audit)

        if grievance.applicant_vyasa_user_id:
            notif_app = Notification(
                user_id=grievance.applicant_vyasa_user_id,
                title="Additional Documents Requested",
                message=(
                    f"Associate Dean {authority.name_snapshot} has requested {len(payload.documents)} additional "
                    f"supporting document(s) for your grievance {grievance.grievance_id}."
                ),
                type="DOCUMENT_REQUEST",
                metadata_json={
                    "grievance_id": str(grievance.id),
                    "tracking_id": grievance.grievance_id,
                    "request_group_id": str(req_group_id),
                },
            )
            db.add(notif_app)

        db.commit()
        return created_requests

    @classmethod
    def request_committee(
        cls,
        db: Session,
        grievance_id: uuid.UUID,
        assoc_dean_user: User,
        payload: AssociateDeanCommitteeRequestPayload,
    ) -> CommitteeCreationRequest:
        """
        Creates a committee creation request for special inquiry.
        """
        authority = cls.get_associate_dean_authority(db, assoc_dean_user)

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
                detail="You can only request committee formation for grievances currently assigned to your jurisdiction.",
            )

        if grievance.status in {GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot request committee for a resolved or closed grievance.",
            )

        # Check existing active pending committee request
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

        target_auth_id = payload.target_authority_id
        if not target_auth_id:
            dean_auth = db.scalar(
                select(NivaranAuthority).where(
                    NivaranAuthority.role == NivaranRole.DEAN,
                    NivaranAuthority.is_active.is_(True),
                )
            )
            if dean_auth:
                target_auth_id = dean_auth.id

        now_utc = datetime.now(timezone.utc)
        comm_req = CommitteeCreationRequest(
            id=uuid.uuid4(),
            grievance_id=grievance.id,
            requested_by_id=authority.id,
            request_status=CommitteeRequestStatus.PENDING,
            justification=payload.justification.strip(),
            proposed_members_snapshot={
                "proposed_scope": payload.proposed_scope.strip() if payload.proposed_scope else None,
                "supporting_remarks": payload.supporting_remarks.strip() if payload.supporting_remarks else None,
                "target_authority_id": str(target_auth_id) if target_auth_id else None,
            },
            created_at=now_utc,
        )
        db.add(comm_req)

        audit = AuditLog(
            user_id=assoc_dean_user.id,
            module="atharva_veda",
            action="COMMITTEE_REQUESTED",
            entity_name="CommitteeCreationRequest",
            entity_id=str(comm_req.id),
            details={
                "description": (
                    f"Associate Dean {authority.name_snapshot} requested committee creation for grievance {grievance.grievance_id}. "
                    f"Justification: {payload.justification.strip()[:120]}..."
                ),
                "grievance_id": str(grievance.id),
                "tracking_id": grievance.grievance_id,
                "committee_request_id": str(comm_req.id),
                "target_authority_id": str(target_auth_id) if target_auth_id else None,
            },
        )
        db.add(audit)

        db.commit()
        db.refresh(comm_req)
        return comm_req
