"""Pytest fixtures for NIVARAN backend testing."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.main import app

FROZEN_40_TABLES = {
    # 1. Authority
    "nivaran_authorities",
    # 2. Taxonomy (4)
    "subject_clusters",
    "subjects",
    "grievance_clusters",
    "categories",
    # 3. Grievance Core (5)
    "student_master_records",
    "grievances",
    "grievance_status_history",
    "comments",
    "grievance_feedback",
    # 4. Routing & Escalation (3)
    "assignments",
    "forwarding_confirmations",
    "escalations",
    # 5. Documents (2)
    "documents",
    "document_requests",
    # 6. Committee Management (13)
    "committee_creation_requests",
    "grievance_committees",
    "committee_members",
    "committee_member_recommendations",
    "committee_final_recommendations",
    "committee_messages",
    "committee_polls",
    "committee_poll_options",
    "committee_poll_voters",
    "committee_poll_votes",
    "committee_decision_records",
    "committee_meetings",
    "committee_meeting_participants",
    # 7. Dean Reopen Review (1)
    "dean_reopen_reviews",
    # 8. Digital Signatures (3)
    "signing_key_versions",
    "signing_authorization_challenges",
    "digital_signatures",
    # 9. E-File Lifecycle (2)
    "efiles",
    "efile_documents",
    # 10. Multi-Level Approvals (2)
    "approval_requests",
    "approval_actions",
    # 11. AI Processing & Clustering (2)
    "ai_processing_records",
    "clusters",
    # 12. Notification Outbox (1)
    "grievance_notification_outbox",
    # 13. Audit & Compliance (1)
    "audit_logs",
}


@pytest.fixture(scope="session")
def client() -> TestClient:
    """TestClient fixture for FastAPI endpoints."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="function")
def db_session() -> Session:
    """Yield a database session and close it afterwards."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="session")
def expected_tables() -> set[str]:
    """Frozen 40 table names fixture."""
    return FROZEN_40_TABLES
