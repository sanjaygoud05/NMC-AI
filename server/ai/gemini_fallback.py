"""
Gemini fallback - LLM-assisted processing using Google Gemini
"""


class GeminiFallback:
    """LLM-assisted processing using Google Gemini API"""

    async def extract_attributes(self, description: str) -> dict:
        """
        Extract structured attributes from material description using LLM
        
        Args:
            description: Material description text
            
        Returns:
            dict: Extracted attributes
        """
        # TODO: Implement LLM-based attribute extraction
        # - Use Gemini API
        # - Parse structured output
        # - Validate results
        raise NotImplementedError("LLM attribute extraction not implemented yet")

    async def standardize_description(self, description: str) -> str:
        """
        Standardize material description using LLM
        
        Args:
            description: Original material description
            
        Returns:
            str: Standardized description
        """
        # TODO: Implement LLM-based standardization
        # - Use Gemini API
        # - Apply domain knowledge
        # - Validate output
        raise NotImplementedError("LLM standardization not implemented yet")

    async def explain_match(self, material1: dict, material2: dict) -> str:
        """
        Generate explanation for material match using LLM
        
        Args:
            material1: First material
            material2: Second material
            
        Returns:
            str: Match explanation
        """
        # TODO: Implement LLM-based match explanation
        # - Use Gemini API
        # - Generate human-readable explanation
        # - Highlight key similarities
        raise NotImplementedError("LLM match explanation not implemented yet")


gemini_fallback = GeminiFallback()
