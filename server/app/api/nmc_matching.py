"""
NMC Matching API
Manages normalization readiness checks, cross-CPSE matching triggers, and match run status.
"""

import logging
import threading
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from app.db.nmc_repository import nmc_repo
from app.api.nmc_auth import verify_admin_access

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/nmc/matching", tags=["NMC Matching"])

# ── In-memory job state (single active matching run) ─────────────────────────
_job_lock = threading.Lock()
_job_state: dict = {
    "status": "IDLE",         # IDLE | RUNNING | COMPLETED | FAILED
    "result": None,
    "error": None,
}


def _run_matching_job():
    """Execute matching in background thread; update _job_state when done."""
    global _job_state
    try:
        try:
            from services.nmc_matching_service import run_cross_cpse_matching
        except ImportError:
            from server.services.nmc_matching_service import run_cross_cpse_matching

        result = run_cross_cpse_matching()

        with _job_lock:
            _job_state["status"] = "COMPLETED"
            _job_state["result"] = result
            _job_state["error"] = None
        logger.info("Matching job completed: %s", result)
    except Exception as exc:
        logger.error("Matching job failed: %s", exc, exc_info=True)
        with _job_lock:
            _job_state["status"] = "FAILED"
            _job_state["result"] = None
            _job_state["error"] = str(exc)


@router.get("/readiness")
def check_readiness():
    """
    Check if all active CPSEs have normalized datasets.
    Controls whether 'Find Mapping' button is enabled in the UI.
    Decision is driven purely by database state — never hardcoded.
    """
    return nmc_repo.get_normalization_readiness()


@router.post("/run")
def trigger_matching(background_tasks: BackgroundTasks, _role: str = Depends(verify_admin_access)):
    """
    Trigger cross-CPSE material matching as a background job.
    Returns immediately with job status 'RUNNING'.
    Poll GET /run/result to check completion.
    Only permitted when all active CPSEs have normalized their datasets.
    """
    readiness = nmc_repo.get_normalization_readiness()
    if not readiness.get("all_ready", False):
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Cannot run matching. Not all CPSE datasets are normalized.",
                "pending_cpses": readiness.get("pending_cpses", []),
                "normalized": readiness.get("normalized", 0),
                "total": readiness.get("total", 0),
            },
        )

    with _job_lock:
        if _job_state["status"] == "RUNNING":
            return {"status": "RUNNING", "message": "Matching job is already running."}
        _job_state["status"] = "RUNNING"
        _job_state["result"] = None
        _job_state["error"] = None

    background_tasks.add_task(_run_matching_job)

    return {
        "status": "RUNNING",
        "message": "Matching job started in background. Poll GET /api/nmc/matching/run/result for completion.",
    }


@router.get("/run/result")
def get_run_result():
    """
    Poll the result of the last matching run.
    Returns: status (IDLE|RUNNING|COMPLETED|FAILED), result, error.
    """
    with _job_lock:
        return {
            "status": _job_state["status"],
            "result": _job_state["result"],
            "error": _job_state["error"],
        }


@router.get("/status")
def get_matching_status():
    """
    Returns high-level statistics about existing matches and current readiness.
    """
    readiness = nmc_repo.get_normalization_readiness()
    kpis = nmc_repo.get_dashboard_kpis()
    return {
        "readiness": readiness,
        "kpis": kpis,
    }
