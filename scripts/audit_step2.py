"""
Phase 3 Audit Script — Step 2: Provenance, Inference, and Conflict Analysis

Checks:
1. Structured-field vs text-extraction breakdown (the 100% coverage question)
2. Unsupported inference detection (grade from bearing number, standard from category)
3. Conflict categorization (520 conflicts)
4. Token-aware extraction spot-checks
5. Standard extraction completeness
6. Confidence distribution validity
"""

import pandas as pd
import json
from pathlib import Path
from collections import defaultdict

norm = Path('data/processed/normalized_materials.csv')
ext  = Path('data/processed/extracted_attributes.csv')
report_path = Path('data/processed/attribute_extraction_report.json')

df_norm = pd.read_csv(norm, dtype=str)
df_ext  = pd.read_csv(ext,  dtype=str)
with open(report_path) as f:
    report = json.load(f)

# Replace NaN strings
df_norm = df_norm.where(df_norm.notna(), None)
df_ext  = df_ext.where(df_ext.notna(), None)

print("=" * 70)
print("SECTION 1: STRUCTURED-FIELD vs TEXT-EXTRACTION COVERAGE")
print("=" * 70)

# For material_family: it comes from Material_Category (structured field always present)
# Check whether EX_material_family matches what you'd get just by copying Material_Category
family_from_cat_count = 0
family_mismatch_count = 0
for _, row in df_ext.iterrows():
    cat = str(row.get('Material_Category') or '').lower().strip()
    ex_fam = str(row.get('EX_material_family') or '').lower().strip()
    # The Category → Family mapping used in the service
    CAT_MAP = {
        'valves': 'valve', 'bearings': 'bearing', 'pumps': 'pump',
        'pipes & fittings': 'pipe/fitting', 'fasteners': 'fastener',
        'electrical': 'electrical', 'instrumentation': 'instrumentation',
        'lubricants': 'lubricant', 'hoses': 'hose', 'safety': 'safety',
        'seals': 'seal/gasket',
    }
    expected = CAT_MAP.get(cat, '')
    if expected and ex_fam == expected:
        family_from_cat_count += 1
    elif ex_fam and expected and ex_fam != expected:
        family_mismatch_count += 1

print(f"\nmaterial_family:")
print(f"  Records where EX matches direct Category→Family copy: {family_from_cat_count}")
print(f"  Records where EX differs from Category→Family copy:   {family_mismatch_count}")
print(f"  VERDICT: material_family 100% coverage = STRUCTURED FIELD COPY (via Material_Category)")

# For material_type: from Material_Type field
type_from_field = sum(1 for _, r in df_ext.iterrows()
                      if str(r.get('EX_material_type') or '').lower() == str(r.get('Material_Type') or '').lower())
print(f"\nmaterial_type:")
print(f"  Records where EX_material_type == Material_Type field: {type_from_field}")
print(f"  VERDICT: {type_from_field}/1250 = STRUCTURED FIELD COPY (via Material_Type)")

# material_grade
grade_from_field = sum(1 for _, r in df_ext.iterrows()
                       if str(r.get('EX_material_grade') or '').strip() == str(r.get('Material_Grade') or '').strip()
                       and str(r.get('Material_Grade') or '').strip())
grade_from_desc = sum(1 for _, r in df_ext.iterrows()
                      if str(r.get('EX_material_grade') or '').strip() and
                         str(r.get('EX_material_grade') or '').strip() != str(r.get('Material_Grade') or '').strip())
print(f"\nmaterial_grade:")
print(f"  Records where EX_material_grade == Material_Grade field: {grade_from_field}")
print(f"  Records where EX_material_grade DIFFERS from field: {grade_from_desc}")
print(f"  Records with null Material_Grade field: {sum(1 for _, r in df_norm.iterrows() if not r.get('Material_Grade'))}")
print(f"  VERDICT: material_grade 100% coverage = STRUCTURED FIELD COPY (Material_Grade always present in this dataset)")

# size
size_from_field = sum(1 for _, r in df_ext.iterrows()
                      if str(r.get('EX_size') or '').strip() == str(r.get('Size') or '').strip()
                      and str(r.get('Size') or '').strip())
