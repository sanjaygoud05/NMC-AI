import pandas as pd

df = pd.read_csv('data/processed/validated_candidates.csv', low_memory=False)
print("Total rows in validated_candidates.csv:", len(df))

# Filter to cross-CPSE compatible pairs
cross_comp = df[
    (df['source_cpse'] != df['candidate_cpse']) & 
    (df['validation_status'] == 'VALIDATED_COMPATIBLE')
]
print(f"Total cross-CPSE compatible pairs: {len(cross_comp)}")

# Check exact key matches
exact_keys = cross_comp[cross_comp['canonical_key_exact'] == True]
print(f"Total exact canonical key cross-CPSE pairs: {len(exact_keys)}")

# Refined score >= 0.9
high_score = cross_comp[cross_comp['refined_score'] >= 0.9]
print(f"Total refined_score >= 0.9 cross-CPSE pairs: {len(high_score)}")

# Look at distribution across CPSE pairs
print("\nCross-CPSE Compatible Distribution:")
print(cross_comp.groupby(['source_cpse', 'candidate_cpse']).size().unstack(fill_value=0))

print("\nSample top cross-CPSE compatible matches:")
print(cross_comp[['source_cpse', 'source_material_code', 'candidate_cpse', 'candidate_material_code', 'refined_score', 'source_canonical_key']].head(10).to_string())
