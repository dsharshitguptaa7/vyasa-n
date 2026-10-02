import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.main import app
from app.core.database import SessionLocal
from app.modules.phd_rag.services.document_parser import DocumentParser, RawExtractedItem
from app.modules.phd_rag.services.retrieval_service import PhdRetrievalService
from app.modules.phd_rag.services.llm_service import PhdLLMService
from app.modules.phd_rag.models import PhdDocument, PhdChunk


@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="module")
def api_client():
    with TestClient(app) as c:
        yield c


# ==============================================================================
# 1. EXTRACTION & PARSING TESTS
# ==============================================================================

def test_pdf_extraction_page_level():
    parser = DocumentParser()
    brochure_path = os.path.abspath("data/phd-admission/phd-brochure-2627 (1).pdf")
    if not os.path.exists(brochure_path):
        brochure_path = os.path.abspath("backend/data/phd-admission/phd-brochure-2627 (1).pdf")

    assert os.path.exists(brochure_path), "Brochure PDF must exist"
    res = parser.parse_pdf(brochure_path)

    assert res.file_type == "pdf"
    assert res.doc_type == "brochure"
    assert res.total_units == 16
    assert len(res.empty_units) == 0, "No empty pages should be in brochure"
    assert len(res.checksum_sha256) == 64

    # Check page metadata on first item
    assert res.items[0].unit_index == 1
    assert res.items[0].unit_type == "page"
    assert "CHHATRAPATI SHAHU JI MAHARAJ UNIVERSITY" in res.items[0].text

    # Chunking test
    chunks = parser.chunk_document(res)
    assert len(chunks) > 0
    assert all(c.page_number is not None for c in chunks)
    assert all(c.doc_type == "brochure" for c in chunks)


def test_pptx_slide_level_extraction():
    parser = DocumentParser()
    ppt_path = os.path.abspath("data/phd-admission/PhD Orientation 2026-27 Coursework.pptx")
    if not os.path.exists(ppt_path):
        ppt_path = os.path.abspath("backend/data/phd-admission/PhD Orientation 2026-27 Coursework.pptx")

    assert os.path.exists(ppt_path), "Coursework PPT must exist"
    res = parser.parse_pptx(ppt_path)

    assert res.file_type == "pptx"
    assert res.doc_type == "coursework_ppt"
    assert res.total_units == 8
    assert len(res.empty_units) == 0
    assert len(res.checksum_sha256) == 64

    # Check slide numbers and text
    assert res.items[0].unit_index == 1
    assert res.items[0].unit_type == "slide"
    assert "Ph.D. ORIENTATION" in res.items[0].text

    chunks = parser.chunk_document(res)
    assert len(chunks) == 8
    assert all(c.slide_number is not None for c in chunks)
    assert all(c.page_number is None for c in chunks)


def test_docx_ordinance_extraction():
    parser = DocumentParser()
    docx_path = os.path.abspath("data/phd-admission/Ph.D. Ordinance CSJMU FINAL 2024-25 25.8.2-25 (1).docx")
    if not os.path.exists(docx_path):
        docx_path = os.path.abspath("backend/data/phd-admission/Ph.D. Ordinance CSJMU FINAL 2024-25 25.8.2-25 (1).docx")

    assert os.path.exists(docx_path), "Ordinance DOCX must exist"
    res = parser.parse_docx(docx_path)

    assert res.file_type == "docx"
    assert res.doc_type == "ordinance"
    assert len(res.items) > 0
    assert len(res.checksum_sha256) == 64

    # Verify that clauses/sections contain statutory rules
    chunks = parser.chunk_document(res)
    assert len(chunks) >= 50
    assert any("ordinance" in c.chunk_text.lower() for c in chunks)


def test_parser_unsupported_format_and_missing_file():
    parser = DocumentParser()
    with pytest.raises(FileNotFoundError):
        parser.parse_file("non_existent_file_vyasa_test.pdf")

    # Unsupported format
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as tf:
        tf.write(b"Hello world")
        tmp_name = tf.name

    try:
        with pytest.raises(ValueError, match="Unsupported file format"):
            parser.parse_file(tmp_name)
    finally:
        os.remove(tmp_name)


# ==============================================================================
# 2. RETRIEVAL TESTS
# ==============================================================================

def test_coursework_question_prioritizes_coursework_ppt(db_session: Session):
    retrieval = PhdRetrievalService()
    query = "How many credits are required for Ph.D. course work?"
    evidence = retrieval.retrieve(query, db_session, top_k=5)

    assert len(evidence) > 0
    # Top chunk MUST be from Course Work PPT per prioritization rule
    assert evidence[0].doc_type == "coursework_ppt"
    assert evidence[0].slide_number is not None
    assert any("credit" in e.chunk_text.lower() for e in evidence)


