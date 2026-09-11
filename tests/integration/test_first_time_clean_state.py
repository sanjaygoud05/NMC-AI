"""
Integration Test Suite: First-Time Clean State & Dataset Isolation
Verifies SIH26099 Prompt 1/5 Product Requirements:
- No dataset selected (dataset_id=None or 'NONE') returns truthful empty states with explicit metadata
- Explicit 'BASELINE' selection returns full baseline results (1,250 records)
- Raw baseline dataset is never modified
"""

import pytest
from fastapi.testclient import TestClient
from server.app.main import app
from server.services.dataset_resolver import resolve_dataset_files


@pytest.fixture
def client():
    return TestClient(app)


def test_resolver_none_scope():
    """Verify resolver treats None, empty, and 'NONE' as clean unselected state."""
    files, eff_id = resolve_dataset_files("cleaned_dataset.csv", None)
    assert files == []
    assert eff_id == "NONE"

    files, eff_id = resolve_dataset_files("cleaned_dataset.csv", "")
    assert files == []
    assert eff_id == "NONE"

    files, eff_id = resolve_dataset_files("cleaned_dataset.csv", "NONE")
    assert files == []
    assert eff_id == "NONE"


def test_resolver_explicit_baseline():
    """Verify resolver returns raw baseline only when explicitly requested as BASELINE."""
    files, eff_id = resolve_dataset_files("standardized_materials.csv", "BASELINE")
    assert len(files) == 1
    assert eff_id == "BASELINE"
    assert files[0].name == "standardized_materials.csv"


def test_dashboard_none_returns_clean_state(client):
    """GET /api/analytics/dashboard with NONE must return zeroed metrics and metadata."""
    res = client.get("/api/analytics/dashboard?dataset_id=NONE")
    assert res.status_code == 200
    data = res.json()
    assert data["has_dataset"] is False
    assert data["data_available"] is False
    assert data["dataset_id"] == "NONE"
    assert data["total_materials"] == 0
    assert data["total_cpse"] == 0


def test_dashboard_baseline_returns_full_metrics(client):
    """GET /api/analytics/dashboard with explicit BASELINE must return baseline metrics."""
    res = client.get("/api/analytics/dashboard?dataset_id=BASELINE")
    assert res.status_code == 200
    data = res.json()
    assert data["has_dataset"] is True
    assert data["data_available"] is True
    assert data["dataset_id"] == "BASELINE"
    assert data["total_materials"] == 1250
    assert data["total_cpse"] == 4


def test_materials_none_returns_clean_state(client):
    """GET /api/materials with NONE must return empty list."""
    res = client.get("/api/materials?dataset_id=NONE")
    assert res.status_code == 200
    data = res.json()
    assert data["has_dataset"] is False
    assert data["data_available"] is False
    assert data["total"] == 0
    assert data["materials"] == []


def test_materials_baseline_returns_records(client):
    """GET /api/materials with explicit BASELINE must return 1,250 materials."""
    res = client.get("/api/materials?dataset_id=BASELINE&limit=10")
    assert res.status_code == 200
    data = res.json()
    assert data["has_dataset"] is True
    assert data["data_available"] is True
    assert data["total"] == 1250
    assert len(data["materials"]) == 10


def test_standardization_report_none_returns_clean_state(client):
    """GET /api/standardization/report with NONE must return clean empty report."""
    res = client.get("/api/standardization/report?dataset_id=NONE")
    assert res.status_code == 200
    data = res.json()
    assert data["has_dataset"] is False
    assert data["data_available"] is False
    assert data["total_materials"] == 0


def test_standardization_report_baseline(client):
    """GET /api/standardization/report with BASELINE returns populated report."""
    res = client.get("/api/standardization/report?dataset_id=BASELINE")
    assert res.status_code == 200
    data = res.json()
    assert data["has_dataset"] is True
    assert data["data_available"] is True
    assert data["dataset_id"] == "BASELINE"
    assert data.get("dataset", {}).get("input_rows", 0) == 1250


def test_matches_none_returns_clean_state(client):
    """GET /api/matches with NONE must return empty matches."""
    res = client.get("/api/matches?dataset_id=NONE")
    assert res.status_code == 200
    data = res.json()
    assert data["has_dataset"] is False
    assert data["data_available"] is False
    assert data["total"] == 0
    assert data["matches"] == []


def test_matches_report_none_returns_clean_state(client):
    """GET /api/matches/report with NONE must return clean empty report."""
    res = client.get("/api/matches/report?dataset_id=NONE")
    assert res.status_code == 200
    data = res.json()
    assert data["has_dataset"] is False
    assert data["data_available"] is False


def test_common_master_none_returns_clean_state(client):
    """GET /api/common-master with NONE must return empty catalog."""
    res = client.get("/api/common-master?dataset_id=NONE")
    assert res.status_code == 200
    data = res.json()
    assert data["has_dataset"] is False
    assert data["data_available"] is False
    assert data["total"] == 0
    assert data["items"] == []


def test_common_master_stats_none_returns_clean_state(client):
    """GET /api/common-master/stats with NONE must return zero stats."""
    res = client.get("/api/common-master/stats?dataset_id=NONE")
    assert res.status_code == 200
    data = res.json()
    assert data["has_dataset"] is False
    assert data["data_available"] is False
    assert data["total_common_materials"] == 0


def test_legacy_mapping_none_returns_clean_state(client):
    """GET /api/legacy-mapping with NONE must return empty mappings."""
    res = client.get("/api/legacy-mapping?dataset_id=NONE")
    assert res.status_code == 200
    data = res.json()
    assert data["has_dataset"] is False
    assert data["data_available"] is False
    assert data["total"] == 0
    assert data["items"] == []


def test_legacy_mapping_stats_none_returns_clean_state(client):
    """GET /api/legacy-mapping/stats with NONE must return zero stats."""
    res = client.get("/api/legacy-mapping/stats?dataset_id=NONE")
    assert res.status_code == 200
    data = res.json()
    assert data["has_dataset"] is False
    assert data["data_available"] is False
    assert data["total_source_materials"] == 0


def test_procurement_kpis_none_returns_clean_state(client):
    """GET /api/procurement/kpis with NONE must return zero opportunities."""
    res = client.get("/api/procurement/kpis?dataset_id=NONE")
    assert res.status_code == 200
    data = res.json()
    assert data["has_dataset"] is False
    assert data["data_available"] is False
    assert data["total_opportunities_count"] == 0


def test_analytics_cpse_none_returns_clean_state(client):
    """GET /api/analytics/cpse with NONE must return empty CPSE analytics."""
    res = client.get("/api/analytics/cpse?dataset_id=NONE")
    assert res.status_code == 200
    data = res.json()
    assert data["has_dataset"] is False
    assert data["data_available"] is False
    assert data["cpse_data"] == {}


def test_analytics_data_quality_none_returns_clean_state(client):
    """GET /api/analytics/data-quality with NONE must return empty quality metrics."""
    res = client.get("/api/analytics/data-quality?dataset_id=NONE")
    assert res.status_code == 200
    data = res.json()
    assert data["has_dataset"] is False
    assert data["data_available"] is False
    assert data["data_quality_score"] == 0.0
