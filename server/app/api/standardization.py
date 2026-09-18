"""
Standardization & Attribute Extraction API endpoints (Phase 3)
SIH26099 Material Harmonization Platform

Endpoints:
  GET  /api/standardization/attributes          - Attribute extraction summary
  GET  /api/standardization/attributes/report   - Full extraction report JSON
  GET  /api/standardization/attributes/{code}   - Single material extracted attributes
  POST /api/standardization/extract-attributes  - Run Phase 3 extraction pipeline
"""

import json
import math
from pathlib import Path
from typing import Optional

import pandas as pd
from fastapi import APIRouter, HTTPException

from pipeline.pipeline_runner import pipeline_runner

router = APIRouter()

EXTRACTION_REPORT_PATH = Path("data/processed/attribute_extraction_report.json")
EXTRACTED_CSV_PATH = Path("data/processed/extracted_attributes.csv")

# Lazy-load extracted dataframe (cache in module scope)
_extracted_df: Optional[pd.DataFrame] = None


def _load_extracted_df() -> Optional[pd.DataFrame]:
    global _extracted_df
    if _extracted_df is None and EXTRACTED_CSV_PATH.exists():
        _extracted_df = pd.read_csv(EXTRACTED_CSV_PATH, dtype=str)
        # Replace pandas NaN strings with None for clean JSON
        _extracted_df = _extracted_df.where(pd.notna(_extracted_df), None)
    return _extracted_df


def _clean_val(v):
    if v is None:
        return None
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    if pd.isna(v):
        return None
    s = str(v).strip()
    if s.lower() in ("nan", "none", "<na>"):
        return None
    return v


def _invalidate_cache():
    global _extracted_df
    _extracted_df = None


