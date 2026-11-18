# -*- coding: utf-8 -*-
"""
Phase 4H Automated Test Suite: Critical Ingestion Concurrency & Security Hardening

Covers:
1. Worker Ownership Assignment: job_id and heartbeat_at initialized on processing transition.
2. Monotonic Heartbeat Updates: update_heartbeat advances heartbeat_at while preserving job_id.
3. Heartbeat Rejection on Revoked Job: update_heartbeat raises ExtractionJobRevokedError on mismatch.
4. Active Long-Running Worker Protection: workers running >15m with fresh heartbeats are NOT marked failed.
5. Truly Abandoned Worker Recovery: workers with stale heartbeats (>15m) are revoked, failed, and chunks purged.
6. Revoked Worker Commit Prevention: CAS check fails if job_id was revoked, rolling back without committing chunks.
7. Retry Issues Fresh Job ID: retry_extraction assigns a new UUID job_id and resets status.
8. Simultaneous Stale Recovery Serialization: concurrent recovery calls execute safely without deadlock.
9. PostgreSQL Advisory Lock Error Handling: advisory lock failure logs error, rolls back, and fails open safely.
10. SADMIN Diagnostics RBAC: require_sadmin enforced on GET /api/v1/assistant/diagnostics.
11. UI Copy Verification: PhdAssistantPage.tsx contains 'Authoritative Retrieval Mode' and zero 'Zero Hallucination Mode'.
12. Schema Migration Verification: Migration 8b29c54e1030 is valid, has down_revision 8b29c54e1029, and defines upgrade/downgrade.
"""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
import threading
from typing import Optional
import uuid
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from sqlalchemy.exc import OperationalError

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
from app.modules.knowledge_centre.service import (
    knowledge_service,
    ExtractionJobRevokedError,
    DEFAULT_STALE_PROCESSING_THRESHOLD_MINUTES,
)
from app.modules.knowledge_centre.rate_limiter import (
    distributed_rate_limiter,
    DistributedRateLimiter,
)


# ==============================================================================
# Fixtures
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


@pytest.fixture
def sadmin_user(mem_db: Session) -> User:
    return create_db_user(mem_db, email="sadmin_phase4h@example.edu", role_name="super_admin")


@pytest.fixture
def scholar_user(mem_db: Session) -> User:
    return create_db_user(mem_db, email="scholar_phase4h@example.edu", role_name="scholar")


@pytest.fixture
def test_doc_and_ver(mem_db: Session, sadmin_user: User):
    doc = AiKnowledgeDocument(
        title="University PhD Guidelines 2026",
        domain="academic",
        document_type="policy",
        status=KnowledgeDocumentStatus.DRAFT.value,
        uploaded_by_id=sadmin_user.id,
    )
    mem_db.add(doc)
    mem_db.flush()

    ver = AiKnowledgeDocumentVersion(
        document_id=doc.id,
        version_number=1,
        storage_key="test/academic/v1_guidelines.pdf",
        checksum_sha256="testchecksum1234567890abcdef1234567890abcdef1234567890abcdef12345678",
        original_filename="guidelines.pdf",
        mime_type="application/pdf",
        size_bytes=1024,
        extraction_status=KnowledgeExtractionStatus.PENDING.value,
        approval_status=KnowledgeApprovalStatus.PENDING.value,
    )
    mem_db.add(ver)
    mem_db.commit()
    mem_db.refresh(doc)
    mem_db.refresh(ver)
    return doc, ver


# ==============================================================================
# Tests
# ==============================================================================

def test_1_worker_ownership_assignment(mem_db: Session, test_doc_and_ver):
    """1. Worker Ownership Assignment: job_id and heartbeat_at initialized on processing transition."""
    doc, ver = test_doc_and_ver
    doc, ver, job_id = knowledge_service.transition_to_processing(mem_db, doc.id, ver.id)

    assert isinstance(job_id, uuid.UUID)
    mem_db.refresh(ver)
    mem_db.refresh(doc)
    assert ver.job_id == job_id
    assert ver.heartbeat_at is not None
    assert ver.extraction_status == KnowledgeExtractionStatus.PENDING.value
    assert doc.status == KnowledgeDocumentStatus.PROCESSING.value


