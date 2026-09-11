"""
Integration tests for Phase 9 Legacy Material Mapping API
Tests:
- GET /api/legacy-mapping list, pagination, CPSE filter, status filter, and text search
- GET /api/legacy-mapping/stats returns exact operational baseline KPIs
- GET /api/legacy-mapping/{source_cpse}/{material_code} single record detail & provenance
- GET /api/legacy-mapping/by-cmm/{cmm_code} reverse lookup
- Database composite uniqueness enforcement on (source_cpse, material_code)
- Upstream artifact immutability verification
"""

import hashlib
import os
import pytest
from fastapi.testclient import TestClient

from server.app.main import app
from server.pipeline.phase09_legacy_mapping import run_legacy_mapping
from server.app.db.legacy_mapping_repository import LegacyMappingRepository

try:
    from app.models.legacy_mapping import LegacyMaterialMapping
except ImportError:
    from server.app.models.legacy_mapping import LegacyMaterialMapping


@pytest.fixture(scope="module", autouse=True)
def setup_crosswalk():
    """Ensure cross-walk repository is populated before running integration tests"""
    run_legacy_mapping()


@pytest.fixture
def client():
    c = TestClient(app)
    orig_get = c.get

    def get_with_baseline(url, *args, **kwargs):
        if "dataset_id=" not in url and not (kwargs.get("params") and "dataset_id" in kwargs["params"]):
            sep = "&" if "?" in url else "?"
            url = f"{url}{sep}dataset_id=BASELINE"
        return orig_get(url, *args, **kwargs)

    c.get = get_with_baseline
    return c


