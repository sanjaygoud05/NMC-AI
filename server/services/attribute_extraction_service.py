"""
Attribute Extraction Service — Phase 3
SIH26099 Material Harmonization Platform

PURPOSE:
Convert normalized material descriptions and existing structured fields into
a structured engineering attribute representation.

DESIGN PRINCIPLES:
- Deterministic: same input always produces identical output
- Explainable: every attribute records its source and rule_id
- Conservative: NULL is better than an incorrect attribute
- Token-aware: never corrupt engineering identifiers (SS316, DN50, A105)
- No LLM: only rule-based / dictionary-driven extraction
- No matching: this is NOT Phase 5 (no fuzzy/semantic matching)

CRITICAL RULE: Never invent attributes. If not explicitly present, leave null.
"""

import re
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

# ─────────────────────────────────────────────────
# Rule ID Constants
# ─────────────────────────────────────────────────
R_FAMILY_VALVE          = "FAMILY_VALVE"
R_FAMILY_BEARING        = "FAMILY_BEARING"
R_FAMILY_PUMP           = "FAMILY_PUMP"
R_FAMILY_FLANGE         = "FAMILY_FLANGE"
R_FAMILY_PIPE           = "FAMILY_PIPE"
R_FAMILY_FITTING        = "FAMILY_FITTING"
R_FAMILY_FASTENER       = "FAMILY_FASTENER"
R_FAMILY_ELECTRICAL     = "FAMILY_ELECTRICAL"
R_FAMILY_INSTRUMENT     = "FAMILY_INSTRUMENTATION"
R_FAMILY_HOSE           = "FAMILY_HOSE"
R_FAMILY_SEAL           = "FAMILY_SEAL"
R_FAMILY_LUBE           = "FAMILY_LUBRICANT"
R_FAMILY_SAFETY         = "FAMILY_SAFETY"
R_FAMILY_CATEGORY       = "FAMILY_FROM_CATEGORY"

R_TYPE_BALL_VALVE       = "TYPE_BALL_VALVE"
R_TYPE_GATE_VALVE       = "TYPE_GATE_VALVE"
R_TYPE_GLOBE_VALVE      = "TYPE_GLOBE_VALVE"
R_TYPE_CHECK_VALVE      = "TYPE_CHECK_VALVE"
R_TYPE_BUTTERFLY_VALVE  = "TYPE_BUTTERFLY_VALVE"
R_TYPE_SAFETY_VALVE     = "TYPE_SAFETY_VALVE"
R_TYPE_CENTRIFUGAL_PUMP = "TYPE_CENTRIFUGAL_PUMP"
R_TYPE_BALL_BEARING     = "TYPE_BALL_BEARING"
R_TYPE_WELDNECK_FLANGE  = "TYPE_WELDNECK_FLANGE"
R_TYPE_SLIPON_FLANGE    = "TYPE_SLIPON_FLANGE"
R_TYPE_BLIND_FLANGE     = "TYPE_BLIND_FLANGE"
R_TYPE_SPIRAL_GASKET    = "TYPE_SPIRAL_GASKET"
R_TYPE_FROM_MATTYPE     = "TYPE_FROM_MATERIAL_TYPE"

R_SUBTYPE_FLOATING      = "SUBTYPE_FLOATING"
R_SUBTYPE_HEX           = "SUBTYPE_HEX"
R_SUBTYPE_SEAMLESS      = "SUBTYPE_SEAMLESS"
R_SUBTYPE_SPIRAL        = "SUBTYPE_SPIRAL"
R_SUBTYPE_DEEP_GROOVE   = "SUBTYPE_DEEP_GROOVE"

R_MAT_SS                = "MATERIAL_STAINLESS_STEEL"
R_MAT_CS                = "MATERIAL_CARBON_STEEL"
R_MAT_CHROME_STEEL      = "MATERIAL_CHROME_STEEL"
R_MAT_CAST_IRON         = "MATERIAL_CAST_IRON"
R_MAT_XLPE              = "MATERIAL_XLPE"
R_MAT_SYNTHETIC_RUBBER  = "MATERIAL_SYNTHETIC_RUBBER"
R_MAT_MINERAL_OIL       = "MATERIAL_MINERAL_OIL"
R_MAT_FROM_GRADE        = "MATERIAL_FROM_GRADE_FIELD"

R_GRADE_SS316           = "GRADE_SS316"
R_GRADE_SS304           = "GRADE_SS304"
R_GRADE_A105            = "GRADE_A105"
R_GRADE_A216_WCB        = "GRADE_A216_WCB"
R_GRADE_A234_WPB        = "GRADE_A234_WPB"
R_GRADE_A106            = "GRADE_A106"
R_GRADE_FROM_FIELD      = "GRADE_FROM_STRUCTURED_FIELD"
R_GRADE_CHROME          = "GRADE_CHROME_STEEL"

R_SIZE_INCH             = "SIZE_INCH"
R_SIZE_MM               = "SIZE_MM"
R_SIZE_DN               = "SIZE_DN"
R_SIZE_METRIC_BOLT      = "SIZE_METRIC_BOLT"
R_SIZE_BEARING_NO       = "SIZE_BEARING_NUMBER"
R_SIZE_FRACTION_INCH    = "SIZE_FRACTION_INCH"
R_SIZE_FROM_FIELD       = "SIZE_FROM_STRUCTURED_FIELD"
R_SIZE_SQMM             = "SIZE_SQMM_CABLE"
R_SIZE_VGISO            = "SIZE_VG_ISO_LUBE"

