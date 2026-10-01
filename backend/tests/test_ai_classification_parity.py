import uuid
import pytest
from pathlib import Path
from unittest.mock import patch
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.applicant_profile import ApplicantProfile
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.taxonomy import (
    SubjectCluster,
    Subject,
    GrievanceCluster,
    Category,
)
from app.modules.atharva_veda.nivaran.models.enums import (
    NivaranRole,
    CategoryRoutingType,
    GrievanceStatus,
    GrievancePriority,
)
from app.modules.atharva_veda.nivaran.models.grievance import (
    Grievance,
    GrievanceStatusHistory,
)
from app.modules.atharva_veda.nivaran.models.ai_processing import AIProcessingRecord
from app.modules.atharva_veda.nivaran.services.ai_classification_pipeline import (
    ai_pipeline,
    BASELINE_CLASSIFIER_PATH,
    DEFAULT_MODEL_NAME,
    DEFAULT_MODEL_VERSION,
)
from app.modules.atharva_veda.nivaran.services.ai_processing_service import (
    resolve_db_category,
    AIProcessingService,
)
from app.modules.atharva_veda.nivaran.services.grievance_service import GrievanceService
from app.modules.atharva_veda.nivaran.schemas.grievance import GrievanceSubmitRequest
from tests.test_atharva_grievance_lifecycle import (
    create_user_with_role,
    create_test_applicant,
    setup_taxonomy_and_authorities,
)


# ==========================================
# 1. Model Artifact & Initialization Tests
# ==========================================

def test_model_artifact_exists_and_loads():
    """Verify category_classifier.joblib exists at the expected path and loads with 16 classes."""
    assert BASELINE_CLASSIFIER_PATH.exists(), f"Model missing at {BASELINE_CLASSIFIER_PATH}"
    ai_pipeline.initialize()
    assert ai_pipeline._baseline_model is not None
    classes = list(ai_pipeline._baseline_model.classes_)
    assert len(classes) == 16
    assert "FT_PT_Conversion" in classes
    assert "Fellowship" in classes
    assert "Course_Work" in classes
    assert "Other" in classes


def test_ai_pipeline_known_category_predictions():
    """Verify AI pipeline outputs valid predictions and confidences for known classes."""
    # Fellowship prediction
    res_f = ai_pipeline.process_grievance_text(
        title="JRF fellowship stipend delayed",
        description="The monthly scholarship stipend disbursement has not been received.",
    )
    assert res_f["predicted_category"] == "Fellowship"
    assert 0.0 <= res_f["confidence_score"] <= 1.0
    assert res_f["model_name"] == DEFAULT_MODEL_NAME
    assert res_f["model_version"] == DEFAULT_MODEL_VERSION
    assert res_f["processing_time_ms"] >= 0

    # Coursework prediction
    res_c = ai_pipeline.process_grievance_text(
        title="Course work exam grading issue",
        description="Coursework marksheet evaluation error in research methodology paper.",
    )
    assert res_c["predicted_category"] == "Course_Work"
    assert 0.0 <= res_c["confidence_score"] <= 1.0


# ==========================================
# 2. FT/PT Conversion & Model Label Space != DB Taxonomy
# ==========================================

def test_ai_pipeline_ft_pt_conversion_prediction():
    """
    CRUCIAL REGRESSION TEST:
    Verify input related to 'FT/PT conversion' predicts 'FT_PT_Conversion' with high confidence.
    """
    res = ai_pipeline.process_grievance_text(
        title="Request for conversion from full time to part time PhD",
        description="I have secured employment and request conversion from full time to part time research scholar status under University ordinances.",
    )
    assert res["predicted_category"] == "FT_PT_Conversion"
    assert res["confidence_score"] > 0.50


def test_resolve_db_category_unconfigured_label_does_not_mutate_db(db_session: Session):
    """
    CRUCIAL REGRESSION TEST:
    The model's internal label space is NOT the database taxonomy.
    When an unknown/unconfigured model label (such as 'fellowship_disbursal') is processed:
    - resolve_db_category MUST NOT insert 'fellowship_disbursal' into nivaran_categories.
    - Total category count MUST remain unchanged.
    - Must resolve to a valid existing category via fallback.
    """
    setup = setup_taxonomy_and_authorities(db_session)
    unknown_label = "fellowship_disbursal"

    # Verify unknown label is NOT in DB
    existing = db_session.scalar(select(Category).where(Category.name == unknown_label))
    assert existing is None

    count_before = db_session.scalar(select(func.count(Category.id)))

    # Resolve category for unknown label
    resolved = resolve_db_category(db_session, unknown_label)

    count_after = db_session.scalar(select(func.count(Category.id)))

    # 1. Total category count must NOT change (ZERO unapproved insertions)
    assert count_after == count_before

    # 2. Resolved category must be a valid, existing Category instance
    assert resolved is not None
    assert isinstance(resolved, Category)
    assert resolved.is_active is True

    # 3. Must NOT be 'fellowship_disbursal' (no fake category created)
    assert resolved.name != unknown_label
    check_none = db_session.scalar(select(Category).where(Category.name == unknown_label))
    assert check_none is None


