"""
Unit Tests for Phase 4: Material Standardization & Canonicalization
SIH26099 Material Harmonization Platform

Coverage:
- Formatting: case, whitespace, safe punctuation normalization
- Material & Grade Separation: Material and Material Grade kept strictly separate
- Technical identifiers: API, ASME, ASTM, IEC, ISO, IS, SAE, EN
- Sizes: inches, fractions, mixed inches, mm, metric bolts, cable sq mm, current
- Coatings & Connections: casing and safe formatting
- Conflict Preservation: extraction_has_conflict strictly preserved
- Zero Invention Policy: No unsupported values added to bearings, pumps, etc.
- Technical Distinction: M16 vs M16X75, 1 IN vs 2 IN, BALL VALVE vs GATE VALVE
- Determinism & Idempotence: Repeated runs produce identical outputs
- Row Count Preservation: 1,250 rows in == 1,250 rows out
"""

import sys
import hashlib
from pathlib import Path
import pandas as pd
import pytest

server_dir = Path(__file__).resolve().parent.parent.parent / "server"
if str(server_dir) not in sys.path:
    sys.path.insert(0, str(server_dir))

from services.standardization_service import StandardizationService, CANONICAL_ATTR_ORDER


@pytest.fixture
def svc():
    return StandardizationService()


def _make_record(**kwargs):
    """Helper to create a Phase 3 extracted record dictionary."""
    base = {f"EX_{attr}": None for attr in CANONICAL_ATTR_ORDER}
    base["Material_Code"] = "TEST-001"
    base["Material_Description"] = "TEST MATERIAL"
    base["extraction_has_conflict"] = False
    base["extraction_conflicts_detail"] = None
    for k, v in kwargs.items():
        if k in CANONICAL_ATTR_ORDER:
            base[f"EX_{k}"] = v
        else:
            base[k] = v
    return base


class TestBasicFormatting:
    def test_family_and_type_casing(self, svc):
        rec = _make_record(material_family="valve", material_type="ball valve")
        res = svc.standardize_record(rec)
        assert res["Canonical_Material_Family"] == "VALVE"
        assert res["Canonical_Material_Type"] == "BALL VALVE"
        assert "VALVE | BALL VALVE" in res["Standardized_Description"]

    def test_construction_and_orientation_casing(self, svc):
        rec = _make_record(construction="floating", orientation="horizontal")
        res = svc.standardize_record(rec)
        assert res["Canonical_Construction"] == "FLOATING"
        assert res["Canonical_Orientation"] == "HORIZONTAL"

    def test_whitespace_and_punctuation_normalization(self, svc):
        rec = _make_record(coating="zinc-plated", connection_type="weld-neck")
        res = svc.standardize_record(rec)
        assert res["Canonical_Coating"] == "ZINC PLATED"
        assert res["Canonical_Connection_Type"] == "WELD NECK"


class TestMaterialAndGradeSeparation:
    def test_material_and_grade_kept_separate(self, svc):
        """Material=STAINLESS STEEL and Grade=316 must be kept semantically separate."""
        rec = _make_record(
            material_family="valve",
            material_type="ball valve",
            material="stainless steel",
            material_grade="316",
        )
        res = svc.standardize_record(rec)
        assert res["Canonical_Material"] == "STAINLESS STEEL"
        assert res["Canonical_Material_Grade"] == "316"
        # Must not fabricate "SS 316" if grade was purely "316"
        assert "STAINLESS STEEL | 316" in res["Standardized_Description"]

    def test_ss_material_alias(self, svc):
        rec = _make_record(material="ss")
        res = svc.standardize_record(rec)
        assert res["Canonical_Material"] == "STAINLESS STEEL"

    def test_cs_material_alias(self, svc):
        rec = _make_record(material="cs")
        res = svc.standardize_record(rec)
        assert res["Canonical_Material"] == "CARBON STEEL"


