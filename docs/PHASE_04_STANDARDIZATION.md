# Phase 4 — Material Standardization & Canonicalization

## SIH26099: AI-Driven Standardization and Harmonization of Material Codes Across CPSEs

---

## 1. Objective
The objective of Phase 4 is to convert extracted engineering attributes (from Phase 3) into a **deterministic, consistent, explainable canonical representation**. 

Phase 4 standardizes how engineering concepts are expressed across divergent CPSE terminologies without performing record-to-record matching or premature entity resolution. It answers the question: *"How should the same engineering concept be represented consistently?"* while intentionally deferring the matching question (*"Are these two records the same material?"*) to subsequent phases.

---

## 2. Input
Authoritative primary input:
- `data/processed/extracted_attributes.csv` (Phase 3 output, 1,250 rows, 44 columns)
- `data/processed/normalized_materials.csv` (Phase 2 output, used solely for preserving original CPSE business metadata such as Plant, Material Status, Annual Consumption, and Last Purchase Date)

Input Immutability:
- `data/raw/CPSE_Material_Master_cleaned.csv` remains strictly immutable (SHA256: `1a45fccad5203de25f64bfda42e2f56667752bca4338a55913ae4a7babeafef1`).
- `data/processed/normalized_materials.csv` remains strictly unchanged.
- `data/processed/extracted_attributes.csv` remains strictly unchanged.

---

## 3. Output
The phase produces:
1. **Primary Dataset**: `data/processed/standardized_materials.csv` (1,250 rows, 73 columns)
2. **Audit Report**: `data/processed/standardization_report.json`
3. **Domain Dictionary**: `data/dictionaries/canonical_aliases.csv`
4. **Documentation**: `docs/PHASE_04_STANDARDIZATION.md`

---

## 4. Canonical Schema
Every material record preserves all raw fields, normalized fields, and Phase 3 extracted attributes, and appends the following canonical schema fields:

| Field Name | Type | Description |
|---|---|---|
| `Standardized_Description` | string | Concise, pipe-delimited human-readable description of populated canonical attributes |
| `Canonical_Material_Key` | string | Stable, machine-readable composite identifier of intrinsic material identity |
| `Canonical_Material_Family` | string | Normalized family (e.g. `VALVE`, `BEARING`, `FASTENER`, `PUMP`) |
| `Canonical_Material_Type` | string | Normalized type (e.g. `BALL VALVE`, `BALL BEARING`, `BOLT`, `NUT`) |
| `Canonical_Material_Subtype` | string | Subtype (e.g. `HEX`, `DEEP GROOVE`) |
| `Canonical_Material` | string | Material base composition (e.g. `STAINLESS STEEL`, `CARBON STEEL`, `XLPE`) |
| `Canonical_Material_Grade` | string | Technical grade (e.g. `ASTM A105`, `SS 316`, `ASTM A216 WCB`, `PT100`) |
| `Canonical_Nominal_Size` | string | Nominal diameter / size specification |
| `Canonical_Size` | string | Primary dimension (e.g. `1 IN`, `1/2 IN`, `80 MM`, `M16`, `25 SQ MM`, `10 A`) |
| `Canonical_Length` | string | Length dimension (e.g. `75 MM`, `1000 MM`) |
| `Canonical_Width` | string | Width dimension |
| `Canonical_Height` | string | Height dimension |
| `Canonical_Diameter` | string | Diameter dimension (e.g. `20 MM`, `12 MM`) |
| `Canonical_Thickness` | string | Wall/plate thickness |
| `Canonical_Pressure_Class` | string | Pressure rating (e.g. `150#`, `300#`, `CL150`) |
| `Canonical_Schedule` | string | Pipe schedule |
| `Canonical_Rating` | string | Engineering rating (e.g. `90 DEG`) |
| `Canonical_Standard` | string | Industry standard (e.g. `API 608`, `ASME B16.5`, `IEC 60751`, `ISO 15`) |
| `Canonical_Specification` | string | Preserved normalized specification string |
| `Canonical_Coating` | string | Protective treatment (e.g. `ZINC PLATED`, `GALVANIZED`, `PTFE`, `RUBBER`) |
| `Canonical_Connection_Type` | string | Joint connection (e.g. `FLANGED`, `THREADED`, `WELD NECK`, `SOCKET WELD`) |
| `Canonical_End_Type` | string | End preparation |
| `Canonical_Construction` | string | Manufacturing method (e.g. `FLOATING`, `SEAMLESS`, `FORGED`) |
| `Canonical_Orientation` | string | Mechanical orientation (e.g. `HORIZONTAL`, `VERTICAL`) |
| `Canonical_Manufacturer` | string | Normalized supplier/OEM entity |
| `Canonical_Manufacturer_Part_No` | string | Opaque technical part identifier |
| `Canonical_Unit` | string | Standardized UOM (`NOS`, `MTR`, `LTR`) |
| `Standardization_Changed` | boolean | True if any canonical attribute differs from Phase 3 input |
| `Standardization_Rule_Count` | integer | Total distinct rules applied to this record |
| `Standardization_Rules_Applied` | string | Semicolon-delimited list of rule IDs applied |
| `Standardization_Conflict_Preserved` | boolean | True if Phase 3 detected a conflict that was preserved |

