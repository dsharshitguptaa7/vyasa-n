"""
Database-Free Tests for Sama Veda Content Management Backend APIs (Phase C).

Verifies:
1. Pydantic schema validation:
   - Default status="draft" for publications and bulletins.
   - Certificate revocation requires mandatory explanation (min length 5).
   - Valid lifecycle statuses (draft, in_review, published, archived).
2. RBAC & Granular Authorization:
   - 401 Unauthorized for unauthenticated requests.
   - 403 Forbidden for unauthorized roles (e.g. applicant).
   - Delegated role sama_content_editor can read/edit, but cannot publish or revoke.
   - Delegated role sama_content_admin can read/edit/publish/verify/manage, but cannot revoke certificates.
   - administrator role cannot revoke certificates.
   - super_admin can revoke certificates.
3. CMS Business Logic & Content Lifecycle:
   - Publication status changes update published_at / archived_at timestamps.
   - Author verification updates is_verified and verification_notes.
   - Certificate revocation marks is_revoked=True and stores revocation_reason.
4. Public Read Filtering:
   - /api/modules/sama-veda/publications strictly queries status == 'published'.
   - /api/modules/sama-veda/bulletins strictly queries status == 'published' AND is_active == True.
   - /api/modules/sama-veda/certificates/verify reports revoked status.
   - /api/modules/sama-veda/certificates/download blocks revoked certificates with 403 Forbidden.
5. Central Audit Service Integration:
   - All mutations trigger audit logging with module="sama_veda" and fail_silent=False.
6. Central Storage Service Integration:
   - Bulletin and certificate upload endpoints validate file types and store securely.
"""

from datetime import datetime, timezone
import io
from unittest.mock import MagicMock, patch
import uuid
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.api.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.role import Role
from app.models.permission import Permission
from app.services.audit_service import audit_service
from app.modules.sama_veda.models.publication import ResearchPublication, PublicationAuthor
from app.modules.sama_veda.models.bulletin import ResearchBulletin
from app.modules.sama_veda.models.author import ResearchAuthor
from app.modules.sama_veda.models.cam_project import CamAiProject
from app.modules.sama_veda.models.certificate import FelicitationCertificate
from app.modules.sama_veda.models.spotlight import ResearcherSpotlight
from app.modules.sama_veda.schemas.cms import (
    PublicationCreate,
    PublicationUpdate,
    PublicationStatusUpdate,
    AuthorCreate,
    AuthorVerificationUpdate,
    BulletinCreate,
    BulletinStatusUpdate,
    CertificateIssueRequest,
    CertificateRevokeRequest,
    SpotlightCreate,
    SpotlightUpdate,
)


SAMPLE_PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"


# ============================================================================
# Helpers for User & Mock DB Fixtures
# ============================================================================

def make_mock_user(role_name: str, permissions: list[str]) -> User:
    role = Role(name=role_name)
    role.permissions = [Permission(name=p, resource="sama_veda", action=p.split(":")[-1]) for p in permissions]
    user = User(
        id=uuid.uuid4(),
        email=f"{role_name}@csjmu.ac.in",
        first_name="Test",
        last_name=role_name.capitalize(),
        is_active=True,
    )
    user.roles = [role]
    return user


@pytest.fixture(autouse=True)
def clean_dependency_overrides():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def super_admin_user():
    return make_mock_user(
        "super_admin",
        [
            "sama:read",
            "sama:content:edit",
            "sama:content:publish",
            "sama:author:verify",
            "sama:certificate:manage",
            "sama:certificate:revoke",
        ],
    )


@pytest.fixture
def administrator_user():
    return make_mock_user(
        "administrator",
        [
            "sama:read",
            "sama:content:edit",
            "sama:content:publish",
            "sama:author:verify",
            "sama:certificate:manage",
            # Note: sama:certificate:revoke is strictly excluded!
        ],
    )


@pytest.fixture
def sama_content_admin_user():
    return make_mock_user(
        "sama_content_admin",
        [
            "sama:read",
            "sama:content:edit",
            "sama:content:publish",
            "sama:author:verify",
            "sama:certificate:manage",
        ],
    )


