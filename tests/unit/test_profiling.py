"""
Unit tests for Phase 1 Data Profiling Service and Quality Scoring
"""

import sys
from pathlib import Path

# Add server directory to path
server_dir = Path(__file__).resolve().parent.parent.parent / "server"
sys.path.insert(0, str(server_dir))

from services.ingestion_service import IngestionService
from services.profiling_service import ProfilingService


def test_profiling_calculations():
    ingestion = IngestionService()
    profiling = ProfilingService()
    
    df = ingestion.load_raw_dataframe()
    report = profiling.profile_dataset(df)
    
    summary = report["dataset_summary"]
    assert summary["total_rows"] == 1250
    assert summary["total_columns"] == 18
    assert summary["exact_duplicate_rows"] == 0
    assert summary["unique_material_codes"] == 1250
    assert summary["unique_descriptions"] == 357
    assert summary["duplicate_descriptions"] == 893


def test_data_quality_score():
    ingestion = IngestionService()
    profiling = ProfilingService()
    
    df = ingestion.load_raw_dataframe()
    report = profiling.profile_dataset(df)
    
    scoring = report["quality_score"]
    assert "overall_score" in scoring
    assert scoring["overall_score"] >= 80.0
    assert "completeness" in scoring["dimensions"]
    assert "uniqueness" in scoring["dimensions"]
    assert "validity" in scoring["dimensions"]
    assert "consistency" in scoring["dimensions"]


def test_column_profiles():
    ingestion = IngestionService()
    profiling = ProfilingService()
    
    df = ingestion.load_raw_dataframe()
    report = profiling.profile_dataset(df)
    
    columns = report["column_profiles"]
    assert len(columns) == 18
    col_names = [c["column_name"] for c in columns]
    assert "CPSE" in col_names
    assert "Material_Code" in col_names
    assert "Material_Description" in col_names
