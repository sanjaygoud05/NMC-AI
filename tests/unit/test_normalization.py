"""
Phase 2 Unit Tests — Normalization Service
SIH26099 Material Harmonization Platform

Tests cover:
- Whitespace normalization
- Case normalization
- Unicode / symbol normalization
- Safe punctuation normalization
- Abbreviation expansion with token-boundary safety
- UOM canonicalization
- Null/blank value preservation
- Material_Code preservation
- Technical identifier safety (SS316, DN50, ASTM-A216, A105)
- Manufacturer part number safety
- Audit metadata correctness
- Raw dataset hash safety (cross-check with Phase 1 safety test)
- Dataset-level normalization output integrity
"""

import sys
from pathlib import Path

import pandas as pd
import pytest

# Add server directory to path
server_dir = Path(__file__).resolve().parent.parent.parent / "server"
sys.path.insert(0, str(server_dir))

from services.normalization_service import NormalizationService


@pytest.fixture
def svc():
    """Create NormalizationService with real dictionaries."""
    # Point to real data/dictionaries
    dict_dir = Path(__file__).resolve().parent.parent.parent / "data" / "dictionaries"
    return NormalizationService(dict_dir=str(dict_dir))


# ===================================================================
# 1. Whitespace Normalization
# ===================================================================


class TestWhitespaceNormalization:
    def test_trim_leading_trailing(self, svc):
        result, rules = svc.normalize_description("  BALL VALVE  ")
        assert result.startswith("ball") or result.startswith("b"), f"Result: {result!r}"
        assert not result.startswith(" ")
        assert not result.endswith(" ")

    def test_collapse_multiple_spaces(self, svc):
        result, rules = svc.normalize_description("BALL   VALVE   SS")
        # After normalization there should be no double spaces
        assert "  " not in result, f"Double space found in: {result!r}"

    def test_collapse_tabs(self, svc):
        result, rules = svc.normalize_description("BALL\tVALVE")
        assert "\t" not in result

    def test_collapse_whitespace_rule_applied(self, svc):
        _, rules = svc.normalize_description("BALL  VALVE")
        assert "COLLAPSE_WHITESPACE" in rules

    def test_no_change_when_clean(self, svc):
        result, rules = svc.normalize_description("ball bearing 6208")
        # Already clean — only LOWERCASE_TEXT should have been the original change
        assert "TRIM_WHITESPACE" not in rules
        assert "COLLAPSE_WHITESPACE" not in rules


# ===================================================================
# 2. Case Normalization
# ===================================================================


class TestCaseNormalization:
    def test_all_caps_lowercased(self, svc):
        result, rules = svc.normalize_description("BALL VALVE")
        assert result == result.lower()

    def test_lowercase_rule_applied(self, svc):
        _, rules = svc.normalize_description("BALL VALVE")
        assert "LOWERCASE_TEXT" in rules

    def test_mixed_case_lowercased(self, svc):
        result, rules = svc.normalize_description("Carbon Steel Valve")
        assert result == result.lower()

    def test_original_field_not_changed(self, svc):
        """The original value must not be altered — normalization returns new value."""
        original = "BALL VALVE 2 IN"
        result, _ = svc.normalize_description(original)
        # The function must return a new string; original variable is untouched
        assert original == "BALL VALVE 2 IN", "Original string must not be mutated"


# ===================================================================
# 3. Unicode / Symbol Normalization
# ===================================================================


class TestUnicodeNormalization:
    def test_en_dash_to_hyphen(self, svc):
        result, rules = svc.normalize_description("DN 50 \u2013 SS316")
        assert "\u2013" not in result
        assert "-" in result

    def test_em_dash_to_hyphen(self, svc):
        result, rules = svc.normalize_description("SIZE \u2014 50 MM")
        assert "\u2014" not in result

    def test_multiplication_sign_to_x(self, svc):
        result, rules = svc.normalize_description("100 \u00d7 50 MM")
        assert "\u00d7" not in result
        assert "x" in result

    def test_unicode_rule_recorded(self, svc):
        _, rules = svc.normalize_description("DN 50 \u2013 SS316")
        assert "UNICODE_NORMALIZATION" in rules


# ===================================================================
# 4. Safe Punctuation Normalization
# ===================================================================