def test_2_monotonic_heartbeat_updates(mem_db: Session, test_doc_and_ver):
    """2. Monotonic Heartbeat Updates: update_heartbeat advances heartbeat_at while preserving job_id."""
    doc, ver = test_doc_and_ver
    doc, ver, job_id = knowledge_service.transition_to_processing(mem_db, doc.id, ver.id)
    initial_heartbeat = ver.heartbeat_at

    knowledge_service.update_heartbeat(mem_db, ver.id, job_id)
    mem_db.refresh(ver)
    assert ver.job_id == job_id
    assert ver.heartbeat_at >= initial_heartbeat


def test_3_heartbeat_rejection_on_revoked_job(mem_db: Session, test_doc_and_ver):
    """3. Heartbeat Rejection on Revoked Job: update_heartbeat raises ExtractionJobRevokedError on mismatch."""
    doc, ver = test_doc_and_ver
    doc, ver, job_id = knowledge_service.transition_to_processing(mem_db, doc.id, ver.id)

    wrong_job_id = uuid.uuid4()
    with pytest.raises(ExtractionJobRevokedError) as exc_info:
        knowledge_service.update_heartbeat(mem_db, ver.id, wrong_job_id)

    assert str(wrong_job_id) in str(exc_info.value)
    assert "revoked or superseded" in str(exc_info.value)
    mem_db.refresh(ver)
    assert ver.job_id == job_id  # unchanged


def test_4_active_long_running_worker_protection(mem_db: Session, sadmin_user: User, test_doc_and_ver):
    """4. Active Long-Running Worker Protection: workers running >15m with fresh heartbeats are NOT marked failed."""
    doc, ver = test_doc_and_ver
    doc, ver, job_id = knowledge_service.transition_to_processing(mem_db, doc.id, ver.id)

    # Simulate worker started 45 minutes ago, but posted a heartbeat 2 minutes ago
    now = datetime.now(timezone.utc)
    doc.updated_at = now - timedelta(minutes=45)
    ver.heartbeat_at = now - timedelta(minutes=2)
    mem_db.commit()

    recovered = knowledge_service.recover_stale_processing_jobs(
        mem_db, stale_minutes=15, acting_user=sadmin_user
    )

    # Should NOT have recovered the active worker
    assert len(recovered) == 0
    mem_db.refresh(doc)
    mem_db.refresh(ver)
    assert doc.status == KnowledgeDocumentStatus.PROCESSING.value
    assert ver.job_id == job_id
    assert ver.extraction_status == KnowledgeExtractionStatus.PENDING.value


def test_5_truly_abandoned_worker_recovery(mem_db: Session, sadmin_user: User, test_doc_and_ver):
    """5. Truly Abandoned Worker Recovery: workers with stale heartbeats (>15m) are revoked, failed, and chunks purged."""
    doc, ver = test_doc_and_ver
    doc, ver, job_id = knowledge_service.transition_to_processing(mem_db, doc.id, ver.id)

    # Add partial chunk
    chunk = AiKnowledgeChunk(
        document_id=doc.id,
        version_id=ver.id,
        chunk_index=0,
        content="Partial abandoned content",
        verification_status=KnowledgeVerificationStatus.UNVERIFIED.value,
    )
    mem_db.add(chunk)

    # Worker died 25 minutes ago
    now = datetime.now(timezone.utc)
    doc.updated_at = now - timedelta(minutes=25)
    ver.heartbeat_at = now - timedelta(minutes=25)
    mem_db.commit()

    recovered = knowledge_service.recover_stale_processing_jobs(
        mem_db, stale_minutes=15, acting_user=sadmin_user
    )

    assert len(recovered) == 1
    assert recovered[0]["document_id"] == str(doc.id)
    assert recovered[0]["recovery_action"] == "reset_to_draft"

    mem_db.refresh(doc)
    mem_db.refresh(ver)
    assert ver.job_id is None
    assert ver.extraction_status == KnowledgeExtractionStatus.FAILED.value
    assert "heartbeat expired" in ver.processing_error
    assert doc.status == KnowledgeDocumentStatus.DRAFT.value

    # Verify partial chunks were purged
    remaining_chunks = mem_db.scalars(
        select(AiKnowledgeChunk).where(AiKnowledgeChunk.version_id == ver.id)
    ).all()
    assert len(remaining_chunks) == 0


