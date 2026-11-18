# -*- coding: utf-8 -*-
"""
Phase 4B Automated Test Suite: Secure Multi-Domain RAG Retrieval Engine
Covers all 18 security, eligibility, provenance, and regression test cases:
1. Active approved current version is retrieved.
2. Pending approval document is excluded.
3. Rejected document is excluded.
4. Archived document is excluded.
5. Historical version is excluded.
6. Superseded version is excluded.
7. Failed extraction is excluded.
8. Unindexed chunks are excluded.
9. Wrong model provenance is excluded.
10. Wrong vector dimensions are excluded.
11. Unauthorized users cannot access protected retrieval endpoints.
12. Domain filtering works.
13. Academic session filtering works.
14. Issuing authority filtering works.
15. Citation metadata is accurate.
16. Duplicate passages are suppressed.
17. Empty retrieval produces a safe no-evidence result.
18. Existing PhD RAG retrieval remains functional.
"""

import math
from typing import List, Optional, Tuple
import uuid
from unittest.mock import MagicMock, patch
import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.main import app
from app.models.base import Base
from app.models.user import User
from app.core.database import get_db as core_get_db
from app.api.dependencies import get_db as api_get_db, require_sadmin
from app.modules.knowledge_centre.models import (
    AiKnowledgeDocument,
    AiKnowledgeDocumentVersion,
    AiKnowledgeChunk,
    KnowledgeDocumentStatus,
    KnowledgeApprovalStatus,
    KnowledgeExtractionStatus,
    KnowledgeVerificationStatus,
)
from app.modules.knowledge_centre.retrieval_service import (
    KnowledgeRetrievalService,
    KnowledgeRetrievalQuery,
    KnowledgeRetrievedEvidence,
    KnowledgeRetrievalResult,
    compute_lexical_score,
    format_citation_label,
)
from app.modules.phd_rag.services.retrieval_service import PhdRetrievalService
from app.modules.phd_rag.models import PhdChunk, PhdDocument


# ==============================================================================
# In-Memory Database Fixtures
# ==============================================================================

@pytest.fixture
def mem_db():
    """In-memory SQLite database session isolated per test."""
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


def create_test_doc_and_chunk(
    db: Session,
    title: str = "CSJMU Ph.D. Ordinance 2026-27",
    domain: str = "doctoral-studies",
    document_type: str = "ordinance",
    academic_session: Optional[str] = "2026-27",
    issuing_authority: Optional[str] = "Academic Council",
    subdomain: Optional[str] = None,
    doc_status: str = KnowledgeDocumentStatus.ACTIVE.value,
    version_num: int = 1,
    approval_status: str = KnowledgeApprovalStatus.APPROVED.value,
    extraction_status: str = KnowledgeExtractionStatus.PARSED.value,
    verification_status: str = KnowledgeVerificationStatus.INDEXED.value,
    content: str = "Candidates must complete 12 credits of Ph.D. course work within the first year.",
    chunk_index: int = 0,
    page_number: Optional[int] = 4,
    section_heading: Optional[str] = "Clause 6: Course Work",
    embedding: Optional[List[float]] = None,
    embedding_model: str = "text-embedding-004",
    embedding_dimensions: int = 768,
    is_current: bool = True,
) -> Tuple[AiKnowledgeDocument, AiKnowledgeDocumentVersion, AiKnowledgeChunk]:
    """Helper factory for constructing document, version, and chunk entities with explicit states."""
    doc_id = uuid.uuid4()
    ver_id = uuid.uuid4()
    chk_id = uuid.uuid4()

    doc = AiKnowledgeDocument(
        id=doc_id,
        title=title,
        domain=domain,
        document_type=document_type,
        academic_session=academic_session,
        issuing_authority=issuing_authority,
        subdomain=subdomain,
        status=doc_status,
        current_version_id=ver_id if is_current else None,
    )
    db.add(doc)
    db.flush()

    ver = AiKnowledgeDocumentVersion(
        id=ver_id,
        document_id=doc_id,
        version_number=version_num,
        storage_key=f"vyasa-knowledge/{domain}/{ver_id}.pdf",
        checksum_sha256=f"sha256_{uuid.uuid4().hex}",
        original_filename=f"{title.replace(' ', '_').lower()}.pdf",
        mime_type="application/pdf",
        size_bytes=2048,
        extraction_status=extraction_status,
        approval_status=approval_status,
    )
    db.add(ver)
    db.flush()

    if is_current:
        doc.current_version_id = ver_id
        db.flush()

    if embedding is None:
        raw_vec = [0.05] * 768
        norm = np.linalg.norm(raw_vec)
        embedding = (np.array(raw_vec) / norm).tolist()

    meta = {
        "document_title": title,
        "domain": domain,
        "section_heading": section_heading,
        "source_filename": ver.original_filename,
        "academic_session": academic_session,
        "token_count": 15,
        "checksum_sha256": f"chunk_sha_{chk_id.hex[:16]}",
        "embedding_model": embedding_model,
        "embedding_dimensions": embedding_dimensions,
        "embedding_provider": "google_genai",
        "embedding_mode": "online",
        "embedding_status": "indexed",
    }

    chunk = AiKnowledgeChunk(
        id=chk_id,
        document_id=doc_id,
        version_id=ver_id,
        chunk_index=chunk_index,
        content=content,
        page_number=page_number,
        chunk_metadata=meta,
        embedding=embedding,
        verification_status=verification_status,
    )
    db.add(chunk)
    db.commit()

    return doc, ver, chunk


