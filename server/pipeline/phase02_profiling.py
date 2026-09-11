"""
Phase 02: Data Profiling
Analyze material data structure, completeness, duplicate metrics, and dataset quality
"""

from services.profiling_service import profiling_service


async def run_profiling(config: dict = None) -> dict:
    """
    Run data profiling phase
    
    Args:
        config: Configuration dict (optional)
        
    Returns:
        dict: Profiling execution results and quality scores
    """
    return profiling_service.run_profiling()
