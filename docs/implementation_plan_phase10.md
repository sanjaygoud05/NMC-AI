# Phase 10 Implementation Plan: Procurement Intelligence + Analytics

## SIH26099: AI-Driven Standardization and Harmonization of Material Codes Across CPSEs

---

## 1. Executive Summary & Objective

Phase 10 represents the analytical culmination of the SIH26099 platform. Its objective is to transform the governed, authoritative **Common Material Master (CMM)** catalog (from Phase 8) and the **Legacy Material Mapping** cross-walk registry (from Phase 9) into an evidence-based, deterministic **Procurement Intelligence and Demand Analytics** system.

In all prior phases (Phases 1 through 9), the platform operated strictly on material standardization, deduplication, candidate grouping, and governance cross-referencing. Phase 10 is the **first and only phase dedicated to enterprise demand aggregation, cross-CPSE consumption visibility, and purchase recency analytics**.

### Strict Phase Boundaries & Negative Invariants

Phase 10 is strictly a **downstream analytical consumer**. It MUST NOT:
- Modify any upstream artifact from Phases 1 through 9 (including raw data, standardization tables, match candidates, validated candidates, accepted pairs, CMM master/members, and legacy mappings).
- Create, modify, retire, or delete Common Material Master records or CMM codes.
- Alter Phase 8 governance statuses (e.g., cannot assign `APPROVED_MASTER`).
- Modify or override Phase 7 human validation verdicts (`ACCEPT`, `REJECT`, `DEFER`).
- Infer new material matches, technical equivalence relationships, or transitive linkages.
- Use Large Language Models (LLMs) or probabilistic AI for procurement decisions or calculations.
- **Strict Prohibition of Financial / Commercial Claims**: The available raw dataset contains physical quantities (`Annual_Consumption`), dates (`Last_Purchase_Date`), operational metadata (`CPSE`, `Plant`, `Material_Status`), and catalog attributes (`Manufacturer`, `Manufacturer_Part_No`, `Unit`, `Material_Category`, `Material_Type`). It does **NOT** contain unit pricing, contract prices, purchase order spend amounts, inventory holding costs, supplier discount tiers, or lead times. **Phase 10 strictly prohibits claiming or calculating spend, pricing, price variance, cost savings, ROI, financial optimization, commercial leverage, or supplier cost reductions.**
- **No Meaningless Multi-UOM Summation**: Consumption volume cannot be summed across different units of measure. Adding 100 `NOS` (units) to 500 `MTR` (meters) or 20 `KG` produces a meaningless quantity. **All consumption aggregations, conservation checks, and volume KPIs must be computed and reported strictly per Unit of Measure (UOM).**

---

## 2. Authoritative Baseline Alignment

Phase 10 operates strictly on the governed Phase 8 & 9 baseline:

| Dimension | Count | Description / Governance Semantics |
| :--- | :--- | :--- |
| **Total Source Materials** | 1,250 | 100% accounted for from `CPSE_Material_Master_cleaned.csv` |
| **ONGC Materials** | 332 | Exploration, drilling, and production equipment |
| **IOCL Materials** | 319 | Downstream refining and pipeline materials |
| **HPCL Materials** | 301 | Refining and marketing infrastructure |
| **CPCL Materials** | 298 | Petrochemical and refinery operations |
| **Total CMM Entities** | 1,249 | Governed Phase 8 Common Material Master groups |
| **Multi-CPSE CMMs** | **1** | `CMM-VALVE-A79389-001` (comprising `ONGC-437562` & `IOCL-875352`) |
| **Standalone CMM Candidates** | **1,248** | Single-CPSE isolated candidates (`STANDALONE_IDENTITY`) |
| **Zero Inferred Links** | 0 | `TRANSITIVE_VERIFIED = 0`; zero transitive deduction |

> **IMPORTANT GOVERNANCE NOTICE**: Phase 10 clearly distinguishes that **exactly 1 CMM represents verified cross-CPSE demand** (`CMM-VALVE-A79389-001`). The remaining **1,248 CMM candidates represent standalone single-CPSE demands**. Phase 10 will never imply or display standalone items as cross-enterprise harmonized demand.

---

## 3. Architecture & Data Flow

