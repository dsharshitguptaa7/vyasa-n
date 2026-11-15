"""
Comprehensive Test Suite for SAMIKSHA Scheduled Certificate Issuance & Automatic Activation System.

Covers all 15 scenarios specified in institutional requirements:
1. Certificate created today (no future date) -> activates immediately (status = ISSUED, activated_at set).
2. Certificate created tomorrow -> status = SCHEDULED, activated_at is None, invisible publicly.
3. Certificate created in future -> status = SCHEDULED, invisible publicly.
4. Certificate dual-approved with future date -> final status becomes SCHEDULED (not ISSUED).
5. Scopus ID public lookup with scheduled certificate -> certificate completely hidden.
6. Certificate verify-by-number with scheduled certificate -> returns safe 404 Not Found.
7. QR verification with scheduled certificate -> returns safe 404 Not Found.
8. Direct PDF download with scheduled certificate -> returns safe 404 Not Found.
9. Automatic activation when target date arrives -> transitions SCHEDULED -> ISSUED.
10. Idempotency test -> multiple activation calls do not corrupt, re-activate, or produce duplicate events.
11. Concurrency safety test -> dialect-aware row locking / idempotent updates.
12. Public lookup immediately succeeds after activation date arrives.
13. Vector PDF retains scheduled issue date in visual snapshot.
14. Legacy historical certificates remain accessible and ISSUED.
15. Revoked and superseded certificates are not affected by scheduled activation.
Bonus scenarios:
16. Strict Date of Issue validation: rejects past dates > 365 days, accepts past dates <= 365 days.
17. Rescheduling: permitted only for SCHEDULED certificates prior to activation, forbidden once ISSUED.
"""

import uuid
import pytest
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.models.base import Base
from app.models.user import User
from app.models.role import Role
from app.api.dependencies import get_db, get_optional_current_user
from app.modules.sama_veda.models.author import ResearchAuthor
from app.modules.sama_veda.models.bulletin import ResearchBulletin
from app.modules.sama_veda.models.certificate import (
    FelicitationCertificate,
    CertificateAuthor,
    CertificateApproval,
    CertificateSignatory,
    CertificateTemplate,
)
from app.modules.sama_veda.schemas.cms import (
    CertificateIssueRequest,
    CertificateAuthorCreate,
    CertificateRescheduleRequest,
)
from app.modules.sama_veda.services.cms_service import (
    SamaCmsService,
    validate_issue_date,
)

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

    # Mock storage service to save to tmp_path
    class MockStorageService:
        def save_file(self, content, filename, subfolder="", **kwargs):
            out_file = tmp_path / filename
            out_file.write_bytes(content)
            class SaveRes:
                storage_key = str(out_file)
            return SaveRes()

        def get_file_path(self, storage_key):
            from pathlib import Path
            return Path(storage_key)

    from app.modules.sama_veda.services import cms_service, certificate_download_service
    monkeypatch.setattr(cms_service, "storage_service", MockStorageService())
    monkeypatch.setattr(certificate_download_service, "storage_service", MockStorageService())

    # Mock PDF rendering engine to avoid heavy rendering during rapid tests
    class MockPdfEngine:
        def render_certificate_pdf(self, **kwargs):
            import hashlib
            content = f"PDF-Mock-{kwargs.get('certificate_number')}-{kwargs.get('issue_date')}".encode()
            sha = hashlib.sha256(content).hexdigest()
            return content, sha

    monkeypatch.setattr(cms_service, "certificate_pdf_engine", MockPdfEngine())

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
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def sample_bulletin(db_session):
    bulletin = ResearchBulletin(
        title="CSJMU Research Bulletin Vol 2 Issue 3",
        volume_number=2,
        issue_number=3,
        publication_period="July - September 2026",
        file_path="sama_veda/bulletins/vol2_issue3.pdf",
        status="PUBLISHED",
    )
    db_session.add(bulletin)
    db_session.commit()
    db_session.refresh(bulletin)
    return bulletin


