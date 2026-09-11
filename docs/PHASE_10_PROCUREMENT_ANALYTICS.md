# Phase 10 — Procurement Intelligence + Analytics

## SIH26099: AI-Driven Standardization and Harmonization of Material Codes Across CPSEs

---

## 1. Executive Summary & Purpose

Phase 10 implements the **Procurement Intelligence + Analytics** layer for the SIH26099 platform. Operating strictly as a downstream consumer of the governed Phase 8 Common Material Master (CMM) and Phase 9 Legacy Material Mapping cross-walk, Phase 10 delivers deterministic, evidence-based procurement analytics, cross-CPSE demand visibility, and explainable sourcing signals without altering upstream data or making unsubstantiated financial claims.

### Core Governance & Architectural Guardrails

- **Pure Downstream Consumer**: Phase 10 does NOT create new CMM codes, modify Phase 8 CMM entities, generate match candidates, perform semantic matching, or infer technical equivalence.
- **Physical Volume Conservation**: Physical consumption volume is strictly partitioned by Unit of Measure (UOM). Disparate physical units (NOS, MTR, SET, KG, LTR) are **never** added together into a mixed-unit aggregate. Conservation holds identically across granular facts, CPSE enterprise summaries, and CMM demand records.
- **No Financial / Spend Inventions**: Because the raw dataset does not contain spend or pricing fields, Phase 10 strictly prohibits inventing prices, unit costs, spend amounts, savings projections, ROI calculations, or claiming supplier cost reductions.
- **Deterministic Reference Date**: All purchase recency metrics are calculated against the frozen constant:
  $$\text{ANALYSIS\_REFERENCE\_DATE} = \text{"2026-03-31"}$$
  Dynamic clock calls (`datetime.now()`) are completely prohibited.
- **Auditable Sourcing Opportunities**: Every opportunity includes complete, transparent provenance: `opportunity_id`, `opportunity_type`, `cmm_code`, `source_cpses`, `material_codes`, `trigger_metric`, `trigger_value`, `threshold`, `reason`, and `evidence_reference`.
- **Bit-for-Bit Determinism**: All 5 generated CSV artifacts contain only deterministic fields (runtime execution timestamps are excluded). Consecutive executions produce bit-for-bit identical SHA-256 checksums.

---

## 2. Authoritative Operational Baseline

The Phase 10 baseline operates on the exact governed universe of 1,250 raw source materials:

| Metric | Target Baseline | Actual Output | Status |
| :--- | :--- | :--- | :--- |
| **Total Source Materials** | 1,250 | 1,250 | PASS |
| **Procurement Facts Rows** | 1,250 | 1,250 | PASS |
| **CMM Consumption Summaries** | 1,249 | 1,249 | PASS |
| **CMM Purchase Summaries** | 1,249 | 1,249 | PASS |
| **CPSE Procurement Summaries** | 4 | 4 | PASS |
| **Multi-CPSE CMM Entities** | 1 | 1 | PASS |
| **Standalone CMM Candidates** | 1,248 | 1,248 | PASS |
| **Identified Sourcing Opportunities**| Deterministic | 71 | PASS |

### Enterprise CPSE Distribution

| CPSE Entity | Material Count | Distribution % | Active Items | Inactive Items | Operating Plants | Multi-CPSE Members |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ONGC** | 332 | 26.56% | 302 | 30 | 8 | 1 (`ONGC-437562`) |
| **IOCL** | 319 | 25.52% | 290 | 29 | 11 | 1 (`IOCL-875352`) |
| **HPCL** | 301 | 24.08% | 275 | 26 | 5 | 0 |
| **CPCL** | 298 | 23.84% | 271 | 27 | 3 | 0 |
| **Total Universe** | **1,250** | **100.00%** | **1,138** | **112** | **27** | **2** |

---

## 3. Physical Volume Conservation Invariant (Per UOM)

Phase 10 strictly enforces the physical volume conservation invariant across all analytical layers:

$$\sum \text{Facts}(UOM = X) = \sum \text{CPSE Summary}(UOM = X) = \sum \text{CMM Summary}(UOM = X)$$

| Unit of Measure (UOM) | Facts Total Volume | CPSE Summaries Volume | CMM Summaries Volume | Conservation Status |
| :--- | :--- | :--- | :--- | :--- |
| **NOS** | 9,144,354 | 9,144,354 | 9,144,354 | STRICTLY CONSERVED |
| **MTR** | 5,858,592 | 5,858,592 | 5,858,592 | STRICTLY CONSERVED |
| **LTR** | 764,341 | 764,341 | 764,341 | STRICTLY CONSERVED |

Disparate units are never mixed.

---

## 4. Explainable Sourcing Opportunities Breakdown

All 71 identified opportunities derive from transparent, deterministic rule evaluation:

| Opportunity Type | Count | Primary Trigger / Threshold | Explainable Description |
| :--- | :--- | :--- | :--- |
| **MULTI_CPSE_DEMAND_AGGREGATION** | 1 | `cpse_count >= 2` | Flagged for `CMM-VALVE-A79389-001` (`IOCL` + `ONGC`). Links directly to Phase 7 accepted match `CAN-000331`. |
| **HIGH_VOLUME_CONCENTRATION** | 69 | `consumption >= Linear_P95` | Top 5% annual consumption concentration within `(material_family, primary_uom)` partitions with $N \ge 5$. |
| **PURCHASE_DORMANCY_SIGNAL** | 0 | Active peer with inactive item | No cross-member lifecycle divergences exist in current dataset. |
| **MANUFACTURER_DIVERSITY_SIGNAL** | 1 | `unique_manufacturers_count >= 2` | Flagged for `CMM-VALVE-A79389-001` (2 distinct OEM part numbers across members). |
| **Total Sourcing Signals** | **71** | Complete Provenance | Auditable via `procurement_opportunities.csv` |

