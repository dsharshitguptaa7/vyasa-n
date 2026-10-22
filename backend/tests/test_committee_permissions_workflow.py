# -*- coding: utf-8 -*-
"""
Test Suite: NIVARAN-AI Committee Formation Workflow & Authority Permissions

Verifies:
1. Authoritative Permission Matrix:
   - Assistant Dean can request from Associate Dean or Dean, but CANNOT directly form committees (403 Forbidden).
   - Associate Dean can request from Dean ONLY (CANNOT request from another Associate Dean -> 403 Forbidden), and CAN form directly.
   - Dean can directly form committees, and CANNOT request formation from higher authorities (Dean is highest authority -> 403 Forbidden).
2. Request Review Actions:
   - Recipient / Dean can review: APPROVE, REJECT, REQUEST_CLARIFICATION.
   - Approval does NOT auto-create a committee.
3. Request-to-Committee Linking:
   - Direct formation with creation_request_id links request to formed committee.
4. Notification Source Branding:
   - All notifications emitted have source_pillar == 'NIVARAN'.
"""

import uuid
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.main import app
from app.core.security import create_access_token
from app.models.user import User
from app.models.role import Role, user_roles
from app.models.notification import Notification
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.grievance import Grievance, StudentMasterRecord
from app.modules.atharva_veda.nivaran.models.routing import Assignment
from app.modules.atharva_veda.nivaran.models.committee import (
    CommitteeCreationRequest,
    GrievanceCommittee,
)
from app.modules.atharva_veda.nivaran.models.enums import (
    NivaranRole,
    GrievanceStatus,
    GrievancePriority,
    CommitteeRequestStatus,
    CommitteeStatus,
)
from app.modules.atharva_veda.nivaran.models.taxonomy import Subject, Category

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
            last_name="Tester",
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
        db.commit()
        db.refresh(auth)
    return user, auth, token


@pytest.fixture
def authorities_fixture(db_session: Session):
    u_asst1, auth_asst1, tok_asst1 = get_or_create_authority(
        db_session, "test_asst_dean1@csjmu.ac.in", NivaranRole.ASSISTANT_DEAN, "Assistant Dean Academics"
    )
    u_asst2, auth_asst2, tok_asst2 = get_or_create_authority(
        db_session, "test_asst_dean2@csjmu.ac.in", NivaranRole.ASSISTANT_DEAN, "Assistant Dean Exams"
    )
    u_assoc1, auth_assoc1, tok_assoc1 = get_or_create_authority(
        db_session, "test_assoc_dean1@csjmu.ac.in", NivaranRole.ASSOCIATE_DEAN, "Associate Dean R&D"
    )
    u_assoc2, auth_assoc2, tok_assoc2 = get_or_create_authority(
        db_session, "test_assoc_dean2@csjmu.ac.in", NivaranRole.ASSOCIATE_DEAN, "Associate Dean Student Affairs"
    )
    u_dean, auth_dean, tok_dean = get_or_create_authority(
        db_session, "test_dean_comm@csjmu.ac.in", NivaranRole.DEAN, "Dean Research & Development"
    )
    u_applicant, tok_applicant = get_or_create_user(
        db_session, f"test_app_{uuid.uuid4().hex[:8]}@csjmu.ac.in", ["applicant"]
    )

    return {
        "asst1": (u_asst1, auth_asst1, tok_asst1),
        "asst2": (u_asst2, auth_asst2, tok_asst2),
        "assoc1": (u_assoc1, auth_assoc1, tok_assoc1),
        "assoc2": (u_assoc2, auth_assoc2, tok_assoc2),
        "dean": (u_dean, auth_dean, tok_dean),
        "applicant": (u_applicant, tok_applicant),
    }


