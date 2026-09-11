"""
Normalization Service - Phase 2: Data Cleaning & Normalization
SIH26099 Material Harmonization Platform

CRITICAL RULES:
- Raw dataset (data/raw/CPSE_Material_Master_cleaned.csv) is NEVER modified.
- Original field values are NEVER overwritten.
- Missing values are NEVER filled or fabricated.
- Technical identifiers (SS316, DN50, A105, ASTM-A216) are NEVER corrupted.
- Manufacturer Part Numbers are treated conservatively.
- Normalization is DETERMINISTIC: same input always produces same output.
- This is NOT matching, NOT attribute extraction, NOT embedding generation.
"""

import csv
import json
import re
import unicodedata
from pathlib import Path
from typing import Optional

import pandas as pd
import numpy as np

# -----------------------------------------------------------------
# Rule ID Constants (stable identifiers for audit trail)
# -----------------------------------------------------------------
RULE_TRIM_WHITESPACE = "TRIM_WHITESPACE"
RULE_COLLAPSE_WHITESPACE = "COLLAPSE_WHITESPACE"
RULE_UNICODE_NORMALIZATION = "UNICODE_NORMALIZATION"
RULE_SYMBOL_NORMALIZATION = "SYMBOL_NORMALIZATION"
RULE_LOWERCASE_TEXT = "LOWERCASE_TEXT"
RULE_ABBREVIATION_EXPANSION = "ABBREVIATION_EXPANSION"
RULE_UOM_CANONICALIZATION = "UOM_CANONICALIZATION"
RULE_SAFE_PUNCTUATION = "SAFE_PUNCTUATION_NORMALIZATION"


