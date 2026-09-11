# Phase 8 — Common Material Master

## SIH26099: AI-Driven Standardization and Harmonization of Material Codes Across CPSEs

---

## 1. Executive Summary & Objective

Phase 8 is the foundational synthesis phase of the SIH26099 platform where trusted, human-accepted pairwise material relationships from Phase 7 are transformed into candidate **Common Material Master (CMM)** groups and a fully governed Common Material Master catalog.

In all prior phases (Phases 0 through 7), the platform strictly operated on candidate pairs, candidate rankings, and pairwise human validation verdicts. Phase 8 is the **first and only stage where Common Material Master groups and Common Material Codes (CMM Codes) are created**.

### Core Philosophy & Mandatory Governance Invariants
- **Immutable Upstream Artifacts**: Raw data (`CPSE_Material_Master_cleaned.csv`), normalized (`normalized_materials.csv`), extracted (`extracted_attributes.csv`), standardized (`standardized_materials.csv`), candidate matching (`match_candidates.csv`), validated candidates (`validated_candidates.csv`), and accepted pairs (`accepted_harmonization_pairs.csv`) remain strictly read-only and bit-for-bit immutable.
- **Trusted Input Only**: Only relationships with verdict `ACCEPT` from Phase 7 (`data/processed/accepted_harmonization_pairs.csv` / `review_decisions`) participate in harmonization grouping. `REJECT` and `DEFER` verdicts are strictly excluded.
- **No Automatic `APPROVED_MASTER`**: The automated grouping engine **never** assigns the `APPROVED_MASTER` status. All automated groupings receive `VERIFIED_HARMONIZED`, `STANDALONE_CANDIDATE`, `AMBIGUOUS_REVIEW_REQUIRED`, or `SPLIT_CONFLICT`. `APPROVED_MASTER` requires explicit authorized human governance sign-off through the Phase 8 governance workflow.
- **Transitivity Failure Protection**: If material $A$ is accepted with $B$, and $B$ is accepted with $C$, $A$ and $C$ **are NOT automatically assumed equivalent**. Transitive grouping requires full pairwise compatibility verification against Phase 6 validation invariants and attribute checks.
- **Safe Attribute Consolidation**: Specificity precedence never invents or infers missing engineering values. Missing attributes remain missing unless explicitly verified in authoritative upstream records without contradiction.
- **Zero Invention / Zero LLM**: No probabilistic language model or artificial intelligence generates engineering facts. All consolidated attributes are derived deterministically from standardized material profiles.
- **Procurement Metric Separation**: Spend, consumption, and plant volume are never used as technical grouping criteria.
- **Phase 9 / 10 Exclusion**: Phase 8 establishes candidate master groups and catalog governance. Legacy cross-referencing mapping finalization (Phase 9) and procurement spend analytics (Phase 10) are strictly out of scope.

---

## 2. Guarded Clique Grouping & Deterministic Partitioning

Pairwise human acceptances form an undirected graph $G = (V, E)$, where $V$ is the set of materials and $E$ is the set of accepted pairwise edges.

### Clique Partitioning with Multi-Tier Tie-Breaking
When a connected component contains an incompatibility $(u, w)$ identified in Phase 6, the component is automatically partitioned into maximal compatible cliques with deterministic tie-breaking:
1. **Maximum verified member count** (largest compatible group size first).
2. **Maximum supported accepted-edge count** (most densely connected accepted relationships).
3. **Deterministic compatibility / confidence ordering** (highest average Phase 6 refined score).
4. **Lexicographically smallest member-code signature** (e.g., `["GAIL-101", "IOCL-202"]` beats `["ONGC-101", "IOCL-202"]`).

### Deterministic Grouping Invariants
- Source material codes sorted lexicographically.
- Accepted candidate edges sorted by `candidate_id` ascending.
- The algorithm produces bit-for-bit identical results across repeated executions.
- Singletons (unmatched materials) are retained 100% as `STANDALONE_CANDIDATE` groups to guarantee complete catalog universe coverage (1,250 materials).

---

## 3. Deterministic Common Material Code Syntax

Common Material Codes (CMM Codes) are human-readable, deterministic, unique, and strictly structured according to standardized engineering taxonomy:

$$\text{CMM}-\langle\text{FAMILY}\rangle-\langle\text{CANONICAL\_KEY\_HASH}_{6}\rangle-\langle\text{SEQ}_{3}\rangle$$

- `CMM`: Platform prefix designating "Common Material Master".
- `FAMILY`: Normalized 3-to-6 letter uppercase engineering family token (e.g., `FLANGE`, `VALVE`, `BEARNG`, `PIPE`, `GASKET`, `PUMP`, `BOLT`, `CABLE`, `ELECTR`).
- `CANONICAL_KEY_HASH`: First 6 hex characters of `SHA256(consolidated_canonical_key)`.
- `SEQ`: 3-digit sequential integer disambiguator (`001`, `002`, ...).

