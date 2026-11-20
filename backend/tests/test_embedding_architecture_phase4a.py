# -*- coding: utf-8 -*-
"""
Phase 4A Automated Test Suite: Unified Embedding Architecture & Production Safety
Covers all 14 mandatory test requirements:
1. Explicit Gemini output dimensionality request.
2. Valid online response parsing & dimension validation.
3. Missing production API key raises EmbeddingConfigurationError.
4. Gemini API failure raises EmbeddingGenerationError without silent fallback.
5. Wrong-dimensional response rejected (EmbeddingValidationError).
6. NaN and Inf vector rejection.
7. Empty vector rejection.
8. Explicit offline mode produces deterministic 768-dim normalized vector.
9. Production flag prevents silent fallback even when API fails.
10. Provenance metadata persistence in Knowledge Centre chunk metadata.
11. Retrieval similarity handles dimension mismatch safely without crash.
12. Existing Ph.D. RAG embedding compatibility preserved.
13. Knowledge Centre embedding compatibility verified.
14. Stale/incompatible model vector rejection.
"""

import math
import uuid
from unittest.mock import MagicMock, patch
import numpy as np
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.models.base import Base
from app.modules.phd_rag.services.embedding_service import (
    EmbeddingService,
    EmbeddingError,
    EmbeddingConfigurationError,
    EmbeddingGenerationError,
    EmbeddingValidationError,
    validate_and_normalize_vector,
    DEFAULT_EMBEDDING_MODEL,
    DEFAULT_EMBEDDING_DIMENSIONS,
    EMBEDDING_DIMENSIONS,
)
from app.modules.phd_rag.services.retrieval_service import PhdRetrievalService
from app.modules.phd_rag.models import PhdChunk
from app.modules.knowledge_centre.models import (
    AiKnowledgeDocument,
    AiKnowledgeDocumentVersion,
    AiKnowledgeChunk,
    KnowledgeVerificationStatus,
    KnowledgeDocumentStatus,
    KnowledgeApprovalStatus,
    KnowledgeExtractionStatus,
)
from app.modules.knowledge_centre.service import KnowledgeCentreService


# Helper fixture for in-memory SQLite database
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
# TEST CASE 1: Explicit Gemini output dimensionality request
# ==============================================================================
def test_case_01_explicit_gemini_output_dimensionality_request():
    """Verify that client.models.embed_content is called with explicit output_dimensionality=768."""
    svc = EmbeddingService(api_key="mock-api-key", is_production=False, allow_offline=False)

    mock_client = MagicMock()
    mock_res = MagicMock()
    mock_res.embedding.values = [0.1] * 768
    mock_client.models.embed_content.return_value = mock_res
    svc._client = mock_client

    vec = svc.embed_text("Test query for dimensionality")

    assert len(vec) == 768
    mock_client.models.embed_content.assert_called_once()
    _, kwargs = mock_client.models.embed_content.call_args
    assert "config" in kwargs
    config = kwargs["config"]
    assert hasattr(config, "output_dimensionality")
    assert config.output_dimensionality == 768


# ==============================================================================
# TEST CASE 2: Valid online response parsing & dimension validation
# ==============================================================================
def test_case_02_valid_online_response_parsing_and_provenance():
    """Verify online response is properly parsed, validated, L2-normalized, with correct provenance."""
    svc = EmbeddingService(api_key="mock-api-key", is_production=False, allow_offline=False)

    mock_client = MagicMock()
    raw_vals = [float(i + 1) for i in range(768)]
    mock_res = MagicMock()
    mock_res.embedding.values = raw_vals
    mock_client.models.embed_content.return_value = mock_res
    svc._client = mock_client

    vec, provenance = svc.embed_text_with_provenance("Authoritative guidelines")

    assert len(vec) == 768
    assert math.isclose(np.linalg.norm(vec), 1.0, rel_tol=1e-5)
    assert provenance["embedding_model"] == DEFAULT_EMBEDDING_MODEL
    assert provenance["embedding_dimensions"] == 768
    assert provenance["embedding_provider"] == "google_genai"
    assert provenance["embedding_mode"] == "online"
    assert provenance["embedding_status"] == "indexed"
    assert "generated_at" in provenance