R_PRESSURE_HASH         = "PRESSURE_CLASS_HASH"
R_PRESSURE_CLASS        = "PRESSURE_CLASS_KEYWORD"

R_SCHEDULE_SCH          = "PIPE_SCHEDULE"

R_STD_ASTM              = "STANDARD_ASTM"
R_STD_ASME              = "STANDARD_ASME"
R_STD_API               = "STANDARD_API"
R_STD_ISO               = "STANDARD_ISO"
R_STD_IS                = "STANDARD_IS"
R_STD_SAE               = "STANDARD_SAE"
R_STD_EN                = "STANDARD_EN"
R_STD_IEC               = "STANDARD_IEC"
R_STD_FROM_SPEC         = "STANDARD_FROM_SPECIFICATION"

R_COAT_FROM_FIELD       = "COATING_FROM_STRUCTURED_FIELD"
R_COAT_ZINC             = "COATING_ZINC_PLATED"
R_COAT_GALV             = "COATING_GALVANIZED"
R_COAT_PTFE             = "COATING_PTFE"
R_COAT_RUBBER           = "COATING_RUBBER_LINED"
R_COAT_PAINTED          = "COATING_PAINTED"
R_COAT_SS               = "COATING_SS"
R_COAT_PVC              = "COATING_PVC"
R_COAT_BLACK            = "COATING_BLACK"
R_COAT_BARE             = "COATING_BARE"

R_CONN_FLANGED          = "CONNECTION_FLANGED"
R_CONN_THREADED         = "CONNECTION_THREADED"
R_CONN_SW               = "CONNECTION_SOCKET_WELD"
R_CONN_BW               = "CONNECTION_BUTT_WELD"
R_CONN_WELDNECK         = "CONNECTION_WELD_NECK"

R_CONSTRUCT_FLOATING    = "CONSTRUCTION_FLOATING"
R_CONSTRUCT_SEAMLESS    = "CONSTRUCTION_SEAMLESS"
R_CONSTRUCT_FORGED      = "CONSTRUCTION_FORGED"
R_CONSTRUCT_CAST        = "CONSTRUCTION_CAST"
R_CONSTRUCT_WELDED      = "CONSTRUCTION_WELDED"

R_ORIENT_HORIZONTAL     = "ORIENTATION_HORIZONTAL"
R_ORIENT_VERTICAL       = "ORIENTATION_VERTICAL"

R_BEARING_NO            = "BEARING_NUMBER"

# ─────────────────────────────────────────────────
# Domain Dictionaries (derived from real dataset)
# ─────────────────────────────────────────────────

# Category → Material Family mapping (direct translation of category values)
CATEGORY_TO_FAMILY = {
    "valves":           ("valve",          R_FAMILY_VALVE),
    "bearings":         ("bearing",        R_FAMILY_BEARING),
    "pumps":            ("pump",           R_FAMILY_PUMP),
    "pipes & fittings": ("pipe/fitting",   R_FAMILY_PIPE),
    "fasteners":        ("fastener",       R_FAMILY_FASTENER),
    "electrical":       ("electrical",     R_FAMILY_ELECTRICAL),
    "instrumentation":  ("instrumentation",R_FAMILY_INSTRUMENT),
    "lubricants":       ("lubricant",      R_FAMILY_LUBE),
    "hoses":            ("hose",           R_FAMILY_HOSE),
    "safety":           ("safety",         R_FAMILY_SAFETY),
    "seals":            ("seal/gasket",    R_FAMILY_SEAL),
}

# MaterialType → (type_value, subtype_value, rule_id)
MATTYPE_TO_TYPE = {
    "ball valve":        ("ball valve",         None,           R_TYPE_BALL_VALVE),
    "gate valve":        ("gate valve",         None,           R_TYPE_GATE_VALVE),
    "globe valve":       ("globe valve",        None,           R_TYPE_GLOBE_VALVE),
    "check valve":       ("check valve",        None,           R_TYPE_CHECK_VALVE),
    "butterfly valve":   ("butterfly valve",    None,           R_TYPE_BUTTERFLY_VALVE),
    "safety valve":      ("safety valve",       None,           R_TYPE_SAFETY_VALVE),
    "centrifugal pump":  ("centrifugal pump",   None,           R_TYPE_CENTRIFUGAL_PUMP),
    "ball bearing":      ("ball bearing",       None,           R_TYPE_BALL_BEARING),
    "flange":            ("flange",             None,           R_TYPE_FROM_MATTYPE),
    "nut":               ("nut",                None,           R_TYPE_FROM_MATTYPE),
    "bolt":              ("bolt",               None,           R_TYPE_FROM_MATTYPE),
    "washer":            ("washer",             None,           R_TYPE_FROM_MATTYPE),
    "elbow":             ("elbow",              None,           R_TYPE_FROM_MATTYPE),
    "pipe":              ("pipe",               None,           R_TYPE_FROM_MATTYPE),
    "gasket":            ("gasket",             None,           R_TYPE_FROM_MATTYPE),
    "fuse":              ("fuse",               None,           R_TYPE_FROM_MATTYPE),
    "cable":             ("cable",              None,           R_TYPE_FROM_MATTYPE),
    "hydraulic hose":    ("hydraulic hose",     None,           R_TYPE_FROM_MATTYPE),
    "lubricant":         ("lubricant",          None,           R_TYPE_FROM_MATTYPE),
    "pressure gauge":    ("pressure gauge",     None,           R_TYPE_FROM_MATTYPE),
    "temperature sensor":("temperature sensor", None,           R_TYPE_FROM_MATTYPE),
    "globe valve":       ("globe valve",        None,           R_TYPE_GLOBE_VALVE),
}