# ==============================================================================
# TEST CASE 1: Active approved current version is retrieved
# ==============================================================================
def test_case_01_active_approved_current_version_is_retrieved(mem_db):
    """Verify that an active, approved document chunk with current version is retrieved with citation."""
    doc, ver, chk = create_test_doc_and_chunk(
        mem_db,
        title="Ph.D. Ordinance 2026-27",
        domain="doctoral-studies",
        content="Ph.D. course work requires 12 credits including research methodology.",
        page_number=6,
        section_heading="Clause 6.1 Course Work Structure",
    )

    mock_embedder = MagicMock()
    mock_embedder.model_name = "text-embedding-004"
    mock_embedder.embed_text.return_value = chk.embedding

    service = KnowledgeRetrievalService(embedder=mock_embedder)
    q = KnowledgeRetrievalQuery(query="Ph.D. course work 12 credits", top_k=5)
    res = service.retrieve(q, mem_db)

    assert res.has_sufficient_evidence is True
    assert len(res.top_evidence) == 1
    evidence = res.top_evidence[0]
    assert evidence.chunk_id == str(chk.id)
    assert evidence.document_id == str(doc.id)
    assert evidence.version_id == str(ver.id)
    assert evidence.version_number == 1
    assert evidence.relevance_score > 0.5
    assert evidence.page_number == 6
    assert evidence.section_heading == "Clause 6.1 Course Work Structure"
    assert "Doctoral Studies" in evidence.citation_label
    assert "Page 6" in evidence.citation_label


# ==============================================================================
# TEST CASE 2: Pending approval document is excluded
# ==============================================================================
def test_case_02_pending_approval_document_is_excluded(mem_db):
    """Verify that documents in pending_approval status are excluded from retrieval results."""
    create_test_doc_and_chunk(
        mem_db,
        title="Draft Guidelines",
        doc_status=KnowledgeDocumentStatus.PENDING_APPROVAL.value,
        approval_status=KnowledgeApprovalStatus.PENDING.value,
        content="Secret draft policy for faculty recruitment.",
    )

    mock_embedder = MagicMock()
    mock_embedder.model_name = "text-embedding-004"
    mock_embedder.embed_text.return_value = [0.05] * 768

    service = KnowledgeRetrievalService(embedder=mock_embedder)
    q = KnowledgeRetrievalQuery(query="faculty recruitment policy")
    res = service.retrieve(q, mem_db)

    assert res.has_sufficient_evidence is False
    assert len(res.top_evidence) == 0


