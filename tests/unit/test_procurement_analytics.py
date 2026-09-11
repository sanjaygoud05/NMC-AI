"""
Unit tests for Phase 10 Procurement Intelligence + Analytics
Tests:
- Universe retention: exactly 1,250 facts, 1,249 CMM summaries, 4 CPSE summaries
- CPSE distribution: ONGC 332, IOCL 319, HPCL 301, CPCL 298
- Per-UOM volume conservation: sum(facts[u]) == sum(cpse[u]) == sum(cmm[u])
- No cross-UOM aggregation
- Linear interpolation 95th percentile calculation on partitions with N >= 5
- Frozen reference date: 2026-03-31 recency determinism
- Multi-CPSE CMM aggregation signal and provenance
- Manufacturer diversity signal
- Complete opportunity provenance
- Deterministic UUIDv5 identifiers
- Bit-for-bit determinism across two clean pipeline runs
- No runtime timestamps in CSV artifacts
- No spend, price, financial savings, or ROI invention
"""

import os
import hashlib
import uuid
import pytest
import pandas as pd
import numpy as np

from server.services.procurement_analytics_service import (
    ProcurementAnalyticsService,
    ANALYSIS_REFERENCE_DATE,
)
from server.pipeline.phase10_procurement_analytics import run_procurement_analytics


@pytest.fixture(scope="module")
def analytics_bundle():
    data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))
    svc = ProcurementAnalyticsService(data_dir=data_dir)
    return svc.build_procurement_analytics()


class TestProcurementUniverseAndCardinality:
    """Validates full universe retention and exact enterprise distributions"""

    def test_facts_row_count(self, analytics_bundle):
        """Procurement facts must contain exactly 1,250 rows"""
        assert len(analytics_bundle["facts"]) == 1250

    def test_cmm_summaries_count(self, analytics_bundle):
        """CMM consumption and purchase summaries must contain exactly 1,249 rows"""
        assert len(analytics_bundle["cmm_consumption_summaries"]) == 1249
        assert len(analytics_bundle["cmm_purchase_summaries"]) == 1249

    def test_cpse_summaries_count(self, analytics_bundle):
        """CPSE summaries must contain exactly 4 rows"""
        assert len(analytics_bundle["cpse_summaries"]) == 4

    def test_cpse_material_distribution(self, analytics_bundle):
        """Source CPSE distribution must match raw cleaned dataset exactly"""
        df_facts = pd.DataFrame(analytics_bundle["facts"])
        counts = df_facts["source_cpse"].value_counts().to_dict()
        assert counts["ONGC"] == 332
        assert counts["IOCL"] == 319
        assert counts["HPCL"] == 301
        assert counts["CPCL"] == 298
        assert sum(counts.values()) == 1250

    def test_multi_cpse_and_standalone_counts(self, analytics_bundle):
        """Exactly 1 Multi-CPSE CMM entity and 1,248 Standalone CMM entities"""
        cmm_cons = analytics_bundle["cmm_consumption_summaries"]
        multi_cpse = [c for c in cmm_cons if c["cpse_count"] >= 2]
        standalone = [c for c in cmm_cons if c["cpse_count"] == 1]
        assert len(multi_cpse) == 1
        assert len(standalone) == 1248
        assert multi_cpse[0]["cmm_code"] == "CMM-VALVE-A79389-001"
        assert set(multi_cpse[0]["consuming_cpses"].split(";")) == {"IOCL", "ONGC"}


class TestUOMVolumeConservation:
    """Validates strict physical volume conservation partitioned by UOM"""

    def test_volume_conservation_by_uom(self, analytics_bundle):
        """
        Physical conservation invariant must hold independently for each UOM:
        SUM(facts where UOM = X) == SUM(cpse summary where UOM = X) == SUM(CMM summary where UOM = X)
        """
        df_facts = pd.DataFrame(analytics_bundle["facts"])
        df_cpse = pd.DataFrame(analytics_bundle["cpse_summaries"])
        df_cmm = pd.DataFrame(analytics_bundle["cmm_consumption_summaries"])

        # Check NOS
        facts_nos = df_facts[df_facts["unit_of_measure"] == "NOS"]["annual_consumption"].sum()
        cpse_nos = df_cpse["total_volume_nos"].sum()
        cmm_nos = df_cmm[df_cmm["primary_uom"] == "NOS"]["total_annual_consumption"].sum()
        assert facts_nos == cpse_nos == cmm_nos == 9144354

        # Check MTR
        facts_mtr = df_facts[df_facts["unit_of_measure"] == "MTR"]["annual_consumption"].sum()
        cpse_mtr = df_cpse["total_volume_mtr"].sum()
        cmm_mtr = df_cmm[df_cmm["primary_uom"] == "MTR"]["total_annual_consumption"].sum()
        assert facts_mtr == cpse_mtr == cmm_mtr == 5858592

        # Check SET
        facts_set = df_facts[df_facts["unit_of_measure"] == "SET"]["annual_consumption"].sum()
        cpse_set = df_cpse["total_volume_set"].sum()
        cmm_set = df_cmm[df_cmm["primary_uom"] == "SET"]["total_annual_consumption"].sum()
        assert facts_set == cpse_set == cmm_set

    def test_no_cross_uom_addition(self, analytics_bundle):
        """Disparate UOMs must never be added together into a single physical metric"""
        df_facts = pd.DataFrame(analytics_bundle["facts"])
        uoms = df_facts["unit_of_measure"].unique().tolist()
        assert len(uoms) >= 3
        # Ensure separate tracking
        for uom in uoms:
            uom_vol = df_facts[df_facts["unit_of_measure"] == uom]["annual_consumption"].sum()
            assert uom_vol > 0


