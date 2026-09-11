"""
Abbreviation dictionary - Common material abbreviations and expansions
"""

# Material type abbreviations
MATERIAL_ABBREVIATIONS = {
    "MS": "Mild Steel",
    "SS": "Stainless Steel",
    "HR": "Hot Rolled",
    "CR": "Cold Rolled",
    "PPC": "Portland Pozzolana Cement",
    "OPC": "Ordinary Portland Cement",
    "Cu": "Copper",
    "Al": "Aluminum",
    "PVC": "Polyvinyl Chloride",
    "XLPE": "Cross-linked Polyethylene",
}

# Unit abbreviations
UNIT_ABBREVIATIONS = {
    "KG": "Kilogram",
    "MTR": "Meter",
    "NOS": "Numbers",
    "BAG": "Bag",
    "L": "Liter",
    "SQM": "Square Meter",
    "SQFT": "Square Feet",
    "CUM": "Cubic Meter",
    "CFT": "Cubic Feet",
}

# Specification abbreviations
SPEC_ABBREVIATIONS = {
    "sq mm": "square millimeter",
    "mm": "millimeter",
    "inch": "inch",
    "ft": "feet",
    "m": "meter",
    "dia": "diameter",
    "thk": "thickness",
    "len": "length",
    "wd": "width",
    "ht": "height",
}


class AbbreviationDictionary:
    """Dictionary for expanding material abbreviations"""

    @staticmethod
    def expand_material(text: str) -> str:
        """
        Expand material abbreviations in text
        
        Args:
            text: Text containing abbreviations
            
        Returns:
            str: Text with expanded abbreviations
        """
        # TODO: Implement abbreviation expansion
        # - Replace material abbreviations
        # - Handle case sensitivity
        # - Preserve context
        raise NotImplementedError("Abbreviation expansion not implemented yet")

    @staticmethod
    def expand_unit(text: str) -> str:
        """
        Expand unit abbreviations in text
        
        Args:
            text: Text containing unit abbreviations
            
        Returns:
            str: Text with expanded units
        """
        # TODO: Implement unit expansion
        raise NotImplementedError("Unit expansion not implemented yet")

    @staticmethod
    def normalize_text(text: str) -> str:
        """
        Normalize text by expanding abbreviations
        
        Args:
            text: Text to normalize
            
        Returns:
            str: Normalized text
        """
        # TODO: Implement full normalization
        raise NotImplementedError("Text normalization not implemented yet")


abbreviation_dictionary = AbbreviationDictionary()
