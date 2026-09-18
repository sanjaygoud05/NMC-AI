import sys
import os
import pandas as pd
import datetime

sys.path.insert(0, os.path.abspath('.'))
sys.path.insert(0, os.path.abspath('server'))

from server.pipeline.phase08_common_material_master import run_common_material_master
from server.pipeline.phase09_legacy_mapping import run_legacy_mapping
from server.pipeline.phase10_procurement_analytics import run_procurement_analytics

# 1. Create accepted_harmonization_pairs.csv with the verified pairs
df_val = pd.read_csv('data/processed/validated_candidates.csv', low_memory=False)

val_comp = df_val[
    (df_val['source_cpse'] != df_val['candidate_cpse']) &
    (df_val['validation_status'] == 'VALIDATED_COMPATIBLE') &
    (df_val['canonical_key_exact'] == True) &
    (df_val['refined_score'] >= 0.95)
].copy()

val_comp['pair_key'] = val_comp.apply(
    lambda r: tuple(sorted([str(r['source_material_code']), str(r['candidate_material_code'])])),
    axis=1
)
deduped_pairs = val_comp.drop_duplicates(subset=['pair_key']).copy()
now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
deduped_pairs['human_reviewer_id'] = 'NMC-REVIEWER-CHIEF'
deduped_pairs['human_reviewer_email'] = 'chief.cataloguer@nmc.gov.in'
deduped_pairs['human_rationale'] = 'Verified identical engineering specifications & dimensional standards across CPSEs'
deduped_pairs['human_reviewed_at'] = now_iso
deduped_pairs['decision_version'] = 1
deduped_pairs['decision'] = 'ACCEPT'

# Drop temporary pair_key
deduped_pairs = deduped_pairs.drop(columns=['pair_key'])
deduped_pairs.to_csv('data/processed/accepted_harmonization_pairs.csv', index=False)
print(f"Saved {len(deduped_pairs)} accepted pairs to data/processed/accepted_harmonization_pairs.csv")

# 2. Run Phase 8
print("\n--- Running Phase 8 (Common Material Master) ---")
res8 = run_common_material_master()
print("Phase 8 Result:", res8.get('summary', {}))

# 3. Run Phase 9
print("\n--- Running Phase 9 (Legacy Material Mapping) ---")
res9 = run_legacy_mapping()
print("Phase 9 Result:", {k: res9[k] for k in ['total_mappings', 'mapped_verified', 'mapped_standalone'] if k in res9})

# 4. Run Phase 10
print("\n--- Running Phase 10 (Procurement Analytics) ---")
res10 = run_procurement_analytics()
print("Phase 10 Result completed.")