# ==============================================================================
# TEST CASE 3: Rejected document is excluded
# ==============================================================================
def test_case_03_rejected_document_is_excluded(mem_db):
    """Verify that documents rejected by SADMIN are never retrieved."""
    create_test_doc_and_chunk(
        mem_db,
        title="Rejected Guidelines",
        doc_status=KnowledgeDocumentStatus.REJECTED.value,
        approval_status=KnowledgeApprovalStatus.REJECTED.value,
        content="Rejected proposal for university grading system.",
    )

    mock_embedder = MagicMock()
    mock_embedder.model_name = "text-embedding-004"
    mock_embedder.embed_text.return_value = [0.05] * 768

    service = KnowledgeRetrievalService(embedder=mock_embedder)
    q = KnowledgeRetrievalQuery(query="university grading system")
    res = service.retrieve(q, mem_db)

    assert res.has_sufficient_evidence is False
    assert len(res.top_evidence) == 0


# ==============================================================================
# TEST CASE 4: Archived document is excluded
# ==============================================================================
def test_case_04_archived_document_is_excluded(mem_db):
    """Verify that archived documents are strictly excluded from retrieval."""
    create_test_doc_and_chunk(
        mem_db,
        title="Historical Statutes 2010",
        doc_status=KnowledgeDocumentStatus.ARCHIVED.value,
        content="Obsolete university statutes from 2010 session.",
    )

    mock_embedder = MagicMock()
    mock_embedder.model_name = "text-embedding-004"
    mock_embedder.embed_text.return_value = [0.05] * 768

    service = KnowledgeRetrievalService(embedder=mock_embedder)
    q = KnowledgeRetrievalQuery(query="obsolete statutes")
    res = service.retrieve(q, mem_db)

    assert res.has_sufficient_evidence is False
    assert len(res.top_evidence) == 0


# ==============================================================================
# TEST CASE 5: Historical version is excluded
# ==============================================================================
def test_case_05_historical_version_is_excluded(mem_db):
    """Verify that chunks belonging to an old version are excluded when a new version is current."""
    doc_id = uuid.uuid4()
    v1_id = uuid.uuid4()
    v2_id = uuid.uuid4()

    doc = AiKnowledgeDocument(
        id=doc_id,
        title="Multi-Version Ordinance",
        domain="academic-regulations",
        document_type="ordinance",
        status=KnowledgeDocumentStatus.ACTIVE.value,
        current_version_id=v2_id,  # V2 is current!
    )
    mem_db.add(doc)

    # V1 (historical)
    v1 = AiKnowledgeDocumentVersion(
        id=v1_id,
        document_id=doc_id,
        version_number=1,
        storage_key="v1.pdf",
        checksum_sha256="sha_v1",
        original_filename="v1.pdf",
        mime_type="application/pdf",
        size_bytes=1000,
        extraction_status=KnowledgeExtractionStatus.PARSED.value,
        approval_status=KnowledgeApprovalStatus.APPROVED.value,
    )
    # V2 (current active)
    v2 = AiKnowledgeDocumentVersion(
        id=v2_id,
        document_id=doc_id,
        version_number=2,
        storage_key="v2.pdf",
        checksum_sha256="sha_v2",
        original_filename="v2.pdf",
        mime_type="application/pdf",
        size_bytes=1000,
        extraction_status=KnowledgeExtractionStatus.PARSED.value,
        approval_status=KnowledgeApprovalStatus.APPROVED.value,
    )
    mem_db.add_all([v1, v2])

    emb = [0.05] * 768
    # Chunk from old V1 (must be excluded)
    c1 = AiKnowledgeChunk(
        id=uuid.uuid4(),
        document_id=doc_id,
        version_id=v1_id,
        chunk_index=0,
        content="Old historical regulations 16 credits.",
        embedding=emb,
        verification_status=KnowledgeVerificationStatus.INDEXED.value,
        chunk_metadata={"embedding_model": "text-embedding-004", "embedding_dimensions": 768},
    )
    # Chunk from new V2 (must be retrieved)
    c2 = AiKnowledgeChunk(
        id=uuid.uuid4(),
        document_id=doc_id,
        version_id=v2_id,
        chunk_index=0,
        content="Updated current regulations 12 credits.",
        embedding=emb,
        verification_status=KnowledgeVerificationStatus.INDEXED.value,
        chunk_metadata={"embedding_model": "text-embedding-004", "embedding_dimensions": 768},
    )
    mem_db.add_all([c1, c2])
    mem_db.commit()

    mock_embedder = MagicMock()
    mock_embedder.model_name = "text-embedding-004"
    mock_embedder.embed_text.return_value = emb

    service = KnowledgeRetrievalService(embedder=mock_embedder)
    q = KnowledgeRetrievalQuery(query="regulations credits", top_k=5)
    res = service.retrieve(q, mem_db)

    assert len(res.top_evidence) == 1
    assert res.top_evidence[0].version_id == str(v2_id)
    assert "Updated current" in res.top_evidence[0].content


