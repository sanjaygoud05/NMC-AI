"""
Unit Tests for Phase 6 — Technical Validation & Confidence Refinement
Tests engineering validation rules, 4-tier conflict hierarchy, reason codes,
pure technical review prioritization, upstream conflict preservation, and benchmark cases.
"""

import pytest
from server.services.validation_service import validation_service
from server.services.confidence_service import confidence_service


class TestBenchmarkValidationCases:
    """Mandatory Benchmark Validation Cases"""

    def test_strong_same_material_across_cpse(self):
        """Identical material across CPSEs must be VALIDATED_COMPATIBLE with NO_CONFLICT and HIGH confidence"""
        cand_row = {
            "candidate_id": "CAN-000001",
            "source_material_code": "IOCL-101",
            "source_cpse": "IOCL",
            "candidate_material_code": "ONGC-202",
            "candidate_cpse": "ONGC",
            "canonical_key_exact": True,
            "final_match_score": 1.0,
            "attribute_agreement": 1.0,
            "conflict_present": False,
        }
        src_mat = {
            "Canonical_Material_Family": "VALVE",
            "Canonical_Material_Type": "BALL VALVE",
            "Canonical_Material": "STAINLESS STEEL",
            "Canonical_Material_Grade": "SS 316",
            "Canonical_Size": "1 IN",
            "Canonical_Pressure_Class": "150#",
            "Canonical_Standard": "API 608",
        }
        tgt_mat = dict(src_mat)

        val_res = validation_service.evaluate_candidate(cand_row, src_mat, tgt_mat)
        conf_res = confidence_service.refine_candidate(val_res, cand_row)

        assert val_res["engineering_conflict_class"] == "NO_CONFLICT"
        assert val_res["validation_status"] == "VALIDATED_COMPATIBLE"
        assert "EXACT_CANONICAL_KEY" in val_res["reason_codes"]
        assert conf_res["refined_confidence"] == "HIGH"
        assert conf_res["refined_score"] >= 0.85

    def test_astm_a105_vs_a105_representation_difference(self):
        """ASTM A105 vs A105 must be REPRESENTATION_DIFFERENCE and PROBABLE_COMPATIBLE, not claimed resolved"""
        cand_row = {
            "candidate_id": "CAN-000002",
            "source_material_code": "IOCL-102",
            "source_cpse": "IOCL",
            "candidate_material_code": "HPCL-203",
            "candidate_cpse": "HPCL",
            "canonical_key_exact": False,
            "final_match_score": 0.80,
            "attribute_agreement": 0.90,
            "conflict_present": False,
        }
        src_mat = {
            "Canonical_Material_Family": "VALVE",
            "Canonical_Material_Type": "GATE VALVE",
            "Canonical_Material": "CARBON STEEL",
            "Canonical_Material_Grade": "ASTM A105",
            "Canonical_Size": "2 IN",
        }
        tgt_mat = {
            "Canonical_Material_Family": "VALVE",
            "Canonical_Material_Type": "GATE VALVE",
            "Canonical_Material": "CARBON STEEL",
            "Canonical_Material_Grade": "A105",
            "Canonical_Size": "2 IN",
        }

        val_res = validation_service.evaluate_candidate(cand_row, src_mat, tgt_mat)
        conf_res = confidence_service.refine_candidate(val_res, cand_row)

        assert val_res["engineering_conflict_class"] == "REPRESENTATION_DIFFERENCE"
        assert val_res["validation_status"] == "PROBABLE_COMPATIBLE"
        assert "REPRESENTATION_COMPATIBLE" in val_res["reason_codes"]
        assert not any("RESOLVED" in rc for rc in val_res["reason_codes"])
        assert conf_res["refined_score"] >= 0.70

    def test_m16_vs_m16x75_soft_engineering_difference(self):
        """M16 vs M16X75 must be SOFT_ENGINEERING_DIFFERENCE, REVIEW_REQUIRED, and retained as candidate"""
        cand_row = {
            "candidate_id": "CAN-000003",
            "source_material_code": "BPCL-103",
            "source_cpse": "BPCL",
            "candidate_material_code": "CPCL-204",
            "candidate_cpse": "CPCL",
            "canonical_key_exact": False,
            "final_match_score": 0.75,
            "attribute_agreement": 0.85,
            "conflict_present": False,
        }
        src_mat = {
            "Canonical_Material_Family": "FASTENER",
            "Canonical_Material_Type": "BOLT",
            "Canonical_Material": "CARBON STEEL",
            "Canonical_Size": "M16",
        }
        tgt_mat = {
            "Canonical_Material_Family": "FASTENER",
            "Canonical_Material_Type": "BOLT",
            "Canonical_Material": "CARBON STEEL",
            "Canonical_Size": "M16X75",
        }

        val_res = validation_service.evaluate_candidate(cand_row, src_mat, tgt_mat)
        conf_res = confidence_service.refine_candidate(val_res, cand_row)

        assert val_res["engineering_conflict_class"] == "SOFT_ENGINEERING_DIFFERENCE"
        assert val_res["validation_status"] == "REVIEW_REQUIRED"
        assert "FASTENER_DIM_PARTIAL" in val_res["reason_codes"]
        assert conf_res["review_priority"] == "CRITICAL"  # Cross-CPSE soft difference
        assert conf_res["refined_confidence"] == "MEDIUM"

    def test_ss304_vs_ss316_hard_incompatible(self):
        """SS 304 vs SS 316 metallurgy mismatch must be HARD_INCOMPATIBLE, capped < 0.40, cannot be HIGH"""
        cand_row = {
            "candidate_id": "CAN-000004",
            "source_material_code": "IOCL-104",
            "source_cpse": "IOCL",
            "candidate_material_code": "ONGC-205",
            "candidate_cpse": "ONGC",
            "canonical_key_exact": False,
            "final_match_score": 0.88,
            "attribute_agreement": 0.80,
            "conflict_present": False,
        }
        src_mat = {
            "Canonical_Material_Family": "VALVE",
            "Canonical_Material_Type": "BALL VALVE",
            "Canonical_Material": "STAINLESS STEEL",
            "Canonical_Material_Grade": "SS 304",
            "Canonical_Size": "2 IN",
        }
        tgt_mat = {
            "Canonical_Material_Family": "VALVE",
            "Canonical_Material_Type": "BALL VALVE",
            "Canonical_Material": "STAINLESS STEEL",
            "Canonical_Material_Grade": "SS 316",
            "Canonical_Size": "2 IN",
        }

        val_res = validation_service.evaluate_candidate(cand_row, src_mat, tgt_mat)
        conf_res = confidence_service.refine_candidate(val_res, cand_row)

        assert val_res["engineering_conflict_class"] == "HARD_INCOMPATIBLE"
        assert val_res["validation_status"] == "ENGINEERING_INCOMPATIBLE"
        assert "GRADE_MISMATCH" in val_res["reason_codes"]
        assert conf_res["refined_score"] < 0.40
        assert conf_res["refined_confidence"] == "LOW"

    def test_2in_vs_3in_size_hard_incompatible(self):
        """2 IN vs 3 IN size mismatch must be HARD_INCOMPATIBLE, capped < 0.40, cannot be HIGH"""
        cand_row = {
            "candidate_id": "CAN-000005",
            "source_material_code": "HPCL-105",
            "source_cpse": "HPCL",
            "candidate_material_code": "BPCL-206",
            "candidate_cpse": "BPCL",
            "canonical_key_exact": False,
            "final_match_score": 0.85,
            "attribute_agreement": 0.80,
            "conflict_present": False,
        }
        src_mat = {
            "Canonical_Material_Family": "PIPE",
            "Canonical_Material_Type": "SEAMLESS PIPE",
            "Canonical_Material": "CARBON STEEL",
            "Canonical_Size": "2 IN",
        }
        tgt_mat = {
            "Canonical_Material_Family": "PIPE",
            "Canonical_Material_Type": "SEAMLESS PIPE",
            "Canonical_Material": "CARBON STEEL",
            "Canonical_Size": "3 IN",
        }

        val_res = validation_service.evaluate_candidate(cand_row, src_mat, tgt_mat)
        conf_res = confidence_service.refine_candidate(val_res, cand_row)

        assert val_res["engineering_conflict_class"] == "HARD_INCOMPATIBLE"
        assert val_res["validation_status"] == "ENGINEERING_INCOMPATIBLE"
        assert "SIZE_MISMATCH" in val_res["reason_codes"]
        assert conf_res["refined_score"] < 0.40
        assert conf_res["refined_confidence"] == "LOW"

    def test_astm_a105_vs_a216_wcb_hard_incompatible(self):
        """ASTM A105 vs ASTM A216 WCB (forging vs casting) must be HARD_INCOMPATIBLE, capped < 0.40"""
        cand_row = {
            "candidate_id": "CAN-000006",
            "source_material_code": "CPCL-106",
            "source_cpse": "CPCL",
            "candidate_material_code": "IOCL-207",
            "candidate_cpse": "IOCL",
            "canonical_key_exact": False,
            "final_match_score": 0.82,
            "attribute_agreement": 0.75,
            "conflict_present": False,
        }
        src_mat = {
            "Canonical_Material_Family": "VALVE",
            "Canonical_Material_Type": "GLOBE VALVE",
            "Canonical_Material": "CARBON STEEL",
            "Canonical_Material_Grade": "ASTM A105",
            "Canonical_Size": "1 IN",
        }
        tgt_mat = {
            "Canonical_Material_Family": "VALVE",
            "Canonical_Material_Type": "GLOBE VALVE",
            "Canonical_Material": "CARBON STEEL",
            "Canonical_Material_Grade": "ASTM A216 WCB",
            "Canonical_Size": "1 IN",
        }

        val_res = validation_service.evaluate_candidate(cand_row, src_mat, tgt_mat)
        conf_res = confidence_service.refine_candidate(val_res, cand_row)

        assert val_res["engineering_conflict_class"] == "HARD_INCOMPATIBLE"
        assert val_res["validation_status"] == "ENGINEERING_INCOMPATIBLE"
        assert "GRADE_MISMATCH" in val_res["reason_codes"]
        assert conf_res["refined_score"] < 0.40
        assert conf_res["refined_confidence"] == "LOW"


