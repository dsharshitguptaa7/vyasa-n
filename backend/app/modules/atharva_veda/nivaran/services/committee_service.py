import base64
import hashlib
import logging
import os
from pathlib import Path
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple, Dict

from fastapi import HTTPException, status
from sqlalchemy import select, and_, or_, desc, func
from sqlalchemy.orm import Session, selectinload

from app.models.audit import AuditLog
from app.models.notification import Notification
from app.models.user import User
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.committee import (
    CommitteeCreationRequest,
    GrievanceCommittee,
    CommitteeMember,
    CommitteeMessage,
    CommitteePoll,
    CommitteePollOption,
    CommitteePollVoter,
    CommitteePollVote,
    CommitteeDecisionRecord,
    CommitteeMeeting,
    CommitteeMeetingParticipant,
    CommitteeFormalDecision,
)
from app.modules.atharva_veda.nivaran.models.document import Document
from app.modules.atharva_veda.nivaran.models.enums import (
    CommitteeMemberRole,
    CommitteeRequestStatus,
    CommitteeStatus,
    CommitteeVotingPolicy,
    CommitteePollStatus,
    CommitteeDecisionStatus,
    MeetingType,
    MeetingStatus,
    GrievanceStatus,
    NivaranRole,
)
from app.modules.atharva_veda.nivaran.models.grievance import Grievance
from app.modules.atharva_veda.nivaran.models.routing import Assignment
from app.modules.atharva_veda.nivaran.models.taxonomy import Category, GrievanceCluster, SubjectCluster, Subject
from app.modules.atharva_veda.nivaran.schemas.committee import (
    CommitteeDirectCreatePayload,
    CommitteeMemberResponseItem,
    CommitteeRequestDetailedResponseItem,
    CommitteeRequestReviewAction,
    CommitteeRequestReviewPayload,
    CommitteeResponseItem,
    CommitteeOverviewMetricsResponse,
    CommitteeMessageCreatePayload,
    CommitteeMessageResponseItem,
    CommitteePollCreatePayload,
    CommitteePollResponseItem,
    CommitteePollOptionResponseItem,
    CommitteePollVotePayload,
    CommitteeMeetingCreatePayload,
    CommitteeMeetingUpdatePayload,
    CommitteeMeetingResponseItem,
    CommitteeMeetingParticipantItem,
    CommitteeDocumentResponseItem,
    CommitteeDocumentUploadPayload,
    CommitteeFormalDecisionCreatePayload,
    CommitteeFormalDecisionResponseItem,
    CommitteeWorkspaceDetailResponse,
)
from app.modules.atharva_veda.nivaran.services.committee_chat_ws import committee_chat_manager
from app.modules.atharva_veda.nivaran.services.google_meet_service import GoogleMeetService
from app.modules.atharva_veda.nivaran.services.routing_service import DynamicRoutingEngine
from app.schemas.notification import NotificationEventPayload
from app.services.notifications.engine import engine as notification_engine

logger = logging.getLogger("vyasa.atharva.committee")
STORAGE_BASE_DIR = Path("storage/uploads")


