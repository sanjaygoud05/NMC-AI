"""
Phase 8 Pipeline: Common Material Master Generation
Synthesizes candidate Common Material Master groups from Phase 7 accepted human reviews,
standardized materials, and Phase 6 technical validation safeguards.
Produces:
- data/processed/common_material_master.csv
- data/processed/common_material_members.csv
- data/processed/common_master_report.json
"""

import os
import sys
import json
import pandas as pd
from typing import Dict, Any, Optional

_server_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_root_dir = os.path.abspath(os.path.join(_server_dir, ".."))
for _p in [_root_dir, _server_dir]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

try:
    from server.services.common_master_service import common_master_service
    from server.app.db.common_master_repository import common_master_repository
except ImportError:
    from services.common_master_service import common_master_service
    from app.db.common_master_repository import common_master_repository


def run_common_material_master(config: Optional[dict] = None) -> Dict[str, Any]:
    """
    Executes Phase 8 Common Material Master synthesis:
    1. Executes deterministic clique grouping and attribute consolidation.
    2. Persists master records and member mappings to transactional Supabase PostgreSQL repository.
    3. Exports data/processed/common_material_master.csv and common_material_members.csv.
    4. Writes summary report to data/processed/common_master_report.json.
    """
    data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "processed"))
    os.makedirs(data_dir, exist_ok=True)

    # 1. Run synthesis
    catalog_bundle = common_master_service.build_common_material_catalog()
    master_records = catalog_bundle["master_records"]
    member_records = catalog_bundle["member_records"]
    summary = catalog_bundle["summary"]

    # 2. Persist to database
    db_res = common_master_repository.bulk_replace_master_catalog(master_records, member_records)

    # 3. Export CSV files
    master_csv_path = os.path.join(data_dir, "common_material_master.csv")
    member_csv_path = os.path.join(data_dir, "common_material_members.csv")
    report_json_path = os.path.join(data_dir, "common_master_report.json")

    # Format master DataFrame
    flat_masters = []
    for m in master_records:
        rec = dict(m)
        rec["consolidated_attributes"] = json.dumps(rec["consolidated_attributes"], sort_keys=True)
        rec["cpse_coverage"] = ";".join(rec["cpse_coverage"])
        flat_masters.append(rec)

    df_masters = pd.DataFrame(flat_masters)
    df_masters.to_csv(master_csv_path, index=False)

    # Format member DataFrame
    flat_members = []
    for mem in member_records:
        rec = dict(mem)
        rec["accepted_edge_candidate_ids"] = ";".join(rec["accepted_edge_candidate_ids"])
        rec["reviewer_ids"] = ";".join(rec["reviewer_ids"])
        rec["evidence_snapshot_hashes"] = ";".join(rec["evidence_snapshot_hashes"])
        flat_members.append(rec)

    df_members = pd.DataFrame(flat_members)
    df_members.to_csv(member_csv_path, index=False)

    # Write report
    report_data = {
        "phase": "Phase 8 — Common Material Master",
        "status": "completed",
        "database_persistence": db_res,
        "metrics": summary,
        "files_generated": {
            "master_catalog_csv": master_csv_path,
            "member_mappings_csv": member_csv_path,
            "report_json": report_json_path,
        },
    }

    with open(report_json_path, "w", encoding="utf-8") as f:
        json.dump(report_data, f, indent=2)

    return report_data


if __name__ == "__main__":
    res = run_common_material_master()
    print("Phase 8 Common Material Master completed successfully:")
    print(json.dumps(res, indent=2))
