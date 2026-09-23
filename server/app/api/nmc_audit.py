"""
NMC Audit Trail API
Provides queryable audit trail endpoints for all platform actions.
Accessible to both Admin and Reviewer (read-only).
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from app.db.nmc_repository import nmc_repo
from app.api.nmc_auth import verify_reviewer_access

router = APIRouter(prefix="/api/nmc/audit", tags=["NMC Audit"])


@router.get("")
def list_audit_logs(
    cpse_code: Optional[str] = Query(None, description="Filter by CPSE code"),
    action: Optional[str] = Query(None, description="Filter by action name"),
    actor: Optional[str] = Query(None, description="Filter by actor (Admin, System, Reviewer)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    role: str = Depends(verify_reviewer_access),
):
    """
    Query append-only audit trail logs with filtering and pagination.
    Accessible to Admin and Reviewer.
    """
    return nmc_repo.query_audit_logs(
        cpse_code=cpse_code,
        action=action,
        actor=actor,
        page=page,
        page_size=page_size,
    )
