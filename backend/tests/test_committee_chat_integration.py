# -*- coding: utf-8 -*-
"""
Test Suite: NIVARAN-AI Committee Real-Time Chat PostgreSQL Integration Tests

Requires: Isolated PostgreSQL test database configured via TEST_DATABASE_URL.
If TEST_DATABASE_URL is absent, the conftest.py security guard fails closed immediately.

Verifies:
1. Two authenticated committee members in the same committee room:
   - Client 1 sends message -> persisted in database.
   - Client 2 receives and reads the persisted message.
2. Deterministic Chronological Message History:
   - Messages retrieved in strictly ascending chronological order by created_at.
3. Bounded Pagination:
   - Querying messages with `limit` restricts page size.
   - Paginating backwards with `before_id` cursor returns older messages in chronological order.
4. Cross-Committee Room Isolation:
   - Messages posted to Committee A are NEVER accessible or leaked into Committee B.
5. Reconnect and Message History Recovery:
   - When a client disconnects, messages sent during the offline period are persisted.
   - Upon reconnecting, the client retrieves the complete uninterrupted chat history.
6. Single-Use Ticket Flow & Authorization:
   - Generating a ticket via /ws-ticket succeeds for committee members.
   - Non-members are strictly rejected with HTTP 403.
   - Reusing a burned ticket is rejected.
"""

import uuid
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.models.user import User
from app.models.role import Role, user_roles
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.grievance import Grievance, StudentMasterRecord
from app.modules.atharva_veda.nivaran.models.committee import (
    GrievanceCommittee,
    CommitteeMember,
    CommitteeMessage,
)
from app.modules.atharva_veda.nivaran.models.enums import (
    NivaranRole,
    GrievanceStatus,
    GrievancePriority,
    CommitteeStatus,
    CommitteeMemberRole,
    CommitteeMessageType,
)
from app.modules.atharva_veda.nivaran.models.taxonomy import Subject, Category, SubjectCluster, GrievanceCluster
from app.modules.atharva_veda.nivaran.services.committee_chat_ws import committee_chat_manager

NIVARAN_BASE = "/api/modules/atharva-veda/nivaran"


# ==========================================
# Helpers & Fixtures
# ==========================================

def _create_test_authority(db: Session, email: str, role_name: str, nivaran_role: NivaranRole) -> tuple[User, NivaranAuthority, str]:
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
        db.flush()

        role = db.scalar(select(Role).where(Role.name == role_name))
        if role:
            db.execute(user_roles.insert().values(user_id=user.id, role_id=role.id))
            db.flush()

    auth = db.scalar(select(NivaranAuthority).where(NivaranAuthority.vyasa_user_id == user.id))
    if not auth:
        auth = NivaranAuthority(
            vyasa_user_id=user.id,
            role=nivaran_role,
            name_snapshot=f"{user.first_name} {user.last_name}",
            designation=nivaran_role.value.replace("_", " ").title(),
            is_active=True,
        )
        db.add(auth)
        db.flush()

    token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": role_name})
    return user, auth, token


