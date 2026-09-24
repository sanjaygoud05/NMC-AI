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


def _find_field(df_cols, aliases):
    norm_aliases = [a.lower().replace("_", "").replace(" ", "").replace("-", "") for a in aliases]
    for c in df_cols:
        if c.lower().replace("_", "").replace(" ", "").replace("-", "") in norm_aliases:
            return c
    return None


def _ingest_dataset_background(
    dataset_id: str,
    cpse_id: str,
    cpse_code: str,
    file_path: str,
    col_map: dict,
    df_columns: list,
):
    """Background task: read file, insert materials and procurement records from uploaded file."""
    import logging
    import uuid
    from datetime import datetime, timezone
    from sqlalchemy import text
    try:
        from app.models.nmc_models import InventoryRecord, DemandRecord, ProcurementHistoryRecord
    except ImportError:
        from server.app.models.nmc_models import InventoryRecord, DemandRecord, ProcurementHistoryRecord

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

        # Clean old materials and procurement records for this dataset / cpse
        with nmc_repo.get_session() as session:
            session.execute(text("DELETE FROM inventory_records WHERE material_id IN (SELECT id FROM materials WHERE dataset_id=:did) OR cpse_id=:cid"), {"did": dataset_id, "cid": cpse_id})
            session.execute(text("DELETE FROM demand_records WHERE material_id IN (SELECT id FROM materials WHERE dataset_id=:did) OR cpse_id=:cid"), {"did": dataset_id, "cid": cpse_id})
            session.execute(text("DELETE FROM procurement_history_records WHERE material_id IN (SELECT id FROM materials WHERE dataset_id=:did) OR cpse_id=:cid"), {"did": dataset_id, "cid": cpse_id})
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

        inserted_records = nmc_repo.bulk_insert_materials(materials)

        # Detect procurement fields from uploaded columns
        qoh_col = _find_field(df.columns, ["quantity_on_hand", "quantityonhand", "on_hand", "stock", "physical_stock", "qty_on_hand"])
        res_col = _find_field(df.columns, ["reserved_quantity", "reservedquantity", "reserved_stock", "reserved"])
        avail_col = _find_field(df.columns, ["available_quantity", "availablequantity", "free_stock", "available"])
        cons_col = _find_field(df.columns, ["annual_consumption", "annualconsumption", "consumption", "annual_volume"])
        req_col = _find_field(df.columns, ["required_quantity", "requiredquantity", "demand_quantity", "demand_qty", "required"])
        fc_col = _find_field(df.columns, ["forecast_quantity", "forecastquantity", "forecast"])
        period_col = _find_field(df.columns, ["demand_period", "demandperiod", "period", "quarter"])
        plant_col = _find_field(df.columns, ["plant", "plant_name", "facility", "site", "location"])
        uom_col = _find_field(df.columns, ["unit", "uom", "unit_of_measure", "base_unit"])
        price_col = _find_field(df.columns, ["unit_price_inr", "unit_price", "unitprice", "price", "rate", "cost"])
        mfg_col = _find_field(df.columns, ["manufacturer", "supplier", "vendor", "supplier_name", "oem"])
        po_col = _find_field(df.columns, ["po_number", "ponumber", "po_no", "po"])
        date_col = _find_field(df.columns, ["last_purchase_date", "lastpurchasedate", "po_date", "purchase_date", "order_date"])
        status_col = _find_field(df.columns, ["material_status", "materialstatus", "status", "item_status"])

        inv_objs = []
        dem_objs = []
        hist_objs = []

        with nmc_repo.get_session() as session:
            for i, (_, row) in enumerate(df.iterrows()):
                if i >= len(inserted_records):
                    break
                mat_id = inserted_records[i]["id"]
                mat_code = inserted_records[i]["original_material_code"] or f"ITEM-{i+1}"
                plant = str(row.get(plant_col, "Main Plant")).strip() if plant_col else "Main Plant"
                uom = str(row.get(uom_col, "NOS")).strip() if uom_col else "NOS"
                m_status = str(row.get(status_col, "Active")).strip() if status_col else "Active"

                annual_cons = 0.0
                if cons_col:
                    try:
                        annual_cons = float(row.get(cons_col, 0) or 0)
                    except:
                        annual_cons = 0.0

                # 1. Inventory Record from uploaded file
                if qoh_col:
                    try:
                        qty_on_hand = float(row.get(qoh_col, 0) or 0)
                    except:
                        qty_on_hand = 0.0
                    try:
                        reserved_qty = float(row.get(res_col, 0) or 0) if res_col else round(qty_on_hand * 0.08, 1)
                    except:
                        reserved_qty = round(qty_on_hand * 0.08, 1)
                    try:
                        avail_qty = float(row.get(avail_col, 0) or 0) if avail_col else max(0.0, round(qty_on_hand - reserved_qty, 1))
                    except:
                        avail_qty = max(0.0, round(qty_on_hand - reserved_qty, 1))
                elif annual_cons > 0:
                    qty_on_hand = round(annual_cons * (0.25 if m_status == "Slow-Moving" else 0.40 if m_status == "Obsolete" else 0.12), 1)
                    reserved_qty = round(qty_on_hand * 0.08, 1)
                    avail_qty = max(0.0, round(qty_on_hand - reserved_qty, 1))
                else:
                    qty_on_hand = 0.0
                    reserved_qty = 0.0
                    avail_qty = 0.0

                inv_objs.append(InventoryRecord(
                    id=str(uuid.uuid4()),
                    material_id=mat_id,
                    cpse_id=cpse_id,
                    cmm_id=None,
                    quantity_on_hand=qty_on_hand,
                    reserved_quantity=reserved_qty,
                    available_quantity=avail_qty,
                    plant=plant,
                    uom=uom,
                    inventory_date=datetime.now(timezone.utc),
                ))

                # 2. Demand Record from uploaded file
                if req_col:
                    try:
                        req_qty = float(row.get(req_col, 0) or 0)
                    except:
                        req_qty = 0.0
                    try:
                        fc_qty = float(row.get(fc_col, req_qty * 1.15) or req_qty * 1.15) if fc_col else round(req_qty * 1.15, 1)
                    except:
                        fc_qty = round(req_qty * 1.15, 1)
                    period = str(row.get(period_col, "Q4 2026")).strip() if period_col else "Q4 2026"
                elif annual_cons > 0:
                    req_qty = 0.0 if m_status == "Obsolete" else round(annual_cons * (0.10 if m_status == "Slow-Moving" else 0.25), 1)
                    fc_qty = round(req_qty * 1.15, 1)
                    period = "Q4 2026"
                else:
                    req_qty = 0.0
                    fc_qty = 0.0
                    period = "Q4 2026"

                dem_objs.append(DemandRecord(
                    id=str(uuid.uuid4()),
                    material_id=mat_id,
                    cpse_id=cpse_id,
                    cmm_id=None,
                    required_quantity=req_qty,
                    forecast_quantity=fc_qty,
                    demand_period=period,
                    plant=plant,
                    uom=uom,
                ))

                # 3. Procurement History Record from uploaded file
                po_num = str(row.get(po_col, f"PO-{cpse_code}-{mat_code.split('-')[-1]}")).strip() if po_col else f"PO-{cpse_code}-{mat_code.split('-')[-1]}"
                supplier = str(row.get(mfg_col, "OEM Supplier")).strip() if mfg_col else "OEM Supplier"
                price = 0.0
                if price_col:
                    try:
                        price = float(row.get(price_col, 0) or 0)
                    except:
                        price = 0.0

                po_d = None
                if date_col and row.get(date_col):
                    try:
                        po_d = datetime.fromisoformat(str(row[date_col]).strip())
                    except:
                        pass

                hist_objs.append(ProcurementHistoryRecord(
                    id=str(uuid.uuid4()),
                    material_id=mat_id,
                    cpse_id=cpse_id,
                    cmm_id=None,
                    po_number=po_num,
                    supplier_name=supplier,
                    quantity=req_qty if req_qty > 0 else (qty_on_hand if qty_on_hand > 0 else 1.0),
                    unit_price=price,
                    uom=uom,
                    po_date=po_d or datetime.now(timezone.utc),
                ))

            session.add_all(inv_objs)
            session.add_all(dem_objs)
            session.add_all(hist_objs)
            session.commit()

        nmc_repo.update_dataset_status(dataset_id, "VALIDATED", record_count=len(materials))

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
