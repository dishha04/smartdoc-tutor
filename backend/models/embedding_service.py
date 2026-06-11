"""
Embedding service using sentence-transformers.
Generates vector embeddings for text chunks and queries.
Uses MiniLM-L6-v2 (~80MB, fast, good quality).
"""

import logging
import numpy as np
from sentence_transformers import SentenceTransformer
from typing import List

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


class EmbeddingService:
    def __init__(self, model_name: str | None = None):
        self.model_name = model_name or DEFAULT_MODEL
        logger.info(f"Loading embedding model: {self.model_name}")
        self.model = SentenceTransformer(self.model_name)
        self.dimension = self.model.get_sentence_embedding_dimension()
        logger.info(f"Embedding model loaded (dim={self.dimension})")

    def embed_text(self, text: str) -> np.ndarray:
        """Embed a single text string into a vector."""
        return self.model.encode(text, normalize_embeddings=True)

    def embed_chunks(self, chunks: List[str]) -> np.ndarray:
        """
        Embed multiple text chunks into a matrix.
        Returns shape (n_chunks, dimension).
        """
        if not chunks:
            return np.array([])

        embeddings = self.model.encode(
            chunks,
            normalize_embeddings=True,
            show_progress_bar=False,
            batch_size=32,
        )
        logger.info(f"Embedded {len(chunks)} chunks → shape {embeddings.shape}")
        return embeddings


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

_service: EmbeddingService | None = None


def get_embedding_service() -> EmbeddingService:
    global _service
    if _service is None:
        _service = EmbeddingService()
    return _service
