"""
Unit and regression tests for Phase 5: Candidate Generation & Semantic Matching
Verifies determinism, blocking, ranking, null-aware attribute comparison,
engineering conflict safety, conflict preservation, no metadata leakage, and idempotence.
"""

import hashlib
from pathlib import Path
import pytest
import pandas as pd
import numpy as np

from server.services.matching_service import (
    matching_service, NO_CONFLICT, REPRESENTATION_DIFFERENCE,
    SOFT_ENGINEERING_DIFFERENCE, HARD_INCOMPATIBLE
)
from server.services.embedding_service import embedding_service


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def _make_record(**kwargs):
    default = {
        "Material_Code": "TEST-001",
        "CPSE": "IOCL",
        "Standardized_Description": "VALVE | BALL VALVE | STAINLESS STEEL | SS 316 | 1 IN | API 608",
        "Canonical_Material_Key": "VALVE|BALL_VALVE|STAINLESS_STEEL|SS_316|1_IN|API_608",
        "Canonical_Material_Family": "VALVE",
        "Canonical_Material_Type": "BALL VALVE",
        "Canonical_Material_Subtype": None,
        "Canonical_Material": "STAINLESS STEEL",
        "Canonical_Material_Grade": "SS 316",
        "Canonical_Size": "1 IN",
        "Canonical_Standard": "API 608",
        "Canonical_Coating": None,
        "Canonical_Pressure_Class": None,
        "extraction_has_conflict": False,
        "extraction_conflicts_detail": None,
    }
    default.update(kwargs)
    return default


class TestDeterminismAndIdempotence:
    def test_matching_determinism(self):
        """Same input records must produce identical match scores and evidence."""
        r1 = _make_record(Material_Code="A-1", CPSE="IOCL")
        r2 = _make_record(Material_Code="B-1", CPSE="CPCL", Canonical_Size="1 IN")
        m1 = matching_service.calculate_match(r1, r2)
        m2 = matching_service.calculate_match(r1, r2)
        assert m1["final_match_score"] == m2["final_match_score"]
        assert m1["confidence_level"] == m2["confidence_level"]
        assert m1["engineering_conflict_class"] == m2["engineering_conflict_class"]
        assert m1["evidence_summary"] == m2["evidence_summary"]

    def test_embedding_reproducibility(self):
        """Sentence transformer must produce reproducible vectors for identical text."""
        texts = ["BALL VALVE 1 IN SS 316", "CENTRIFUGAL PUMP 100 MM"]
        e1 = embedding_service.encode_texts(texts)
        e2 = embedding_service.encode_texts(texts)
        np.testing.assert_allclose(e1, e2, atol=1e-6)

    def test_phase5_output_exists_and_row_integrity(self):
        """Verify match_candidates.csv has expected structure and 1,250 source materials represented."""
        cand_path = Path("data/processed/match_candidates.csv")
        assert cand_path.exists(), "match_candidates.csv must exist"
        df = pd.read_csv(cand_path, dtype=str)
        assert len(df) > 0
        assert df["source_material_code"].nunique() == 1250, "All 1,250 materials must have candidates"
        assert "candidate_rank" in df.columns
        assert "final_match_score" in df.columns
        assert "confidence_level" in df.columns
        assert "engineering_conflict_class" in df.columns


class TestCandidateDeduplicationAndCrossCPSE:
    def test_pair_deduplication(self):
        """For any source material, candidate material codes must be unique."""
        cand_path = Path("data/processed/match_candidates.csv")
        df = pd.read_csv(cand_path, dtype=str)
        # Check first 50 source materials for unique candidate codes
        sample_sources = df["source_material_code"].unique()[:50]
        for src in sample_sources:
            cands = df[df["source_material_code"] == src]["candidate_material_code"].tolist()
            assert len(cands) == len(set(cands)), f"Duplicate candidate found for source {src}!"

    def test_cross_cpse_prioritized(self):
        """Cross-CPSE candidates must be generated and represent majority of candidates."""
        cand_path = Path("data/processed/match_candidates.csv")
        df = pd.read_csv(cand_path, dtype=str)
        cross_count = (df["source_cpse"] != df["candidate_cpse"]).sum()
        total_count = len(df)
        ratio = cross_count / total_count
        assert ratio > 0.60, f"Expected >60% cross-CPSE candidates, got {ratio*100:.1f}%"


class TestAttributeComparisonAndNullAwareness:
    def test_missing_values_do_not_match(self):
        """NULL vs NULL must be neutral (None) and not count as positive match."""
        r1 = _make_record(Canonical_Coating=None, Canonical_Pressure_Class=None)
        r2 = _make_record(Canonical_Coating=None, Canonical_Pressure_Class=None)
        sims, score, evaluated = matching_service.compare_attributes(r1, r2)
        assert sims["coating_similarity"] is None
        assert sims["pressure_class_similarity"] is None

    def test_populated_attribute_agreement(self):
        """Identical populated attributes must have similarity 1.0."""
        r1 = _make_record(Canonical_Material_Grade="SS 316", Canonical_Size="1 IN")
        r2 = _make_record(Canonical_Material_Grade="SS 316", Canonical_Size="1 IN")
        sims, score, evaluated = matching_service.compare_attributes(r1, r2)
        assert sims["material_grade_similarity"] == 1.0
        assert sims["size_similarity"] == 1.0


