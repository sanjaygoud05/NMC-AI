"""
Integration tests for Phase 10 Procurement Intelligence & Analytics REST API
Tests:
- GET /api/procurement/kpis returns exact operational baseline KPIs
- GET /api/procurement/cmm-summary supports filtering, search, and pagination
- GET /api/procurement/cmm-summary/{cmm_code} returns single CMM with member drill-down
- GET /api/procurement/cpse-summary returns 4 CPSE rows with UOM partitioning
- GET /api/procurement/opportunities returns full provenance fields
- GET /api/procurement/plants returns plant-level distribution
- GET /api/procurement/facts returns line-level procurement facts
- Database constraints and relational integrity
- Upstream Phase 1–9 immutability
"""

import hashlib
import os
import pytest
from fastapi.testclient import TestClient

from server.app.main import app
from server.pipeline.phase10_procurement_analytics import run_procurement_analytics


@pytest.fixture(scope="module", autouse=True)
def setup_procurement_data():
    """Ensure procurement tables and artifacts are initialized before testing"""
    run_procurement_analytics()


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


class TestProcurementAPI:
    """Integration test suite for Procurement REST endpoints"""

    def test_get_kpis_endpoint(self, client):
        """GET /api/procurement/kpis returns exact authoritative metrics"""
        res = client.get("/api/procurement/kpis")
        assert res.status_code == 200
        data = res.json()
        assert data["total_materials_analyzed"] == 1250
        assert data["total_cmm_entities"] == 1249
        assert data["multi_cpse_cmms_count"] == 1
        assert data["standalone_cmms_count"] == 1248
        assert data["volume_by_uom"]["NOS"] == 9144354
        assert data["volume_by_uom"]["MTR"] == 5858592
        assert data["volume_by_uom"]["LTR"] == 764341
        assert data["analysis_reference_date"] == "2026-03-31"

    def test_cmm_summary_list_endpoint(self, client):
        """GET /api/procurement/cmm-summary returns paginated CMM demand summaries"""
        res = client.get("/api/procurement/cmm-summary?page=1&page_size=25")
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == 1249
        assert len(data["items"]) == 25
        first = data["items"][0]
        assert "cmm_code" in first
        assert "common_description" in first
        assert "material_family" in first
        assert "total_annual_consumption" in first
        assert "primary_uom" in first

    def test_cmm_summary_filter_by_family_and_uom(self, client):
        """GET /api/procurement/cmm-summary supports family and UOM filtering"""
        res = client.get("/api/procurement/cmm-summary?material_family=VALVE&primary_uom=NOS")
        assert res.status_code == 200
        data = res.json()
        assert data["total"] > 0
        for item in data["items"]:
            assert item["material_family"] == "VALVE"
            assert item["primary_uom"] == "NOS"

    def test_cmm_summary_detail_multi_cpse(self, client):
        """GET /api/procurement/cmm-summary/{cmm_code} drill-down for harmonized valve"""
        res = client.get("/api/procurement/cmm-summary/CMM-VALVE-A79389-001")
        assert res.status_code == 200
        data = res.json()
        assert data["cmm_code"] == "CMM-VALVE-A79389-001"
        assert data["cpse_count"] == 2
        assert set(data["consuming_cpses"].split(";")) == {"IOCL", "ONGC"}
        assert len(data["members"]) == 2
        member_codes = {m["material_code"] for m in data["members"]}
        assert member_codes == {"ONGC-437562", "IOCL-875352"}

    def test_cmm_summary_detail_not_found(self, client):
        """GET /api/procurement/cmm-summary/{cmm_code} returns 404 for invalid code"""
        res = client.get("/api/procurement/cmm-summary/CMM-NONEXISTENT-999")
        assert res.status_code == 404

    def test_cpse_summary_endpoint(self, client):
        """GET /api/procurement/cpse-summary returns 4 enterprise summaries with UOM partitioning"""
        res = client.get("/api/procurement/cpse-summary")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 4
        by_cpse = {r["source_cpse"]: r for r in data}

        assert by_cpse["CPCL"]["total_material_records"] == 298
        assert by_cpse["HPCL"]["total_material_records"] == 301
        assert by_cpse["IOCL"]["total_material_records"] == 319
        assert by_cpse["ONGC"]["total_material_records"] == 332

        assert by_cpse["ONGC"]["multi_cpse_harmonized_members"] == 1
        assert by_cpse["IOCL"]["multi_cpse_harmonized_members"] == 1
        assert by_cpse["CPCL"]["multi_cpse_harmonized_members"] == 0
        assert by_cpse["HPCL"]["multi_cpse_harmonized_members"] == 0

        # Verify sum of NOS volume across CPSEs
        total_nos = sum(r["total_volume_nos"] for r in data)
        assert total_nos == 9144354

    def test_opportunities_endpoint(self, client):
        """GET /api/procurement/opportunities returns auditable records with provenance"""
        res = client.get("/api/procurement/opportunities?page=1&page_size=20")
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == 71
        assert len(data["items"]) == 20
        item = data["items"][0]
        assert "opportunity_id" in item
        assert "opportunity_type" in item
        assert "cmm_code" in item
        assert "source_cpses" in item
        assert "material_codes" in item
        assert "trigger_metric" in item
        assert "trigger_value" in item
        assert "threshold" in item
        assert "reason" in item
        assert "evidence_reference" in item

    def test_opportunities_filter_by_type(self, client):
        """Filter opportunities by MULTI_CPSE_DEMAND_AGGREGATION"""
        res = client.get("/api/procurement/opportunities?opportunity_type=MULTI_CPSE_DEMAND_AGGREGATION")
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == 1
        assert data["items"][0]["cmm_code"] == "CMM-VALVE-A79389-001"

    def test_plants_distribution_endpoint(self, client):
        """GET /api/procurement/plants returns breakdown per plant and UOM"""
        res = client.get("/api/procurement/plants")
        assert res.status_code == 200
        data = res.json()
        assert len(data) > 0
        first = data[0]
        assert "plant" in first
        assert "source_cpse" in first
        assert "unit_of_measure" in first
        assert "total_volume" in first
        assert "material_count" in first

    def test_facts_list_endpoint(self, client):
        """GET /api/procurement/facts returns paginated line-level facts"""
        res = client.get("/api/procurement/facts?source_cpse=ONGC&page=1&page_size=10")
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == 332
        assert len(data["items"]) == 10
        assert data["items"][0]["source_cpse"] == "ONGC"

    def test_upstream_artifacts_immutability(self):
        """Verifies that running the Phase 10 API does not alter any Phase 1–9 artifact"""
        expected_hashes = {
            "RAW": (
                "data/raw/CPSE_Material_Master_cleaned.csv",
                "1a45fccad5203de25f64bfda42e2f56667752bca4338a55913ae4a7babeafef1",
            ),
            "NORMALIZED": (
                "data/processed/normalized_materials.csv",
                "34891ddaffba57cb3956d4a1172b554077e87dfe36e513e641022bc5634abffc",
            ),
            "EXTRACTED": (
                "data/processed/extracted_attributes.csv",
                "8fc02888a909679f24346982ebde84a21ee756e80d4d0e9a3d94023580633f4e",
            ),
            "STANDARDIZED": (
                "data/processed/standardized_materials.csv",
                "5e93c66468d2813afd147234c53089f17b4400b07ca6ea168f3445a255fc72d6",
            ),
            "MATCH CANDIDATES": (
                "data/processed/match_candidates.csv",
                "0337a33c1170b64c7f40edb6c82419269f847e06c0b35a174a1434ce77407ca3",
            ),
            "VALIDATED": (
                "data/processed/validated_candidates.csv",
                "bc434f434a25aff84a30f3acb4750a0982e19ad125b23cbd5d2c8a84aab89cbc",
            ),
            "ACCEPTED PAIRS": (
                "data/processed/accepted_harmonization_pairs.csv",
                "632f64df3f0fdee63a44e2e1d8d29834df6632a8f4babe5a066222ad4635c3d2",
            ),
            "COMMON MATERIAL MASTER": (
                "data/processed/common_material_master.csv",
                "96fa68f3c3401c03b5896bfda3b66b4653640c9d51764cb1652499515be55cba",
            ),
            "COMMON MATERIAL MEMBERS": (
                "data/processed/common_material_members.csv",
                "5b41bf7220d6818ffae58d5e787da8410c43c0da13c74b099a5f6c704613b4a0",
            ),
            "LEGACY MAPPING": (
                "data/processed/legacy_material_mapping.csv",
                "2cf7bf298d260a2b4b2d611f6ce680f7a695abadf756232b5b3258082de75a34",
            ),
        }

        root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        for name, (rel_path, expected_hash) in expected_hashes.items():
            full_path = os.path.join(root, rel_path)
            with open(full_path, "rb") as f:
                actual_hash = hashlib.sha256(f.read()).hexdigest()
            assert actual_hash == expected_hash, f"Upstream hash mismatch for {name}"