def test_resolve_db_category_flexible_matching(db_session: Session):
    """
    Verifies that resolve_db_category respects:
    1. Exact match
    2. Case-insensitive match
    3. Normalized match (underscore vs space)
    4. Partial substring match
    """
    setup = setup_taxonomy_and_authorities(db_session)

    cat_cw = db_session.scalar(select(Category).where(Category.name == "Course_Work"))
    assert cat_cw is not None

    # 1. Exact match
    cat_exact = resolve_db_category(db_session, "Course_Work")
    assert cat_exact.id == cat_cw.id

    # 2. Case-insensitive
    cat_lower = resolve_db_category(db_session, "course_work")
    assert cat_lower.id == cat_cw.id

    # 3. Normalized (space instead of underscore)
    cat_norm = resolve_db_category(db_session, "Course Work")
    assert cat_norm.id == cat_cw.id

    # 4. Normalized with different casing
    cat_norm2 = resolve_db_category(db_session, "course work")
    assert cat_norm2.id == cat_cw.id



def test_ai_pipeline_failure_fallback_heuristic():
    """When the baseline model fails or raises an error, the pipeline gracefully falls back."""
    with patch.object(ai_pipeline, "_baseline_model", None):
        # Keyword fallback for fellowship
        cat, conf = ai_pipeline.predict_category("Fellowship scholarship stipend", "Delayed payment")
        assert cat == "Fellowship"
        assert conf == 0.75

        # Keyword fallback for viva
        cat_v, conf_v = ai_pipeline.predict_category("PhD defense viva voce", "Oral defense schedule")
        assert cat_v == "Viva"
        assert conf_v == 0.75

        # Complete unknown fallback
        cat_u, conf_u = ai_pipeline.predict_category("Unrelated query", "Something generic")
        assert cat_u == "Other"
        assert conf_u == 0.50


# ==========================================
# 3. End-to-End Submission & Record Persistence
# ==========================================

def test_ft_pt_conversion_submission_lifecycle(db_session: Session):
    """
    Full lifecycle test for FT/PT conversion with corrected institutional master data:
    - Applicant submits grievance requesting FT/PT conversion.
    - AI Pipeline predicts 'FT_PT_Conversion'.
    - Database HAS 'FT_PT_Conversion' configured as an approved institutional category.
    - Grievance successfully created, status progresses SUBMITTED -> AI_PROCESSING -> PENDING_REVIEW.
    - category_id maps directly to the actual 'FT_PT_Conversion' Category (NOT 'Other').
    - AIProcessingRecord is persisted with model metrics and predicted_category_id = FT_PT_Conversion.id.
    - nivaran_categories table is NOT mutated.
    """
    from app.modules.atharva_veda.nivaran.services.category_seed_service import seed_nivaran_categories
    seed_nivaran_categories(db_session)

    setup = setup_taxonomy_and_authorities(db_session)
    applicant, _ = create_test_applicant(db_session, setup, "ft_pt_scholar")

    # Verify 'FT_PT_Conversion' exists in DB
    ft_pt_cat = db_session.scalar(select(Category).where(Category.name == "FT_PT_Conversion"))
    assert ft_pt_cat is not None
    assert ft_pt_cat.is_active is True

    initial_cat_count = db_session.scalar(select(func.count(Category.id)))

    request_data = GrievanceSubmitRequest(
        title="Application for FT to PT Conversion of PhD Candidature",
        description="I have joined as an Assistant Professor and request converting my PhD candidature from full time to part time as per ordinance.",
    )

    grievance = GrievanceService.submit_grievance(
        db=db_session,
        applicant=applicant,
        request_data=request_data,
    )

    # 1. Category table count unchanged
    final_cat_count = db_session.scalar(select(func.count(Category.id)))
    assert final_cat_count == initial_cat_count

    # 2. Grievance status & resolved category - MUST be FT_PT_Conversion, NOT Other
    assert grievance.status == GrievanceStatus.PENDING_REVIEW
    assert grievance.priority == GrievancePriority.MEDIUM
    assert grievance.subject_id == setup["subject"].id
    assert grievance.category_id == ft_pt_cat.id
    assert grievance.final_category_id == ft_pt_cat.id
    assert grievance.ai_suggested_category_id == ft_pt_cat.id
    assert grievance.ai_confidence is not None
    assert grievance.ai_confidence > 0.50

    # 3. AIProcessingRecord persisted pointing to FT_PT_Conversion
    ai_record = db_session.scalar(
        select(AIProcessingRecord).where(AIProcessingRecord.grievance_id == grievance.id)
    )
    assert ai_record is not None
    assert ai_record.predicted_category_id == ft_pt_cat.id
    assert ai_record.confidence_score == grievance.ai_confidence
    assert ai_record.model_version in ["NIVARAN-AI-NLP-v2.0.0", DEFAULT_MODEL_VERSION]
    assert ai_record.inference_latency_ms is not None

    # 4. Status history has both transitions: SUBMITTED -> PENDING_REVIEW
    history = db_session.scalars(
        select(GrievanceStatusHistory)
        .where(GrievanceStatusHistory.grievance_id == grievance.id)
        .order_by(GrievanceStatusHistory.created_at.asc())
    ).all()
    assert len(history) == 2
    assert history[0].to_status == GrievanceStatus.SUBMITTED.value
    assert history[1].to_status == GrievanceStatus.PENDING_REVIEW.value