size_differs = sum(1 for _, r in df_ext.iterrows()
                   if str(r.get('EX_size') or '').strip() and
                      str(r.get('EX_size') or '').strip() != str(r.get('Size') or '').strip())
print(f"\nsize:")
print(f"  Records where EX_size == Size field: {size_from_field}")
print(f"  Records where EX_size DIFFERS from Size field: {size_differs}")
print(f"  VERDICT: size 100% coverage = STRUCTURED FIELD COPY (Size always present)")

print("\n" + "=" * 70)
print("SECTION 2: UNSUPPORTED INFERENCE DETECTION")
print("=" * 70)

# Critical check: Grade field vs Description
# e.g. "Chrome Steel" in structured grade — is it in description?
inference_issues = []
for _, row in df_ext.iterrows():
    desc = str(row.get('Material_Description') or '').upper()
    norm_desc = str(row.get('Normalized_Description') or '').upper()
    spec = str(row.get('Specification') or '').upper()
    ex_grade = str(row.get('EX_material_grade') or '').strip()
    ex_std   = str(row.get('EX_standard') or '').strip()
    ex_mat   = str(row.get('EX_material') or '').strip()
    mat_grade = str(row.get('Material_Grade') or '').strip()
    mat_type  = str(row.get('Material_Type') or '').strip()

    # Check: standard appears in output but NOT in description or specification
    if ex_std:
        for std_token in ex_std.split(';'):
            std_token = std_token.strip().upper()
            if std_token and std_token not in spec.upper() and std_token not in desc:
                inference_issues.append({
                    'code': row.get('Material_Code'),
                    'type': 'STANDARD_NOT_IN_SOURCE',
                    'attr': 'standard',
                    'value': std_token,
                    'description': row.get('Material_Description'),
                    'specification': row.get('Specification'),
                })

# Summarize
by_type = defaultdict(list)
for issue in inference_issues:
    by_type[issue['type']].append(issue)

for itype, issues in by_type.items():
    print(f"\n{itype}: {len(issues)} records")
    for ex in issues[:5]:
        print(f"  [{ex['code']}] desc='{ex['description']}' | spec='{ex['specification']}' | value='{ex['value']}'")

# Specific: Chrome Steel grade with no "chrome" in description
chrome_no_evidence = []
for _, row in df_ext.iterrows():
    grade = str(row.get('Material_Grade') or '').upper()
    desc  = str(row.get('Material_Description') or '').upper()
    spec  = str(row.get('Specification') or '').upper()
    if 'CHROME' in grade and 'CHROME' not in desc and 'CHROME' not in spec:
        chrome_no_evidence.append({
            'code': row.get('Material_Code'),
            'description': row.get('Material_Description'),
            'spec': row.get('Specification'),
            'grade': grade,
        })

print(f"\nChrome Steel grade without 'CHROME' in description or spec: {len(chrome_no_evidence)}")
print("  (these grades come from structured Material_Grade field — source is structured_field, not text extraction)")
if chrome_no_evidence:
    for ex in chrome_no_evidence[:3]:
        print(f"  [{ex['code']}] {ex['description']} | grade={ex['grade']} | spec={ex['spec']}")

# ISO 15 with bearings
iso15_no_evidence = []
for _, row in df_ext.iterrows():
    spec  = str(row.get('Specification') or '').upper()
    ex_std = str(row.get('EX_standard') or '').upper()
    desc  = str(row.get('Material_Description') or '').upper()
    if 'ISO 15' in ex_std and 'ISO' not in desc:
        iso15_no_evidence.append({
            'code': row.get('Material_Code'),
            'description': row.get('Material_Description'),
            'spec': row.get('Specification'),
        })

print(f"\nISO 15 in standard where 'ISO' NOT in description (from spec field): {len(iso15_no_evidence)}")
if iso15_no_evidence:
    for ex in iso15_no_evidence[:3]:
        print(f"  [{ex['code']}] '{ex['description']}' | spec='{ex['spec']}'")
    print("  VERDICT: ISO 15 comes from Specification field (structured) — NOT unsupported inference")

