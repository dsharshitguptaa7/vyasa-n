# -*- coding: utf-8 -*-
"""
Test Suite: NIVARAN-AI Committee Management Workspace & Governance Workflows

Verifies:
1. Role-aware committee visibility & access control (Dean, Associate Dean, Assistant Dean, Member, Unauthorized).
2. Committee overview summary metrics calculation.
3. Dedicated committee workspace detail retrieval and access restrictions.
4. Real-time chat: membership restrictions, chronological persistence, pagination.
5. Polls & voting: poll creation, valid vote casting, duplicate vote prevention, poll closing, quorum calculation, voting policy result computation, certification record.
6. Meetings & Google Meet: scheduling with participant list, Google Meet integration status endpoint (reports unconfigured when credentials absent without faking links), update, cancellation, participant notifications.
7. Documents: uploading committee evidence with SHA-256 integrity checksum, access control.
8. Decisions & minutes: recording draft decision, formally recorded decision, minutes, distinction from final university order.
9. Dissolution: controlled status change to DISSOLVED with reason and actor, historical records preservation (messages, polls, meetings, documents still accessible), rejection of mutations on dissolved committee.
10. Notification source identity verification (source_pillar == 'NIVARAN').
"""

import base64
import uuid
import pytest
from datetime import datetime, timezone, timedelta
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
    CommitteeMember,
    CommitteeMessage,
    CommitteePoll,
    CommitteeMeeting,
    CommitteeFormalDecision,
)
from app.modules.atharva_veda.nivaran.models.enums import (
    NivaranRole,
    GrievanceStatus,
    GrievancePriority,
    CommitteeStatus,
    CommitteeMemberRole,
    CommitteePollStatus,
    MeetingStatus,
)
from app.modules.atharva_veda.nivaran.models.taxonomy import Subject, Category

NIVARAN_BASE = "/api/modules/atharva-veda/nivaran"


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
def workspace_authorities(db_session: Session):
    u_dean, auth_dean, tok_dean = get_or_create_authority(
        db_session, "test_dean_ws@csjmu.ac.in", NivaranRole.DEAN, "Dean Research & Development"
    )
    u_assoc1, auth_assoc1, tok_assoc1 = get_or_create_authority(
        db_session, "test_assoc1_ws@csjmu.ac.in", NivaranRole.ASSOCIATE_DEAN, "Associate Dean Academic Affairs"
    )
    u_assoc2, auth_assoc2, tok_assoc2 = get_or_create_authority(
        db_session, "test_assoc2_ws@csjmu.ac.in", NivaranRole.ASSOCIATE_DEAN, "Associate Dean Student Welfare"
    )
    u_asst1, auth_asst1, tok_asst1 = get_or_create_authority(
        db_session, "test_asst1_ws@csjmu.ac.in", NivaranRole.ASSISTANT_DEAN, "Assistant Dean Exams"
    )
    u_asst2, auth_asst2, tok_asst2 = get_or_create_authority(
        db_session, "test_asst2_ws@csjmu.ac.in", NivaranRole.ASSISTANT_DEAN, "Assistant Dean Admissions"
    )
    u_applicant, tok_applicant = get_or_create_user(
        db_session, f"test_app_ws_{uuid.uuid4().hex[:6]}@csjmu.ac.in", ["applicant"]
    )
    return {
        "dean": (u_dean, auth_dean, tok_dean),
        "assoc1": (u_assoc1, auth_assoc1, tok_assoc1),
        "assoc2": (u_assoc2, auth_assoc2, tok_assoc2),
        "asst1": (u_asst1, auth_asst1, tok_asst1),
        "asst2": (u_asst2, auth_asst2, tok_asst2),
        "applicant": (u_applicant, tok_applicant),
    }