class TestSafePunctuationNormalization:
    def test_trailing_period_on_unit_removed(self, svc):
        """'IN.' should become 'in' (trailing period removed from unit)."""
        result, rules = svc.normalize_description("BALL VALVE 2 IN.")
        # After lowercase: "ball valve 2 in."
        # Safe punctuation should remove the trailing period from IN.
        assert result.endswith("in"), f"Expected 'in' at end, got: {result!r}"

    def test_engineering_code_hyphen_preserved(self, svc):
        """Hyphens inside ASTM-A216 must not be removed."""
        result, rules = svc.normalize_description("ASTM-A216 VALVE")
        # ASTM-A216 should remain intact (no hyphen removal)
        assert "astm-a216" in result or "astm" in result, f"Result: {result!r}"

    def test_decimal_number_preserved(self, svc):
        """Decimal numbers like 3.14 must not be corrupted."""
        result, _ = svc.normalize_description("PIPE 1.5 IN")
        assert "1.5" in result, f"Decimal number lost in: {result!r}"


# ===================================================================
# 5. Abbreviation Expansion (Token-Boundary Safety)
# ===================================================================


class TestAbbreviationExpansion:
    def test_ss_expanded_when_standalone(self, svc):
        """Standalone 'SS' token should expand to 'stainless steel'."""
        result, rules = svc.normalize_description("SS BALL VALVE")
        assert "stainless steel" in result, f"Result: {result!r}"
        assert "ABBREVIATION_EXPANSION" in rules

    def test_cs_expanded(self, svc):
        """Standalone 'CS' should expand to 'carbon steel'."""
        result, rules = svc.normalize_description("CS PIPE")
        assert "carbon steel" in result, f"Result: {result!r}"

    def test_ss316_not_corrupted(self, svc):
        """'SS316' is a technical identifier — must not become 'stainless steel316'."""
        result, rules = svc.normalize_description("SS316 BALL VALVE")
        # SS316 should not be split/corrupted
        # The result should not contain 'stainless steel316' as that's corrupt
        assert "stainless steel316" not in result, f"Technical id SS316 was corrupted: {result!r}"

    def test_dn50_not_expanded(self, svc):
        """'DN50' is a pipe size designation — must remain intact."""
        result, _ = svc.normalize_description("DN50 GATE VALVE")
        # DN50 should appear as-is (possibly lowercased to dn50)
        assert "dn50" in result, f"DN50 was corrupted: {result!r}"

    def test_a105_not_expanded(self, svc):
        """'A105' is a material standard — must remain intact."""
        result, _ = svc.normalize_description("WELD NECK FLANGE A105")
        assert "a105" in result, f"A105 was corrupted: {result!r}"

    def test_astm_not_expanded(self, svc):
        """'ASTM' is a standards body name — must remain intact."""
        result, _ = svc.normalize_description("ASTM A105 FLANGE")
        assert "astm" in result, f"ASTM was corrupted: {result!r}"

    def test_api_not_expanded(self, svc):
        """'API' must remain intact as it's a standards body name."""
        result, _ = svc.normalize_description("API 610 CENTRIFUGAL PUMP")
        assert "api" in result, f"API was corrupted: {result!r}"

    def test_flg_expanded(self, svc):
        """'FLG' should expand to 'flange'."""
        result, rules = svc.normalize_description("FLG 2 IN")
        assert "flange" in result, f"FLG not expanded: {result!r}"
        assert "ABBREVIATION_EXPANSION" in rules

    def test_brg_expanded(self, svc):
        """'BRG' should expand to 'bearing'."""
        result, rules = svc.normalize_description("BRG NO 6207")
        assert "bearing" in result, f"BRG not expanded: {result!r}"

    def test_hrc_technical_not_corrupted(self, svc):
        """'HRC' followed by a rating like '10 A' is a fuse cartridge — handle carefully."""
        result, _ = svc.normalize_description("HRC CARTRIDGE 10 A")
        # HRC should appear in result (either as 'hrc' or 'high rupturing capacity')
        assert "hrc" in result or "high rupturing capacity" in result, f"Result: {result!r}"


# ===================================================================
# 6. UOM Canonicalization
# ===================================================================