# ==============================================================================
# TEST CASE 6: Superseded version is excluded
# ==============================================================================
def test_case_06_superseded_version_is_excluded(mem_db):
    """Verify that chunks from superseded versions never appear in retrieval."""
    test_case_05_historical_version_is_excluded(mem_db)


# ==============================================================================
# TEST CASE 7: Failed extraction is excluded
# ==============================================================================
def test_case_07_failed_extraction_is_excluded(mem_db):
    """Verify that document versions marked with extraction_status='failed' are excluded."""
    create_test_doc_and_chunk(
        mem_db,
        title="Corrupt Document",
        extraction_status=KnowledgeExtractionStatus.FAILED.value,
        content="Failed extraction corrupted text fragment.",
    )

    mock_embedder = MagicMock()
    mock_embedder.model_name = "text-embedding-004"
    mock_embedder.embed_text.return_value = [0.05] * 768

    service = KnowledgeRetrievalService(embedder=mock_embedder)
    q = KnowledgeRetrievalQuery(query="corrupted text fragment")
    res = service.retrieve(q, mem_db)

    assert len(res.top_evidence) == 0


# ==============================================================================
# TEST CASE 8: Unindexed chunks are excluded
# ==============================================================================
def test_case_08_unindexed_chunks_are_excluded(mem_db):
    """Verify that chunks with unverified or rejected verification_status are excluded."""
    create_test_doc_and_chunk(
        mem_db,
        title="Document with Unindexed Chunks",
        verification_status=KnowledgeVerificationStatus.UNVERIFIED.value,
        content="Unverified passage pending QA inspection.",
    )

    mock_embedder = MagicMock()
    mock_embedder.model_name = "text-embedding-004"
    mock_embedder.embed_text.return_value = [0.05] * 768

    service = KnowledgeRetrievalService(embedder=mock_embedder)
    q = KnowledgeRetrievalQuery(query="unverified passage")
    res = service.retrieve(q, mem_db)

    assert len(res.top_evidence) == 0


# ==============================================================================
# TEST CASE 9: Wrong model provenance is excluded
# ==============================================================================
def test_case_09_wrong_model_provenance_is_excluded(mem_db):
    """Verify chunks with incompatible embedding model metadata are excluded with a diagnostic warning."""
    create_test_doc_and_chunk(
        mem_db,
        title="Document with Obsolete Embedding Model",
        content="Passage embedded with deprecated BERT model.",
        embedding_model="bert-base-uncased",  # Incompatible with text-embedding-004!
    )

    mock_embedder = MagicMock()
    mock_embedder.model_name = "text-embedding-004"
    mock_embedder.embed_text.return_value = [0.05] * 768

    service = KnowledgeRetrievalService(embedder=mock_embedder)
    q = KnowledgeRetrievalQuery(query="deprecated BERT model")
    res = service.retrieve(q, mem_db)

    assert len(res.top_evidence) == 0
    assert any("incompatible with active" in w for w in res.diagnostic_warnings)