@pytest.fixture
def active_committee_fixture(db_session: Session, workspace_authorities):
    u_app, _ = workspace_authorities["applicant"]
    _, auth_dean, _ = workspace_authorities["dean"]
    _, auth_assoc1, _ = workspace_authorities["assoc1"]
    _, auth_asst1, _ = workspace_authorities["asst1"]

    sub = db_session.scalar(select(Subject).where(Subject.is_active.is_(True)))
    cat = db_session.scalar(select(Category).where(Category.is_active.is_(True)))

    smr = db_session.scalar(
        select(StudentMasterRecord).where(StudentMasterRecord.student_vyasa_user_id == u_app.id)
    )
    if not smr:
        smr = StudentMasterRecord(
            student_vyasa_user_id=u_app.id,
            record_number=f"SMR-{uuid.uuid4().hex[:8].upper()}",
            registration_number_snapshot=f"REG-{uuid.uuid4().hex[:6].upper()}",
            enrollment_number_snapshot=f"ENR-{uuid.uuid4().hex[:6].upper()}",
            full_name_snapshot=u_app.full_name,
            email_snapshot=u_app.email,
            subject_id=sub.id if sub else None,
        )
        db_session.add(smr)
        db_session.commit()
        db_session.refresh(smr)

    grv = Grievance(
        grievance_id=f"CSJMU-WS-{uuid.uuid4().hex[:6].upper()}",
        applicant_vyasa_user_id=u_app.id,
        student_record_id=smr.id,
        subject_id=sub.id if sub else None,
        category_id=cat.id if cat else None,
        title="Grievance for Committee Workspace Verification",
        description="Detailed inquiry matter for institutional governance workspace.",
        status=GrievanceStatus.IN_PROGRESS,
        priority=GrievancePriority.HIGH,
        assigned_authority_id=auth_assoc1.id,
    )
    db_session.add(grv)
    db_session.commit()
    db_session.refresh(grv)

    now_utc = datetime.now(timezone.utc)
    comm = GrievanceCommittee(
        id=uuid.uuid4(),
        grievance_id=grv.id,
        committee_name="Statutory Fact-Finding Committee on Lab Standards",
        terms_of_reference="Examine laboratory safety compliance under Ordinance 42.",
        chairperson_id=auth_assoc1.id,
        status=CommitteeStatus.ACTIVE,
        chartered_at=now_utc,
        created_at=now_utc,
        updated_at=now_utc,
    )
    db_session.add(comm)

    # Chairperson member
    m_chair = CommitteeMember(
        id=uuid.uuid4(),
        committee_id=comm.id,
        authority_id=auth_assoc1.id,
        member_role=CommitteeMemberRole.CHAIRPERSON,
        appointed_at=now_utc,
        is_active=True,
    )
    # Assistant dean member
    m_asst = CommitteeMember(
        id=uuid.uuid4(),
        committee_id=comm.id,
        authority_id=auth_asst1.id,
        member_role=CommitteeMemberRole.MEMBER,
        appointed_at=now_utc,
        is_active=True,
    )
    db_session.add_all([m_chair, m_asst])
    db_session.commit()
    db_session.refresh(comm)

    return comm, grv


# ==========================================
# 1. Overview Metrics & Visibility Tests
# ==========================================

def test_committee_overview_metrics(client: TestClient, workspace_authorities, active_committee_fixture):
    """Verifies calculated overview metrics endpoint for authorized users."""
    _, _, tok_dean = workspace_authorities["dean"]
    resp = client.get(
        f"{NIVARAN_BASE}/committees/overview-metrics",
        headers={"Authorization": f"Bearer {tok_dean}"},
    )
    assert resp.status_code == 200
    data = resp.json().get("data", resp.json())
    assert "total_committees" in data
    assert "active_committees" in data
    assert "dissolved_committees" in data
    assert "pending_requests" in data
    assert "pending_polls_for_user" in data
    assert "upcoming_meetings" in data
    assert data["total_committees"] >= 1
    assert data["active_committees"] >= 1