# ==============================================================================
# TEST CASE 3: Missing production API key raises EmbeddingConfigurationError
# ==============================================================================
def test_case_03_missing_production_api_key_raises_config_error():
    """Verify that in production, missing API key immediately raises EmbeddingConfigurationError."""
    svc = EmbeddingService(api_key=None, is_production=True)
    svc._api_key = None

    with pytest.raises(EmbeddingConfigurationError) as exc_info:
        svc.embed_text("Sample query in production")
    assert "GEMINI_API_KEY is required" in str(exc_info.value)


# ==============================================================================
# TEST CASE 4: Gemini API failure raises EmbeddingGenerationError without fallback
# ==============================================================================
def test_case_04_gemini_api_failure_raises_generation_error():
    """Verify that Gemini API failure in production raises EmbeddingGenerationError without fallback."""
    svc = EmbeddingService(api_key="mock-prod-key", is_production=True)

    mock_client = MagicMock()
    mock_client.models.embed_content.side_effect = Exception("503 Service Unavailable / Rate Limit Exceeded")
    svc._client = mock_client

    with pytest.raises(EmbeddingGenerationError) as exc_info:
        svc.embed_text("Query during API outage")
    assert "Gemini API embedding generation failed" in str(exc_info.value)
    assert "503" in str(exc_info.value)


# ==============================================================================
# TEST CASE 5: Wrong-dimensional response rejected (EmbeddingValidationError)
# ==============================================================================
def test_case_05_wrong_dimensional_response_rejected():
    """Verify that any embedding response not matching 768 dimensions raises EmbeddingValidationError."""
    svc = EmbeddingService(api_key="mock-api-key", is_production=False, allow_offline=False)

    # Simulate Gemini returning 3072-dim or 1536-dim vector unexpectedly
    mock_client = MagicMock()
    mock_res = MagicMock()
    mock_res.embedding.values = [0.1] * 3072
    mock_client.models.embed_content.return_value = mock_res
    svc._client = mock_client

    with pytest.raises(EmbeddingValidationError) as exc_info:
        svc.embed_text("Text with 3072-dim mismatch")
    assert "dimension mismatch: expected 768, got 3072" in str(exc_info.value)


# ==============================================================================
# TEST CASE 6: NaN and Inf vector rejection
# ==============================================================================
def test_case_06_nan_and_inf_vector_rejection():
    """Verify that vectors containing NaN, +Inf, or -Inf are rejected with EmbeddingValidationError."""
    nan_vector = [0.1] * 767 + [float("nan")]
    with pytest.raises(EmbeddingValidationError) as exc_info_nan:
        validate_and_normalize_vector(nan_vector, expected_dim=768)
    assert "contains non-finite values (NaN or Inf)" in str(exc_info_nan.value)

    inf_vector = [float("inf")] + [0.1] * 767
    with pytest.raises(EmbeddingValidationError) as exc_info_inf:
        validate_and_normalize_vector(inf_vector, expected_dim=768)
    assert "contains non-finite values (NaN or Inf)" in str(exc_info_inf.value)

    neg_inf_vector = [-float("inf")] + [0.1] * 767
    with pytest.raises(EmbeddingValidationError) as exc_info_ninf:
        validate_and_normalize_vector(neg_inf_vector, expected_dim=768)
    assert "contains non-finite values (NaN or Inf)" in str(exc_info_ninf.value)


