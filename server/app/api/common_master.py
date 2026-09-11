"""
FastAPI Router for Phase 8 Common Material Master
Provides endpoints for catalog querying, stats, detailed provenance, and human governance actions.
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.dependencies import get_current_user, require_reviewer
from app.db.common_master_repository import common_master_repository

router = APIRouter()


class GovernanceUpdateRequest(BaseModel):
    """Payload for updating governance status on a Common Material Master record"""
    new_status: str = Field(..., description="Target governance status (e.g. APPROVED_MASTER, SPLIT_CONFLICT)")
    rationale: str = Field(..., min_length=10, description="Mandatory justification for governance decision")


@router.get("", response_model=Dict[str, Any])
async def list_common_materials(
    search: Optional[str] = Query(None, description="Search term for code, description, or family"),
    family: Optional[str] = Query(None, description="Filter by material family"),
    governance_status: Optional[str] = Query(None, description="Filter by governance status"),
    cpse: Optional[str] = Query(None, description="Filter by participating CPSE"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    """
    List Common Material Master records with filtering, search, and pagination.
    """
    return common_master_repository.query_common_materials(
        search=search,
        family=family,
        governance_status=governance_status,
        cpse=cpse,
        page=page,
        page_size=page_size,
    )


@router.get("/stats", response_model=Dict[str, Any])
async def get_common_master_stats(
    user: dict = Depends(get_current_user),
):
    """
    Get summary statistics and KPI metrics for the Common Material Master catalog.
    """
    return common_master_repository.get_stats()


@router.get("/{common_id}", response_model=Dict[str, Any])
async def get_common_material_detail(
    common_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Get complete detail and member provenance mapping for a single Common Material record.
    """
    record = common_master_repository.get_common_material(common_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Common Material Master record '{common_id}' not found",
        )
    return record


@router.post("/{common_id}/governance", response_model=Dict[str, Any])
async def update_governance_status(
    common_id: str,
    request: GovernanceUpdateRequest,
    user: dict = Depends(require_reviewer),
):
    """
    Explicit human governance sign-off or status update.
    Requires 'reviewer' or 'admin' role. Viewers are strictly rejected.
    """
    allowed_statuses = [
        "APPROVED_MASTER",
        "VERIFIED_HARMONIZED",
        "AMBIGUOUS_REVIEW_REQUIRED",
        "SPLIT_CONFLICT",
    ]
    if request.new_status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid governance status '{request.new_status}'. Allowed: {', '.join(allowed_statuses)}",
        )

    reviewer_email = user.get("email") or user.get("id", "unknown_reviewer")

    try:
        updated = common_master_repository.update_governance_status(
            common_material_id=common_id,
            new_status=request.new_status,
            approved_by=reviewer_email,
            rationale=request.rationale,
        )
        return updated
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