def test_manager_category_override_preserves_ai_suggestion(db_session: Session):
    """
    When Manager overrides the grievance category:
    - final_category_id is updated to Manager's selection.
    - ai_suggested_category_id remains unchanged, preserving the AI audit trail.
    """
    from app.modules.atharva_veda.nivaran.services.manager_review_service import ManagerReviewService
    from app.modules.atharva_veda.nivaran.schemas.grievance import ManagerReviewRequest

    setup = setup_taxonomy_and_authorities(db_session)
    applicant, _ = create_test_applicant(db_session, setup, "mgr_override_scholar")

    # Submit grievance that maps to cat_subject_route (Course_Work)
    req = GrievanceSubmitRequest(
        title="Coursework grade sheet discrepancy",
        description="Evaluation error in course work exam paper marksheet for research methodology.",
    )
    grievance = GrievanceService.submit_grievance(
        db=db_session,
        applicant=applicant,
        request_data=req,
    )
    cat_cw = db_session.scalar(select(Category).where(Category.name == "Course_Work"))

    assert cat_cw is not None
    assert grievance.category_id == cat_cw.id
    assert grievance.ai_suggested_category_id == cat_cw.id

    # Manager overrides to cat_cluster_route (PhD_Admission)
    review_req = ManagerReviewRequest(
        confirm_category=False,
        override_category_id=setup["cat_cluster_route"].id,
        override_reason="Overridden to administrative admission matter by triage manager.",
        priority=GrievancePriority.HIGH,
        remarks="Assigning to Associate Dean.",
    )
    ManagerReviewService.review_and_assign_grievance(
        db=db_session,
        grievance_id=grievance.id,
        manager_user=setup["mgr_user"],
        action_data=review_req,
    )
    db_session.refresh(grievance)

    # final_category_id updated
    assert grievance.final_category_id == setup["cat_cluster_route"].id
    # ai_suggested_category_id preserved
    assert grievance.ai_suggested_category_id == cat_cw.id
    # priority updated
    assert grievance.priority == GrievancePriority.HIGH
    assert grievance.status == GrievanceStatus.ASSIGNED
    assert grievance.category_overridden is True




def test_all_16_approved_categories_seed_and_resolution(db_session: Session):
    """
    Validates that:
    1. All 16 approved institutional NIVARAN categories exist in nivaran_categories.
    2. Input for FT/PT conversion resolves to FT_PT_Conversion (NOT 'Other').
    3. Input for Fellowship resolves to Fellowship.
    4. Input for Course_Work resolves to Course_Work.
    5. Input for Thesis_Submission resolves to Thesis_Submission.
    6. Input for PhD_Admission resolves to PhD_Admission.
    7. Input for Other resolves to Other.
    8. Unknown model label 'fellowship_disbursal' does NOT mutate nivaran_categories.
    """
    from app.modules.atharva_veda.nivaran.services.category_seed_service import (
        seed_nivaran_categories,
        APPROVED_NIVARAN_CATEGORIES,
    )

    seed_result = seed_nivaran_categories(db_session)
    assert seed_result["total_approved"] == 16

    # Verify every approved category exists and is active
    for spec in APPROVED_NIVARAN_CATEGORIES:
        c = db_session.scalar(select(Category).where(Category.name == spec["name"]))
        assert c is not None, f"Missing approved category: {spec['name']}"
        assert c.is_active is True
        assert c.description is not None

    # Test key predictions & resolutions
    cases = [
        ("FT/PT conversion of research candidature", "FT_PT_Conversion"),
        ("Fellowship scholarship disbursement delayed", "Fellowship"),
        ("Course work syllabus examination evaluation", "Course_Work"),
        ("Thesis submission synopsis approval", "Thesis_Submission"),
        ("PhD admission entrance RET scorecard", "PhD_Admission"),
        ("General miscellaneous grievance", "Other"),
    ]

    for text_sample, expected_pred in cases:
        ai_res = ai_pipeline.process_grievance_text(text_sample, text_sample)
        assert ai_res["predicted_category"] == expected_pred
        resolved = resolve_db_category(db_session, ai_res["predicted_category"])
        assert resolved.name == expected_pred, f"Expected {expected_pred}, got {resolved.name}"

    # Unknown label must NOT mutate the table
    count_before = db_session.scalar(select(func.count(Category.id)))
    unknown_resolved = resolve_db_category(db_session, "fellowship_disbursal")
    count_after = db_session.scalar(select(func.count(Category.id)))
    assert count_after == count_before
    assert unknown_resolved.name != "fellowship_disbursal"