class TestTechnicalIdentifiers:
    def test_api_standards(self, svc):
        for std in ["API 5L", "API 608", "API 610", "API 600", "API 526"]:
            rec = _make_record(standard=std.lower())
            res = svc.standardize_record(rec)
            assert res["Canonical_Standard"] == std

    def test_asme_standard(self, svc):
        rec = _make_record(standard="asme b16.5")
        res = svc.standardize_record(rec)
        assert res["Canonical_Standard"] == "ASME B16.5"

    def test_astm_grade(self, svc):
        rec = _make_record(material_grade="a105")
        res = svc.standardize_record(rec)
        assert res["Canonical_Material_Grade"] == "ASTM A105"

    def test_iec_standard(self, svc):
        rec = _make_record(standard="iec 60751")
        res = svc.standardize_record(rec)
        assert res["Canonical_Standard"] == "IEC 60751"

    def test_iso_standard(self, svc):
        rec = _make_record(standard="iso 15")
        res = svc.standardize_record(rec)
        assert res["Canonical_Standard"] == "ISO 15"


class TestSizes:
    def test_integer_inch(self, svc):
        rec = _make_record(size="1 in")
        res = svc.standardize_record(rec)
        assert res["Canonical_Size"] == "1 IN"

    def test_fraction_inch(self, svc):
        rec = _make_record(size="3/4 in")
        res = svc.standardize_record(rec)
        assert res["Canonical_Size"] == "3/4 IN"

    def test_mixed_fraction_inch(self, svc):
        rec = _make_record(size="1-1/2 in")
        res = svc.standardize_record(rec)
        assert res["Canonical_Size"] == "1-1/2 IN"

    def test_millimeter(self, svc):
        rec = _make_record(size="80 mm")
        res = svc.standardize_record(rec)
        assert res["Canonical_Size"] == "80 MM"

    def test_metric_bolt_size(self, svc):
        rec = _make_record(size="M16")
        res = svc.standardize_record(rec)
        assert res["Canonical_Size"] == "M16"

    def test_cable_sq_mm(self, svc):
        rec = _make_record(size="25 sq mm")
        res = svc.standardize_record(rec)
        assert res["Canonical_Size"] == "25 SQ MM"

    def test_current_ampere(self, svc):
        rec = _make_record(size="10 a")
        res = svc.standardize_record(rec)
        assert res["Canonical_Size"] == "10 A"


class TestTechnicalDistinction:
    def test_m16_and_m16x75_remain_distinguishable(self, svc):
        rec1 = _make_record(material_family="fastener", material_type="bolt", size="M16")
        rec2 = _make_record(material_family="fastener", material_type="bolt", size="M16X75")
        res1 = svc.standardize_record(rec1)
        res2 = svc.standardize_record(rec2)
        assert res1["Canonical_Size"] != res2["Canonical_Size"]
        assert res1["Canonical_Material_Key"] != res2["Canonical_Material_Key"]

    def test_valve_types_remain_distinguishable(self, svc):
        rec1 = _make_record(material_family="valve", material_type="ball valve", size="2 in")
        rec2 = _make_record(material_family="valve", material_type="gate valve", size="2 in")
        res1 = svc.standardize_record(rec1)
        res2 = svc.standardize_record(rec2)
        assert res1["Canonical_Material_Type"] != res2["Canonical_Material_Type"]
        assert res1["Canonical_Material_Key"] != res2["Canonical_Material_Key"]

    def test_different_sizes_have_different_keys(self, svc):
        rec1 = _make_record(material_family="valve", material_type="ball valve", size="1 in")
        rec2 = _make_record(material_family="valve", material_type="ball valve", size="2 in")
        res1 = svc.standardize_record(rec1)
        res2 = svc.standardize_record(rec2)
        assert res1["Canonical_Material_Key"] != res2["Canonical_Material_Key"]


