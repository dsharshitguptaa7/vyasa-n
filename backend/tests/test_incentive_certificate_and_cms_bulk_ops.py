"""
Comprehensive Automated Test Suite for:
1. SAMIKSHA Research Incentive Certificate — Date of Issuance Vector PDF
2. CMS — Bulk Certificate Deletion & Archival
3. CMS — Bulk Certificate Verification (Text and CSV upload)

Validates all requirements:
- PDF Date of Issuance on INCENTIVE_AWARD certificates (issued, scheduled, fallback string).
- Soft deletion / archival preserving audit provenance and foreign keys.
- Bulk deletion with mandatory audit reason, partial failure reporting, and Super Admin RBAC.
- Single certificate deletion.
- Bulk verification with single batch query, duplicate detection, invalid format handling,
  scheduled certificate privacy shield, 250 batch limit enforcement, and CSV upload.
"""

import io
import uuid
import pytest
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import pypdf

from app.main import app
from app.models.base import Base
from app.models.user import User
from app.models.role import Role
from app.api.dependencies import get_db, get_current_user, get_optional_current_user
from app.modules.sama_veda.models.author import ResearchAuthor
from app.modules.sama_veda.models.bulletin import ResearchBulletin
from app.modules.sama_veda.models.certificate import (
    FelicitationCertificate,
    CertificateAuthor,
    CertificateVerificationEvent,
)
from app.modules.sama_veda.schemas.cms import (
    CertificateIssueRequest,
    CertificateAuthorCreate,
    BulkDeleteCertificatesRequest,
    SingleDeleteCertificateRequest,
    BulkVerifyCertificatesRequest,
)
from app.modules.sama_veda.services.cms_service import SamaCmsService
from app.modules.sama_veda.services.certificate_pdf_service import certificate_pdf_engine