# Grade-based material inference (only when unambiguous in context)
GRADE_TO_MATERIAL = {
    r"^ss\s*316l?$":    ("stainless steel", R_MAT_SS),
    r"^ss\s*304l?$":    ("stainless steel", R_MAT_SS),
    r"^stainless steel$": ("stainless steel", R_MAT_SS),
    r"^chrome steel$":  ("chrome steel",    R_MAT_CHROME_STEEL),
    r"^carbon steel$":  ("carbon steel",    R_MAT_CS),
    r"^xlpe":           ("xlpe",            R_MAT_XLPE),
    r"^synthetic rubber":("synthetic rubber",R_MAT_SYNTHETIC_RUBBER),
    r"^mineral oil$":   ("mineral oil",     R_MAT_MINERAL_OIL),
}

# Known standard patterns
STANDARD_PATTERNS = [
    (r"\bASTM\s+[A-Z]\d+(?:\s+(?:WCB|WCC|LCB|Gr\.?[A-Z0-9]+))?\b", R_STD_ASTM),
    (r"\bASME\s+B\d+\.\d+\b",           R_STD_ASME),
    (r"\bAPI\s+\d+[A-Z]?\b",            R_STD_API),
    (r"\bAPI\s+[A-Z0-9]+\b",            R_STD_API),
    (r"\bISO\s+\d+\b",                  R_STD_ISO),
    (r"\bISO\s+VG\s+\d+\b",             R_STD_ISO),
    (r"\bIS\s+\d+\b",                   R_STD_IS),
    (r"\bSAE\s+\d+\s+R\d+\b",           R_STD_SAE),
    (r"\bEN\s+\d+[-\d]*\b",             R_STD_EN),
    (r"\bIEC\s+\d+(?:-\d+)?\b",         R_STD_IEC),
]

# Coating mapping from description / Coating field
COATING_MAP = {
    r"\bzinc\s*plated\b":   ("zinc plated",   R_COAT_ZINC),
    r"\bgalvanized\b":       ("galvanized",    R_COAT_GALV),
    r"\bptfe\b":             ("ptfe",          R_COAT_PTFE),
    r"\brubber\b":           ("rubber",        R_COAT_RUBBER),
    r"\bpainted\b":          ("painted",       R_COAT_PAINTED),
    r"\bblack\b":            ("black",         R_COAT_BLACK),
    r"\bbare\b":             ("bare",          R_COAT_BARE),
    r"\bpvc\b":              ("pvc",           R_COAT_PVC),
}


def _tok(pattern: str, text: str, flags=re.IGNORECASE) -> bool:
    """Token-boundary match. True if pattern found."""
    return bool(re.search(pattern, text, flags))


def _first_match(pattern: str, text: str, flags=re.IGNORECASE) -> Optional[str]:
    """Return the first capture group or full match."""
    m = re.search(pattern, text, flags)
    if m:
        return (m.group(1) if m.lastindex else m.group(0)).strip()
    return None


def _is_null(val) -> bool:
    """True if value is None, NaN, or blank string."""
    if val is None:
        return True
    if isinstance(val, float) and (val != val):  # NaN check
        return True
    return str(val).strip() == "" or str(val).strip().lower() == "nan"


