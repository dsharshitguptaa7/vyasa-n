# -*- coding: utf-8 -*-
"""
Test Suite: Gemini Embedding Failure Audit, Repair & Document Recovery
Validates all 15 Phase 7 requirements:
1. Supported embedding model configuration
2. Successful embedding request
3. Unsupported model error
4. Permanent 404 classification
5. No retry for permanent model failure
6. Retry behavior for transient errors
7. Correct vector dimensions
8. Chunk persistence
9. Embedding persistence
10. Processing status transition
11. Retry of previously failed documents
12. Retry idempotency
13. Duplicate prevention
14. Document/chunk viewer retrieval
15. Existing document compatibility
"""

import math
import uuid
from unittest.mock import MagicMock, patch
import numpy as np
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.resilience import (
    execute_with_resilience,
    is_retryable_exception,
    PermanentApiError,
    TransientApiError,
)
from app.models.base import Base
from app.modules.phd_rag.services.embedding_service import (
    EmbeddingService,
    EmbeddingError,
    EmbeddingPermanentError,
    EmbeddingModelNotFoundError,
    EmbeddingUnsupportedOperationError,
    EmbeddingAuthenticationError,
    EmbeddingTransientError,
    EmbeddingGenerationError,
    EmbeddingValidationError,
    validate_and_normalize_vector,
    DEFAULT_EMBEDDING_MODEL,
    DEFAULT_EMBEDDING_DIMENSIONS,
)
from app.modules.phd_rag.models import PhdDocument, PhdChunk
from app.modules.phd_rag.services.retrieval_service import PhdRetrievalService
from app.modules.knowledge_centre.models import (
    AiKnowledgeDocument,
    AiKnowledgeDocumentVersion,
    AiKnowledgeChunk,
    KnowledgeDocumentStatus,
    KnowledgeApprovalStatus,
    KnowledgeExtractionStatus,
    KnowledgeVerificationStatus,
)
from app.modules.knowledge_centre.service import KnowledgeCentreService
from app.modules.knowledge_centre.retrieval_service import (
    KnowledgeRetrievalService,
    KnowledgeRetrievalQuery,
)
from app.modules.knowledge_centre.router import _serialize_document, _serialize_chunk


# ==============================================================================
# In-memory isolated database fixture
# ==============================================================================
@pytest.fixture
def mem_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


# ==============================================================================
# TEST 1: Supported embedding model configuration
# ==============================================================================
def test_01_supported_embedding_model_configuration():
    """Verify that gemini-embedding-001 is centralized, default, and validated."""
    assert DEFAULT_EMBEDDING_MODEL == "gemini-embedding-001"
    assert DEFAULT_EMBEDDING_DIMENSIONS == 768
    assert settings.GEMINI_EMBEDDING_MODEL == "gemini-embedding-001"
    assert settings.GEMINI_EMBEDDING_DIMENSIONS == 768

    svc = EmbeddingService(is_production=False, allow_offline=True)
    health = svc.validate_provider(check_live=False)
    assert health["status"] == "HEALTHY"
    assert health["model"] == "gemini-embedding-001"
    assert health["dimensions"] == 768
    assert health["is_known_supported"] is True
    assert health["is_known_retired"] is False


# ==============================================================================
# TEST 2: Successful embedding request
# ==============================================================================
def test_02_successful_embedding_request():
    """Verify online embedding generation using gemini-embedding-001 returns 768-dim vector and provenance."""
    svc = EmbeddingService(api_key="mock-valid-key", is_production=True)

    mock_client = MagicMock()
    mock_res = MagicMock()
    mock_res.embedding.values = [0.05] * 768
    mock_client.models.embed_content.return_value = mock_res
    svc._client = mock_client

    vec, provenance = svc.embed_text_with_provenance("CSJMU Ph.D. Admission Regulations")

    assert len(vec) == 768
    assert math.isclose(np.linalg.norm(vec), 1.0, rel_tol=1e-5)
    assert provenance["embedding_model"] == "gemini-embedding-001"
    assert provenance["embedding_dimensions"] == 768
    assert provenance["embedding_provider"] == "google_genai"
    assert provenance["embedding_mode"] == "online"
    assert provenance["embedding_status"] == "indexed"