```
                      ┌──────────────────────────────────────────────┐
                      │             READ-ONLY UPSTREAM               │
                      │ data/raw/CPSE_Material_Master_cleaned.csv    │
                      │ data/processed/common_material_master.csv    │
                      │ data/processed/common_material_members.csv   │
                      │ data/processed/legacy_material_mapping.csv   │
                      │ data/processed/standardized_materials.csv    │
                      │ data/processed/accepted_harmonization_pairs  │
                      └──────────────────────┬───────────────────────┘
                                             │
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │    Phase 10 Procurement Analytics Engine    │
                      │  - Per-UOM Volume Conservation               │
                      │  - Frozen Date Recency (2026-03-31)          │
                      │  - Deterministic Linear P95 Concentration    │
                      │  - Auditable Opportunity Provenance          │
                      └──────────────────────┬───────────────────────┘
                                             │
               ┌─────────────────────────────┼─────────────────────────────┐
               ▼                             ▼                             ▼
   ┌───────────────────────┐     ┌───────────────────────┐     ┌───────────────────────┐
   │   Line-Level Facts    │     │   CMM & CPSE Aggr.    │     │ Sourcing Opportunity  │
   │ procurement_facts.csv │     │ cmm_consumption_*.csv │     │ opportunities.csv     │
   │ (1,250 legacy items)  │     │ cpse_procurement_*.csv│     │ (Auditable Signals)   │
   └───────────┬───────────┘     └───────────┬───────────┘     └───────────┬───────────┘
               │                             │                             │
               └─────────────────────────────┼─────────────────────────────┘
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │     Supabase PostgreSQL Persistence          │
                      │ (procurement_facts, cmm_procurement_summary, │
                      │  procurement_opportunities)                  │
                      └──────────────────────┬───────────────────────┘
                                             │
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │              FastAPI REST API                │
                      │    /api/procurement/kpis                     │
                      │    /api/procurement/cmm-summary              │
                      │    /api/procurement/cpse-summary             │
                      │    /api/procurement/opportunities            │
                      │    /api/procurement/facts                    │
                      └──────────────────────┬───────────────────────┘
                                             │
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │           React + Vite Frontend              │
                      │    client/src/pages/Procurement.tsx          │
                      │    client/src/services/procurementService.ts │
                      └──────────────────────────────────────────────┘
```

---

## 4. Deterministic Analytics Engine & Mathematical Rules

### 4.1 Frozen Analysis Reference Date
To guarantee 100% bit-for-bit reproducible date deltas across different execution days and environments:
$$\text{ANALYSIS\_REFERENCE\_DATE} = \text{"2026-03-31"}$$
No dynamic system clock (`datetime.now()`) may be used for analytical metrics. Recency is strictly evaluated as:
$$\text{purchase\_recency\_days} = (\text{date}(2026, 3, 31) - \text{last\_purchase\_date}).\text{days}$$

### 4.2 Per-UOM Volume Conservation Invariant
Physical quantities are separated strictly by `unit_of_measure`. For each distinct unit $u \in \{\text{NOS}, \text{MTR}, \text{SET}, \text{KG}, \dots\}$:
$$\sum_{m \in \text{Facts}, \text{UOM}=u} \text{Annual\_Consumption}_m = \sum_{c \in \text{CPSE}, \text{UOM}=u} \text{Volume}_{c, u} = \sum_{k \in \text{CMM}, \text{UOM}=u} \text{Volume}_{k, u}$$
Summing across disparate UoMs is mathematically prohibited.

### 4.3 Deterministic 95th-Percentile Concentration Method
To ensure exact mathematical determinism without implementation ambiguity:
- **Partition**: Evaluated per `(material_family, primary_uom)` partition having $N \ge 5$ distinct CMM records. (Partitions with $N < 5$ are excluded from percentile calculation to prevent spurious triggers on tiny sample sizes).
- **Interpolation Method**: Linear interpolation equivalent to `numpy.percentile(..., 95, method='linear')` and `pandas.Series.quantile(0.95, interpolation='linear')`.
- **Exact Formulation**:
  Let $x_1 \le x_2 \le \dots \le x_N$ be the sorted array of annual consumption values in the partition.
  Virtual index $i = 1 + 0.95 \times (N - 1)$.
  Let $k = \lfloor i \rfloor$ and $d = i - k$.
  $$\text{Threshold } P_{95} = x_k + d \times (x_{k+1} - x_k)$$
  A CMM triggers `HIGH_VOLUME_CONCENTRATION` if:
  $$\text{total\_annual\_consumption} \ge P_{95}$$

