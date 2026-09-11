"""
Embedding Service for Phase 5: Semantic Matching
Generates 384-dimensional embeddings using sentence-transformers/all-MiniLM-L6-v2
Strictly encodes canonical engineering representations with zero metadata leakage.
"""

import json
import logging
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import numpy as np

logger = logging.getLogger(__name__)

# Constants
DEFAULT_MODEL_NAME = "all-MiniLM-L6-v2"
DEFAULT_DIMENSION = 384
METADATA_PATH = Path("data/processed/embeddings_metadata.json")


class EmbeddingService:
    def __init__(self, model_name: str = DEFAULT_MODEL_NAME, config: Optional[dict] = None):
        self.model_name = model_name
        self.dimension = DEFAULT_DIMENSION
        self.config = config or {}
        self.model = None
        self._model_initialized = False
        self.fallback_used = False
        self.embedding_method = f"sentence_transformer_{self.model_name.replace('/', '_')}"

    def _get_model(self):
        """Lazy-initialize sentence transformer model on demand to keep startup memory < 80MB."""
        if not self._model_initialized:
            try:
                from sentence_transformers import SentenceTransformer
                self.model = SentenceTransformer(self.model_name)
                self.embedding_method = f"sentence_transformer_{self.model_name.replace('/', '_')}"
                self.fallback_used = False
                logger.info(f"Loaded sentence transformer model: {self.model_name}")
            except Exception as e:
                logger.warning(f"Could not load sentence transformer model ({e}). Using deterministic TF-IDF fallback.")
                self.model = None
                self.fallback_used = True
                self.embedding_method = "deterministic_tfidf_fallback"
            self._model_initialized = True
        return self.model

    def build_engineering_text(self, row: Dict[str, Any]) -> str:
        """
        Build the canonical engineering text representation for embedding.
        Strictly excludes Material_Code, CPSE, Plant, Annual_Consumption, Last_Purchase_Date.
        """
        std_desc = row.get("Standardized_Description")
        if std_desc and str(std_desc).strip() and str(std_desc).lower() != "nan":
            return str(std_desc).strip()

        # Fallback to key canonical attributes if Standardized_Description is missing
        parts = []
        for attr in [
            "Canonical_Material_Family",
            "Canonical_Material_Type",
            "Canonical_Material_Subtype",
            "Canonical_Material",
            "Canonical_Material_Grade",
            "Canonical_Size",
            "Canonical_Length",
            "Canonical_Diameter",
            "Canonical_Pressure_Class",
            "Canonical_Standard",
            "Canonical_Coating",
            "Canonical_Connection_Type",
            "Canonical_Construction",
            "Canonical_Orientation",
        ]:
            val = row.get(attr)
            if val and str(val).strip() and str(val).lower() not in ["none", "nan", "null"]:
                parts.append(str(val).strip())
        return " | ".join(parts) if parts else "MATERIAL"

    def encode_texts(self, texts: List[str]) -> np.ndarray:
        """
        Encode list of texts into 2D numpy array of embeddings.
        Returns float32 normalized embeddings.
        """
        model = self._get_model()
        if not self.fallback_used and model is not None:
            embeddings = model.encode(
                texts,
                batch_size=self.config.get("batch_size", 64),
                show_progress_bar=False,
                normalize_embeddings=True,
            )
            return np.array(embeddings, dtype=np.float32)
        else:
            # Deterministic TF-IDF fallback with character n-grams
            from sklearn.feature_extraction.text import TfidfVectorizer
            vectorizer = TfidfVectorizer(ngram_range=(1, 3), max_features=DEFAULT_DIMENSION, sublinear_tf=True)
            tfidf_matrix = vectorizer.fit_transform(texts).toarray()
            # Pad or truncate to DEFAULT_DIMENSION if needed
            if tfidf_matrix.shape[1] < DEFAULT_DIMENSION:
                pad = np.zeros((tfidf_matrix.shape[0], DEFAULT_DIMENSION - tfidf_matrix.shape[1]), dtype=np.float32)
                tfidf_matrix = np.hstack([tfidf_matrix, pad])
            norms = np.linalg.norm(tfidf_matrix, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            return (tfidf_matrix / norms).astype(np.float32)

    def compute_similarity(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """Compute cosine similarity between two normalized vectors."""
        norm1 = np.linalg.norm(emb1)
        norm2 = np.linalg.norm(emb2)
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return float(np.dot(emb1, emb2) / (norm1 * norm2))

    def save_metadata(self, input_sha256: str, record_count: int, output_path: Path = METADATA_PATH) -> dict:
        """Persist embedding metadata to file."""
        metadata = {
            "embedding_method": self.embedding_method,
            "embedding_model": self.model_name,
            "embedding_dimension": self.dimension,
            "fallback_used": self.fallback_used,
            "input_sha256": input_sha256,
            "record_count": record_count,
            "generation_timestamp": datetime.now(timezone.utc).isoformat(),
            "normalization": "l2_unit_norm",
        }
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)
        return metadata


embedding_service = EmbeddingService()
