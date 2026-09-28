"""
Unit and Integration Tests for Local NIVARAN AI Pipeline.

Validates the 18 specific requirements:
1. Artifact exists.
2. Artifact loads successfully.
3. Loaded object is sklearn Pipeline.
4. Pipeline contains TF-IDF Vectorizer.
5. Pipeline contains Logistic Regression.
6. Model classes contain the expected 16 institutional categories.
7. Empty input uses the exact fallback text.
8. Title-only preprocessing is correct.
9. Description-only preprocessing is correct.
10. Title + description preprocessing is correct.
11. Prediction returns a valid category.
12. Confidence is between 0 and 1.
13. Confidence is rounded to 4 decimal places.
14. model_name is NIVARAN-AI-NLP.
15. model_version is 2.0.0.
16. Repeated predictions reuse the same loaded model instance.
17. No retraining occurs.
18. Corrupt/missing artifact produces a controlled model-loading error.
"""

from pathlib import Path
import pytest
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

from app.ai.pipeline import (
    DEFAULT_MODEL_PATH,
    EXPECTED_CLASSES,
    FALLBACK_PREPROCESS_TEXT,
    MODEL_NAME,
    MODEL_VERSION,
    NivaranAIPipeline,
    ai_pipeline,
)
from app.core.exceptions import ModelLoadError


def test_01_artifact_exists():
    """1. Artifact exists at the configured path."""
    assert DEFAULT_MODEL_PATH.exists(), f"Model artifact missing at {DEFAULT_MODEL_PATH}"
    assert DEFAULT_MODEL_PATH.is_file(), f"Model artifact is not a file: {DEFAULT_MODEL_PATH}"


def test_02_artifact_loads_successfully():
    """2. Artifact loads successfully into memory."""
    pipeline = NivaranAIPipeline()
    assert not pipeline.is_loaded
    pipeline.initialize()
    assert pipeline.is_loaded


def test_03_loaded_object_is_sklearn_pipeline():
    """3. Loaded object is an instance of sklearn.pipeline.Pipeline."""
    pipeline = NivaranAIPipeline()
    pipeline.initialize()
    assert isinstance(pipeline._pipeline, Pipeline)


def test_04_pipeline_contains_tfidf():
    """4. Pipeline contains a TfidfVectorizer step."""
    pipeline = NivaranAIPipeline()
    pipeline.initialize()
    has_tfidf = any(isinstance(step[1], TfidfVectorizer) for step in pipeline._pipeline.steps)
    assert has_tfidf, "Pipeline missing TfidfVectorizer step"


def test_05_pipeline_contains_logistic_regression():
    """5. Pipeline contains a LogisticRegression step."""
    pipeline = NivaranAIPipeline()
    pipeline.initialize()
    has_lr = any(isinstance(step[1], LogisticRegression) for step in pipeline._pipeline.steps)
    assert has_lr, "Pipeline missing LogisticRegression step"


def test_06_model_classes_contain_16_institutional_categories():
    """6. Model classes contain the expected 16 institutional categories."""
    pipeline = NivaranAIPipeline()
    pipeline.initialize()
    assert len(pipeline.classes) == 16
    assert sorted(pipeline.classes) == sorted(EXPECTED_CLASSES)


def test_07_empty_input_uses_exact_fallback_text():
    """7. Empty input uses the exact fallback text."""
    assert NivaranAIPipeline.preprocess_text("", "") == FALLBACK_PREPROCESS_TEXT
    assert NivaranAIPipeline.preprocess_text(None, None) == FALLBACK_PREPROCESS_TEXT
    assert NivaranAIPipeline.preprocess_text("   ", "   ") == FALLBACK_PREPROCESS_TEXT


def test_08_title_only_preprocessing():
    """8. Title-only preprocessing is correct."""
    title = "Fellowship stipend delayed for month of August"
    preprocessed = NivaranAIPipeline.preprocess_text(title, "")
    assert preprocessed == title

    preprocessed_none = NivaranAIPipeline.preprocess_text(f"  {title}  ", None)
    assert preprocessed_none == title


def test_09_description_only_preprocessing():
    """9. Description-only preprocessing is correct."""
    desc = "My monthly JRF fellowship has not been credited to my bank account."
    preprocessed = NivaranAIPipeline.preprocess_text("", desc)
    assert preprocessed == desc

    preprocessed_none = NivaranAIPipeline.preprocess_text(None, f"  {desc}  ")
    assert preprocessed_none == desc


