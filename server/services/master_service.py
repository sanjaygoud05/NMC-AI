"""
Master service - Common material master management
"""


class MasterService:
    """Service for common material master"""

    async def create_common_material(self, data: dict) -> dict:
        """Create a common material entry"""
        # TODO: Implement common material creation
        raise NotImplementedError("Common material creation not implemented yet")

    async def get_common_material(self, common_code: str) -> dict:
        """Get common material by code"""
        # TODO: Implement common material retrieval
        raise NotImplementedError("Common material retrieval not implemented yet")

    async def update_common_material(self, common_code: str, data: dict) -> dict:
        """Update common material"""
        # TODO: Implement common material update
        raise NotImplementedError("Common material update not implemented yet")


master_service = MasterService()
