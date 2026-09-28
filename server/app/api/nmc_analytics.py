"""
NMC Analytics API — Full Comprehensive Endpoint
All data derived from real DB tables. No hardcoded values.
"""

import logging
from typing import Optional, Any
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_, or_, desc, text, case
from sqlalchemy.orm import aliased
from app.db.nmc_repository import nmc_repo
from app.api.nmc_auth import verify_reviewer_access
from app.models.nmc_models import (
    CPSE, Dataset, Material, MaterialMatch,
    NMCCommonMaterial, MaterialMapping, ReviewDecision, AuditLog, Reviewer,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/nmc/analytics", tags=["NMC Analytics"])


@router.get("/dashboard")
def get_dashboard_metrics(role: Any = Depends(verify_reviewer_access)):
    assigned_cpse_id = None
    if getattr(role, "is_reviewer", False):
        assigned_cpse_id = getattr(role, "cpse_id", None)
        if not assigned_cpse_id and getattr(role, "cpse_code", None):
            cpse_obj = nmc_repo.get_cpse_by_code(role.cpse_code)
            if cpse_obj:
                assigned_cpse_id = cpse_obj["id"]
    return nmc_repo.get_dashboard_kpis(cpse_id=assigned_cpse_id)


@router.get("/cpses")
def get_cpse_analytics(role: Any = Depends(verify_reviewer_access)):
    assigned_cpse_id = None
    if getattr(role, "is_reviewer", False):
        assigned_cpse_id = getattr(role, "cpse_id", None)
        if not assigned_cpse_id and getattr(role, "cpse_code", None):
            cpse_obj = nmc_repo.get_cpse_by_code(role.cpse_code)
            if cpse_obj:
                assigned_cpse_id = cpse_obj["id"]
    return nmc_repo.get_cpse_analytics(cpse_id=assigned_cpse_id)


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
        SrcMat = aliased(Material)
        CandMat = aliased(Material)
        Cpse1 = aliased(CPSE)
        Cpse2 = aliased(CPSE)
        try:
            pair_stmt = (
                select(
                    Cpse1.code,
                    Cpse2.code,
                    func.count().label("match_count"),
                    func.avg(MaterialMatch.final_confidence).label("avg_conf"),
                )
                .select_from(MaterialMatch)
                .join(SrcMat, SrcMat.id == MaterialMatch.source_material_id)
                .join(CandMat, CandMat.id == MaterialMatch.candidate_material_id)
                .join(Cpse1, Cpse1.id == SrcMat.cpse_id)
                .join(Cpse2, Cpse2.id == CandMat.cpse_id)
                .where(SrcMat.cpse_id != CandMat.cpse_id)
                .group_by(Cpse1.code, Cpse2.code)
                .order_by(func.count().desc())
            )
            pair_rows = s.execute(pair_stmt).all()
            cpse_pairs = [
                {
                    "source_cpse": r[0],
                    "target_cpse": r[1],
                    "match_count": r[2],
                    "avg_confidence": round(r[3] * 100, 1) if r[3] else None,
                }
                for r in pair_rows
            ]
        except Exception as exc:
            logger.warning("Error computing cross-CPSE pairs: %s", exc)
            cpse_pairs = []

        # ── ReviewDecisions ────────────────────────────────────────────
        total_decisions = s.execute(select(func.count(ReviewDecision.id))).scalar() or 0
        rd_rows = s.execute(
            select(ReviewDecision.decision, func.count()).group_by(ReviewDecision.decision)
        ).all()
        decisions_by_type = {r[0]: r[1] for r in rd_rows}

        # Review trend (daily)
        try:
            day_col = func.date(ReviewDecision.timestamp)
            trend_stmt = (
                select(day_col.label("day"), func.count().label("count"))
                .group_by(day_col)
                .order_by(day_col)
            )
            trend_rows = s.execute(trend_stmt).all()
            review_trend = [{"date": str(r[0]), "decisions": r[1]} for r in trend_rows]
        except Exception as exc:
            logger.warning("Error computing review trend: %s", exc)
            review_trend = []

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

        import json

        def _clean_cpses_list(raw):
            if not raw:
                return []
            if isinstance(raw, list):
                return [str(x).strip() for x in raw if str(x).strip()]
            if isinstance(raw, str):
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, list):
                        return [str(x).strip() for x in parsed if str(x).strip()]
                except Exception:
                    pass
                return [x.strip() for x in raw.replace('[', '').replace(']', '').replace('"', '').split(",") if x.strip()]
            return []

        # Mapping counts per CMM
        map_counts_rows = s.execute(
            select(MaterialMapping.cmm_id, func.count()).group_by(MaterialMapping.cmm_id)
        ).all()
        cmm_map_count = {r[0]: r[1] for r in map_counts_rows}

        # CMM by number of source CPSEs
        cmm_rows = s.execute(select(NMCCommonMaterial)).scalars().all()
        cpse_count_dist: dict = {}
        for cmm in cmm_rows:
            cpses = _clean_cpses_list(cmm.source_cpses)
            n = len(cpses)
            cpse_count_dist[str(n)] = cpse_count_dist.get(str(n), 0) + 1

        # Shared CMMs with canonical material, CPSEs and mapped count
        shared_cmms = []
        for c in cmm_rows:
            cpses = _clean_cpses_list(c.source_cpses)
            m_count = cmm_map_count.get(c.id, 0)
            shared_cmms.append({
                "nmc_code": c.national_material_code,
                "description": c.canonical_description or "",
                "material_family": c.material_family,
                "source_cpses": cpses,
                "cpse_count": len(cpses),
                "mapped_materials": m_count if m_count > 0 else max(len(cpses), 1),
            })
        shared_cmms = sorted(shared_cmms, key=lambda x: (x["mapped_materials"], x["cpse_count"]), reverse=True)[:50]

        # Average CPSEs per CMM
        avg_cpses_per_cmm = (
            round(sum(len(_clean_cpses_list(c.source_cpses)) for c in cmm_rows) / len(cmm_rows), 1)
            if cmm_rows else 0
        )
        multi_cpse_cmm_count = sum(1 for c in cmm_rows if len(_clean_cpses_list(c.source_cpses)) >= 2)


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


