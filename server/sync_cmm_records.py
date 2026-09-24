import sqlite3
import os
from datetime import datetime, timezone

db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/nmc.db"))
print(f"Opening database: {db_path}")

con = sqlite3.connect(db_path)
cur = con.cursor()

# 1. Inspect current status
cur.execute("SELECT COUNT(*) FROM material_mappings WHERE mapping_status = 'ACTIVE'")
active_mappings_count = cur.fetchone()[0]
print(f"Active material mappings: {active_mappings_count}")

# 2. Update inventory_records
cur.execute("""
    UPDATE inventory_records
    SET cmm_id = (
        SELECT mm.cmm_id 
        FROM material_mappings mm 
        WHERE mm.material_id = inventory_records.material_id 
          AND mm.mapping_status = 'ACTIVE'
    ),
    updated_at = ?
    WHERE material_id IN (
        SELECT material_id FROM material_mappings WHERE mapping_status = 'ACTIVE'
    )
""", (datetime.now(timezone.utc).isoformat(),))
inv_updated = cur.rowcount
print(f"Updated inventory_records rows: {inv_updated}")

# 3. Update demand_records
cur.execute("""
    UPDATE demand_records
    SET cmm_id = (
        SELECT mm.cmm_id 
        FROM material_mappings mm 
        WHERE mm.material_id = demand_records.material_id 
          AND mm.mapping_status = 'ACTIVE'
    ),
    updated_at = ?
    WHERE material_id IN (
        SELECT material_id FROM material_mappings WHERE mapping_status = 'ACTIVE'
    )
""", (datetime.now(timezone.utc).isoformat(),))
dem_updated = cur.rowcount
print(f"Updated demand_records rows: {dem_updated}")

# 4. Update procurement_history_records
cur.execute("""
    UPDATE procurement_history_records
    SET cmm_id = (
        SELECT mm.cmm_id 
        FROM material_mappings mm 
        WHERE mm.material_id = procurement_history_records.material_id 
          AND mm.mapping_status = 'ACTIVE'
    ),
    updated_at = ?
    WHERE material_id IN (
        SELECT material_id FROM material_mappings WHERE mapping_status = 'ACTIVE'
    )
""", (datetime.now(timezone.utc).isoformat(),))
phr_updated = cur.rowcount
print(f"Updated procurement_history_records rows: {phr_updated}")

con.commit()

# Verify non-null counts now
print("\n--- POST-SYNC VERIFICATION ---")
for t in ['inventory_records', 'demand_records', 'procurement_history_records']:
    cur.execute(f"SELECT COUNT(*), COUNT(cmm_id) FROM {t}")
    total, non_null = cur.fetchone()
    print(f"Table '{t}': total rows = {total}, with cmm_id = {non_null}")

# Query distinct cmm_ids
cur.execute("SELECT DISTINCT cmm_id FROM inventory_records WHERE cmm_id IS NOT NULL")
inv_cmms = cur.fetchall()
print(f"\nDistinct CMMs in inventory: {len(inv_cmms)}")
for (cmm,) in inv_cmms:
    cur.execute("SELECT national_material_code, canonical_description FROM nmc_common_materials WHERE id = ?", (cmm,))
    code, desc = cur.fetchone() or ("UNKNOWN", "UNKNOWN")
    cur.execute("SELECT COUNT(DISTINCT cpse_id), SUM(quantity_on_hand), SUM(available_quantity) FROM inventory_records WHERE cmm_id = ?", (cmm,))
    cpse_cnt, on_hand, avail = cur.fetchone()
    print(f"  [{code}] ({desc[:40]}...) -> CPSE count: {cpse_cnt}, On-hand: {on_hand}, Available: {avail}")

con.close()