def test_6_revoked_worker_commit_prevention(mem_db: Session, test_doc_and_ver):
    """6. Revoked Worker Commit Prevention: CAS check fails if job_id was revoked, rolling back without committing chunks."""
    doc, ver = test_doc_and_ver
    doc, ver, job_id = knowledge_service.transition_to_processing(mem_db, doc.id, ver.id)

    mock_storage = MagicMock()
    mock_storage.get_file_path.return_value = "/tmp/dummy_test.pdf"

    mock_parser_instance = MagicMock()
    mock_chunk = MagicMock()
    mock_chunk.chunk_text = "Authoritative Policy Statement"
    mock_chunk.page_number = 1
    mock_chunk.slide_number = None
    mock_chunk.section_heading = "1. General Regulations"
    mock_chunk.token_count = 10
    mock_chunk.checksum_sha256 = "c12345"
    mock_parser_instance.parse_file.return_value = MagicMock()
    mock_parser_instance.chunk_document.return_value = [mock_chunk]

    # Simulate recovery executing concurrently while worker is parsing/embedding
    def revoke_worker_job(*args, **kwargs):
        ver.job_id = None
        ver.extraction_status = KnowledgeExtractionStatus.FAILED.value
        mem_db.commit()
        return ([[0.1] * 768], {"embedding_model": "text-embedding-004"})

    mock_emb = MagicMock()
    mock_emb.embed_batch_with_provenance.side_effect = revoke_worker_job

    with patch("app.modules.knowledge_centre.service.storage_service", mock_storage), \
         patch("app.modules.knowledge_centre.service.DocumentParser", return_value=mock_parser_instance), \
         patch("app.modules.knowledge_centre.service.embedding_service", mock_emb):

        chunks_indexed = knowledge_service.extract_and_index_document(
            mem_db, doc.id, ver.id, job_id=job_id
        )

        # Worker aborted cleanly without committing results
        assert chunks_indexed == 0

    # Verify no chunks were committed to the database
    chunks = mem_db.scalars(
        select(AiKnowledgeChunk).where(AiKnowledgeChunk.version_id == ver.id)
    ).all()
    assert len(chunks) == 0


def test_7_retry_issues_fresh_job_id(mem_db: Session, sadmin_user: User, test_doc_and_ver):
    """7. Retry Issues Fresh Job ID: retry_extraction assigns a new UUID job_id and resets status."""
    doc, ver = test_doc_and_ver
    doc, ver, old_job_id = knowledge_service.transition_to_processing(mem_db, doc.id, ver.id)

    # Mark as failed
    ver.extraction_status = KnowledgeExtractionStatus.FAILED.value
    ver.job_id = None
    doc.status = KnowledgeDocumentStatus.DRAFT.value
    mem_db.commit()

    retried_ver, new_job_id = knowledge_service.retry_extraction(
        mem_db, doc.id, ver.id, acting_user=sadmin_user
    )

    assert isinstance(new_job_id, uuid.UUID)
    assert new_job_id != old_job_id
    assert retried_ver.job_id == new_job_id
    assert retried_ver.extraction_status == KnowledgeExtractionStatus.PENDING.value
    mem_db.refresh(doc)
    assert doc.status == KnowledgeDocumentStatus.PROCESSING.value


def test_8_simultaneous_stale_recovery_serialization(mem_db: Session, test_doc_and_ver):
    """8. Simultaneous Stale Recovery Serialization: concurrent recovery calls execute safely without deadlock."""
    doc, ver = test_doc_and_ver
    doc, ver, job_id = knowledge_service.transition_to_processing(mem_db, doc.id, ver.id)

    now = datetime.now(timezone.utc)
    doc.updated_at = now - timedelta(minutes=30)
    ver.heartbeat_at = now - timedelta(minutes=30)
    mem_db.commit()

    def run_recovery():
        # Call with independent session sharing engine connection
        engine = mem_db.get_bind()
        LocalSession = sessionmaker(bind=engine)
        session = LocalSession()
        try:
            return knowledge_service.recover_stale_processing_jobs(
                session, stale_minutes=15, acting_user=None
            )
        finally:
            session.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(run_recovery)
        f2 = executor.submit(run_recovery)
        res1 = f1.result(timeout=5)
        res2 = f2.result(timeout=5)

    # Exactly one thread recovers the item, the second finds 0 candidates
    total_recovered = len(res1) + len(res2)
    assert total_recovered == 1


