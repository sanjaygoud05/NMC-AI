"""
FastAPI Router for Phase 9 Legacy Mapping
Provides endpoints for querying legacy cross-walk mappings, summary statistics,
material code lookup, and reverse lookup by CMM code.
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.dependencies import get_current_user
from app.db.legacy_mapping_repository import legacy_mapping_repository

router = APIRouter()


@router.get("", response_model=Dict[str, Any])
async def list_legacy_mappings(
    search: Optional[str] = Query(None, description="Search term for material code, description, or CMM code"),
    source_cpse: Optional[str] = Query(None, description="Filter by contributing CPSE"),
    cpse: Optional[str] = Query(None, description="Alias for source_cpse"),
    mapping_status: Optional[str] = Query(None, description="Filter by mapping status"),
    status: Optional[str] = Query(None, description="Alias for mapping_status"),
    confidence_semantics: Optional[str] = Query(None, description="Filter by confidence semantics"),
    cmm_code: Optional[str] = Query(None, description="Filter by CMM code"),
    dataset_id: Optional[str] = Query(None, description="Scope by dataset_id"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=10000),
    user: dict = Depends(get_current_user),
):
    """
    List legacy material mappings with filtering, search, and pagination scoped by dataset_id.
    """
    effective_id = (dataset_id or "BASELINE").strip().upper()
    if effective_id == "NONE":
        return {
            "items": [],
            "total": 0,
            "page": page,
            "page_size": page_size,
            "total_pages": 0,
            "dataset_id": "NONE",
            "has_dataset": False,
            "data_available": False,
        }

    if effective_id != "BASELINE":
        from services.dataset_resolver import load_dataset_dataframe
        df = load_dataset_dataframe("legacy_material_mapping.csv", dataset_id=effective_id)
        if df.empty:
            return {
                "items": [],
                "total": 0,
                "page": page,
                "page_size": page_size,
                "total_pages": 0,
                "dataset_id": effective_id,
                "has_dataset": True,
                "data_available": False,
            }

        effective_cpse = cpse or source_cpse
        effective_status = status or mapping_status
        if effective_cpse and effective_cpse != "all":
            df = df[df["source_cpse"].str.upper() == effective_cpse.upper()]
        if effective_status and effective_status != "all":
            df = df[df["mapping_status"] == effective_status]
        if cmm_code:
            df = df[df["cmm_code"] == cmm_code]
        if search:
            s = search.strip().lower()
            mask = (
                df["material_code"].str.lower().str.contains(s, na=False)
                | df["source_description"].str.lower().str.contains(s, na=False)
                | df["cmm_code"].str.lower().str.contains(s, na=False)
            )
            df = df[mask]

        total = len(df)
        total_pages = (total + page_size - 1) // page_size if total > 0 else 0
        start = (page - 1) * page_size
        page_df = df.iloc[start : start + page_size]

        items = []
        for _, r in page_df.iterrows():
            items.append({
                "mapping_id": str(r.get("mapping_id", "")),
                "source_cpse": str(r.get("source_cpse", "")),
                "material_code": str(r.get("material_code", "")),
                "source_description": str(r.get("source_description", "")),
                "cmm_code": str(r.get("cmm_code", "")) or None,
                "cmm_group_id": str(r.get("cmm_group_id", "")) or None,
                "mapping_status": str(r.get("mapping_status", "MAPPED_STANDALONE")),
                "membership_type": str(r.get("membership_type", "STANDALONE")),
                "confidence_score": float(r.get("confidence_score", 1.0)),
                "confidence_semantics": str(r.get("confidence_semantics", "STANDALONE_IDENTITY")),
                "mapping_method": str(r.get("mapping_method", "STANDALONE_IDENTITY")),
                "mapping_reason": str(r.get("mapping_reason", "")),
                "accepted_candidate_id": str(r.get("accepted_candidate_id", "")) or None,
                "phase6_validation_status": str(r.get("phase6_validation_status", "")) or None,
                "phase7_review_decision": str(r.get("phase7_review_decision", "")) or None,
                "evidence_hash": str(r.get("evidence_hash", "")) or None,
                "canonical_material_key": str(r.get("canonical_material_key", "")),
                "created_at": "2026-03-31T00:00:00Z",
                "updated_at": "2026-03-31T00:00:00Z",
            })

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "dataset_id": effective_id,
            "has_dataset": True,
            "data_available": total > 0,
        }

    effective_cpse = cpse or source_cpse
    effective_status = status or mapping_status
    res = legacy_mapping_repository.query_mappings(
        search=search,
        source_cpse=effective_cpse,
        mapping_status=effective_status,
        confidence_semantics=confidence_semantics,
        cmm_code=cmm_code,
        page=page,
        page_size=page_size,
    )
    res["dataset_id"] = "BASELINE"
    res["has_dataset"] = True
    res["data_available"] = res.get("total", 0) > 0
    return res


@router.get("/stats", response_model=Dict[str, Any])
async def get_legacy_mapping_stats(
    dataset_id: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    """
    Get summary statistics and KPI metrics for Legacy Material Mappings.
    """
    effective_id = (dataset_id or "BASELINE").strip().upper()
    if effective_id == "NONE":
        return {
            "total_source_materials": 0,
            "total_mappings": 0,
            "mapped_verified": 0,
            "mapped_standalone": 0,
            "review_required": 0,
            "conflict": 0,
            "unmapped": 0,
            "cpse_distribution": {},
            "mapping_coverage_pct": 0.0,
            "dataset_id": "NONE",
            "has_dataset": False,
            "data_available": False,
        }

    if effective_id != "BASELINE":
        from services.dataset_resolver import load_dataset_dataframe
        df = load_dataset_dataframe("legacy_material_mapping.csv", dataset_id=effective_id)
        total = len(df)
        cpse_dist = df["source_cpse"].value_counts().to_dict() if "source_cpse" in df.columns else {}
        return {
            "total_source_materials": total,
            "total_mappings": total,
            "mapped_verified": 0,
            "mapped_standalone": total,
            "review_required": 0,
            "conflict": 0,
            "unmapped": 0,
            "cpse_distribution": cpse_dist,
            "mapping_coverage_pct": 100.0 if total > 0 else 0.0,
            "dataset_id": effective_id,
            "has_dataset": True,
            "data_available": total > 0,
        }
    stats = legacy_mapping_repository.get_stats()
    stats["dataset_id"] = "BASELINE"
    stats["has_dataset"] = True
    stats["data_available"] = stats.get("total_mappings", 0) > 0
    return stats


@router.get("/by-cmm/{cmm_code}", response_model=List[Dict[str, Any]])
async def get_mappings_by_cmm_code(
    cmm_code: str,
    user: dict = Depends(get_current_user),
):
    """
    List all legacy CPSE materials mapped to a specific Phase 8 Common Material Master code.
    Declared before /{source_cpse}/{material_code} to avoid path collision.
    """
    return legacy_mapping_repository.get_mappings_by_cmm(cmm_code)


@router.get("/{source_cpse}/{material_code}", response_model=Dict[str, Any])
async def get_legacy_mapping_detail(
    source_cpse: str,
    material_code: str,
    user: dict = Depends(get_current_user),
):
    """
    Get single legacy mapping record with full provenance by (source_cpse, material_code).
    """
    rec = legacy_mapping_repository.get_mapping_by_code(source_cpse, material_code)
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Legacy mapping for '{source_cpse}:{material_code}' not found",
        )
    return rec