class TestLegacyMappingAPI:
    """Integration test suite for Legacy Material Mapping REST endpoints"""

    def test_list_legacy_mappings_endpoint(self, client):
        """GET /api/legacy-mapping returns paginated cross-walk records"""
        res = client.get("/api/legacy-mapping?page=1&page_size=20")
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        assert data["total"] == 1250
        assert len(data["items"]) == 20
        item = data["items"][0]
        assert "mapping_id" in item
        assert "source_cpse" in item
        assert "material_code" in item
        assert "raw_material_name" in item
        assert "cmm_code" in item
        assert "mapping_status" in item

    def test_get_legacy_mapping_stats_baseline(self, client):
        """GET /api/legacy-mapping/stats returns exact authoritative baseline KPIs"""
        res = client.get("/api/legacy-mapping/stats")
        assert res.status_code == 200
        data = res.json()

        assert data["total_source_materials"] == 1250
        assert data["verified_mapped"] == 2
        assert data["standalone_mapped"] == 1248
        assert data["review_required"] == 0
        assert data["conflict"] == 0
        assert data["unmapped"] == 0
        assert data["transitive_verified"] == 0
        assert data["mapping_coverage_pct"] == 100.0

        cpse_dist = data["cpse_distribution"]
        assert cpse_dist["ONGC"] == 332
        assert cpse_dist["IOCL"] == 319
        assert cpse_dist["HPCL"] == 301
        assert cpse_dist["CPCL"] == 298

    def test_filter_by_cpse(self, client):
        """GET /api/legacy-mapping?cpse=ONGC returns only ONGC records"""
        res = client.get("/api/legacy-mapping?cpse=ONGC&page_size=500")
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == 332
        for item in data["items"]:
            assert item["source_cpse"] == "ONGC"

    def test_filter_by_mapping_status(self, client):
        """GET /api/legacy-mapping?status=MAPPED_VERIFIED returns exactly the 2 verified records"""
        res = client.get("/api/legacy-mapping?status=MAPPED_VERIFIED")
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == 2
        codes = {item["material_code"] for item in data["items"]}
        assert codes == {"ONGC-437562", "IOCL-875352"}

    def test_get_single_legacy_mapping_verified_provenance(self, client):
        """GET /api/legacy-mapping/ONGC/437562 returns full verified mapping detail"""
        res = client.get("/api/legacy-mapping/ONGC/437562")
        assert res.status_code == 200
        item = res.json()

        assert item["source_cpse"] == "ONGC"
        assert item["material_code"] in ["ONGC-437562", "437562"]
        assert item["cmm_code"] == "CMM-VALVE-A79389-001"
        assert item["mapping_status"] == "MAPPED_VERIFIED"
        assert item["membership_type"] == "DIRECT_ACCEPTED"
        assert float(item["confidence_score"]) == 1.000
        assert item["confidence_semantics"] == "VERIFIED_CROSS_CPSE"
        assert item["accepted_candidate_id"] == "CAN-000331"
        assert item["phase6_validation_status"] == "VALIDATED_COMPATIBLE"
        assert item["phase7_review_decision"] == "ACCEPT"

    def test_get_single_legacy_mapping_not_found(self, client):
        """GET /api/legacy-mapping/ONGC/INVALID-CODE returns 404"""
        res = client.get("/api/legacy-mapping/ONGC/INVALID-CODE")
        assert res.status_code == 404

    def test_get_legacy_mappings_by_cmm_reverse_lookup(self, client):
        """GET /api/legacy-mapping/by-cmm/CMM-VALVE-A79389-001 returns both verified members"""
        res = client.get("/api/legacy-mapping/by-cmm/CMM-VALVE-A79389-001")
        assert res.status_code == 200
        items = res.json()
        assert len(items) == 2
        materials = {(m["source_cpse"], m["material_code"]) for m in items}
        assert materials == {("ONGC", "ONGC-437562"), ("IOCL", "IOCL-875352")}

    def test_composite_uniqueness_enforcement(self):
        """Direct DB insertion with duplicate (source_cpse, material_code) violates unique constraint"""
        repo = LegacyMappingRepository()
        with repo.get_session() as session:
            duplicate = LegacyMaterialMapping(
                mapping_id="TEST-DUP-001",
                source_cpse="ONGC",
                material_code="ONGC-437562",  # already exists
                source_description="Duplicate item test",
                cmm_code="CMM-VALVE-A79389-001",
                mapping_status="MAPPED_VERIFIED",
                membership_type="DIRECT_ACCEPTED",
                confidence_score=1.000,
                confidence_semantics="VERIFIED_CROSS_CPSE",
                mapping_method="DIRECT_ACCEPTED",
                mapping_reason="Duplicate test",
                canonical_material_key="VALVE|TEST",
            )
            session.add(duplicate)
            with pytest.raises(Exception):
                session.commit()
            session.rollback()


class TestUpstreamImmutability:
    """Validate that Phase 9 does not alter upstream Phase 1-8 artifacts"""

    FROZEN_HASHES = {
        "data/raw/CPSE_Material_Master_cleaned.csv": "1a45fccad5203de25f64bfda42e2f56667752bca4338a55913ae4a7babeafef1",
        "data/processed/standardized_materials.csv": "5e93c66468d2813afd147234c53089f17b4400b07ca6ea168f3445a255fc72d6",
        "data/processed/accepted_harmonization_pairs.csv": "632f64df3f0fdee63a44e2e1d8d29834df6632a8f4babe5a066222ad4635c3d2",
        "data/processed/common_material_master.csv": "96fa68f3c3401c03b5896bfda3b66b4653640c9d51764cb1652499515be55cba",
        "data/processed/common_material_members.csv": "5b41bf7220d6818ffae58d5e787da8410c43c0da13c74b099a5f6c704613b4a0",
    }

    def test_upstream_artifacts_remain_unmodified(self):
        root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        for rel_path, expected_hash in self.FROZEN_HASHES.items():
            full_path = os.path.join(root_dir, rel_path)
            assert os.path.exists(full_path), f"Artifact missing: {rel_path}"
            with open(full_path, "rb") as f:
                actual_hash = hashlib.sha256(f.read()).hexdigest()
            assert actual_hash == expected_hash, (
                f"IMMUTABILITY VIOLATION in {rel_path}! Expected {expected_hash}, got {actual_hash}"
            )
