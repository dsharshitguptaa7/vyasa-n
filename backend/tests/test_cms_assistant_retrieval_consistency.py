# -*- coding: utf-8 -*-
"""
Test Suite: CMS vs AI Assistant Authoritative Retrieval Consistency
Verifies that:
1. Active approved documents in CMS (AiKnowledgeDocument) are immediately visible in the AI Assistant status.
2. Verified passage chunks in CMS (AiKnowledgeChunk) are counted accurately without hardcoded numbers.
3. Public Assistant chat endpoint (/public/phd-admission/chat) retrieves evidence from CMS documents.
4. User query 'eligible fellowship' retrieves from 'ROLLING CIRCULATION PhD ADMISSION 2026 27 EDITABLE OCR' and generates grounded citations.
5. Unapproved, draft, or archived CMS documents are strictly excluded from status counts and retrieval.
6. Fallback abstention correctly triggers only when genuine evidence is absent.
"""

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
from app.api.dependencies import get_db as api_get_db
from app.modules.knowledge_centre.models import (
    AiKnowledgeDocument,
    AiKnowledgeDocumentVersion,
    AiKnowledgeChunk,
    KnowledgeDocumentStatus,
    KnowledgeApprovalStatus,
    KnowledgeExtractionStatus,
    KnowledgeVerificationStatus,
)
from app.modules.phd_rag.models import PhdDocument, PhdChunk
from app.modules.phd_rag.services.retrieval_service import PhdRetrievalService
from app.modules.phd_rag.services.llm_service import PhdLLMService


# ==============================================================================
# Isolated SQLite In-Memory Database Fixture
# ==============================================================================

