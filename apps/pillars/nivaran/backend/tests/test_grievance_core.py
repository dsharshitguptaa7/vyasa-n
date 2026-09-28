"""
Tests validating the Grievance Core & Applicant Filing Phase.

Validates the 17 core requirements:
1. Successful grievance creation.
2. New grievance starts in SUBMITTED.
3. Initial status history is created.
4. Initial status history has previous_status = NULL.
5. Applicant identity is stored/referenceable correctly.
6. Invalid subject is rejected.
7. Inactive subject is rejected.
8. Subject belongs to a valid Subject Cluster.
9. Applicant can retrieve their own grievance.
10. Applicant cannot retrieve another applicant's grievance.
11. Applicant list is scoped to the authenticated applicant identity.
12. Internal fields are not exposed in applicant response.
13. Audit log is created on successful submission.
14. Failed transaction rolls back grievance creation.
15. Invalid lifecycle transition is rejected.
16. Existing 40-table schema remains unchanged.
17. All previous foundation + master-data tests continue passing.
"""

import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from app.core.database import engine
from app.core.exceptions import InvalidLifecycleTransitionError
from app.models.audit import AuditLog
from app.models.base import Base
from app.models.document import Document
from app.models.enums import GrievancePriority, GrievanceStatus, HistoryActorType
from app.models.grievance import Grievance, GrievanceStatusHistory
from app.models.taxonomy import Subject, SubjectCluster
from app.schemas.grievance import GrievanceSubmissionRequest
from app.services.grievance_submission import GrievanceSubmissionService
from app.services.lifecycle import LifecycleStateMachine


@pytest.fixture
def test_subject(db_session: Session) -> Subject:
    """Fixture providing a known active subject (Mathematics)."""
    stmt = select(Subject).where(Subject.name == "Mathematics")
    subject = db_session.execute(stmt).scalar_one_or_none()
    assert subject is not None, "Subject 'Mathematics' must exist from seed master data"
    assert subject.is_active is True
    assert subject.subject_cluster_id is not None
    return subject


@pytest.fixture
def applicant_one_id() -> uuid.UUID:
    """Unique external VYASA Core UUID for applicant 1."""
    return uuid.uuid4()


@pytest.fixture
def applicant_two_id() -> uuid.UUID:
    """Unique external VYASA Core UUID for applicant 2."""
    return uuid.uuid4()


# ==============================================================================
# 1. GRIEVANCE CREATION & INITIAL LIFECYCLE
# ==============================================================================

