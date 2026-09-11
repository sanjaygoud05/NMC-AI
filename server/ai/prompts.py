"""
AI Prompts - Structured prompts for LLM interactions
"""


# Attribute extraction prompt
ATTRIBUTE_EXTRACTION_PROMPT = """
You are a materials engineering expert. Extract structured attributes from the following material description.

Material Description: {description}

Extract the following attributes if present:
- Material type (e.g., Steel, Cement, Copper, Brick)
- Specifications (e.g., thickness, grade, size)
- Unit of measurement (e.g., KG, MTR, BAG, NOS)
- Manufacturer (if mentioned)
- Category (e.g., Raw Materials, Construction Materials, Electrical)

Return the result as a JSON object with the extracted attributes.
"""

# Standardization prompt
STANDARDIZATION_PROMPT = """
You are a materials engineering expert. Standardize the following material description to a common format.

Original Description: {description}

Rules:
- Use full technical names (e.g., "Steel Plate" instead of "MS Plate")
- Include key specifications
- Use standard abbreviations (e.g., "sq mm" for square millimeter)
- Follow industry naming conventions

Return the standardized description.
"""

# Match explanation prompt
MATCH_EXPLANATION_PROMPT = """
You are a materials engineering expert. Explain why the following two materials are considered a match.

Material 1:
- Description: {description1}
- Attributes: {attributes1}

Material 2:
- Description: {description2}
- Attributes: {attributes2}

Similarity Scores:
- Semantic: {semantic_score}
- Fuzzy: {fuzzy_score}
- Attribute: {attribute_score}
- Overall Confidence: {confidence_score}

Provide a clear explanation of why these materials match, highlighting:
- Key similarities
- Technical compatibility
- Any notable differences
- Why the confidence score is appropriate
"""

# Data quality assessment prompt
DATA_QUALITY_PROMPT = """
You are a data quality expert. Assess the quality of the following material data.

Material Data: {data}

Assess:
- Completeness of required fields
- Consistency of data formats
- Validity of values
- Potential data issues

Return a quality assessment with:
- Overall quality score (0-100)
- Specific issues found
- Recommendations for improvement
"""
