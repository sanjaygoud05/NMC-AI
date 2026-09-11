# Phase 6 — Technical Validation, Confidence Refinement & Review Preparation

## SIH26099: AI-Driven Standardization and Harmonization of Material Codes Across CPSEs

---

## 1. Executive Summary & Objective
Phase 6 implements the deterministic technical validation, confidence refinement, and human review preparation layer for the SIH26099 Material Harmonization Platform.

Taking the **37,500 candidate pairs** generated in Phase 5 from `data/processed/match_candidates.csv` and the **1,250 standardized material records** from `data/processed/standardized_materials.csv`, Phase 6 subjects each candidate pair to deep engineering rule checks, null-aware attribute consistency analysis, upstream conflict propagation, and domain precedence logic.

### Core Philosophy: Candidates, Not Common Material Identity
- Phase 6 **strictly produces validated candidate evidence**.
- `VALIDATED_COMPATIBLE` explicitly means: **"Technically validated compatible candidate, not final common-material identity."**
- Phase 6 **does NOT** create the Common Material Master.
- Phase 6 **does NOT** generate Common Material Codes.
- Phase 6 **does NOT** merge material records.
- Phase 6 **does NOT** finalize legacy mappings.
- Phase 6 **does NOT** claim to have "resolved" source conflicts; all upstream Phase 3 and Phase 4 conflict metadata is strictly preserved untouched.
- Phase 6 **does NOT** use procurement data (`Annual_Consumption` or spend) for technical review priority.
- Phase 6 **does NOT** use an LLM or probabilistic replacement for missing engineering attributes.

---

## 2. Upstream Immutability Lock & Input Integrity

All upstream datasets and previous phase outputs remain strictly bit-for-bit identical before and after Phase 6 execution:

| Dataset / Artifact | Purpose | Verified SHA256 Hash | Status |
|---|---|---|---|
| `data/raw/CPSE_Material_Master_cleaned.csv` | Raw Source Master | `1a45fccad5203de25f64bfda42e2f56667752bca4338a55913ae4a7babeafef1` | **IMMUTABLE** |
| `data/processed/normalized_materials.csv` | Phase 2 Normalized | `34891ddaffba57cb3956d4a1172b554077e87dfe36e513e641022bc5634abffc` | **IMMUTABLE** |
| `data/processed/extracted_attributes.csv` | Phase 3 Extracted | `8fc02888a909679f24346982ebde84a21ee756e80d4d0e9a3d94023580633f4e` | **IMMUTABLE** |
| `data/processed/standardized_materials.csv` | Phase 4 Standardized | `5e93c66468d2813afd147234c53089f17b4400b07ca6ea168f3445a255fc72d6` | **IMMUTABLE** |
| `data/processed/match_candidates.csv` | Phase 5 Candidates | `0337a33c1170b64c7f40edb6c82419269f847e06c0b35a174a1434ce77407ca3` | **IMMUTABLE** |

---

## 3. Engineering Precedence Hierarchy

Engineering attributes take precedence over semantic/textual similarity when they conflict. Rather than treating every attribute difference as an automatic disqualification, Phase 6 enforces the following 4-tier hierarchy:

1. **`HARD_ENGINEERING_CONFLICT` (`HARD_INCOMPATIBLE`)**:
   - Physical, dimensional, metallurgical, or casting/forging contradictions (`2 IN` vs `3 IN`, `SS 304` vs `SS 316`, `ASTM A105` vs `ASTM A216 WCB`).
   - **Action**: Overrides semantic similarity. Validation status set to `ENGINEERING_INCOMPATIBLE`. Refined score is penalized and **strictly hard-capped at $< 0.40$**. Confidence is forced to `LOW`.
2. **`SOFT_ENGINEERING_DIFFERENCE`**:
   - Secondary dimensional omissions or subtype variances where materials belong to the same component family (e.g., `M16` bolt without length vs `M16X75` bolt with length).
   - **Action**: Penalizes confidence by $-0.15$. Validation status set to `REVIEW_REQUIRED`. Candidate remains fully available in the review queue.
3. **`REPRESENTATION_DIFFERENCE` (`REPRESENTATION_COMPATIBLE`)**:
   - Equivalent aliases or formatting differences representing the identical physical engineering item (e.g., `ASTM A105` vs `A105`, `SS 316` vs `STAINLESS STEEL 316`).
   - **Action**: Treated as representational variation. Little to no penalty. Validation status set to `PROBABLE_COMPATIBLE`. Original upstream conflict metadata is preserved untouched.
4. **`MISSING_ATTRIBUTE`**:
   - `NULL vs NULL` or `NULL vs Populated`.
   - **Action**: Evaluated as **NEUTRAL**. Never infer compatibility or incompatibility from absence alone.

---

## 4. Deterministic Validation Status Taxonomy

Every candidate pair is classified into exactly one of five deterministic statuses:

| Validation Status | Definition & Criteria | Count | Percentage |
|---|---|---|---|
| `VALIDATED_COMPATIBLE` | Complete core attribute agreement, zero conflicts; candidate for Phase 7 human review / downstream harmonization analysis | 8,608 | 23.0% |
| `PROBABLE_COMPATIBLE` | High attribute agreement with representation differences or minor secondary variance. | 528 | 1.4% |
| `REVIEW_REQUIRED` | Soft engineering difference (e.g. `M16` vs `M16X75`) requiring expert triage. | 7,088 | 18.9% |
| `ENGINEERING_INCOMPATIBLE` | Definite physical/metallurgical incompatibility. Hard-capped $< 0.40$. | 21,276 | 56.7% |
| `INSUFFICIENT_EVIDENCE` | Sparse co-populated attributes ($< 2$) where compatibility cannot be determined. | 0 | 0.0% |

