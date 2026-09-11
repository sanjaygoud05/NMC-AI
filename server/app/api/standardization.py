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


def _invalidate_cache():
    global _extracted_df
    _extracted_df = None


@router.get("/attributes")
async def get_attributes_summary():
    """
    Get Phase 3 attribute extraction summary.
    Returns persisted extraction report if available.
    """
    if not EXTRACTION_REPORT_PATH.exists():
        return {
            "status": "not_run",
            "message": "Phase 3 attribute extraction has not been executed yet. POST /api/standardization/extract-attributes to run.",
            "extracted_file_exists": False,
        }

    try:
        with open(EXTRACTION_REPORT_PATH, encoding="utf-8") as f:
            report = json.load(f)
        return {
            "status": "completed",
            "extracted_file_exists": EXTRACTED_CSV_PATH.exists(),
            "report": report,
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
    original_fields = {k: v for k, v in row_dict.items() if not k.startswith("EX_") and not k.startswith("extraction_")}
    extracted_attrs = {
        k.replace("EX_", ""): v
        for k, v in row_dict.items()
        if k.startswith("EX_") and v is not None
    }
    audit = {k: v for k, v in row_dict.items() if k.startswith("extraction_")}

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
async def get_standardization_report():
    """
    Get Phase 4 Material Standardization & Canonicalization report.
    """
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
        return json.loads(sanitized)
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
    from server.services.dataset_resolver import load_dataset_dataframe

    df = load_dataset_dataframe("standardized_materials.csv", dataset_id=dataset_id)
    if df.empty:
        df = _load_standardized_df()

    if df is None or df.empty:
        raise HTTPException(
            status_code=404,
            detail="Standardized materials dataset not found.",
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
        k.replace("Canonical_", ""): v
        for k, v in row_dict.items()
        if k.startswith("Canonical_") and k != "Canonical_Material_Key"
    }

    extracted_attrs = {
        k.replace("EX_", ""): v
        for k, v in row_dict.items()
        if k.startswith("EX_") and v is not None
    }

    standardization_meta = {
        "standardized_description": row_dict.get("Standardized_Description"),
        "canonical_material_key": row_dict.get("Canonical_Material_Key"),
        "standardization_changed": row_dict.get("Standardization_Changed"),
        "standardization_rule_count": row_dict.get("Standardization_Rule_Count"),
        "standardization_rules_applied": row_dict.get("Standardization_Rules_Applied"),
        "conflict_preserved": row_dict.get("Standardization_Conflict_Preserved"),
        "conflict_detail": row_dict.get("extraction_conflicts_detail"),
    }

    original_fields = {
        k: v for k, v in row_dict.items()
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

