"""
Phase 04: Engineering Attribute Extraction Pipeline Stage
SIH26099 Material Harmonization Platform

Input:  data/processed/normalized_materials.csv  (Phase 2 output)
Output: data/processed/extracted_attributes.csv
        data/processed/attribute_extraction_report.json

CRITICAL:
- Raw dataset (data/raw/CPSE_Material_Master_cleaned.csv) MUST remain unchanged.
- Phase 2 output (normalized_materials.csv) is NOT modified.
- Row count: input == output (1,250 rows exactly).
- No attributes are invented; NULL is correct for absent data.
"""

import json
import sys
from pathlib import Path

server_root = Path(__file__).resolve().parent.parent
if str(server_root) not in sys.path:
    sys.path.insert(0, str(server_root))

from services.ingestion_service import IngestionService
from services.attribute_extraction_service import AttributeExtractionService

EXPECTED_RAW_HASH = "1a45fccad5203de25f64bfda42e2f56667752bca4338a55913ae4a7babeafef1"
NORMALIZED_CSV = Path("data/processed/normalized_materials.csv")
OUTPUT_DIR = Path("data/processed")


def run_attribute_extraction(config: dict = None) -> dict:
    """
    Execute Phase 4 (Attribute Extraction) pipeline stage.

    Steps:
    1. Verify raw dataset hash unchanged.
    2. Load normalized_materials.csv (Phase 2 output).
    3. Validate row count.
    4. Run AttributeExtractionService.extract_dataset().
    5. Validate output row count.
    6. Write extracted_attributes.csv.
    7. Write attribute_extraction_report.json.
    8. Re-verify raw hash (must be unchanged).
    9. Return execution summary.
    """
    import pandas as pd

    config = config or {}
    output_dir = Path(config.get("output_dir", "data/processed"))

    # ── Step 1: Raw dataset integrity ──────────────────────
    ingestion = IngestionService()
    hash_before = ingestion.get_file_hash()
    if hash_before != EXPECTED_RAW_HASH:
        return {
            "status": "failed",
            "stage": "raw_integrity_check",
            "message": (
                f"CRITICAL: Raw dataset hash mismatch before Phase 4.\n"
                f"Expected: {EXPECTED_RAW_HASH}\n"
                f"Actual:   {hash_before}"
            ),
        }

    # ── Step 2: Load Phase 2 output ────────────────────────
    norm_path = Path(config.get("normalized_csv", str(NORMALIZED_CSV)))
    if not norm_path.exists():
        return {
            "status": "failed",
            "stage": "input_file_check",
            "message": (
                f"Phase 2 output not found: {norm_path}. "
                "Run Phase 2 (normalization) before Phase 3 (attribute extraction)."
            ),
        }

    df_norm = pd.read_csv(norm_path, dtype=str)
    input_rows = len(df_norm)

    # ── Step 3: Validate input ─────────────────────────────
    if "Material_Code" not in df_norm.columns:
        return {
            "status": "failed",
            "stage": "schema_check",
            "message": "normalized_materials.csv is missing Material_Code column.",
        }

    # ── Step 4: Run extraction ─────────────────────────────
    svc = AttributeExtractionService()
    extracted_df, report = svc.extract_dataset(df_norm)

    # ── Step 5: Output row count check ────────────────────
    output_rows = len(extracted_df)
    if output_rows != input_rows:
        return {
            "status": "failed",
            "stage": "output_integrity_check",
            "message": (
                f"Row count mismatch: input={input_rows}, output={output_rows}. "
                "No rows should be lost during attribute extraction."
            ),
        }

    # ── Step 6: Write extracted CSV ────────────────────────
    output_dir.mkdir(parents=True, exist_ok=True)
    extracted_csv_path = output_dir / "extracted_attributes.csv"
    extracted_df.to_csv(extracted_csv_path, index=False, encoding="utf-8")

    # ── Step 7: Write extraction report ───────────────────
    hash_after = ingestion.get_file_hash()
    report["raw_dataset_hash_before"] = hash_before
    report["raw_dataset_hash_after"] = hash_after
    report["raw_dataset_unchanged"] = (hash_before == hash_after)
    report["input_row_count"] = input_rows
    report["output_row_count"] = output_rows

    report_path = output_dir / "attribute_extraction_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    # ── Step 8: Post-check raw hash ────────────────────────
    if hash_after != hash_before:
        return {
            "status": "failed",
            "stage": "post_hash_check",
            "message": "CRITICAL: Raw dataset hash changed DURING Phase 3 execution.",
        }

    return {
        "status": "completed",
        "stage": "phase04_attribute_extraction",
        "message": "Phase 3 (Attribute Extraction) completed successfully.",
        "input_rows": input_rows,
        "output_rows": output_rows,
        "records_with_attributes": report["records_with_attributes"],
        "records_3_plus": report["records_3_plus_attributes"],
        "records_5_plus": report["records_5_plus_attributes"],
        "average_attributes": report["average_attributes_per_record"],
        "total_conflicts": report["total_conflicts"],
        "raw_dataset_unchanged": report["raw_dataset_unchanged"],
        "hash_before": hash_before,
        "hash_after": hash_after,
        "extracted_csv": str(extracted_csv_path),
        "extraction_report": str(report_path),
    }
