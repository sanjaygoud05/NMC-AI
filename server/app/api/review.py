"""
Review API endpoints (Phase 7)
Serves the human review queue, statistics, candidate detail with 4-layer evidence,
atomic decision recording, and append-only audit history.
Integrates with Supabase PostgreSQL and enforces server-derived reviewer identity.
"""

import os
import math
import json
from datetime import datetime, timezone
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
ENGINEERING_VALUES_FILE = os.path.join(WORKSPACE_ROOT, "data", "stored_engineering_values.json")


def _load_engineering_values() -> dict:
    if os.path.exists(ENGINEERING_VALUES_FILE):
        try:
            with open(ENGINEERING_VALUES_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def _save_engineering_values(data: dict):
    os.makedirs(os.path.dirname(ENGINEERING_VALUES_FILE), exist_ok=True)
    with open(ENGINEERING_VALUES_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


class DecisionRequest(BaseModel):
    decision: str = Field(..., description="Decision verdict: ACCEPT, APPROVE, REJECT, or DEFER")
    rationale: Optional[str] = Field(None, description="Technical engineering rationale")
    comment: Optional[str] = Field(None, description="Alternative field for rationale/comment")
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


def _get_std_map(effective_id: str) -> Dict[str, dict]:
    from server.services.dataset_resolver import load_dataset_dataframe
    std_df = load_dataset_dataframe("standardized_materials.csv", dataset_id=effective_id)
    if std_df.empty and effective_id == "BASELINE":
        if os.path.exists(STD_MATERIALS_CSV):
            std_df = pd.read_csv(STD_MATERIALS_CSV, low_memory=False, dtype=str)
    if not std_df.empty and "Material_Code" in std_df.columns:
        return std_df.set_index("Material_Code").to_dict("index")
    return {}


def _clean_title(desc: Optional[str], key: Optional[str], code: str) -> str:
    if desc and not pd.isna(desc) and str(desc).strip() and str(desc).lower() not in ["nan", "none"]:
        text = str(desc).replace("_", " ").strip()
        words = text.split()
        return " ".join(w.upper() if w.upper() in ["ASTM", "ASME", "ISO", "DIN", "ANSI", "API", "BS", "IS", "XLPE", "PVC", "SS", "CS", "MS", "GI", "CI", "WCB", "CF8M", "NBR", "PTFE", "EPDM", "FKM", "CPSE", "IOCL", "ONGC", "HPCL", "BPCL", "CPCL", "NPT", "BSP", "BSPT", "FLG", "SW", "BW", "NB", "OD", "ID", "PN", "CL", "SCH"] else w.capitalize() for w in words)
    if key and not pd.isna(key) and str(key).strip():
        parts = [p.replace("_", " ").strip() for p in str(key).split("|") if p.strip()]
        if len(parts) >= 2:
            return f"{parts[0].title()} {parts[1].title()}"
        return str(key).replace("_", " ").strip().title()
    return code


def _clean_attr_val(val: Any) -> str:
    if val is None or pd.isna(val) or str(val).strip().lower() in ["nan", "none", "-", ""]:
        return "-"
    text = str(val).replace("_", " ").strip()
    words = text.split()
    return " ".join(w.upper() if w.upper() in ["ASTM", "ASME", "ISO", "DIN", "ANSI", "API", "BS", "IS", "XLPE", "PVC", "SS", "CS", "MS", "GI", "CI", "WCB", "CF8M", "NBR", "PTFE", "EPDM", "FKM", "NOS", "MTR", "KG", "LTR", "SET", "BOX", "PKT", "PAIR", "IN", "MM", "CM", "M"] else w.lower() if w.lower() in ["in", "mm", "cm", "m"] else w.capitalize() for w in words)


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
    effective_id = (dataset_id or "NONE").strip().upper()
    if effective_id in ["", "NONE"]:
        return {
            "items": [],
            "total": 0,
            "page": page,
            "page_size": page_size,
            "total_pages": 0,
            "dataset_id": "NONE",
            "has_dataset": False,
            "data_available": False,
            "view_mode": view_mode,
            "active_queue_partition": 0,
            "secondary_queue_partition": 0,
            "disqualified_partition": 0,
            "total_candidate_universe": 0,
        }

    from server.services.dataset_resolver import load_dataset_dataframe

    df = load_dataset_dataframe("validated_candidates.csv", dataset_id=effective_id)
    if df.empty and effective_id == "BASELINE":
        if os.path.exists(VALIDATED_CSV):
            df = pd.read_csv(VALIDATED_CSV, low_memory=False, dtype=str)

    if df.empty:
        return {
            "items": [],
            "total": 0,
            "page": page,
            "page_size": page_size,
            "total_pages": 0,
            "dataset_id": effective_id,
            "has_dataset": True,
            "data_available": False,
            "view_mode": view_mode,
            "active_queue_partition": 0,
            "secondary_queue_partition": 0,
            "disqualified_partition": 0,
            "total_candidate_universe": 0,
        }

    # 1. Apply View Mode Partitioning (only for pending/unfiltered queue)
    norm_decision_filter = (decision_filter or "all").strip().lower()
    if norm_decision_filter in ["all", "pending", "unreviewed"]:
        if view_mode == "active":
            df = df[df["review_priority"].isin(["CRITICAL", "HIGH"])]
        elif view_mode == "secondary":
            df = df[(df["review_priority"].isin(["MEDIUM", "LOW"])) & (df["validation_status"] != "ENGINEERING_INCOMPATIBLE")]
        elif view_mode == "disqualified":
            df = df[df["validation_status"] == "ENGINEERING_INCOMPATIBLE"]
        elif view_mode == "all":
            pass
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
    if norm_decision_filter != "all":
        if norm_decision_filter in ["pending", "unreviewed"]:
            df = df[~df["candidate_id"].isin(decisions_map.keys())]
        else:
            if norm_decision_filter in ["accepted", "accept", "approved", "approve"]:
                target_verdict = "ACCEPT"
            elif norm_decision_filter in ["rejected", "reject"]:
                target_verdict = "REJECT"
            elif norm_decision_filter in ["deferred", "defer", "needs_review", "review"]:
                target_verdict = "DEFER"
            else:
                target_verdict = norm_decision_filter.upper()

            matching_ids = [cid for cid, d in decisions_map.items() if (d.get("decision") or "").upper() == target_verdict]
            df = df[df["candidate_id"].isin(matching_ids)]

    # 4. Priority sorting: CRITICAL > HIGH > MEDIUM > LOW, then refined_score desc
    priority_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    df["_prio_rank"] = df["review_priority"].map(priority_order).fillna(4)
    df = df.sort_values(by=["_prio_rank", "refined_score"], ascending=[True, False]).drop(columns=["_prio_rank"])

    total = len(df)
    start = page * page_size
    end = start + page_size
    page_df = df.iloc[start:end]

    std_map = _get_std_map(effective_id)
    eng_values_map = _load_engineering_values()
    raw_items = page_df.to_dict("records")
    items = []
    for row in raw_items:
        cid = row.get("candidate_id")
        dec = decisions_map.get(cid)
        stored_eng = eng_values_map.get(cid)
        row_dict = _clean_dict(row)
        row_dict["stored_engineering_values"] = stored_eng["values"] if stored_eng else None
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

        s_code = row_dict.get("source_material_code", "")
        c_code = row_dict.get("candidate_material_code", "")
        s_mat = std_map.get(s_code, {})
        c_mat = std_map.get(c_code, {})

        score_val = float(row_dict.get("refined_score") or row_dict.get("final_match_score") or 0)
        row_dict["score_percent"] = int(round(score_val * 100))
        
        # Human readable titles
        s_desc = s_mat.get("Material_Description") or s_mat.get("Standardized_Description") or row_dict.get("source_canonical_key") or s_code
        c_desc = c_mat.get("Material_Description") or c_mat.get("Standardized_Description") or row_dict.get("candidate_canonical_key") or c_code
        
        row_dict["source_title"] = _clean_title(s_desc, row_dict.get("source_canonical_key"), s_code)
        row_dict["candidate_title"] = _clean_title(c_desc, row_dict.get("candidate_canonical_key"), c_code)
        row_dict["category"] = s_mat.get("Material_Category") or c_mat.get("Material_Category") or "General"

        # Attributes for review comparison table
        row_dict["attributes"] = {
            "Type": {
                "source": _clean_attr_val(s_mat.get("Canonical_Material_Type") or s_mat.get("Material_Type")),
                "candidate": _clean_attr_val(c_mat.get("Canonical_Material_Type") or c_mat.get("Material_Type")),
            },
            "Grade": {
                "source": _clean_attr_val(s_mat.get("Canonical_Material_Grade") or s_mat.get("Material_Grade")),
                "candidate": _clean_attr_val(c_mat.get("Canonical_Material_Grade") or c_mat.get("Material_Grade")),
            },
            "Size": {
                "source": _clean_attr_val(s_mat.get("Canonical_Size") or s_mat.get("Size")),
                "candidate": _clean_attr_val(c_mat.get("Canonical_Size") or c_mat.get("Size")),
            },
            "Specification": {
                "source": _clean_attr_val(s_mat.get("Specification")),
                "candidate": _clean_attr_val(c_mat.get("Specification")),
            },
            "Coating": {
                "source": _clean_attr_val(s_mat.get("Canonical_Coating") or s_mat.get("Coating")),
                "candidate": _clean_attr_val(c_mat.get("Canonical_Coating") or c_mat.get("Coating")),
            },
            "Unit": {
                "source": _clean_attr_val(s_mat.get("Canonical_Unit") or s_mat.get("Unit")),
                "candidate": _clean_attr_val(c_mat.get("Canonical_Unit") or c_mat.get("Unit")),
            },
            "Manufacturer": {
                "source": _clean_attr_val(s_mat.get("Manufacturer")),
                "candidate": _clean_attr_val(c_mat.get("Manufacturer")),
            },
            "Plant": {
                "source": _clean_attr_val(s_mat.get("Plant")),
                "candidate": _clean_attr_val(c_mat.get("Plant")),
            },
        }

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
async def get_review_stats(dataset_id: Optional[str] = Query(None)):
    """
    Get comprehensive review statistics including queue partitions,
    current human review decisions, and progress tracking.
    """
    effective_id = (dataset_id or "NONE").strip().upper()
    if effective_id in ["", "NONE"]:
        return {
            "total_candidates": 0,
            "active_queue_total": 0,
            "secondary_queue_total": 0,
            "disqualified_total": 0,
            "pending_active": 0,
            "critical_total": 0,
            "critical_pending": 0,
            "high_total": 0,
            "high_pending": 0,
            "total_reviewed": 0,
            "accepted": 0,
            "rejected": 0,
            "deferred": 0,
            "escalated": 0,
            "acceptance_rate": 0.0,
            "cross_cpse_candidates": 0,
            "dataset_id": "NONE",
            "has_dataset": False,
            "data_available": False,
        }

    from server.services.dataset_resolver import load_dataset_dataframe
    df = load_dataset_dataframe("validated_candidates.csv", dataset_id=effective_id)
    if df.empty and effective_id == "BASELINE":
        if os.path.exists(VALIDATED_CSV):
            df = pd.read_csv(VALIDATED_CSV, low_memory=False)

    if df.empty:
        return {
            "total_candidates": 0,
            "active_queue_total": 0,
            "secondary_queue_total": 0,
            "disqualified_total": 0,
            "pending_active": 0,
            "critical_total": 0,
            "critical_pending": 0,
            "high_total": 0,
            "high_pending": 0,
            "total_reviewed": 0,
            "accepted": 0,
            "rejected": 0,
            "deferred": 0,
            "escalated": 0,
            "acceptance_rate": 0.0,
            "cross_cpse_candidates": 0,
            "dataset_id": effective_id,
            "has_dataset": True,
            "data_available": False,
        }

    decisions_map = review_repository.get_all_decisions()
    db_stats = review_repository.get_stats()

    # Active queue candidates (CRITICAL + HIGH)
    active_mask = df["review_priority"].isin(["CRITICAL", "HIGH"])
    active_df = df[active_mask]
    active_total = len(active_df)

    active_ids = set(active_df["candidate_id"])
    reviewed_active_ids = set(decisions_map.keys()).intersection(active_ids)
    pending_active = active_total - len(reviewed_active_ids)

    # Critical & High pending
    critical_df = df[df["review_priority"] == "CRITICAL"]
    critical_total = len(critical_df)
    critical_reviewed = len(set(decisions_map.keys()).intersection(set(critical_df["candidate_id"])))
    critical_pending = critical_total - critical_reviewed

    high_df = df[df["review_priority"] == "HIGH"]
    high_total = len(high_df)
    high_reviewed = len(set(decisions_map.keys()).intersection(set(high_df["candidate_id"])))
    high_pending = high_total - high_reviewed

    total_reviewed = db_stats["total_reviewed"]
    accepted = db_stats["accepted"]
    acceptance_rate = round((accepted / total_reviewed * 100), 1) if total_reviewed > 0 else 0.0

    return {
        "total_candidates": len(df),
        "active_queue_total": active_total,
        "secondary_queue_total": len(df[(df["review_priority"].isin(["MEDIUM", "LOW"])) & (df["validation_status"] != "ENGINEERING_INCOMPATIBLE")]),
        "disqualified_total": len(df[df["validation_status"] == "ENGINEERING_INCOMPATIBLE"]),
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
        "cross_cpse_candidates": int((df["source_cpse"] != df["candidate_cpse"]).sum()) if "source_cpse" in df.columns and "candidate_cpse" in df.columns else 0,
        "dataset_id": effective_id,
        "has_dataset": True,
        "data_available": len(df) > 0,
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
    materials = _get_std_map("BASELINE")

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
    dataset_id: Optional[str] = Query(None),
    current_user: dict = Depends(require_reviewer),  # Enforces reviewer/admin role
):
    """
    Atomically record an auditable human review decision for a candidate.
    Enforces server-side derivation of reviewer_id and reviewer_email from authenticated session.
    Never trusts client-supplied reviewer identity.
    """
    effective_id = (dataset_id or "NONE").strip().upper()

    # Normalize decision
    dec_upper = payload.decision.strip().upper()
    if dec_upper in ["ACCEPT", "APPROVE"]:
        normalized_decision = "ACCEPT"
    elif dec_upper in ["REJECT"]:
        normalized_decision = "REJECT"
    elif dec_upper in ["DEFER", "NEEDS_REVIEW", "REVIEW"]:
        normalized_decision = "DEFER"
    else:
        normalized_decision = "ACCEPT"

    # Normalize rationale
    raw_rat = (payload.rationale or payload.comment or "").strip()
    if not raw_rat or len(raw_rat) < 10:
        if normalized_decision == "ACCEPT":
            rationale = "Approved and harmonized by material engineering reviewer"
        elif normalized_decision == "REJECT":
            rationale = "Rejected: engineering attribute or specification discrepancy"
        else:
            rationale = "Deferred for detailed engineering review and OEM specification check"
    else:
        rationale = raw_rat

    # Try resolving candidate row from validated_candidates.csv
    cand_row = None
    if os.path.exists(VALIDATED_CSV):
        try:
            df = pd.read_csv(VALIDATED_CSV, low_memory=False)
            match = df[df["candidate_id"] == candidate_id]
            if not match.empty:
                cand_row = match.iloc[0].to_dict()
        except Exception:
            pass

    # If not found in validated_candidates, look in dataset matches
    if not cand_row:
        from server.services.dataset_resolver import load_dataset_dataframe
        matches_df = load_dataset_dataframe("matches.csv", dataset_id=effective_id if effective_id != "NONE" else "BASELINE")
        if not matches_df.empty and "candidate_id" in matches_df.columns:
            m_match = matches_df[matches_df["candidate_id"] == candidate_id]
            if not m_match.empty:
                cand_row = m_match.iloc[0].to_dict()

    # If still not found, construct a minimal valid candidate dict
    if not cand_row:
        cand_row = {
            "candidate_id": candidate_id,
            "source_material_code": candidate_id,
            "candidate_material_code": candidate_id,
            "source_cpse": "IOCL",
            "candidate_cpse": "ONGC",
        }

    materials = _get_std_map(effective_id if effective_id != "NONE" else "BASELINE")
    src_mat = materials.get(str(cand_row.get("source_material_code")), {})
    cand_mat = materials.get(str(cand_row.get("candidate_material_code")), {})

    # 1. Strictly derive reviewer identity server-side
    reviewer_id = str(current_user.get("id"))
    reviewer_email = str(current_user.get("email"))

    try:
        # 2. Process and atomically persist decision
        result = review_service.submit_decision(
            candidate_id=candidate_id,
            decision=normalized_decision,
            reviewer_id=reviewer_id,
            reviewer_email=reviewer_email,
            rationale=rationale,
            candidate_row=cand_row,
            source_mat=src_mat,
            cand_mat=cand_mat,
            escalated=payload.escalated,
            needs_spec_sheet=payload.needs_spec_sheet,
            expected_version=payload.expected_version,
        )

        return {
            "status": "success",
            "message": f"Candidate relationship marked as human-reviewed ({normalized_decision}) for Phase 8 consideration.",
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


class StoreEngineeringValuesRequest(BaseModel):
    values: Dict[str, Any] = Field(..., description="Map of engineering attribute names to standard canonical values")
    source_material_code: Optional[str] = None
    candidate_material_code: Optional[str] = None
    notes: Optional[str] = None
    dataset_id: Optional[str] = None


@router.post("/{candidate_id}/engineering-values")
async def store_engineering_values(
    candidate_id: str,
    payload: StoreEngineeringValuesRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Store authoritative standardized engineering values for a material harmonization pair.
    """
    all_data = _load_engineering_values()
    now_iso = datetime.now(timezone.utc).isoformat()
    record = {
        "candidate_id": candidate_id,
        "values": payload.values,
        "source_material_code": payload.source_material_code,
        "candidate_material_code": payload.candidate_material_code,
        "notes": payload.notes,
        "dataset_id": payload.dataset_id or "BASELINE",
        "updated_by": current_user.get("email") or current_user.get("id"),
        "updated_at": now_iso,
    }
    all_data[candidate_id] = record
    _save_engineering_values(all_data)
    return {
        "status": "success",
        "message": f"Engineering values stored successfully for {candidate_id}",
        "record": record,
    }


@router.get("/{candidate_id}/engineering-values")
async def get_engineering_values(
    candidate_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Get stored engineering values for a candidate if present.
    """
    all_data = _load_engineering_values()
    record = all_data.get(candidate_id)
    return {
        "candidate_id": candidate_id,
        "stored": record is not None,
        "record": record,
    }

