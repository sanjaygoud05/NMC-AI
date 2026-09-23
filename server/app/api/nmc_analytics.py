"""
NMC Analytics API — Full Comprehensive Endpoint
All data derived from real DB tables. No hardcoded values.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_, text
from app.db.nmc_repository import nmc_repo
from app.api.nmc_auth import verify_reviewer_access
from app.models.nmc_models import (
    CPSE, Dataset, Material, MaterialMatch,
    NMCCommonMaterial, MaterialMapping, ReviewDecision, AuditLog,
)

router = APIRouter(prefix="/api/nmc/analytics", tags=["NMC Analytics"])


@router.get("/dashboard")
def get_dashboard_metrics(role: str = Depends(verify_reviewer_access)):
    return nmc_repo.get_dashboard_kpis()


@router.get("/cpses")
def get_cpse_analytics(role: str = Depends(verify_reviewer_access)):
    return nmc_repo.get_cpse_analytics()


@router.get("/match-stats")
def get_match_stats(role: str = Depends(verify_reviewer_access)):
    return nmc_repo.get_match_stats()


@router.get("/full")
def get_full_analytics(role: str = Depends(verify_reviewer_access)):
    """
    Single comprehensive analytics endpoint.
    Returns all data needed for the Analytics dashboard.
    All values are real database aggregations.
    """
    with nmc_repo.get_session() as s:

        # ── CPSEs ──────────────────────────────────────────────────────
        cpse_rows = s.execute(select(CPSE)).scalars().all()
        total_cpses = len(cpse_rows)
        active_cpses = sum(1 for c in cpse_rows if c.status == "ACTIVE")
        cpse_lookup = {c.id: c.code for c in cpse_rows}

        # ── Datasets ───────────────────────────────────────────────────
        total_datasets = s.execute(select(func.count(Dataset.id))).scalar() or 0
        ds_status_rows = s.execute(
            select(Dataset.status, func.count()).group_by(Dataset.status)
        ).all()
        ds_by_status = {r[0]: r[1] for r in ds_status_rows}

        # ── Materials ──────────────────────────────────────────────────
        total_materials = s.execute(select(func.count(Material.id))).scalar() or 0
        normalized_materials = s.execute(
            select(func.count(Material.id))
            .where(Material.processing_status == "NORMALIZED")
        ).scalar() or 0
        with_attrs = s.execute(
            select(func.count(Material.id))
            .where(Material.attributes.isnot(None))
        ).scalar() or 0

        # Mapping status counts
        map_rows = s.execute(
            select(Material.mapping_status, func.count()).group_by(Material.mapping_status)
        ).all()
        map_by_status = {r[0]: r[1] for r in map_rows}
        mapped_materials = map_by_status.get("MAPPED", 0)
        different_materials = map_by_status.get("DIFFERENT", 0)

        # Per-CPSE material counts
        cpse_mat_rows = s.execute(
            select(Material.cpse_id, func.count()).group_by(Material.cpse_id)
        ).all()
        cpse_mat_dist = [
            {"cpse_code": cpse_lookup.get(r[0], r[0]), "material_count": r[1]}
            for r in cpse_mat_rows
        ]

        # Material type distribution (top 15)
        type_rows = s.execute(
            select(Material.material_type, func.count())
            .where(Material.material_type.isnot(None))
            .group_by(Material.material_type)
            .order_by(func.count().desc())
            .limit(15)
        ).all()
        material_type_dist = [{"type": r[0], "count": r[1]} for r in type_rows]

        # Material family distribution
        family_rows = s.execute(
            select(Material.material_family, func.count())
            .where(Material.material_family.isnot(None))
            .group_by(Material.material_family)
            .order_by(func.count().desc())
            .limit(10)
        ).all()
        material_family_dist = [{"family": r[0], "count": r[1]} for r in family_rows]

        # ── Matches ────────────────────────────────────────────────────
        total_matches = s.execute(select(func.count(MaterialMatch.id))).scalar() or 0
        match_status_rows = s.execute(
            select(MaterialMatch.status, func.count()).group_by(MaterialMatch.status)
        ).all()
        match_by_status = {r[0]: r[1] for r in match_status_rows}

        match_cat_rows = s.execute(
            select(MaterialMatch.match_category, func.count()).group_by(MaterialMatch.match_category)
        ).all()
        match_by_category = {r[0]: r[1] for r in match_cat_rows}

        # Confidence distribution (only non-null)
        def _conf_count(lo, hi=None):
            if hi is None:
                return s.execute(
                    select(func.count(MaterialMatch.id))
                    .where(MaterialMatch.final_confidence < lo)
                ).scalar() or 0
            return s.execute(
                select(func.count(MaterialMatch.id))
                .where(and_(MaterialMatch.final_confidence >= lo, MaterialMatch.final_confidence < hi))
            ).scalar() or 0

        conf_90_100 = _conf_count(0.90, 1.01)
        conf_80_89  = _conf_count(0.80, 0.90)
        conf_70_79  = _conf_count(0.70, 0.80)
        conf_60_69  = _conf_count(0.60, 0.70)
        conf_below60 = _conf_count(0.60)

        avg_conf = s.execute(
            select(func.avg(MaterialMatch.final_confidence))
            .where(MaterialMatch.final_confidence.isnot(None))
        ).scalar()
        avg_semantic = s.execute(
            select(func.avg(MaterialMatch.semantic_similarity))
            .where(MaterialMatch.semantic_similarity.isnot(None))
        ).scalar()
        avg_text = s.execute(
            select(func.avg(MaterialMatch.text_similarity))
            .where(MaterialMatch.text_similarity.isnot(None))
        ).scalar()
        avg_attr = s.execute(
            select(func.avg(MaterialMatch.attribute_similarity))
            .where(MaterialMatch.attribute_similarity.isnot(None))
        ).scalar()

        # Cross-CPSE pair relationships
        pair_rows = s.execute(text("""
            SELECT c1.code, c2.code, COUNT(*) as match_count,
                   AVG(mm.final_confidence) as avg_conf
            FROM material_matches mm
            JOIN materials src  ON src.id  = mm.source_material_id
            JOIN materials cand ON cand.id = mm.candidate_material_id
            JOIN cpsEs c1 ON c1.id = src.cpse_id
            JOIN cpsEs c2 ON c2.id = cand.cpse_id
            WHERE src.cpse_id != cand.cpse_id
            GROUP BY c1.code, c2.code
            ORDER BY match_count DESC
        """)).all()
        cpse_pairs = [
            {
                "source_cpse": r[0],
                "target_cpse": r[1],
                "match_count": r[2],
                "avg_confidence": round(r[3] * 100, 1) if r[3] else None,
            }
            for r in pair_rows
        ]

        # ── ReviewDecisions ────────────────────────────────────────────
        total_decisions = s.execute(select(func.count(ReviewDecision.id))).scalar() or 0
        rd_rows = s.execute(
            select(ReviewDecision.decision, func.count()).group_by(ReviewDecision.decision)
        ).all()
        decisions_by_type = {r[0]: r[1] for r in rd_rows}

        # Review trend (daily)
        trend_rows = s.execute(text("""
            SELECT date(timestamp) as day, COUNT(*) as count
            FROM review_decisions
            GROUP BY day
            ORDER BY day
        """)).all()
        review_trend = [{"date": str(r[0]), "decisions": r[1]} for r in trend_rows]

        # Total reviewable = pending + decided
        total_reviewable = (
            match_by_status.get("PENDING_REVIEW", 0)
            + match_by_status.get("ACCEPTED", 0)
            + match_by_status.get("REJECTED", 0)
            + match_by_status.get("DIFFERENT", 0)
            + match_by_status.get("OVERRIDDEN", 0)
        )
        potentially_same = match_by_category.get("POTENTIALLY_SAME", 0)
        review_completion_pct = (
            round((total_decisions / potentially_same) * 100, 1)
            if potentially_same > 0 else 0
        )

        # ── CMM / NMC ─────────────────────────────────────────────────
        total_cmm = s.execute(
            select(func.count(NMCCommonMaterial.id))
            .where(NMCCommonMaterial.status == "ACTIVE")
        ).scalar() or 0
        total_mappings = s.execute(
            select(func.count(MaterialMapping.id))
        ).scalar() or 0

        # CMM by number of source CPSEs
        cmm_rows = s.execute(select(NMCCommonMaterial)).scalars().all()
        cpse_count_dist: dict = {}
        for cmm in cmm_rows:
            n = len(cmm.source_cpses) if cmm.source_cpses else 0
            cpse_count_dist[str(n)] = cpse_count_dist.get(str(n), 0) + 1

        # Top shared CMMs (all, sorted by number of source CPSEs descending)
        sorted_cmm_rows = sorted(cmm_rows, key=lambda x: len(x.source_cpses or []), reverse=True)
        shared_cmms = [
            {
                "nmc_code": c.national_material_code,
                "description": c.canonical_description[:80] if c.canonical_description else "",
                "material_family": c.material_family,
                "source_cpses": c.source_cpses,
                "cpse_count": len(c.source_cpses) if c.source_cpses else 0,
            }
            for c in sorted_cmm_rows
            if c.source_cpses and len(c.source_cpses) >= 1
        ][:20]

        # Average CPSEs per CMM
        avg_cpses_per_cmm = (
            round(sum(len(c.source_cpses or []) for c in cmm_rows) / len(cmm_rows), 1)
            if cmm_rows else 0
        )
        multi_cpse_cmm_count = sum(1 for c in cmm_rows if len(c.source_cpses or []) >= 2)

        # ── Audit events ──────────────────────────────────────────────
        audit_total = s.execute(select(func.count(AuditLog.id))).scalar() or 0
        audit_rows = s.execute(
            select(AuditLog.action, func.count()).group_by(AuditLog.action)
        ).all()
        audit_by_action = {r[0]: r[1] for r in audit_rows}

        # ── Pipeline stages ───────────────────────────────────────────
        pipeline = [
            {"stage": "Datasets Uploaded",     "count": total_datasets,                      "color": "#6366f1"},
            {"stage": "Validated",             "count": ds_by_status.get("VALIDATED", 0)
                                                      + ds_by_status.get("NORMALIZED", 0)
                                                      + ds_by_status.get("READY", 0),        "color": "#8b5cf6"},
            {"stage": "Materials Normalized",  "count": normalized_materials,                "color": "#3b82f6"},
            {"stage": "Attributes Extracted",  "count": with_attrs,                          "color": "#06b6d4"},
            {"stage": "AI Matched (pairs)",    "count": total_matches,                        "color": "#f59e0b"},
            {"stage": "Reviewed",              "count": total_decisions,                      "color": "#10b981"},
            {"stage": "Mapped to NMC",         "count": mapped_materials,                     "color": "#22c55e"},
        ]

        return {
            # Top-level counts
            "total_cpses": total_cpses,
            "active_cpses": active_cpses,
            "total_datasets": total_datasets,
            "total_materials": total_materials,
            "normalized_materials": normalized_materials,
            "mapped_materials": mapped_materials,
            "different_materials": different_materials,
            "materials_with_attributes": with_attrs,
            "total_matches": total_matches,
            "total_cmm": total_cmm,
            "total_mappings": total_mappings,
            "total_review_decisions": total_decisions,

            # Distributions
            "dataset_by_status": ds_by_status,
            "match_by_status": match_by_status,
            "match_by_category": match_by_category,
            "decisions_by_type": decisions_by_type,

            # Confidence
            "confidence_distribution": [
                {"range": "90–100%", "count": conf_90_100},
                {"range": "80–89%",  "count": conf_80_89},
                {"range": "70–79%",  "count": conf_70_79},
                {"range": "60–69%",  "count": conf_60_69},
                {"range": "< 60%",   "count": conf_below60},
            ],
            "avg_final_confidence":    round((avg_conf or 0) * 100, 1),
            "avg_semantic_similarity": round((avg_semantic or 0) * 100, 1),
            "avg_text_similarity":     round((avg_text or 0) * 100, 1),
            "avg_attribute_similarity":round((avg_attr or 0) * 100, 1),

            # Cross-CPSE
            "cpse_pairs": cpse_pairs,
            "cpse_material_distribution": cpse_mat_dist,

            # Review
            "review_completion_pct": review_completion_pct,
            "review_trend": review_trend,

            # CMM
            "cmm_by_cpse_count": [
                {"cpse_count": int(k), "cmm_count": v}
                for k, v in sorted(cpse_count_dist.items())
            ],
            "shared_cmms": shared_cmms,
            "avg_cpses_per_cmm": avg_cpses_per_cmm,
            "multi_cpse_cmm_count": multi_cpse_cmm_count,

            # Material types
            "material_type_distribution": material_type_dist,
            "material_family_distribution": material_family_dist,

            # Pipeline
            "pipeline_stages": pipeline,

            # Audit
            "audit_total": audit_total,
            "audit_by_action": audit_by_action,
        }