class TestEngineeringPrecedenceAndSafety:
    """Precedence of engineering attributes over text/semantic similarity"""

    def test_semantic_similarity_overruled_by_engineering_conflict(self):
        """A pair with 0.99 semantic similarity must be disqualified if physical attributes conflict"""
        cand_row = {
            "candidate_id": "CAN-000007",
            "source_material_code": "IOCL-107",
            "source_cpse": "IOCL",
            "candidate_material_code": "ONGC-208",
            "candidate_cpse": "ONGC",
            "embedding_similarity": 0.99,
            "description_similarity": 0.98,
            "final_match_score": 0.95,
            "canonical_key_exact": False,
            "conflict_present": False,
        }
        # Size mismatch (2" vs 3")
        src_mat = {"Canonical_Material_Family": "VALVE", "Canonical_Size": "2 IN"}
        tgt_mat = {"Canonical_Material_Family": "VALVE", "Canonical_Size": "3 IN"}

        val_res = validation_service.evaluate_candidate(cand_row, src_mat, tgt_mat)
        conf_res = confidence_service.refine_candidate(val_res, cand_row)

        assert val_res["validation_status"] == "ENGINEERING_INCOMPATIBLE"
        assert conf_res["refined_score"] < 0.40
        assert conf_res["refined_confidence"] == "LOW"

    def test_upstream_conflict_preserved_unmodified(self):
        """Phase 3/4 conflict flags must be preserved unmodified and propagate to evidence"""
        cand_row = {
            "candidate_id": "CAN-000008",
            "source_material_code": "HPCL-108",
            "source_cpse": "HPCL",
            "candidate_material_code": "BPCL-209",
            "candidate_cpse": "BPCL",
            "conflict_present": True,
            "conflict_details": "Extracted Grade differs from Description Specification",
            "final_match_score": 0.70,
        }
        src_mat = {"Standardization_Conflict_Preserved": True}
        tgt_mat = {}

        val_res = validation_service.evaluate_candidate(cand_row, src_mat, tgt_mat)
        conf_res = confidence_service.refine_candidate(val_res, cand_row)

        assert val_res["upstream_conflict_present"] is True
        assert val_res["upstream_conflict_preserved"] is True
        assert "UPSTREAM_CONFLICT_PRESERVED" in val_res["reason_codes"]
        assert "Upstream Conflict Preserved" in conf_res["validation_evidence"]

    def test_pure_technical_review_priority(self):
        """Review priority must depend strictly on technical ambiguity and CPSE relationship, not procurement spend"""
        cand_cross = {
            "candidate_id": "CAN-000009",
            "source_cpse": "IOCL",
            "candidate_cpse": "ONGC",
            "final_match_score": 0.70,
        }
        cand_same = {
            "candidate_id": "CAN-000010",
            "source_cpse": "IOCL",
            "candidate_cpse": "IOCL",
            "final_match_score": 0.70,
        }
        val_soft = {
            "validation_status": "REVIEW_REQUIRED",
            "engineering_conflict_class": "SOFT_ENGINEERING_DIFFERENCE",
            "reason_codes": ["FASTENER_DIM_PARTIAL"],
            "upstream_conflict_present": False,
            "upstream_conflict_preserved": False,
            "hard_conflict_reasons": [],
            "soft_difference_reasons": ["Fastener dimension partial"],
            "repr_difference_reasons": [],
        }

        conf_cross = confidence_service.refine_candidate(val_soft, cand_cross)
        conf_same = confidence_service.refine_candidate(val_soft, cand_same)

        assert conf_cross["review_priority"] == "CRITICAL"
        assert conf_same["review_priority"] == "MEDIUM"

    def test_status_taxonomy_conformance(self):
        """All validation statuses must conform strictly to the 5 allowed enum values"""
        allowed = {
            "VALIDATED_COMPATIBLE",
            "PROBABLE_COMPATIBLE",
            "REVIEW_REQUIRED",
            "ENGINEERING_INCOMPATIBLE",
            "INSUFFICIENT_EVIDENCE",
        }
        for status in allowed:
            val_res = {
                "validation_status": status,
                "engineering_conflict_class": "NO_CONFLICT",
                "reason_codes": [],
                "upstream_conflict_present": False,
                "upstream_conflict_preserved": False,
                "hard_conflict_reasons": [],
                "soft_difference_reasons": [],
                "repr_difference_reasons": [],
            }
            cand = {"final_match_score": 0.85, "source_cpse": "IOCL", "candidate_cpse": "ONGC"}
            conf = confidence_service.refine_candidate(val_res, cand)
            assert status in allowed
            assert conf["refined_confidence"] in ("HIGH", "MEDIUM", "LOW")
            assert conf["review_priority"] in ("CRITICAL", "HIGH", "MEDIUM", "LOW")


