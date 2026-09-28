"""
Tests for AI Processing Integration in NIVARAN Pillar.

Validates the full AI triage workflow:
1. Submitted grievance triggers AI processing.
2. SUBMITTED -> AI_PROCESSING history exists (actor=SYSTEM).
3. Local NivaranAIPipeline is invoked using the verified artifact.
4. Predicted category resolves to database category.
5. ai_processing_records is created.
6. model_name is stored correctly ("NIVARAN-AI-NLP").
7. model_version is stored correctly ("2.0.0").
8. confidence is stored correctly (0 <= conf <= 1, rounded to 4 decimals).
9. processing_time_ms is populated (>= 0).
10. grievance.category_id is updated.
11. grievance.ai_confidence is updated.
12. grievance.final_category_id is initialized to predicted category.
13. category_reviewed remains FALSE.
14. category_overridden remains FALSE.
15. AI_PROCESSING -> PENDING_REVIEW history exists (actor=SYSTEM).
16. Successful processing ends in PENDING_REVIEW.
17. AI failure creates FAILED ai_processing_records.
18. AI failure does not fabricate category.
19. AI failure still ends in PENDING_REVIEW.
20. AI failure creates appropriate status history ("AI processing failed. Manual review required.").
21. Applicant response does not expose internal AI metadata.
22. Resilient category resolution: exact, case variation, space/underscore variation.
23. Unknown category does NOT create a new database category and fails safely.
24. Frozen 40-table schema remains unchanged.
"""

import uuid
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from app.core.database import engine
from app.models.ai_processing import AIProcessingRecord, AIProcessingStatus
from app.models.enums import GrievancePriority, GrievanceStatus, HistoryActorType
from app.models.grievance import Grievance, GrievanceStatusHistory
from app.models.taxonomy import Category, Subject
from app.services.ai_processing import AIProcessingService
from app.services.grievance_submission import GrievanceSubmissionService


@pytest.fixture
def test_subject(db_session: Session) -> Subject:
    """Fixture providing a known active subject (Mathematics)."""
    stmt = select(Subject).where(Subject.name == "Mathematics")
    subject = db_session.execute(stmt).scalar_one_or_none()
    assert subject is not None, "Subject 'Mathematics' must exist from seed master data"
    assert subject.is_active is True
    return subject


@pytest.fixture
def applicant_id() -> uuid.UUID:
    """External VYASA Core UUID for test applicant."""
    return uuid.uuid4()


# ==============================================================================
# 1. CATEGORY DATABASE RESOLUTION TESTS
# ==============================================================================

def test_category_resolution_exact_match(db_session: Session) -> None:
    """Category resolution finds exact case-sensitive match."""
    cat = AIProcessingService.resolve_db_category(db_session, "Fellowship")
    assert cat is not None
    assert cat.name == "Fellowship"
    assert cat.is_active is True


def test_category_resolution_case_variation(db_session: Session) -> None:
    """Category resolution handles case variation."""
    cat_lower = AIProcessingService.resolve_db_category(db_session, "fellowship")
    assert cat_lower is not None
    assert cat_lower.name == "Fellowship"

    cat_upper = AIProcessingService.resolve_db_category(db_session, "FELLOWSHIP")
    assert cat_upper is not None
    assert cat_upper.name == "Fellowship"


def test_category_resolution_space_underscore_variation(db_session: Session) -> None:
    """Category resolution handles space vs underscore variations."""
    # 'Course Work' -> 'Course_Work'
    cat_space = AIProcessingService.resolve_db_category(db_session, "Course Work")
    assert cat_space is not None
    assert cat_space.name == "Course_Work"

    # 'Course_Work' -> 'Course_Work'
    cat_underscore = AIProcessingService.resolve_db_category(db_session, "Course_Work")
    assert cat_underscore is not None
    assert cat_underscore.name == "Course_Work"

    # 'thesis submission' -> 'Thesis_Submission'
    cat_thesis = AIProcessingService.resolve_db_category(db_session, "thesis submission")
    assert cat_thesis is not None
    assert cat_thesis.name == "Thesis_Submission"


def test_category_resolution_unknown_category_does_not_fabricate(db_session: Session) -> None:
    """Unknown category returns None and does NOT create a new database category."""
    count_before = db_session.query(Category).count()

    cat_unknown = AIProcessingService.resolve_db_category(db_session, "NON_EXISTENT_CATEGORY")
    assert cat_unknown is None

    count_after = db_session.query(Category).count()
    assert count_before == count_after, "Unknown category created an unexpected database category record!"


# ==============================================================================
# 2. END-TO-END AUTOMATIC AI PROCESSING INTEGRATION
# ==============================================================================

