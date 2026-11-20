# -*- coding: utf-8 -*-
"""
VYASA Centralized Embedding Service
Unified embedding architecture with Google Gemini API and strict production safety.

Safety Guarantees:
1. Strict Production Fail-Fast: No silent fallback to pseudo-vectors in production.
2. Explicit Model & Dimensions: Centralized model and fixed 768-dim output.
3. Rigorous Vector Validation: Rejection of NaN, Inf, non-numerical, wrong-dimension, or empty vectors.
4. Consistent Normalization: Strict L2 normalization for cosine similarity consistency.
5. Full Provenance Metadata: Model, dimension, provider, mode, and timestamp tracking.
"""

import logging
import math
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np

from app.core.config import settings
from app.core.resilience import execute_with_resilience
from app.core.observability import assistant_observability

logger = logging.getLogger("vyasa.phd_rag.embedding")

# Centralized constants
DEFAULT_EMBEDDING_MODEL = getattr(settings, "GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
DEFAULT_EMBEDDING_DIMENSIONS = int(getattr(settings, "GEMINI_EMBEDDING_DIMENSIONS", 768))

# Backward compatibility alias
EMBEDDING_DIMENSIONS = DEFAULT_EMBEDDING_DIMENSIONS

_SENTINEL = object()


# ==============================================================================
# Custom Exceptions
# ==============================================================================

class EmbeddingError(Exception):
    """Base exception for all embedding-related errors."""
    pass


class EmbeddingGenerationError(EmbeddingError):
    """Raised when embedding generation fails from provider/API in production or strict mode."""
    pass


class EmbeddingPermanentError(EmbeddingGenerationError):
    """Base exception for non-retryable embedding errors (e.g. 404 model not found, unsupported operation, 401/403)."""
    pass


class EmbeddingModelNotFoundError(EmbeddingPermanentError):
    """Raised when configured embedding model is not found in Gemini API (e.g. 404 NOT_FOUND)."""
    pass


class EmbeddingUnsupportedOperationError(EmbeddingPermanentError):
    """Raised when model does not support embedContent operation."""
    pass


class EmbeddingAuthenticationError(EmbeddingPermanentError):
    """Raised when API credentials are missing, rejected, or unauthenticated (e.g. 401/403)."""
    pass


class EmbeddingConfigurationError(EmbeddingPermanentError):
    """Raised when embedding configuration or credentials are missing or invalid."""
    pass


class EmbeddingValidationError(EmbeddingPermanentError):
    """Raised when embedding vector fails validation (NaN, Inf, wrong dimensions, empty)."""
    pass


class EmbeddingTransientError(EmbeddingGenerationError):
    """Temporary failure eligible for retry (e.g. 429 rate limit, 503 unavailable, network timeout)."""
    pass


# ==============================================================================
# Vector Validation & Normalization
# ==============================================================================

def validate_and_normalize_vector(
    vector: Any,
    expected_dim: int = DEFAULT_EMBEDDING_DIMENSIONS,
    label: str = "Embedding vector",
) -> List[float]:
    """
    Validates that a vector:
    1. Is non-None and convertible to a 1D float array.
    2. Has exact length equal to expected_dim (strictly rejects empty or mismatched lengths).
    3. Contains only finite numerical floats (strictly rejects NaN, Inf, strings, None).
    4. Has non-zero L2 norm (not all zeros).
    5. Returns an L2-normalized list of floats.

    Raises:
        EmbeddingValidationError: If any rule is violated.
    """
    if vector is None:
        raise EmbeddingValidationError(f"{label} cannot be None.")

    try:
        arr = np.asarray(vector, dtype=np.float64)
    except (ValueError, TypeError) as e:
        raise EmbeddingValidationError(f"{label} could not be converted to float array: {e}")

    if arr.ndim != 1:
        raise EmbeddingValidationError(f"{label} must be 1-dimensional, got {arr.ndim} dimensions.")

    if len(arr) == 0:
        raise EmbeddingValidationError(f"{label} is empty (0 dimensions).")

    if len(arr) != expected_dim:
        raise EmbeddingValidationError(
            f"{label} dimension mismatch: expected {expected_dim}, got {len(arr)}."
        )

    if not np.all(np.isfinite(arr)):
        raise EmbeddingValidationError(f"{label} contains non-finite values (NaN or Inf).")

    norm = float(np.linalg.norm(arr))
    if norm <= 1e-12:
        raise EmbeddingValidationError(f"{label} has zero or near-zero L2 norm; cannot be normalized.")

    normalized = arr / norm
    return [float(x) for x in normalized]


# ==============================================================================
# Embedding Service Class
# ==============================================================================

class EmbeddingService:
    """
    Unified institutional embedding service:
    1. Online (Production & Dev): Google Gemini API (default gemini-embedding-001, 768 dimensions)
       with explicit output_dimensionality and finite vector validation.
    2. Strict Production Guard: If is_production is True, missing credentials or API failures
       raise EmbeddingConfigurationError or EmbeddingGenerationError immediately.
       Silent offline pseudo-vector fallback is strictly forbidden in production.
    3. Offline (Isolated Dev/Test only): Permitted ONLY when allow_offline is True
       and is_production is False.
    4. Full Provenance Metadata: Provides model, dimensions, provider, mode, status, and timestamp.
    """

    def __init__(
        self,
        api_key: Any = _SENTINEL,
        model_name: Optional[str] = None,
        dimensions: Optional[int] = None,
        allow_offline: Optional[bool] = None,
        is_production: Optional[bool] = None,
    ):
        if api_key is _SENTINEL:
            self._api_key = (
                getattr(settings, "GEMINI_API_KEY", None)
                or os.getenv("GEMINI_API_KEY", "")
                or os.getenv("GOOGLE_API_KEY", "")
            )
        else:
            self._api_key = api_key or ""

        if self._api_key:
            self._api_key = self._api_key.strip()

        self.model_name = (
            model_name
            or getattr(settings, "GEMINI_EMBEDDING_MODEL", None)
            or os.getenv("GEMINI_EMBEDDING_MODEL", "")
            or DEFAULT_EMBEDDING_MODEL
        ).strip()

        self.dimensions = int(
            dimensions
            or getattr(settings, "GEMINI_EMBEDDING_DIMENSIONS", None)
            or DEFAULT_EMBEDDING_DIMENSIONS
        )

        # Production determination
        if is_production is not None:
            self.is_production = is_production
        else:
            self.is_production = bool(getattr(settings, "is_production", False))

        # Offline permission: STRICTLY forbidden in production
        if self.is_production:
            self.allow_offline = False
        else:
            if allow_offline is not None:
                self.allow_offline = allow_offline
            else:
                self.allow_offline = bool(getattr(settings, "ALLOW_OFFLINE_EMBEDDINGS", False))

        self._client = None

    @staticmethod
    def classify_api_error(exc: Exception) -> EmbeddingError:
        """
        Classifies external or internal API errors into explicit domain exceptions:
        - 404 / NOT_FOUND / model not found -> EmbeddingModelNotFoundError (Permanent)
        - "not supported for embedcontent" -> EmbeddingUnsupportedOperationError (Permanent)
        - 401 / 403 / unauthenticated / invalid api key -> EmbeddingAuthenticationError (Permanent)
        - 429 / rate limit / resource exhausted -> EmbeddingTransientError (Transient)
        - Others -> EmbeddingGenerationError
        """
        err_str = str(exc).lower()
        if "404" in err_str or "not_found" in err_str or "not found" in err_str:
            return EmbeddingModelNotFoundError(f"Gemini API embedding generation failed: Configured model not found (404 NOT_FOUND): {exc}")
        if "not supported for embedcontent" in err_str or "unsupported for embedcontent" in err_str:
            return EmbeddingUnsupportedOperationError(f"Gemini API embedding generation failed: Model unsupported for embedContent: {exc}")
        if any(w in err_str for w in ["401", "403", "unauthenticated", "permission_denied", "invalid_api_key", "api_key_invalid"]):
            return EmbeddingAuthenticationError(f"Gemini API embedding generation failed: Authentication failed: {exc}")
        if any(w in err_str for w in ["429", "rate limit", "resource_exhausted", "too many requests"]):
            return EmbeddingTransientError(f"Gemini API embedding generation failed: {exc}")
        return EmbeddingGenerationError(f"Gemini API embedding generation failed: {exc}")

    def validate_provider(self, check_live: bool = False) -> Dict[str, Any]:
        """
        Validates provider configuration, credentials, model compatibility,
        and output dimensionality without leaking sensitive keys.
        """
        has_key = bool(self._api_key)
        mode = "online" if has_key else ("offline" if self.allow_offline else "unconfigured")

        supported_gemini_models = {
            "gemini-embedding-001",
            "gemini-embedding-2",
            "gemini-embedding-2-preview",
        }
        retired_models = {
            "text-embedding-004",
            "embedding-001",
        }

        is_known_retired = self.model_name in retired_models
        is_known_supported = self.model_name in supported_gemini_models or not has_key

        health_status = "HEALTHY"
        issues: List[str] = []

        if is_known_retired:
            health_status = "MISCONFIGURED"
            issues.append(f"Model '{self.model_name}' has been retired by Google. Use 'gemini-embedding-001'.")

        if not has_key and self.is_production:
            health_status = "MISCONFIGURED"
            issues.append("Missing GEMINI_API_KEY in production.")
        elif not has_key and not self.allow_offline:
            health_status = "MISCONFIGURED"
            issues.append("Missing GEMINI_API_KEY and offline embeddings disallowed.")

        if self.dimensions != 768:
            issues.append(f"Configured output dimensionality is {self.dimensions} (expected 768).")

        live_result = None
        if check_live and has_key and not is_known_retired:
            try:
                client = self._get_client()
                if client:
                    client.models.embed_content(
                        model=self.model_name,
                        contents="health_probe",
                    )
                    live_result = "SUCCESS"
            except Exception as exc:
                live_result = f"FAILED: {exc}"
                health_status = "UNHEALTHY"
                issues.append(f"Live connectivity test failed: {exc}")

        return {
            "status": health_status,
            "provider": "google_genai" if has_key else "deterministic_offline",
            "mode": mode,
            "model": self.model_name,
            "dimensions": self.dimensions,
            "has_credentials": has_key,
            "is_known_supported": is_known_supported and not is_known_retired,
            "is_known_retired": is_known_retired,
            "live_test": live_result,
            "issues": issues,
        }

    def _get_client(self):
        """
        Retrieves or initializes the Google GenAI client.
        In production or strict mode, fails fast if API key is missing.
        """
        if not self._api_key:
            if self.is_production or not self.allow_offline:
                raise EmbeddingConfigurationError(
                    "GEMINI_API_KEY is required for embedding generation in production or strict mode."
                )
            return None

        if self._client is None:
            try:
                from google import genai
                self._client = genai.Client(api_key=self._api_key)
            except Exception as e:
                logger.warning("Failed to initialize Google GenAI Client: %s", e)
                if self.is_production or not self.allow_offline:
                    raise EmbeddingConfigurationError(
                        f"Failed to initialize Google GenAI Client with configured credentials: {e}"
                    ) from e
                self._client = None

        return self._client

    def _generate_offline_embedding(self, text: str) -> List[float]:
        """
        Deterministic, offline normalized vector generator (exact self.dimensions length).
        Uses word hashing and character n-grams with L2 normalization.
        Guarantees deterministic, reproducible, non-zero vectors for offline dev/test only.
        """
        dim = self.dimensions
        vector = np.zeros(dim, dtype=np.float64)
        words = text.lower().split()

        for w in words:
            h = abs(hash(w)) % dim
            vector[h] += 1.0

        cleaned = "".join(c for c in text.lower() if c.isalnum() or c.isspace())
        for i in range(len(cleaned) - 2):
            trigram = cleaned[i : i + 3]
            h = abs(hash(trigram)) % dim
            vector[h] += 0.5

        if np.all(vector == 0):
            for i, c in enumerate(text):
                h = (ord(c) * 31 + i) % dim
                vector[h] += 1.0

        return validate_and_normalize_vector(
            vector,
            expected_dim=dim,
            label="Offline deterministic embedding",
        )

    def embed_text_with_provenance(self, text: str) -> Tuple[List[float], Dict[str, Any]]:
        """
        Embed a single text string and return both the L2-normalized vector
        and its full provenance metadata dictionary.
        """
        if not text or not text.strip():
            raise EmbeddingValidationError("Cannot generate embedding for empty or whitespace-only text.")

        cleaned = text.strip()
        client = self._get_client()

        if client:
            t0 = time.time()
            try:
                from google.genai import types
                config = types.EmbedContentConfig(output_dimensionality=self.dimensions)

                def _call_embed():
                    return client.models.embed_content(
                        model=self.model_name,
                        contents=cleaned,
                        config=config,
                    )

                res = execute_with_resilience(
                    _call_embed,
                    operation_name=f"Gemini EmbedContent ({self.model_name})",
                    max_retries=3,
                    base_delay=0.5,
                    max_delay=5.0,
                    timeout_seconds=15.0,
                )

                vals = (
                    res.embedding.values
                    if hasattr(res, "embedding") and res.embedding is not None
                    else res.embeddings[0].values
                )
                norm_vec = validate_and_normalize_vector(
                    vals,
                    expected_dim=self.dimensions,
                    label="Online Gemini embedding",
                )
                provenance = {
                    "embedding_model": self.model_name,
                    "embedding_dimensions": self.dimensions,
                    "embedding_provider": "google_genai",
                    "embedding_mode": "online",
                    "embedding_status": "indexed",
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                }
                latency_ms = round((time.time() - t0) * 1000, 2)
                assistant_observability.record_embedding(latency_ms, success=True)
                return norm_vec, provenance
            except EmbeddingValidationError:
                # Validation error on returned vector must NEVER be masked by offline fallback
                assistant_observability.record_embedding(round((time.time() - t0) * 1000, 2), success=False)
                raise
            except Exception as e:
                assistant_observability.record_embedding(round((time.time() - t0) * 1000, 2), success=False)
                classified_err = self.classify_api_error(e)
                logger.warning("Gemini online embedding API call failed (%s): %s", type(classified_err).__name__, e)
                # Permanent errors (such as 404 model not found) must NEVER be masked by offline fallback
                if self.is_production or not self.allow_offline or isinstance(classified_err, EmbeddingPermanentError):
                    raise classified_err from e

        # Fallback to offline embedding only if explicitly permitted in dev/test
        if not self.allow_offline:
            raise EmbeddingConfigurationError(
                "Offline embedding generation is not permitted. Configure GEMINI_API_KEY or allow_offline."
            )

        offline_vec = self._generate_offline_embedding(cleaned)
        provenance = {
            "embedding_model": self.model_name,
            "embedding_dimensions": self.dimensions,
            "embedding_provider": "deterministic_offline",
            "embedding_mode": "offline",
            "embedding_status": "indexed",
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
        return offline_vec, provenance

    def embed_text(self, text: str) -> List[float]:
        """
        Embed a single text string. Preserves existing signature and return type.
        """
        vec, _ = self.embed_text_with_provenance(text)
        return vec

    def embed_batch_with_provenance(
        self, texts: List[str], batch_size: int = 16
    ) -> Tuple[List[List[float]], Dict[str, Any]]:
        """
        Embed a list of text strings in batches and return the list of normalized vectors
        and common batch provenance metadata.
        """
        if not texts:
            empty_provenance = {
                "embedding_model": self.model_name,
                "embedding_dimensions": self.dimensions,
                "embedding_provider": "google_genai" if self._api_key else "deterministic_offline",
                "embedding_mode": "online" if self._api_key else "offline",
                "embedding_status": "indexed",
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
            return [], empty_provenance

        results: List[List[float]] = []
        batch_provenance: Optional[Dict[str, Any]] = None

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            for item in batch:
                vec, prov = self.embed_text_with_provenance(item)
                results.append(vec)
                if batch_provenance is None:
                    batch_provenance = prov

        return results, batch_provenance or {}

    def embed_batch(self, texts: List[str], batch_size: int = 16) -> List[List[float]]:
        """
        Embed a list of text strings with batching. Preserves existing signature and return type.
        """
        vectors, _ = self.embed_batch_with_provenance(texts, batch_size=batch_size)
        return vectors


# Singleton instance
embedding_service = EmbeddingService()