---

## 5. Evidence-Based Sourcing Opportunity Rules

All procurement opportunities are rule-based, deterministic, explainable, and traceable. Speculative financial savings are strictly forbidden.

### Rule 1: Multi-CPSE Demand Aggregation (`MULTI_CPSE_DEMAND_AGGREGATION`)
- **Condition**: CMM group has members in $\ge 2$ distinct CPSEs (`cpse_count >= 2`).
- **Baseline Entity**: Exactly 1 group: `CMM-VALVE-A79389-001` (comprising `ONGC-437562` and `IOCL-875352`).
- **Trigger Metric**: `cpse_count`
- **Trigger Value**: `2`
- **Threshold**: `>= 2`
- **Reason**: Multiple public sector enterprises consume technically equivalent items governed under a verified Common Material Master code.
- **Evidence Reference**: `CAN-000331|VALIDATED_COMPATIBLE|ACCEPT`
- **Actionable Next Step**: Explore inter-enterprise volume consolidation and collaborative joint procurement for this harmonized specification across ONGC and IOCL.

### Rule 2: High-Volume Demand Concentration (`HIGH_VOLUME_CONCENTRATION`)
- **Condition**: Within a given `(material_family, primary_uom)` partition with $N \ge 5$, `total_annual_consumption` $\ge P_{95}$ (linear interpolation).
- **Trigger Metric**: `total_annual_consumption`
- **Trigger Value**: Calculated CMM consumption volume
- **Threshold**: `>= P95 (linear interpolation)`
- **Reason**: Item ranks in the top 5% highest consumption volume within its engineering family and unit of measure.
- **Evidence Reference**: `P95_PERCENTILE_LINEAR_{FAMILY}_{UOM}`
- **Actionable Next Step**: Prioritize long-term supply framework agreements and safety stock optimization for this mission-critical volume driver.

### Rule 3: Purchase Dormancy Signal (`PURCHASE_DORMANCY_SIGNAL`)
- **Condition**: Within a CMM group, $\ge 1$ member is marked `Inactive` or `Obsolete`, while another member (or facility) actively consumes the identical specification (`Active` with `Annual_Consumption > 0`).
- **Trigger Metric**: `lifecycle_status_divergence`
- **Trigger Value**: Count of inactive members
- **Threshold**: `has_inactive_and_active_members`
- **Reason**: Procurement inactivity recorded for an item whose standardized engineering specification is actively consumed at another facility/CPSE.
- **Evidence Reference**: `STATUS_INACTIVE_VS_ACTIVE_{CMM_CODE}`
- **Actionable Next Step**: Conduct inter-facility asset review to investigate potential re-activation, inventory transfer, or catalog rationalization before initiating fresh procurement.
- **Constraint**: Must NOT claim verified physical stock-on-hand quantities, as warehouse stock balances are not present in the dataset.

### Rule 4: Manufacturer Diversity Signal (`MANUFACTURER_DIVERSITY_SIGNAL`)
- **Condition**: A CMM group has $\ge 2$ distinct non-empty `Manufacturer` or `Manufacturer_Part_No` entries across its members.
- **Trigger Metric**: `unique_manufacturers_count`
- **Trigger Value**: Distinct manufacturer count ($\ge 2$)
- **Threshold**: `>= 2`
- **Reason**: Multiple OEMs supply technically compatible materials for the identical standardized specification.
- **Evidence Reference**: `OEM_DIVERSITY_{CMM_CODE}`
- **Actionable Next Step**: Review approved vendor lists (AVL) across operating units to qualify alternate OEMs and mitigate single-source dependencies.
- **Constraint**: Analytical visibility signal only. Must NOT claim supplier consolidation discounts or financial benefits.

---

## 6. Exact Output Specifications & Schemas

Phase 10 produces exactly six deterministic artifacts in `data/processed/`:

