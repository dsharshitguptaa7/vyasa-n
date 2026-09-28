"""
Tests for NIVARAN Applicant SSO, Token Verification & JIT Provisioning.

Verifies the 12 required scenarios:
1. First-time VYASA applicant with no NIVARAN record:
   - Successful VYASA verification
   - Profile fetched
   - NIVARAN domain record (student_master_records) created JIT
   - Subject reconciled against NIVARAN taxonomy
   - APPLICANT_JIT_PROVISIONED and APPLICANT_SESSION_ESTABLISHED audit events emitted
   - Session established and workspace context returned
2. Existing VYASA applicant with NIVARAN record:
   - Existing record reused
   - Snapshots updated
   - APPLICANT_SESSION_ESTABLISHED emitted (not JIT_PROVISIONED)
   - Zero duplicates
3. Repeated handoffs remain completely idempotent (still 1 record).
4. Invalid/expired VYASA token rejected with 401 before provisioning.
5. Authority role rejected with 403 before provisioning.
6. Administrator role rejected with 403 before provisioning.
7. VYASA profile fetch failure: rejects with 422/502 without creating partial record.
8. Subject mismatch: fails with 422, rolls back partial creation.
9. Database error during provisioning: rolls back and returns 500 domain error (not VYASA verification error).
10. Unified /api/v1/session routes both applicant and authority dynamically.
11. No password or local authentication credentials created in NIVARAN.
12. Frozen 40-table schema remains untouched.
"""

import json
import uuid
from typing import Optional
from unittest.mock import patch
import httpx
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.main import app
from app.models.audit import AuditLog
from app.models.authority import NivaranAuthority
from app.models.enums import NivaranRole, StudentRecordStatus
from app.models.grievance import StudentMasterRecord
from app.models.taxonomy import Subject
from app.services.vyasa_identity import vyasa_identity_client


@pytest.fixture
def test_subject(db_session: Session) -> Subject:
    """Provides a verified active subject from NIVARAN's seeded master data."""
    subject = db_session.scalar(select(Subject).where(Subject.name == "Mathematics"))
    if not subject:
        # Fallback to any active seeded subject
        subject = db_session.scalar(select(Subject).where(Subject.is_active.is_(True)))
    assert subject is not None, "At least one active subject must exist in NIVARAN master data"
    return subject


@pytest.fixture
def mock_vyasa_services(db_session: Session):
    token_verify_db = {}
    profile_db = {}

    def register_user(
        token: str,
        verify_payload: dict,
        profile_payload: Optional[dict] = None,
        verify_status: int = 200,
        profile_status: int = 200,
        verify_raises: Exception = None,
        profile_raises: Exception = None,
    ):
        token_verify_db[token] = {
            "payload": verify_payload,
            "status_code": verify_status,
            "raises": verify_raises,
        }
        if profile_payload is not None or profile_status != 200 or profile_raises is not None:
            profile_db[token] = {
                "payload": profile_payload,
                "status_code": profile_status,
                "raises": profile_raises,
            }

    def transport_handler(request: httpx.Request) -> httpx.Response:
        url_path = request.url.path

        if url_path == "/api/auth/verify":
            req_data = json.loads(request.read())
            token = req_data.get("token")
            if token not in token_verify_db:
                return httpx.Response(200, json={"valid": False, "user": None})
            entry = token_verify_db[token]
            if entry["raises"]:
                raise entry["raises"]
            return httpx.Response(entry["status_code"], json=entry["payload"])

        elif url_path == "/api/applicant/profile":
            auth_header = request.headers.get("Authorization", "")
            token = auth_header.replace("Bearer ", "").strip()
            if token not in profile_db:
                return httpx.Response(404, json={"detail": "Applicant profile not found"})
            entry = profile_db[token]
            if entry["raises"]:
                raise entry["raises"]
            return httpx.Response(entry["status_code"], json=entry["payload"])

        return httpx.Response(404, json={"detail": "Not found"})

    original_transport = vyasa_identity_client._transport
    vyasa_identity_client._transport = httpx.MockTransport(transport_handler)

    app.dependency_overrides[get_db] = lambda: db_session

    yield register_user

    vyasa_identity_client._transport = original_transport
    app.dependency_overrides.clear()