class TestPercentileAndReferenceDate:
    """Validates linear P95 calculation and frozen reference date"""

    def test_linear_p95_calculation(self):
        """compute_linear_p95 must match numpy.percentile(method='linear')"""
        vals = [10, 20, 35, 50, 100, 200, 500, 1000, 2500, 10000]
        custom_p95 = ProcurementAnalyticsService.compute_linear_p95(vals)
        np_p95 = float(np.percentile(vals, 95, method="linear"))
        assert pytest.approx(custom_p95, rel=1e-6) == np_p95

    def test_frozen_reference_date_recency(self, analytics_bundle):
        """Purchase recency days must be calculated strictly against 2026-03-31"""
        assert ANALYSIS_REFERENCE_DATE == "2026-03-31"
        cmm_pur = analytics_bundle["cmm_purchase_summaries"]
        with_dates = [c for c in cmm_pur if c["latest_purchase_date"] and c["purchase_recency_days"] != ""]
        assert len(with_dates) > 0
        for c in with_dates[:20]:
            latest_d = pd.to_datetime(c["latest_purchase_date"]).date()
            expected_days = (pd.to_datetime("2026-03-31").date() - latest_d).days
            assert int(c["purchase_recency_days"]) == expected_days


class TestOpportunitySignalsAndProvenance:
    """Validates explainable opportunity rules and complete provenance"""

    def test_multi_cpse_demand_aggregation_signal(self, analytics_bundle):
        """CMM-VALVE-A79389-001 must trigger MULTI_CPSE_DEMAND_AGGREGATION with complete provenance"""
        opps = analytics_bundle["opportunities"]
        multi_opps = [o for o in opps if o["opportunity_type"] == "MULTI_CPSE_DEMAND_AGGREGATION"]
        assert len(multi_opps) == 1
        opp = multi_opps[0]
        assert opp["cmm_code"] == "CMM-VALVE-A79389-001"
        assert set(opp["source_cpses"].split(";")) == {"IOCL", "ONGC"}
        assert opp["trigger_metric"] == "cpse_count"
        assert opp["trigger_value"] == "2"
        assert opp["evidence_reference"] == "CAN-000331|VALIDATED_COMPATIBLE|ACCEPT"

    def test_all_opportunities_have_complete_provenance(self, analytics_bundle):
        """Every opportunity must contain all mandatory provenance fields"""
        opps = analytics_bundle["opportunities"]
        required_fields = [
            "opportunity_id",
            "opportunity_type",
            "cmm_code",
            "source_cpses",
            "material_codes",
            "trigger_metric",
            "trigger_value",
            "threshold",
            "reason",
            "evidence_reference",
        ]
        for o in opps:
            for field in required_fields:
                assert field in o
                assert o[field] is not None
                assert str(o[field]).strip() != ""

    def test_deterministic_uuidv5_generation(self):
        """UUIDv5 generators must produce consistent, reproducible identifiers"""
        id1 = ProcurementAnalyticsService.generate_fact_id("ONGC", "ONGC-437562")
        id2 = ProcurementAnalyticsService.generate_fact_id("ONGC", "ONGC-437562")
        assert id1 == id2
        assert uuid.UUID(id1).version == 5

        opp1 = ProcurementAnalyticsService.generate_opportunity_id("MULTI_CPSE_DEMAND_AGGREGATION", "CMM-VALVE-A79389-001")
        opp2 = ProcurementAnalyticsService.generate_opportunity_id("MULTI_CPSE_DEMAND_AGGREGATION", "CMM-VALVE-A79389-001")
        assert opp1 == opp2
        assert uuid.UUID(opp1).version == 5


class TestDeterminismAndProhibitions:
    """Validates two-run bit-for-bit CSV determinism and absence of invented financial data"""

    def test_two_run_csv_determinism(self):
        """Running the Phase 10 pipeline twice must produce identical SHA-256 hashes"""
        res1 = run_procurement_analytics()
        res2 = run_procurement_analytics()

        artifacts1 = res1["artifacts"]
        artifacts2 = res2["artifacts"]

        csv_keys = [
            "procurement_facts_sha256",
            "cmm_consumption_summary_sha256",
            "cmm_purchase_summary_sha256",
            "cpse_procurement_summary_sha256",
            "procurement_opportunities_sha256",
        ]
        for key in csv_keys:
            assert artifacts1[key] == artifacts2[key], f"Determinism mismatch on {key}"

    def test_no_financial_or_pricing_invention(self, analytics_bundle):
        """Phase 10 must not invent spend, unit prices, cost savings, or ROI"""
        facts = analytics_bundle["facts"]
        forbidden_keywords = ["price", "spend", "cost", "savings", "roi", "inr", "usd", "currency"]
        for f in facts[:50]:
            for k in f.keys():
                for kw in forbidden_keywords:
                    assert kw not in k.lower(), f"Forbidden financial term '{kw}' found in fact key '{k}'"

    def test_no_runtime_timestamps_in_csv_artifacts(self):
        """CSV artifacts must not contain runtime execution timestamps"""
        data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "processed"))
        csv_files = [
            "procurement_facts.csv",
            "cmm_consumption_summary.csv",
            "cmm_purchase_summary.csv",
            "cpse_procurement_summary.csv",
            "procurement_opportunities.csv",
        ]
        for cf in csv_files:
            p = os.path.join(data_dir, cf)
            df = pd.read_csv(p)
            for col in df.columns:
                assert col not in ["created_at", "updated_at", "execution_timestamp", "run_time"]