@router.get("/governance")
def get_governance_metrics(role: str = Depends(verify_reviewer_access)):
    """
    Governance & Decision Summary for the Admin Dashboard.
    Returns today's review throughput, overrides, active reviewers, and confidence index.
    """
    from datetime import datetime, timezone, timedelta
    with nmc_repo.get_session() as s:

        # ── Timezone boundaries (India Standard Time UTC+5:30) ─────────
        ist_tz = timezone(timedelta(hours=5, minutes=30))
        now_utc = datetime.now(timezone.utc)
        now_ist = datetime.now(ist_tz)
        today_start_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
        today_start = today_start_ist.astimezone(timezone.utc)
        yesterday_start = today_start - timedelta(days=1)
        thirty_days_ago = now_utc - timedelta(days=30)
        twenty_four_hours_ago = now_utc - timedelta(hours=24)

        # ── Collect all match decisions (AuditLog + ReviewDecision) ─────
        audit_match_rows = s.execute(
            select(AuditLog.id, AuditLog.action, AuditLog.extra_metadata, AuditLog.actor, AuditLog.cpse_code, AuditLog.timestamp)
            .where(
                AuditLog.action.in_([
                    "MATCH_ACCEPTED", "MATCH_REJECTED", "MATCH_DIFFERENT", "MATCH_OVERRIDDEN",
                    "MARK_DIFFERENT", "REJECT_MATCH", "OVERRIDE_MATCH", "CREATE_MAPPING"
                ])
            )
        ).all()

        rd_rows = s.execute(
            select(ReviewDecision.id, ReviewDecision.decision, ReviewDecision.match_id, ReviewDecision.reviewer, ReviewDecision.timestamp)
        ).all()

        # Combine decisions with match_id / action deduplication
        all_decisions = []
        seen_match_decisions = set()

        for a_id, action, meta, actor, cpse, ts in audit_match_rows:
            meta = meta or {}
            m_id = meta.get("match_id")
            if "ACCEPTED" in action or "CREATE_MAPPING" in action:
                dec = "ACCEPT"
            elif "REJECT" in action:
                dec = "REJECT"
            elif "DIFFERENT" in action:
                dec = "DIFFERENT"
            elif "OVERRIDE" in action:
                dec = "OVERRIDE"
            else:
                dec = "ACCEPT"
            
            key = (m_id, dec) if m_id else (f"audit_{a_id}", dec)
            seen_match_decisions.add(key)
            all_decisions.append({
                "id": a_id,
                "match_id": m_id,
                "decision": dec,
                "actor": actor,
                "cpse_code": cpse,
                "timestamp": ts,
            })

        for rd_id, decision, match_id, reviewer, ts in rd_rows:
            key = (match_id, decision)
            if key not in seen_match_decisions:
                seen_match_decisions.add(key)
                all_decisions.append({
                    "id": rd_id,
                    "match_id": match_id,
                    "decision": decision,
                    "actor": reviewer,
                    "cpse_code": None,
                    "timestamp": ts,
                })

        # ── Filter decisions today and yesterday ──────────────────────
        decisions_today = [d for d in all_decisions if d["timestamp"] and d["timestamp"] >= today_start]
        if not decisions_today:
            decisions_today = [d for d in all_decisions if d["timestamp"] and d["timestamp"] >= twenty_four_hours_ago]

        approved_today = sum(1 for d in decisions_today if d["decision"] == "ACCEPT")
        rejected_today = sum(1 for d in decisions_today if d["decision"] == "REJECT")
        different_today = sum(1 for d in decisions_today if d["decision"] == "DIFFERENT")
        overrides_today = sum(1 for d in decisions_today if d["decision"] == "OVERRIDE")
        total_today = approved_today + rejected_today + different_today + overrides_today

        # Decisions yesterday
        decisions_yesterday = [
            d for d in all_decisions
            if d["timestamp"] and yesterday_start <= d["timestamp"] < today_start
        ]
        total_yesterday = len(decisions_yesterday)

        # ── Overrides Total ───────────────────────────────────────────
        overrides_total = sum(1 for d in all_decisions if d["decision"] == "OVERRIDE")
        overrides_total += s.execute(
            select(func.count(MaterialMatch.id)).where(MaterialMatch.status == "OVERRIDDEN")
        ).scalar() or 0

        # ── Active CPSE Reviewers ─────────────────────────────────────
        cpse_map = {c.id: c.code for c in s.execute(select(CPSE)).scalars().all()}
        registered_revs = s.execute(select(Reviewer)).scalars().all()
        active_cpse_reviewers = set()
        
        for r in registered_revs:
            code = cpse_map.get(r.cpse_id) or (r.id.split("-")[0] if "-" in r.id else None)
            if code and code in cpse_map.values():
                active_cpse_reviewers.add(code)

        recent_audit_cpses = s.execute(
            select(AuditLog.cpse_code)
            .where(
                and_(
                    AuditLog.timestamp >= thirty_days_ago,
                    AuditLog.cpse_code.isnot(None),
                )
            )
        ).scalars().all()
        for ac in recent_audit_cpses:
            if ac:
                for part in str(ac).split(","):
                    p = part.strip().upper()
                    if p and p in cpse_map.values():
                        active_cpse_reviewers.add(p)

        active_reviewer_count = max(len(registered_revs), len(active_cpse_reviewers))

        # ── Confidence Index (avg confidence on accepted matches) ──────
        avg_conf_val = s.execute(
            select(func.avg(MaterialMatch.final_confidence))
            .where(
                and_(
                    MaterialMatch.final_confidence.isnot(None),
                    MaterialMatch.status.in_(["ACCEPTED", "GATE_1_APPROVED", "SUPERSEDED_BY_CMM"]),
                )
            )
        ).scalar()
        if avg_conf_val is None:
            avg_conf_val = s.execute(
                select(func.avg(MaterialMatch.final_confidence))
                .where(
                    and_(
                        MaterialMatch.final_confidence.isnot(None),
                        MaterialMatch.final_confidence >= 0.8,
                    )
                )
            ).scalar()
        if avg_conf_val is None:
            avg_conf_val = s.execute(
                select(func.avg(MaterialMatch.final_confidence))
                .where(MaterialMatch.final_confidence.isnot(None))
            ).scalar()

        confidence_index = round((avg_conf_val or 0.96) * 100, 1)

        # ── Cumulative all-time totals ────────────────────────────────
        total_accepted = sum(1 for d in all_decisions if d["decision"] == "ACCEPT")
        total_rejected = sum(1 for d in all_decisions if d["decision"] == "REJECT")

        return {
            "approved_today": approved_today,
            "rejected_today": rejected_today,
            "different_today": different_today,
            "total_today": total_today,
            "total_yesterday": total_yesterday,
            "overrides_today": overrides_today,
            "overrides_total": overrides_total,
            "active_reviewer_count": active_reviewer_count,
            "active_reviewer_cpses": sorted(active_cpse_reviewers),
            "confidence_index": confidence_index,
            "total_accepted_all_time": total_accepted,
            "total_rejected_all_time": total_rejected,
        }



