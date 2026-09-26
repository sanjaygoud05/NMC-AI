"""
NMC Common Material Master (CMM) API
Endpoints for exploring harmonized material master records and national material codes.
Accessible to both Admin and Reviewer (read-only).
"""

from typing import Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from app.db.nmc_repository import nmc_repo
from app.api.nmc_auth import verify_reviewer_access

router = APIRouter(prefix="/api/nmc/cmm", tags=["NMC CMM"])


@router.get("")
def list_cmm_records(
    search: Optional[str] = Query(None, description="Search by NMC code or description"),
    material_family: Optional[str] = Query(None, description="Filter by material family"),
    cpse_code: Optional[str] = Query(None, description="Filter by CPSE enterprise code"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    role: Any = Depends(verify_reviewer_access),
):
    """
    Search and filter Common Material Master records.
    Accessible to Admin (all records) and Reviewer (records involving their CPSE).
    """
    if getattr(role, "is_reviewer", False):
        assigned_cpse = getattr(role, "cpse_code", None)
        if assigned_cpse:
            if cpse_code and cpse_code.upper() != assigned_cpse.upper():
                raise HTTPException(
                    status_code=403,
                    detail=f"Access forbidden: Reviewers for {assigned_cpse} cannot browse CMM mappings of other CPSEs."
                )
            cpse_code = assigned_cpse

    return nmc_repo.query_cmm(
        search=search,
        material_family=material_family,
        cpse_code=cpse_code,
        page=page,
        page_size=page_size,
    )


@router.get("/{cmm_id}")
def get_cmm_detail(cmm_id: str, role: Any = Depends(verify_reviewer_access)):
    """
    Fetch a single Common Material Master record including its mapped CPSE materials.
    Accessible to Admin (all) and Reviewer (if relevant to their CPSE).
    """
    cmm = nmc_repo.get_cmm(cmm_id)
    if not cmm:
        raise HTTPException(status_code=404, detail=f"Common Material Master record '{cmm_id}' not found.")

    if getattr(role, "is_reviewer", False):
        assigned_cpse = getattr(role, "cpse_code", None)
        if assigned_cpse:
            source_cpses = [c.upper() for c in (cmm.get("source_cpses") or [])]
            mapped_materials = cmm.get("mapped_materials") or []
            involved_cpses = set(source_cpses)
            for m in mapped_materials:
                if m.get("cpse_code"):
                    involved_cpses.add(m["cpse_code"].upper())
            if assigned_cpse.upper() not in involved_cpses:
                raise HTTPException(
                    status_code=403,
                    detail=f"Access denied: CMM record '{cmm.get('national_material_code')}' has no active mappings for {assigned_cpse}."
                )

    return cmm
