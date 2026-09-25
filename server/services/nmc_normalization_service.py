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


import os
import glob
from pathlib import Path

def _find_field_alias(cols, aliases):
    norm_aliases = [a.lower().replace("_", "").replace(" ", "").replace("-", "") for a in aliases]
    for c in cols:
        if c.lower().replace("_", "").replace(" ", "").replace("-", "") in norm_aliases:
            return c
    return None


def normalize_dataset_materials(dataset_id: str, cpse_id: str, cpse_code: str) -> Dict[str, Any]:
    """
    Run full normalization pipeline for all materials in a dataset:
    1. Look up original dataset file to recover all structured columns
    2. Text normalization & abbreviation expansion (Phase 2)
    3. Rule-based engineering attribute extraction (Phase 3) with full structured columns
    4. Canonicalization & standardized description generation (Phase 4)
    5. Database update for grade, specifications, uom, dimensions, family, type & audit logging
    """
    repo = _get_repo()
    norm_service, attr_service, std_service = _get_services()

    materials = repo.get_materials_for_dataset(dataset_id)
    if not materials:
        repo.update_dataset_status(dataset_id, "NORMALIZED")
        return {"processed": 0, "status": "NORMALIZED"}

    # ── Attempt to load source dataset file to get complete raw columns ───────
    ds = repo.get_dataset(dataset_id)
    raw_df_by_code: Dict[str, Dict[str, str]] = {}
    raw_df_by_desc: Dict[str, Dict[str, str]] = {}

    if ds and ds.get("file_name"):
        fname = ds["file_name"]
        candidate_paths = [
            Path("data/uploads") / cpse_code / fname,
            Path("server/data/uploads") / cpse_code / fname,
            Path("data/uploads") / fname,
            Path("server/data/uploads") / fname,
            Path("data/raw") / fname,
            Path("server/data/raw") / fname,
        ]
        for matched in glob.glob(f"**/{fname}", recursive=True):
            p = Path(matched)
            if p not in candidate_paths and p.is_file():
                candidate_paths.append(p)

        for p in candidate_paths:
            if p.exists() and p.is_file():
                try:
                    ext = p.suffix.lower()
                    if ext == ".csv":
                        df_raw = pd.read_csv(p, dtype=str)
                    else:
                        df_raw = pd.read_excel(p, dtype=str)
                    df_raw.fillna("", inplace=True)

                    c_code = _find_field_alias(df_raw.columns, ["material_code", "mat_code", "code", "item_code"])
                    c_desc = _find_field_alias(df_raw.columns, ["description", "material_description", "desc", "short_text"])
                    c_grade = _find_field_alias(df_raw.columns, ["material_grade", "grade", "materialgrade", "mat_grade", "item_grade"])
                    c_spec = _find_field_alias(df_raw.columns, ["specification", "specifications", "specification_standard", "spec_standard", "standard", "standards", "spec", "industry_standard"])
                    c_size = _find_field_alias(df_raw.columns, ["size", "dimensions", "dimension", "nominal_size", "dimensions_size", "dim", "item_size"])
                    c_cat = _find_field_alias(df_raw.columns, ["material_category", "category", "material_family", "family", "mat_category", "mat_family", "item_category"])
                    c_type = _find_field_alias(df_raw.columns, ["material_type", "type", "materialtype", "mat_type", "item_type"])
                    c_uom = _find_field_alias(df_raw.columns, ["unit", "uom", "unit_of_measure", "base_unit", "unit_measure", "primary_uom", "item_uom"])
                    c_coat = _find_field_alias(df_raw.columns, ["coating", "coat", "surface_finish"])
                    c_len = _find_field_alias(df_raw.columns, ["length", "len"])
                    c_diam = _find_field_alias(df_raw.columns, ["diameter", "dia"])
                    c_mfg = _find_field_alias(df_raw.columns, ["manufacturer", "supplier", "vendor", "supplier_name", "oem"])
                    c_part = _find_field_alias(df_raw.columns, ["manufacturer_part_no", "part_no", "part_number", "partno", "model_number"])

                    for _, r in df_raw.iterrows():
                        r_dict = {
                            "Material_Grade": str(r.get(c_grade, "")).strip() if c_grade else "",
                            "Specification": str(r.get(c_spec, "")).strip() if c_spec else "",
                            "Size": str(r.get(c_size, "")).strip() if c_size else "",
                            "Unit": str(r.get(c_uom, "")).strip() if c_uom else "",
                            "Material_Category": str(r.get(c_cat, "")).strip() if c_cat else "",
                            "Material_Type": str(r.get(c_type, "")).strip() if c_type else "",
                            "Coating": str(r.get(c_coat, "")).strip() if c_coat else "",
                            "Length": str(r.get(c_len, "")).strip() if c_len else "",
                            "Diameter": str(r.get(c_diam, "")).strip() if c_diam else "",
                            "Manufacturer": str(r.get(c_mfg, "")).strip() if c_mfg else "",
                            "Manufacturer_Part_No": str(r.get(c_part, "")).strip() if c_part else "",
                        }
                        for k, v in list(r_dict.items()):
                            if not v or v.lower() in ("nan", "none", "null"):
                                r_dict[k] = ""

                        if c_code and str(r.get(c_code, "")).strip():
                            raw_df_by_code[str(r.get(c_code, "")).strip()] = r_dict
                        if c_desc and str(r.get(c_desc, "")).strip():
                            raw_df_by_desc[str(r.get(c_desc, "")).strip().lower()] = r_dict
                    break
                except Exception as ex:
                    logger.warning("Could not parse dataset file %s: %s", p, ex)

    def _clean_val(*candidates):
        for c in candidates:
            if c is not None:
                s = str(c).strip()
                if s and s.lower() not in ("nan", "none", "null"):
                    return s
        return ""

    updates: List[Dict[str, Any]] = []

    for m in materials:
        mat_code = (m.get("original_material_code") or "").strip()
        raw_desc = (m.get("original_description") or "").strip()
        norm_desc, _ = norm_service.normalize_description(raw_desc)

        file_attrs = raw_df_by_code.get(mat_code) or raw_df_by_desc.get(raw_desc.lower()) or {}
        existing_attrs = m.get("attributes") or {}
        if not isinstance(existing_attrs, dict):
            try:
                import json
                existing_attrs = json.loads(existing_attrs) if existing_attrs else {}
            except Exception:
                existing_attrs = {}

        grade_val = _clean_val(file_attrs.get("Material_Grade"), existing_attrs.get("Material_Grade"), existing_attrs.get("material_grade"), m.get("grade"))
        spec_val = _clean_val(file_attrs.get("Specification"), existing_attrs.get("Specification"), existing_attrs.get("specification"), existing_attrs.get("standard"), m.get("specifications"))
        size_val = _clean_val(file_attrs.get("Size"), existing_attrs.get("Size"), existing_attrs.get("size"), existing_attrs.get("nominal_size"), m.get("dimensions"))
        unit_val = _clean_val(file_attrs.get("Unit"), existing_attrs.get("Unit"), existing_attrs.get("unit"), m.get("uom"))
        cat_val = _clean_val(file_attrs.get("Material_Category"), existing_attrs.get("Material_Category"), existing_attrs.get("material_family"), m.get("material_family"))
        type_val = _clean_val(file_attrs.get("Material_Type"), existing_attrs.get("Material_Type"), existing_attrs.get("material_type"), m.get("material_type"))
        len_val = _clean_val(file_attrs.get("Length"), existing_attrs.get("Length"), existing_attrs.get("length"))
        diam_val = _clean_val(file_attrs.get("Diameter"), existing_attrs.get("Diameter"), existing_attrs.get("diameter"))
        coat_val = _clean_val(file_attrs.get("Coating"), existing_attrs.get("Coating"), existing_attrs.get("coating"))
        mfg_val = _clean_val(file_attrs.get("Manufacturer"), existing_attrs.get("Manufacturer"), existing_attrs.get("manufacturer"))
        pn_val = _clean_val(file_attrs.get("Manufacturer_Part_No"), existing_attrs.get("Manufacturer_Part_No"), existing_attrs.get("manufacturer_part_no"))

        # Attribute extraction input with all structured fields
        row_dict = {
            "Material_Description": raw_desc,
            "Normalized_Description": norm_desc or raw_desc,
            "Material_Code": mat_code,
            "Material_Grade": grade_val,
            "Specification": spec_val,
            "Size": size_val,
            "Unit": unit_val,
            "Material_Category": cat_val,
            "Material_Type": type_val,
            "Length": len_val,
            "Diameter": diam_val,
            "Coating": coat_val,
            "Manufacturer": mfg_val,
            "Manufacturer_Part_No": pn_val,
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

        fin_family = extracted.get("material_family") or cat_val or m.get("material_family") or None
        fin_type = extracted.get("material_type") or type_val or m.get("material_type") or None
        fin_grade = extracted.get("material_grade") or grade_val or m.get("grade") or None
        fin_dims = extracted.get("size") or extracted.get("nominal_size") or size_val or m.get("dimensions") or None
        fin_specs = extracted.get("specification") or extracted.get("standard") or spec_val or m.get("specifications") or None
        fin_uom = extracted.get("unit") or unit_val or m.get("uom") or None

        updates.append({
            "id": m["id"],
            "normalized_description": norm_desc or raw_desc,
            "standardized_description": standardized_desc,
            "material_family": fin_family,
            "material_type": fin_type,
            "grade": fin_grade,
            "dimensions": fin_dims,
            "specifications": fin_specs,
            "uom": fin_uom,
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
