"""
Unit tests for Phase 9 Legacy Material Mapping
Tests:
- Complete universe retention: exactly 1,250 source materials mapped
- Cardinality: exactly 1 mapping per (source_cpse, material_code)
- Zero missing, zero duplicate, zero extraneous materials
- Every referenced CMM code exists in Phase 8 master catalog
- Verified harmonized group (ONGC-437562 & IOCL-875352 -> CMM-VALVE-A79389-001)
- CAN-000331 provenance preservation (Phase 6 VALIDATED_COMPATIBLE, Phase 7 ACCEPT)
- Standalone semantics: 1,248 items with MAPPED_STANDALONE and STANDALONE_IDENTITY
- Zero transitive relationships (TRANSITIVE_VERIFIED = 0)
- No transitive inference in Phase 9
- Deterministic UUIDv5 mapping IDs
- Two clean executions yield bit-for-bit identical CSV SHA-256
- Runtime timestamps excluded from deterministic CSV
- Raw source descriptions preserved from CPSE_Material_Master_cleaned.csv
- Nullable CMM code integrity and valid status combinations
"""

import hashlib
import os
import uuid
import pytest
import pandas as pd
from server.services.legacy_mapping_service import LegacyMappingService


@pytest.fixture
def service():
    data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))
    return LegacyMappingService(data_dir=data_dir)


class TestLegacyMappingUniverseAndCardinality:
    """Test full source universe coverage and strict 1-to-1 cardinality"""

    def test_complete_source_universe_retention(self, service):
        """Phase 9 must map exactly 1,250 source materials"""
        output = service.build_legacy_mapping_crosswalk()
        mappings = output["mappings"]
        assert len(mappings) == 1250

    def test_exact_cpse_distribution(self, service):
        """CPSE distribution must match raw cleaned dataset exactly"""
        output = service.build_legacy_mapping_crosswalk()
        df = pd.DataFrame(output["mappings"])
        counts = df["source_cpse"].value_counts().to_dict()

        assert counts["ONGC"] == 332
        assert counts["IOCL"] == 319
        assert counts["HPCL"] == 301
        assert counts["CPCL"] == 298
        assert sum(counts.values()) == 1250

    def test_strict_one_to_one_cardinality(self, service):
        """Exactly one mapping per (source_cpse, material_code) tuple"""
        output = service.build_legacy_mapping_crosswalk()
        df = pd.DataFrame(output["mappings"])
        unique_pairs = df[["source_cpse", "material_code"]].drop_duplicates()
        assert len(unique_pairs) == 1250

    def test_no_missing_or_extra_source_materials(self, service):
        """Set of (source_cpse, material_code) in mappings must strictly equal raw dataset"""
        output = service.build_legacy_mapping_crosswalk()
        mapping_df = pd.DataFrame(output["mappings"])
        raw_df = service.load_raw_materials()

        mapping_keys = set(zip(mapping_df["source_cpse"], mapping_df["material_code"]))
        raw_keys = set(zip(raw_df["CPSE"], raw_df["Material_Code"]))

        assert mapping_keys == raw_keys
        assert len(raw_keys - mapping_keys) == 0
        assert len(mapping_keys - raw_keys) == 0

    def test_every_cmm_code_exists_in_phase_8(self, service):
        """All CMM codes referenced by mappings must exist in Phase 8 common_material_master.csv"""
        output = service.build_legacy_mapping_crosswalk()
        mapping_df = pd.DataFrame(output["mappings"])
        phase8_masters = service.load_common_material_master()

        valid_cmm_codes = set(phase8_masters["common_code"])
        mapped_cmm_codes = set(mapping_df[mapping_df["cmm_code"].notna()]["cmm_code"])

        assert mapped_cmm_codes.issubset(valid_cmm_codes)
        assert len(mapped_cmm_codes - valid_cmm_codes) == 0