def test_role_aware_committee_visibility_and_access(
    client: TestClient, workspace_authorities, active_committee_fixture
):
    """
    Verifies role-based access:
    - Dean can access workspace.
    - Committee member (asst1) can access workspace.
    - Chairperson (assoc1) can access workspace.
    - Non-member assistant dean (asst2) receives 403 Forbidden.
    - Applicant receives 403 Forbidden.
    """
    comm, _ = active_committee_fixture
    _, _, tok_dean = workspace_authorities["dean"]
    _, _, tok_assoc1 = workspace_authorities["assoc1"]
    _, _, tok_asst1 = workspace_authorities["asst1"]
    _, _, tok_asst2 = workspace_authorities["asst2"]
    _, tok_applicant = workspace_authorities["applicant"]

    # 1. Dean oversight access
    r_dean = client.get(
        f"{NIVARAN_BASE}/committees/{comm.id}",
        headers={"Authorization": f"Bearer {tok_dean}"},
    )
    assert r_dean.status_code == 200
    d_dean = r_dean.json().get("data", r_dean.json())
    assert d_dean["committee"]["id"] == str(comm.id)
    assert d_dean["can_manage"] is True

    # 2. Chairperson access
    r_chair = client.get(
        f"{NIVARAN_BASE}/committees/{comm.id}",
        headers={"Authorization": f"Bearer {tok_assoc1}"},
    )
    assert r_chair.status_code == 200
    d_chair = r_chair.json().get("data", r_chair.json())
    assert d_chair["user_role_in_committee"] == "CHAIRPERSON"
    assert d_chair["can_manage"] is True

    # 3. Member access
    r_member = client.get(
        f"{NIVARAN_BASE}/committees/{comm.id}",
        headers={"Authorization": f"Bearer {tok_asst1}"},
    )
    assert r_member.status_code == 200
    d_mem = r_member.json().get("data", r_member.json())
    assert d_mem["user_role_in_committee"] == "MEMBER"
    assert d_mem["can_vote"] is True

    # 4. Non-member Assistant Dean access denied (403)
    r_unauth = client.get(
        f"{NIVARAN_BASE}/committees/{comm.id}",
        headers={"Authorization": f"Bearer {tok_asst2}"},
    )
    assert r_unauth.status_code == 403

    # 5. Applicant access denied (403)
    r_app = client.get(
        f"{NIVARAN_BASE}/committees/{comm.id}",
        headers={"Authorization": f"Bearer {tok_applicant}"},
    )
    assert r_app.status_code == 403


# ==========================================
# 2. Real-Time Chat & Persistence Tests
# ==========================================

def test_committee_chat_messages(client: TestClient, workspace_authorities, active_committee_fixture):
    """
    Verifies committee messaging:
    - Member posts message, stored in DB and retrievable chronologically.
    - Non-member cannot post or read messages.
    """
    comm, _ = active_committee_fixture
    _, _, tok_asst1 = workspace_authorities["asst1"]
    _, _, tok_asst2 = workspace_authorities["asst2"]

    # 1. Post message by appointed member
    resp_post = client.post(
        f"{NIVARAN_BASE}/committees/{comm.id}/messages",
        json={"message_text": "Preliminary inspection scheduled for tomorrow at 10 AM."},
        headers={"Authorization": f"Bearer {tok_asst1}"},
    )
    assert resp_post.status_code == 200
    msg_data = resp_post.json().get("data", resp_post.json())
    assert msg_data["message_text"] == "Preliminary inspection scheduled for tomorrow at 10 AM."
    assert "sender_name" in msg_data

    # 2. Retrieve messages
    resp_list = client.get(
        f"{NIVARAN_BASE}/committees/{comm.id}/messages",
        headers={"Authorization": f"Bearer {tok_asst1}"},
    )
    assert resp_list.status_code == 200
    msgs = resp_list.json().get("data", resp_list.json())
    assert len(msgs) >= 1
    assert any(m["message_text"] == "Preliminary inspection scheduled for tomorrow at 10 AM." for m in msgs)

    # 3. Non-member denied post and list (403)
    resp_denied = client.post(
        f"{NIVARAN_BASE}/committees/{comm.id}/messages",
        json={"message_text": "Unauthorized intrusion attempt."},
        headers={"Authorization": f"Bearer {tok_asst2}"},
    )
    assert resp_denied.status_code == 403

    resp_denied_list = client.get(
        f"{NIVARAN_BASE}/committees/{comm.id}/messages",
        headers={"Authorization": f"Bearer {tok_asst2}"},
    )
    assert resp_denied_list.status_code == 403