@pytest.fixture
def test_grievance(db_session: Session, authorities_fixture):
    u_applicant, _ = authorities_fixture["applicant"]
    _, auth_asst1, _ = authorities_fixture["asst1"]

    sub = db_session.scalar(select(Subject).where(Subject.is_active.is_(True)))
    cat = db_session.scalar(select(Category).where(Category.is_active.is_(True)))

    smr = db_session.scalar(
        select(StudentMasterRecord).where(StudentMasterRecord.student_vyasa_user_id == u_applicant.id)
    )
    if not smr:
        smr = StudentMasterRecord(
            student_vyasa_user_id=u_applicant.id,
            record_number=f"SMR-{uuid.uuid4().hex[:8].upper()}",
            registration_number_snapshot=f"REG-{uuid.uuid4().hex[:6].upper()}",
            enrollment_number_snapshot=f"ENR-{uuid.uuid4().hex[:6].upper()}",
            full_name_snapshot=u_applicant.full_name,
            email_snapshot=u_applicant.email,
            subject_id=sub.id if sub else None,
        )
        db_session.add(smr)
        db_session.commit()
        db_session.refresh(smr)

    grv = Grievance(
        grievance_id=f"CSJMU-COMM-{uuid.uuid4().hex[:6].upper()}",
        applicant_vyasa_user_id=u_applicant.id,
        student_record_id=smr.id,
        subject_id=sub.id if sub else None,
        category_id=cat.id if cat else None,
        final_category_id=cat.id if cat else None,
        title="Test Grievance for Committee Workflow",
        description="Detailed description for committee formation verification test.",
        status=GrievanceStatus.IN_PROGRESS,
        priority=GrievancePriority.HIGH,
        assigned_authority_id=auth_asst1.id,
    )
    db_session.add(grv)
    db_session.commit()
    db_session.refresh(grv)

    # Active assignment to asst1
    assign = Assignment(
        grievance_id=grv.id,
        authority_id=auth_asst1.id,
        is_active=True,
        assigned_at=datetime.now(timezone.utc),
    )
    db_session.add(assign)
    db_session.commit()

    return grv


# ==========================================
# 1. Authoritative Permission Matrix Tests
# ==========================================

def test_assistant_dean_cannot_form_committee_directly(client: TestClient, authorities_fixture, test_grievance):
    """Assistant Dean cannot form a committee directly; must return 403 Forbidden."""
    _, _, tok_asst1 = authorities_fixture["asst1"]
    _, auth_dean, _ = authorities_fixture["dean"]

    payload = {
        "committee_name": "Direct Committee by Asst Dean",
        "terms_of_reference": "Inquiry",
        "grievance_id": str(test_grievance.id),
        "chairperson_id": str(auth_dean.id),
        "members": [{"authority_id": str(auth_dean.id), "member_role": "MEMBER"}],
    }
    resp = client.post(
        f"{NIVARAN_BASE}/committees/direct",
        json=payload,
        headers={"Authorization": f"Bearer {tok_asst1}"},
    )
    assert resp.status_code == 403
    err_msg = resp.json().get("message") or resp.json().get("detail", "")
    assert "Assistant Deans cannot directly form committees" in err_msg


def test_applicant_cannot_form_or_request_committee(client: TestClient, authorities_fixture, test_grievance):
    """Applicant cannot form or request committees (403)."""
    _, tok_applicant = authorities_fixture["applicant"]
    _, auth_dean, _ = authorities_fixture["dean"]

    resp = client.post(
        f"{NIVARAN_BASE}/committees/direct",
        json={
            "committee_name": "Applicant Committee",
            "terms_of_reference": "Test",
            "grievance_id": str(test_grievance.id),
            "chairperson_id": str(auth_dean.id),
            "members": [{"authority_id": str(auth_dean.id), "member_role": "MEMBER"}],
        },
        headers={"Authorization": f"Bearer {tok_applicant}"},
    )
    assert resp.status_code == 403

    resp2 = client.post(
        f"{NIVARAN_BASE}/committees/requests/{test_grievance.id}",
        json={"target_authority_id": str(auth_dean.id), "purpose": "Applicant Request"},
        headers={"Authorization": f"Bearer {tok_applicant}"},
    )
    assert resp2.status_code == 403


def test_associate_dean_cannot_request_from_another_associate_dean(client: TestClient, authorities_fixture, test_grievance):
    """Associate Dean must NOT request committee from another Associate Dean (403)."""
    _, _, tok_assoc1 = authorities_fixture["assoc1"]
    _, auth_assoc2, _ = authorities_fixture["assoc2"]

    payload = {
        "target_authority_id": str(auth_assoc2.id),
        "purpose": "Inter-Associate Dean Request",
        "justification": "Peer review",
    }
    resp = client.post(
        f"{NIVARAN_BASE}/committees/requests/{test_grievance.id}",
        json=payload,
        headers={"Authorization": f"Bearer {tok_assoc1}"},
    )
    assert resp.status_code == 403
    err_msg = resp.json().get("message") or resp.json().get("detail", "")
    assert "Associate Deans can only request committee formation from the Dean" in err_msg