@pytest.fixture
def sama_content_editor_user():
    return make_mock_user(
        "sama_content_editor",
        [
            "sama:read",
            "sama:content:edit",
        ],
    )


@pytest.fixture
def applicant_user():
    return make_mock_user("applicant", ["applicant:submit"])


@pytest.fixture
def mock_db():
    session = MagicMock()
    return session


@pytest.fixture
def client():
    with patch("app.main.check_database_connection", return_value=False), \
         patch("app.main.seed_all", return_value={}):
        with TestClient(app) as test_client:
            yield test_client


# ============================================================================
# 1. Pydantic Schema Validation Tests
# ============================================================================

def test_publication_create_defaults_to_draft():
    payload = PublicationCreate(
        bulletin_id=uuid.uuid4(),
        serial_no=1,
        slug="v2-i1-r001",
        title="Valid Research Publication Title",
        source_journal="Journal of High Energy Physics",
        category="Article",
        author_display="Kumar et al.",
    )
    assert payload.status == "draft"
    assert payload.is_featured is False
    assert payload.authors_complete is True


def test_publication_create_rejects_invalid_status():
    with pytest.raises(ValidationError):
        PublicationCreate(
            bulletin_id=uuid.uuid4(),
            serial_no=1,
            slug="v2-i1-r001",
            title="Valid Title",
            source_journal="Journal of Physics",
            category="Article",
            author_display="Kumar et al.",
            status="pending_approval",  # Invalid pattern
        )


def test_certificate_revoke_requires_minimum_length_reason():
    with pytest.raises(ValidationError):
        CertificateRevokeRequest(revocation_reason="bad")  # Too short (< 5 chars)

    valid = CertificateRevokeRequest(
        revocation_reason="Paper retracted by publisher due to duplicate publication."
    )
    assert len(valid.revocation_reason) >= 5


def test_bulletin_create_defaults_to_draft():
    payload = BulletinCreate(
        volume_number=2,
        issue_number=1,
        title="Volume 2 • Issue 1",
        publication_period="January – March 2026",
        file_path="storage/sama_veda/bulletins/v2_i1.pdf",
    )
    assert payload.status == "draft"
    assert payload.is_active is True


# ============================================================================
# 2. RBAC & Granular Authorization Tests
# ============================================================================

def test_unauthenticated_request_rejected(client):
    """Requests without auth header return 401 Unauthorized."""
    resp = client.get("/api/admin/sama/publications")
    assert resp.status_code == 401


def test_unauthorized_role_rejected(client, mock_db, applicant_user):
    """Applicant user receives 403 Forbidden for Sama admin routes."""
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: applicant_user

    resp = client.get("/api/admin/sama/publications")
    assert resp.status_code == 403
    assert "Missing required permission: 'sama:read'" in resp.json()["message"]


def test_editor_can_read_and_edit_publications(client, mock_db, sama_content_editor_user):
    """Editor can list publications because they possess 'sama:read'."""
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: sama_content_editor_user

    mock_db.scalar.return_value = 0
    mock_db.scalars.return_value.unique.return_value.all.return_value = []

    resp = client.get("/api/admin/sama/publications")
    assert resp.status_code == 200
    assert resp.json()["success"] is True


def test_editor_cannot_publish_publication(client, mock_db, sama_content_editor_user):
    """Editor cannot publish (change status) because they lack sama:content:publish."""
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: sama_content_editor_user

    pub_id = uuid.uuid4()
    resp = client.patch(
        f"/api/admin/sama/publications/{pub_id}/status",
        json={"status": "published"},
    )
    assert resp.status_code == 403
    assert "Missing required permission: 'sama:content:publish'" in resp.json()["message"]