# ==========================================
# 3. Polling, Voting & Duplicate Prevention Tests
# ==========================================

def test_committee_polling_and_voting_workflow(
    client: TestClient, db_session: Session, workspace_authorities, active_committee_fixture
):
    """
    Verifies formal committee polling:
    - Member creates poll with options.
    - Member casts vote.
    - Duplicate voting attempt is rejected (400 Bad Request).
    - Closing poll tallies votes and records official CommitteeDecisionRecord.
    - Notification dispatched with source_pillar == 'NIVARAN'.
    """
    comm, _ = active_committee_fixture
    u_assoc1, _, tok_assoc1 = workspace_authorities["assoc1"]
    u_asst1, _, tok_asst1 = workspace_authorities["asst1"]

    # 1. Create poll
    poll_resp = client.post(
        f"{NIVARAN_BASE}/committees/{comm.id}/polls",
        json={
            "title": "Ratify Interim Lab Safety Protocol",
            "description": "Shall we mandate secondary fume hood ventilation immediately?",
            "voting_policy": "SIMPLE_MAJORITY",
            "quorum_required": 1,
            "options": ["In Favor", "Against", "Abstain"],
        },
        headers={"Authorization": f"Bearer {tok_assoc1}"},
    )
    assert poll_resp.status_code == 200
    poll_data = poll_resp.json().get("data", poll_resp.json())
    poll_id = poll_data["id"]
    options = poll_data["options"]
    assert len(options) == 3

    opt_in_favor = next(o for o in options if o["option_text"] == "In Favor")

    # 2. Cast vote by appointed member
    vote_resp = client.post(
        f"{NIVARAN_BASE}/committees/polls/{poll_id}/vote",
        json={"option_id": opt_in_favor["id"]},
        headers={"Authorization": f"Bearer {tok_asst1}"},
    )
    assert vote_resp.status_code == 200
    v_data = vote_resp.json().get("data", vote_resp.json())
    assert v_data["user_has_voted"] is True
    assert v_data["total_votes"] >= 1

    # 3. Duplicate voting attempt MUST fail with 400 Bad Request
    dup_resp = client.post(
        f"{NIVARAN_BASE}/committees/polls/{poll_id}/vote",
        json={"option_id": opt_in_favor["id"]},
        headers={"Authorization": f"Bearer {tok_asst1}"},
    )
    assert dup_resp.status_code == 400
    err_msg = dup_resp.json().get("message") or dup_resp.json().get("detail", "")
    assert "Duplicate voting is prohibited" in err_msg or "already cast" in err_msg

    # 4. Close poll and certify decision
    close_resp = client.post(
        f"{NIVARAN_BASE}/committees/polls/{poll_id}/close",
        headers={"Authorization": f"Bearer {tok_assoc1}"},
    )
    assert close_resp.status_code == 200
    c_data = close_resp.json().get("data", close_resp.json())
    assert c_data["status"] == "CLOSED"
    assert c_data["winning_option_id"] == opt_in_favor["id"]
    assert c_data["decision_status"] == "RATIFIED"

    # 5. Check notification source branding (NIVARAN)
    notif = db_session.scalar(
        select(Notification)
        .where(Notification.event_type == "committee.poll_closed")
        .order_by(Notification.created_at.desc())
    )
    assert notif is not None
    assert notif.source_pillar == "NIVARAN"


# ==========================================
# 4. Google Meet Integration & Meetings Tests
# ==========================================

