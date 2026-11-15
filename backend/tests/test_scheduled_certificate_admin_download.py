"""
Comprehensive Automated Test Suite for SAMIKSHA Scheduled Certificate Admin Download Support.

Validates institutional requirements:
1. Super Admin Advance Download:
   - Super Admin can download SCHEDULED certificate PDF prior to scheduled issue date.
   - Streamed response has HTTP 200, Content-Type: application/pdf, X-Certificate-Status: SCHEDULED.
2. State & Activation Immobility:
   - Downloading a scheduled certificate does NOT activate or issue it.
   - Status remains SCHEDULED in database.
   - activated_at remains None.
   - download_count is incremented and audit telemetry is logged.
3. Strict Public Verification Inaccessibility:
   - Public GET /certificates/verify/{certificate_number} returns HTTP 404 Not Found.
4. Strict Public Token Download Inaccessibility:
   - Public GET /certificates/download/{token} returns HTTP 404 Not Found.
5. Strict Public Query Download Inaccessibility:
   - Public GET /certificates/download?certificate_number=... returns HTTP 404 Not Found.
6. Public Scopus Researcher Discovery Inaccessibility:
   - Scheduled certificates are completely excluded from researcher profile discovery.
7. Backend RBAC Enforcement:
   - Unauthenticated requests to /api/admin/sama/certificates/{id}/download return HTTP 401.
   - Authenticated non-admin / unauthorized applicants return HTTP 403 Forbidden.
8. Revoked & Superseded Exclusions:
   - Revoked certificates are rejected with HTTP 403 Forbidden on admin download.
   - Superseded certificates are rejected with HTTP 409 Conflict on admin download.
9. Lifecycle Transition & Activation:
   - On scheduled issue date, certificate transitions to ISSUED.
   - Public verification and download then immediately become accessible.
"""

import hashlib
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
)
from app.modules.sama_veda.services.cms_service import SamaCmsService
from app.modules.sama_veda.services.researcher_discovery_service import ResearcherDiscoveryService

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
            class SaveRes:
                storage_key = str(out_file)
            return SaveRes()

        def get_file_path(self, storage_key):
            from pathlib import Path
            return Path(storage_key)

    from app.modules.sama_veda.services import cms_service, certificate_download_service
    monkeypatch.setattr(cms_service, "storage_service", MockStorageService())
    monkeypatch.setattr(certificate_download_service, "storage_service", MockStorageService())

    # Mock PDF rendering engine to return consistent bytes & SHA-256
    class MockPdfEngine:
        def render_certificate_pdf(self, **kwargs):
            content = f"%PDF-1.4 Mock-PDF-{kwargs.get('certificate_number')}-{kwargs.get('issue_date')}".encode()
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
def super_admin_user(db_session):
    role = Role(id=uuid.uuid4(), name="super_admin", description="Super Admin Role")
    user = User(
        id=uuid.uuid4(),
        email="superadmin.samiksha@csjmu.ac.in",
        first_name="Super",
        last_name="Admin",
        is_active=True,
        roles=[role],
    )
    db_session.add_all([role, user])
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def regular_applicant_user(db_session):
    role = Role(id=uuid.uuid4(), name="applicant", description="Applicant Role")
    user = User(
        id=uuid.uuid4(),
        email="applicant.student@csjmu.ac.in",
        first_name="Applicant",
        last_name="User",
        is_active=True,
        roles=[role],
    )
    db_session.add_all([role, user])
    db_session.commit()
    db_session.refresh(user)
    return user


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
        scopus_id="57200000999",
        full_name="Prof. Anandita Sharma",
        department="Department of Biotechnology",
        institutional_affiliation="Chhatrapati Shahu Ji Maharaj University, Kanpur",
        is_verified=True,
    )
    db_session.add(author)
    db_session.commit()
    db_session.refresh(author)
    return author


