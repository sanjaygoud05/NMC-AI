"""
FastAPI Router for Phase 10 Procurement Intelligence & Analytics
Provides endpoints for querying:
- Procurement KPIs (partitioned by UOM, no cross-UOM aggregation)
- CMM procurement summaries (consumption, purchase recency, OEM diversity)
- CMM detail drill-down (with member facts)
- Enterprise CPSE procurement summaries (4 CPSEs)
- Auditable procurement opportunities with complete provenance
- Plant/facility distribution partitioned by UOM
- Line-level procurement facts
"""

from typing import Optional, List, Dict, Any
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.dependencies import get_current_user
from app.db.procurement_repository import procurement_repository

router = APIRouter()


@router.get("/kpis", response_model=Dict[str, Any])
async def get_procurement_kpis(
    dataset_id: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    """
    Get enterprise procurement KPIs partitioned strictly by UOM scoped by dataset_id.
    Never aggregates mixed physical units into a single sum.
    """
    if dataset_id and dataset_id.upper() not in ["", "BASELINE"]:
        from server.services.dataset_resolver import load_dataset_dataframe
        df_facts = load_dataset_dataframe("procurement_facts.csv", dataset_id=dataset_id)
        df_cmm = load_dataset_dataframe("common_material_master.csv", dataset_id=dataset_id)

        volume_by_uom: Dict[str, float] = {}
        if not df_facts.empty and "unit_of_measure" in df_facts.columns and "annual_consumption" in df_facts.columns:
            for uom, grp in df_facts.groupby("unit_of_measure"):
                total_val = pd.to_numeric(grp["annual_consumption"], errors="coerce").fillna(0).sum()
                volume_by_uom[str(uom)] = round(float(total_val), 2)

        total_mats = len(df_facts)
        total_cmm = len(df_cmm)
        active_count = len(df_facts[df_facts["material_status"].str.lower() == "active"]) if not df_facts.empty and "material_status" in df_facts.columns else total_mats
        plants_count = df_facts["plant"].nunique() if not df_facts.empty and "plant" in df_facts.columns else 1
        mfg_count = df_facts["manufacturer"].nunique() if not df_facts.empty and "manufacturer" in df_facts.columns else 0

        return {
            "total_materials_analyzed": total_mats,
            "total_cmm_entities": total_cmm,
            "multi_cpse_cmms_count": 0,
            "standalone_cmms_count": total_cmm,
            "volume_by_uom": volume_by_uom,
            "multi_cpse_volume_by_uom": {},
            "active_materials_count": active_count,
            "inactive_materials_count": total_mats - active_count,
            "active_materials_pct": round((active_count / total_mats) * 100, 1) if total_mats > 0 else 0,
            "distinct_plants_count": plants_count,
            "distinct_manufacturers_count": mfg_count,
            "opportunities_by_type": {},
            "total_opportunities_count": 0,
            "analysis_reference_date": "2026-03-31",
        }
    return procurement_repository.get_kpis()


@router.get("/cmm-summary", response_model=Dict[str, Any])
async def list_cmm_summaries(
    search: Optional[str] = Query(None, description="Search term for CMM code, description, or dominant plant"),
    material_family: Optional[str] = Query(None, description="Filter by material family"),
    primary_uom: Optional[str] = Query(None, description="Filter by primary UOM"),
    cpse: Optional[str] = Query(None, description="Filter by consuming CPSE"),
    min_consumption: Optional[int] = Query(None, ge=0, description="Filter by minimum total annual consumption"),
    dataset_id: Optional[str] = Query(None, description="Scope by dataset_id"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    user: dict = Depends(get_current_user),
):
    """
    List Common Material Master procurement summaries with filtering, pagination, and dataset scoping.
    """
    if dataset_id and dataset_id.upper() not in ["", "BASELINE"]:
        from server.services.dataset_resolver import load_dataset_dataframe
        df = load_dataset_dataframe("cmm_consumption_summary.csv", dataset_id=dataset_id)
        if df.empty:
            return {"items": [], "total": 0, "page": page, "page_size": page_size, "total_pages": 0}

        if material_family and material_family != "all":
            df = df[df["material_family"].str.upper() == material_family.upper()]
        if primary_uom and primary_uom != "all":
            df = df[df["primary_uom"].str.upper() == primary_uom.upper()]
        if cpse and cpse != "all":
            df = df[df["consuming_cpses"].str.contains(cpse, case=False, na=False)]
        if search:
            s = search.strip().lower()
            mask = (
                df["cmm_code"].str.lower().str.contains(s, na=False)
                | df["common_description"].str.lower().str.contains(s, na=False)
                | df["dominant_plant"].str.lower().str.contains(s, na=False)
            )
            df = df[mask]

        total = len(df)
        total_pages = (total + page_size - 1) // page_size if total > 0 else 0
        start = (page - 1) * page_size
        page_df = df.iloc[start : start + page_size]

        items = []
        for _, r in page_df.iterrows():
            items.append({
                "cmm_code": str(r.get("cmm_code", "")),
                "common_description": str(r.get("common_description", "")),
                "material_family": str(r.get("material_family", "")),
                "governance_status": str(r.get("governance_status", "STANDALONE_CANDIDATE")),
                "member_count": int(r.get("member_count", 1)),
                "cpse_count": int(r.get("cpse_count", 1)),
                "consuming_cpses": str(r.get("consuming_cpses", "")),
                "primary_uom": str(r.get("primary_uom", "NOS")),
                "total_annual_consumption": float(r.get("total_annual_consumption", 0)),
                "avg_consumption_per_member": float(r.get("avg_consumption_per_member", 0)),
                "plant_count": int(r.get("plant_count", 1)),
                "dominant_plant": str(r.get("dominant_plant", "MAIN")),
                "earliest_purchase_date": str(r.get("earliest_purchase_date", "")) or None,
                "latest_purchase_date": str(r.get("latest_purchase_date", "")) or None,
                "purchase_recency_days": int(r.get("purchase_recency_days", 180)),
                "active_member_count": int(r.get("active_member_count", 1)),
                "inactive_member_count": int(r.get("inactive_member_count", 0)),
                "distinct_manufacturers_count": int(r.get("distinct_manufacturers_count", 0)),
                "manufacturers_list": str(r.get("manufacturers_list", "")),
            })

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        }

    return procurement_repository.query_cmm_summaries(
        search=search,
        material_family=material_family,
        primary_uom=primary_uom,
        cpse=cpse,
        min_consumption=min_consumption,
        page=page,
        page_size=page_size,
    )


@router.get("/cmm-summary/{cmm_code}", response_model=Dict[str, Any])
async def get_cmm_summary_detail(
    cmm_code: str,
    user: dict = Depends(get_current_user),
):
    """
    Get single CMM procurement summary with full drill-down to contributing legacy member facts.
    """
    detail = procurement_repository.get_cmm_summary_detail(cmm_code)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CMM summary for '{cmm_code}' not found",
        )
    return detail