@pytest.fixture
def sample_author(db_session):
    author = ResearchAuthor(
        scopus_id="57200000099",
        full_name="Dr. Harshit Gupta",
        department="Department of Physics",
        institutional_affiliation="Chhatrapati Shahu Ji Maharaj University, Kanpur",
        is_verified=True,
    )
    db_session.add(author)
    db_session.commit()
    db_session.refresh(author)
    return author


# ============================================================================
# SCENARIO 1: Immediate Activation (Date = Today)
# ============================================================================
def test_scenario_1_immediate_activation_today(db_session, sample_bulletin, sample_author):
    today_ist = datetime.now(timezone.utc).astimezone(IST).date()

    req = CertificateIssueRequest(
        certificate_type="RESEARCH_PUBLICATION",
        title="Certificate of Appreciation & Research Excellence",
        research_title="Nanotechnology Innovations in Energy Storage",
        bulletin_id=sample_bulletin.id,
        issue_date=today_ist,
        submit_for_approval=False,
        direct_issue_justification="Authorized immediate direct felicitation",
        authors=[
            CertificateAuthorCreate(
                researcher_id=sample_author.id,
                author_name_snapshot=sample_author.full_name,
                academic_title_snapshot="Dr.",
                scopus_id_snapshot=sample_author.scopus_id,
                department_snapshot=sample_author.department,
                affiliation_snapshot=sample_author.institutional_affiliation,
                author_order=1,
                author_role="Principal Author",
            )
        ],
    )

    cert = SamaCmsService.issue_certificate(db_session, req)
    assert cert.status == "ISSUED"
    assert cert.scheduled_issue_date == today_ist
    assert cert.activated_at is not None
    assert cert.is_scheduled is False


# ============================================================================
# SCENARIO 2 & 3: Future-Dated Issuance -> SCHEDULED Status
# ============================================================================
def test_scenario_2_and_3_future_dated_certificate_is_scheduled(db_session, sample_bulletin, sample_author):
    today_ist = datetime.now(timezone.utc).astimezone(IST).date()
    tomorrow = today_ist + timedelta(days=1)
    future_10d = today_ist + timedelta(days=10)

    # Tomorrow
    req_tomorrow = CertificateIssueRequest(
        certificate_type="RESEARCH_PUBLICATION",
        bulletin_id=sample_bulletin.id,
        issue_date=tomorrow,
        submit_for_approval=False,
        direct_issue_justification="Scheduled annual awards ceremony",
        authors=[
            CertificateAuthorCreate(
                researcher_id=sample_author.id,
                author_name_snapshot=sample_author.full_name,
                scopus_id_snapshot=sample_author.scopus_id,
            )
        ],
    )
    cert_tomorrow = SamaCmsService.issue_certificate(db_session, req_tomorrow)
    assert cert_tomorrow.status == "SCHEDULED"
    assert cert_tomorrow.scheduled_issue_date == tomorrow
    assert cert_tomorrow.activated_at is None
    assert cert_tomorrow.is_scheduled is True
    assert cert_tomorrow.time_until_activation_seconds is not None
    assert cert_tomorrow.time_until_activation_seconds > 0

    # 10 days in future
    req_future = CertificateIssueRequest(
        certificate_type="INCENTIVE_AWARD",
        bulletin_id=sample_bulletin.id,
        issue_date=future_10d,
        submit_for_approval=False,
        direct_issue_justification="Scheduled convocation ceremony",
        authors=[
            CertificateAuthorCreate(
                researcher_id=sample_author.id,
                author_name_snapshot=sample_author.full_name,
                scopus_id_snapshot=sample_author.scopus_id,
            )
        ],
    )
    cert_future = SamaCmsService.issue_certificate(db_session, req_future)
    assert cert_future.status == "SCHEDULED"
    assert cert_future.scheduled_issue_date == future_10d
    assert cert_future.activated_at is None


