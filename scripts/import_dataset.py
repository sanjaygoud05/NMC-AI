"""
Import dataset script - Ingest and validate CPSE material master data
SIH26099 Material Harmonization Platform (Phase 1)
"""

import sys
import os
import json

# Add server directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "server"))

from services.ingestion_service import IngestionService


def import_dataset(file_path: str = None):
    """
    Import and validate CPSE material master dataset
    
    Args:
        file_path: Optional path to the raw CSV file
    """
    print(f"==================================================")
    print(f"  SIH26099 Phase 01: Dataset Ingestion & Validation  ")
    print(f"==================================================")

    service = IngestionService(raw_path=file_path) if file_path else IngestionService()
    
    print(f"Verifying raw dataset at: {service.raw_path}")
    file_info = service.verify_file()
    
    if not file_info["exists"]:
        print(f"❌ Error: {file_info.get('error')}")
        sys.exit(1)

    print(f"✓ File exists! Size: {file_info['size_mb']} MB ({file_info['size_bytes']} bytes)")
    print(f"✓ SHA256 Hash: {file_info['sha256']}")

    print("\nLoading dataset DataFrame...")
    df = service.load_raw_dataframe()
    print(f"✓ Successfully loaded DataFrame: {len(df)} rows, {len(df.columns)} columns")

    print("\nValidating schema against expected 18 columns...")
    schema_info = service.validate_schema(df)
    
    if schema_info["is_valid"]:
        print("✓ Schema validation PASSED!")
    else:
        print(f"❌ Schema validation FAILED!")
        if schema_info["missing_columns"]:
            print(f"  Missing columns: {schema_info['missing_columns']}")
        if schema_info["extra_columns"]:
            print(f"  Extra columns: {schema_info['extra_columns']}")

    result = service.run_ingestion()
    print("\nIngestion Summary:")
    print(json.dumps(result, indent=2))
    return result


if __name__ == "__main__":
    file_path = sys.argv[1] if len(sys.argv) > 1 else None
    import_dataset(file_path)
