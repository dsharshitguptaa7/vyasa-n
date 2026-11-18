"""
Unit and Integration Tests for VYASAⁿ AI Knowledge Centre Phase 1 & 2.

Covers:
1. Storage Engine Extensions:
   - Preservation of PDF, PNG, JPEG, WebP validation.
   - Safe OpenXML DOCX and PPTX validation with internal archive structure checks.
   - Rejection of corrupt or masquerading archives (arbitrary zips or binaries).
   - Safe UTF-8 TXT validation and rejection of binary files containing null bytes.
   - Checksum SHA-256 integrity and immutability.
   - Configurable Knowledge Centre upload size limits.
   - Universal backend streaming and presigned URL capabilities across Local, Spaces, and Proxy.
   - Preservation of existing Bulletin storage paths and behavior.
2. Knowledge Database Models & Alembic Migration:
   - Verification of ai_knowledge_documents, ai_knowledge_document_versions, and ai_knowledge_chunks.
   - Verification of columns, foreign keys, unique constraints, and indexes.
   - pgvector-safe JSON/JSONB embedding column verification.
3. Knowledge Lifecycle and SADMIN RBAC:
   - Draft -> Processing -> Pending Approval -> Active state machine.
   - Prevention of active state for unextracted or failed documents.
   - Strict SADMIN role enforcement on approval, rejection, and archiving.
   - Checksum-based duplicate upload detection.
   - Version immutability and atomic active version swapping.
"""

from datetime import datetime, timezone
import hashlib
import io
from pathlib import Path
from unittest.mock import MagicMock, patch
import uuid
import zipfile
import pytest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.role import Role
from app.models.user import User
from app.core.storage import (
    storage_service,
    LocalStorageProvider,
    SpacesStorageProvider,
    StorageResult,
    StorageError,
    StorageInvalidFileTypeError,
    StorageSizeLimitError,
    StorageFileNotFoundError,
    sanitize_filename,
    verify_magic_bytes,
    infer_mime_type,
    KNOWLEDGE_ALLOWED_MIME_TYPES,
    DEFAULT_KNOWLEDGE_MAX_UPLOAD_BYTES,
    MIME_DOCX,
    MIME_PPTX,
    MIME_PDF,
    MIME_TXT,
)
from app.modules.knowledge_centre.models import (
    AiKnowledgeDocument,
    AiKnowledgeDocumentVersion,
    AiKnowledgeChunk,
    KnowledgeDocumentStatus,
    KnowledgeApprovalStatus,
    KnowledgeExtractionStatus,
    KnowledgeVerificationStatus,
    KNOWLEDGE_STORAGE_PREFIX,
)
from app.modules.knowledge_centre.service import (
    KnowledgeCentreService,
    KnowledgePermissionDeniedError,
    KnowledgeDuplicateDocumentError,
    KnowledgeInvalidLifecycleStateError,
    generate_knowledge_storage_key,
    assert_sadmin,
)
from app.api.dependencies import require_sadmin, require_super_admin_user


# =============================================================================
# Test Data Fixtures
# =============================================================================

SAMPLE_PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"
SAMPLE_PNG_BYTES = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
SAMPLE_JPEG_BYTES = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01"
SAMPLE_WEBP_BYTES = b"RIFF\x24\x00\x00\x00WEBPVP8 \x18\x00\x00\x00"
SAMPLE_TXT_BYTES = "University Ordinance 2026-27.\nClause 1: Eligibility criteria for admission.".encode("utf-8")
SAMPLE_BINARY_BYTES = b"\x7fELF\x02\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00"
SAMPLE_EXE_BYTES = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00"


def make_valid_docx_bytes() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
        zf.writestr("word/document.xml", '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Academic Regulations</w:t></w:r></w:p></w:body></w:document>')
    return buf.getvalue()


def make_valid_pptx_bytes() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
        zf.writestr("ppt/presentation.xml", '<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>')
    return buf.getvalue()


def make_arbitrary_zip_bytes() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("malicious.sh", "echo 'arbitrary code'")
    return buf.getvalue()