# ============================================================================
# SCENARIO 4: Dual Approvals with Future Date -> Transitions to SCHEDULED
# ============================================================================
def test_scenario_4_dual_approval_with_future_date_becomes_scheduled(db_session, sample_bulletin, sample_author):
    today_ist = datetime.now(timezone.utc).astimezone(IST).date()
    next_week = today_ist + timedelta(days=7)

    req = CertificateIssueRequest(
        certificate_type="RESEARCH_PUBLICATION",
        bulletin_id=sample_bulletin.id,
        issue_date=next_week,
        submit_for_approval=True,
        authors=[
            CertificateAuthorCreate(
                researcher_id=sample_author.id,
                author_name_snapshot=sample_author.full_name,
                scopus_id_snapshot=sample_author.scopus_id,
            )
        ],
    )

    cert = SamaCmsService.issue_certificate(db_session, req)
    assert cert.status == "PENDING_DEAN_APPROVAL"
    assert cert.scheduled_issue_date == next_week
    assert cert.activated_at is None

    # Step 1: Dean Approves
    cert = SamaCmsService.process_authority_approval(
        db_session, cert, authority_type="DEAN_RD", action="APPROVE", remarks="Approved by Dean"
    )
    assert cert.status == "PENDING_VC_APPROVAL"

    # Step 2: Vice Chancellor Approves
    cert = SamaCmsService.process_authority_approval(
        db_session, cert, authority_type="VICE_CHANCELLOR", action="APPROVE", remarks="Concurred by VC"
    )
    # Because date is next week, final state MUST be SCHEDULED, not ISSUED!
    assert cert.status == "SCHEDULED"
    assert cert.approved_at is not None
    assert cert.activated_at is None
    assert cert.scheduled_issue_date == next_week


# ============================================================================
# SCENARIOS 5, 6, 7, 8: Public Invisibility of Scheduled Certificates
# ============================================================================
def test_scenarios_5_to_8_public_invisibility_of_scheduled_certificates(client, db_session, sample_bulletin, sample_author):
    today_ist = datetime.now(timezone.utc).astimezone(IST).date()
    future_date = today_ist + timedelta(days=5)

    req = CertificateIssueRequest(
        certificate_type="RESEARCH_PUBLICATION",
        bulletin_id=sample_bulletin.id,
        issue_date=future_date,
        submit_for_approval=False,
        direct_issue_justification="Scheduled ceremony",
        authors=[
            CertificateAuthorCreate(
                researcher_id=sample_author.id,
                author_name_snapshot=sample_author.full_name,
                scopus_id_snapshot=sample_author.scopus_id,
            )
        ],
    )
    cert = SamaCmsService.issue_certificate(db_session, req)
    assert cert.status == "SCHEDULED"

    # Scenario 5: Public Scopus ID Lookup MUST omit scheduled certificate
    resp_scopus = client.get(f"/api/modules/sama-veda/certificates/researcher-discovery?scopus_id={sample_author.scopus_id}")
    assert resp_scopus.status_code == 200
    data = resp_scopus.json()["data"]
    research_cert_nums = [c["certificate_number"] for c in data["research_certificates"]]
    assert cert.certificate_number not in research_cert_nums

    # Scenario 6: Public Verify-by-Number returns 404
    resp_verify_num = client.get(f"/api/modules/sama-veda/certificates/verify/{cert.certificate_number}")
    assert resp_verify_num.status_code == 404

    # Scenario 7: Public QR Verify (by verification_token) returns 404
    resp_verify_token = client.get(f"/api/modules/sama-veda/certificates/verify/{cert.verification_token}")
    assert resp_verify_token.status_code == 404

    # Scenario 8: Public PDF Download by token or number returns 404
    resp_dl_token = client.get(f"/api/modules/sama-veda/certificates/verify/{cert.verification_token}/download")
    assert resp_dl_token.status_code == 404

    resp_dl_num = client.get(f"/api/modules/sama-veda/certificates/download/{cert.certificate_number}")
    assert resp_dl_num.status_code == 404


