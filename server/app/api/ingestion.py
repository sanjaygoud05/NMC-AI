"""
Ingestion & Data Profiling API endpoints (Phase 1)
Normalization API endpoints (Phase 2)
"""

import json
from typing import Optional
from pathlib import Path

from fastapi import APIRouter, HTTPException, File, UploadFile, BackgroundTasks, Form, Header, Query
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
async def upload_dataset_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(None),
    x_user_id: Optional[str] = Header(None),
):
    """
    Upload and register a CSV material dataset file.
    Validates against expected 18-column schema, generates unique dataset_id,
    persists dataset metadata, and queues background processing job.
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Only CSV (.csv) files are supported for dataset ingestion.",
        )

    try:
        content = await file.read()
        from services.dataset_registry_service import dataset_registry_service
        from services.upload_processing_service import upload_processing_service

        effective_user_id = user_id or x_user_id
        reg = dataset_registry_service.register_upload(
            file_name=file.filename,
            content=content,
            user_id=effective_user_id,
        )

        dataset_id = reg["dataset_id"]

        if reg["status"] == "FAILED":
            return {
                "dataset_id": dataset_id,
                "status": "FAILED",
                "message": reg.get("error_message", "CSV validation failed"),
                "dataset_summary": reg,
            }

        # Dispatch background processing job
        if background_tasks:
            background_tasks.add_task(upload_processing_service.process_dataset, dataset_id)
        else:
            # Fallback direct processing if background_tasks not provided
            import asyncio
            asyncio.get_event_loop().run_in_executor(None, upload_processing_service.process_dataset, dataset_id)

        return {
            "status": "UPLOADED",
            "message": f"Dataset {file.filename} registered successfully with ID {dataset_id}",
            "dataset_id": dataset_id,
            "filename": file.filename,
            "dataset_summary": reg,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file upload: {str(e)}")


@router.get("/datasets")
async def list_datasets(
    user_id: Optional[str] = Query(None),
    x_user_id: Optional[str] = Header(None),
):
    """
    List all registered datasets visible to user (BASELINE + user's uploaded datasets).
    """
    from services.dataset_registry_service import dataset_registry_service
    effective_user_id = user_id or x_user_id
    return dataset_registry_service.list_datasets(user_id=effective_user_id)


@router.get("/datasets/{dataset_id}")
async def get_dataset_status(dataset_id: str):
    """
    Get metadata and processing status for specific dataset.
    """
    from services.dataset_registry_service import dataset_registry_service
    ds = dataset_registry_service.get_dataset(dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found.")
    return ds


@router.get("/jobs")
async def list_ingestion_jobs():
    """
    List all ingestion jobs with their status and metadata.
    """
    from services.dataset_registry_service import dataset_registry_service
    datasets = dataset_registry_service.list_datasets()
    
    jobs = []
    for ds in datasets:
        job = {
            "job_id": ds.get("dataset_id"),
            "dataset_id": ds.get("dataset_id"),
            "file_name": ds.get("file_name"),
            "status": ds.get("status", "UNKNOWN"),
            "created_at": ds.get("created_at"),
            "started_at": ds.get("started_at"),
            "completed_at": ds.get("completed_at"),
            "current_phase": ds.get("current_phase"),
            "progress": ds.get("progress", 0),
            "error_message": ds.get("error_message"),
        }
        jobs.append(job)
    
    return jobs


@router.get("/jobs/{job_id}")
async def get_ingestion_job(job_id: str):
    """
    Get detailed information about a specific ingestion job.
    """
    from services.dataset_registry_service import dataset_registry_service
    ds = dataset_registry_service.get_dataset(job_id)
    if not ds:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    
    return {
        "job_id": ds.get("dataset_id"),
        "dataset_id": ds.get("dataset_id"),
        "file_name": ds.get("file_name"),
        "status": ds.get("status", "UNKNOWN"),
        "created_at": ds.get("created_at"),
        "started_at": ds.get("started_at"),
        "completed_at": ds.get("completed_at"),
        "current_phase": ds.get("current_phase"),
        "progress": ds.get("progress", 0),
        "error_message": ds.get("error_message"),
        "row_count": ds.get("row_count"),
        "cpse_count": ds.get("cpse_count"),
    }


@router.get("/jobs/{job_id}/status")
async def get_ingestion_job_status(job_id: str):
    """
    Get current status of a specific ingestion job.
    """
    from services.dataset_registry_service import dataset_registry_service
    ds = dataset_registry_service.get_dataset(job_id)
    if not ds:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    
    return {
        "job_id": job_id,
        "status": ds.get("status", "UNKNOWN"),
        "progress": ds.get("progress", 0),
        "current_phase": ds.get("current_phase"),
        "message": ds.get("error_message") or "Processing in progress",
    }


@router.post("/jobs/{job_id}/cancel")
async def cancel_ingestion_job(job_id: str):
    """
    Cancel a running ingestion job.
    """
    from services.dataset_registry_service import dataset_registry_service
    ds = dataset_registry_service.get_dataset(job_id)
    if not ds:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    
    if ds.get("status") in ["COMPLETED", "FAILED"]:
        return {
            "job_id": job_id,
            "cancelled": False,
            "message": f"Job cannot be cancelled (status: {ds.get('status')})",
        }
    
    # Update status to CANCELLED
    dataset_registry_service.update_dataset_status(job_id, "CANCELLED")
    
    return {
        "job_id": job_id,
        "cancelled": True,
        "message": "Job cancellation requested",
    }


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