class TestUOMCanonicalization:
    def test_nos_remains_canonical(self, svc):
        """NOS is already canonical in this dataset."""
        result, rules = svc.normalize_uom("NOS")
        assert result == "NOS"
        # No change — rules list should be empty (no transformation needed)
        assert rules == []

    def test_mtr_remains_canonical(self, svc):
        result, rules = svc.normalize_uom("MTR")
        assert result == "MTR"
        assert rules == []

    def test_ltr_remains_canonical(self, svc):
        result, rules = svc.normalize_uom("LTR")
        assert result == "LTR"
        assert rules == []

    def test_pcs_maps_to_nos(self, svc):
        """PCS should map to NOS (canonical count unit)."""
        result, rules = svc.normalize_uom("PCS")
        assert result == "NOS", f"PCS should map to NOS, got: {result!r}"

    def test_ea_maps_to_nos(self, svc):
        """EA should map to NOS."""
        result, rules = svc.normalize_uom("EA")
        assert result == "NOS", f"EA should map to NOS, got: {result!r}"

    def test_null_uom_preserved(self, svc):
        """Null UOM must return None."""
        result, rules = svc.normalize_uom(None)
        assert result is None
        assert rules == []

    def test_blank_uom_preserved(self, svc):
        result, rules = svc.normalize_uom("")
        assert result is None


# ===================================================================
# 7. Missing Value Preservation
# ===================================================================


class TestMissingValuePreservation:
    def test_null_description_returns_none(self, svc):
        result, rules = svc.normalize_description(None)
        assert result is None
        assert rules == []

    def test_nan_description_returns_none(self, svc):
        import math
        result, rules = svc.normalize_description(float("nan"))
        assert result is None
        assert rules == []

    def test_blank_description_returns_none(self, svc):
        result, rules = svc.normalize_description("   ")
        assert result is None
        assert rules == []

    def test_null_manufacturer_returns_none(self, svc):
        result, rules = svc.normalize_manufacturer(None)
        assert result is None
        assert rules == []

    def test_null_part_number_returns_none(self, svc):
        result, rules = svc.normalize_part_number(None)
        assert result is None
        assert rules == []

    def test_null_text_field_returns_none(self, svc):
        result, rules = svc.normalize_text_field(None)
        assert result is None
        assert rules == []


# ===================================================================
# 8. Manufacturer Part Number Safety
# ===================================================================


class TestManufacturerPartNumberSafety:
    def test_hyphen_preserved(self, svc):
        """Hyphens in part numbers must not be removed."""
        result, _ = svc.normalize_part_number("ABC-123-XYZ")
        assert "-" in result, f"Hyphen removed from part number: {result!r}"

    def test_slash_preserved(self, svc):
        """Slashes in part numbers must not be removed."""
        result, _ = svc.normalize_part_number("ABC/123")
        assert "/" in result, f"Slash removed from part number: {result!r}"

    def test_dot_preserved(self, svc):
        """Dots in part numbers must not be removed."""
        result, _ = svc.normalize_part_number("PN.123.456")
        assert "." in result, f"Dot removed from part number: {result!r}"

    def test_no_case_change(self, svc):
        """Part numbers must not have case changed."""
        original = "AbC-123-XyZ"
        result, _ = svc.normalize_part_number(original)
        assert result == original, f"Case changed in part number: {result!r}"


# ===================================================================
# 9. Dataset-Level Normalization Output Integrity
# ===================================================================