# ==============================================================================
# TEST 3: Unsupported model error
# ==============================================================================
def test_03_unsupported_model_error():
    """Verify unsupported embedContent operation is classified into EmbeddingUnsupportedOperationError."""
    exc = Exception("Model 'gemini-1.5-pro' is not supported for embedContent.")
    classified = EmbeddingService.classify_api_error(exc)

    assert isinstance(classified, EmbeddingUnsupportedOperationError)
    assert isinstance(classified, EmbeddingPermanentError)
    assert isinstance(classified, EmbeddingGenerationError)


# ==============================================================================
# TEST 4: Permanent 404 classification
# ==============================================================================
def test_04_permanent_404_classification():
    """Verify 404 NOT_FOUND is classified into EmbeddingModelNotFoundError."""
    exc_str = "models/text-embedding-004 is not found for API version v1beta, or is not supported for embedContent."
    classified = EmbeddingService.classify_api_error(Exception(exc_str))

    assert isinstance(classified, EmbeddingModelNotFoundError)
    assert isinstance(classified, EmbeddingPermanentError)
    assert isinstance(classified, EmbeddingGenerationError)
    assert is_retryable_exception(Exception(exc_str)) is False


# ==============================================================================
# TEST 5: No retry for permanent model failure
# ==============================================================================
def test_05_no_retry_for_permanent_model_failure():
    """Verify resilience executor fails fast on 404 NOT_FOUND without retrying."""
    call_count = 0

    def mock_embed():
        nonlocal call_count
        call_count += 1
        raise Exception("404 NOT_FOUND: models/text-embedding-004 is not found for API version v1beta")

    with pytest.raises(PermanentApiError):
        execute_with_resilience(
            mock_embed,
            operation_name="Gemini EmbedContent Test",
            max_retries=3,
            base_delay=0.01,
        )

    # Must be called exactly once: NO RETRIES for 404 errors!
    assert call_count == 1


# ==============================================================================
# TEST 6: Retry behavior for transient errors
# ==============================================================================
def test_06_retry_behavior_for_transient_errors():
    """Verify resilience executor retries transient 429 rate-limit errors with exponential backoff."""
    call_count = 0

    def mock_embed():
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise Exception("429 RESOURCE_EXHAUSTED: Rate limit exceeded")
        return "SUCCESS"

    result = execute_with_resilience(
        mock_embed,
        operation_name="Gemini EmbedContent Rate Limit Test",
        max_retries=3,
        base_delay=0.01,
        max_delay=0.05,
    )

    assert result == "SUCCESS"
    assert call_count == 3


# ==============================================================================
# TEST 7: Correct vector dimensions
# ==============================================================================
def test_07_correct_vector_dimensions():
    """Verify strict validation and rejection of mismatched or invalid vector dimensions."""
    # 768 is valid
    valid_768 = [0.1] * 768
    norm_vec = validate_and_normalize_vector(valid_768, expected_dim=768)
    assert len(norm_vec) == 768

    # 3072 is rejected when 768 expected
    with pytest.raises(EmbeddingValidationError) as exc:
        validate_and_normalize_vector([0.1] * 3072, expected_dim=768)
    assert "dimension mismatch: expected 768, got 3072" in str(exc.value)

    # 1536 is rejected
    with pytest.raises(EmbeddingValidationError) as exc2:
        validate_and_normalize_vector([0.1] * 1536, expected_dim=768)
    assert "dimension mismatch: expected 768, got 1536" in str(exc2.value)


