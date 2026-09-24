"""
NMC — National Material Code Platform
FastAPI Backend Main Application Entry Point
"""

import os
import sys

_server_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_root_dir = os.path.abspath(os.path.join(_server_dir, ".."))
for _p in [_root_dir, _server_dir]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

# Import NMC routers
from app.api import (
    health,
    nmc_auth,
    cpse,
    nmc_materials,
    nmc_matching,
    nmc_review,
    nmc_cmm,
    nmc_analytics,
    nmc_audit,
    nmc_procurement,
)

app = FastAPI(
    title="NMC — National Material Code Platform API",
    description="AI-Driven Standardization and Harmonization of Material Codes Across CPSEs",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

allowed_origins = list(settings.cors_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register health check
app.include_router(health.router, prefix="/api", tags=["Health"])

# Register NMC platform routers
app.include_router(nmc_auth.router, prefix="/api/nmc/auth", tags=["NMC Auth"])
app.include_router(cpse.router, prefix="/api/nmc/cpses", tags=["NMC CPSE"])
app.include_router(nmc_materials.router)
app.include_router(nmc_matching.router)
app.include_router(nmc_review.router)
app.include_router(nmc_cmm.router)
app.include_router(nmc_analytics.router)
app.include_router(nmc_audit.router)
app.include_router(nmc_procurement.router)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "NMC — National Material Code Platform API",
        "version": "1.0.0",
        "status": "active",
        "docs": "/api/docs",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