def test_admission_question_prioritizes_brochure(db_session: Session):
    retrieval = PhdRetrievalService()
    query = "What is the application fee for Ph.D. admission?"
    evidence = retrieval.retrieve(query, db_session, top_k=5)

    assert len(evidence) > 0
    assert evidence[0].doc_type == "brochure"
    assert evidence[0].page_number is not None
    assert "2500" in evidence[0].chunk_text or "application fee" in evidence[0].chunk_text.lower()


def test_ordinance_question_retrieves_ordinance(db_session: Session):
    retrieval = PhdRetrievalService()
    query = "What is the minimum and maximum duration of the Ph.D. programme according to the Ordinance?"
    evidence = retrieval.retrieve(query, db_session, top_k=5)

    assert len(evidence) > 0
    assert any(e.doc_type == "ordinance" for e in evidence)
    assert any("duration" in e.chunk_text.lower() for e in evidence)


def test_cross_document_credit_query_retrieves_both_sources(db_session: Session):
    retrieval = PhdRetrievalService()
    query = "How many credits are required according to the ordinance versus course work ppt?"
    evidence = retrieval.retrieve(query, db_session, top_k=5)

    doc_types = {e.doc_type for e in evidence}
    assert "coursework_ppt" in doc_types, "Must include Course Work PPT"
    assert "ordinance" in doc_types, "Must include Ordinance"


def test_abstention_when_evidence_insufficient():
    llm = PhdLLMService()
    # When evidence is empty
    resp = llm.answer_query(
        query="What is the cricket team captain's name at Kanpur university?",
        evidence=[],
    )
    assert not resp.is_grounded
    assert "do not contain information" in resp.answer.lower()
    assert len(resp.cited_sources) == 0


# ==============================================================================
# 3. PUBLIC API & SECURITY TESTS
# ==============================================================================

def test_public_chat_endpoint_without_login(api_client: TestClient):
    payload = {
        "query": "How many credits are required for Ph.D. course work?",
    }
    response = api_client.post("/api/public/phd-admission/chat", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "12 credits" in data["answer"] or "credits" in data["answer"].lower()
    assert len(data["citations"]) > 0
    assert data["citations"][0]["doc_type"] == "coursework_ppt"
    assert data["is_grounded"] is True


def test_public_suggested_questions_endpoint(api_client: TestClient):
    response = api_client.get("/api/public/phd-admission/suggested-questions")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["questions"]) >= 5
    categories = {q["category"] for q in data["questions"]}
    assert "Course Work" in categories
    assert "Admission & Fees" in categories


def test_public_status_endpoint(api_client: TestClient):
    response = api_client.get("/api/public/phd-admission/status")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["is_ready"] is True
    assert data["total_documents"] == 3
    assert data["total_chunks"] >= 140
    # Ensure no internal filesystem paths or DB credentials leaked
    resp_text = response.text
    assert "C:\\" not in resp_text
    assert "postgresql://" not in resp_text
    assert "password" not in resp_text.lower()


def test_public_chat_rejects_empty_query(api_client: TestClient):
    payload = {"query": " "}
    response = api_client.post("/api/public/phd-admission/chat", json=payload)
    # Validation error or bad request
    assert response.status_code in (400, 422)


# ==============================================================================
# 4. COURSE WORK SOURCE-OF-TRUTH & REGRESSION TESTS
# ==============================================================================

def test_ordinary_coursework_question_source_of_truth(db_session: Session):
    """
    For ordinary Course Work questions, the Course Work Orientation PPT is authoritative.
    Must answer 12 credits, cite Slide 2, and NOT show an unresolved 12 vs 16 conflict.
    """
    retrieval = PhdRetrievalService()
    llm = PhdLLMService()
    query = "How many credits are required for Ph.D. course work?"
    evidence = retrieval.retrieve(query, db_session, top_k=5)

    assert len(evidence) > 0
    assert evidence[0].doc_type == "coursework_ppt"
    assert evidence[0].slide_number == 2

    resp = llm.answer_query(query, evidence)
    assert resp.is_grounded is True
    assert resp.has_conflict is False, "Ordinary coursework query must NOT flag unresolved conflict"
    assert "12 credits" in resp.answer.lower() or "12 credit" in resp.answer.lower()
    assert any(c["doc_type"] == "coursework_ppt" for c in resp.cited_sources)
    # Ordinance 16 credits must NOT displace Slide 2 in top citation
    assert resp.cited_sources[0]["doc_type"] == "coursework_ppt"