### 6.1 `data/processed/procurement_facts.csv`
Granular line-level procurement facts. Exactly 1,250 rows. Sorted strictly by `(source_cpse, material_code)` ascending.

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `fact_id` | String (UUIDv5) | `UUIDv5(NAMESPACE_DNS, "FACT:{source_cpse}:{material_code}")` |
| `source_cpse` | String | Source CPSE (`ONGC`, `IOCL`, `HPCL`, `CPCL`) |
| `material_code` | String | Raw legacy material code (e.g., `ONGC-437562`) |
| `material_description`| String | Raw material description |
| `cmm_code` | String | Phase 8 Common Material Master code |
| `material_category` | String | Raw material category (e.g., `Valves`, `Bearings`) |
| `material_type` | String | Material subtype (e.g., `Ball Valve`) |
| `unit_of_measure` | String | Physical unit (`NOS`, `MTR`, `SET`, `KG`, etc.) |
| `plant` | String | Consuming plant/refinery |
| `material_status` | String | Operational state (`Active`, `Inactive`, `Obsolete`) |
| `annual_consumption` | Integer | Annual consumed units ($\ge 0$) |
| `last_purchase_date` | String | Date of last recorded purchase (YYYY-MM-DD) |
| `manufacturer` | String | Recorded OEM/vendor name |
| `manufacturer_part_no`| String | OEM part number |

### 6.2 `data/processed/cmm_consumption_summary.csv`
CMM consumption aggregation. Exactly 1,249 rows. Sorted strictly by `cmm_code` ascending.

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `cmm_code` | String | Common Material Master code |
| `common_description` | String | Governed Phase 8 description |
| `material_family` | String | Standard family token (`VALVE`, `FLANGE`, etc.) |
| `governance_status` | String | Phase 8 status (`VERIFIED_HARMONIZED`, `STANDALONE_CANDIDATE`) |
| `member_count` | Integer | Member count (2 for verified valve, 1 for standalones) |
| `cpse_count` | Integer | Distinct CPSE count (2 for verified valve, 1 for standalones) |
| `consuming_cpses` | String | Sorted semicolon-separated CPSE list (e.g., `IOCL;ONGC`) |
| `primary_uom` | String | Unit of measure for the CMM |
| `total_annual_consumption` | Integer | Sum of member annual consumption |
| `avg_consumption_per_member`| Float | Average consumption per member |
| `plant_count` | Integer | Count of distinct consuming plants |
| `dominant_plant` | String | Plant with highest consumption volume |

### 6.3 `data/processed/cmm_purchase_summary.csv`
Purchase recency and OEM diversity summary. Exactly 1,249 rows. Sorted strictly by `cmm_code` ascending.

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `cmm_code` | String | Common Material Master code |
| `earliest_purchase_date` | String | Min purchase date across members |
| `latest_purchase_date` | String | Max purchase date across members |
| `purchase_recency_days` | Integer | Days elapsed from `latest_purchase_date` to `2026-03-31` |
| `active_member_count` | Integer | Count of active members |
| `inactive_member_count` | Integer | Count of inactive/obsolete members |
| `unique_manufacturers_count`| Integer | Distinct OEM count across members |
| `unique_part_numbers_count`| Integer | Distinct OEM part number count |
| `manufacturer_diversity_flag`| Boolean | True if $\ge 2$ distinct OEMs recorded |

### 6.4 `data/processed/cpse_procurement_summary.csv`
Enterprise summary. Exactly 4 rows (`CPCL`, `HPCL`, `IOCL`, `ONGC`). Sorted strictly by `source_cpse` ascending.

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `source_cpse` | String | CPSE name |
| `total_material_records` | Integer | Material count (`CPCL`: 298, `HPCL`: 301, `IOCL`: 319, `ONGC`: 332) |
| `active_material_count` | Integer | Active material count |
| `inactive_material_count` | Integer | Inactive material count |
| `total_volume_nos` | Integer | Annual consumption for UOM = `NOS` |
| `total_volume_mtr` | Integer | Annual consumption for UOM = `MTR` |
| `total_volume_set` | Integer | Annual consumption for UOM = `SET` |
| `total_volume_other` | Integer | Annual consumption for other UOMs |
| `distinct_plants_count` | Integer | Count of operating refineries/plants |
| `distinct_manufacturers_count`| Integer | Count of distinct OEMs |
| `multi_cpse_harmonized_members`| Integer | Count of verified multi-CPSE members (1 for ONGC, 1 for IOCL, 0 for others) |

