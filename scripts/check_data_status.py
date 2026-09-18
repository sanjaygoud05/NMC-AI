import sqlite3

conn = sqlite3.connect('data/review_store.db')
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [row[0] for row in cursor.fetchall()]

print("=== TABLES IN data/review_store.db ===")
for t in tables:
    try:
        cursor.execute(f"SELECT count(*) FROM {t}")
        cnt = cursor.fetchone()[0]
        print(f"  {t}: {cnt} rows")
    except Exception as e:
        print(f"  {t}: ERROR - {e}")

print("\n=== PROCUREMENT FACTS ===")
try:
    cursor.execute("SELECT cpse, count(*) FROM procurement_facts GROUP BY cpse")
    for row in cursor.fetchall():
        print(f"  CPSE: {row[0]}, Count: {row[1]}")
except Exception as e:
    print(f"  Error: {e}")

print("\n=== COMMON MASTER ITEMS ===")
try:
    cursor.execute("SELECT count(*) FROM common_material_master")
    print(f"  Total Common Master: {cursor.fetchone()[0]}")
    cursor.execute("SELECT cmm_id, category, item_name, count_of_members FROM common_material_master LIMIT 5")
    for row in cursor.fetchall():
        print(f"  {row}")
except Exception as e:
    print(f"  Error: {e}")

print("\n=== LEGACY MAPPINGS ===")
try:
    cursor.execute("SELECT cpse, count(*) FROM legacy_mappings GROUP BY cpse")
    for row in cursor.fetchall():
        print(f"  CPSE: {row[0]}, Count: {row[1]}")
except Exception as e:
    print(f"  Error: {e}")

print("\n=== PIPELINE ARTIFACTS / CSV FILES IN data/ ===")
import os, glob
for path in glob.glob("data/**/*.*", recursive=True):
    if not path.endswith('.pyc') and '__pycache__' not in path:
        print(f"  {path} ({os.path.getsize(path)} bytes)")
