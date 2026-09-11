"""
Phase 9 Pipeline: Legacy Mapping Generation
Produces:
- data/processed/legacy_material_mapping.csv (strictly deterministic fields)
- data/processed/legacy_mapping_report.json
"""

import os
import sys
import json
import hashlib
from typing import Dict, Any, Optional
import pandas as pd

_server_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_root_dir = os.path.abspath(os.path.join(_server_dir, ".."))
for _p in [_root_dir, _server_dir]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

try:
    from server.services.legacy_mapping_service import legacy_mapping_service
    from server.app.db.legacy_mapping_repository import legacy_mapping_repository
except ImportError:
    from services.legacy_mapping_service import legacy_mapping_service
    from app.db.legacy_mapping_repository import legacy_mapping_repository


def compute_file_sha256(file_path: str) -> str:
    """Compute SHA-256 checksum of a file"""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def run_legacy_mapping(config: Optional[dict] = None) -> Dict[str, Any]:
    """
    Executes Phase 9 Legacy Material Mapping:
    1. Generates deterministic cross-walk mapping records.
    2. Writes data/processed/legacy_material_mapping.csv with deterministic columns only.
    3. Persists records to PostgreSQL repository.
    4. Writes data/processed/legacy_mapping_report.json separating deterministic metrics from runtime metadata.
    """
    data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "processed"))
    os.makedirs(data_dir, exist_ok=True)

    # 1. Synthesize mappings
    bundle = legacy_mapping_service.build_legacy_mappings()
    mapping_records = bundle["mapping_records"]
    summary = bundle["summary"]

    # 2. Persist to database
    db_res = legacy_mapping_repository.bulk_replace_mappings(mapping_records)

    # 3. Export CSV (deterministic columns only, no runtime timestamps)
    csv_path = os.path.join(data_dir, "legacy_material_mapping.csv")
    df_csv = pd.DataFrame(mapping_records)
    
    # Strictly define deterministic column order
    csv_columns = [
        "mapping_id",
        "source_cpse",
        "material_code",
        "source_description",
        "cmm_code",
        "cmm_group_id",
        "mapping_status",
        "membership_type",
        "confidence_score",
        "confidence_semantics",
        "mapping_method",
        "mapping_reason",
        "accepted_candidate_id",
        "phase6_validation_status",
        "phase7_review_decision",
        "evidence_hash",
        "canonical_material_key",
    ]
    df_csv = df_csv[csv_columns]
    df_csv.to_csv(csv_path, index=False, encoding="utf-8")
    csv_hash = compute_file_sha256(csv_path)

    # 4. Export JSON report
    report_path = os.path.join(data_dir, "legacy_mapping_report.json")
    report_data = {
        "phase": "Phase 9 — Legacy Mapping",
        "status": "completed",
        "database_persistence": db_res,
        "deterministic_metrics": summary,
        "files_generated": {
            "legacy_mapping_csv": csv_path,
            "legacy_mapping_csv_sha256": csv_hash,
            "report_json": report_path,
        },
    }

    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report_data, f, indent=2)

    return report_data


if __name__ == "__main__":
    res = run_legacy_mapping()
    print("Phase 9 Legacy Mapping completed successfully:")
    print(json.dumps(res, indent=2))
