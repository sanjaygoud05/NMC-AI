"""
Integration tests for Phase 8 Common Material Master API
Tests:
- GET /api/common-master query, filter, search, pagination
- GET /api/common-master/stats KPIs
- GET /api/common-master/{common_id} detailed provenance payload
- POST /api/common-master/{common_id}/governance RBAC and state transition to APPROVED_MASTER
- Viewer role rejection with HTTP 403
- Upstream artifact immutability verification
"""

import hashlib
import pytest
from fastapi.testclient import TestClient

from server.app.main import app
from server.pipeline.phase08_common_material_master import run_common_material_master


@pytest.fixture(scope="module", autouse=True)
def setup_catalog():
    """Ensure catalog is populated before integration tests run"""
    run_common_material_master()


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


class TestCommonMasterAPI:
    """Integration test suite for Common Material Master API"""

    def test_list_common_materials_endpoint(self, client):
        """GET /api/common-master returns paginated catalog items"""
        res = client.get("/api/common-master?page=1&page_size=10")
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        assert data["total"] > 0
        assert len(data["items"]) <= 10
        item = data["items"][0]
        assert "common_code" in item
        assert "consolidated_attributes" in item
        assert "cpse_coverage" in item

    def test_get_common_master_stats(self, client):
        """GET /api/common-master/stats returns high-level metrics"""
        res = client.get("/api/common-master/stats")
        assert res.status_code == 200
        data = res.json()
        assert data["total_common_materials"] > 0
        assert data["total_members_mapped"] == 1250
        assert "unique_families" in data
        assert len(data["unique_families"]) > 0

    def test_get_common_material_detail_and_provenance(self, client):
        """GET /api/common-master/{id} returns full record with member mappings"""
        res_list = client.get("/api/common-master?page_size=1")
        common_id = res_list.json()["items"][0]["common_code"]

        res = client.get(f"/api/common-master/{common_id}")
        assert res.status_code == 200
        data = res.json()
        assert data["common_code"] == common_id
        assert "members" in data
        assert len(data["members"]) >= 1
        member = data["members"][0]
        assert "source_material_code" in member
        assert "source_cpse" in member
        assert "membership_type" in member

    def test_viewer_role_rejected_from_governance_sign_off(self, client):
        """Users with 'viewer' role receive HTTP 403 on governance sign-off"""
        res_list = client.get("/api/common-master?page_size=1")
        common_id = res_list.json()["items"][0]["common_code"]

        headers = {
            "x-test-user-id": "viewer-user-01",
            "x-test-user-role": "viewer",
        }
        payload = {
            "new_status": "APPROVED_MASTER",
            "rationale": "Viewer attempting illegal governance sign-off",
        }
        res = client.post(f"/api/common-master/{common_id}/governance", json=payload, headers=headers)
        assert res.status_code == 403

    def test_reviewer_governance_sign_off_success(self, client):
        """Authorized reviewer or admin can transition record to APPROVED_MASTER"""
        res_list = client.get("/api/common-master?page_size=1")
        common_id = res_list.json()["items"][0]["common_code"]

        headers = {
            "x-test-user-id": "lead-governance-officer",
            "x-test-user-email": "governance.lead@cpse.gov.in",
            "x-test-user-role": "reviewer",
        }
        payload = {
            "new_status": "APPROVED_MASTER",
            "rationale": "Certified golden canonical catalog definition following engineering review",
        }
        res = client.post(f"/api/common-master/{common_id}/governance", json=payload, headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["governance_status"] == "APPROVED_MASTER"
        assert data["approved_by"] == "governance.lead@cpse.gov.in"
        assert data["approval_rationale"] == payload["rationale"]

    def test_upstream_artifacts_remain_strictly_immutable(self):
        """Verify that Phase 1 through 7 artifacts have not changed SHA-256 hashes"""
        expected_hashes = {
            "data/raw/CPSE_Material_Master_cleaned.csv": "1a45fccad5203de25f64bfda42e2f56667752bca4338a55913ae4a7babeafef1",
            "data/processed/normalized_materials.csv": "34891ddaffba57cb3956d4a1172b554077e87dfe36e513e641022bc5634abffc",
            "data/processed/extracted_attributes.csv": "8fc02888a909679f24346982ebde84a21ee756e80d4d0e9a3d94023580633f4e",
            "data/processed/standardized_materials.csv": "5e93c66468d2813afd147234c53089f17b4400b07ca6ea168f3445a255fc72d6",
            "data/processed/match_candidates.csv": "0337a33c1170b64c7f40edb6c82419269f847e06c0b35a174a1434ce77407ca3",
            "data/processed/validated_candidates.csv": "bc434f434a25aff84a30f3acb4750a0982e19ad125b23cbd5d2c8a84aab89cbc",
            "data/processed/accepted_harmonization_pairs.csv": "632f64df3f0fdee63a44e2e1d8d29834df6632a8f4babe5a066222ad4635c3d2",
        }

        for path, expected in expected_hashes.items():
            with open(path, "rb") as fp:
                current_hash = hashlib.sha256(fp.read()).hexdigest()
            assert current_hash == expected, f"Artifact {path} was corrupted! Hash: {current_hash} != {expected}"