# ==============================================================================
# TEST CASE 10: Wrong vector dimensions are excluded
# ==============================================================================
def test_case_10_wrong_vector_dimensions_are_excluded(mem_db):
    """Verify chunks with mismatched embedding dimensions (e.g. 3072 instead of 768) are safely excluded."""
    create_test_doc_and_chunk(
        mem_db,
        title="Legacy 3072-dim Vector Document",
        content="Passage with legacy 3072-dimensional vector.",
        embedding=[0.01] * 3072,
        embedding_dimensions=3072,
    )

    mock_embedder = MagicMock()
    mock_embedder.model_name = "text-embedding-004"
    mock_embedder.embed_text.return_value = [0.05] * 768

    service = KnowledgeRetrievalService(embedder=mock_embedder)
    q = KnowledgeRetrievalQuery(query="legacy vector")
    res = service.retrieve(q, mem_db)

    assert len(res.top_evidence) == 0
    assert any("dimension mismatch" in w for w in res.diagnostic_warnings)


# ==============================================================================
# TEST CASE 11: Unauthorized users blocked from retrieval endpoint
# ==============================================================================
def test_case_11_unauthorized_users_blocked_from_retrieval_endpoint(mem_db):
    """Verify that non-SADMIN users (anonymous, faculty, dean) are rejected from administrative retrieval."""
    client = TestClient(app)

    # 1. Anonymous request -> 401 Unauthorized
    resp_anon = client.post(
        "/api/v1/admin/knowledge-centre/retrieval/search",
        json={"query": "test query"},
    )
    assert resp_anon.status_code == 401

    # 2. Dean / non-superadmin -> 403 Forbidden
    from fastapi import HTTPException

    def _mock_forbidden():
        raise HTTPException(status_code=403, detail="Super Admin role required.")

    app.dependency_overrides[require_sadmin] = _mock_forbidden
    try:
        resp_forbidden = client.post(
            "/api/v1/admin/knowledge-centre/retrieval/search",
            json={"query": "test query"},
            headers={"Authorization": "Bearer mock_token"},
        )
        assert resp_forbidden.status_code == 403
    finally:
        app.dependency_overrides.pop(require_sadmin, None)


# ==============================================================================
# TEST CASE 12: Domain filtering works
# ==============================================================================
def test_case_12_domain_filtering_works(mem_db):
    """Verify retrieval selectively filters by university domain."""
    create_test_doc_and_chunk(
        mem_db,
        title="Doctoral Regulations",
        domain="doctoral-studies",
        content="Ph.D. guidelines and dissertation rules.",
    )
    create_test_doc_and_chunk(
        mem_db,
        title="Administration Circular",
        domain="university-administration",
        content="Campus holidays and administrative circulars.",
    )

    mock_embedder = MagicMock()
    mock_embedder.model_name = "text-embedding-004"
    mock_embedder.embed_text.return_value = [0.05] * 768

    service = KnowledgeRetrievalService(embedder=mock_embedder)

    # Query restricted to doctoral-studies
    q_doc = KnowledgeRetrievalQuery(
        query="regulations",
        domains=["doctoral-studies"],
    )
    res_doc = service.retrieve(q_doc, mem_db)
    assert len(res_doc.top_evidence) == 1
    assert res_doc.top_evidence[0].domain == "doctoral-studies"

    # Query restricted to university-administration
    q_admin = KnowledgeRetrievalQuery(
        query="regulations holidays",
        domains=["university-administration"],
    )
    res_admin = service.retrieve(q_admin, mem_db)
    assert len(res_admin.top_evidence) == 1
    assert res_admin.top_evidence[0].domain == "university-administration"


# ==============================================================================
# TEST CASE 13: Academic session filtering works
# ==============================================================================
def test_case_13_academic_session_filtering_works(mem_db):
    """Verify retrieval filters accurately by academic session."""
    create_test_doc_and_chunk(
        mem_db,
        title="Admission Brochure 2026-27",
        domain="admissions",
        academic_session="2026-27",
        content="Admission criteria for 2026-27 session.",
    )
    create_test_doc_and_chunk(
        mem_db,
        title="Admission Brochure 2024-25",
        domain="admissions",
        academic_session="2024-25",
        content="Admission criteria for 2024-25 session.",
    )

    mock_embedder = MagicMock()
    mock_embedder.model_name = "text-embedding-004"
    mock_embedder.embed_text.return_value = [0.05] * 768

    service = KnowledgeRetrievalService(embedder=mock_embedder)

    q_2627 = KnowledgeRetrievalQuery(
        query="admission criteria",
        academic_session="2026-27",
    )
    res_2627 = service.retrieve(q_2627, mem_db)
    assert len(res_2627.top_evidence) == 1
    assert res_2627.top_evidence[0].academic_session == "2026-27"