@pytest.fixture
def chat_integration_setup(db_session: Session):
    """
    Creates two active committees (Committee A and Committee B) with members:
    - Member 1 (Associate Dean) in Committee A.
    - Member 2 (Assistant Dean) in Committee A.
    - Outsider (Assistant Dean) in Committee B only.
    """
    db = db_session

    u1, auth1, tok1 = _create_test_authority(db, "chat_member1@csjmu.ac.in", "Atharva_Associate_Dean", NivaranRole.ASSOCIATE_DEAN)
    u2, auth2, tok2 = _create_test_authority(db, "chat_member2@csjmu.ac.in", "Atharva_Assistant_Dean", NivaranRole.ASSISTANT_DEAN)
    u_out, auth_out, tok_out = _create_test_authority(db, "chat_outsider@csjmu.ac.in", "Atharva_Assistant_Dean", NivaranRole.ASSISTANT_DEAN)

    # Grievance Taxonomy Setup
    s_cluster = db.scalar(select(SubjectCluster).where(SubjectCluster.cluster_code == "ENGG"))
    if not s_cluster:
        s_cluster = SubjectCluster(cluster_code="ENGG", name="Engineering")
        db.add(s_cluster)
        db.flush()

    subject = db.scalar(select(Subject).where(Subject.code == "CS"))
    if not subject:
        subject = Subject(cluster_id=s_cluster.id, code="CS", name="Computer Science")
        db.add(subject)
        db.flush()

    g_cluster = db.scalar(select(GrievanceCluster).where(GrievanceCluster.cluster_code == "ACAD"))
    if not g_cluster:
        g_cluster = GrievanceCluster(cluster_code="ACAD", name="Academic Affairs")
        db.add(g_cluster)
        db.flush()

    category = db.scalar(select(Category).where(Category.code == "EXAM_DISPUTE"))
    if not category:
        category = Category(
            cluster_id=g_cluster.id,
            code="EXAM_DISPUTE",
            name="Examination Dispute",
            routing_type="AUTOMATIC_CLUSTER_MAPPED",
        )
        db.add(category)
        db.flush()

    student = db.scalar(select(StudentMasterRecord).where(StudentMasterRecord.enrollment_number == "ENR-CHAT-TEST"))
    if not student:
        student = StudentMasterRecord(
            enrollment_number="ENR-CHAT-TEST",
            name="Chat Test Student",
            current_subject_id=subject.id,
        )
        db.add(student)
        db.flush()

    # Grievance 1
    g1 = Grievance(
        grievance_id="GRV-CHAT-001",
        applicant_user_id=u1.id,
        student_id=student.id,
        final_category_id=category.id,
        status=GrievanceStatus.IN_PROGRESS,
        priority=GrievancePriority.HIGH,
        nature_of_grievance="Committee investigation grievance 1",
    )
    db.add(g1)
    db.flush()

    # Grievance 2
    g2 = Grievance(
        grievance_id="GRV-CHAT-002",
        applicant_user_id=u1.id,
        student_id=student.id,
        final_category_id=category.id,
        status=GrievanceStatus.IN_PROGRESS,
        priority=GrievancePriority.MEDIUM,
        nature_of_grievance="Committee investigation grievance 2",
    )
    db.add(g2)
    db.flush()

    # Committee A (g1) - Members: auth1 (Chair), auth2 (Member)
    comm_a = GrievanceCommittee(
        grievance_id=g1.id,
        committee_name="Inquiry Committee Alpha",
        chairperson_id=auth1.id,
        status=CommitteeStatus.ACTIVE,
    )
    db.add(comm_a)
    db.flush()

    db.add(CommitteeMember(committee_id=comm_a.id, authority_id=auth1.id, member_role=CommitteeMemberRole.CHAIRPERSON, is_active=True))
    db.add(CommitteeMember(committee_id=comm_a.id, authority_id=auth2.id, member_role=CommitteeMemberRole.MEMBER, is_active=True))
    db.flush()

    # Committee B (g2) - Members: auth_out (Chair)
    comm_b = GrievanceCommittee(
        grievance_id=g2.id,
        committee_name="Inquiry Committee Beta",
        chairperson_id=auth_out.id,
        status=CommitteeStatus.ACTIVE,
    )
    db.add(comm_b)
    db.flush()

    db.add(CommitteeMember(committee_id=comm_b.id, authority_id=auth_out.id, member_role=CommitteeMemberRole.CHAIRPERSON, is_active=True))
    db.flush()

    return {
        "comm_a": comm_a,
        "comm_b": comm_b,
        "member1": (u1, auth1, tok1),
        "member2": (u2, auth2, tok2),
        "outsider": (u_out, auth_out, tok_out),
    }


# ==========================================
# Integration Test Cases
# ==========================================

