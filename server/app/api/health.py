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