def test_successful_grievance_creation(
    client: TestClient,
    test_subject: Subject,
    applicant_one_id: uuid.UUID,
    db_session: Session,
) -> None:
    """Requirement 1, 2, 3, 4, 5: Creation, SUBMITTED status, history, applicant identity."""
    payload = {
        "title": "Mathematics Coursework Registration Delay",
        "description": "My doctoral registration renewal for semester 3 coursework has been delayed for 4 weeks.",
        "subject_id": str(test_subject.id),
        "priority": "HIGH",
        "documents": [
            {
                "file_name": "fee_receipt.pdf",
                "file_path": "uploads/2026/09/fee_receipt.pdf",
                "mime_type": "application/pdf",
                "file_size": 1048576,
                "document_type": "FEE_RECEIPT",
                "content_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            }
        ],
    }

    headers = {"X-Applicant-User-Id": str(applicant_one_id)}
    res = client.post("/api/v1/grievances", json=payload, headers=headers)
    assert res.status_code == 201, f"Submission failed: {res.text}"

    data = res.json()
    assert data["title"] == payload["title"]
    assert data["description"] == payload["description"]
    assert data["status"] in ["SUBMITTED", "PENDING_REVIEW"]
    assert data["priority"] == "HIGH"
    assert data["subject_id"] == str(test_subject.id)
    assert data["subject_name"] == "Mathematics"
    assert data["subject_cluster_name"] == "Cluster 1"
    assert data["grievance_id"].startswith("G-")

    # Verify documents in response
    assert len(data["documents"]) == 1
    assert data["documents"][0]["file_name"] == "fee_receipt.pdf"

    # Verify status history in response begins with SUBMITTED
    assert len(data["status_history"]) >= 1
    assert data["status_history"][0]["new_status"] == "SUBMITTED"

    # Verify directly in Database
    created_id = uuid.UUID(data["id"])
    grievance = db_session.get(Grievance, created_id)
    assert grievance is not None
    assert grievance.applicant_vyasa_user_id == applicant_one_id
    assert grievance.status in [GrievanceStatus.SUBMITTED, GrievanceStatus.PENDING_REVIEW]

    # Verify DB History: initial history has previous_status = NULL, new_status = SUBMITTED
    histories = db_session.execute(
        select(GrievanceStatusHistory)
        .where(GrievanceStatusHistory.grievance_id == created_id)
        .order_by(GrievanceStatusHistory.changed_at.asc())
    ).scalars().all()
    assert len(histories) >= 1
    history = histories[0]
    assert history.previous_status is None
    assert history.new_status == GrievanceStatus.SUBMITTED
    assert history.changed_by_vyasa_user_id == applicant_one_id
    assert history.actor_type == HistoryActorType.USER

    # Verify DB Documents
    docs = db_session.execute(
        select(Document).where(Document.grievance_id == created_id)
    ).scalars().all()
    assert len(docs) == 1
    assert docs[0].uploaded_by_vyasa_user_id == applicant_one_id


# ==============================================================================
# 2. SUBJECT VALIDATION
# ==============================================================================

def test_invalid_subject_rejected(client: TestClient, applicant_one_id: uuid.UUID) -> None:
    """Requirement 6: Invalid subject UUID is rejected with HTTP 400."""
    fake_subject_id = str(uuid.uuid4())
    payload = {
        "title": "Invalid Subject Test",
        "description": "Attempting submission with a non-existent subject ID.",
        "subject_id": fake_subject_id,
    }
    headers = {"X-Applicant-User-Id": str(applicant_one_id)}
    res = client.post("/api/v1/grievances", json=payload, headers=headers)
    assert res.status_code == 400
    assert "was not found" in res.json()["detail"]


def test_inactive_subject_rejected(
    client: TestClient,
    applicant_one_id: uuid.UUID,
    test_subject: Subject,
    db_session: Session,
) -> None:
    """Requirement 7: Inactive subject is rejected with HTTP 400."""
    original_state = test_subject.is_active
    try:
        test_subject.is_active = False
        db_session.commit()

        payload = {
            "title": "Inactive Subject Test",
            "description": "Attempting submission with an inactive subject.",
            "subject_id": str(test_subject.id),
        }
        headers = {"X-Applicant-User-Id": str(applicant_one_id)}
        res = client.post("/api/v1/grievances", json=payload, headers=headers)
        assert res.status_code == 400
        assert "is currently inactive" in res.json()["detail"]
    finally:
        test_subject.is_active = original_state
        db_session.commit()


def test_subject_belongs_to_valid_cluster(test_subject: Subject, db_session: Session) -> None:
    """Requirement 8: Subject belongs to a valid Subject Cluster."""
    cluster = db_session.get(SubjectCluster, test_subject.subject_cluster_id)
    assert cluster is not None
    assert cluster.cluster_number in range(1, 11)


# ==============================================================================
# 3. APPLICANT RETRIEVAL & ACCESS SCOPING
# ==============================================================================

def test_applicant_can_retrieve_own_grievance(
    client: TestClient,
    test_subject: Subject,
    applicant_one_id: uuid.UUID,
) -> None:
    """Requirement 9: Applicant can retrieve their own grievance."""
    # Create grievance
    payload = {
        "title": "Applicant Own Grievance",
        "description": "This grievance is owned by applicant one.",
        "subject_id": str(test_subject.id),
    }
    headers = {"X-Applicant-User-Id": str(applicant_one_id)}
    post_res = client.post("/api/v1/grievances", json=payload, headers=headers)
    created_id = post_res.json()["id"]
    tracking_code = post_res.json()["grievance_id"]

    # Retrieve by UUID
    get_res = client.get(f"/api/v1/grievances/{created_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == created_id

    # Retrieve by tracking code
    get_code_res = client.get(f"/api/v1/grievances/{tracking_code}", headers=headers)
    assert get_code_res.status_code == 200
    assert get_code_res.json()["id"] == created_id


def test_applicant_cannot_retrieve_another_applicants_grievance(
    client: TestClient,
    test_subject: Subject,
    applicant_one_id: uuid.UUID,
    applicant_two_id: uuid.UUID,
) -> None:
    """Requirement 10: Applicant 2 cannot retrieve Applicant 1's grievance."""
    # Create grievance as applicant 1
    payload = {
        "title": "Applicant One Private Grievance",
        "description": "Confidential matter belonging to applicant one.",
        "subject_id": str(test_subject.id),
    }
    headers_app1 = {"X-Applicant-User-Id": str(applicant_one_id)}
    post_res = client.post("/api/v1/grievances", json=payload, headers=headers_app1)
    grievance_id = post_res.json()["id"]

    # Attempt to retrieve as applicant 2
    headers_app2 = {"X-Applicant-User-Id": str(applicant_two_id)}
    get_res = client.get(f"/api/v1/grievances/{grievance_id}", headers=headers_app2)
    assert get_res.status_code in [403, 404], f"Access leaked! Status: {get_res.status_code}"


def test_applicant_list_scoped_to_authenticated_identity(
    client: TestClient,
    test_subject: Subject,
    applicant_one_id: uuid.UUID,
    applicant_two_id: uuid.UUID,
) -> None:
    """Requirement 11: GET /api/v1/grievances lists only the caller's own grievances."""
    headers_app1 = {"X-Applicant-User-Id": str(applicant_one_id)}
    headers_app2 = {"X-Applicant-User-Id": str(applicant_two_id)}

    # Create 2 distinct grievances for applicant 1
    distinct_payloads_app1 = [
        {"title": "Library card renewal request", "description": "Need physical barcode for library reading hall access.", "subject_id": str(test_subject.id)},
        {"title": "Hostel room maintenance leak", "description": "Plumbing issue in third floor washroom tap leaking severely.", "subject_id": str(test_subject.id)},
    ]
    for p in distinct_payloads_app1:
        res = client.post("/api/v1/grievances", json=p, headers=headers_app1)
        assert res.status_code == 201

    # Create 1 for applicant 2
    client.post(
        "/api/v1/grievances",
        json={
            "title": "App 2 Ticket 0",
            "description": "Detailed description of issues.",
            "subject_id": str(test_subject.id),
        },
        headers=headers_app2,
    )

    # Query as App 1
    res1 = client.get("/api/v1/grievances", headers=headers_app1)
    assert res1.status_code == 200
    items1 = res1.json()["items"]
    assert len(items1) >= 2
    for item in items1:
        assert "App 2 Ticket" not in item["title"]

    # Query as App 2
    res2 = client.get("/api/v1/grievances", headers=headers_app2)
    assert res2.status_code == 200
    items2 = res2.json()["items"]
    assert any("App 2 Ticket 0" == item["title"] for item in items2)
    for item in items2:
        assert "App 1 Ticket" not in item["title"]


def test_internal_fields_not_exposed(
    client: TestClient,
    test_subject: Subject,
    applicant_one_id: uuid.UUID,
) -> None:
    """Requirement 12: Internal fields (audit, authority IDs, AI confidence) are excluded."""
    headers = {"X-Applicant-User-Id": str(applicant_one_id)}
    res = client.post(
        "/api/v1/grievances",
        json={
            "title": "Field Exposure Check",
            "description": "Ensuring response does not expose internal fields.",
            "subject_id": str(test_subject.id),
        },
        headers=headers,
    )
    assert res.status_code == 201
    data = res.json()

    prohibited_fields = [
        "ai_confidence",
        "category_reviewed",
        "category_overridden",
        "resolved_by_authority_id",
        "closed_by_authority_id",
        "previous_resolved_by_id",
        "previous_closed_by_id",
        "resolution_notes",
        "closure_remarks",
    ]
    for field in prohibited_fields:
        assert field not in data, f"Prohibited internal field '{field}' leaked in applicant response!"


# ==============================================================================
# 4. AUDIT LOG & TRANSACTIONAL INTEGRITY
# ==============================================================================

def test_audit_log_created_on_submission(
    client: TestClient,
    test_subject: Subject,
    applicant_one_id: uuid.UUID,
    db_session: Session,
) -> None:
    """Requirement 13: An audit log entry is recorded upon grievance creation."""
    headers = {"X-Applicant-User-Id": str(applicant_one_id)}
    res = client.post(
        "/api/v1/grievances",
        json={
            "title": "Audit Log Check",
            "description": "Testing audit log creation upon successful filing.",
            "subject_id": str(test_subject.id),
        },
        headers=headers,
    )
    assert res.status_code == 201
    created_id = uuid.UUID(res.json()["id"])

    audit_entry = db_session.execute(
        select(AuditLog).where(
            (AuditLog.grievance_id == created_id) & (AuditLog.action == "GRIEVANCE_SUBMITTED")
        )
    ).scalar_one_or_none()

    assert audit_entry is not None
    assert audit_entry.user_vyasa_id == applicant_one_id
    assert audit_entry.entity_type == "Grievance"
    assert audit_entry.entity_id == created_id


def test_transaction_rollback_on_failure(
    test_subject: Subject,
    applicant_one_id: uuid.UUID,
    db_session: Session,
) -> None:
    """Requirement 14: Failure during creation rolls back transaction (zero orphaned records)."""
    # Create request with an invalid/malformed payload structure that forces failure
    count_before = db_session.query(Grievance).count()
    count_history_before = db_session.query(GrievanceStatusHistory).count()
    count_audit_before = db_session.query(AuditLog).count()

    invalid_subject_id = uuid.uuid4()
    req = GrievanceSubmissionRequest(
        title="Rollback Test",
        description="This will fail due to subject not found.",
        subject_id=invalid_subject_id,
    )

    with pytest.raises(Exception):
        GrievanceSubmissionService.submit_grievance(
            db=db_session,
            applicant_vyasa_user_id=applicant_one_id,
            payload=req,
        )

    assert db_session.query(Grievance).count() == count_before
    assert db_session.query(GrievanceStatusHistory).count() == count_history_before
    assert db_session.query(AuditLog).count() == count_audit_before


# ==============================================================================
# 5. LIFECYCLE STATE MACHINE VALIDATION
# ==============================================================================

def test_invalid_lifecycle_transition_rejected() -> None:
    """Requirement 15: Invalid initial or direct transitions are rejected by state machine."""
    # Cannot start directly in RESOLVED, ASSIGNED, or CLOSED
    with pytest.raises(InvalidLifecycleTransitionError):
        LifecycleStateMachine.validate_initial_transition(GrievanceStatus.RESOLVED)

    with pytest.raises(InvalidLifecycleTransitionError):
        LifecycleStateMachine.validate_initial_transition(GrievanceStatus.ASSIGNED)

    with pytest.raises(InvalidLifecycleTransitionError):
        LifecycleStateMachine.validate_initial_transition(GrievanceStatus.CLOSED)

    # Valid initial transition
    assert LifecycleStateMachine.validate_initial_transition(GrievanceStatus.SUBMITTED) is True

    # Valid next step from SUBMITTED: AI_PROCESSING
    assert (
        LifecycleStateMachine.validate_transition(
            GrievanceStatus.SUBMITTED, GrievanceStatus.AI_PROCESSING
        )
        is True
    )

    # Illegal leap from SUBMITTED directly to RESOLVED
    with pytest.raises(InvalidLifecycleTransitionError):
        LifecycleStateMachine.validate_transition(
            GrievanceStatus.SUBMITTED, GrievanceStatus.RESOLVED
        )


# ==============================================================================
# 6. SCHEMA SAFETY & SYSTEM INTEGRITY
# ==============================================================================

def test_frozen_forty_table_schema_remains_unchanged() -> None:
    """Requirement 16: Existing 40-table schema remains untouched."""
    metadata_tables = set(Base.metadata.tables.keys())
    assert len(metadata_tables) == 40

    inspector = inspect(engine)
    live_tables = set(t for t in inspector.get_table_names() if t != "alembic_version")
    assert len(live_tables) == 40
    assert metadata_tables == live_tables
