# -*- coding: utf-8 -*-
"""
Distributed Rate Limiting Engine for VYASAⁿ Scholar-Facing AI Gateway.
Provides atomic sliding-window rate limiting backed by PostgreSQL to ensure
consistent enforcement across horizontally scaled DigitalOcean App Platform instances.

Features:
1. Atomic Sliding Window: Tracks exact timestamps in ai_assistant_rate_limits.
2. Cross-Instance Synchronization: Fully shared across multiple replicas.
3. Accurate Retry-After Header: Computes exact seconds until the earliest window slot expires.
4. Robust Resilience: If database is temporarily unavailable, fails open safely with critical
   operational logging to prevent total system outages.
5. Strict Identity Grounding: Uses authenticated current_user.id; strictly ignores client-supplied headers.
6. Payload & Prompt Protection: Bounded character length and token protection.
"""

from collections import defaultdict
from datetime import datetime, timedelta, timezone
import logging
import math
import threading
import time
from typing import Dict, Optional
import uuid

from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_db, get_current_user
from app.models.user import User
from app.modules.knowledge_centre.conversation_models import AiAssistantRateLimit

logger = logging.getLogger("vyasa.knowledge_centre.rate_limiter")

DEFAULT_WINDOW_SECONDS = 60
DEFAULT_MAX_REQUESTS = 20
MAX_PROMPT_CHARS = 1000
GLOBAL_CLEANUP_INTERVAL_SECONDS = 300  # Opportunistic global purge interval (5 minutes)

# In-process thread locks per user (guarantees local thread serialization for SQLite and in-memory test harnesses)
_user_thread_locks: Dict[uuid.UUID, threading.Lock] = defaultdict(threading.Lock)
_user_thread_locks_guard = threading.Lock()


def _get_user_thread_lock(user_id: uuid.UUID) -> threading.Lock:
    with _user_thread_locks_guard:
        return _user_thread_locks[user_id]