def test_submitted_grievance_triggers_ai_processing(
    client: TestClient,
    test_subject: Subject,
    applicant_id: uuid.UUID,
    db_session: Session,
) -> None:
    """
    Submitting a grievance triggers local AI classification:
    SUBMITTED -> AI_PROCESSING -> Local Inference -> ai_processing_records -> PENDING_REVIEW.
    """
    payload = {
        "title": "Delayed Monthly Stipend for Ph.D. Scholar",
        "description": "My JRF fellowship contingency amount for the past 2 months has not been credited.",
        "subject_id": str(test_subject.id),
        "priority": "HIGH",
    }
    headers = {"X-Applicant-User-Id": str(applicant_id)}

    res = client.post("/api/v1/grievances", json=payload, headers=headers)
    assert res.status_code == 201, f"Submission failed: {res.text}"

    data = res.json()
    grievance_uuid = uuid.UUID(data["id"])

    # 1. Successful processing ends in PENDING_REVIEW
    assert data["status"] == "PENDING_REVIEW"
    assert data["grievance_id"].startswith("G-")

    # 2. Verify grievance directly in database
    grievance = db_session.get(Grievance, grievance_uuid)
    assert grievance is not None
    assert grievance.status == GrievanceStatus.PENDING_REVIEW

    # 3. Category and AI confidence are updated on grievance
    assert grievance.category_id is not None
    assert grievance.ai_confidence is not None
    assert 0.0 <= grievance.ai_confidence <= 1.0

    # Verify category name resolved correctly to Fellowship
    cat = db_session.get(Category, grievance.category_id)
    assert cat is not None
    assert cat.name == "Fellowship"

    # 4. final_category_id is initialized to predicted category
    assert grievance.final_category_id == grievance.category_id

    # 5. category_reviewed and category_overridden remain FALSE (awaiting Manager review)
    assert grievance.category_reviewed is False
    assert grievance.category_overridden is False

    # 6. Verify chronological GrievanceStatusHistory entries:
    #    Step 1: None -> SUBMITTED (actor=USER)
    #    Step 2: SUBMITTED -> AI_PROCESSING (actor=SYSTEM)
    #    Step 3: AI_PROCESSING -> PENDING_REVIEW (actor=SYSTEM)
    histories = db_session.execute(
        select(GrievanceStatusHistory)
        .where(GrievanceStatusHistory.grievance_id == grievance_uuid)
        .order_by(GrievanceStatusHistory.changed_at.asc())
    ).scalars().all()

    assert len(histories) == 3

    # History 1: Initial filing
    h1 = histories[0]
    assert h1.previous_status is None
    assert h1.new_status == GrievanceStatus.SUBMITTED
    assert h1.actor_type == HistoryActorType.USER
    assert h1.changed_by_vyasa_user_id == applicant_id

    # History 2: AI processing start
    h2 = histories[1]
    assert h2.previous_status == GrievanceStatus.SUBMITTED
    assert h2.new_status == GrievanceStatus.AI_PROCESSING
    assert h2.actor_type == HistoryActorType.SYSTEM
    assert h2.remarks == "AI processing started automatically"

    # History 3: AI processing completion
    h3 = histories[2]
    assert h3.previous_status == GrievanceStatus.AI_PROCESSING
    assert h3.new_status == GrievanceStatus.PENDING_REVIEW
    assert h3.actor_type == HistoryActorType.SYSTEM
    assert h3.remarks == "AI processing completed automatically"

    # 7. Verify AIProcessingRecord persisted in database
    ai_record = db_session.execute(
        select(AIProcessingRecord).where(AIProcessingRecord.grievance_id == grievance_uuid)
    ).scalar_one_or_none()

    assert ai_record is not None
    assert ai_record.status == AIProcessingStatus.COMPLETED
    assert ai_record.model_name == "NIVARAN-AI-NLP"
    assert ai_record.model_version == "2.0.0"
    assert ai_record.predicted_category_id == grievance.category_id
    assert pytest.approx(float(grievance.ai_confidence), abs=1e-4) == float(ai_record.confidence_score)
    assert ai_record.processing_time_ms is not None and ai_record.processing_time_ms >= 0
    assert ai_record.error_message is None

    # 8. Applicant response does NOT expose internal AI metadata
    assert "model_name" not in data
    assert "model_version" not in data
    assert "ai_confidence" not in data
    assert "category_id" not in data
    assert "final_category_id" not in data
    assert "processing_time_ms" not in data


# ==============================================================================
# 3. AI FAILURE HANDLING & SAFE DEGRADATION TESTS
# ==============================================================================