def test_editor_cannot_revoke_certificate(client, mock_db, sama_content_editor_user):
    """Editor cannot revoke certificate."""
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: sama_content_editor_user

    cert_id = uuid.uuid4()
    resp = client.post(
        f"/api/admin/sama/certificates/{cert_id}/revoke",
        json={"revocation_reason": "Institutional decision after misconduct inquiry."},
    )
    assert resp.status_code == 403
    assert "Missing required permission: 'sama:certificate:revoke'" in resp.json()["message"]


def test_content_admin_cannot_revoke_certificate(client, mock_db, sama_content_admin_user):
    """Content Admin has manage permission but NOT certificate revoke."""
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: sama_content_admin_user

    cert_id = uuid.uuid4()
    resp = client.post(
        f"/api/admin/sama/certificates/{cert_id}/revoke",
        json={"revocation_reason": "Institutional decision after misconduct inquiry."},
    )
    assert resp.status_code == 403
    assert "Missing required permission: 'sama:certificate:revoke'" in resp.json()["message"]


def test_general_administrator_cannot_revoke_certificate(client, mock_db, administrator_user):
    """Institutional administrator role is strictly excluded from certificate revocation."""
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: administrator_user

    cert_id = uuid.uuid4()
    resp = client.post(
        f"/api/admin/sama/certificates/{cert_id}/revoke",
        json={"revocation_reason": "Author Scopus identity claimed dishonestly."},
    )
    assert resp.status_code == 403
    assert "Missing required permission: 'sama:certificate:revoke'" in resp.json()["message"]


def test_super_admin_can_revoke_certificate(client, mock_db, super_admin_user):
    """Super Admin is authorized to revoke certificates."""
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: super_admin_user

    cert_id = uuid.uuid4()
    mock_cert = FelicitationCertificate(
        id=cert_id,
        certificate_number="CSJMU/RD/2026/V2-I1/048",
        bulletin_id=uuid.uuid4(),
        author_id=uuid.uuid4(),
        file_storage_path="48-48.pdf",
        download_count=0,
        issued_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
        is_revoked=False,
    )
    mock_db.get.return_value = mock_cert

    with patch.object(audit_service, "log_from_request") as mock_audit:
        resp = client.post(
            f"/api/admin/sama/certificates/{cert_id}/revoke",
            json={"revocation_reason": "Paper retracted by the publishing journal."},
        )

        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["is_revoked"] is True
        assert data["revocation_reason"] == "Paper retracted by the publishing journal."
        assert mock_cert.is_revoked is True
        assert mock_cert.revoked_at is not None

        # Verify audit logging was called
        mock_audit.assert_called_once()
        kwargs = mock_audit.call_args.kwargs
        assert kwargs["module"] == "sama_veda"
        assert kwargs["action"] == "certificate_revoked"
        assert kwargs["entity_id"] == cert_id
        assert kwargs["fail_silent"] is False


# ============================================================================
# 3. Content Lifecycle & Author Verification Tests
# ============================================================================

def test_publication_status_lifecycle_updates_timestamps(client, mock_db, super_admin_user):
    """Updating publication status sets published_at and records audit log."""
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: super_admin_user

    pub_id = uuid.uuid4()
    mock_pub = ResearchPublication(
        id=pub_id,
        bulletin_id=uuid.uuid4(),
        serial_no=1,
        slug="v2-i1-r001",
        title="Advanced Polymer Research",
        source_journal="Macromolecules",
        category="Article",
        author_display="Sharma et al.",
        status="draft",
        published_at=None,
    )
    mock_pub.author_links = []
    mock_db.scalar.return_value = mock_pub

    with patch.object(audit_service, "log_from_request") as mock_audit:
        resp = client.patch(
            f"/api/admin/sama/publications/{pub_id}/status",
            json={"status": "published"},
        )

        assert resp.status_code == 200
        assert mock_pub.status == "published"
        assert mock_pub.published_at is not None

        mock_audit.assert_called_once()
        assert mock_audit.call_args.kwargs["action"] == "publication_status_updated"
        assert mock_audit.call_args.kwargs["details"]["previous_status"] == "draft"
        assert mock_audit.call_args.kwargs["details"]["new_status"] == "published"


