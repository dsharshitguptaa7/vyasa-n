# -*- coding: utf-8 -*-
"""
Phase 4F Automated Test Suite: Conditional GO Remediation & Final Deployment Gate

Covers:
1. PHASE 4F-A: Mandatory Diagnostics RBAC Fix (require_sadmin enforcement, 403 for scholars, 401 unauth).
2. PHASE 4F-B: Rate Limiter Concurrency & Cleanup (locking serialization, 20-req ceiling, cleanup_expired_records, fail-open).
3. PHASE 4F-C: Background Ingestion Recovery (stale job threshold, prior active version preservation, SADMIN recover-stale endpoint).
4. PHASE 4F-D: Grounding & Citation Transparency (mechanical source attribution, figure validation notices, abstention, conflicts).
"""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import math
import threading
from typing import List, Optional
import uuid
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.main import app
from app.models.base import Base
from app.models.user import User
from app.models.role import Role
from app.core.database import get_db as core_get_db
from app.api.dependencies import get_db as api_get_db, get_current_user, require_sadmin
from app.modules.knowledge_centre.models import (
    AiKnowledgeDocument,
    AiKnowledgeDocumentVersion,
    AiKnowledgeChunk,
    KnowledgeDocumentStatus,
    KnowledgeApprovalStatus,
    KnowledgeExtractionStatus,
    KnowledgeVerificationStatus,
)
from app.modules.knowledge_centre.conversation_models import (
    AiAssistantConversation,
    AiAssistantMessage,
    AiAssistantRateLimit,
)
from app.modules.knowledge_centre.rate_limiter import (
    distributed_rate_limiter,
    DistributedRateLimiter,
)
from app.modules.knowledge_centre.service import (
    knowledge_service,
    DEFAULT_STALE_PROCESSING_THRESHOLD_MINUTES,
)
from app.modules.knowledge_centre.synthesis_service import (
    knowledge_synthesis_service,
    sanitize_assistant_output,
    ScholarCitationItem,
    SynthesisResult,
)
from app.modules.knowledge_centre.retrieval_service import (
    KnowledgeRetrievalResult,
    KnowledgeRetrievedEvidence,
)
from app.modules.knowledge_centre.observability import assistant_observability


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


@pytest.fixture(autouse=True)
def override_db_and_cleanup(mem_db):
    """Automatically mock DB dependency and clean up dependency overrides."""
    app.dependency_overrides[core_get_db] = lambda: mem_db
    app.dependency_overrides[api_get_db] = lambda: mem_db
    yield
    app.dependency_overrides.clear()


def create_db_user(
    db: Session,
    user_id: Optional[uuid.UUID] = None,
    email: str = "scholar@csjmu.ac.in",
    role_name: str = "scholar",
    is_active: bool = True,
) -> User:
    """Helper creating real User and Role records in the test database."""
    role = db.query(Role).filter(Role.name == role_name).first()
    if not role:
        role = Role(id=uuid.uuid4(), name=role_name, description=f"{role_name} role")
        db.add(role)
        db.commit()
    user = User(
        id=user_id or uuid.uuid4(),
        email=email,
        first_name="Dr.",
        last_name="Scholar",
        is_active=is_active,
        roles=[role],
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ==============================================================================
# PHASE 4F-A: Mandatory Diagnostics RBAC Tests
# ==============================================================================

def test_case_01_diagnostics_unauthorized_for_scholars(mem_db):
    """Confirm regular scholars receive HTTP 403 on GET /v1/assistant/diagnostics."""
    scholar_user = create_db_user(mem_db, email="scholar@csjmu.ac.in", role_name="scholar")
    app.dependency_overrides[get_current_user] = lambda: scholar_user

    client = TestClient(app)
    resp = client.get("/api/v1/assistant/diagnostics")
    assert resp.status_code == 403
    error_msg = resp.json().get("message") or resp.json().get("detail", "")
    assert "Super Admin only" in error_msg


def test_case_02_diagnostics_authorized_for_sadmin(mem_db):
    """Confirm central SADMIN receives HTTP 200 on GET /v1/assistant/diagnostics."""
    sadmin_user = create_db_user(mem_db, email="sadmin@csjmu.ac.in", role_name="super_admin")
    app.dependency_overrides[get_current_user] = lambda: sadmin_user
    app.dependency_overrides[require_sadmin] = lambda: sadmin_user

    client = TestClient(app)
    resp = client.get("/api/v1/assistant/diagnostics")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["service"] == "VYASA-AI-Knowledge-Gateway"
    assert "query_metrics" in data
    assert "latency_benchmarks" in data
    # Confirm no private user content or storage paths in diagnostics
    data_str = str(data)
    assert "vyasa-knowledge" not in data_str
    assert "password" not in data_str
    assert "token" not in data_str


def test_case_03_diagnostics_unauthenticated(mem_db):
    """Confirm unauthenticated caller receives HTTP 401 on GET /v1/assistant/diagnostics."""
    # Ensure get_current_user is not overridden
    if get_current_user in app.dependency_overrides:
        del app.dependency_overrides[get_current_user]

    client = TestClient(app)
    resp = client.get("/api/v1/assistant/diagnostics")
    assert resp.status_code == 401


# ==============================================================================
# PHASE 4F-B: Rate Limiter Concurrency & Cleanup Tests
# ==============================================================================

def test_case_04_rate_limiter_sequential_and_rejection(mem_db):
    """Confirm 20 requests succeed within the window and the 21st is rejected with Retry-After."""
    user_id = uuid.uuid4()
    limiter = DistributedRateLimiter(window_seconds=60, max_requests=20)

    # 20 sequential allowed
    for _ in range(20):
        retry_after = limiter.check_and_record(user_id, mem_db)
        assert retry_after is None

    # 21st rejected
    retry_after = limiter.check_and_record(user_id, mem_db)
    assert retry_after is not None
    assert retry_after > 0
    assert retry_after <= 60


def test_case_05_rate_limiter_thread_concurrency(mem_db):
    """
    Simulate concurrent requests across threads for the same user.
    Verifies that the serialized sliding window enforces the limit without race overflows.
    """
    user_id = uuid.uuid4()
    limiter = DistributedRateLimiter(window_seconds=60, max_requests=10)

    allowed_count = 0
    rejected_count = 0
    count_lock = threading.Lock()

    def make_request():
        nonlocal allowed_count, rejected_count
        res = limiter.check_and_record(user_id, mem_db)
        with count_lock:
            if res is None:
                allowed_count += 1
            else:
                rejected_count += 1

    # Fire 15 concurrent threads
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(make_request) for _ in range(15)]
        for f in futures:
            f.result()

    assert allowed_count == 10
    assert rejected_count == 5


