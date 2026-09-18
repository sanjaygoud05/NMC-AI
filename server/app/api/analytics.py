from typing import Optional, Dict, Tuple
from pathlib import Path
from fastapi import APIRouter, Query
from services.ingestion_service import ingestion_service
from services.profiling_service import profiling_service

router = APIRouter()

_PROFILE_CACHE: Dict[Tuple[str, float], dict] = {}


def _get_cached_profile(path: Path, df) -> dict:
    """Return cached profiling result if file mtime hasn't changed"""
    try:
        res_str = str(path.resolve())
        mtime = path.stat().st_mtime
    except Exception:
        res_str = str(path)
        mtime = 0.0

    key = (res_str, mtime)
    if key in _PROFILE_CACHE:
        return _PROFILE_CACHE[key]

    for k in list(_PROFILE_CACHE.keys()):
        if k[0] == res_str:
            del _PROFILE_CACHE[k]

    profile = profiling_service.profile_dataset(df)
    _PROFILE_CACHE[key] = profile
    return profile


@router.get("/dashboard")
async def get_dashboard_metrics(dataset_id: Optional[str] = Query(None)):
    """
    Get real dashboard metrics computed from active dataset scope (BASELINE, UPLOAD-..., or ALL)
    """
    effective_id = (dataset_id or "BASELINE").strip().upper()
    if effective_id == "NONE":
        return {
            "total_materials": 0,
            "total_cpse": 0,
            "standardized_materials": 0,
            "harmonized_groups": 0,
            "pending_reviews": 0,
            "high_confidence_matches": 0,
            "duplicate_candidates": 0,
            "data_quality_score": 0,
            "processing_progress": 0,
            "dataset_id": "NONE",
            "has_dataset": False,
            "data_available": False,
        }

    from services.dataset_resolver import load_dataset_dataframe

    df_std = load_dataset_dataframe("standardized_materials.csv", dataset_id=effective_id)
    if df_std.empty and effective_id != "BASELINE":
        from services.dataset_registry_service import dataset_registry_service
        meta = dataset_registry_service.get_dataset(effective_id)
        reg_progress = meta.get("progress", 0) if meta else 0
        return {
            "total_materials": 0,
            "total_cpse": 0,
            "standardized_materials": 0,
            "harmonized_groups": 0,
            "pending_reviews": 0,
            "high_confidence_matches": 0,
            "duplicate_candidates": 0,
            "data_quality_score": 0,
            "processing_progress": reg_progress,
            "dataset_id": effective_id,
            "has_dataset": True,
            "data_available": False,
        }

    total_mats = len(df_std) if not df_std.empty else 0
    cpses = set(df_std["CPSE"].dropna()) if not df_std.empty and "CPSE" in df_std.columns else set()
    unique_desc = len(set(df_std["Standardized_Description"].dropna())) if not df_std.empty and "Standardized_Description" in df_std.columns else 0

    # Load match candidates count
    df_cands = load_dataset_dataframe("match_candidates.csv", dataset_id=effective_id)
    cand_count = len(df_cands) if not df_cands.empty else 0
    high_conf = int(len(df_cands[df_cands["confidence_level"] == "HIGH"])) if not df_cands.empty and "confidence_level" in df_cands.columns else 0

    # Load review queue pending count
    df_reviews = load_dataset_dataframe("validated_candidates.csv", dataset_id=effective_id)
    from app.db.review_repository import review_repository
    decisions_map = review_repository.get_all_decisions()
    pending_cnt = 0
    if not df_reviews.empty and "candidate_id" in df_reviews.columns:
        active_ids = set(df_reviews[df_reviews["review_priority"].isin(["CRITICAL", "HIGH"])]["candidate_id"]) if "review_priority" in df_reviews.columns else set(df_reviews["candidate_id"])
        reviewed_ids = set(decisions_map.keys()).intersection(active_ids)
        pending_cnt = len(active_ids) - len(reviewed_ids)

    is_baseline = effective_id == "BASELINE"

    # Calculate actual data quality score from the dataset (cached by mtime)
    data_quality_score = 0
    if total_mats > 0:
        try:
            from services.dataset_resolver import resolve_artifact_path
            norm_path = resolve_artifact_path("normalized_materials.csv", dataset_id=effective_id)
            if norm_path and norm_path.exists():
                df_norm = load_dataset_dataframe("normalized_materials.csv", dataset_id=effective_id)
                if not df_norm.empty:
                    profile = _get_cached_profile(norm_path, df_norm)
                    data_quality_score = profile["quality_score"]["overall_score"]
            elif effective_id == "BASELINE":
                raw_path = Path("data/raw/data.csv")
                if not raw_path.exists():
                    raw_path = Path("data/raw/CPSE_Material_Master_cleaned.csv")
                if raw_path.exists():
                    df_raw = ingestion_service.load_raw_dataframe()
                    profile = _get_cached_profile(raw_path, df_raw)
                    data_quality_score = profile["quality_score"]["overall_score"]
        except Exception:
            data_quality_score = 0

    return {
        "total_materials": total_mats,
        "total_cpse": len(cpses),
        "standardized_materials": total_mats,
        "harmonized_groups": unique_desc,
        "pending_reviews": pending_cnt,
        "high_confidence_matches": high_conf,
        "duplicate_candidates": cand_count,
        "data_quality_score": data_quality_score,
        "processing_progress": 100 if total_mats > 0 else 0,
        "dataset_id": effective_id,
        "has_dataset": True,
        "data_available": total_mats > 0,
    }