# ==============================================================================
# TEST 8: Chunk persistence
# ==============================================================================
def test_08_chunk_persistence(mem_db):
    """Verify that chunks persist correct document_id, version_id, chunk_index, and text."""
    doc_id = uuid.uuid4()
    ver_id = uuid.uuid4()

    doc = AiKnowledgeDocument(
        id=doc_id,
        title="Ph.D. Ordinance 2026-27",
        domain="doctoral-studies",
        document_type="ordinance",
        academic_session="2026-27",
        status=KnowledgeDocumentStatus.ACTIVE.value,
        current_version_id=ver_id,
    )
    ver = AiKnowledgeDocumentVersion(
        id=ver_id,
        document_id=doc_id,
        version_number=1,
        storage_key="vyasa-knowledge/doctoral-studies/v1_ordinance.pdf",
        checksum_sha256="abc123sha",
        original_filename="ordinance.pdf",
        mime_type="application/pdf",
        size_bytes=1024,
        extraction_status=KnowledgeExtractionStatus.PARSED.value,
        approval_status=KnowledgeApprovalStatus.APPROVED.value,
    )
    chunk = AiKnowledgeChunk(
        id=uuid.uuid4(),
        document_id=doc_id,
        version_id=ver_id,
        chunk_index=0,
        content="Course work consists of 12 credits including Research Methodology.",
        page_number=3,
        embedding=[0.05] * 768,
        verification_status=KnowledgeVerificationStatus.INDEXED.value,
        chunk_metadata={
            "embedding_model": "gemini-embedding-001",
            "embedding_dimensions": 768,
            "section_heading": "Clause 6.1 Course Work",
        },
    )
    mem_db.add_all([doc, ver, chunk])
    mem_db.commit()

    saved_chunk = mem_db.query(AiKnowledgeChunk).filter_by(document_id=doc_id).first()
    assert saved_chunk is not None
    assert saved_chunk.document_id == doc_id
    assert saved_chunk.version_id == ver_id
    assert saved_chunk.chunk_index == 0
    assert "12 credits" in saved_chunk.content


# ==============================================================================
# TEST 9: Embedding persistence
# ==============================================================================
def test_09_embedding_persistence(mem_db):
    """Verify that embedding array of floats persists in JSON/JSONB column and retrieves accurately."""
    doc_id = uuid.uuid4()
    ver_id = uuid.uuid4()
    raw_vector = [round(float(i) / 768.0, 5) for i in range(768)]

    chunk = AiKnowledgeChunk(
        id=uuid.uuid4(),
        document_id=doc_id,
        version_id=ver_id,
        chunk_index=0,
        content="Test passage for embedding vector storage.",
        embedding=raw_vector,
        verification_status=KnowledgeVerificationStatus.INDEXED.value,
    )
    mem_db.add(chunk)
    mem_db.commit()

    retrieved = mem_db.query(AiKnowledgeChunk).filter_by(id=chunk.id).first()
    assert retrieved.embedding is not None
    assert len(retrieved.embedding) == 768
    assert retrieved.embedding == raw_vector


# ==============================================================================
# TEST 10: Processing status transition
# ==============================================================================
def test_10_processing_status_transition(mem_db):
    """Verify document and version status transitions across success and failure."""
    doc_id = uuid.uuid4()
    ver_id = uuid.uuid4()
    user = MagicMock()
    user.role = "sadmin"

    doc = AiKnowledgeDocument(
        id=doc_id,
        title="Test Orientation Document",
        domain="doctoral-studies",
        document_type="guideline",
        status=KnowledgeDocumentStatus.DRAFT.value,
    )
    ver = AiKnowledgeDocumentVersion(
        id=ver_id,
        document_id=doc_id,
        version_number=1,
        storage_key="test/key.pdf",
        checksum_sha256="dummy_sha",
        original_filename="orientation.pdf",
        mime_type="application/pdf",
        size_bytes=500,
        extraction_status=KnowledgeExtractionStatus.PENDING.value,
        approval_status=KnowledgeApprovalStatus.PENDING.value,
    )
    mem_db.add_all([doc, ver])
    mem_db.commit()

    kc = KnowledgeCentreService()

    # 1. Transition to PROCESSING
    kc.transition_to_processing(mem_db, doc_id, ver_id)
    assert doc.status == KnowledgeDocumentStatus.PROCESSING.value
    assert ver.extraction_status == KnowledgeExtractionStatus.PENDING.value

    # 2. Record Failure: status transitions to DRAFT and extraction_status to FAILED
    kc.record_extraction_failure(mem_db, doc_id, ver_id, "Gemini API embedding failure: 404 NOT_FOUND")
    assert doc.status == KnowledgeDocumentStatus.DRAFT.value
    assert ver.extraction_status == KnowledgeExtractionStatus.FAILED.value
    assert "404 NOT_FOUND" in ver.processing_error

    # 3. Record Success: status transitions to PENDING_APPROVAL and extraction_status to PARSED
    kc.record_extraction_success(mem_db, doc_id, ver_id, chunks_count=5)
    assert doc.status == KnowledgeDocumentStatus.PENDING_APPROVAL.value
    assert ver.extraction_status == KnowledgeExtractionStatus.PARSED.value
    assert ver.processing_error is None


