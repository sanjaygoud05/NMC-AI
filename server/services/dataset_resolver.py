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

from services.dataset_registry_service import dataset_registry_service

_WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
PROCESSED_BASE = _WORKSPACE_ROOT / "data" / "processed"
if not PROCESSED_BASE.exists():
    PROCESSED_BASE = Path("data/processed")

UPLOADS_BASE = _WORKSPACE_ROOT / "data" / "uploads"
if not UPLOADS_BASE.exists():
    UPLOADS_BASE = Path("data/uploads")


def resolve_dataset_files(
    filename: str,
    dataset_id: Optional[str] = None,
) -> Tuple[List[Path], str]:
    """
    Resolves artifact path(s) for a given filename based on dataset_id.
    Returns (list_of_paths, effective_scope).
    - If dataset_id is None, empty, or 'NONE': returns ([], 'NONE')
    - If dataset_id is 'BASELINE': returns ([data/processed/filename], 'BASELINE')
    - If dataset_id is 'ALL': returns baseline + all completed upload datasets
    - If dataset_id is 'UPLOAD-...': returns upload directory file
    """
    # Explicit unselected state
    if dataset_id and dataset_id.strip().upper() == "NONE":
        return ([], "NONE")

    scope = dataset_id.strip().upper() if (dataset_id and dataset_id.strip()) else "BASELINE"

    if scope == "BASELINE":
        base_path = PROCESSED_BASE / filename
        return ([base_path] if base_path.exists() else [], "BASELINE")

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


_DF_CACHE: Dict[Tuple[str, float], pd.DataFrame] = {}


def clear_dataframe_cache(dataset_id: Optional[str] = None):
    """Clear in-memory DataFrame cache, optionally filtered by dataset_id"""
    global _DF_CACHE
    if not dataset_id:
        _DF_CACHE.clear()
        return
    keys_to_del = [k for k in _DF_CACHE.keys() if dataset_id in k[0]]
    for k in keys_to_del:
        _DF_CACHE.pop(k, None)


def _read_cached_csv(p: Path, scope: str) -> Optional[pd.DataFrame]:
    """Read CSV with memory caching keyed by resolved path and file modification time (st_mtime)"""
    try:
        resolved_str = str(p.resolve())
        mtime = p.stat().st_mtime
    except Exception:
        resolved_str = str(p)
        mtime = 0.0

    cache_key = (resolved_str, mtime)
    if cache_key in _DF_CACHE:
        # Return a copy to avoid in-place mutation issues across requests
        return _DF_CACHE[cache_key].copy(deep=False)

    # Clean out any older versions of this file from cache
    for k in list(_DF_CACHE.keys()):
        if k[0] == resolved_str:
            del _DF_CACHE[k]

    try:
        df = pd.read_csv(p, dtype=str)
        if "dataset_id" not in df.columns:
            if "uploads" in str(p):
                parts = p.parts
                for part in parts:
                    if part.startswith("UPLOAD-"):
                        df["dataset_id"] = part
                        break
                else:
                    df["dataset_id"] = scope
            else:
                df["dataset_id"] = "BASELINE"

        _DF_CACHE[cache_key] = df
        return df.copy(deep=False)
    except Exception:
        return None


def load_dataset_dataframe(
    filename: str,
    dataset_id: Optional[str] = None,
) -> pd.DataFrame:
    """
    Loads DataFrame from resolved dataset files, attaching dataset_id provenance.
    If scope is ALL, concatenates all matching datasets preserving provenance.
    Uses in-memory cache with automatic mtime invalidation for near-instant responses.
    """
    paths, scope = resolve_dataset_files(filename, dataset_id)
    if not paths:
        return pd.DataFrame()

    dfs = []
    for p in paths:
        cached_df = _read_cached_csv(p, scope)
        if cached_df is not None and not cached_df.empty:
            dfs.append(cached_df)

    if not dfs:
        return pd.DataFrame()

    if len(dfs) == 1:
        return dfs[0]

    combined = pd.concat(dfs, ignore_index=True)
    return combined