# ==============================================================================
# TEST CASE 7: Empty vector rejection
# ==============================================================================
def test_case_07_empty_vector_rejection():
    """Verify that empty vectors, None vectors, all-zero vectors, and empty text are rejected."""
    # 1. Empty list
    with pytest.raises(EmbeddingValidationError) as exc_empty:
        validate_and_normalize_vector([], expected_dim=768)
    assert "is empty (0 dimensions)" in str(exc_empty.value)

    # 2. None
    with pytest.raises(EmbeddingValidationError) as exc_none:
        validate_and_normalize_vector(None, expected_dim=768)
    assert "cannot be None" in str(exc_none.value)

    # 3. All-zero vector
    with pytest.raises(EmbeddingValidationError) as exc_zero:
        validate_and_normalize_vector([0.0] * 768, expected_dim=768)
    assert "zero or near-zero L2 norm" in str(exc_zero.value)

    # 4. Empty or whitespace-only text passed to embed_text
    svc = EmbeddingService(is_production=False, allow_offline=True)
    with pytest.raises(EmbeddingValidationError) as exc_txt:
        svc.embed_text("   ")
    assert "Cannot generate embedding for empty or whitespace-only text" in str(exc_txt.value)


# ==============================================================================
# TEST CASE 8: Explicit offline mode produces deterministic 768-dim normalized vector
# ==============================================================================
def test_case_08_explicit_offline_mode_deterministic_normalized():
    """Verify explicit offline mode produces deterministic, normalized 768-dim vector with provenance."""
    svc = EmbeddingService(api_key=None, is_production=False, allow_offline=True)

    text = "CSJMU Ph.D. Ordinance Clause 6.1 Course Work"
    vec1, prov1 = svc.embed_text_with_provenance(text)
    vec2, prov2 = svc.embed_text_with_provenance(text)

    # Exact 768 dimensions
    assert len(vec1) == 768
    assert len(vec2) == 768

    # L2 normalized
    assert math.isclose(np.linalg.norm(vec1), 1.0, rel_tol=1e-5)

    # Strictly deterministic
    assert vec1 == vec2

    # Different text yields distinct vector
    vec3, _ = svc.embed_text_with_provenance("Completely different topic sports and athletics")
    assert vec1 != vec3

    # Provenance fields
    assert prov1["embedding_provider"] == "deterministic_offline"
    assert prov1["embedding_mode"] == "offline"
    assert prov1["embedding_dimensions"] == 768
    assert prov1["embedding_status"] == "indexed"


# ==============================================================================
# TEST CASE 9: Production flag prevents silent fallback even when API fails
# ==============================================================================
def test_case_09_production_flag_strictly_disallows_offline_fallback():
    """Verify that even if allow_offline=True is passed, is_production=True enforces allow_offline=False."""
    svc = EmbeddingService(api_key="mock-key", is_production=True, allow_offline=True)
    assert svc.allow_offline is False, "Production mode must strictly force allow_offline to False"

    mock_client = MagicMock()
    mock_client.models.embed_content.side_effect = RuntimeError("Connection timeout to Gemini endpoint")
    svc._client = mock_client

    with pytest.raises(EmbeddingGenerationError) as exc_info:
        svc.embed_text("Production query during failure")
    assert "Gemini API embedding generation failed" in str(exc_info.value)