def test_10_title_and_description_preprocessing():
    """10. Title + description preprocessing is correct."""
    title = "Fellowship Delay"
    desc = "Stipend not received for August."
    preprocessed = NivaranAIPipeline.preprocess_text(f"  {title}  ", f"  {desc}  ")
    assert preprocessed == f"{title}. {desc}"


def test_11_prediction_returns_valid_category():
    """11. Prediction returns a valid institutional category."""
    res = ai_pipeline.predict_category(
        "Delayed Monthly Stipend for Ph.D. Scholar",
        "My JRF fellowship contingency amount for the past 2 months has not been credited.",
    )
    assert res["category"] in EXPECTED_CLASSES
    assert res["category"] == "Fellowship"


def test_12_confidence_is_between_0_and_1():
    """12. Confidence is between 0.0 and 1.0."""
    res = ai_pipeline.predict_category(
        "Viva voce examination schedule",
        "When will the oral defence viva exam take place?",
    )
    assert 0.0 <= res["confidence"] <= 1.0
    assert res["category"] == "Viva"


def test_13_confidence_is_rounded_to_4_decimal_places():
    """13. Confidence is rounded to 4 decimal places."""
    res = ai_pipeline.predict_category(
        "Course work syllabus inquiry",
        "Where can I find the coursework exam timetable and marksheet?",
    )
    conf_str = str(res["confidence"])
    decimals = len(conf_str.split(".")[1]) if "." in conf_str else 0
    assert decimals <= 4


def test_14_model_name_metadata():
    """14. model_name is NIVARAN-AI-NLP."""
    res = ai_pipeline.predict_category("Test inquiry", "General description")
    assert res["model_name"] == MODEL_NAME
    assert res["model_name"] == "NIVARAN-AI-NLP"


def test_15_model_version_metadata():
    """15. model_version is 2.0.0."""
    res = ai_pipeline.predict_category("Test inquiry", "General description")
    assert res["model_version"] == MODEL_VERSION
    assert res["model_version"] == "2.0.0"


def test_16_repeated_predictions_reuse_same_model_instance():
    """16. Repeated predictions reuse the same loaded model instance in memory."""
    ai_pipeline.initialize()
    instance_before = id(ai_pipeline._pipeline)

    res1 = ai_pipeline.predict_category("Inquiry 1", "Description 1")
    instance_after1 = id(ai_pipeline._pipeline)

    res2 = ai_pipeline.predict_category("Inquiry 2", "Description 2")
    instance_after2 = id(ai_pipeline._pipeline)

    assert instance_before == instance_after1 == instance_after2
    assert res1 is not None and res2 is not None


def test_17_no_retraining_occurs():
    """17. No retraining occurs during inference (vocabulary and weights remain immutable)."""
    ai_pipeline.initialize()
    tfidf_step = ai_pipeline._pipeline.named_steps["tfidf"]
    vocab_len_before = len(tfidf_step.vocabulary_)

    classifier_step = ai_pipeline._pipeline.named_steps["classifier"]
    coef_hash_before = hash(classifier_step.coef_.tobytes())

    # Run predictions with new vocabulary words
    ai_pipeline.predict_category("Completely Novel OutOfVocabularyKeyword XYZ999", "Another new token 1234567")

    vocab_len_after = len(tfidf_step.vocabulary_)
    coef_hash_after = hash(classifier_step.coef_.tobytes())

    assert vocab_len_before == vocab_len_after, "Vocabulary was mutated during inference"
    assert coef_hash_before == coef_hash_after, "Model coefficients were mutated during inference"


def test_18_corrupt_or_missing_artifact_raises_model_load_error(tmp_path: Path):
    """18. Corrupt or missing artifact produces a controlled ModelLoadError."""
    # Test missing file
    missing_path = tmp_path / "non_existent_model.joblib"
    missing_pipeline = NivaranAIPipeline(model_path=missing_path)
    with pytest.raises(ModelLoadError) as exc_info:
        missing_pipeline.initialize()
    assert "not found" in str(exc_info.value).lower()
    assert exc_info.value.code == "AI_MODEL_LOAD_ERROR"

    # Test corrupt file
    corrupt_path = tmp_path / "corrupt_model.joblib"
    corrupt_path.write_bytes(b"Corrupt data not a pickle or joblib file")
    corrupt_pipeline = NivaranAIPipeline(model_path=corrupt_path)
    with pytest.raises(ModelLoadError) as exc_info_corrupt:
        corrupt_pipeline.initialize()
    assert "failed to deserialize" in str(exc_info_corrupt.value).lower()
    assert exc_info_corrupt.value.code == "AI_MODEL_LOAD_ERROR"
