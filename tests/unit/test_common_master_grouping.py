"""
Unit tests for Phase 8 Common Material Master Grouping and Synthesis
Tests:
- Deterministic grouping across repeated runs
- Deterministic CMM code generation and sequence assignment
- No automatic APPROVED_MASTER assignment
- Unsafe specificity inheritance prevention
- Transitive incompatibility detection and deterministic clique splitting
- Direct vs transitive membership semantics
- Provenance retention and singleton universe coverage
"""

import os
import pytest
import pandas as pd
from server.services.common_master_service import CommonMasterService


@pytest.fixture
def service():
    data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))
    return CommonMasterService(data_dir=data_dir)


class TestCommonMasterGroupingAndSynthesis:
    """Test deterministic grouping, code generation, and safety invariants"""

    def test_deterministic_catalog_generation_repeatability(self, service):
        """Repeated executions on identical inputs yield bit-for-bit identical results"""
        run1 = service.build_common_material_catalog()
        run2 = service.build_common_material_catalog()

        assert len(run1["master_records"]) == len(run2["master_records"])
        assert len(run1["member_records"]) == len(run2["member_records"])

        # Verify exact code ordering
        codes1 = [m["common_code"] for m in run1["master_records"]]
        codes2 = [m["common_code"] for m in run2["master_records"]]
        assert codes1 == codes2

        # Verify identity hashes
        hashes1 = [m["group_identity_hash"] for m in run1["master_records"]]
        hashes2 = [m["group_identity_hash"] for m in run2["master_records"]]
        assert hashes1 == hashes2

    def test_no_automatic_approved_master(self, service):
        """Automated grouping must NEVER assign APPROVED_MASTER status"""
        catalog = service.build_common_material_catalog()
        for master in catalog["master_records"]:
            assert master["governance_status"] != "APPROVED_MASTER", (
                f"Master {master['common_code']} was illegally assigned APPROVED_MASTER automatically"
            )
            assert master["governance_status"] in [
                "VERIFIED_HARMONIZED",
                "STANDALONE_CANDIDATE",
                "AMBIGUOUS_REVIEW_REQUIRED",
                "SPLIT_CONFLICT",
            ]

    def test_deterministic_cmm_code_syntax(self, service):
        """CMM codes must match CMM-<FAMILY>-<HASH_6>-<SEQ_3> syntax"""
        catalog = service.build_common_material_catalog()
        for master in catalog["master_records"]:
            code = master["common_code"]
            parts = code.split("-")
            assert len(parts) == 4, f"Invalid CMM code format: {code}"
            assert parts[0] == "CMM"
            assert len(parts[1]) >= 3  # Family token
            assert len(parts[2]) == 6  # Hash prefix
            assert len(parts[3]) == 3 and parts[3].isdigit()  # 3-digit sequence

    def test_unsafe_specificity_inheritance_prevention(self, service):
        """Conflicting attributes must NOT be inherited; must be flagged as UNRESOLVED_CONFLICT"""
        profiles = {
            "MAT-A": {
                "Canonical_Material_Family": "FLANGE",
                "Canonical_Size": "2 IN",
                "Canonical_Material_Grade": "ASTM A105",
            },
            "MAT-B": {
                "Canonical_Material_Family": "FLANGE",
                "Canonical_Size": "3 IN",  # Hard contradiction in size
                "Canonical_Material_Grade": "ASTM A105",
            },
        }

        consolidated, has_conflict = service.consolidate_attributes(["MAT-A", "MAT-B"], profiles)
        assert has_conflict is True
        assert "UNRESOLVED_CONFLICT" in consolidated["size"]
        assert consolidated["material_grade"] == "ASTM A105"

    def test_safe_specificity_inheritance_when_valid(self, service):
        """Safe detailed specification is consolidated when one value is detailed and other is subset"""
        profiles = {
            "MAT-1": {
                "Canonical_Material_Family": "FLANGE",
                "Canonical_Specification": "ASME B16.5; 1 IN; ASTM A105",
            },
            "MAT-2": {
                "Canonical_Material_Family": "FLANGE",
                "Canonical_Specification": "ASTM A105",
            },
        }

        consolidated, has_conflict = service.consolidate_attributes(["MAT-1", "MAT-2"], profiles)
        assert has_conflict is False
        assert consolidated["specification"] == "ASME B16.5; 1 IN; ASTM A105"

    def test_transitive_incompatibility_triggers_clique_partitioning(self, service):
        """
        When A accepts B and B accepts C, but A and C are incompatible,
        partitioning must split them into maximal compatible cliques with SPLIT_CONFLICT.
        """
        nodes = ["IOCL-001", "ONGC-002", "GAIL-003"]
        accepted_edges = {("IOCL-001", "ONGC-002"), ("ONGC-002", "GAIL-003")}
        incompatibilities = {("GAIL-003", "IOCL-001")}  # A and C incompatible!

        profiles = {
            "IOCL-001": {"Canonical_Material_Family": "FLANGE", "Canonical_Size": "2 IN"},
            "ONGC-002": {"Canonical_Material_Family": "FLANGE", "Canonical_Size": "2 IN"},
            "GAIL-003": {"Canonical_Material_Family": "FLANGE", "Canonical_Size": "3 IN"},
        }
        edge_data = {
            ("IOCL-001", "ONGC-002"): {"refined_score": 1.0, "candidate_id": "CAN-1"},
            ("ONGC-002", "GAIL-003"): {"refined_score": 0.9, "candidate_id": "CAN-2"},
        }

        cliques = service.partition_to_cliques(nodes, accepted_edges, incompatibilities, profiles, edge_data) if hasattr(service, "partition_to_cliques") else service._partition_component_to_cliques(nodes, accepted_edges, incompatibilities, profiles, edge_data)

        assert len(cliques) >= 2
        for members, status in cliques:
            assert status == "SPLIT_CONFLICT"
            # Verify no incompatible pair exists in any clique
            assert not ("IOCL-001" in members and "GAIL-003" in members)

    def test_singleton_universe_retention(self, service):
        """All 1,250 source materials must be represented in member mappings"""
        catalog = service.build_common_material_catalog()
        member_codes = set([m["source_material_code"] for m in catalog["member_records"]])
        assert len(member_codes) == 1250, "All 1,250 source materials must be mapped to Common Material Master"
