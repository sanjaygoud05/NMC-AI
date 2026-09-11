"""
Ingestion Service - Raw Dataset Verification, Loading & Schema Validation
SIH26099 Material Harmonization Platform (Phase 1)
"""

import hashlib
import os
from pathlib import Path
import pandas as pd
from app.config import settings

EXPECTED_SCHEMA = [
    "CPSE",
    "Material_Code",
    "Material_Description",
    "Material_Category",
    "Material_Type",
    "Specification",
    "Material_Grade",
    "Size",
    "Length",
    "Diameter",
    "Coating",
    "Unit",
    "Manufacturer",
    "Manufacturer_Part_No",
    "Plant",
    "Material_Status",
    "Annual_Consumption",
    "Last_Purchase_Date",
]


class IngestionService:
    """Service for dataset ingestion and raw file integrity verification"""

    def __init__(self, raw_path: str = None):
        if raw_path is None:
            raw_path = getattr(settings, "RAW_DATA_PATH", "data/raw/CPSE_Material_Master_cleaned.csv")
        p = Path(raw_path)
        if not p.exists():
            alt_paths = [
                Path("data/raw/CPSE_Material_Master_cleaned.csv"),
                Path("../data/raw/CPSE_Material_Master_cleaned.csv"),
            ]
            for alt in alt_paths:
                if alt.exists():
                    p = alt
                    break
        self.raw_path = p

    def get_file_hash(self) -> str:
        """Calculate SHA256 hash of the raw CSV file to guarantee immutability"""
        if not self.raw_path.exists():
            raise FileNotFoundError(f"Raw dataset file not found at {self.raw_path}")
        
        hasher = hashlib.sha256()
        with open(self.raw_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hasher.update(chunk)
        return hasher.hexdigest()

    def verify_file(self) -> dict:
        """Verify existence, size, and hash of raw dataset file"""
        if not self.raw_path.exists():
            return {
                "exists": False,
                "path": str(self.raw_path),
                "error": "File missing from raw directory",
            }
        
        file_size = self.raw_path.stat().st_size
        file_hash = self.get_file_hash()

        return {
            "exists": True,
            "path": str(self.raw_path),
            "size_bytes": file_size,
            "size_mb": round(file_size / (1024 * 1024), 3),
            "sha256": file_hash,
            "readable": os.access(self.raw_path, os.R_OK),
        }

    def load_raw_dataframe(self) -> pd.DataFrame:
        """Safely load raw dataset into pandas DataFrame without modifying source file"""
        if not self.raw_path.exists():
            raise FileNotFoundError(f"Raw dataset not found at {self.raw_path}")
        
        # Read raw CSV safely
        df = pd.read_csv(self.raw_path, encoding="utf-8", dtype=str)
        return df

    def validate_schema(self, df: pd.DataFrame) -> dict:
        """Validate DataFrame columns against expected 18-column schema"""
        actual_columns = list(df.columns)
        missing_columns = [col for col in EXPECTED_SCHEMA if col not in actual_columns]
        extra_columns = [col for col in actual_columns if col not in EXPECTED_SCHEMA]
        
        is_valid = len(missing_columns) == 0 and len(actual_columns) == len(EXPECTED_SCHEMA)

        return {
            "is_valid": is_valid,
            "expected_count": len(EXPECTED_SCHEMA),
            "actual_count": len(actual_columns),
            "expected_columns": EXPECTED_SCHEMA,
            "actual_columns": actual_columns,
            "missing_columns": missing_columns,
            "extra_columns": extra_columns,
        }

    def run_ingestion(self) -> dict:
        """
        Execute Phase 1 Ingestion
        
        Returns:
            dict: Structured ingestion status and schema validation summary
        """
        file_info = self.verify_file()
        if not file_info["exists"]:
            return {
                "status": "failed",
                "message": file_info.get("error", "File missing"),
                "file_info": file_info,
            }

        df = self.load_raw_dataframe()
        schema_info = self.validate_schema(df)

        return {
            "status": "completed" if schema_info["is_valid"] else "schema_mismatch",
            "message": "Dataset loaded and schema validated successfully",
            "file_info": file_info,
            "schema_info": schema_info,
            "dataset_summary": {
                "rows": len(df),
                "columns": len(df.columns),
                "empty_rows": int((df.isna().all(axis=1)).sum()),
                "empty_columns": [col for col in df.columns if df[col].isna().all()],
            },
        }


ingestion_service = IngestionService()