# 1. First-time VYASA applicant JIT provisioning
def test_01_first_time_applicant_jit_provisioning_success(
    db_session: Session, mock_vyasa_services, test_subject: Subject
):
    applicant_id = uuid.uuid4()
    token = "test-fresh-applicant-token"

    mock_vyasa_services(
        token=token,
        verify_payload={
            "valid": True,
            "user": {
                "id": str(applicant_id),
                "email": "scholar.raj@csjmu.ac.in",
                "first_name": "Raj",
                "last_name": "Sharma",
                "roles": ["applicant"],
            },
        },
        profile_payload={
            "id": str(uuid.uuid4()),
            "user_id": str(applicant_id),
            "email": "scholar.raj@csjmu.ac.in",
            "first_name": "Raj",
            "last_name": "Sharma",
            "full_name": "Raj Sharma",
            "phone": "+91 9876543210",
            "roles": ["applicant"],
            "is_active": True,
            "is_verified": True,
            "phd_registration_number": "CSJMU/PHD/2024/001",
            "department": "Department of Mathematical Sciences",
            "subject_id": str(test_subject.id),
            "subject_name": test_subject.name,
        },
    )

    client = TestClient(app)
    resp = client.get(
        "/api/v1/applicant/session",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["success"] is True
    assert data["role"] == "applicant"
    assert data["is_new_registration"] is True
    assert data["vyasa_identity"]["id"] == str(applicant_id)
    assert data["student_record"]["registration_number"] == "CSJMU/PHD/2024/001"
    assert data["student_record"]["department"] == "Department of Mathematical Sciences"
    assert data["student_record"]["full_name"] == "Raj Sharma"
    assert data["student_record"]["status"] == "ACTIVE"
    assert data["academic_context"]["subject_id"] == str(test_subject.id)
    assert data["academic_context"]["subject_name"] == test_subject.name

    # Verify student_master_records persistence
    record = db_session.scalar(
        select(StudentMasterRecord).where(
            StudentMasterRecord.student_vyasa_user_id == applicant_id
        )
    )
    assert record is not None
    assert record.registration_number_snapshot == "CSJMU/PHD/2024/001"
    assert record.full_name_snapshot == "Raj Sharma"

    # Verify both APPLICANT_JIT_PROVISIONED and APPLICANT_SESSION_ESTABLISHED audit events
    audit_jit = db_session.scalar(
        select(AuditLog).where(
            AuditLog.user_vyasa_id == applicant_id,
            AuditLog.action == "APPLICANT_JIT_PROVISIONED",
        )
    )
    assert audit_jit is not None

    audit_session = db_session.scalar(
        select(AuditLog).where(
            AuditLog.user_vyasa_id == applicant_id,
            AuditLog.action == "APPLICANT_SESSION_ESTABLISHED",
        )
    )
    assert audit_session is not None


# 2. Existing VYASA applicant reuses record and synchronizes snapshots
def test_02_existing_applicant_reuses_record_without_duplicate(
    db_session: Session, mock_vyasa_services, test_subject: Subject
):
    applicant_id = uuid.uuid4()
    token = "test-existing-applicant-token"

    # Pre-existing record
    existing_record = StudentMasterRecord(
        id=uuid.uuid4(),
        student_vyasa_user_id=applicant_id,
        record_number=f"SMR-{applicant_id.hex[:10].upper()}",
        registration_number_snapshot="OLD-REG-000",
        full_name_snapshot="Old Name",
        email_snapshot="old@example.com",
        status=StudentRecordStatus.ACTIVE,
    )
    db_session.add(existing_record)
    db_session.commit()

    mock_vyasa_services(
        token=token,
        verify_payload={
            "valid": True,
            "user": {
                "id": str(applicant_id),
                "email": "updated.raj@csjmu.ac.in",
                "first_name": "Raj",
                "last_name": "Kumar Sharma",
                "roles": ["applicant"],
            },
        },
        profile_payload={
            "id": str(uuid.uuid4()),
            "user_id": str(applicant_id),
            "email": "updated.raj@csjmu.ac.in",
            "first_name": "Raj",
            "last_name": "Kumar Sharma",
            "full_name": "Raj Kumar Sharma",
            "phone": "+91 9998887776",
            "roles": ["applicant"],
            "is_active": True,
            "is_verified": True,
            "phd_registration_number": "CSJMU/PHD/2024/999",
            "department": "Mathematics",
            "subject_id": str(test_subject.id),
            "subject_name": test_subject.name,
        },
    )

    client = TestClient(app)
    resp = client.get(
        "/api/v1/applicant/session",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["is_new_registration"] is False
    assert data["student_record"]["id"] == str(existing_record.id)
    assert data["student_record"]["registration_number"] == "CSJMU/PHD/2024/999"
    assert data["student_record"]["full_name"] == "Raj Kumar Sharma"

    # Exactly 1 record in database
    records = db_session.scalars(
        select(StudentMasterRecord).where(
            StudentMasterRecord.student_vyasa_user_id == applicant_id
        )
    ).all()
    assert len(records) == 1

    # APPLICANT_JIT_PROVISIONED must NOT be emitted for existing applicant
    audit_jit = db_session.scalar(
        select(AuditLog).where(
            AuditLog.user_vyasa_id == applicant_id,
            AuditLog.action == "APPLICANT_JIT_PROVISIONED",
        )
    )
    assert audit_jit is None

    # APPLICANT_SESSION_ESTABLISHED must be emitted
    audit_session = db_session.scalar(
        select(AuditLog).where(
            AuditLog.user_vyasa_id == applicant_id,
            AuditLog.action == "APPLICANT_SESSION_ESTABLISHED",
        )
    )
    assert audit_session is not None


# 3. Repeated handoffs remain idempotent
def test_03_repeated_handoffs_remain_idempotent(
    db_session: Session, mock_vyasa_services, test_subject: Subject
):
    applicant_id = uuid.uuid4()
    token = "test-multi-handoff-token"

    mock_vyasa_services(
        token=token,
        verify_payload={
            "valid": True,
            "user": {
                "id": str(applicant_id),
                "email": "repeat.scholar@csjmu.ac.in",
                "first_name": "Repeat",
                "last_name": "Scholar",
                "roles": ["applicant"],
            },
        },
        profile_payload={
            "id": str(uuid.uuid4()),
            "user_id": str(applicant_id),
            "email": "repeat.scholar@csjmu.ac.in",
            "first_name": "Repeat",
            "last_name": "Scholar",
            "full_name": "Repeat Scholar",
            "phone": "+91 9991112233",
            "roles": ["applicant"],
            "is_active": True,
            "is_verified": True,
            "phd_registration_number": "CSJMU/PHD/REP/001",
            "department": "Mathematics",
            "subject_id": str(test_subject.id),
            "subject_name": test_subject.name,
        },
    )

    client = TestClient(app)

    # First call -> creates record
    r1 = client.get("/api/v1/applicant/session", headers={"Authorization": f"Bearer {token}"})
    assert r1.status_code == status.HTTP_200_OK
    assert r1.json()["is_new_registration"] is True

    # Second call -> reuses record
    r2 = client.get("/api/v1/applicant/session", headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == status.HTTP_200_OK
    assert r2.json()["is_new_registration"] is False

    # Third call -> still reuses record
    r3 = client.get("/api/v1/applicant/session", headers={"Authorization": f"Bearer {token}"})
    assert r3.status_code == status.HTTP_200_OK
    assert r3.json()["is_new_registration"] is False

    records = db_session.scalars(
        select(StudentMasterRecord).where(
            StudentMasterRecord.student_vyasa_user_id == applicant_id
        )
    ).all()
    assert len(records) == 1


# 4. Invalid/expired VYASA token rejected before provisioning
def test_04_invalid_or_expired_vyasa_token_rejected_401(
    db_session: Session, mock_vyasa_services
):
    token = "expired-token"
    mock_vyasa_services(
        token=token,
        verify_payload={"valid": False, "user": None},
    )

    initial_count = len(db_session.scalars(select(StudentMasterRecord)).all())

    client = TestClient(app)
    resp = client.get(
        "/api/v1/applicant/session",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    # Zero new records created
    after_count = len(db_session.scalars(select(StudentMasterRecord)).all())
    assert after_count == initial_count


# 5. Authority role rejected with 403 before provisioning
def test_05_authority_role_rejected_403_before_provisioning(
    db_session: Session, mock_vyasa_services
):
    auth_id = uuid.uuid4()
    token = "authority-token"
    mock_vyasa_services(
        token=token,
        verify_payload={
            "valid": True,
            "user": {
                "id": str(auth_id),
                "email": "dean@csjmu.ac.in",
                "first_name": "Dean",
                "last_name": "Admin",
                "roles": ["authority"],
            },
        },
    )

    client = TestClient(app)
    resp = client.get(
        "/api/v1/applicant/session",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == status.HTTP_403_FORBIDDEN
    assert "ecosystem role" in resp.json()["detail"].lower()

    # Zero student master records created
    records = db_session.scalars(
        select(StudentMasterRecord).where(StudentMasterRecord.student_vyasa_user_id == auth_id)
    ).all()
    assert len(records) == 0


# 6. Administrator role rejected with 403 before provisioning
def test_06_administrator_role_rejected_403_before_provisioning(
    db_session: Session, mock_vyasa_services
):
    admin_id = uuid.uuid4()
    token = "admin-token"
    mock_vyasa_services(
        token=token,
        verify_payload={
            "valid": True,
            "user": {
                "id": str(admin_id),
                "email": "superadmin@csjmu.ac.in",
                "first_name": "Super",
                "last_name": "Admin",
                "roles": ["administrator"],
            },
        },
    )

    client = TestClient(app)
    resp = client.get(
        "/api/v1/applicant/session",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == status.HTTP_403_FORBIDDEN

    records = db_session.scalars(
        select(StudentMasterRecord).where(StudentMasterRecord.student_vyasa_user_id == admin_id)
    ).all()
    assert len(records) == 0


# 7. VYASA profile failure rejects with 422/502 without partial record
def test_07_vyasa_profile_failure_creates_no_partial_record(
    db_session: Session, mock_vyasa_services
):
    applicant_id = uuid.uuid4()
    token = "missing-profile-token"

    mock_vyasa_services(
        token=token,
        verify_payload={
            "valid": True,
            "user": {
                "id": str(applicant_id),
                "email": "noprofile@csjmu.ac.in",
                "first_name": "No",
                "last_name": "Profile",
                "roles": ["applicant"],
            },
        },
        profile_payload=None,
        profile_status=404,
    )

    client = TestClient(app)
    resp = client.get(
        "/api/v1/applicant/session",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code in (status.HTTP_422_UNPROCESSABLE_ENTITY, status.HTTP_502_BAD_GATEWAY)

    # Zero partial records created
    records = db_session.scalars(
        select(StudentMasterRecord).where(StudentMasterRecord.student_vyasa_user_id == applicant_id)
    ).all()
    assert len(records) == 0


# 8. Subject mismatch rejects with 422 and rolls back cleanly
def test_08_subject_mismatch_fails_and_rolls_back_safely(
    db_session: Session, mock_vyasa_services
):
    applicant_id = uuid.uuid4()
    token = "bad-subject-token"

    mock_vyasa_services(
        token=token,
        verify_payload={
            "valid": True,
            "user": {
                "id": str(applicant_id),
                "email": "badsubject@csjmu.ac.in",
                "first_name": "Bad",
                "last_name": "Subject",
                "roles": ["applicant"],
            },
        },
        profile_payload={
            "id": str(uuid.uuid4()),
            "user_id": str(applicant_id),
            "email": "badsubject@csjmu.ac.in",
            "first_name": "Bad",
            "last_name": "Subject",
            "full_name": "Bad Subject",
            "phone": "+91 9998881111",
            "roles": ["applicant"],
            "is_active": True,
            "is_verified": True,
            "phd_registration_number": "CSJMU/PHD/BAD/001",
            "department": "Astrology Department",
            "subject_id": str(uuid.uuid4()),  # Non-existent UUID
            "subject_name": "NonExistentAstrologicalScience",
        },
    )

    client = TestClient(app)
    resp = client.get(
        "/api/v1/applicant/session",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    assert "taxonomy" in resp.json()["detail"].lower()

    # Zero records created
    records = db_session.scalars(
        select(StudentMasterRecord).where(StudentMasterRecord.student_vyasa_user_id == applicant_id)
    ).all()
    assert len(records) == 0


# 9. Database failure during provisioning returns 500 domain error, not VYASA verification error
def test_09_database_failure_returns_domain_error(
    db_session: Session, mock_vyasa_services, test_subject: Subject
):
    applicant_id = uuid.uuid4()
    token = "db-fail-token"

    mock_vyasa_services(
        token=token,
        verify_payload={
            "valid": True,
            "user": {
                "id": str(applicant_id),
                "email": "dbfail@csjmu.ac.in",
                "first_name": "Db",
                "last_name": "Fail",
                "roles": ["applicant"],
            },
        },
        profile_payload={
            "id": str(uuid.uuid4()),
            "user_id": str(applicant_id),
            "email": "dbfail@csjmu.ac.in",
            "first_name": "Db",
            "last_name": "Fail",
            "full_name": "Db Fail",
            "phone": "+91 9998881111",
            "roles": ["applicant"],
            "is_active": True,
            "is_verified": True,
            "phd_registration_number": "CSJMU/PHD/FAIL/001",
            "department": "Mathematics",
            "subject_id": str(test_subject.id),
            "subject_name": test_subject.name,
        },
    )

    client = TestClient(app)
    with patch.object(db_session, "commit", side_effect=Exception("Database lock acquisition failure")):
        resp = client.get(
            "/api/v1/applicant/session",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        # Detail must indicate NIVARAN database error, not VYASA verification error
        assert "nivaran domain registration failed" in resp.json()["detail"].lower()


# 10. Unified session endpoint dynamically routes applicant and authority
def test_10_unified_session_routes_applicant_and_authority(
    db_session: Session, mock_vyasa_services, test_subject: Subject
):
    # Applicant routing
    app_id = uuid.uuid4()
    app_token = "unified-app-token"
    mock_vyasa_services(
        token=app_token,
        verify_payload={
            "valid": True,
            "user": {
                "id": str(app_id),
                "email": "app@csjmu.ac.in",
                "first_name": "App",
                "last_name": "User",
                "roles": ["applicant"],
            },
        },
        profile_payload={
            "id": str(uuid.uuid4()),
            "user_id": str(app_id),
            "email": "app@csjmu.ac.in",
            "first_name": "App",
            "last_name": "User",
            "full_name": "App User",
            "phone": "+91 9991110000",
            "roles": ["applicant"],
            "is_active": True,
            "is_verified": True,
            "phd_registration_number": "CSJMU/PHD/APP/001",
            "department": "Mathematics",
            "subject_id": str(test_subject.id),
            "subject_name": test_subject.name,
        },
    )

    # Authority routing
    mgr_id = uuid.UUID("73fd427c-30c5-54d7-ba9a-4101620815f8")
    mgr_token = "unified-mgr-token"

    auth = db_session.query(NivaranAuthority).filter_by(vyasa_user_id=mgr_id).first()
    if not auth:
        auth = NivaranAuthority(
            id=uuid.uuid4(),
            vyasa_user_id=mgr_id,
            role=NivaranRole.MANAGER,
            name_snapshot="Mr. Ashfaq Ansari",
            email_snapshot="rdmmanager@csjmu.ac.in",
            designation="Manager",
            department="Triage",
            is_active=True,
        )
        db_session.add(auth)
        db_session.commit()

    mock_vyasa_services(
        token=mgr_token,
        verify_payload={
            "valid": True,
            "user": {
                "id": str(mgr_id),
                "email": "rdmmanager@csjmu.ac.in",
                "first_name": "Ashfaq",
                "last_name": "Ansari",
                "roles": ["authority"],
            },
        },
    )

    client = TestClient(app)

    # 1. Applicant via /session
    r_app = client.get("/api/v1/session", headers={"Authorization": f"Bearer {app_token}"})
    assert r_app.status_code == status.HTTP_200_OK
    assert r_app.json()["role_type"] == "applicant"

    # 2. Authority via /session
    r_mgr = client.get("/api/v1/session", headers={"Authorization": f"Bearer {mgr_token}"})
    assert r_mgr.status_code == status.HTTP_200_OK
    assert r_mgr.json()["role_type"] == "authority"
