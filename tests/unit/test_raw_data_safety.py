"""
Raw Data Safety Test - Verifies that Phase 1 pipeline execution does NOT modify data/raw/CPSE_Material_Master_cleaned.csv
"""

import sys
import hashlib
from pathlib import Path

# Add server directory to path
server_dir = Path(__file__).resolve().parent.parent.parent / "server"
sys.path.insert(0, str(server_dir))

from services.ingestion_service import IngestionService
from services.profiling_service import ProfilingService


def calculate_hash(path: Path) -> str:
    hasher = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def test_raw_data_immutability():
    ingestion = IngestionService()
    raw_path = ingestion.raw_path
    
    assert raw_path.exists()
    
    hash_before = calculate_hash(raw_path)
    size_before = raw_path.stat().st_size
    
    # Run full Phase 1 ingestion and profiling
    profiling = ProfilingService()
    df = ingestion.load_raw_dataframe()
    _ = profiling.profile_dataset(df)
    _ = profiling.run_profiling()
    
    hash_after = calculate_hash(raw_path)
    size_after = raw_path.stat().st_size
    
    # Strictly enforce raw data immutability
    assert hash_before == hash_after
    assert size_before == size_after
    assert hash_before == "1a45fccad5203de25f64bfda42e2f56667752bca4338a55913ae4a7babeafef1"