def test_two_clients_live_delivery_and_persistence(client: TestClient, db_session: Session, chat_integration_setup):
    """
    Verifies two authenticated clients in the same committee room:
    - Client 1 posts a message.
    - The message is persisted in PostgreSQL.
    - Client 2 retrieves message history and observes the new message with correct metadata.
    """
    setup = chat_integration_setup
    comm_a = setup["comm_a"]
    _, auth1, tok1 = setup["member1"]
    _, auth2, tok2 = setup["member2"]

    # 1. Client 1 sends message
    post_resp = client.post(
        f"{NIVARAN_BASE}/committees/{comm_a.id}/messages",
        json={"message_text": "Evidence verification scheduled for Room 102."},
        headers={"Authorization": f"Bearer {tok1}"},
    )
    assert post_resp.status_code == 200
    data = post_resp.json().get("data", post_resp.json())
    assert data["message_text"] == "Evidence verification scheduled for Room 102."
    assert data["sender_authority_id"] == str(auth1.id)
    assert data["sender_name"] == auth1.name_snapshot
    msg_id = data["id"]

    # 2. Database verification: message is persisted
    db_msg = db_session.scalar(select(CommitteeMessage).where(CommitteeMessage.id == uuid.UUID(msg_id)))
    assert db_msg is not None
    assert db_msg.message_text == "Evidence verification scheduled for Room 102."
    assert db_msg.sender_authority_id == auth1.id
    assert db_msg.committee_id == comm_a.id

    # 3. Client 2 retrieves messages and receives Client 1's message
    list_resp = client.get(
        f"{NIVARAN_BASE}/committees/{comm_a.id}/messages",
        headers={"Authorization": f"Bearer {tok2}"},
    )
    assert list_resp.status_code == 200
    msgs = list_resp.json().get("data", list_resp.json())
    assert len(msgs) == 1
    assert msgs[0]["id"] == msg_id
    assert msgs[0]["message_text"] == "Evidence verification scheduled for Room 102."


