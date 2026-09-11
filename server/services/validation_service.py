"""
Validation Service (Phase 6)
Deterministic technical validation of candidate material matches using engineering rules,
attribute-level precedence, 4-tier conflict hierarchy, and upstream conflict preservation.
"""

from typing import Dict, Any, List, Optional, Tuple
import re

CORE_ATTRIBUTES = [
    "material_family",
    "material_type",
    "material",
    "material_grade",
    "size",
    "nominal_size",
    "pressure_class",
    "standard",
    "rating",
]

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


class ValidationService:
    """Service for deterministic technical validation of material match candidates"""

    def __init__(self):
        pass

    def _normalize_attr(self, val: Any) -> Optional[str]:
        if val is None:
            return None
        s = str(val).strip().upper()
        if not s or s in ("NAN", "NONE", "NULL", "UNKNOWN", "N/A"):
            return None
        return s

    def _is_representation_equivalent(self, val1: str, val2: str) -> bool:
        """
        Check if two values represent the same physical entity with formatting/prefix variations
        e.g., ASTM A105 vs A105, SS 316 vs STAINLESS STEEL 316
        """
        if val1 == val2:
            return True

        # Remove common standard prefixes for comparison
        clean1 = re.sub(r'^(ASTM|ASME|IS|DIN|ISO|API|BS)\s+', '', val1)
        clean2 = re.sub(r'^(ASTM|ASME|IS|DIN|ISO|API|BS)\s+', '', val2)
        if clean1 == clean2:
            return True

        # Common material alias equivalence
        aliases = [
            ({"SS", "STAINLESS STEEL", "STAINLESS_STEEL"}),
            ({"CS", "CARBON STEEL", "CARBON_STEEL"}),
            ({"CI", "CAST IRON", "CAST_IRON"}),
            ({"MS", "MILD STEEL", "MILD_STEEL"}),
            ({"BRASS", "COPPER ALLOY"}),
        ]
        for group in aliases:
            if val1 in group and val2 in group:
                return True

        # Grade aliases
        grade_pairs = [
            ({"ASTM A105", "A105", "A-105"}),
            ({"ASTM A216 WCB", "A216 WCB", "WCB", "A216-WCB"}),
            ({"SS 316", "316", "AISI 316", "TP316", "SS-316", "GRADE 316"}),
            ({"SS 304", "304", "AISI 304", "TP304", "SS-304", "GRADE 304"}),
            ({"SS 316L", "316L", "AISI 316L", "TP316L", "SS-316L"}),
            ({"SS 304L", "304L", "AISI 304L", "TP304L", "SS-304L"}),
        ]
        for pair in grade_pairs:
            if val1 in pair and val2 in pair:
                return True

        return False

    def _is_soft_fastener_difference(self, val1: str, val2: str) -> bool:
        """
        Detect soft engineering differences in fasteners (e.g. M16 vs M16X75)
        where diameter matches but length is specified in only one.
        """
        # Match M<diam> against M<diam>X<length>
        patt = r'^M(\d+)(?:X(\d+))?$'
        m1 = re.match(patt, val1)
        m2 = re.match(patt, val2)
        if m1 and m2:
            diam1, len1 = m1.groups()
            diam2, len2 = m2.groups()
            if diam1 == diam2:
                # Same diameter, one has length omitted or different length
                return True
        return False

    def evaluate_candidate(
        self,
        candidate_row: Dict[str, Any],
        source_mat: Optional[Dict[str, Any]] = None,
        cand_mat: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Perform deterministic technical validation on a candidate pair.
        Preserves all upstream conflict evidence from Phase 3 & Phase 4.
        """
        source_mat = source_mat or {}
        cand_mat = cand_mat or {}

        # 1. Preserve upstream conflict flags strictly without modification
        conflict_present_upstream = bool(
            candidate_row.get("conflict_present", False)
            or str(candidate_row.get("conflict_present", "")).lower() == "true"
        )
        conflict_details_upstream = str(candidate_row.get("conflict_details") or "")
        std_conflict_preserved = bool(
            source_mat.get("Standardization_Conflict_Preserved", False)
            or cand_mat.get("Standardization_Conflict_Preserved", False)
        )

        # 2. Compare the 21 engineering attributes null-aware
        attr_agreements = 0
        attr_disagreements = 0
        co_populated_count = 0
        diff_attributes = []
        hard_conflict_reasons = []
        soft_difference_reasons = []
        repr_difference_reasons = []

        for attr in ALL_21_ATTRIBUTES:
            # Look in candidate_row per-attribute similarities or source/candidate record
            col_name = f"Canonical_{'_'.join([p.capitalize() for p in attr.split('_')])}"
            val1 = self._normalize_attr(source_mat.get(col_name))
            val2 = self._normalize_attr(cand_mat.get(col_name))

            if val1 is None or val2 is None:
                # NULL vs NULL or NULL vs Populated -> Neutral
                continue

            co_populated_count += 1
            if val1 == val2:
                attr_agreements += 1
            else:
                attr_disagreements += 1
                diff_attributes.append((attr, val1, val2))

                # Analyze attribute difference
                if self._is_representation_equivalent(val1, val2):
                    repr_difference_reasons.append(f"{attr}: '{val1}' ~= '{val2}' (Representation difference)")
                elif attr in ("size", "nominal_size") and self._is_soft_fastener_difference(val1, val2):
                    soft_difference_reasons.append(f"{attr}: '{val1}' vs '{val2}' (Fastener dimension partial)")
                else:
                    # Critical attribute check
                    if attr in ("material_family", "material_type"):
                        hard_conflict_reasons.append(f"Family/Type mismatch: {val1} vs {val2}")
                    elif attr in ("size", "nominal_size"):
                        hard_conflict_reasons.append(f"Size mismatch: {val1} vs {val2}")
                    elif attr in ("material_grade", "material"):
                        hard_conflict_reasons.append(f"Material/Grade mismatch: {val1} vs {val2}")
                    elif attr == "pressure_class":
                        hard_conflict_reasons.append(f"Pressure class mismatch: {val1} vs {val2}")
                    elif attr == "standard":
                        # If different standards
                        hard_conflict_reasons.append(f"Standard mismatch: {val1} vs {val2}")
                    else:
                        # Non-core attribute differences are soft differences
                        soft_difference_reasons.append(f"{attr} mismatch: {val1} vs {val2}")

        # Also incorporate Phase 5 candidate classification if available
        phase5_class = str(candidate_row.get("engineering_conflict_class") or "").strip().upper()
        if phase5_class == "HARD_INCOMPATIBLE" and not hard_conflict_reasons:
            hard_conflict_reasons.append("Phase 5 detected hard incompatibility")
        elif phase5_class == "SOFT_ENGINEERING_DIFFERENCE" and not soft_difference_reasons:
            soft_difference_reasons.append("Phase 5 detected soft engineering difference")
        elif phase5_class == "REPRESENTATION_DIFFERENCE" and not repr_difference_reasons:
            repr_difference_reasons.append("Phase 5 detected representation difference")

        # 3. Determine Overall Engineering Conflict Classification (Strict 4-Tier Hierarchy)
        if hard_conflict_reasons:
            conflict_class = "HARD_INCOMPATIBLE"
            is_incompatible = True
        elif soft_difference_reasons:
            conflict_class = "SOFT_ENGINEERING_DIFFERENCE"
            is_incompatible = False
        elif repr_difference_reasons:
            conflict_class = "REPRESENTATION_DIFFERENCE"
            is_incompatible = False
        else:
            conflict_class = "NO_CONFLICT"
            is_incompatible = False

        # 4. Generate Validation Reason Codes
        reason_codes = []
        is_exact_key = bool(
            candidate_row.get("canonical_key_exact", False)
            or str(candidate_row.get("canonical_key_exact", "")).lower() == "true"
        )
        if is_exact_key:
            reason_codes.append("EXACT_CANONICAL_KEY")

        if conflict_class == "NO_CONFLICT" and co_populated_count >= 3 and attr_disagreements == 0:
            reason_codes.append("CORE_ATTR_MATCH")

        if repr_difference_reasons:
            reason_codes.append("REPRESENTATION_COMPATIBLE")

        if any("Fastener dimension partial" in r for r in soft_difference_reasons):
            reason_codes.append("FASTENER_DIM_PARTIAL")
        elif soft_difference_reasons:
            reason_codes.append("SECONDARY_ATTR_DIFFERENCE")

        if any("Size mismatch" in r for r in hard_conflict_reasons):
            reason_codes.append("SIZE_MISMATCH")
        if any("Material/Grade mismatch" in r for r in hard_conflict_reasons):
            reason_codes.append("GRADE_MISMATCH")
        if any("Family/Type mismatch" in r for r in hard_conflict_reasons):
            reason_codes.append("FAMILY_MISMATCH")
        if any("Standard mismatch" in r for r in hard_conflict_reasons):
            reason_codes.append("STANDARD_MISMATCH")
        if any("Pressure class mismatch" in r for r in hard_conflict_reasons):
            reason_codes.append("RATING_MISMATCH")

        if conflict_present_upstream or std_conflict_preserved:
            reason_codes.append("UPSTREAM_CONFLICT_PRESERVED")

        if co_populated_count < 2 and not is_exact_key:
            reason_codes.append("SPARSE_ATTRIBUTES")

        # 5. Determine Validation Status
        # Hierarchy:
        # HARD_INCOMPATIBLE -> ENGINEERING_INCOMPATIBLE
        # SPARSE_ATTRIBUTES -> INSUFFICIENT_EVIDENCE
        # SOFT_ENGINEERING_DIFFERENCE -> REVIEW_REQUIRED
        # REPRESENTATION_DIFFERENCE -> PROBABLE_COMPATIBLE
        # NO_CONFLICT with high score/exact key -> VALIDATED_COMPATIBLE
        base_score = float(candidate_row.get("final_match_score", 0.0))

        if is_incompatible:
            validation_status = "ENGINEERING_INCOMPATIBLE"
        elif co_populated_count < 2 and not is_exact_key:
            validation_status = "INSUFFICIENT_EVIDENCE"
        elif conflict_class == "SOFT_ENGINEERING_DIFFERENCE":
            validation_status = "REVIEW_REQUIRED"
        elif conflict_class == "REPRESENTATION_DIFFERENCE":
            validation_status = "PROBABLE_COMPATIBLE"
        elif conflict_class == "NO_CONFLICT":
            if is_exact_key or (base_score >= 0.85 and attr_disagreements == 0):
                validation_status = "VALIDATED_COMPATIBLE"
            elif base_score >= 0.70:
                validation_status = "PROBABLE_COMPATIBLE"
            else:
                validation_status = "REVIEW_REQUIRED"
        else:
            validation_status = "REVIEW_REQUIRED"

        return {
            "engineering_conflict_class": conflict_class,
            "engineering_incompatibility": is_incompatible,
            "hard_conflict_reasons": hard_conflict_reasons,
            "soft_difference_reasons": soft_difference_reasons,
            "repr_difference_reasons": repr_difference_reasons,
            "validation_status": validation_status,
            "reason_codes": reason_codes,
            "co_populated_count": co_populated_count,
            "attr_agreements": attr_agreements,
            "attr_disagreements": attr_disagreements,
            "upstream_conflict_present": conflict_present_upstream,
            "upstream_conflict_details": conflict_details_upstream,
            "upstream_conflict_preserved": std_conflict_preserved,
        }


validation_service = ValidationService()
