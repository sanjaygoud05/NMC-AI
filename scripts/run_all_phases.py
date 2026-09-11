"""
Complete Pipeline Runner: Phases 1 to 10
Executes the full pipeline against the Frozen Baseline dataset, verifies all artifact files,
and logs row counts, file sizes, and execution times.
"""

import os
import sys
import time
import asyncio
import pandas as pd
from pathlib import Path

# Add project root and server to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(BASE_DIR / "server"))

from server.pipeline.pipeline_runner import pipeline_runner

PHASES = [
    ("Phase 1: Ingestion", "phase01_ingestion", ["data/processed/raw_ingested.csv", "data/raw/frozen_baseline_dataset.csv"]),
    ("Phase 2: Data Profiling", "phase02_profiling", ["data/processed/profiled_materials.csv", "data/processed/data_quality_report.json"]),
    ("Phase 3: Cleaning & Normalization", "phase03_cleaning", ["data/processed/normalized_materials.csv", "data/processed/normalization_report.json"]),
    ("Phase 4: Attribute Extraction", "phase04_attribute_extraction", ["data/processed/extracted_attributes.csv", "data/processed/attribute_extraction_report.json"]),
    ("Phase 5: Standardization", "phase05_standardization", ["data/processed/standardized_materials.csv", "data/processed/standardization_report.json"]),
    ("Phase 6: Candidate Matching", "phase07_candidate_matching", ["data/processed/match_candidates.csv", "data/processed/matching_report.json"]),
    ("Phase 7: Technical Validation", "phase08_technical_validation", ["data/processed/validated_candidates.csv", "data/processed/validation_report.json"]),
    ("Phase 8: Common Material Master", "phase08_common_material_master", ["data/processed/common_material_master.csv", "data/processed/common_material_members.csv", "data/processed/common_master_report.json"]),
    ("Phase 9: Legacy Material Mapping", "phase09_legacy_mapping", ["data/processed/legacy_material_mapping.csv", "data/processed/legacy_mapping_report.json"]),
    ("Phase 10: Procurement Intelligence", "phase10_procurement_analytics", ["data/processed/procurement_facts.csv", "data/processed/procurement_opportunities.csv", "data/processed/phase10_analytics_report.json"]),
]

async def run():
    print("=" * 70)
    print("  SIH26099 FULL PHASE 1-10 PIPELINE EXECUTION (FROZEN BASELINE)")
    print("=" * 70)
    
    total_start = time.time()
    results = []

    for phase_label, phase_key, expected_files in PHASES:
        print(f"\n>>> Running {phase_label} ({phase_key})...")
        t0 = time.time()
        try:
            res = await pipeline_runner.run_phase(phase_key)
            elapsed = time.time() - t0
            status = "SUCCESS" if res.get("status") in ["completed", "success", None] else "FAILED"
            print(f"    Status: {status} ({elapsed:.2f}s)")
            
            # Check produced files
            file_stats = []
            for f in expected_files:
                p = BASE_DIR / f
                if p.exists():
                    size_kb = p.stat().st_size / 1024
                    if f.endswith(".csv"):
                        try:
                            df = pd.read_csv(p, dtype=str)
                            rows = len(df)
                            file_stats.append(f"{p.name} ({rows:,} rows, {size_kb:.1f} KB)")
                        except Exception:
                            file_stats.append(f"{p.name} ({size_kb:.1f} KB)")
                    else:
                        file_stats.append(f"{p.name} ({size_kb:.1f} KB)")
                else:
                    file_stats.append(f"{p.name} (MISSING)")
            
            print(f"    Artifacts: {', '.join(file_stats)}")
            results.append({
                "phase": phase_label,
                "status": status,
                "time": f"{elapsed:.2f}s",
                "artifacts": file_stats
            })
        except Exception as e:
            elapsed = time.time() - t0
            print(f"    ERROR: {e}")
            results.append({
                "phase": phase_label,
                "status": f"ERROR: {str(e)[:50]}",
                "time": f"{elapsed:.2f}s",
                "artifacts": []
            })

    total_time = time.time() - total_start
    print("\n" + "=" * 70)
    print(f"  PIPELINE EXECUTION COMPLETE (Total: {total_time:.2f}s)")
    print("=" * 70)
    print(f"{'Phase':<35} | {'Status':<10} | {'Time':<8} | {'Artifacts'}")
    print("-" * 70)
    for r in results:
        art_summary = "; ".join(r["artifacts"][:2])
        print(f"{r['phase']:<35} | {r['status']:<10} | {r['time']:<8} | {art_summary}")

if __name__ == "__main__":
    asyncio.run(run())
