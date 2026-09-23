"""
NMC Review Queue API
Provides review queue, match comparison, and reviewer decision endpoints.
Queue / detail: accessible by Reviewer AND Admin (read).
Decision submission: Reviewer-ONLY — Admin receives HTTP 403.
"""

from typing import Optional
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
    role: str = Depends(verify_reviewer_access),
):
    """
    Per-tab match counts for the Review Queue.
    Returns: { pending, different, mapped }
    """
    return nmc_repo.get_queue_stats(cpse_id=cpse_id)


@router.get("/queue")
def get_review_queue(
    cpse_id: Optional[str] = Query(None, description="CPSE filter for review queue"),
    status: Optional[str] = Query("PENDING_REVIEW", description="Match status filter (comma-separated for multiple)"),
    match_category: Optional[str] = Query(None, description="Match category filter"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    role: str = Depends(verify_reviewer_access),
):
    """
    Fetch paginated review queue.
    Accessible to both Reviewers and Admins (read-only).
    """
    return nmc_repo.query_matches(
        cpse_id=cpse_id,
        match_category=match_category,
        status=status,
        page=page,
        page_size=page_size,
    )


@router.get("/match/{match_id}")
def get_match_detail(
    match_id: str,
    role: str = Depends(verify_reviewer_access),
):
    """
    Detailed side-by-side match view for reviewer evaluation.
    Accessible to both Reviewers and Admins (read-only).
    """
    match = nmc_repo.get_match(match_id)
    if not match:
        raise HTTPException(status_code=404, detail=f"Match '{match_id}' not found.")
    return match


@router.post("/{match_id}/decision")
def submit_decision(
    match_id: str,
    req: DecisionRequest,
    role: str = Depends(verify_reviewer_decision_access),
):
    """
    Submit a reviewer decision on a material match.
    REVIEWER-ONLY — Admin receives HTTP 403.

    - ACCEPT: Creates/updates CMM, assigns NMC code, maps both materials.
    - REJECT: Marks match as rejected (no CMM).
    - DIFFERENT: Marks items as distinct engineering items (no CMM).
    - OVERRIDE: Requires override_outcome ('EQUIVALENT' -> create CMM/mapping, 'DIFFERENT' -> record only).
    """
    reviewer_name = req.reviewer or "Reviewer"

    match = nmc_repo.get_match(match_id)
    if not match:
        raise HTTPException(status_code=404, detail=f"Match '{match_id}' not found.")

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

    cmm_result = None
    if decision_upper == "ACCEPT" or (decision_upper == "OVERRIDE" and override_outcome_upper == "EQUIVALENT"):
        # Create or reuse CMM and create mappings for both materials
        cmm, was_created = nmc_repo.get_or_create_cmm_for_match(match, reviewer=reviewer_name)
        cmm_result = cmm
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

    # Record decision in DB & audit trail
    record = nmc_repo.record_review_decision(
        match_id=match_id,
        reviewer=reviewer_name,
        decision=decision_upper,
        reason=req.reason,
        cpse_code=req.cpse_code,
        override_outcome=override_outcome_upper,
    )

    return {
        "status": "SUCCESS",
        "decision": record,
        "cmm": cmm_result,
        "message": f"Match marked as {decision_upper} ({override_outcome_upper})" if override_outcome_upper else f"Match marked as {decision_upper}.",
    }
