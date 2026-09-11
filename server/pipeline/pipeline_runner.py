"""
Pipeline runner - Main pipeline orchestration
Phase 1: Ingestion & Profiling
Phase 2 (Phase 3 stage): Cleaning & Normalization
Phase 3 (Phase 4 stage): Engineering Attribute Extraction
"""

import os
import sys

_server_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_root_dir = os.path.abspath(os.path.join(_server_dir, ".."))
for _p in [_root_dir, _server_dir]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

try:
    from pipeline.phase01_ingestion import run_ingestion
    from pipeline.phase02_profiling import run_profiling
    from pipeline.phase03_cleaning import run_cleaning
    from pipeline.phase04_attribute_extraction import run_attribute_extraction
    from pipeline.phase05_standardization import run_standardization
    from pipeline.phase07_candidate_matching import run_matching
    from pipeline.phase08_technical_validation import run_technical_validation
    from pipeline.phase08_common_material_master import run_common_material_master
    from pipeline.phase09_legacy_mapping import run_legacy_mapping
    from pipeline.phase10_procurement_analytics import run_procurement_analytics
except ImportError:
    from server.pipeline.phase01_ingestion import run_ingestion
    from server.pipeline.phase02_profiling import run_profiling
    from server.pipeline.phase03_cleaning import run_cleaning
    from server.pipeline.phase04_attribute_extraction import run_attribute_extraction
    from server.pipeline.phase05_standardization import run_standardization
    from server.pipeline.phase07_candidate_matching import run_matching
    from server.pipeline.phase08_technical_validation import run_technical_validation
    from server.pipeline.phase08_common_material_master import run_common_material_master
    from server.pipeline.phase09_legacy_mapping import run_legacy_mapping
    from server.pipeline.phase10_procurement_analytics import run_procurement_analytics


class PipelineRunner:
    """Main pipeline orchestration class"""

    def __init__(self):
        self.current_status = "idle"
        self.last_results = {}

    async def run_common_material_master(self, config: dict = None) -> dict:
        """Run Phase 8 Common Material Master synthesis"""
        self.current_status = "running"
        result = run_common_material_master(config)
        self.current_status = "completed" if result.get("status") == "completed" else "failed"
        self.last_results = result
        return result

    async def run_legacy_mapping(self, config: dict = None) -> dict:
        """Run Phase 9 Legacy Material Mapping synthesis"""
        self.current_status = "running"
        result = run_legacy_mapping(config)
        self.current_status = "completed" if result.get("status") == "completed" else "failed"
        self.last_results = result
        return result

    async def run_procurement_analytics(self, config: dict = None) -> dict:
        """Run Phase 10 Procurement Intelligence + Analytics"""
        self.current_status = "running"
        result = run_procurement_analytics(config)
        self.current_status = "completed" if result.get("status") == "completed" else "failed"
        self.last_results = result
        return result

    async def run_pipeline(self, config: dict = None) -> dict:
        """Run Phase 1 pipeline (Ingestion + Profiling)"""
        self.current_status = "running"

        # Step 1: Ingestion
        ingestion_res = await run_ingestion(config)
        if ingestion_res.get("status") == "failed":
            self.current_status = "failed"
            return {
                "status": "failed",
                "phase": "phase01_ingestion",
                "results": ingestion_res,
            }

        # Step 2: Profiling
        profiling_res = await run_profiling(config)

        self.current_status = "completed"
        self.last_results = {
            "status": "completed",
            "ingestion": ingestion_res,
            "profiling": profiling_res,
        }
        return self.last_results

    async def run_normalization_pipeline(self, config: dict = None) -> dict:
        """Run Phase 2 (Cleaning & Normalization) pipeline"""
        self.current_status = "running"

        result = run_cleaning(config)

        if result.get("status") == "failed":
            self.current_status = "failed"
        else:
            self.current_status = "completed"

        self.last_results = result
        return result

    async def run_extraction_pipeline(self, config: dict = None) -> dict:
        """Run Phase 3 (Attribute Extraction) pipeline"""
        self.current_status = "running"

        result = run_attribute_extraction(config)

        if result.get("status") == "failed":
            self.current_status = "failed"
        else:
            self.current_status = "completed"

        self.last_results = result
        return result

    async def run_standardization_pipeline(self, config: dict = None) -> dict:
        """Run Phase 4 (Standardization & Canonicalization) pipeline"""
        self.current_status = "running"
        result = await run_standardization(config)
        self.current_status = "completed" if result.get("status") == "completed" else "failed"
        self.last_results = result
        return result

    async def run_matching_pipeline(self, config: dict = None) -> dict:
        """Run Phase 5 (Candidate Matching) pipeline"""
        self.current_status = "running"
        result = await run_matching(config)
        self.current_status = "completed" if result.get("status") == "completed" else "failed"
        self.last_results = result
        return result

    async def run_validation_pipeline(self, config: dict = None) -> dict:
        """Run Phase 6 (Technical Validation) pipeline"""
        self.current_status = "running"
        result = await run_technical_validation(config)
        self.current_status = "completed" if result.get("status") == "completed" else "failed"
        self.last_results = result
        return result

    async def run_phase(self, phase_name: str, config: dict = None) -> dict:
        """Run a specific pipeline phase by name"""
        if phase_name in ["phase01_ingestion", "ingestion"]:
            return await run_ingestion(config)
        elif phase_name in ["phase02_profiling", "profiling"]:
            return await run_profiling(config)
        elif phase_name in ["phase03_cleaning", "cleaning", "normalization", "phase2"]:
            return run_cleaning(config)
        elif phase_name in ["phase04_attribute_extraction", "extraction", "attributes", "phase3"]:
            return run_attribute_extraction(config)
        elif phase_name in ["phase05_standardization", "standardization", "canonicalization", "phase4"]:
            return await run_standardization(config)
        elif phase_name in ["phase07_candidate_matching", "matching", "candidate_matching", "phase5"]:
            return await run_matching(config)
        elif phase_name in ["phase08_technical_validation", "validation", "technical_validation", "phase6"]:
            return await run_technical_validation(config)
        elif phase_name in ["phase08_common_material_master", "common_master", "common_material_master", "phase8"]:
            return await self.run_common_material_master(config)
        elif phase_name in ["phase09_legacy_mapping", "legacy_mapping", "phase9"]:
            return await self.run_legacy_mapping(config)
        elif phase_name in ["phase10_procurement_analytics", "procurement_analytics", "procurement", "phase10"]:
            return await self.run_procurement_analytics(config)
        else:
            raise ValueError(
                f"Phase '{phase_name}' is not recognized. "
                "Available: phase01_ingestion, phase02_profiling, phase03_cleaning, phase04_attribute_extraction, phase05_standardization, phase07_candidate_matching, phase08_technical_validation, phase08_common_material_master, phase09_legacy_mapping, phase10_procurement_analytics"
            )

    def get_pipeline_status(self) -> dict:
        """Get current pipeline status"""
        return {
            "status": self.current_status,
            "phase": "phase01_ingestion_and_profiling",
            "last_results": self.last_results,
        }


pipeline_runner = PipelineRunner()