---

## 5. Canonical Key Design
`Canonical_Material_Key` represents the intrinsic engineering identity of the material item.

Rules:
1. **Stable Attribute Order**:
   `material_family` → `material_type` → `material_subtype` → `material` → `material_grade` → `nominal_size` → `size` → `length` → `width` → `height` → `diameter` → `thickness` → `pressure_class` → `schedule` → `rating` → `standard` → `coating` → `connection_type` → `end_type` → `construction` → `orientation`.
2. **Exclusion of External Metadata**:
   Procurement metadata (`CPSE`, `Material_Code`, `Plant`, `Annual_Consumption`, `Last_Purchase_Date`), commercial attributes (`Manufacturer`, `Manufacturer_Part_No`), and generic units (`Unit`) are strictly excluded from the canonical material key.
3. **Whitespace & Delimiters**:
   Attributes are separated by `|`. Internal whitespace and punctuation are replaced by single underscores `_`.
4. **Omission of Missing Attributes**:
   Unpopulated fields are omitted entirely; no placeholder values (`UNKNOWN`, `N/A`, `NULL`) are ever injected.

Examples:
- `VALVE|BALL_VALVE|STAINLESS_STEEL|SS_316|1_IN|API_608|STAINLESS_STEEL|FLOATING`
- `FASTENER|BOLT|HEX|CARBON_STEEL|CARBON_STEEL|M16|75_MM|20_MM|IS_1363|ZINC_PLATED`
- `BEARING|BALL_BEARING|CHROME_STEEL|CHROME_STEEL|6207|ISO_15`
- `PUMP|CENTRIFUGAL_PUMP|STAINLESS_STEEL|SS_316|80_MM|API_610|PAINTED|HORIZONTAL`

---

## 6. Standardization Rules
All transformations are deterministic, rule-based, and logged with unique rule identifiers:

- `FAMILY_CANONICAL`, `FAMILY_UPPERCASE`: Standardizes families to canonical terms (`VALVE`, `BEARING`, `PUMP`, `FASTENER`, etc.).
- `TYPE_CANONICAL`, `TYPE_UPPERCASE`: Maps terminology variants while preserving technical distinction.
- `SUBTYPE_CANONICAL`: Normalizes subtypes (`HEX`, `DEEP GROOVE`).
- `MATERIAL_CANONICAL`: Canonicalizes base material composition.
- `GRADE_FORMAT_ASTM_A105`, `GRADE_FORMAT_ASTM_A216_WCB`, `GRADE_FORMAT_ASTM_A234_WPB`, `GRADE_FORMAT_ASTM_A106_GRB`: Normalizes standard prefix formats while retaining technical grades.
- `GRADE_FORMAT_SS316`, `GRADE_FORMAT_SS304`, `GRADE_CANONICAL_316`, `GRADE_FORMAT_PT100`: Cleans metallurgical grade designations.
- `SIZE_FORMAT_INCH`, `SIZE_FORMAT_FRACTION_INCH`, `SIZE_FORMAT_MIXED_INCH`: Standardizes imperial dimensions (`1 IN`, `3/4 IN`, `1-1/2 IN`).
- `SIZE_FORMAT_MM`, `LENGTH_FORMAT_MM`, `DIAMETER_FORMAT_MM`: Standardizes metric measurements (`80 MM`, `75 MM`, `20 MM`).
- `SIZE_FORMAT_METRIC_BOLT`: Retains exact fastener metric codes (`M8`, `M16`, `M16X75`, `M20`).
- `SIZE_FORMAT_SQMM`: Standardizes cable conductor sizes (`1.5 SQ MM`, `25 SQ MM`).
- `SIZE_FORMAT_BAR`: Standardizes pressure ranges (`0-25 BAR`).
- `SIZE_FORMAT_AMPERE`: Standardizes fuse currents (`10 A`, `2 A`).
- `SIZE_FORMAT_WIRE`: Standardizes sensor lead configurations (`3-WIRE`, `4-WIRE`).
- `SIZE_BEARING_NUMBER`: Retains ISO bearing numbers (`6207`, `6208`).
- `STANDARD_FORMAT_API`, `STANDARD_FORMAT_ASME`, `STANDARD_FORMAT_ASTM`, `STANDARD_FORMAT_IEC`, `STANDARD_FORMAT_ISO`, `STANDARD_FORMAT_IS`, `STANDARD_FORMAT_SAE`, `STANDARD_FORMAT_EN`: Standardizes prefix spacing and capitalization.
- `COATING_CANONICAL`, `COATING_FORMAT`: Normalizes protective treatments (`ZINC PLATED`, `GALVANIZED`).
- `CONNECTION_CANONICAL`, `CONSTRUCTION_CANONICAL`, `ORIENTATION_CANONICAL`: Normalizes mechanical specifications.

