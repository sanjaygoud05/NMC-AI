"""
NMC CPSE API
Manage CPSEs and their datasets.
"""

import io
import os
from pathlib import Path
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Form
from pydantic import BaseModel

try:
    from app.db.nmc_repository import nmc_repo
    from app.config import settings
    from app.api.nmc_auth import verify_admin_access
except ImportError:
    from server.app.db.nmc_repository import nmc_repo
    from server.app.config import settings
    from server.app.api.nmc_auth import verify_admin_access

router = APIRouter()

# Required columns in uploaded CSV/Excel
REQUIRED_COLUMNS = {"material_code", "description"}
# Acceptable aliases for those columns
COLUMN_ALIASES = {
    "material_code": ["material_code", "mat_code", "code", "item_code", "material code"],
    "description": ["description", "material_description", "desc", "item_description", "short_text"],
}


def _normalize_header(col: str) -> str:
    return col.strip().lower().replace(" ", "_").replace("-", "_")


def _detect_required_columns(df_cols):
    """Try to map actual column names to required fields using aliases."""
    col_map = {}
    lower_cols = {_normalize_header(c): c for c in df_cols}
    for required, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            norm = _normalize_header(alias)
            if norm in lower_cols:
                col_map[required] = lower_cols[norm]
                break
    return col_map


class CreateCPSERequest(BaseModel):
    name: str
    code: str
    description: Optional[str] = ""


@router.get("")
def list_cpsEs():
    """List all CPSEs with dataset status and material counts."""
    return nmc_repo.list_cpsEs()


@router.post("")
def create_cpse(req: CreateCPSERequest, _role: str = Depends(verify_admin_access)):
    """Create a new CPSE. Admin-only."""
    existing = nmc_repo.get_cpse(req.code.upper())
    if existing:
        raise HTTPException(status_code=409, detail=f"CPSE with code '{req.code.upper()}' already exists.")
    return nmc_repo.create_cpse(name=req.name, code=req.code, description=req.description or "")


@router.get("/{cpse_id}")
def get_cpse(cpse_id: str):
    """Get a single CPSE by ID or code."""
    cpse = nmc_repo.get_cpse(cpse_id)
    if not cpse:
        raise HTTPException(status_code=404, detail=f"CPSE '{cpse_id}' not found.")
    return cpse


@router.delete("/{cpse_id}")
def delete_cpse(cpse_id: str, _role: str = Depends(verify_admin_access)):
    """Delete a CPSE and its associated materials and datasets. Admin-only."""
    deleted = nmc_repo.delete_cpse(cpse_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"CPSE '{cpse_id}' not found.")
    return {"status": "SUCCESS", "message": f"CPSE '{cpse_id}' deleted successfully."}


@router.post("/{cpse_id}/upload")
async def upload_dataset(
    cpse_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    _role: str = Depends(verify_admin_access),
):
    """
    Upload a CSV or Excel material dataset for a CPSE.
    Validates structure, saves file, registers dataset in DB.
    """
    cpse = nmc_repo.get_cpse(cpse_id)
    if not cpse:
        raise HTTPException(status_code=404, detail=f"CPSE '{cpse_id}' not found.")

    filename = file.filename or ""
    ext = Path(filename).suffix.lower()
    if ext not in (".csv", ".xlsx", ".xls"):
        raise HTTPException(
            status_code=400,
            detail="Only CSV (.csv) and Excel (.xlsx, .xls) files are supported.",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Parse
    try:
        if ext == ".csv":
            df = pd.read_csv(io.BytesIO(content), dtype=str)
        else:
            df = pd.read_excel(io.BytesIO(content), dtype=str)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {exc}")

    if df.empty:
        raise HTTPException(status_code=400, detail="The file contains no data rows.")

    # Column detection
    col_map = _detect_required_columns(df.columns.tolist())
    missing = [r for r in REQUIRED_COLUMNS if r not in col_map]
    if missing:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Missing required columns: {missing}. "
                f"File has: {df.columns.tolist()}. "
                "Expected columns: 'material_code' and 'description' (or common aliases)."
            ),
        )

    # Save file to disk
    uploads_dir = Path(settings.UPLOADS_DIR)
    uploads_dir.mkdir(parents=True, exist_ok=True)

    cpse_dir = uploads_dir / cpse["code"]
    cpse_dir.mkdir(parents=True, exist_ok=True)

    save_path = cpse_dir / filename
    with open(save_path, "wb") as f:
        f.write(content)

    record_count = len(df)
    dataset = nmc_repo.create_dataset(
        cpse_id=cpse["id"],
        file_name=filename,
        file_type=ext.lstrip("."),
        record_count=record_count,
    )
    dataset_id = dataset["id"]

    # Queue background ingestion
    background_tasks.add_task(
        _ingest_dataset_background,
        dataset_id=dataset_id,
        cpse_id=cpse["id"],
        cpse_code=cpse["code"],
        file_path=str(save_path),
        col_map=col_map,
        df_columns=df.columns.tolist(),
    )

    return {
        "status": "UPLOADED",
        "dataset_id": dataset_id,
        "file_name": filename,
        "record_count": record_count,
        "message": f"Dataset uploaded. Processing started for {record_count} records.",
        "dataset": dataset,
    }


