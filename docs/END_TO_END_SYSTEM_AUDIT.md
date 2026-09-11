# SIH26099 — End-to-End System Validation and Comprehensive Audit Report

**Project Title:** AI-Driven Standardization and Harmonization of Material Codes Across CPSEs  
**Audit Date:** 2026-09-11  
**Audit Scope:** Full End-to-End System (Phases 0 through 10)  
**System Status:** **PASS**

---

## Executive Summary & System Verdict

A comprehensive end-to-end integration, runtime, UI, and data-flow validation was conducted across the entire SIH26099 material harmonization platform. The authoritative baseline dataset (`data/raw/CPSE_Material_Master_cleaned.csv`, 1,250 records across ONGC, IOCL, HPCL, and CPCL) remains 100% frozen and bit-for-bit immutable (`SHA256: 1a45fccad5203de25f64bfda42e2f56667752bca4338a55913ae4a7babeafef1`). All 10 pipeline phases (Phase 1 Ingestion through Phase 10 Procurement Analytics) execute deterministically with 100% record universe retention, zero data loss, strict per-UOM physical volume conservation, and full end-to-end lineage traceability.

All genuine runtime, UI, and data integration issues discovered during the audit (including non-working file upload zone, FastAPI `NaN` serialization exceptions, and disconnected dashboard metric hooks) have been permanently resolved without modifying frozen baseline data or altering architectural constraints.

---

## 1. System Inventory

### 1.1 Architecture & Stack Summary
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + React Router v6 + Recharts v2.15 + TanStack Query v5 + Lucide React.
- **Backend:** FastAPI + Python 3.14 + Uvicorn + Pydantic v2.
- **Database / Persistence:** Supabase PostgreSQL + Deterministic local CSV/JSON artifact governance.
- **ML / Pipeline:** Sentence-Transformers (all-MiniLM-L6-v2), PyTorch, Scikit-learn, RapidFuzz, Pandas, NumPy.

### 1.2 Authoritative Baseline Artifact Inventory & SHA-256 Hashes
| Phase / Artifact Name | File Path | Record Count | Authoritative SHA-256 Checksum | Immutability Status |
| :--- | :--- | :--- | :--- | :--- |
| **Raw Baseline** | `data/raw/CPSE_Material_Master_cleaned.csv` | 1,250 | `1a45fccad5203de25f64bfda42e2f56667752bca4338a55913ae4a7babeafef1` | **FROZEN & VERIFIED** |
| **Phase 1: Profiled** | `data/processed/profiled_materials.csv` | 1,250 | Deterministic profiling artifact | **VERIFIED** |
| **Phase 2: Normalized** | `data/processed/normalized_materials.csv` | 1,250 | `34891ddaffba57cb3956d4a1172b554077e87dfe36e513e641022bc5634abffc` | **FROZEN & VERIFIED** |
| **Phase 3: Extracted** | `data/processed/extracted_attributes.csv` | 1,250 | `8fc02888a909679f24346982ebde84a21ee756e80d4d0e9a3d94023580633f4e` | **FROZEN & VERIFIED** |
| **Phase 4: Standardized** | `data/processed/standardized_materials.csv` | 1,250 | `5e93c66468d2813afd147234c53089f17b4400b07ca6ea168f3445a255fc72d6` | **FROZEN & VERIFIED** |
| **Phase 5: Embeddings Metadata** | `data/processed/embeddings_metadata.csv` | 1,250 | Deterministic embedding index | **VERIFIED** |
| **Phase 5: Match Candidates** | `data/processed/match_candidates.csv` | 37,500 | `0337a33c1170b64c7f40edb6c82419269f847e06c0b35a174a1434ce77407ca3` | **FROZEN & VERIFIED** |
| **Phase 6: Validated Candidates** | `data/processed/validated_candidates.csv` | 37,500 | `bc434f434a25aff84a30f3acb4750a0982e19ad125b23cbd5d2c8a84aab89cbc` | **FROZEN & VERIFIED** |
| **Phase 7: Accepted Pairs** | `data/processed/accepted_harmonization_pairs.csv` | 1 | `632f64df3f0fdee63a44e2e1d8d29834df6632a8f4babe5a066222ad4635c3d2` | **FROZEN & VERIFIED** |
| **Phase 8: Common Material Master** | `data/processed/common_material_master.csv` | 1,249 | `96fa68f3c3401c03b5896bfda3b66b4653640c9d51764cb1652499515be55cba` | **FROZEN & VERIFIED** |
| **Phase 8: CMM Members** | `data/processed/common_material_members.csv` | 1,250 | `5b41bf7220d6818ffae58d5e787da8410c43c0da13c74b099a5f6c704613b4a0` | **FROZEN & VERIFIED** |
| **Phase 9: Legacy Mapping** | `data/processed/legacy_material_mapping.csv` | 1,250 | `2cf7bf298d260a2b4b2d611f6ce680f7a695abadf756232b5b3258082de75a34` | **FROZEN & VERIFIED** |
| **Phase 10: Procurement Facts** | `data/processed/procurement_facts.csv` | 1,250 | `c5fa34b727d3da81197bce0d947cb634d466f971163f5c3a7f91584d866e8a36` | **FROZEN & VERIFIED** |
| **Phase 10: CMM Consumption** | `data/processed/cmm_consumption_summary.csv` | 1,249 | `adb1f5e2653e644d4e36617c3d842e3f20c55d34660095f32ee204eb26a51ed5` | **FROZEN & VERIFIED** |
| **Phase 10: CMM Purchase** | `data/processed/cmm_purchase_summary.csv` | 1,249 | `b768d579570c43cb48d63f6127f0e15dda3b8a0cddf1d8e6428e5bfe1a14cd19` | **FROZEN & VERIFIED** |
| **Phase 10: CPSE Procurement** | `data/processed/cpse_procurement_summary.csv` | 4 | `def508da033756b1ced3215da332c754026ba27fe809e8b214ac9a8746ebbde8` | **FROZEN & VERIFIED** |
| **Phase 10: Sourcing Signals** | `data/processed/procurement_opportunities.csv` | 71 | `7e83afdb74f95b73b77effd6f5d2ce02b4fe9f2599759c2f7851754e55b9445b` | **FROZEN & VERIFIED** |

