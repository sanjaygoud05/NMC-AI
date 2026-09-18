"""
Materials API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from app.dependencies import get_current_user

router = APIRouter()


@router.get("/")
async def get_materials(
    skip: int = 0,
    limit: int = 100,
    dataset_id: Optional[str] = None,
    search: Optional[str] = None,
    cpse: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """
    Get materials scoped by dataset_id (NONE, BASELINE, UPLOAD-..., or ALL) with search and filters
    """
    from services.dataset_resolver import load_dataset_dataframe

    effective_id = (dataset_id or "NONE").strip().upper()
    has_dataset = effective_id not in ["", "NONE"]

    if not has_dataset:
        return {
            "materials": [],
            "total": 0,
            "skip": skip,
            "limit": limit,
            "dataset_id": "NONE",
            "has_dataset": False,
            "data_available": False,
        }

    df = load_dataset_dataframe("standardized_materials.csv", dataset_id=effective_id)
    if df.empty:
        return {
            "materials": [],
            "total": 0,
            "skip": skip,
            "limit": limit,
            "dataset_id": effective_id,
            "has_dataset": True,
            "data_available": False,
        }

    # Filter by CPSE
    if cpse and cpse.lower() != "all":
        df = df[df["CPSE"].str.upper() == cpse.upper()]

    # Filter by Category
    if category and category.lower() != "all":
        df = df[df["Material_Category"].str.upper() == category.upper()]

    # Filter by Status
    if status and status.lower() != "all":
        if "Material_Status" in df.columns:
            df = df[df["Material_Status"].astype(str).str.upper() == status.upper()]

    # Filter by search
    if search:
        s = search.strip().lower()
        mask = (
            df["Material_Code"].str.lower().str.contains(s, na=False)
            | df["Material_Description"].str.lower().str.contains(s, na=False)
            | df["Standardized_Description"].str.lower().str.contains(s, na=False)
            | df["CPSE"].str.lower().str.contains(s, na=False)
        )
        df = df[mask]

    total = len(df)
    page_df = df.iloc[skip : skip + limit]

    materials_list = []
    for _, r in page_df.iterrows():
        code = str(r.get("Material_Code", ""))
        cpse_val = str(r.get("CPSE", ""))
        ds_val = str(r.get("dataset_id", effective_id))
        m_id = f"{ds_val}:{cpse_val}:{code}"

        materials_list.append({
            "id": m_id,
            "material_code": code,
            "materialCode": code,  # Legacy compatibility
            "cpse": cpse_val,
            "cpseId": cpse_val,  # Legacy compatibility
            "dataset_id": ds_val,
            "datasetId": ds_val,  # Legacy compatibility
            "description": str(r.get("Material_Description", "")),
            "normalized_description": str(r.get("Normalized_Description", "")),
            "normalizedDescription": str(r.get("Normalized_Description", "")),  # Legacy compatibility
            "standardized_description": str(r.get("Standardized_Description", "")),
            "standardizedDescription": str(r.get("Standardized_Description", "")),  # Legacy compatibility
            "category": str(r.get("Material_Category", "")),
            "material_type": str(r.get("Material_Type", "")),
            "materialType": str(r.get("Material_Type", "")),  # Legacy compatibility
            "unit_of_measure": str(r.get("Unit", "")),
            "unit": str(r.get("Unit", "")),  # Legacy compatibility
            "manufacturer": str(r.get("Manufacturer", "")),
            "standardization_status": "standardized",
            "standardizationStatus": "standardized",  # Legacy compatibility
            "match_status": "pending",
            "matchStatus": "pending",  # Legacy compatibility
            "confidence_score": 0.95,
            "confidenceScore": 0.95,  # Legacy compatibility
            "created_at": "2026-03-31T00:00:00Z",
            "createdAt": "2026-03-31T00:00:00Z",  # Legacy compatibility
            "updated_at": "2026-03-31T00:00:00Z",
            "updatedAt": "2026-03-31T00:00:00Z",  # Legacy compatibility
        })

    return {
        "materials": materials_list,
        "total": total,
        "skip": skip,
        "limit": limit,
        "dataset_id": effective_id,
        "has_dataset": True,
        "data_available": total > 0,
    }


@router.get("/{material_id:path}")
async def get_material(
    material_id: str,
    dataset_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """
    Get single material details by compound ID (dataset_id:cpse:code) or direct Material_Code
    """
    from services.dataset_resolver import load_dataset_dataframe

    # Extract target code and optional dataset from compound ID
    target_code = material_id
    eff_dataset = dataset_id
    if ":" in material_id:
        parts = material_id.split(":")
        if len(parts) == 3:
            eff_dataset, _, target_code = parts
        elif len(parts) == 2:
            eff_dataset, target_code = parts

    df = load_dataset_dataframe("standardized_materials.csv", dataset_id=eff_dataset)
    match = df[df["Material_Code"] == target_code]
    if match.empty:
        raise HTTPException(status_code=404, detail=f"Material '{target_code}' not found")

    r = match.iloc[0]
    return {
        "id": material_id,
        "material_code": str(r.get("Material_Code", "")),
        "materialCode": str(r.get("Material_Code", "")),  # Legacy compatibility
        "cpse": str(r.get("CPSE", "")),
        "cpseId": str(r.get("CPSE", "")),  # Legacy compatibility
        "dataset_id": str(r.get("dataset_id", eff_dataset or "BASELINE")),
        "datasetId": str(r.get("dataset_id", eff_dataset or "BASELINE")),  # Legacy compatibility
        "description": str(r.get("Material_Description", "")),
        "normalized_description": str(r.get("Normalized_Description", "")),
        "normalizedDescription": str(r.get("Normalized_Description", "")),  # Legacy compatibility
        "standardized_description": str(r.get("Standardized_Description", "")),
        "standardizedDescription": str(r.get("Standardized_Description", "")),  # Legacy compatibility
        "category": str(r.get("Material_Category", "")),
        "material_type": str(r.get("Material_Type", "")),
        "materialType": str(r.get("Material_Type", "")),  # Legacy compatibility
        "unit_of_measure": str(r.get("Unit", "")),
        "unit": str(r.get("Unit", "")),  # Legacy compatibility
        "manufacturer": str(r.get("Manufacturer", "")),
        "standardization_status": "standardized",
        "standardizationStatus": "standardized",  # Legacy compatibility
        "match_status": "pending",
        "matchStatus": "pending",  # Legacy compatibility
        "confidence_score": 0.95,
        "confidenceScore": 0.95,  # Legacy compatibility
        "attributes": {
            "size": str(r.get("Canonical_Size", "")),
            "grade": str(r.get("Canonical_Material_Grade", "")),
            "spec": str(r.get("Canonical_Standard", "")),
        },
        "created_at": "2026-03-31T00:00:00Z",
        "createdAt": "2026-03-31T00:00:00Z",  # Legacy compatibility
        "updated_at": "2026-03-31T00:00:00Z",
        "updatedAt": "2026-03-31T00:00:00Z",  # Legacy compatibility
    }


@router.put("/{material_id}")
async def update_material(
    material_id: str,
    material_data: dict,
    current_user: dict = Depends(get_current_user),
):
    """
    Update material
    """
    # TODO: Implement actual material update
    return {
        "id": material_id,
        "message": "Material update coming soon",
    }


@router.delete("/{material_id}")
async def delete_material(
    material_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Delete material
    """
    # TODO: Implement actual material deletion
    return {
        "id": material_id,
        "message": "Material deletion coming soon",
    }


@router.get("/common/list")
async def get_common_materials(
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(get_current_user),
):
    """
    Get common materials from master
    """
    # TODO: Implement actual common materials retrieval
    return {
        "common_materials": [],
        "total": 0,
        "skip": skip,
        "limit": limit,
    }


@router.get("/common/{common_code}")
async def get_common_material(
    common_code: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Get common material by code
    """
    # TODO: Implement actual common material retrieval
    return {
        "common_code": common_code,
        "message": "Common material details coming soon",
    }
