import time
import math
import logging
from typing import Dict, List, Set, Tuple, Optional
from threading import Lock
from fastapi import Request, HTTPException, status

from app.core.config import settings

logger = logging.getLogger("vyasa.phd_rag.rate_limiter")


class InMemorySlidingWindowRateLimiter:
    """
    Thread-safe in-memory sliding-window rate limiter.
    Safely resolves client IP without trusting arbitrary forwarded headers
    from untrusted sources.
    """

    def __init__(self):
        self._lock = Lock()
        self._records: Dict[str, List[float]] = {}
        self._last_cleanup = time.time()

    def _cleanup_stale_entries(self, now: float, window: int):
        """Periodically purge IPs with no requests in current window."""
        if now - self._last_cleanup < 120:
            return
        self._last_cleanup = now
        stale_ips = []
        for ip, timestamps in self._records.items():
            valid = [ts for ts in timestamps if now - ts < window]
            if not valid:
                stale_ips.append(ip)
            else:
                self._records[ip] = valid
        for ip in stale_ips:
            self._records.pop(ip, None)

    def is_allowed(
        self,
        key: str,
        limit: int,
        window: int,
    ) -> Tuple[bool, int]:
        """
        Check if request under `key` is allowed within `window` seconds.
        Returns (is_allowed, retry_after_seconds).
        """
        now = time.time()
        with self._lock:
            self._cleanup_stale_entries(now, window)
            timestamps = self._records.get(key, [])
            # Filter timestamps inside window
            valid_timestamps = [ts for ts in timestamps if now - ts < window]

            if len(valid_timestamps) >= limit:
                oldest = valid_timestamps[0]
                retry_after = max(1, math.ceil(window - (now - oldest)))
                self._records[key] = valid_timestamps
                return False, retry_after

            valid_timestamps.append(now)
            self._records[key] = valid_timestamps
            return True, 0

    def reset(self):
        """Reset state (for test isolation)."""
        with self._lock:
            self._records.clear()
            self._last_cleanup = time.time()


# Global limiter singleton
rate_limiter = InMemorySlidingWindowRateLimiter()


def resolve_client_ip(
    request: Request,
    trusted_proxies: Optional[Set[str]] = None,
) -> str:
    """
    Safely extracts client IP address.
    Arbitrary client headers (X-Forwarded-For, CF-Connecting-IP) are IGNORED
    unless the immediate peer connection originates from a trusted upstream proxy.
    """
    if trusted_proxies is None:
        raw_proxies = getattr(settings, "TRUSTED_PROXIES", "127.0.0.1,::1")
        trusted_proxies = {p.strip() for p in raw_proxies.split(",") if p.strip()}

    peer_ip = request.client.host if request.client else "127.0.0.1"

    # Only inspect forwarding headers if request comes from a trusted upstream proxy
    if peer_ip in trusted_proxies:
        # Check Cloudflare header first if present
        cf_ip = request.headers.get("cf-connecting-ip")
        if cf_ip and cf_ip.strip():
            return cf_ip.strip()

        # Check standard X-Forwarded-For (take the client-most / first IP)
        x_forwarded_for = request.headers.get("x-forwarded-for")
        if x_forwarded_for:
            parts = [p.strip() for p in x_forwarded_for.split(",") if p.strip()]
            if parts:
                return parts[0]

        # Check X-Real-IP
        x_real_ip = request.headers.get("x-real-ip")
        if x_real_ip and x_real_ip.strip():
            return x_real_ip.strip()

    # When not behind a trusted proxy, use direct peer IP
    return peer_ip


async def check_phd_rag_rate_limit(request: Request) -> bool:
    """
    FastAPI dependency enforcing public endpoint rate limits.
    Raises HTTP 429 Too Many Requests if quota is exceeded.
    """
    if not getattr(settings, "PHD_RAG_RATE_LIMIT_ENABLED", True):
        return True

    limit = getattr(settings, "PHD_RAG_RATE_LIMIT_PER_MINUTE", 20)
    window = getattr(settings, "PHD_RAG_RATE_LIMIT_WINDOW_SECONDS", 60)

    client_ip = resolve_client_ip(request)
    allowed, retry_after = rate_limiter.is_allowed(key=client_ip, limit=limit, window=window)

    if not allowed:
        logger.warning(
            "Rate limit exceeded on Ph.D. RAG public endpoint for IP: %s (limit: %s/%ss)",
            client_ip,
            limit,
            window,
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please wait a moment before sending another query.",
            headers={"Retry-After": str(retry_after)},
        )

    return True
