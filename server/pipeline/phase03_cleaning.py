"""
Phase 03: Data Cleaning & Normalization Pipeline Stage
SIH26099 Material Harmonization Platform

Implements Phase 2 pipeline:
  data/raw/CPSE_Material_Master_cleaned.csv
        ↓
  Phase 3 Cleaning + Normalization
        ↓
  data/processed/normalized_materials.csv
  data/processed/normalization_report.json

CRITICAL RULES:
- Raw dataset is NEVER modified.
- All outputs go to data/processed/.
- Row count in output MUST equal row count in input.
- Material_Code values are preserved exactly.
- Missing values remain missing.
"""

import json
import sys
from pathlib import Path

# Support running from server/ or server/pipeline/
server_root = Path(__file__).resolve().parent.parent
if str(server_root) not in sys.path:
    sys.path.insert(0, str(server_root))

from services.ingestion_service import IngestionService, EXPECTED_SCHEMA
from services.normalization_service import NormalizationService

VALID_RAW_HASHES = {
    "1a45fccad5203de25f64bfda42e2f56667752bca4338a55913ae4a7babeafef1",  # 1250-row baseline
    "054163772d5ae37b8f032adb35986f3330a53b8119c1963b43606ec916febb18",  # 2200-row 8-CPSE 5-sector dataset
}
EXPECTED_RAW_HASH = "054163772d5ae37b8f032adb35986f3330a53b8119c1963b43606ec916febb18"
OUTPUT_DIR = Path("data/processed")


def run_cleaning(config: dict = None) -> dict:
    """
    Execute Phase 3 (Cleaning & Normalization) pipeline.

    Steps:
    1. Load raw dataset via IngestionService (read-only).
    2. Validate raw file hash against known baseline.
    3. Validate schema (18 columns).
    4. Run NormalizationService.normalize_dataset().
    5. Validate output row count == input row count.
    6. Validate Material_Code unchanged.
    7. Write normalized_materials.csv.
    8. Write normalization_report.json.
    9. Re-verify raw file hash (must be unchanged).
    10. Return execution summary.
    """
    config = config or {}

    # Resolve paths
    raw_data_path = config.get("raw_data_path", None)
    output_dir = Path(config.get("output_dir", "data/processed"))

    ingestion = IngestionService(raw_path=raw_data_path) if raw_data_path else IngestionService()
    normalization = NormalizationService()

    # ------------------------------------------------------------------
    # Step 1: Verify raw file exists and is readable
    # ------------------------------------------------------------------
    file_info = ingestion.verify_file()
    if not file_info.get("exists"):
        return {
            "status": "failed",
            "stage": "file_verification",
            "message": f"Raw dataset not found: {file_info.get('path')}",
            "file_info": file_info,
        }

    # ------------------------------------------------------------------
    # Step 2: Verify SHA256 hash before processing
    # ------------------------------------------------------------------
    hash_before = ingestion.get_file_hash()
    if hash_before not in VALID_RAW_HASHES:
        return {
            "status": "failed",
            "stage": "raw_integrity_check",
            "message": (
                f"CRITICAL: Raw dataset SHA256 hash mismatch!\n"
                f"Actual:   {hash_before}\n"
                "Raw dataset may have been modified. Phase 2 BLOCKED."
            ),
            "hash_before": hash_before,
            "hash_expected": list(VALID_RAW_HASHES),
        }

    # ------------------------------------------------------------------
    # Step 3: Load raw DataFrame
    # ------------------------------------------------------------------
    df_raw = ingestion.load_raw_dataframe()
    input_row_count = len(df_raw)

    # ------------------------------------------------------------------
    # Step 4: Validate schema
    # ------------------------------------------------------------------
    schema_info = ingestion.validate_schema(df_raw)
    if not schema_info["is_valid"]:
        return {
            "status": "failed",
            "stage": "schema_validation",
            "message": f"Schema validation failed: {schema_info}",
            "schema_info": schema_info,
        }

    # ------------------------------------------------------------------
    # Step 5: Run normalization
    # ------------------------------------------------------------------
    normalized_df, normalization_report = normalization.normalize_dataset(df_raw)

    # ------------------------------------------------------------------
    # Step 6: Validate output integrity
    # ------------------------------------------------------------------
    output_row_count = len(normalized_df)
    if output_row_count != input_row_count:
        return {
            "status": "failed",
            "stage": "output_integrity_check",
            "message": (
                f"Row count mismatch! Input: {input_row_count}, Output: {output_row_count}. "
                "No rows should be added or deleted during normalization."
            ),
        }

    # Verify Material_Code columns are identical
    if "Material_Code" in df_raw.columns and "Material_Code" in normalized_df.columns:
        codes_match = (df_raw["Material_Code"] == normalized_df["Material_Code"]).all()
        if not codes_match:
            return {
                "status": "failed",
                "stage": "material_code_integrity_check",
                "message": "CRITICAL: Material_Code values were modified during normalization. This must not happen.",
            }

    # ------------------------------------------------------------------
    # Step 7: Write normalized CSV
    # ------------------------------------------------------------------
    output_dir.mkdir(parents=True, exist_ok=True)
    normalized_csv_path = output_dir / "normalized_materials.csv"
    normalized_df.to_csv(normalized_csv_path, index=False, encoding="utf-8")

    # ------------------------------------------------------------------
    # Step 8: Finalize normalization report
    # ------------------------------------------------------------------
    hash_after = ingestion.get_file_hash()
    normalization_report["raw_dataset_hash_before"] = hash_before
    normalization_report["raw_dataset_hash_after"] = hash_after
    normalization_report["raw_dataset_unchanged"] = (hash_before == hash_after)
    normalization_report["output_row_count"] = output_row_count
    normalization_report["input_row_count"] = input_row_count
    normalization_report["normalized_csv_path"] = str(normalized_csv_path)

    report_path = output_dir / "normalization_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(normalization_report, f, indent=2)

    # ------------------------------------------------------------------
    # Step 9: Verify raw file still unchanged after all operations
    # ------------------------------------------------------------------
    if hash_after != hash_before:
        return {
            "status": "failed",
            "stage": "post_execution_hash_check",
            "message": (
                "CRITICAL: Raw dataset hash changed DURING Phase 2 execution. "
                "This must not happen."
            ),
            "hash_before": hash_before,
            "hash_after": hash_after,
        }

    return {
        "status": "completed",
        "stage": "phase03_cleaning",
        "message": "Phase 2 (Cleaning & Normalization) completed successfully.",
        "input_rows": input_row_count,
        "output_rows": output_row_count,
        "records_changed": normalization_report["records_changed"],
        "records_unchanged": normalization_report["records_unchanged"],
        "percentage_changed": normalization_report["percentage_changed"],
        "raw_dataset_unchanged": normalization_report["raw_dataset_unchanged"],
        "hash_before": hash_before,
        "hash_after": hash_after,
        "normalized_csv": str(normalized_csv_path),
        "normalization_report": str(report_path),
        "rule_counts": normalization_report["rule_application_counts"],
        "field_change_counts": normalization_report["field_change_counts"],
    }
