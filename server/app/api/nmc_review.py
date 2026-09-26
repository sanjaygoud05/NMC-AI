"""
NMC Review Queue API
Provides review queue, match comparison, and reviewer decision endpoints.
Queue / detail: accessible by Reviewer AND Admin (read).
Decision submission: Reviewer-ONLY — Admin receives HTTP 403.
"""

from typing import Optional, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from app.db.nmc_repository import nmc_repo
from app.api.nmc_auth import verify_reviewer_access, verify_reviewer_decision_access

router = APIRouter(prefix="/api/nmc/review", tags=["NMC Review"])


class DecisionRequest(BaseModel):
    decision: str  # ACCEPT | REJECT | DIFFERENT | OVERRIDE
    override_outcome: Optional[str] = None  # EQUIVALENT | DIFFERENT (required for OVERRIDE)
    reason: Optional[str] = None
    reviewer: Optional[str] = "Reviewer"
    cpse_code: Optional[str] = None


@router.get("/stats")
def get_review_stats(
    cpse_id: Optional[str] = Query(None, description="Optional CPSE filter"),
    role: Any = Depends(verify_reviewer_access),
):
    """
    Per-tab match counts for the Review Queue.
    Returns: { pending, different, mapped }
    """
    if getattr(role, "is_reviewer", False):
        assigned_cpse_id = None
        if getattr(role, "cpse_code", None):
            cpse_obj = nmc_repo.get_cpse_by_code(role.cpse_code)
            if cpse_obj:
                assigned_cpse_id = cpse_obj["id"]
        if not assigned_cpse_id:
            assigned_cpse_id = getattr(role, "cpse_id", None)
        cpse_id = assigned_cpse_id

    return nmc_repo.get_queue_stats(cpse_id=cpse_id)


@router.get("/queue")
def get_review_queue(
    cpse_id: Optional[str] = Query(None, description="CPSE filter for review queue"),
    status: Optional[str] = Query("PENDING_REVIEW", description="Match status filter (comma-separated for multiple)"),
    match_category: Optional[str] = Query(None, description="Match category filter"),
    confidence_label: Optional[str] = Query(None, description="Confidence tier filter: HIGH, MEDIUM, LOW"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    role: Any = Depends(verify_reviewer_access),
):
    """
    Fetch paginated review queue.
    Accessible to both Reviewers (scoped to their CPSE) and Admins (all CPSEs).
    """
    if getattr(role, "is_reviewer", False):
        assigned_cpse_id = None
        if getattr(role, "cpse_code", None):
            cpse_obj = nmc_repo.get_cpse_by_code(role.cpse_code)
            if cpse_obj:
                assigned_cpse_id = cpse_obj["id"]
        if not assigned_cpse_id:
            assigned_cpse_id = getattr(role, "cpse_id", None)

        if cpse_id and cpse_id != assigned_cpse_id:
            if role.cpse_code and cpse_id.upper() == role.cpse_code.upper():
                cpse_id = assigned_cpse_id
            else:
                raise HTTPException(
                    status_code=403,
                    detail=f"Access forbidden: Reviewers for {getattr(role, 'cpse_code', 'assigned CPSE')} cannot view review queues of other CPSEs."
                )
        cpse_id = assigned_cpse_id

    return nmc_repo.query_matches(
        cpse_id=cpse_id,
        match_category=match_category,
        status=status,
        confidence_label=confidence_label,
        page=page,
        page_size=page_size,
    )


@router.get("/match/{match_id}")
def get_match_detail(
    match_id: str,
    role: Any = Depends(verify_reviewer_access),
):
    """
    Detailed side-by-side match view for reviewer evaluation.
    Reviewer can view if their assigned CPSE is the source or candidate.
    """
    match = nmc_repo.get_match(match_id)
    if not match:
        raise HTTPException(status_code=404, detail=f"Match '{match_id}' not found.")

    if getattr(role, "is_reviewer", False):
        assigned_cpse_id = None
        if getattr(role, "cpse_code", None):
            cpse_obj = nmc_repo.get_cpse_by_code(role.cpse_code)
            if cpse_obj:
                assigned_cpse_id = cpse_obj["id"]
        if not assigned_cpse_id:
            assigned_cpse_id = getattr(role, "cpse_id", None)

        src_cpse_id = match.get("source_material", {}).get("cpse_id")
        cand_cpse_id = match.get("candidate_material", {}).get("cpse_id")
        if assigned_cpse_id and assigned_cpse_id not in (src_cpse_id, cand_cpse_id):
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: This review case does not involve your enterprise ({getattr(role, 'cpse_code', 'CPSE')})."
            )

    return match