# ==============================================================================
# TEST 11: Retry of previously failed documents
# ==============================================================================
def test_11_retry_of_previously_failed_documents(mem_db):
    """Verify retry_extraction resets failed version with fresh job_id and pending status."""
    doc_id = uuid.uuid4()
    ver_id = uuid.uuid4()
    admin_user = MagicMock()
    mock_role = MagicMock()
    mock_role.name = "super_admin"
    admin_user.roles = [mock_role]

    doc = AiKnowledgeDocument(
        id=doc_id,
        title="ROLLING CIRCULATION PhD ADMISSION 2026 27 EDITABLE OCR",
        domain="doctoral-studies",
        document_type="admission_notice",
        status=KnowledgeDocumentStatus.DRAFT.value,
    )
    ver = AiKnowledgeDocumentVersion(
        id=ver_id,
        document_id=doc_id,
        version_number=1,
        storage_key="vyasa-knowledge/doctoral-studies/v1_rolling.pdf",
        checksum_sha256="rolling_sha_123",
        original_filename="rolling.pdf",
        mime_type="application/pdf",
        size_bytes=2048,
        extraction_status=KnowledgeExtractionStatus.FAILED.value,
        processing_error="Permanent failure in Gemini EmbedContent (text-embedding-004): 404 NOT_FOUND",
        approval_status=KnowledgeApprovalStatus.PENDING.value,
    )
    mem_db.add_all([doc, ver])
    mem_db.commit()

    kc = KnowledgeCentreService()
    retried_ver, new_job_id = kc.retry_extraction(
        db=mem_db,
        document_id=doc_id,
        version_id=ver_id,
        acting_user=admin_user,
    )

    assert retried_ver.id == ver_id
    assert retried_ver.extraction_status == KnowledgeExtractionStatus.PENDING.value
    assert retried_ver.processing_error is None
    assert retried_ver.job_id == new_job_id
    assert doc.status == KnowledgeDocumentStatus.PROCESSING.value


# ==============================================================================
# TEST 12: Retry idempotency
# ==============================================================================
def test_12_retry_idempotency(mem_db):
    """Verify that multiple consecutive retry calls on the same document do not duplicate document or version records."""
    doc_id = uuid.uuid4()
    ver_id = uuid.uuid4()
    admin_user = MagicMock()
    mock_role = MagicMock()
    mock_role.name = "super_admin"
    admin_user.roles = [mock_role]

    doc = AiKnowledgeDocument(
        id=doc_id,
        title="PhD Orientation 2026 27 Coursework",
        domain="doctoral-studies",
        document_type="coursework_ppt",
        status=KnowledgeDocumentStatus.DRAFT.value,
    )
    ver = AiKnowledgeDocumentVersion(
        id=ver_id,
        document_id=doc_id,
        version_number=1,
        storage_key="vyasa-knowledge/doctoral-studies/v1_orientation.pptx",
        checksum_sha256="orientation_sha_456",
        original_filename="orientation.pptx",
        mime_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        size_bytes=5000,
        extraction_status=KnowledgeExtractionStatus.FAILED.value,
        processing_error="Permanent failure in Gemini EmbedContent",
        approval_status=KnowledgeApprovalStatus.PENDING.value,
    )
    mem_db.add_all([doc, ver])
    mem_db.commit()

    kc = KnowledgeCentreService()

    # Retry 1
    kc.retry_extraction(mem_db, doc_id, ver_id, admin_user)
    # Retry 2
    kc.retry_extraction(mem_db, doc_id, ver_id, admin_user)
    # Retry 3
    kc.retry_extraction(mem_db, doc_id, ver_id, admin_user)

    total_docs = mem_db.query(AiKnowledgeDocument).filter_by(id=doc_id).count()
    total_vers = mem_db.query(AiKnowledgeDocumentVersion).filter_by(document_id=doc_id).count()

    assert total_docs == 1
    assert total_vers == 1