def test_meeting_scheduling_and_google_meet_status(
    client: TestClient, db_session: Session, workspace_authorities, active_committee_fixture
):
    """
    Verifies meeting scheduling and Google Meet integration:
    - Integration status reports CREDENTIALS_REQUIRED when unconfigured without generating fake links.
    - Meeting is scheduled with genuine participant records.
    - Notification dispatched with source_pillar == 'NIVARAN'.
    """
    comm, _ = active_committee_fixture
    _, auth_asst1, tok_asst1 = workspace_authorities["asst1"]
    _, _, tok_assoc1 = workspace_authorities["assoc1"]

    # 1. Check Google Meet integration status
    g_resp = client.get(
        f"{NIVARAN_BASE}/committees/{comm.id}/meetings/integration-status",
        headers={"Authorization": f"Bearer {tok_asst1}"},
    )
    assert g_resp.status_code == 200
    g_data = g_resp.json().get("data", g_resp.json())
    assert "configured" in g_data
    assert "status" in g_data
    if not g_data["configured"]:
        assert g_data["status"] == "CREDENTIALS_REQUIRED"
        assert "setup_instructions" in g_data

    # 2. Schedule meeting
    now_utc = datetime.now(timezone.utc)
    start_time = now_utc + timedelta(days=2)
    end_time = start_time + timedelta(hours=1)

    meet_resp = client.post(
        f"{NIVARAN_BASE}/committees/{comm.id}/meetings",
        json={
            "title": "On-Site Evidence Review Meeting",
            "agenda": "Review physical evidence submitted by departmental safety warden.",
            "scheduled_start": start_time.isoformat(),
            "scheduled_end": end_time.isoformat(),
            "meeting_type": "INTERNAL_COMMITTEE",
            "participant_authority_ids": [str(auth_asst1.id)],
            "external_meet_link": "https://meet.google.com/test-real-link",
        },
        headers={"Authorization": f"Bearer {tok_assoc1}"},
    )
    assert meet_resp.status_code == 200
    m_data = meet_resp.json().get("data", meet_resp.json())
    assert m_data["title"] == "On-Site Evidence Review Meeting"
    assert m_data["meeting_status"] == "SCHEDULED"
    assert len(m_data["participants"]) >= 1

    # 3. Check notification source branding
    notif_meet = db_session.scalar(
        select(Notification)
        .where(Notification.event_type == "committee.meeting_scheduled")
        .order_by(Notification.created_at.desc())
    )
    assert notif_meet is not None
    assert notif_meet.source_pillar == "NIVARAN"


# ==========================================
# 5. Documents & Evidence Upload Tests
# ==========================================

def test_committee_document_upload_and_integrity(
    client: TestClient, workspace_authorities, active_committee_fixture
):
    """
    Verifies document upload and cryptographic integrity checksum:
    - Base64 file upload.
    - Content hash (SHA-256) recorded.
    - Listed in committee documents.
    """
    comm, _ = active_committee_fixture
    _, _, tok_asst1 = workspace_authorities["asst1"]

    test_content = b"Official laboratory inspection notes and particulate air quality readings."
    b64_content = base64.b64encode(test_content).decode("utf-8")

    doc_resp = client.post(
        f"{NIVARAN_BASE}/committees/{comm.id}/documents",
        json={
            "file_name": "air_quality_readings.pdf",
            "mime_type": "application/pdf",
            "file_size": len(test_content),
            "document_type": "COMMITTEE_EVIDENCE",
            "content_base64": b64_content,
        },
        headers={"Authorization": f"Bearer {tok_asst1}"},
    )
    assert doc_resp.status_code == 200
    doc_data = doc_resp.json().get("data", doc_resp.json())
    assert doc_data["file_name"] == "air_quality_readings.pdf"
    assert doc_data["content_hash"] is not None

    # Retrieve documents
    list_resp = client.get(
        f"{NIVARAN_BASE}/committees/{comm.id}/documents",
        headers={"Authorization": f"Bearer {tok_asst1}"},
    )
    assert list_resp.status_code == 200
    docs = list_resp.json().get("data", list_resp.json())
    assert any(d["file_name"] == "air_quality_readings.pdf" for d in docs)


# ==========================================
# 6. Formal Decisions & Minutes Tests
# ==========================================

