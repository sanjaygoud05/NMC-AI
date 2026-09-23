"""
NMC Common Material Master (CMM) API
Endpoints for exploring harmonized material master records and national material codes.
Accessible to both Admin and Reviewer (read-only).
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from app.db.nmc_repository import nmc_repo
from app.api.nmc_auth import verify_reviewer_access

router = APIRouter(prefix="/api/nmc/cmm", tags=["NMC CMM"])


@router.get("")
def list_cmm_records(
    search: Optional[str] = Query(None, description="Search by NMC code or description"),
    material_family: Optional[str] = Query(None, description="Filter by material family"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    role: str = Depends(verify_reviewer_access),
):
    """
    Search and filter Common Material Master records.
    Accessible to Admin and Reviewer.
    """
    return nmc_repo.query_cmm(
        search=search,
        material_family=material_family,
        page=page,
        page_size=page_size,
    )


@router.get("/{cmm_id}")
def get_cmm_detail(cmm_id: str, role: str = Depends(verify_reviewer_access)):
    """
    Fetch a single Common Material Master record including its mapped CPSE materials.
    Accessible to Admin and Reviewer.
    """
    cmm = nmc_repo.get_cmm(cmm_id)
    if not cmm:
        raise HTTPException(status_code=404, detail=f"Common Material Master record '{cmm_id}' not found.")
    return cmm