@pytest.fixture
def scheduled_certificate(db_session, sample_bulletin, sample_author):
    """Creates a SCHEDULED certificate set for tomorrow."""
    today_ist = datetime.now(timezone.utc).astimezone(IST).date()
    tomorrow_ist = today_ist + timedelta(days=1)

    req = CertificateIssueRequest(
        certificate_type="RESEARCH_PUBLICATION",
        title="Certificate of Appreciation & Research Excellence",
        research_title="CRISPR Gene Editing in Crop Resilience",
        bulletin_id=sample_bulletin.id,
        issue_date=tomorrow_ist,
        submit_for_approval=False,
        direct_issue_justification="Advance printing for upcoming convocation ceremony",
        authors=[
            CertificateAuthorCreate(
                researcher_id=sample_author.id,
                author_name_snapshot=sample_author.full_name,
                academic_title_snapshot="Prof.",
                scopus_id_snapshot=sample_author.scopus_id,
                department_snapshot=sample_author.department,
                affiliation_snapshot=sample_author.institutional_affiliation,
                author_order=1,
                author_role="Principal Author",
            )
        ],
    )

    cert = SamaCmsService.issue_certificate(db_session, req)
    assert cert.status == "SCHEDULED"
    assert cert.is_scheduled is True
    assert cert.scheduled_issue_date == tomorrow_ist
    assert cert.activated_at is None
    return cert


# ============================================================================
# SCENARIO 1: Super Admin can download SCHEDULED certificate PDF before issue date
# ============================================================================
def test_scenario_1_super_admin_downloads_scheduled_certificate(
    client, db_session, scheduled_certificate, super_admin_user
):
    app.dependency_overrides[get_current_user] = lambda: super_admin_user
    try:
        response = client.get(f"/api/admin/sama/certificates/{scheduled_certificate.id}/download")
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert response.headers["x-certificate-number"] == scheduled_certificate.certificate_number
        assert response.headers["x-certificate-status"] == "SCHEDULED"
        assert "x-certificate-sha256" in response.headers
        assert response.headers["x-certificate-sha256"] == scheduled_certificate.checksum_sha256
        assert "attachment" in response.headers["content-disposition"]
        assert len(response.content) > 0
    finally:
        app.dependency_overrides.pop(get_current_user, None)


# ============================================================================
# SCENARIO 2: Certificate retains SCHEDULED status after admin download
# ============================================================================
def test_scenario_2_certificate_retains_scheduled_status_after_download(
    client, db_session, scheduled_certificate, super_admin_user
):
    initial_download_count = scheduled_certificate.download_count or 0
    app.dependency_overrides[get_current_user] = lambda: super_admin_user
    try:
        response = client.get(f"/api/admin/sama/certificates/{scheduled_certificate.id}/download")
        assert response.status_code == 200

        # Query fresh from DB to verify no mutation occurred
        db_session.expire_all()
        reloaded = db_session.get(FelicitationCertificate, scheduled_certificate.id)
        assert reloaded.status == "SCHEDULED"
        assert reloaded.activated_at is None
        assert reloaded.is_scheduled is True
        assert reloaded.download_count == initial_download_count + 1
    finally:
        app.dependency_overrides.pop(get_current_user, None)


# ============================================================================
# SCENARIO 3: Public verification returns HTTP 404 for SCHEDULED certificate
# ============================================================================
def test_scenario_3_public_verification_returns_404(
    client, scheduled_certificate
):
    clean_num = scheduled_certificate.certificate_number
    response = client.get(f"/api/modules/sama-veda/certificates/verify/{clean_num}")
    assert response.status_code == 404
    detail = response.json().get("detail", "") or response.json().get("message", "")
    assert "not found" in detail.lower()


# ============================================================================
# SCENARIO 4: Public token download returns HTTP 404 for SCHEDULED certificate
# ============================================================================
def test_scenario_4_public_token_download_returns_404(
    client, scheduled_certificate
):
    token = scheduled_certificate.verification_token
    assert token is not None
    response = client.get(f"/api/modules/sama-veda/certificates/download/{token}")
    assert response.status_code == 404


# ============================================================================
# SCENARIO 5: Public query download returns HTTP 404 for SCHEDULED certificate
# ============================================================================
def test_scenario_5_public_query_download_returns_404(
    client, scheduled_certificate
):
    num = scheduled_certificate.certificate_number
    response = client.get(f"/api/modules/sama-veda/certificates/download?certificate_number={num}")
    assert response.status_code == 404


# ============================================================================
# SCENARIO 6: Public Scopus researcher discovery excludes SCHEDULED certificate
# ============================================================================
def test_scenario_6_scopus_discovery_excludes_scheduled_certificate(
    client, db_session, scheduled_certificate, sample_author
):
    result = ResearcherDiscoveryService.get_researcher_certificates(
        author=sample_author,
        db=db_session,
    )
    cert_ids = [c["id"] for c in result.get("research_certificates", []) + result.get("incentive_certificates", [])]
    assert str(scheduled_certificate.id) not in cert_ids
    assert result.get("total_certificates", 0) == 0