class TestPhase6DatasetIntegrityAndArtifacts:
    """Tests for Phase 6 output artifact integrity and schema"""

    def test_validated_candidates_file_and_rows(self):
        import os
        import pandas as pd

        ws_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        val_csv = os.path.join(ws_root, "data", "processed", "validated_candidates.csv")
        assert os.path.exists(val_csv), f"Missing {val_csv}"

        df = pd.read_csv(val_csv, low_memory=False)
        assert len(df) == 37500, f"Expected 37,500 rows, got {len(df)}"

        # Check required columns
        required_cols = [
            "candidate_id", "source_material_code", "source_cpse",
            "candidate_material_code", "candidate_cpse", "source_canonical_key",
            "candidate_canonical_key", "canonical_key_exact", "description_similarity",
            "embedding_similarity", "attribute_agreement", "validation_status",
            "validation_reason_codes", "refined_score", "refined_confidence",
            "review_priority", "validation_evidence", "upstream_conflict_present",
            "upstream_conflict_details", "upstream_conflict_preserved"
        ]
        for col in required_cols:
            assert col in df.columns, f"Missing required column: {col}"

    def test_hard_incompatible_scores_strictly_capped(self):
        import os
        import pandas as pd

        ws_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        val_csv = os.path.join(ws_root, "data", "processed", "validated_candidates.csv")
        df = pd.read_csv(val_csv, low_memory=False)

        incompat = df[df["validation_status"] == "ENGINEERING_INCOMPATIBLE"]
        assert len(incompat) > 0

        # Refined score must be strictly < 0.40
        assert (incompat["refined_score"] < 0.40).all(), "Hard incompatible score exceeded 0.40 cap"
        # Refined confidence must be strictly LOW
        assert (incompat["refined_confidence"] == "LOW").all(), "Hard incompatible received non-LOW confidence"