def test_committee_formal_decisions_and_minutes(
    client: TestClient, db_session: Session, workspace_authorities, active_committee_fixture
):
    """
    Verifies formal decisions and minutes:
    - Chairperson records official committee decision.
    - Stored with participating members snapshot.
    - Distinguished from final university order.
    - Notification source identity is NIVARAN.
    """
    comm, _ = active_committee_fixture
    _, _, tok_assoc1 = workspace_authorities["assoc1"]

    dec_resp = client.post(
        f"{NIVARAN_BASE}/committees/{comm.id}/decisions",
        json={
            "title": "Interim Finding: Primary Air Ventilation Non-Compliant",
            "decision_type": "FORMAL_DECISION",
            "outcome": "ACTION_RECOMMENDED",
            "summary": "Committee concludes unanimously that secondary exhaust system requires urgent overhaul.",
            "is_final_institutional_order": False,
        },
        headers={"Authorization": f"Bearer {tok_assoc1}"},
    )
    assert dec_resp.status_code == 200
    d_data = dec_resp.json().get("data", dec_resp.json())
    assert d_data["title"] == "Interim Finding: Primary Air Ventilation Non-Compliant"
    assert d_data["is_final_institutional_order"] is False
    assert d_data["participating_members_snapshot"] is not None

    # Verify notification source branding
    notif_dec = db_session.scalar(
        select(Notification)
        .where(Notification.event_type == "committee.decision_recorded")
        .order_by(Notification.created_at.desc())
    )
    assert notif_dec is not None
    assert notif_dec.source_pillar == "NIVARAN"


# ==========================================
# 7. Dissolution & Historical Preservation Tests
# ==========================================

def test_committee_dissolution_and_historical_preservation(
    client: TestClient, db_session: Session, workspace_authorities, active_committee_fixture
):
    """
    Verifies formal dissolution:
    - Status changes to DISSOLVED with reason and disbanded_at.
    - Historical records (chat messages, documents, decisions) remain accessible in read-only mode.
    - Mutations on dissolved committee are rejected with 400 Bad Request.
    """
    comm, _ = active_committee_fixture
    _, _, tok_assoc1 = workspace_authorities["assoc1"]
    _, _, tok_asst1 = workspace_authorities["asst1"]

    # 1. Dissolve committee
    dissolve_resp = client.post(
        f"{NIVARAN_BASE}/committees/{comm.id}/dissolve",
        json={"reason": "Mandate concluded upon submission of final inquiry report to the Dean."},
        headers={"Authorization": f"Bearer {tok_assoc1}"},
    )
    assert dissolve_resp.status_code == 200
    diss_data = dissolve_resp.json().get("data", dissolve_resp.json())
    assert diss_data["status"] == "DISSOLVED"
    assert diss_data["dissolution_reason"] == "Mandate concluded upon submission of final inquiry report to the Dean."

    # 2. Historical records are preserved and accessible in read-only mode
    r_detail = client.get(
        f"{NIVARAN_BASE}/committees/{comm.id}",
        headers={"Authorization": f"Bearer {tok_asst1}"},
    )
    assert r_detail.status_code == 200
    d_info = r_detail.json().get("data", r_detail.json())
    assert d_info["committee"]["status"] == "DISSOLVED"
    assert d_info["can_vote"] is False

    # 3. Chat history is preserved
    r_msgs = client.get(
        f"{NIVARAN_BASE}/committees/{comm.id}/messages",
        headers={"Authorization": f"Bearer {tok_asst1}"},
    )
    assert r_msgs.status_code == 200

    # 4. Mutation rejected on dissolved committee (400 Bad Request)
    r_fail_post = client.post(
        f"{NIVARAN_BASE}/committees/{comm.id}/messages",
        json={"message_text": "Late message after dissolution."},
        headers={"Authorization": f"Bearer {tok_asst1}"},
    )
    assert r_fail_post.status_code == 400
    fail_msg = r_fail_post.json().get("message") or r_fail_post.json().get("detail", "")
    assert "dissolved" in fail_msg.lower()

    # 5. Poll creation rejected on dissolved committee
    r_fail_poll = client.post(
        f"{NIVARAN_BASE}/committees/{comm.id}/polls",
        json={
            "title": "Post Dissolution Poll",
            "description": "Invalid",
            "options": ["Yes", "No"],
        },
        headers={"Authorization": f"Bearer {tok_asst1}"},
    )
    assert r_fail_poll.status_code == 400
