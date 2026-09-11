"""
Phase 06: Embedding Generation Pipeline Stage
Encodes standardized engineering representations into 384-dimensional embeddings.
Persists embedding metadata for semantic search and audit traceability.
"""

import hashlib
import json
import logging
from pathlib import Path
from typing import Dict, Any, Tuple
import numpy as np
import pandas as pd

from server.services.embedding_service import embedding_service

logger = logging.getLogger(__name__)

STANDARDIZED_CSV = Path("data/processed/standardized_materials.csv")
METADATA_JSON = Path("data/processed/embeddings_metadata.json")


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


async def run_embedding(config: dict = None) -> Tuple[np.ndarray, dict]:
    """
    Run embedding generation phase on standardized materials dataset.
    Returns:
        (embeddings_array, metadata_dict)
    """
    config = config or {}
    csv_path = Path(config.get("standardized_csv", str(STANDARDIZED_CSV)))

    if not csv_path.exists():
        raise FileNotFoundError(f"Standardized materials CSV not found: {csv_path}")

    input_hash = _sha256(csv_path)
    df = pd.read_csv(csv_path, dtype=str)
    total_rows = len(df)

    logger.info(f"Generating embeddings for {total_rows} standardized records...")

    # Build engineering text representation for every record (zero metadata leakage)
    texts = [embedding_service.build_engineering_text(row.to_dict()) for _, row in df.iterrows()]

    # Generate embeddings
    embeddings = embedding_service.encode_texts(texts)

    # Persist metadata
    meta = embedding_service.save_metadata(
        input_sha256=input_hash,
        record_count=total_rows,
        output_path=Path(config.get("metadata_path", str(METADATA_JSON))),
    )

    logger.info(f"Embeddings generated: shape {embeddings.shape}, method: {meta['embedding_method']}")
    return embeddings, meta
