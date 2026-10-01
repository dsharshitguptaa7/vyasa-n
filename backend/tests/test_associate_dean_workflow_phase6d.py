# -*- coding: utf-8 -*-
"""
Phase 6D: Comprehensive Associate Dean Workflow Test Suite
Verifies reference parity with projects/NIVARAN-AI:
- Strict Associate Dean authorization (require_atharva_associate_dean)
- Role boundary rejection: Applicant, Manager, Assistant Dean, Dean get 403
- Queue scoping & record-level jurisdiction: only grievances actively assigned to this Associate Dean
- Queue filtering (status, search, priority, pagination)
- Backwards compatible aliases (/associate-dean/cases, /grievances/{id}/resolve, /grievances/{id}/escalate)
- Case dossier retrieval with Stage 3 Dean routing destination preview and can_forward/can_resolve flags
- Direct grievance resolution (status -> RESOLVED, notes, history, audit, notifications)
- Resolution validation (minimum notes length, status guard, jurisdiction guard)
- Stage 3 Dean Escalation / Forwarding:
  * Justification text validation (minimum 5 characters)
  * Dynamic routing resolution to active institutional Dean
  * Assignment handoff: deactivation of Associate Dean assignment, creation of new active Dean assignment
  * Status transition to ESCALATED
  * ForwardingConfirmation persistence
  * Status history, AuditLog, and Notifications
- Evidentiary Document Requests:
  * Transitions status to AWAITING_INFORMATION
  * Preserves active assignment
  * DocumentRequest records persistence
  * AuditLog & applicant notification
- Committee Creation Request:
  * Creates CommitteeCreationRequest in PENDING status
  * Duplicate prevention (400 Bad Request)
  * AuditLog & notifications
- Non-functional guards:
  * Idempotency & double-action prevention
  * IDOR protection (cannot act on other authorities' cases)
"""

import uuid
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import select, and_
from sqlalchemy.orm import Session

from app.main import app
from app.core.security import create_access_token
from app.models.user import User
from app.models.role import Role, user_roles
from app.models.audit import AuditLog
from app.models.notification import Notification
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.taxonomy import (
    SubjectCluster,
    Subject,
    GrievanceCluster,
    Category,
)
from app.modules.atharva_veda.nivaran.models.enums import (
    CategoryRoutingType,
    NivaranRole,
    GrievanceStatus,
    GrievancePriority,
    HistoryActorType,
    DocumentRequestStatus,
    CommitteeRequestStatus,
)
from app.modules.atharva_veda.nivaran.models.grievance import (
    Grievance,
    GrievanceStatusHistory,
    StudentMasterRecord,
)
from app.modules.atharva_veda.nivaran.models.routing import (
    Assignment,
    ForwardingConfirmation,
)
from app.modules.atharva_veda.nivaran.models.document import DocumentRequest
from app.modules.atharva_veda.nivaran.models.committee import CommitteeCreationRequest

client = TestClient(app)

NIVARAN_BASE = "/api/modules/atharva-veda/nivaran"


# ==========================================
# Helpers & Fixtures
# ==========================================

