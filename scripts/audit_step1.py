"""Phase 3 Audit Script — Step 1: Data chain integrity"""
import pandas as pd
import hashlib
import json
from pathlib import Path

def sha256(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()

raw  = Path('data/raw/CPSE_Material_Master_cleaned.csv')
norm = Path('data/processed/normalized_materials.csv')
ext  = Path('data/processed/extracted_attributes.csv')
prof = Path('data/processed/profiled_materials.csv')

EXPECTED_RAW_HASH = "1a45fccad5203de25f64bfda42e2f56667752bca4338a55913ae4a7babeafef1"

print("=== FILE PRESENCE ===")
for p in [raw, norm, ext, prof]:
    print(f"  {p.name}: exists={p.exists()}, size={p.stat().st_size if p.exists() else 'N/A'}")

print("\n=== HASHES ===")
raw_hash  = sha256(raw)
norm_hash = sha256(norm)
print(f"  raw  SHA256 : {raw_hash}")
print(f"  norm SHA256 : {norm_hash}")
print(f"  raw  EXPECTED  : {EXPECTED_RAW_HASH}")
print(f"  raw  MATCH  : {raw_hash == EXPECTED_RAW_HASH}")

print("\n=== ROW / COLUMN COUNTS ===")
df_raw  = pd.read_csv(raw,  dtype=str)
df_norm = pd.read_csv(norm, dtype=str)
df_ext  = pd.read_csv(ext,  dtype=str)
print(f"  raw  rows={len(df_raw)}, cols={len(df_raw.columns)}")
print(f"  norm rows={len(df_norm)}, cols={len(df_norm.columns)}")
print(f"  ext  rows={len(df_ext)}, cols={len(df_ext.columns)}")

print("\n=== MATERIAL CODE INTEGRITY ===")
raw_codes  = set(df_raw['Material_Code'].tolist())
norm_codes = set(df_norm['Material_Code'].tolist())
ext_codes  = set(df_ext['Material_Code'].tolist())
print(f"  raw  unique codes: {df_raw['Material_Code'].nunique()}")
print(f"  norm unique codes: {df_norm['Material_Code'].nunique()}")
print(f"  ext  unique codes: {df_ext['Material_Code'].nunique()}")
print(f"  raw  dup codes: {df_raw['Material_Code'].duplicated().sum()}")
print(f"  norm dup codes: {df_norm['Material_Code'].duplicated().sum()}")
print(f"  ext  dup codes: {df_ext['Material_Code'].duplicated().sum()}")
print(f"  raw  dup rows: {df_raw.duplicated().sum()}")
print(f"  raw vs norm code mismatch: {len(raw_codes.symmetric_difference(norm_codes))}")
print(f"  raw vs ext  code mismatch: {len(raw_codes.symmetric_difference(ext_codes))}")

print("\n=== EXT COLUMNS LIST ===")
ex_cols = [c for c in df_ext.columns if c.startswith('EX_')]
audit_cols = [c for c in df_ext.columns if c.startswith('extraction_')]
orig_cols = [c for c in df_ext.columns if not c.startswith('EX_') and not c.startswith('extraction_')]
print(f"  Original carry-through: {orig_cols}")
print(f"  EX_ attribute cols ({len(ex_cols)}): {ex_cols[:15]}...")
print(f"  audit cols ({len(audit_cols)}): {audit_cols}")
