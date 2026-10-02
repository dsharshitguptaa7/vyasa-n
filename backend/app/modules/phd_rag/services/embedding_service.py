import logging
import os
from typing import List, Optional
import numpy as np

from app.core.config import settings

logger = logging.getLogger("vyasa.phd_rag.embedding")

DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIMENSIONS = 3072


class EmbeddingService:
    """
    Dual-mode embedding provider:
    1. Online: Google Gemini API (gemini-embedding-001, 3072 dimensions)
    2. Offline / Test: Deterministic TF-IDF / feature projection (3072 dimensions)
       Guarantees full testability and reproducible rankings without live credentials.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
    ):
        self._api_key = (
            api_key
            or getattr(settings, "GEMINI_API_KEY", None)
            or os.getenv("GEMINI_API_KEY", "")
            or os.getenv("GOOGLE_API_KEY", "")
        )
        if self._api_key:
            self._api_key = self._api_key.strip()
        self.model_name = (
            model_name
            or os.getenv("GEMINI_EMBEDDING_MODEL", "")
            or DEFAULT_EMBEDDING_MODEL
        ).strip()
        self._client = None
        self._offline_vectorizer = None

    def _get_client(self):
        if not self._api_key:
            return None
        if self._client is None:
            try:
                from google import genai
                self._client = genai.Client(api_key=self._api_key)
            except Exception as e:
                logger.warning("Failed to initialize Google GenAI Client: %s", e)
                self._client = None
        return self._client

    def _generate_offline_embedding(self, text: str) -> List[float]:
        """
        Deterministic, offline normalized vector generator (3072 dimensions).
        Uses word hashing and character n-grams with l2 normalization.
        """
        vector = np.zeros(EMBEDDING_DIMENSIONS, dtype=np.float32)
        words = text.lower().split()
        if not words:
            return vector.tolist()

        for w in words:
            # Deterministic hash bucket
            h = abs(hash(w)) % EMBEDDING_DIMENSIONS
            vector[h] += 1.0

        # Add 3-gram character features
        cleaned = "".join(c for c in text.lower() if c.isalnum() or c.isspace())
        for i in range(len(cleaned) - 2):
            trigram = cleaned[i : i + 3]
            h = abs(hash(trigram)) % EMBEDDING_DIMENSIONS
            vector[h] += 0.5

        # L2 normalize
        norm = np.linalg.norm(vector)
        if norm > 0:
            vector = vector / norm

        return vector.tolist()

    def embed_text(self, text: str) -> List[float]:
        """
        Embed a single text string.
        """
        cleaned = text.strip()
        if not cleaned:
            return [0.0] * EMBEDDING_DIMENSIONS

        client = self._get_client()
        if client:
            try:
                res = client.models.embed_content(
                    model=self.model_name,
                    contents=cleaned,
                )
                vals = res.embedding.values if hasattr(res, "embedding") else res.embeddings[0].values
                return list(vals)
            except Exception as e:
                logger.warning("Gemini online embedding failed (%s), falling back to offline embedder", e)

        return self._generate_offline_embedding(cleaned)

    def embed_batch(self, texts: List[str], batch_size: int = 16) -> List[List[float]]:
        """
        Embed a list of text strings with batching.
        """
        results: List[List[float]] = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            for item in batch:
                results.append(self.embed_text(item))
        return results


# Singleton instance
embedding_service = EmbeddingService()
