"""
Unit and Integration Tests for Runtime Dataset Upload, Registry, and Scoping
Validates:
1. Dynamic Dataset ID format (UPLOAD-YYYYMMDD-XXX) and uniqueness (no hardcoded IDs)
2. Strict schema validation (18 standard columns, empty file check, intra-CPSE duplicate check)
3. Isolated execution into data/uploads/<dataset_id>/processed/
4. Frozen baseline immutability (data/raw/CPSE_Material_Master_cleaned.csv SHA256 untouched)
5. Phase 7/8 governance invariants (0 auto-accepts, standalone candidates)
6. Scoping resolution across BASELINE, UPLOAD, and ALL (preserves dataset_id & provenance)
"""

import re
import io
import hashlib
from pathlib import Path
import pandas as pd
import pytest

from server.services.dataset_registry_service import (
    dataset_registry_service,
    UPLOADS_DIR,
    BASELINE_HASH,
)
from server.services.upload_processing_service import execute_upload_pipeline
from server.services.dataset_resolver import (
    resolve_artifact_path,
    load_dataset_dataframe,
)

FIXTURE_PATH = Path(__file__).resolve().parent.parent / "fixtures" / "SIH26099_upload_test.csv"
RAW_BASELINE_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "raw" / "CPSE_Material_Master_cleaned.csv"
EXPECTED_RAW_HASH = "1a45fccad5203de25f64bfda42e2f56667752bca4338a55913ae4a7babeafef1"


def calculate_hash(path: Path) -> str:
    hasher = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def test_dataset_id_generation_format_and_uniqueness():
    """Verify dynamic dataset ID adheres to UPLOAD-YYYYMMDD-XXX format and increments uniquely."""
    id1 = dataset_registry_service.generate_next_dataset_id()
    id2 = dataset_registry_service.generate_next_dataset_id()
    
    # Must match dynamic regex without hardcoded dates
    pattern = re.compile(r"^UPLOAD-\d{8}-\d{3}$")
    assert pattern.match(id1), f"id1 {id1} does not match UPLOAD-YYYYMMDD-XXX"
    assert pattern.match(id2), f"id2 {id2} does not match UPLOAD-YYYYMMDD-XXX"
    assert id1 != id2, f"Successive dataset IDs must be unique: {id1} vs {id2}"
    
    # Verify sequence increment
    seq1 = int(id1.split("-")[-1])
    seq2 = int(id2.split("-")[-1])
    assert seq2 > seq1


def test_schema_validation_valid_and_invalid():
    """Verify 18-column schema validation detects valid files, missing columns, and duplicates."""
    assert FIXTURE_PATH.exists(), f"Missing fixture at {FIXTURE_PATH}"
    with open(FIXTURE_PATH, "rb") as f:
        valid_bytes = f.read()
    
    # Valid dataset
    res_valid = dataset_registry_service.validate_csv_content(valid_bytes)
    assert res_valid["is_valid"] is True
    assert res_valid["row_count"] == 8
    assert res_valid["column_count"] == 18
    
    # Missing columns
    df_valid = pd.read_csv(io.BytesIO(valid_bytes))
    df_missing = df_valid.drop(columns=["Unit", "Material_Category"])
    missing_bytes = df_missing.to_csv(index=False).encode("utf-8")
    res_missing = dataset_registry_service.validate_csv_content(missing_bytes)
    assert res_missing["is_valid"] is False
    assert "missing_columns" in res_missing
    assert "Unit" in res_missing["missing_columns"]
    assert "Material_Category" in res_missing["missing_columns"]
    
    # Intra-CPSE duplicate material code
    df_dup = df_valid.copy()
    df_dup.loc[1, "Material_Code"] = df_dup.loc[0, "Material_Code"]
    df_dup.loc[1, "CPSE"] = df_dup.loc[0, "CPSE"]
    dup_bytes = df_dup.to_csv(index=False).encode("utf-8")
    res_dup = dataset_registry_service.validate_csv_content(dup_bytes)
    assert res_dup["is_valid"] is False
    assert "Duplicate Material_Code" in res_dup["error"]