def test_explicit_ordinance_question_cites_clause_6(db_session: Session):
    """
    When user explicitly asks what the Ph.D. Ordinance states, must report Clause 6.01
    minimum 16 credits and cite the Ordinance.
    """
    retrieval = PhdRetrievalService()
    llm = PhdLLMService()
    query = "What does the Ph.D. Ordinance say about coursework credits?"
    evidence = retrieval.retrieve(query, db_session, top_k=5)

    assert len(evidence) > 0
    assert evidence[0].doc_type == "ordinance", "Explicit Ordinance query must prioritize Ordinance"

    resp = llm.answer_query(query, evidence)
    assert resp.is_grounded is True
    assert resp.has_conflict is False
    assert "16" in resp.answer
    assert any(c["doc_type"] == "ordinance" for c in resp.cited_sources)


def test_explicit_comparison_query_surfaces_discrepancy(db_session: Session):
    """
    When user asks to compare Ordinance vs PPT, must accurately surface both 12 and 16 credits
    and flag has_conflict = True.
    """
    retrieval = PhdRetrievalService()
    llm = PhdLLMService()
    query = "Is there any discrepancy between the Ordinance and PPT regarding credits?"
    evidence = retrieval.retrieve(query, db_session, top_k=5)

    doc_types = {e.doc_type for e in evidence}
    assert "coursework_ppt" in doc_types
    assert "ordinance" in doc_types

    resp = llm.answer_query(query, evidence)
    assert resp.is_grounded is True
    assert resp.has_conflict is True
    assert "12" in resp.answer and "16" in resp.answer


# ==============================================================================
# 5. RATE LIMITING & SECURITY REGRESSION TESTS
# ==============================================================================

def test_rate_limiter_sliding_window_enforcement():
    from app.modules.phd_rag.rate_limiter import InMemorySlidingWindowRateLimiter

    limiter = InMemorySlidingWindowRateLimiter()
    ip = "192.168.1.100"
    limit = 3
    window = 5

    # 3 allowed
    assert limiter.is_allowed(ip, limit, window)[0] is True
    assert limiter.is_allowed(ip, limit, window)[0] is True
    assert limiter.is_allowed(ip, limit, window)[0] is True

    # 4th blocked
    allowed, retry_after = limiter.is_allowed(ip, limit, window)
    assert allowed is False
    assert retry_after > 0


def test_rate_limiter_safe_proxy_ip_resolution():
    from starlette.requests import Request
    from app.modules.phd_rag.rate_limiter import resolve_client_ip

    # Scenario 1: Request from untrusted peer attempting to spoof X-Forwarded-For
    scope_untrusted = {
        "type": "http",
        "client": ("203.0.113.5", 54321),
        "headers": [
            (b"x-forwarded-for", b"198.51.100.22"),
        ],
    }
    req_untrusted = Request(scope_untrusted)
    # Untrusted client IP must be used, NOT spoofed X-Forwarded-For
    resolved_untrusted = resolve_client_ip(req_untrusted, trusted_proxies={"127.0.0.1"})
    assert resolved_untrusted == "203.0.113.5"

    # Scenario 2: Request from trusted proxy with valid X-Forwarded-For
    scope_trusted = {
        "type": "http",
        "client": ("127.0.0.1", 54321),
        "headers": [
            (b"x-forwarded-for", b"203.0.113.99, 10.0.0.1"),
        ],
    }
    req_trusted = Request(scope_trusted)
    resolved_trusted = resolve_client_ip(req_trusted, trusted_proxies={"127.0.0.1"})
    assert resolved_trusted == "203.0.113.99"


def test_provider_failure_graceful_fallback(db_session: Session):
    """
    When LLM provider times out or fails, assistant must fall back safely
    to offline evidence summary without raising 500 error.
    """
    llm = PhdLLMService(api_key="mock-invalid-key-to-trigger-fallback")
    
    # Mock client generate_content to raise an error
    class MockErrorClient:
        class models:
            @staticmethod
            def generate_content(*args, **kwargs):
                raise TimeoutError("Gemini API hosted connection timed out")
    
    llm._client = MockErrorClient()
    
    evidence = [
        PhdRetrievalService.format_citation_label("Ph.D. Course Work Orientation", None, 2, "12 credits", "2026-27")
    ]
    retrieval = PhdRetrievalService()
    ev = retrieval.retrieve("How many credits are required for Ph.D. course work?", db_session, top_k=2)

    resp = llm.answer_query("How many credits are required for Ph.D. course work?", ev)
    assert resp.is_grounded is True
    assert "12 credits" in resp.answer or "credits" in resp.answer.lower()
    assert "offline-fallback" in resp.model_used