IST = ZoneInfo("Asia/Kolkata")
TEST_DB_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    """Initializes in-memory database and mocks storage service."""
    Base.metadata.create_all(bind=test_engine)

    class MockStorageService:
        def save_file(self, content, filename, subfolder="", **kwargs):
            out_file = tmp_path / filename
            out_file.write_bytes(content)
            return f"mock_storage/{filename}"

        def get_file_path(self, storage_key):
            from pathlib import Path
            return Path(storage_key)

    from app.modules.sama_veda.services import cms_service
    monkeypatch.setattr(cms_service, "storage_service", MockStorageService())

    yield

    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def super_admin_user(db_session):
    role = db_session.execute(select(Role).where(Role.name == "super_admin")).scalar_one_or_none()
    if not role:
        role = Role(id=uuid.uuid4(), name="super_admin", description="Super Admin Role")
        db_session.add(role)
        db_session.flush()

    user = User(
        id=uuid.uuid4(),
        email="sadmin@csjmu.ac.in",
        first_name="Super",
        last_name="Admin",
        is_active=True,
        roles=[role],
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def normal_user(db_session):
    role = db_session.execute(select(Role).where(Role.name == "applicant")).scalar_one_or_none()
    if not role:
        role = Role(id=uuid.uuid4(), name="applicant", description="Applicant Role")
        db_session.add(role)
        db_session.flush()

    user = User(
        id=uuid.uuid4(),
        email="scholar@csjmu.ac.in",
        first_name="Scholar",
        last_name="One",
        is_active=True,
        roles=[role],
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


# ==============================================================================
# 1. RESEARCH INCENTIVE CERTIFICATE — RESTORED CITATION LAYOUT (NO ISSUANCE DATE)
# ==============================================================================

def test_incentive_certificate_pdf_renders_bulletin_citation_layout():
    """Verify that INCENTIVE_AWARD PDF renders 'RESEARCH BULLETIN CITATION' and excludes 'DATE OF ISSUANCE'."""
    pdf_bytes, sha256_hash = certificate_pdf_engine.render_certificate_pdf(
        certificate_number="CSJMU/RD/SAM/2026/INC-001",
        verification_token="token-inc-1",
        verification_url="https://vyasa.csjmu.ac.in/verify/token-inc-1",
        title="RESEARCH INCENTIVE CONFERMENT",
        certificate_type="INCENTIVE_AWARD",
        authors=[
            {
                "author_name_snapshot": "Dr. Rashmi Shukla",
                "academic_title_snapshot": "Dr.",
                "department_snapshot": "Department of Physics",
                "affiliation_snapshot": "CSJM University",
                "author_order": 1,
                "author_role": "Lead Researcher",
            }
        ],
        research_title="Quantum Photonics and Nanostructured Semiconductor Devices",
        bulletin_volume=4,
        bulletin_issue=2,
        issue_date=date(2026, 11, 20),
        incentive_details={
            "incentive_amount": 50000,
            "sanction_order_ref": "CSJMU/R&D/INC-2026/001",
        },
    )
    assert pdf_bytes is not None
    assert len(pdf_bytes) > 1000

    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    page_text = reader.pages[0].extract_text()

    assert "SANCTIONED INCENTIVE AWARD" in page_text
    assert "INR 50,000" in page_text
    assert "RESEARCH BULLETIN CITATION" in page_text
    assert "Volume 4, Issue 2" in page_text
    assert "DATE OF ISSUANCE" not in page_text
    assert "November 20, 2026" not in page_text


def test_scheduled_incentive_certificate_pdf_renders_citation_without_issuance_date():
    """Verify that a scheduled INCENTIVE_AWARD PDF renders bulletin citation without showing scheduled calendar date."""
    scheduled_d = date(2026, 12, 25)
    pdf_bytes, sha256_hash = certificate_pdf_engine.render_certificate_pdf(
        certificate_number="CSJMU/RD/SAM/2026/INC-SCHED",
        verification_token="token-inc-sched",
        verification_url="https://vyasa.csjmu.ac.in/verify/token-inc-sched",
        title="RESEARCH INCENTIVE CONFERMENT",
        certificate_type="INCENTIVE_AWARD",
        authors=[
            {
                "author_name_snapshot": "Prof. Amit Verma",
                "academic_title_snapshot": "Prof.",
                "author_order": 1,
                "author_role": "Principal Investigator",
            }
        ],
        research_title="Advanced Materials Synthesis",
        issue_date=scheduled_d,
        incentive_details={
            "incentive_amount": 100000,
            "sanction_order_ref": "CSJMU/R&D/INC-2026/SCHED",
            "volume": 2,
            "issue": 3,
            "period": "July - September 2026",
        },
    )

    pdf_bytes = bytes(pdf_bytes)
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    page_text = reader.pages[0].extract_text()

    assert "SANCTIONED INCENTIVE AWARD" in page_text
    assert "INR 100,000" in page_text
    assert "RESEARCH BULLETIN CITATION" in page_text
    assert "Volume 2, Issue 3 (July - September 2026)" in page_text
    assert "DATE OF ISSUANCE" not in page_text
    assert "December 25, 2026" not in page_text


def test_incentive_certificate_pdf_handles_legacy_iso_string_date():
    """Verify safe handling of issue_date while strictly excluding visible date from incentive award layout."""
    pdf_bytes, sha256_hash = certificate_pdf_engine.render_certificate_pdf(
        certificate_number="CSJMU/RD/SAM/2026/INC-STR",
        verification_token="token-str",
        verification_url="https://vyasa.csjmu.ac.in/verify/token-str",
        title="RESEARCH INCENTIVE CONFERMENT",
        certificate_type="INCENTIVE_AWARD",
        authors=[{"author_name_snapshot": "Scholar One", "author_order": 1, "author_role": "Author"}],
        research_title="String Date Compatibility",
        issue_date="2026-08-15T10:30:00Z",
        incentive_details={
            "incentive_amount": 25000,
            "sanction_order_ref": "CSJMU/R&D/INC-2026/STR",
        },
    )

    pdf_bytes = bytes(pdf_bytes)
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    page_text = reader.pages[0].extract_text()

    assert "SANCTIONED INCENTIVE AWARD" in page_text
    assert "INR 25,000" in page_text
    assert "RESEARCH BULLETIN CITATION" in page_text
    assert "Official CSJMU Research Bulletin" in page_text
    assert "DATE OF ISSUANCE" not in page_text
    assert "August 15, 2026" not in page_text


# ==============================================================================
# 2. CMS — BULK & SINGLE CERTIFICATE DELETION TESTS
# ==============================================================================

def test_bulk_delete_certificates_service_and_rbac(db_session, super_admin_user, normal_user, test_client):
    """Verify bulk certificate soft deletion with audit notes and Super Admin authorization."""
    # Seed 3 certificates
    certs = []
    now_dt = datetime.now(timezone.utc)
    for i in range(1, 4):
        c = FelicitationCertificate(
            id=uuid.uuid4(),
            certificate_number=f"VYASA/SAM/TEST-DEL-{i}",
            verification_token=f"token-del-{i}",
            status="REVOKED",
            is_revoked=True,
            title=f"Test Certificate {i}",
            issued_at=now_dt,
        )
        db_session.add(c)
        certs.append(c)
    db_session.commit()

    cert_ids = [str(c.id) for c in certs[:2]]

    # 1. Service Layer soft delete
    op_id, deleted_ids, failed = SamaCmsService.bulk_delete_certificates(
        db_session,
        certificate_ids=[uuid.UUID(cid) for cid in cert_ids],
        reason="Administrative correction: duplicate batch",
        actor_user_id=super_admin_user.id,
    )
    assert len(deleted_ids) == 2
    assert len(failed) == 0
    assert op_id is not None and len(op_id) > 10

    # Verify status in database
    for cid in cert_ids:
        c_db = db_session.get(FelicitationCertificate, uuid.UUID(cid))
        assert c_db.status == "ARCHIVED"
        assert "Administrative correction: duplicate batch" in c_db.rejection_reason

    # Verify cert 3 remains active
    c3_db = db_session.get(FelicitationCertificate, certs[2].id)
    assert c3_db.status == "REVOKED"

    # 2. API RBAC: Non-admin rejected
    app.dependency_overrides[get_current_user] = lambda: normal_user
    resp = test_client.post(
        "/api/admin/sama/certificates/bulk-delete",
        json={"certificate_ids": [str(certs[2].id)], "reason": "Unauthorized attempt"},
    )
    assert resp.status_code == 403

    # 3. API RBAC: Super Admin succeeds
    app.dependency_overrides[get_current_user] = lambda: super_admin_user
    resp = test_client.post(
        "/api/admin/sama/certificates/bulk-delete",
        json={"certificate_ids": [str(certs[2].id)], "reason": "Authorized removal by Super Admin"},
    )
    assert resp.status_code == 200
    res_body = resp.json()
    data = res_body.get("data", res_body)
    assert data["deleted_count"] == 1
    assert str(certs[2].id) in data["deleted_ids"]


def test_bulk_delete_partial_failure_handling(db_session, super_admin_user, test_client):
    """Verify that non-existent or already archived IDs report as failed items without crashing."""
    c = FelicitationCertificate(
        id=uuid.uuid4(),
        certificate_number="VYASA/SAM/TEST-FAIL-1",
        verification_token="token-fail-1",
        status="ARCHIVED",
        rejection_reason="Already archived",
    )
    db_session.add(c)
    db_session.commit()

    non_existent_id = str(uuid.uuid4())

    op_id, deleted, failed = SamaCmsService.bulk_delete_certificates(
        db_session,
        certificate_ids=[c.id, uuid.UUID(non_existent_id)],
        reason="Test cleanup",
        actor_user_id=super_admin_user.id,
    )
    assert len(deleted) == 0
    assert len(failed) == 2
    reasons = [f["reason"] for f in failed]
    assert any("already archived" in r.lower() for r in reasons)
    assert any("not found" in r.lower() for r in reasons)


def test_single_delete_certificate_api(db_session, super_admin_user, test_client):
    """Verify single certificate deletion endpoint DELETE /certificates/{id}."""
    c = FelicitationCertificate(
        id=uuid.uuid4(),
        certificate_number="VYASA/SAM/TEST-SINGLE-1",
        verification_token="token-single-1",
        status="REVOKED",
        is_revoked=True,
        title="Single Delete Test",
    )
    db_session.add(c)
    db_session.commit()

    app.dependency_overrides[get_current_user] = lambda: super_admin_user
    resp = test_client.request(
        "DELETE",
        f"/api/admin/sama/certificates/{c.id}",
        json={"reason": "Single archival confirmation"},
    )
    assert resp.status_code == 200
    res_body = resp.json()
    res_data = res_body.get("data", res_body)
    assert res_data["status"] == "ARCHIVED"
    assert res_data["id"] == str(c.id)

    db_session.refresh(c)
    assert c.status == "ARCHIVED"
    assert "Single archival confirmation" in c.rejection_reason


# ==============================================================================
# 3. CMS — BULK CERTIFICATE VERIFICATION TESTS
# ==============================================================================

def test_bulk_verify_certificates_lifecycle_and_duplicates(db_session, super_admin_user, test_client):
    """Verify bulk verification maps statuses, flags duplicates and invalid tokens."""
    # Seed certificates with various lifecycle states
    now_ist = datetime.now(IST)
    tomorrow = (now_ist + timedelta(days=2)).date()

    c_valid = FelicitationCertificate(
        id=uuid.uuid4(),
        certificate_number="VYASA/SAM/VERIFY/VALID",
        verification_token="tok-v",
        status="ISSUED",
        research_title="Quantum Computing Research",
        authors=[
            CertificateAuthor(
                id=uuid.uuid4(),
                author_name_snapshot="Dr. Valid Author",
                author_order=1,
                author_role="Lead Author",
            )
        ],
    )
    c_sched = FelicitationCertificate(
        id=uuid.uuid4(),
        certificate_number="VYASA/SAM/VERIFY/SCHED",
        verification_token="tok-s",
        status="SCHEDULED",
        scheduled_issue_date=tomorrow,
        research_title="Future Nanotechnology",
        authors=[
            CertificateAuthor(
                id=uuid.uuid4(),
                author_name_snapshot="Dr. Scheduled Author",
                author_order=1,
                author_role="Principal Author",
            )
        ],
    )
    c_rev = FelicitationCertificate(
        id=uuid.uuid4(),
        certificate_number="VYASA/SAM/VERIFY/REV",
        verification_token="tok-r",
        status="REVOKED",
        is_revoked=True,
        revocation_reason="Plagiarism confirmed by academic ethics board",
    )
    c_sup = FelicitationCertificate(
        id=uuid.uuid4(),
        certificate_number="VYASA/SAM/VERIFY/SUP",
        verification_token="tok-sup",
        status="SUPERSEDED",
        reissued_reason="Reissued with updated scholar title",
    )

    db_session.add_all([c_valid, c_sched, c_rev, c_sup])
    db_session.commit()

    app.dependency_overrides[get_current_user] = lambda: super_admin_user

    # Request with valid, scheduled, revoked, superseded, not found, invalid, and a duplicate
    input_numbers = [
        "VYASA/SAM/VERIFY/VALID",
        "VYASA/SAM/VERIFY/VALID",  # Duplicate
        "VYASA/SAM/VERIFY/SCHED",
        "VYASA/SAM/VERIFY/REV",
        "VYASA/SAM/VERIFY/SUP",
        "VYASA/SAM/NONEXISTENT/001",
        "INV<MALFORMED>",  # Invalid format
    ]

    resp = test_client.post(
        "/api/admin/sama/certificates/bulk-verify",
        json={"certificate_numbers": input_numbers},
    )
    assert resp.status_code == 200
    res_body = resp.json()
    data = res_body.get("data", res_body)

    assert data["total_submitted"] == 7
    assert data["valid_count"] == 2  # Both original and duplicate counted
    assert data["scheduled_count"] == 1
    assert data["revoked_count"] == 1
    assert data["superseded_count"] == 1
    assert data["not_found_count"] == 1
    assert data["invalid_count"] == 1
    assert data["duplicate_count"] == 1

    # Check duplicate badge
    results = data["results"]
    assert results[0]["is_duplicate"] is False
    assert results[1]["is_duplicate"] is True

    # Check revoked details
    rev_item = next(it for it in results if it["certificate_number"] == "VYASA/SAM/VERIFY/REV")
    assert rev_item["status"] == "REVOKED"
    assert "Plagiarism confirmed" in rev_item["revocation_reason"]

    # Check scheduled details
    sched_item = next(it for it in results if it["certificate_number"] == "VYASA/SAM/VERIFY/SCHED")
    assert sched_item["status"] == "SCHEDULED"
    assert str(tomorrow) in sched_item["scheduled_issue_date"]


def test_bulk_verify_batch_limit_exceeded(super_admin_user, test_client):
    """Verify that batches > 250 items are rejected with HTTP 400 or 422."""
    app.dependency_overrides[get_current_user] = lambda: super_admin_user
    oversized_list = [f"VYASA/CERT/{i}" for i in range(251)]

    resp = test_client.post(
        "/api/admin/sama/certificates/bulk-verify",
        json={"certificate_numbers": oversized_list},
    )
    assert resp.status_code in (400, 422)


def test_bulk_verify_csv_upload_endpoint(db_session, super_admin_user, test_client):
    """Verify POST /certificates/bulk-verify/csv with multipart file upload."""
    c = FelicitationCertificate(
        id=uuid.uuid4(),
        certificate_number="CSJMU/CSV/TEST-1",
        verification_token="tok-csv-1",
        status="ISSUED",
        authors=[
            CertificateAuthor(
                id=uuid.uuid4(),
                author_name_snapshot="CSV Scholar",
                author_order=1,
                author_role="Author",
            )
        ],
    )
    db_session.add(c)
    db_session.commit()

    csv_content = b"certificate_number\nCSJMU/CSV/TEST-1\nCSJMU/CSV/TEST-MISSING\n"
    app.dependency_overrides[get_current_user] = lambda: super_admin_user

    resp = test_client.post(
        "/api/admin/sama/certificates/bulk-verify/csv",
        files={"file": ("verify_batch.csv", csv_content, "text/csv")},
    )
    assert resp.status_code == 200
    res_body = resp.json()
    data = res_body.get("data", res_body)
    assert data["total_submitted"] == 2
    assert data["valid_count"] == 1
    assert data["not_found_count"] == 1