def test_ai_processing_failure_records_failed_and_transitions_to_pending_review(
    test_subject: Subject,
    applicant_id: uuid.UUID,
    db_session: Session,
) -> None:
    """
    When model inference encounters an unexpected exception:
    - AIProcessingRecord is created with status = FAILED and controlled error message.
    - Category and confidence are NOT fabricated on the grievance.
    - Grievance still transitions safely: SUBMITTED -> AI_PROCESSING -> PENDING_REVIEW.
    - Status history remark is 'AI processing failed. Manual review required.'
    """
    # Create grievance manually in SUBMITTED state
    tracking_code = f"G-FAIL-{uuid.uuid4().hex[:6].upper()}"
    grievance = Grievance(
        grievance_id=tracking_code,
        applicant_vyasa_user_id=applicant_id,
        subject_id=test_subject.id,
        title="Unexpected Model Failure Test",
        description="Testing safe degradation when the AI model throws an inference error.",
        status=GrievanceStatus.SUBMITTED,
        priority=GrievancePriority.LOW,
    )
    db_session.add(grievance)
    db_session.commit()
    db_session.refresh(grievance)

    # Mock ai_pipeline.predict_category to simulate an inference engine failure
    with patch("app.services.ai_processing.ai_pipeline.predict_category") as mock_predict:
        mock_predict.side_effect = RuntimeError("Simulated inference engine calculation fault")

        record = AIProcessingService.process_grievance(db=db_session, grievance=grievance)

    assert record.status == AIProcessingStatus.FAILED
    assert "Simulated inference engine calculation fault" in record.error_message
    assert record.predicted_category_id is None
    assert record.confidence_score is None

    # Refresh grievance from database
    db_session.refresh(grievance)
    assert grievance.status == GrievanceStatus.PENDING_REVIEW
    assert grievance.category_id is None, "AI failure must NOT fabricate a category!"
    assert grievance.ai_confidence is None, "AI failure must NOT fabricate confidence!"
    assert grievance.final_category_id is None

    # Check status history
    histories = db_session.execute(
        select(GrievanceStatusHistory)
        .where(GrievanceStatusHistory.grievance_id == grievance.id)
        .order_by(GrievanceStatusHistory.changed_at.asc())
    ).scalars().all()

    assert len(histories) >= 2
    last_history = histories[-1]
    assert last_history.previous_status == GrievanceStatus.AI_PROCESSING
    assert last_history.new_status == GrievanceStatus.PENDING_REVIEW
    assert last_history.actor_type == HistoryActorType.SYSTEM
    assert last_history.remarks == "AI processing failed. Manual review required."


def test_ai_processing_unresolvable_category_fails_safely(
    test_subject: Subject,
    applicant_id: uuid.UUID,
    db_session: Session,
) -> None:
    """
    When the model returns a category that cannot be resolved in the taxonomy:
    - AIProcessingRecord is created with status = FAILED.
    - Category is NOT fabricated.
    - Grievance still transitions safely to PENDING_REVIEW for manual manager triage.
    """
    tracking_code = f"G-UNRESOLVABLE-{uuid.uuid4().hex[:6].upper()}"
    grievance = Grievance(
        grievance_id=tracking_code,
        applicant_vyasa_user_id=applicant_id,
        subject_id=test_subject.id,
        title="Unresolvable Category Test",
        description="Testing category resolution failure handling.",
        status=GrievanceStatus.SUBMITTED,
        priority=GrievancePriority.LOW,
    )
    db_session.add(grievance)
    db_session.commit()
    db_session.refresh(grievance)

    # Mock ai_pipeline.predict_category to return an unknown category
    with patch("app.services.ai_processing.ai_pipeline.predict_category") as mock_predict:
        mock_predict.return_value = {
            "category": "TOTALLY_UNKNOWN_DISPUTE_CATEGORY_XYZ",
            "confidence": 0.9950,
            "model_name": "NIVARAN-AI-NLP",
            "model_version": "2.0.0",
        }

        record = AIProcessingService.process_grievance(db=db_session, grievance=grievance)

    assert record.status == AIProcessingStatus.FAILED
    assert "could not be resolved" in record.error_message
    assert record.predicted_category_id is None

    db_session.refresh(grievance)
    assert grievance.status == GrievanceStatus.PENDING_REVIEW
    assert grievance.category_id is None
    assert grievance.ai_confidence is None


# ==============================================================================
# 4. FROZEN SCHEMA INTEGRITY CHECK
# ==============================================================================

def test_frozen_40_table_schema_remains_unchanged(expected_tables: set[str]) -> None:
    """Confirm the frozen 40-table database schema has NOT been altered."""
    inspector = inspect(engine)
    live_tables = set(t for t in inspector.get_table_names() if t != "alembic_version")
    assert live_tables == expected_tables, f"Schema mismatch! Diff: {live_tables ^ expected_tables}"
    assert len(live_tables) == 40
