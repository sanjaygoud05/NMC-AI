"""
Unit tests for Phase 1 Ingestion Service and Schema Validation
"""

import sys
from pathlib import Path

# Add server directory to path
server_dir = Path(__file__).resolve().parent.parent.parent / "server"
sys.path.insert(0, str(server_dir))

from services.ingestion_service import IngestionService, EXPECTED_SCHEMA


def test_ingestion_file_verification():
    service = IngestionService()
    file_info = service.verify_file()
    
    assert file_info["exists"] is True
    assert file_info["size_bytes"] == 239717
    assert file_info["readable"] is True
    assert "sha256" in file_info


def test_ingestion_dataframe_loading():
    service = IngestionService()
    df = service.load_raw_dataframe()
    
    assert len(df) == 1250
    assert len(df.columns) == 18
    assert list(df.columns) == EXPECTED_SCHEMA


def test_schema_validation():
    service = IngestionService()
    df = service.load_raw_dataframe()
    schema_info = service.validate_schema(df)
    
    assert schema_info["is_valid"] is True
    assert schema_info["actual_count"] == 18
    assert len(schema_info["missing_columns"]) == 0
    assert len(schema_info["extra_columns"]) == 0