---

## 2. Pipeline Phase-by-Phase Verification (Phases 1 to 10)

### Phase 1: Ingestion & Profiling
- **Input:** `data/raw/CPSE_Material_Master_cleaned.csv` (1,250 rows).
- **CPSE Distribution:** ONGC (332), IOCL (319), HPCL (301), CPCL (298).
- **Validation:** 18-column mandatory schema validated; zero missing values in primary key composite `(CPSE, Material_Code)`. Data quality score: 93.1%.
- **Output:** `data/processed/profiled_materials.csv` (1,250 rows).

### Phase 2: Cleaning & Normalization
- **Input:** `data/processed/profiled_materials.csv`.
- **Transformation:** Deterministic abbreviation expansion (e.g. `SS` $\rightarrow$ `stainless steel`, `FLG` $\rightarrow$ `flanged`, `HEX` $\rightarrow$ `hexagonal`), casing normalization, whitespace stripping.
- **Output:** `data/processed/normalized_materials.csv` (1,250 rows).

### Phase 3: Attribute Extraction
- **Input:** `data/processed/normalized_materials.csv`.
- **Extraction Logic:** Rule-based regex extraction of 14 key engineering dimensions (Family, Type, Material, Grade, Nominal Size, Rating, Standard Spec, Ends, Orientation, Construction, Finish, Casing, etc.).
- **Output:** `data/processed/extracted_attributes.csv` (1,250 rows).

### Phase 4: Standardization
- **Input:** `data/processed/extracted_attributes.csv`.
- **Transformation:** Generates canonical material key with delimiter pipes (`FAMILY|TYPE|MATERIAL|GRADE|SIZE|SPEC|FINISH|ENDS`).
- **Output:** `data/processed/standardized_materials.csv` (1,250 rows).

### Phase 5: Embeddings & Candidate Generation
- **Input:** `data/processed/standardized_materials.csv`.
- **Model:** SentenceTransformer `all-MiniLM-L6-v2` (384-dimensional dense vectors).
- **Blocking & Top-K:** Cross-CPSE blocking filters out same-CPSE pairs and disparate material families; top-30 candidate generation.
- **Output:** `data/processed/match_candidates.csv` (37,500 candidate pairs).

