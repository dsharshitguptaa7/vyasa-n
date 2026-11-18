# -*- coding: utf-8 -*-
"""
Core Operational Telemetry & Observability Infrastructure for VYASAⁿ.
Provides structured metrics collection, latency histograms, error counters,
and safe administrative health diagnostics.
"""

from collections import deque
from datetime import datetime, timezone
import threading
import time
from typing import Any, Dict, List, Optional


class OperationalMetricsTracker:
    """
    Thread-safe operational telemetry collector for Knowledge Centre retrieval,
    embedding generation, LLM synthesis, and persistence services.
    """

    def __init__(self, sample_window: int = 100):
        self._lock = threading.Lock()
        self._sample_window = sample_window

        self.total_queries = 0
        self.sufficient_evidence_count = 0
        self.insufficient_evidence_count = 0
        self.conflicting_sources_count = 0
        self.rate_limit_rejections = 0
        self.embedding_requests = 0
        self.embedding_failures = 0
        self.synthesis_requests = 0
        self.synthesis_failures = 0
        self.claim_validation_verified = 0
        self.claim_validation_flagged = 0
        self.conversation_persistence_failures = 0

        self.retrieval_latencies: deque = deque(maxlen=sample_window)
        self.embedding_latencies: deque = deque(maxlen=sample_window)
        self.synthesis_latencies: deque = deque(maxlen=sample_window)

        self.service_start_time = time.time()

    def record_query(
        self,
        retrieval_ms: float,
        synthesis_ms: float,
        evidence_status: str,
        has_conflict: bool = False,
        claim_status: Optional[str] = None,
    ) -> None:
        with self._lock:
            self.total_queries += 1
            self.retrieval_latencies.append(retrieval_ms)
            self.synthesis_latencies.append(synthesis_ms)

            if evidence_status == "sufficient":
                self.sufficient_evidence_count += 1
            elif evidence_status == "insufficient":
                self.insufficient_evidence_count += 1

            if has_conflict or evidence_status == "conflicting_sources":
                self.conflicting_sources_count += 1

            if claim_status == "verified":
                self.claim_validation_verified += 1
            elif claim_status == "flagged":
                self.claim_validation_flagged += 1

    def record_embedding(self, latency_ms: float, success: bool = True) -> None:
        with self._lock:
            self.embedding_requests += 1
            if success:
                self.embedding_latencies.append(latency_ms)
            else:
                self.embedding_failures += 1

    def record_synthesis_failure(self) -> None:
        with self._lock:
            self.synthesis_failures += 1

    def record_rate_limit_rejection(self) -> None:
        with self._lock:
            self.rate_limit_rejections += 1

    def record_persistence_failure(self) -> None:
        with self._lock:
            self.conversation_persistence_failures += 1

    def _calculate_stats(self, samples: deque) -> Dict[str, float]:
        if not samples:
            return {"avg_ms": 0.0, "p50_ms": 0.0, "p95_ms": 0.0, "count": 0}
        s = sorted(samples)
        count = len(s)
        avg = sum(s) / count
        p50 = s[int(count * 0.50)]
        p95 = s[min(int(count * 0.95), count - 1)]
        return {
            "avg_ms": round(avg, 2),
            "p50_ms": round(p50, 2),
            "p95_ms": round(p95, 2),
            "count": count,
        }

    def get_diagnostic_summary(self) -> Dict[str, Any]:
        with self._lock:
            uptime_seconds = round(time.time() - self.service_start_time, 1)
            total = max(1, self.total_queries)
            sufficiency_rate = round((self.sufficient_evidence_count / total) * 100, 2)

            return {
                "service": "VYASA-AI-Knowledge-Gateway",
                "status": "HEALTHY",
                "uptime_seconds": uptime_seconds,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "query_metrics": {
                    "total_queries": self.total_queries,
                    "evidence_sufficiency_rate_pct": sufficiency_rate,
                    "sufficient_evidence_count": self.sufficient_evidence_count,
                    "insufficient_evidence_count": self.insufficient_evidence_count,
                    "conflicting_sources_count": self.conflicting_sources_count,
                    "rate_limit_rejections": self.rate_limit_rejections,
                },
                "latency_benchmarks": {
                    "retrieval": self._calculate_stats(self.retrieval_latencies),
                    "embedding": self._calculate_stats(self.embedding_latencies),
                    "synthesis": self._calculate_stats(self.synthesis_latencies),
                },
                "reliability_metrics": {
                    "embedding_requests": self.embedding_requests,
                    "embedding_failures": self.embedding_failures,
                    "synthesis_failures": self.synthesis_failures,
                    "conversation_persistence_failures": self.conversation_persistence_failures,
                },
                "claim_grounding_stats": {
                    "verified_claims_count": self.claim_validation_verified,
                    "flagged_claims_count": self.claim_validation_flagged,
                },
            }


assistant_observability = OperationalMetricsTracker()
