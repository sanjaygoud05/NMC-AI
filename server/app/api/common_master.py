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
    dataset_id: Optional[str] = Query(None, description="Scope by dataset_id (BASELINE, UPLOAD-..., ALL)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    """
    List Common Material Master records with filtering, search, pagination, and dataset scoping.
    """
    if dataset_id and dataset_id.upper() not in ["", "BASELINE"]:
        from server.services.dataset_resolver import load_dataset_dataframe
        import json

        df = load_dataset_dataframe("common_material_master.csv", dataset_id=dataset_id)
        if df.empty:
            return {"items": [], "total": 0, "page": page, "page_size": page_size, "total_pages": 0}

        if family and family != "all":
            df = df[df["material_family"].str.upper() == family.upper()]
        if governance_status and governance_status != "all":
            df = df[df["governance_status"] == governance_status]
        if cpse and cpse != "all":
            df = df[df["cpse_coverage"].str.contains(cpse, case=False, na=False)]
        if search:
            s = search.strip().lower()
            mask = (
                df["common_code"].str.lower().str.contains(s, na=False)
                | df["common_description"].str.lower().str.contains(s, na=False)
                | df["material_family"].str.lower().str.contains(s, na=False)
            )
            df = df[mask]

        total = len(df)
        total_pages = (total + page_size - 1) // page_size if total > 0 else 0
        start = (page - 1) * page_size
        page_df = df.iloc[start : start + page_size]

        items = []
        for _, r in page_df.iterrows():
            c_attrs = {}
            raw_attrs = r.get("consolidated_attributes", "{}")
            if isinstance(raw_attrs, str):
                try:
                    c_attrs = json.loads(raw_attrs)
                except Exception:
                    c_attrs = {}
            elif isinstance(raw_attrs, dict):
                c_attrs = raw_attrs

            cov = r.get("cpse_coverage", "")
            cov_list = cov.split(";") if isinstance(cov, str) else []

            items.append({
                "common_material_id": str(r.get("common_material_id", "")),
                "common_code": str(r.get("common_code", "")),
                "common_description": str(r.get("common_description", "")),
                "material_family": str(r.get("material_family", "")),
                "material_type": str(r.get("material_type", "")),
                "material_grade": str(r.get("material_grade", "")),
                "nominal_size": str(r.get("nominal_size", "")),
                "pressure_rating": str(r.get("pressure_rating", "")),
                "standard_spec": str(r.get("standard_spec", "")),
                "unit_of_measure": str(r.get("unit_of_measure", "")),
                "consolidated_attributes": c_attrs,
                "cpse_coverage": cov_list,
                "member_count": int(r.get("member_count", 1)),
                "governance_status": str(r.get("governance_status", "STANDALONE_CANDIDATE")),
                "group_confidence": float(r.get("group_confidence", 1.0)),
                "group_identity_hash": str(r.get("group_identity_hash", "")),
                "approved_by": None,
                "approved_at": None,
                "approval_rationale": None,
                "created_at": "2026-03-31T00:00:00Z",
                "updated_at": "2026-03-31T00:00:00Z",
                "members": [],
            })

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        }

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
    dataset_id: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    """
    Get summary statistics and KPI metrics for the Common Material Master catalog.
    """
    if dataset_id and dataset_id.upper() not in ["", "BASELINE"]:
        from server.services.dataset_resolver import load_dataset_dataframe
        df = load_dataset_dataframe("common_material_master.csv", dataset_id=dataset_id)
        total_records = len(df)
        return {
            "total_common_materials": total_records,
            "verified_harmonized_count": 0,
            "standalone_count": total_records,
            "approved_master_count": 0,
            "review_required_count": 0,
            "total_source_members": total_records,
            "coverage_stats": {
                "single_cpse_count": total_records,
                "multi_cpse_count": 0,
            },
            "family_distribution": df["material_family"].value_counts().to_dict() if not df.empty and "material_family" in df.columns else {},
        }
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
