"""
Phase 10 Pipeline: Procurement Intelligence + Analytics
Produces:
- data/processed/procurement_facts.csv
- data/processed/cmm_consumption_summary.csv
- data/processed/cmm_purchase_summary.csv
- data/processed/cpse_procurement_summary.csv
- data/processed/procurement_opportunities.csv
- data/processed/phase10_analytics_report.json
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
    from server.services.procurement_analytics_service import procurement_analytics_service
    from server.app.db.procurement_repository import procurement_repository
except ImportError:
    from services.procurement_analytics_service import procurement_analytics_service
    from app.db.procurement_repository import procurement_repository


def compute_file_sha256(file_path: str) -> str:
    """Compute SHA-256 checksum of a file"""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def run_procurement_analytics(config: Optional[dict] = None) -> Dict[str, Any]:
    """
    Executes Phase 10 Procurement Intelligence & Analytics:
    1. Computes line-level facts, CMM aggregations, enterprise CPSE summaries, and auditable opportunities.
    2. Persists data to PostgreSQL database via atomic transaction.
    3. Exports 5 deterministic CSV artifacts and 1 JSON report to data/processed/.
    """
    data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "processed"))
    os.makedirs(data_dir, exist_ok=True)

    # 1. Synthesize analytics bundle
    bundle = procurement_analytics_service.build_procurement_analytics()
    facts = bundle["facts"]
    cmm_consumption = bundle["cmm_consumption_summaries"]
    cmm_purchase = bundle["cmm_purchase_summaries"]
    cpse_summaries = bundle["cpse_summaries"]
    opportunities = bundle["opportunities"]
    report_data = bundle["report"]

    # Combine consumption and purchase metrics by cmm_code for DB model persistence
    purchase_lookup = {p["cmm_code"]: p for p in cmm_purchase}
    combined_cmm_summaries = []
    for c in cmm_consumption:
        code = c["cmm_code"]
        p = purchase_lookup.get(code, {})
        merged = {**c, **p}
        combined_cmm_summaries.append(merged)

    # 2. Persist to PostgreSQL database
    db_res = procurement_repository.bulk_replace_procurement_data(
        facts=facts,
        cmm_summaries=combined_cmm_summaries,
        opportunities=opportunities,
    )

    # 3. Export CSV 1: procurement_facts.csv (1,250 rows)
    facts_csv_path = os.path.join(data_dir, "procurement_facts.csv")
    facts_cols = [
        "fact_id",
        "source_cpse",
        "material_code",
        "material_description",
        "cmm_code",
        "material_category",
        "material_type",
        "unit_of_measure",
        "plant",
        "material_status",
        "annual_consumption",
        "last_purchase_date",
        "manufacturer",
        "manufacturer_part_no",
    ]
    df_facts = pd.DataFrame(facts)[facts_cols]
    df_facts.to_csv(facts_csv_path, index=False, encoding="utf-8")
    facts_sha = compute_file_sha256(facts_csv_path)

    # Export CSV 2: cmm_consumption_summary.csv (1,249 rows)
    cons_csv_path = os.path.join(data_dir, "cmm_consumption_summary.csv")
    cons_cols = [
        "cmm_code",
        "common_description",
        "material_family",
        "governance_status",
        "member_count",
        "cpse_count",
        "consuming_cpses",
        "primary_uom",
        "total_annual_consumption",
        "avg_consumption_per_member",
        "plant_count",
        "dominant_plant",
    ]
    df_cons = pd.DataFrame(cmm_consumption)[cons_cols]
    df_cons.to_csv(cons_csv_path, index=False, encoding="utf-8")
    cons_sha = compute_file_sha256(cons_csv_path)

    # Export CSV 3: cmm_purchase_summary.csv (1,249 rows)
    pur_csv_path = os.path.join(data_dir, "cmm_purchase_summary.csv")
    pur_cols = [
        "cmm_code",
        "earliest_purchase_date",
        "latest_purchase_date",
        "purchase_recency_days",
        "active_member_count",
        "inactive_member_count",
        "unique_manufacturers_count",
        "unique_part_numbers_count",
        "manufacturer_diversity_flag",
    ]
    df_pur = pd.DataFrame(cmm_purchase)[pur_cols]
    df_pur.to_csv(pur_csv_path, index=False, encoding="utf-8")
    pur_sha = compute_file_sha256(pur_csv_path)

    # Export CSV 4: cpse_procurement_summary.csv (4 rows)
    cpse_csv_path = os.path.join(data_dir, "cpse_procurement_summary.csv")
    cpse_cols = [
        "source_cpse",
        "total_material_records",
        "active_material_count",
        "inactive_material_count",
        "total_volume_nos",
        "total_volume_mtr",
        "total_volume_set",
        "total_volume_other",
        "distinct_plants_count",
        "distinct_manufacturers_count",
        "multi_cpse_harmonized_members",
    ]
    df_cpse = pd.DataFrame(cpse_summaries)[cpse_cols]
    df_cpse.to_csv(cpse_csv_path, index=False, encoding="utf-8")
    cpse_sha = compute_file_sha256(cpse_csv_path)

    # Export CSV 5: procurement_opportunities.csv
    opp_csv_path = os.path.join(data_dir, "procurement_opportunities.csv")
    opp_cols = [
        "opportunity_id",
        "opportunity_type",
        "cmm_code",
        "source_cpses",
        "material_codes",
        "trigger_metric",
        "trigger_value",
        "threshold",
        "reason",
        "evidence_reference",
    ]
    df_opp = pd.DataFrame(opportunities)[opp_cols]
    df_opp.to_csv(opp_csv_path, index=False, encoding="utf-8")
    opp_sha = compute_file_sha256(opp_csv_path)

    # Export JSON report: phase10_analytics_report.json
    report_path = os.path.join(data_dir, "phase10_analytics_report.json")
    final_report = {
        **report_data,
        "database_persistence": db_res,
        "files_generated": {
            "procurement_facts_csv": facts_csv_path,
            "procurement_facts_sha256": facts_sha,
            "cmm_consumption_summary_csv": cons_csv_path,
            "cmm_consumption_summary_sha256": cons_sha,
            "cmm_purchase_summary_csv": pur_csv_path,
            "cmm_purchase_summary_sha256": pur_sha,
            "cpse_procurement_summary_csv": cpse_csv_path,
            "cpse_procurement_summary_sha256": cpse_sha,
            "procurement_opportunities_csv": opp_csv_path,
            "procurement_opportunities_sha256": opp_sha,
            "phase10_analytics_report_json": report_path,
        },
    }

    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(final_report, f, indent=2)

    return {
        "status": "completed",
        "database_persistence": db_res,
        "artifacts": {
            "procurement_facts_csv": facts_csv_path,
            "procurement_facts_sha256": facts_sha,
            "cmm_consumption_summary_csv": cons_csv_path,
            "cmm_consumption_summary_sha256": cons_sha,
            "cmm_purchase_summary_csv": pur_csv_path,
            "cmm_purchase_summary_sha256": pur_sha,
            "cpse_procurement_summary_csv": cpse_csv_path,
            "cpse_procurement_summary_sha256": cpse_sha,
            "procurement_opportunities_csv": opp_csv_path,
            "procurement_opportunities_sha256": opp_sha,
            "phase10_analytics_report_json": report_path,
        },
        "metrics": final_report["metrics"],
    }


if __name__ == "__main__":
    res = run_procurement_analytics()
    print("Phase 10 Pipeline completed successfully:")
    print(json.dumps(res, indent=2))
