"""
NMC Audit Trail API
Provides queryable audit trail endpoints for all platform actions.
Accessible to both Admin and Reviewer (read-only).
"""

from typing import Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from app.db.nmc_repository import nmc_repo
from app.api.nmc_auth import verify_reviewer_access

router = APIRouter(prefix="/api/nmc/audit", tags=["NMC Audit"])


@router.get("")
def list_audit_logs(
    cpse_code: Optional[str] = Query(None, description="Filter by CPSE code"),
    action: Optional[str] = Query(None, description="Filter by action name"),
    actor: Optional[str] = Query(None, description="Filter by actor (Admin, System, Reviewer)"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    search: Optional[str] = Query(None, description="Filter by UUID, material, actor or keyword"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    role: Any = Depends(verify_reviewer_access),
):
    """
    Query append-only audit trail logs with filtering and pagination.
    Accessible to Admin (all) and Reviewer (scoped to assigned CPSE).
    """
    if getattr(role, "is_reviewer", False):
        assigned_cpse = getattr(role, "cpse_code", None)
        if assigned_cpse:
            if cpse_code and cpse_code.upper() != assigned_cpse.upper():
                raise HTTPException(
                    status_code=403,
                    detail=f"Access forbidden: Reviewers for {assigned_cpse} cannot view audit logs of other CPSEs."
                )
            cpse_code = assigned_cpse

    return nmc_repo.query_audit_logs(
        cpse_code=cpse_code,
        action=action,
        actor=actor,
        entity_type=entity_type,
        search=search,
        page=page,
        page_size=page_size,
    )

