import logging
import time
import uuid
from typing import Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.atharva_veda.nivaran.models.taxonomy import Category
from app.modules.atharva_veda.nivaran.models.ai_processing import AIProcessingRecord
from app.modules.atharva_veda.nivaran.models.grievance import Grievance
from app.modules.atharva_veda.nivaran.services.ai_classification_pipeline import (
    ai_pipeline,
    DEFAULT_MODEL_NAME,
    DEFAULT_MODEL_VERSION,
)

logger = logging.getLogger("vyasa.atharva.ai_processing")

MODEL_VERSION = f"{DEFAULT_MODEL_NAME}-v{DEFAULT_MODEL_VERSION}"


def resolve_db_category(db: Session, predicted_name: str) -> Category:
    """
    Resiliently resolves a predicted category string to an active Category in the database.
    Attempts:
      1. Exact match
      2. Case-insensitive match
      3. Space/underscore normalized match
      4. Partial substring match
      5. Fallback to 'Other' or first active category
    """
    if not predicted_name:
        predicted_name = "Other"

    # 1. Exact match
    category = db.scalar(
        select(Category).where(
            Category.name == predicted_name,
            Category.is_active.is_(True),
        )
    )
    if category is not None:
        return category

    # 2. Case-insensitive match
    category = db.scalar(
        select(Category).where(
            func.lower(Category.name) == predicted_name.lower(),
            Category.is_active.is_(True),
        )
    )
    if category is not None:
        return category

    # 3. Space / underscore normalized match
    all_categories = db.scalars(
        select(Category).where(Category.is_active.is_(True))
    ).all()

    norm_pred = predicted_name.replace("_", " ").strip().lower()
    for cat in all_categories:
        if cat.name.replace("_", " ").strip().lower() == norm_pred:
            return cat

    # Partial substring match
    for cat in all_categories:
        cat_norm = cat.name.replace("_", " ").strip().lower()
        if norm_pred in cat_norm or cat_norm in norm_pred:
            return cat

    # 4. Fallback to 'Other' category
    other_category = db.scalar(
        select(Category).where(
            func.lower(Category.name) == "other",
            Category.is_active.is_(True),
        )
    )
    if other_category is not None:
        return other_category

    # Absolute fallback: return first active category
    if all_categories:
        return all_categories[0]

    raise ValueError("No active categories found in database to map grievance.")


class AIProcessingService:
    @staticmethod
    def classify_grievance_category(
        db: Session,
        title: str,
        description: str,
    ) -> Tuple[Optional[Category], float, int]:
        """
        Classifies incoming grievance text into the best-matching active Category using
        the TF-IDF + LogisticRegression pipeline ported from NIVARAN reference.
        Returns (predicted_category, confidence_score, latency_ms).
        """
        start_time = time.perf_counter()
        ai_res = ai_pipeline.process_grievance_text(title, description)
        predicted_name = ai_res["predicted_category"]
        confidence = float(ai_res["confidence_score"])
        latency_ms = ai_res.get("processing_time_ms") or int((time.perf_counter() - start_time) * 1000)

        resolved_cat = resolve_db_category(db, predicted_name)
        return resolved_cat, confidence, max(1, latency_ms)

    @classmethod
    def process_new_grievance(
        cls,
        db: Session,
        grievance: Grievance,
    ) -> AIProcessingRecord:
        """
        Executes AI inference for a newly filed grievance:
        1. Runs TF-IDF + LogisticRegression inference.
        2. Resolves category in database.
        3. Persists AIProcessingRecord in nivaran_ai_processing_records.
        4. Updates grievance with initial category_id, ai_suggested_category_id and ai_confidence.
        """
        predicted_cat, confidence, latency_ms = cls.classify_grievance_category(
            db=db,
            title=grievance.title,
            description=grievance.description,
        )

        record = AIProcessingRecord(
            grievance_id=grievance.id,
            predicted_category_id=predicted_cat.id if predicted_cat else None,
            confidence_score=confidence,
            inference_latency_ms=latency_ms,
            model_version=MODEL_VERSION,
        )
        db.add(record)

        if predicted_cat:
            if not grievance.category_id:
                grievance.category_id = predicted_cat.id
            if not grievance.final_category_id:
                grievance.final_category_id = grievance.category_id or predicted_cat.id
            grievance.ai_suggested_category_id = predicted_cat.id

        grievance.ai_confidence = confidence

        logger.info(
            f"[AI Processing] Grievance {grievance.grievance_id} classified into "
            f"'{predicted_cat.name if predicted_cat else 'None'}' (confidence: {confidence:.4f}) in {latency_ms}ms"
        )
        return record