@router.get("/cpse")
async def get_cpse_analytics(dataset_id: Optional[str] = Query(None)):
    """
    Get CPSE analytics computed from active dataset scope distribution
    """
    effective_id = (dataset_id or "BASELINE").strip().upper()
    if effective_id == "NONE":
        return {
            "cpse_data": {},
            "dataset_id": "NONE",
            "has_dataset": False,
            "data_available": False,
        }

    from services.dataset_resolver import load_dataset_dataframe

    df = load_dataset_dataframe("standardized_materials.csv", dataset_id=effective_id)
    if df.empty:
        return {
            "cpse_data": {},
            "dataset_id": effective_id,
            "has_dataset": True,
            "data_available": False,
        }

    counts = df["CPSE"].value_counts().to_dict() if "CPSE" in df.columns else {}
    cpse_data = {}
    for cpse, cnt in counts.items():
        cpse_data[cpse] = {
            "record_count": cnt,
            "percentage": round((cnt / len(df)) * 100, 1) if len(df) > 0 else 0,
        }

    return {
        "cpse_data": cpse_data,
        "dataset_id": effective_id,
        "has_dataset": True,
        "data_available": len(df) > 0,
        "message": f"CPSE distribution generated for dataset scope: {effective_id}",
    }


@router.get("/data-quality")
async def get_data_quality_metrics(dataset_id: Optional[str] = Query(None)):
    """
    Get data quality metrics scoped by dataset_id.
    For BASELINE (default): runs Phase 1 profiling on frozen raw dataset.
    For UPLOAD datasets: profiles the uploaded source CSV.
    """
    effective_id = (dataset_id or "BASELINE").strip().upper()
    if effective_id == "NONE":
        return {
            "data_quality_score": 0,
            "dataset_id": "NONE",
            "has_dataset": False,
            "data_available": False,
            "quality_scoring": {},
            "column_profiles": {},
            "missingness": {},
            "quality_flags": [],
        }

    from services.dataset_resolver import resolve_artifact_path
    import pandas as _pd

    try:
        if effective_id != "BASELINE":
            norm_path = resolve_artifact_path("normalized_materials.csv", dataset_id=effective_id)
            if norm_path and norm_path.exists():
                df = _pd.read_csv(norm_path, dtype=str)
                profile = _get_cached_profile(norm_path, df)
                return {
                    "data_quality_score": profile["quality_score"]["overall_score"],
                    "quality_scoring": profile["quality_score"],
                    "column_profiles": profile["column_profiles"],
                    "missingness": profile["missingness_analysis"],
                    "quality_flags": profile["quality_flags"],
                    "dataset_id": effective_id,
                    "has_dataset": True,
                    "data_available": True,
                }
            else:
                return {
                    "data_quality_score": 0,
                    "quality_scoring": {},
                    "column_profiles": {},
                    "missingness": {},
                    "quality_flags": [],
                    "dataset_id": effective_id,
                    "has_dataset": True,
                    "data_available": False,
                    "message": "Processing not yet complete for this dataset",
                }
        # Baseline: profile raw frozen CSV (cached)
        raw_path = Path("data/raw/data.csv")
        if not raw_path.exists():
            raw_path = Path("data/raw/CPSE_Material_Master_cleaned.csv")
        df = ingestion_service.load_raw_dataframe()
        profile = _get_cached_profile(raw_path, df) if raw_path.exists() else profiling_service.profile_dataset(df)
        return {
            "data_quality_score": profile["quality_score"]["overall_score"],
            "quality_scoring": profile["quality_score"],
            "column_profiles": profile["column_profiles"],
            "missingness": profile["missingness_analysis"],
            "quality_flags": profile["quality_flags"],
            "dataset_id": "BASELINE",
            "has_dataset": True,
            "data_available": True,
        }
    except Exception as e:
        return {
            "error": str(e),
            "data_quality_score": 0,
            "dataset_id": effective_id,
            "has_dataset": True,
            "data_available": False,
        }


@router.get("/procurement")
async def get_procurement_insights():
    """
    Get procurement insights
    """
    return {
        "insights": [],
        "message": "Procurement insights coming in Phase 13",
    }


@router.get("/evaluation")
async def get_evaluation_metrics():
    """
    Get evaluation metrics
    """
    return {
        "evaluation_metrics": {},
        "message": "Evaluation metrics coming in Phase 15",
    }