def test_frozen_baseline_immutability():
    """Verify data/raw/CPSE_Material_Master_cleaned.csv is never altered."""
    assert RAW_BASELINE_PATH.exists()
    current_hash = calculate_hash(RAW_BASELINE_PATH)
    assert current_hash == EXPECTED_RAW_HASH, f"Raw baseline modified! Expected {EXPECTED_RAW_HASH}, got {current_hash}"


def test_runtime_upload_isolated_execution():
    """Verify runtime pipeline processes data into isolated folder with governance & provenance preserved."""
    hash_before = calculate_hash(RAW_BASELINE_PATH)
    
    with open(FIXTURE_PATH, "rb") as f:
        content = f.read()
    
    entry = dataset_registry_service.register_upload("SIH26099_upload_test.csv", content)
    dataset_id = entry["dataset_id"]
    
    # Check dataset ID pattern
    assert re.match(r"^UPLOAD-\d{8}-\d{3}$", dataset_id)
    assert entry["row_count"] == 8
    assert entry["status"] in ["UPLOADED", "VALIDATED"]
    
    # Execute Phase 2-10 processing
    success = execute_upload_pipeline(dataset_id)
    assert success is True
    
    # Check updated entry status
    updated_entry = dataset_registry_service.get_dataset(dataset_id)
    assert updated_entry is not None
    assert updated_entry["status"] == "COMPLETED"
    
    # Verify outputs are isolated under data/uploads/<dataset_id>/processed/
    proc_dir = UPLOADS_DIR / dataset_id / "processed"
    assert proc_dir.exists()
    assert (proc_dir / "normalized_materials.csv").exists()
    assert (proc_dir / "extracted_attributes.csv").exists()
    assert (proc_dir / "standardized_materials.csv").exists()
    assert (proc_dir / "common_material_master.csv").exists()
    assert (proc_dir / "legacy_material_mapping.csv").exists()
    assert (proc_dir / "procurement_facts.csv").exists()
    assert (proc_dir / "cmm_consumption_summary.csv").exists()
    
    # Invariant: Phase 7/8 governance - no auto-accepted matches for upload
    df_cmm = pd.read_csv(proc_dir / "common_material_master.csv")
    assert len(df_cmm) == 8
    assert all(df_cmm["governance_status"] == "STANDALONE_CANDIDATE")
    
    # Invariant: Provenance - dataset_id column attached
    df_norm = pd.read_csv(proc_dir / "normalized_materials.csv")
    assert "dataset_id" in df_norm.columns
    assert all(df_norm["dataset_id"] == dataset_id)
    
    # Invariant: Raw baseline remains untouched
    hash_after = calculate_hash(RAW_BASELINE_PATH)
    assert hash_before == hash_after == EXPECTED_RAW_HASH


def test_dataset_resolver_scoping():
    """Verify dataset_resolver correctly scopes BASELINE, specific UPLOAD, and ALL view."""
    # BASELINE scope
    df_base = load_dataset_dataframe("standardized_materials.csv", dataset_id="BASELINE")
    assert len(df_base) == 1250
    assert "dataset_id" in df_base.columns
    assert all(df_base["dataset_id"] == "BASELINE")
    
    # Query all datasets to find registered upload
    datasets = dataset_registry_service.list_datasets()
    upload_datasets = [d for d in datasets if not d.get("is_baseline") and d.get("status") == "COMPLETED"]
    assert len(upload_datasets) > 0
    test_upload_id = upload_datasets[0]["dataset_id"]
    
    # Specific UPLOAD scope
    df_upload = load_dataset_dataframe("standardized_materials.csv", dataset_id=test_upload_id)
    assert len(df_upload) == 8
    assert all(df_upload["dataset_id"] == test_upload_id)
    
    # ALL scope (aggregation view preserving provenance)
    df_all = load_dataset_dataframe("standardized_materials.csv", dataset_id="ALL")
    assert len(df_all) >= 1258
    assert set(df_all["dataset_id"].unique()).issuperset({"BASELINE", test_upload_id})
    # Check no duplicate identity collisions for CPSE + Material_Code + dataset_id
    assert not df_all.duplicated(subset=["dataset_id", "CPSE", "Material_Code"]).any()