def get_or_create_user(db: Session, email: str, role_names: list[str]) -> tuple[User, str]:
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        user = User(
            email=email,
            password_hash="hashed_test_pw",
            first_name=email.split("@")[0].capitalize(),
            last_name="Test",
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif not user.is_active:
        user.is_active = True
        db.commit()
        db.refresh(user)

    for r_name in role_names:
        role = db.scalar(select(Role).where(Role.name == r_name))
        if not role:
            role = Role(name=r_name, description=f"{r_name} role", is_system=True)
            db.add(role)
            db.commit()
            db.refresh(role)

        existing = db.execute(
            select(user_roles).where(user_roles.c.user_id == user.id, user_roles.c.role_id == role.id)
        ).first()
        if not existing:
            db.execute(user_roles.insert().values(user_id=user.id, role_id=role.id))
            db.commit()

    token = create_access_token({"sub": str(user.id)})
    return user, token


def get_or_create_authority(
    db: Session,
    email: str,
    role: NivaranRole,
    designation: str,
) -> tuple[User, NivaranAuthority, str]:
    user, token = get_or_create_user(db, email, ["authority"])
    auth = db.scalar(select(NivaranAuthority).where(NivaranAuthority.vyasa_user_id == user.id))
    if not auth:
        auth = NivaranAuthority(
            vyasa_user_id=user.id,
            role=role,
            designation=designation,
            is_active=True,
            name_snapshot=user.full_name,
            email_snapshot=user.email,
        )
        db.add(auth)
        db.commit()
        db.refresh(auth)
    else:
        auth.role = role
        auth.is_active = True
        auth.designation = designation
        db.commit()
        db.refresh(auth)
    return user, auth, token


def setup_associate_dean_environment(db: Session):
    """
    Sets up institutional taxonomy and authority environment:
    - Associate Dean 1 (Dr. Sweta Pandey, associatedean1@csjmu.ac.in)
    - Associate Dean 2 (Dr. Rajiv Verma, associatedean2@csjmu.ac.in)
    - Dean (Prof. Namita Tiwari, research@csjmu.ac.in)
    - Assistant Dean (assistantdean1@csjmu.ac.in)
    - Manager (manager@csjmu.ac.in)
    - Applicant (applicant_phase6d@csjmu.ac.in)
    """
    # 1. Associate Dean 1
    u_assoc1, assoc1, token_assoc1 = get_or_create_authority(
        db, "associatedean1@csjmu.ac.in", NivaranRole.ASSOCIATE_DEAN, "Associate Dean Academic Affairs"
    )

    # 2. Associate Dean 2
    u_assoc2, assoc2, token_assoc2 = get_or_create_authority(
        db, "associatedean2@csjmu.ac.in", NivaranRole.ASSOCIATE_DEAN, "Associate Dean Student Welfare"
    )

    # 3. Dean
    try:
        dean = DynamicRoutingEngine.resolve_dean_route(db)
        u_dean = db.get(User, dean.vyasa_user_id) if dean.vyasa_user_id else None
        token_dean = create_access_token({"sub": str(u_dean.id)}) if u_dean else ""
    except Exception:
        u_dean, dean, token_dean = get_or_create_authority(
            db, "research@csjmu.ac.in", NivaranRole.DEAN, "Dean of Research & Development"
        )

    # 4. Assistant Dean
    u_asst, asst, token_asst = get_or_create_authority(
        db, "assistantdean1@csjmu.ac.in", NivaranRole.ASSISTANT_DEAN, "Assistant Dean Science"
    )

    # 5. Manager
    u_mgr, mgr, token_mgr = get_or_create_authority(
        db, "manager@csjmu.ac.in", NivaranRole.MANAGER, "Grievance Manager"
    )

    # 6. Applicant
    u_app, token_app = get_or_create_user(db, "applicant_phase6d@csjmu.ac.in", ["applicant"])

    # 7. Category & Subject
    subject = db.scalar(select(Subject).where(Subject.is_active.is_(True)))
    category = db.scalar(select(Category).where(Category.is_active.is_(True)))

    return {
        "u_assoc1": u_assoc1, "assoc1": assoc1, "token_assoc1": token_assoc1,
        "u_assoc2": u_assoc2, "assoc2": assoc2, "token_assoc2": token_assoc2,
        "u_dean": u_dean, "dean": dean, "token_dean": token_dean,
        "u_asst": u_asst, "asst": asst, "token_asst": token_asst,
        "u_mgr": u_mgr, "mgr": mgr, "token_mgr": token_mgr,
        "u_app": u_app, "token_app": token_app,
        "subject": subject,
        "category": category,
    }


def create_test_grievance_for_assoc_dean(
    db: Session,
    env: dict,
    status: GrievanceStatus = GrievanceStatus.ASSIGNED,
    priority: GrievancePriority = GrievancePriority.HIGH,
    title: str = "Associate Dean Test Grievance",
    assoc_auth: NivaranAuthority = None,
) -> Grievance:
    if assoc_auth is None:
        assoc_auth = env["assoc1"]

    applicant = env["u_app"]
    smr = db.scalar(select(StudentMasterRecord).where(StudentMasterRecord.student_vyasa_user_id == applicant.id))
    if not smr:
        smr = StudentMasterRecord(
            student_vyasa_user_id=applicant.id,
            record_number=f"SMR-{uuid.uuid4().hex[:8].upper()}",
            registration_number_snapshot=f"REG-{uuid.uuid4().hex[:6].upper()}",
            enrollment_number_snapshot=f"ENR-{uuid.uuid4().hex[:6].upper()}",
            full_name_snapshot=applicant.full_name,
            email_snapshot=applicant.email,
            subject_id=env["subject"].id if env["subject"] else None,
        )
        db.add(smr)
        db.commit()
        db.refresh(smr)

    gid = f"CSJMU-2026-{uuid.uuid4().hex[:5].upper()}"
    grv = Grievance(
        grievance_id=gid,
        applicant_vyasa_user_id=applicant.id,
        student_record_id=smr.id,
        title=title,
        description="Comprehensive grievance description requiring Associate Dean intervention.",
        status=status,
        priority=priority,
        subject_id=env["subject"].id if env["subject"] else None,
        category_id=env["category"].id if env["category"] else None,
        final_category_id=env["category"].id if env["category"] else None,
        assigned_authority_id=assoc_auth.id,
        category_reviewed=True,
    )
    db.add(grv)
    db.commit()
    db.refresh(grv)

    # Active assignment
    assign = Assignment(
        grievance_id=grv.id,
        authority_id=assoc_auth.id,
        is_active=True,
        assignment_reason="Forwarded by Assistant Dean to Stage 2 Associate Dean",
        assigned_at=datetime.now(timezone.utc),
    )
    db.add(assign)
    db.commit()
    return grv


# ==========================================
# Test Cases
# ==========================================

class TestAssociateDeanAuthorizationBoundaries:
    """Verifies strict Associate Dean role boundary controls."""

    def test_unauthenticated_request_rejected(self, db_session: Session):
        resp = client.get(f"{NIVARAN_BASE}/associate-dean/dashboard")
        assert resp.status_code == 401

    def test_applicant_role_rejected(self, db_session: Session):
        env = setup_associate_dean_environment(db_session)
        resp = client.get(
            f"{NIVARAN_BASE}/associate-dean/dashboard",
            headers={"Authorization": f"Bearer {env['token_app']}"},
        )
        assert resp.status_code == 403

    def test_manager_role_rejected(self, db_session: Session):
        env = setup_associate_dean_environment(db_session)
        resp = client.get(
            f"{NIVARAN_BASE}/associate-dean/dashboard",
            headers={"Authorization": f"Bearer {env['token_mgr']}"},
        )
        assert resp.status_code == 403

    def test_assistant_dean_role_rejected(self, db_session: Session):
        env = setup_associate_dean_environment(db_session)
        resp = client.get(
            f"{NIVARAN_BASE}/associate-dean/dashboard",
            headers={"Authorization": f"Bearer {env['token_asst']}"},
        )
        assert resp.status_code == 403

    def test_dean_role_rejected_for_associate_dean_endpoint(self, db_session: Session):
        env = setup_associate_dean_environment(db_session)
        resp = client.get(
            f"{NIVARAN_BASE}/associate-dean/dashboard",
            headers={"Authorization": f"Bearer {env['token_dean']}"},
        )
        assert resp.status_code == 403

    def test_authorized_associate_dean_allowed(self, db_session: Session):
        env = setup_associate_dean_environment(db_session)
        resp = client.get(
            f"{NIVARAN_BASE}/associate-dean/dashboard",
            headers={"Authorization": f"Bearer {env['token_assoc1']}"},
        )
        assert resp.status_code == 200
        json_body = resp.json()
        assert json_body.get("success") is True
        data = json_body.get("data", {})
        assert "total_assigned" in data
        assert "pending" in data
        assert "in_progress" in data
        assert "resolved" in data
        assert "escalated" in data


class TestAssociateDeanQueueScopingAndFiltering:
    """Verifies that Associate Deans only see their own active assignments with correct filtering."""

    def test_queue_scoped_to_active_associate_dean(self, db_session: Session):
        env = setup_associate_dean_environment(db_session)
        grv1 = create_test_grievance_for_assoc_dean(db_session, env, title="Assoc 1 Case", assoc_auth=env["assoc1"])
        grv2 = create_test_grievance_for_assoc_dean(db_session, env, title="Assoc 2 Case", assoc_auth=env["assoc2"])

        # Assoc 1 requests queue
        resp1 = client.get(
            f"{NIVARAN_BASE}/associate-dean/grievances",
            headers={"Authorization": f"Bearer {env['token_assoc1']}"},
        )
        assert resp1.status_code == 200
        items1 = resp1.json()["data"]["items"]
        item_ids1 = [item["id"] for item in items1]
        assert str(grv1.id) in item_ids1
        assert str(grv2.id) not in item_ids1

        # Assoc 2 requests queue
        resp2 = client.get(
            f"{NIVARAN_BASE}/associate-dean/grievances",
            headers={"Authorization": f"Bearer {env['token_assoc2']}"},
        )
        assert resp2.status_code == 200
        items2 = resp2.json()["data"]["items"]
        item_ids2 = [item["id"] for item in items2]
        assert str(grv2.id) in item_ids2
        assert str(grv1.id) not in item_ids2

    def test_queue_backwards_compatible_alias(self, db_session: Session):
        env = setup_associate_dean_environment(db_session)
        grv = create_test_grievance_for_assoc_dean(db_session, env, title="Alias Case", assoc_auth=env["assoc1"])

        resp = client.get(
            f"{NIVARAN_BASE}/associate-dean/cases",
            headers={"Authorization": f"Bearer {env['token_assoc1']}"},
        )
        data = resp.json()["data"]
        items = data["items"] if isinstance(data, dict) else data
        assert any(item["id"] == str(grv.id) for item in items)

    def test_queue_filters_by_status_and_priority(self, db_session: Session):
        env = setup_associate_dean_environment(db_session)
        grv_urgent = create_test_grievance_for_assoc_dean(
            db_session, env,
            status=GrievanceStatus.IN_PROGRESS,
            priority=GrievancePriority.CRITICAL,
            title="Urgent Thesis Issue",
            assoc_auth=env["assoc1"],
        )
        grv_low = create_test_grievance_for_assoc_dean(
            db_session, env,
            status=GrievanceStatus.ASSIGNED,
            priority=GrievancePriority.LOW,
            title="Low Priority Query",
            assoc_auth=env["assoc1"],
        )

        # Filter by status IN_PROGRESS
        resp_status = client.get(
            f"{NIVARAN_BASE}/associate-dean/grievances?status=IN_PROGRESS",
            headers={"Authorization": f"Bearer {env['token_assoc1']}"},
        )
        assert resp_status.status_code == 200
        ids_status = [item["id"] for item in resp_status.json()["data"]["items"]]
        assert str(grv_urgent.id) in ids_status
        assert str(grv_low.id) not in ids_status

        # Filter by priority CRITICAL
        resp_prio = client.get(
            f"{NIVARAN_BASE}/associate-dean/grievances?priority=CRITICAL",
            headers={"Authorization": f"Bearer {env['token_assoc1']}"},
        )
        assert resp_prio.status_code == 200
        ids_prio = [item["id"] for item in resp_prio.json()["data"]["items"]]
        assert str(grv_urgent.id) in ids_prio
        assert str(grv_low.id) not in ids_prio

        # Search filter
        resp_search = client.get(
            f"{NIVARAN_BASE}/associate-dean/grievances?search=Thesis",
            headers={"Authorization": f"Bearer {env['token_assoc1']}"},
        )
        assert resp_search.status_code == 200
        ids_search = [item["id"] for item in resp_search.json()["data"]["items"]]
        assert str(grv_urgent.id) in ids_search
        assert str(grv_low.id) not in ids_search


class TestAssociateDeanGrievanceDetail:
    """Verifies grievance dossier retrieval, Stage 3 Dean preview, and jurisdiction enforcement."""

    def test_detail_includes_stage3_dean_preview(self, db_session: Session):
        env = setup_associate_dean_environment(db_session)
        grv = create_test_grievance_for_assoc_dean(db_session, env, assoc_auth=env["assoc1"])

        resp = client.get(
            f"{NIVARAN_BASE}/associate-dean/grievances/{grv.id}",
            headers={"Authorization": f"Bearer {env['token_assoc1']}"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["id"] == str(grv.id)
        assert data["title"] == grv.title
        assert data["can_resolve"] is True
        assert data["can_forward"] is True

        # Verify Stage 3 Dean preview
        preview = data.get("stage3_dean_preview")
        assert preview is not None
        assert preview["target_authority_role"] == "DEAN"
        assert "@" in preview["target_authority_email"]
        assert preview["is_active"] is True

    def test_idor_protection_assoc_dean_cannot_view_unassigned_grievance(self, db_session: Session):
        env = setup_associate_dean_environment(db_session)
        grv2 = create_test_grievance_for_assoc_dean(db_session, env, assoc_auth=env["assoc2"])

        # Assoc 1 tries to view Assoc 2's grievance
        resp = client.get(
            f"{NIVARAN_BASE}/associate-dean/grievances/{grv2.id}",
            headers={"Authorization": f"Bearer {env['token_assoc1']}"},
        )
        assert resp.status_code in [403, 404]


class TestAssociateDeanDirectResolution:
    """Verifies direct resolution by Associate Dean."""

    def test_resolve_validation_requires_minimum_notes(self, db_session: Session):
        env = setup_associate_dean_environment(db_session)
        grv = create_test_grievance_for_assoc_dean(db_session, env, assoc_auth=env["assoc1"])

        resp = client.post(
            f"{NIVARAN_BASE}/associate-dean/grievances/{grv.id}/resolve",
            json={"resolution_notes": "ok"},  # Under 5 chars
            headers={"Authorization": f"Bearer {env['token_assoc1']}"},
        )
        assert resp.status_code == 422

    def test_resolve_success_updates_status_audit_and_notifications(self, db_session: Session):
        env = setup_associate_dean_environment(db_session)
        grv = create_test_grievance_for_assoc_dean(db_session, env, assoc_auth=env["assoc1"])

        resolution_text = "The dissertation committee conflict was successfully resolved following consultative review."
        resp = client.post(
            f"{NIVARAN_BASE}/associate-dean/grievances/{grv.id}/resolve",
            json={"resolution_notes": resolution_text},
            headers={"Authorization": f"Bearer {env['token_assoc1']}"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["status"] == "RESOLVED"
        assert data["resolution_summary"] == resolution_text

        # Verify DB state
        db_session.refresh(grv)
        assert grv.status == GrievanceStatus.RESOLVED
        assert grv.resolution_summary == resolution_text

        # Verify AuditLog
        audit = db_session.scalar(
            select(AuditLog).where(
                AuditLog.action == "GRIEVANCE_RESOLVED",
                AuditLog.entity_id == str(grv.id),
            )
        )
        assert audit is not None
        assert audit.user_id == env["u_assoc1"].id

        # Verify Applicant Notification
        notif = db_session.scalar(
            select(Notification).where(
                Notification.user_id == env["u_app"].id,
                Notification.title.ilike("%Resolved%"),
            )
        )
        assert notif is not None

    def test_cannot_resolve_already_resolved_grievance(self, db_session: Session):
        env = setup_associate_dean_environment(db_session)
        grv = create_test_grievance_for_assoc_dean(
            db_session, env, status=GrievanceStatus.RESOLVED, assoc_auth=env["assoc1"]
        )

        resp = client.post(
            f"{NIVARAN_BASE}/associate-dean/grievances/{grv.id}/resolve",
            json={"resolution_notes": "Attempting redundant resolution"},
            headers={"Authorization": f"Bearer {env['token_assoc1']}"},
        )
        assert resp.status_code == 400

    def test_canonical_alias_resolve_endpoint(self, db_session: Session):
        env = setup_associate_dean_environment(db_session)
        grv = create_test_grievance_for_assoc_dean(db_session, env, assoc_auth=env["assoc1"])

        resp = client.post(
            f"{NIVARAN_BASE}/grievances/{grv.id}/resolve",
            json={"resolution_notes": "Resolved via canonical alias endpoint."},
            headers={"Authorization": f"Bearer {env['token_assoc1']}"},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "RESOLVED"


class TestAssociateDeanForwardingToDean:
    """Verifies Stage 3 forwarding / escalation to Dean."""

    def test_forward_validation_requires_justification(self, db_session: Session):
        env = setup_associate_dean_environment(db_session)
        grv = create_test_grievance_for_assoc_dean(db_session, env, assoc_auth=env["assoc1"])

        resp = client.post(
            f"{NIVARAN_BASE}/associate-dean/grievances/{grv.id}/forward",
            json={"justification": "   "},
            headers={"Authorization": f"Bearer {env['token_assoc1']}"},
        )
        assert resp.status_code in [400, 422]

    def test_forward_success_escalates_to_dean(self, db_session: Session):
        env = setup_associate_dean_environment(db_session)
        grv = create_test_grievance_for_assoc_dean(db_session, env, assoc_auth=env["assoc1"])

        justification_text = "Requires institutional policy intervention and Dean discretionary review."
        resp = client.post(
            f"{NIVARAN_BASE}/associate-dean/grievances/{grv.id}/forward",
            json={"justification": justification_text},
            headers={"Authorization": f"Bearer {env['token_assoc1']}"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["status"] == "ESCALATED"
        target_dean_id = uuid.UUID(data["assigned_to"]["id"])

        # Verify DB status
        db_session.refresh(grv)
        assert grv.status == GrievanceStatus.ESCALATED
        assert grv.assigned_authority_id == target_dean_id

        # Verify old assignment deactivated
        old_assign = db_session.scalar(
            select(Assignment).where(
                Assignment.grievance_id == grv.id,
                Assignment.authority_id == env["assoc1"].id,
            )
        )
        assert old_assign.is_active is False

        # Verify new assignment created for Dean
        dean_assign = db_session.scalar(
            select(Assignment).where(
                Assignment.grievance_id == grv.id,
                Assignment.authority_id == target_dean_id,
                Assignment.is_active.is_(True),
            )
        )
        assert dean_assign is not None

        # Verify ForwardingConfirmation record
        fc = db_session.scalar(
            select(ForwardingConfirmation).where(
                ForwardingConfirmation.grievance_id == grv.id,
                ForwardingConfirmation.forwarded_by_authority_id == env["assoc1"].id,
            )
        )
        assert fc is not None
        assert fc.forwarded_to_authority_id == target_dean_id
        assert fc.justification_reason == justification_text

        # Verify AuditLog
        audit = db_session.scalar(
            select(AuditLog).where(
                AuditLog.action == "GRIEVANCE_ESCALATED",
                AuditLog.entity_id == str(grv.id),
            )
        )
        assert audit is not None
        assert audit.user_id == env["u_assoc1"].id

        # Verify Dean Notification
        target_dean = db_session.get(NivaranAuthority, target_dean_id)
        dean_notif = db_session.scalar(
            select(Notification).where(
                Notification.user_id == target_dean.vyasa_user_id,
                Notification.title.ilike("%Escalated%"),
            )
        )
        assert dean_notif is not None

    def test_canonical_alias_escalate_endpoint(self, db_session: Session):
        env = setup_associate_dean_environment(db_session)
        grv = create_test_grievance_for_assoc_dean(db_session, env, assoc_auth=env["assoc1"])

        resp = client.post(
            f"{NIVARAN_BASE}/grievances/{grv.id}/escalate",
            json={"reason": "Escalated through canonical alias endpoint."},
            headers={"Authorization": f"Bearer {env['token_assoc1']}"},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] == "ESCALATED"

    def test_cannot_forward_already_escalated_grievance(self, db_session: Session):
        env = setup_associate_dean_environment(db_session)
        grv = create_test_grievance_for_assoc_dean(
            db_session, env, status=GrievanceStatus.ESCALATED, assoc_auth=env["assoc1"]
        )

        resp = client.post(
            f"{NIVARAN_BASE}/associate-dean/grievances/{grv.id}/forward",
            json={"justification": "Trying to forward an already escalated grievance"},
            headers={"Authorization": f"Bearer {env['token_assoc1']}"},
        )
        assert resp.status_code == 400


class TestAssociateDeanAncillaryActions:
    """Verifies evidentiary document requests and committee creation requests by Associate Dean."""

    def test_request_documents_transitions_status_to_awaiting_information(self, db_session: Session):
        env = setup_associate_dean_environment(db_session)
        grv = create_test_grievance_for_assoc_dean(db_session, env, assoc_auth=env["assoc1"])

        payload = {
            "documents": [
                {
                    "document_name": "Official Fee Deposit Receipt",
                    "description": "Stamped bank challan or online transaction confirmation.",
                    "is_required": True,
                }
            ],
            "notes": "Original receipt needed for reimbursement verification.",
        }

        resp = client.post(
            f"{NIVARAN_BASE}/associate-dean/grievances/{grv.id}/document-requests",
            json=payload,
            headers={"Authorization": f"Bearer {env['token_assoc1']}"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["status"] == "AWAITING_INFORMATION"

        # Verify DB status
        db_session.refresh(grv)
        assert grv.status == GrievanceStatus.AWAITING_INFORMATION

        # Verify DocumentRequest created
        doc_req = db_session.scalar(
            select(DocumentRequest).where(
                DocumentRequest.grievance_id == grv.id,
                DocumentRequest.document_name == "Official Fee Deposit Receipt",
            )
        )
        assert doc_req is not None
        assert doc_req.requested_by_id == env["assoc1"].id

        # Verify Applicant Notification
        notif = db_session.scalar(
            select(Notification).where(
                Notification.user_id == env["u_app"].id,
                Notification.title.ilike("%Documents Requested%"),
            )
        )
        assert notif is not None

    def test_request_committee_creation(self, db_session: Session):
        env = setup_associate_dean_environment(db_session)
        grv = create_test_grievance_for_assoc_dean(db_session, env, assoc_auth=env["assoc1"])

        payload = {
            "committee_type": "INQUIRY",
            "proposed_title": "Ad-Hoc Academic Grievance Inquiry Panel",
            "justification": "Requires cross-departmental inquiry into academic records.",
        }

        resp = client.post(
            f"{NIVARAN_BASE}/associate-dean/grievances/{grv.id}/request-committee",
            json=payload,
            headers={"Authorization": f"Bearer {env['token_assoc1']}"},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["request_status"] == "PENDING"
        assert "justification" in data

        # Duplicate committee request rejected
        resp_dup = client.post(
            f"{NIVARAN_BASE}/associate-dean/grievances/{grv.id}/request-committee",
            json=payload,
            headers={"Authorization": f"Bearer {env['token_assoc1']}"},
        )
        assert resp_dup.status_code == 400