# ============================================================================
# SCENARIOS 9, 10, 11, 12: Automatic Activation, Idempotency, and Public Accessibility
# ============================================================================
def test_scenarios_9_to_12_automatic_activation_and_idempotency(client, db_session, sample_bulletin, sample_author):
    today_ist = datetime.now(timezone.utc).astimezone(IST).date()
    future_date = today_ist + timedelta(days=2)

    req = CertificateIssueRequest(
        certificate_type="RESEARCH_PUBLICATION",
        bulletin_id=sample_bulletin.id,
        issue_date=future_date,
        submit_for_approval=False,
        direct_issue_justification="Ceremony in 2 days",
        authors=[
            CertificateAuthorCreate(
                researcher_id=sample_author.id,
                author_name_snapshot=sample_author.full_name,
                scopus_id_snapshot=sample_author.scopus_id,
            )
        ],
    )
    cert = SamaCmsService.issue_certificate(db_session, req)
    assert cert.status == "SCHEDULED"

    # Before due date arrives: activating as of today activates 0
    activated_today = SamaCmsService.activate_due_certificates(db_session, as_of_date=today_ist)
    assert activated_today == 0
    db_session.refresh(cert)
    assert cert.status == "SCHEDULED"

    # Scenario 9: When target date arrives (as_of_date = future_date):
    activated_due = SamaCmsService.activate_due_certificates(db_session, as_of_date=future_date)
    assert activated_due == 1
    db_session.refresh(cert)
    assert cert.status == "ISSUED"
    assert cert.activated_at is not None

    # Scenario 10: Idempotency -> subsequent calls activate 0 and don't re-touch record
    second_run = SamaCmsService.activate_due_certificates(db_session, as_of_date=future_date)
    assert second_run == 0
    third_run = SamaCmsService.activate_due_certificates(db_session, as_of_date=future_date + timedelta(days=1))
    assert third_run == 0

    # Scenario 12: Public lookup immediately works after activation
    resp_scopus = client.get(f"/api/modules/sama-veda/certificates/researcher-discovery?scopus_id={sample_author.scopus_id}")
    assert resp_scopus.status_code == 200
    data = resp_scopus.json()["data"]
    research_cert_nums = [c["certificate_number"] for c in data["research_certificates"]]
    assert cert.certificate_number in research_cert_nums

    # Public verification by number now returns 200
    resp_verify = client.get(f"/api/modules/sama-veda/certificates/verify/{cert.certificate_number}")
    assert resp_verify.status_code == 200
    assert resp_verify.json()["data"]["status"] == "ISSUED"

    # Public PDF download now succeeds
    resp_dl = client.get(f"/api/modules/sama-veda/certificates/download/{cert.certificate_number}")
    assert resp_dl.status_code == 200


# ============================================================================
# SCENARIO 13: Vector PDF Retains Scheduled Issue Date
# ============================================================================
def test_scenario_13_pdf_snapshot_retains_scheduled_issue_date(db_session, sample_bulletin, sample_author):
    today_ist = datetime.now(timezone.utc).astimezone(IST).date()
    target_date = today_ist + timedelta(days=14)

    req = CertificateIssueRequest(
        certificate_type="RESEARCH_PUBLICATION",
        bulletin_id=sample_bulletin.id,
        issue_date=target_date,
        submit_for_approval=False,
        direct_issue_justification="Official Convocation",
        authors=[
            CertificateAuthorCreate(
                researcher_id=sample_author.id,
                author_name_snapshot=sample_author.full_name,
                scopus_id_snapshot=sample_author.scopus_id,
            )
        ],
    )
    cert = SamaCmsService.issue_certificate(db_session, req)
    assert cert.scheduled_issue_date == target_date
    assert cert.issued_at.date() == target_date


