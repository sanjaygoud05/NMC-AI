# Phase 9 — Legacy Material Mapping Cross-Walk Registry

## SIH26099: AI-Driven Standardization and Harmonization of Material Codes Across CPSEs

---

## 1. Executive Summary & Purpose

Phase 9 implements the authoritative **Legacy Material Mapping Cross-Walk Registry** for the SIH26099 platform. It provides the definitive operational bridge connecting legacy enterprise resource planning (ERP) material numbers from participating CPSEs (ONGC, IOCL, HPCL, CPCL) to governed **Common Material Master (CMM)** entities synthesized in Phase 8.

Phase 9 serves as a **pure consumer** of governed master data and accepted validation verdicts. It establishes a complete, deterministic, traceable, and audited cross-reference directory enabling cross-enterprise inventory visibility, spend aggregation, and procurement intelligence without modifying source ERP systems.

### Core Philosophy & Strict Phase Boundaries

- **Pure Consumer Architecture**: Phase 9 does NOT create, alter, split, or retire Common Material Master records. It does NOT generate new CMM codes, modify CMM descriptions, or change Phase 8 governance statuses.
- **Zero Inferred Harmonization**: Phase 9 strictly respects explicit Phase 8 memberships. No semantic matching, embedding distance, LLM inference, or transitive deduction ($A \rightarrow B \land B \rightarrow C \implies A \rightarrow C$) is performed.
- **Complete Universe Retention**: Exactly 1,250 source materials across all 4 physical CPSEs are accounted for with 100% coverage ($1,250 / 1,250$).
- **Bit-for-Bit Determinism**: Artifact outputs (`legacy_material_mapping.csv`) are 100% deterministic with zero runtime timestamps in deterministic files. Repeated pipeline executions on identical inputs yield identical SHA-256 checksums.
- **Cryptographic Provenance**: Every mapping is keyed by a deterministic UUIDv5 identifier and links directly to upstream Phase 6 compatibility validation and Phase 7 human review verdicts.

---

## 2. Authoritative Operational Baseline

The Phase 9 baseline reflects the exact governed state of the SIH26099 platform following Phase 8 synthesis:

| Metric | Target Baseline | Actual Output | Status |
| :--- | :--- | :--- | :--- |
| **Total Source Materials** | 1,250 | 1,250 | PASS |
| **MAPPED_VERIFIED** | 2 | 2 | PASS |
| **MAPPED_STANDALONE** | 1,248 | 1,248 | PASS |
| **REVIEW_REQUIRED** | 0 | 0 | PASS |
| **CONFLICT** | 0 | 0 | PASS |
| **UNMAPPED** | 0 | 0 | PASS |
| **TRANSITIVE_VERIFIED** | 0 | 0 | PASS |
| **Mapping Coverage** | 100.0% | 100.0% | PASS |

### CPSE Source Universe Distribution

| CPSE Entity | Source Material Count | Distribution Percentage |
| :--- | :--- | :--- |
| **ONGC** (Oil and Natural Gas Corporation) | 332 | 26.56% |
| **IOCL** (Indian Oil Corporation Limited) | 319 | 25.52% |
| **HPCL** (Hindustan Petroleum Corporation Limited) | 301 | 24.08% |
| **CPCL** (Chennai Petroleum Corporation Limited) | 298 | 23.84% |
| **Total Universe** | **1,250** | **100.00%** |

---

## 3. Operational Semantics & Confidence Framework

A critical governance requirement of Phase 9 is the strict distinction between cross-CPSE verified harmonization and single-CPSE standalone identity:

### Verified Cross-CPSE Harmonization (`MAPPED_VERIFIED`)
- **Applies to**: The 2 validated members of the multi-CPSE valve cluster (`ONGC-437562` and `IOCL-875352`).
- **Assigned CMM Code**: `CMM-VALVE-A79389-001`
- **Membership Type**: `DIRECT_ACCEPTED`
- **Confidence Score**: `1.000`
- **Confidence Semantics**: `VERIFIED_CROSS_CPSE`
- **Traceable Provenance**:
  - Candidate Relationship: `CAN-000331`
  - Phase 6 Technical Validation: `VALIDATED_COMPATIBLE`
  - Phase 7 Review Decision: `ACCEPT`
  - Phase 8 Master Group: `VERIFIED_HARMONIZED`

### Standalone Identity (`MAPPED_STANDALONE`)
- **Applies to**: The 1,248 catalog materials having no validated cross-CPSE accepted counterpart in Phase 7.
- **Assigned CMM Code**: Unique deterministic singleton CMM code (e.g., `CMM-PIPE-01C5CE-001`, `CMM-FLANGE-9B04DC-001`).
- **Membership Type**: `STANDALONE`
- **Confidence Score**: `1.000`
- **Confidence Semantics**: `STANDALONE_IDENTITY`
- **Mapping Method**: `STANDALONE_ISOLATE`
- **Governance Mandate**:
  > **IMPORTANT NOTICE:** `STANDALONE_IDENTITY` indicates a deterministic, uncompromised 1-to-1 link between a legacy CPSE record and its isolated Common Material Master candidate. **`STANDALONE_IDENTITY` does NOT mean cross-CPSE equivalence or universal interchangeability.** These items are preserved to maintain 100% catalog integrity and must never be portrayed as multi-CPSE harmonized.

---

## 4. Deterministic Identity & Data Model

### Deterministic UUIDv5 Mapping Identifier
To prevent random, unrepeatable identifiers across environments, mapping IDs are computed using UUIDv5 with the DNS namespace:

$$\text{UUIDv5}\left(\text{NAMESPACE\_DNS}, \text{"LEGACY\_MAP:\{source\_cpse\}:\{material\_code\}:\{cmm\_code\_or\_NONE\}"}\right)$$

