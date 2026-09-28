"""
NIVARAN Pillar Local AI Module.

Exposes the verified local scikit-learn classifier pipeline for grievance categorization.
"""

from app.ai.pipeline import (
    EXPECTED_CLASSES,
    MODEL_NAME,
    MODEL_VERSION,
    NivaranAIPipeline,
    ai_pipeline,
)

__all__ = [
    "EXPECTED_CLASSES",
    "MODEL_NAME",
    "MODEL_VERSION",
    "NivaranAIPipeline",
    "ai_pipeline",
]