---

## 5. Artifact Verification & Bit-for-Bit Determinism

All Phase 10 artifacts are persisted to `data/processed/`. Two clean pipeline executions produce identical SHA-256 hashes:

| Artifact Path | Expected Rows | Verified Rows | SHA-256 Checksum |
| :--- | :--- | :--- | :--- |
| `data/processed/procurement_facts.csv` | 1,250 | 1,250 | `c5fa34b727d3da81197bce0d947cb634d466f971163f5c3a7f91584d866e8a36` |
| `data/processed/cmm_consumption_summary.csv` | 1,249 | 1,249 | `adb1f5e2653e644d4e36617c3d842e3f20c55d34660095f32ee204eb26a51ed5` |
| `data/processed/cmm_purchase_summary.csv` | 1,249 | 1,249 | `b768d579570c43cb48d63f6127f0e15dda3b8a0cddf1d8e6428e5bfe1a14cd19` |
| `data/processed/cpse_procurement_summary.csv` | 4 | 4 | `def508da033756b1ced3215da332c754026ba27fe809e8b214ac9a8746ebbde8` |
| `data/processed/procurement_opportunities.csv` | 71 | 71 | `7e83afdb74f95b73b77effd6f5d2ce02b4fe9f2599759c2f7851754e55b9445b` |
| `data/processed/phase10_analytics_report.json` | — | — | Validated JSON Report |

### Upstream Immutability Audit (Phases 1–9)

All 10 upstream artifact hashes remain 100% bit-for-bit unchanged:

| Phase | Artifact File | Frozen Target SHA-256 | Current Verified SHA-256 | Immutability Status |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | `CPSE_Material_Master_cleaned.csv` | `1a45fccad5203de25f64bfda42e2f56667752bca4338a55913ae4a7babeafef1` | `1a45fccad5203de25f64bfda42e2f56667752bca4338a55913ae4a7babeafef1` | PASS (UNMODIFIED) |
| **Phase 2** | `normalized_materials.csv` | `34891ddaffba57cb3956d4a1172b554077e87dfe36e513e641022bc5634abffc` | `34891ddaffba57cb3956d4a1172b554077e87dfe36e513e641022bc5634abffc` | PASS (UNMODIFIED) |
| **Phase 3** | `extracted_attributes.csv` | `8fc02888a909679f24346982ebde84a21ee756e80d4d0e9a3d94023580633f4e` | `8fc02888a909679f24346982ebde84a21ee756e80d4d0e9a3d94023580633f4e` | PASS (UNMODIFIED) |
| **Phase 4** | `standardized_materials.csv` | `5e93c66468d2813afd147234c53089f17b4400b07ca6ea168f3445a255fc72d6` | `5e93c66468d2813afd147234c53089f17b4400b07ca6ea168f3445a255fc72d6` | PASS (UNMODIFIED) |
| **Phase 5** | `match_candidates.csv` | `0337a33c1170b64c7f40edb6c82419269f847e06c0b35a174a1434ce77407ca3` | `0337a33c1170b64c7f40edb6c82419269f847e06c0b35a174a1434ce77407ca3` | PASS (UNMODIFIED) |
| **Phase 6** | `validated_candidates.csv` | `bc434f434a25aff84a30f3acb4750a0982e19ad125b23cbd5d2c8a84aab89cbc` | `bc434f434a25aff84a30f3acb4750a0982e19ad125b23cbd5d2c8a84aab89cbc` | PASS (UNMODIFIED) |
| **Phase 7** | `accepted_harmonization_pairs.csv`| `632f64df3f0fdee63a44e2e1d8d29834df6632a8f4babe5a066222ad4635c3d2` | `632f64df3f0fdee63a44e2e1d8d29834df6632a8f4babe5a066222ad4635c3d2` | PASS (UNMODIFIED) |
| **Phase 8** | `common_material_master.csv` | `96fa68f3c3401c03b5896bfda3b66b4653640c9d51764cb1652499515be55cba` | `96fa68f3c3401c03b5896bfda3b66b4653640c9d51764cb1652499515be55cba` | PASS (UNMODIFIED) |
| **Phase 8** | `common_material_members.csv` | `5b41bf7220d6818ffae58d5e787da8410c43c0da13c74b099a5f6c704613b4a0` | `5b41bf7220d6818ffae58d5e787da8410c43c0da13c74b099a5f6c704613b4a0` | PASS (UNMODIFIED) |
| **Phase 9** | `legacy_material_mapping.csv` | `2cf7bf298d260a2b4b2d611f6ce680f7a695abadf756232b5b3258082de75a34` | `2cf7bf298d260a2b4b2d611f6ce680f7a695abadf756232b5b3258082de75a34` | PASS (UNMODIFIED) |

---

## 6. Verification and Regression Testing

- **Unit Tests**: `tests/unit/test_procurement_analytics.py` (15/15 passed)
- **Integration Tests**: `tests/integration/test_procurement_api.py` (11/11 passed)
- **Total Project Tests**: 277 passed in 34.51s across all phases.
- **Frontend Verification**: TypeScript compiles with 0 errors (`tsc --noEmit`), ESLint reports 0 errors, production build succeeds in 4.84s.
- **Data Integrity Audit (A–Z)**: All 26 checks (A through Z) passed.
