"""
NIVARAN-AI Role-Based Notification Event Catalogue
Fulfills Section 4 requirements for:
- Applicant / Scholar Submitter
- Manager
- Authorities (Assistant Dean, Associate Dean, Dean)
"""
from typing import Dict, List, Optional
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.services.notifications.contracts import (
    EventDefinition,
    TemplateDefinition,
    NotificationPriority,
)
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.enums import NivaranRole
from app.modules.atharva_veda.nivaran.models.grievance import Grievance
from app.modules.atharva_veda.nivaran.services.routing_service import DynamicRoutingEngine


NIVARAN_EVENTS: Dict[str, EventDefinition] = {
    # -------------------------------------------------------------------------
    # A. Applicant / Grievance Submitter
    # -------------------------------------------------------------------------
    "grievance.submitted": EventDefinition(
        event_type="grievance.submitted",
        description="Grievance submission acknowledgement to scholar",
        category="workflow",
        template=TemplateDefinition(
            title_template="Grievance Submitted — {grievance_id}",
            body_template="Your grievance '{title}' has been successfully lodged and assigned tracking reference {grievance_id}.",
            action_route_template="/modules/atharva-veda/nivaran/grievance/{grievance_uuid}",
            default_priority=NotificationPriority.MEDIUM,
            is_action_required=False,
        ),
        allowed_roles=["applicant"],
    ),
    "grievance.document_requested": EventDefinition(
        event_type="grievance.document_requested",
        description="Document or additional evidence requested from scholar",
        category="task",
        template=TemplateDefinition(
            title_template="Action Required: Additional Information Requested — {grievance_id}",
            body_template="The adjudicating authority has requested additional evidence for case {grievance_id}. Please upload requested documents promptly.",
            action_route_template="/modules/atharva-veda/nivaran/grievance/{grievance_uuid}",
            default_priority=NotificationPriority.HIGH,
            is_action_required=True,
        ),
        allowed_roles=["applicant"],
    ),
    "grievance.resolved": EventDefinition(
        event_type="grievance.resolved",
        description="Resolution recorded on grievance",
        category="workflow",
        template=TemplateDefinition(
            title_template="Grievance Resolved — {grievance_id}",
            body_template="A formal resolution has been entered for your case {grievance_id} by {resolver_title}.",
            action_route_template="/modules/atharva-veda/nivaran/grievance/{grievance_uuid}",
            default_priority=NotificationPriority.HIGH,
            is_action_required=False,
        ),
        allowed_roles=["applicant"],
    ),
    "grievance.feedback_requested": EventDefinition(
        event_type="grievance.feedback_requested",
        description="Applicant feedback requested on resolved grievance",
        category="task",
        template=TemplateDefinition(
            title_template="Action Required: Submit Feedback for Case {grievance_id}",
            body_template="Your grievance {grievance_id} is resolved. Please provide feedback on timeliness, fairness, and quality to facilitate closure.",
            action_route_template="/modules/atharva-veda/nivaran/grievance/{grievance_uuid}",
            default_priority=NotificationPriority.MEDIUM,
            is_action_required=True,
        ),
        allowed_roles=["applicant"],
    ),
    "grievance.feedback_submitted": EventDefinition(
        event_type="grievance.feedback_submitted",
        description="Feedback submission acknowledgement to scholar",
        category="workflow",
        template=TemplateDefinition(
            title_template="Feedback Recorded — {grievance_id}",
            body_template="Thank you for submitting your evaluation for case {grievance_id}. The case has proceeded to the final closure queue.",
            action_route_template="/modules/atharva-veda/nivaran/grievance/{grievance_uuid}",
            default_priority=NotificationPriority.LOW,
            is_action_required=False,
        ),
        allowed_roles=["applicant"],
    ),
    "grievance.closed": EventDefinition(
        event_type="grievance.closed",
        description="Formal grievance closure acknowledgement",
        category="workflow",
        template=TemplateDefinition(
            title_template="Grievance Formally Closed — {grievance_id}",
            body_template="Case {grievance_id} has been formally closed by the Grievance Redressal Cell. Sealed official dossier is available in your E-Files.",
            action_route_template="/modules/atharva-veda/nivaran/grievance/{grievance_uuid}",
            default_priority=NotificationPriority.MEDIUM,
            is_action_required=False,
        ),
        allowed_roles=["applicant"],
    ),
    "grievance.status_changed": EventDefinition(
        event_type="grievance.status_changed",
        description="General status transition update",
        category="workflow",
        template=TemplateDefinition(
            title_template="Status Update: Case {grievance_id}",
            body_template="Your grievance status has transitioned to '{status_label}'.",
            action_route_template="/modules/atharva-veda/nivaran/grievance/{grievance_uuid}",
            default_priority=NotificationPriority.LOW,
            is_action_required=False,
        ),
        allowed_roles=["applicant"],
    ),

    # -------------------------------------------------------------------------
    # B. Manager
    # -------------------------------------------------------------------------
    "manager.new_grievance": EventDefinition(
        event_type="manager.new_grievance",
        description="New grievance received/registered requiring manager triage",
        category="task",
        template=TemplateDefinition(
            title_template="New Case Lodged — {grievance_id}",
            body_template="A new grievance has been lodged in category '{category}' ({grievance_id}). Awaiting intake review and verification.",
            action_route_template="/modules/atharva-veda/nivaran/manager/queue",
            default_priority=NotificationPriority.MEDIUM,
            is_action_required=True,
        ),
        allowed_roles=["authority"],
    ),
    "manager.grievance_closed": EventDefinition(
        event_type="manager.grievance_closed",
        description="Grievance closed notification to managers",
        category="workflow",
        template=TemplateDefinition(
            title_template="Case Closed — {grievance_id}",
            body_template="Grievance {grievance_id} has been formally closed and official electronic dossier sealed.",
            action_route_template="/modules/atharva-veda/nivaran/manager/closure-queue",
            default_priority=NotificationPriority.LOW,
            is_action_required=False,
        ),
        allowed_roles=["authority"],
    ),
    "manager.feedback_received": EventDefinition(
        event_type="manager.feedback_received",
        description="Scholar feedback received on resolved grievance",
        category="task",
        template=TemplateDefinition(
            title_template="Applicant Feedback Received — {grievance_id}",
            body_template="Applicant feedback submitted for case {grievance_id}. Case is now ready for managerial closure review.",
            action_route_template="/modules/atharva-veda/nivaran/manager/closure-queue",
            default_priority=NotificationPriority.MEDIUM,
            is_action_required=True,
        ),
        allowed_roles=["authority"],
    ),
    "manager.action_required": EventDefinition(
        event_type="manager.action_required",
        description="Case awaiting managerial action or review",
        category="task",
        template=TemplateDefinition(
            title_template="Action Required: Triage Item — {grievance_id}",
            body_template="Grievance {grievance_id} requires managerial review or status reconciliation.",
            action_route_template="/modules/atharva-veda/nivaran/manager/queue",
            default_priority=NotificationPriority.HIGH,
            is_action_required=True,
        ),
        allowed_roles=["authority"],
    ),
    "manager.escalation_alert": EventDefinition(
        event_type="manager.escalation_alert",
        description="Escalation or overdue case event alert",
        category="alert",
        template=TemplateDefinition(
            title_template="Escalation Alert: Case {grievance_id}",
            body_template="Case {grievance_id} has exceeded standard SLA thresholds or has been escalated for managerial intervention.",
            action_route_template="/modules/atharva-veda/nivaran/manager/queue",
            default_priority=NotificationPriority.CRITICAL,
            is_action_required=True,
        ),
        allowed_roles=["authority"],
    ),
    "manager.system_announcement": EventDefinition(
        event_type="manager.system_announcement",
        description="Platform or policy announcement for managers",
        category="info",
        template=TemplateDefinition(
            title_template="NIVARAN Announcement: {headline}",
            body_template="{announcement_body}",
            action_route_template="/modules/atharva-veda/nivaran",
            default_priority=NotificationPriority.MEDIUM,
            is_action_required=False,
        ),
        allowed_roles=["authority"],
    ),

    # -------------------------------------------------------------------------
    # C. Authorities (Assistant Dean, Associate Dean, Dean)
    # -------------------------------------------------------------------------
    "authority.case_assigned": EventDefinition(
        event_type="authority.case_assigned",
        description="New case assigned within authority jurisdiction",
        category="task",
        template=TemplateDefinition(
            title_template="New Assigned Case — {grievance_id}",
            body_template="Grievance {grievance_id} ('{title}') has been assigned to your jurisdiction for adjudication.",
            action_route_template="{authority_case_route}",
            default_priority=NotificationPriority.HIGH,
            is_action_required=True,
        ),
        allowed_roles=["authority"],
    ),
    "authority.info_received": EventDefinition(
        event_type="authority.info_received",
        description="Additional evidence uploaded by scholar on assigned case",
        category="task",
        template=TemplateDefinition(
            title_template="Evidence Uploaded: Case {grievance_id}",
            body_template="The scholar has uploaded requested evidence for grievance {grievance_id}. Case is ready for review.",
            action_route_template="{authority_case_route}",
            default_priority=NotificationPriority.MEDIUM,
            is_action_required=True,
        ),
        allowed_roles=["authority"],
    ),
    "authority.action_required": EventDefinition(
        event_type="authority.action_required",
        description="Case status requiring immediate authority decision",
        category="task",
        template=TemplateDefinition(
            title_template="Action Required: Adjudication Due — {grievance_id}",
            body_template="Grievance {grievance_id} is awaiting your resolution determination.",
            action_route_template="{authority_case_route}",
            default_priority=NotificationPriority.HIGH,
            is_action_required=True,
        ),
        allowed_roles=["authority"],
    ),
    "authority.escalated_case": EventDefinition(
        event_type="authority.escalated_case",
        description="Urgent case escalation to Associate Dean or Dean",
        category="alert",
        template=TemplateDefinition(
            title_template="Priority Escalation: Case {grievance_id}",
            body_template="Grievance {grievance_id} has been escalated to your docket: {escalation_reason}.",
            action_route_template="{authority_case_route}",
            default_priority=NotificationPriority.CRITICAL,
            is_action_required=True,
        ),
        allowed_roles=["authority"],
    ),
    "authority.escalated": EventDefinition(
        event_type="authority.escalated",
        description="Urgent case escalation to Associate Dean or Dean",
        category="alert",
        template=TemplateDefinition(
            title_template="Priority Escalation: Case {grievance_id}",
            body_template="Grievance {grievance_id} has been escalated to your docket.",
            action_route_template="/modules/atharva-veda/nivaran/dean/cases",
            default_priority=NotificationPriority.CRITICAL,
            is_action_required=True,
        ),
        allowed_roles=["authority"],
    ),
    "authority.case_forwarded": EventDefinition(
        event_type="authority.case_forwarded",
        description="Grievance forwarded to authority jurisdiction",
        category="task",
        template=TemplateDefinition(
            title_template="Grievance Forwarded — {grievance_id}",
            body_template="Grievance {grievance_id} has been forwarded to you for review.",
            action_route_template="/modules/atharva-veda/nivaran",
            default_priority=NotificationPriority.HIGH,
            is_action_required=True,
        ),
        allowed_roles=["authority"],
    ),
    "grievance.efile_generated": EventDefinition(
        event_type="grievance.efile_generated",
        description="Official sealed electronic dossier generated",
        category="workflow",
        template=TemplateDefinition(
            title_template="Official E-File Generated — {grievance_id}",
            body_template="Sealed official dossier {efile_number} is now available for grievance {grievance_id}.",
            action_route_template="/modules/atharva-veda/nivaran/grievance/{grievance_uuid}",
            default_priority=NotificationPriority.MEDIUM,
            is_action_required=False,
        ),
        allowed_roles=["applicant"],
    ),
    # Committee-related events: Operational
    "committee.formation_requested": EventDefinition(
        event_type="committee.formation_requested",
        description="Committee formation request pending approval",
        category="task",
        template=TemplateDefinition(
            title_template="Committee Formation Requested — {grievance_id}",
            body_template="{requester_name} has requested committee formation for case {grievance_id}.",
            action_route_template="/modules/atharva-veda/nivaran/grievance/{grievance_uuid}",
            default_priority=NotificationPriority.HIGH,
            is_action_required=True,
            is_operational=True,
        ),
        allowed_roles=["authority"],
        is_operational=True,
    ),
    "committee.clarification_requested": EventDefinition(
        event_type="committee.clarification_requested",
        description="Clarification requested on committee formation request",
        category="task",
        template=TemplateDefinition(
            title_template="Committee Clarification Requested — {grievance_id}",
            body_template="{reviewer_name} requested clarification on committee request for case {grievance_id}: {remarks}",
            action_route_template="/modules/atharva-veda/nivaran/grievance/{grievance_uuid}",
            default_priority=NotificationPriority.HIGH,
            is_action_required=True,
            is_operational=True,
        ),
        allowed_roles=["authority"],
        is_operational=True,
    ),
    "committee.request_approved": EventDefinition(
        event_type="committee.request_approved",
        description="Committee formation request approved",
        category="workflow",
        template=TemplateDefinition(
            title_template="Committee Request Approved — {grievance_id}",
            body_template="Committee formation request for case {grievance_id} has been approved by {reviewer_name}.",
            action_route_template="/modules/atharva-veda/nivaran/grievance/{grievance_uuid}",
            default_priority=NotificationPriority.HIGH,
            is_action_required=False,
            is_operational=True,
        ),
        allowed_roles=["authority"],
        is_operational=True,
    ),
    "committee.request_rejected": EventDefinition(
        event_type="committee.request_rejected",
        description="Committee formation request rejected",
        category="workflow",
        template=TemplateDefinition(
            title_template="Committee Request Rejected — {grievance_id}",
            body_template="Committee formation request for case {grievance_id} was rejected by {reviewer_name}: {remarks}",
            action_route_template="/modules/atharva-veda/nivaran/grievance/{grievance_uuid}",
            default_priority=NotificationPriority.MEDIUM,
            is_action_required=False,
            is_operational=True,
        ),
        allowed_roles=["authority"],
        is_operational=True,
    ),
    "committee.formed": EventDefinition(
        event_type="committee.formed",
        description="Inquiry committee formally constituted",
        category="workflow",
        template=TemplateDefinition(
            title_template="Inquiry Committee Formed — {grievance_id}",
            body_template="An inquiry committee '{committee_name}' has been formed for case {grievance_id}.",
            action_route_template="/modules/atharva-veda/nivaran/grievance/{grievance_uuid}",
            default_priority=NotificationPriority.HIGH,
            is_action_required=False,
            is_operational=True,
        ),
        allowed_roles=["authority"],
        is_operational=True,
    ),
    "committee.membership_updated": EventDefinition(
        event_type="committee.membership_updated",
        description="Committee appointment or composition update",
        category="info",
        template=TemplateDefinition(
            title_template="Committee Appointment: Case {grievance_id}",
            body_template="You have been appointed to the inquiry committee '{committee_name}' for grievance {grievance_id} as {member_role}.",
            action_route_template="/modules/atharva-veda/nivaran/grievance/{grievance_uuid}",
            default_priority=NotificationPriority.HIGH,
            is_action_required=False,
            is_operational=True,
        ),
        allowed_roles=["authority"],
        is_operational=True,
    ),
    "committee.meeting_scheduled": EventDefinition(
        event_type="committee.meeting_scheduled",
        description="Committee session or hearing scheduled",
        category="workflow",
        template=TemplateDefinition(
            title_template="Committee Session Scheduled — {grievance_id}",
            body_template="An inquiry hearing has been scheduled for case {grievance_id} on {meeting_time}.",
            action_route_template="/modules/atharva-veda/nivaran",
            default_priority=NotificationPriority.HIGH,
            is_action_required=False,
            is_operational=False,
        ),
        allowed_roles=["authority"],
        is_operational=False,
    ),
    "committee.poll_pending": EventDefinition(
        event_type="committee.poll_pending",
        description="Committee vote/poll requiring attention",
        category="task",
        template=TemplateDefinition(
            title_template="Action Required: Committee Ballot Pending — {grievance_id}",
            body_template="Your vote is required on the resolution recommendation for case {grievance_id}.",
            action_route_template="/modules/atharva-veda/nivaran",
            default_priority=NotificationPriority.HIGH,
            is_action_required=True,
            is_operational=False,
        ),
        allowed_roles=["authority"],
        is_operational=False,
    ),
    "committee.decision_recorded": EventDefinition(
        event_type="committee.decision_recorded",
        description="Formal committee recommendation ratified",
        category="workflow",
        template=TemplateDefinition(
            title_template="Committee Finding Ratified — {grievance_id}",
            body_template="The committee has finalized its recommendation for case {grievance_id}: {decision_outcome}.",
            action_route_template="/modules/atharva-veda/nivaran",
            default_priority=NotificationPriority.MEDIUM,
            is_action_required=False,
            is_operational=False,
        ),
        allowed_roles=["authority"],
        is_operational=False,
    ),
    "authority.grievance_resolved_or_closed": EventDefinition(
        event_type="authority.grievance_resolved_or_closed",
        description="Grievance resolution or closure in authority jurisdiction",
        category="workflow",
        template=TemplateDefinition(
            title_template="Docket Case Concluded — {grievance_id}",
            body_template="Grievance {grievance_id} in your jurisdictional cluster has been concluded.",
            action_route_template="{authority_case_route}",
            default_priority=NotificationPriority.LOW,
            is_action_required=False,
        ),
        allowed_roles=["authority"],
    ),
    "authority.system_announcement": EventDefinition(
        event_type="authority.system_announcement",
        description="Platform or policy announcement for university authorities",
        category="info",
        template=TemplateDefinition(
            title_template="Institutional Directive: {headline}",
            body_template="{announcement_body}",
            action_route_template="/dashboard",
            default_priority=NotificationPriority.MEDIUM,
            is_action_required=False,
        ),
        allowed_roles=["authority"],
    ),
}


