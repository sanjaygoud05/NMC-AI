"""
Review API endpoints (Phase 7)
Serves the human review queue, statistics, candidate detail with 4-layer evidence,
atomic decision recording, and append-only audit history.
Integrates with Supabase PostgreSQL and enforces server-derived reviewer identity.
"""

import os
import math
import pandas as pd
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, Query, HTTPException, Depends, status

from app.dependencies import get_current_user, require_reviewer
from app.db.review_repository import review_repository, StaleVersionError, RepositoryError
from services.review_service import review_service, ValidationError

router = APIRouter()

WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
VALIDATED_CSV = os.path.join(WORKSPACE_ROOT, "data", "processed", "validated_candidates.csv")
STD_MATERIALS_CSV = os.path.join(WORKSPACE_ROOT, "data", "processed", "standardized_materials.csv")


class DecisionRequest(BaseModel):
    decision: str = Field(..., description="Decision verdict: ACCEPT, REJECT, or DEFER")
    rationale: str = Field(..., description="Technical engineering rationale")
    escalated: bool = Field(False, description="Flag for senior engineering escalation")
    needs_spec_sheet: bool = Field(False, description="Flag requesting OEM datasheet")
    expected_version: Optional[int] = Field(None, description="Expected version for optimistic locking")


def _clean_dict(d: dict) -> dict:
    """Sanitize dict converting NaN/float nulls to Python None for JSON compliance"""
    cleaned = {}
    for k, v in d.items():
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            cleaned[k] = None
        else:
            cleaned[k] = v
    return cleaned


def _load_std_materials() -> Dict[str, Dict[str, Any]]:
    """Load standardized materials into dictionary index by Material_Code"""
    if not os.path.exists(STD_MATERIALS_CSV):
        return {}
    df = pd.read_csv(STD_MATERIALS_CSV, low_memory=False)
    index = {}
    for _, row in df.iterrows():
        code = str(row.get("Material_Code", "")).strip()
        if code:
            index[code] = row.to_dict()
    return index


_std_materials_cache: Optional[Dict[str, Dict[str, Any]]] = None


def get_cached_materials() -> Dict[str, Dict[str, Any]]:
    global _std_materials_cache
    if _std_materials_cache is None:
        _std_materials_cache = _load_std_materials()
    return _std_materials_cache