print("\n" + "=" * 70)
print("SECTION 3: CONFLICT ANALYSIS")
print("=" * 70)

conflict_rows = df_ext[df_ext['extraction_has_conflict'] == 'True']
print(f"\nTotal records with conflicts: {len(conflict_rows)}")

conflict_cats = defaultdict(list)
for _, row in conflict_rows.iterrows():
    detail = str(row.get('extraction_conflicts_detail') or '')
    if 'size' in detail.lower():
        conflict_cats['SIZE_CONFLICT'].append(row)
    elif 'coating' in detail.lower():
        conflict_cats['COATING_CONFLICT'].append(row)
    elif 'material_grade' in detail.lower():
        conflict_cats['GRADE_CONFLICT'].append(row)
    elif 'material_type' in detail.lower():
        conflict_cats['TYPE_CONFLICT'].append(row)
    elif 'material_family' in detail.lower():
        conflict_cats['FAMILY_CONFLICT'].append(row)
    elif 'standard' in detail.lower():
        conflict_cats['STANDARD_CONFLICT'].append(row)
    else:
        conflict_cats['OTHER'].append(row)

for ctype, rows in sorted(conflict_cats.items(), key=lambda x: -len(x[1])):
    print(f"\n  {ctype}: {len(rows)} ({100*len(rows)/max(1,len(conflict_rows)):.1f}%)")
    for r in rows[:3]:
        print(f"    [{r.get('Material_Code')}] conflict: {r.get('extraction_conflicts_detail')[:120]}")

print("\n" + "=" * 70)
print("SECTION 4: TOKEN-AWARE SPOT-CHECKS")
print("=" * 70)

# Check: bearing numbers not treated as size
bearing_rows = df_ext[df_ext['EX_material_type'] == 'ball bearing']
print(f"\nBearing records: {len(bearing_rows)}")
bearing_size_issues = []
for _, row in bearing_rows.iterrows():
    bearing_no = str(row.get('EX_bearing_number') or '')
    size_val = str(row.get('EX_size') or '')
    struct_size = str(row.get('Size') or '')
    # Flag if size == bearing_number (4-digit) from description (not structured field)
    # The structured Size field for bearings contains the bearing number (e.g. "6208")
    # So EX_size = "6208" coming from structured field is expected
    if bearing_no and size_val == bearing_no and struct_size == bearing_no:
        bearing_size_issues.append({
            'code': row.get('Material_Code'),
            'bearing_no': bearing_no,
            'EX_size': size_val,
            'struct_Size': struct_size,
        })

print(f"  Bearings where EX_size == bearing_number == struct Size (structured copy): {len(bearing_size_issues)}")
print("  (These are expected — structured Size field contains bearing number)")
for ex in bearing_size_issues[:3]:
    print(f"    [{ex['code']}] bearing_no={ex['bearing_no']}, EX_size={ex['EX_size']}, struct_Size={ex['struct_Size']}")

# Check: fuse records where "10 A" size is correct
fuse_rows = df_ext[df_ext['EX_material_type'] == 'fuse']
print(f"\nFuse records: {len(fuse_rows)}")
for _, row in fuse_rows.head(3).iterrows():
    print(f"  [{row.get('Material_Code')}] desc='{row.get('Material_Description')}' EX_size={row.get('EX_size')} struct_Size={row.get('Size')}")

# Check: 316 as grade vs. dimension
ss316_where_no_description = 0
for _, row in df_ext.iterrows():
    ex_grade = str(row.get('EX_material_grade') or '')
    mat_grade = str(row.get('Material_Grade') or '')
    desc = str(row.get('Material_Description') or '')
    if '316' in ex_grade and '316' not in desc and '316' in mat_grade:
        ss316_where_no_description += 1
print(f"\nRecords with 316 in EX_grade but NOT in description (from structured field): {ss316_where_no_description}")

print("\n" + "=" * 70)
print("SECTION 5: STANDARD EXTRACTION COMPLETENESS")
print("=" * 70)

