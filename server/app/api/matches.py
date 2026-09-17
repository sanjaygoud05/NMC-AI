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
async def get_matching_report(dataset_id: Optional[str] = None):
    """
    Get Phase 5 matching KPI summary, reduction ratio, and candidate distribution.
    Scoped by dataset_id (BASELINE, UPLOAD-..., or ALL).
    """
    effective_id = (dataset_id or "NONE").strip().upper()
    if effective_id in ["", "NONE"]:
        return {
            "phase": "Phase 07: Candidate Generation & Matching",
            "dataset_id": "NONE",
            "has_dataset": False,
            "data_available": False,
            "total_candidates": 0,
            "message": "No dataset selected",
        }

    from server.services.dataset_resolver import resolve_artifact_path

    if effective_id != "BASELINE":
        rpt_path = resolve_artifact_path("matching_report.json", dataset_id=effective_id)
        if rpt_path and rpt_path.exists():
            with open(rpt_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                data["has_dataset"] = True
                data["data_available"] = True
                return data
        return {
            "phase": "Phase 07: Candidate Generation & Matching (Runtime)",
            "dataset_id": effective_id,
            "has_dataset": True,
            "data_available": False,
            "dataset": {"input_rows": 0, "unique_material_codes": 0, "input_sha256": "", "output_sha256": ""},
            "performance": {},
            "message": "Matching report not yet available for this dataset",
        }

    if not REPORT_JSON.exists():
        await run_matching()

    if REPORT_JSON.exists():
        with open(REPORT_JSON, "r", encoding="utf-8") as f:
            data = json.load(f)
            data["has_dataset"] = True
            data["data_available"] = True
            return data

    raise HTTPException(status_code=404, detail="Matching report not found.")


def _get_std_map(effective_id: str) -> Dict[str, dict]:
    from server.services.dataset_resolver import load_dataset_dataframe
    std_df = load_dataset_dataframe("standardized_materials.csv", dataset_id=effective_id)
    if std_df.empty and effective_id == "BASELINE":
        std_path = Path("data/processed/standardized_materials.csv")
        if std_path.exists():
            std_df = pd.read_csv(std_path, dtype=str)
    if not std_df.empty and "Material_Code" in std_df.columns:
        return std_df.set_index("Material_Code").to_dict("index")
    return {}


def _format_material_title(raw_desc: Optional[str], canonical_key: Optional[str], code: str) -> str:
    if raw_desc and not pd.isna(raw_desc) and str(raw_desc).strip() and str(raw_desc).lower() != "nan":
        text = str(raw_desc).strip()
        # Clean title casing
        return " ".join(word.capitalize() if not word.isupper() or len(word) > 4 else word for word in text.split())
    if canonical_key and not pd.isna(canonical_key) and str(canonical_key).strip():
        parts = [p.strip() for p in str(canonical_key).split("|") if p.strip()]
        if len(parts) >= 2:
            return f"{parts[0].title()} {parts[1].title()}"
        return str(canonical_key).strip().title()
    return code


def _compute_status_tier(r: dict) -> str:
    conflict = str(r.get("engineering_conflict_class") or "")
    is_incompatible = str(r.get("engineering_incompatibility", "")).lower() in ["true", "1"]
    score = float(r.get("final_match_score") or 0)
    is_exact = str(r.get("canonical_key_exact", "")).lower() in ["true", "1"]

    if is_incompatible or conflict == "HARD_INCOMPATIBLE":
        return "Not match"
    if score >= 0.95 and is_exact:
        return "Exact"
    if score >= 0.85:
        return "Equivalent"
    if score >= 0.60:
        return "Review"
    return "Not match"


def _generate_clean_summary(r: dict, s_mat: dict, c_mat: dict) -> str:
    ev = r.get("evidence_summary")
    if ev and not pd.isna(ev) and str(ev).strip() and str(ev).lower() != "nan":
        return str(ev).strip()
    
    tier = _compute_status_tier(r)
    s_type = s_mat.get("Canonical_Material_Type") or s_mat.get("Material_Type")
    c_type = c_mat.get("Canonical_Material_Type") or c_mat.get("Material_Type")
    s_grade = s_mat.get("Canonical_Material_Grade") or s_mat.get("Material_Grade")
    c_grade = c_mat.get("Canonical_Material_Grade") or c_mat.get("Material_Grade")
    s_size = s_mat.get("Canonical_Size") or s_mat.get("Size")
    c_size = c_mat.get("Canonical_Size") or c_mat.get("Size")

    clauses = []
    if s_type and c_type and str(s_type).lower() == str(c_type).lower():
        clauses.append("Same type")
    if s_grade and c_grade and str(s_grade).lower() == str(c_grade).lower():
        clauses.append("same grade")
    if s_size and c_size and str(s_size).lower() == str(c_size).lower():
        clauses.append("same size")
    elif s_size and c_size and str(s_size).lower() != str(c_size).lower():
        clauses.append("different size — flagged for reviewer")

    if tier == "Exact":
        return "Same material · same grade · same specifications · verified identical"
    if tier == "Equivalent":
        return " · ".join(clauses) if clauses else "High similarity · standard and specification equivalent"
    if tier == "Review":
        return " · ".join(clauses) if clauses else "Potential engineering equivalence — requires manual verification"
    return "Different specifications or hard engineering incompatibility"


def _clean_attr_val(val: Any) -> str:
    if val is None or pd.isna(val) or str(val).strip().lower() in ["nan", "none", "-", ""]:
        return "-"
    text = str(val).replace("_", " ").strip()
    words = text.split()
    return " ".join(w.upper() if w.upper() in ["ASTM", "ASME", "ISO", "DIN", "ANSI", "API", "BS", "IS", "XLPE", "PVC", "SS", "CS", "MS", "GI", "CI", "WCB", "CF8M", "NBR", "PTFE", "EPDM", "FKM", "NOS", "MTR", "KG", "LTR", "SET", "BOX", "PKT", "PAIR", "IN", "MM", "CM", "M"] else w.lower() if w.lower() in ["in", "mm", "cm", "m"] else w.capitalize() for w in words)


@router.get("")
@router.get("/")
async def get_matches(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    dataset_id: Optional[str] = None,
    source_cpse: Optional[str] = None,
    candidate_cpse: Optional[str] = None,
    confidence_level: Optional[str] = None,
    category: Optional[str] = None,
    status_filter: Optional[str] = None,
    cross_cpse_only: bool = False,
    exact_key_only: bool = False,
    incompatible_only: bool = False,
    search: Optional[str] = None,
):
    """
    Query candidate match pairs with multi-attribute filtering, search, and pagination.
    """
    effective_id = (dataset_id or "NONE").strip().upper()
    if effective_id in ["", "NONE"]:
        return {
            "matches": [],
            "total": 0,
            "skip": skip,
            "limit": limit,
            "dataset_id": "NONE",
            "has_dataset": False,
            "data_available": False,
            "categories": [],
        }

    from server.services.dataset_resolver import load_dataset_dataframe

    df = load_dataset_dataframe("match_candidates.csv", dataset_id=effective_id)
    if df.empty and effective_id == "BASELINE":
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
            "dataset_id": effective_id,
            "has_dataset": True,
            "data_available": False,
            "categories": [],
        }

    std_map = _get_std_map(effective_id)

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

    # Pre-extract categories from standardized map
    all_categories = sorted(list(set(str(v.get("Material_Category", "")).strip() for v in std_map.values() if v.get("Material_Category") and str(v.get("Material_Category")).strip() != "nan")))

    def _enrich_single(r):
        clean_r = _clean_dict(r)
        s_code = clean_r.get("source_material_code", "")
        c_code = clean_r.get("candidate_material_code", "")
        s_mat = std_map.get(s_code, {})
        c_mat = std_map.get(c_code, {})

        cat = s_mat.get("Material_Category") or c_mat.get("Material_Category") or "General"
        tier = _compute_status_tier(clean_r)

        clean_r["category"] = cat
        clean_r["status_tier"] = tier
        clean_r["source_title"] = _format_material_title(s_mat.get("Material_Description") or s_mat.get("Standardized_Description"), clean_r.get("source_canonical_key"), s_code)
        clean_r["candidate_title"] = _format_material_title(c_mat.get("Material_Description") or c_mat.get("Standardized_Description"), clean_r.get("candidate_canonical_key"), c_code)
        
        score_val = float(clean_r.get("final_match_score") or 0)
        clean_r["score_percent"] = int(round(score_val * 100))
        clean_r["explainable_summary"] = _generate_clean_summary(clean_r, s_mat, c_mat)

        clean_r["attributes"] = {
            "Type": {
                "source": _clean_attr_val(s_mat.get("Canonical_Material_Type") or s_mat.get("Material_Type")),
                "candidate": _clean_attr_val(c_mat.get("Canonical_Material_Type") or c_mat.get("Material_Type")),
            },
            "Grade": {
                "source": _clean_attr_val(s_mat.get("Canonical_Material_Grade") or s_mat.get("Material_Grade")),
                "candidate": _clean_attr_val(c_mat.get("Canonical_Material_Grade") or c_mat.get("Material_Grade")),
            },
            "Size": {
                "source": _clean_attr_val(s_mat.get("Canonical_Size") or s_mat.get("Size")),
                "candidate": _clean_attr_val(c_mat.get("Canonical_Size") or c_mat.get("Size")),
            },
            "Coating": {
                "source": _clean_attr_val(s_mat.get("Canonical_Coating") or s_mat.get("Coating")),
                "candidate": _clean_attr_val(c_mat.get("Canonical_Coating") or c_mat.get("Coating")),
            },
            "Unit": {
                "source": _clean_attr_val(s_mat.get("Canonical_Unit") or s_mat.get("Unit")),
                "candidate": _clean_attr_val(c_mat.get("Canonical_Unit") or c_mat.get("Unit")),
            },
        }
        return clean_r

    has_cat_filter = bool(category and category.lower() != "all")
    has_status_filter = bool(status_filter and status_filter.lower() != "all")

    if not has_cat_filter and not has_status_filter:
        total = len(filtered)
        page_df = filtered.iloc[skip : skip + limit]
        page_records = [_enrich_single(r) for r in page_df.to_dict("records")]
        return {
            "matches": page_records,
            "total": total,
            "skip": skip,
            "limit": limit,
            "categories": all_categories,
        }

    # If category or status filter is active, filter candidates
    enriched_list = []
    for r in filtered.to_dict("records"):
        enriched = _enrich_single(r)
        if has_cat_filter and enriched["category"].lower() != category.lower():
            continue
        if has_status_filter and enriched["status_tier"].lower() != status_filter.lower():
            continue
        enriched_list.append(enriched)

    total = len(enriched_list)
    page_records = enriched_list[skip : skip + limit]

    return {
        "matches": page_records,
        "total": total,
        "skip": skip,
        "limit": limit,
        "categories": all_categories,
    }


@router.get("/{candidate_id}")
async def get_match_detail(candidate_id: str, dataset_id: Optional[str] = None):
    """
    Get detailed evidence breakdown for a single candidate match pair.
    """
    effective_id = (dataset_id or "NONE").strip().upper()
    from server.services.dataset_resolver import load_dataset_dataframe
    df = load_dataset_dataframe("match_candidates.csv", dataset_id=effective_id)
    if df.empty and effective_id == "BASELINE":
        df = _load_candidates_df()

    if df is None or df.empty:
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
