"""
NMC Cross-CPSE Matching Service
Coordinates cross-CPSE candidate generation, semantic embedding comparison,
attribute agreement scoring, and engineering rule validation.
"""

import logging
from typing import Dict, Any, List
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


def _get_services():
    try:
        from services.embedding_service import embedding_service
        from services.matching_service import matching_service
    except ImportError:
        from server.services.embedding_service import embedding_service
        from server.services.matching_service import matching_service
    return embedding_service, matching_service


def _get_repo():
    try:
        from app.db.nmc_repository import nmc_repo
    except ImportError:
        from server.app.db.nmc_repository import nmc_repo
    return nmc_repo


def run_cross_cpse_matching() -> Dict[str, Any]:
    """
    Executes cross-CPSE material matching:
    1. Checks normalization readiness across all active CPSEs.
    2. Retrieves all normalized materials.
    3. Encodes materials with embeddings.
    4. Generates candidate pairs using multi-block heuristics.
    5. Scores cross-CPSE pairs and persists MaterialMatch records.
    6. Logs audit trail.
    """
    repo = _get_repo()
    embedding_svc, matching_svc = _get_services()

    # Step 1: Readiness check
    readiness = repo.get_normalization_readiness()
    if not readiness.get("all_ready", False):
        raise ValueError(
            f"Not all CPSEs are ready for matching. Pending CPSEs: {readiness.get('pending_cpses')}"
        )

    # Step 2: Audit start
    repo.create_audit_log(
        actor="System",
        action="MATCHING_STARTED",
        metadata={"total_cpses": readiness.get("total")},
    )

    # Step 3: Fetch all normalized materials
    materials = repo.get_all_normalized_materials()
    if len(materials) < 2:
        repo.create_audit_log(
            actor="System",
            action="MATCHING_COMPLETED",
            metadata={"pairs_generated": 0, "status": "insufficient_materials"},
        )
        return {
            "status": "COMPLETED",
            "pairs_generated": 0,
            "message": "Fewer than 2 normalized materials available for matching.",
        }

    # CPSE lookup for code
    cpses = repo.get_all_cpses()
    cpse_map = {c["id"]: c["code"] for c in cpses}

    # Step 4: Build DataFrame for matching service
    rows = []
    texts_to_embed = []

    for m in materials:
        attrs = m.get("attributes") or {}
        std_desc = m.get("standardized_description") or m.get("normalized_description") or m.get("original_description") or ""
        row = {
            "id": m["id"],
            "cpse_id": m["cpse_id"],
            "CPSE": cpse_map.get(m["cpse_id"], "UNKNOWN"),
            "Material_Code": m.get("original_material_code") or m["id"],
            "Material_Description": m.get("original_description") or "",
            "Standardized_Description": std_desc,
            "Canonical_Material_Family": m.get("material_family") or attrs.get("material_family") or "",
            "Canonical_Material_Type": m.get("material_type") or attrs.get("material_type") or "",
            "Canonical_Material_Subtype": attrs.get("material_subtype") or "",
            "Canonical_Material": attrs.get("material") or "",
            "Canonical_Material_Grade": m.get("grade") or attrs.get("material_grade") or "",
            "Canonical_Size": m.get("dimensions") or attrs.get("size") or "",
            "Canonical_Length": attrs.get("length") or "",
            "Canonical_Diameter": attrs.get("diameter") or "",
            "Canonical_Pressure_Class": attrs.get("pressure_class") or "",
            "Canonical_Standard": m.get("specifications") or attrs.get("standard") or "",
            "Canonical_Coating": attrs.get("coating") or "",
            "Canonical_Connection_Type": attrs.get("connection_type") or "",
            "Canonical_Construction": attrs.get("construction") or "",
            "Canonical_Orientation": attrs.get("orientation") or "",
            "Canonical_Material_Key": attrs.get("canonical_key") or "",
            "extraction_conflicts_detail": attrs.get("_conflicts_detail") or "",
        }
        rows.append(row)
        texts_to_embed.append(embedding_svc.build_engineering_text(row))

    df = pd.DataFrame(rows)

    # Step 5: Encode embeddings
    embeddings = embedding_svc.encode_texts(texts_to_embed)

    # Step 6: Generate candidate pairs using union blocking
    pair_blocks = matching_svc.generate_candidate_pairs(df)

    # Step 7: Clear old matches before writing new run
    repo.clear_all_matches()

    # Step 8: Score cross-CPSE candidate pairs
    matches_to_insert: List[Dict[str, Any]] = []

    for (idx1, idx2), blocks in pair_blocks.items():
        row1 = df.iloc[idx1]
        row2 = df.iloc[idx2]

        # Strictly cross-CPSE: materials must originate from different CPSEs
        if row1["cpse_id"] == row2["cpse_id"]:
            continue

        desc1_clean = str(row1.get("Material_Description") or "").strip()
        desc2_clean = str(row2.get("Material_Description") or "").strip()
        if not desc1_clean or not desc2_clean:
            continue

        emb1 = embeddings[idx1]
        emb2 = embeddings[idx2]

        res = matching_svc.calculate_match(
            row1.to_dict(),
            row2.to_dict(),
            emb1,
            emb2,
            blocks_applied=blocks,
        )

        score = res.get("final_match_score", 0.0)
        conf_label = res.get("confidence_level", "LOW")
        canonical_key_exact = res.get("canonical_key_exact", False)
        is_hard_incompatible = res.get("engineering_incompatibility", False)

        # Categorization rule: strict and honest
        if is_hard_incompatible or score < 0.55:
            category = "DIFFERENT"
            conf_label = "LOW"
        elif score >= 0.75 and canonical_key_exact and not is_hard_incompatible:
            category = "POTENTIALLY_SAME"
            conf_label = "HIGH"
        elif score >= 0.60 and not is_hard_incompatible:
            category = "POTENTIALLY_SAME"
            conf_label = "MEDIUM"
        else:
            category = "DIFFERENT"
            conf_label = "LOW"

        explanation = {
            "evidence_summary": res.get("evidence_summary"),
            "conflict_details": res.get("conflict_details"),
            "conflict_class": res.get("engineering_conflict_class"),
            "penalty_applied": res.get("penalty_applied", 0.0),
            "blocking_strategies": res.get("blocking_strategies"),
            "evaluated_attribute_count": res.get("evaluated_attribute_count", 0),
            "canonical_key_exact": canonical_key_exact,
        }

        matches_to_insert.append({
            "source_material_id": row1["id"],
            "candidate_material_id": row2["id"],
            "semantic_similarity": float(res.get("embedding_similarity", 0.0)),
            "text_similarity": float(res.get("description_similarity", 0.0)),
            "attribute_similarity": float(res.get("attribute_agreement", 0.0)),
            "rule_validation_status": "FAILED" if is_hard_incompatible else "PASSED",
            "final_confidence": float(score),
            "confidence_label": conf_label,
            "match_category": category,
            "status": "PENDING_REVIEW",  # Always PENDING — only reviewer decisions move status
            "explanation": explanation,
        })


    # Bulk insert
    inserted_count = 0
    if matches_to_insert:
        inserted_count = repo.bulk_create_matches(matches_to_insert)

    # Step 9: Audit complete
    repo.create_audit_log(
        actor="System",
        action="MATCHING_COMPLETED",
        metadata={
            "materials_count": len(materials),
            "pairs_evaluated": len(pair_blocks),
            "matches_created": inserted_count,
        },
    )

    logger.info("Matching run completed: %d matches created from %d candidate pairs", inserted_count, len(pair_blocks))

    return {
        "status": "COMPLETED",
        "materials_count": len(materials),
        "pairs_evaluated": len(pair_blocks),
        "matches_created": inserted_count,
    }