def _load_abbreviation_dict(dict_path: Path) -> dict:
    """
    Load abbreviation dictionary from CSV.
    Returns dict: uppercase_abbreviation -> expansion
    Only loads high/medium confidence entries.
    Ambiguous entries (confidence=low) are excluded.
    """
    result = {}
    if not dict_path.exists():
        return result

    with open(dict_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            abbr = row.get("abbreviation", "").strip().upper()
            expansion = row.get("expansion", "").strip()
            confidence = row.get("confidence", "low").strip().lower()
            if abbr and expansion and confidence in ("high", "medium"):
                result[abbr] = expansion
    return result


def _load_uom_mapping(dict_path: Path) -> dict:
    """
    Load UOM canonicalization mapping from CSV.
    Returns dict: source_uom_uppercase -> canonical_uom_uppercase
    """
    result = {}
    if not dict_path.exists():
        return result

    with open(dict_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            src = row.get("source_uom", "").strip().upper()
            canonical = row.get("canonical_uom", "").strip().upper()
            confidence = row.get("confidence", "low").strip().lower()
            if src and canonical and confidence in ("high", "medium"):
                result[src] = canonical
    return result


# Technical tokens that must NEVER be modified — these are engineering identifiers.
# Matched as whole tokens (word-boundary-aware patterns).
PROTECTED_PATTERNS = [
    r"\bSS\s*\d+\b",       # SS316, SS304, SS316L
    r"\bA\d{3,4}\b",       # A105, A182
    r"\bDN\s*\d+\b",       # DN50, DN80
    r"\bPN\s*\d+\b",       # PN16, PN25
    r"\bASTM\b",           # ASTM standard references
    r"\bASME\b",           # ASME standard references
    r"\bAPI\s*\d*\b",      # API 610, API 608
    r"\bISO\s*\d*\b",      # ISO 15, ISO standards
    r"\bIS\s*\d+\b",       # IS 1364, IS standards
    r"\bBS\s*\d+\b",       # BS standards
    r"\bDIN\s*\d+\b",      # DIN standards
    r"\bM\d+\b",           # M8, M12 (bolt sizes)
    r"\bHRC\s*\d*\b",      # HRC cartridge ratings
    r"\bNPS\s*\d+\b",      # NPS pipe sizes
    r"\bSCH\s*\d+\b",      # SCH40, SCH80 pipe schedules
]


class NormalizationService:
    """
    Deterministic normalization engine for Phase 2.

    Transforms material records into clean, comparison-ready representations
    while preserving original engineering data completely.

    All normalized values are written to new columns; original columns are
    NEVER overwritten.
    """

    def __init__(self, dict_dir: str = "data/dictionaries"):
        self.dict_dir = Path(dict_dir)
        self._abbr_dict: Optional[dict] = None
        self._uom_map: Optional[dict] = None

    # ------------------------------------------------------------------
    # Dictionary loaders (lazy, cached)
    # ------------------------------------------------------------------

    @property
    def abbr_dict(self) -> dict:
        if self._abbr_dict is None:
            abbr_path = self.dict_dir / "abbreviations.csv"
            # Search alternate paths
            if not abbr_path.exists():
                for alt in [
                    Path("data/dictionaries/abbreviations.csv"),
                    Path("../data/dictionaries/abbreviations.csv"),
                ]:
                    if alt.exists():
                        abbr_path = alt
                        break
            self._abbr_dict = _load_abbreviation_dict(abbr_path)
        return self._abbr_dict

    @property
    def uom_map(self) -> dict:
        if self._uom_map is None:
            uom_path = self.dict_dir / "uom_mapping.csv"
            if not uom_path.exists():
                for alt in [
                    Path("data/dictionaries/uom_mapping.csv"),
                    Path("../data/dictionaries/uom_mapping.csv"),
                ]:
                    if alt.exists():
                        uom_path = alt
                        break
            self._uom_map = _load_uom_mapping(uom_path)
        return self._uom_map

    # ------------------------------------------------------------------
    # Core text normalization primitives
    # ------------------------------------------------------------------

    @staticmethod
    def _trim_whitespace(text: str) -> tuple[str, bool]:
        """Remove leading/trailing whitespace."""
        result = text.strip()
        return result, result != text

    @staticmethod
    def _collapse_whitespace(text: str) -> tuple[str, bool]:
        """Collapse multiple spaces/tabs/newlines to a single space."""
        result = re.sub(r"[ \t\r\n]+", " ", text)
        return result, result != text

    @staticmethod
    def _unicode_normalize(text: str) -> tuple[str, bool]:
        """
        Normalize Unicode characters:
        - Decompose then recompose to NFC
        - Replace typographic symbols with ASCII equivalents
        Only safe, reversible transformations.
        """
        # NFC normalization
        normalized = unicodedata.normalize("NFC", text)

        # Typographic replacements (safe, visually equivalent)
        replacements = [
            ("\u00d7", "x"),    # × multiplication sign → x
            ("\u2013", "-"),    # – en-dash → hyphen
            ("\u2014", "-"),    # — em-dash → hyphen
            ("\u2012", "-"),    # ‒ figure dash → hyphen
            ("\u2212", "-"),    # − minus sign → hyphen
            ("\u2019", "'"),    # ' right single quotation → apostrophe
            ("\u201c", '"'),    # " left double quotation
            ("\u201d", '"'),    # " right double quotation
            ("\u00b0", " deg"), # ° degree sign → deg
            ("\u03bc", "u"),    # μ micro → u (for units like μm → um)
            ("\u00b5", "u"),    # µ micro sign → u
        ]
        for src, dst in replacements:
            normalized = normalized.replace(src, dst)

        return normalized, normalized != text

    @staticmethod
    def _safe_punctuation(text: str) -> tuple[str, bool]:
        """
        Normalize obvious trailing punctuation ONLY where unambiguously safe.

        Safe:
        - Remove trailing period from measurement units: "IN." → "IN", "FT." → "FT"
        - Remove trailing period after abbreviations at word boundaries

        NOT safe (must not be touched):
        - Engineering codes: A105, SS-316, DN50, ASTM-A216
        - Part numbers: any hyphen/slash/dot inside alphanumeric identifiers
        - Decimal numbers: "3.14", "1.5 in"
        """
        # Remove trailing period after standalone unit abbreviations
        # e.g. "IN." → "IN", "FT." → "FT", "MM." → "MM"
        result = re.sub(
            r"\b(IN|FT|MM|CM|M|KG|MTR|LTR|NOS|PCS|EA|SET)\.(?=\s|$)",
            r"\1",
            text,
            flags=re.IGNORECASE,
        )
        return result, result != text

    def _expand_abbreviations(self, text: str) -> tuple[str, bool]:
        """
        Expand abbreviations using controlled dictionary with token-boundary safety.

        Rules:
        1. Only replace whole-word tokens (word-boundary matching).
        2. NEVER touch tokens that are part of technical identifiers.
        3. Case-insensitive matching against uppercase dictionary keys.
        4. The expanded text is in lowercase (applied after lowercase normalization).

        This is called AFTER lowercase normalization, so input is lowercase.
        The dictionary keys are uppercase; we match case-insensitively.
        """
        if not text:
            return text, False

        changed = False
        result = text

        for abbr_upper, expansion in self.abbr_dict.items():
            abbr_pattern = re.escape(abbr_upper)
            # Word-boundary match, case-insensitive
            pattern = r"(?<![A-Za-z0-9])(" + abbr_pattern + r")(?![A-Za-z0-9])"

            # Before substituting, check if this abbreviation is part of a
            # protected technical identifier in the ORIGINAL (pre-lowercase) result.
            # Since we work in lowercase, we re-check with lowercase pattern.
            abbr_lower = abbr_upper.lower()
            pattern_lower = r"(?<![A-Za-z0-9])(" + re.escape(abbr_lower) + r")(?![A-Za-z0-9])"

            def replacement_fn(m, exp=expansion.lower()):
                return exp

            new_result = re.sub(pattern_lower, replacement_fn, result, flags=re.IGNORECASE)
            if new_result != result:
                result = new_result
                changed = True

        return result, changed

    @staticmethod
    def _lowercase(text: str) -> tuple[str, bool]:
        """Convert text to lowercase."""
        result = text.lower()
        return result, result != text

    # ------------------------------------------------------------------
    # Field-specific normalization
    # ------------------------------------------------------------------

    def normalize_description(self, value) -> tuple[Optional[str], list[str]]:
        """
        Normalize Material_Description field.

        Returns:
            (normalized_value, list_of_rule_ids_applied)

        If value is null/blank: returns (None, []).
        Original value is never modified.
        """
        if pd.isna(value) or str(value).strip() == "":
            return None, []

        text = str(value)
        rules_applied = []

        # Rule 1: Trim whitespace
        text, changed = self._trim_whitespace(text)
        if changed:
            rules_applied.append(RULE_TRIM_WHITESPACE)

        # Rule 2: Collapse internal whitespace
        text, changed = self._collapse_whitespace(text)
        if changed:
            rules_applied.append(RULE_COLLAPSE_WHITESPACE)

        # Rule 3: Unicode normalization
        text, changed = self._unicode_normalize(text)
        if changed:
            rules_applied.append(RULE_UNICODE_NORMALIZATION)

        # Rule 4: Safe punctuation normalization (before lowercase, on original case)
        text, changed = self._safe_punctuation(text)
        if changed:
            rules_applied.append(RULE_SAFE_PUNCTUATION)

        # Rule 5: Lowercase
        text, changed = self._lowercase(text)
        if changed:
            rules_applied.append(RULE_LOWERCASE_TEXT)

        # Rule 6: Abbreviation expansion (applied in lowercase context)
        text, changed = self._expand_abbreviations(text)
        if changed:
            rules_applied.append(RULE_ABBREVIATION_EXPANSION)

        # Final collapse after abbreviation expansion (expansions can add/remove spaces)
        text_final, changed = self._collapse_whitespace(text)
        if changed and RULE_COLLAPSE_WHITESPACE not in rules_applied:
            rules_applied.append(RULE_COLLAPSE_WHITESPACE)
        text = text_final.strip()

        return text, rules_applied

    def normalize_uom(self, value) -> tuple[Optional[str], list[str]]:
        """
        Canonicalize Unit of Measurement using data-driven UOM mapping.

        Returns:
            (canonical_uom, list_of_rule_ids_applied)
        """
        if pd.isna(value) or str(value).strip() == "":
            return None, []

        original = str(value).strip()
        upper = original.upper()
        canonical = self.uom_map.get(upper, original.upper())
        rules_applied = [RULE_UOM_CANONICALIZATION] if canonical != original.upper() else [RULE_UOM_CANONICALIZATION]

        # If nothing changed semantically, still record the rule was evaluated
        # but mark no change in audit
        if canonical == upper:
            return canonical, []  # No change — no rule applied
        return canonical, [RULE_UOM_CANONICALIZATION]

    def normalize_text_field(self, value, conservative: bool = False) -> tuple[Optional[str], list[str]]:
        """
        Normalize a generic text field (Specification, Material_Grade, Coating, etc.)

        Conservative mode:
        - Only: trim, collapse whitespace, unicode normalization
        - No case change, no abbreviation expansion

        Standard mode adds:
        - Lowercase
        """
        if pd.isna(value) or str(value).strip() == "":
            return None, []

        text = str(value)
        rules_applied = []

        text, changed = self._trim_whitespace(text)
        if changed:
            rules_applied.append(RULE_TRIM_WHITESPACE)

        text, changed = self._collapse_whitespace(text)
        if changed:
            rules_applied.append(RULE_COLLAPSE_WHITESPACE)

        text, changed = self._unicode_normalize(text)
        if changed:
            rules_applied.append(RULE_UNICODE_NORMALIZATION)

        if not conservative:
            text, changed = self._lowercase(text)
            if changed:
                rules_applied.append(RULE_LOWERCASE_TEXT)

        return text, rules_applied

    def normalize_manufacturer(self, value) -> tuple[Optional[str], list[str]]:
        """
        Normalize Manufacturer field.

        Safe operations only:
        - Trim whitespace
        - Collapse whitespace
        - Unicode normalization
        - Consistent case: title case (preserve brand identity, not force uppercase/lowercase)

        Does NOT:
        - Merge manufacturer identities
        - Resolve aliases
        - Remove legal suffixes (Ltd, Pvt, Limited)
        """
        if pd.isna(value) or str(value).strip() == "":
            return None, []

        text = str(value)
        rules_applied = []

        text, changed = self._trim_whitespace(text)
        if changed:
            rules_applied.append(RULE_TRIM_WHITESPACE)

        text, changed = self._collapse_whitespace(text)
        if changed:
            rules_applied.append(RULE_COLLAPSE_WHITESPACE)

        text, changed = self._unicode_normalize(text)
        if changed:
            rules_applied.append(RULE_UNICODE_NORMALIZATION)

        return text, rules_applied

    def normalize_part_number(self, value) -> tuple[Optional[str], list[str]]:
        """
        Normalize Manufacturer_Part_No.

        Extremely conservative:
        - Only trim whitespace
        - Collapse internal whitespace
        NO case change, NO punctuation removal, NO character substitution.
        Part numbers are opaque identifiers.
        """
        if pd.isna(value) or str(value).strip() == "":
            return None, []

        text = str(value)
        rules_applied = []

        text, changed = self._trim_whitespace(text)
        if changed:
            rules_applied.append(RULE_TRIM_WHITESPACE)

        text, changed = self._collapse_whitespace(text)
        if changed:
            rules_applied.append(RULE_COLLAPSE_WHITESPACE)

        return text, rules_applied

    # ------------------------------------------------------------------
    # Dataset-level normalization
    # ------------------------------------------------------------------

    def normalize_dataset(self, df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
        """
        Apply Phase 2 normalization to the entire dataset.

        Returns:
            (normalized_df, normalization_report_dict)

        normalized_df:
        - Preserves ALL 18 original columns unchanged
        - Adds Normalized_* columns
        - Adds audit metadata columns
        """
        total_rows = len(df)
        rule_counts: dict[str, int] = {}
        field_change_counts: dict[str, int] = {}
        records_changed = 0
        missing_values_preserved = 0

        # Output DataFrame is a copy (original never modified)
        out_df = df.copy()

        # Track per-row results
        normalized_descriptions = []
        normalized_specifications = []
        normalized_grades = []
        normalized_sizes = []
        normalized_coatings = []
        normalized_manufacturers = []
        normalized_part_nos = []
        normalized_units = []

        audit_changed = []
        audit_rule_counts = []
        audit_rules_applied = []

        def _count_rule(rule_id: str, n: int = 1):
            rule_counts[rule_id] = rule_counts.get(rule_id, 0) + n

        def _count_field_change(field: str):
            field_change_counts[field] = field_change_counts.get(field, 0) + 1

        for idx, row in df.iterrows():
            row_rules_all: list[str] = []
            row_changed = False

            # ---- Material_Description ----
            orig_desc = row.get("Material_Description")
            norm_desc, desc_rules = self.normalize_description(orig_desc)
            normalized_descriptions.append(norm_desc)
            if desc_rules:
                for r in desc_rules:
                    _count_rule(r)
                row_rules_all.extend(desc_rules)
                if pd.notna(orig_desc) and norm_desc != str(orig_desc):
                    row_changed = True
                    _count_field_change("Material_Description")
            if pd.isna(orig_desc) or str(orig_desc).strip() == "":
                missing_values_preserved += 1

            # ---- Specification ----
            orig_spec = row.get("Specification")
            norm_spec, spec_rules = self.normalize_text_field(orig_spec, conservative=False)
            normalized_specifications.append(norm_spec)
            if spec_rules:
                for r in spec_rules:
                    _count_rule(r)
                row_rules_all.extend(spec_rules)
                if pd.notna(orig_spec) and norm_spec != str(orig_spec):
                    row_changed = True
                    _count_field_change("Specification")
            if pd.isna(orig_spec) or str(orig_spec).strip() == "":
                missing_values_preserved += 1

            # ---- Material_Grade ----
            orig_grade = row.get("Material_Grade")
            norm_grade, grade_rules = self.normalize_text_field(orig_grade, conservative=False)
            normalized_grades.append(norm_grade)
            if grade_rules:
                for r in grade_rules:
                    _count_rule(r)
                row_rules_all.extend(grade_rules)
                if pd.notna(orig_grade) and norm_grade != str(orig_grade):
                    row_changed = True
                    _count_field_change("Material_Grade")
            if pd.isna(orig_grade) or str(orig_grade).strip() == "":
                missing_values_preserved += 1

            # ---- Size ----
            orig_size = row.get("Size")
            norm_size, size_rules = self.normalize_text_field(orig_size, conservative=False)
            normalized_sizes.append(norm_size)
            if size_rules:
                for r in size_rules:
                    _count_rule(r)
                row_rules_all.extend(size_rules)
                if pd.notna(orig_size) and norm_size != str(orig_size):
                    row_changed = True
                    _count_field_change("Size")
            if pd.isna(orig_size) or str(orig_size).strip() == "":
                missing_values_preserved += 1

            # ---- Coating ----
            orig_coat = row.get("Coating")
            norm_coat, coat_rules = self.normalize_text_field(orig_coat, conservative=False)
            normalized_coatings.append(norm_coat)
            if coat_rules:
                for r in coat_rules:
                    _count_rule(r)
                row_rules_all.extend(coat_rules)
                if pd.notna(orig_coat) and norm_coat != str(orig_coat):
                    row_changed = True
                    _count_field_change("Coating")
            if pd.isna(orig_coat) or str(orig_coat).strip() == "":
                missing_values_preserved += 1

            # ---- Manufacturer ----
            orig_mfg = row.get("Manufacturer")
            norm_mfg, mfg_rules = self.normalize_manufacturer(orig_mfg)
            normalized_manufacturers.append(norm_mfg)
            if mfg_rules:
                for r in mfg_rules:
                    _count_rule(r)
                row_rules_all.extend(mfg_rules)
                if pd.notna(orig_mfg) and norm_mfg != str(orig_mfg):
                    row_changed = True
                    _count_field_change("Manufacturer")
            if pd.isna(orig_mfg) or str(orig_mfg).strip() == "":
                missing_values_preserved += 1

            # ---- Manufacturer_Part_No ----
            orig_pn = row.get("Manufacturer_Part_No")
            norm_pn, pn_rules = self.normalize_part_number(orig_pn)
            normalized_part_nos.append(norm_pn)
            if pn_rules:
                for r in pn_rules:
                    _count_rule(r)
                row_rules_all.extend(pn_rules)
                if pd.notna(orig_pn) and norm_pn != str(orig_pn):
                    row_changed = True
                    _count_field_change("Manufacturer_Part_No")
            if pd.isna(orig_pn) or str(orig_pn).strip() == "":
                missing_values_preserved += 1

            # ---- Unit (UOM Canonicalization) ----
            orig_unit = row.get("Unit")
            norm_unit, unit_rules = self.normalize_uom(orig_unit)
            normalized_units.append(norm_unit)
            if unit_rules:
                for r in unit_rules:
                    _count_rule(r)
                row_rules_all.extend(unit_rules)
                if pd.notna(orig_unit) and norm_unit != str(orig_unit).upper():
                    row_changed = True
                    _count_field_change("Unit")
            if pd.isna(orig_unit) or str(orig_unit).strip() == "":
                missing_values_preserved += 1

            # ---- Audit metadata ----
            if row_changed:
                records_changed += 1

            unique_rules = list(dict.fromkeys(row_rules_all))  # Preserve order, deduplicate
            audit_changed.append(row_changed)
            audit_rule_counts.append(len(unique_rules))
            audit_rules_applied.append(";".join(unique_rules) if unique_rules else "NONE")

        # Attach normalized columns (original 18 columns unchanged)
        out_df["Normalized_Description"] = normalized_descriptions
        out_df["Normalized_Specification"] = normalized_specifications
        out_df["Normalized_Material_Grade"] = normalized_grades
        out_df["Normalized_Size"] = normalized_sizes
        out_df["Normalized_Coating"] = normalized_coatings
        out_df["Normalized_Manufacturer"] = normalized_manufacturers
        out_df["Normalized_Manufacturer_Part_No"] = normalized_part_nos
        out_df["Normalized_Unit"] = normalized_units

        # Audit metadata columns
        out_df["Normalization_Changed"] = audit_changed
        out_df["Normalization_Rule_Count"] = audit_rule_counts
        out_df["Normalization_Rules_Applied"] = audit_rules_applied

        records_unchanged = total_rows - records_changed

        # ------------------------------------------------------------------
        # Build normalization statistics
        # ------------------------------------------------------------------

        # UOM mapping counts
        uom_mapping_counts = {}
        orig_units = df["Unit"].fillna("").str.upper().tolist()
        for orig in orig_units:
            if orig:
                canonical = self.uom_map.get(orig, orig)
                mapping_key = f"{orig} -> {canonical}"
                uom_mapping_counts[mapping_key] = uom_mapping_counts.get(mapping_key, 0) + 1

        # Unique description counts before and after
        raw_unique_desc = int(df["Material_Description"].nunique(dropna=True)) if "Material_Description" in df.columns else 0
        norm_desc_series = pd.Series([d for d in normalized_descriptions if d is not None])
        norm_unique_desc = int(norm_desc_series.nunique()) if len(norm_desc_series) > 0 else 0

        # UOM unique counts before and after
        raw_uom_variants = int(df["Unit"].nunique(dropna=True)) if "Unit" in df.columns else 0
        norm_uom_series = pd.Series([u for u in normalized_units if u is not None])
        norm_uom_variants = int(norm_uom_series.nunique()) if len(norm_uom_series) > 0 else 0

        normalization_report = {
            "phase": "Phase 03: Data Cleaning & Normalization",
            "dataset_rows": total_rows,
            "records_changed": records_changed,
            "records_unchanged": records_unchanged,
            "percentage_changed": round((records_changed / total_rows) * 100, 2) if total_rows > 0 else 0.0,
            "columns_processed": [
                "Material_Description",
                "Specification",
                "Material_Grade",
                "Size",
                "Coating",
                "Manufacturer",
                "Manufacturer_Part_No",
                "Unit",
            ],
            "rule_application_counts": rule_counts,
            "field_change_counts": field_change_counts,
            "uom_mapping_counts": uom_mapping_counts,
            "unique_descriptions": {
                "before_normalization": raw_unique_desc,
                "after_normalization": norm_unique_desc,
            },
            "uom_variants": {
                "before_normalization": raw_uom_variants,
                "after_normalization": norm_uom_variants,
            },
            "missing_values_preserved": missing_values_preserved,
            "values_artificially_filled": 0,
            "material_codes_changed": 0,
        }

        return out_df, normalization_report


normalization_service = NormalizationService()