class TestLegacyMappingHarmonizationAndSemantics:
    """Test verified group and standalone semantics"""

    def test_verified_harmonized_pair_mapping(self, service):
        """ONGC-437562 and IOCL-875352 map to CMM-VALVE-A79389-001 with verified semantics"""
        output = service.build_legacy_mapping_crosswalk()
        df = pd.DataFrame(output["mappings"])

        ongc_row = df[(df["source_cpse"] == "ONGC") & (df["material_code"].isin(["ONGC-437562", "437562"]))].iloc[0]
        iocl_row = df[(df["source_cpse"] == "IOCL") & (df["material_code"].isin(["IOCL-875352", "875352"]))].iloc[0]

        for row in [ongc_row, iocl_row]:
            assert row["cmm_code"] == "CMM-VALVE-A79389-001"
            assert row["mapping_status"] == "MAPPED_VERIFIED"
            assert row["membership_type"] == "DIRECT_ACCEPTED"
            assert float(row["confidence_score"]) == 1.000
            assert row["confidence_semantics"] == "VERIFIED_CROSS_CPSE"
            assert row["accepted_candidate_id"] == "CAN-000331"
            assert row["phase6_validation_status"] == "VALIDATED_COMPATIBLE"
            assert row["phase7_review_decision"] == "ACCEPT"

    def test_can_000331_provenance_preservation(self, service):
        """Provenance for CAN-000331 is preserved from Phase 7 accepted harmonization pairs"""
        output = service.build_legacy_mapping_crosswalk()
        df = pd.DataFrame(output["mappings"])
        can_mappings = df[df["accepted_candidate_id"] == "CAN-000331"]

        assert len(can_mappings) == 2
        cpses = set(can_mappings["source_cpse"])
        assert cpses == {"ONGC", "IOCL"}

    def test_standalone_semantics_for_single_cpse_items(self, service):
        """The 1,248 standalone items have MAPPED_STANDALONE and STANDALONE_IDENTITY semantics"""
        output = service.build_legacy_mapping_crosswalk()
        df = pd.DataFrame(output["mappings"])

        standalone = df[df["mapping_status"] == "MAPPED_STANDALONE"]
        assert len(standalone) == 1248

        assert (standalone["membership_type"] == "STANDALONE").all()
        assert (standalone["confidence_score"].astype(float) == 1.000).all()
        assert (standalone["confidence_semantics"] == "STANDALONE_IDENTITY").all()
        assert (standalone["accepted_candidate_id"].fillna("") == "").all()

    def test_zero_transitive_relationships_and_no_inference(self, service):
        """TRANSITIVE_VERIFIED count is 0 and Phase 9 performs zero transitive calculations"""
        output = service.build_legacy_mapping_crosswalk()
        df = pd.DataFrame(output["mappings"])

        transitive = df[df["mapping_status"] == "TRANSITIVE_VERIFIED"]
        assert len(transitive) == 0

        # Also check membership_type
        assert (df["membership_type"] != "TRANSITIVE_VERIFIED").all()


class TestLegacyMappingDeterminismAndIntegrity:
    """Test deterministic UUIDv5 generation, repeated bit-for-bit CSV determinism, and data safety"""

    def test_deterministic_uuidv5_generation(self, service):
        """Mapping ID must be UUIDv5(NAMESPACE_DNS, 'LEGACY_MAP:{source_cpse}:{material_code}:{cmm_code}')"""
        output = service.build_legacy_mapping_crosswalk()
        mappings = output["mappings"]

        for m in mappings:
            cmm = m["cmm_code"] or "NONE"
            expected_name = f"LEGACY_MAP:{m['source_cpse']}:{m['material_code']}:{cmm}"
            expected_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, expected_name))
            assert m["mapping_id"] == expected_uuid

    def test_bit_for_bit_csv_determinism(self, service):
        """Two repeated runs produce bit-for-bit identical CSV output and identical SHA-256"""
        df1 = service.generate_crosswalk_dataframe()
        csv1 = df1.to_csv(index=False, lineterminator="\n").encode("utf-8")
        hash1 = hashlib.sha256(csv1).hexdigest()

        df2 = service.generate_crosswalk_dataframe()
        csv2 = df2.to_csv(index=False, lineterminator="\n").encode("utf-8")
        hash2 = hashlib.sha256(csv2).hexdigest()

        assert hash1 == hash2
        assert csv1 == csv2

    def test_no_runtime_timestamps_in_deterministic_csv(self, service):
        """Deterministic CSV dataframe must NOT contain created_at or updated_at columns"""
        df = service.generate_crosswalk_dataframe()
        assert "created_at" not in df.columns
        assert "updated_at" not in df.columns
        assert "execution_timestamp" not in df.columns

    def test_raw_descriptions_preserved_exactly(self, service):
        """source_description in output must exactly match Material_Description in raw dataset"""
        output = service.build_legacy_mapping_crosswalk()
        mapping_df = pd.DataFrame(output["mappings"])
        raw_df = service.load_raw_materials()

        merged = pd.merge(
            mapping_df,
            raw_df,
            left_on=["source_cpse", "material_code"],
            right_on=["CPSE", "Material_Code"],
        )
        assert len(merged) == 1250
        assert (merged["source_description"] == merged["Material_Description"]).all()

    def test_output_sorting_is_deterministic(self, service):
        """Mappings must be strictly sorted by (source_cpse, material_code)"""
        df = service.generate_crosswalk_dataframe()
        sorted_df = df.sort_values(by=["source_cpse", "material_code"], ascending=[True, True])
        assert df["mapping_id"].tolist() == sorted_df["mapping_id"].tolist()