@router.get("/queue")
async def get_review_queue(
    page: int = Query(0, ge=0),
    page_size: int = Query(25, ge=1, le=100),
    view_mode: str = Query("active", description="Queue partition: active, secondary, disqualified, or all"),
    dataset_id: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    decision_filter: str = Query("all", description="Filter by decision: all, pending, accepted, rejected, deferred"),
    source_cpse: Optional[str] = None,
    candidate_cpse: Optional[str] = None,
    cross_cpse_only: bool = False,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """
    Get paginated review queue of validated candidates.
    Supports dataset_id scoping (BASELINE, UPLOAD-..., or ALL).
    """
    from server.services.dataset_resolver import load_dataset_dataframe

    df = load_dataset_dataframe("validated_candidates.csv", dataset_id=dataset_id)
    if df.empty and dataset_id in [None, "BASELINE"]:
        if os.path.exists(VALIDATED_CSV):
            df = pd.read_csv(VALIDATED_CSV, low_memory=False)

    if df.empty:
        return {
            "items": [],
            "total": 0,
            "page": page,
            "page_size": page_size,
            "total_pages": 0,
            "dataset_id": dataset_id or "BASELINE",
        }

    # 1. Apply View Mode Partitioning
    # ACTIVE: CRITICAL + HIGH priority (12,191 candidates)
    # SECONDARY: MEDIUM (3,917) + LOW non-incompatible (116) = 4,033 candidates
    # DISQUALIFIED: ENGINEERING_INCOMPATIBLE (21,276 candidates)
    if view_mode == "active":
        df = df[df["review_priority"].isin(["CRITICAL", "HIGH"])]
    elif view_mode == "secondary":
        df = df[(df["review_priority"].isin(["MEDIUM", "LOW"])) & (df["validation_status"] != "ENGINEERING_INCOMPATIBLE")]
    elif view_mode == "disqualified":
        df = df[df["validation_status"] == "ENGINEERING_INCOMPATIBLE"]
    elif view_mode == "all":
        pass  # All 37,500 candidates accessible
    else:
        raise HTTPException(status_code=400, detail=f"Invalid view_mode '{view_mode}'. Must be active, secondary, disqualified, or all.")

    # 2. Specific field filters
    if status and status != "all":
        df = df[df["validation_status"] == status]

    if priority and priority != "all":
        df = df[df["review_priority"] == priority]

    if source_cpse and source_cpse != "all":
        df = df[df["source_cpse"] == source_cpse]

    if candidate_cpse and candidate_cpse != "all":
        df = df[df["candidate_cpse"] == candidate_cpse]

    if cross_cpse_only:
        df = df[df["source_cpse"] != df["candidate_cpse"]]

    if search:
        s = search.strip().lower()
        mask = (
            df["candidate_id"].str.lower().str.contains(s, na=False)
            | df["source_material_code"].str.lower().str.contains(s, na=False)
            | df["candidate_material_code"].str.lower().str.contains(s, na=False)
            | df["source_canonical_key"].str.lower().str.contains(s, na=False)
            | df["candidate_canonical_key"].str.lower().str.contains(s, na=False)
            | df["validation_reason_codes"].str.lower().str.contains(s, na=False)
        )
        df = df[mask]

    # 3. Overlay human review decisions from database
    decisions_map = review_repository.get_all_decisions()

    # Filter by decision if specified
    if decision_filter != "all":
        decision_target = decision_filter.upper()
        if decision_target == "PENDING":
            df = df[~df["candidate_id"].isin(decisions_map.keys())]
        else:
            matching_ids = [cid for cid, d in decisions_map.items() if d.get("decision") == decision_target]
            df = df[df["candidate_id"].isin(matching_ids)]

    # 4. Priority sorting: CRITICAL > HIGH > MEDIUM > LOW, then refined_score desc
    priority_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    df["_prio_rank"] = df["review_priority"].map(priority_order).fillna(4)
    df = df.sort_values(by=["_prio_rank", "refined_score"], ascending=[True, False]).drop(columns=["_prio_rank"])

    total = len(df)
    start = page * page_size
    end = start + page_size
    page_df = df.iloc[start:end]

    raw_items = page_df.to_dict("records")
    items = []
    for row in raw_items:
        cid = row.get("candidate_id")
        dec = decisions_map.get(cid)
        row_dict = _clean_dict(row)
        if dec:
            row_dict["human_decision"] = dec["decision"]
            row_dict["human_rationale"] = dec["rationale"]
            row_dict["human_reviewer_id"] = dec["reviewer_id"]
            row_dict["human_reviewer_email"] = dec["reviewer_email"]
            row_dict["human_reviewed_at"] = dec["updated_at"]
            row_dict["decision_version"] = dec["version"]
            row_dict["escalated"] = dec.get("escalated", False)
            row_dict["needs_spec_sheet"] = dec.get("needs_spec_sheet", False)
        else:
            row_dict["human_decision"] = "PENDING"
            row_dict["human_rationale"] = None
            row_dict["human_reviewer_id"] = None
            row_dict["human_reviewer_email"] = None
            row_dict["human_reviewed_at"] = None
            row_dict["decision_version"] = 0
            row_dict["escalated"] = False
            row_dict["needs_spec_sheet"] = False
        items.append(row_dict)

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "view_mode": view_mode,
        "active_queue_partition": 12191,
        "secondary_queue_partition": 4033,
        "disqualified_partition": 21276,
        "total_candidate_universe": 37500,
    }


@router.get("/stats")
async def get_review_stats():
    """
    Get comprehensive review statistics including queue partitions,
    current human review decisions, and progress tracking.
    """
    if not os.path.exists(VALIDATED_CSV):
        raise HTTPException(
            status_code=503,
            detail="Phase 6 validation has not been run yet. File validated_candidates.csv missing."
        )

    df = pd.read_csv(VALIDATED_CSV, low_memory=False)
    decisions_map = review_repository.get_all_decisions()
    db_stats = review_repository.get_stats()

    # Active queue candidates (CRITICAL + HIGH)
    active_mask = df["review_priority"].isin(["CRITICAL", "HIGH"])
    active_df = df[active_mask]
    active_total = len(active_df)  # 12,191

    active_ids = set(active_df["candidate_id"])
    reviewed_active_ids = set(decisions_map.keys()).intersection(active_ids)
    pending_active = active_total - len(reviewed_active_ids)

    # Critical & High pending
    critical_df = df[df["review_priority"] == "CRITICAL"]
    critical_total = len(critical_df)  # 7,337
    critical_reviewed = len(set(decisions_map.keys()).intersection(set(critical_df["candidate_id"])))
    critical_pending = critical_total - critical_reviewed

    high_df = df[df["review_priority"] == "HIGH"]
    high_total = len(high_df)  # 4,854
    high_reviewed = len(set(decisions_map.keys()).intersection(set(high_df["candidate_id"])))
    high_pending = high_total - high_reviewed

    total_reviewed = db_stats["total_reviewed"]
    accepted = db_stats["accepted"]
    acceptance_rate = round((accepted / total_reviewed * 100), 1) if total_reviewed > 0 else 0.0

    return {
        "total_candidates": 37500,
        "active_queue_total": 12191,
        "secondary_queue_total": 4033,
        "disqualified_total": 21276,
        "pending_active": pending_active,
        "critical_total": critical_total,
        "critical_pending": critical_pending,
        "high_total": high_total,
        "high_pending": high_pending,
        "total_reviewed": total_reviewed,
        "accepted": accepted,
        "rejected": db_stats["rejected"],
        "deferred": db_stats["deferred"],
        "escalated": db_stats["escalated"],
        "acceptance_rate": acceptance_rate,
        "cross_cpse_candidates": int((df["source_cpse"] != df["candidate_cpse"]).sum()),
    }


