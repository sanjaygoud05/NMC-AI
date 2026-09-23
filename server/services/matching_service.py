"""
Matching Service for Phase 5: Candidate Generation & Semantic Matching
Implements multi-block candidate generation, null-aware attribute comparison,
engineering conflict classification, explainable composite scoring, and candidate ranking.
Strictly preserves Phase 6 boundaries (no Common Material Master, no record merging).
"""

import logging
import re
from collections import defaultdict
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Set
import numpy as np
import pandas as pd
import yaml
from rapidfuzz import fuzz

from services.embedding_service import embedding_service

logger = logging.getLogger(__name__)

# Canonical engineering attributes to compare
ENGINEERING_ATTRS = [
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

# Conflict classifications
NO_CONFLICT = "NO_CONFLICT"
REPRESENTATION_DIFFERENCE = "REPRESENTATION_DIFFERENCE"
SOFT_ENGINEERING_DIFFERENCE = "SOFT_ENGINEERING_DIFFERENCE"
HARD_INCOMPATIBLE = "HARD_INCOMPATIBLE"


def _clean_str(val: Any) -> Optional[str]:
    """Clean string, converting nan/none/null to None."""
    if val is None:
        return None
    if isinstance(val, float) and (val != val):
        return None
    s = str(val).strip()
    if not s or s.lower() in ["none", "nan", "null"]:
        return None
    return s


def load_matching_config(config_path: str = "config/matching.yaml") -> dict:
    """Load matching configuration YAML."""
    p = Path(config_path)
    if p.exists():
        with open(p, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    return {
        "scoring": {
            "weights": {
                "canonical_key_exact": 0.30,
                "embedding_similarity": 0.20,
                "description_similarity": 0.10,
                "attribute_agreement": 0.40,
            },
            "penalties": {
                "NO_CONFLICT": 0.00,
                "REPRESENTATION_DIFFERENCE": 0.00,
                "SOFT_ENGINEERING_DIFFERENCE": 0.15,
                "HARD_INCOMPATIBLE": 0.50,
            },
            "hard_incompatible_max_score": 0.60,
        },
        "confidence_thresholds": {
            "high": 0.85,
            "medium": 0.65,
            "low": 0.00,
        },
        "blocking": {
            "max_candidates_per_source": 30,
            "prioritize_cross_cpse": True,
            "retain_same_cpse": True,
        },
    }


class MatchingService:
    def __init__(self, config: Optional[dict] = None):
        self.config = config or load_matching_config()
        self.weights = self.config.get("scoring", {}).get("weights", {
            "canonical_key_exact": 0.30,
            "embedding_similarity": 0.20,
            "description_similarity": 0.10,
            "attribute_agreement": 0.40,
        })
        self.penalties = self.config.get("scoring", {}).get("penalties", {
            "NO_CONFLICT": 0.00,
            "REPRESENTATION_DIFFERENCE": 0.00,
            "SOFT_ENGINEERING_DIFFERENCE": 0.15,
            "HARD_INCOMPATIBLE": 0.50,
        })
        self.hard_incompatible_max_score = self.config.get("scoring", {}).get("hard_incompatible_max_score", 0.60)
        self.thresholds = self.config.get("confidence_thresholds", {
            "high": 0.85,
            "medium": 0.65,
            "low": 0.00,
        })

    def classify_engineering_conflict(self, rec1: Dict[str, Any], rec2: Dict[str, Any]) -> Tuple[str, List[str]]:
        """
        Classify conflict between two material records into exactly one of:
        - NO_CONFLICT
        - REPRESENTATION_DIFFERENCE
        - SOFT_ENGINEERING_DIFFERENCE
        - HARD_INCOMPATIBLE
        Returns (conflict_class, reasons_list).
        """
        reasons = []

        fam1 = _clean_str(rec1.get("Canonical_Material_Family"))
        fam2 = _clean_str(rec2.get("Canonical_Material_Family"))
        typ1 = _clean_str(rec1.get("Canonical_Material_Type"))
        typ2 = _clean_str(rec2.get("Canonical_Material_Type"))
        sub1 = _clean_str(rec1.get("Canonical_Material_Subtype"))
        sub2 = _clean_str(rec2.get("Canonical_Material_Subtype"))
        mat1 = _clean_str(rec1.get("Canonical_Material"))
        mat2 = _clean_str(rec2.get("Canonical_Material"))
        grd1 = _clean_str(rec1.get("Canonical_Material_Grade"))
        grd2 = _clean_str(rec2.get("Canonical_Material_Grade"))
        sz1 = _clean_str(rec1.get("Canonical_Size"))
        sz2 = _clean_str(rec2.get("Canonical_Size"))
        len1 = _clean_str(rec1.get("Canonical_Length"))
        len2 = _clean_str(rec2.get("Canonical_Length"))
        dia1 = _clean_str(rec1.get("Canonical_Diameter"))
        dia2 = _clean_str(rec2.get("Canonical_Diameter"))
        pc1 = _clean_str(rec1.get("Canonical_Pressure_Class"))
        pc2 = _clean_str(rec2.get("Canonical_Pressure_Class"))
        std1 = _clean_str(rec1.get("Canonical_Standard"))
        std2 = _clean_str(rec2.get("Canonical_Standard"))

        # 1. HARD INCOMPATIBILITIES

        # Family mismatch
        if fam1 and fam2 and fam1.upper() != fam2.upper():
            return HARD_INCOMPATIBLE, [f"Material family mismatch: '{fam1}' vs '{fam2}'"]

        # Type mismatch (e.g. BALL VALVE vs GATE VALVE, NUT vs BOLT)
        if typ1 and typ2 and typ1.upper() != typ2.upper():
            return HARD_INCOMPATIBLE, [f"Material type mismatch: '{typ1}' vs '{typ2}'"]

        # Text-based domain engineering conflict checks on full descriptions
        raw1 = str(rec1.get("Material_Description") or rec1.get("Standardized_Description") or "").upper()
        raw2 = str(rec2.get("Material_Description") or rec2.get("Standardized_Description") or "").upper()

        if raw1 and raw2:
            # Conductor / Electrical metallurgy
            metals = ["COPPER", "ALUMINIUM", "ALUMINUM"]
            m1 = next((m for m in metals if m in raw1), None)
            m2 = next((m for m in metals if m in raw2), None)
            if m1 and m2:
                n1 = "AL" if "ALUM" in m1 else "CU"
                n2 = "AL" if "ALUM" in m2 else "CU"
                if n1 != n2:
                    return HARD_INCOMPATIBLE, [f"Incompatible conductor metallurgy: {m1} vs {m2}"]

            # Casting / Steel metallurgy
            cast_grades = ["WCB", "LCB", "LCC", "WC6", "WC9", "C5", "C12", "CF8", "CF8M", "CF3", "CF3M"]
            cg1 = next((g for g in cast_grades if re.search(r"\b" + g + r"\b", raw1)), None)
            cg2 = next((g for g in cast_grades if re.search(r"\b" + g + r"\b", raw2)), None)
            if cg1 and cg2 and cg1 != cg2:
                return HARD_INCOMPATIBLE, [f"Incompatible casting metallurgy: {cg1} vs {cg2}"]

            # Sealing elastomer / Gasket materials
            gaskets = ["VITON", "NBR", "NITRILE", "PTFE", "TEFLON", "EPDM", "GRAPHITE", "NEOPRENE", "SILICONE"]
            gk1 = next((g for g in gaskets if re.search(r"\b" + g + r"\b", raw1)), None)
            gk2 = next((g for g in gaskets if re.search(r"\b" + g + r"\b", raw2)), None)
            if gk1 and gk2 and gk1 != gk2:
                return HARD_INCOMPATIBLE, [f"Incompatible sealing elastomer: {gk1} vs {gk2}"]

            # Valve types
            valve_types = [
                "GATE VALVE", "GLOBE VALVE", "BALL VALVE", "CHECK VALVE",
                "BUTTERFLY VALVE", "PLUG VALVE", "NEEDLE VALVE", "CONTROL VALVE",
                "RELIEF VALVE", "SAFETY VALVE"
            ]
            vt1 = next((v for v in valve_types if v in raw1), None)
            vt2 = next((v for v in valve_types if v in raw2), None)
            if vt1 and vt2 and vt1 != vt2:
                return HARD_INCOMPATIBLE, [f"Incompatible valve type: {vt1} vs {vt2}"]

            # Fastener types
            fasteners = ["HEX BOLT", "ANCHOR BOLT", "STUD BOLT", "EYE BOLT", "U-BOLT", "HEX NUT", "WASHER"]
            f1 = next((f for f in fasteners if f in raw1), None)
            f2 = next((f for f in fasteners if f in raw2), None)
            if f1 and f2 and f1 != f2:
                return HARD_INCOMPATIBLE, [f"Incompatible fastener type: {f1} vs {f2}"]

            # Pressure ratings
            p_pat = r"(\b\d{3,4}#|\bCLASS\s*\d{3,4}|\bPN\s*\d{1,3})"
            p1 = re.findall(p_pat, raw1)
            p2 = re.findall(p_pat, raw2)
            if p1 and p2:
                norm_p1 = re.sub(r"\D", "", p1[0])
                norm_p2 = re.sub(r"\D", "", p2[0])
                if norm_p1 != norm_p2:
                    return HARD_INCOMPATIBLE, [f"Incompatible pressure rating: {p1[0]} vs {p2[0]}"]

            # Fastener grade / metallurgy
            ss_pat = r"\b(SS\s*304L?|SS\s*316L?|GRADE\s*8\.8|GRADE\s*10\.9|GRADE\s*4\.6|A2-70|A4-70|A4-80)\b"
            ss1 = re.findall(ss_pat, raw1)
            ss2 = re.findall(ss_pat, raw2)
            if ss1 and ss2:
                n1 = ss1[0].replace(" ", "").replace("GRADE", "GR")
                n2 = ss2[0].replace(" ", "").replace("GRADE", "GR")
                if n1 != n2 and not (("304" in n1 and "304" in n2) or ("316" in n1 and "316" in n2)):
                    return HARD_INCOMPATIBLE, [f"Incompatible fastener grade: {ss1[0]} vs {ss2[0]}"]

            # Cable cross-section
            cs1 = re.findall(r"(\d+(?:\.\d+)?)\s*(?:SQ\.?\s*MM|SQMM)", raw1)
            cs2 = re.findall(r"(\d+(?:\.\d+)?)\s*(?:SQ\.?\s*MM|SQMM)", raw2)
            if cs1 and cs2 and cs1[0] != cs2[0]:
                return HARD_INCOMPATIBLE, [f"Incompatible cable cross-section: {cs1[0]} sq mm vs {cs2[0]} sq mm"]

            # Cable core count
            cc1 = re.findall(r"\b(\d+(?:\.5)?)\s*C\b", raw1)
            cc2 = re.findall(r"\b(\d+(?:\.5)?)\s*C\b", raw2)
            if cc1 and cc2 and cc1[0] != cc2[0]:
                return HARD_INCOMPATIBLE, [f"Incompatible cable core count: {cc1[0]}C vs {cc2[0]}C"]

            # Metric bolt diameter
            mb1 = re.findall(r"\bM(\d+)\b", raw1)
            mb2 = re.findall(r"\bM(\d+)\b", raw2)
            if mb1 and mb2 and mb1[0] != mb2[0]:
                return HARD_INCOMPATIBLE, [f"Incompatible bolt diameter: M{mb1[0]} vs M{mb2[0]}"]

            # Inch size
            in1 = re.findall(r"(\d+(?:/\d+)?)\s*(?:IN\b|INCH\b)", raw1)
            in2 = re.findall(r"(\d+(?:/\d+)?)\s*(?:IN\b|INCH\b)", raw2)
            if in1 and in2 and in1[0] != in2[0]:
                return HARD_INCOMPATIBLE, [f"Incompatible nominal pipe/valve size: {in1[0]} in vs {in2[0]} in"]

        # Metallurgy grade hard incompatibilities
        if grd1 and grd2:
            g1, g2 = grd1.upper(), grd2.upper()
            # Stainless steel grades
            if ("304" in g1 and "316" in g2) or ("316" in g1 and "304" in g2):
                return HARD_INCOMPATIBLE, [f"Incompatible stainless steel grade: '{grd1}' vs '{grd2}'"]
            # Forged vs Cast carbon steel
            if ("A105" in g1 and "WCB" in g2) or ("WCB" in g1 and "A105" in g2):
                return HARD_INCOMPATIBLE, [f"Incompatible steel form (forged vs cast): '{grd1}' vs '{grd2}'"]
            # Carbon steel vs Stainless steel
            if ("CARBON" in g1 and "STAINLESS" in g2) or ("STAINLESS" in g1 and "CARBON" in g2):
                return HARD_INCOMPATIBLE, [f"Incompatible base metallurgy: '{grd1}' vs '{grd2}'"]

        # Base material hard incompatibility
        if mat1 and mat2:
            m1, m2 = mat1.upper(), mat2.upper()
            if ("CARBON STEEL" in m1 and "STAINLESS STEEL" in m2) or ("STAINLESS STEEL" in m1 and "CARBON STEEL" in m2):
                return HARD_INCOMPATIBLE, [f"Base material incompatibility: '{mat1}' vs '{mat2}'"]
            if ("RUBBER" in m1 and "STEEL" in m2) or ("STEEL" in m1 and "RUBBER" in m2):
                return HARD_INCOMPATIBLE, [f"Base material incompatibility: '{mat1}' vs '{mat2}'"]

        # Size hard incompatibility (e.g. 2 IN vs 3 IN, M16 vs M20, 1/2 IN vs 1 IN)
        if sz1 and sz2 and sz1.upper() != sz2.upper():
            s1, s2 = sz1.upper(), sz2.upper()
            # Check if one is metric bolt and other is metric bolt with different diameter
            mb1 = re.match(r"^M(\d+)", s1)
            mb2 = re.match(r"^M(\d+)", s2)
            if mb1 and mb2:
                if mb1.group(1) != mb2.group(1):
                    return HARD_INCOMPATIBLE, [f"Incompatible metric bolt diameter: '{sz1}' vs '{sz2}'"]
                else:
                    # Same diameter (e.g. M16 vs M16X75) -> Soft difference
                    reasons.append(f"Fastener length/specification variance: '{sz1}' vs '{sz2}'")
            else:
                # Inch sizes or distinct values (e.g. 2 IN vs 3 IN)
                inch1 = re.match(r"^(\d+(?:/\d+)?)\s*IN", s1)
                inch2 = re.match(r"^(\d+(?:/\d+)?)\s*IN", s2)
                if inch1 and inch2 and inch1.group(1) != inch2.group(1):
                    return HARD_INCOMPATIBLE, [f"Incompatible pipe/valve nominal size: '{sz1}' vs '{sz2}'"]
                # Distinct bearing numbers
                if s1.isdigit() and s2.isdigit() and s1 != s2:
                    return HARD_INCOMPATIBLE, [f"Incompatible bearing number: '{sz1}' vs '{sz2}'"]
                # Sensor wiring vs probe length (4-wire vs 500 mm)
                if ("WIRE" in s1 and "MM" in s2) or ("MM" in s1 and "WIRE" in s2):
                    reasons.append(f"Sensor wiring specification vs dimension: '{sz1}' vs '{sz2}'")
                elif s1 != s2:
                    return HARD_INCOMPATIBLE, [f"Incompatible engineering size: '{sz1}' vs '{sz2}'"]

        # Pressure class hard incompatibility
        if pc1 and pc2 and pc1.upper() != pc2.upper():
            return HARD_INCOMPATIBLE, [f"Pressure class mismatch: '{pc1}' vs '{pc2}'"]

        # Standard incompatibility (e.g. API 600 vs API 608)
        if std1 and std2 and std1.upper() != std2.upper():
            st1, st2 = std1.upper(), std2.upper()
            if ("API 600" in st1 and "API 608" in st2) or ("API 608" in st1 and "API 600" in st2):
                return HARD_INCOMPATIBLE, [f"Standard incompatibility (gate vs ball valve): '{std1}' vs '{std2}'"]
            # IS 1363 vs IS 1364 is black vs precision bolt
            if ("IS 1363" in st1 and "IS 1364" in st2) or ("IS 1364" in st1 and "IS 1363" in st2):
                reasons.append(f"Fastener product grade variance: '{std1}' vs '{std2}'")

        # 2. SOFT ENGINEERING DIFFERENCES
        if reasons:
            return SOFT_ENGINEERING_DIFFERENCE, reasons

        # Check dimension difference if sizes matched
        if len1 and len2 and len1.upper() != len2.upper():
            return SOFT_ENGINEERING_DIFFERENCE, [f"Length dimension variance: '{len1}' vs '{len2}'"]
        if dia1 and dia2 and dia1.upper() != dia2.upper():
            return SOFT_ENGINEERING_DIFFERENCE, [f"Diameter dimension variance: '{dia1}' vs '{dia2}'"]

        # Subtype soft variance (e.g. gasket vs spiral wound gasket)
        if sub1 and sub2 and sub1.upper() != sub2.upper():
            if ("SPIRAL" in sub1.upper() or "SPIRAL" in sub2.upper()):
                return SOFT_ENGINEERING_DIFFERENCE, [f"Construction subtype variance: '{sub1}' vs '{sub2}'"]

        # 3. REPRESENTATION DIFFERENCES
        rep_reasons = []
        if grd1 and grd2 and grd1.upper() != grd2.upper():
            g1, g2 = grd1.upper(), grd2.upper()
            if ("A105" in g1 and "A105" in g2) or ("WCB" in g1 and "WCB" in g2) or ("316" in g1 and "316" in g2):
                rep_reasons.append(f"Standard/grade prefix representation difference: '{grd1}' vs '{grd2}'")

        # Preserved Phase 3 conflict details
        conf_detail1 = str(rec1.get("extraction_conflicts_detail") or "")
        conf_detail2 = str(rec2.get("extraction_conflicts_detail") or "")
        if "ASTM A105" in conf_detail1 or "ASTM A105" in conf_detail2 or "A105" in conf_detail1:
            rep_reasons.append("Phase 3 preserved grade representation conflict: ASTM A105 vs A105")

        if rep_reasons:
            return REPRESENTATION_DIFFERENCE, rep_reasons

        return NO_CONFLICT, ["No engineering or representation conflicts detected"]

    def compare_attributes(self, rec1: Dict[str, Any], rec2: Dict[str, Any]) -> Tuple[Dict[str, Optional[float]], float, int]:
        """
        Compare 21 canonical attributes using null-aware logic.
        NULL vs NULL is neutral (returns None, omitted from calculation).
        Returns:
            attr_similarities: dict mapping attribute -> similarity float (or None if unpopulated)
            agreement_score: float (0.0 to 1.0)
            evaluated_count: int
        """
        attr_sims: Dict[str, Optional[float]] = {}
        agreements = []

        for attr in ENGINEERING_ATTRS:
            col = f"Canonical_{'_'.join([part.capitalize() for part in attr.split('_')])}"
            v1 = _clean_str(rec1.get(col))
            v2 = _clean_str(rec2.get(col))

            if v1 is None and v2 is None:
                # Neutral: both missing
                attr_sims[f"{attr}_similarity"] = None
                continue

            if v1 is None or v2 is None:
                # One present, one missing
                attr_sims[f"{attr}_similarity"] = 0.0
                agreements.append(0.0)
                continue

            # Both present
            s1 = v1.upper()
            s2 = v2.upper()
            if s1 == s2:
                sim = 1.0
            else:
                # Token or string fuzzy similarity
                sim = fuzz.token_sort_ratio(s1, s2) / 100.0
                if sim < 0.5:
                    sim = 0.0
            attr_sims[f"{attr}_similarity"] = round(sim, 4)
            agreements.append(sim)

        evaluated_count = len(agreements)
        agreement_score = (sum(agreements) / evaluated_count) if evaluated_count > 0 else 0.0
        return attr_sims, round(agreement_score, 4), evaluated_count

    def calculate_match(
        self,
        rec1: Dict[str, Any],
        rec2: Dict[str, Any],
        emb1: Optional[np.ndarray] = None,
        emb2: Optional[np.ndarray] = None,
        blocks_applied: Optional[Set[str]] = None,
    ) -> Dict[str, Any]:
        """
        Calculate complete explainable candidate match features and composite score.
        """
        code1 = str(rec1.get("Material_Code", ""))
        code2 = str(rec2.get("Material_Code", ""))
        cpse1 = str(rec1.get("CPSE", ""))
        cpse2 = str(rec2.get("CPSE", ""))

        raw1 = str(rec1.get("Material_Description", "") or "")
        raw2 = str(rec2.get("Material_Description", "") or "")
        raw_sim = (fuzz.token_sort_ratio(raw1.upper(), raw2.upper()) / 100.0) if (raw1 and raw2) else 0.0

        desc1 = str(rec1.get("Standardized_Description", "") or "")
        desc2 = str(rec2.get("Standardized_Description", "") or "")
        std_sim = (fuzz.token_sort_ratio(desc1.upper(), desc2.upper()) / 100.0) if (desc1 and desc2) else 0.0

        # Description similarity combines raw and standardized text
        if raw1 and raw2 and desc1 and desc2:
            desc_sim = round(0.35 * std_sim + 0.65 * raw_sim, 4)
        else:
            desc_sim = raw_sim if raw1 and raw2 else std_sim

        # Engineering conflict classification
        conflict_class, conflict_reasons = self.classify_engineering_conflict(rec1, rec2)
        is_hard_incompatible = (conflict_class == HARD_INCOMPATIBLE)

        key1 = str(rec1.get("Canonical_Material_Key", "") or "")
        key2 = str(rec2.get("Canonical_Material_Key", "") or "")
        canonical_key_exact = 1.0 if (key1 and key2 and key1 == key2 and not is_hard_incompatible) else 0.0

        # Embedding similarity
        if emb1 is not None and emb2 is not None:
            emb_sim = embedding_service.compute_similarity(emb1, emb2)
        else:
            emb_sim = desc_sim  # Fallback if embeddings not precomputed
        emb_sim = max(0.0, min(1.0, round(float(emb_sim), 4)))

        # Attribute similarities
        attr_sims, agreement_score, evaluated_count = self.compare_attributes(rec1, rec2)
        coverage_factor = min(1.0, evaluated_count / 4.0) if evaluated_count > 0 else 0.0
        effective_agreement = agreement_score * (0.6 + 0.4 * coverage_factor)

        # Base composite score with balanced weights
        base_score = (
            0.25 * canonical_key_exact
            + 0.20 * emb_sim
            + 0.25 * desc_sim
            + 0.30 * effective_agreement
        )

        if is_hard_incompatible:
            # Strictly cap hard incompatible pairs to low score
            penalty = 0.65
            final_score = min(0.25, max(0.05, round(base_score - penalty, 4)))
            confidence = "LOW"
        else:
            penalty = self.penalties.get(conflict_class, 0.0)
            final_score = max(0.0, round(base_score - penalty, 4))

            # Guard against blindly assigning 1.0 (100%):
            # Only exact identical raw description + exact key + high attribute agreement can ever reach 1.0
            is_exact_raw = (raw1.strip().upper() == raw2.strip().upper()) and bool(raw1.strip())
            if not is_exact_raw:
                final_score = min(final_score, 0.94)
                if raw_sim < 0.85:
                    final_score = min(final_score, 0.82)
                if raw_sim < 0.70:
                    final_score = min(final_score, 0.68)
                if raw_sim < 0.50:
                    final_score = min(final_score, 0.45)

            # Confidence level
            if final_score >= 0.80 and canonical_key_exact:
                confidence = "HIGH"
            elif final_score >= 0.60:
                confidence = "MEDIUM"
            else:
                confidence = "LOW"

        # Preserved Phase 3/4 conflict details
        conf_detail = []
        c1 = rec1.get("extraction_conflicts_detail")
        c2 = rec2.get("extraction_conflicts_detail")
        if c1 and str(c1).strip() and str(c1).lower() != "nan":
            conf_detail.append(f"{code1}: {c1}")
        if c2 and str(c2).strip() and str(c2).lower() != "nan":
            conf_detail.append(f"{code2}: {c2}")
        conflict_details_str = "; ".join(conf_detail) if conf_detail else None
        conflict_present = bool(conf_detail or conflict_class in [SOFT_ENGINEERING_DIFFERENCE, HARD_INCOMPATIBLE])

        # Evidence summary
        evidence_parts = []
        if canonical_key_exact == 1.0:
            evidence_parts.append("Exact canonical material key match")
        evidence_parts.append(f"Embedding sim: {emb_sim:.2f}")
        evidence_parts.append(f"Description sim: {desc_sim:.2f}")
        evidence_parts.append(f"Attribute agreement: {agreement_score:.2f} ({evaluated_count} attrs)")
        evidence_parts.append(f"Status: {conflict_class}")
        if penalty > 0:
            evidence_parts.append(f"Penalty: -{penalty:.2f}")
        if conflict_reasons and conflict_class != NO_CONFLICT:
            evidence_parts.append(f"Notes: {'; '.join(conflict_reasons)}")
        evidence_summary = " | ".join(evidence_parts)

        # Blocking strategies
        blocking_str = "|".join(sorted(list(blocks_applied))) if blocks_applied else "UNKNOWN"

        res = {
            "source_material_code": code1,
            "source_cpse": cpse1,
            "candidate_material_code": code2,
            "candidate_cpse": cpse2,
            "source_canonical_key": key1,
            "candidate_canonical_key": key2,
            "canonical_key_exact": bool(canonical_key_exact == 1.0),
            "description_similarity": round(desc_sim, 4),
            "embedding_similarity": emb_sim,
            "attribute_agreement": agreement_score,
            "evaluated_attribute_count": evaluated_count,
            "blocking_strategies": blocking_str,
            "conflict_present": conflict_present,
            "conflict_details": conflict_details_str,
            "engineering_conflict_class": conflict_class,
            "engineering_incompatibility": (conflict_class == HARD_INCOMPATIBLE),
            "penalty_applied": penalty,
            "final_match_score": final_score,
            "confidence_level": confidence,
            "evidence_summary": evidence_summary,
        }
        res.update(attr_sims)
        return res

    def generate_candidate_pairs(self, df: pd.DataFrame) -> Dict[Tuple[int, int], Set[str]]:
        """
        Generate candidate pairs using deterministic union blocking:
        - Family Block
        - Type Block
        - Standard Block
        - Size Block
        - Material/Grade Block
        - Engineering Token Block
        Returns dict mapping (idx1, idx2) -> set of block names.
        """
        blocks: Dict[str, Dict[str, List[int]]] = {
            "FAMILY": defaultdict(list),
            "TYPE": defaultdict(list),
            "STANDARD": defaultdict(list),
            "SIZE": defaultdict(list),
            "MATERIAL_GRADE": defaultdict(list),
            "TOKEN": defaultdict(list),
        }

        for idx, row in df.iterrows():
            fam = _clean_str(row.get("Canonical_Material_Family"))
            typ = _clean_str(row.get("Canonical_Material_Type"))
            std = _clean_str(row.get("Canonical_Standard"))
            sz = _clean_str(row.get("Canonical_Size"))
            grd = _clean_str(row.get("Canonical_Material_Grade"))
            desc = _clean_str(row.get("Standardized_Description"))

            if fam:
                blocks["FAMILY"][fam].append(idx)
            if typ:
                blocks["TYPE"][typ].append(idx)
            if std:
                blocks["STANDARD"][std].append(idx)
            if sz:
                blocks["SIZE"][sz].append(idx)
            if grd:
                blocks["MATERIAL_GRADE"][grd].append(idx)
            if desc:
                for tok in desc.split("|"):
                    tok = tok.strip().upper()
                    if len(tok) >= 3 and not tok.isdigit():
                        blocks["TOKEN"][tok].append(idx)

        # Union candidate pairs
        # To maintain high precision and prevent all-pairs explosion, candidates
        # must share Family OR Type OR Standard OR Size OR Material/Grade OR Key Tokens
        pair_blocks: Dict[Tuple[int, int], Set[str]] = defaultdict(set)

        for bname in ["TYPE", "STANDARD", "SIZE", "MATERIAL_GRADE"]:
            for key, idxs in blocks[bname].items():
                unique_idxs = sorted(list(set(idxs)))
                if len(unique_idxs) < 2 or len(unique_idxs) > 300:
                    continue
                for i in range(len(unique_idxs)):
                    idx_i = unique_idxs[i]
                    for j in range(i + 1, len(unique_idxs)):
                        idx_j = unique_idxs[j]
                        if idx_i == idx_j:
                            continue
                        pair = (idx_i, idx_j) if idx_i < idx_j else (idx_j, idx_i)
                        pair_blocks[pair].add(bname)

        # Add exact Family matches that also share at least one engineering token
        for fam, idxs in blocks["FAMILY"].items():
            if len(idxs) < 2:
                continue
            fam_set = set(idxs)
            for tok, t_idxs in blocks["TOKEN"].items():
                in_fam = sorted(list(set([x for x in t_idxs if x in fam_set])))
                if len(in_fam) < 2 or len(in_fam) > 100:
                    continue
                for i in range(len(in_fam)):
                    idx_i = in_fam[i]
                    for j in range(i + 1, len(in_fam)):
                        idx_j = in_fam[j]
                        if idx_i == idx_j:
                            continue
                        pair = (idx_i, idx_j) if idx_i < idx_j else (idx_j, idx_i)
                        pair_blocks[pair].add("FAMILY_TOKEN")

        return pair_blocks


matching_service = MatchingService()