# ==============================================================================
# TEST 13: Duplicate prevention
# ==============================================================================
def test_13_duplicate_prevention(mem_db):
    """Verify that retrying extraction deletes prior partial chunks, preventing duplicates."""
    doc_id = uuid.uuid4()
    ver_id = uuid.uuid4()

    doc = AiKnowledgeDocument(
        id=doc_id,
        title="Doc With Partial Chunks",
        domain="doctoral-studies",
        document_type="ordinance",
        status=KnowledgeDocumentStatus.PROCESSING.value,
    )
    ver = AiKnowledgeDocumentVersion(
        id=ver_id,
        document_id=doc_id,
        version_number=1,
        storage_key="test/key.pdf",
        checksum_sha256="partial_sha",
        original_filename="doc.pdf",
        mime_type="application/pdf",
        size_bytes=1000,
        extraction_status=KnowledgeExtractionStatus.PENDING.value,
        approval_status=KnowledgeApprovalStatus.PENDING.value,
    )
    # Seed 3 prior partial chunks
    for i in range(3):
        mem_db.add(AiKnowledgeChunk(
            id=uuid.uuid4(),
            document_id=doc_id,
            version_id=ver_id,
            chunk_index=i,
            content=f"Partial chunk {i}",
            verification_status="indexed",
        ))
    mem_db.add_all([doc, ver])
    mem_db.commit()

    assert mem_db.query(AiKnowledgeChunk).filter_by(version_id=ver_id).count() == 3

    # Mock parser and embedder producing 2 new chunks
    mock_chunk1 = MagicMock(chunk_text="Clean chunk 0", section_heading="S1", page_number=1, slide_number=None, token_count=5, checksum_sha256="c1")
    mock_chunk2 = MagicMock(chunk_text="Clean chunk 1", section_heading="S2", page_number=2, slide_number=None, token_count=5, checksum_sha256="c2")

    with patch("app.modules.knowledge_centre.service.storage_service.get_file_path") as mock_fp, \
         patch("app.modules.knowledge_centre.service.DocumentParser") as mock_p_cls, \
         patch("app.modules.knowledge_centre.service.embedding_service") as mock_emb:

        mock_fp.return_value = MagicMock()
        mock_p = MagicMock()
        mock_p.parse_file.return_value = MagicMock()
        mock_p.chunk_document.return_value = [mock_chunk1, mock_chunk2]
        mock_p_cls.return_value = mock_p

        mock_emb.embed_batch_with_provenance.return_value = (
            [[0.01] * 768, [0.02] * 768],
            {"embedding_model": "gemini-embedding-001", "embedding_dimensions": 768},
        )

        kc = KnowledgeCentreService()
        count = kc.extract_and_index_document(mem_db, doc_id, ver_id)

        assert count == 2
        # Verify old 3 chunks were purged: exactly 2 chunks exist now, NO DUPLICATES!
        final_chunks = mem_db.query(AiKnowledgeChunk).filter_by(version_id=ver_id).all()
        assert len(final_chunks) == 2
        assert final_chunks[0].content == "Clean chunk 0"
        assert final_chunks[1].content == "Clean chunk 1"