@router.get("/attributes")
async def get_attributes_summary(dataset_id: Optional[str] = None):
    """
    Get Phase 3 attribute extraction summary, scoped by dataset_id.
    Returns persisted extraction report if available.
    """
    effective_id = (dataset_id or "BASELINE").strip().upper()
    if effective_id in ["", "NONE"]:
        return {
            "status": "not_run",
            "message": "No dataset selected.",
            "extracted_file_exists": False,
            "dataset_id": "NONE",
            "has_dataset": False,
            "data_available": False,
        }

    from services.dataset_resolver import resolve_artifact_path
    import json as _json

    # Resolve extraction report for specific dataset
    if effective_id != "BASELINE":
        report_path = resolve_artifact_path("attribute_extraction_report.json", dataset_id=effective_id)
        if report_path and report_path.exists():
            with open(report_path, encoding="utf-8") as f:
                report = _json.load(f)
            extracted_path = resolve_artifact_path("extracted_attributes.csv", dataset_id=effective_id)
            return {
                "status": "completed",
                "extracted_file_exists": extracted_path is not None and extracted_path.exists(),
                "report": report,
                "dataset_id": effective_id,
                "has_dataset": True,
                "data_available": True,
            }
        return {
            "status": "not_run",
            "message": f"Attribute extraction not yet completed for dataset {effective_id}.",
            "extracted_file_exists": False,
            "dataset_id": effective_id,
            "has_dataset": True,
            "data_available": False,
        }

    if not EXTRACTION_REPORT_PATH.exists():
        return {
            "status": "not_run",
            "message": "Phase 3 attribute extraction has not been executed yet. POST /api/standardization/extract-attributes to run.",
            "extracted_file_exists": False,
            "dataset_id": "BASELINE",
            "has_dataset": True,
            "data_available": False,
        }

    try:
        with open(EXTRACTION_REPORT_PATH, encoding="utf-8") as f:
            report = json.load(f)
        return {
            "status": "completed",
            "extracted_file_exists": EXTRACTED_CSV_PATH.exists(),
            "report": report,
            "dataset_id": "BASELINE",
            "has_dataset": True,
            "data_available": True,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read extraction report: {str(e)}")


@router.get("/attributes/report")
async def get_attributes_report():
    """
    Get the full Phase 3 attribute extraction report JSON.
    """
    if not EXTRACTION_REPORT_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="Extraction report not found. Run POST /api/standardization/extract-attributes first.",
        )
    try:
        with open(EXTRACTION_REPORT_PATH, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/attributes/{material_code}")
async def get_material_attributes(material_code: str):
    """
    Get extracted attributes for a specific material code.
    Returns original fields + all EX_* extracted attribute columns.
    """
    df = _load_extracted_df()
    if df is None:
        raise HTTPException(
            status_code=404,
            detail="Extracted attributes data not found. Run Phase 3 extraction first.",
        )

    mask = df["Material_Code"] == material_code
    if not mask.any():
        raise HTTPException(
            status_code=404,
            detail=f"Material code '{material_code}' not found in extracted attributes dataset.",
        )

    row = df[mask].iloc[0]
    row_dict = row.where(pd.notna(row), None).to_dict()

    # Separate original fields from extracted attributes
    original_fields = {
        k: _clean_val(v)
        for k, v in row_dict.items()
        if not k.startswith("EX_") and not k.startswith("extraction_")
    }
    extracted_attrs = {
        k.replace("EX_", ""): _clean_val(v)
        for k, v in row_dict.items()
        if k.startswith("EX_") and _clean_val(v) is not None
    }
    audit = {
        k: _clean_val(v)
        for k, v in row_dict.items()
        if k.startswith("extraction_")
    }

    return {
        "material_code": material_code,
        "original_fields": original_fields,
        "extracted_attributes": extracted_attrs,
        "audit": audit,
    }


@router.post("/extract-attributes")
async def run_attribute_extraction():
    """
    Trigger Phase 3 pipeline: Engineering Attribute Extraction.

    Reads from data/processed/normalized_materials.csv (Phase 2 output).
    Writes:
      - data/processed/extracted_attributes.csv
      - data/processed/attribute_extraction_report.json
    Verifies raw dataset SHA256 unchanged before and after.
    """
    try:
        _invalidate_cache()  # Clear cached DataFrame before re-run
        result = await pipeline_runner.run_extraction_pipeline()
        if result.get("status") == "failed":
            raise HTTPException(
                status_code=500,
                detail=result.get("message", "Phase 3 extraction failed"),
            )
        return {
            "status": "completed",
            "message": "Phase 3 (Attribute Extraction) pipeline executed successfully.",
            "result": result,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction pipeline error: {str(e)}")


# ═════════════════════════════════════════════════════════════════════════════
# Phase 4: Material Standardization & Canonicalization Endpoints
# ═════════════════════════════════════════════════════════════════════════════

STANDARDIZATION_REPORT_PATH = Path("data/processed/standardization_report.json")
STANDARDIZED_CSV_PATH = Path("data/processed/standardized_materials.csv")
_standardized_df: Optional[pd.DataFrame] = None


def _load_standardized_df() -> Optional[pd.DataFrame]:
    global _standardized_df
    if _standardized_df is None and STANDARDIZED_CSV_PATH.exists():
        _standardized_df = pd.read_csv(STANDARDIZED_CSV_PATH, dtype=str)
        _standardized_df = _standardized_df.where(pd.notna(_standardized_df), None)
    return _standardized_df


def _invalidate_standardization_cache():
    global _standardized_df
    _standardized_df = None


@router.get("/report")
async def get_standardization_report(dataset_id: Optional[str] = None):
    """
    Get Phase 4 Material Standardization & Canonicalization report, scoped by dataset_id.
    """
    from services.dataset_resolver import resolve_artifact_path

    effective_id = dataset_id.strip().upper() if dataset_id else "BASELINE"
    if effective_id == "NONE":
        return {
            "dataset_id": "NONE",
            "has_dataset": False,
            "data_available": False,
            "total_materials": 0,
            "standardized_count": 0,
            "canonicalized_count": 0,
            "coverage_pct": 0.0,
            "domain_coverage": {},
            "attribute_distributions": {},
            "categories": [],
            "status": "no_dataset_selected",
        }

    # Resolve for specific upload dataset
    if effective_id not in ["BASELINE", "ALL"]:
        rpt_path = resolve_artifact_path("standardization_report.json", dataset_id=dataset_id)
        if rpt_path and rpt_path.exists():
            try:
                with open(rpt_path, encoding="utf-8") as f:
                    raw_text = f.read()
                import re
                sanitized = re.sub(r"\bNaN\b", "null", raw_text)
                data = json.loads(sanitized)
                data["dataset_id"] = dataset_id
                data["has_dataset"] = True
                data["data_available"] = True
                return data
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to read standardization report: {str(e)}")
        raise HTTPException(
            status_code=404,
            detail=f"Standardization report not found for dataset {dataset_id}. Processing may not be complete.",
        )

    # Only BASELINE / ALL when explicit
    if not STANDARDIZATION_REPORT_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="Standardization report not found. Run POST /api/standardization/run first.",
        )
    try:
        with open(STANDARDIZATION_REPORT_PATH, encoding="utf-8") as f:
            raw_text = f.read()
        import re
        sanitized = re.sub(r"\bNaN\b", "null", raw_text)
        data = json.loads(sanitized)
        data["dataset_id"] = effective_id
        data["has_dataset"] = True
        data["data_available"] = True

        # If cached report has no examples, sample them live from the CSV
        if not data.get("examples"):
            try:
                df_std = _load_standardized_df()
                if df_std is not None and not df_std.empty:
                    conflict_rows = df_std[df_std.get("Standardization_Conflict_Preserved", pd.Series(dtype=str)) == "True"]
                    clean_rows = df_std[df_std.get("Standardization_Conflict_Preserved", pd.Series(dtype=str)) != "True"]
                    n_c = min(8, len(conflict_rows))
                    n_clean = min(7, len(clean_rows))
                    parts = []
                    if n_c > 0:
                        parts.append(conflict_rows.sample(n=n_c, random_state=42))
                    if n_clean > 0:
                        parts.append(clean_rows.sample(n=n_clean, random_state=42))
                    sample_df = pd.concat(parts) if parts else df_std.sample(n=min(15, len(df_std)), random_state=42)

                    examples_live = []
                    for _, r in sample_df.iterrows():
                        code = str(r.get("Material_Code", "") or "")
                        if not code or code == "nan":
                            continue
                        examples_live.append({
                            "material_code": code,
                            "original_description": str(r.get("Material_Description", "") or ""),
                            "phase3_extracted": {
                                k.replace("EX_", ""): str(r[k]).strip()
                                for k in df_std.columns
                                if k.startswith("EX_")
                                and r.get(k) is not None
                                and str(r.get(k, "")).strip() not in ("", "nan", "None")
                            },
                            "standardized_description": str(r.get("Standardized_Description", "") or ""),
                            "canonical_material_key": str(r.get("Canonical_Material_Key", "") or ""),
                            "rules_applied": str(r.get("Standardization_Rules_Applied", "") or ""),
                            "conflict_preserved": str(r.get("Standardization_Conflict_Preserved", "")) == "True",
                        })
                    data["examples"] = examples_live
            except Exception:
                pass  # Leave examples empty on any error

        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read standardization report: {str(e)}")


@router.get("/materials/{material_code}")
async def get_standardized_material(
    material_code: str,
    dataset_id: Optional[str] = None,
):
    """
    Get standardized material details for a specific material code scoped by dataset_id.
    Returns original fields, Phase 3 extracted attributes, and Phase 4 canonical attributes.
    """
    from services.dataset_resolver import load_dataset_dataframe

    effective_id = dataset_id.strip().upper() if dataset_id else "BASELINE"
    if effective_id == "NONE":
        raise HTTPException(
            status_code=404,
            detail="No dataset selected.",
        )

    df = load_dataset_dataframe("standardized_materials.csv", dataset_id=dataset_id)
    if df.empty and effective_id == "BASELINE":
        df = _load_standardized_df()

    if df is None or df.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Standardized materials dataset not found for dataset '{dataset_id}'.",
        )

    mask = df["Material_Code"] == material_code
    if not mask.any():
        raise HTTPException(
            status_code=404,
            detail=f"Material code '{material_code}' not found in standardized materials dataset.",
        )

    row = df[mask].iloc[0]
    row_dict = row.where(pd.notna(row), None).to_dict()

    canonical_attrs = {
        k.replace("Canonical_", ""): _clean_val(v)
        for k, v in row_dict.items()
        if k.startswith("Canonical_") and k != "Canonical_Material_Key" and _clean_val(v) is not None
    }

    extracted_attrs = {
        k.replace("EX_", ""): _clean_val(v)
        for k, v in row_dict.items()
        if k.startswith("EX_") and _clean_val(v) is not None
    }

    standardization_meta = {
        "standardized_description": _clean_val(row_dict.get("Standardized_Description")),
        "canonical_material_key": _clean_val(row_dict.get("Canonical_Material_Key")),
        "standardization_changed": _clean_val(row_dict.get("Standardization_Changed")),
        "standardization_rule_count": _clean_val(row_dict.get("Standardization_Rule_Count")),
        "standardization_rules_applied": _clean_val(row_dict.get("Standardization_Rules_Applied")),
        "conflict_preserved": _clean_val(row_dict.get("Standardization_Conflict_Preserved")),
        "conflict_detail": _clean_val(row_dict.get("extraction_conflicts_detail")),
    }

    original_fields = {
        k: _clean_val(v)
        for k, v in row_dict.items()
        if not k.startswith("EX_")
        and not k.startswith("Canonical_")
        and not k.startswith("Standardization_")
        and not k.startswith("extraction_")
        and k != "Standardized_Description"
    }

    return {
        "material_code": material_code,
        "original_fields": original_fields,
        "extracted_attributes": extracted_attrs,
        "canonical_attributes": canonical_attrs,
        "standardization": standardization_meta,
    }


@router.post("/run")
async def run_standardization_pipeline():
    """
    Trigger Phase 4 pipeline: Material Standardization & Canonicalization.
    """
    try:
        _invalidate_standardization_cache()
        result = await pipeline_runner.run_standardization_pipeline()
        if result.get("status") == "failed":
            raise HTTPException(
                status_code=500,
                detail=result.get("message", "Standardization pipeline execution failed"),
            )
        return {
            "status": "completed",
            "message": "Phase 4 (Material Standardization & Canonicalization) executed successfully.",
            "result": result,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Standardization pipeline error: {str(e)}")