def test_9_postgres_advisory_lock_error_handling(mem_db: Session):
    """9. PostgreSQL Advisory Lock Error Handling: advisory lock failure logs error, rolls back, and fails open safely."""
    mock_db = MagicMock(spec=Session)
    mock_bind = MagicMock()
    mock_bind.dialect.name = "postgresql"
    mock_db.get_bind.return_value = mock_bind

    # Simulate OperationalError on executing advisory lock
    mock_db.execute.side_effect = OperationalError("SELECT pg_advisory_xact_lock", {}, Exception("Connection lost"))

    test_user = uuid.uuid4()
    limiter = DistributedRateLimiter(window_seconds=60, max_requests=20)

    # Calling check_and_record must NOT crash; must return None (fail open) and call rollback
    result = limiter.check_and_record(test_user, mock_db)

    assert result is None  # Allowed (failed open)
    mock_db.rollback.assert_called()


def test_10_sadmin_diagnostics_rbac(mem_db: Session, sadmin_user: User, scholar_user: User):
    """10. SADMIN Diagnostics RBAC: require_sadmin enforced on GET /api/v1/assistant/diagnostics."""
    client = TestClient(app)

    # 1. Unauthenticated -> 401
    resp_unauth = client.get("/api/v1/assistant/diagnostics")
    assert resp_unauth.status_code == 401

    # 2. Scholar User -> 403 Forbidden
    app.dependency_overrides[get_current_user] = lambda: scholar_user

    resp_scholar = client.get("/api/v1/assistant/diagnostics")
    assert resp_scholar.status_code == 403

    # 3. Super Admin -> 200 OK with sanitized telemetry
    app.dependency_overrides[get_current_user] = lambda: sadmin_user
    app.dependency_overrides[require_sadmin] = lambda: sadmin_user

    resp_sadmin = client.get("/api/v1/assistant/diagnostics")
    assert resp_sadmin.status_code == 200
    data = resp_sadmin.json()
    assert data["success"] is True
    diag_data = data["data"]
    assert diag_data["service"] == "VYASA-AI-Knowledge-Gateway"
    assert "query_metrics" in diag_data
    assert "latency_benchmarks" in diag_data
    # Ensure no raw credentials or query text leaks
    assert "password" not in str(data)
    assert "secret" not in str(data)


def test_11_ui_copy_verification():
    """11. UI Copy Verification: PhdAssistantPage.tsx contains 'Authoritative Retrieval Mode' and zero 'Zero Hallucination Mode'."""
    page_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "src" / "features" / "phd-rag" / "PhdAssistantPage.tsx"
    assert page_path.exists(), f"Frontend file not found: {page_path}"

    content = page_path.read_text(encoding="utf-8")
    assert "Authoritative Retrieval Mode" in content
    assert "Zero Hallucination Mode" not in content


def test_12_schema_migration_verification():
    """12. Schema Migration Verification: Migration 8b29c54e1030 is valid, has down_revision 8b29c54e1029, and defines upgrade/downgrade."""
    migration_file = Path(__file__).resolve().parent.parent / "alembic" / "versions" / "8b29c54e1030_add_extraction_job_ownership_and_heartbeat.py"
    assert migration_file.exists(), f"Migration file not found: {migration_file}"

    migration_content = migration_file.read_text(encoding="utf-8")
    assert "8b29c54e1030" in migration_content
    assert "8b29c54e1029" in migration_content
    assert "def upgrade()" in migration_content
    assert "def downgrade()" in migration_content
    assert "job_id" in migration_content
    assert "heartbeat_at" in migration_content
