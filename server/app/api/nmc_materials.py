"""
NMC Material Explorer API
Provides search, filtering, and detail endpoints for materials across CPSE datasets.
Read-only: accessible to both Admin and Reviewer.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from app.db.nmc_repository import nmc_repo
from app.api.nmc_auth import verify_reviewer_access

router = APIRouter(prefix="/api/nmc/materials", tags=["NMC Materials"])


@router.get("")
def list_materials(
    cpse_id: Optional[str] = Query(None, description="Filter by CPSE ID"),
    search: Optional[str] = Query(None, description="Search by description or material code"),
    processing_status: Optional[str] = Query(None, description="Filter by processing status"),
    mapping_status: Optional[str] = Query(None, description="Filter by mapping status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    role: str = Depends(verify_reviewer_access),
):
    """
    Paginated search and filter for materials across all CPSEs.
    Accessible to Admin (full use) and Reviewer (read-only view).
    """
    return nmc_repo.query_materials(
        cpse_id=cpse_id,
        search=search,
        processing_status=processing_status,
        mapping_status=mapping_status,
        page=page,
        page_size=page_size,
    )


@router.get("/{material_id}")
def get_material_detail(material_id: str, role: str = Depends(verify_reviewer_access)):
    """
    Fetch a single material by ID with full attributes and CPSE details.
    Accessible to Admin and Reviewer.
    """
    mat = nmc_repo.get_material(material_id)
    if not mat:
        raise HTTPException(status_code=404, detail=f"Material '{material_id}' not found.")

    # Enhance with CPSE info
    cpse = nmc_repo.get_cpse(mat["cpse_id"])
    if cpse:
        mat["cpse_code"] = cpse["code"]
        mat["cpse_name"] = cpse["name"]

    return mat