---

## 7. Alias Dictionaries
Controlled dictionary at `data/dictionaries/canonical_aliases.csv`:
- Only contains representation-safe synonyms (e.g. `ss` → `STAINLESS STEEL`, `ball-valve` → `BALL VALVE`, `zinc-plated` → `ZINC PLATED`).
- Contains **ZERO** engineering inference mappings (e.g. `A105` is NOT mapped to `CARBON STEEL`, `6207` is NOT mapped to `CHROME STEEL`, `6207` is NOT mapped to `ISO 15`).

---

## 8. Unit Handling
- Reuses Phase 2 canonical units: `NOS`, `MTR`, `LTR`.
- No arbitrary cross-system dimensional conversions are performed (e.g. `1 IN` is NOT converted to `25.4 MM`). Dimensions preserve their original engineering unit of definition.

---

## 9. Technical Identifier Handling
All technical identifiers are treated as authoritative and opaque:
- Standards (`API 610`, `ASME B16.5`, `IEC 60751`, `ISO 15`) are capitalized and space-normalized but never truncated or collapsed.
- Manufacturer part numbers (`PRI-640-42`, `HIN-899-26`) are preserved exactly as opaque strings without punctuation stripping.

---

## 10. Conflict Preservation
- 268 records with Phase 3 extraction conflicts are marked with `Standardization_Conflict_Preserved = True`.
- Conflicts resolved = 0.
- Genuine engineering conflicts (e.g. `M16` vs `M16X75`, `4-wire` vs `500 mm`) remain fully distinguishable and traceable.

---

## 11. No-Invention Policy
- Phase 4 only standardizes values present in Phase 3.
- If a bearing lacks explicit grade or standard in Phase 3, those attributes remain strictly `None`.
- If a centrifugal pump lacks an explicit standard in Phase 3, `API 610` is never hallucinated.

---

## 12. API Endpoints
The FastAPI server exposes:
- `GET /api/standardization/report`: Returns the full standardization report JSON.
- `GET /api/standardization/materials/{material_code}`: Returns single-material original fields, Phase 3 extracted attributes, Phase 4 canonical attributes, rules applied, and conflict status.
- `POST /api/standardization/run`: Executes the Phase 4 pipeline stage.

---

## 13. Frontend Integration
The `client/src/pages/Standardization.tsx` interface provides:
- KPI summary cards (Processed, Standardized, Canonical Keys, Preserved Conflicts, Zero Invention).
- Searchable and inspectable materials table with standardized descriptions and canonical keys.
- Side-by-side inspection dialog showing Phase 3 extracted attributes vs Phase 4 canonical attributes.
- Traceability breakdown of applied standardization rules and preserved conflicts.
- Raw dataset integrity verification card.

---

## 14. Test Strategy
Unit tests in `tests/unit/test_standardization.py` (26 tests) verify:
- Basic formatting and casing.
- Material and Material Grade semantic separation.
- Technical identifier canonicalization across all major standards.
- Size, metric bolt, fraction, and dimension formatting.
- Technical distinction (`M16` vs `M16X75`, `1 IN` vs `2 IN`, `BALL VALVE` vs `GATE VALVE`).
- Zero-invention compliance for bearings and pumps.
- Conflict preservation flag integrity.
- Bit-for-bit determinism.
- Exact 1,250 row count preservation.

Full test suite: 172/172 passing tests across all phases.

---

## 15. Idempotence
The standardization pipeline is 100% deterministic and idempotent:
- Output hash for Run 1: `5e93c66468d2813afd147234c53089f17b4400b07ca6ea168f3445a255fc72d6`
- Output hash for Run 2: `5e93c66468d2813afd147234c53089f17b4400b07ca6ea168f3445a255fc72d6`
- Result: **Bit-for-bit identical**.

---

## 16. Known Limitations
- Records categorized under divergent top-level CPSE taxonomies (e.g. `SAFETY` vs `VALVE` for pressure safety valves) retain distinct canonical keys, awaiting harmonization in Phase 5.
- Fasteners with embedded lengths (`M16X75`) produce distinct canonical keys from bare diameter fasteners (`M16`), which is correct engineering behavior pending candidate generation.

---

## 17. Why Matching is Intentionally Deferred
Material matching involves probabilistic candidate generation, multi-attribute fuzzy similarity, embedding vectors, and human-in-the-loop governance. Attempting to match records during canonicalization risks premature false positives and irrecoverable data loss. By establishing a clean, verified, deterministic canonical layer first, Phase 5 (Embeddings & Semantic Search) and Phase 6 (Candidate Matching & Harmonization) can operate on verified, trustworthy engineering attributes.
