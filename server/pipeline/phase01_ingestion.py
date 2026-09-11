"""
Phase 01: Data Ingestion
Upload, load, and validate raw material data from CPSEs
"""

from services.ingestion_service import ingestion_service


async def run_ingestion(config: dict = None) -> dict:
    """
    Run data ingestion phase
    
    Args:
        config: Configuration dict (optional)
        
    Returns:
        dict: Ingestion execution results and schema validation
    """
    return ingestion_service.run_ingestion()
