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
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.dependencies import get_current_user
from app.db.procurement_repository import procurement_repository

router = APIRouter()


@router.get("/kpis", response_model=Dict[str, Any])
async def get_procurement_kpis(
    user: dict = Depends(get_current_user),
):
    """
    Get enterprise procurement KPIs partitioned strictly by UOM.
    Never aggregates mixed physical units into a single sum.
    """
    return procurement_repository.get_kpis()


@router.get("/cmm-summary", response_model=Dict[str, Any])
async def list_cmm_summaries(
    search: Optional[str] = Query(None, description="Search term for CMM code, description, or dominant plant"),
    material_family: Optional[str] = Query(None, description="Filter by material family"),
    primary_uom: Optional[str] = Query(None, description="Filter by primary UOM"),
    cpse: Optional[str] = Query(None, description="Filter by consuming CPSE"),
    min_consumption: Optional[int] = Query(None, ge=0, description="Filter by minimum total annual consumption"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    user: dict = Depends(get_current_user),
):
    """
    List Common Material Master procurement summaries with filtering and pagination.
    """
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
