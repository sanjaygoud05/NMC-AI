# Phase 7 — Human Review / Expert Validation

## SIH26099: AI-Driven Standardization and Harmonization of Material Codes Across CPSEs

---

## 1. Executive Summary & Objective

Phase 7 implements the Human Review and Expert Validation layer for the SIH26099 Material Harmonization Platform.

Building upon the **37,500 candidates** validated during Phase 6, Phase 7 establishes an enterprise-grade expert review environment where domain engineers, procurement officers, and technical validators inspect 4-layer technical evidence packages, review attribute diffs, and record human decisions under strict optimistic concurrency control and cryptographic evidence integrity.

### Core Philosophy & Boundary Constraints
- **Human Governance Only**: No automatic acceptance of candidates. A human reviewer must explicitly deliberate and submit decisions.
- **Candidate Relationships, Not Material Identity**: The `ACCEPT` decision strictly marks the candidate relationship as human-reviewed and accepted for downstream Phase 8 consideration. It does **NOT** certify final identity, universal interchangeability, Common Material Master approval, or cross-CPSE code merging.
- **No Material Master or Code Generation**: Phase 7 **does NOT** create Common Material Master records, generate Common Material Codes, or merge legacy items.
- **Strict Upstream Immutability**: Raw source data and artifacts from Phases 2, 3, 4, 5, and 6 remain bit-for-bit immutable.
- **Zero LLM Engineering Decisions**: No large language models or non-deterministic generators are used for validation or review decisions.
- **Pure Technical Priority**: Procurement metrics (spend, annual consumption) are strictly segregated from technical review priorities.

---

## 2. Queue Partitioning & Universe Coverage

All 37,500 candidates validated in Phase 6 remain fully accessible in Phase 7 through deterministic queue partitions. Candidates are never dropped or hidden from the analytical universe:

| Queue Partition | Phase 6 Review Priority / Validation Status | Candidate Count | Workflow Description |
|---|---|---|---|
| **Active Review Queue** | `CRITICAL` (7,337) + `HIGH` (4,854) | **12,191** | High-confidence matches and critical borderline candidates requiring immediate expert human deliberation. |
| **Secondary / Reference Queue** | `MEDIUM` (3,917) + `LOW` (116) non-incompatible | **4,033** | Secondary candidates requiring spec sheets or extended domain analysis. |
| **Disqualified Archive** | `ENGINEERING_INCOMPATIBLE` (Hard Conflicts) | **21,276** | Transparently archived pairs with physical or metallurgical contradictions, available for audit and reference. |
| **Total Review Universe** | All Validated Candidate Pairs | **37,500** | Complete set of generated cross-CPSE candidate pairs. |

---

## 3. 4-Layer Evidence Package & Cryptographic Fingerprinting

To ensure complete explainability, when a candidate is inspected, the system compiles a comprehensive 4-layer evidence package:

1. **Source Profile**: Standardized engineering attributes (item family, item type, material grade, dimensional standard, pressure rating, size, canonical material key, and CPSE provenance).
2. **Candidate Profile**: Complete comparative engineering attributes from the target CPSE material.
3. **21-Attribute Difference Matrix**: Side-by-side comparison of every extracted engineering property categorized into `EXACT_MATCH`, `REPRESENTATION_DIFFERENCE`, `SOFT_ENGINEERING_DIFFERENCE`, `HARD_INCOMPATIBLE`, `MISSING_IN_BOTH`, or `MISSING_IN_ONE`.
4. **Algorithmic Validation Signals**: Phase 5 semantic scores, lexical similarity, token overlap, Phase 6 engineering conflict classification, deterministic validation status, reason codes, and technical review priority.

### Evidence Snapshot Hash
Before persisting any decision or rendering the review view, the complete 4-layer evidence package is serialized using **canonical deterministic JSON formatting** (`sort_keys=True`, compact separators) and hashed via SHA-256:

$$\text{evidence\_snapshot\_hash} = \text{SHA256}(\text{canonical\_json}(\text{evidence\_package}))$$

This produces a 64-character deterministic cryptographic fingerprint of the exact evidence package used during the review event, enabling later integrity verification and auditability.

---

