"""
Confidence Service (Phase 6)
Confidence refinement, technical review priority scoring, and explainable review evidence generation.
Strictly excludes procurement metadata from technical review priority calculations.
"""

from typing import Dict, Any, List


class ConfidenceService:
    """Service for refining confidence scores and assigning technical review priorities"""

    def __init__(self):
        pass

    def refine_candidate(
        self,
        validation_res: Dict[str, Any],
        candidate_row: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Refine candidate match confidence, assign technical review priority,
        and generate explainable review evidence.
        """
        base_score = float(candidate_row.get("final_match_score", 0.0))
        status = validation_res["validation_status"]
        conflict_class = validation_res["engineering_conflict_class"]
        reason_codes = validation_res["reason_codes"]
        source_cpse = str(candidate_row.get("source_cpse", ""))
        candidate_cpse = str(candidate_row.get("candidate_cpse", ""))
        is_cross_cpse = (source_cpse != candidate_cpse)
        has_upstream_conflict = validation_res["upstream_conflict_present"] or validation_res["upstream_conflict_preserved"]

        # 1. Refined Score Calculation & Capping
        if status == "ENGINEERING_INCOMPATIBLE":
            # Strict Hard Cap: Must never exceed 0.399 and must never be HIGH or MEDIUM
            refined_score = round(min(0.39, max(0.0, base_score - 0.50)), 4)
            refined_confidence = "LOW"
        elif status == "INSUFFICIENT_EVIDENCE":
            refined_score = round(min(0.49, max(0.0, base_score - 0.20)), 4)
            refined_confidence = "LOW"
        elif status == "REVIEW_REQUIRED":
            refined_score = round(min(0.79, max(0.40, base_score - 0.15)), 4)
            refined_confidence = "MEDIUM"
        elif status == "PROBABLE_COMPATIBLE":
            refined_score = round(min(0.95, max(0.65, base_score)), 4)
            refined_confidence = "HIGH" if refined_score >= 0.85 else "MEDIUM"
        elif status == "VALIDATED_COMPATIBLE":
            refined_score = round(max(0.85, min(1.0, base_score)), 4)
            refined_confidence = "HIGH"
        else:
            refined_score = round(base_score, 4)
            refined_confidence = "LOW"

        # 2. Purely Technical Review Priority Assignment (No Procurement Data)
        if status == "ENGINEERING_INCOMPATIBLE" or status == "INSUFFICIENT_EVIDENCE":
            # Disqualified or unviable matches do not require urgent human triage
            review_priority = "LOW"
        elif is_cross_cpse and (status == "REVIEW_REQUIRED" or has_upstream_conflict):
            # Critical engineering ambiguity across enterprises
            review_priority = "CRITICAL"
        elif is_cross_cpse and (status in ("PROBABLE_COMPATIBLE", "VALIDATED_COMPATIBLE")):
            # High-impact cross-enterprise harmonization candidates
            review_priority = "HIGH"
        elif not is_cross_cpse and status == "REVIEW_REQUIRED":
            # Internal CPSE soft difference
            review_priority = "MEDIUM"
        else:
            review_priority = "MEDIUM" if status == "VALIDATED_COMPATIBLE" else "LOW"

        # 3. Explainable Review Evidence Text
        evidence_parts = [
            f"Status: {status} ({conflict_class})",
            f"Refined Score: {refined_score:.3f} [{refined_confidence}]",
            f"Priority: {review_priority}",
            f"Reasons: [{', '.join(reason_codes)}]" if reason_codes else "Reasons: None",
        ]

        if validation_res["hard_conflict_reasons"]:
            evidence_parts.append(f"Hard Incompatibilities: {'; '.join(validation_res['hard_conflict_reasons'])}")
        if validation_res["soft_difference_reasons"]:
            evidence_parts.append(f"Soft Differences: {'; '.join(validation_res['soft_difference_reasons'])}")
        if validation_res["repr_difference_reasons"]:
            evidence_parts.append(f"Representational Variations: {'; '.join(validation_res['repr_difference_reasons'])}")
        if has_upstream_conflict:
            evidence_parts.append(f"Upstream Conflict Preserved: {validation_res.get('upstream_conflict_details', 'Flagged in Phase 3/4')}")

        evidence_parts.append("Candidate evidence only; final common master identity deferred to human review.")
        validation_evidence = " | ".join(evidence_parts)

        return {
            "refined_score": refined_score,
            "refined_confidence": refined_confidence,
            "review_priority": review_priority,
            "validation_evidence": validation_evidence,
            "is_cross_cpse": is_cross_cpse,
        }


confidence_service = ConfidenceService()
