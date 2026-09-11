"""
Full Phase 1 to Phase 10 Pipeline Runner for Frozen Baseline
SIH26099 Material Harmonization Platform
"""

import os
import sys
import time
import json
import asyncio
from pathlib import Path

# Ensure server and root are in sys.path
root_dir = Path(__file__).resolve().parent.parent
server_dir = root_dir / "server"
sys.path.insert(0, str(root_dir))
sys.path.insert(0, str(server_dir))

from pipeline.phase01_ingestion import run_ingestion
from pipeline.phase02_profiling import run_profiling
from pipeline.phase03_cleaning import run_cleaning
from pipeline.phase04_attribute_extraction import run_attribute_extraction
from pipeline.phase05_standardization import run_standardization
from pipeline.phase06_embedding import run_embedding
from pipeline.phase07_candidate_matching import run_matching
from pipeline.phase08_technical_validation import run_technical_validation
from pipeline.phase08_common_material_master import run_common_material_master
from pipeline.phase09_legacy_mapping import run_legacy_mapping
from pipeline.phase10_procurement_analytics import run_procurement_analytics


async def main():
    print("=" * 70)
    print("  SIH26099 — EXECUTING FULL PHASE 1–10 PIPELINE (FROZEN BASELINE)  ")
    print("=" * 70)
    total_start = time.time()
    results = {}

    # Phase 1: Ingestion
    print("\n>>> [Phase 01] Ingestion & Raw Validation")
    t0 = time.time()
    res1 = await run_ingestion()
    results["phase01"] = res1
    print(f"Status: {res1.get('status')} | Time: {time.time()-t0:.2f}s | Message: {res1.get('message')}")

    # Phase 2: Profiling
    print("\n>>> [Phase 02] Data Profiling & Quality Scoring")
    t0 = time.time()
    res2 = await run_profiling()
    results["phase02"] = res2
    qs = res2.get("quality_score") if isinstance(res2, dict) else None
    if isinstance(qs, dict):
        qs = qs.get("overall_score")
    print(f"Status: {res2.get('status')} | Time: {time.time()-t0:.2f}s | Quality Score: {qs}")

    # Phase 3: Cleaning & Normalization
    print("\n>>> [Phase 03] Data Cleaning & Normalization")
    t0 = time.time()
    res3 = run_cleaning()
    results["phase03"] = res3
    print(f"Status: {res3.get('status')} | Time: {time.time()-t0:.2f}s | Normalized rows: {res3.get('row_count')}")

    # Phase 4: Attribute Extraction
    print("\n>>> [Phase 04] Engineering Attribute Extraction")
    t0 = time.time()
    res4 = run_attribute_extraction()
    results["phase04"] = res4
    print(f"Status: {res4.get('status')} | Time: {time.time()-t0:.2f}s | Extracted attributes rows: {res4.get('row_count')}")

    # Phase 5: Standardization
    print("\n>>> [Phase 05] Canonical Standardization Taxonomy")
    t0 = time.time()
    res5 = await run_standardization()
    results["phase05"] = res5
    print(f"Status: {res5.get('status')} | Time: {time.time()-t0:.2f}s | Standardized records: {res5.get('standardized_count')}")

    # Phase 6: Vector Embeddings
    print("\n>>> [Phase 06] Dense Vector Embeddings")
    t0 = time.time()
    emb_arr, res6 = await run_embedding()
    results["phase06"] = res6
    print(f"Status: completed | Time: {time.time()-t0:.2f}s | Embeddings shape: {emb_arr.shape} | Method: {res6.get('embedding_method')}")

    # Phase 7: Candidate Matching
    print("\n>>> [Phase 07] Multi-Metric Candidate Matching")
    t0 = time.time()
    res7 = await run_matching()
    results["phase07"] = res7
    print(f"Status: {res7.get('status')} | Time: {time.time()-t0:.2f}s | Candidate pairs: {res7.get('candidate_count')}")

    # Phase 8: Technical Validation & Review Prep
    print("\n>>> [Phase 08] Hard Technical Domain Validation")
    t0 = time.time()
    res8_val = await run_technical_validation()
    results["phase08_val"] = res8_val
    val_count = res8_val.get('summary', {}).get('total_validated') or res8_val.get('validated_pairs')
    print(f"Status: {res8_val.get('status')} | Time: {time.time()-t0:.2f}s | Validated pairs: {val_count}")

    # Phase 8 (CMM): Common Material Master Clustering
    print("\n>>> [Phase 08 (CMM)] Common Material Master Synthesis")
    t0 = time.time()
    res8_cmm = run_common_material_master()
    results["phase08_cmm"] = res8_cmm
    print(f"Status: {res8_cmm.get('status')} | Time: {time.time()-t0:.2f}s | CMM Master Count: {res8_cmm.get('master_count')}")

    # Phase 9: Legacy Mapping Crosswalk
    print("\n>>> [Phase 09] Legacy Material Mapping Generation")
    t0 = time.time()
    res9 = run_legacy_mapping()
    results["phase09"] = res9
    print(f"Status: {res9.get('status')} | Time: {time.time()-t0:.2f}s | Legacy Mappings: {res9.get('record_count')}")

    # Phase 10: Procurement Analytics
    print("\n>>> [Phase 10] Procurement Intelligence & Spend Opportunities")
    t0 = time.time()
    res10 = run_procurement_analytics()
    results["phase10"] = res10
    print(f"Status: {res10.get('status')} | Time: {time.time()-t0:.2f}s | Facts: {res10.get('facts_count')} | Opportunities: {res10.get('opportunities_count')}")

    total_time = time.time() - total_start
    print("\n" + "=" * 70)
    print(f"  FULL PIPELINE COMPLETE IN {total_time:.2f}s  ")
    print("=" * 70)

    # Verification of produced artifacts in data/processed/
    print("\n>>> Verifying Generated Artifacts in data/processed/:")
    processed_dir = root_dir / "data" / "processed"
    files_to_check = [
        ("data_quality_report.json", "Phase 2 Quality Report"),
        ("normalized_materials.csv", "Phase 3 Normalized Materials"),
        ("normalization_report.json", "Phase 3 Normalization Report"),
        ("extracted_attributes.csv", "Phase 4 Extracted Attributes"),
        ("attribute_extraction_report.json", "Phase 4 Extraction Report"),
        ("standardized_materials.csv", "Phase 5 Standardized Materials"),
        ("standardization_report.json", "Phase 5 Standardization Report"),
        ("embeddings_metadata.json", "Phase 6 Embeddings Metadata"),
        ("match_candidates.csv", "Phase 7 Match Candidates"),
        ("matching_report.json", "Phase 7 Matching Report"),
        ("validated_candidates.csv", "Phase 8 Validated Candidates"),
        ("validation_report.json", "Phase 8 Validation Report"),
        ("common_material_master.csv", "Phase 8 CMM Master Catalog"),
        ("common_material_members.csv", "Phase 8 CMM Members Mapping"),
        ("common_master_report.json", "Phase 8 CMM Report"),
        ("legacy_material_mapping.csv", "Phase 9 Legacy Crosswalk Mapping"),
        ("legacy_mapping_report.json", "Phase 9 Legacy Mapping Report"),
        ("procurement_facts.csv", "Phase 10 Procurement Facts"),
        ("procurement_opportunities.csv", "Phase 10 Joint Sourcing Opportunities"),
        ("phase10_analytics_report.json", "Phase 10 Analytics Report"),
    ]

    all_exist = True
    for filename, description in files_to_check:
        p = processed_dir / filename
        if p.exists():
            size_kb = p.stat().st_size / 1024
            print(f"  [OK] {filename:<35} | {size_kb:>10.2f} KB | {description}")
        else:
            all_exist = False
            print(f"  [MISSING] {filename:<35} | {description}")

    if all_exist:
        print("\nSUCCESS: Every single phase produced a real verified file in data/processed/!")
    else:
        print("\nWARNING: Some files were missing.")


if __name__ == "__main__":
    asyncio.run(main())
