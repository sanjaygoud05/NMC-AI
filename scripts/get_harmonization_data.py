import sqlite3
import pandas as pd
import json
import sys

conn = sqlite3.connect('data/review_store.db')

# Get multi-CPSE verified clusters
df_cmm = pd.read_sql_query("""
    SELECT common_code, common_description, material_family, member_count, 
           cpse_coverage, group_confidence, governance_status
    FROM common_material_master
    WHERE member_count > 1
    ORDER BY member_count DESC
""", conn)

def parse_cpses(val):
    if not val:
        return []
    try:
        return json.loads(val)
    except:
        return [c.strip() for c in str(val).strip("[]").replace("'","").replace('"','').split(",") if c.strip()]

df_cmm['cpses'] = df_cmm['cpse_coverage'].apply(parse_cpses)
df_cmm['cpse_count'] = df_cmm['cpses'].apply(len)

print("=== MULTI-CPSE CMM SUMMARY ===")
print(f"Total multi-CPSE clusters: {len(df_cmm)}")
print(f"Verified harmonized: {len(df_cmm[df_cmm['governance_status']=='VERIFIED_HARMONIZED'])}")
print(f"All 8 CPSEs clusters: {len(df_cmm[df_cmm['cpse_count']==8])}")
print(f"7+ CPSE clusters: {len(df_cmm[df_cmm['cpse_count']>=7])}")
print(f"5+ CPSE clusters: {len(df_cmm[df_cmm['cpse_count']>=5])}")

print("\n=== TOP 10 VERIFIED MULTI-CPSE CMM CLUSTERS ===")
verified_multi = df_cmm[df_cmm['governance_status']=='VERIFIED_HARMONIZED'].head(10)
print(verified_multi[['common_code', 'common_description', 'member_count', 'cpse_count', 'governance_status']].to_string())

# Get cross-CPSE pair counts from members
print("\n=== CPSE PAIR OVERLAP COUNTS ===")
df_members = pd.read_sql_query("""
    SELECT m.source_cpse, m.common_material_id
    FROM common_material_members m
    INNER JOIN common_material_master c ON c.common_material_id = m.common_material_id
    WHERE c.member_count > 1
""", conn)

if not df_members.empty:
    pair_counts = {}
    for cmm_id, grp in df_members.groupby('common_material_id'):
        cpses = sorted(grp['source_cpse'].tolist())
        for i, c1 in enumerate(cpses):
            for c2 in cpses[i+1:]:
                pair = f"{c1} -- {c2}"
                pair_counts[pair] = pair_counts.get(pair, 0) + 1
    pair_df = pd.DataFrame({'pair': list(pair_counts.keys()), 'count': list(pair_counts.values())})
    pair_df = pair_df.sort_values('count', ascending=False)
    for _, row in pair_df.head(20).iterrows():
        print(f"  {row['pair']}: {row['count']}")

print("\n=== FAMILY DISTRIBUTION OF MULTI-CPSE CLUSTERS ===")
family_counts = df_cmm['material_family'].value_counts()
print(family_counts.to_string())
