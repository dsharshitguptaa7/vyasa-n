# -*- coding: utf-8 -*-
"""
Re-export module for backward compatibility with knowledge_centre references.
Actual implementation lives in app.core.observability to avoid circular dependencies.
"""

from app.core.observability import (
    OperationalMetricsTracker,
    assistant_observability,
)

__all__ = [
    "OperationalMetricsTracker",
    "assistant_observability",
]
