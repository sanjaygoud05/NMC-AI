"""
Ingestion & Data Profiling API endpoints (Phase 1)
Normalization API endpoints (Phase 2)
"""

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException, File, UploadFile
from services.ingestion_service import ingestion_service
from services.profiling_service import profiling_service
from services.normalization_service import normalization_service
from pipeline.pipeline_runner import pipeline_runner

router = APIRouter()

NORMALIZATION_REPORT_PATH = Path("data/processed/normalization_report.json")
NORMALIZED_CSV_PATH = Path("data/processed/normalized_materials.csv")


@router.get("/status")
async def get_ingestion_status():
    """
    Get current raw dataset file integrity and ingestion status
    """
    file_info = ingestion_service.verify_file()
    if not file_info["exists"]:
        return {
            "status": "failed",
            "file_info": file_info,
            "message": "Raw dataset file missing from data/raw/",
        }

    ingestion_res = ingestion_service.run_ingestion()
    return {
        "status": ingestion_res["status"],
        "message": ingestion_res["message"],
        "file_info": file_info,
        "schema_info": ingestion_res.get("schema_info"),
        "dataset_summary": ingestion_res.get("dataset_summary"),
    }


@router.get("/profile")
async def get_dataset_profile():
    """
    Get full deterministic dataset profiling JSON report
    """
    try:
        df = ingestion_service.load_raw_dataframe()
        report = profiling_service.profile_dataset(df)
        return report
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to profile dataset: {str(e)}")


@router.get("/data-quality")
async def get_data_quality_metrics():
    """
    Get dataset-level Data Quality Score and field-level completeness breakdown
    """
    try:
        df = ingestion_service.load_raw_dataframe()
        report = profiling_service.profile_dataset(df)
        return {
            "data_quality_score": report["quality_score"]["overall_score"],
            "scoring_methodology": report["quality_score"],
            "dataset_summary": report["dataset_summary"],
            "field_qualities": report["column_profiles"],
            "missingness_analysis": report["missingness_analysis"],
            "quality_flags": report["quality_flags"],
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload")
async def upload_dataset_file(file: UploadFile = File(...)):
    """
    Upload and profile a CSV material dataset file.
    Validates against expected 18-column schema, computes SHA-256,
    identifies whether it matches the official Phase 1 raw baseline,
    and returns dataset characteristics.
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Only CSV (.csv) files are supported for dataset ingestion.",
        )

    try:
        content = await file.read()
        res = ingestion_service.process_uploaded_file(content=content, filename=file.filename)
        if res.get("status") == "error":
            raise HTTPException(status_code=400, detail=res.get("message", "Failed to process CSV file"))
        return res
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file upload: {str(e)}")


@router.post("/run")
async def run_phase1_pipeline():
    """
    Trigger Phase 1 pipeline execution (Ingestion + Data Profiling)
    """
    results = await pipeline_runner.run_pipeline()
    return {
        "status": results["status"],
        "message": "Phase 1 pipeline executed successfully",
        "results": results,
    }


# ------------------------------------------------------------------
# Phase 2 — Normalization Endpoints
# ------------------------------------------------------------------

@router.get("/normalization")
async def get_normalization_summary():
    """
    Get Phase 2 normalization summary.
    Returns the persisted normalization report if available,
    or indicates that normalization has not been run yet.
    """
    if not NORMALIZATION_REPORT_PATH.exists():
        return {
            "status": "not_run",
            "message": "Phase 2 normalization has not been executed yet. POST /api/ingest/normalize to run it.",
            "normalized_file_exists": False,
        }

    try:
        with open(NORMALIZATION_REPORT_PATH, encoding="utf-8") as f:
            report = json.load(f)

        normalized_exists = NORMALIZED_CSV_PATH.exists()
        return {
            "status": "completed",
            "normalized_file_exists": normalized_exists,
            "report": report,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read normalization report: {str(e)}")


@router.get("/normalization/report")
async def get_normalization_report():
    """
    Get the full Phase 2 normalization report JSON.
    """
    if not NORMALIZATION_REPORT_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="Normalization report not found. Run POST /api/ingest/normalize first.",
        )
    try:
        with open(NORMALIZATION_REPORT_PATH, encoding="utf-8") as f:
            report = json.load(f)
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read normalization report: {str(e)}")


@router.post("/normalize")
async def run_normalization_pipeline():
    """
    Trigger Phase 2 pipeline execution (Cleaning & Normalization).

    This will:
    - Verify raw dataset integrity (SHA256)
    - Apply deterministic text normalization
    - Apply UOM canonicalization
    - Apply abbreviation expansion (token-safe)
    - Write data/processed/normalized_materials.csv
    - Write data/processed/normalization_report.json
    - Verify raw dataset is unchanged after execution
    """
    try:
        result = await pipeline_runner.run_normalization_pipeline()
        if result.get("status") == "failed":
            raise HTTPException(
                status_code=500,
                detail=result.get("message", "Phase 2 normalization failed"),
            )
        return {
            "status": "completed",
            "message": "Phase 2 (Cleaning & Normalization) pipeline executed successfully.",
            "result": result,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Normalization pipeline error: {str(e)}")