@router.get("/{candidate_id}")
async def get_review_candidate_detail(
    candidate_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Get detailed candidate validation record with complete 4-layer evidence package,
    side-by-side attributes, canonical snapshot hash, and decision history.
    """
    if not os.path.exists(VALIDATED_CSV):
        raise HTTPException(
            status_code=503,
            detail="Phase 6 validation has not been run yet. File validated_candidates.csv missing."
        )

    df = pd.read_csv(VALIDATED_CSV, low_memory=False)
    match = df[df["candidate_id"] == candidate_id]

    if match.empty:
        raise HTTPException(status_code=404, detail=f"Candidate ID '{candidate_id}' not found")

    cand_row = _clean_dict(match.iloc[0].to_dict())
    materials = get_cached_materials()

    src_mat = materials.get(str(cand_row.get("source_material_code")), {})
    cand_mat = materials.get(str(cand_row.get("candidate_material_code")), {})

    # Build complete 4-layer evidence package
    evidence_package = review_service.build_evidence_package(cand_row, src_mat, cand_mat)
    evidence_snapshot_hash = review_service.compute_canonical_evidence_hash(evidence_package)

    # Current decision
    decision = review_repository.get_decision(candidate_id)
    history = review_repository.get_history(candidate_id)

    return {
        "candidate": cand_row,
        "evidence_package": evidence_package,
        "evidence_snapshot_hash": evidence_snapshot_hash,
        "current_decision": decision,
        "history_count": len(history),
        "is_read_only": current_user.get("role") not in ("reviewer", "admin", "manager"),
    }


@router.post("/{candidate_id}/decision")
async def submit_review_decision(
    candidate_id: str,
    payload: DecisionRequest,
    current_user: dict = Depends(require_reviewer),  # Enforces reviewer/admin role
):
    """
    Atomically record an auditable human review decision for a candidate.
    Enforces server-side derivation of reviewer_id and reviewer_email from authenticated session.
    Never trusts client-supplied reviewer identity.
    """
    if not os.path.exists(VALIDATED_CSV):
        raise HTTPException(
            status_code=503,
            detail="Phase 6 validation has not been run yet. File validated_candidates.csv missing."
        )

    df = pd.read_csv(VALIDATED_CSV, low_memory=False)
    match = df[df["candidate_id"] == candidate_id]

    if match.empty:
        raise HTTPException(status_code=404, detail=f"Candidate ID '{candidate_id}' not found")

    cand_row = match.iloc[0].to_dict()
    materials = get_cached_materials()

    src_mat = materials.get(str(cand_row.get("source_material_code")), {})
    cand_mat = materials.get(str(cand_row.get("candidate_material_code")), {})

    # 1. Strictly derive reviewer identity server-side
    reviewer_id = str(current_user.get("id"))
    reviewer_email = str(current_user.get("email"))

    try:
        # 2. Process and atomically persist decision
        result = review_service.submit_decision(
            candidate_id=candidate_id,
            decision=payload.decision.upper(),
            reviewer_id=reviewer_id,
            reviewer_email=reviewer_email,
            rationale=payload.rationale,
            candidate_row=cand_row,
            source_mat=src_mat,
            cand_mat=cand_mat,
            escalated=payload.escalated,
            needs_spec_sheet=payload.needs_spec_sheet,
            expected_version=payload.expected_version,
        )

        return {
            "status": "success",
            "message": f"Candidate relationship marked as human-reviewed ({payload.decision.upper()}) for Phase 8 consideration.",
            "candidate_id": candidate_id,
            "decision": result["decision"],
            "version": result["version"],
            "event_id": result["event_id"],
            "evidence_snapshot_hash": result["evidence_snapshot_hash"],
            "reviewer_id": reviewer_id,
            "reviewer_email": reviewer_email,
        }

    except ValidationError as ve:
        raise HTTPException(status_code=422, detail=str(ve))
    except StaleVersionError as se:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(se))
    except RepositoryError as re:
        raise HTTPException(status_code=500, detail=str(re))


@router.get("/{candidate_id}/history")
async def get_candidate_review_history(
    candidate_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Get append-only audit event history for a candidate.
    """
    history = review_repository.get_history(candidate_id)
    return {
        "candidate_id": candidate_id,
        "events": history,
        "total_events": len(history),
    }