### Phase 6: Technical Validation
- **Input:** `data/processed/match_candidates.csv` + `extracted_attributes.csv`.
- **Validation Engine:** Engineering rule engine evaluates 14 technical dimensions. Statuses: `VALIDATED_COMPATIBLE`, `PROBABLE_COMPATIBLE`, `REVIEW_REQUIRED`, `ENGINEERING_INCOMPATIBLE`, `INSUFFICIENT_EVIDENCE`. Hard conflicts (e.g. size mismatch, material grade incompatibility) strictly overrule high semantic cosine similarity.
- **Output:** `data/processed/validated_candidates.csv` (37,500 pairs).

### Phase 7: Human Review Workflow
- **Input:** `data/processed/validated_candidates.csv`.
- **Review Queues:** Active queue (12,191), Secondary queue (4,033), Disqualified archive (21,276).
- **Accepted Relationships:** Exactly 1 accepted pair (`CAN-000331`: ONGC-437562 $\leftrightarrow$ IOCL-875352).
- **Audit Logging:** Append-only review events, SHA-256 evidence snapshot hashing, optimistic concurrency control (`version` tracking), no client identity spoofing.
- **Output:** `data/processed/accepted_harmonization_pairs.csv` (1 accepted pair).

### Phase 8: Common Material Master (CMM)
- **Input:** `accepted_harmonization_pairs.csv` (1 accepted pair) + `standardized_materials.csv` (1,250 records).
- **Synthesis:** Guarded grouping, zero automatic transitive inference, deterministic CMM code generation (`CMM-<FAMILY>-<HASH>-<SEQ>`).
- **Output:**
  - `data/processed/common_material_master.csv` (1,249 CMM entities: 1 multi-CPSE harmonized group, 1,248 standalone candidates).
  - `data/processed/common_material_members.csv` (1,250 members mapped; 2 direct accepted, 1,248 standalone).
- **Verified CMM Entity:** `CMM-VALVE-A79389-001` (Members: `ONGC-437562`, `IOCL-875352`).

### Phase 9: Legacy Material Mapping
- **Input:** Phase 8 Common Master artifacts + Phase 4 standardized materials.
- **Crosswalk Invariant:** Every source material `(source_cpse, material_code)` maps exactly once.
- **Output:** `data/processed/legacy_material_mapping.csv` (1,250 mappings):
  - `MAPPED_VERIFIED`: 2 (ONGC-437562, IOCL-875352; confidence 1.000, `VERIFIED_CROSS_CPSE`).
  - `MAPPED_STANDALONE`: 1,248 (confidence 1.000, `STANDALONE_IDENTITY`).
  - `REVIEW_REQUIRED`: 0
  - `CONFLICT`: 0
  - `UNMAPPED`: 0
  - Total universe retention: **100.0%**.

### Phase 10: Procurement Intelligence & Analytics
- **Input:** Phase 9 Legacy Mapping + Phase 8 CMM + Raw Baseline procurement attributes.
- **Reference Date:** `ANALYSIS_REFERENCE_DATE = 2026-03-31` (Frozen).
- **Physical Volume Conservation:** Strict per-UOM aggregation (zero mixed-UOM math).
  - Volume NOS: **9,144,354**
  - Volume MTR: **5,858,592**
  - Volume LTR: **764,341**
- **Outputs:**
  - `procurement_facts.csv` (1,250 granular facts)
  - `cmm_consumption_summary.csv` (1,249 records)
  - `cmm_purchase_summary.csv` (1,249 records)
  - `cpse_procurement_summary.csv` (4 records: CPCL, HPCL, IOCL, ONGC)
  - `procurement_opportunities.csv` (71 auditable signals: 69 High-Volume Concentration P95, 1 Multi-CPSE Demand Aggregation, 1 OEM Diversity Signal).

---

## 3. Real File Upload & Isolated Ingestion Verification

### 3.1 Upload Mechanism & Safety Isolation
To satisfy the requirement that users can upload new material master files without mutating or overwriting the frozen authoritative raw dataset (`data/raw/CPSE_Material_Master_cleaned.csv`):
1. An isolated staging directory `data/uploads/` was implemented.
2. The ingestion endpoint `POST /api/ingest/upload` checks the uploaded file's SHA-256 against the authoritative baseline:
   - If identical to the official baseline, it acknowledges verified baseline status.
   - If new/modified, it saves the file into `data/uploads/<filename>` and returns comprehensive profiling metrics without replacing `data/raw/CPSE_Material_Master_cleaned.csv`.
3. The raw baseline hash remained **100% unchanged** after all uploads.