### Relational Schema & Integrity Constraints
The PostgreSQL table `legacy_material_mappings` enforces natural and conditional data integrity:

```sql
CREATE TABLE legacy_material_mappings (
    mapping_id VARCHAR(64) PRIMARY KEY,
    source_cpse VARCHAR(32) NOT NULL,
    material_code VARCHAR(64) NOT NULL,
    raw_material_name TEXT NOT NULL,
    cmm_code VARCHAR(64) REFERENCES common_material_master(common_code) ON DELETE RESTRICT,
    mapping_status VARCHAR(32) NOT NULL,
    membership_type VARCHAR(32) NOT NULL,
    confidence_score NUMERIC(4, 3) NOT NULL,
    confidence_semantics VARCHAR(32) NOT NULL,
    accepted_candidate_id VARCHAR(64),
    phase6_validation_status VARCHAR(32),
    phase7_review_decision VARCHAR(32),
    mapping_method VARCHAR(32) NOT NULL,
    mapping_reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_legacy_mapping_source_material UNIQUE (source_cpse, material_code),
    CONSTRAINT ck_legacy_mapping_status CHECK (
        mapping_status IN ('MAPPED_VERIFIED', 'MAPPED_STANDALONE', 'REVIEW_REQUIRED', 'CONFLICT', 'UNMAPPED')
    ),
    CONSTRAINT ck_legacy_confidence_semantics CHECK (
        confidence_semantics IN ('VERIFIED_CROSS_CPSE', 'STANDALONE_IDENTITY', 'PENDING_REVIEW', 'CONFLICT_UNRESOLVED')
    ),
    CONSTRAINT ck_cmm_code_integrity CHECK (
        (mapping_status IN ('MAPPED_VERIFIED', 'MAPPED_STANDALONE') AND cmm_code IS NOT NULL) OR
        (mapping_status = 'UNMAPPED' AND cmm_code IS NULL) OR
        (mapping_status IN ('REVIEW_REQUIRED', 'CONFLICT'))
    )
);
```

### Deterministic Artifact Structure
`data/processed/legacy_material_mapping.csv` is strictly ordered by `(source_cpse, material_code)` ascending and contains only deterministic domain attributes:
- `mapping_id`
- `source_cpse`
- `material_code`
- `raw_material_name`
- `cmm_code`
- `mapping_status`
- `membership_type`
- `confidence_score`
- `confidence_semantics`
- `accepted_candidate_id`
- `phase6_validation_status`
- `phase7_review_decision`
- `mapping_method`
- `mapping_reason`

---

## 5. REST API Specifications

The FastAPI backend exposes read-only endpoints for legacy cross-walk exploration:

### 1. Paginated Registry Query
- **Endpoint**: `GET /api/legacy-mapping`
- **Query Parameters**:
  - `page` (integer, default: 1)
  - `page_size` (integer, default: 20, max: 500)
  - `cpse` (optional string: `ONGC`, `IOCL`, `HPCL`, `CPCL`)
  - `status` (optional string: `MAPPED_VERIFIED`, `MAPPED_STANDALONE`, etc.)
  - `search` (optional substring query matching code, description, or CMM code)
- **Response**: JSON object containing `items`, `total`, `page`, `page_size`, `total_pages`.

### 2. High-Level Summary Statistics
- **Endpoint**: `GET /api/legacy-mapping/stats`
- **Response**: JSON object containing KPIs:
  - `total_source_materials` (1250)
  - `verified_mapped` (2)
  - `standalone_mapped` (1248)
  - `review_required` (0)
  - `conflict` (0)
  - `unmapped` (0)
  - `transitive_verified` (0)
  - `mapping_coverage_pct` (100.0)
  - `cpse_distribution` (`ONGC`: 332, `IOCL`: 319, `HPCL`: 301, `CPCL`: 298)

### 3. Single Legacy Material Lookup
- **Endpoint**: `GET /api/legacy-mapping/{source_cpse}/{material_code}`
- **Response**: Complete record payload with Phase 6 and Phase 7 provenance details. Returns HTTP 404 if not found.

### 4. Reverse Lookup by CMM Code
- **Endpoint**: `GET /api/legacy-mapping/by-cmm/{cmm_code}`
- **Response**: Array of legacy material records mapped to the specified CMM entity.

---

## 6. Upstream Immutability Matrix

Phase 9 verifies that all upstream artifacts from Phases 1 through 8 remain strictly byte-for-byte unmodified:

| Artifact Path | Frozen SHA-256 Checksum | Verification Status |
| :--- | :--- | :--- |
| `data/raw/CPSE_Material_Master_cleaned.csv` | `1a45fccad5203de25f64bfda42e2f56667752bca4338a55913ae4a7babeafef1` | VERIFIED IMMUTABLE |
| `data/processed/standardized_materials.csv` | `5e93c66468d2813afd147234c53089f17b4400b07ca6ea168f3445a255fc72d6` | VERIFIED IMMUTABLE |
| `data/processed/accepted_harmonization_pairs.csv` | `632f64df3f0fdee63a44e2e1d8d29834df6632a8f4babe5a066222ad4635c3d2` | VERIFIED IMMUTABLE |
| `data/processed/common_material_master.csv` | `96fa68f3c3401c03b5896bfda3b66b4653640c9d51764cb1652499515be55cba` | VERIFIED IMMUTABLE |
| `data/processed/common_material_members.csv` | `5b41bf7220d6818ffae58d5e787da8410c43c0da13c74b099a5f6c704613b4a0` | VERIFIED IMMUTABLE |
