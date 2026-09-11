"""
Mapping service - Legacy to common material mapping
"""


class MappingService:
    """Service for legacy mapping"""

    async def create_mapping(self, legacy_id: str, common_code: str) -> dict:
        """Create legacy to common mapping"""
        # TODO: Implement mapping creation
        raise NotImplementedError("Mapping creation not implemented yet")

    async def get_mappings(self, common_code: str) -> list:
        """Get all mappings for a common material"""
        # TODO: Implement mapping retrieval
        raise NotImplementedError("Mapping retrieval not implemented yet")

    async def remove_mapping(self, mapping_id: str) -> dict:
        """Remove a mapping"""
        # TODO: Implement mapping removal
        raise NotImplementedError("Mapping removal not implemented yet")


mapping_service = MappingService()
