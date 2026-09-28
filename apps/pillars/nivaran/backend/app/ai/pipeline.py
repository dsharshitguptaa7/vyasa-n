"""
Local AI Inference Pipeline for NIVARAN Pillar.

Provides thread-safe, ultra-lightweight category classification and confidence scoring
using the verified, pre-trained local scikit-learn Pipeline (TF-IDF + Logistic Regression).

Architecture Constraints:
- 100% offline, local CPU inference (<1 ms latency, ~1.8 MB RAM).
- ZERO external AI APIs (No OpenAI, No Gemini, No Anthropic, No cloud inference).
- ZERO deep learning runtime overhead (No PyTorch, No transformers, No sentence-transformers).
- NO runtime retraining or model modification.
"""

import logging
import threading
import warnings
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
from sklearn.exceptions import InconsistentVersionWarning
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

from app.core.exceptions import ModelLoadError

logger = logging.getLogger("nivaran.ai")

# ==============================================================================
# CONSTANTS & INSTITUTIONAL CONFIGURATION
# ==============================================================================

MODEL_NAME = "NIVARAN-AI-NLP"
MODEL_VERSION = "2.0.0"
FALLBACK_PREPROCESS_TEXT = "General research grievance inquiry."

# Expected exact 16 institutional category classes (alphabetical)
EXPECTED_CLASSES: Tuple[str, ...] = (
    "Course_Work",
    "Fee",
    "Fellowship",
    "FT_PT_Conversion",
    "Other",
    "PhD_Admission",
    "Portal_Data_Correction",
    "Publication_Verification",
    "RAC",
    "RDC",
    "Registration",
    "RTI_IIGRS",
    "Supervisor_Related",
    "Thesis_Evaluation",
    "Thesis_Submission",
    "Viva",
)

DEFAULT_MODEL_DIR = Path(__file__).resolve().parent / "models"
DEFAULT_MODEL_PATH = DEFAULT_MODEL_DIR / "category_classifier.joblib"


class NivaranAIPipeline:
    """
    Thread-safe, singleton-compatible local AI inference engine.
    Loads and validates the pre-trained Scikit-Learn Pipeline once into memory
    and serves concurrent predictions without model re-instantiation or mutation.
    """

    def __init__(self, model_path: Optional[Path] = None) -> None:
        self._model_path: Path = model_path or DEFAULT_MODEL_PATH
        self._pipeline: Optional[Pipeline] = None
        self._classes: List[str] = []
        self._lock = threading.Lock()

    @property
    def model_path(self) -> Path:
        """Configured path to the serialized model artifact."""
        return self._model_path

    @property
    def is_loaded(self) -> bool:
        """True if the model artifact has been loaded and validated in memory."""
        return self._pipeline is not None

    @property
    def classes(self) -> List[str]:
        """List of target category classes recognized by the model."""
        return list(self._classes)

    @property
    def model_name(self) -> str:
        """Canonical identifier of the model."""
        return MODEL_NAME

    @property
    def model_version(self) -> str:
        """Version string of the model."""
        return MODEL_VERSION

    def initialize(self) -> None:
        """
        Loads the serialized pipeline artifact once into memory and verifies its integrity.
        Thread-safe; subsequent calls are no-ops.
        Raises ModelLoadError if the artifact cannot be loaded, is missing, or is invalid.
        """
        if self._pipeline is not None:
            return

        with self._lock:
            # Double-check inside lock
            if self._pipeline is not None:
                return

            if not self._model_path.exists():
                raise ModelLoadError(
                    f"Model artifact not found at configured path: {self._model_path.name}"
                )

            if not self._model_path.is_file():
                raise ModelLoadError(
                    f"Model path does not point to a valid file: {self._model_path.name}"
                )

            try:
                with warnings.catch_warnings():
                    # Suppress benign minor version difference warnings from joblib/sklearn
                    warnings.filterwarnings("ignore", category=InconsistentVersionWarning)
                    loaded_obj = joblib.load(self._model_path)
            except Exception as exc:
                raise ModelLoadError(
                    f"Failed to deserialize model artifact '{self._model_path.name}': {exc}"
                ) from exc

            # Verify that the loaded object is a Scikit-Learn Pipeline
            if not isinstance(loaded_obj, Pipeline):
                raise ModelLoadError(
                    f"Expected loaded artifact to be sklearn.pipeline.Pipeline, got {type(loaded_obj).__name__}"
                )

            # Verify required pipeline steps: TfidfVectorizer and LogisticRegression
            has_tfidf = any(
                isinstance(step[1], TfidfVectorizer) for step in loaded_obj.steps
            )
            has_logistic = any(
                isinstance(step[1], LogisticRegression) for step in loaded_obj.steps
            )

            if not has_tfidf:
                raise ModelLoadError(
                    "Pipeline validation failed: Missing required 'TfidfVectorizer' step."
                )

            if not has_logistic:
                raise ModelLoadError(
                    "Pipeline validation failed: Missing required 'LogisticRegression' step."
                )

            # Verify class labels match institutional taxonomy
            if not hasattr(loaded_obj, "classes_"):
                raise ModelLoadError(
                    "Pipeline validation failed: Fitted pipeline has no 'classes_' attribute."
                )

            actual_classes = sorted(str(cls_name) for cls_name in loaded_obj.classes_)
            expected_classes_sorted = sorted(EXPECTED_CLASSES)

            if actual_classes != expected_classes_sorted:
                raise ModelLoadError(
                    f"Model classes mismatch. Expected: {expected_classes_sorted}, Got: {actual_classes}"
                )

            self._pipeline = loaded_obj
            self._classes = actual_classes

            logger.info(
                "NivaranAIPipeline loaded successfully (Model: %s v%s, Classes: %d)",
                self.model_name,
                self.model_version,
                len(self._classes),
            )

    @classmethod
    def preprocess_text(cls, title: Optional[str], description: Optional[str]) -> str:
        """
        Sanitize and compose grievance text for inference according to legacy rules.

        Rules:
        - title = (title or "").strip()
        - description = (description or "").strip()
        - If both: f"{title}. {description}"
        - If title only: title
        - If description only: description
        - If both empty: "General research grievance inquiry."
        """
        clean_title = (title or "").strip()
        clean_desc = (description or "").strip()

        if clean_title and clean_desc:
            return f"{clean_title}. {clean_desc}"
        elif clean_title:
            return clean_title
        elif clean_desc:
            return clean_desc
        else:
            return FALLBACK_PREPROCESS_TEXT

    def predict_category(
        self,
        title: Optional[str],
        description: Optional[str],
    ) -> Dict[str, Any]:
        """
        Execute deterministic local inference on the provided grievance text.

        Returns:
            {
                "category": str,
                "confidence": float,
                "model_name": "NIVARAN-AI-NLP",
                "model_version": "2.0.0"
            }
        """
        if self._pipeline is None:
            self.initialize()

        assert self._pipeline is not None  # Guaranteed by initialize()

        text = self.preprocess_text(title, description)

        # Thread-safe read-only inference
        probabilities = self._pipeline.predict_proba([text])[0]
        classes = self._pipeline.classes_
        best_idx = probabilities.argmax()

        category = str(classes[best_idx])
        confidence = float(probabilities[best_idx])

        return {
            "category": category,
            "confidence": round(confidence, 4),
            "model_name": self.model_name,
            "model_version": self.model_version,
        }


# Global singleton instance for application use
ai_pipeline = NivaranAIPipeline()