# ============================================================================
# SCENARIO 7: Unauthorized admin download is rejected (401 unauthenticated, 403 non-admin)
# ============================================================================
def test_scenario_7_unauthorized_admin_download_rejected(
    client, scheduled_certificate, regular_applicant_user
):
    # 7A: Completely unauthenticated -> HTTP 401
    res_anon = client.get(f"/api/admin/sama/certificates/{scheduled_certificate.id}/download")
    assert res_anon.status_code == 401

    # 7B: Authenticated as regular applicant without sama:certificate:manage -> HTTP 403
    app.dependency_overrides[get_current_user] = lambda: regular_applicant_user
    try:
        res_applicant = client.get(f"/api/admin/sama/certificates/{scheduled_certificate.id}/download")
        assert res_applicant.status_code == 403
        body = res_applicant.json()
        detail = body.get("message", "") or body.get("detail", "")
        assert "Access denied" in detail or "Missing required permission" in detail or "forbidden" in detail.lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)


# ============================================================================
# SCENARIO 8: Revoked and Superseded certificates are blocked on admin download
# ============================================================================
def test_scenario_8_revoked_and_superseded_certificates_blocked(
    client, db_session, scheduled_certificate, super_admin_user
):
    app.dependency_overrides[get_current_user] = lambda: super_admin_user
    try:
        # Test Revoked
        scheduled_certificate.status = "REVOKED"
        scheduled_certificate.is_revoked = True
        scheduled_certificate.revocation_reason = "Plagiarism discovered post-investigation"
        db_session.commit()

        res_revoked = client.get(f"/api/admin/sama/certificates/{scheduled_certificate.id}/download")
        assert res_revoked.status_code == 403
        body_revoked = res_revoked.json()
        msg_revoked = body_revoked.get("message", "") or body_revoked.get("detail", "")
        assert "REVOKED" in msg_revoked

        # Test Superseded
        scheduled_certificate.status = "SUPERSEDED"
        scheduled_certificate.is_revoked = False
        db_session.commit()

        res_superseded = client.get(f"/api/admin/sama/certificates/{scheduled_certificate.id}/download")
        assert res_superseded.status_code == 409
        body_superseded = res_superseded.json()
        msg_superseded = body_superseded.get("message", "") or body_superseded.get("detail", "")
        assert "SUPERSEDED" in msg_superseded
    finally:
        app.dependency_overrides.pop(get_current_user, None)


# ============================================================================
# SCENARIO 9: Lifecycle activation on scheduled date enables public access
# ============================================================================
def test_scenario_9_activation_on_issue_date_enables_public_access(
    client, db_session, scheduled_certificate, sample_author
):
    # Before activation: public verify returns 404
    res_before = client.get(f"/api/modules/sama-veda/certificates/verify/{scheduled_certificate.certificate_number}")
    assert res_before.status_code == 404

    # Simulate arrival of scheduled date
    target_date = scheduled_certificate.scheduled_issue_date
    count = SamaCmsService.activate_due_certificates(db_session, as_of_date=target_date)
    assert count >= 1

    # Verify status changed to ISSUED
    db_session.expire_all()
    activated = db_session.get(FelicitationCertificate, scheduled_certificate.id)
    assert activated.status == "ISSUED"
    assert activated.activated_at is not None

    # After activation: public verify returns 200
    res_after = client.get(f"/api/modules/sama-veda/certificates/verify/{activated.certificate_number}")
    assert res_after.status_code == 200
    assert res_after.json()["data"]["certificate_number"] == activated.certificate_number

    # Public download also returns 200
    res_down = client.get(f"/api/modules/sama-veda/certificates/download/{activated.verification_token}")
    assert res_down.status_code == 200
    assert res_down.headers["content-type"] == "application/pdf"

    # Scopus discovery now includes certificate
    scopus_result = ResearcherDiscoveryService.get_researcher_certificates(
        author=sample_author,
        db=db_session,
    )
    cert_ids = [c["id"] for c in scopus_result.get("research_certificates", []) + scopus_result.get("incentive_certificates", [])]
    assert str(activated.id) in cert_ids