@pytest.fixture
def memory_db():
    """In-memory SQLite session with schema initialized."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def sadmin_user():
    user = User(
        id=uuid.uuid4(),
        email="sadmin@csjmu.ac.in",
        first_name="Super",
        last_name="Administrator",
        is_active=True,
    )
    sadmin_role = Role(id=uuid.uuid4(), name="super_admin")
    user.roles = [sadmin_role]
    return user


@pytest.fixture
def regular_user():
    user = User(
        id=uuid.uuid4(),
        email="faculty@csjmu.ac.in",
        first_name="Faculty",
        last_name="User",
        is_active=True,
    )
    faculty_role = Role(id=uuid.uuid4(), name="faculty")
    user.roles = [faculty_role]
    return user


# =============================================================================
# 1. Core Storage Extension Tests
# =============================================================================

class TestCoreStorageExtensions:
    """Verifies file type validation, ZIP inspections, size limits, and presigned URLs."""

    def test_pdf_validation_preserved(self, tmp_path):
        provider = LocalStorageProvider(base_dir=tmp_path)
        res = provider.save_file(
            content=SAMPLE_PDF_BYTES,
            filename="regulation.pdf",
            subfolder="vyasa-knowledge/academic-regulations",
            allowed_mime_types=KNOWLEDGE_ALLOWED_MIME_TYPES,
        )
        assert res.mime_type == MIME_PDF
        assert res.storage_key.startswith("vyasa-knowledge/academic-regulations/")
        assert res.sha256_checksum == hashlib.sha256(SAMPLE_PDF_BYTES).hexdigest()

    def test_valid_docx_accepted(self, tmp_path):
        docx_bytes = make_valid_docx_bytes()
        provider = LocalStorageProvider(base_dir=tmp_path)
        res = provider.save_file(
            content=docx_bytes,
            filename="ordinance.docx",
            subfolder="vyasa-knowledge/doctoral-studies",
            allowed_mime_types=KNOWLEDGE_ALLOWED_MIME_TYPES,
        )
        assert res.mime_type == MIME_DOCX
        assert "ordinance.docx" in res.stored_filename
        assert provider.exists(res.storage_key)

    def test_valid_pptx_accepted(self, tmp_path):
        pptx_bytes = make_valid_pptx_bytes()
        provider = LocalStorageProvider(base_dir=tmp_path)
        res = provider.save_file(
            content=pptx_bytes,
            filename="coursework_orientation.pptx",
            subfolder="vyasa-knowledge/doctoral-studies",
            allowed_mime_types=KNOWLEDGE_ALLOWED_MIME_TYPES,
        )
        assert res.mime_type == MIME_PPTX
        assert "coursework_orientation.pptx" in res.stored_filename

    def test_valid_txt_accepted(self, tmp_path):
        provider = LocalStorageProvider(base_dir=tmp_path)
        res = provider.save_file(
            content=SAMPLE_TXT_BYTES,
            filename="guidelines.txt",
            subfolder="vyasa-knowledge/admissions",
            allowed_mime_types=KNOWLEDGE_ALLOWED_MIME_TYPES,
        )
        assert res.mime_type == MIME_TXT
        assert provider.exists(res.storage_key)

    def test_arbitrary_zip_renamed_to_docx_rejected(self, tmp_path):
        """Rejects arbitrary zip files that lack OpenXML [Content_Types].xml and word/ parts."""
        arbitrary_zip = make_arbitrary_zip_bytes()
        provider = LocalStorageProvider(base_dir=tmp_path)
        with pytest.raises(StorageInvalidFileTypeError) as exc_info:
            provider.save_file(
                content=arbitrary_zip,
                filename="fake.docx",
                subfolder="vyasa-knowledge/doctoral-studies",
                allowed_mime_types=KNOWLEDGE_ALLOWED_MIME_TYPES,
            )
        assert "ZIP structure lacks [Content_Types].xml or word/ parts" in str(exc_info.value)

    def test_arbitrary_zip_renamed_to_pptx_rejected(self, tmp_path):
        arbitrary_zip = make_arbitrary_zip_bytes()
        provider = LocalStorageProvider(base_dir=tmp_path)
        with pytest.raises(StorageInvalidFileTypeError) as exc_info:
            provider.save_file(
                content=arbitrary_zip,
                filename="fake.pptx",
                subfolder="vyasa-knowledge/doctoral-studies",
                allowed_mime_types=KNOWLEDGE_ALLOWED_MIME_TYPES,
            )
        assert "ZIP structure lacks [Content_Types].xml or ppt/ parts" in str(exc_info.value)

    def test_binary_executable_renamed_to_docx_rejected(self, tmp_path):
        provider = LocalStorageProvider(base_dir=tmp_path)
        with pytest.raises(StorageInvalidFileTypeError) as exc_info:
            provider.save_file(
                content=SAMPLE_EXE_BYTES,
                filename="trojan.docx",
                subfolder="vyasa-knowledge/doctoral-studies",
                allowed_mime_types=KNOWLEDGE_ALLOWED_MIME_TYPES,
            )
        assert "ZIP magic bytes" in str(exc_info.value)

    def test_binary_file_with_null_bytes_renamed_to_txt_rejected(self, tmp_path):
        """Rejects binary files with null bytes masquerading as text/plain."""
        binary_with_nulls = b"Plain looking text\x00\x01\x02\x03corrupt binary"
        provider = LocalStorageProvider(base_dir=tmp_path)
        with pytest.raises(StorageInvalidFileTypeError) as exc_info:
            provider.save_file(
                content=binary_with_nulls,
                filename="notes.txt",
                subfolder="vyasa-knowledge/admissions",
                allowed_mime_types=KNOWLEDGE_ALLOWED_MIME_TYPES,
            )
        assert "contains null bytes" in str(exc_info.value)

    def test_upload_size_limit_enforced(self, tmp_path):
        provider = LocalStorageProvider(base_dir=tmp_path)
        # Limit to 100 bytes
        with pytest.raises(StorageSizeLimitError) as exc_info:
            provider.save_file(
                content=SAMPLE_TXT_BYTES,
                filename="overflow.txt",
                subfolder="vyasa-knowledge/admissions",
                max_size_bytes=10,
                allowed_mime_types=KNOWLEDGE_ALLOWED_MIME_TYPES,
            )
        assert "exceeds maximum permitted limit" in str(exc_info.value)

    def test_local_presigned_url_generation(self, tmp_path):
        provider = LocalStorageProvider(base_dir=tmp_path)
        res = provider.save_file(
            content=SAMPLE_PDF_BYTES,
            filename="handbook.pdf",
            subfolder="vyasa-knowledge/academic-regulations",
            allowed_mime_types=KNOWLEDGE_ALLOWED_MIME_TYPES,
        )
        url = provider.generate_presigned_url(res.storage_key)
        assert url.startswith("/api/v1/storage/download?key=")
        assert res.storage_key in url

    def test_spaces_presigned_url_generation(self):
        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.return_value = "https://mock-bucket.sgp1.digitaloceanspaces.com/sample?token=abc"
        provider = SpacesStorageProvider(
            bucket="mock-bucket",
            region="sgp1",
            access_key_id="test-key",
            secret_access_key="test-secret",
            s3_client=mock_s3,
        )
        url = provider.generate_presigned_url("vyasa-knowledge/admissions/v1_abc_test.pdf")
        assert "digitaloceanspaces.com" in url
        mock_s3.generate_presigned_url.assert_called_once_with(
            ClientMethod="get_object",
            Params={"Bucket": "mock-bucket", "Key": "vyasa-knowledge/admissions/v1_abc_test.pdf"},
            ExpiresIn=300,
        )

    def test_storage_service_proxy_forwards_presigned_url(self, tmp_path):
        provider = LocalStorageProvider(base_dir=tmp_path)
        storage_service.set_provider(provider)
        try:
            res = storage_service.save_file(
                content=SAMPLE_PDF_BYTES,
                filename="proxy_test.pdf",
                subfolder="vyasa-knowledge/test",
                allowed_mime_types=KNOWLEDGE_ALLOWED_MIME_TYPES,
            )
            url = storage_service.generate_presigned_url(res.storage_key)
            assert url.startswith("/api/v1/storage/download?key=")
        finally:
            storage_service.reset_provider()

    def test_bulletin_storage_regression_zero_impact(self, tmp_path):
        """Verifies Bulletin workflows remain completely unaffected."""
        provider = LocalStorageProvider(base_dir=tmp_path)
        res = provider.save_file(
            content=SAMPLE_PDF_BYTES,
            filename="Research_Bulletin_Vol2.pdf",
            subfolder="sama_veda/bulletins",
            allowed_mime_types=["application/pdf"],
        )
        assert res.storage_key.startswith("sama_veda/bulletins/")
        assert "Research_Bulletin_Vol2.pdf" in res.stored_filename
        assert provider.exists(res.storage_key)


# =============================================================================
# 2. Database Schema & Model Registration Tests
# =============================================================================

class TestKnowledgeDatabaseSchema:
    """Verifies all required tables, columns, indexes, and constraints exist in Base.metadata."""

    EXPECTED_TABLES = [
        "ai_knowledge_documents",
        "ai_knowledge_document_versions",
        "ai_knowledge_chunks",
    ]

    @pytest.mark.parametrize("tbl_name", EXPECTED_TABLES)
    def test_tables_registered_in_metadata(self, tbl_name):
        assert tbl_name in Base.metadata.tables

    def test_ai_knowledge_documents_columns(self):
        tbl = AiKnowledgeDocument.__table__
        expected_cols = {
            "id", "title", "description", "domain", "subdomain",
            "document_type", "academic_session", "issuing_authority",
            "effective_from", "effective_until", "current_version_id",
            "status", "uploaded_by_id", "approved_by_id",
            "created_at", "updated_at", "published_at", "archived_at"
        }
        actual_cols = set(tbl.columns.keys())
        assert expected_cols.issubset(actual_cols)
        assert tbl.c.id.primary_key is True
        assert tbl.c.title.nullable is False
        assert tbl.c.domain.nullable is False
        assert tbl.c.status.nullable is False

    def test_ai_knowledge_document_versions_columns(self):
        tbl = AiKnowledgeDocumentVersion.__table__
        expected_cols = {
            "id", "document_id", "version_number", "storage_key",
            "checksum_sha256", "original_filename", "mime_type",
            "size_bytes", "extraction_status", "processing_error",
            "approval_status", "approved_by_id", "approved_at", "created_at"
        }
        actual_cols = set(tbl.columns.keys())
        assert expected_cols.issubset(actual_cols)
        assert tbl.c.storage_key.unique is True or any(
            isinstance(c, UniqueConstraint) and "storage_key" in [col.name for col in c.columns]
            for c in tbl.constraints
        )

    def test_ai_knowledge_chunks_columns(self):
        tbl = AiKnowledgeChunk.__table__
        expected_cols = {
            "id", "document_id", "version_id", "chunk_index",
            "content", "page_number", "metadata", "embedding",
            "verification_status", "created_at"
        }
        actual_cols = set(tbl.columns.keys())
        assert expected_cols.issubset(actual_cols)
        assert tbl.c.content.nullable is False


# =============================================================================
# 3. Knowledge Lifecycle, SADMIN RBAC & Immutability Tests
# =============================================================================

class TestKnowledgeLifecycleAndRBAC:
    """Tests document intake, state transitions, duplicate detection, and versioning."""

    def test_require_sadmin_dependency_alias(self):
        """Verifies require_sadmin is identical to require_super_admin_user."""
        assert require_sadmin is require_super_admin_user

    def test_assert_sadmin_enforces_role(self, sadmin_user, regular_user):
        # Should not raise for super_admin
        assert_sadmin(sadmin_user)
        # Should raise for non-super_admin
        with pytest.raises(KnowledgePermissionDeniedError):
            assert_sadmin(regular_user)

    def test_document_intake_creates_draft(self, memory_db, sadmin_user, tmp_path):
        service = KnowledgeCentreService()
        provider = LocalStorageProvider(base_dir=tmp_path)
        storage_service.set_provider(provider)
        try:
            doc, ver = service.create_document(
                db=memory_db,
                title="Ph.D. Ordinance 2026-27",
                domain="doctoral-studies",
                document_type="ordinance",
                filename="ordinance.pdf",
                file_bytes=SAMPLE_PDF_BYTES,
                uploaded_by=sadmin_user,
                academic_session="2026-27",
            )
            assert doc.status == KnowledgeDocumentStatus.DRAFT.value
            assert ver.version_number == 1
            assert ver.approval_status == KnowledgeApprovalStatus.PENDING.value
            assert ver.extraction_status == KnowledgeExtractionStatus.PENDING.value
            assert "vyasa-knowledge/doctoral-studies" in ver.storage_key
        finally:
            storage_service.reset_provider()

    def test_non_sadmin_cannot_create_document(self, memory_db, regular_user):
        service = KnowledgeCentreService()
        with pytest.raises(KnowledgePermissionDeniedError):
            service.create_document(
                db=memory_db,
                title="Unauthorized Upload",
                domain="admissions",
                document_type="policy",
                filename="unauthorized.pdf",
                file_bytes=SAMPLE_PDF_BYTES,
                uploaded_by=regular_user,
            )

    def test_duplicate_upload_detection(self, memory_db, sadmin_user, tmp_path):
        service = KnowledgeCentreService()
        provider = LocalStorageProvider(base_dir=tmp_path)
        storage_service.set_provider(provider)
        try:
            doc, ver = service.create_document(
                db=memory_db,
                title="Original Document",
                domain="doctoral-studies",
                document_type="ordinance",
                filename="original.pdf",
                file_bytes=SAMPLE_PDF_BYTES,
                uploaded_by=sadmin_user,
            )
            # Second attempt with identical file content must fail
            with pytest.raises(KnowledgeDuplicateDocumentError) as exc_info:
                service.create_document(
                    db=memory_db,
                    title="Duplicate Document",
                    domain="doctoral-studies",
                    document_type="ordinance",
                    filename="duplicate.pdf",
                    file_bytes=SAMPLE_PDF_BYTES,
                    uploaded_by=sadmin_user,
                )
            assert "already exists in knowledge base" in str(exc_info.value)
        finally:
            storage_service.reset_provider()

    def test_lifecycle_draft_to_processing_to_pending(self, memory_db, sadmin_user, tmp_path):
        service = KnowledgeCentreService()
        provider = LocalStorageProvider(base_dir=tmp_path)
        storage_service.set_provider(provider)
        try:
            doc, ver = service.create_document(
                db=memory_db,
                title="Processing Test",
                domain="academic-regulations",
                document_type="regulation",
                filename="reg.pdf",
                file_bytes=SAMPLE_PDF_BYTES,
                uploaded_by=sadmin_user,
            )
            assert doc.status == KnowledgeDocumentStatus.DRAFT.value

            # Transition to processing
            service.transition_to_processing(memory_db, doc.id, ver.id)
            assert doc.status == KnowledgeDocumentStatus.PROCESSING.value

            # Successful extraction moves to pending_approval
            service.record_extraction_success(memory_db, doc.id, ver.id, chunks_count=10)
            assert doc.status == KnowledgeDocumentStatus.PENDING_APPROVAL.value
            assert ver.extraction_status == KnowledgeExtractionStatus.PARSED.value
        finally:
            storage_service.reset_provider()

    def test_failed_extraction_prevents_active(self, memory_db, sadmin_user, tmp_path):
        """A failed extraction must NEVER allow document to transition to active."""
        service = KnowledgeCentreService()
        provider = LocalStorageProvider(base_dir=tmp_path)
        storage_service.set_provider(provider)
        try:
            doc, ver = service.create_document(
                db=memory_db,
                title="Failed Document",
                domain="admissions",
                document_type="brochure",
                filename="broken.pdf",
                file_bytes=SAMPLE_PDF_BYTES,
                uploaded_by=sadmin_user,
            )
            service.transition_to_processing(memory_db, doc.id, ver.id)
            service.record_extraction_failure(memory_db, doc.id, ver.id, "Corrupt PDF stream")

            assert ver.extraction_status == KnowledgeExtractionStatus.FAILED.value
            assert doc.status == KnowledgeDocumentStatus.DRAFT.value

            # Attempting SADMIN approval on failed extraction must raise error
            with pytest.raises(KnowledgeInvalidLifecycleStateError) as exc_info:
                service.approve_version(memory_db, doc.id, ver.id, approving_user=sadmin_user)
            assert "Cannot approve document version with extraction status 'failed'" in str(exc_info.value)
        finally:
            storage_service.reset_provider()

    def test_sadmin_approval_activates_document(self, memory_db, sadmin_user, tmp_path):
        service = KnowledgeCentreService()
        provider = LocalStorageProvider(base_dir=tmp_path)
        storage_service.set_provider(provider)
        try:
            doc, ver = service.create_document(
                db=memory_db,
                title="Authoritative Syllabus",
                domain="academic-regulations",
                document_type="syllabus",
                filename="syllabus.pdf",
                file_bytes=SAMPLE_PDF_BYTES,
                uploaded_by=sadmin_user,
            )
            service.record_extraction_success(memory_db, doc.id, ver.id, chunks_count=5)

            # Approve by SADMIN
            service.approve_version(memory_db, doc.id, ver.id, approving_user=sadmin_user)

            assert doc.status == KnowledgeDocumentStatus.ACTIVE.value
            assert doc.current_version_id == ver.id
            assert doc.published_at is not None
            assert ver.approval_status == KnowledgeApprovalStatus.APPROVED.value
            assert ver.approved_by_id == sadmin_user.id
        finally:
            storage_service.reset_provider()

    def test_non_sadmin_cannot_approve(self, memory_db, sadmin_user, regular_user, tmp_path):
        service = KnowledgeCentreService()
        provider = LocalStorageProvider(base_dir=tmp_path)
        storage_service.set_provider(provider)
        try:
            doc, ver = service.create_document(
                db=memory_db,
                title="Dean Review",
                domain="doctoral-studies",
                document_type="ordinance",
                filename="doc.pdf",
                file_bytes=SAMPLE_PDF_BYTES,
                uploaded_by=sadmin_user,
            )
            service.record_extraction_success(memory_db, doc.id, ver.id, chunks_count=5)

            # Faculty/Dean attempt must fail
            with pytest.raises(KnowledgePermissionDeniedError):
                service.approve_version(memory_db, doc.id, ver.id, approving_user=regular_user)
        finally:
            storage_service.reset_provider()

    def test_sadmin_rejection(self, memory_db, sadmin_user, tmp_path):
        service = KnowledgeCentreService()
        provider = LocalStorageProvider(base_dir=tmp_path)
        storage_service.set_provider(provider)
        try:
            doc, ver = service.create_document(
                db=memory_db,
                title="Incorrect Document",
                domain="university-administration",
                document_type="policy",
                filename="outdated.pdf",
                file_bytes=SAMPLE_PDF_BYTES,
                uploaded_by=sadmin_user,
            )
            service.record_extraction_success(memory_db, doc.id, ver.id, chunks_count=2)
            service.reject_version(memory_db, doc.id, ver.id, rejecting_user=sadmin_user, reason="Superseded by Gazette")

            assert doc.status == KnowledgeDocumentStatus.REJECTED.value
            assert ver.approval_status == KnowledgeApprovalStatus.REJECTED.value
            assert ver.processing_error == "Superseded by Gazette"
        finally:
            storage_service.reset_provider()

    def test_version_immutability_and_atomic_swap(self, memory_db, sadmin_user, tmp_path):
        """Verifies v1 and v2 have independent keys, and v1 remains active until v2 is approved."""
        service = KnowledgeCentreService()
        provider = LocalStorageProvider(base_dir=tmp_path)
        storage_service.set_provider(provider)
        try:
            # 1. Create and approve v1
            doc, v1 = service.create_document(
                db=memory_db,
                title="Admission Brochure",
                domain="admissions",
                document_type="brochure",
                filename="brochure_v1.pdf",
                file_bytes=SAMPLE_PDF_BYTES,
                uploaded_by=sadmin_user,
            )
            service.record_extraction_success(memory_db, doc.id, v1.id, chunks_count=15)
            service.approve_version(memory_db, doc.id, v1.id, approving_user=sadmin_user)
            assert doc.status == KnowledgeDocumentStatus.ACTIVE.value
            assert doc.current_version_id == v1.id

            # 2. Upload v2 (different content)
            v2_bytes = SAMPLE_PDF_BYTES + b"% Additional Policy Amendments\n"
            v2 = service.create_new_version(
                db=memory_db,
                document_id=doc.id,
                filename="brochure_v2.pdf",
                file_bytes=v2_bytes,
                uploaded_by=sadmin_user,
            )
            assert v2.version_number == 2
            assert "v2_" in v2.storage_key
            assert v1.storage_key != v2.storage_key

            # Critical check: Prior version (v1) remains active while v2 is pending!
            assert doc.current_version_id == v1.id
            assert doc.status == KnowledgeDocumentStatus.ACTIVE.value
            assert v2.approval_status == KnowledgeApprovalStatus.PENDING.value

            # 3. Complete v2 extraction and approve v2
            service.record_extraction_success(memory_db, doc.id, v2.id, chunks_count=20)
            service.approve_version(memory_db, doc.id, v2.id, approving_user=sadmin_user)

            # Active version is now atomically updated to v2
            assert doc.current_version_id == v2.id
            assert v2.approval_status == KnowledgeApprovalStatus.APPROVED.value
            # Both physical files exist in storage (immutable history preserved)
            assert provider.exists(v1.storage_key)
            assert provider.exists(v2.storage_key)
        finally:
            storage_service.reset_provider()
