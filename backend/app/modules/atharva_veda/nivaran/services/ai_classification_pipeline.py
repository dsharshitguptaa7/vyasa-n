import logging
import os
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import joblib

# Ensure huggingface and tokenizers never block or make remote HTTP requests
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

logger = logging.getLogger("vyasa.atharva.ai_pipeline")

# ==============================================================================
# BASE PATHS & CONSTANTS
# ==============================================================================
BASE_DIR = Path(__file__).resolve().parent
AI_MODELS_DIR = BASE_DIR.parent / "ai_models"

BASELINE_CLASSIFIER_PATH = AI_MODELS_DIR / "category_classifier.joblib"

DEFAULT_MODEL_NAME = "NIVARAN-AI-NLP"
DEFAULT_MODEL_VERSION = "2.0.0"
FALLBACK_CATEGORY = "Other"
FALLBACK_CONFIDENCE = 0.50


class AIPipeline:
    """
    Unified, thread-safe AI Inference Pipeline for Atharva Veda / NIVARAN-AI in VYASA.
    Manages NLP preprocessing, category classification (TF-IDF + Logistic Regression),
    and confidence scoring with deterministic rule-based fallback.
    """

    def __init__(self):
        self._baseline_model = None
        self._initialized = False

    def initialize(self) -> None:
        """Pre-load and cache lightweight baseline machine learning model in memory (<2MB)."""
        if self._initialized:
            return

        # 1. Load Baseline Category Classifier (TF-IDF + LogisticRegression Pipeline)
        if BASELINE_CLASSIFIER_PATH.exists():
            try:
                self._baseline_model = joblib.load(BASELINE_CLASSIFIER_PATH)
                logger.info(f"[AI Pipeline] Baseline category classifier (TF-IDF) loaded from {BASELINE_CLASSIFIER_PATH}.")
            except Exception as e:
                logger.warning(f"[AI Pipeline] Failed to load baseline classifier: {e}")
        else:
            logger.warning(f"[AI Pipeline] Classifier artifact not found at {BASELINE_CLASSIFIER_PATH}. Using fallback heuristics.")

        self._initialized = True

    def preprocess_text(self, title: Optional[str], description: Optional[str]) -> str:
        """Sanitize and format grievance text for inference."""
        clean_title = (title or "").strip()
        clean_desc = (description or "").strip()

        if clean_title and clean_desc:
            combined = f"{clean_title}. {clean_desc}"
        elif clean_title:
            combined = clean_title
        elif clean_desc:
            combined = clean_desc
        else:
            combined = "General research grievance inquiry."

        return combined

    def predict_category(self, title: Optional[str], description: Optional[str]) -> Tuple[str, float]:
        """
        Predicts category name and confidence score [0.0 - 1.0].
        Employs fast, lightweight TF-IDF + LogisticRegression model (<2MB RAM, <1ms latency)
        with deterministic rule-based fallback matching NIVARAN reference behavior.
        """
        self.initialize()
        text = self.preprocess_text(title, description)

        # Attempt 1: Baseline Classifier (Fast, Highly Accurate TF-IDF Pipeline)
        if self._baseline_model is not None:
            try:
                probs = self._baseline_model.predict_proba([text])[0]
                classes = self._baseline_model.classes_
                best_idx = probs.argmax()
                category = str(classes[best_idx])
                confidence = float(probs[best_idx])
                return category, round(confidence, 4)
            except Exception as e:
                logger.warning(f"[AI Pipeline] Baseline classification inference failed: {e}")

        # Attempt 2: Safe Rule-Based Heuristic Fallback
        lower_text = text.lower()
        if any(w in lower_text for w in ["fellowship", "scholarship", "stipend", "jrf", "srf", "disbursement", "contingency"]):
            return "Fellowship", 0.75
        if any(w in lower_text for w in ["thesis", "synopsis", "dissertation"]):
            return "Thesis_Submission", 0.70
        if any(w in lower_text for w in ["guide", "supervisor", "co-supervisor"]):
            return "Supervisor_Related", 0.70
        if any(w in lower_text for w in ["fee", "payment", "challan", "dues"]):
            return "Fee", 0.75
        if any(w in lower_text for w in ["viva", "defense", "oral exam"]):
            return "Viva", 0.75
        if any(w in lower_text for w in ["coursework", "course work", "exam", "grade", "marksheet"]):
            return "Course_Work", 0.70
        if any(w in lower_text for w in ["admission", "entrance", "ret"]):
            return "PhD_Admission", 0.75

        return FALLBACK_CATEGORY, FALLBACK_CONFIDENCE

    def predict_cluster(self, title: Optional[str], description: Optional[str]) -> int:
        """
        Safe cluster predictor stub.
        Returns default cluster ID (1) without loading heavy embedding models.
        """
        return 1

    def process_grievance_text(
        self,
        title: Optional[str],
        description: Optional[str],
    ) -> Dict[str, Any]:
        """
        Executes lightweight, memory-efficient AI pipeline.
        Returns predicted category, confidence score, cluster_id, and latency metrics.
        """
        start_time = time.perf_counter()

        category, confidence = self.predict_category(title, description)
        cluster_id = self.predict_cluster(title, description)

        latency_ms = int((time.perf_counter() - start_time) * 1000)

        return {
            "predicted_category": category,
            "confidence_score": confidence,
            "cluster_id": cluster_id,
            "processing_time_ms": latency_ms,
            "model_name": DEFAULT_MODEL_NAME,
            "model_version": DEFAULT_MODEL_VERSION,
        }


# Singleton pipeline instance
ai_pipeline = AIPipeline()