class TestZeroInventionPolicy:
    def test_bearing_without_grade_remains_absent(self, svc):
        """BEARING 6207 must not automatically gain Chrome Steel or ISO 15."""
        rec = _make_record(
            material_family="bearing",
            material_type="ball bearing",
            size="6207",
            # material_grade and standard are NOT provided
        )
        res = svc.standardize_record(rec)
        assert res["Canonical_Material_Grade"] is None
        assert res["Canonical_Standard"] is None
        assert "CHROME" not in res["Standardized_Description"]
        assert "ISO" not in res["Standardized_Description"]

    def test_pump_without_standard_remains_absent(self, svc):
        """Pump must not automatically gain API 610."""
        rec = _make_record(
            material_family="pump",
            material_type="centrifugal pump",
            size="80 mm",
        )
        res = svc.standardize_record(rec)
        assert res["Canonical_Standard"] is None
        assert "API" not in res["Standardized_Description"]


class TestConflictPreservation:
    def test_conflict_flag_and_detail_strictly_preserved(self, svc):
        rec = _make_record(
            material_family="fastener",
            material_type="bolt",
            size="M16",
            extraction_has_conflict=True,
            extraction_conflicts_detail="size: 'M16' vs 'M16X75'",
        )
        res = svc.standardize_record(rec)
        assert res["Standardization_Conflict_Preserved"] is True
        assert res["extraction_has_conflict"] is True
        assert "M16X75" in res["extraction_conflicts_detail"]


class TestDeterminismAndIdempotence:
    def test_identical_input_produces_identical_output(self, svc):
        rec = _make_record(
            material_family="valve",
            material_type="ball valve",
            construction="floating",
            material="stainless steel",
            material_grade="SS 316",
            size="1 in",
            standard="API 608",
        )
        res1 = svc.standardize_record(rec)
        res2 = svc.standardize_record(rec)
        assert res1["Standardized_Description"] == res2["Standardized_Description"]
        assert res1["Canonical_Material_Key"] == res2["Canonical_Material_Key"]
        assert res1["Standardization_Rules_Applied"] == res2["Standardization_Rules_Applied"]


class TestDatasetIntegrity:
    def test_row_count_and_columns_preserved(self, svc):
        ext_path = Path("data/processed/extracted_attributes.csv")
        assert ext_path.exists()
        df = pd.read_csv(ext_path, dtype=str)
        out_df, report = svc.standardize_dataset(df)
        assert len(out_df) == len(df) == 1250
        assert "Canonical_Material_Key" in out_df.columns
        assert "Standardized_Description" in out_df.columns
        assert report["dataset"]["input_rows"] == 1250
        assert report["dataset"]["output_rows"] == 1250

    def test_reconstruct_key_matches_canonical_material_key_all_rows(self, svc):
        """Verify Canonical_Material_Key is generated programmatically from the defined stable attribute order for all 1,250 rows."""
        import re
        from server.services.standardization_service import KEY_ATTR_ORDER, _clean_val

        csv_path = Path("data/processed/standardized_materials.csv")
        assert csv_path.exists()
        df = pd.read_csv(csv_path, dtype=str)
        assert len(df) == 1250

        key_cols = [
            f"Canonical_{'_'.join([part.capitalize() for part in attr.split('_')])}"
            for attr in KEY_ATTR_ORDER
        ]

        mismatches = []
        for _, row in df.iterrows():
            tokens = []
            for col in key_cols:
                val = _clean_val(row.get(col))
                if val:
                    clean_token = re.sub(r"[\s/\-]+", "_", val.upper())
                    clean_token = re.sub(r"[^A-Z0-9_]+", "", clean_token).strip("_")
                    if clean_token:
                        tokens.append(clean_token)
            expected_key = "|".join(tokens)
            actual_key = row["Canonical_Material_Key"]
            if expected_key != actual_key:
                mismatches.append((row["Material_Code"], expected_key, actual_key))

        assert len(mismatches) == 0, f"Found {len(mismatches)} mismatches in Canonical_Material_Key reconstruction!"
