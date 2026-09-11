"""
Dataset Resolution Utility
Provides uniform path resolution and provenance for queries across:
- NONE
- BASELINE (default)
- UPLOAD-YYYYMMDD-XXX (individual upload)
- ALL (aggregated view across all completed datasets)
"""

import os
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd

from server.services.dataset_registry_service import dataset_registry_service

PROCESSED_BASE = Path("data/processed")
UPLOADS_BASE = Path("data/uploads")


def resolve_dataset_files(
    filename: str,
    dataset_id: Optional[str] = None,
) -> Tuple[List[Path], str]:
    """
    Resolves artifact path(s) for a given filename based on dataset_id.
    Returns (list_of_paths, effective_scope).
    """
    scope = (dataset_id or "BASELINE").strip().upper()

    if scope in ["", "BASELINE", "DEFAULT"]:
        base_path = PROCESSED_BASE / filename
        return ([base_path] if base_path.exists() else [], "BASELINE")

    if scope == "NONE":
        return ([], "NONE")

    if scope == "ALL":
        # Combine baseline + all completed upload datasets
        paths = []
        base_path = PROCESSED_BASE / filename
        if base_path.exists():
            paths.append(base_path)

        for ds in dataset_registry_service.list_datasets():
            if ds.get("dataset_id") != "BASELINE" and ds.get("status") == "COMPLETED":
                p = Path(ds["data_dir"]) / filename
                if p.exists():
                    paths.append(p)
        return (paths, "ALL")

    # Specific dataset ID: UPLOAD-YYYYMMDD-XXX
    ds = dataset_registry_service.get_dataset(dataset_id)
    if not ds:
        # Fallback check directly in uploads folder
        custom_dir = UPLOADS_BASE / dataset_id / "processed"
        target = custom_dir / filename
        return ([target] if target.exists() else [], dataset_id)

    target = Path(ds["data_dir"]) / filename
    return ([target] if target.exists() else [], dataset_id)


def resolve_artifact_path(filename: str, dataset_id: Optional[str] = None) -> Optional[Path]:
    """Resolves single artifact Path for a given filename and dataset_id."""
    paths, _ = resolve_dataset_files(filename, dataset_id)
    return paths[0] if paths else None


def load_dataset_dataframe(
    filename: str,
    dataset_id: Optional[str] = None,
) -> pd.DataFrame:
    """
    Loads DataFrame from resolved dataset files, attaching dataset_id provenance.
    If scope is ALL, concatenates all matching datasets preserving provenance.
    """
    paths, scope = resolve_dataset_files(filename, dataset_id)
    if not paths:
        return pd.DataFrame()

    dfs = []
    for p in paths:
        try:
            df = pd.read_csv(p, dtype=str)
            # Infer or ensure dataset_id column
            if "dataset_id" not in df.columns:
                if "uploads" in str(p):
                    # extract UPLOAD-... from path
                    parts = p.parts
                    for part in parts:
                        if part.startswith("UPLOAD-"):
                            df["dataset_id"] = part
                            break
                    else:
                        df["dataset_id"] = scope
                else:
                    df["dataset_id"] = "BASELINE"
            dfs.append(df)
        except Exception:
            continue

    if not dfs:
        return pd.DataFrame()

    if len(dfs) == 1:
        return dfs[0]

    combined = pd.concat(dfs, ignore_index=True)
    return combined
