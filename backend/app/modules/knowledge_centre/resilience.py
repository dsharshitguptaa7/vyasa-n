# -*- coding: utf-8 -*-
"""
Re-export module for backward compatibility with knowledge_centre references.
Actual implementation lives in app.core.resilience to avoid circular dependencies.
"""

from app.core.resilience import (
    ResilienceError,
    TransientApiError,
    ApiTimeoutError,
    ApiRateLimitError,
    PermanentApiError,
    is_retryable_exception,
    execute_with_resilience,
    QueryDeduplicator,
    query_deduplicator,
)

__all__ = [
    "ResilienceError",
    "TransientApiError",
    "ApiTimeoutError",
    "ApiRateLimitError",
    "PermanentApiError",
    "is_retryable_exception",
    "execute_with_resilience",
    "QueryDeduplicator",
    "query_deduplicator",
]
