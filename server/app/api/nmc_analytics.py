"""
NMC Analytics API
Provides real database-backed KPIs, CPSE progress statistics, and harmonization metrics.
No hardcoded stats.
Accessible to both Admin and Reviewer (read-only).
"""

from fastapi import APIRouter, Depends
from app.db.nmc_repository import nmc_repo
from app.api.nmc_auth import verify_reviewer_access

router = APIRouter(prefix="/api/nmc/analytics", tags=["NMC Analytics"])


@router.get("/dashboard")
def get_dashboard_metrics(role: str = Depends(verify_reviewer_access)):
    """
    Returns platform-wide KPIs:
    - Total CPSEs
    - Total Materials
    - Normalized count & percentage
    - Matches found (pending, accepted, rejected, different)
    - CMM records created
    Accessible to Admin and Reviewer.
    """
    return nmc_repo.get_dashboard_kpis()


@router.get("/cpses")
def get_cpse_analytics(role: str = Depends(verify_reviewer_access)):
    """
    Returns per-CPSE metrics:
    - Total materials uploaded
    - Normalization status
    - Mapped materials count
    Accessible to Admin and Reviewer.
    """
    return nmc_repo.get_cpse_analytics()


@router.get("/match-stats")
def get_match_stats(role: str = Depends(verify_reviewer_access)):
    """
    Returns match breakdown by status:
    - Total, pending, accepted, rejected, different
    Used for pie/donut charts on the analytics page.
    """
    return nmc_repo.get_match_stats()