def test_dean_cannot_request_committee_formation(client: TestClient, authorities_fixture, test_grievance):
    """Dean is the highest authority and directly forms committees, not request them (403)."""
    _, _, tok_dean = authorities_fixture["dean"]
    _, auth_assoc1, _ = authorities_fixture["assoc1"]

    payload = {
        "target_authority_id": str(auth_assoc1.id),
        "purpose": "Dean requesting down",
        "justification": "Test",
    }
    resp = client.post(
        f"{NIVARAN_BASE}/committees/requests/{test_grievance.id}",
        json=payload,
        headers={"Authorization": f"Bearer {tok_dean}"},
    )
    assert resp.status_code == 403
    err_msg = resp.json().get("message") or resp.json().get("detail", "")
    assert "Dean is the highest authority and directly forms committees" in err_msg


def test_assistant_dean_cannot_request_from_another_assistant_dean(client: TestClient, authorities_fixture, test_grievance):
    """Assistant Dean cannot request from another Assistant Dean (403)."""
    _, _, tok_asst1 = authorities_fixture["asst1"]
    _, auth_asst2, _ = authorities_fixture["asst2"]

    payload = {
        "target_authority_id": str(auth_asst2.id),
        "purpose": "Peer request between Assistant Deans",
        "justification": "Test",
    }
    resp = client.post(
        f"{NIVARAN_BASE}/committees/requests/{test_grievance.id}",
        json=payload,
        headers={"Authorization": f"Bearer {tok_asst1}"},
    )
    assert resp.status_code == 403
    err_msg = resp.json().get("message") or resp.json().get("detail", "")
    assert "Assistant Deans can only request committee formation from an Associate Dean or Dean" in err_msg


# ==========================================
# 2. Committee Formation Request Workflow
# ==========================================

def test_assistant_dean_can_request_from_associate_dean_or_dean(
    client: TestClient, db_session: Session, authorities_fixture, test_grievance
):
    """Assistant Dean can successfully request committee formation from Associate Dean or Dean."""
    u_asst1, _, tok_asst1 = authorities_fixture["asst1"]
    u_assoc1, auth_assoc1, _ = authorities_fixture["assoc1"]

    payload = {
        "target_authority_id": str(auth_assoc1.id),
        "purpose": "High-level examination of research misconduct allegations",
        "justification": "Specialized domain expert review required under University Statute.",
        "proposed_roles": ["Subject Expert", "External Observer"],
    }
    resp = client.post(
        f"{NIVARAN_BASE}/committees/requests/{test_grievance.id}",
        json=payload,
        headers={"Authorization": f"Bearer {tok_asst1}"},
    )
    assert resp.status_code in (200, 201)
    data = resp.json().get("data", resp.json())
    assert data["request_status"] == "PENDING"
    assert data["requested_by_role"] == "ASSISTANT_DEAN"

    # Verify notification dispatched to recipient with NIVARAN identity
    notif = db_session.scalar(
        select(Notification)
        .where(
            Notification.user_id == u_assoc1.id,
            Notification.event_type == "committee.formation_requested",
        )
        .order_by(Notification.created_at.desc())
    )
    assert notif is not None
    assert notif.source_pillar == "NIVARAN"


def test_associate_dean_can_request_from_dean(
    client: TestClient, db_session: Session, authorities_fixture, test_grievance
):
    """Associate Dean can request committee formation from Dean."""
    u_assoc1, auth_assoc1, tok_assoc1 = authorities_fixture["assoc1"]
    u_dean, auth_dean, _ = authorities_fixture["dean"]

    # Assign grievance to assoc1 to establish jurisdiction
    assign_assoc = Assignment(
        grievance_id=test_grievance.id,
        authority_id=auth_assoc1.id,
        is_active=True,
        assigned_at=datetime.now(timezone.utc),
    )
    db_session.add(assign_assoc)
    db_session.commit()

    payload = {
        "target_authority_id": str(auth_dean.id),
        "purpose": "University-wide inquiry into lab safety compliance",
        "justification": "Executive level committee needed across multiple departments.",
        "proposed_roles": ["Chief Investigator", "Safety Officer"],
    }
    resp = client.post(
        f"{NIVARAN_BASE}/committees/requests/{test_grievance.id}",
        json=payload,
        headers={"Authorization": f"Bearer {tok_assoc1}"},
    )
    assert resp.status_code in (200, 201)
    data = resp.json().get("data", resp.json())
    assert data["request_status"] == "PENDING"

    # Check notification to Dean
    notif = db_session.scalar(
        select(Notification)
        .where(
            Notification.user_id == u_dean.id,
            Notification.event_type == "committee.formation_requested",
        )
        .order_by(Notification.created_at.desc())
    )
    assert notif is not None
    assert notif.source_pillar == "NIVARAN"