@pytest.fixture
def mem_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def test_client(mem_db: Session):
    def override_get_db():
        try:
            yield mem_db
        finally:
            pass

    app.dependency_overrides[api_get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(api_get_db, None)


@pytest.fixture
def mock_embedder():
    embedder = MagicMock()
    embedder.dimensions = 768
    embedder.model_name = "gemini-embedding-001"
    # Deterministic 768-dim vector
    v = np.zeros(768, dtype=np.float32)
    v[0] = 1.0
    embedder.embed_text.return_value = v.tolist()
    return embedder


# ==============================================================================
# Helper to Seed Rolling Circulation Document in CMS
# ==============================================================================

def create_rolling_circulation_cms_doc(
    db: Session,
    status: str = KnowledgeDocumentStatus.ACTIVE.value,
    approval_status: str = KnowledgeApprovalStatus.APPROVED.value,
    chunk_count: int = 7,
    domain: str = "doctoral-studies",
) -> AiKnowledgeDocument:
    doc_id = uuid.uuid4()
    ver_id = uuid.uuid4()

    doc = AiKnowledgeDocument(
        id=doc_id,
        title="ROLLING CIRCULATION PhD ADMISSION 2026 27 EDITABLE OCR",
        description="Official Rolling PhD Admission Guidelines and Fellowship Provisions 2026-27",
        domain=domain,
        subdomain="phd-admissions",
        document_type="guideline",
        academic_session="2026-27",
        issuing_authority="Research Degree Committee, CSJMU",
        status=status,
        current_version_id=ver_id,
    )
    db.add(doc)
    db.flush()

    ver = AiKnowledgeDocumentVersion(
        id=ver_id,
        document_id=doc_id,
        version_number=1,
        storage_key="vyasa-knowledge/doctoral-studies/rolling-circulation-2026.pdf",
        checksum_sha256="abc123rollingcirculationhash4567890123456789012345678901234567890123",
        original_filename="ROLLING CIRCULATION PhD ADMISSION 2026 27 EDITABLE OCR.pdf",
        mime_type="application/pdf",
        size_bytes=452100,
        extraction_status=KnowledgeExtractionStatus.INDEXED.value,
        approval_status=approval_status,
    )
    db.add(ver)
    db.flush()

    # Create 7 passage chunks
    sample_texts = [
        "Clause 1. Rolling Ph.D. Admission overview for academic session 2026-27.",
        "Clause 2. Eligible fellowship categories: Candidates who have qualified UGC-NET (including JRF), "
        "CSIR-NET (including JRF), ICMR, ICAR, or any national fellowship are eligible for direct interview "
        "without appearing in the written entrance test.",
        "Clause 3. University Fellowship: CSJMU provides institutional research fellowship of Rs 15,000 per month "
        "for eligible meritorious full-time doctoral scholars in selected departments.",
        "Clause 4. Application procedure for national fellowship awardees and self-funded scholars.",
        "Clause 5. Minimum eligibility criteria: Master's degree with minimum 55% marks (50% for SC/ST/OBC).",
        "Clause 6. Research proposal submission guidelines and interview scoring rubric.",
        "Clause 7. Contact information of the Research & Development Cell, CSJMU Kanpur.",
    ]

    v_emb = np.zeros(768, dtype=np.float32)
    v_emb[0] = 0.95
    v_emb[1] = 0.05
    emb_list = v_emb.tolist()

    for idx in range(chunk_count):
        text = sample_texts[idx] if idx < len(sample_texts) else f"Additional clause {idx+1} provisions."
        chk = AiKnowledgeChunk(
            id=uuid.uuid4(),
            document_id=doc_id,
            version_id=ver_id,
            chunk_index=idx + 1,
            content=text,
            page_number=idx + 1,
            chunk_metadata={
                "section_heading": f"Section {idx+1}",
                "embedding_model": "gemini-embedding-001",
                "embedding_dimensions": 768,
            },
            embedding=emb_list,
            verification_status=KnowledgeVerificationStatus.VERIFIED.value,
        )
        db.add(chk)

    db.commit()
    db.refresh(doc)
    return doc


# ==============================================================================
# Unit & Integration Tests
# ==============================================================================

def test_01_assistant_status_reflects_active_cms_document_and_passages(test_client: TestClient, mem_db: Session):
    """
    When CMS has an active approved document with 7 passages (Rolling Circulation),
    the Assistant status endpoint must return total_documents=1 and total_chunks=7.
    """
    create_rolling_circulation_cms_doc(mem_db, chunk_count=7)

    res = test_client.get("/api/public/phd-admission/status")
    assert res.status_code == 200
    data = res.json()

    assert data["success"] is True
    assert data["is_ready"] is True
    assert data["total_documents"] == 1
    assert data["total_chunks"] == 7
    assert len(data["documents"]) == 1
    assert data["documents"][0]["title"] == "ROLLING CIRCULATION PhD ADMISSION 2026 27 EDITABLE OCR"
    assert data["documents"][0]["chunk_count"] == 7


def test_02_assistant_status_excludes_draft_and_unapproved_cms_documents(test_client: TestClient, mem_db: Session):
    """
    Draft or pending approval documents in CMS must NOT be counted in the Assistant status.
    """
    # 1 unapproved pending document
    create_rolling_circulation_cms_doc(
        mem_db,
        status=KnowledgeDocumentStatus.PENDING_APPROVAL.value,
        approval_status=KnowledgeApprovalStatus.PENDING.value,
        chunk_count=7,
    )

    res = test_client.get("/api/public/phd-admission/status")
    assert res.status_code == 200
    data = res.json()

    assert data["total_documents"] == 0
    assert data["total_chunks"] == 0
    assert data["is_ready"] is False


def test_03_assistant_retrieves_eligible_fellowship_from_cms_document(mem_db: Session, mock_embedder):
    """
    Query 'eligible fellowship' must retrieve the fellowship chunk from the CMS document
    and rank it as the top evidence.
    """
    create_rolling_circulation_cms_doc(mem_db, chunk_count=7)

    service = PhdRetrievalService(embedder=mock_embedder)
    evidence = service.retrieve("eligible fellowship", mem_db, top_k=3)

    assert len(evidence) > 0
    top_chunk = evidence[0]
    assert "fellowship" in top_chunk.chunk_text.lower()
    assert top_chunk.document_title == "ROLLING CIRCULATION PhD ADMISSION 2026 27 EDITABLE OCR"
    assert "ROLLING CIRCULATION" in top_chunk.citation_label


def test_04_public_chat_answers_eligible_fellowship_with_citations(test_client: TestClient, mem_db: Session):
    """
    End-to-end API test: Calling /public/phd-admission/chat with query 'eligible fellowship'
    must produce a grounded response with citations, NOT a fallback abstention.
    """
    create_rolling_circulation_cms_doc(mem_db, chunk_count=7)

    payload = {
        "query": "What are the rules for eligible fellowship candidates?",
    }
    res = test_client.post("/api/public/phd-admission/chat", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["success"] is True
    assert data["is_grounded"] is True
    assert len(data["citations"]) > 0
    assert any("ROLLING CIRCULATION" in c["citation_label"] for c in data["citations"])
    assert "fellowship" in data["answer"].lower()
    # Must NOT return fallback abstention
    assert "do not contain information regarding your query" not in data["answer"].lower()


def test_05_domain_filtering_in_status_and_chat(test_client: TestClient, mem_db: Session):
    """
    Verifies that domain filters work consistently:
    Filtering by 'doctoral-studies' includes the document; filtering by 'research-development' excludes it.
    """
    create_rolling_circulation_cms_doc(mem_db, domain="doctoral-studies", chunk_count=7)

    # 1. Matching domain
    res_match = test_client.get("/api/public/phd-admission/status?domain=doctoral-studies")
    assert res_match.status_code == 200
    assert res_match.json()["total_documents"] == 1

    # 2. Non-matching domain
    res_mismatch = test_client.get("/api/public/phd-admission/status?domain=research-development")
    assert res_mismatch.status_code == 200
    assert res_mismatch.json()["total_documents"] == 0


def test_06_unification_with_legacy_phd_documents(test_client: TestClient, mem_db: Session, mock_embedder):
    """
    Verifies that when both legacy PhdDocument and CMS AiKnowledgeDocument exist,
    they are unified seamlessly without duplicate counting.
    """
    # 1. Seed CMS document
    create_rolling_circulation_cms_doc(mem_db, chunk_count=7)

    # 2. Seed legacy PhdDocument
    phd_doc = PhdDocument(
        id=uuid.uuid4(),
        filename="phd-brochure-2627.pdf",
        title="Ph.D. Admission Brochure (2026-27)",
        doc_type="brochure",
        academic_session="2026-27",
        file_size_bytes=19756001,
        checksum_sha256="legacyhashbrochure123456789012345678901234567890123456789012345678",
        total_pages_or_slides=16,
        processing_status="COMPLETED",
        is_active=True,
    )
    mem_db.add(phd_doc)
    mem_db.flush()

    v_emb = [0.95] + [0.0] * 767
    phd_chunk = PhdChunk(
        id=uuid.uuid4(),
        document_id=phd_doc.id,
        chunk_index=1,
        doc_type="brochure",
        document_title="Ph.D. Admission Brochure (2026-27)",
        source_filename="phd-brochure-2627.pdf",
        academic_session="2026-27",
        page_number=1,
        chunk_text="General instructions for Ph.D. admissions 2026-27.",
        checksum_sha256="chunkhash12345678901234567890123456789012345678901234567890123456",
        embedding=v_emb,
    )
    mem_db.add(phd_chunk)
    mem_db.commit()

    # Status should reflect 2 distinct documents and 8 total chunks (7 + 1)
    res = test_client.get("/api/public/phd-admission/status")
    assert res.status_code == 200
    data = res.json()
    assert data["total_documents"] == 2
    assert data["total_chunks"] == 8

    # Retrieval should be able to retrieve from both sources
    service = PhdRetrievalService(embedder=mock_embedder)
    ev_fellowship = service.retrieve("eligible fellowship", mem_db)
    assert any("ROLLING CIRCULATION" in e.document_title for e in ev_fellowship)

    ev_brochure = service.retrieve("general instructions admissions", mem_db)
    assert any("Brochure" in e.document_title for e in ev_brochure)


def test_07_abstention_on_unrelated_query(test_client: TestClient, mem_db: Session):
    """
    When a question has no relevant evidence in the university documents,
    the assistant must abstain safely without hallucinating.
    """
    # Empty DB
    payload = {"query": "What is the formula for rocket propellant?"}
    res = test_client.post("/api/public/phd-admission/chat", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["is_grounded"] is False
    assert len(data["citations"]) == 0
    assert "do not contain information" in data["answer"].lower()