@router.get("/cpse-summary", response_model=List[Dict[str, Any]])
async def get_cpse_summaries(
    user: dict = Depends(get_current_user),
):
    """
    Get enterprise summaries across all 4 CPSEs (CPCL, HPCL, IOCL, ONGC) partitioned by UOM.
    """
    return procurement_repository.get_cpse_summaries()


@router.get("/opportunities", response_model=Dict[str, Any])
async def list_procurement_opportunities(
    opportunity_type: Optional[str] = Query(None, description="Filter by opportunity type"),
    cmm_code: Optional[str] = Query(None, description="Filter by CMM code"),
    source_cpse: Optional[str] = Query(None, description="Filter by source CPSE"),
    cpse: Optional[str] = Query(None, description="Alias for source_cpse"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    user: dict = Depends(get_current_user),
):
    """
    List auditable procurement opportunities with complete provenance fields:
    trigger_metric, trigger_value, threshold, reason, evidence_reference.
    """
    effective_cpse = cpse or source_cpse
    return procurement_repository.query_opportunities(
        opportunity_type=opportunity_type,
        cmm_code=cmm_code,
        source_cpse=effective_cpse,
        page=page,
        page_size=page_size,
    )


@router.get("/plants", response_model=List[Dict[str, Any]])
async def get_plant_distribution(
    user: dict = Depends(get_current_user),
):
    """
    Get consumption volume breakdown strictly per plant and UOM.
    """
    return procurement_repository.get_plant_distribution()


@router.get("/facts", response_model=Dict[str, Any])
async def list_procurement_facts(
    source_cpse: Optional[str] = Query(None, description="Filter by CPSE"),
    cmm_code: Optional[str] = Query(None, description="Filter by CMM code"),
    search: Optional[str] = Query(None, description="Search material code, description, or plant"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    user: dict = Depends(get_current_user),
):
    """
    List line-level procurement facts with filtering and pagination.
    """
    return procurement_repository.query_facts(
        source_cpse=source_cpse,
        cmm_code=cmm_code,
        search=search,
        page=page,
        page_size=page_size,
    )