### Sequence Number Assignment
To ensure sequence numbers are independent of database or filesystem insertion order:
1. Groups sharing the same `(FAMILY, CANONICAL_KEY_HASH_6)` prefix are partitioned into collision buckets.
2. Within each collision bucket, groups are sorted deterministically by `group_identity_hash` ascending.
3. `SEQ_3` is assigned sequentially (`001`, `002`, ...) based on this deterministic sort.

---

## 4. Structured Common Description & Attribute Consolidation

Each Common Material Master group represents a single unified engineering concept. Consolidated attributes and descriptions are derived without inventing values:

### Attribute Consolidation Safety Rules
1. **Unanimous Agreement**: All group members share the identical non-empty attribute value $\rightarrow$ value is preserved.
2. **Canonical Normalization**: Values differ only by alias or formatting $\rightarrow$ authoritative Phase 4 canonical standardized representation is preserved.
3. **Safe Specificity Inheritance**:
   A more specific value may be consolidated only when:
   - The value exists in authoritative Phase 3/4 evidence.
   - The other member's attribute is genuinely unpopulated (`NULL` / empty).
   - Phase 3–6 evidence contains **no contradictory value** across any member.
   - Provenance to the contributing source material is explicitly retained.
4. **Unresolved / Contradictory Attributes**:
   If members possess differing populated values that are not representation equivalent, the attribute is marked as `UNRESOLVED_CONFLICT` and the group governance status is set to `AMBIGUOUS_REVIEW_REQUIRED`.

### Structured Description Template
Synthesized structured description using verified attributes:
$$\langle\text{FAMILY}\rangle\ |\ \langle\text{TYPE}\rangle\ |\ \langle\text{GRADE}\rangle\ |\ \langle\text{SIZE}\rangle\ |\ \langle\text{RATING/STANDARD}\rangle\ |\ \langle\text{CONNECTION/END}\rangle$$
Unavailable fields are omitted rather than invented.

---

## 5. Membership Semantics & End-to-End Provenance

Every source material mapped to a Common Material Master record is assigned an explicit membership type:
- `DIRECT_ACCEPTED`: Directly supported by an active Phase 7 `ACCEPT` relationship.
- `TRANSITIVE_VERIFIED`: Connected via a path of accepted edges and validated compatible with zero hard engineering conflicts.
- `STANDALONE`: Single unmatched material candidate.

Every master record preserves complete audit traceability:
1. **Source material codes and descriptions**.
2. **Phase 7 candidate IDs** justifying membership.
3. **Reviewer IDs and emails** who deliberate on the decisions.
4. **Cryptographic evidence snapshot hashes** captured at review time.
5. **Group Master Identity Hash**:
   $$\text{group\_identity\_hash} = \text{SHA256}(\text{sorted}(\text{member\_material\_codes}) + \text{canonical\_key\_signature} + \text{consolidated\_attributes})$$

---

## 6. Supabase Database Schema

### `common_material_master` Table
- `common_material_id` (VARCHAR(64), Primary Key)
- `common_code` (VARCHAR(64), Unique, Not Null)
- `common_description` (TEXT, Not Null)
- `material_family` (VARCHAR(64), Not Null, Index)
- `material_type` (VARCHAR(64))
- `material_grade` (VARCHAR(64))
- `nominal_size` (VARCHAR(64))
- `pressure_rating` (VARCHAR(64))
- `standard_spec` (VARCHAR(128))
- `unit_of_measure` (VARCHAR(32))
- `consolidated_attributes` (JSONB, Not Null)
- `cpse_coverage` (JSON, Not Null) — e.g. `["IOCL", "ONGC"]`
- `member_count` (INTEGER, Not Null)
- `governance_status` (VARCHAR(32), Not Null, Index)
- `group_confidence` (FLOAT, Not Null)
- `group_identity_hash` (VARCHAR(64), Unique, Not Null)
- `approved_by` (VARCHAR(128), Nullable)
- `approved_at` (TIMESTAMPTZ, Nullable)
- `approval_rationale` (TEXT, Nullable)
- `created_at` / `updated_at` (TIMESTAMPTZ, Default CURRENT_TIMESTAMP)

### `common_material_members` Table
- `id` (VARCHAR(36), Primary Key, UUID)
- `common_material_id` (VARCHAR(64), Foreign Key $\rightarrow$ `common_material_master.common_material_id`, Index)
- `source_material_code` (VARCHAR(64), Not Null, Index)
- `source_cpse` (VARCHAR(32), Not Null)
- `source_description` (TEXT, Not Null)
- `canonical_material_key` (VARCHAR(256), Not Null)
- `membership_type` (VARCHAR(32), Check: `DIRECT_ACCEPTED`, `TRANSITIVE_VERIFIED`, `STANDALONE`)
- `accepted_edge_candidate_ids` (JSON)
- `reviewer_ids` (JSON)
- `evidence_snapshot_hashes` (JSON)
- `created_at` (TIMESTAMPTZ, Default CURRENT_TIMESTAMP)

