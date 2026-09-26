"""
NMC Material Explorer API
Provides search, filtering, and detail endpoints for materials across CPSE datasets.
Read-only: accessible to both Admin and Reviewer.
"""

from typing import Optional, Any
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
    role: Any = Depends(verify_reviewer_access),
):
    """
    Paginated search and filter for materials across all CPSEs.
    Accessible to Admin (full use) and Reviewer (scoped strictly to assigned CPSE).
    """
    if getattr(role, "is_reviewer", False):
        assigned_cpse_id = None
        if getattr(role, "cpse_code", None):
            cpse_obj = nmc_repo.get_cpse_by_code(role.cpse_code)
            if cpse_obj:
                assigned_cpse_id = cpse_obj["id"]
        if not assigned_cpse_id:
            assigned_cpse_id = getattr(role, "cpse_id", None)

        if cpse_id and cpse_id != assigned_cpse_id:
            if role.cpse_code and cpse_id.upper() == role.cpse_code.upper():
                cpse_id = assigned_cpse_id
            else:
                raise HTTPException(
                    status_code=403,
                    detail=f"Access forbidden: Reviewers for {getattr(role, 'cpse_code', 'assigned CPSE')} cannot browse other CPSE datasets."
                )
        cpse_id = assigned_cpse_id

    return nmc_repo.query_materials(
        cpse_id=cpse_id,
        search=search,
        processing_status=processing_status,
        mapping_status=mapping_status,
        page=page,
        page_size=page_size,
    )


@router.get("/{material_id}")
def get_material_detail(material_id: str, role: Any = Depends(verify_reviewer_access)):
    """
    Fetch a single material by ID with full attributes and CPSE details.
    Accessible to Admin (all) and Reviewer (own CPSE or candidate in assigned review case).
    """
    mat = nmc_repo.get_material(material_id)
    if not mat:
        raise HTTPException(status_code=404, detail=f"Material '{material_id}' not found.")

    if getattr(role, "is_reviewer", False):
        assigned_cpse_id = None
        if getattr(role, "cpse_code", None):
            cpse_obj = nmc_repo.get_cpse_by_code(role.cpse_code)
            if cpse_obj:
                assigned_cpse_id = cpse_obj["id"]
        if not assigned_cpse_id:
            assigned_cpse_id = getattr(role, "cpse_id", None)

        if assigned_cpse_id and mat["cpse_id"] != assigned_cpse_id:
            # Check if this foreign material is an AI match candidate in a review case involving reviewer's CPSE
            if not nmc_repo.is_material_in_cpse_review(material_id, assigned_cpse_id):
                raise HTTPException(
                    status_code=403,
                    detail=f"Access denied: Material belongs to another CPSE dataset outside your review authorization scope."
                )

    # Enhance with CPSE info & Enterprise Provenance
    cpse = nmc_repo.get_cpse(mat["cpse_id"])
    if cpse:
        mat["cpse_code"] = cpse["code"]
        mat["cpse_name"] = cpse["name"]
        mat["erp_source"] = nmc_repo._resolve_provenance_source(cpse["code"])
        mat["plant_site"] = nmc_repo._resolve_provenance_plant(cpse["code"])

    return mat