def test_case_06_rate_limiter_user_isolation(mem_db):
    """Confirm rate limits for User A do not affect User B."""
    user_a = uuid.uuid4()
    user_b = uuid.uuid4()
    limiter = DistributedRateLimiter(window_seconds=60, max_requests=5)

    for _ in range(5):
        assert limiter.check_and_record(user_a, mem_db) is None
    # User A is now capped
    assert limiter.check_and_record(user_a, mem_db) is not None

    # User B should still be allowed 5 requests
    for _ in range(5):
        assert limiter.check_and_record(user_b, mem_db) is None


def test_case_07_rate_limiter_cleanup_expired(mem_db):
    """Confirm cleanup_expired_records safely purges expired rows older than threshold."""
    user_id = uuid.uuid4()
    limiter = DistributedRateLimiter(window_seconds=60, max_requests=20)

    # Insert an expired record (2 hours ago)
    old_time = datetime.now(timezone.utc) - timedelta(hours=2)
    old_entry = AiAssistantRateLimit(user_id=user_id, request_timestamp=old_time)
    mem_db.add(old_entry)

    # Insert an active record (now)
    current_entry = AiAssistantRateLimit(user_id=user_id, request_timestamp=datetime.now(timezone.utc))
    mem_db.add(current_entry)
    mem_db.commit()

    # Verify 2 records exist
    total_before = mem_db.query(AiAssistantRateLimit).count()
    assert total_before == 2

    # Clean up records older than 3600s
    pruned = limiter.cleanup_expired_records(mem_db, max_age_seconds=3600)
    assert pruned == 1

    # Verify only 1 active record remains
    total_after = mem_db.query(AiAssistantRateLimit).count()
    assert total_after == 1
    remaining = mem_db.query(AiAssistantRateLimit).first()
    assert remaining.id == current_entry.id


def test_case_08_rate_limiter_fail_open_on_db_exception():
    """Confirm rate limiter fails open safely (returns None) on database exception."""
    mock_db = MagicMock()
    mock_db.execute.side_effect = RuntimeError("Database connection lost")

    limiter = DistributedRateLimiter()
    result = limiter.check_and_record(uuid.uuid4(), mock_db)
    # Fail-open returns None
    assert result is None
    mock_db.rollback.assert_called_once()


# ==============================================================================
# PHASE 4F-C: Background Ingestion Recovery Tests
# ==============================================================================