### 3.2 Temporary Test Dataset Verification (`tmp/e2e_test_material_master.csv`)
A dedicated 1,259-row test file was generated with realistic edge cases satisfying requirements A through G:
- **A. 5 New Records:** Added `HPCL-999001` through `HPCL-999005`.
- **B. 5 Modified Records:** Altered description, size, annual consumption, and purchase dates.
- **C. Normalization Variations:** Included `SS316`, `HEX`, `FLG`, `MTR`, `NOS`.
- **D. Incomplete Record:** Tested missing manufacturer and specification (`HPCL-999006`).
- **E. Duplicate Material Code:** Tested cross-CPSE identifier conflict (`IOCL-875352` duplication).
- **F. Non-Harmonizable Material:** Intentionally conflicting gate valve with differing dimensions (`HPCL-999008`).
- **G. Plausible Candidate:** Gate valve matching ASTM A216 WCB specifications (`HPCL-999009`).

Tested via `POST /api/ingest/upload` $\rightarrow$ `HTTP 200 OK`, returned `record_count: 1259`, correctly identified CPSE distribution (HPCL: 309, ONGC: 332, IOCL: 320, CPCL: 298), and verified raw baseline hash remained bit-for-bit unchanged.

---

## 4. End-to-End Record Traceability

Three representative records were traced end-to-end across all 10 phases:

```
[RAW] ONGC-437562 (GATE VALVE FLANGED 2 in ASTM A216 WCB)
  ↓ Phase 2: gate valve flanged 2 in astm a216 wcb
  ↓ Phase 3: Category: Valves, Size: 2 IN, Spec: ASTM A216 WCB
  ↓ Phase 4: VALVE | GATE VALVE | ASTM A216 WCB | 2 IN | API 600; ASTM A216 WCB | PAINTED | FLANGED
  ↓ Phase 5: 69 Candidate Pairs generated
  ↓ Phase 6: Validated against candidate pairs (including VALIDATED_COMPATIBLE)
  ↓ Phase 7: Reviewed & Accepted (CAN-000331)
  ↓ Phase 8: CMM-VALVE-A79389-001 (Membership: DIRECT_ACCEPTED)
  ↓ Phase 9: MAPPED_VERIFIED (Confidence: 1.000, Semantics: VERIFIED_CROSS_CPSE)
  ↓ Phase 10: Procurement Fact: 249 NOS (Plant: ONGC_PLANT_1)

[RAW] IOCL-875352 (GATE VALVE FLANGED 2 in)
  ↓ Phase 2: gate valve flanged 2 in
  ↓ Phase 3: Category: Valves, Size: 2 IN, Spec: ASTM A216 WCB
  ↓ Phase 4: VALVE | GATE VALVE | ASTM A216 WCB | 2 IN | API 600; ASTM A216 WCB | PAINTED | FLANGED
  ↓ Phase 5: 70 Candidate Pairs generated
  ↓ Phase 6: Validated against candidate pairs (including VALIDATED_COMPATIBLE)
  ↓ Phase 7: Reviewed & Accepted (CAN-000331)
  ↓ Phase 8: CMM-VALVE-A79389-001 (Membership: DIRECT_ACCEPTED)
  ↓ Phase 9: MAPPED_VERIFIED (Confidence: 1.000, Semantics: VERIFIED_CROSS_CPSE)
  ↓ Phase 10: Procurement Fact: 17,398 NOS (Plant: IOCL_PLANT_1)

[RAW] HPCL-462251 (HRC CARTRIDGE 10 A)
  ↓ Phase 2: high rupturing capacity cartridge 10 a
  ↓ Phase 3: Category: Electrical, Type: Fuse, Size: 10 A
  ↓ Phase 4: ELECTRICAL | FUSE | CERAMIC | 10 A | IS 13703
  ↓ Phase 5: 40 Candidate Pairs generated
  ↓ Phase 6: Validated against candidates
  ↓ Phase 7: Retained in review backlog (0 accepted pairs)
  ↓ Phase 8: CMM-ELECTR-7AAF2F-001 (Membership: STANDALONE)
  ↓ Phase 9: MAPPED_STANDALONE (Confidence: 1.000, Semantics: STANDALONE_IDENTITY)
  ↓ Phase 10: Procurement Fact: 9,740 MTR (Plant: HPCL_PLANT_1)
```

**Lineage Integrity Result:** **PASS** (Zero broken lineage, 100% source-to-CMM traceability).

---

## 5. Recharts Visualizations & Frontend Chart Audit