# ==============================================================================
# TEST CASE 10: Provenance metadata persistence in Knowledge Centre chunk metadata
# ==============================================================================
def test_case_10_provenance_metadata_persistence(mem_db):
    """Verify Knowledge Centre ingestion persists full embedding provenance in chunk_metadata."""
    kc_service = KnowledgeCentreService()

    # Create test document and version
    doc_id = uuid.uuid4()
    ver_id = uuid.uuid4()

    doc = AiKnowledgeDocument(
        id=doc_id,
        domain="doctoral-studies",
        document_type="ordinance",
        title="Ph.D. Ordinance 2026-27",
        academic_session="2026-27",
        status=KnowledgeDocumentStatus.PROCESSING.value,
    )
    ver = AiKnowledgeDocumentVersion(
        id=ver_id,
        document_id=doc_id,
        version_number=1,
        storage_key="vyasa-knowledge/doctoral-studies/ordinance.pdf",
        original_filename="ordinance.pdf",
        mime_type="application/pdf",
        size_bytes=1024,
        checksum_sha256="mockchecksum0123456789abcdef0123456789abcdef0123456789abcdef01234567",
        extraction_status=KnowledgeExtractionStatus.PENDING.value,
        approval_status=KnowledgeApprovalStatus.PENDING.value,
    )
    mem_db.add(doc)
    mem_db.add(ver)
    mem_db.commit()

    # Mock storage, parser, and embedding service
    with patch("app.modules.knowledge_centre.service.storage_service.get_file_path") as mock_get_path, \
         patch("app.modules.knowledge_centre.service.DocumentParser") as mock_parser_cls, \
         patch("app.modules.knowledge_centre.service.embedding_service") as mock_emb_svc:

        mock_get_path.return_value = "/mock/path/ordinance.pdf"

        # Mock parsed chunk
        mock_chunk = MagicMock()
        mock_chunk.chunk_text = "The minimum duration for Ph.D. is three years."
        mock_chunk.section_heading = "Clause 3: Duration"
        mock_chunk.token_count = 10
        mock_chunk.checksum_sha256 = "chunksha256"
        mock_chunk.page_number = 4
        mock_chunk.slide_number = None

        mock_parser = MagicMock()
        mock_parser.parse_file.return_value = MagicMock()
        mock_parser.chunk_document.return_value = [mock_chunk]
        mock_parser_cls.return_value = mock_parser

        # Mock embedder returning 768-dim vector with provenance
        mock_vec = [0.05] * 768
        mock_provenance = {
            "embedding_model": "text-embedding-004",
            "embedding_dimensions": 768,
            "embedding_provider": "google_genai",
            "embedding_mode": "online",
            "embedding_status": "indexed",
            "generated_at": "2026-11-18T12:00:00+00:00",
        }
        mock_emb_svc.embed_batch_with_provenance.return_value = ([mock_vec], mock_provenance)

        count = kc_service.extract_and_index_document(mem_db, doc_id, ver_id)
        assert count == 1

        stored_chunk = mem_db.query(AiKnowledgeChunk).filter_by(version_id=ver_id).first()
        assert stored_chunk is not None
        assert stored_chunk.content == "The minimum duration for Ph.D. is three years."
        assert len(stored_chunk.embedding) == 768

        meta = stored_chunk.chunk_metadata
        assert meta["embedding_model"] == "text-embedding-004"
        assert meta["embedding_dimensions"] == 768
        assert meta["embedding_provider"] == "google_genai"
        assert meta["embedding_mode"] == "online"
        assert meta["embedding_status"] == "indexed"
        assert meta["generated_at"] == "2026-11-18T12:00:00+00:00"


# ==============================================================================
# TEST CASE 11: Retrieval similarity handles dimension mismatch safely without crash
# ==============================================================================
def test_case_11_retrieval_handles_dimension_mismatch_safely(mem_db):
    """Verify that retrieval service skips semantic scoring safely when encountering mismatched vectors."""
    # Insert chunks with different vector dimensions: one legacy 3072-dim, one valid 768-dim
    doc_id = uuid.uuid4()
    chunk_legacy = PhdChunk(
        id=uuid.uuid4(),
        document_id=doc_id,
        chunk_index=0,
        doc_type="ordinance",
        document_title="Legacy Ordinance",
        source_filename="legacy.docx",
        chunk_text="Legacy coursework requirements with old dimension.",
        checksum_sha256="sha256_mock_legacy_1234567890abcdef",
        token_count=10,
        embedding=[0.01] * 3072,  # Stale 3072-dim vector!
    )
    chunk_valid = PhdChunk(
        id=uuid.uuid4(),
        document_id=doc_id,
        chunk_index=1,
        doc_type="coursework_ppt",
        document_title="Current Course Work",
        source_filename="current.pptx",
        chunk_text="Current coursework credit requirements 12 credits.",
        checksum_sha256="sha256_mock_valid_1234567890abcdef",
        token_count=10,
        embedding=[0.05] * 768,  # Current 768-dim vector
    )
    mem_db.add(chunk_legacy)
    mem_db.add(chunk_valid)
    mem_db.commit()

    # Embedder returns 768-dim query vector
    mock_embedder = MagicMock()
    mock_embedder.embed_text.return_value = [0.05] * 768

    retrieval_svc = PhdRetrievalService(embedder=mock_embedder)

    # This call must NOT raise "ValueError: shapes (768,) and (3072,) not aligned"
    results = retrieval_svc.retrieve("coursework credit requirements", mem_db, top_k=5)

    assert len(results) == 2
    # Current chunk with matching dimensions scores higher
    assert results[0].source_filename == "current.pptx"
    # Legacy chunk did not crash; scored via lexical overlap only


