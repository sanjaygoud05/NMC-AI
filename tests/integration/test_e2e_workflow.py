"""
End-to-End System Workflow Integration Test (Phases 0 - 10)
Verifies:
1. Health check endpoint
2. Raw data immutability & frozen hash verification
3. Safe isolated file upload (does not mutate raw baseline)
4. Materials exploration and detail querying
5. Candidate matching generation and retrieval
6. Human review queue and partitioned stats
7. Common Material Master (CMM) catalog, stats, and verified multi-CPSE group
8. Legacy Material Mapping verification, baseline stats, and 100% universe retention
9. Phase 10 Procurement Analytics, strict per-UOM physical conservation, and opportunities
10. Verification that raw baseline SHA-256 remains 100% frozen.
"""

import hashlib
import io
import os
import pytest
from fastapi.testclient import TestClient
from server.app.main import app

client = TestClient(app)
_orig_get = client.get

def _get_with_baseline(url, *args, **kwargs):
    if "dataset_id=" not in url and not (kwargs.get("params") and "dataset_id" in kwargs["params"]):
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}dataset_id=BASELINE"
    return _orig_get(url, *args, **kwargs)

client.get = _get_with_baseline

RAW_BASELINE_PATH = "data/raw/CPSE_Material_Master_cleaned.csv"
EXPECTED_RAW_SHA256 = "1a45fccad5203de25f64bfda42e2f56667752bca4338a55913ae4a7babeafef1"


def test_01_api_health():
    """Verify backend health check endpoint returns 200 OK and valid status"""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data.get("status") == "healthy"
    assert "timestamp" in data


def test_02_raw_dataset_hash_immutability():
    """Verify raw baseline file exists and matches the frozen authoritative SHA-256 hash"""
    assert os.path.exists(RAW_BASELINE_PATH), f"Raw dataset not found at {RAW_BASELINE_PATH}"
    with open(RAW_BASELINE_PATH, "rb") as f:
        file_hash = hashlib.sha256(f.read()).hexdigest()
    assert file_hash == EXPECTED_RAW_SHA256, (
        f"CRITICAL: Raw dataset hash changed! Expected {EXPECTED_RAW_SHA256}, got {file_hash}"
    )


def test_03_isolated_file_upload():
    """Verify that uploading a new material master is safely staged and validated without mutating raw baseline"""
    # Must include all 18 required EXPECTED_SCHEMA columns:
    # CPSE, Material_Code, Material_Description, Material_Category, Material_Type, Specification,
    # Material_Grade, Size, Length, Diameter, Coating, Unit, Manufacturer, Manufacturer_Part_No,
    # Plant, Material_Status, Annual_Consumption, Last_Purchase_Date
    csv_content = (
        "CPSE,Material_Code,Material_Description,Material_Category,Material_Type,Specification,"
        "Material_Grade,Size,Length,Diameter,Coating,Unit,Manufacturer,Manufacturer_Part_No,"
        "Plant,Material_Status,Annual_Consumption,Last_Purchase_Date\n"
        "ONGC,TEST-001,BALL VALVE FLANGED 2 IN ASTM A216 WCB,Valves,Mechanical,API 600,"
        "WCB,2 in,,,,NOS,L&T,LT-BV-200,Plant-A,Active,150,2025-05-15\n"
        "IOCL,TEST-002,GATE VALVE FLANGED 2 in,Valves,Mechanical,API 600,"
        "WCB,2 in,,,,NOS,BHEL,BH-GV-100,Plant-B,Active,320,2025-06-20\n"
    ).encode("utf-8")

    files = {"file": ("test_upload_isolated.csv", io.BytesIO(csv_content), "text/csv")}
    res = client.post("/api/ingest/upload", files=files)
    assert res.status_code == 200
    data = res.json()
    # New runtime upload API returns dataset_id + status (VALIDATED or UPLOADED)
    # rather than the old 'success' + 'staged_path' structure
    assert data.get("status") in ("success", "VALIDATED", "UPLOADED", "COMPLETED"), (
        f"Unexpected upload status: {data.get('status')} — {data.get('error_message') or data.get('detail', '')}"
    )
    assert "dataset_id" in data
    # record_count is nested inside dataset_summary in the new API
    row_count = data.get("dataset_summary", {}).get("row_count") or data.get("record_count", 0)
    assert row_count >= 2

    # Confirm raw baseline remained unchanged
    with open(RAW_BASELINE_PATH, "rb") as f:
        current_raw_hash = hashlib.sha256(f.read()).hexdigest()
    assert current_raw_hash == EXPECTED_RAW_SHA256


def test_04_materials_api():
    """Verify materials catalog endpoint returns 200 OK and valid pagination"""
    res = client.get("/api/materials?limit=10&offset=0")
    assert res.status_code == 200
    data = res.json()
    assert "materials" in data or "items" in data
    assert "total" in data