---

## 5. Pure Technical Review Prioritization

Review priority is calculated **purely from technical validation evidence**, completely independent of procurement value, spend, or consumption volume:

- **`CRITICAL` (7,337 candidates)**:
  - Cross-CPSE candidate pairs with `REVIEW_REQUIRED` (soft engineering differences like `M16` vs `M16X75`), OR
  - Cross-CPSE candidate pairs with upstream conflict flags preserved from Phase 3/4.
- **`HIGH` (4,854 candidates)**:
  - Cross-CPSE candidate pairs with `PROBABLE_COMPATIBLE` or high candidate score needing engineering sign-off.
- **`MEDIUM` (3,917 candidates)**:
  - Internal CPSE review items or standard same-CPSE candidate pairs.
- **`LOW` (21,392 candidates)**:
  - Disqualified `ENGINEERING_INCOMPATIBLE` pairs or low-scoring candidates.

---

## 6. Deterministic Benchmark Validation Results

All six required benchmark validation scenarios were executed and verified:

| Benchmark Case | Evaluated Candidate Pair | Engineering Conflict Class | Validation Status | Refined Confidence | Status |
|---|---|---|---|---|---|
| **Strong Cross-CPSE Material** | Identical Ball Valve (IOCL vs ONGC) | `NO_CONFLICT` | `VALIDATED_COMPATIBLE` | `HIGH` (Score: 1.000) | **PASS** |
| **ASTM A105 vs A105** | Standard prefix variation | `REPRESENTATION_DIFFERENCE` | `PROBABLE_COMPATIBLE` | `MEDIUM`/`HIGH` (Score: 0.800) | **PASS** |
| **M16 vs M16X75** | Metric bolt without vs with length | `SOFT_ENGINEERING_DIFFERENCE` | `REVIEW_REQUIRED` | `MEDIUM` (Score: 0.600) | **PASS** |
| **SS 304 vs SS 316** | Grade 304 vs 316 (molybdenum mismatch) | `HARD_INCOMPATIBLE` | `ENGINEERING_INCOMPATIBLE` | `LOW` (Score: 0.380) | **PASS** |
| **2 IN vs 3 IN** | 2" pipe vs 3" pipe size mismatch | `HARD_INCOMPATIBLE` | `ENGINEERING_INCOMPATIBLE` | `LOW` (Score: 0.350) | **PASS** |
| **ASTM A105 vs ASTM A216 WCB** | Forged CS vs Cast WCB CS | `HARD_INCOMPATIBLE` | `ENGINEERING_INCOMPATIBLE` | `LOW` (Score: 0.320) | **PASS** |

---

## 7. Generated Output Artifacts & Verification

### 1. `data/processed/validated_candidates.csv`
- Total Rows: 37,500
- Verified SHA256: `bc434f434a25aff84a30f3acb4750a0982e19ad125b23cbd5d2c8a84aab89cbc`
- Key Schema Fields Appended:
  - `validation_status`
  - `validation_reason_codes`
  - `refined_score`
  - `refined_confidence`
  - `review_priority`
  - `validation_evidence`
  - `upstream_conflict_present`
  - `upstream_conflict_details`
  - `upstream_conflict_preserved`

### 2. `data/processed/validation_report.json`
- Input Candidates: 37,500
- Output Candidates: 37,500 (`rows_preserved: true`)
- Execution Duration: ~4.3 seconds
- Idempotence: Two consecutive runs produced bit-for-bit identical SHA256 checksums (`bc434f434a25aff84a30f3acb4750a0982e19ad125b23cbd5d2c8a84aab89cbc`).

---

## 8. API & Frontend Integration

### FastAPI Endpoints (`server/app/api/review.py`)
- `GET /api/review/queue`: Paginated review queue with filtering by `status`, `priority`, `source_cpse`, `candidate_cpse`, `cross_cpse_only`, and `search`. Sorted by priority (`CRITICAL` $\rightarrow$ `HIGH` $\rightarrow$ `MEDIUM` $\rightarrow$ `LOW`).
- `GET /api/review/stats`: Distribution metrics across statuses, priorities, confidences, and conflict classes.
- `GET /api/review/{candidate_id}`: Full candidate validation detail including attribute-level similarity breakdown.
- `POST /api/review/{candidate_id}/decision`: Records reviewer audit notes without modifying master records.

### React + TypeScript + Vite Frontend (`client/src/pages/Review.tsx`)
- Connected to live backend via `client/src/services/reviewService.ts`.
- KPI summary cards displaying Total Validated Candidates, Critical Priority Items, Review Required Queue, and Incompatibilities Blocked.
- Full filter toolbar with live pagination and search.
- Interactive side-by-side material evidence modal showing exact attribute differences, reason code badges, and audit note logging.

---

## 9. Automated Testing & Verification Summary

1. **Unit Test Suite** (`python -m pytest tests/unit/test_validation.py -v`):
   - **12/12 PASS** (all benchmarks, precedence rules, reason codes, status taxonomy, and dataset integrity).
2. **Full Repository Regression Suite** (`python -m pytest tests/ -v`):
   - **199/199 PASS** (0 regressions across Phases 0–6).
3. **Python Bytecode Compilation** (`python -m compileall server/ tests/`):
   - **0 errors**.
4. **Frontend TypeScript Check** (`cd client && npx tsc --noEmit`):
   - **0 errors**.
5. **Frontend Linting** (`cd client && npm run lint`):
   - **0 errors**.
6. **Frontend Production Build** (`cd client && npm run build`):
   - **0 errors** (Production bundle built cleanly in 5.16s).