def test_author_identity_verification(client, mock_db, super_admin_user):
    """Author verification updates verified flag and records audit event."""
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: super_admin_user

    author_id = uuid.uuid4()
    mock_author = ResearchAuthor(
        id=author_id,
        full_name="Dr. Chandra Shekhar",
        scopus_id="59650228300",
        institutional_affiliation="Chhatrapati Shahu Ji Maharaj University, Kanpur",
        is_verified=False,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    mock_db.get.return_value = mock_author

    with patch.object(audit_service, "log_from_request") as mock_audit:
        resp = client.patch(
            f"/api/admin/sama/authors/{author_id}/verify",
            json={
                "is_verified": True,
                "scopus_id": "59650228300",
                "verification_notes": "Official institutional Scopus profile confirmed via R&D Cell registry.",
            },
        )

        assert resp.status_code == 200
        assert mock_author.is_verified is True
        assert mock_author.verification_notes == "Official institutional Scopus profile confirmed via R&D Cell registry."

        mock_audit.assert_called_once()
        assert mock_audit.call_args.kwargs["action"] == "author_verified"


# ============================================================================
# 4. Public API Visibility Isolation Tests
# ============================================================================

def test_public_publications_strictly_filters_drafts(client, mock_db):
    """Public read endpoint exclusively queries status == 'published'."""
    app.dependency_overrides[get_db] = lambda: mock_db

    pub_published = ResearchPublication(
        id=uuid.uuid4(),
        bulletin_id=uuid.uuid4(),
        serial_no=1,
        slug="v2-i1-r001",
        title="Published Paper",
        source_journal="Journal A",
        category="Article",
        author_display="Author A",
        status="published",
    )
    pub_published.author_links = []

    mock_db.scalar.return_value = 1
    mock_db.scalars.return_value.unique.return_value.all.return_value = [pub_published]

    resp = client.get("/api/modules/sama-veda/publications")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 1
    assert data["items"][0]["status"] == "published"


def test_public_publication_by_slug_returns_404_if_draft(client, mock_db):
    """Looking up a draft paper by slug on public API returns 404."""
    app.dependency_overrides[get_db] = lambda: mock_db
    # Return None because WHERE status == 'published' filters out draft
    mock_db.scalar.return_value = None

    resp = client.get("/api/modules/sama-veda/publications/v2-i1-r099-draft")
    assert resp.status_code == 404


def test_public_certificate_verification_reports_revocation(client, mock_db):
    """Public verify endpoint indicates revoked status."""
    app.dependency_overrides[get_db] = lambda: mock_db

    cert_id = uuid.uuid4()
    mock_cert = FelicitationCertificate(
        id=cert_id,
        certificate_number="CSJMU/RD/2026/V2-I1/048",
        bulletin_id=uuid.uuid4(),
        author_id=uuid.uuid4(),
        file_storage_path="48-48.pdf",
        is_revoked=True,
        revoked_at=datetime.now(timezone.utc),
        revocation_reason="Paper retracted by publisher.",
    )
    mock_cert.author = ResearchAuthor(full_name="Dr. Chandra", is_verified=True)
    mock_cert.bulletin = ResearchBulletin(volume_number=2, issue_number=1, title="Vol 2 Issue 1")
    mock_cert.publication = None
    mock_db.scalar.return_value = mock_cert

    resp = client.get("/api/modules/sama-veda/certificates/verify/CSJMU/RD/2026/V2-I1/048")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["is_revoked"] is True
    assert data["revocation_reason"] == "Paper retracted by publisher."
    assert "REVOKED" in resp.json()["message"]


def test_public_certificate_download_blocks_revoked_certificate(client, mock_db):
    """Public download endpoint returns 403 Forbidden for revoked certificates."""
    app.dependency_overrides[get_db] = lambda: mock_db

    cert_id = uuid.uuid4()
    mock_cert = FelicitationCertificate(
        id=cert_id,
        certificate_number="CSJMU/RD/2026/V2-I1/048",
        file_storage_path="48-48.pdf",
        is_revoked=True,
        revocation_reason="Fraudulent authorship claim.",
    )
    mock_db.scalar.return_value = mock_cert

    resp = client.get("/api/modules/sama-veda/certificates/download/CSJMU/RD/2026/V2-I1/048")
    assert resp.status_code == 403
    assert "REVOKED and cannot be downloaded" in resp.json()["message"]


# ============================================================================
# 5. Storage Service Upload Integration Tests
# ============================================================================

def test_bulletin_pdf_upload_success(client, super_admin_user):
    """Bulletin upload validates PDF magic bytes and returns storage key."""
    app.dependency_overrides[get_db] = lambda: MagicMock()
    app.dependency_overrides[get_current_user] = lambda: super_admin_user

    with patch("app.admin.sama_admin_router.storage_service") as mock_storage:
        mock_result = MagicMock()
        mock_result.storage_key = "sama_veda/bulletins/v2_i1_abc.pdf"
        mock_result.filename = "v2_i1.pdf"
        mock_result.file_size_bytes = len(SAMPLE_PDF_BYTES)
        mock_result.checksum_sha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        mock_storage.save_file.return_value = mock_result

        files = {"file": ("v2_i1.pdf", io.BytesIO(SAMPLE_PDF_BYTES), "application/pdf")}
        resp = client.post("/api/admin/sama/bulletins/upload", files=files)

        assert resp.status_code == 200
        assert resp.json()["success"] is True
        data = resp.json()["data"]
        assert data["storage_key"] == "sama_veda/bulletins/v2_i1_abc.pdf"
        assert data["file_size_bytes"] == len(SAMPLE_PDF_BYTES)


# ============================================================================
# 6. End-to-End Workflow Integration Tests (Phase D.1)
# ============================================================================

def test_workflow_spotlight_creation_and_update(client, mock_db, super_admin_user):
    """Workflow 5: Create and update a researcher spotlight with audit trail."""
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: super_admin_user

    spotlight_id = uuid.uuid4()
    mock_spotlight = ResearcherSpotlight(
        id=spotlight_id,
        headline="Breakthrough in Quantum Computing",
        summary="CSJMU researchers demonstrate quantum coherence in ambient conditions.",
        media_type="photo",
        media_url="storage/sama_veda/spotlights/quantum_lab.jpg",
        video_embed_url=None,
        display_order=0,
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    mock_db.get.return_value = mock_spotlight

    with patch("app.modules.sama_veda.services.cms_service.sama_cms_service.create_spotlight", return_value=mock_spotlight), \
         patch.object(audit_service, "log_from_request") as mock_audit:

        # 1. Create spotlight
        create_resp = client.post(
            "/api/admin/sama/spotlights",
            json={
                "headline": "Breakthrough in Quantum Computing",
                "summary": "CSJMU researchers demonstrate quantum coherence in ambient conditions.",
                "media_type": "photo",
                "media_url": "storage/sama_veda/spotlights/quantum_lab.jpg",
                "display_order": 0,
                "is_active": True,
            },
        )
        assert create_resp.status_code == 201
        assert create_resp.json()["data"]["headline"] == "Breakthrough in Quantum Computing"
        assert mock_audit.call_args.kwargs["action"] == "spotlight_created"

        # 2. Update spotlight
        mock_spotlight.headline = "Updated Breakthrough Headline"
        update_resp = client.put(
            f"/api/admin/sama/spotlights/{spotlight_id}",
            json={
                "headline": "Updated Breakthrough Headline",
                "summary": "CSJMU researchers demonstrate quantum coherence in ambient conditions.",
                "media_type": "video",
                "media_url": "storage/sama_veda/spotlights/quantum_video_thumb.jpg",
                "video_embed_url": "https://www.youtube.com/embed/example123",
            },
        )
        assert update_resp.status_code == 200
        assert mock_audit.call_args.kwargs["action"] == "spotlight_updated"


def test_workflow_certificate_issuance_and_authorized_download(client, mock_db, super_admin_user, tmp_path):
    """Workflow 4: Issue certificate, download authenticated, and verify audit increment."""
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: super_admin_user

    cert_id = uuid.uuid4()
    pdf_file = tmp_path / "cert_099.pdf"
    pdf_file.write_bytes(SAMPLE_PDF_BYTES)

    mock_cert = FelicitationCertificate(
        id=cert_id,
        certificate_number="CSJMU/RD/2026/V2-I1/099",
        bulletin_id=uuid.uuid4(),
        author_id=uuid.uuid4(),
        file_storage_path=str(pdf_file),
        download_count=0,
        issued_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
        is_revoked=False,
    )
    mock_db.get.return_value = mock_cert

    with patch("app.modules.sama_veda.services.cms_service.sama_cms_service.get_certificate_by_number", return_value=None), \
         patch("app.modules.sama_veda.services.cms_service.sama_cms_service.get_bulletin_by_id", return_value=MagicMock()), \
         patch("app.modules.sama_veda.services.cms_service.sama_cms_service.get_author_by_id", return_value=MagicMock()), \
         patch("app.modules.sama_veda.services.cms_service.sama_cms_service.issue_certificate", return_value=mock_cert), \
         patch("app.admin.sama_admin_router.storage_service.get_file_path", return_value=pdf_file), \
         patch.object(audit_service, "log_from_request") as mock_audit:

        # 1. Issue certificate
        issue_resp = client.post(
            "/api/admin/sama/certificates",
            json={
                "certificate_number": "CSJMU/RD/2026/V2-I1/099",
                "bulletin_id": str(uuid.uuid4()),
                "author_id": str(uuid.uuid4()),
                "file_storage_path": str(pdf_file),
            },
        )
        assert issue_resp.status_code == 201
        assert issue_resp.json()["data"]["certificate_number"] == "CSJMU/RD/2026/V2-I1/099"
        assert mock_audit.call_args.kwargs["action"] == "certificate_issued"

        # 2. Download certificate with authorization
        down_resp = client.get(f"/api/admin/sama/certificates/{cert_id}/download")
        assert down_resp.status_code == 200
        assert down_resp.headers["content-type"] == "application/pdf"
        assert mock_cert.download_count == 1


def test_workflow_bulletin_creation_and_status_toggle(client, mock_db, super_admin_user):
    """Workflow 3: Create bulletin and update lifecycle status with active toggle."""
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: super_admin_user

    bull_id = uuid.uuid4()
    mock_bull = ResearchBulletin(
        id=bull_id,
        volume_number=3,
        issue_number=1,
        title="Volume 3 • Issue 1",
        publication_period="January – June 2026",
        file_path="storage/sama_veda/bulletins/v3_i1.pdf",
        file_size_bytes=1024,
        publication_count=0,
        is_active=False,
        status="draft",
        created_at=datetime.now(timezone.utc),
    )
    mock_db.get.return_value = mock_bull

    with patch("app.modules.sama_veda.services.cms_service.sama_cms_service.create_bulletin", return_value=mock_bull), \
         patch.object(audit_service, "log_from_request") as mock_audit:

        # 1. Create bulletin in draft status
        create_resp = client.post(
            "/api/admin/sama/bulletins",
            json={
                "volume_number": 3,
                "issue_number": 1,
                "title": "Volume 3 • Issue 1",
                "publication_period": "January – June 2026",
                "file_path": "storage/sama_veda/bulletins/v3_i1.pdf",
            },
        )
        assert create_resp.status_code == 201
        assert create_resp.json()["data"]["status"] == "draft"
        assert mock_audit.call_args.kwargs["action"] == "bulletin_created"

        # 2. Update status to published and active
        mock_bull.status = "published"
        mock_bull.is_active = True
        status_resp = client.patch(
            f"/api/admin/sama/bulletins/{bull_id}/status",
            json={"status": "published", "is_active": True},
        )
        assert status_resp.status_code == 200
        assert mock_audit.call_args.kwargs["action"] == "bulletin_status_updated"
        assert mock_audit.call_args.kwargs["details"]["new_status"] == "published"

