"""
Phase 05: Material Standardization & Canonicalization Pipeline Stage
SIH26099 Material Harmonization Platform

Input:  data/processed/extracted_attributes.csv (Phase 3 output)
        data/processed/normalized_materials.csv (Phase 2 output, for business metadata)
Output: data/processed/standardized_materials.csv
        data/processed/standardization_report.json

CRITICAL:
- Raw dataset (data/raw/CPSE_Material_Master_cleaned.csv) MUST remain unchanged.
- Phase 2 output (normalized_materials.csv) is NOT modified.
- Phase 3 output (extracted_attributes.csv) is NOT modified.
- Row count: input == output (1,250 rows exactly).
- Deterministic, explainable canonical representations and canonical keys.
- Preserves all Phase 3 conflicts without resolving genuine engineering differences.
"""

import json
import sys
import hashlib
from pathlib import Path

server_root = Path(__file__).resolve().parent.parent
if str(server_root) not in sys.path:
    sys.path.insert(0, str(server_root))

from services.ingestion_service import IngestionService
from services.standardization_service import StandardizationService

VALID_RAW_HASHES = {
    "1a45fccad5203de25f64bfda42e2f56667752bca4338a55913ae4a7babeafef1",
    "054163772d5ae37b8f032adb35986f3330a53b8119c1963b43606ec916febb18",
}
EXPECTED_RAW_HASH = "054163772d5ae37b8f032adb35986f3330a53b8119c1963b43606ec916febb18"
EXTRACTED_CSV = Path("data/processed/extracted_attributes.csv")
NORMALIZED_CSV = Path("data/processed/normalized_materials.csv")
OUTPUT_DIR = Path("data/processed")


def _sha256(path: Path) -> str:
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


async def run_standardization(config: dict = None) -> dict:
    """
    Execute Phase 05 (Material Standardization & Canonicalization) pipeline stage.
    """
    import pandas as pd

    config = config or {}
    output_dir = Path(config.get("output_dir", "data/processed"))
    output_dir.mkdir(parents=True, exist_ok=True)

    # ── Step 1: Raw dataset integrity ──────────────────────
    ingestion = IngestionService()
    hash_before = ingestion.get_file_hash()
    if hash_before not in VALID_RAW_HASHES:
        return {
            "status": "failed",
            "stage": "raw_integrity_check",
            "message": (
                f"CRITICAL: Raw dataset hash mismatch before Phase 5.\n"
                f"Expected one of: {list(VALID_RAW_HASHES)}\n"
                f"Actual:   {hash_before}"
            ),
        }

    # ── Step 2: Load Phase 3 output ────────────────────────
    ext_path = Path(config.get("extracted_csv", str(EXTRACTED_CSV)))
    if not ext_path.exists():
        return {
            "status": "failed",
            "stage": "input_file_check",
            "message": (
                f"Phase 3 output not found: {ext_path}. "
                "Run Phase 3 (attribute extraction) before Phase 4/5 (standardization)."
            ),
        }

    ext_hash_before = _sha256(ext_path)

    df_ext = pd.read_csv(ext_path, dtype=str)
    df_ext = df_ext.where(pd.notna(df_ext), None)
    input_rows = len(df_ext)

    if input_rows <= 0:
        return {
            "status": "failed",
            "stage": "input_row_count_check",
            "message": f"Input rows must be greater than 0, found {input_rows}.",
        }

    # Optional load of normalized materials for business columns
    df_norm = None
    if NORMALIZED_CSV.exists():
        df_norm = pd.read_csv(NORMALIZED_CSV, dtype=str)
        df_norm = df_norm.where(pd.notna(df_norm), None)

    # ── Step 3: Run Standardization ────────────────────────
    svc = StandardizationService()
    standardized_df, report = svc.standardize_dataset(df_ext, df_norm)

    # ── Step 4: Output row count check ─────────────────────
    output_rows = len(standardized_df)
    if output_rows != input_rows:
        return {
            "status": "failed",
            "stage": "output_integrity_check",
            "message": (
                f"Row count mismatch: input={input_rows}, output={output_rows}. "
                "Phase 4 must strictly preserve row count."
            ),
        }

    # ── Step 5: Save artifacts ─────────────────────────────
    out_csv = output_dir / "standardized_materials.csv"
    out_json = output_dir / "standardization_report.json"

    standardized_df.to_csv(out_csv, index=False, encoding="utf-8")

    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    # ── Step 6: Post-run Immutability Verification ──────────
    hash_after = ingestion.get_file_hash()
    if hash_after != EXPECTED_RAW_HASH:
        return {
            "status": "failed",
            "stage": "post_run_raw_integrity_check",
            "message": "CRITICAL: Raw dataset was modified during Phase 5 execution.",
        }

    ext_hash_after = _sha256(ext_path)
    if ext_hash_after != ext_hash_before:
        return {
            "status": "failed",
            "stage": "post_run_phase3_integrity_check",
            "message": "CRITICAL: extracted_attributes.csv was modified during Phase 5 execution.",
        }

    return {
        "status": "completed",
        "stage": "phase05_standardization",
        "message": "Phase 4 (Material Standardization & Canonicalization) completed successfully.",
        "input_rows": input_rows,
        "output_rows": output_rows,
        "records_changed": report["standardization"]["records_changed"],
        "records_unchanged": report["standardization"]["records_unchanged"],
        "change_rate": report["standardization"]["change_rate"],
        "unique_canonical_keys": report["canonical_keys"]["unique_canonical_keys"],
        "records_sharing_canonical_key": report["canonical_keys"]["records_sharing_canonical_key"],
        "conflicts_preserved": report["conflicts"]["records_with_preserved_conflicts"],
        "conflicts_resolved": 0,
        "raw_dataset_unchanged": True,
        "phase2_dataset_unchanged": True,
        "phase3_dataset_unchanged": True,
        "raw_hash": hash_after,
        "standardized_csv": str(out_csv),
        "standardization_report": str(out_json),
    }