def test_recipient_review_actions_and_no_auto_creation(
    client: TestClient, db_session: Session, authorities_fixture, test_grievance
):
    """
    Recipient reviews request:
    - CLARIFICATION_REQUESTED -> updates status and notifies requester.
    - APPROVE -> updates status to APPROVED, but does NOT auto-create committee.
    """
    u_asst1, auth_asst1, tok_asst1 = authorities_fixture["asst1"]
    _, auth_assoc1, tok_assoc1 = authorities_fixture["assoc1"]

    # 1. Create request from asst1 to assoc1
    req_resp = client.post(
        f"{NIVARAN_BASE}/committees/requests/{test_grievance.id}",
        json={
            "target_authority_id": str(auth_assoc1.id),
            "purpose": "Ph.D. Plagiarism Probe",
            "justification": "Requires 3-member review board.",
        },
        headers={"Authorization": f"Bearer {tok_asst1}"},
    )
    assert req_resp.status_code in (200, 201)
    request_id = req_resp.json().get("data", req_resp.json())["id"]

    # 2. Recipient requests clarification
    clarify_resp = client.post(
        f"{NIVARAN_BASE}/committees/requests/{request_id}/review",
        json={
            "action": "REQUEST_CLARIFICATION",
            "remarks": "Please provide similarity index report before constituting board.",
        },
        headers={"Authorization": f"Bearer {tok_assoc1}"},
    )
    assert clarify_resp.status_code == 200
    clarify_data = clarify_resp.json().get("data", clarify_resp.json())
    assert clarify_data["request_status"] == "CLARIFICATION_REQUESTED"

    # Verify notification to asst1
    notif_clarify = db_session.scalar(
        select(Notification)
        .where(
            Notification.user_id == u_asst1.id,
            Notification.event_type == "committee.clarification_requested",
        )
        .order_by(Notification.created_at.desc())
    )
    assert notif_clarify is not None
    assert notif_clarify.source_pillar == "NIVARAN"

    # 3. Recipient approves request
    approve_resp = client.post(
        f"{NIVARAN_BASE}/committees/requests/{request_id}/review",
        json={
            "action": "APPROVE",
            "remarks": "Clarification satisfied. Approved to constitute committee.",
        },
        headers={"Authorization": f"Bearer {tok_assoc1}"},
    )
    assert approve_resp.status_code == 200
    approve_data = approve_resp.json().get("data", approve_resp.json())
    assert approve_data["request_status"] == "APPROVED"

    # Verify notification of approval to asst1
    notif_appr = db_session.scalar(
        select(Notification)
        .where(
            Notification.user_id == u_asst1.id,
            Notification.event_type == "committee.request_approved",
        )
        .order_by(Notification.created_at.desc())
    )
    assert notif_appr is not None
    assert notif_appr.source_pillar == "NIVARAN"

    # CRITICAL: Verify NO committee was auto-created merely because request was approved
    linked_comm = db_session.scalar(
        select(GrievanceCommittee).where(GrievanceCommittee.creation_request_id == uuid.UUID(str(request_id)))
    )
    assert linked_comm is None, "Committee must NOT be auto-created upon request approval!"


# ==========================================
# 3. Direct Committee Formation & Linking
# ==========================================