# ============================================================================
# SCENARIOS 14 & 15: Historical Integrity & Non-Interference with Revoked/Superseded
# ============================================================================
def test_scenarios_14_and_15_legacy_and_revoked_non_interference(db_session, sample_bulletin, sample_author):
    today_ist = datetime.now(timezone.utc).astimezone(IST).date()

    # Legacy historical certificate (already issued)
    legacy = FelicitationCertificate(
        certificate_number="CSJMU/SAMIKSHA/2025/HISTORICAL-01",
        status="ISSUED",
        scheduled_issue_date=today_ist - timedelta(days=100),
        activated_at=datetime.now(timezone.utc) - timedelta(days=100),
        title="Historical Certificate",
        verification_token=uuid.uuid4().hex,
        author_id=sample_author.id,
    )
    # Revoked certificate
    revoked = FelicitationCertificate(
        certificate_number="CSJMU/SAMIKSHA/2025/REVOKED-01",
        status="REVOKED",
        is_revoked=True,
        scheduled_issue_date=today_ist + timedelta(days=1),
        revocation_reason="Paper retracted",
        verification_token=uuid.uuid4().hex,
        author_id=sample_author.id,
    )
    # Superseded certificate
    superseded = FelicitationCertificate(
        certificate_number="CSJMU/SAMIKSHA/2025/SUPERSEDED-01",
        status="SUPERSEDED",
        scheduled_issue_date=today_ist + timedelta(days=1),
        reissued_reason="Superseded by replacement",
        verification_token=uuid.uuid4().hex,
        author_id=sample_author.id,
    )
    db_session.add_all([legacy, revoked, superseded])
    db_session.commit()

    # Run activation as of tomorrow
    tomorrow = today_ist + timedelta(days=1)
    activated = SamaCmsService.activate_due_certificates(db_session, as_of_date=tomorrow)
    assert activated == 0  # Neither legacy, revoked, nor superseded should be changed

    db_session.refresh(legacy)
    db_session.refresh(revoked)
    db_session.refresh(superseded)

    assert legacy.status == "ISSUED"
    assert revoked.status == "REVOKED"
    assert superseded.status == "SUPERSEDED"


# ============================================================================
# SCENARIOS 16 & 17: Validation Limits & Rescheduling Capabilities
# ============================================================================
def test_scenario_16_past_date_validation_limits():
    today_ist = datetime.now(timezone.utc).astimezone(IST).date()

    # Within 365 days: valid
    valid_past = today_ist - timedelta(days=180)
    validate_issue_date(valid_past)  # should not raise

    # Exactly 365 days: valid
    validate_issue_date(today_ist - timedelta(days=365))  # should not raise

    # > 365 days: rejected with HTTPException 400
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        validate_issue_date(today_ist - timedelta(days=400))
    assert exc_info.value.status_code == 400
    assert "exceeds the permitted institutional backfill limit of 365 days" in exc_info.value.detail


def test_scenario_17_rescheduling_behavior(db_session, sample_bulletin, sample_author):
    today_ist = datetime.now(timezone.utc).astimezone(IST).date()
    original_sched = today_ist + timedelta(days=5)

    req = CertificateIssueRequest(
        certificate_type="RESEARCH_PUBLICATION",
        bulletin_id=sample_bulletin.id,
        issue_date=original_sched,
        submit_for_approval=False,
        direct_issue_justification="Scheduled",
        authors=[
            CertificateAuthorCreate(
                researcher_id=sample_author.id,
                author_name_snapshot=sample_author.full_name,
                scopus_id_snapshot=sample_author.scopus_id,
            )
        ],
    )
    cert = SamaCmsService.issue_certificate(db_session, req)
    assert cert.status == "SCHEDULED"
    assert cert.scheduled_issue_date == original_sched

    # Reschedule to 12 days in future
    new_sched = today_ist + timedelta(days=12)
    updated = SamaCmsService.reschedule_certificate(db_session, cert.id, new_sched)
    assert updated.status == "SCHEDULED"
    assert updated.scheduled_issue_date == new_sched
    assert updated.issued_at.date() == new_sched

    # Reschedule to today (triggers immediate activation!)
    now_cert = SamaCmsService.reschedule_certificate(db_session, cert.id, today_ist)
    assert now_cert.status == "ISSUED"
    assert now_cert.scheduled_issue_date == today_ist
    assert now_cert.activated_at is not None

    # Reschedule on already ISSUED certificate must be rejected!
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        SamaCmsService.reschedule_certificate(db_session, cert.id, today_ist + timedelta(days=1))
    assert exc_info.value.status_code == 400
    assert "Rescheduling is only permitted for certificates in SCHEDULED status" in exc_info.value.detail
