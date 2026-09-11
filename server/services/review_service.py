"""
Review Service (Phase 7)
Business logic for Phase 7 Human Review / Expert Validation.
Compiles 4-layer technical evidence packages, generates deterministic canonical JSON
SHA-256 evidence snapshot fingerprints, validates decision rules and rationales.
"""

import os
import json
import hashlib
from typing import Dict, Any, List, Optional

from app.db.review_repository import review_repository, StaleVersionError, RepositoryError

# All 21 canonical engineering attributes
ALL_21_ATTRIBUTES = [
    "material_family",
    "material_type",
    "material_subtype",
    "material",
    "material_grade",
    "nominal_size",
    "size",
    "length",
    "width",
    "height",
    "diameter",
    "thickness",
    "pressure_class",
    "schedule",
    "rating",
    "standard",
    "coating",
    "connection_type",
    "end_type",
    "construction",
    "orientation",
]


class ValidationError(Exception):
    """Raised when decision parameters or rationale fail validation"""
    pass


class ReviewService:
    """Service for Phase 7 human review workflow and evidence snapshot packaging"""

    def __init__(self):
        pass

    def compute_canonical_evidence_hash(self, evidence_package: Dict[str, Any]) -> str:
        """
        Produce a deterministic cryptographic fingerprint of the exact evidence package
        used during the review event, enabling later integrity verification.
        Uses canonical JSON serialization with sorted keys.
        """
        canonical_json = json.dumps(evidence_package, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()

    def build_evidence_package(
        self,
        candidate_row: Dict[str, Any],
        source_mat: Optional[Dict[str, Any]] = None,
        cand_mat: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Compile the complete 4-layer evidence package shown to the reviewer.
        Deterministic and complete.
        """
        source_mat = source_mat or {}
        cand_mat = cand_mat or {}

        # Layer 1: Source Material Profile
        source_attrs = {}
        for attr in ALL_21_ATTRIBUTES:
            col = f"Canonical_{'_'.join([p.capitalize() for p in attr.split('_')])}"
            val = source_mat.get(col)
            if val is not None and str(val).strip() and str(val).strip().upper() != "NAN":
                source_attrs[attr] = str(val).strip()

        source_profile = {
            "cpse": candidate_row.get("source_cpse"),
            "material_code": candidate_row.get("source_material_code"),
            "raw_description": source_mat.get("Raw_Description") or source_mat.get("Description"),
            "standardized_description": source_mat.get("Standardized_Description"),
            "canonical_material_key": candidate_row.get("source_canonical_key") or source_mat.get("Canonical_Material_Key"),
            "material_family": source_mat.get("Canonical_Material_Family"),
            "material_type": source_mat.get("Canonical_Material_Type"),
            "plant": source_mat.get("Plant"),
            "manufacturer": source_mat.get("Canonical_Manufacturer"),
            "manufacturer_part_no": source_mat.get("Canonical_Manufacturer_Part_No"),
            "unit": source_mat.get("Canonical_Unit"),
            "attributes": source_attrs,
        }

        # Layer 2: Candidate Material Profile
        cand_attrs = {}
        for attr in ALL_21_ATTRIBUTES:
            col = f"Canonical_{'_'.join([p.capitalize() for p in attr.split('_')])}"
            val = cand_mat.get(col)
            if val is not None and str(val).strip() and str(val).strip().upper() != "NAN":
                cand_attrs[attr] = str(val).strip()

        candidate_profile = {
            "cpse": candidate_row.get("candidate_cpse"),
            "material_code": candidate_row.get("candidate_material_code"),
            "raw_description": cand_mat.get("Raw_Description") or cand_mat.get("Description"),
            "standardized_description": cand_mat.get("Standardized_Description"),
            "canonical_material_key": candidate_row.get("candidate_canonical_key") or cand_mat.get("Canonical_Material_Key"),
            "material_family": cand_mat.get("Canonical_Material_Family"),
            "material_type": cand_mat.get("Canonical_Material_Type"),
            "plant": cand_mat.get("Plant"),
            "manufacturer": cand_mat.get("Canonical_Manufacturer"),
            "manufacturer_part_no": cand_mat.get("Canonical_Manufacturer_Part_No"),
            "unit": cand_mat.get("Canonical_Unit"),
            "attributes": cand_attrs,
        }

        # Attribute-level comparison / diff matrix
        attribute_diff = {}
        for attr in ALL_21_ATTRIBUTES:
            s_val = source_attrs.get(attr)
            c_val = cand_attrs.get(attr)
            similarity = candidate_row.get(f"{attr}_similarity")
            attribute_diff[attr] = {
                "source": s_val,
                "candidate": c_val,
                "similarity": similarity if similarity is not None and str(similarity).strip() != "nan" else None,
                "status": (
                    "MATCH" if s_val and c_val and s_val == c_val
                    else "DIFF" if s_val and c_val
                    else "PARTIAL" if s_val or c_val
                    else "NEUTRAL"
                ),
            }

        # Layer 3: Phase 5 Matching Evidence
        matching_evidence = {
            "embedding_similarity": float(candidate_row.get("embedding_similarity", 0.0)),
            "description_similarity": float(candidate_row.get("description_similarity", 0.0)),
            "attribute_agreement": float(candidate_row.get("attribute_agreement", 0.0)),
            "canonical_key_exact": bool(
                candidate_row.get("canonical_key_exact", False)
                or str(candidate_row.get("canonical_key_exact", "")).lower() == "true"
            ),
            "blocking_strategies": str(candidate_row.get("blocking_strategies", "")),
            "candidate_rank": int(candidate_row.get("candidate_rank", 1)),
            "phase5_score": float(candidate_row.get("final_match_score", 0.0)),
        }

        # Layer 4: Phase 6 Technical Validation Evidence
        validation_evidence = {
            "validation_status": str(candidate_row.get("validation_status", "")),
            "refined_score": float(candidate_row.get("refined_score", 0.0)),
            "refined_confidence": str(candidate_row.get("refined_confidence", "")),
            "review_priority": str(candidate_row.get("review_priority", "")),
            "engineering_conflict_class": str(candidate_row.get("engineering_conflict_class", "")),
            "validation_reason_codes": str(candidate_row.get("validation_reason_codes", "")).split(";"),
            "upstream_conflict_present": bool(
                candidate_row.get("upstream_conflict_present", False)
                or str(candidate_row.get("upstream_conflict_present", "")).lower() == "true"
            ),
            "upstream_conflict_details": str(candidate_row.get("upstream_conflict_details") or ""),
            "upstream_conflict_preserved": bool(
                candidate_row.get("upstream_conflict_preserved", False)
                or str(candidate_row.get("upstream_conflict_preserved", "")).lower() == "true"
            ),
            "evidence_summary": str(candidate_row.get("validation_evidence") or candidate_row.get("evidence_summary") or ""),
        }

        return {
            "candidate_id": candidate_row.get("candidate_id"),
            "source_profile": source_profile,
            "candidate_profile": candidate_profile,
            "attribute_diff": attribute_diff,
            "matching_evidence": matching_evidence,
            "validation_evidence": validation_evidence,
        }

    def validate_decision_input(self, decision: str, rationale: str) -> None:
        """Validate review decision verdict and rationale stringency"""
        valid_decisions = {"ACCEPT", "REJECT", "DEFER"}
        if decision not in valid_decisions:
            raise ValidationError(f"Invalid decision '{decision}'. Must be one of {valid_decisions}")

        if not rationale or not rationale.strip():
            raise ValidationError("Technical review rationale is mandatory and cannot be empty")

        clean_rat = rationale.strip()
        if decision in ("REJECT", "DEFER") and len(clean_rat) < 10:
            raise ValidationError(
                f"A detailed technical rationale (at least 10 characters) is required when decision is {decision}"
            )

    def submit_decision(
        self,
        candidate_id: str,
        decision: str,
        reviewer_id: str,
        reviewer_email: str,
        rationale: str,
        candidate_row: Dict[str, Any],
        source_mat: Optional[Dict[str, Any]] = None,
        cand_mat: Optional[Dict[str, Any]] = None,
        escalated: bool = False,
        needs_spec_sheet: bool = False,
        expected_version: Optional[int] = None,
        force_fail_event: bool = False,
    ) -> Dict[str, Any]:
        """
        Process and atomically record an auditable human review decision.
        """
        # 1. Validate decision rules
        self.validate_decision_input(decision, rationale)

        # 2. Build complete 4-layer evidence package
        evidence_package = self.build_evidence_package(candidate_row, source_mat, cand_mat)

        # 3. Compute deterministic cryptographic fingerprint
        evidence_snapshot_hash = self.compute_canonical_evidence_hash(evidence_package)

        # 4. Atomically persist to repository
        src_code = str(candidate_row.get("source_material_code", ""))
        cand_code = str(candidate_row.get("candidate_material_code", ""))

        result = review_repository.record_decision_atomic(
            candidate_id=candidate_id,
            source_material_code=src_code,
            candidate_material_code=cand_code,
            decision=decision,
            reviewer_id=reviewer_id,
            reviewer_email=reviewer_email,
            rationale=rationale.strip(),
            escalated=escalated,
            needs_spec_sheet=needs_spec_sheet,
            evidence_snapshot_hash=evidence_snapshot_hash,
            expected_version=expected_version,
            force_fail_event=force_fail_event,
        )

        return {
            **result,
            "evidence_snapshot_hash": evidence_snapshot_hash,
            "evidence_package": evidence_package,
        }


review_service = ReviewService()
