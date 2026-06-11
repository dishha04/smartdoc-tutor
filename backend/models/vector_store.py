"""
FAISS-based vector store for RAG retrieval.
Stores per-document FAISS indexes and chunk text mappings.
Supports in-memory and on-disk persistence.
"""

import os
import json
import logging
import numpy as np
import faiss
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

# Directory for persisting FAISS indexes
VECTOR_STORE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "vector_stores")


class VectorStore:
    """Manages FAISS indexes for all documents."""

    def __init__(self, persist_dir: str | None = None):
        self.persist_dir = persist_dir or VECTOR_STORE_DIR
        os.makedirs(self.persist_dir, exist_ok=True)

        # In-memory cache: doc_id -> { "index": faiss.Index, "chunks": [...] }
        self._cache: Dict[str, dict] = {}

    def create_index(
        self,
        doc_id: str,
        chunks: List[str],
        embeddings: np.ndarray,
    ) -> None:
        """
        Create a FAISS index for a document and persist to disk.
        """
        if len(chunks) != embeddings.shape[0]:
            raise ValueError(
                f"Mismatch: {len(chunks)} chunks vs {embeddings.shape[0]} embeddings"
            )

        dimension = embeddings.shape[1]

        # Create FAISS index (L2 distance on normalized vectors = cosine similarity)
        index = faiss.IndexFlatIP(dimension)  # Inner product for cosine sim
        index.add(embeddings.astype(np.float32))

        # Cache in memory
        self._cache[doc_id] = {
            "index": index,
            "chunks": chunks,
        }

        # Persist to disk
        doc_dir = os.path.join(self.persist_dir, doc_id)
        os.makedirs(doc_dir, exist_ok=True)

        faiss.write_index(index, os.path.join(doc_dir, "index.faiss"))
        with open(os.path.join(doc_dir, "chunks.json"), "w", encoding="utf-8") as f:
            json.dump(chunks, f, ensure_ascii=False)

        logger.info(f"Created FAISS index for doc_id={doc_id}: {len(chunks)} chunks, dim={dimension}")

    def search(
        self,
        doc_id: str,
        query_embedding: np.ndarray,
        top_k: int = 5,
    ) -> List[str]:
        """
        Search for the most relevant chunks for a query.
        Returns list of chunk texts ranked by relevance.
        """
        entry = self._load(doc_id)
        if entry is None:
            logger.warning(f"No vector index found for doc_id={doc_id}")
            return []

        index = entry["index"]
        chunks = entry["chunks"]

        # Ensure correct shape
        query = query_embedding.reshape(1, -1).astype(np.float32)

        # Search
        k = min(top_k, index.ntotal)
        scores, indices = index.search(query, k)

        results = []
        for i, idx in enumerate(indices[0]):
            if idx < len(chunks) and idx >= 0:
                results.append(chunks[idx])
                logger.debug(f"  Match {i+1}: score={scores[0][i]:.4f}, chunk_idx={idx}")

        logger.info(f"RAG search for doc_id={doc_id}: found {len(results)} relevant chunks")
        return results

    def has_index(self, doc_id: str) -> bool:
        """Check if a document has a FAISS index."""
        if doc_id in self._cache:
            return True
        doc_dir = os.path.join(self.persist_dir, doc_id)
        return os.path.exists(os.path.join(doc_dir, "index.faiss"))

    def delete_index(self, doc_id: str) -> None:
        """Delete a document's FAISS index from cache and disk."""
        self._cache.pop(doc_id, None)
        doc_dir = os.path.join(self.persist_dir, doc_id)
        if os.path.exists(doc_dir):
            import shutil
            shutil.rmtree(doc_dir)
            logger.info(f"Deleted vector index for doc_id={doc_id}")

    def _load(self, doc_id: str) -> Optional[dict]:
        """Load index from cache or disk."""
        if doc_id in self._cache:
            return self._cache[doc_id]

        doc_dir = os.path.join(self.persist_dir, doc_id)
        index_path = os.path.join(doc_dir, "index.faiss")
        chunks_path = os.path.join(doc_dir, "chunks.json")

        if not os.path.exists(index_path) or not os.path.exists(chunks_path):
            return None

        try:
            index = faiss.read_index(index_path)
            with open(chunks_path, "r", encoding="utf-8") as f:
                chunks = json.load(f)

            self._cache[doc_id] = {"index": index, "chunks": chunks}
            logger.info(f"Loaded FAISS index from disk for doc_id={doc_id}")
            return self._cache[doc_id]
        except Exception as e:
            logger.error(f"Failed to load index for doc_id={doc_id}: {e}")
            return None


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

_store: VectorStore | None = None


def get_vector_store() -> VectorStore:
    global _store
    if _store is None:
        _store = VectorStore()
    return _store
