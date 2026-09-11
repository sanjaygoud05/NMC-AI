"""
FastAPI Router for Phase 9 Legacy Mapping
Provides endpoints for querying legacy cross-walk mappings, summary statistics,
material code lookup, and reverse lookup by CMM code.
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.dependencies import get_current_user
from app.db.legacy_mapping_repository import legacy_mapping_repository

router = APIRouter()


@router.get("", response_model=Dict[str, Any])
async def list_legacy_mappings(
    search: Optional[str] = Query(None, description="Search term for material code, description, or CMM code"),
    source_cpse: Optional[str] = Query(None, description="Filter by contributing CPSE"),
    cpse: Optional[str] = Query(None, description="Alias for source_cpse"),
    mapping_status: Optional[str] = Query(None, description="Filter by mapping status"),
    status: Optional[str] = Query(None, description="Alias for mapping_status"),
    confidence_semantics: Optional[str] = Query(None, description="Filter by confidence semantics"),
    cmm_code: Optional[str] = Query(None, description="Filter by CMM code"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    user: dict = Depends(get_current_user),
):
    """
    List legacy material mappings with filtering, search, and pagination.
    """
    effective_cpse = cpse or source_cpse
    effective_status = status or mapping_status
    return legacy_mapping_repository.query_mappings(
        search=search,
        source_cpse=effective_cpse,
        mapping_status=effective_status,
        confidence_semantics=confidence_semantics,
        cmm_code=cmm_code,
        page=page,
        page_size=page_size,
    )


@router.get("/stats", response_model=Dict[str, Any])
async def get_legacy_mapping_stats(
    user: dict = Depends(get_current_user),
):
    """
    Get summary statistics and KPI metrics for Legacy Material Mappings.
    """
    return legacy_mapping_repository.get_stats()


@router.get("/by-cmm/{cmm_code}", response_model=List[Dict[str, Any]])
async def get_mappings_by_cmm_code(
    cmm_code: str,
    user: dict = Depends(get_current_user),
):
    """
    List all legacy CPSE materials mapped to a specific Phase 8 Common Material Master code.
    Declared before /{source_cpse}/{material_code} to avoid path collision.
    """
    return legacy_mapping_repository.get_mappings_by_cmm(cmm_code)


@router.get("/{source_cpse}/{material_code}", response_model=Dict[str, Any])
async def get_legacy_mapping_detail(
    source_cpse: str,
    material_code: str,
    user: dict = Depends(get_current_user),
):
    """
    Get single legacy mapping record with full provenance by (source_cpse, material_code).
    """
    rec = legacy_mapping_repository.get_mapping_by_code(source_cpse, material_code)
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Legacy mapping for '{source_cpse}:{material_code}' not found",
        )
    return rec