Every Recharts component was audited for data integrity, responsive rendering, correct units, non-zero handling, and strict UOM separation:

| Chart Title | Page / Route | API Source | Source Field | Transformation | Expected Value | Actual Value | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Material Master Volume by CPSE** | Dashboard (`/dashboard`) | `GET /api/analytics/cpse` | `cpse_data.*.record_count` | Object mapping to BarChart array | ONGC: 332, IOCL: 319, HPCL: 301, CPCL: 298 | 332, 319, 301, 298 (Total: 1,250) | **PASS** |
| **Procurement Intelligence Signals** | Dashboard (`/dashboard`) | `GET /api/procurement/kpis` | `opportunities_by_type` | BarChart mapping of 3 signal classes | P95: 69, Joint: 1, OEM: 1 | 69, 1, 1 (Total: 71) | **PASS** |
| **Field-Level Profiling (Comp vs. Valid)** | Data Quality (`/data-quality`) | `GET /api/analytics/data-quality` | `column_profiles` & `quality_scoring` | Completeness % & Validity % per column | Code: 100%, Desc: 100%/94%, Cat: 96%/92% | Exact column profile scores | **PASS** |
| **Material Records per CPSE** | CPSE Analytics (`/cpse-analytics`) | `GET /api/procurement/cpse-summary` | `total_material_records` | BarChart per CPSE | CPCL: 298, HPCL: 301, IOCL: 319, ONGC: 332 | Exact catalog counts | **PASS** |
| **Annual NOS Volume per CPSE** | CPSE Analytics (`/cpse-analytics`) | `GET /api/procurement/cpse-summary` | `total_volume_nos` | BarChart with millions formatter (`1e6`) | CPCL: 2.28M, HPCL: 2.22M, IOCL: 2.41M, ONGC: 2.22M | Conserved NOS volumes | **PASS** |
| **Sourcing Signals Distribution** | Procurement (`/procurement` Tab 1) | `GET /api/procurement/kpis` | `opportunities_by_type` | BarChart with custom tooltips | P95: 69, Joint: 1, OEM: 1 | 69, 1, 1 (Total: 71) | **PASS** |
| **Comparative Physical Volume by CPSE** | Procurement (`/procurement` Tab 3) | `GET /api/procurement/cpse-summary` | `total_volume_nos`, `total_volume_mtr` | Dual BarChart (NOS & MTR conserved) | Separate bars per UOM | Zero mixed-UOM aggregation | **PASS** |
| **Facility Annual Volume Distribution** | Procurement (`/procurement` Tab 4) | `GET /api/procurement/plants` | `total_volume` | Top-8 plant BarChart with angled labels | Plant volume conserved | Accurately rendered | **PASS** |
| **Benchmark Accuracy & F1 Trajectory** | Evaluation (`/evaluation`) | Static benchmark iterations | `precision`, `recall`, `f1` | Multi-bar iteration progression | 83.5% $\rightarrow$ 89.9% $\rightarrow$ 93.0% F1 | Accurately rendered | **PASS** |

---

## 6. API Endpoint Verification

All registered REST API endpoints were systematically exercised and verified:

| Method & Route | Function & Purpose | HTTP Status | Response Schema Validity | Authorization / Guardrails |
| :--- | :--- | :--- | :--- | :--- |
| `GET /api/health` | Service health & timestamp | `200 OK` | `{"status": "healthy", ...}` | Public |
| `POST /api/ingest/upload` | Isolated material CSV upload | `200 OK` | `{"status": "success", "record_count": ...}` | Staged to `data/uploads/` |
| `GET /api/materials` | Material catalog pagination | `200 OK` | `{"materials": [...], "total": 1250}` | Validated limit/offset |
| `GET /api/matches` | Candidate matches retrieval | `200 OK` | Array of match candidate pairs | Blocked & top-K filtered |
| `GET /api/review/queue` | Review queue partitioned list | `200 OK` | `{"items": [...], "total": 12191}` | Active/Secondary/Disqualified |
| `GET /api/review/stats` | Review backlog metrics | `200 OK` | `{"total_candidates": 37500, ...}` | Total candidates: 37,500 |
| `GET /api/common-master` | Common Master catalog | `200 OK` | `{"items": [...], "total": 1249}` | CMM codes verified |
| `GET /api/common-master/stats` | CMM enterprise statistics | `200 OK` | `{"total_common_materials": 1249}` | Multi-CPSE: 1, Standalone: 1,248 |
| `GET /api/common-master/{id}` | CMM detail & member mappings | `200 OK` | Provenance & member attributes | `CMM-VALVE-A79389-001` (2 members) |
| `GET /api/legacy-mapping` | Legacy mapping crosswalk list | `200 OK` | `{"items": [...], "total": 1250}` | 100% universe retention |
| `GET /api/legacy-mapping/stats` | Crosswalk operational stats | `200 OK` | `{"mapped_verified": 2, ...}` | Verified: 2, Standalone: 1,248 |
| `GET /api/legacy-mapping/{c}/{m}` | Single mapping record detail | `200 OK` | Source-to-CMM mapping record | Checked `ONGC/ONGC-437562` |
| `GET /api/procurement/kpis` | Enterprise procurement KPIs | `200 OK` | Strict UOM partitioned volumes | Reference date: 2026-03-31 |
| `GET /api/procurement/cpse-summary`| 4 CPSE procurement profiles | `200 OK` | Array of 4 CPSE summary objects | Total materials: 1,250 |
| `GET /api/procurement/opportunities`| Auditable sourcing signals | `200 OK` | `{"items": [...], "total": 71}` | High-vol: 69, Joint: 1, OEM: 1 |
| `GET /api/procurement/plants` | Plant consumption records | `200 OK` | Array of plant-UOM records | Conserved physical volume |
| `GET /api/analytics/dashboard` | Aggregated dashboard stats | `200 OK` | `{"total_materials": 1250, ...}` | Live profiling computed |
| `GET /api/analytics/cpse` | Raw CPSE volume breakdown | `200 OK` | 4 CPSE count objects | 332, 319, 301, 298 |
| `GET /api/analytics/data-quality` | 4-dimension quality scoring | `200 OK` | Overall score: 93.1% | Completeness, Uniqueness, etc. |

---

## 7. Frontend Routes Verification

All 19 frontend React routes were verified for clean rendering, proper layout wrapping, navigation, and error-free loading:

| Route Path | Component / Page | Layout Wrapper | Live Data Status | Console / Runtime Status |
| :--- | :--- | :--- | :--- | :--- |
| `/` | Redirects to `/dashboard` | `AppLayout` | Live | **PASS** |
| `/dashboard` | `Dashboard.tsx` | `AppLayout` | Live Recharts + KPIs | **PASS** |
| `/ingest` | `Ingest.tsx` | `AppLayout` | Drag-and-drop file upload | **PASS** |
| `/materials` | `Materials.tsx` | `AppLayout` | Live table & filtering | **PASS** |
| `/materials/:id` | `MaterialDetail.tsx` | `AppLayout` | Live attribute inspection | **PASS** |
| `/matches` | `Matches.tsx` | `AppLayout` | Live candidate table | **PASS** |
| `/matches/:id` | `MatchDetail.tsx` | `AppLayout` | Side-by-side comparison | **PASS** |
| `/review` | `Review.tsx` | `AppLayout` | Live review queue | **PASS** |
| `/common-master` | `CommonMaster.tsx` | `AppLayout` | CMM catalog explorer | **PASS** |
| `/common-master/:code` | `CommonMasterDetail.tsx`| `AppLayout` | CMM lineage & member crosswalk | **PASS** |
| `/legacy-mapping` | `LegacyMapping.tsx` | `AppLayout` | 1,250 legacy crosswalk table | **PASS** |
| `/procurement` | `Procurement.tsx` | `AppLayout` | 4 tabs with live Recharts | **PASS** |
| `/standardization` | `Standardization.tsx` | `AppLayout` | Canonical rules & reports | **PASS** |
| `/data-quality` | `DataQuality.tsx` | `AppLayout` | Recharts quality profiler | **PASS** |
| `/cpse-analytics` | `CPSEAnalytics.tsx` | `AppLayout` | Recharts catalog & NOS comparison| **PASS** |
| `/evaluation` | `Evaluation.tsx` | `AppLayout` | Recharts benchmark history | **PASS** |
| `/jobs` | `Jobs.tsx` | `AppLayout` | Pipeline execution status | **PASS** |
| `/settings` | `Settings.tsx` | `AppLayout` | Configuration & parameters | **PASS** |
| `/profile` | `Profile.tsx` | `AppLayout` | User profile & session details | **PASS** |

---