@router.post("/{match_id}/decision")
def submit_decision(
    match_id: str,
    req: DecisionRequest,
    role: Any = Depends(verify_reviewer_decision_access),
):
    """
    Submit a reviewer decision on a material match.
    Enforces CPSE boundary: Reviewer can only decide matches involving their assigned CPSE.
    """
    match = nmc_repo.get_match(match_id)
    if not match:
        raise HTTPException(status_code=404, detail=f"Match '{match_id}' not found.")

    reviewer_name = req.reviewer or "Reviewer"
    cpse_code = req.cpse_code

    if getattr(role, "is_reviewer", False):
        assigned_cpse_id = None
        if getattr(role, "cpse_code", None):
            cpse_obj = nmc_repo.get_cpse_by_code(role.cpse_code)
            if cpse_obj:
                assigned_cpse_id = cpse_obj["id"]
        if not assigned_cpse_id:
            assigned_cpse_id = getattr(role, "cpse_id", None)

        src_cpse_id = match.get("source_material", {}).get("cpse_id")
        cand_cpse_id = match.get("candidate_material", {}).get("cpse_id")
        if assigned_cpse_id and assigned_cpse_id not in (src_cpse_id, cand_cpse_id):
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: You cannot submit decisions for review cases outside your CPSE ({getattr(role, 'cpse_code', 'CPSE')})."
            )
        reviewer_name = getattr(role, "reviewer_name", None) or reviewer_name
        cpse_code = getattr(role, "cpse_code", None) or cpse_code

    decision_upper = req.decision.upper()
    if decision_upper not in ("ACCEPT", "REJECT", "DIFFERENT", "OVERRIDE"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid decision '{req.decision}'. Allowed: ACCEPT, REJECT, DIFFERENT, OVERRIDE.",
        )

    override_outcome_upper = req.override_outcome.upper() if req.override_outcome else None
    if decision_upper == "OVERRIDE":
        if not override_outcome_upper or override_outcome_upper not in ("EQUIVALENT", "DIFFERENT"):
            raise HTTPException(
                status_code=400,
                detail="For OVERRIDE decisions, override_outcome must be explicitly specified as 'EQUIVALENT' or 'DIFFERENT'.",
            )

    is_admin = getattr(role, "is_admin", False) or role == "ADMIN"
    match_category = match.get("match_category")
    current_status = match.get("status")
    gate1_cpse = match.get("gate1_cpse_code")

    if decision_upper == "OVERRIDE" and override_outcome_upper == "EQUIVALENT":
        # Direct administrative override: create CMM immediately
        cmm, was_created = nmc_repo.get_or_create_cmm_for_match(match, reviewer=reviewer_name)
        nmc_repo.create_mapping(
            material_id=match["source_material_id"],
            cmm_id=cmm["id"],
            decision_source="REVIEWER",
            reviewer=reviewer_name,
        )
        nmc_repo.create_mapping(
            material_id=match["candidate_material_id"],
            cmm_id=cmm["id"],
            decision_source="REVIEWER",
            reviewer=reviewer_name,
        )
        nmc_repo.upgrade_pending_matches_to_cmm(
            cmm_id=cmm["id"],
            mapped_material_ids=[match["source_material_id"], match["candidate_material_id"]],
            reviewer=reviewer_name,
        )
        record = nmc_repo.record_review_decision(
            match_id=match_id,
            reviewer=reviewer_name,
            decision=decision_upper,
            reason=req.reason,
            cpse_code=cpse_code,
            override_outcome=override_outcome_upper,
            new_status="ACCEPTED",
        )
        nmc_repo.mark_notifications_acted_for_match(match_id)
        return {
            "status": "SUCCESS",
            "match_status": "ACCEPTED",
            "decision": record,
            "cmm": cmm,
            "message": f"Match overridden to EQUIVALENT. National Master {cmm['national_material_code']} created.",
        }

    if decision_upper == "ACCEPT":
        # Case 1: Match against an already-established NMC Master standard (ALREADY_MAPPED)
        # Single-click confirmation from 3rd / 4th CPSE
        if match_category == "ALREADY_MAPPED":
            cmm, was_created = nmc_repo.get_or_create_cmm_for_match(match, reviewer=reviewer_name)
            nmc_repo.create_mapping(
                material_id=match["source_material_id"],
                cmm_id=cmm["id"],
                decision_source="REVIEWER",
                reviewer=reviewer_name,
            )
            record = nmc_repo.record_review_decision(
                match_id=match_id,
                reviewer=reviewer_name,
                decision="ACCEPT",
                reason=req.reason or "Confirmed link to established National Master Code",
                cpse_code=cpse_code,
                new_status="ACCEPTED",
            )
            nmc_repo.mark_notifications_acted_for_match(match_id)
            return {
                "status": "SUCCESS",
                "match_status": "ACCEPTED",
                "decision": record,
                "cmm": cmm,
                "message": f"Item successfully linked to National Master Code {cmm['national_material_code']}.",
            }

        # Case 2: Admin Direct Approval
        if is_admin:
            cmm, was_created = nmc_repo.get_or_create_cmm_for_match(match, reviewer=reviewer_name)
            nmc_repo.create_mapping(
                material_id=match["source_material_id"],
                cmm_id=cmm["id"],
                decision_source="REVIEWER",
                reviewer=reviewer_name,
            )
            nmc_repo.create_mapping(
                material_id=match["candidate_material_id"],
                cmm_id=cmm["id"],
                decision_source="REVIEWER",
                reviewer=reviewer_name,
            )
            nmc_repo.upgrade_pending_matches_to_cmm(
                cmm_id=cmm["id"],
                mapped_material_ids=[match["source_material_id"], match["candidate_material_id"]],
                reviewer=reviewer_name,
            )
            record = nmc_repo.record_review_decision(
                match_id=match_id,
                reviewer=reviewer_name,
                decision="ACCEPT",
                reason=req.reason,
                cpse_code=cpse_code,
                new_status="ACCEPTED",
            )
            nmc_repo.mark_notifications_acted_for_match(match_id)
            return {
                "status": "SUCCESS",
                "match_status": "ACCEPTED",
                "decision": record,
                "cmm": cmm,
                "message": f"Match accepted by Administrator. National Master {cmm['national_material_code']} created.",
            }

        # Case 3: CPSE Reviewer - Peer-to-Peer Gate 2 (Consensus)
        if current_status == "GATE_1_APPROVED" and gate1_cpse:
            if gate1_cpse.upper() == (cpse_code or "").upper():
                raise HTTPException(
                    status_code=400,
                    detail=f"This match was already endorsed by your CPSE ({cpse_code}). Waiting for counterpart CPSE co-endorsement.",
                )
            cmm, was_created = nmc_repo.get_or_create_cmm_for_match(match, reviewer=reviewer_name)
            nmc_repo.create_mapping(
                material_id=match["source_material_id"],
                cmm_id=cmm["id"],
                decision_source="REVIEWER",
                reviewer=reviewer_name,
            )
            nmc_repo.create_mapping(
                material_id=match["candidate_material_id"],
                cmm_id=cmm["id"],
                decision_source="REVIEWER",
                reviewer=reviewer_name,
            )
            nmc_repo.upgrade_pending_matches_to_cmm(
                cmm_id=cmm["id"],
                mapped_material_ids=[match["source_material_id"], match["candidate_material_id"]],
                reviewer=reviewer_name,
            )
            record = nmc_repo.record_review_decision(
                match_id=match_id,
                reviewer=reviewer_name,
                decision="ACCEPT",
                reason=req.reason or "Gate 2 consensus confirmation",
                cpse_code=cpse_code,
                new_status="ACCEPTED",
            )
            nmc_repo.mark_notifications_acted_for_match(match_id)
            return {
                "status": "SUCCESS",
                "match_status": "ACCEPTED",
                "decision": record,
                "cmm": cmm,
                "message": f"Consensus achieved! National Master Code {cmm['national_material_code']} established by {gate1_cpse} and {cpse_code}.",
            }

        # Case 4: CPSE Reviewer - Peer-to-Peer Gate 1 (First Endorsement)
        src_code = match.get("source_material", {}).get("cpse_code") or ""
        cand_code = match.get("candidate_material", {}).get("cpse_code") or ""
        counterpart_code = cand_code if src_code.upper() == (cpse_code or "").upper() else src_code
        counterpart_mat = match.get("candidate_material") if src_code.upper() == (cpse_code or "").upper() else match.get("source_material")

        record = nmc_repo.record_review_decision(
            match_id=match_id,
            reviewer=reviewer_name,
            decision="ACCEPT",
            reason=req.reason or "Gate 1 verification and endorsement submitted",
            cpse_code=cpse_code,
            new_status="GATE_1_APPROVED",
            gate1_data={
                "reviewer": reviewer_name,
                "cpse_code": cpse_code,
                "timestamp": datetime.now(timezone.utc),
            },
        )
        if counterpart_code:
            nmc_repo.create_notification(
                cpse_code=counterpart_code,
                alert_type="PEER_ENDORSED",
                match_id=match_id,
                material_id=counterpart_mat.get("id") if counterpart_mat else None,
                material_code=counterpart_mat.get("original_material_code") if counterpart_mat else None,
                material_description=counterpart_mat.get("standardized_description") or (counterpart_mat.get("original_description") if counterpart_mat else None),
                triggered_by_cpse=cpse_code,
                triggered_by_reviewer=reviewer_name,
                endorsed_cpses=[cpse_code],
                message=f"{cpse_code} evaluated and endorsed this match. Your co-endorsement is needed to establish the National Master Code.",
            )
        return {
            "status": "SUCCESS",
            "match_status": "GATE_1_APPROVED",
            "decision": record,
            "cmm": None,
            "message": f"Match verified and endorsed. Moved to Awaiting Peer — alert sent to {counterpart_code} for co-endorsement.",
        }
    else:
        # REJECT, DIFFERENT, or OVERRIDE (DIFFERENT)
        record = nmc_repo.record_review_decision(
            match_id=match_id,
            reviewer=reviewer_name,
            decision=decision_upper,
            reason=req.reason,
            cpse_code=cpse_code,
            override_outcome=override_outcome_upper,
        )
        nmc_repo.mark_notifications_acted_for_match(match_id)
        return {
            "status": "SUCCESS",
            "match_status": record.get("status", decision_upper),
            "decision": record,
            "cmm": None,
            "message": f"Match marked as {decision_upper} ({override_outcome_upper})" if override_outcome_upper else f"Match marked as {decision_upper}.",
        }


@router.get("/notifications")
def get_notifications(
    cpse_code: Optional[str] = Query(None, description="Optional CPSE filter"),
    unacted_only: bool = Query(True, description="Filter unacted notifications"),
    role: Any = Depends(verify_reviewer_access),
):
    """
    Returns alerts/notifications for CPSE reviewers:
    - PEER_ENDORSED: Peer evaluated and accepted a match, awaiting reviewer's endorsement.
    - NMC_CREATED: NMC Master Code generated, alerting other CPSEs to review & link their items.
    """
    filter_code = cpse_code
    if getattr(role, "is_reviewer", False):
        user_code = getattr(role, "cpse_code", None)
        if user_code and not filter_code:
            filter_code = user_code

    notifs = nmc_repo.get_notifications(cpse_code=filter_code, unacted_only=unacted_only)
    return {"notifications": notifs, "count": len(notifs)}


@router.post("/notifications/{notif_id}/dismiss")
def dismiss_notification(
    notif_id: str,
    role: Any = Depends(verify_reviewer_access),
):
    """
    Dismisses an alert notification.
    """
    success = nmc_repo.mark_notification_acted(notif_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "SUCCESS", "message": "Notification dismissed"}