class DistributedRateLimiter:
    """
    PostgreSQL-backed atomic sliding-window rate limiter for multi-instance deployments.
    Uses transaction-scoped advisory locks on PostgreSQL (pg_advisory_xact_lock)
    combined with in-process thread locking to guarantee strict serialization per user.

    Fail-Open Institutional Policy:
    If the database encounters a transient connection error or table lock timeout,
    this limiter fails open (returns None) with high-priority error logging.
    Rationale: In an institutional university portal, transient DB hiccup should not
    prevent scholars from accessing statutory guidance or thesis submission regulations.
    Edge protection (Cloudflare / DigitalOcean App Platform ingress) guards against
    high-volume denial-of-service attempts.
    """

    def __init__(
        self,
        window_seconds: int = DEFAULT_WINDOW_SECONDS,
        max_requests: int = DEFAULT_MAX_REQUESTS,
    ):
        self.window_seconds = window_seconds
        self.max_requests = max_requests
        self._last_global_cleanup_ts: float = 0.0

    def cleanup_expired_records(
        self,
        db: Session,
        max_age_seconds: int = 3600,
    ) -> int:
        """
        Safely purges expired rate limit records across all users older than max_age_seconds.
        Eliminates unbounded table growth without requiring Celery or Redis.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=max_age_seconds)
        try:
            res = db.execute(
                delete(AiAssistantRateLimit).where(
                    AiAssistantRateLimit.request_timestamp < cutoff
                )
            )
            db.commit()
            deleted_count = res.rowcount or 0
            if deleted_count > 0:
                logger.info(
                    "Purged %d expired rate limit records older than %ds across all users.",
                    deleted_count,
                    max_age_seconds,
                )
            return deleted_count
        except Exception as e:
            logger.warning("Failed to purge expired rate limit records: %s", e)
            try:
                db.rollback()
            except Exception:
                pass
            return 0

    def check_and_record(
        self,
        user_id: uuid.UUID,
        db: Session,
    ) -> Optional[int]:
        """
        Atomically inspects request history for user_id within the active sliding window:
        1. Serializes concurrent requests for the user using PostgreSQL transaction-scoped advisory locks.
        2. Purges expired timestamps older than window_seconds for this user.
        3. Counts active requests within the window.
        4. If count >= max_requests, calculates remaining seconds on the oldest active request
           and returns retry_after integer (indicating rate limit exceeded).
        5. If count < max_requests, inserts current timestamp and returns None (allowed).
        6. Periodically runs opportunistic global cleanup to bound table growth.
        """
        now = datetime.now(timezone.utc)
        window_start = now - timedelta(seconds=self.window_seconds)

        # 1. Acquire local thread lock for this user (for thread-safe SQLite testing & local worker safety)
        user_lock = _get_user_thread_lock(user_id)

        with user_lock:
            try:
                # 2. Acquire transaction-scoped advisory lock in PostgreSQL (cross-pod, cross-instance serialization)
                # If acquiring the advisory lock fails on PostgreSQL (connectivity, timeout, lock contention),
                # we log ERROR, rollback the session, and fail open safely rather than silently executing unlocked.
                bind = db.get_bind()
                if bind and bind.dialect.name == "postgresql":
                    try:
                        # Convert first 8 bytes of UUID to a signed 64-bit integer
                        advisory_key = int.from_bytes(user_id.bytes[:8], byteorder="big", signed=True)
                        db.execute(select(func.pg_advisory_xact_lock(advisory_key)))
                    except Exception as lock_err:
                        logger.error(
                            "PostgreSQL advisory lock acquisition failed for user %s: %s. "
                            "Rolling back session and failing open safely per institutional availability policy.",
                            user_id,
                            lock_err,
                            exc_info=True,
                        )
                        try:
                            db.rollback()
                        except Exception:
                            pass
                        return None

                # 3. Purge expired requests for this user
                db.execute(
                    delete(AiAssistantRateLimit).where(
                        AiAssistantRateLimit.user_id == user_id,
                        AiAssistantRateLimit.request_timestamp < window_start,
                    )
                )

                # 4. Query active requests in window ordered by timestamp asc
                active_entries = db.scalars(
                    select(AiAssistantRateLimit.request_timestamp)
                    .where(
                        AiAssistantRateLimit.user_id == user_id,
                        AiAssistantRateLimit.request_timestamp >= window_start,
                    )
                    .order_by(AiAssistantRateLimit.request_timestamp.asc())
                ).all()

                current_count = len(active_entries)

                if current_count >= self.max_requests:
                    # Calculate Retry-After based on oldest entry in window
                    oldest_ts = active_entries[0]
                    if oldest_ts.tzinfo is None:
                        oldest_ts = oldest_ts.replace(tzinfo=timezone.utc)

                    elapsed = (now - oldest_ts).total_seconds()
                    retry_after = max(1, math.ceil(self.window_seconds - elapsed))
                    logger.warning(
                        "Distributed rate limit exceeded for user %s: %d/%d in %ds window. Retry-After: %ds",
                        user_id,
                        current_count,
                        self.max_requests,
                        self.window_seconds,
                        retry_after,
                    )
                    # Commit the purge so transaction ends and releases advisory lock immediately
                    db.commit()
                    return retry_after

                # 5. Record current request atomically
                new_entry = AiAssistantRateLimit(
                    user_id=user_id,
                    request_timestamp=now,
                )
                db.add(new_entry)
                db.commit()

                # 6. Opportunistic bounded global cleanup (every 5 minutes)
                if time.time() - self._last_global_cleanup_ts > GLOBAL_CLEANUP_INTERVAL_SECONDS:
                    self._last_global_cleanup_ts = time.time()
                    self.cleanup_expired_records(db, max_age_seconds=max(300, self.window_seconds * 2))

                return None

            except Exception as e:
                logger.error(
                    "Rate limit storage error on user %s: %s. Failing open safely for service continuity.",
                    user_id,
                    e,
                    exc_info=True,
                )
                try:
                    db.rollback()
                except Exception:
                    pass
                # Fail open to prevent database hiccups from blocking scholars
                return None


# Global limiter singleton
distributed_rate_limiter = DistributedRateLimiter()


def enforce_distributed_rate_limit(
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    """
    FastAPI dependency enforcing distributed sliding-window rate limiting on endpoints.
    Attaches Retry-After header on HTTP 429 response.
    """
    # Guard: Prompt character limit is validated by Pydantic schema (min 2, max 1000)
    retry_after = distributed_rate_limiter.check_and_record(current_user.id, db)
    if retry_after is not None:
        response.headers["Retry-After"] = str(retry_after)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Please wait {retry_after} seconds before sending another inquiry.",
            headers={"Retry-After": str(retry_after)},
        )
    return current_user