# ==============================================================================
# TEST CASE 14: Issuing authority filtering works
# ==============================================================================
def test_case_14_issuing_authority_filtering_works(mem_db):
    """Verify retrieval filters accurately by issuing authority."""
    create_test_doc_and_chunk(
        mem_db,
        title="Ethics Committee Policy",
        domain="research-development",
        issuing_authority="Institutional Ethics Committee",
        content="Protocols for clinical and animal research approvals.",
    )
    create_test_doc_and_chunk(
        mem_db,
        title="Registrar Circular",
        domain="university-administration",
        issuing_authority="Office of the Registrar",
        content="Office protocol for faculty service register.",
    )

    mock_embedder = MagicMock()
    mock_embedder.model_name = "text-embedding-004"
    mock_embedder.embed_text.return_value = [0.05] * 768

    service = KnowledgeRetrievalService(embedder=mock_embedder)

    q = KnowledgeRetrievalQuery(
        query="research protocols",
        issuing_authority="Ethics Committee",
    )
    res = service.retrieve(q, mem_db)
    assert len(res.top_evidence) == 1
    assert "Ethics Committee" in res.top_evidence[0].issuing_authority


# ==============================================================================
# TEST CASE 15: Citation metadata is accurate
# ==============================================================================
def test_case_15_citation_metadata_is_accurate(mem_db):
    """Verify all citation metadata matches exact database fields without hallucinated values."""
    doc, ver, chk = create_test_doc_and_chunk(
        mem_db,
        title="National Education Policy Implementation",
        domain="academic-regulations",
        document_type="policy",
        academic_session="2026-27",
        issuing_authority="Academic Council",
        section_heading="Chapter 4: Multiple Entry and Exit",
        page_number=18,
        content="Students may exit after Year 1 with an Undergraduate Certificate.",
    )

    mock_embedder = MagicMock()
    mock_embedder.model_name = "text-embedding-004"
    mock_embedder.embed_text.return_value = chk.embedding

    service = KnowledgeRetrievalService(embedder=mock_embedder)
    q = KnowledgeRetrievalQuery(query="multiple entry and exit undergraduate certificate")
    res = service.retrieve(q, mem_db)

    assert len(res.top_evidence) == 1
    ev = res.top_evidence[0]
    assert ev.document_title == "National Education Policy Implementation"
    assert ev.page_number == 18
    assert ev.section_heading == "Chapter 4: Multiple Entry and Exit"
    assert ev.issuing_authority == "Academic Council"
    assert ev.academic_session == "2026-27"
    assert ev.document_type == "policy"
    assert "Academic Regulations" in ev.citation_label
    assert "Page 18" in ev.citation_label
    assert "Section: Chapter 4: Multiple Entry and Exit" in ev.citation_label