def _ingest_dataset_background(
    dataset_id: str,
    cpse_id: str,
    cpse_code: str,
    file_path: str,
    col_map: dict,
    df_columns: list,
):
    """Background task: read file, insert materials as RAW, update status."""
    import logging
    logger = logging.getLogger(__name__)
    try:
        nmc_repo.update_dataset_status(dataset_id, "VALIDATED")
        ext = Path(file_path).suffix.lower()
        if ext == ".csv":
            df = pd.read_csv(file_path, dtype=str)
        else:
            df = pd.read_excel(file_path, dtype=str)

        df.fillna("", inplace=True)
        df.drop_duplicates(subset=[col_map["description"]], inplace=True)
        df = df[df[col_map["description"]].str.strip() != ""]

        nmc_repo.update_dataset_status(dataset_id, "PROCESSING")

        # Delete old materials for this dataset
        from sqlalchemy import text
        with nmc_repo.get_session() as session:
            session.execute(text("DELETE FROM materials WHERE dataset_id=:did"), {"did": dataset_id})
            session.commit()

        materials = []
        for _, row in df.iterrows():
            materials.append({
                "dataset_id": dataset_id,
                "cpse_id": cpse_id,
                "original_material_code": str(row.get(col_map.get("material_code", ""), "")).strip() or None,
                "original_description": str(row[col_map["description"]]).strip(),
            })

        nmc_repo.bulk_insert_materials(materials)
        nmc_repo.update_dataset_status(dataset_id, "NORMALIZED" if False else "VALIDATED", record_count=len(materials))
        # Status stays VALIDATED — user must trigger normalization explicitly

    except Exception as exc:
        logger.error("Background ingestion failed for dataset %s: %s", dataset_id, exc)
        nmc_repo.update_dataset_status(dataset_id, "FAILED", error_message=str(exc))


@router.post("/{cpse_id}/normalize")
def normalize_dataset(cpse_id: str, _role: str = Depends(verify_admin_access)):
    """
    Trigger normalization for the active dataset of a CPSE.
    Uses the existing normalization + attribute extraction pipeline.
    Runs synchronously so normalized records are immediately written and available.
    """
    cpse = nmc_repo.get_cpse(cpse_id)
    if not cpse:
        raise HTTPException(status_code=404, detail=f"CPSE '{cpse_id}' not found.")

    ds = nmc_repo.get_active_dataset_for_cpse(cpse["id"])
    if not ds:
        raise HTTPException(status_code=404, detail="No active dataset found for this CPSE.")

    if ds["status"] not in ("VALIDATED", "NORMALIZED", "UPLOADED"):
        raise HTTPException(
            status_code=409,
            detail=f"Dataset must be in VALIDATED status to normalize. Current status: {ds['status']}",
        )

    nmc_repo.update_dataset_status(ds["id"], "PROCESSING")
    try:
        try:
            from services.nmc_normalization_service import normalize_dataset_materials
        except ImportError:
            from server.services.nmc_normalization_service import normalize_dataset_materials
        res = normalize_dataset_materials(ds["id"], cpse["id"], cpse["code"])
        return {
            "status": "NORMALIZED",
            "dataset_id": ds["id"],
            "record_count": res.get("processed", 0) if isinstance(res, dict) else ds.get("record_count", 0),
            "message": "Dataset normalized successfully.",
        }
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error("Normalization failed for dataset %s: %s", ds["id"], exc, exc_info=True)
        nmc_repo.update_dataset_status(ds["id"], "FAILED", error_message=str(exc))
        raise HTTPException(status_code=500, detail=f"Normalization failed: {exc}")


@router.get("/{cpse_id}/dataset")
def get_dataset_status(cpse_id: str):
    """Get the active dataset status for a CPSE."""
    cpse = nmc_repo.get_cpse(cpse_id)
    if not cpse:
        raise HTTPException(status_code=404, detail=f"CPSE '{cpse_id}' not found.")
    ds = nmc_repo.get_active_dataset_for_cpse(cpse["id"])
    if not ds:
        return {"status": "NO_DATASET", "message": "No dataset uploaded yet."}
    return ds