### 6.5 `data/processed/procurement_opportunities.csv`
Auditable opportunity table with complete provenance fields. Sorted strictly by `(opportunity_type, cmm_code, opportunity_id)` ascending.

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `opportunity_id` | String (UUIDv5) | Deterministic UUIDv5 identifier |
| `opportunity_type` | String | `MULTI_CPSE_DEMAND_AGGREGATION`, `HIGH_VOLUME_CONCENTRATION`, `PURCHASE_DORMANCY_SIGNAL`, `MANUFACTURER_DIVERSITY_SIGNAL` |
| `cmm_code` | String | Common Material Master code |
| `source_cpses` | String | Semicolon-separated list of CPSEs involved |
| `material_codes` | String | Semicolon-separated list of legacy material codes |
| `trigger_metric` | String | Metric triggering signal (e.g. `cpse_count`, `total_annual_consumption`) |
| `trigger_value` | String | Actual calculated metric value |
| `threshold` | String | Rule threshold string |
| `reason` | String | Plain-language, transparent explanation |
| `evidence_reference` | String | Traceable upstream evidence (e.g. `CAN-000331|VALIDATED_COMPATIBLE|ACCEPT`) |

### 6.6 `data/processed/phase10_analytics_report.json`
Metadata report detailing UOM volume distributions, multi-CPSE metrics, opportunity counts, and pipeline execution audit data.

---

## 7. Backend Architecture & Database Design

### 7.1 SQLAlchemy ORM Models (`server/app/models/procurement.py`)

Three PostgreSQL tables in the Supabase schema:

```sql
-- 1. Line-level procurement facts
CREATE TABLE procurement_facts (
    fact_id VARCHAR(64) PRIMARY KEY,
    source_cpse VARCHAR(32) NOT NULL,
    material_code VARCHAR(64) NOT NULL,
    material_description TEXT NOT NULL,
    cmm_code VARCHAR(64) NOT NULL REFERENCES common_material_master(common_code),
    material_category VARCHAR(64) NOT NULL,
    material_type VARCHAR(64),
    unit_of_measure VARCHAR(32) NOT NULL,
    plant VARCHAR(128) NOT NULL,
    material_status VARCHAR(32) NOT NULL,
    annual_consumption INTEGER NOT NULL CHECK (annual_consumption >= 0),
    last_purchase_date DATE,
    manufacturer VARCHAR(128),
    manufacturer_part_no VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_procurement_fact_cpse_code UNIQUE (source_cpse, material_code)
);

-- 2. CMM aggregated procurement summary
CREATE TABLE cmm_procurement_summary (
    cmm_code VARCHAR(64) PRIMARY KEY REFERENCES common_material_master(common_code),
    common_description TEXT NOT NULL,
    material_family VARCHAR(64) NOT NULL,
    governance_status VARCHAR(32) NOT NULL,
    member_count INTEGER NOT NULL,
    cpse_count INTEGER NOT NULL,
    consuming_cpses VARCHAR(128) NOT NULL,
    primary_uom VARCHAR(32) NOT NULL,
    total_annual_consumption INTEGER NOT NULL,
    avg_consumption_per_member FLOAT NOT NULL,
    plant_count INTEGER NOT NULL,
    dominant_plant VARCHAR(128),
    earliest_purchase_date DATE,
    latest_purchase_date DATE,
    purchase_recency_days INTEGER,
    active_member_count INTEGER NOT NULL,
    inactive_member_count INTEGER NOT NULL,
    unique_manufacturers_count INTEGER NOT NULL,
    unique_part_numbers_count INTEGER NOT NULL,
    manufacturer_diversity_flag BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Deterministic procurement opportunities with full provenance
CREATE TABLE procurement_opportunities (
    opportunity_id VARCHAR(64) PRIMARY KEY,
    opportunity_type VARCHAR(64) NOT NULL,
    cmm_code VARCHAR(64) NOT NULL REFERENCES common_material_master(common_code),
    source_cpses VARCHAR(128) NOT NULL,
    material_codes TEXT NOT NULL,
    trigger_metric VARCHAR(64) NOT NULL,
    trigger_value VARCHAR(64) NOT NULL,
    threshold VARCHAR(64) NOT NULL,
    reason TEXT NOT NULL,
    evidence_reference TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_opp_type_cmm UNIQUE (opportunity_type, cmm_code),
    CONSTRAINT ck_opp_type CHECK (
        opportunity_type IN (
            'MULTI_CPSE_DEMAND_AGGREGATION',
            'HIGH_VOLUME_CONCENTRATION',
            'PURCHASE_DORMANCY_SIGNAL',
            'MANUFACTURER_DIVERSITY_SIGNAL'
        )
    )
);
```

