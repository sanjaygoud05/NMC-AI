"""
Sync Localhost Database (SQLite) to Deployed Render Database (PostgreSQL)
Exports all tables from data/nmc.db and pushes them to the live Render backend API.
"""

import os
import sys
import sqlite3
import json
from pathlib import Path
import httpx

BASE_DIR = Path(__file__).resolve().parent.parent
LOCAL_DB = BASE_DIR / "data" / "nmc.db"
TARGET_URL = os.getenv("TARGET_API_URL", "https://nmc-ai-backend.onrender.com").rstrip("/")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "nmc-admin-2026")

TABLES = [
    "cpsEs",
    "reviewers",
    "datasets",
    "materials",
    "material_matches",
    "nmc_common_materials",
    "material_mappings",
    "review_decisions",
    "audit_logs",
    "inventory_records",
    "demand_records",
    "procurement_history_records",
    "review_notifications",
]

def export_local_data():
    if not LOCAL_DB.exists():
        print(f"Error: Local database not found at {LOCAL_DB}")
        sys.exit(1)
        
    print(f"Reading local SQLite database: {LOCAL_DB}")
    conn = sqlite3.connect(LOCAL_DB)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    payload = {}
    for tbl in TABLES:
        try:
            cur.execute(f'SELECT * FROM "{tbl}"')
            rows = [dict(r) for r in cur.fetchall()]
            payload[tbl] = rows
            print(f"  Exported {len(rows):4d} records from '{tbl}'")
        except sqlite3.OperationalError as e:
            print(f"  Notice: table '{tbl}' not found in SQLite ({e})")
            payload[tbl] = []
            
    conn.close()
    return payload

def sync_to_backend(payload):
    print(f"\nConnecting to live Render API: {TARGET_URL}...")
    
    with httpx.Client(timeout=120.0) as client:
        # 1. Health check
        h_res = client.get(f"{TARGET_URL}/api/health")
        if h_res.status_code != 200:
            print(f"Failed to reach target health endpoint: {h_res.status_code} {h_res.text}")
            sys.exit(1)
        print("Live backend is online and healthy.")
        
        # 2. Login as Admin
        login_res = client.post(
            f"{TARGET_URL}/api/nmc/auth/admin-login",
            json={"password": ADMIN_PASSWORD},
        )
        if login_res.status_code != 200:
            print(f"Admin authentication failed: {login_res.status_code} {login_res.text}")
            sys.exit(1)
            
        token = login_res.json().get("token")
        print("Authenticated successfully as Admin.")
        
        # 3. Post full sync payload
        print("Uploading and synchronizing platform database...")
        sync_res = client.post(
            f"{TARGET_URL}/api/nmc/auth/sync-database",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        
        if sync_res.status_code != 200:
            print(f"Database sync failed: {sync_res.status_code} {sync_res.text}")
            sys.exit(1)
            
        result = sync_res.json()
        print("\nSync Results:")
        for tbl, cnt in result.get("synced", {}).items():
            print(f"  [OK] {tbl}: {cnt} rows synchronized")
            
        print("\nAll localhost data has been successfully pushed to the deployed database!")

if __name__ == "__main__":
    data = export_local_data()
    sync_to_backend(data)