def resolve_nivaran_recipients(db: Session, event_type: str, payload_data: dict) -> List[uuid.UUID]:
    """
    Dynamically resolves recipient user IDs based on NIVARAN role, jurisdiction,
    and case assignment rules.
    """
    recipients: List[uuid.UUID] = []

    # 1. Applicant events
    if event_type.startswith("grievance."):
        # Resolve scholar's user UUID from grievance if provided
        grv_id = payload_data.get("entity_id") or payload_data.get("grievance_id")
        if grv_id:
            try:
                parsed_uuid = uuid.UUID(str(grv_id))
                grv = db.scalar(select(Grievance).where((Grievance.id == parsed_uuid) | (Grievance.grievance_id == str(grv_id))))
            except Exception:
                grv = db.scalar(select(Grievance).where(Grievance.grievance_id == str(grv_id)))

            if grv and grv.applicant_vyasa_user_id:
                recipients.append(grv.applicant_vyasa_user_id)

    # 2. Manager events
    elif event_type.startswith("manager."):
        mgr_authorities = db.scalars(
            select(NivaranAuthority).where(
                NivaranAuthority.role == NivaranRole.MANAGER,
                NivaranAuthority.is_active.is_(True),
            )
        ).all()
        for mgr in mgr_authorities:
            if mgr.vyasa_user_id and mgr.vyasa_user_id not in recipients:
                recipients.append(mgr.vyasa_user_id)

    # 3. Authority events
    elif event_type.startswith("authority.") or event_type.startswith("committee."):
        role_target = payload_data.get("recipient_role_target") or {}
        target_role = role_target.get("role")
        subject_id = role_target.get("subject_id")
        category_id = role_target.get("category_id")

        if target_role == "DEAN":
            dean = DynamicRoutingEngine.resolve_dean_route(db)
            if dean and dean.vyasa_user_id:
                recipients.append(dean.vyasa_user_id)
        elif target_role == "ASSISTANT_DEAN" and subject_id:
            try:
                ad = DynamicRoutingEngine.resolve_subject_route(db, uuid.UUID(str(subject_id)))
                if ad and ad.vyasa_user_id:
                    recipients.append(ad.vyasa_user_id)
            except Exception:
                pass
        elif target_role == "ASSOCIATE_DEAN" and category_id:
            try:
                assoc = DynamicRoutingEngine.resolve_category_route(db, uuid.UUID(str(category_id)))
                if assoc and assoc.vyasa_user_id:
                    recipients.append(assoc.vyasa_user_id)
            except Exception:
                pass
        else:
            # Fallback: check if assigned authority ID is in grievance
            grv_id = payload_data.get("entity_id") or payload_data.get("grievance_id")
            if grv_id:
                try:
                    parsed_uuid = uuid.UUID(str(grv_id))
                    grv = db.scalar(select(Grievance).where((Grievance.id == parsed_uuid) | (Grievance.grievance_id == str(grv_id))))
                except Exception:
                    grv = db.scalar(select(Grievance).where(Grievance.grievance_id == str(grv_id)))

                if grv and grv.assigned_authority_id:
                    auth = db.scalar(select(NivaranAuthority).where(NivaranAuthority.id == grv.assigned_authority_id))
                    if auth and auth.vyasa_user_id and auth.vyasa_user_id not in recipients:
                        recipients.append(auth.vyasa_user_id)

    return recipients
