"""
Review Export Pipeline Stage (Phase 7 Handoff to Phase 8)
Exports all human-reviewed ACCEPTED candidate relationships to:
data/processed/accepted_harmonization_pairs.csv

This export is the Phase 8 handoff only.
Does NOT perform grouping, clustering, or Common Material Master creation.
"""

import os
import json
import time
import hashlib
import pandas as pd
from typing import Dict, Any, List

from app.db.review_repository import review_repository


def compute_sha256(file_path: str) -> str:
    """Compute SHA256 checksum of a file"""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def export_accepted_relationships(output_path: str = None) -> Dict[str, Any]:
    """
    Export all human-accepted candidate pairs for downstream Phase 8 consideration.
    """
    workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    validated_path = os.path.join(workspace_root, "data", "processed", "validated_candidates.csv")
    if output_path is None:
        output_path = os.path.join(workspace_root, "data", "processed", "accepted_harmonization_pairs.csv")

    if not os.path.exists(validated_path):
        raise FileNotFoundError(f"Missing validated candidates file: {validated_path}")

    # 1. Fetch all ACCEPTED decisions from transactional store
    accepted_decisions = review_repository.get_accepted_pairs()
    accepted_by_id = {d["candidate_id"]: d for d in accepted_decisions}

    # 2. Load validated candidates
    df_val = pd.read_csv(validated_path, low_memory=False)

    # 3. Filter to accepted rows
    if accepted_by_id:
        df_accepted = df_val[df_val["candidate_id"].isin(accepted_by_id.keys())].copy()
        # Overlay review metadata
        df_accepted["human_reviewer_id"] = df_accepted["candidate_id"].map(lambda cid: accepted_by_id[cid]["reviewer_id"])
        df_accepted["human_reviewer_email"] = df_accepted["candidate_id"].map(lambda cid: accepted_by_id[cid]["reviewer_email"])
        df_accepted["human_rationale"] = df_accepted["candidate_id"].map(lambda cid: accepted_by_id[cid]["rationale"])
        df_accepted["human_reviewed_at"] = df_accepted["candidate_id"].map(lambda cid: accepted_by_id[cid]["updated_at"])
        df_accepted["evidence_snapshot_hash"] = df_accepted["candidate_id"].map(lambda cid: accepted_by_id[cid]["evidence_snapshot_hash"])
        df_accepted["decision_version"] = df_accepted["candidate_id"].map(lambda cid: accepted_by_id[cid]["version"])
    else:
        # Create empty DataFrame with proper schema if no reviews completed yet
        cols = list(df_val.columns) + [
            "human_reviewer_id", "human_reviewer_email", "human_rationale",
            "human_reviewed_at", "evidence_snapshot_hash", "decision_version"
        ]
        df_accepted = pd.DataFrame(columns=cols)

    df_accepted.to_csv(output_path, index=False)
    output_sha256 = compute_sha256(output_path)

    return {
        "status": "completed",
        "output_file": output_path,
        "accepted_count": len(df_accepted),
        "output_sha256": output_sha256,
        "handoff_target": "Phase 8 Common Material Master Candidate Grouping",
    }


if __name__ == "__main__":
    res = export_accepted_relationships()
    print("Exported accepted relationships:", res)