def test_05_matches_api():
    """Verify matching candidates endpoint returns 200 OK"""
    res = client.get("/api/matches")
    assert res.status_code == 200


def test_06_human_review_queue_and_stats():
    """Verify review queue and stats endpoint return partitioned counts"""
    # 1. Stats
    res_stats = client.get("/api/review/stats")
    assert res_stats.status_code == 200
    stats = res_stats.json()
    assert stats.get("total_candidates") == 37500
    assert stats.get("active_queue_total") == 12191

    # 2. Queue items
    res_queue = client.get("/api/review/queue?view_mode=active&page_size=5")
    assert res_queue.status_code == 200
    queue = res_queue.json()
    assert "items" in queue
    assert queue.get("total") == 12191


def test_07_common_material_master_api():
    """Verify CMM catalog, stats, and verified multi-CPSE group integrity"""
    # 1. Catalog summary
    res = client.get("/api/common-master?page=1&page_size=5")
    assert res.status_code == 200
    data = res.json()
    assert data.get("total") == 1249
    assert len(data.get("items", [])) <= 5

    # 2. Stats
    res_stats = client.get("/api/common-master/stats")
    assert res_stats.status_code == 200
    stats = res_stats.json()
    assert stats.get("total_common_materials") == 1249
    assert stats.get("total_members_mapped") == 1250

    # 3. Verified multi-CPSE group detail
    res_detail = client.get("/api/common-master/CMM-VALVE-A79389-001")
    assert res_detail.status_code == 200
    cmm_data = res_detail.json()
    assert cmm_data.get("common_code") == "CMM-VALVE-A79389-001"
    assert cmm_data.get("member_count") == 2
    assert len(cmm_data.get("cpse_coverage", [])) == 2
    member_codes = [m.get("source_material_code") for m in cmm_data.get("members", [])]
    assert "ONGC-437562" in member_codes
    assert "IOCL-875352" in member_codes


def test_08_legacy_mapping_api():
    """Verify legacy material mapping universe retention and verified mapping detail"""
    # 1. Listing & universe retention
    res = client.get("/api/legacy-mapping?page=1&page_size=20")
    assert res.status_code == 200
    data = res.json()
    assert data.get("total") == 1250
    assert len(data.get("items", [])) == 20

    # 2. Stats
    res_stats = client.get("/api/legacy-mapping/stats")
    assert res_stats.status_code == 200
    stats = res_stats.json()
    assert stats.get("total_source_materials") == 1250
    assert stats.get("mapped_verified") == 2
    assert stats.get("mapped_standalone") == 1248
    assert stats.get("unmapped") == 0
    assert stats.get("mapping_coverage_pct") == 100.0

    # 3. Specific verified mapping
    res_map = client.get("/api/legacy-mapping/ONGC/ONGC-437562")
    assert res_map.status_code == 200
    mapping = res_map.json()
    assert mapping.get("cmm_code") == "CMM-VALVE-A79389-001"
    assert mapping.get("mapping_status") == "MAPPED_VERIFIED"
    assert mapping.get("confidence_score") == 1.0


def test_09_procurement_intelligence_api():
    """Verify Phase 10 procurement analytics, volume conservation per UOM, and opportunities"""
    # 1. KPIs
    res_kpi = client.get("/api/procurement/kpis")
    assert res_kpi.status_code == 200
    kpis = res_kpi.json()
    assert kpis.get("total_materials_analyzed") == 1250
    assert kpis.get("total_cmm_entities") == 1249
    assert kpis.get("multi_cpse_cmms_count") == 1
    assert kpis.get("standalone_cmms_count") == 1248
    assert kpis.get("total_opportunities_count") == 71
    assert kpis.get("analysis_reference_date") == "2026-03-31"

    vol_uom = kpis.get("volume_by_uom", {})
    assert vol_uom.get("NOS") == 9144354
    assert vol_uom.get("MTR") == 5858592
    assert vol_uom.get("LTR") == 764341

    # 2. CPSE summary
    res_cpse = client.get("/api/procurement/cpse-summary")
    assert res_cpse.status_code == 200
    cpses = res_cpse.json()
    assert len(cpses) == 4
    total_records = sum(c.get("total_material_records", 0) for c in cpses)
    assert total_records == 1250

    # 3. Opportunities catalog
    res_opp = client.get("/api/procurement/opportunities?page_size=5")
    assert res_opp.status_code == 200
    opps = res_opp.json()
    assert opps.get("total") == 71


def test_10_final_raw_hash_check():
    """Final check: Ensure raw baseline remains strictly byte-identical after full workflow"""
    with open(RAW_BASELINE_PATH, "rb") as f:
        final_hash = hashlib.sha256(f.read()).hexdigest()
    assert final_hash == EXPECTED_RAW_SHA256, (
        f"CRITICAL: Final raw hash mismatch! Expected {EXPECTED_RAW_SHA256}, got {final_hash}"
    )