def test_message_history_deterministic_chronological_ordering(client: TestClient, db_session: Session, chat_integration_setup):
    """
    Verifies that message history is retrieved in strictly ascending chronological order.
    """
    setup = chat_integration_setup
    comm_a = setup["comm_a"]
    _, _, tok1 = setup["member1"]
    _, _, tok2 = setup["member2"]

    # Post 4 messages alternating between member 1 and member 2
    texts = [
        "First message from Chair",
        "Second message response from Member",
        "Third message clarification",
        "Fourth message final confirmation",
    ]
    tokens = [tok1, tok2, tok1, tok2]

    for text, tok in zip(texts, tokens):
        res = client.post(
            f"{NIVARAN_BASE}/committees/{comm_a.id}/messages",
            json={"message_text": text},
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert res.status_code == 200

    # Retrieve messages
    resp = client.get(
        f"{NIVARAN_BASE}/committees/{comm_a.id}/messages",
        headers={"Authorization": f"Bearer {tok1}"},
    )
    assert resp.status_code == 200
    retrieved = resp.json().get("data", resp.json())
    assert len(retrieved) == 4

    # Assert deterministic chronological order: oldest to newest
    retrieved_texts = [m["message_text"] for m in retrieved]
    assert retrieved_texts == texts

    # Assert timestamp monotonicity
    timestamps = [m["created_at"] for m in retrieved]
    assert timestamps == sorted(timestamps)


def test_bounded_pagination_and_cursor(client: TestClient, chat_integration_setup):
    """
    Verifies that pagination is bounded and the before_id cursor correctly retrieves older pages.
    """
    setup = chat_integration_setup
    comm_a = setup["comm_a"]
    _, _, tok1 = setup["member1"]

    # Post 6 messages
    for i in range(1, 7):
        res = client.post(
            f"{NIVARAN_BASE}/committees/{comm_a.id}/messages",
            json={"message_text": f"Audit record entry #{i}"},
            headers={"Authorization": f"Bearer {tok1}"},
        )
        assert res.status_code == 200

    # 1. Bounded page size (limit=3) returns the 3 most recent messages in chronological order
    page1_resp = client.get(
        f"{NIVARAN_BASE}/committees/{comm_a.id}/messages?limit=3",
        headers={"Authorization": f"Bearer {tok1}"},
    )
    assert page1_resp.status_code == 200
    page1 = page1_resp.json().get("data", page1_resp.json())
    assert len(page1) == 3
    assert [m["message_text"] for m in page1] == [
        "Audit record entry #4",
        "Audit record entry #5",
        "Audit record entry #6",
    ]

    # 2. Cursor pagination: request older page using before_id from oldest item in page 1
    cursor_id = page1[0]["id"]
    page2_resp = client.get(
        f"{NIVARAN_BASE}/committees/{comm_a.id}/messages?limit=3&before_id={cursor_id}",
        headers={"Authorization": f"Bearer {tok1}"},
    )
    assert page2_resp.status_code == 200
    page2 = page2_resp.json().get("data", page2_resp.json())
    assert len(page2) == 3
    assert [m["message_text"] for m in page2] == [
        "Audit record entry #1",
        "Audit record entry #2",
        "Audit record entry #3",
    ]


def test_cross_committee_room_isolation(client: TestClient, chat_integration_setup):
    """
    Verifies that messages posted in Committee A never appear in Committee B.
    """
    setup = chat_integration_setup
    comm_a = setup["comm_a"]
    comm_b = setup["comm_b"]
    _, _, tok_a = setup["member1"]
    _, _, tok_b = setup["outsider"]

    # Post in Comm A
    client.post(
        f"{NIVARAN_BASE}/committees/{comm_a.id}/messages",
        json={"message_text": "Confidential investigation in Committee Alpha."},
        headers={"Authorization": f"Bearer {tok_a}"},
    )

    # Post in Comm B
    client.post(
        f"{NIVARAN_BASE}/committees/{comm_b.id}/messages",
        json={"message_text": "Distinct discussion in Committee Beta."},
        headers={"Authorization": f"Bearer {tok_b}"},
    )

    # Comm A messages
    msgs_a = client.get(
        f"{NIVARAN_BASE}/committees/{comm_a.id}/messages",
        headers={"Authorization": f"Bearer {tok_a}"},
    ).json().get("data")
    assert len(msgs_a) == 1
    assert msgs_a[0]["message_text"] == "Confidential investigation in Committee Alpha."

    # Comm B messages
    msgs_b = client.get(
        f"{NIVARAN_BASE}/committees/{comm_b.id}/messages",
        headers={"Authorization": f"Bearer {tok_b}"},
    ).json().get("data")
    assert len(msgs_b) == 1
    assert msgs_b[0]["message_text"] == "Distinct discussion in Committee Beta."


def test_reconnect_and_history_recovery(client: TestClient, chat_integration_setup):
    """
    Verifies that when a client is disconnected/offline, all interim messages are persisted
    and completely recovered upon reconnection.
    """
    setup = chat_integration_setup
    comm_a = setup["comm_a"]
    _, _, tok1 = setup["member1"]
    _, _, tok2 = setup["member2"]

    # 1. Member 2 goes offline. Member 1 posts 3 updates.
    for i in range(1, 4):
        client.post(
            f"{NIVARAN_BASE}/committees/{comm_a.id}/messages",
            json={"message_text": f"Offline progress note #{i}"},
            headers={"Authorization": f"Bearer {tok1}"},
        )

    # 2. Member 2 reconnects and requests message history
    recovery_resp = client.get(
        f"{NIVARAN_BASE}/committees/{comm_a.id}/messages",
        headers={"Authorization": f"Bearer {tok2}"},
    )
    assert recovery_resp.status_code == 200
    msgs = recovery_resp.json().get("data", recovery_resp.json())
    assert len(msgs) == 3
    assert [m["message_text"] for m in msgs] == [
        "Offline progress note #1",
        "Offline progress note #2",
        "Offline progress note #3",
    ]


def test_unauthorized_non_member_access_forbidden(client: TestClient, chat_integration_setup):
    """
    Verifies that a user not belonging to Committee A is rejected with HTTP 403 on all chat endpoints.
    """
    setup = chat_integration_setup
    comm_a = setup["comm_a"]
    _, _, tok_out = setup["outsider"]

    # Cannot list messages
    res_list = client.get(
        f"{NIVARAN_BASE}/committees/{comm_a.id}/messages",
        headers={"Authorization": f"Bearer {tok_out}"},
    )
    assert res_list.status_code == 403

    # Cannot post messages
    res_post = client.post(
        f"{NIVARAN_BASE}/committees/{comm_a.id}/messages",
        json={"message_text": "Intrusion payload"},
        headers={"Authorization": f"Bearer {tok_out}"},
    )
    assert res_post.status_code == 403

    # Cannot acquire WS ticket
    res_ticket = client.post(
        f"{NIVARAN_BASE}/committees/{comm_a.id}/ws-ticket",
        headers={"Authorization": f"Bearer {tok_out}"},
    )
    assert res_ticket.status_code == 403


def test_single_use_ticket_generation_and_consumption(client: TestClient, chat_integration_setup):
    """
    Verifies the ticket creation endpoint /ws-ticket and single-use consumption.
    """
    setup = chat_integration_setup
    comm_a = setup["comm_a"]
    u1, auth1, tok1 = setup["member1"]

    # 1. Request ticket
    res = client.post(
        f"{NIVARAN_BASE}/committees/{comm_a.id}/ws-ticket",
        headers={"Authorization": f"Bearer {tok1}"},
    )
    assert res.status_code == 200
    ticket_data = res.json().get("data", res.json())
    ticket = ticket_data["ticket"]
    assert isinstance(ticket, str)
    assert len(ticket) >= 32

    # 2. Consume ticket via ConnectionManager
    consumed = committee_chat_manager.consume_chat_ticket(ticket, comm_a.id)
    assert consumed == (u1.id, auth1.id)

    # 3. Second consumption fails (single-use burned)
    consumed_second = committee_chat_manager.consume_chat_ticket(ticket, comm_a.id)
    assert consumed_second is None


def test_cursor_cross_committee_rejected_and_timestamp_collision(client: TestClient, db_session: Session, chat_integration_setup):
    """
    Verifies:
    1. Cursor message from another committee (or non-existent cursor) returns 404.
    2. Compound cursor (created_at, id) deterministically paginates even when messages share identical timestamps.
    """
    setup = chat_integration_setup
    comm_a = setup["comm_a"]
    comm_b = setup["comm_b"]
    _, auth1, tok1 = setup["member1"]
    _, _, tok_b = setup["outsider"]

    # Post message in Comm B
    res_b = client.post(
        f"{NIVARAN_BASE}/committees/{comm_b.id}/messages",
        json={"message_text": "Comm B message for cursor test"},
        headers={"Authorization": f"Bearer {tok_b}"},
    )
    msg_b_id = res_b.json().get("data")["id"]

    # Attempt to use Comm B's message id as cursor in Comm A -> 404
    res_invalid_cursor = client.get(
        f"{NIVARAN_BASE}/committees/{comm_a.id}/messages?before_id={msg_b_id}",
        headers={"Authorization": f"Bearer {tok1}"},
    )
    assert res_invalid_cursor.status_code == 404
    assert "not found in this committee" in res_invalid_cursor.json()["message"]

    # Nonexistent UUID -> 404
    res_nonexistent = client.get(
        f"{NIVARAN_BASE}/committees/{comm_a.id}/messages?before_id={uuid.uuid4()}",
        headers={"Authorization": f"Bearer {tok1}"},
    )
    assert res_nonexistent.status_code == 404

    # Timestamp collision test: Insert 3 messages with the EXACT same created_at timestamp
    now = datetime.now(timezone.utc)
    m1 = CommitteeMessage(
        id=uuid.uuid4(),
        committee_id=comm_a.id,
        sender_authority_id=auth1.id,
        message_text="Collision message 1",
        created_at=now,
    )
    m2 = CommitteeMessage(
        id=uuid.uuid4(),
        committee_id=comm_a.id,
        sender_authority_id=auth1.id,
        message_text="Collision message 2",
        created_at=now,
    )
    m3 = CommitteeMessage(
        id=uuid.uuid4(),
        committee_id=comm_a.id,
        sender_authority_id=auth1.id,
        message_text="Collision message 3",
        created_at=now,
    )
    db_session.add_all([m1, m2, m3])
    db_session.commit()

    # Query all messages: ordering by (created_at ASC, id ASC) is deterministic
    res_all = client.get(
        f"{NIVARAN_BASE}/committees/{comm_a.id}/messages?limit=10",
        headers={"Authorization": f"Bearer {tok1}"},
    )
    assert res_all.status_code == 200
    collision_msgs = [m for m in res_all.json()["data"] if "Collision message" in m["message_text"]]
    assert len(collision_msgs) == 3
    # IDs must be strictly sorted ascending
    assert [m["id"] for m in collision_msgs] == sorted([m["id"] for m in collision_msgs])

    # Cursor paginate using newest collision message as cursor
    newest_collision_id = collision_msgs[-1]["id"]
    res_page = client.get(
        f"{NIVARAN_BASE}/committees/{comm_a.id}/messages?limit=10&before_id={newest_collision_id}",
        headers={"Authorization": f"Bearer {tok1}"},
    )
    assert res_page.status_code == 200
    older_collision_msgs = [m for m in res_page.json()["data"] if "Collision message" in m["message_text"]]
    assert len(older_collision_msgs) == 2
    assert older_collision_msgs[0]["id"] == collision_msgs[0]["id"]
    assert older_collision_msgs[1]["id"] == collision_msgs[1]["id"]

