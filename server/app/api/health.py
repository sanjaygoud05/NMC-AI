"""
Health check endpoint
"""

from fastapi import APIRouter, status
from datetime import datetime

router = APIRouter()


@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "0.1.0",
    }


@router.api_route("/sync-baseline", methods=["GET", "POST"], status_code=status.HTTP_200_OK)
async def sync_baseline(force: bool = False):
    """
    Triggers automated verification and migration of the 2,200 baseline dataset.
    If force=True, forces complete re-seeding regardless of current count.
    """
    try:
        from services.db_seeder import seed_database_if_empty
    except ImportError:
        from server.services.db_seeder import seed_database_if_empty

    result = seed_database_if_empty(force=force)
    return {
        "status": "success",
        "result": result,
        "timestamp": datetime.utcnow().isoformat(),
    }

