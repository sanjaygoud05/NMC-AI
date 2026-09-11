"""
Matches API endpoints for Phase 5: Candidate Exploration
Serves ranked cross-CPSE candidate pairs, composite scores, and explainable evidence.
Strictly respects Phase 6 boundaries: no match approval, merging, or common master creation.
"""

import json
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query
import pandas as pd

from server.pipeline.phase07_candidate_matching import run_matching

logger = logging.getLogger(__name__)
router = APIRouter()

CANDIDATES_CSV = Path("data/processed/match_candidates.csv")
REPORT_JSON = Path("data/processed/matching_report.json")


def _clean_dict(d: dict) -> dict:
    clean = {}
    for k, v in d.items():
        if pd.isna(v) or v is None or (isinstance(v, str) and v.lower() in ["nan", "none"]):
            clean[k] = None
        else:
            clean[k] = v
    return clean


def _load_candidates_df() -> Optional[pd.DataFrame]:
    if CANDIDATES_CSV.exists():
        df = pd.read_csv(CANDIDATES_CSV, dtype=str)
        return df
    return None


@router.get("/report")
async def get_matching_report():
    """
    Get Phase 5 matching KPI summary, reduction ratio, and candidate distribution.
    """
    if not REPORT_JSON.exists():
        await run_matching()

    if REPORT_JSON.exists():
        with open(REPORT_JSON, "r", encoding="utf-8") as f:
            return json.load(f)

    raise HTTPException(status_code=404, detail="Matching report not found.")


@router.get("/")
async def get_matches(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    dataset_id: Optional[str] = None,
    source_cpse: Optional[str] = None,
    candidate_cpse: Optional[str] = None,
    confidence_level: Optional[str] = None,
    cross_cpse_only: bool = False,
    exact_key_only: bool = False,
    incompatible_only: bool = False,
    search: Optional[str] = None,
):
    """
    Query candidate match pairs with multi-attribute filtering, search, and pagination.
    """
    from server.services.dataset_resolver import load_dataset_dataframe

    df = load_dataset_dataframe("match_candidates.csv", dataset_id=dataset_id)
    if df.empty and dataset_id in [None, "BASELINE"]:
        df = _load_candidates_df()
        if df is None:
            await run_matching()
            df = _load_candidates_df()

    if df is None or df.empty:
        return {
            "matches": [],
            "total": 0,
            "skip": skip,
            "limit": limit,
            "dataset_id": dataset_id or "BASELINE",
        }

    filtered = df

    if source_cpse and source_cpse != "all":
        filtered = filtered[filtered["source_cpse"].str.upper() == source_cpse.upper()]

    if candidate_cpse and candidate_cpse != "all":
        filtered = filtered[filtered["candidate_cpse"].str.upper() == candidate_cpse.upper()]

    if confidence_level and confidence_level != "all":
        filtered = filtered[filtered["confidence_level"].str.upper() == confidence_level.upper()]

    if cross_cpse_only:
        filtered = filtered[filtered["source_cpse"] != filtered["candidate_cpse"]]

    if exact_key_only:
        filtered = filtered[filtered["canonical_key_exact"].astype(str).str.lower().isin(["true", "1"])]

    if incompatible_only:
        filtered = filtered[filtered["engineering_incompatibility"].astype(str).str.lower().isin(["true", "1"])]

    if search:
        s = search.lower()
        cond = (
            filtered["source_material_code"].str.lower().str.contains(s, na=False)
            | filtered["candidate_material_code"].str.lower().str.contains(s, na=False)
            | filtered["source_canonical_key"].str.lower().str.contains(s, na=False)
            | filtered["candidate_canonical_key"].str.lower().str.contains(s, na=False)
            | filtered["evidence_summary"].str.lower().str.contains(s, na=False)
        )
        filtered = filtered[cond]

    total = len(filtered)
    page_df = filtered.iloc[skip : skip + limit]

    matches = [_clean_dict(r) for r in page_df.to_dict("records")]
    return {
        "matches": matches,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/{candidate_id}")
async def get_match_detail(candidate_id: str):
    """
    Get detailed evidence breakdown for a single candidate match pair.
    """
    df = _load_candidates_df()
    if df is None:
        raise HTTPException(status_code=404, detail="Match candidates dataset not found.")

    matched = df[df["candidate_id"] == candidate_id]
    if len(matched) == 0:
        raise HTTPException(status_code=404, detail=f"Candidate {candidate_id} not found.")

    rec = _clean_dict(matched.iloc[0].to_dict())

    # Organize attribute-level similarities into structured comparison
    attr_breakdown = {}
    from server.services.matching_service import ENGINEERING_ATTRS
    for attr in ENGINEERING_ATTRS:
        sim_col = f"{attr}_similarity"
        sim_val = rec.get(sim_col)
        attr_breakdown[attr] = {
            "similarity": float(sim_val) if sim_val is not None else None,
        }

    return {
        "candidate": rec,
        "attribute_breakdown": attr_breakdown,
    }


@router.post("/run")
async def trigger_matching_pipeline():
    """
    Execute Phase 5 Candidate Generation & Matching pipeline stage.
    """
    result = await run_matching()
    return result