---

## 7. REST API Endpoints

| Endpoint | Method | Role Required | Description |
|---|---|---|---|
| `/api/common-master` | `GET` | Authenticated | Returns paginated Common Material Master catalog with filtering by family, status, CPSE, and search. |
| `/api/common-master/stats` | `GET` | Authenticated | Returns catalog summary KPIs (Total groups, multi-CPSE count, standalone count, mapped members, unique families). |
| `/api/common-master/{common_id}` | `GET` | Authenticated | Compiles and returns full master record, consolidated specifications, and member provenance records. |
| `/api/common-master/{common_id}/governance` | `POST` | `reviewer` / `admin` | Human governance sign-off endpoint for transitioning status to `APPROVED_MASTER` with mandatory rationale. Viewers are rejected with HTTP 403. |

---

## 8. Catalog Synthesis Statistics

| Metric | Result | Description |
|---|---|---|
| **Total Source Materials Processed** | **1,250** | 100% catalog universe coverage. |
| **Total Common Material Master Groups** | **1,249** | Complete unified master catalog. |
| **Multi-CPSE Harmonized Groups** | **1** | Validated multi-CPSE group (`ONGC-437562` $\leftrightarrow$ `IOCL-875352`). |
| **Standalone Candidate Groups** | **1,248** | Unmatched materials retained as candidate masters. |
| **Governance: `VERIFIED_HARMONIZED`** | **1** | Multi-CPSE groups with zero conflicts and full compatibility. |
| **Governance: `STANDALONE_CANDIDATE`** | **1,248** | Single-item groups awaiting future cross-CPSE matches. |
| **Governance: `AMBIGUOUS_REVIEW_REQUIRED`** | **0** | No unresolved attribute conflicts. |
| **Governance: `SPLIT_CONFLICT`** | **0** | No incompatible transitive edges required splitting. |
| **Governance: `APPROVED_MASTER` (Automated)** | **0** | Invariant strictly preserved; requires explicit human action. |
| **Total Mapped Source Members** | **1,250** | Zero orphaned records. |
| **Unique CMM Codes Generated** | **1,249** | 100% collision-free deterministic codes. |
| **Determinism Invariant** | **PASS** | Bit-for-bit identical outputs across repeated runs. |

---

## 9. Upstream Immutability Verification

| Dataset / Artifact | SHA-256 Hash | Status |
|---|---|---|
| `data/raw/CPSE_Material_Master_cleaned.csv` | `1a45fccad5203de25f64bfda42e2f56667752bca4338a55913ae4a7babeafef1` | **IMMUTABLE** |
| `data/processed/normalized_materials.csv` | `34891ddaffba57cb3956d4a1172b554077e87dfe36e513e641022bc5634abffc` | **IMMUTABLE** |
| `data/processed/extracted_attributes.csv` | `8fc02888a909679f24346982ebde84a21ee756e80d4d0e9a3d94023580633f4e` | **IMMUTABLE** |
| `data/processed/standardized_materials.csv` | `5e93c66468d2813afd147234c53089f17b4400b07ca6ea168f3445a255fc72d6` | **IMMUTABLE** |
| `data/processed/match_candidates.csv` | `0337a33c1170b64c7f40edb6c82419269f847e06c0b35a174a1434ce77407ca3` | **IMMUTABLE** |
| `data/processed/validated_candidates.csv` | `bc434f434a25aff84a30f3acb4750a0982e19ad125b23cbd5d2c8a84aab89cbc` | **IMMUTABLE** |
| `data/processed/accepted_harmonization_pairs.csv` | `632f64df3f0fdee63a44e2e1d8d29834df6632a8f4babe5a066222ad4635c3d2` | **IMMUTABLE** |

---

## 10. Test & Build Verification Summary

- **Phase 8 Unit Tests (`tests/unit/test_common_master_grouping.py`)**: 7/7 PASS.
- **Phase 8 Integration Tests (`tests/integration/test_common_master_api.py`)**: 6/6 PASS.
- **Full Test Suite Regression**: 228/228 PASS across all phases.
- **Backend Bytecode Compilation**: PASS (`python -m compileall server/ tests/`).
- **TypeScript Typecheck**: PASS (`npx tsc --noEmit` — 0 errors).
- **ESLint**: PASS (`npm run lint` — 0 errors).
- **Frontend Production Build**: PASS (`npm run build` — Vite production bundle generated in 4.88s).
