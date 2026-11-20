# -*- coding: utf-8 -*-
"""
Core API Resilience & Retry Infrastructure for VYASAⁿ.
Provides bounded exponential backoff with jitter, explicit request timeouts,
clear error classification, request deduplication, and structured operational logging.
"""

from datetime import datetime, timezone
import logging
import random
import threading
import time
from typing import Any, Callable, Dict, Optional, Tuple, TypeVar

logger = logging.getLogger("vyasa.core.resilience")

T = TypeVar("T")

DEFAULT_MAX_RETRIES = 3
DEFAULT_BASE_DELAY = 1.0
DEFAULT_MAX_DELAY = 10.0
DEFAULT_JITTER_MAX = 0.5
DEFAULT_TIMEOUT_SECONDS = 30.0


class ResilienceError(Exception):
    """Base exception for resilience operations."""
    pass


class TransientApiError(ResilienceError):
    """Temporary failure eligible for exponential retry (e.g. 503, connection reset)."""
    pass


class ApiTimeoutError(TransientApiError):
    """Request exceeded explicit timeout window."""
    pass


class ApiRateLimitError(TransientApiError):
    """Provider returned 429 rate limit quota exhaustion."""
    pass


class PermanentApiError(ResilienceError):
    """Non-retryable failure (e.g. 400, 401, 403, invalid credentials)."""
    pass


def is_retryable_exception(exc: Exception) -> bool:
    """
    Classifies whether an exception represents a transient, retryable failure.
    Strictly forbids retrying credential, permission, or malformed request errors.
    """
    exc_str = str(exc).lower()

    non_retryable_patterns = [
        "invalid_api_key",
        "api_key_invalid",
        "permission_denied",
        "unauthenticated",
        "unauthorized",
        "invalid argument",
        "embeddingvalidationerror",
        "embeddingconfigurationerror",
        "embeddingmodelnotfounderror",
        "embeddingunsupportedoperationerror",
        "embeddingauthenticationerror",
        "embeddingpermanenterror",
        "bad request",
        "status code 400",
        "status code 401",
        "status code 403",
        "status code 404",
        "400 bad request",
        "401 unauthorized",
        "403 forbidden",
        "404 not found",
        "404 not_found",
        "not_found",
        "not found",
        "is not supported for embedcontent",
        "not supported for embedcontent",
    ]
    if any(pat in exc_str for pat in non_retryable_patterns):
        return False

    retryable_patterns = [
        "429",
        "resource_exhausted",
        "rate limit",
        "too many requests",
        "500",
        "502",
        "503",
        "504",
        "unavailable",
        "internal server error",
        "timeout",
        "timed out",
        "connection reset",
        "connection refused",
        "connection error",
        "broken pipe",
        "remote disconnected",
    ]
    return any(pat in exc_str for pat in retryable_patterns)


def execute_with_resilience(
    func: Callable[..., T],
    *args: Any,
    operation_name: str = "External API Call",
    max_retries: int = DEFAULT_MAX_RETRIES,
    base_delay: float = DEFAULT_BASE_DELAY,
    max_delay: float = DEFAULT_MAX_DELAY,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    **kwargs: Any,
) -> T:
    """
    Executes a callable with bounded retries, exponential backoff with jitter,
    and strict retryable error filtering.
    """
    start_time = time.time()
    last_exception: Optional[Exception] = None

    for attempt in range(1, max_retries + 1):
        try:
            if time.time() - start_time > timeout_seconds:
                raise ApiTimeoutError(
                    f"{operation_name} exceeded total timeout of {timeout_seconds}s before attempt {attempt}."
                )

            logger.debug("Executing %s (attempt %d/%d)", operation_name, attempt, max_retries)
            result = func(*args, **kwargs)
            duration = round((time.time() - start_time) * 1000, 2)
            logger.info("%s succeeded on attempt %d (%sms)", operation_name, attempt, duration)
            return result

        except Exception as exc:
            last_exception = exc
            duration = round((time.time() - start_time) * 1000, 2)

            if not is_retryable_exception(exc):
                logger.error(
                    "%s failed permanently on attempt %d (%sms) with non-retryable error: %s",
                    operation_name,
                    attempt,
                    duration,
                    exc,
                )
                raise PermanentApiError(f"Permanent failure in {operation_name}: {exc}") from exc

            if attempt == max_retries:
                logger.error(
                    "%s exhausted all %d retry attempts (%sms). Last error: %s",
                    operation_name,
                    max_retries,
                    duration,
                    exc,
                )
                raise TransientApiError(
                    f"{operation_name} failed after {max_retries} retries: {exc}"
                ) from exc

            backoff = min(max_delay, base_delay * (2 ** (attempt - 1)))
            jitter = random.uniform(0, DEFAULT_JITTER_MAX)
            sleep_duration = round(backoff + jitter, 3)

            logger.warning(
                "%s transient error on attempt %d (%s). Retrying in %ss...",
                operation_name,
                attempt,
                exc,
                sleep_duration,
            )
            time.sleep(sleep_duration)

    raise last_exception if last_exception else ResilienceError(f"{operation_name} failed unexpectedly.")


class QueryDeduplicator:
    """
    Thread-safe short-lived memoizer (10s TTL) preventing duplicate identical concurrent
    expensive LLM generation requests across simultaneous requests.
    """

    def __init__(self, ttl_seconds: float = 10.0, max_entries: int = 100):
        self.ttl_seconds = ttl_seconds
        self.max_entries = max_entries
        self._cache: Dict[str, Tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        now = time.time()
        with self._lock:
            if key in self._cache:
                timestamp, val = self._cache[key]
                if now - timestamp < self.ttl_seconds:
                    return val
                del self._cache[key]
        return None

    def set(self, key: str, value: Any) -> None:
        now = time.time()
        with self._lock:
            if len(self._cache) >= self.max_entries:
                expired = [k for k, (ts, _) in self._cache.items() if now - ts >= self.ttl_seconds]
                for k in expired:
                    del self._cache[k]
                if len(self._cache) >= self.max_entries:
                    oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k][0])
                    del self._cache[oldest_key]
            self._cache[key] = (now, value)


query_deduplicator = QueryDeduplicator()