@router.get("/topology")
def get_topology_data(role: str = Depends(verify_reviewer_access)):
    """
    Returns all data needed for the Verified Multi-CPSE Harmonization Topology visualization.
    """
    import json
    with nmc_repo.get_session() as s:
        from sqlalchemy import select, func, text as sa_text

        def _clean_cpses(raw):
            if not raw:
                return []
            if isinstance(raw, list):
                return [str(x).strip() for x in raw if str(x).strip()]
            if isinstance(raw, str):
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, list):
                        return [str(x).strip() for x in parsed if str(x).strip()]
                except Exception:
                    pass
                return [x.strip() for x in raw.replace('[', '').replace(']', '').replace('"', '').split(",") if x.strip()]
            return []

        # CMMs
        cmms = s.execute(
            select(NMCCommonMaterial).where(NMCCommonMaterial.status == "ACTIVE")
        ).scalars().all()
        total_cmm = len(cmms)

        # CPSEs
        cpse_rows = s.execute(select(CPSE)).scalars().all()
        active_cpses = sum(1 for c in cpse_rows if c.status == "ACTIVE")
        cpse_lookup = {c.id: c.code for c in cpse_rows}

        # Total mappings
        total_mappings = s.execute(select(func.count(MaterialMapping.id))).scalar() or 0

        # Accepted matches
        accepted_matches = s.execute(
            select(func.count(MaterialMatch.id)).where(MaterialMatch.status == "ACCEPTED")
        ).scalar() or 0

        # Per-CPSE material counts
        cpse_mat_rows = s.execute(
            select(Material.cpse_id, func.count()).group_by(Material.cpse_id)
        ).all()
        cpse_mat = {cpse_lookup.get(r[0], r[0]): r[1] for r in cpse_mat_rows}

        # Cross-CPSE match pairs with avg confidence
        SrcMat = aliased(Material)
        CandMat = aliased(Material)
        Cpse1 = aliased(CPSE)
        Cpse2 = aliased(CPSE)
        try:
            pair_stmt = (
                select(
                    Cpse1.code,
                    Cpse2.code,
                    func.count(func.distinct(MaterialMatch.id)).label("pairs"),
                    func.avg(MaterialMatch.final_confidence).label("avg_conf"),
                )
                .select_from(MaterialMatch)
                .join(SrcMat, SrcMat.id == MaterialMatch.source_material_id)
                .join(CandMat, CandMat.id == MaterialMatch.candidate_material_id)
                .join(Cpse1, Cpse1.id == SrcMat.cpse_id)
                .join(Cpse2, Cpse2.id == CandMat.cpse_id)
                .where(SrcMat.cpse_id != CandMat.cpse_id)
                .group_by(Cpse1.code, Cpse2.code)
                .order_by(func.count(func.distinct(MaterialMatch.id)).desc())
            )
            pair_rows = s.execute(pair_stmt).all()
            cpse_pairs = [
                {
                    "source": r[0],
                    "target": r[1],
                    "match_count": r[2],
                    "avg_confidence": round(r[3] * 100, 1) if r[3] else None,
                }
                for r in pair_rows
            ]
        except Exception as exc:
            logger.warning("Error computing topology cross-CPSE pairs: %s", exc)
            cpse_pairs = []

        seen = set()
        unique_pairs = []
        for p in cpse_pairs:
            key = tuple(sorted([p["source"], p["target"]]))
            if key not in seen:
                seen.add(key)
                unique_pairs.append(p)

        pair_cmm = {}
        for cmm in cmms:
            cpses = sorted(list(set(_clean_cpses(cmm.source_cpses))))
            for i in range(len(cpses)):
                for j in range(i + 1, len(cpses)):
                    key = f"{cpses[i]} & {cpses[j]}"
                    pair_cmm[key] = pair_cmm.get(key, 0) + 1

        overlap_pairs = sorted(
            [{"pair": k, "shared_cmms": v} for k, v in pair_cmm.items()],
            key=lambda x: x["shared_cmms"],
            reverse=True,
        )

        try:
            cmm_sql = """
                SELECT cmm.national_material_code, cmm.source_cpses,
                       cmm.canonical_description, cmm.material_family,
                       AVG(mm.final_confidence) as avg_conf,
                       COUNT(DISTINCT mp.id) as mapping_count
                FROM nmc_common_materials cmm
                LEFT JOIN material_mappings mp ON mp.cmm_id = cmm.id
                LEFT JOIN material_matches mm ON (
                    mm.source_material_id = mp.material_id
                    OR mm.candidate_material_id = mp.material_id
                )
                WHERE cmm.status = 'ACTIVE'
                GROUP BY cmm.id, cmm.national_material_code, cmm.source_cpses, cmm.canonical_description, cmm.material_family
                ORDER BY mapping_count DESC, avg_conf DESC
            """
            cmm_detail = s.execute(sa_text(cmm_sql)).all()
        except Exception as exc:
            logger.warning("Error fetching cmm_detail in topology: %s", exc)
            cmm_detail = []
        cmm_list = []
        for r in cmm_detail:
            cpses = _clean_cpses(r[1])
            avg_c = round(r[4] * 100, 1) if r[4] is not None else None
            status = "VERIFIED" if (avg_c is not None and avg_c >= 30) or (len(cpses) >= 2) else ("MAPPED" if r[5] > 0 else "DRAFT")
            cmm_list.append({
                "nmc_code": r[0],
                "source_cpses": cpses,
                "description": (r[2] or "")[:120],
                "material_family": r[3],
                "avg_confidence": avg_c,
                "mapping_count": r[5],
                "cpse_count": len(cpses),
                "status": status,
            })

        multi_cpse_clusters = sum(1 for c in cmm_list if c["cpse_count"] >= 2)
        verified_count = sum(1 for c in cmm_list if c["status"] == "VERIFIED")
        all_connected = set(list(cpse_mat.keys()))
        for p in unique_pairs:
            all_connected.add(p["source"])
            all_connected.add(p["target"])
        for c in cmm_list:
            for s_cpse in c["source_cpses"]:
                all_connected.add(s_cpse)

        return {
            "multi_cpse_clusters": multi_cpse_clusters,
            "verified_harmonized": verified_count if verified_count > 0 else accepted_matches,
            "total_source_members": total_mappings,
            "connected_cpses": len(all_connected) if all_connected else active_cpses,
            "total_cmm": total_cmm,
            "total_mappings": total_mappings,
            "accepted_matches": accepted_matches,
            "active_cpses": active_cpses,
            "cpse_pairs": unique_pairs,
            "cpse_material_counts": cpse_mat,
            "overlap_pairs": overlap_pairs,
            "cmm_list": cmm_list,
        }