def test_case_09_stale_processing_recovery_resets_stranded_job(mem_db):
    """
    Confirm stranded documents in PROCESSING state older than threshold
    are safely recovered to DRAFT with FAILED version status and partial chunks purged.
    """
    sadmin = create_db_user(mem_db, role_name="super_admin")

    # Create document stuck in PROCESSING for 30 minutes
    stale_time = datetime.now(timezone.utc) - timedelta(minutes=30)
    doc = AiKnowledgeDocument(
        title="Stranded CSJMU Ordinance",
        domain="doctoral-studies",
        document_type="ordinance",
        status=KnowledgeDocumentStatus.PROCESSING.value,
        uploaded_by_id=sadmin.id,
    )
    mem_db.add(doc)
    mem_db.flush()

    ver = AiKnowledgeDocumentVersion(
        document_id=doc.id,
        version_number=1,
        storage_key="vyasa-knowledge/doctoral-studies/v1_stranded.pdf",
        checksum_sha256="abc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        original_filename="stranded.pdf",
        mime_type="application/pdf",
        size_bytes=1024,
        extraction_status=KnowledgeExtractionStatus.PENDING.value,
        approval_status=KnowledgeApprovalStatus.PENDING.value,
    )
    mem_db.add(ver)
    mem_db.flush()

    # Add partial chunk
    partial_chunk = AiKnowledgeChunk(
        document_id=doc.id,
        version_id=ver.id,
        chunk_index=0,
        content="Partial text before crash",
        verification_status=KnowledgeVerificationStatus.INDEXED.value,
    )
    mem_db.add(partial_chunk)

    # Force updated_at into the past
    doc.updated_at = stale_time
    mem_db.commit()

    # Execute recovery with 15-minute threshold
    recovered = knowledge_service.recover_stale_processing_jobs(
        db=mem_db,
        stale_minutes=15,
        acting_user=sadmin,
    )

    assert len(recovered) == 1
    assert recovered[0]["document_id"] == str(doc.id)
    assert recovered[0]["recovery_action"] == "reset_to_draft"

    # Verify state transitions
    mem_db.refresh(doc)
    mem_db.refresh(ver)
    assert doc.status == KnowledgeDocumentStatus.DRAFT.value
    assert ver.extraction_status == KnowledgeExtractionStatus.FAILED.value
    assert "Stale extraction recovered" in ver.processing_error

    # Verify partial chunks were purged
    chunk_count = mem_db.query(AiKnowledgeChunk).filter(AiKnowledgeChunk.version_id == ver.id).count()
    assert chunk_count == 0


def test_case_10_stale_recovery_preserves_active_version_on_v2_crash(mem_db):
    """
    Confirm that if v2 of an already approved document crashes during extraction,
    recovery preserves the document in ACTIVE status serving v1, and marks only v2 as FAILED.
    """
    sadmin = create_db_user(mem_db, role_name="super_admin")

    # Document currently active on v1
    doc = AiKnowledgeDocument(
        title="Active PhD Ordinance with v2 Processing",
        domain="doctoral-studies",
        document_type="ordinance",
        status=KnowledgeDocumentStatus.PROCESSING.value,
        uploaded_by_id=sadmin.id,
        approved_by_id=sadmin.id,
    )
    mem_db.add(doc)
    mem_db.flush()

    v1 = AiKnowledgeDocumentVersion(
        document_id=doc.id,
        version_number=1,
        storage_key="vyasa-knowledge/doctoral-studies/v1_active.pdf",
        checksum_sha256="1111111111111111111111111111111111111111111111111111111111111111",
        original_filename="active.pdf",
        mime_type="application/pdf",
        size_bytes=1024,
        extraction_status=KnowledgeExtractionStatus.PARSED.value,
        approval_status=KnowledgeApprovalStatus.APPROVED.value,
    )
    mem_db.add(v1)
    mem_db.flush()

    doc.current_version_id = v1.id
    doc.current_version = v1

    # v2 uploaded and crashed in processing
    v2 = AiKnowledgeDocumentVersion(
        document_id=doc.id,
        version_number=2,
        storage_key="vyasa-knowledge/doctoral-studies/v2_crashed.pdf",
        checksum_sha256="2222222222222222222222222222222222222222222222222222222222222222",
        original_filename="crashed.pdf",
        mime_type="application/pdf",
        size_bytes=2048,
        extraction_status=KnowledgeExtractionStatus.PENDING.value,
        approval_status=KnowledgeApprovalStatus.PENDING.value,
    )
    mem_db.add(v2)

    # Force updated_at into the past (20 mins ago)
    doc.updated_at = datetime.now(timezone.utc) - timedelta(minutes=20)
    mem_db.commit()

    recovered = knowledge_service.recover_stale_processing_jobs(
        db=mem_db,
        stale_minutes=15,
        acting_user=sadmin,
    )

    assert len(recovered) == 1
    assert recovered[0]["recovery_action"] == "restored_prior_active_version"

    mem_db.refresh(doc)
    mem_db.refresh(v1)
    mem_db.refresh(v2)

    # Document remains ACTIVE serving v1
    assert doc.status == KnowledgeDocumentStatus.ACTIVE.value
    assert doc.current_version_id == v1.id
    # v2 marked FAILED
    assert v2.extraction_status == KnowledgeExtractionStatus.FAILED.value