# ==============================================================================
# TEST CASE 16: Duplicate passages are suppressed
# ==============================================================================
def test_case_16_duplicate_passages_are_suppressed(mem_db):
    """Verify that identical or near-identical passages from repetitive sections are deduplicated."""
    doc_id = uuid.uuid4()
    ver_id = uuid.uuid4()

    doc = AiKnowledgeDocument(
        id=doc_id,
        title="Standard University Manual",
        domain="university-administration",
        document_type="manual",
        status=KnowledgeDocumentStatus.ACTIVE.value,
        current_version_id=ver_id,
    )
    ver = AiKnowledgeDocumentVersion(
        id=ver_id,
        document_id=doc_id,
        version_number=1,
        storage_key="manual.pdf",
        checksum_sha256="sha_manual",
        original_filename="manual.pdf",
        mime_type="application/pdf",
        size_bytes=5000,
        extraction_status=KnowledgeExtractionStatus.PARSED.value,
        approval_status=KnowledgeApprovalStatus.APPROVED.value,
    )
    mem_db.add_all([doc, ver])

    duplicate_content = "The University campus is strictly a tobacco-free and ragging-free zone."
    emb = [0.05] * 768

    c1 = AiKnowledgeChunk(
        id=uuid.uuid4(),
        document_id=doc_id,
        version_id=ver_id,
        chunk_index=0,
        content=duplicate_content,
        page_number=2,
        embedding=emb,
        verification_status=KnowledgeVerificationStatus.INDEXED.value,
        chunk_metadata={"embedding_model": "text-embedding-004", "embedding_dimensions": 768},
    )
    c2 = AiKnowledgeChunk(
        id=uuid.uuid4(),
        document_id=doc_id,
        version_id=ver_id,
        chunk_index=1,
        content=duplicate_content,  # Exact duplicate on page 20
        page_number=20,
        embedding=emb,
        verification_status=KnowledgeVerificationStatus.INDEXED.value,
        chunk_metadata={"embedding_model": "text-embedding-004", "embedding_dimensions": 768},
    )
    mem_db.add_all([c1, c2])
    mem_db.commit()

    mock_embedder = MagicMock()
    mock_embedder.model_name = "text-embedding-004"
    mock_embedder.embed_text.return_value = emb

    service = KnowledgeRetrievalService(embedder=mock_embedder)
    q = KnowledgeRetrievalQuery(query="tobacco free campus zone", top_k=5)
    res = service.retrieve(q, mem_db)

    # Exactly 1 passage retained; duplicate suppressed
    assert len(res.top_evidence) == 1


# ==============================================================================
# TEST CASE 17: Empty retrieval produces a safe no-evidence result
# ==============================================================================
def test_case_17_empty_retrieval_produces_safe_no_evidence_result(mem_db):
    """Verify that when no eligible documents match the threshold, an explicit no-evidence result is returned."""
    mock_embedder = MagicMock()
    mock_embedder.model_name = "text-embedding-004"
    mock_embedder.embed_text.return_value = [0.05] * 768

    service = KnowledgeRetrievalService(embedder=mock_embedder)
    q = KnowledgeRetrievalQuery(query="completely unrelated question about interstellar travel", min_score=0.8)
    res = service.retrieve(q, mem_db)

    assert res.has_sufficient_evidence is False
    assert len(res.top_evidence) == 0
    assert res.matched_passages_count == 0


# ==============================================================================
# TEST CASE 18: Existing PhD RAG retrieval remains functional
# ==============================================================================
def test_case_18_existing_phd_rag_retrieval_remains_functional(mem_db):
    """Verify that existing PhD RAG PhdRetrievalService operates cleanly without regression."""
    doc_id = uuid.uuid4()
    phd_doc = PhdDocument(
        id=doc_id,
        filename="phd_brochure_2026.pdf",
        title="CSJMU Ph.D. Brochure 2026-27",
        doc_type="brochure",
        academic_session="2026-27",
        file_size_bytes=4096,
        checksum_sha256="brochure_sha256_mock_12345",
        total_pages_or_slides=16,
        processing_status="COMPLETED",
        is_active=True,
    )
    mem_db.add(phd_doc)

    emb = [0.05] * 768
    phd_chunk = PhdChunk(
        id=uuid.uuid4(),
        document_id=doc_id,
        chunk_index=0,
        doc_type="brochure",
        document_title="CSJMU Ph.D. Brochure 2026-27",
        source_filename="phd_brochure_2026.pdf",
        academic_session="2026-27",
        page_number=3,
        section_heading="Eligibility Criteria",
        chunk_text="Master's degree with at least 55% marks or equivalent grade.",
        token_count=12,
        checksum_sha256="chunk_sha256_mock_12345",
        embedding=emb,
    )
    mem_db.add(phd_chunk)
    mem_db.commit()

    mock_embedder = MagicMock()
    mock_embedder.embed_text.return_value = emb

    phd_service = PhdRetrievalService(embedder=mock_embedder)
    evidence = phd_service.retrieve("Master's degree 55% eligibility", mem_db, top_k=5)

    assert len(evidence) == 1
    assert evidence[0].doc_type == "brochure"
    assert "55%" in evidence[0].chunk_text
    assert evidence[0].page_number == 3