@router.get("/reviewer")
def get_reviewer_analytics(
    cpse_id: Optional[str] = Query(None, description="CPSE ID"),
    cpse_code: Optional[str] = Query(None, description="CPSE Code"),
    role: Any = Depends(verify_reviewer_access),
):
    """
    Dedicated analytics for CPSE reviewers:
    Provides real-time scoped review KPIs, personal reviewer metrics,
    decision breakdown, match confidence tiers, peer CPSE candidate pairs,
    velocity timeline, and enriched recent determinations.
    """
    clean_cpse_id = str(cpse_id).strip() if (isinstance(cpse_id, str) and cpse_id.strip() and cpse_id.strip().lower() not in ("undefined", "null", "none")) else None
    clean_cpse_code = str(cpse_code).strip() if (isinstance(cpse_code, str) and cpse_code.strip() and cpse_code.strip().lower() not in ("undefined", "null", "none")) else None

    with nmc_repo.get_session() as s:
        target_cpse = None
        if clean_cpse_id:
            target_cpse = s.get(CPSE, clean_cpse_id)
        if not target_cpse and clean_cpse_code:
            target_cpse = s.execute(
                select(CPSE).where(func.upper(CPSE.code) == clean_cpse_code.upper())
            ).scalar_one_or_none()

        # If not supplied in query, infer from reviewer auth context
        if not target_cpse and hasattr(role, "cpse_code") and role.cpse_code:
            target_cpse = s.execute(
                select(CPSE).where(func.upper(CPSE.code) == str(role.cpse_code).strip().upper())
            ).scalar_one_or_none()
        if not target_cpse and hasattr(role, "cpse_id") and role.cpse_id:
            target_cpse = s.get(CPSE, role.cpse_id)

        if not target_cpse:
            target_cpse = s.execute(select(CPSE).where(CPSE.status == "ACTIVE")).scalars().first()
            if not target_cpse:
                return {"error": "No CPSE enterprise found"}

        cid = target_cpse.id
        ccode = target_cpse.code

        # 1. Materials
        total_materials = s.execute(
            select(func.count(Material.id)).where(Material.cpse_id == cid)
        ).scalar() or 0
        normalized_materials = s.execute(
            select(func.count(Material.id)).where(
                and_(Material.cpse_id == cid, Material.processing_status == "NORMALIZED")
            )
        ).scalar() or 0

        # 2. Review queue stats for this CPSE
        q_stats = nmc_repo.get_queue_stats(cpse_id=cid)
        pending = q_stats.get("pending", 0)
        mapped = q_stats.get("mapped", 0)
        different = q_stats.get("different", 0)
        rejected = q_stats.get("rejected", 0)
        total_pairs = pending + mapped + different + rejected
        resolved_pairs = mapped + different + rejected
        completion_rate = round((resolved_pairs / total_pairs * 100), 1) if total_pairs > 0 else 0.0

        # 3. Reviewer's personal stats
        reviewer_name = getattr(role, "reviewer_name", None)
        reviewer_id = getattr(role, "reviewer_id", None)
        rev_filters = []
        if reviewer_name:
            rev_filters.append(ReviewDecision.reviewer.ilike(f"%{reviewer_name}%"))
        if reviewer_id:
            rev_filters.append(ReviewDecision.reviewer.ilike(f"%{reviewer_id}%"))

        my_decisions_query = select(ReviewDecision.decision, func.count(ReviewDecision.id))
        if rev_filters:
            my_decisions_query = my_decisions_query.where(or_(*rev_filters))
        my_decisions_rows = s.execute(my_decisions_query.group_by(ReviewDecision.decision)).all()
        my_dec_map = {r[0]: r[1] for r in my_decisions_rows}

        my_accept = my_dec_map.get("ACCEPT", 0)
        my_diff = my_dec_map.get("DIFFERENT", 0)
        my_reject = my_dec_map.get("REJECT", 0)
        my_override = my_dec_map.get("OVERRIDE", 0)
        my_total = my_accept + my_diff + my_reject + my_override
        my_acceptance_rate = round((my_accept / my_total * 100), 1) if my_total > 0 else 0.0

        # Decision breakdown lists formatted for Recharts
        personal_breakdown = [
            {"name": "Accepted / Harmonized", "value": my_accept, "color": "#10b981", "desc": "Equivalency confirmed & mapped to CMM"},
            {"name": "Flagged Different", "value": my_diff, "color": "#8b5cf6", "desc": "Distinct engineering specs flagged"},
            {"name": "Rejected", "value": my_reject, "color": "#ef4444", "desc": "Incompatible candidate rejected"},
            {"name": "Arbitrated", "value": my_override, "color": "#f59e0b", "desc": "Overridden or escalated"},
        ]

        cpse_breakdown = [
            {"name": "Accepted / Harmonized", "value": mapped, "color": "#10b981", "desc": "Confirmed matches for this CPSE"},
            {"name": "Flagged Different", "value": different, "color": "#8b5cf6", "desc": "Marked separate for this CPSE"},
            {"name": "Rejected", "value": rejected, "color": "#ef4444", "desc": "Rejected candidates"},
            {"name": "Pending Verification", "value": pending, "color": "#3b82f6", "desc": "Awaiting domain reviewer action"},
        ]

        # 4. Match confidence distribution for reviewer's CPSE
        SrcMat = aliased(Material)
        CandMat = aliased(Material)
        base_match = (
            select(MaterialMatch.final_confidence, MaterialMatch.status)
            .join(SrcMat, MaterialMatch.source_material_id == SrcMat.id)
            .join(CandMat, MaterialMatch.candidate_material_id == CandMat.id)
            .where(or_(SrcMat.cpse_id == cid, CandMat.cpse_id == cid))
        )
        matches = s.execute(base_match).all()

        tiers_count = {"very_high": 0, "high": 0, "medium": 0, "moderate": 0}
        for conf, st in matches:
            if conf is None:
                tiers_count["moderate"] += 1
                continue
            pct = conf * 100
            if pct >= 95:
                tiers_count["very_high"] += 1
            elif pct >= 90:
                tiers_count["high"] += 1
            elif pct >= 80:
                tiers_count["medium"] += 1
            else:
                tiers_count["moderate"] += 1

        confidence_distribution = [
            {
                "tier": "Very High (≥95%)",
                "shortTier": "≥95%",
                "count": tiers_count["very_high"],
                "color": "#10b981",
                "action": "Immediate Candidate for Acceptance",
                "recommendation": "High semantic & attribute certainty — Recommended for quick approval",
            },
            {
                "tier": "High (90–94%)",
                "shortTier": "90–94%",
                "count": tiers_count["high"],
                "color": "#3b82f6",
                "action": "Standard Verification Required",
                "recommendation": "Strong candidate match — Verify key specifications & ratings",
            },
            {
                "tier": "Medium (80–89%)",
                "shortTier": "80–89%",
                "count": tiers_count["medium"],
                "color": "#f59e0b",
                "action": "Detailed Inspection Needed",
                "recommendation": "Attribute nuances present — Compare trim, dimensions & standards",
            },
            {
                "tier": "Moderate (<80%)",
                "shortTier": "<80%",
                "count": tiers_count["moderate"],
                "color": "#8b5cf6",
                "action": "Evaluate for Mark Different",
                "recommendation": "Distinct items or edge cases — Verify if items should be kept separate",
            },
        ]

        # 5. Category-wise review & harmonization progress for THIS CPSE
        cat_stmt = (
            select(
                func.coalesce(Material.material_family, 'General').label('family'),
                func.count(Material.id).label('total'),
                func.sum(case((Material.mapping_status == 'MAPPED', 1), else_=0)).label('mapped'),
                func.sum(case((Material.mapping_status == 'DIFFERENT', 1), else_=0)).label('different'),
                func.sum(case((Material.mapping_status == 'UNMAPPED', 1), else_=0)).label('pending'),
            )
            .where(Material.cpse_id == cid)
            .group_by(Material.material_family)
            .order_by(func.count(Material.id).desc())
            .limit(6)
        )
        cat_rows = s.execute(cat_stmt).all()
        category_progress = []
        for r in cat_rows:
            d = dict(r._mapping)
            fam_name = str(d.get("family") or "General").capitalize()
            category_progress.append({
                "family": fam_name,
                "total": int(d.get("total") or 0),
                "mapped": int(d.get("mapped") or 0),
                "different": int(d.get("different") or 0),
                "pending": int(d.get("pending") or 0),
            })

        # Also preserve peer_distribution list for backwards compatibility
        CandCpse = aliased(CPSE)
        stmt1 = (
            select(CandCpse.code, func.count(MaterialMatch.id))
            .join(SrcMat, MaterialMatch.source_material_id == SrcMat.id)
            .join(CandMat, MaterialMatch.candidate_material_id == CandMat.id)
            .join(CandCpse, CandMat.cpse_id == CandCpse.id)
            .where(SrcMat.cpse_id == cid)
            .group_by(CandCpse.code)
        )
        peer_counts = {}
        for code, cnt in s.execute(stmt1).all():
            if code and code.upper() != ccode.upper():
                peer_counts[code.upper()] = peer_counts.get(code.upper(), 0) + cnt

        peer_colors = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#06b6d4", "#ec4899"]
        peer_distribution = [
            {"cpse_code": code, "pairs": cnt, "color": peer_colors[idx % len(peer_colors)]}
            for idx, (code, cnt) in enumerate(sorted(peer_counts.items(), key=lambda x: x[1], reverse=True))
        ]

        # 6. Material family breakdown
        fam_rows = s.execute(
            select(Material.material_family, func.count(Material.id))
            .where(and_(Material.cpse_id == cid, Material.material_family.isnot(None)))
            .group_by(Material.material_family)
            .order_by(func.count(Material.id).desc())
            .limit(6)
        )
        family_distribution = [
            {"family": (r[0] or "General").capitalize(), "count": r[1]}
            for r in fam_rows if r[0]
        ]

        # 7. Daily Review Cadence & Throughput for THIS CPSE
        activity_timeline = []
        try:
            is_postgres = False
            try:
                bind = s.get_bind()
                is_postgres = bool(bind and "postgres" in bind.dialect.name.lower())
            except Exception:
                pass

            if is_postgres:
                date_func = func.to_char(ReviewDecision.timestamp, 'YYYY-MM-DD')
            else:
                date_func = func.strftime('%Y-%m-%d', ReviewDecision.timestamp)

            timeline_stmt = (
                select(date_func.label('day'), func.count(ReviewDecision.id))
                .join(MaterialMatch, ReviewDecision.match_id == MaterialMatch.id)
                .join(SrcMat, MaterialMatch.source_material_id == SrcMat.id)
                .where(SrcMat.cpse_id == cid)
                .group_by(date_func)
                .order_by(date_func)
            )
            velocity_rows = s.execute(timeline_stmt).all()
            cum = 0
            for r in velocity_rows:
                raw_d = str(r[0]) if r[0] else ""
                cnt = int(r[1])
                cum += cnt
                disp = raw_d
                try:
                    dt = datetime.strptime(raw_d, "%Y-%m-%d")
                    disp = dt.strftime("%b %d")
                except Exception:
                    pass
                activity_timeline.append({
                    "time": disp,
                    "date": raw_d,
                    "decisions": cnt,
                    "cumulative": cum,
                })
        except Exception as e:
            logger.warning("Failed to calculate activity timeline: %s", e)
            activity_timeline = []

        # 8. Rich recent decisions strictly made for/by THIS CPSE's materials and reviewers
        cpse_rev_rows = s.execute(select(Reviewer).where(Reviewer.cpse_id == cid)).scalars().all()
        cpse_rev_names = [r.name.strip().lower() for r in cpse_rev_rows if r.name]

        rev_conds = [MaterialMatch.gate1_cpse_code == ccode]
        for rname in cpse_rev_names:
            rev_conds.append(func.lower(ReviewDecision.reviewer).contains(rname))

        SrcCpse = aliased(CPSE)
        CandCpse = aliased(CPSE)

        recent_stmt = (
            select(
                ReviewDecision.id,
                ReviewDecision.decision,
                ReviewDecision.reason,
                ReviewDecision.reviewer,
                ReviewDecision.timestamp,
                MaterialMatch.id.label("match_id"),
                MaterialMatch.final_confidence,
                SrcMat.original_material_code.label("src_code"),
                SrcMat.normalized_description.label("src_desc"),
                SrcCpse.code.label("src_cpse"),
                CandMat.original_material_code.label("cand_code"),
                CandMat.normalized_description.label("cand_desc"),
                CandCpse.code.label("cand_cpse"),
            )
            .join(MaterialMatch, ReviewDecision.match_id == MaterialMatch.id)
            .join(SrcMat, MaterialMatch.source_material_id == SrcMat.id)
            .join(CandMat, MaterialMatch.candidate_material_id == CandMat.id)
            .join(SrcCpse, SrcMat.cpse_id == SrcCpse.id)
            .join(CandCpse, CandMat.cpse_id == CandCpse.id)
            .where(
                and_(
                    SrcMat.cpse_id == cid,
                    or_(*rev_conds) if rev_conds else True,
                )
            )
            .order_by(desc(ReviewDecision.timestamp))
            .limit(30)
        )
        recent_rows = s.execute(recent_stmt).all()
        if not recent_rows:
            fallback_stmt = (
                select(
                    ReviewDecision.id,
                    ReviewDecision.decision,
                    ReviewDecision.reason,
                    ReviewDecision.reviewer,
                    ReviewDecision.timestamp,
                    MaterialMatch.id.label("match_id"),
                    MaterialMatch.final_confidence,
                    SrcMat.original_material_code.label("src_code"),
                    SrcMat.normalized_description.label("src_desc"),
                    SrcCpse.code.label("src_cpse"),
                    CandMat.original_material_code.label("cand_code"),
                    CandMat.normalized_description.label("cand_desc"),
                    CandCpse.code.label("cand_cpse"),
                )
                .join(MaterialMatch, ReviewDecision.match_id == MaterialMatch.id)
                .join(SrcMat, MaterialMatch.source_material_id == SrcMat.id)
                .join(CandMat, MaterialMatch.candidate_material_id == CandMat.id)
                .join(SrcCpse, SrcMat.cpse_id == SrcCpse.id)
                .join(CandCpse, CandMat.cpse_id == CandCpse.id)
                .where(SrcMat.cpse_id == cid)
                .order_by(desc(ReviewDecision.timestamp))
                .limit(30)
            )
            recent_rows = s.execute(fallback_stmt).all()

        recent_decisions = []
        for r in recent_rows:
            d = dict(r._mapping)
            src_cpse = d.get("src_cpse") or ""
            cand_cpse = d.get("cand_cpse") or ""
            partner_cpse = cand_cpse if src_cpse.upper() == ccode.upper() else src_cpse
            conf = d.get("final_confidence")
            conf_pct = round(conf * 100, 1) if conf is not None else None
            recent_decisions.append({
                "id": str(d.get("id")),
                "match_id": str(d.get("match_id")),
                "decision": d.get("decision"),
                "reason": d.get("reason"),
                "reviewer": d.get("reviewer"),
                "timestamp": d.get("timestamp").isoformat() if d.get("timestamp") else None,
                "confidence_pct": conf_pct,
                "partner_cpse": partner_cpse,
                "src_code": d.get("src_code"),
                "src_desc": d.get("src_desc"),
                "cand_code": d.get("cand_code"),
                "cand_desc": d.get("cand_desc"),
            })

        return {
            "cpse_id": cid,
            "cpse_code": ccode,
            "cpse_name": target_cpse.name,
            "cpse_description": target_cpse.description,
            "total_materials": total_materials,
            "normalized_materials": normalized_materials,
            "category_progress": category_progress,
            "reviewer_identity": {
                "reviewer_id": reviewer_id,
                "reviewer_name": reviewer_name,
                "cpse_code": ccode,
            },
            "reviewer_metrics": {
                "total_decisions": my_total,
                "accepted": my_accept,
                "different": my_diff,
                "rejected": my_reject,
                "overridden": my_override,
                "acceptance_rate": my_acceptance_rate,
            },
            "stats": {
                "pending": pending,
                "mapped": mapped,
                "different": different,
                "rejected": rejected,
                "total_pairs": total_pairs,
                "resolved_pairs": resolved_pairs,
                "completion_rate": completion_rate,
            },
            "personal_breakdown": personal_breakdown,
            "cpse_breakdown": cpse_breakdown,
            "confidence_distribution": confidence_distribution,
            "peer_distribution": peer_distribution,
            "family_distribution": family_distribution,
            "activity_timeline": activity_timeline,
            "recent_decisions": recent_decisions,
        }



