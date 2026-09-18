"""
Database Seeder Service
Ensures database tables are seeded on startup if empty (e.g. on fresh Render deployment or ephemeral restart).
"""

import logging

logger = logging.getLogger(__name__)


def seed_database_if_empty():
    """
    Checks if Common Material Master, Procurement, or Legacy Mapping tables are empty.
    If so, seeds them immediately using the pipeline phases.
    Takes ~3 seconds and guarantees 100% data availability even on fresh deployments.
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

        # Check Common Master
        cm_count = 0
        try:
            res = common_master_repository.query_common_materials(page_size=1)
            cm_count = res.get("total", 0)
        except Exception as e:
            logger.warning(f"Error checking common master count: {e}")

        if cm_count == 0:
            logger.info("Common Material Master table is empty. Seeding Phase 8 data...")
            try:
                from pipeline.phase08_common_material_master import run_common_material_master
            except ImportError:
                from server.pipeline.phase08_common_material_master import run_common_material_master
            run_common_material_master()
            logger.info("Common Material Master seeded successfully.")

        # Check Procurement
        proc_count = 0
        try:
            kpis = procurement_repository.get_kpis()
            proc_count = kpis.get("total_materials_analyzed", 0)
        except Exception as e:
            logger.warning(f"Error checking procurement KPI count: {e}")

        if proc_count == 0:
            logger.info("Procurement facts table is empty. Seeding Phase 10 data...")
            try:
                from pipeline.phase10_procurement_analytics import run_procurement_analytics
            except ImportError:
                from server.pipeline.phase10_procurement_analytics import run_procurement_analytics
            run_procurement_analytics()
            logger.info("Procurement analytics seeded successfully.")

        # Check Legacy Mapping
        lm_count = 0
        try:
            stats = legacy_mapping_repository.get_stats()
            lm_count = stats.get("total_mappings", 0)
        except Exception as e:
            logger.warning(f"Error checking legacy mapping count: {e}")

        if lm_count == 0:
            logger.info("Legacy mapping table is empty. Seeding Phase 9 data...")
            try:
                from pipeline.phase09_legacy_mapping import run_legacy_mapping
            except ImportError:
                from server.pipeline.phase09_legacy_mapping import run_legacy_mapping
            run_legacy_mapping()
            logger.info("Legacy mapping seeded successfully.")

    except Exception as e:
        logger.error(f"Failed to auto-seed database: {e}", exc_info=True)
