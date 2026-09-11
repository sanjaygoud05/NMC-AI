"""
Run pipeline script - Material Harmonization Pipeline Runner
SIH26099 Material Harmonization Platform (Phase 1)
"""

import sys
import os
import argparse
import asyncio
import json

# Add server directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "server"))

from pipeline.pipeline_runner import pipeline_runner


async def main(phase: str = None):
    print("==================================================")
    print("  SIH26099 Pipeline Orchestration Engine (Phase 1) ")
    print("==================================================")

    if phase:
        print(f"Executing specified phase: {phase}")
        results = await pipeline_runner.run_phase(phase)
    else:
        print("Executing Phase 1 (Ingestion + Data Profiling)...")
        results = await pipeline_runner.run_pipeline()

    print("\nExecution Summary:")
    print(json.dumps(results, indent=2))
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run material harmonization pipeline")
    parser.add_argument("--phase", help="Specific phase to run", type=str)
    args = parser.parse_args()

    asyncio.run(main(phase=args.phase))
