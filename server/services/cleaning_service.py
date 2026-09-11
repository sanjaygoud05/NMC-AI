"""
Cleaning service - Data cleaning and normalization
"""


class CleaningService:
    """Service for data cleaning"""

    async def clean_materials(self, data) -> dict:
        """Clean material data"""
        # TODO: Implement data cleaning
        raise NotImplementedError("Data cleaning not implemented yet")

    async def normalize_descriptions(self, data) -> dict:
        """Normalize material descriptions"""
        # TODO: Implement description normalization
        raise NotImplementedError("Description normalization not implemented yet")


cleaning_service = CleaningService()