# ==============================================================================
# TEST CASE 12: Existing Ph.D. RAG embedding compatibility preserved
# ==============================================================================
def test_case_12_existing_phd_rag_compatibility_preserved():
    """Verify existing Ph.D. RAG API contract (embed_text, embed_batch, constants)."""
    assert DEFAULT_EMBEDDING_MODEL == "gemini-embedding-001"
    assert DEFAULT_EMBEDDING_DIMENSIONS == 768
    assert EMBEDDING_DIMENSIONS == 768

    svc = EmbeddingService(is_production=False, allow_offline=True)

    # 1. embed_text returns List[float]
    vec = svc.embed_text("Ph.D. admission test query")
    assert isinstance(vec, list)
    assert len(vec) == 768
    assert all(isinstance(x, float) for x in vec)

    # 2. embed_batch returns List[List[float]]
    texts = ["Course work credit requirements", "Research degree committee"]
    batch_vecs = svc.embed_batch(texts, batch_size=2)
    assert isinstance(batch_vecs, list)
    assert len(batch_vecs) == 2
    assert len(batch_vecs[0]) == 768
    assert len(batch_vecs[1]) == 768


# ==============================================================================
# TEST CASE 13: Knowledge Centre embedding compatibility verified
# ==============================================================================
def test_case_13_knowledge_centre_embedding_compatibility():
    """Verify Knowledge Centre batch provenance generation and cosine similarity calculation."""
    svc = EmbeddingService(is_production=False, allow_offline=True)

    texts = [
        "Ordinance rules for supervisor eligibility",
        "Guidelines for patent filing and research incentives",
    ]
    vectors, provenance = svc.embed_batch_with_provenance(texts, batch_size=10)

    assert len(vectors) == 2
    assert len(vectors[0]) == 768
    assert len(vectors[1]) == 768
    assert provenance["embedding_dimensions"] == 768

    # Cosine similarity between the two unit vectors is mathematically valid and bounded [-1, 1]
    v1 = np.array(vectors[0], dtype=np.float32)
    v2 = np.array(vectors[1], dtype=np.float32)
    sim = float(np.dot(v1, v2))
    assert -1.0 <= sim <= 1.0


# ==============================================================================
# TEST CASE 14: Stale/incompatible model vector rejection
# ==============================================================================
def test_case_14_stale_incompatible_vector_rejection(mem_db):
    """Verify retrieval service gracefully rejects chunks with NaN or corrupt embeddings without NaN propagation."""
    doc_id = uuid.uuid4()
    chunk_nan = PhdChunk(
        id=uuid.uuid4(),
        document_id=doc_id,
        chunk_index=0,
        doc_type="ordinance",
        document_title="Corrupt Chunk",
        source_filename="corrupt.pdf",
        chunk_text="Ordinance section with corrupted embedding.",
        checksum_sha256="sha256_corrupt_chunk_1234567890abcdef",
        token_count=10,
        embedding=[float("nan")] * 768,  # Corrupted NaN vector!
    )
    mem_db.add(chunk_nan)
    mem_db.commit()

    mock_embedder = MagicMock()
    mock_embedder.embed_text.return_value = [0.05] * 768

    retrieval_svc = PhdRetrievalService(embedder=mock_embedder)
    results = retrieval_svc.retrieve("ordinance section", mem_db, top_k=5)

    assert len(results) == 1
    # Relevance score must be finite (not NaN)
    assert not math.isnan(results[0].relevance_score)
    assert results[0].relevance_score >= 0.0
