import sqlite3
import pandas as pd
import json

conn = sqlite3.connect('data/review_store.db')

cursor = conn.cursor()
cursor.execute("PRAGMA table_info(common_material_members)")
print("common_material_members columns:", [col[1] for col in cursor.fetchall()])

df_cmm = pd.read_sql_query("SELECT * FROM common_material_master", conn)
print(f"Total CMM records: {len(df_cmm)}")

# Member counts distribution
print("\nMember count distribution:")
print(df_cmm['member_count'].value_counts())

# Governance status distribution
print("\nGovernance status distribution:")
print(df_cmm['governance_status'].value_counts())

# Parse cpse_coverage
def parse_cpses(val):
    if not val:
        return []
    try:
        res = json.loads(val)
        return res if isinstance(res, list) else [str(res)]
    except:
        return [c.strip() for c in val.strip("[]").replace("'", "").replace('"', '').split(",") if c.strip()]

df_cmm['cpses'] = df_cmm['cpse_coverage'].apply(parse_cpses)
df_cmm['cpse_count'] = df_cmm['cpses'].apply(len)

print("\nCPSE count per CMM distribution:")
print(df_cmm['cpse_count'].value_counts())

# Multi-CPSE clusters (cpse_count > 1 or member_count > 1)
multi_cpses = df_cmm[df_cmm['cpse_count'] > 1]
print(f"\nTotal Multi-CPSE CMM entities: {len(multi_cpses)}")
if not multi_cpses.empty:
    print(multi_cpses[['common_code', 'common_description', 'member_count', 'cpse_count', 'group_confidence', 'governance_status']].head(10).to_string())

# Also check candidate_matches or validated_candidates or review_decisions
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
print("\nTables:", [r[0] for r in cursor.fetchall()])