def test_associate_dean_and_dean_direct_formation_and_request_linking(
    client: TestClient, db_session: Session, authorities_fixture, test_grievance
):
    """
    Associate Dean and Dean can form committees directly,
    and link an approved creation_request_id.
    """
    _, auth_asst1, tok_asst1 = authorities_fixture["asst1"]
    _, auth_assoc1, tok_assoc1 = authorities_fixture["assoc1"]
    _, auth_dean, tok_dean = authorities_fixture["dean"]

    # 1. Create and approve a request
    req_resp = client.post(
        f"{NIVARAN_BASE}/committees/requests/{test_grievance.id}",
        json={
            "target_authority_id": str(auth_dean.id),
            "purpose": "Faculty Conduct Inquiry",
            "justification": "High severity matter.",
        },
        headers={"Authorization": f"Bearer {tok_asst1}"},
    )
    request_id = req_resp.json().get("data", req_resp.json())["id"]

    # Dean approves
    client.post(
        f"{NIVARAN_BASE}/committees/requests/{request_id}/review",
        json={"action": "APPROVE", "remarks": "Sanctioned."},
        headers={"Authorization": f"Bearer {tok_dean}"},
    )

    # 2. Dean forms committee directly linking request
    form_resp = client.post(
        f"{NIVARAN_BASE}/committees/direct",
        json={
            "committee_name": "Statutory Fact-Finding Committee on Faculty Conduct",
            "terms_of_reference": "Submit comprehensive inquiry report within 14 business days.",
            "grievance_id": str(test_grievance.id),
            "creation_request_id": str(request_id),
            "chairperson_id": str(auth_assoc1.id),
            "members": [{"authority_id": str(auth_asst1.id), "member_role": "MEMBER"}],
        },
        headers={"Authorization": f"Bearer {tok_dean}"},
    )
    assert form_resp.status_code in (200, 201)
    c_data = form_resp.json().get("data", form_resp.json())
    assert c_data["committee_name"] == "Statutory Fact-Finding Committee on Faculty Conduct"
    assert c_data["terms_of_reference"] == "Submit comprehensive inquiry report within 14 business days."
    assert str(c_data["creation_request_id"]) == str(request_id)
    assert c_data["status"] == "ACTIVE"
    assert len(c_data["members"]) == 2

    # Check notification source branding for committee formed
    notif_formed = db_session.scalar(
        select(Notification)
        .where(Notification.event_type == "committee.formed")
        .order_by(Notification.created_at.desc())
    )
    assert notif_formed is not None
    assert notif_formed.source_pillar == "NIVARAN"

    # 3. Associate Dean can also form committee directly within jurisdiction
    grv2 = Grievance(
        grievance_id=f"CSJMU-COMM2-{uuid.uuid4().hex[:6].upper()}",
        applicant_vyasa_user_id=test_grievance.applicant_vyasa_user_id,
        student_record_id=test_grievance.student_record_id,
        subject_id=test_grievance.subject_id,
        category_id=test_grievance.category_id,
        status=GrievanceStatus.IN_PROGRESS,
        priority=GrievancePriority.HIGH,
        assigned_authority_id=auth_assoc1.id,
        title="Departmental Assessment Matter",
        description="Assessment grading dispute requiring departmental board.",
    )
    db_session.add(grv2)
    db_session.commit()
    db_session.refresh(grv2)

    assign_assoc = Assignment(
        grievance_id=grv2.id,
        authority_id=auth_assoc1.id,
        is_active=True,
        assigned_at=datetime.now(timezone.utc),
    )
    db_session.add(assign_assoc)
    db_session.commit()

    assoc_form_resp = client.post(
        f"{NIVARAN_BASE}/committees/direct",
        json={
            "committee_name": "Departmental Assessment Board",
            "terms_of_reference": "Review grading discrepancy",
            "grievance_id": str(grv2.id),
            "chairperson_id": str(auth_assoc1.id),
            "members": [{"authority_id": str(auth_asst1.id), "member_role": "MEMBER"}],
        },
        headers={"Authorization": f"Bearer {tok_assoc1}"},
    )
    assert assoc_form_resp.status_code in (200, 201)
    assoc_data = assoc_form_resp.json().get("data", assoc_form_resp.json())
    assert assoc_data["committee_name"] == "Departmental Assessment Board"


def test_eligible_authorities_endpoint(client: TestClient, authorities_fixture):
    """Verify GET /authorities/eligible-committee-members returns active authorities."""
    _, _, tok_asst1 = authorities_fixture["asst1"]
    resp = client.get(
        f"{NIVARAN_BASE}/authorities/eligible-committee-members",
        headers={"Authorization": f"Bearer {tok_asst1}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    data = body["data"] if isinstance(body, dict) and "data" in body else body
    assert isinstance(data, list)
    roles = [item["role"] for item in data]
    assert "DEAN" in roles
    assert "ASSOCIATE_DEAN" in roles
    assert "ASSISTANT_DEAN" in roles
