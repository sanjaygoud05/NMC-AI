"""Audit quick check — size false-positive: 3/4 in matching 4 in"""
import re
import pandas as pd

ext = pd.read_csv('data/processed/extracted_attributes.csv', dtype=str)
ext = ext.where(ext.notna(), None)

# Check hose 3/4 in case
hose = ext[ext['Material_Description'].str.contains('3/4', na=False)]
print("Hose 3/4 in records:")
for _, r in hose.head(5).iterrows():
    print(f"  [{r.get('Material_Code')}] desc='{r.get('Material_Description')}' EX_size={r.get('EX_size')} struct_Size={r.get('Size')} conflict='{r.get('extraction_conflicts_detail')}'")

# Test the regex — does 3/4 in match both patterns?
test = "HYDRAULIC HOSE 3/4 in"
frac_match = re.search(r'\b(\d+/\d+\s*in)\b', test, re.IGNORECASE)
inch_match = re.search(r'\b(\d+(?:\.\d+)?\s*in)\b', test, re.IGNORECASE)
print(f"\nTest '{test}':")
print(f"  frac_match: {frac_match.group(1) if frac_match else None}")
print(f"  inch_match: {inch_match.group(1) if inch_match else None}")

# Check how many hose records have size conflict "3/4 in vs 4 in"
frac_inch_conflict = ext[ext['extraction_conflicts_detail'].str.contains(r"3/4.*4 in|4 in.*3/4", na=False, regex=True)]
print(f"\nRecords with '3/4 in vs 4 in' conflict: {len(frac_inch_conflict)}")

# Check all size conflicts where struct_size contains / (fractional)
size_frac_conflicts = ext[(ext['Size'].str.contains('/', na=False)) & (ext['extraction_has_conflict'] == 'True')]
print(f"\nRecords with fractional structured Size and any conflict: {len(size_frac_conflicts)}")
for _, r in size_frac_conflicts.head(10).iterrows():
    print(f"  [{r.get('Material_Code')}] struct_Size='{r.get('Size')}' EX_size='{r.get('EX_size')}' conflict='{r.get('extraction_conflicts_detail')}'")

# Check: when frac pattern matches AND inch pattern also matches same fragment
print("\n\nRoot cause: '3/4 in' matches BOTH frac pattern AND bare-digit '4 in'")
print("Since structured field wins (3/4 in from field), final EX_size=3/4 in is CORRECT")
print("But the conflict is flagged because description regex ALSO sets '4 in'")
print("Fix: run fraction inch check BEFORE integer inch, exclude already-set tokens")