### 7.2 Repository & Service Layer
- `server/app/db/procurement_repository.py`: Manages transactional batch persistence, queries with filtering, pagination, and per-UOM KPI aggregation.
- `server/services/procurement_analytics_service.py`: Encapsulates per-UOM conservation math, linear P95 calculations, opportunity rule evaluation, and report serialization.
- `server/pipeline/phase10_procurement_analytics.py`: Standalone executable pipeline script.

### 7.3 FastAPI REST Endpoints (`server/app/api/procurement.py`)
- `GET /api/procurement/kpis`: Returns per-UOM volume totals, multi-CPSE demand, active ratios, plant counts, opportunity counts.
- `GET /api/procurement/cmm-summary`: Paginated query of CMM consumption profiles with filtering by family, UoM, CPSE coverage, min consumption.
- `GET /api/procurement/cmm-summary/{cmm_code}`: Single CMM detailed procurement profile with plant and member breakdown.
- `GET /api/procurement/cpse-summary`: Enterprise-level breakdown across the 4 CPSEs with per-UOM metrics.
- `GET /api/procurement/opportunities`: Filterable list of evidence-based procurement opportunities (by type, family, CPSE).
- `GET /api/procurement/plants`: Plant/refinery-level consumption distribution.

---

## 8. Frontend Architecture & User Interface

The React + TypeScript + Vite frontend will replace the mock `client/src/pages/Procurement.tsx` with a production-grade analytics interface:

### 8.2 Key Interface Components
1. **Executive KPI Header (Per-UOM Breakdown)**:
   - Volume by UOM: `NOS` Volume, `MTR` Volume, `SET` Volume.
   - Multi-CPSE Harmonized Volume (Valve cluster).
   - Total Materials ($1,250$) & CMMs ($1,249$).
   - Active Material % ($92.4\%$).
   - Identified Opportunities Count.
2. **Tabbed Analytics Workspace**:
   - **Tab 1: Sourcing Opportunities**: Transparent cards detailing verified signals with full provenance chips, trigger metrics, thresholds, and evidence links.
   - **Tab 2: CMM Demand Explorer**: Searchable, sortable catalog of all 1,249 CMM codes with per-UOM consumption volume bars, CPSE coverage badges, and plant counts.
   - **Tab 3: CPSE Demand Comparison**: Visual cards and charts comparing per-UOM volume distributions, active/inactive ratios, and plant counts across CPSEs.
   - **Tab 4: Facility & Plant Distribution**: Refinery-level breakdown showing consumption volume by plant.
3. **CMM Drill-Down Modal**:
   - Deep-dive modal displaying member-level plant consumption, OEM part numbers, purchase recency, and harmonization provenance.

---

## 9. Phase 10 Testing Strategy

### 9.1 Unit Tests (`tests/unit/test_procurement_analytics.py`, 14+ tests)
1. **Universe Retention**: `procurement_facts.csv` contains exactly 1,250 rows.
2. **Exact CPSE Counts**: ONGC (332), IOCL (319), HPCL (301), CPCL (298).
3. **CMM Cardinality**: `cmm_consumption_summary.csv` contains exactly 1,249 rows (1 multi-CPSE, 1,248 standalone).
4. **Per-UOM Volume Conservation**:
   $$\sum \text{Annual\_Consumption}(\text{UOM}=u) \text{ is invariant across Facts, CPSE, and CMM summaries}.$$
5. **No Cross-UOM Addition**: Verifies that disparate UOMs (NOS, MTR, LTR, KG) are never combined into a single sum.
6. **Multi-CPSE Valve Group Demand**: `CMM-VALVE-A79389-001` demand equals $\text{Annual\_Consumption}(\text{ONGC-437562}) + \text{Annual\_Consumption}(\text{IOCL-875352})$.
7. **Multi-CPSE Opportunity Trigger**: Exactly 1 `MULTI_CPSE_DEMAND_AGGREGATION` opportunity triggered (`CMM-VALVE-A79389-001`).
8. **Linear P95 Calculation**: Verified exact linear interpolation quantile matches expected mathematical value on test arrays.
9. **Purchase Dormancy Signal**: Verified trigger on inactive member with active peer.
10. **Manufacturer Diversity Signal**: Analytical flag only; verified trigger when $\ge 2$ distinct OEMs exist.
11. **Frozen Reference Date**: Verified `ANALYSIS_REFERENCE_DATE = "2026-03-31"` is used for all day deltas.
12. **Deterministic UUIDv5 Integrity**: Fact IDs and Opportunity IDs match UUIDv5 format.
13. **Two-Run CSV Determinism**: Two repeated clean runs produce bit-for-bit identical CSV bytes and SHA-256 hashes.
14. **No Runtime Timestamps in CSV**: Absence of `created_at`/`updated_at` in CSV files.
15. **No Commercial Inventions**: Verifies zero financial/spend/currency fields exist in output schemas.