## 4. Database Architecture & Concurrency Control

### Schema Definition (Supabase PostgreSQL / Transactional Store)

The review persistence architecture consists of two tables linked by candidate identifiers:

#### `review_decisions` Table
Maintains the current human review state for each candidate pair:
- `candidate_id` (VARCHAR(64), Primary Key)
- `source_material_code` (VARCHAR(64), Not Null)
- `candidate_material_code` (VARCHAR(64), Not Null)
- `decision` (VARCHAR(20), Not Null, Check Constraint: `decision IN ('ACCEPT', 'REJECT', 'DEFER')`)
- `reviewer_id` (VARCHAR(128), Not Null)
- `reviewer_email` (VARCHAR(256), Not Null)
- `rationale` (TEXT, Not Null)
- `escalated` (BOOLEAN, Default False)
- `needs_spec_sheet` (BOOLEAN, Default False)
- `evidence_snapshot_hash` (VARCHAR(64), Not Null)
- `version` (INTEGER, Default 1, Optimistic Locking Counter)
- `created_at` / `updated_at` (TIMESTAMPTZ, Default CURRENT_TIMESTAMP)

#### `review_events` Table (Append-Only Audit Log)
Immutable chronological record of every decision attempt and revision:
- `id` (VARCHAR(36), Primary Key, UUIDv4)
- `candidate_id` (VARCHAR(64), Not Null, Index)
- `version` (INTEGER, Not Null)
- `previous_decision` (VARCHAR(20), Nullable)
- `new_decision` (VARCHAR(20), Not Null)
- `reviewer_id` (VARCHAR(128), Not Null)
- `reviewer_email` (VARCHAR(256), Not Null)
- `rationale` (TEXT, Not Null)
- `escalated` (BOOLEAN, Default False)
- `needs_spec_sheet` (BOOLEAN, Default False)
- `evidence_snapshot_hash` (VARCHAR(64), Not Null)
- `created_at` (TIMESTAMPTZ, Default CURRENT_TIMESTAMP, Index)

### Atomic Transactions & Optimistic Concurrency
1. **Single Transaction Boundary**: Decision submission executes inside a single database transaction block (`session.begin()`). Both `review_decisions` upsert and `review_events` insertion succeed together or rollback completely if any error occurs.
2. **Optimistic Locking (`expected_version`)**:
   - Each decision record maintains an incremental `version` number.
   - When a reviewer submits a decision, the client sends `expected_version`.
   - If another reviewer or process modified the candidate in the interim, the server raises a `StaleVersionError` returned as HTTP `409 Conflict`, completely preventing lost updates.
3. **Pending-State Invariant**:
   - Unreviewed candidates exist as `PENDING` (version 0).
   - The first review decision transitions the record to version 1.

---

## 5. Security & Role-Based Access Control (RBAC)

1. **Server-Side Identity Derivation**:
   - `reviewer_id` and `reviewer_email` are derived strictly from the authenticated Supabase JWT / session claims on the backend.
   - Client payload fields attempting to inject reviewer identity are strictly ignored, preventing identity spoofing.
2. **Role Enforcement**:
   - `reviewer` and `admin` roles are permitted to submit decisions (`POST /api/review/{candidate_id}/decision`).
   - `viewer` roles are strictly read-only; attempts to submit decisions return HTTP `403 Forbidden`.

---

## 6. REST API Endpoints

The backend provides five REST endpoints under `/api/review`:

| Endpoint | Method | Role Required | Description |
|---|---|---|---|
| `/api/review/queue` | `GET` | Authenticated | Returns paginated candidates filtered by queue partition (`active`, `secondary`, `disqualified`, `all`), decision status (`pending`, `decided`, `accepted`, etc.), search query, and priority. |
| `/api/review/stats` | `GET` | Authenticated | Returns queue partition counts (Active: 12,191, Secondary: 4,033, Disqualified: 21,276, Total: 37,500) and review metrics (Pending Active, Accepted, Rejected, Deferred). |
| `/api/review/{candidate_id}` | `GET` | Authenticated | Compiles and returns the full 4-layer evidence package, attribute difference matrix, and deterministic SHA-256 fingerprint hash. |
| `/api/review/{candidate_id}/decision` | `POST` | `reviewer` / `admin` | Atomically commits a review decision and append-only audit event under optimistic locking. |
| `/api/review/{candidate_id}/history` | `GET` | Authenticated | Returns the chronological list of all audit events recorded for the candidate. |

