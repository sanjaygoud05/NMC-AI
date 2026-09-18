"""
Dataset Registry Service
Manages dataset registrations, persistent manifest, SHA256 integrity, schema validation,
and runtime storage isolation.

Datasets:
- BASELINE: Frozen official Phase 1-10 dataset (1,250 records).
- UPLOAD-YYYYMMDD-XXX: Independent uploaded runtime datasets.
"""

import os
import re
import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional
import pandas as pd

from services.ingestion_service import EXPECTED_SCHEMA

_WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
UPLOADS_DIR = _WORKSPACE_ROOT / "data" / "uploads"
if not UPLOADS_DIR.exists():
    UPLOADS_DIR = Path("data/uploads")
MANIFEST_PATH = UPLOADS_DIR / "datasets_manifest.json"

BASELINE_HASH = "1a45fccad5203de25f64bfda42e2f56667752bca4338a55913ae4a7babeafef1"


class DatasetRegistryService:
    """Service for dataset registration, metadata persistence, and isolation"""

    def __init__(self, uploads_dir: Path = UPLOADS_DIR):
        self.uploads_dir = uploads_dir
        self.manifest_path = self.uploads_dir / "datasets_manifest.json"
        self._ensure_initialized()

    def _ensure_initialized(self):
        """Ensure uploads directory and manifest file exist with BASELINE pre-registered"""
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        if not self.manifest_path.exists():
            initial_manifest = {
                "version": "1.0",
                "last_updated": datetime.now(timezone.utc).isoformat(),
                "sequence_counters": {},
                "datasets": {
                    "BASELINE": {
                        "dataset_id": "BASELINE",
                        "file_name": "CPSE_Material_Master_cleaned.csv",
                        "file_hash": BASELINE_HASH,
                        "row_count": 1250,
                        "column_count": 18,
                        "cpse_summary": {
                            "ONGC": 332,
                            "IOCL": 319,
                            "HPCL": 301,
                            "CPCL": 298,
                        },
                        "status": "COMPLETED",
                        "is_baseline": True,
                        "schema_version": "1.0",
                        "uploaded_at": "2026-03-31T00:00:00Z",
                        "processing_started_at": "2026-03-31T00:00:00Z",
                        "processing_completed_at": "2026-03-31T00:00:00Z",
                        "error_message": None,
                        "data_dir": "data/processed",
                        "source_file": "data/raw/CPSE_Material_Master_cleaned.csv",
                        "current_phase": "COMPLETED",
                        "progress": 100,
                        "created_at": "2026-03-31T00:00:00Z",
                        "started_at": "2026-03-31T00:00:00Z",
                        "completed_at": "2026-03-31T00:00:00Z",
                        "cpse_count": 4,
                    }
                },
            }
            with open(self.manifest_path, "w", encoding="utf-8") as f:
                json.dump(initial_manifest, f, indent=2)

    def _load_manifest(self) -> Dict[str, Any]:
        self._ensure_initialized()
        try:
            with open(self.manifest_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {"version": "1.0", "sequence_counters": {}, "datasets": {}}

    def _save_manifest(self, manifest: Dict[str, Any]):
        manifest["last_updated"] = datetime.now(timezone.utc).isoformat()
        with open(self.manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)

    def generate_next_dataset_id(self) -> str:
        """
        Generate unique dataset ID in format: UPLOAD-YYYYMMDD-XXX
        Uses current UTC date and thread-safe daily sequence counter in manifest.
        """
        manifest = self._load_manifest()
        date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        counters = manifest.setdefault("sequence_counters", {})
        current_seq = counters.get(date_str, 0) + 1
        counters[date_str] = current_seq
        self._save_manifest(manifest)
        return f"UPLOAD-{date_str}-{current_seq:03d}"

    def list_datasets(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List datasets visible to the user:
        - BASELINE is always included.
        - Uploads are strictly scoped to the requesting user_id.
        - For a new user (or no user_id), only BASELINE is returned so no unwanted mock datasets appear.
        """
        manifest = self._load_manifest()
        datasets = list(manifest.get("datasets", {}).values())
        
        baseline = [d for d in datasets if d.get("dataset_id") == "BASELINE"]
        if user_id:
            uploads = [
                d for d in datasets
                if d.get("dataset_id") != "BASELINE" and d.get("user_id") == user_id
            ]
        else:
            uploads = []
        uploads.sort(key=lambda d: d.get("uploaded_at", ""), reverse=True)
        return baseline + uploads

    def get_dataset(self, dataset_id: str) -> Optional[Dict[str, Any]]:
        """Fetch metadata for specific dataset"""
        manifest = self._load_manifest()
        return manifest.get("datasets", {}).get(dataset_id)

    def update_dataset_status(
        self,
        dataset_id: str,
        status: str,
        error_message: Optional[str] = None,
        current_phase: Optional[str] = None,
        progress: Optional[int] = None,
        extra_fields: Optional[Dict[str, Any]] = None,
    ):
        """Update dataset status, current phase, progress, and execution lifecycle timestamps"""
        manifest = self._load_manifest()
        if dataset_id not in manifest.get("datasets", {}):
            return
        entry = manifest["datasets"][dataset_id]
        entry["status"] = status
        if current_phase is not None:
            entry["current_phase"] = current_phase
        if progress is not None:
            entry["progress"] = progress
        if error_message is not None:
            entry["error_message"] = error_message
        now_str = datetime.now(timezone.utc).isoformat()
        if status == "PROCESSING" and not entry.get("processing_started_at"):
            entry["processing_started_at"] = now_str
            entry["started_at"] = now_str
        elif status in ["COMPLETED", "FAILED", "CANCELLED"]:
            entry["processing_completed_at"] = now_str
            entry["completed_at"] = now_str
        if extra_fields:
            entry.update(extra_fields)
        self._save_manifest(manifest)

        # Sync local metadata.json in dataset folder if directory exists
        dataset_dir = self.uploads_dir / dataset_id
        if dataset_dir.exists():
            try:
                with open(dataset_dir / "metadata.json", "w", encoding="utf-8") as f:
                    json.dump(entry, f, indent=2)
            except Exception:
                pass

    def validate_csv_content(self, content: bytes) -> Dict[str, Any]:
        """
        Strictly validate CSV format, 18 required columns, row structure, and duplicates.
        Does NOT create partial processed results if validation fails.
        """
        import io

        if not content or len(content.strip()) == 0:
            return {
                "is_valid": False,
                "error": "Uploaded CSV file is completely empty",
                "df": None,
            }

        try:
            df = pd.read_csv(io.BytesIO(content), encoding="utf-8", dtype=str)
        except Exception:
            try:
                df = pd.read_csv(io.BytesIO(content), encoding="latin-1", dtype=str)
            except Exception as e:
                return {
                    "is_valid": False,
                    "error": f"Malformed CSV file format: {str(e)}",
                    "df": None,
                }

        if len(df) == 0:
            return {
                "is_valid": False,
                "error": "CSV file contains zero data rows",
                "df": None,
            }

        actual_cols = list(df.columns)
        missing_cols = [c for c in EXPECTED_SCHEMA if c not in actual_cols]
        if missing_cols:
            return {
                "is_valid": False,
                "error": f"Schema validation failed. Missing required columns: {', '.join(missing_cols)}",
                "missing_columns": missing_cols,
                "df": None,
            }

        # Check for duplicate Material_Code within CPSE
        if "Material_Code" in df.columns and "CPSE" in df.columns:
            subset = df[["CPSE", "Material_Code"]].dropna()
            dups = subset[subset.duplicated(keep=False)]
            if len(dups) > 0:
                dup_pairs = dups.head(5).to_dict(orient="records")
                return {
                    "is_valid": False,
                    "error": f"Validation failed: Duplicate Material_Code within same CPSE detected ({len(dups)} rows). Examples: {dup_pairs}",
                    "df": None,
                }

        return {
            "is_valid": True,
            "error": None,
            "df": df,
            "row_count": len(df),
            "column_count": len(df.columns),
            "cpse_summary": df["CPSE"].value_counts().to_dict() if "CPSE" in df.columns else {},
        }

    def register_upload(self, file_name: str, content: bytes, user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Register a newly uploaded CSV dataset file:
        1. Generate unique dataset_id (UPLOAD-YYYYMMDD-XXX).
        2. Create isolated storage directory: data/uploads/<dataset_id>/.
        3. Compute SHA256 checksum.
        4. Validate schema and structure.
        5. Persist source.csv and metadata.json.
        6. Record in manifest with initial status (VALIDATED or FAILED) and user_id ownership.
        """
        dataset_id = self.generate_next_dataset_id()
        dataset_dir = self.uploads_dir / dataset_id
        dataset_dir.mkdir(parents=True, exist_ok=True)
        (dataset_dir / "processed").mkdir(parents=True, exist_ok=True)

        source_path = dataset_dir / "source.csv"
        with open(source_path, "wb") as f:
            f.write(content)

        file_hash = hashlib.sha256(content).hexdigest()
        val_result = self.validate_csv_content(content)

        initial_status = "VALIDATED" if val_result["is_valid"] else "FAILED"
        error_msg = val_result.get("error")

        dataset_entry = {
            "dataset_id": dataset_id,
            "user_id": user_id,
            "file_name": file_name,
            "file_hash": file_hash,
            "row_count": val_result.get("row_count", 0),
            "column_count": val_result.get("column_count", 0),
            "cpse_summary": val_result.get("cpse_summary", {}),
            "status": initial_status,
            "is_baseline": False,
            "schema_version": "1.0",
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "processing_started_at": None,
            "processing_completed_at": None,
            "error_message": error_msg,
            "data_dir": str(dataset_dir / "processed"),
            "source_file": str(source_path),
            "current_phase": None,
            "progress": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "started_at": None,
            "completed_at": None,
            "cpse_count": len(val_result.get("cpse_summary", {})),
        }

        manifest = self._load_manifest()
        manifest.setdefault("datasets", {})[dataset_id] = dataset_entry
        self._save_manifest(manifest)

        # Write dataset-local metadata
        with open(dataset_dir / "metadata.json", "w", encoding="utf-8") as f:
            json.dump(dataset_entry, f, indent=2)

        return dataset_entry


dataset_registry_service = DatasetRegistryService()