## 8. Security, RBAC & Secret Handling Audit

1. **Secret Leakage Prevention:** Verified that `SUPABASE_SERVICE_ROLE_KEY` is strictly confined to server-side environments and is **never** bundled or referenced in client-side Vite/React code. Client uses public anonymous keys or local API abstraction.
2. **Reviewer Identity Spoofing Protection:** Phase 7 review decision endpoints enforce server-validated JWT reviewer identity; client requests cannot spoof reviewer credentials.
3. **Optimistic Locking:** Stale version updates in review submissions return `HTTP 409 Conflict`, preserving append-only audit trail integrity.
4. **CORS Safety:** Allowed origins configured to `localhost:8080`, `127.0.0.1:8080`, and authorized internal clients.
5. **Path Traversal & Safe Upload:** Ingestion uploads enforce extension validation (`.csv`), file size limits, and safe storage within `data/uploads/` using sanitization.

---

## 9. Test Suite Execution & Verification Results

### 9.1 Backend Python / Pytest Suite
- **Command:** `python -m pytest tests/ -v`
- **Total Tests Executed:** 287 tests (277 unit/integration + 10 E2E workflow integration tests).
- **Passed:** **287**
- **Failed:** **0**
- **Failures / Errors:** **0**
- **Coverage Areas:** Ingestion, Profiling, Cleaning, Attribute Extraction, Standardization, Matching, Technical Validation, Human Review, CMM Grouping, Legacy Mapping, Procurement Analytics, and E2E System Workflow.

### 9.2 Frontend Client Compilation & Type Checking
- **TypeScript Check:** `npx tsc --noEmit` $\rightarrow$ **0 errors (Exit code 0)**.
- **Production Build:** `npm run build` $\rightarrow$ **Successful production bundle built in 6.62s (Exit code 0)**.

---

## 10. Problems Found & Permanently Fixed

| Issue Description | Component / File | Root Cause | Permanent Resolution |
| :--- | :--- | :--- | :--- |
| **Upload Section Non-Functional** | `client/src/pages/Ingest.tsx` & `server/api/ingestion.py` | Missing upload API endpoint and mock file picker in UI | Added `process_uploaded_file` in `ingestion_service.py`, created `POST /api/ingest/upload`, and wired interactive drag-and-drop upload zone in `Ingest.tsx`. |
| **FastAPI NaN JSON Serialization 500 Crash** | `server/app/api/standardization.py` | Default JSON serializer crashed on float `NaN` in report | Sanitized `NaN` values to `null` before JSON serialization and cleaned dictionary comprehension. |
| **CORS / Port Mismatch** | `server/app/config.py` & `client/.env` | Client Vite port `8080` not in backend allowed origins | Added `http://localhost:8080` and `http://127.0.0.1:8080` to `ALLOWED_ORIGINS` and set `VITE_API_BASE_URL="http://localhost:8000"`. |
| **Disconnected Dashboard & Analytics Hooks** | `client/src/services/dashboardService.ts` & `useDashboard.ts` | Services returned `null` or mock values | Connected services to live `/api/analytics` endpoints and mapped camelCase properties. |
| **Missing / Static Charts in UI** | `Dashboard.tsx`, `CPSEAnalytics.tsx`, `DataQuality.tsx`, `Procurement.tsx`, `Evaluation.tsx` | Pages lacked Recharts or displayed hardcoded tables | Built clean, interactive Recharts visualizations (BarCharts) connected to real backend APIs. |
| **Raw Baseline Immutability Guard** | File upload flow | Potential risk of uploaded files overwriting raw baseline | Staged non-baseline files to `data/uploads/` while keeping `data/raw/CPSE_Material_Master_cleaned.csv` immutable. |

---

## 11. Final Verification of Authoritative Frozen Hashes

Following the execution of all unit tests, integration tests, file uploads, and pipeline runs, the raw baseline SHA-256 hash was re-verified:

$$\text{RAW SHA-256: } 1a45fccad5203de25f64bfda42e2f56667752bca4338a55913ae4a7babeafef1$$

**Status:** **BIT-FOR-BIT IDENTICAL (100% UNCHANGED).**

---

## 12. Final Verdict: **PASS**

The SIH26099 Material Harmonization Platform has passed all end-to-end integration, runtime, UI, and data pipeline audits. All 10 phases operate with verified integrity, zero broken lineage, mathematically conserved volumes, and production-grade visualizations.
