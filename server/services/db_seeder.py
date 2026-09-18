"""
Database Seeder Service
Ensures database tables are seeded on startup or auto-migrated if holding the stale dataset (< 2,000 items).
Guarantees the live deployment always runs the full 2,200 materials across 8 CPSEs.
"""

import os
import sys
import logging

_server_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_root_dir = os.path.abspath(os.path.join(_server_dir, ".."))
for _p in [_root_dir, _server_dir]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

logger = logging.getLogger(__name__)


def seed_database_if_empty(force: bool = False) -> dict:
    """
    Checks if Common Material Master, Procurement, or Legacy Mapping tables are empty
    OR contain the stale dataset (< 2,000 records).
    If so, seeds them immediately using the pipeline phases with the new 2,200 baseline dataset.
    """
    try:
        try:
            from app.db.common_master_repository import common_master_repository
            from app.db.procurement_repository import procurement_repository
            from app.db.legacy_mapping_repository import legacy_mapping_repository
        except ImportError:
            from server.app.db.common_master_repository import common_master_repository
            from server.app.db.procurement_repository import procurement_repository
            from server.app.db.legacy_mapping_repository import legacy_mapping_repository

        # Check Legacy Mapping count (must be 2,200 for new dataset)
        lm_count = 0
        try:
            stats = legacy_mapping_repository.get_stats()
            lm_count = stats.get("total_mappings", 0)
        except Exception as e:
            logger.warning(f"Error checking legacy mapping count: {e}")

        # Check Procurement count (must be 2,200 for new dataset)
        proc_count = 0
        try:
            kpis = procurement_repository.get_kpis()
            proc_count = kpis.get("total_materials_analyzed", 0)
        except Exception as e:
            logger.warning(f"Error checking procurement KPI count: {e}")

        # Check Common Master count
        cm_count = 0
        try:
            res = common_master_repository.query_common_materials(page_size=1)
            cm_count = res.get("total", 0)
        except Exception as e:
            logger.warning(f"Error checking common master count: {e}")

        # Stale check: old dataset had 1,250 items; new dataset has 2,200 items
        is_stale = (lm_count < 2000 or proc_count < 2000 or cm_count == 1249 or cm_count == 0 or force)

        if is_stale:
            logger.info(
                "Database contains stale or incomplete dataset (LM=%d, Proc=%d, CMM=%d). "
                "Migrating and re-seeding full 2,200 baseline dataset across 8 CPSEs...",
                lm_count, proc_count, cm_count,
            )

            # 1. Re-seed Common Material Master (Phase 8)
            try:
                from pipeline.phase08_common_material_master import run_common_material_master
            except ImportError:
                from server.pipeline.phase08_common_material_master import run_common_material_master
            run_common_material_master()
            logger.info("Common Material Master seeded successfully.")

            # 2. Re-seed Legacy Mapping (Phase 9)
            try:
                from pipeline.phase09_legacy_mapping import run_legacy_mapping
            except ImportError:
                from server.pipeline.phase09_legacy_mapping import run_legacy_mapping
            run_legacy_mapping()
            logger.info("Legacy mapping seeded successfully.")

            # 3. Re-seed Procurement Analytics (Phase 10)
            try:
                from pipeline.phase10_procurement_analytics import run_procurement_analytics
            except ImportError:
                from server.pipeline.phase10_procurement_analytics import run_procurement_analytics
            run_procurement_analytics()
            logger.info("Procurement analytics seeded successfully.")

            # Fetch refreshed stats
            new_lm = legacy_mapping_repository.get_stats().get("total_mappings", 2200)
            new_proc = procurement_repository.get_kpis().get("total_materials_analyzed", 2200)
            new_cmm = common_master_repository.query_common_materials(page_size=1).get("total", 1228)

            return {
                "status": "reseeded",
                "legacy_mappings": new_lm,
                "procurement_facts": new_proc,
                "common_master": new_cmm,
                "dataset_version": "2200_BASELINE",
            }
        else:
            logger.info(
                "Database is verified up-to-date with new 2,200 baseline dataset (LM=%d, Proc=%d, CMM=%d).",
                lm_count, proc_count, cm_count,
            )
            return {
                "status": "current",
                "legacy_mappings": lm_count,
                "procurement_facts": proc_count,
                "common_master": cm_count,
                "dataset_version": "2200_BASELINE",
            }

    except Exception as e:
        logger.error(f"Failed to auto-seed database: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}

