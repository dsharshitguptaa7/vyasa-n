"""
API and RBAC Integration Tests for VYASAⁿ AI Knowledge Centre Phase 3.

Covers:
1. SADMIN Authorization Enforcement:
   - Super Admin can upload, inspect, approve, reject, archive, and retry.
   - Faculty, Dean, and unauthenticated callers are rejected with 401/403.
2. Complete Document Lifecycle API:
   - Upload (PDF, DOCX, PPTX, TXT)
   - Validation failures and duplicate detection (409)
   - Storage failure & DB rollback cleanup
   - Pagination, search, and domain/status filtering
   - Approval of fully parsed documents
   - Rejection of failed or incomplete extractions
   - Mandatory rejection reason enforcement (422 on empty reason)
   - Historical versioning and previous active version preservation
   - Document archiving
   - Failed document retry
   - Streaming downloads with SADMIN authorization
3. Zero Bulletin Regression
"""

from datetime import datetime, timezone
import hashlib
import io
from pathlib import Path
from unittest.mock import MagicMock, patch
import uuid
import zipfile
import pytest

from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.models.base import Base
from app.models.role import Role
from app.models.user import User
from app.core.database import get_db as core_get_db
from app.core.storage import storage_service, LocalStorageProvider
from app.api.dependencies import get_db as api_get_db, get_current_user, require_sadmin, require_super_admin_user
from app.modules.knowledge_centre.models import (
    AiKnowledgeDocument,
    AiKnowledgeDocumentVersion,
    AiKnowledgeChunk,
    KnowledgeDocumentStatus,
    KnowledgeApprovalStatus,
    KnowledgeExtractionStatus,
    KnowledgeVerificationStatus,
)
from app.modules.knowledge_centre.service import knowledge_service


# =============================================================================
# Test Fixtures
# =============================================================================

SAMPLE_PDF = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"
SAMPLE_TXT = b"CSJMU Institutional Policy 2026.\nSection 1: General provisions for scholars."


def make_valid_docx() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
        zf.writestr("word/document.xml", '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Ordinance</w:t></w:r></w:p></w:body></w:document>')
    return buf.getvalue()


@pytest.fixture(autouse=True)
def mock_bg_tasks():
    """Prevents background workers from attempting live DB connections during test runs."""
    with patch("app.modules.knowledge_centre.router.run_background_extraction") as m:
        yield m


@pytest.fixture
def mock_db_engine(tmp_path):
    """File-backed SQLite database ensuring multi-thread session persistence."""
    db_file = tmp_path / "test_knowledge_api.db"
    engine = create_engine(
        f"sqlite:///{db_file}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def mock_db_session(mock_db_engine):
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False, bind=mock_db_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def sadmin_user_obj(mock_db_session):
    role = Role(id=uuid.uuid4(), name="super_admin")
    mock_db_session.add(role)
    user = User(
        id=uuid.uuid4(),
        email="sadmin@csjmu.ac.in",
        first_name="Super",
        last_name="Administrator",
        is_active=True,
    )
    user.roles = [role]
    mock_db_session.add(user)
    mock_db_session.commit()
    return user


@pytest.fixture
def faculty_user_obj(mock_db_session):
    role = Role(id=uuid.uuid4(), name="faculty")
    mock_db_session.add(role)
    user = User(
        id=uuid.uuid4(),
        email="faculty@csjmu.ac.in",
        first_name="Faculty",
        last_name="Member",
        is_active=True,
    )
    user.roles = [role]
    mock_db_session.add(user)
    mock_db_session.commit()
    return user


@pytest.fixture
def dean_user_obj(mock_db_session):
    role = Role(id=uuid.uuid4(), name="dean")
    mock_db_session.add(role)
    user = User(
        id=uuid.uuid4(),
        email="dean@csjmu.ac.in",
        first_name="Dean",
        last_name="Academics",
        is_active=True,
    )
    user.roles = [role]
    mock_db_session.add(user)
    mock_db_session.commit()
    return user


@pytest.fixture
def client_factory(mock_db_engine, tmp_path):
    """Creates a TestClient with overridden get_db and LocalStorageProvider."""
    provider = LocalStorageProvider(base_dir=tmp_path / "storage")
    storage_service.set_provider(provider)

    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False, bind=mock_db_engine)

    def _make_client(user_override=None):
        def _get_test_db():
            db = TestingSessionLocal()
            try:
                yield db
            finally:
                db.close()

        def _get_test_user():
            if user_override is None:
                from fastapi import HTTPException
                raise HTTPException(status_code=401, detail="Missing or invalid Authorization header. Bearer token required.")
            from sqlalchemy import select
            from sqlalchemy.orm import joinedload
            db = TestingSessionLocal()
            try:
                stmt = select(User).options(joinedload(User.roles)).where(User.id == user_override.id)
                u = db.execute(stmt).unique().scalar_one_or_none()
                return u
            finally:
                db.close()

        app.dependency_overrides[core_get_db] = _get_test_db
        app.dependency_overrides[api_get_db] = _get_test_db
        app.dependency_overrides[get_current_user] = _get_test_user
        app.dependency_overrides.pop(require_sadmin, None)
        app.dependency_overrides.pop(require_super_admin_user, None)

        return TestClient(app)

    yield _make_client

    app.dependency_overrides.clear()
    storage_service.reset_provider()


