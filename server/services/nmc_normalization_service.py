"""
NMC Normalization Service
Orchestrates Phase 2 (Text Cleaning), Phase 3 (Attribute Extraction), and
Phase 4 (Standardization / Canonicalization) for materials in a CPSE dataset.
Writes results back to the database and maintains the audit trail.
"""

import logging
from typing import Dict, Any, List
import pandas as pd

logger = logging.getLogger(__name__)


def _get_services():
    try:
        from services.normalization_service import NormalizationService
        from services.attribute_extraction_service import AttributeExtractionService
        from services.standardization_service import StandardizationService
    except ImportError:
        from server.services.normalization_service import NormalizationService
        from server.services.attribute_extraction_service import AttributeExtractionService
        from server.services.standardization_service import StandardizationService

    return NormalizationService(), AttributeExtractionService(), StandardizationService()


def _get_repo():
    try:
        from app.db.nmc_repository import nmc_repo
    except ImportError:
        from server.app.db.nmc_repository import nmc_repo
    return nmc_repo


def normalize_dataset_materials(dataset_id: str, cpse_id: str, cpse_code: str) -> Dict[str, Any]:
    """
    Run full normalization pipeline for all materials in a dataset:
    1. Text normalization & abbreviation expansion (Phase 2)
    2. Rule-based engineering attribute extraction (Phase 3)
    3. Canonicalization & standardized description generation (Phase 4)
    4. Database update & audit logging
    """
    repo = _get_repo()
    norm_service, attr_service, std_service = _get_services()

    materials = repo.get_materials_for_dataset(dataset_id)
    if not materials:
        repo.update_dataset_status(dataset_id, "NORMALIZED")
        return {"processed": 0, "status": "NORMALIZED"}

    updates: List[Dict[str, Any]] = []

    for m in materials:
        raw_desc = m.get("original_description") or ""
        norm_desc, _ = norm_service.normalize_description(raw_desc)

        # Attribute extraction input
        row_dict = {
            "Material_Description": raw_desc,
            "Normalized_Description": norm_desc or raw_desc,
            "Material_Code": m.get("original_material_code") or "",
        }
        series = pd.Series(row_dict)
        extracted = attr_service.extract_record(series)

        # Standardization input
        std_input = {
            f"EX_{k}": v for k, v in extracted.items()
            if not k.startswith("_")
            and not k.endswith("__source")
            and not k.endswith("__confidence")
            and not k.endswith("__rule")
        }
        std_res = std_service.standardize_record(std_input)

        standardized_desc = std_res.get("Standardized_Description") or norm_desc or raw_desc
        canon_key = std_res.get("Canonical_Material_Key")

        if canon_key:
            extracted["canonical_key"] = canon_key

        updates.append({
            "id": m["id"],
            "normalized_description": norm_desc or raw_desc,
            "standardized_description": standardized_desc,
            "material_family": extracted.get("material_family") or None,
            "material_type": extracted.get("material_type") or None,
            "grade": extracted.get("material_grade") or None,
            "dimensions": extracted.get("size") or extracted.get("nominal_size") or None,
            "specifications": extracted.get("specification") or extracted.get("standard") or None,
            "uom": extracted.get("unit") or None,
            "attributes": extracted,
        })

    # Bulk update materials in DB
    updated_count = repo.bulk_update_materials_normalized(updates)
    repo.update_dataset_status(dataset_id, "NORMALIZED")

    # Audit log
    repo.create_audit_log(
        actor="System",
        cpse_code=cpse_code,
        action="DATASET_NORMALIZED",
        metadata={
            "dataset_id": dataset_id,
            "materials_count": len(materials),
            "updated_count": updated_count,
        },
    )

    logger.info(
        "Successfully normalized dataset %s (%s) with %d materials",
        dataset_id, cpse_code, updated_count,
    )
    return {
        "processed": updated_count,
        "dataset_id": dataset_id,
        "status": "NORMALIZED",
    }