def test_case_11_active_extraction_not_recovered_prematurely(mem_db):
    """Confirm a genuinely active extraction job (< 15 mins old) is NOT reset by recovery."""
    sadmin = create_db_user(mem_db, role_name="super_admin")

    # Document currently processing (started 2 minutes ago)
    doc = AiKnowledgeDocument(
        title="Actively Extracting Document",
        domain="academic-regulations",
        document_type="regulation",
        status=KnowledgeDocumentStatus.PROCESSING.value,
        uploaded_by_id=sadmin.id,
    )
    mem_db.add(doc)
    mem_db.commit()

    recovered = knowledge_service.recover_stale_processing_jobs(
        db=mem_db,
        stale_minutes=15,
        acting_user=sadmin,
    )

    assert len(recovered) == 0
    mem_db.refresh(doc)
    assert doc.status == KnowledgeDocumentStatus.PROCESSING.value


def test_case_12_sadmin_recover_stale_endpoint(mem_db):
    """Test POST /v1/admin/knowledge-centre/documents/recover-stale endpoint authorization."""
    sadmin = create_db_user(mem_db, email="sadmin_recovery@csjmu.ac.in", role_name="super_admin")
    app.dependency_overrides[get_current_user] = lambda: sadmin
    app.dependency_overrides[require_sadmin] = lambda: sadmin

    client = TestClient(app)
    resp = client.post("/api/v1/admin/knowledge-centre/documents/recover-stale?stale_minutes=15")
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    # Scholar is forbidden
    scholar = create_db_user(mem_db, email="scholar_recovery@csjmu.ac.in", role_name="scholar")
    app.dependency_overrides[get_current_user] = lambda: scholar
    if require_sadmin in app.dependency_overrides:
        del app.dependency_overrides[require_sadmin]

    resp403 = client.post("/api/v1/admin/knowledge-centre/documents/recover-stale")
    assert resp403.status_code == 403


# ==============================================================================
# PHASE 4F-D: Grounding & Citation Transparency Tests
# ==============================================================================

def test_case_13_claim_grounding_flags_unsupported_figures():
    """Confirm quantitative claim verification flags uncorroborated figures with a clear caution."""
    evidence = [
        KnowledgeRetrievedEvidence(
            chunk_id="chunk-1",
            document_id=str(uuid.uuid4()),
            version_id=str(uuid.uuid4()),
            version_number=1,
            document_title="Ph.D. Ordinance 2026",
            domain="doctoral-studies",
            subdomain=None,
            document_type="ordinance",
            academic_session="2026-27",
            issuing_authority="Academic Council",
            section_heading="Clause 4",
            page_number=3,
            chunk_index=0,
            source_filename="ordinance.pdf",
            storage_key="key",
            content="Scholars must complete coursework with 12 credits and minimum 55% marks.",
            relevance_score=0.9,
            semantic_score=0.9,
            lexical_score=0.9,
            retrieval_method="hybrid",
            embedding_model="text-embedding-004",
            embedding_dimensions=768,
            citation_label="[Doctoral Studies] Ph.D. Ordinance 2026",
        )
    ]

    # Answer containing hallucinated figure: "24 credits" and "75%"
    answer_with_hallucination = "Coursework requires 24 credits and a score of 75% marks [SOURCE 1]."

    augmented_ans, claim_status, unsupported = knowledge_synthesis_service._validate_claim_grounding(
        answer_with_hallucination, evidence
    )

    assert claim_status == "flagged"
    assert any("24 credits" in u for u in unsupported)
    assert any("75%" in u for u in unsupported)
    assert "Verification Notice" in augmented_ans
    assert "requires institutional confirmation" in augmented_ans


def test_case_14_insufficient_evidence_deterministic_abstention():
    """Confirm insufficient evidence returns immediate deterministic abstention without LLM hallucination."""
    empty_result = KnowledgeRetrievalResult(
        query="What is the submarine quota?",
        total_candidates_examined=0,
        matched_passages_count=0,
        top_evidence=[],
        applied_filters={},
        has_sufficient_evidence=False,
    )

    synth = knowledge_synthesis_service.synthesize(
        query="What is the submarine quota?",
        retrieval_result=empty_result,
    )

    assert synth.evidence_status == "insufficient"
    assert synth.is_grounded is False
    assert len(synth.citations) == 0
    assert "do not establish the answer" in synth.answer
    assert synth.model_used == "deterministic-abstention-engine"