# =============================================================================
# 1. RBAC and Endpoint Security Tests
# =============================================================================

class TestKnowledgeCentreRBAC:
    """Verifies that non-SADMIN and unauthenticated callers are rejected."""

    def test_unauthenticated_blocked(self, client_factory):
        client = client_factory(user_override=None)
        resp = client.get("/api/v1/admin/knowledge-centre/dashboard/stats")
        assert resp.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)

    def test_faculty_blocked(self, client_factory, faculty_user_obj):
        client = client_factory(user_override=faculty_user_obj)
        resp = client.get("/api/v1/admin/knowledge-centre/dashboard/stats")
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_dean_blocked(self, client_factory, dean_user_obj):
        client = client_factory(user_override=dean_user_obj)
        resp = client.get("/api/v1/admin/knowledge-centre/dashboard/stats")
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_sadmin_access_granted(self, client_factory, sadmin_user_obj):
        client = client_factory(user_override=sadmin_user_obj)
        resp = client.get("/api/v1/admin/knowledge-centre/dashboard/stats")
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()["data"]
        assert "total_documents" in data
        assert "published_documents" in data
        assert "total_passages" in data


# =============================================================================
# 2. Upload, Ingestion, and Lifecycle Tests
# =============================================================================

class TestDocumentUploadAndLifecycle:
    """Tests document intake, parsing, versioning, approval, rejection, and archiving."""

    def test_upload_pdf_success(self, client_factory, sadmin_user_obj):
        client = client_factory(user_override=sadmin_user_obj)
        files = {"file": ("academic_regulations_2026.pdf", SAMPLE_PDF, "application/pdf")}
        data = {
            "title": "Academic Regulations Manual 2026-27",
            "domain": "academic-regulations",
            "document_type": "manual",
            "academic_session": "2026-27",
            "issuing_authority": "Academic Council",
        }
        resp = client.post("/api/v1/admin/knowledge-centre/documents/upload", files=files, data=data)
        assert resp.status_code == status.HTTP_201_CREATED
        res_data = resp.json()["data"]
        assert res_data["document_id"]
        assert res_data["version_number"] == 1
        assert "vyasa-knowledge/academic-regulations" in res_data["storage_key"]
        assert res_data["checksum_sha256"] == hashlib.sha256(SAMPLE_PDF).hexdigest()

    def test_upload_docx_success(self, client_factory, sadmin_user_obj):
        client = client_factory(user_override=sadmin_user_obj)
        docx_bytes = make_valid_docx()
        files = {"file": ("phd_ordinance.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
        data = {
            "title": "Ph.D. Ordinance 2024-25",
            "domain": "doctoral-studies",
            "document_type": "ordinance",
        }
        resp = client.post("/api/v1/admin/knowledge-centre/documents/upload", files=files, data=data)
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.json()["data"]["version_number"] == 1

    def test_duplicate_upload_rejected_with_409(self, client_factory, sadmin_user_obj):
        client = client_factory(user_override=sadmin_user_obj)
        files = {"file": ("unique_manual.pdf", SAMPLE_PDF, "application/pdf")}
        data = {
            "title": "Unique Manual",
            "domain": "admissions",
            "document_type": "brochure",
        }
        resp1 = client.post("/api/v1/admin/knowledge-centre/documents/upload", files=files, data=data)
        assert resp1.status_code == status.HTTP_201_CREATED

        # Duplicate attempt with identical bytes
        files2 = {"file": ("copy_manual.pdf", SAMPLE_PDF, "application/pdf")}
        resp2 = client.post("/api/v1/admin/knowledge-centre/documents/upload", files=files2, data=data)
        assert resp2.status_code == status.HTTP_409_CONFLICT
        err_msg = resp2.json().get("message") or resp2.json().get("detail", "")
        assert "already exists" in err_msg

    def test_empty_file_rejected(self, client_factory, sadmin_user_obj):
        client = client_factory(user_override=sadmin_user_obj)
        files = {"file": ("empty.pdf", b"", "application/pdf")}
        data = {"title": "Empty File", "domain": "admissions", "document_type": "policy"}
        resp = client.post("/api/v1/admin/knowledge-centre/documents/upload", files=files, data=data)
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_user_reported_phd_ordinance_docx_upload_success(self, client_factory, sadmin_user_obj):
        """
        Regression test covering the exact scenario reported by the user:
        - File: 'Ph.D. Ordinance CSJMU FINAL 2024-25 25.8.2-25.docx'
        - MIME: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        - Knowledge Domain: 'academic-regulations'
        - Document Type: 'ordinance'
        - Academic Session: '2026-27'
        - Description: populated
        - Optional date fields: submitted as empty strings
        """
        client = client_factory(user_override=sadmin_user_obj)
        docx_bytes = make_valid_docx()
        files = {
            "file": (
                "Ph.D. Ordinance CSJMU FINAL 2024-25 25.8.2-25.docx",
                docx_bytes,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        }
        data = {
            "title": "Ph.D. Ordinance CSJMU FINAL 2024-25",
            "domain": "academic-regulations",
            "document_type": "ordinance",
            "academic_session": "2026-27",
            "description": "Comprehensive Ph.D. research ordinance and guidelines for faculty and scholars.",
            "effective_from": "",
            "effective_until": "",
        }
        resp = client.post("/api/v1/admin/knowledge-centre/documents/upload", files=files, data=data)
        assert resp.status_code == status.HTTP_201_CREATED
        res_data = resp.json()["data"]
        assert res_data["document_id"]
        assert res_data["version_number"] == 1
        assert "vyasa-knowledge/academic-regulations" in res_data["storage_key"]
        assert res_data["checksum_sha256"] == hashlib.sha256(docx_bytes).hexdigest()

    def test_upload_invalid_academic_session_rejected_with_422(self, client_factory, sadmin_user_obj):
        client = client_factory(user_override=sadmin_user_obj)
        files = {"file": ("sample.pdf", SAMPLE_PDF, "application/pdf")}
        data = {
            "title": "Invalid Session Doc",
            "domain": "academic-regulations",
            "document_type": "ordinance",
            "academic_session": "2026/2027",
        }
        resp = client.post("/api/v1/admin/knowledge-centre/documents/upload", files=files, data=data)
        assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        body = resp.json()
        error_text = body.get("message", "") or str(body.get("error", ""))
        assert "Academic session must be in the format YYYY-YY or YYYY-YYYY" in error_text

    def test_upload_invalid_document_type_rejected_with_422(self, client_factory, sadmin_user_obj):
        client = client_factory(user_override=sadmin_user_obj)
        files = {"file": ("sample.pdf", SAMPLE_PDF, "application/pdf")}
        data = {
            "title": "Invalid Type Doc",
            "domain": "academic-regulations",
            "document_type": "invalid_type",
        }
        resp = client.post("/api/v1/admin/knowledge-centre/documents/upload", files=files, data=data)
        assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        body = resp.json()
        error_text = body.get("message", "") or str(body.get("error", ""))
        assert "Invalid document type 'invalid_type'" in error_text

    def test_upload_invalid_domain_rejected_with_422(self, client_factory, sadmin_user_obj):
        client = client_factory(user_override=sadmin_user_obj)
        files = {"file": ("sample.pdf", SAMPLE_PDF, "application/pdf")}
        data = {
            "title": "Invalid Domain Doc",
            "domain": "non_existent_domain",
            "document_type": "policy",
        }
        resp = client.post("/api/v1/admin/knowledge-centre/documents/upload", files=files, data=data)
        assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        body = resp.json()
        error_text = body.get("message", "") or str(body.get("error", ""))
        assert "Invalid knowledge domain 'non_existent_domain'" in error_text

    def test_upload_missing_title_rejected_with_422(self, client_factory, sadmin_user_obj):
        client = client_factory(user_override=sadmin_user_obj)
        files = {"file": ("sample.pdf", SAMPLE_PDF, "application/pdf")}
        data = {
            "title": "   ",
            "domain": "admissions",
            "document_type": "policy",
        }
        resp = client.post("/api/v1/admin/knowledge-centre/documents/upload", files=files, data=data)
        assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        body = resp.json()
        error_text = body.get("message", "") or str(body.get("error", ""))
        assert "Document title is mandatory" in error_text

    def test_upload_empty_optional_fields_succeeds(self, client_factory, sadmin_user_obj):
        """Verifies empty strings submitted for optional fields do not fail datetime/string validation."""
        client = client_factory(user_override=sadmin_user_obj)
        unique_pdf = SAMPLE_PDF + b"% empty optional test\n"
        files = {"file": ("empty_optional.pdf", unique_pdf, "application/pdf")}
        data = {
            "title": "Clean Optional Fields Doc",
            "domain": "doctoral-studies",
            "document_type": "guideline",
            "description": "",
            "subdomain": "",
            "academic_session": "",
            "issuing_authority": "",
            "effective_from": "",
            "effective_until": "",
        }
        resp = client.post("/api/v1/admin/knowledge-centre/documents/upload", files=files, data=data)
        assert resp.status_code == status.HTTP_201_CREATED
        res_data = resp.json()["data"]
        assert res_data["version_number"] == 1

    def test_storage_cleanup_on_db_failure(self, mock_db_session, sadmin_user_obj, tmp_path):
        """Verifies that if the database transaction fails, the uploaded storage file is deleted."""
        provider = LocalStorageProvider(base_dir=tmp_path)
        storage_service.set_provider(provider)

        test_bytes = SAMPLE_PDF + b"% unique bytes for cleanup test\n"

        # Force a database failure during create_document by passing mock session that raises on flush
        broken_db = MagicMock()
        broken_db.execute.return_value.scalars.return_value.first.return_value = None
        broken_db.flush.side_effect = RuntimeError("Simulated Database Crash")

        with pytest.raises(RuntimeError):
            knowledge_service.create_document(
                db=broken_db,
                title="Crash Test",
                domain="admissions",
                document_type="policy",
                filename="crash_test.pdf",
                file_bytes=test_bytes,
                uploaded_by=sadmin_user_obj,
            )

        # Storage directory must have zero orphaned files
        knowledge_files = list((tmp_path / "vyasa-knowledge" / "admissions").glob("*"))
        assert len(knowledge_files) == 0

    def test_list_and_filter_documents(self, client_factory, sadmin_user_obj, mock_db_session):
        client = client_factory(user_override=sadmin_user_obj)

        # Ingest 2 distinct documents
        client.post(
            "/api/v1/admin/knowledge-centre/documents/upload",
            files={"file": ("doc_a.pdf", SAMPLE_PDF + b"1", "application/pdf")},
            data={"title": "Admissions Guidelines", "domain": "admissions", "document_type": "brochure"},
        )
        client.post(
            "/api/v1/admin/knowledge-centre/documents/upload",
            files={"file": ("doc_b.pdf", SAMPLE_PDF + b"2", "application/pdf")},
            data={"title": "Doctoral Guidelines", "domain": "doctoral-studies", "document_type": "ordinance"},
        )

        # Filter by domain
        resp_adm = client.get("/api/v1/admin/knowledge-centre/documents?domain=admissions")
        assert resp_adm.status_code == status.HTTP_200_OK
        data_adm = resp_adm.json()["data"]
        assert data_adm["total"] == 1
        assert data_adm["items"][0]["domain"] == "admissions"

        # Search filter
        resp_search = client.get("/api/v1/admin/knowledge-centre/documents?search=Doctoral")
        assert resp_search.status_code == status.HTTP_200_OK
        data_search = resp_search.json()["data"]
        assert data_search["total"] == 1
        assert "Doctoral" in data_search["items"][0]["title"]

    def test_document_detail_and_versions(self, client_factory, sadmin_user_obj):
        client = client_factory(user_override=sadmin_user_obj)
        up_resp = client.post(
            "/api/v1/admin/knowledge-centre/documents/upload",
            files={"file": ("detail_test.pdf", SAMPLE_PDF + b"detail", "application/pdf")},
            data={"title": "Detail Test Manual", "domain": "university-administration", "document_type": "manual"},
        )
        doc_id = up_resp.json()["data"]["document_id"]

        detail_resp = client.get(f"/api/v1/admin/knowledge-centre/documents/{doc_id}")
        assert detail_resp.status_code == status.HTTP_200_OK
        d_data = detail_resp.json()["data"]
        assert d_data["document"]["id"] == doc_id
        assert len(d_data["versions"]) == 1

        versions_resp = client.get(f"/api/v1/admin/knowledge-centre/documents/{doc_id}/versions")
        assert versions_resp.status_code == status.HTTP_200_OK
        assert len(versions_resp.json()["data"]) == 1

    def test_approval_workflow_requires_successful_extraction(self, client_factory, sadmin_user_obj, mock_db_session):
        client = client_factory(user_override=sadmin_user_obj)
        up_resp = client.post(
            "/api/v1/admin/knowledge-centre/documents/upload",
            files={"file": ("approval_test.pdf", SAMPLE_PDF + b"appr", "application/pdf")},
            data={"title": "Approval Test", "domain": "research-development", "document_type": "policy"},
        )
        doc_id = uuid.UUID(up_resp.json()["data"]["document_id"])
        ver_id = uuid.UUID(up_resp.json()["data"]["version_id"])

        # Attempting approval while extraction is still PENDING must fail (400)
        appr_fail = client.post(f"/api/v1/admin/knowledge-centre/documents/{doc_id}/approve", json={"version_id": str(ver_id)})
        assert appr_fail.status_code == status.HTTP_400_BAD_REQUEST

        # Mark extraction successful
        knowledge_service.record_extraction_success(mock_db_session, doc_id, ver_id, chunks_count=10)
        mock_db_session.commit()

        # Approval must now succeed
        appr_ok = client.post(f"/api/v1/admin/knowledge-centre/documents/{doc_id}/approve", json={"version_id": str(ver_id)})
        assert appr_ok.status_code == status.HTTP_200_OK
        assert appr_ok.json()["data"]["status"] == "active"

    def test_rejection_requires_mandatory_reason(self, client_factory, sadmin_user_obj):
        client = client_factory(user_override=sadmin_user_obj)
        up_resp = client.post(
            "/api/v1/admin/knowledge-centre/documents/upload",
            files={"file": ("reject_test.pdf", SAMPLE_PDF + b"rej", "application/pdf")},
            data={"title": "Rejection Test", "domain": "doctoral-studies", "document_type": "manual"},
        )
        doc_id = up_resp.json()["data"]["document_id"]

        # Missing reason
        rej_empty = client.post(f"/api/v1/admin/knowledge-centre/documents/{doc_id}/reject", json={"reason": ""})
        assert rej_empty.status_code in (status.HTTP_422_UNPROCESSABLE_ENTITY, status.HTTP_400_BAD_REQUEST)

        # Valid reason
        rej_ok = client.post(f"/api/v1/admin/knowledge-centre/documents/{doc_id}/reject", json={"reason": "Contains expired calendar schedules."})
        assert rej_ok.status_code == status.HTTP_200_OK
        assert rej_ok.json()["data"]["status"] == "rejected"

    def test_archive_published_document(self, client_factory, sadmin_user_obj, mock_db_session):
        client = client_factory(user_override=sadmin_user_obj)
        up_resp = client.post(
            "/api/v1/admin/knowledge-centre/documents/upload",
            files={"file": ("archive_test.pdf", SAMPLE_PDF + b"arch", "application/pdf")},
            data={"title": "Archive Test", "domain": "academic-regulations", "document_type": "policy"},
        )
        doc_id = uuid.UUID(up_resp.json()["data"]["document_id"])
        ver_id = uuid.UUID(up_resp.json()["data"]["version_id"])

        knowledge_service.record_extraction_success(mock_db_session, doc_id, ver_id, chunks_count=5)
        knowledge_service.approve_version(mock_db_session, doc_id, ver_id, approving_user=sadmin_user_obj)
        mock_db_session.commit()

        # Archive document
        arch_resp = client.post(f"/api/v1/admin/knowledge-centre/documents/{doc_id}/archive")
        assert arch_resp.status_code == status.HTTP_200_OK
        assert arch_resp.json()["data"]["status"] == "archived"

    def test_new_version_preserves_previous_active_version(self, client_factory, sadmin_user_obj, mock_db_session):
        client = client_factory(user_override=sadmin_user_obj)

        # 1. Upload and approve v1
        up_v1 = client.post(
            "/api/v1/admin/knowledge-centre/documents/upload",
            files={"file": ("v1.pdf", SAMPLE_PDF + b"version1", "application/pdf")},
            data={"title": "Versioned Brochure", "domain": "admissions", "document_type": "brochure"},
        )
        doc_id = uuid.UUID(up_v1.json()["data"]["document_id"])
        v1_id = uuid.UUID(up_v1.json()["data"]["version_id"])

        knowledge_service.record_extraction_success(mock_db_session, doc_id, v1_id, chunks_count=12)
        knowledge_service.approve_version(mock_db_session, doc_id, v1_id, approving_user=sadmin_user_obj)
        mock_db_session.commit()

        # 2. Upload v2
        up_v2 = client.post(
            f"/api/v1/admin/knowledge-centre/documents/{doc_id}/versions",
            files={"file": ("v2.pdf", SAMPLE_PDF + b"version2", "application/pdf")},
        )
        assert up_v2.status_code == status.HTTP_201_CREATED
        v2_id = uuid.UUID(up_v2.json()["data"]["version_id"])
        assert up_v2.json()["data"]["version_number"] == 2

        # Prior version v1 must remain the active version in database!
        check_doc = mock_db_session.get(AiKnowledgeDocument, doc_id)
        assert check_doc.status == "active"
        assert check_doc.current_version_id == v1_id

        # 3. Approve v2
        knowledge_service.record_extraction_success(mock_db_session, doc_id, v2_id, chunks_count=18)
        mock_db_session.commit()
        app_resp = client.post(f"/api/v1/admin/knowledge-centre/documents/{doc_id}/approve", json={"version_id": str(v2_id)})
        assert app_resp.status_code == status.HTTP_200_OK

        # Now active version swaps to v2
        mock_db_session.refresh(check_doc)
        assert check_doc.current_version_id == v2_id

    def test_download_streaming_authorized(self, client_factory, sadmin_user_obj):
        client = client_factory(user_override=sadmin_user_obj)
        up_resp = client.post(
            "/api/v1/admin/knowledge-centre/documents/upload",
            files={"file": ("stream_test.txt", SAMPLE_TXT, "text/plain")},
            data={"title": "Stream Policy", "domain": "admissions", "document_type": "policy"},
        )
        doc_id = up_resp.json()["data"]["document_id"]

        dl_resp = client.get(f"/api/v1/admin/knowledge-centre/documents/{doc_id}/download")
        assert dl_resp.status_code == status.HTTP_200_OK
        assert dl_resp.content == SAMPLE_TXT
        assert "stream_test.txt" in dl_resp.headers.get("content-disposition", "")

    def test_retry_failed_document(self, client_factory, sadmin_user_obj, mock_db_session):
        client = client_factory(user_override=sadmin_user_obj)
        up_resp = client.post(
            "/api/v1/admin/knowledge-centre/documents/upload",
            files={"file": ("retry_me.pdf", SAMPLE_PDF + b"retry", "application/pdf")},
            data={"title": "Retry Test", "domain": "admissions", "document_type": "brochure"},
        )
        doc_id = uuid.UUID(up_resp.json()["data"]["document_id"])
        ver_id = uuid.UUID(up_resp.json()["data"]["version_id"])

        # Mark extraction failed
        knowledge_service.record_extraction_failure(mock_db_session, doc_id, ver_id, "Simulated Parser Crash")
        mock_db_session.commit()

        # Call retry endpoint
        retry_resp = client.post(f"/api/v1/admin/knowledge-centre/documents/{doc_id}/retry", json={"version_id": str(ver_id)})
        assert retry_resp.status_code == status.HTTP_200_OK
        assert retry_resp.json()["data"]["status"] == "processing"
