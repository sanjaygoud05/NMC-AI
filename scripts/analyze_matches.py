import pandas as pd

df_val = pd.read_csv('data/processed/validated_candidates.csv', nrows=20000, low_memory=False)
print("Validated candidates sample columns:", df_val.columns.tolist())
print("\nValidation status counts (sample):")
print(df_val['validation_status'].value_counts())

if 'refined_score' in df_val.columns:
    print("\nRefined score summary:")
    print(df_val['refined_score'].describe())

if 'source_cpse' in df_val.columns and 'candidate_cpse' in df_val.columns:
    cross = df_val[df_val['source_cpse'] != df_val['candidate_cpse']]
    print(f"\nCross-CPSE candidates in sample: {len(cross)}")
    print("Pairs:")
    print(cross.groupby(['source_cpse', 'candidate_cpse']).size())

high_conf = df_val[df_val['validation_status'] == 'VALIDATED']
print(f"\nTotal strictly VALIDATED in sample: {len(high_conf)}")