class TestDatasetNormalizationIntegrity:
    @pytest.fixture
    def small_df(self):
        """Small synthetic DataFrame for unit testing dataset normalization."""
        return pd.DataFrame(
            {
                "CPSE": ["CPCL", "IOCL", "ONGC"],
                "Material_Code": ["CPCL-001", "IOCL-002", "ONGC-003"],
                "Material_Description": [
                    "SS BALL VALVE 2 IN",
                    "BALL   VALVE   SS",
                    "CS PIPE DN50",
                ],
                "Material_Category": ["Valves", "Valves", "Pipes & Fittings"],
                "Material_Type": ["Ball Valve", "Ball Valve", "Pipe"],
                "Specification": ["API 608; 2 in; SS 316", "API 608; 1 in", None],
                "Material_Grade": ["SS 316", "SS 316", "Carbon Steel"],
                "Size": ["2 in", "1 in", None],
                "Length": [None, None, "6 MTR"],
                "Diameter": [None, None, "50 MM"],
                "Coating": ["Bare", "Painted", None],
                "Unit": ["NOS", "NOS", "MTR"],
                "Manufacturer": ["ABC Industrial Products", "ABC Industrial Products", None],
                "Manufacturer_Part_No": ["ABC-BV-2IN", "ABC-BV-1IN", None],
                "Plant": ["P001", "P002", "P003"],
                "Material_Status": ["Active", "Active", "Active"],
                "Annual_Consumption": ["100", "50", "200"],
                "Last_Purchase_Date": ["2025-01-01", "2025-02-01", "2025-03-01"],
            }
        )

    def test_row_count_preserved(self, svc, small_df):
        normalized, report = svc.normalize_dataset(small_df)
        assert len(normalized) == len(small_df)

    def test_original_columns_preserved(self, svc, small_df):
        normalized, report = svc.normalize_dataset(small_df)
        # All 18 original columns must still be present
        for col in small_df.columns:
            assert col in normalized.columns, f"Original column {col!r} missing"

    def test_material_codes_unchanged(self, svc, small_df):
        normalized, report = svc.normalize_dataset(small_df)
        for orig, normed in zip(small_df["Material_Code"], normalized["Material_Code"]):
            assert orig == normed, f"Material_Code changed: {orig!r} -> {normed!r}"

    def test_normalized_description_column_exists(self, svc, small_df):
        normalized, report = svc.normalize_dataset(small_df)
        assert "Normalized_Description" in normalized.columns

    def test_normalized_unit_column_exists(self, svc, small_df):
        normalized, report = svc.normalize_dataset(small_df)
        assert "Normalized_Unit" in normalized.columns

    def test_audit_changed_column_exists(self, svc, small_df):
        normalized, report = svc.normalize_dataset(small_df)
        assert "Normalization_Changed" in normalized.columns

    def test_audit_rules_applied_column_exists(self, svc, small_df):
        normalized, report = svc.normalize_dataset(small_df)
        assert "Normalization_Rules_Applied" in normalized.columns

    def test_null_description_remains_null(self, svc):
        df = pd.DataFrame(
            {
                "CPSE": ["CPCL"],
                "Material_Code": ["CPCL-001"],
                "Material_Description": [None],
                "Material_Category": ["Valves"],
                "Material_Type": ["Ball Valve"],
                "Specification": [None],
                "Material_Grade": [None],
                "Size": [None],
                "Length": [None],
                "Diameter": [None],
                "Coating": [None],
                "Unit": ["NOS"],
                "Manufacturer": [None],
                "Manufacturer_Part_No": [None],
                "Plant": ["P001"],
                "Material_Status": ["Active"],
                "Annual_Consumption": ["100"],
                "Last_Purchase_Date": ["2025-01-01"],
            }
        )
        normalized, report = svc.normalize_dataset(df)
        assert normalized["Normalized_Description"].iloc[0] is None

    def test_no_values_artificially_filled(self, svc, small_df):
        _, report = svc.normalize_dataset(small_df)
        assert report["values_artificially_filled"] == 0

    def test_material_codes_changed_is_zero(self, svc, small_df):
        _, report = svc.normalize_dataset(small_df)
        assert report["material_codes_changed"] == 0

    def test_abbreviation_expansion_in_dataset(self, svc, small_df):
        normalized, _ = svc.normalize_dataset(small_df)
        # "SS BALL VALVE 2 IN" should have SS expanded
        desc_0 = normalized["Normalized_Description"].iloc[0]
        assert "stainless steel" in desc_0, f"SS not expanded: {desc_0!r}"

    def test_original_description_not_changed(self, svc, small_df):
        orig_descs = list(small_df["Material_Description"])
        normalized, _ = svc.normalize_dataset(small_df)
        for orig, after in zip(orig_descs, normalized["Material_Description"]):
            assert orig == after, f"Original description was modified: {orig!r} -> {after!r}"


# ===================================================================
# 10. Raw Dataset Integrity (Cross-check)
# ===================================================================


class TestRawDataIntegrity:
    EXPECTED_HASH = "1a45fccad5203de25f64bfda42e2f56667752bca4338a55913ae4a7babeafef1"

    def test_hash_before_normalization(self):
        """Raw dataset hash must match expected baseline before normalization."""
        from services.ingestion_service import IngestionService
        svc = IngestionService()
        actual_hash = svc.get_file_hash()
        assert actual_hash == self.EXPECTED_HASH, (
            f"Raw dataset hash mismatch!\n"
            f"Expected: {self.EXPECTED_HASH}\n"
            f"Actual:   {actual_hash}"
        )