# ==============================================================================
# TEST 14: Document/chunk viewer retrieval
# ==============================================================================
def test_14_document_and_chunk_viewer_retrieval(mem_db):
    """Verify document serializer preserves canonical document ID and shows error on failed version."""
    doc_id = uuid.uuid4()
    ver_id = uuid.uuid4()

    doc = AiKnowledgeDocument(
        id=doc_id,
        title="Failed Document In Viewer",
        domain="doctoral-studies",
        document_type="guideline",
        status=KnowledgeDocumentStatus.DRAFT.value,
        academic_session="2026-27",
    )
    ver = AiKnowledgeDocumentVersion(
        id=ver_id,
        document_id=doc_id,
        version_number=1,
        storage_key="test/failed.pdf",
        checksum_sha256="failed_sha",
        original_filename="failed.pdf",
        mime_type="application/pdf",
        size_bytes=2000,
        extraction_status=KnowledgeExtractionStatus.FAILED.value,
        processing_error="Permanent failure in Gemini EmbedContent (text-embedding-004): 404 NOT_FOUND",
        approval_status=KnowledgeApprovalStatus.PENDING.value,
    )
    doc.versions = [ver]
    mem_db.add_all([doc, ver])
    mem_db.commit()

    serialized = _serialize_document(doc)

    assert serialized.id == doc_id
    assert serialized.title == "Failed Document In Viewer"
    assert serialized.status == "draft"
    assert serialized.current_version is not None
    assert serialized.current_version.extraction_status == "failed"
    assert "404 NOT_FOUND" in serialized.current_version.processing_error
    assert serialized.chunk_count == 0


# ==============================================================================
# TEST 15: Existing document compatibility
# ==============================================================================
def test_15_existing_document_compatibility(mem_db):
    """Verify that existing active documents with 768 dimensions remain queryable without crashes."""
    doc_id = uuid.uuid4()
    ver_id = uuid.uuid4()

    doc = AiKnowledgeDocument(
        id=doc_id,
        title="Historical Active Ph.D. Ordinance",
        domain="doctoral-studies",
        document_type="ordinance",
        academic_session="2024-25",
        status=KnowledgeDocumentStatus.ACTIVE.value,
        current_version_id=ver_id,
    )
    ver = AiKnowledgeDocumentVersion(
        id=ver_id,
        document_id=doc_id,
        version_number=1,
        storage_key="vyasa-knowledge/doctoral-studies/v1_hist.pdf",
        checksum_sha256="hist_sha_123",
        original_filename="hist.pdf",
        mime_type="application/pdf",
        size_bytes=1500,
        extraction_status=KnowledgeExtractionStatus.PARSED.value,
        approval_status=KnowledgeApprovalStatus.APPROVED.value,
    )
    chunk = AiKnowledgeChunk(
        id=uuid.uuid4(),
        document_id=doc_id,
        version_id=ver_id,
        chunk_index=0,
        content="Research advisory committee will review student progress every six months.",
        page_number=5,
        embedding=[0.05] * 768,
        verification_status=KnowledgeVerificationStatus.INDEXED.value,
        chunk_metadata={
            "embedding_model": "gemini-embedding-001",
            "embedding_dimensions": 768,
            "section_heading": "Clause 8: Progress Review",
        },
    )
    mem_db.add_all([doc, ver, chunk])
    mem_db.commit()

    mock_embedder = MagicMock()
    mock_embedder.model_name = "gemini-embedding-001"
    mock_embedder.dimensions = 768
    mock_embedder.embed_text.return_value = [0.05] * 768

    retrieval_svc = KnowledgeRetrievalService(embedder=mock_embedder)
    q = KnowledgeRetrievalQuery(query="student progress review committee")
    res = retrieval_svc.retrieve(q, mem_db)

    assert res.matched_passages_count >= 1
    assert len(res.top_evidence) >= 1
    assert res.top_evidence[0].document_title == "Historical Active Ph.D. Ordinance"
    assert res.top_evidence[0].embedding_model == "gemini-embedding-001"