class CommitteeService:
    @classmethod
    def get_authority_for_user(cls, db: Session, user: User) -> NivaranAuthority:
        """
        Resolves the active NivaranAuthority for the user. Raises 403 if not found.
        """
        authority = db.scalar(
            select(NivaranAuthority).where(
                NivaranAuthority.vyasa_user_id == user.id,
                NivaranAuthority.is_active.is_(True),
            )
        )
        if not authority:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Institutional authority profile required for this action.",
            )
        return authority

    @classmethod
    def validate_grievance_jurisdiction(
        cls, db: Session, grievance: Grievance, authority: NivaranAuthority
    ) -> None:
        """
        Validates whether authority has jurisdictional scope over the grievance.
        Dean has institution-wide scope.
        Associate / Assistant Deans must be assigned or match cluster/category.
        """
        if authority.role == NivaranRole.DEAN:
            return

        active_assignment = db.scalar(
            select(Assignment).where(
                Assignment.grievance_id == grievance.id,
                Assignment.authority_id == authority.id,
                Assignment.is_active.is_(True),
            )
        )
        is_directly_assigned = (
            (active_assignment is not None)
            or grievance.assigned_authority_id == authority.id
        )

        if is_directly_assigned:
            return

        # Check cluster / category alignment for Associate Dean
        if authority.role == NivaranRole.ASSOCIATE_DEAN:
            effective_cat_id = grievance.final_category_id or grievance.category_id
            if effective_cat_id:
                cat = db.scalar(select(Category).where(Category.id == effective_cat_id))
                if cat and cat.grievance_cluster_id:
                    cluster = db.scalar(select(GrievanceCluster).where(GrievanceCluster.id == cat.grievance_cluster_id))
                    if cluster and cluster.associate_dean_id == authority.id:
                        return

        # Check subject cluster for Assistant Dean
        if authority.role == NivaranRole.ASSISTANT_DEAN:
            if grievance.subject_id:
                sub = db.scalar(select(Subject).where(Subject.id == grievance.subject_id))
                if sub and sub.cluster_id:
                    s_cluster = db.scalar(select(SubjectCluster).where(SubjectCluster.id == sub.cluster_id))
                    if s_cluster and s_cluster.assistant_dean_id == authority.id:
                        return

        # If not assigned and not matching cluster
        if not is_directly_assigned:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have jurisdiction over this grievance.",
            )

    @classmethod
    def submit_request(
        cls,
        db: Session,
        grievance_id: uuid.UUID,
        requester_user: User,
        justification: str,
        target_authority_id: Optional[uuid.UUID] = None,
        proposed_scope: Optional[str] = None,
        supporting_remarks: Optional[str] = None,
    ) -> CommitteeCreationRequest:
        """
        Enforces Authoritative Permission Matrix:
        - Assistant Dean -> Associate Dean or Dean (NOT permitted to form directly).
        - Associate Dean -> Dean ONLY (CANNOT request from another Associate Dean; can form directly).
        - Dean -> Highest authority (forms directly; does not request).
        """
        authority = cls.get_authority_for_user(db, requester_user)

        # 1. Authority role check
        if authority.role == NivaranRole.DEAN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Dean is the highest authority and directly forms committees rather than requesting them.",
            )
        elif authority.role not in (NivaranRole.ASSISTANT_DEAN, NivaranRole.ASSOCIATE_DEAN):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Assistant Deans and Associate Deans may submit committee formation requests.",
            )

        # 2. Resolve and validate target recipient based on Authoritative Permission Matrix
        target_authority: Optional[NivaranAuthority] = None
        if target_authority_id:
            target_authority = db.scalar(
                select(NivaranAuthority).where(
                    NivaranAuthority.id == target_authority_id,
                    NivaranAuthority.is_active.is_(True),
                )
            )
            if not target_authority:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Target authority '{target_authority_id}' was not found or is inactive.",
                )

            if authority.role == NivaranRole.ASSISTANT_DEAN:
                if target_authority.role not in (NivaranRole.ASSOCIATE_DEAN, NivaranRole.DEAN):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Assistant Deans can only request committee formation from an Associate Dean or Dean.",
                    )
            elif authority.role == NivaranRole.ASSOCIATE_DEAN:
                if target_authority.role != NivaranRole.DEAN:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Associate Deans can only request committee formation from the Dean.",
                    )

        # 3. Fetch grievance under row lock
        grievance = db.scalar(
            select(Grievance).where(Grievance.id == grievance_id).with_for_update()
        )
        if not grievance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Grievance '{grievance_id}' was not found.",
            )

        cls.validate_grievance_jurisdiction(db, grievance, authority)

        if grievance.status in (GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot request committee formation for a {grievance.status.value} grievance.",
            )

        # 4. Check for existing active pending / clarification request
        existing_active_req = db.scalar(
            select(CommitteeCreationRequest).where(
                CommitteeCreationRequest.grievance_id == grievance.id,
                CommitteeCreationRequest.request_status.in_([
                    CommitteeRequestStatus.PENDING,
                    CommitteeRequestStatus.CLARIFICATION_REQUESTED,
                ]),
            )
        )
        if existing_active_req:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An active committee creation request is already pending or awaiting clarification for this grievance.",
            )

        # If target authority was not explicitly selected, resolve default fallback
        if not target_authority:
            if authority.role == NivaranRole.ASSISTANT_DEAN:
                effective_cat_id = grievance.final_category_id or grievance.category_id
                cat = db.scalar(select(Category).where(Category.id == effective_cat_id)) if effective_cat_id else None
                if cat:
                    try:
                        target_authority = DynamicRoutingEngine.resolve_category_route(db, cat.id, grievance.subject_id)
                    except Exception:
                        pass
                if not target_authority:
                    target_authority = db.scalar(
                        select(NivaranAuthority).where(
                            NivaranAuthority.role == NivaranRole.DEAN,
                            NivaranAuthority.is_active.is_(True),
                        )
                    )
            elif authority.role == NivaranRole.ASSOCIATE_DEAN:
                target_authority = db.scalar(
                    select(NivaranAuthority).where(
                        NivaranAuthority.role == NivaranRole.DEAN,
                        NivaranAuthority.is_active.is_(True),
                    )
                )

        if not target_authority:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No eligible recipient authority (Dean) is configured to receive this committee request.",
            )

        now_utc = datetime.now(timezone.utc)
        req = CommitteeCreationRequest(
            id=uuid.uuid4(),
            grievance_id=grievance.id,
            requested_by_id=authority.id,
            target_authority_id=target_authority.id,
            request_status=CommitteeRequestStatus.PENDING,
            justification=justification.strip(),
            proposed_members_snapshot={
                "proposed_scope": proposed_scope.strip() if proposed_scope else None,
                "supporting_remarks": supporting_remarks.strip() if supporting_remarks else None,
                "target_authority_id": str(target_authority.id),
                "target_authority_name": target_authority.name_snapshot,
                "target_authority_role": target_authority.role.value,
            },
            created_at=now_utc,
        )
        db.add(req)

        # Audit history
        audit = AuditLog(
            user_id=requester_user.id,
            module="atharva_veda",
            action="COMMITTEE_FORMATION_REQUESTED",
            entity_name="CommitteeCreationRequest",
            entity_id=str(req.id),
            details={
                "grievance_id": str(grievance.id),
                "tracking_id": grievance.grievance_id,
                "requested_by_id": str(authority.id),
                "requested_by_name": authority.name_snapshot,
                "requested_by_role": authority.role.value,
                "target_authority_id": str(target_authority.id),
                "target_authority_name": target_authority.name_snapshot,
                "target_authority_role": target_authority.role.value,
                "justification": justification.strip()[:200],
            },
        )
        db.add(audit)

        # Dispatch notification to recipient with source_pillar = NIVARAN
        if target_authority.vyasa_user_id:
            try:
                notification_engine.process_event(
                    db=db,
                    event=NotificationEventPayload(
                        event_id=f"comm_req_{req.id}",
                        source_pillar="NIVARAN",
                        event_type="committee.formation_requested",
                        priority="HIGH",
                        action_route=f"/modules/atharva-veda/nivaran/grievance/{grievance.id}",
                        action_required=True,
                        entity_type="grievance",
                        entity_id=str(grievance.id),
                        recipient_user_ids=[target_authority.vyasa_user_id],
                        metadata={
                            "grievance_id": grievance.grievance_id,
                            "grievance_uuid": str(grievance.id),
                            "requester_name": authority.name_snapshot,
                            "request_id": str(req.id),
                        },
                    ),
                )
            except Exception as e:
                logger.warning(f"[CommitteeService] Notification dispatch failed: {e}")

        db.commit()
        db.refresh(req)
        return req

    @classmethod
    def review_request(
        cls,
        db: Session,
        request_id: uuid.UUID,
        reviewer_user: User,
        payload: CommitteeRequestReviewPayload,
    ) -> CommitteeCreationRequest:
        """
        Reviews a committee formation request (APPROVE, REJECT, REQUEST_CLARIFICATION).
        Only the designated recipient authority or Dean is authorised to review.
        Assistant Deans CANNOT review requests.
        Approval does NOT auto-create a committee.
        """
        reviewer = cls.get_authority_for_user(db, reviewer_user)
        if reviewer.role == NivaranRole.ASSISTANT_DEAN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Assistant Deans are not authorized to review committee formation requests.",
            )

        req = db.scalar(
            select(CommitteeCreationRequest)
            .options(
                selectinload(CommitteeCreationRequest.grievance),
                selectinload(CommitteeCreationRequest.requested_by),
                selectinload(CommitteeCreationRequest.target_authority),
            )
            .where(CommitteeCreationRequest.id == request_id)
            .with_for_update()
        )
        if not req:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Committee creation request '{request_id}' was not found.",
            )

        # Check permission: Dean can review any; Associate Dean can review if they are target
        if reviewer.role != NivaranRole.DEAN and req.target_authority_id != reviewer.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to review this committee formation request.",
            )

        if req.request_status not in (
            CommitteeRequestStatus.PENDING,
            CommitteeRequestStatus.CLARIFICATION_REQUESTED,
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot review request that is already in status '{req.request_status.value}'.",
            )

        now_utc = datetime.now(timezone.utc)
        req.reviewed_by_id = reviewer.id
        req.reviewed_at = now_utc
        req.review_remarks = payload.remarks.strip() if payload.remarks else None

        notif_event_type = ""
        action_name = ""

        if payload.action == CommitteeRequestReviewAction.APPROVE:
            req.request_status = CommitteeRequestStatus.APPROVED
            notif_event_type = "committee.request_approved"
            action_name = "COMMITTEE_REQUEST_APPROVED"
        elif payload.action == CommitteeRequestReviewAction.REJECT:
            req.request_status = CommitteeRequestStatus.REJECTED
            notif_event_type = "committee.request_rejected"
            action_name = "COMMITTEE_REQUEST_REJECTED"
        elif payload.action == CommitteeRequestReviewAction.REQUEST_CLARIFICATION:
            req.request_status = CommitteeRequestStatus.CLARIFICATION_REQUESTED
            notif_event_type = "committee.clarification_requested"
            action_name = "COMMITTEE_REQUEST_CLARIFICATION_REQUESTED"

        audit = AuditLog(
            user_id=reviewer_user.id,
            module="atharva_veda",
            action=action_name,
            entity_name="CommitteeCreationRequest",
            entity_id=str(req.id),
            details={
                "request_id": str(req.id),
                "grievance_id": str(req.grievance_id),
                "reviewed_by_id": str(reviewer.id),
                "reviewed_by_name": reviewer.name_snapshot,
                "action": payload.action.value,
                "remarks": payload.remarks,
            },
        )
        db.add(audit)

        # Notify requester of decision
        if req.requested_by and req.requested_by.vyasa_user_id and notif_event_type:
            try:
                notification_engine.process_event(
                    db=db,
                    event=NotificationEventPayload(
                        event_id=f"comm_rev_{req.id}_{req.request_status.value}",
                        source_pillar="NIVARAN",
                        event_type=notif_event_type,
                        priority="HIGH" if payload.action != CommitteeRequestReviewAction.REJECT else "MEDIUM",
                        action_route=f"/modules/atharva-veda/nivaran/grievance/{req.grievance_id}",
                        action_required=(payload.action == CommitteeRequestReviewAction.REQUEST_CLARIFICATION),
                        entity_type="grievance",
                        entity_id=str(req.grievance_id),
                        recipient_user_ids=[req.requested_by.vyasa_user_id],
                        metadata={
                            "grievance_id": req.grievance.grievance_id if req.grievance else str(req.grievance_id),
                            "grievance_uuid": str(req.grievance_id),
                            "reviewer_name": reviewer.name_snapshot,
                            "remarks": payload.remarks or "",
                        },
                    ),
                )
            except Exception as e:
                logger.warning(f"[CommitteeService] Review notification dispatch failed: {e}")

        db.commit()
        db.refresh(req)
        return req

    @classmethod
    def form_committee_direct(
        cls,
        db: Session,
        creator_user: User,
        payload: CommitteeDirectCreatePayload,
    ) -> GrievanceCommittee:
        """
        Direct committee formation by Associate Dean or Dean within their jurisdiction.
        Assistant Deans CANNOT form committees directly (returns 403 Forbidden).
        Validates members, chairperson, active status, jurisdiction, and links creation request if present.
        """
        creator = cls.get_authority_for_user(db, creator_user)

        # 1. Permission check
        if creator.role == NivaranRole.ASSISTANT_DEAN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Assistant Deans cannot directly form committees; please submit a Committee Formation Request.",
            )
        elif creator.role not in (NivaranRole.ASSOCIATE_DEAN, NivaranRole.DEAN):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Associate Deans and Deans are authorized to form committees.",
            )

        # 2. Fetch grievance
        grievance = db.scalar(
            select(Grievance).where(Grievance.id == payload.grievance_id).with_for_update()
        )
        if not grievance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Grievance '{payload.grievance_id}' was not found.",
            )

        cls.validate_grievance_jurisdiction(db, grievance, creator)

        if grievance.status in (GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot form committee for a {grievance.status.value} grievance.",
            )

        # 3. Check if active committee already exists
        existing_comm = db.scalar(
            select(GrievanceCommittee).where(
                GrievanceCommittee.grievance_id == grievance.id,
                GrievanceCommittee.status == CommitteeStatus.ACTIVE,
            )
        )
        if existing_comm:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"An active committee '{existing_comm.committee_name}' already exists for this grievance.",
            )

        # 4. Validate chairperson
        chairperson = db.scalar(
            select(NivaranAuthority).where(
                NivaranAuthority.id == payload.chairperson_id,
                NivaranAuthority.is_active.is_(True),
            )
        )
        if not chairperson:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected chairperson is invalid or inactive.",
            )

        # 5. Validate members
        member_authorities: List[Tuple[NivaranAuthority, CommitteeMemberRole]] = []
        seen_authority_ids = set()

        # Add chairperson
        member_authorities.append((chairperson, CommitteeMemberRole.CHAIRPERSON))
        seen_authority_ids.add(chairperson.id)

        for mem_input in payload.members:
            if mem_input.authority_id == chairperson.id:
                continue
            if mem_input.authority_id in seen_authority_ids:
                continue

            auth = db.scalar(
                select(NivaranAuthority).where(
                    NivaranAuthority.id == mem_input.authority_id,
                    NivaranAuthority.is_active.is_(True),
                )
            )
            if not auth:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Committee member authority '{mem_input.authority_id}' is invalid or inactive.",
                )

            member_authorities.append((auth, mem_input.member_role))
            seen_authority_ids.add(auth.id)

        # 6. Validate and link creation request if applicable
        linked_request: Optional[CommitteeCreationRequest] = None
        if payload.creation_request_id:
            linked_request = db.scalar(
                select(CommitteeCreationRequest).where(
                    CommitteeCreationRequest.id == payload.creation_request_id,
                    CommitteeCreationRequest.grievance_id == grievance.id,
                )
            )
            if not linked_request:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Creation request '{payload.creation_request_id}' not found for this grievance.",
                )
            if linked_request.request_status != CommitteeRequestStatus.APPROVED:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Creation request is in status '{linked_request.request_status.value}', must be APPROVED to form committee.",
                )
        else:
            # Check if there is an approved request waiting for a committee link
            auto_req = db.scalar(
                select(CommitteeCreationRequest).where(
                    CommitteeCreationRequest.grievance_id == grievance.id,
                    CommitteeCreationRequest.request_status == CommitteeRequestStatus.APPROVED,
                ).order_by(desc(CommitteeCreationRequest.created_at))
            )
            if auto_req:
                linked_request = auto_req

        # 7. Create GrievanceCommittee
        now_utc = datetime.now(timezone.utc)
        comm = GrievanceCommittee(
            id=uuid.uuid4(),
            grievance_id=grievance.id,
            creation_request_id=linked_request.id if linked_request else None,
            committee_name=payload.committee_name.strip(),
            terms_of_reference=payload.terms_of_reference.strip() if payload.terms_of_reference else None,
            chairperson_id=chairperson.id,
            status=CommitteeStatus.ACTIVE,
            chartered_at=now_utc,
            created_at=now_utc,
            updated_at=now_utc,
        )
        db.add(comm)

        # 8. Create CommitteeMember entries
        for auth_obj, role in member_authorities:
            mem_row = CommitteeMember(
                id=uuid.uuid4(),
                committee_id=comm.id,
                authority_id=auth_obj.id,
                member_role=role,
                appointed_at=now_utc,
                is_active=True,
            )
            db.add(mem_row)

        # 9. AuditLog
        audit = AuditLog(
            user_id=creator_user.id,
            module="atharva_veda",
            action="COMMITTEE_FORMED",
            entity_name="GrievanceCommittee",
            entity_id=str(comm.id),
            details={
                "committee_id": str(comm.id),
                "committee_name": comm.committee_name,
                "grievance_id": str(grievance.id),
                "tracking_id": grievance.grievance_id,
                "chairperson_id": str(chairperson.id),
                "chairperson_name": chairperson.name_snapshot,
                "members_count": len(member_authorities),
                "creation_request_id": str(linked_request.id) if linked_request else None,
            },
        )
        db.add(audit)

        # 10. Dispatch Notifications (source_pillar = NIVARAN)
        # A. Case stakeholders (Applicant)
        if grievance.applicant_vyasa_user_id:
            try:
                notification_engine.process_event(
                    db=db,
                    event=NotificationEventPayload(
                        event_id=f"comm_formed_{comm.id}_applicant",
                        source_pillar="NIVARAN",
                        event_type="committee.formed",
                        priority="HIGH",
                        action_route=f"/modules/atharva-veda/nivaran/grievance/{grievance.id}",
                        action_required=False,
                        entity_type="grievance",
                        entity_id=str(grievance.id),
                        recipient_user_ids=[grievance.applicant_vyasa_user_id],
                        metadata={
                            "grievance_id": grievance.grievance_id,
                            "grievance_uuid": str(grievance.id),
                            "committee_name": comm.committee_name,
                        },
                    ),
                )
            except Exception as e:
                logger.warning(f"[CommitteeService] Applicant notification failed: {e}")

        # B. Appointed committee members
        for auth_obj, role in member_authorities:
            if auth_obj.vyasa_user_id:
                try:
                    notification_engine.process_event(
                        db=db,
                        event=NotificationEventPayload(
                            event_id=f"comm_mem_{comm.id}_{auth_obj.id}",
                            source_pillar="NIVARAN",
                            event_type="committee.membership_updated",
                            priority="HIGH",
                            action_route=f"/modules/atharva-veda/nivaran/grievance/{grievance.id}",
                            action_required=False,
                            entity_type="grievance",
                            entity_id=str(grievance.id),
                            recipient_user_ids=[auth_obj.vyasa_user_id],
                            metadata={
                                "grievance_id": grievance.grievance_id,
                                "grievance_uuid": str(grievance.id),
                                "committee_name": comm.committee_name,
                                "member_role": role.value,
                            },
                        ),
                    )
                except Exception as e:
                    logger.warning(f"[CommitteeService] Member notification failed for {auth_obj.id}: {e}")

        db.commit()
        db.refresh(comm)
        return comm

    @classmethod
    def list_requests(
        cls,
        db: Session,
        user: User,
        grievance_id: Optional[uuid.UUID] = None,
        request_status: Optional[str] = None,
    ) -> List[CommitteeRequestDetailedResponseItem]:
        """
        Lists committee formation requests filtered by authority visibility:
        - Dean: sees all institution-wide requests.
        - Associate Dean: sees requests targeted to them or submitted by them or in their cluster.
        - Assistant Dean: sees requests submitted by them.
        """
        authority = cls.get_authority_for_user(db, user)

        query = (
            select(CommitteeCreationRequest)
            .options(
                selectinload(CommitteeCreationRequest.grievance),
                selectinload(CommitteeCreationRequest.requested_by),
                selectinload(CommitteeCreationRequest.reviewed_by),
                selectinload(CommitteeCreationRequest.target_authority),
                selectinload(CommitteeCreationRequest.committee),
            )
            .order_by(desc(CommitteeCreationRequest.created_at))
        )

        if grievance_id:
            query = query.where(CommitteeCreationRequest.grievance_id == grievance_id)

        if request_status:
            try:
                status_enum = CommitteeRequestStatus(request_status)
                query = query.where(CommitteeCreationRequest.request_status == status_enum)
            except ValueError:
                pass

        if authority.role == NivaranRole.DEAN:
            # Dean sees all
            pass
        elif authority.role == NivaranRole.ASSOCIATE_DEAN:
            # Associate Dean sees where requested by them OR targeted to them
            query = query.where(
                or_(
                    CommitteeCreationRequest.requested_by_id == authority.id,
                    CommitteeCreationRequest.target_authority_id == authority.id,
                )
            )
        elif authority.role == NivaranRole.ASSISTANT_DEAN:
            # Assistant Dean sees only requests submitted by them
            query = query.where(CommitteeCreationRequest.requested_by_id == authority.id)
        else:
            return []

        rows = db.scalars(query).all()
        result = []
        for r in rows:
            result.append(
                CommitteeRequestDetailedResponseItem(
                    id=r.id,
                    grievance_id=r.grievance_id,
                    grievance_tracking_id=r.grievance.grievance_id if r.grievance else None,
                    requested_by_id=r.requested_by_id,
                    requested_by_name=r.requested_by.name_snapshot if r.requested_by else "Authority",
                    requested_by_role=r.requested_by.role.value if r.requested_by else "UNKNOWN",
                    target_authority_id=r.target_authority_id,
                    target_authority_name=r.target_authority.name_snapshot if r.target_authority else None,
                    target_authority_role=r.target_authority.role.value if r.target_authority else None,
                    request_status=r.request_status.value,
                    justification=r.justification,
                    proposed_members_snapshot=r.proposed_members_snapshot,
                    reviewed_by_id=r.reviewed_by_id,
                    reviewed_by_name=r.reviewed_by.name_snapshot if r.reviewed_by else None,
                    reviewed_at=r.reviewed_at,
                    review_remarks=r.review_remarks,
                    created_at=r.created_at,
                    committee_id=r.committee.id if r.committee else None,
                )
            )
        return result

    @classmethod
    def get_request_detail(
        cls,
        db: Session,
        request_id: uuid.UUID,
        user: User,
    ) -> CommitteeRequestDetailedResponseItem:
        authority = cls.get_authority_for_user(db, user)

        r = db.scalar(
            select(CommitteeCreationRequest)
            .options(
                selectinload(CommitteeCreationRequest.grievance),
                selectinload(CommitteeCreationRequest.requested_by),
                selectinload(CommitteeCreationRequest.reviewed_by),
                selectinload(CommitteeCreationRequest.target_authority),
                selectinload(CommitteeCreationRequest.committee),
            )
            .where(CommitteeCreationRequest.id == request_id)
        )
        if not r:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Committee creation request '{request_id}' was not found.",
            )

        # Check visibility
        if authority.role != NivaranRole.DEAN:
            if authority.role == NivaranRole.ASSOCIATE_DEAN:
                if r.requested_by_id != authority.id and r.target_authority_id != authority.id:
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
            elif authority.role == NivaranRole.ASSISTANT_DEAN:
                if r.requested_by_id != authority.id:
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

        return CommitteeRequestDetailedResponseItem(
            id=r.id,
            grievance_id=r.grievance_id,
            grievance_tracking_id=r.grievance.grievance_id if r.grievance else None,
            requested_by_id=r.requested_by_id,
            requested_by_name=r.requested_by.name_snapshot if r.requested_by else "Authority",
            requested_by_role=r.requested_by.role.value if r.requested_by else "UNKNOWN",
            target_authority_id=r.target_authority_id,
            target_authority_name=r.target_authority.name_snapshot if r.target_authority else None,
            target_authority_role=r.target_authority.role.value if r.target_authority else None,
            request_status=r.request_status.value,
            justification=r.justification,
            proposed_members_snapshot=r.proposed_members_snapshot,
            reviewed_by_id=r.reviewed_by_id,
            reviewed_by_name=r.reviewed_by.name_snapshot if r.reviewed_by else None,
            reviewed_at=r.reviewed_at,
            review_remarks=r.review_remarks,
            created_at=r.created_at,
            committee_id=r.committee.id if r.committee else None,
        )

    @classmethod
    def list_committees(
        cls,
        db: Session,
        user: User,
        grievance_id: Optional[uuid.UUID] = None,
        status_filter: Optional[str] = None,
    ) -> List[CommitteeResponseItem]:
        authority = cls.get_authority_for_user(db, user)

        query = (
            select(GrievanceCommittee)
            .options(
                selectinload(GrievanceCommittee.grievance),
                selectinload(GrievanceCommittee.chairperson),
                selectinload(GrievanceCommittee.dissolved_by),
                selectinload(GrievanceCommittee.members).selectinload(CommitteeMember.authority),
            )
            .order_by(desc(GrievanceCommittee.chartered_at))
        )

        if grievance_id:
            query = query.where(GrievanceCommittee.grievance_id == grievance_id)

        if status_filter:
            try:
                st = CommitteeStatus(status_filter)
                query = query.where(GrievanceCommittee.status == st)
            except ValueError:
                pass

        # Role-based visibility
        if authority.role == NivaranRole.DEAN:
            # Dean sees all
            pass
        elif authority.role == NivaranRole.ASSOCIATE_DEAN:
            # Associate Dean sees committees where they are chairperson/member OR have grievance jurisdiction
            member_comm_ids = db.scalars(
                select(CommitteeMember.committee_id).where(
                    CommitteeMember.authority_id == authority.id,
                    CommitteeMember.is_active.is_(True),
                )
            ).all()
            query = query.where(
                or_(
                    GrievanceCommittee.chairperson_id == authority.id,
                    GrievanceCommittee.id.in_(member_comm_ids),
                    GrievanceCommittee.grievance.has(Grievance.assigned_authority_id == authority.id),
                )
            )
        elif authority.role == NivaranRole.ASSISTANT_DEAN:
            # Assistant Dean sees only committees where they are appointed
            member_comm_ids = db.scalars(
                select(CommitteeMember.committee_id).where(
                    CommitteeMember.authority_id == authority.id,
                    CommitteeMember.is_active.is_(True),
                )
            ).all()
            query = query.where(
                or_(
                    GrievanceCommittee.chairperson_id == authority.id,
                    GrievanceCommittee.id.in_(member_comm_ids),
                )
            )
        else:
            # Committee members (generic authority / faculty)
            member_comm_ids = db.scalars(
                select(CommitteeMember.committee_id).where(
                    CommitteeMember.authority_id == authority.id,
                    CommitteeMember.is_active.is_(True),
                )
            ).all()
            query = query.where(
                or_(
                    GrievanceCommittee.chairperson_id == authority.id,
                    GrievanceCommittee.id.in_(member_comm_ids),
                )
            )

        committees = db.scalars(query).all()
        result = []
        for c in committees:
            members_list = [
                CommitteeMemberResponseItem(
                    id=m.id,
                    authority_id=m.authority_id,
                    authority_name=m.authority.name_snapshot if m.authority else "Member",
                    authority_role=m.authority.role.value if m.authority else "UNKNOWN",
                    authority_designation=m.authority.designation if m.authority else None,
                    member_role=m.member_role.value,
                    appointed_at=m.appointed_at,
                    is_active=m.is_active,
                )
                for m in c.members
            ]
            msg_count = db.scalar(
                select(func.count(CommitteeMessage.id)).where(CommitteeMessage.committee_id == c.id)
            ) or 0
            poll_count = db.scalar(
                select(func.count(CommitteePoll.id)).where(CommitteePoll.committee_id == c.id)
            ) or 0
            meet_count = db.scalar(
                select(func.count(CommitteeMeeting.id)).where(CommitteeMeeting.committee_id == c.id)
            ) or 0
            doc_count = db.scalar(
                select(func.count(Document.id)).where(Document.grievance_id == c.grievance_id)
            ) or 0
            dec_count = db.scalar(
                select(func.count(CommitteeFormalDecision.id)).where(CommitteeFormalDecision.committee_id == c.id)
            ) or 0

            result.append(
                CommitteeResponseItem(
                    id=c.id,
                    grievance_id=c.grievance_id,
                    grievance_tracking_id=c.grievance.grievance_id if c.grievance else None,
                    grievance_title=c.grievance.title if c.grievance else None,
                    committee_name=c.committee_name,
                    terms_of_reference=c.terms_of_reference,
                    chairperson_id=c.chairperson_id,
                    chairperson_name=c.chairperson.name_snapshot if c.chairperson else "Chairperson",
                    chairperson_role=c.chairperson.role.value if c.chairperson else None,
                    status=c.status.value,
                    creation_request_id=c.creation_request_id,
                    chartered_at=c.chartered_at,
                    disbanded_at=c.disbanded_at,
                    dissolution_reason=c.dissolution_reason,
                    dissolved_by_id=c.dissolved_by_id,
                    dissolved_by_name=c.dissolved_by.name_snapshot if c.dissolved_by else None,
                    members_count=len(members_list),
                    messages_count=msg_count,
                    polls_count=poll_count,
                    meetings_count=meet_count,
                    documents_count=doc_count,
                    decisions_count=dec_count,
                    members=members_list,
                )
            )
        return result

    @classmethod
    def validate_committee_access(
        cls,
        db: Session,
        committee_id: uuid.UUID,
        user: User,
        require_mutation: bool = False,
    ) -> Tuple[NivaranAuthority, GrievanceCommittee, Optional[CommitteeMember]]:
        """
        Validates whether user has institutional authorization to access this committee workspace.
        Enforces:
        - Dean: institution-wide oversight access to all committees.
        - Associate Dean: member, chairperson, or jurisdiction over associated grievance.
        - Assistant Dean / Member: must be appointed active member or chairperson.
        - Other users: 403 Forbidden.
        - If require_mutation is True and committee is DISSOLVED: 400 Bad Request (read-only mode).
        """
        authority = cls.get_authority_for_user(db, user)

        comm = db.scalar(
            select(GrievanceCommittee)
            .options(
                selectinload(GrievanceCommittee.grievance),
                selectinload(GrievanceCommittee.chairperson),
                selectinload(GrievanceCommittee.dissolved_by),
                selectinload(GrievanceCommittee.members).selectinload(CommitteeMember.authority),
            )
            .where(GrievanceCommittee.id == committee_id)
        )
        if not comm:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Committee '{committee_id}' was not found.",
            )

        member_record: Optional[CommitteeMember] = None
        for m in comm.members:
            if m.authority_id == authority.id and m.is_active:
                member_record = m
                break

        is_chairperson = (comm.chairperson_id == authority.id)
        has_access = False

        if authority.role == NivaranRole.DEAN:
            has_access = True
        elif is_chairperson or member_record is not None:
            has_access = True
        elif authority.role == NivaranRole.ASSOCIATE_DEAN:
            # Check grievance jurisdiction
            if comm.grievance:
                try:
                    cls.validate_grievance_jurisdiction(db, comm.grievance, authority)
                    has_access = True
                except HTTPException:
                    has_access = False

        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have authorization to access this committee workspace.",
            )

        if require_mutation and comm.status == CommitteeStatus.DISSOLVED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This committee has been formally dissolved. Historical records are preserved in read-only mode.",
            )

        return authority, comm, member_record

    @classmethod
    def get_overview_metrics(cls, db: Session, user: User) -> CommitteeOverviewMetricsResponse:
        """
        Calculates authorized summary metrics for the Committees section.
        """
        authority = cls.get_authority_for_user(db, user)
        committees = cls.list_committees(db=db, user=user)

        total_committees = len(committees)
        active_committees = sum(1 for c in committees if c.status == CommitteeStatus.ACTIVE.value)
        dissolved_committees = sum(1 for c in committees if c.status == CommitteeStatus.DISSOLVED.value)

        # Pending formation requests relevant to user
        requests = cls.list_requests(db=db, user=user, request_status=CommitteeRequestStatus.PENDING.value)
        pending_requests = len(requests)

        # Pending polls requiring user action
        active_comm_ids = [c.id for c in committees if c.status == CommitteeStatus.ACTIVE.value]
        pending_polls_for_user = 0
        if active_comm_ids:
            # Polls where user is voter and has_voted is False
            pending_polls_for_user = db.scalar(
                select(func.count(CommitteePoll.id))
                .join(CommitteePollVoter, CommitteePollVoter.poll_id == CommitteePoll.id)
                .join(CommitteeMember, CommitteeMember.id == CommitteePollVoter.member_id)
                .where(
                    CommitteePoll.committee_id.in_(active_comm_ids),
                    CommitteePoll.status == CommitteePollStatus.OPEN,
                    CommitteeMember.authority_id == authority.id,
                    CommitteePollVoter.has_voted.is_(False),
                )
            ) or 0

        # Upcoming meetings (scheduled_start >= now in user's active committees)
        now_utc = datetime.now(timezone.utc)
        upcoming_meetings = 0
        if active_comm_ids:
            upcoming_meetings = db.scalar(
                select(func.count(CommitteeMeeting.id)).where(
                    CommitteeMeeting.committee_id.in_(active_comm_ids),
                    CommitteeMeeting.meeting_status == MeetingStatus.SCHEDULED,
                    CommitteeMeeting.scheduled_start >= now_utc,
                )
            ) or 0

        return CommitteeOverviewMetricsResponse(
            total_committees=total_committees,
            active_committees=active_committees,
            dissolved_committees=dissolved_committees,
            pending_requests=pending_requests,
            pending_polls_for_user=pending_polls_for_user,
            upcoming_meetings=upcoming_meetings,
        )

    @classmethod
    def get_committee_workspace_detail(
        cls, db: Session, committee_id: uuid.UUID, user: User
    ) -> CommitteeWorkspaceDetailResponse:
        """
        Retrieves full workspace details for an authorized committee.
        """
        authority, comm, member_record = cls.validate_committee_access(
            db=db, committee_id=committee_id, user=user, require_mutation=False
        )

        user_role_in_comm = None
        if comm.chairperson_id == authority.id:
            user_role_in_comm = "CHAIRPERSON"
        elif member_record:
            user_role_in_comm = member_record.member_role.value
        elif authority.role == NivaranRole.DEAN:
            user_role_in_comm = "DEAN_OVERSIGHT"

        can_manage = (authority.role == NivaranRole.DEAN or comm.chairperson_id == authority.id)
        can_vote = (
            comm.status == CommitteeStatus.ACTIVE
            and member_record is not None
            and member_record.is_active
        )

        # Format committee response item
        members_list = [
            CommitteeMemberResponseItem(
                id=m.id,
                authority_id=m.authority_id,
                authority_name=m.authority.name_snapshot if m.authority else "Member",
                authority_role=m.authority.role.value if m.authority else "UNKNOWN",
                authority_designation=m.authority.designation if m.authority else None,
                member_role=m.member_role.value,
                appointed_at=m.appointed_at,
                is_active=m.is_active,
            )
            for m in comm.members
        ]

        comm_response = CommitteeResponseItem(
            id=comm.id,
            grievance_id=comm.grievance_id,
            grievance_tracking_id=comm.grievance.grievance_id if comm.grievance else None,
            grievance_title=comm.grievance.title if comm.grievance else None,
            committee_name=comm.committee_name,
            terms_of_reference=comm.terms_of_reference,
            chairperson_id=comm.chairperson_id,
            chairperson_name=comm.chairperson.name_snapshot if comm.chairperson else "Chairperson",
            chairperson_role=comm.chairperson.role.value if comm.chairperson else None,
            status=comm.status.value,
            creation_request_id=comm.creation_request_id,
            chartered_at=comm.chartered_at,
            disbanded_at=comm.disbanded_at,
            dissolution_reason=comm.dissolution_reason,
            dissolved_by_id=comm.dissolved_by_id,
            dissolved_by_name=comm.dissolved_by.name_snapshot if comm.dissolved_by else None,
            members_count=len(members_list),
            members=members_list,
        )

        recent_messages = cls.list_messages(db=db, committee_id=comm.id, user=user, limit=20)
        polls = cls.list_polls(db=db, committee_id=comm.id, user=user)
        meetings = cls.list_meetings(db=db, committee_id=comm.id, user=user)
        documents = cls.list_documents(db=db, committee_id=comm.id, user=user)
        decisions = cls.list_formal_decisions(db=db, committee_id=comm.id, user=user)

        return CommitteeWorkspaceDetailResponse(
            committee=comm_response,
            user_role_in_committee=user_role_in_comm,
            can_manage=can_manage,
            can_vote=can_vote,
            recent_messages=recent_messages,
            active_polls=polls,
            upcoming_meetings=meetings,
            recent_documents=documents,
            recent_decisions=decisions,
        )

    @classmethod
    def dissolve_committee(
        cls, db: Session, committee_id: uuid.UUID, user: User, reason: str
    ) -> GrievanceCommittee:
        """
        Formally dissolves a committee.
        Controlled status change to DISSOLVED.
        Preserves all discussions, votes, meetings, documents, and decision records for historical review.
        """
        authority = cls.get_authority_for_user(db, user)

        comm = db.scalar(
            select(GrievanceCommittee)
            .options(
                selectinload(GrievanceCommittee.grievance),
                selectinload(GrievanceCommittee.chairperson),
                selectinload(GrievanceCommittee.members).selectinload(CommitteeMember.authority),
            )
            .where(GrievanceCommittee.id == committee_id)
            .with_for_update()
        )
        if not comm:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Committee '{committee_id}' was not found.",
            )

        # Permission check: Chairperson, Dean, or Associate Dean who formed/has jurisdiction
        can_dissolve = (
            authority.role == NivaranRole.DEAN
            or comm.chairperson_id == authority.id
        )
        if not can_dissolve and authority.role == NivaranRole.ASSOCIATE_DEAN and comm.grievance:
            try:
                cls.validate_grievance_jurisdiction(db, comm.grievance, authority)
                can_dissolve = True
            except HTTPException:
                can_dissolve = False

        if not can_dissolve:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the Committee Chairperson, Associate Dean, or Dean may dissolve a committee.",
            )

        if comm.status == CommitteeStatus.DISSOLVED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Committee has already been dissolved.",
            )

        now_utc = datetime.now(timezone.utc)
        comm.status = CommitteeStatus.DISSOLVED
        comm.disbanded_at = now_utc
        comm.dissolution_reason = reason.strip()
        comm.dissolved_by_id = authority.id
        comm.updated_at = now_utc

        audit = AuditLog(
            user_id=user.id,
            module="atharva_veda",
            action="COMMITTEE_DISSOLVED",
            entity_name="GrievanceCommittee",
            entity_id=str(comm.id),
            details={
                "committee_id": str(comm.id),
                "committee_name": comm.committee_name,
                "dissolved_by_id": str(authority.id),
                "dissolved_by_name": authority.name_snapshot,
                "reason": reason.strip(),
            },
        )
        db.add(audit)

        # Notify committee members
        for mem in comm.members:
            if mem.authority and mem.authority.vyasa_user_id:
                try:
                    notification_engine.process_event(
                        db=db,
                        event=NotificationEventPayload(
                            event_id=f"comm_dissolved_{comm.id}_{mem.authority.id}",
                            source_pillar="NIVARAN",
                            event_type="committee.dissolved",
                            priority="HIGH",
                            action_route=f"/modules/atharva-veda/nivaran/committees/{comm.id}",
                            action_required=False,
                            entity_type="committee",
                            entity_id=str(comm.id),
                            recipient_user_ids=[mem.authority.vyasa_user_id],
                            metadata={
                                "committee_id": str(comm.id),
                                "committee_name": comm.committee_name,
                                "dissolved_by": authority.name_snapshot,
                                "reason": reason.strip(),
                            },
                        ),
                    )
                except Exception as e:
                    logger.warning(f"[CommitteeService] Dissolution notification failed: {e}")

        db.commit()
        db.refresh(comm)
        return comm

    # ==========================================
    # Real-Time Chat Operations
    # ==========================================

    @classmethod
    def list_messages(
        cls,
        db: Session,
        committee_id: uuid.UUID,
        user: User,
        limit: int = 50,
        before_id: Optional[uuid.UUID] = None,
    ) -> List[CommitteeMessageResponseItem]:
        authority, comm, _ = cls.validate_committee_access(
            db=db, committee_id=committee_id, user=user, require_mutation=False
        )

        query = (
            select(CommitteeMessage)
            .options(selectinload(CommitteeMessage.sender))
            .where(CommitteeMessage.committee_id == committee_id)
        )

        if before_id:
            ref_msg = db.scalar(
                select(CommitteeMessage).where(
                    CommitteeMessage.id == before_id,
                    CommitteeMessage.committee_id == committee_id,
                )
            )
            if not ref_msg:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Cursor message '{before_id}' not found in this committee.",
                )
            query = query.where(
                or_(
                    CommitteeMessage.created_at < ref_msg.created_at,
                    and_(
                        CommitteeMessage.created_at == ref_msg.created_at,
                        CommitteeMessage.id < ref_msg.id,
                    ),
                )
            )

        query = query.order_by(
            desc(CommitteeMessage.created_at),
            desc(CommitteeMessage.id),
        ).limit(limit)
        messages = db.scalars(query).all()

        # Return in ascending chronological order
        chronological = list(reversed(messages))
        return [
            CommitteeMessageResponseItem(
                id=m.id,
                committee_id=m.committee_id,
                sender_authority_id=m.sender_authority_id,
                sender_name=m.sender.name_snapshot if m.sender else "Authority",
                sender_role=m.sender.role.value if m.sender else "UNKNOWN",
                sender_designation=m.sender.designation if m.sender else None,
                message_text=m.message_text,
                message_type=m.message_type.value,
                attachment_url=m.attachment_url,
                created_at=m.created_at,
            )
            for m in chronological
        ]

    @classmethod
    async def post_message_async(
        cls,
        db: Session,
        committee_id: uuid.UUID,
        user: User,
        payload: CommitteeMessageCreatePayload,
        client_msg_id: Optional[str] = None,
    ) -> CommitteeMessageResponseItem:
        authority, comm, _ = cls.validate_committee_access(
            db=db, committee_id=committee_id, user=user, require_mutation=True
        )

        now_utc = datetime.now(timezone.utc)
        msg = CommitteeMessage(
            id=uuid.uuid4(),
            committee_id=comm.id,
            sender_authority_id=authority.id,
            message_text=payload.message_text.strip(),
            message_type=payload.message_type,
            attachment_url=payload.attachment_url,
            created_at=now_utc,
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)

        resp_item = CommitteeMessageResponseItem(
            id=msg.id,
            committee_id=msg.committee_id,
            sender_authority_id=msg.sender_authority_id,
            sender_name=authority.name_snapshot,
            sender_role=authority.role.value,
            sender_designation=authority.designation,
            message_text=msg.message_text,
            message_type=msg.message_type.value if hasattr(msg.message_type, "value") else str(msg.message_type),
            attachment_url=msg.attachment_url,
            created_at=msg.created_at,
        )

        # Broadcast via WebSocket manager to active connections
        broadcast_payload = {
            "type": "chat_message",
            "payload": resp_item.model_dump(mode="json"),
        }
        if client_msg_id:
            broadcast_payload["client_msg_id"] = client_msg_id
        await committee_chat_manager.broadcast(comm.id, broadcast_payload)
        return resp_item

    # ==========================================
    # Polling & Voting Operations
    # ==========================================

    @classmethod
    def list_polls(
        cls, db: Session, committee_id: uuid.UUID, user: User
    ) -> List[CommitteePollResponseItem]:
        authority, comm, member_record = cls.validate_committee_access(
            db=db, committee_id=committee_id, user=user, require_mutation=False
        )

        polls = db.scalars(
            select(CommitteePoll)
            .options(
                selectinload(CommitteePoll.options),
                selectinload(CommitteePoll.votes),
                selectinload(CommitteePoll.voters),
                selectinload(CommitteePoll.decision_record),
            )
            .where(CommitteePoll.committee_id == committee_id)
            .order_by(desc(CommitteePoll.launched_at))
        ).all()

        results = []
        for p in polls:
            total_votes = len(p.votes)
            total_eligible = len(p.voters) or len(comm.members)

            # Check if current user has voted and which option
            user_has_voted = False
            user_voted_option_id = None
            if member_record:
                for v in p.voters:
                    if v.member_id == member_record.id and v.has_voted:
                        user_has_voted = True
                        break
                if user_has_voted:
                    cast_row = db.scalar(
                        select(CommitteePollVote).where(
                            CommitteePollVote.poll_id == p.id,
                            CommitteePollVote.voter_member_id == member_record.id,
                        )
                    )
                    if cast_row:
                        user_voted_option_id = cast_row.option_id

            # Count votes per option
            vote_counts_by_opt: Dict[uuid.UUID, int] = {}
            for opt in p.options:
                vote_counts_by_opt[opt.id] = 0
            for v_cast in p.votes:
                if v_cast.option_id in vote_counts_by_opt:
                    vote_counts_by_opt[v_cast.option_id] += 1

            opt_items = []
            for opt in sorted(p.options, key=lambda o: o.display_order):
                c_votes = vote_counts_by_opt.get(opt.id, 0)
                pct = round((c_votes / total_votes * 100), 1) if total_votes > 0 else 0.0
                opt_items.append(
                    CommitteePollOptionResponseItem(
                        id=opt.id,
                        option_key=opt.option_key,
                        option_text=opt.option_text,
                        display_order=opt.display_order,
                        vote_count=c_votes,
                        vote_percentage=pct,
                    )
                )

            winning_opt_id = None
            winning_opt_text = None
            dec_status = None
            if p.decision_record:
                dec_status = p.decision_record.decision_status.value
                winning_opt_id = p.decision_record.winning_option_id
                if winning_opt_id:
                    for opt in p.options:
                        if opt.id == winning_opt_id:
                            winning_opt_text = opt.option_text
                            break

            results.append(
                CommitteePollResponseItem(
                    id=p.id,
                    committee_id=p.committee_id,
                    title=p.title,
                    description=p.description,
                    voting_policy=p.voting_policy.value,
                    status=p.status.value,
                    quorum_required=p.quorum_required,
                    closing_time=p.closing_time,
                    results_visibility=p.results_visibility,
                    launched_at=p.launched_at,
                    closed_at=p.closed_at,
                    options=opt_items,
                    total_eligible=total_eligible,
                    total_votes=total_votes,
                    quorum_reached=(total_votes >= p.quorum_required),
                    user_has_voted=user_has_voted,
                    user_voted_option_id=user_voted_option_id,
                    winning_option_id=winning_opt_id,
                    winning_option_text=winning_opt_text,
                    decision_status=dec_status,
                )
            )
        return results

    @classmethod
    def create_poll(
        cls,
        db: Session,
        committee_id: uuid.UUID,
        user: User,
        payload: CommitteePollCreatePayload,
    ) -> CommitteePollResponseItem:
        authority, comm, member_record = cls.validate_committee_access(
            db=db, committee_id=committee_id, user=user, require_mutation=True
        )

        now_utc = datetime.now(timezone.utc)
        poll = CommitteePoll(
            id=uuid.uuid4(),
            committee_id=comm.id,
            title=payload.title.strip(),
            description=payload.description.strip(),
            voting_policy=CommitteeVotingPolicy(payload.voting_policy),
            status=CommitteePollStatus.OPEN,
            quorum_required=payload.quorum_required,
            closing_time=payload.closing_time,
            results_visibility=payload.results_visibility,
            launched_at=now_utc,
        )
        db.add(poll)

        # Options
        for idx, opt_text in enumerate(payload.options):
            opt_row = CommitteePollOption(
                id=uuid.uuid4(),
                poll_id=poll.id,
                option_key=f"opt_{idx + 1}",
                option_text=opt_text.strip(),
                display_order=idx + 1,
            )
            db.add(opt_row)

        # Initialize eligible voters
        for mem in comm.members:
            if mem.is_active:
                voter_row = CommitteePollVoter(
                    id=uuid.uuid4(),
                    poll_id=poll.id,
                    member_id=mem.id,
                    has_voted=False,
                )
                db.add(voter_row)

        audit = AuditLog(
            user_id=user.id,
            module="atharva_veda",
            action="COMMITTEE_POLL_CREATED",
            entity_name="CommitteePoll",
            entity_id=str(poll.id),
            details={
                "committee_id": str(comm.id),
                "poll_id": str(poll.id),
                "title": poll.title,
                "options_count": len(payload.options),
            },
        )
        db.add(audit)

        # Notify members
        for mem in comm.members:
            if mem.authority and mem.authority.vyasa_user_id and mem.authority.id != authority.id:
                try:
                    notification_engine.process_event(
                        db=db,
                        event=NotificationEventPayload(
                            event_id=f"comm_poll_created_{poll.id}_{mem.authority.id}",
                            source_pillar="NIVARAN",
                            event_type="committee.poll_created",
                            priority="HIGH",
                            action_route=f"/modules/atharva-veda/nivaran/committees/{comm.id}",
                            action_required=True,
                            entity_type="poll",
                            entity_id=str(poll.id),
                            recipient_user_ids=[mem.authority.vyasa_user_id],
                            metadata={
                                "committee_id": str(comm.id),
                                "committee_name": comm.committee_name,
                                "poll_title": poll.title,
                            },
                        ),
                    )
                except Exception as e:
                    logger.warning(f"[CommitteeService] Poll notification failed: {e}")

        db.commit()
        db.refresh(poll)

        polls_list = cls.list_polls(db=db, committee_id=comm.id, user=user)
        for item in polls_list:
            if item.id == poll.id:
                return item
        raise HTTPException(status_code=500, detail="Failed to retrieve created poll.")

    @classmethod
    def cast_vote(
        cls,
        db: Session,
        poll_id: uuid.UUID,
        user: User,
        payload: CommitteePollVotePayload,
    ) -> CommitteePollResponseItem:
        authority = cls.get_authority_for_user(db, user)

        poll = db.scalar(
            select(CommitteePoll)
            .options(selectinload(CommitteePoll.committee).selectinload(GrievanceCommittee.members))
            .where(CommitteePoll.id == poll_id)
            .with_for_update()
        )
        if not poll:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Poll was not found.")

        # Access check & committee dissolved check
        cls.validate_committee_access(
            db=db, committee_id=poll.committee_id, user=user, require_mutation=True
        )

        if poll.status != CommitteePollStatus.OPEN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot vote in a poll that is {poll.status.value}.",
            )

        # Check closing time
        now_utc = datetime.now(timezone.utc)
        if poll.closing_time and poll.closing_time < now_utc:
            poll.status = CommitteePollStatus.CLOSED
            poll.closed_at = now_utc
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Voting deadline has expired for this poll.",
            )

        # Check voter membership
        member_record = db.scalar(
            select(CommitteeMember).where(
                CommitteeMember.committee_id == poll.committee_id,
                CommitteeMember.authority_id == authority.id,
                CommitteeMember.is_active.is_(True),
            )
        )
        if not member_record:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only active committee members are eligible to cast a vote.",
            )

        # Check duplicate vote
        voter_entry = db.scalar(
            select(CommitteePollVoter).where(
                CommitteePollVoter.poll_id == poll.id,
                CommitteePollVoter.member_id == member_record.id,
            ).with_for_update()
        )
        if voter_entry and voter_entry.has_voted:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You have already cast your vote in this poll. Duplicate voting is prohibited.",
            )

        # Validate option
        option = db.scalar(
            select(CommitteePollOption).where(
                CommitteePollOption.id == payload.option_id,
                CommitteePollOption.poll_id == poll.id,
            )
        )
        if not option:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected poll option does not exist.",
            )

        # Cryptographic vote hash
        vote_raw = f"{poll.id}:{member_record.id}:{option.id}:{now_utc.isoformat()}"
        vote_hash = hashlib.sha256(vote_raw.encode("utf-8")).hexdigest()

        vote_record = CommitteePollVote(
            id=uuid.uuid4(),
            poll_id=poll.id,
            option_id=option.id,
            voter_member_id=member_record.id,
            vote_hash=vote_hash,
            cast_at=now_utc,
        )
        db.add(vote_record)

        if voter_entry:
            voter_entry.has_voted = True
            voter_entry.voted_at = now_utc
        else:
            db.add(
                CommitteePollVoter(
                    id=uuid.uuid4(),
                    poll_id=poll.id,
                    member_id=member_record.id,
                    has_voted=True,
                    voted_at=now_utc,
                )
            )

        audit = AuditLog(
            user_id=user.id,
            module="atharva_veda",
            action="COMMITTEE_POLL_VOTE_CAST",
            entity_name="CommitteePollVote",
            entity_id=str(vote_record.id),
            details={
                "poll_id": str(poll.id),
                "option_id": str(option.id),
                "member_id": str(member_record.id),
                "vote_hash": vote_hash[:16],
            },
        )
        db.add(audit)
        db.commit()

        polls_list = cls.list_polls(db=db, committee_id=poll.committee_id, user=user)
        for item in polls_list:
            if item.id == poll.id:
                return item
        raise HTTPException(status_code=500, detail="Failed to retrieve updated poll.")

    @classmethod
    def close_poll(cls, db: Session, poll_id: uuid.UUID, user: User) -> CommitteePollResponseItem:
        authority = cls.get_authority_for_user(db, user)

        poll = db.scalar(
            select(CommitteePoll)
            .options(
                selectinload(CommitteePoll.committee),
                selectinload(CommitteePoll.options),
                selectinload(CommitteePoll.votes),
                selectinload(CommitteePoll.voters),
            )
            .where(CommitteePoll.id == poll_id)
            .with_for_update()
        )
        if not poll:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Poll was not found.")

        cls.validate_committee_access(
            db=db, committee_id=poll.committee_id, user=user, require_mutation=True
        )

        can_close = (
            authority.role == NivaranRole.DEAN
            or poll.committee.chairperson_id == authority.id
        )
        if not can_close:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the Committee Chairperson or Dean may close this poll.",
            )

        if poll.status != CommitteePollStatus.OPEN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Poll is already in status '{poll.status.value}'.",
            )

        now_utc = datetime.now(timezone.utc)
        poll.status = CommitteePollStatus.CLOSED
        poll.closed_at = now_utc

        total_votes = len(poll.votes)
        total_eligible = len(poll.voters)

        # Quorum & Decision determination
        winning_option_id = None
        decision_status = CommitteeDecisionStatus.RATIFIED

        if total_votes < poll.quorum_required:
            decision_status = CommitteeDecisionStatus.FAILED_QUORUM
        else:
            # Tally
            counts: Dict[uuid.UUID, int] = {o.id: 0 for o in poll.options}
            for v in poll.votes:
                if v.option_id in counts:
                    counts[v.option_id] += 1

            if counts:
                max_votes = max(counts.values())
                top_opts = [opt_id for opt_id, cnt in counts.items() if cnt == max_votes]
                if len(top_opts) == 1:
                    winning_option_id = top_opts[0]
                    decision_status = CommitteeDecisionStatus.RATIFIED
                else:
                    decision_status = CommitteeDecisionStatus.TIE

        dec_record = db.scalar(select(CommitteeDecisionRecord).where(CommitteeDecisionRecord.poll_id == poll.id))
        if not dec_record:
            dec_record = CommitteeDecisionRecord(
                id=uuid.uuid4(),
                poll_id=poll.id,
                winning_option_id=winning_option_id,
                decision_status=decision_status,
                total_eligible=total_eligible,
                total_votes_cast=total_votes,
                certified_by_chairperson_id=poll.committee.chairperson_id,
                certified_at=now_utc,
            )
            db.add(dec_record)
        else:
            dec_record.winning_option_id = winning_option_id
            dec_record.decision_status = decision_status
            dec_record.total_eligible = total_eligible
            dec_record.total_votes_cast = total_votes
            dec_record.certified_at = now_utc

        audit = AuditLog(
            user_id=user.id,
            module="atharva_veda",
            action="COMMITTEE_POLL_CLOSED",
            entity_name="CommitteePoll",
            entity_id=str(poll.id),
            details={
                "poll_id": str(poll.id),
                "decision_status": decision_status.value,
                "total_votes": total_votes,
                "winning_option_id": str(winning_option_id) if winning_option_id else None,
            },
        )
        db.add(audit)

        # Notify members
        for mem in poll.committee.members:
            if mem.authority and mem.authority.vyasa_user_id:
                try:
                    notification_engine.process_event(
                        db=db,
                        event=NotificationEventPayload(
                            event_id=f"comm_poll_closed_{poll.id}_{mem.authority.id}",
                            source_pillar="NIVARAN",
                            event_type="committee.poll_closed",
                            priority="MEDIUM",
                            action_route=f"/modules/atharva-veda/nivaran/committees/{poll.committee_id}",
                            action_required=False,
                            entity_type="poll",
                            entity_id=str(poll.id),
                            recipient_user_ids=[mem.authority.vyasa_user_id],
                            metadata={
                                "committee_id": str(poll.committee_id),
                                "committee_name": poll.committee.committee_name,
                                "poll_title": poll.title,
                                "decision_status": decision_status.value,
                            },
                        ),
                    )
                except Exception as e:
                    logger.warning(f"[CommitteeService] Poll closed notification failed: {e}")

        db.commit()

        polls_list = cls.list_polls(db=db, committee_id=poll.committee_id, user=user)
        for item in polls_list:
            if item.id == poll.id:
                return item
        raise HTTPException(status_code=500, detail="Failed to retrieve closed poll.")

    # ==========================================
    # Meetings Operations
    # ==========================================

    @classmethod
    def list_meetings(
        cls, db: Session, committee_id: uuid.UUID, user: User
    ) -> List[CommitteeMeetingResponseItem]:
        cls.validate_committee_access(db=db, committee_id=committee_id, user=user, require_mutation=False)

        meetings = db.scalars(
            select(CommitteeMeeting)
            .options(
                selectinload(CommitteeMeeting.participants).selectinload(CommitteeMeetingParticipant.user),
                selectinload(CommitteeMeeting.participants).selectinload(CommitteeMeetingParticipant.authority),
            )
            .where(CommitteeMeeting.committee_id == committee_id)
            .order_by(desc(CommitteeMeeting.scheduled_start))
        ).all()

        results = []
        for m in meetings:
            part_items = [
                CommitteeMeetingParticipantItem(
                    id=p.id,
                    user_id=p.user_id,
                    authority_id=p.authority_id,
                    name=p.authority.name_snapshot if p.authority else (p.user.full_name if p.user else "Participant"),
                    role=p.role,
                    attendance_confirmed=p.attendance_confirmed,
                )
                for p in m.participants
            ]
            results.append(
                CommitteeMeetingResponseItem(
                    id=m.id,
                    committee_id=m.committee_id,
                    title=m.title,
                    agenda=m.agenda,
                    meeting_type=m.meeting_type.value,
                    scheduled_start=m.scheduled_start,
                    scheduled_end=m.scheduled_end,
                    meet_link=m.meet_link,
                    meeting_status=m.meeting_status.value,
                    outcome_summary=m.outcome_summary,
                    notes=m.notes,
                    created_at=m.created_at,
                    participants=part_items,
                )
            )
        return results

    @classmethod
    def schedule_meeting(
        cls,
        db: Session,
        committee_id: uuid.UUID,
        user: User,
        payload: CommitteeMeetingCreatePayload,
    ) -> CommitteeMeetingResponseItem:
        authority, comm, _ = cls.validate_committee_access(
            db=db, committee_id=committee_id, user=user, require_mutation=True
        )

        if payload.scheduled_end <= payload.scheduled_start:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Meeting end time must be strictly after start time.",
            )

        # Resolve attendee emails
        attendee_emails = []
        for mem in comm.members:
            if mem.authority and mem.authority.email_snapshot:
                attendee_emails.append(mem.authority.email_snapshot)

        # Automated Google Meet room creation if configured; never fake links
        meet_link = payload.external_meet_link
        if not meet_link and GoogleMeetService.is_configured():
            meet_link = GoogleMeetService.create_meeting_room(
                title=payload.title,
                start_time=payload.scheduled_start,
                end_time=payload.scheduled_end,
                agenda=payload.agenda,
                attendee_emails=attendee_emails,
            )

        now_utc = datetime.now(timezone.utc)
        meeting = CommitteeMeeting(
            id=uuid.uuid4(),
            committee_id=comm.id,
            title=payload.title.strip(),
            agenda=payload.agenda.strip() if payload.agenda else None,
            meeting_type=MeetingType(payload.meeting_type),
            scheduled_start=payload.scheduled_start,
            scheduled_end=payload.scheduled_end,
            meet_link=meet_link,
            meeting_status=MeetingStatus.SCHEDULED,
            notes=payload.notes.strip() if payload.notes else None,
            created_at=now_utc,
        )
        db.add(meeting)

        # Participants: default to all committee members unless explicit list provided
        target_authorities = comm.members
        if payload.participant_authority_ids:
            target_authorities = [
                m for m in comm.members if m.authority_id in payload.participant_authority_ids
            ]

        for m_item in target_authorities:
            if m_item.authority and m_item.authority.vyasa_user_id:
                p_row = CommitteeMeetingParticipant(
                    id=uuid.uuid4(),
                    meeting_id=meeting.id,
                    user_id=m_item.authority.vyasa_user_id,
                    authority_id=m_item.authority_id,
                    role=m_item.member_role.value,
                    attendance_confirmed=False,
                )
                db.add(p_row)

        audit = AuditLog(
            user_id=user.id,
            module="atharva_veda",
            action="COMMITTEE_MEETING_SCHEDULED",
            entity_name="CommitteeMeeting",
            entity_id=str(meeting.id),
            details={
                "committee_id": str(comm.id),
                "title": meeting.title,
                "scheduled_start": meeting.scheduled_start.isoformat(),
                "has_meet_link": bool(meet_link),
            },
        )
        db.add(audit)

        # Dispatch notification to participants
        for m_item in target_authorities:
            if m_item.authority and m_item.authority.vyasa_user_id and m_item.authority.id != authority.id:
                try:
                    notification_engine.process_event(
                        db=db,
                        event=NotificationEventPayload(
                            event_id=f"comm_meeting_sched_{meeting.id}_{m_item.authority.id}",
                            source_pillar="NIVARAN",
                            event_type="committee.meeting_scheduled",
                            priority="HIGH",
                            action_route=f"/modules/atharva-veda/nivaran/committees/{comm.id}",
                            action_required=False,
                            entity_type="meeting",
                            entity_id=str(meeting.id),
                            recipient_user_ids=[m_item.authority.vyasa_user_id],
                            metadata={
                                "committee_id": str(comm.id),
                                "committee_name": comm.committee_name,
                                "meeting_title": meeting.title,
                                "start_time": meeting.scheduled_start.isoformat(),
                                "meet_link": meet_link or "",
                            },
                        ),
                    )
                except Exception as e:
                    logger.warning(f"[CommitteeService] Meeting notification failed: {e}")

        db.commit()

        meetings_list = cls.list_meetings(db=db, committee_id=comm.id, user=user)
        for m_res in meetings_list:
            if m_res.id == meeting.id:
                return m_res
        raise HTTPException(status_code=500, detail="Failed to retrieve scheduled meeting.")

    @classmethod
    def update_meeting(
        cls,
        db: Session,
        meeting_id: uuid.UUID,
        user: User,
        payload: CommitteeMeetingUpdatePayload,
    ) -> CommitteeMeetingResponseItem:
        meeting = db.scalar(
            select(CommitteeMeeting)
            .options(
                selectinload(CommitteeMeeting.committee),
                selectinload(CommitteeMeeting.participants).selectinload(CommitteeMeetingParticipant.authority),
            )
            .where(CommitteeMeeting.id == meeting_id)
            .with_for_update()
        )
        if not meeting:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting was not found.")

        cls.validate_committee_access(
            db=db, committee_id=meeting.committee_id, user=user, require_mutation=True
        )

        if payload.title is not None:
            meeting.title = payload.title.strip()
        if payload.agenda is not None:
            meeting.agenda = payload.agenda.strip()
        if payload.scheduled_start is not None:
            meeting.scheduled_start = payload.scheduled_start
        if payload.scheduled_end is not None:
            meeting.scheduled_end = payload.scheduled_end
        if payload.meet_link is not None:
            meeting.meet_link = payload.meet_link.strip() if payload.meet_link else None
        if payload.notes is not None:
            meeting.notes = payload.notes.strip() if payload.notes else None
        if payload.outcome_summary is not None:
            meeting.outcome_summary = payload.outcome_summary.strip() if payload.outcome_summary else None
        if payload.meeting_status is not None:
            meeting.meeting_status = MeetingStatus(payload.meeting_status)

        db.commit()

        meetings_list = cls.list_meetings(db=db, committee_id=meeting.committee_id, user=user)
        for m_res in meetings_list:
            if m_res.id == meeting.id:
                return m_res
        raise HTTPException(status_code=500, detail="Failed to retrieve updated meeting.")

    @classmethod
    def cancel_meeting(
        cls, db: Session, meeting_id: uuid.UUID, user: User
    ) -> CommitteeMeetingResponseItem:
        return cls.update_meeting(
            db=db,
            meeting_id=meeting_id,
            user=user,
            payload=CommitteeMeetingUpdatePayload(meeting_status=MeetingStatus.CANCELLED.value),
        )

    # ==========================================
    # Documents & Evidence Operations
    # ==========================================

    @classmethod
    def list_documents(
        cls, db: Session, committee_id: uuid.UUID, user: User
    ) -> List[CommitteeDocumentResponseItem]:
        _, comm, _ = cls.validate_committee_access(
            db=db, committee_id=committee_id, user=user, require_mutation=False
        )

        docs = db.scalars(
            select(Document)
            .options(selectinload(Document.uploader))
            .where(Document.grievance_id == comm.grievance_id)
            .order_by(desc(Document.created_at))
        ).all()

        return [
            CommitteeDocumentResponseItem(
                id=d.id,
                grievance_id=d.grievance_id,
                file_name=d.file_name,
                file_path=d.file_path,
                mime_type=d.mime_type,
                file_size=d.file_size,
                document_type=d.document_type or "EVIDENCE",
                content_hash=d.content_hash,
                uploaded_by_name=d.uploader.full_name if d.uploader else "Authority",
                created_at=d.created_at,
            )
            for d in docs
        ]

    @classmethod
    def upload_document(
        cls,
        db: Session,
        committee_id: uuid.UUID,
        user: User,
        payload: CommitteeDocumentUploadPayload,
    ) -> CommitteeDocumentResponseItem:
        authority, comm, _ = cls.validate_committee_access(
            db=db, committee_id=committee_id, user=user, require_mutation=True
        )

        allowed_extensions = {".pdf", ".png", ".jpg", ".jpeg", ".docx", ".xlsx", ".txt"}
        ext = Path(payload.file_name).suffix.lower()
        if ext not in allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(allowed_extensions))}",
            )

        max_file_size = 20 * 1024 * 1024  # 20MB
        if payload.file_size > max_file_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size exceeds maximum permitted limit of 20MB.",
            )

        try:
            content_bytes = base64.b64decode(payload.content_base64)
        except Exception as e:
            raise HTTPException(status_code=400, detail="Corrupted base64 file payload.")

        if not content_bytes:
            raise HTTPException(status_code=400, detail="Uploaded file payload is empty.")

        content_hash = hashlib.sha256(content_bytes).hexdigest()

        target_dir = STORAGE_BASE_DIR / str(comm.grievance_id)
        target_dir.mkdir(parents=True, exist_ok=True)

        safe_name = os.path.basename(payload.file_name).replace(" ", "_")
        safe_name = "".join(c for c in safe_name if c.isalnum() or c in "._-") or "evidence"
        file_disk_path = target_dir / f"{uuid.uuid4().hex[:8]}_{safe_name}"

        with open(file_disk_path, "wb") as f:
            f.write(content_bytes)

        now_utc = datetime.now(timezone.utc)
        doc = Document(
            id=uuid.uuid4(),
            grievance_id=comm.grievance_id,
            uploaded_by_vyasa_user_id=user.id,
            file_name=payload.file_name,
            file_path=str(file_disk_path),
            mime_type=payload.mime_type,
            file_size=len(content_bytes),
            document_type=payload.document_type,
            content_hash=content_hash,
            ocr_status="COMPLETED" if ext in [".png", ".jpg", ".jpeg", ".pdf"] else "NOT_APPLICABLE",
            created_at=now_utc,
        )
        db.add(doc)

        audit = AuditLog(
            user_id=user.id,
            module="atharva_veda",
            action="COMMITTEE_DOCUMENT_UPLOADED",
            entity_name="Document",
            entity_id=str(doc.id),
            details={
                "committee_id": str(comm.id),
                "grievance_id": str(comm.grievance_id),
                "file_name": doc.file_name,
                "file_size": doc.file_size,
                "content_hash": content_hash,
            },
        )
        db.add(audit)
        db.commit()
        db.refresh(doc)

        return CommitteeDocumentResponseItem(
            id=doc.id,
            grievance_id=doc.grievance_id,
            file_name=doc.file_name,
            file_path=doc.file_path,
            mime_type=doc.mime_type,
            file_size=doc.file_size,
            document_type=doc.document_type,
            content_hash=doc.content_hash,
            uploaded_by_name=user.full_name,
            created_at=doc.created_at,
        )

    # ==========================================
    # Formal Decisions & Minutes Operations
    # ==========================================

    @classmethod
    def list_formal_decisions(
        cls, db: Session, committee_id: uuid.UUID, user: User
    ) -> List[CommitteeFormalDecisionResponseItem]:
        cls.validate_committee_access(db=db, committee_id=committee_id, user=user, require_mutation=False)

        decisions = db.scalars(
            select(CommitteeFormalDecision)
            .options(selectinload(CommitteeFormalDecision.recorded_by))
            .where(CommitteeFormalDecision.committee_id == committee_id)
            .order_by(desc(CommitteeFormalDecision.recorded_at))
        ).all()

        return [
            CommitteeFormalDecisionResponseItem(
                id=d.id,
                committee_id=d.committee_id,
                title=d.title,
                decision_type=d.decision_type,
                outcome=d.outcome,
                summary=d.summary,
                meeting_id=d.meeting_id,
                poll_id=d.poll_id,
                participating_members_snapshot=d.participating_members_snapshot,
                supporting_document_url=d.supporting_document_url,
                recorded_by_authority_id=d.recorded_by_authority_id,
                recorded_by_name=d.recorded_by.name_snapshot if d.recorded_by else "Authority",
                recorded_by_role=d.recorded_by.role.value if d.recorded_by else "UNKNOWN",
                recorded_at=d.recorded_at,
                is_final_institutional_order=d.is_final_institutional_order,
                institutional_order_ref=d.institutional_order_ref,
                created_at=d.created_at,
                updated_at=d.updated_at,
            )
            for d in decisions
        ]

    @classmethod
    def record_formal_decision(
        cls,
        db: Session,
        committee_id: uuid.UUID,
        user: User,
        payload: CommitteeFormalDecisionCreatePayload,
    ) -> CommitteeFormalDecisionResponseItem:
        authority, comm, _ = cls.validate_committee_access(
            db=db, committee_id=committee_id, user=user, require_mutation=True
        )

        can_record = (
            authority.role == NivaranRole.DEAN
            or comm.chairperson_id == authority.id
        )
        if not can_record:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the Committee Chairperson or Dean may record official committee decisions.",
            )

        now_utc = datetime.now(timezone.utc)
        members_snapshot = [
            {
                "authority_id": str(m.authority_id),
                "name": m.authority.name_snapshot if m.authority else "Member",
                "role": m.member_role.value,
            }
            for m in comm.members
        ]

        dec = CommitteeFormalDecision(
            id=uuid.uuid4(),
            committee_id=comm.id,
            title=payload.title.strip(),
            decision_type=payload.decision_type,
            outcome=payload.outcome,
            summary=payload.summary.strip(),
            meeting_id=payload.meeting_id,
            poll_id=payload.poll_id,
            participating_members_snapshot={"members": members_snapshot},
            supporting_document_url=payload.supporting_document_url,
            recorded_by_authority_id=authority.id,
            recorded_at=now_utc,
            is_final_institutional_order=payload.is_final_institutional_order,
            institutional_order_ref=payload.institutional_order_ref,
            created_at=now_utc,
            updated_at=now_utc,
        )
        db.add(dec)

        audit = AuditLog(
            user_id=user.id,
            module="atharva_veda",
            action="COMMITTEE_DECISION_RECORDED",
            entity_name="CommitteeFormalDecision",
            entity_id=str(dec.id),
            details={
                "committee_id": str(comm.id),
                "title": dec.title,
                "decision_type": dec.decision_type,
                "outcome": dec.outcome,
                "is_final_order": dec.is_final_institutional_order,
            },
        )
        db.add(audit)

        # Notify members
        for mem in comm.members:
            if mem.authority and mem.authority.vyasa_user_id and mem.authority.id != authority.id:
                try:
                    notification_engine.process_event(
                        db=db,
                        event=NotificationEventPayload(
                            event_id=f"comm_dec_{dec.id}_{mem.authority.id}",
                            source_pillar="NIVARAN",
                            event_type="committee.decision_recorded",
                            priority="HIGH",
                            action_route=f"/modules/atharva-veda/nivaran/committees/{comm.id}",
                            action_required=False,
                            entity_type="decision",
                            entity_id=str(dec.id),
                            recipient_user_ids=[mem.authority.vyasa_user_id],
                            metadata={
                                "committee_id": str(comm.id),
                                "committee_name": comm.committee_name,
                                "decision_title": dec.title,
                                "outcome": dec.outcome,
                            },
                        ),
                    )
                except Exception as e:
                    logger.warning(f"[CommitteeService] Decision notification failed: {e}")

        db.commit()
        db.refresh(dec)

        return CommitteeFormalDecisionResponseItem(
            id=dec.id,
            committee_id=dec.committee_id,
            title=dec.title,
            decision_type=dec.decision_type,
            outcome=dec.outcome,
            summary=dec.summary,
            meeting_id=dec.meeting_id,
            poll_id=dec.poll_id,
            participating_members_snapshot=dec.participating_members_snapshot,
            supporting_document_url=dec.supporting_document_url,
            recorded_by_authority_id=dec.recorded_by_authority_id,
            recorded_by_name=authority.name_snapshot,
            recorded_by_role=authority.role.value,
            recorded_at=dec.recorded_at,
            is_final_institutional_order=dec.is_final_institutional_order,
            institutional_order_ref=dec.institutional_order_ref,
            created_at=dec.created_at,
            updated_at=dec.updated_at,
        )
