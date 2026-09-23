"""
Health check endpoint for NMC platform.
"""

from fastapi import APIRouter, status
from datetime import datetime, timezone

router = APIRouter()


@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "platform": "NMC — National Material Code Platform",
        "version": "1.0.0",
    }