class TestEngineeringSafetyAndConflicts:
    def test_size_safety_2in_vs_3in(self):
        """2 IN vs 3 IN must trigger HARD_INCOMPATIBLE and cannot become HIGH confidence."""
        r1 = _make_record(Canonical_Size="2 IN", Canonical_Material_Key="VALVE|BALL_VALVE|SS_316|2_IN")
        r2 = _make_record(Canonical_Size="3 IN", Canonical_Material_Key="VALVE|BALL_VALVE|SS_316|3_IN")
        m = matching_service.calculate_match(r1, r2)
        assert m["engineering_conflict_class"] == HARD_INCOMPATIBLE
        assert m["engineering_incompatibility"] is True
        assert m["confidence_level"] != "HIGH"
        assert m["final_match_score"] <= 0.60

    def test_grade_safety_ss304_vs_ss316(self):
        """SS 304 vs SS 316 must trigger HARD_INCOMPATIBLE."""
        r1 = _make_record(Canonical_Material_Grade="SS 304", Canonical_Material_Key="VALVE|BALL_VALVE|SS_304|1_IN")
        r2 = _make_record(Canonical_Material_Grade="SS 316", Canonical_Material_Key="VALVE|BALL_VALVE|SS_316|1_IN")
        m = matching_service.calculate_match(r1, r2)
        assert m["engineering_conflict_class"] == HARD_INCOMPATIBLE
        assert m["confidence_level"] != "HIGH"

    def test_fastener_safety_m16_vs_m16x75(self):
        """M16 vs M16X75 is SOFT_ENGINEERING_DIFFERENCE (penalized but retained as candidate)."""
        r1 = _make_record(
            Canonical_Material_Family="FASTENER",
            Canonical_Material_Type="BOLT",
            Canonical_Size="M16",
            Canonical_Material="CARBON STEEL",
            Canonical_Material_Key="FASTENER|BOLT|CARBON_STEEL|M16",
        )
        r2 = _make_record(
            Canonical_Material_Family="FASTENER",
            Canonical_Material_Type="BOLT",
            Canonical_Size="M16X75",
            Canonical_Material="CARBON STEEL",
            Canonical_Material_Key="FASTENER|BOLT|CARBON_STEEL|M16X75",
        )
        m = matching_service.calculate_match(r1, r2)
        assert m["engineering_conflict_class"] == SOFT_ENGINEERING_DIFFERENCE
        assert m["penalty_applied"] > 0

    def test_representation_difference_astm_a105_vs_a105(self):
        """ASTM A105 vs A105 is REPRESENTATION_DIFFERENCE and remains viable."""
        r1 = _make_record(
            Canonical_Material_Family="FLANGE",
            Canonical_Material_Type="WELD NECK FLANGE",
            Canonical_Material_Grade="ASTM A105",
            Canonical_Size="1 IN",
            Canonical_Material_Key="FLANGE|WELD_NECK_FLANGE|ASTM_A105|1_IN",
        )
        r2 = _make_record(
            Canonical_Material_Family="FLANGE",
            Canonical_Material_Type="WELD NECK FLANGE",
            Canonical_Material_Grade="A105",
            Canonical_Size="1 IN",
            Canonical_Material_Key="FLANGE|WELD_NECK_FLANGE|A105|1_IN",
        )
        m = matching_service.calculate_match(r1, r2)
        assert m["engineering_conflict_class"] == REPRESENTATION_DIFFERENCE
        assert m["final_match_score"] >= 0.65

    def test_conflict_preservation(self):
        """Phase 3/4 conflict details must be preserved in candidate output."""
        r1 = _make_record(
            Material_Code="TEST-CONF-1",
            extraction_has_conflict=True,
            extraction_conflicts_detail="size: 'M16' vs 'M16X75'",
        )
        r2 = _make_record(Material_Code="TEST-CONF-2")
        m = matching_service.calculate_match(r1, r2)
        assert m["conflict_present"] is True
        assert "M16X75" in m["conflict_details"]


class TestMetadataLeakagePrevention:
    def test_no_metadata_leakage_in_embeddings(self):
        """Embedding text must not contain Material_Code, CPSE, Plant, or Annual_Consumption."""
        rec = {
            "Material_Code": "SECRET_CODE_12345",
            "CPSE": "SECRET_CPSE_XYZ",
            "Plant": "SECRET_PLANT_LOCATION",
            "Annual_Consumption": "999999",
            "Last_Purchase_Date": "2026-01-01",
            "Standardized_Description": "VALVE | BALL VALVE | SS 316 | 1 IN",
        }
        text = embedding_service.build_engineering_text(rec)
        assert "SECRET_CODE_12345" not in text
        assert "SECRET_CPSE_XYZ" not in text
        assert "SECRET_PLANT_LOCATION" not in text
        assert "999999" not in text
        assert "2026-01-01" not in text
        assert text == "VALVE | BALL VALVE | SS 316 | 1 IN"


class TestCandidateRanking:
    def test_ranking_descending_by_score(self):
        """Candidates for each source material must be sorted by final_match_score DESC."""
        cand_path = Path("data/processed/match_candidates.csv")
        df = pd.read_csv(cand_path, dtype=str)
        sample_sources = df["source_material_code"].unique()[:20]
        for src in sample_sources:
            scores = df[df["source_material_code"] == src]["final_match_score"].astype(float).tolist()
            assert scores == sorted(scores, reverse=True), f"Candidates not sorted DESC for {src}!"
