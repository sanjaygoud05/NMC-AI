import sqlite3
import json
from pathlib import Path

db_path = Path(__file__).resolve().parent.parent / "data" / "nmc.db"
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
tables = [r[0] for r in cur.fetchall()]

stats = {}
for t in tables:
    cur.execute(f"SELECT COUNT(*) FROM \"{t}\"")
    stats[t] = cur.fetchone()[0]

print(json.dumps(stats, indent=2))