### 9.2 Integration Tests (`tests/integration/test_procurement_api.py`, 8+ tests)
1. `GET /api/procurement/kpis`: Verifies per-UOM volume structure.
2. `GET /api/procurement/cmm-summary`: Tests pagination, sorting, and family filtering.
3. `GET /api/procurement/cmm-summary/{cmm_code}`: Single CMM detail for `CMM-VALVE-A79389-001`.
4. `GET /api/procurement/cpse-summary`: Verifies exact 4 CPSE records.
5. `GET /api/procurement/opportunities`: Verifies opportunity filtering and full provenance fields.
6. `GET /api/procurement/plants`: Plant-level volume aggregation.
7. Database constraints and composite uniqueness verification.
8. Upstream Phase 1–9 SHA-256 immutability verification.

---

## 10. Phase 10 Data-Integrity Audit Protocol

Automated audit script (`scratch/phase10_audit.py`) will evaluate:

- **Check A**: Raw universe retained ($1,250$ materials).
- **Check B**: Facts table row count equals exactly $1,250$.
- **Check C**: CMM summary row count equals exactly $1,249$ ($1$ multi-CPSE, $1,248$ standalone).
- **Check D**: CPSE summary row count equals exactly $4$.
- **Check E**: CPSE material distribution matches baseline: ONGC (332), IOCL (319), HPCL (301), CPCL (298).
- **Check F**: Per-UOM volume conservation holds strictly across facts, CPSE, and CMM tables.
- **Check G**: Disparate UOMs are never summed together.
- **Check H**: `CMM-VALVE-A79389-001` demand equals $\text{Annual\_Consumption}(\text{ONGC-437562}) + \text{Annual\_Consumption}(\text{IOCL-875352})$.
- **Check I**: Exactly 1 `MULTI_CPSE_DEMAND_AGGREGATION` opportunity exists (`CMM-VALVE-A79389-001`).
- **Check J**: Full provenance fields present in `procurement_opportunities.csv` (`opportunity_id`, `opportunity_type`, `cmm_code`, `source_cpses`, `material_codes`, `trigger_metric`, `trigger_value`, `threshold`, `reason`, `evidence_reference`).
- **Check K**: Linear P95 calculation formula verified mathematically.
- **Check L**: `ANALYSIS_REFERENCE_DATE` frozen to `2026-03-31`.
- **Check M**: Zero currency spend, pricing, or speculative financial savings appear in output artifacts.
- **Check N**: Zero new CMM codes created (all CMM codes exist in Phase 8).
- **Check O**: Zero new material mappings created (all mappings exist in Phase 9).
- **Check P**: All Phase 1 through 9 artifact SHA-256 hashes remain identical to frozen baselines.
- **Check Q**: Two clean Phase 10 runs produce identical deterministic CSV SHA-256 checksums.
- **Check R**: Database row counts and constraints match output artifacts.

---

## 11. Acceptance Criteria

Phase 10 will only be accepted when:
1. All 6 output files exist with exact row counts.
2. Automated audit protocol (Checks A through R) passes 100%.
3. Volume conservation holds strictly per UOM.
4. No currency spend, pricing, or speculative financial savings are claimed or invented.
5. Multi-CPSE CMM count = 1, Standalone CMM count = 1,248.
6. All Phase 1–9 upstream SHA-256 hashes remain strictly identical.
7. Two consecutive clean pipeline executions produce identical CSV SHA-256 hashes.
8. Full regression test suite passes $\ge 270$ tests ($251$ existing + $\ge 20$ Phase 10 tests).
9. Frontend builds cleanly with zero TypeScript errors and zero lint errors.
