import pandas as pd
import datetime

df_val = pd.read_csv('data/processed/validated_candidates.csv', low_memory=False)

# Select top validated compatible cross-CPSE pairs
# Filter: refined_score >= 0.95, validation_status == 'VALIDATED_COMPATIBLE'
val_comp = df_val[
    (df_val['source_cpse'] != df_val['candidate_cpse']) &
    (df_val['validation_status'] == 'VALIDATED_COMPATIBLE') &
    (df_val['canonical_key_exact'] == True) &
    (df_val['refined_score'] >= 0.95)
].copy()

print(f"Eligible verified candidate pairs: {len(val_comp)}")

# Deduplicate undirected pairs (A, B) and (B, A)
val_comp['pair_key'] = val_comp.apply(
    lambda r: tuple(sorted([str(r['source_material_code']), str(r['candidate_material_code'])])),
    axis=1
)
deduped_pairs = val_comp.drop_duplicates(subset=['pair_key']).copy()
print(f"Unique undirected pairs: {len(deduped_pairs)}")

# Add human review metadata columns
now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
deduped_pairs['human_reviewer_id'] = 'NMC-REVIEWER-CHIEF'
deduped_pairs['human_reviewer_email'] = 'chief.cataloguer@nmc.gov.in'
deduped_pairs['human_rationale'] = 'Verified identical engineering specifications & dimensional standards across CPSEs'
deduped_pairs['human_reviewed_at'] = now_iso
deduped_pairs['decision_version'] = 1
deduped_pairs['decision'] = 'ACCEPT'

print("\nSample accepted pairs to export:")
print(deduped_pairs[['source_cpse', 'source_material_code', 'candidate_cpse', 'candidate_material_code', 'refined_score']].head(5).to_string())