---

## 7. Phase 8 Handoff Pipeline (`review_export.py`)

The pipeline script `server/pipeline/review_export.py` extracts all human-reviewed candidates with verdict `ACCEPT` from the transactional review store and exports them to:

`data/processed/accepted_harmonization_pairs.csv`

### Structure of Accepted Handoff Export
- `candidate_id`: Unique candidate pair identifier.
- `source_material_code`: Source CPSE material code.
- `candidate_material_code`: Target CPSE material code.
- `decision`: Verdict (`ACCEPT`).
- `reviewer_id`: Authenticated reviewer identifier.
- `reviewer_email`: Authenticated reviewer email.
- `rationale`: Technical justification entered by the reviewer.
- `evidence_snapshot_hash`: Cryptographic fingerprint of evidence at decision time.
- `decision_timestamp`: UTC timestamp of acceptance.
- `version`: Decision record version.

> [!IMPORTANT]
> This export contains **only human-accepted pairwise candidate relationships** to be considered in Phase 8 for Common Material Master grouping. It does **not** create master records, merge materials, or generate common codes.

---

## 8. Upstream Immutability Verification

All pre-existing datasets and previous phase outputs remain completely unaltered:

| File | SHA256 Hash | Status |
|---|---|---|
| `data/raw/CPSE_Material_Master_cleaned.csv` | `1a45fccad5203de25f64bfda42e2f56667752bca4338a55913ae4a7babeafef1` | **UNCHANGED** |
| `data/processed/normalized_materials.csv` | `34891ddaffba57cb3956d4a1172b554077e87dfe36e513e641022bc5634abffc` | **UNCHANGED** |
| `data/processed/extracted_attributes.csv` | `8fc02888a909679f24346982ebde84a21ee756e80d4d0e9a3d94023580633f4e` | **UNCHANGED** |
| `data/processed/standardized_materials.csv` | `5e93c66468d2813afd147234c53089f17b4400b07ca6ea168f3445a255fc72d6` | **UNCHANGED** |
| `data/processed/match_candidates.csv` | `0337a33c1170b64c7f40edb6c82419269f847e06c0b35a174a1434ce77407ca3` | **UNCHANGED** |
| `data/processed/validated_candidates.csv` | `bc434f434a25aff84a30f3acb4750a0982e19ad125b23cbd5d2c8a84aab89cbc` | **UNCHANGED** |

---

## 9. Verification & Test Coverage Summary

- **Unit Tests (`tests/unit/test_review_workflow.py`)**: 8/8 tests PASS.
  - Decision state rules (ACCEPT requires rationale, REJECT/DEFER require $\ge 10$ characters).
  - Invalid decision verbs rejected.
  - Deterministic SHA-256 evidence snapshot hash.
  - Atomic transaction commit for decisions and events.
  - Complete rollback on audit event failure.
  - Optimistic concurrency control (stale version rejection).
  - Pending-state invariant.
- **Integration Tests (`tests/integration/test_review_api.py`)**: 8/8 tests PASS.
  - Strict queue partition counts (Active: 12,191, Secondary: 4,033, Disqualified: 21,276, Total: 37,500).
  - Stats API partition metrics.
  - Candidate 4-layer evidence retrieval.
  - Viewer role rejected with HTTP 403.
  - Reviewer identity spoofing protection.
  - Optimistic concurrency control returning HTTP 409 Conflict.
  - Chronological audit history.
  - Non-identity semantics and Phase 8 export handoff.
- **Full Regression Suite**: 215/215 tests PASS across all phases.
- **Frontend Quality**:
  - `npx tsc --noEmit`: PASS (0 errors).
  - `npm run lint`: PASS (0 errors).
  - `npm run build`: PASS (Vite production bundle successfully generated in 4.41s).
- **Backend Quality**:
  - `python -m compileall server/ tests/`: PASS (0 syntax or bytecode errors).
