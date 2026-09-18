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

print("\n=== PROCUREMENT FACTS BY CPSE ===")
try:
    cursor.execute("SELECT cpse, count(*) FROM procurement_facts GROUP BY cpse")
    for row in cursor.fetchall():
        print(f"  CPSE: {row[0]}, Count: {row[1]}")
except Exception as e:
    print(f"  Error: {e}")

print("\n=== LEGACY MAPPINGS BY CPSE ===")
try:
    cursor.execute("SELECT cpse, count(*) FROM legacy_mappings GROUP BY cpse")
    for row in cursor.fetchall():
        print(f"  CPSE: {row[0]}, Count: {row[1]}")
except Exception as e:
    print(f"  Error: {e}")

print("\n=== CANDIDATE MATCHES / REVIEWS ===")
for t in ['candidate_matches', 'match_reviews', 'common_material_master']:
    try:
        cursor.execute(f"SELECT count(*) FROM {t}")
        print(f"  {t}: {cursor.fetchone()[0]} rows")
    except Exception as e:
        print(f"  {t}: {e}")

print("\n=== RECENT UPLOAD IN DATASETS MANIFEST ===")
import json
try:
    with open('data/uploads/datasets_manifest.json') as f:
        data = json.load(f)
        print("Active / current dataset:", data.get('active_dataset_id'))
        print("Datasets in manifest:", len(data.get('datasets', [])))
        for d in data.get('datasets', []):
            print(f"  ID: {d.get('id')}, Status: {d.get('status')}, Records: {d.get('record_count')}, Filename: {d.get('filename')}")
except Exception as e:
    print("Error reading manifest:", e)
