"""
SIH26099 Material Harmonization Platform - FastAPI Backend
Main application entry point
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
from app.api import health, materials, matches, review, analytics, ingestion, standardization, common_master, legacy_mapping, procurement

# Create FastAPI application
app = FastAPI(
    title="SIH26099 Material Harmonization API",
    description="AI-Driven Standardization and Harmonization of Material Codes Across CPSEs",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# Configure CORS to accept local dev and any deployed cloud frontend (Vercel, Railway, Render)
allowed_origins = list(settings.cors_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(materials.router, prefix="/api/materials", tags=["Materials"])
app.include_router(matches.router, prefix="/api/matches", tags=["Matches"])
app.include_router(review.router, prefix="/api/review", tags=["Review"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(ingestion.router, prefix="/api/ingest", tags=["Ingestion"])
app.include_router(standardization.router, prefix="/api/standardization", tags=["Standardization"])
app.include_router(common_master.router, prefix="/api/common-master", tags=["Common Master"])
app.include_router(legacy_mapping.router, prefix="/api/legacy-mapping", tags=["Legacy Mapping"])
app.include_router(procurement.router, prefix="/api/procurement", tags=["Procurement"])


@app.on_event("startup")
async def startup_event():
    """Run database seeder if tables are empty on deployment/startup"""
    try:
        try:
            from services.db_seeder import seed_database_if_empty
        except ImportError:
            from server.services.db_seeder import seed_database_if_empty
        seed_database_if_empty()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Startup seeder warning: {e}")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "SIH26099 Material Harmonization API",
        "version": "0.1.0",
        "status": "active",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