class AttributeExtractionService:
    """
    Deterministic, rule-based attribute extraction engine for Phase 3.

    Extraction priority order:
      1. Existing structured fields (highest trust)
      2. Exact domain dictionary matches
      3. High-confidence regex/pattern rules on normalized description
      4. Specification field patterns
      5. Low-confidence contextual rules (marked accordingly)
    """

    # ─────────────────────────────────────────────────
    # Public API
    # ─────────────────────────────────────────────────

    def extract_record(self, row: pd.Series) -> dict:
        """
        Extract structured attributes for a single material record.

        Args:
            row: pandas Series from normalized_materials.csv

        Returns:
            dict with all extracted attributes, sources, confidence, rules, conflicts
        """
        attrs = {}          # The extracted attribute values
        sources = {}        # attribute → source
        confidences = {}    # attribute → confidence level
        rules = {}          # attribute → rule_id
        conflicts = []      # List of conflict descriptors

        desc_raw  = str(row.get("Material_Description", "") or "").strip()
        desc_norm = str(row.get("Normalized_Description", "") or "").strip()
        spec_raw  = str(row.get("Specification", "") or "").strip()
        spec_norm = str(row.get("Normalized_Specification", "") or "").strip()
        category  = str(row.get("Material_Category", "") or "").strip()
        mat_type  = str(row.get("Material_Type", "") or "").strip()
        grade_f   = str(row.get("Material_Grade", "") or "").strip()
        size_f    = str(row.get("Size", "") or "").strip()
        length_f  = str(row.get("Length", "") or "").strip()
        diam_f    = str(row.get("Diameter", "") or "").strip()
        coat_f    = str(row.get("Coating", "") or "").strip()
        mfg_f     = str(row.get("Manufacturer", "") or "").strip()
        pn_f      = str(row.get("Manufacturer_Part_No", "") or "").strip()
        unit_f    = str(row.get("Unit", "") or "").strip()

        def _set(attr, value, source, confidence, rule_id):
            """Set an attribute, checking for conflicts with existing value."""
            if value is None or value == "":
                return
            if attr in attrs and attrs[attr] != value:
                conflicts.append({
                    "attribute": attr,
                    "existing_value": attrs[attr],
                    "new_value": value,
                    "existing_source": sources.get(attr),
                    "new_source": source,
                })
                # Keep higher-priority (lower-number) source
                priority = {"structured_field": 0, "specification": 1, "description": 2}
                if priority.get(source, 9) >= priority.get(sources.get(attr), 9):
                    return  # Don't overwrite higher-priority source
            attrs[attr] = value
            sources[attr] = source
            confidences[attr] = confidence
            rules[attr] = rule_id

        # ══════════════════════════════════════════════
        # STEP 1: Structured field integration
        # ══════════════════════════════════════════════
        if not _is_null(grade_f):
            _set("material_grade", grade_f, "structured_field", "high", R_GRADE_FROM_FIELD)

        if not _is_null(size_f):
            _set("size", size_f, "structured_field", "high", R_SIZE_FROM_FIELD)

        if not _is_null(length_f):
            _set("length", length_f, "structured_field", "high", "LENGTH_FROM_FIELD")

        if not _is_null(diam_f):
            _set("diameter", diam_f, "structured_field", "high", "DIAMETER_FROM_FIELD")

        if not _is_null(coat_f):
            coat_val = coat_f.strip()
            # Map "SS" coating to stainless steel (not material grade SS)
            if coat_val.upper() == "SS":
                coat_val = "stainless steel"
            elif coat_val.upper() == "PVC":
                coat_val = "pvc"
            _set("coating", coat_val.lower(), "structured_field", "high", R_COAT_FROM_FIELD)

        if not _is_null(mfg_f):
            _set("manufacturer", mfg_f, "structured_field", "high", "MANUFACTURER_FROM_FIELD")

        if not _is_null(pn_f):
            _set("manufacturer_part_no", pn_f, "structured_field", "high", "PART_NO_FROM_FIELD")

        if not _is_null(unit_f):
            _set("unit", unit_f, "structured_field", "high", "UNIT_FROM_FIELD")

        # ══════════════════════════════════════════════
        # STEP 2: Material Family from Category field
        # ══════════════════════════════════════════════
        cat_key = category.lower().strip()
        if cat_key in CATEGORY_TO_FAMILY:
            fam_val, fam_rule = CATEGORY_TO_FAMILY[cat_key]
            _set("material_family", fam_val, "structured_field", "high", fam_rule)

        # ══════════════════════════════════════════════
        # STEP 3: Material Type from Material_Type field
        # ══════════════════════════════════════════════
        mt_key = mat_type.lower().strip()
        if mt_key in MATTYPE_TO_TYPE:
            type_val, sub_val, type_rule = MATTYPE_TO_TYPE[mt_key]
            _set("material_type", type_val, "structured_field", "high", type_rule)
            if sub_val:
                _set("material_subtype", sub_val, "structured_field", "high", type_rule)

        # ══════════════════════════════════════════════
        # STEP 4: Material composition from Material_Grade
        # ══════════════════════════════════════════════
        if not _is_null(grade_f):
            grade_lc = grade_f.lower().strip()
            for pat, (mat_val, mat_rule) in GRADE_TO_MATERIAL.items():
                if re.match(pat, grade_lc, re.IGNORECASE):
                    _set("material", mat_val, "structured_field", "high", mat_rule)
                    break

        # ══════════════════════════════════════════════
        # STEP 5: Standards from Specification field
        # ══════════════════════════════════════════════
        if not _is_null(spec_raw):
            standards_found = []
            for std_pat, std_rule in STANDARD_PATTERNS:
                matches = re.findall(std_pat, spec_raw, re.IGNORECASE)
                for m in matches:
                    s = m.strip()
                    if s not in standards_found:
                        standards_found.append(s)
            if standards_found:
                _set("standard", "; ".join(standards_found), "specification", "high", R_STD_FROM_SPEC)

            # Pressure class from specification
            pc_m = re.search(r"(?:class|cl)\s*(\d+)", spec_raw, re.IGNORECASE)
            if pc_m:
                _set("pressure_class", pc_m.group(1), "specification", "high", R_PRESSURE_CLASS)

        # ══════════════════════════════════════════════
        # STEP 6: Description-based extraction
        # ══════════════════════════════════════════════
        desc = desc_norm  # Work on normalized (lowercase) description

        # ── 6a. Size patterns from description ──
        # Bearing number (4-digit, appears after "bearing" keyword) — must NOT be size
        bearing_no = None
        bno_m = re.search(r"\bBearing(?:\s+No(?:\.?))?\s+(\d{4})\b", desc_raw, re.IGNORECASE)
        if bno_m:
            bearing_no = bno_m.group(1)
        elif re.search(r"\b(ball bearing|deep groove ball bearing)\b", desc_norm, re.IGNORECASE):
            # Try to extract 4-digit bearing number from description
            bno_bare = re.search(r"(?<!\d)(\d{4})(?!\d)", desc_norm)
            if bno_bare:
                bearing_no = bno_bare.group(1)

        if bearing_no:
            _set("bearing_number", bearing_no, "description", "high", R_BEARING_NO)
            # Ensure bearing number is NOT confused with size
            # Override size only if it came from description (structured field wins)

        # Metric bolt size (M8, M16, M20, etc.) — extract before other size patterns
        bolt_m = re.search(r"\b(M\d+(?:X\d+)?)\b", desc_raw, re.IGNORECASE)
        dn_m = re.search(r"\b(DN\s*\d+)\b", desc_raw, re.IGNORECASE)
        mixed_m = re.search(r"\b(\d+[-\s]+\d+/\d+\s*in)\b", desc_raw, re.IGNORECASE)
        frac_m = re.search(r"\b(\d+/\d+\s*in)\b", desc_raw, re.IGNORECASE)
        inch_m = re.search(r"(?<![/\-\d])\b(\d+(?:\.\d+)?\s*in)\b", desc_raw, re.IGNORECASE)
        sqmm_m = re.search(r"(?<![\.\d])\b(\d+(?:\.\d+)?\s*sq\s*mm)\b", desc_raw, re.IGNORECASE)
        vg_m = re.search(r"\b(ISO\s*VG\s*\d+|EP\s*\d+)\b", desc_raw, re.IGNORECASE)
        prange_m = re.search(r"\b(0-\d+\s*(?:bar|psi|kg/cm))\b", desc_raw, re.IGNORECASE)
        mm_m = re.search(r"\b(\d+(?:\.\d+)?\s*mm)\b", desc_raw, re.IGNORECASE)

        if bolt_m:
            val = bolt_m.group(1).upper()
            # Normalize: M16X75 → keep as-is (meaningful cross-reference)
            _set("size", val, "description", "high", R_SIZE_METRIC_BOLT)
        elif dn_m:
            _set("size", dn_m.group(1).upper().replace(" ", ""), "description", "high", R_SIZE_DN)
        elif mixed_m:
            _set("size", mixed_m.group(1).lower(), "description", "high", R_SIZE_FRACTION_INCH)
        elif frac_m:
            _set("size", frac_m.group(1).lower(), "description", "high", R_SIZE_FRACTION_INCH)
        elif inch_m:
            _set("size", inch_m.group(1).lower(), "description", "high", R_SIZE_INCH)
        elif sqmm_m:
            _set("size", sqmm_m.group(1).lower(), "description", "high", R_SIZE_SQMM)
        elif vg_m:
            _set("size", vg_m.group(1), "description", "high", R_SIZE_VGISO)
        elif prange_m:
            _set("size", prange_m.group(1).lower(), "description", "medium", "SIZE_PRESSURE_RANGE")
        elif mm_m and "hose" not in desc_norm:
            val = mm_m.group(1).lower()
            _set("size", val, "description", "high", R_SIZE_MM)

        # Hose length: 1000 mm, 5000 mm
        if "hose" in desc_norm:
            hose_len_m = re.search(r"\b(\d+\s*mm)\b", desc_raw, re.IGNORECASE)
            if hose_len_m and "length" not in attrs:
                _set("length", hose_len_m.group(1).lower(), "description", "high", "LENGTH_HOSE_DESC")

        # Pressure class from description: 150#, 300#, CL150
        pc_desc_m = re.search(r"\b(\d+)#\b", desc_raw)
        if pc_desc_m:
            _set("pressure_class", pc_desc_m.group(1), "description", "high", R_PRESSURE_HASH)
        pc_cls_m = re.search(r"\b(?:class|cl)\s*(\d+)\b", desc_raw, re.IGNORECASE)
        if pc_cls_m:
            _set("pressure_class", pc_cls_m.group(1), "description", "high", R_PRESSURE_CLASS)

        # Schedule
        sch_m = re.search(r"\bsch(?:edule)?\s*(\d+)\b", desc_raw, re.IGNORECASE)
        if sch_m:
            _set("schedule", sch_m.group(1), "description", "high", R_SCHEDULE_SCH)

        # ── 6b. Grade from description ──
        # SS 316 / SS316L — explicit grade tokens
        ss316_m = re.search(r"\bSS\s*(316L?|304L?)\b", desc_raw, re.IGNORECASE)
        if ss316_m:
            grade_from_desc = "SS " + ss316_m.group(1).upper()
            rule = R_GRADE_SS316 if "316" in ss316_m.group(1) else R_GRADE_SS304
            _set("material_grade", grade_from_desc, "description", "high", rule)
            _set("material", "stainless steel", "description", "high", R_MAT_SS)

        # ASTM grade tokens in description: A105, A216 WCB, A234 WPB, A106 Gr.B
        astm_grade_m = re.search(
            r"\bASTM\s+(A\d+(?:\s+(?:WCB|WCC|LCB|Gr\.?[A-Z0-9]+))?)\b",
            desc_raw, re.IGNORECASE
        )
        if astm_grade_m:
            _set("material_grade", "ASTM " + astm_grade_m.group(1).upper(), "description", "high", R_GRADE_A105)

        # Bare grade tokens in description: A105, WCB at word boundary
        bare_grade = re.search(r"\b(A105|A106|WCB|WCC|WPB|LCB)\b", desc_raw, re.IGNORECASE)
        if bare_grade:
            _set("material_grade", bare_grade.group(1).upper(), "description", "high", R_GRADE_A105)

        # ── 6c. Material type from description (supplement structured field) ──
        # Valve subtypes
        if re.search(r"\bball\s+valve\b", desc_norm):
            _set("material_type", "ball valve", "description", "high", R_TYPE_BALL_VALVE)
            _set("material_family", "valve", "description", "high", R_FAMILY_VALVE)
        if re.search(r"\bgate\s+valve\b", desc_norm):
            _set("material_type", "gate valve", "description", "high", R_TYPE_GATE_VALVE)
            _set("material_family", "valve", "description", "high", R_FAMILY_VALVE)
        if re.search(r"\bglobe\s+valve\b", desc_norm):
            _set("material_type", "globe valve", "description", "high", R_TYPE_GLOBE_VALVE)
            _set("material_family", "valve", "description", "high", R_FAMILY_VALVE)
        if re.search(r"\bcheck\s+valve\b", desc_norm):
            _set("material_type", "check valve", "description", "high", R_TYPE_CHECK_VALVE)
            _set("material_family", "valve", "description", "high", R_FAMILY_VALVE)
        if re.search(r"\bbutterfly\s+valve\b", desc_norm):
            _set("material_type", "butterfly valve", "description", "high", R_TYPE_BUTTERFLY_VALVE)
            _set("material_family", "valve", "description", "high", R_FAMILY_VALVE)
        if re.search(r"\b(?:safety|pressure\s+safety)\s+valve\b", desc_norm):
            _set("material_type", "safety valve", "description", "high", R_TYPE_SAFETY_VALVE)
            _set("material_family", "valve", "description", "high", R_FAMILY_VALVE)

        # Pump subtypes
        if re.search(r"\bcentrifugal\s+pump\b", desc_norm):
            _set("material_type", "centrifugal pump", "description", "high", R_TYPE_CENTRIFUGAL_PUMP)
            _set("material_family", "pump", "description", "high", R_FAMILY_PUMP)

        # Bearing subtypes
        if re.search(r"\bball\s+bearing\b", desc_norm):
            _set("material_type", "ball bearing", "description", "high", R_TYPE_BALL_BEARING)
            _set("material_family", "bearing", "description", "high", R_FAMILY_BEARING)
        if re.search(r"\bdeep\s+groove\b", desc_norm):
            _set("material_subtype", "deep groove", "description", "high", R_SUBTYPE_DEEP_GROOVE)

        # Flange subtypes — description wins over generic category
        if re.search(r"\bweld\s*neck\s+flange\b", desc_norm):
            # Force set (override pipe/fitting family with more specific flange)
            attrs["material_family"] = "flange"
            sources["material_family"] = "description"
            confidences["material_family"] = "high"
            rules["material_family"] = R_FAMILY_FLANGE
            attrs["material_type"] = "weld neck flange"
            sources["material_type"] = "description"
            confidences["material_type"] = "high"
            rules["material_type"] = R_TYPE_WELDNECK_FLANGE
            _set("connection_type", "weld neck", "description", "high", R_CONN_WELDNECK)
        elif re.search(r"\bslip.?on\s+flange\b", desc_norm):
            attrs["material_family"] = "flange"
            sources["material_family"] = "description"
            confidences["material_family"] = "high"
            rules["material_family"] = R_FAMILY_FLANGE
            attrs["material_type"] = "slip on flange"
            sources["material_type"] = "description"
            confidences["material_type"] = "high"
            rules["material_type"] = R_TYPE_SLIPON_FLANGE
        elif re.search(r"\bblind\s+flange\b", desc_norm):
            attrs["material_family"] = "flange"
            sources["material_family"] = "description"
            confidences["material_family"] = "high"
            rules["material_family"] = R_FAMILY_FLANGE
            attrs["material_type"] = "blind flange"
            sources["material_type"] = "description"
            confidences["material_type"] = "high"
            rules["material_type"] = R_TYPE_BLIND_FLANGE

        # Gasket
        if re.search(r"\bspiral\s+(?:wound\s+)?gasket\b", desc_norm):
            _set("material_type", "spiral wound gasket", "description", "high", R_TYPE_SPIRAL_GASKET)
            _set("material_family", "seal/gasket", "description", "high", R_FAMILY_SEAL)
        elif re.search(r"\bgasket\b", desc_norm):
            _set("material_family", "seal/gasket", "description", "high", R_FAMILY_SEAL)

        # Fasteners
        if re.search(r"\bhex(?:agonal)?\s+nut\b", desc_norm):
            _set("material_type", "nut", "description", "high", R_TYPE_FROM_MATTYPE)
            _set("material_subtype", "hex", "description", "high", R_SUBTYPE_HEX)
            _set("material_family", "fastener", "description", "high", R_FAMILY_FASTENER)
        elif re.search(r"\bnut\b", desc_norm):
            _set("material_type", "nut", "description", "high", R_TYPE_FROM_MATTYPE)
            _set("material_family", "fastener", "description", "high", R_FAMILY_FASTENER)

        if re.search(r"\bhex(?:agonal)?\s+bolt\b", desc_norm):
            _set("material_type", "bolt", "description", "high", R_TYPE_FROM_MATTYPE)
            _set("material_subtype", "hex", "description", "high", R_SUBTYPE_HEX)
            _set("material_family", "fastener", "description", "high", R_FAMILY_FASTENER)
        elif re.search(r"\bbolt\b", desc_norm):
            _set("material_type", "bolt", "description", "high", R_TYPE_FROM_MATTYPE)
            _set("material_family", "fastener", "description", "high", R_FAMILY_FASTENER)

        if re.search(r"\bwasher\b", desc_norm):
            _set("material_type", "washer", "description", "high", R_TYPE_FROM_MATTYPE)
            _set("material_family", "fastener", "description", "high", R_FAMILY_FASTENER)

        # Elbow
        if re.search(r"\belbow\b", desc_norm):
            _set("material_type", "elbow", "description", "high", R_TYPE_FROM_MATTYPE)
            _set("material_family", "pipe/fitting", "description", "high", R_FAMILY_FITTING)

        # Pipe
        if re.search(r"\b(?:seamless\s+)?(?:steel\s+)?pipe\b", desc_norm):
            _set("material_type", "pipe", "description", "high", R_TYPE_FROM_MATTYPE)
            _set("material_family", "pipe/fitting", "description", "high", R_FAMILY_PIPE)
        if re.search(r"\bseamless\b", desc_norm):
            _set("construction", "seamless", "description", "high", R_CONSTRUCT_SEAMLESS)

        # Cable
        if re.search(r"\bcable\b", desc_norm):
            _set("material_type", "cable", "description", "high", R_TYPE_FROM_MATTYPE)
            _set("material_family", "electrical", "description", "high", R_FAMILY_ELECTRICAL)
        if re.search(r"\bxlpe\b", desc_norm):
            _set("material", "xlpe", "description", "high", R_MAT_XLPE)

        # Fuse / Cartridge fuse
        if re.search(r"\bfuse\b|\bcartridge\b", desc_norm):
            _set("material_type", "fuse", "description", "high", R_TYPE_FROM_MATTYPE)
            _set("material_family", "electrical", "description", "high", R_FAMILY_ELECTRICAL)

        # Pressure gauge / Instrumentation
        if re.search(r"\bpressure\s+(?:gauge|indicator)\b", desc_norm):
            _set("material_type", "pressure gauge", "description", "high", R_TYPE_FROM_MATTYPE)
            _set("material_family", "instrumentation", "description", "high", R_FAMILY_INSTRUMENT)
        if re.search(r"\btemperature\s+sensor\b", desc_norm):
            _set("material_type", "temperature sensor", "description", "high", R_TYPE_FROM_MATTYPE)
            _set("material_family", "instrumentation", "description", "high", R_FAMILY_INSTRUMENT)

        # Hydraulic hose
        if re.search(r"\bhose\b", desc_norm):
            _set("material_type", "hydraulic hose", "description", "high", R_TYPE_FROM_MATTYPE)
            _set("material_family", "hose", "description", "high", R_FAMILY_HOSE)

        # Lubricant / Oil
        if re.search(r"\b(?:gear\s+oil|lubricant|oil|grease)\b", desc_norm):
            _set("material_type", "lubricant", "description", "high", R_TYPE_FROM_MATTYPE)
            _set("material_family", "lubricant", "description", "high", R_FAMILY_LUBE)

        # ── 6d. Construction / Subtype from description ──
        if re.search(r"\bfloating\b", desc_norm):
            _set("construction", "floating", "description", "high", R_CONSTRUCT_FLOATING)

        if re.search(r"\bforged\b", desc_norm):
            _set("construction", "forged", "description", "high", R_CONSTRUCT_FORGED)

        if re.search(r"\bcast\b", desc_norm):
            _set("construction", "cast", "description", "medium", R_CONSTRUCT_CAST)

        if re.search(r"\bwelded\b", desc_norm):
            _set("construction", "welded", "description", "high", R_CONSTRUCT_WELDED)

        # ── 6e. Orientation ──
        if re.search(r"\bhorizontal\b", desc_norm):
            _set("orientation", "horizontal", "description", "high", R_ORIENT_HORIZONTAL)
        if re.search(r"\bvertical\b", desc_norm):
            _set("orientation", "vertical", "description", "high", R_ORIENT_VERTICAL)

        # ── 6f. Connection type ──
        if re.search(r"\bflanged\b", desc_norm):
            _set("connection_type", "flanged", "description", "high", R_CONN_FLANGED)
        if re.search(r"\bthreaded\b", desc_norm):
            _set("connection_type", "threaded", "description", "high", R_CONN_THREADED)
        if re.search(r"\bsocket\s+weld\b|\bsw\b", desc_norm):
            _set("connection_type", "socket weld", "description", "high", R_CONN_SW)
        if re.search(r"\bbutt\s+weld\b|\bbw\b", desc_norm):
            _set("connection_type", "butt weld", "description", "high", R_CONN_BW)

        # ── 6g. Coating from description (only if not from structured field) ──
        if "coating" not in attrs:
            for coat_pat, (coat_val, coat_rule) in COATING_MAP.items():
                if re.search(coat_pat, desc_norm, re.IGNORECASE):
                    _set("coating", coat_val, "description", "high", coat_rule)
                    break

        # ── 6h. Standards from description ──
        if "standard" not in attrs:
            stds = []
            for std_pat, std_rule in STANDARD_PATTERNS:
                matches = re.findall(std_pat, desc_raw, re.IGNORECASE)
                for m in matches:
                    s = m.strip()
                    if s and s not in stds:
                        stds.append(s)
            if stds:
                _set("standard", "; ".join(stds), "description", "high", R_STD_ASTM)

        # ── 6i. Material from description for stainless steel ──
        if re.search(r"\bstainless\s+steel\b", desc_norm):
            _set("material", "stainless steel", "description", "high", R_MAT_SS)
        elif re.search(r"\bcarbon\s+steel\b", desc_norm):
            _set("material", "carbon steel", "description", "high", R_MAT_CS)

        # ── Degree / Angle for elbow ──
        angle_m = re.search(r"\b(\d+)\s*degree\b", desc_norm, re.IGNORECASE)
        if angle_m and attrs.get("material_type") == "elbow":
            _set("rating", angle_m.group(1) + "°", "description", "medium", "ELBOW_ANGLE")

        # ══════════════════════════════════════════════
        # STEP 7: Build result
        # ══════════════════════════════════════════════
        SCHEMA = [
            "material_family", "material_type", "material_subtype",
            "material", "material_grade",
            "size", "nominal_size", "length", "width", "height",
            "diameter", "thickness", "pressure_class", "schedule", "rating",
            "standard", "specification",
            "coating", "connection_type", "end_type", "construction",
            "orientation", "bearing_number",
            "manufacturer", "manufacturer_part_no", "unit",
        ]

        result = {}
        for attr in SCHEMA:
            val = attrs.get(attr, None)
            result[attr] = val
            result[f"{attr}__source"] = sources.get(attr, None) if val is not None else None
            result[f"{attr}__confidence"] = confidences.get(attr, None) if val is not None else None
            result[f"{attr}__rule"] = rules.get(attr, None) if val is not None else None

        # Add specification from structured field
        if not _is_null(spec_raw):
            result["specification"] = spec_raw
            result["specification__source"] = "structured_field"
            result["specification__confidence"] = "high"
            result["specification__rule"] = "SPEC_FROM_FIELD"

        # Count extracted attributes (non-null, non-provenance cols)
        non_null_attrs = sum(1 for k in SCHEMA if result.get(k) is not None)

        result["_attribute_count"] = non_null_attrs
        result["_conflict_count"] = len(conflicts)
        result["_has_conflict"] = len(conflicts) > 0
        result["_conflicts_detail"] = "; ".join(
            [f"{c['attribute']}: {c['existing_value']!r} vs {c['new_value']!r}" for c in conflicts]
        ) if conflicts else None
        result["_rules_applied"] = "; ".join(sorted(set(rules.values()))) if rules else None
        result["_sources_used"] = "; ".join(sorted(set(sources.values()))) if sources else None

        return result

    # ─────────────────────────────────────────────────
    # Dataset-level extraction
    # ─────────────────────────────────────────────────

    def extract_dataset(self, df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
        """
        Run attribute extraction across the full normalized dataset.

        Args:
            df: DataFrame from normalized_materials.csv

        Returns:
            (extracted_df, extraction_report_dict)
        """
        total_rows = len(df)

        # Columns to carry forward from input
        carry_cols = [
            "Material_Code", "CPSE", "Material_Description",
            "Normalized_Description", "Material_Category", "Material_Type",
            "Specification", "Material_Grade", "Size", "Length",
            "Diameter", "Coating", "Unit",
        ]

        # Track statistics
        attr_counts: dict[str, int] = {}
        rule_counts: dict[str, int] = {}
        source_counts: dict[str, int] = {}
        confidence_counts = {"high": 0, "medium": 0, "low": 0}
        records_with_any = 0
        records_3plus = 0
        records_5plus = 0
        total_conflicts = 0

        rows_out = []
        for _, row in df.iterrows():
            extracted = self.extract_record(row)

            out_row = {}
            for col in carry_cols:
                out_row[col] = row.get(col)

            # Attach extracted attributes (primary values only, not provenance)
            SCHEMA = [
                "material_family", "material_type", "material_subtype",
                "material", "material_grade",
                "size", "nominal_size", "length", "width", "height",
                "diameter", "thickness", "pressure_class", "schedule", "rating",
                "standard", "specification",
                "coating", "connection_type", "end_type", "construction",
                "orientation", "bearing_number",
                "manufacturer", "manufacturer_part_no", "unit",
            ]

            for attr in SCHEMA:
                val = extracted.get(attr)
                out_row[f"EX_{attr}"] = val
                # Count coverage
                if val is not None and str(val).strip():
                    attr_counts[attr] = attr_counts.get(attr, 0) + 1

            # Audit columns
            n = extracted["_attribute_count"]
            out_row["extraction_attribute_count"] = n
            out_row["extraction_has_conflict"] = extracted["_has_conflict"]
            out_row["extraction_conflicts_detail"] = extracted["_conflicts_detail"]
            out_row["extraction_rules_applied"] = extracted["_rules_applied"]
            out_row["extraction_sources_used"] = extracted["_sources_used"]

            # Coverage stats
            if n >= 1:
                records_with_any += 1
            if n >= 3:
                records_3plus += 1
            if n >= 5:
                records_5plus += 1
            total_conflicts += extracted["_conflict_count"]

            # Rule counts
            if extracted["_rules_applied"]:
                for r in extracted["_rules_applied"].split("; "):
                    if r.strip():
                        rule_counts[r.strip()] = rule_counts.get(r.strip(), 0) + 1

            # Source counts
            if extracted["_sources_used"]:
                for s in extracted["_sources_used"].split("; "):
                    s = s.strip()
                    if s:
                        source_counts[s] = source_counts.get(s, 0) + 1

            # Confidence counts (count per-attribute confidence)
            for attr in SCHEMA:
                conf = extracted.get(f"{attr}__confidence")
                if conf in confidence_counts:
                    confidence_counts[conf] += 1

            rows_out.append(out_row)

        out_df = pd.DataFrame(rows_out)

        # Build report
        attribute_coverage = {
            attr: round(attr_counts.get(attr, 0) / total_rows, 4)
            for attr in [
                "material_family", "material_type", "material_subtype",
                "material", "material_grade", "size",
                "diameter", "length", "pressure_class", "schedule",
                "standard", "coating", "connection_type", "construction",
                "orientation", "bearing_number",
            ]
        }

        report = {
            "phase": "Phase 04: Attribute Extraction",
            "dataset_rows": total_rows,
            "records_processed": total_rows,
            "records_with_attributes": records_with_any,
            "records_without_attributes": total_rows - records_with_any,
            "records_1_plus_attributes": records_with_any,
            "records_3_plus_attributes": records_3plus,
            "records_5_plus_attributes": records_5plus,
            "average_attributes_per_record": round(
                sum(attr_counts.values()) / total_rows, 2
            ) if total_rows > 0 else 0,
            "attribute_coverage": attribute_coverage,
            "rule_application_counts": dict(sorted(rule_counts.items(), key=lambda x: -x[1])),
            "source_counts": source_counts,
            "confidence_counts": confidence_counts,
            "total_conflicts": total_conflicts,
        }

        return out_df, report


attribute_extraction_service = AttributeExtractionService()