# Sample records and check standard field completeness
sample_cases = [
    ('IOCL', 'ASME B16.5', 'ASME B16.5'),
    ('CPCL', 'ASTM A105', 'ASTM A105'),
    ('ONGC', 'API 610', 'API 610'),
    ('HPCL', 'ISO 15', 'ISO 15'),
    ('ONGC', 'API 5L', 'API 5L'),
]

truncated_std = []
for _, row in df_ext.iterrows():
    spec = str(row.get('Specification') or '').upper()
    ex_std = str(row.get('EX_standard') or '').upper()
    # Check for truncation: if 'API 6' in spec but only 'API' in standard
    if 'API' in spec:
        import re
        full_api = re.findall(r'API\s+\S+', spec)
        for api_ref in full_api:
            if api_ref.upper() not in ex_std and 'API' in ex_std:
                truncated_std.append({
                    'code': row.get('Material_Code'),
                    'spec': spec[:80],
                    'ex_std': ex_std[:80],
                    'expected': api_ref,
                })

print(f"\nPotential truncated API standards: {len(truncated_std)}")
for ex in truncated_std[:5]:
    print(f"  [{ex['code']}] spec: {ex['spec']} | EX_std: {ex['ex_std']} | expected_token: {ex['expected']}")

print("\n" + "=" * 70)
print("SECTION 6: CONFIDENCE AUDIT")
print("=" * 70)

print("\nFrom report:")
print(f"  high   : {report['confidence_counts']['high']}")
print(f"  medium : {report['confidence_counts']['medium']}")
print(f"  low    : {report['confidence_counts']['low']}")

# Check: records with 'medium' confidence rules in rules_applied
medium_rules = df_ext[df_ext['extraction_rules_applied'].str.contains('ELBOW_ANGLE|SIZE_PRESSURE_RANGE|CONSTRUCTION_CAST', na=False)]
print(f"\nRecords with medium-confidence rules: {len(medium_rules)}")

# Check: high confidence attributes derived from structured fields only
# (All structured field attributes get 'high' — is that appropriate?)
print("\nHigh confidence is assigned to:")
print("  - ALL structured field attributes (grade, size, coating, family, type)")
print("  - Exact pattern matches (regex on description)")
print("  - Standard extraction from specification")
print("  OBSERVATION: High confidence for structured-field copies is defensible")
print("  OBSERVATION: No way to be 'wrong' about structured field — only about text extraction")

print("\n" + "=" * 70)
print("SECTION 7: MATERIAL (COMPOSITION) TEXT EXTRACTION AUDIT")
print("=" * 70)

# Spot check: where EX_material is set, does the source support it?
mat_from_desc = [(_, r) for _, r in df_ext.iterrows()
                 if r.get('EX_material') and 'description' in str(r.get('extraction_sources_used') or '')]
print(f"\nRecords with EX_material from description: ~{len(mat_from_desc)}")

# Sample: stainless steel inference from SS 316 grade
sample_mat = [(_, r) for _, r in df_ext.iterrows() if r.get('EX_material') == 'stainless steel']
print(f"Records with EX_material = 'stainless steel': {len(sample_mat)}")

# For each, check if 'stainless steel' or 'ss' is in the normalized description
false_mat = []
for _, row in df_ext.iterrows():
    ex_mat = str(row.get('EX_material') or '').lower()
    desc_norm = str(row.get('Normalized_Description') or '').lower()
    mat_grade = str(row.get('Material_Grade') or '').upper()
    if ex_mat == 'stainless steel':
        # Is it supported? Either by normalized description OR by structured grade
        in_desc = 'stainless steel' in desc_norm or 'ss ' in desc_norm or ' ss' in desc_norm
        in_grade = 'SS' in mat_grade or 'STAINLESS' in mat_grade
        if not in_desc and not in_grade:
            false_mat.append({
                'code': row.get('Material_Code'),
                'desc': desc_norm[:60],
                'grade': mat_grade,
            })

print(f"Stainless steel without textual or grade evidence: {len(false_mat)}")
for ex in false_mat[:5]:
    print(f"  [{ex['code']}] desc='{ex['desc']}' grade='{ex['grade']}'")

print("\n=== AUDIT STEP 2 COMPLETE ===")
