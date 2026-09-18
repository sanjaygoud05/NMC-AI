"""
Phase 05 / Phase 4 Service: Material Standardization & Canonicalization
SIH26099 Material Harmonization Platform

This service converts extracted engineering attributes (from Phase 3)
into a deterministic, explainable, testable canonical representation.

Core Principles:
1. Determinism: Same input produces bit-for-bit identical output.
2. Zero-Invention: Only canonicalize existing Phase 3 values; never infer new properties.
3. Separation: Material and Material Grade are strictly separated.
4. Conflict Preservation: Never resolve genuine engineering conflicts (e.g. M16 vs M16X75);
   always flag and preserve them for Phase 6.
5. Explainability: Every canonical change logs rule ID and count.
"""

import re
import csv
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd


# ─────────────────────────────────────────────────────────────────────────────
# Canonical Attribute Order (Section 8)
# ─────────────────────────────────────────────────────────────────────────────
CANONICAL_ATTR_ORDER = [
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
    "specification",
    "coating",
    "connection_type",
    "end_type",
    "construction",
    "orientation",
    "manufacturer",
    "manufacturer_part_no",
    "unit",
]

# Attributes participating in the concise Standardized_Description
DESCRIPTION_ATTR_ORDER = [
    "material_family",
    "material_type",
    "material_subtype",
    "construction",
    "orientation",
    "material",
    "material_grade",
    "nominal_size",
    "size",
    "length",
    "diameter",
    "thickness",
    "pressure_class",
    "schedule",
    "rating",
    "standard",
    "coating",
    "connection_type",
    "end_type",
]

# Attributes participating in the Canonical_Material_Key (material identity)
KEY_ATTR_ORDER = [
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


def _clean_val(val: Any) -> Optional[str]:
    """Helper to clean None, NaN, empty strings, and string representations of null."""
    if val is None:
        return None
    if isinstance(val, float) and (val != val):
        return None
    s = str(val).strip()
    if not s or s.lower() in ("nan", "none", "null", "<na>"):
        return None
    return s


class StandardizationService:
    """
    Deterministic, rule-based canonicalization engine.
    """

    def __init__(self, alias_dict_path: Optional[str] = None):
        self.aliases: Dict[Tuple[str, str], Tuple[str, str]] = {}
        path = alias_dict_path or "data/dictionaries/canonical_aliases.csv"
        self._load_alias_dictionary(path)

    def _load_alias_dictionary(self, path_str: str):
        path = Path(path_str)
        if not path.exists():
            return
        try:
            with open(path, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    cat = row.get("category", "").strip().lower()
                    raw = row.get("raw_value", "").strip().lower()
                    canon = row.get("canonical_value", "").strip()
                    rule = row.get("rule_id", "").strip()
                    if cat and raw and canon:
                        self.aliases[(cat, raw)] = (canon, rule)
        except Exception as e:
            print(f"Warning: Failed to load canonical aliases dictionary: {e}")

    # ─────────────────────────────────────────────────────────────────────────
    # Canonicalization Rules per Attribute
    # ─────────────────────────────────────────────────────────────────────────

    def canonicalize_family(self, val: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
        clean = _clean_val(val)
        if not clean:
            return None, None
        v = clean.lower()
        if ("family", v) in self.aliases:
            canon, rule = self.aliases[("family", v)]
            return canon, rule
        return v.upper(), "FAMILY_UPPERCASE"

    def canonicalize_type(self, val: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
        clean = _clean_val(val)
        if not clean:
            return None, None
        v = clean.lower()
        if ("type", v) in self.aliases:
            canon, rule = self.aliases[("type", v)]
            return canon, rule
        return re.sub(r"\s+", " ", v).upper(), "TYPE_UPPERCASE"

    def canonicalize_subtype(self, val: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
        clean = _clean_val(val)
        if not clean:
            return None, None
        v = clean.lower()
        if ("subtype", v) in self.aliases:
            canon, rule = self.aliases[("subtype", v)]
            return canon, rule
        return v.upper(), "SUBTYPE_UPPERCASE"

    def canonicalize_material(self, val: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
        clean = _clean_val(val)
        if not clean:
            return None, None
        v = clean.lower()
        if ("material", v) in self.aliases:
            canon, rule = self.aliases[("material", v)]
            return canon, rule
        return v.upper(), "MATERIAL_UPPERCASE"

    def canonicalize_grade(self, val: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
        clean = _clean_val(val)
        if not clean:
            return None, None
        v = clean.lower()

        # Specific numerical grades kept separate from material name
        if v == "316":
            return "316", "GRADE_CANONICAL_316"
        if v == "304":
            return "304", "GRADE_CANONICAL_304"

        # Grade prefix canonicalization without inventing new properties
        if re.match(r"^astm\s*a\s*105$", v) or v == "a105":
            return "ASTM A105", "GRADE_FORMAT_ASTM_A105"
        if re.match(r"^astm\s*a\s*216\s*wcb$", v) or v in ["a216 wcb", "wcb"]:
            return "ASTM A216 WCB", "GRADE_FORMAT_ASTM_A216_WCB"
        if re.match(r"^astm\s*a\s*234\s*wpb$", v) or v in ["a234 wpb", "wpb"]:
            return "ASTM A234 WPB", "GRADE_FORMAT_ASTM_A234_WPB"
        if re.match(r"^astm\s*a\s*106\s*gr\.?\s*b$", v) or v in ["a106 gr.b", "a106 gr b"]:
            return "ASTM A106 GR.B", "GRADE_FORMAT_ASTM_A106_GRB"
        if re.match(r"^ss\s*316l?$", v) or v == "ss316":
            suffix = "L" if "l" in v else ""
            return f"SS 316{suffix}", "GRADE_FORMAT_SS316"
        if re.match(r"^ss\s*304l?$", v) or v == "ss304":
            suffix = "L" if "l" in v else ""
            return f"SS 304{suffix}", "GRADE_FORMAT_SS304"
        if v == "pt100":
            return "PT100", "GRADE_FORMAT_PT100"
        if v == "chrome steel":
            return "CHROME STEEL", "GRADE_CANONICAL_CHROME_STEEL"
        if v == "carbon steel":
            return "CARBON STEEL", "GRADE_CANONICAL_CARBON_STEEL"
        if v == "ceramic":
            return "CERAMIC", "GRADE_CANONICAL_CERAMIC"
        if v == "mineral oil":
            return "MINERAL OIL", "GRADE_CANONICAL_MINERAL_OIL"
        if v == "synthetic rubber":
            return "SYNTHETIC RUBBER", "GRADE_CANONICAL_SYNTHETIC_RUBBER"
        if v == "xlpe aluminium":
            return "XLPE ALUMINIUM", "GRADE_CANONICAL_XLPE_AL"
        if v == "xlpe copper":
            return "XLPE COPPER", "GRADE_CANONICAL_XLPE_CU"
        if v == "graphite/ss 316":
            return "GRAPHITE/SS 316", "GRADE_CANONICAL_GRAPHITE_SS316"

        return re.sub(r"\s+", " ", clean).upper(), "GRADE_UPPERCASE"

    def canonicalize_size(self, val: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
        clean = _clean_val(val)
        if not clean:
            return None, None
        v = clean.lower()

        # Fractional and mixed inch
        if re.match(r"^\d+[-\s]+\d+/\d+\s*in(?:ch)?$", v):
            clean_str = re.sub(r"\s*in(?:ch)?$", " IN", v, flags=re.IGNORECASE)
            return clean_str.upper(), "SIZE_FORMAT_MIXED_INCH"
        if re.match(r"^\d+/\d+\s*in(?:ch)?$", v):
            clean_str = re.sub(r"\s*in(?:ch)?$", " IN", v, flags=re.IGNORECASE)
            return clean_str.upper(), "SIZE_FORMAT_FRACTION_INCH"

        # Decimal / Integer inch
        if re.match(r"^\d+(?:\.\d+)?\s*in(?:ch)?$", v):
            clean_str = re.sub(r"\s*in(?:ch)?$", " IN", v, flags=re.IGNORECASE)
            return clean_str.upper(), "SIZE_FORMAT_INCH"

        # MM dimensions
        if re.match(r"^\d+(?:\.\d+)?\s*mm$", v):
            clean_str = re.sub(r"\s*mm$", " MM", v, flags=re.IGNORECASE)
            return clean_str.upper(), "SIZE_FORMAT_MM"

        # Metric bolts (M8, M16, M16X75, M20) - preserve exact engineering distinction
        if re.match(r"^m\d+(?:x\d+)?$", v):
            return v.upper(), "SIZE_FORMAT_METRIC_BOLT"

        # Cable cross section: 25 sq mm, 1.5 sq mm
        if re.match(r"^\d+(?:\.\d+)?\s*sq\s*mm$", v):
            clean_str = re.sub(r"\s*sq\s*mm$", " SQ MM", v, flags=re.IGNORECASE)
            return clean_str.upper(), "SIZE_FORMAT_SQMM"

        # Current (fuses): 10 A, 2 A
        if re.match(r"^\d+\s*a$", v):
            return v.upper(), "SIZE_FORMAT_AMPERE"

        # Pressure range: 0-25 bar
        if re.match(r"^0-\d+\s*bar$", v):
            clean_str = re.sub(r"\s*bar$", " BAR", v, flags=re.IGNORECASE)
            return clean_str.upper(), "SIZE_FORMAT_BAR"

        # Lubricant grades
        if re.match(r"^(?:iso\s*vg\s*\d+|ep\s*\d+)$", v):
            return re.sub(r"\s+", " ", v).upper(), "SIZE_FORMAT_LUBRICANT"

        # Wiring: 3-wire, 4-wire
        if re.match(r"^\d+-wire$", v):
            return v.upper(), "SIZE_FORMAT_WIRE"

        # Bearing numbers: 6202..6209
        if re.match(r"^\d{4}$", v):
            return v, "SIZE_BEARING_NUMBER"

        return clean.upper(), "SIZE_UPPERCASE"

    def canonicalize_dimension(self, val: Optional[str], dim_type: str = "length") -> Tuple[Optional[str], Optional[str]]:
        clean = _clean_val(val)
        if not clean:
            return None, None
        v = clean.lower()
        if re.match(r"^\d+(?:\.\d+)?\s*mm$", v):
            clean_str = re.sub(r"\s*mm$", " MM", v, flags=re.IGNORECASE)
            return clean_str.upper(), f"{dim_type.upper()}_FORMAT_MM"
        return clean.upper(), f"{dim_type.upper()}_UPPERCASE"

    def canonicalize_rating(self, val: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
        clean = _clean_val(val)
        if not clean:
            return None, None
        # Convert degree symbol to DEG for clean ASCII
        clean_str = re.sub(r"(\d+)\s*(?:°|deg|degree)", r"\1 DEG", clean, flags=re.IGNORECASE)
        return clean_str.upper(), "RATING_FORMAT_DEG"

    def canonicalize_standard(self, val: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
        clean = _clean_val(val)
        if not clean:
            return None, None
        tokens = [t.strip() for t in clean.split(";") if t.strip()]
        canon_tokens = []
        rules_used = []

        for token in tokens:
            t_upper = token.upper()
            t_clean = re.sub(r"\s+", " ", t_upper)

            # Specific standard prefix formatters
            if re.match(r"^API\s*\d+[A-Z]?$", t_clean):
                t_clean = re.sub(r"^API\s*", "API ", t_clean)
                rules_used.append("STANDARD_FORMAT_API")
            elif re.match(r"^ASME\s*B\d+\.\d+$", t_clean):
                t_clean = re.sub(r"^ASME\s*", "ASME ", t_clean)
                rules_used.append("STANDARD_FORMAT_ASME")
            elif re.match(r"^ASTM\s*[A-Z]\d+", t_clean):
                t_clean = re.sub(r"^ASTM\s*", "ASTM ", t_clean)
                rules_used.append("STANDARD_FORMAT_ASTM")
            elif re.match(r"^IEC\s*\d+", t_clean):
                t_clean = re.sub(r"^IEC\s*", "IEC ", t_clean)
                rules_used.append("STANDARD_FORMAT_IEC")
            elif re.match(r"^ISO\s*(?:VG\s*)?\d+", t_clean):
                t_clean = re.sub(r"^ISO\s*", "ISO ", t_clean)
                rules_used.append("STANDARD_FORMAT_ISO")
            elif re.match(r"^IS\s*\d+", t_clean):
                t_clean = re.sub(r"^IS\s*", "IS ", t_clean)
                rules_used.append("STANDARD_FORMAT_IS")
            elif re.match(r"^SAE\s*\d+", t_clean):
                t_clean = re.sub(r"^SAE\s*", "SAE ", t_clean)
                rules_used.append("STANDARD_FORMAT_SAE")
            elif re.match(r"^EN\s*\d+", t_clean):
                t_clean = re.sub(r"^EN\s*", "EN ", t_clean)
                rules_used.append("STANDARD_FORMAT_EN")
            else:
                rules_used.append("STANDARD_FORMAT_GENERIC")

            if t_clean not in canon_tokens:
                canon_tokens.append(t_clean)

        canon_tokens.sort()
        rule_str = rules_used[0] if len(rules_used) == 1 else "STANDARD_FORMAT_MULTI"
        return "; ".join(canon_tokens), rule_str

    def canonicalize_coating(self, val: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
        clean = _clean_val(val)
        if not clean:
            return None, None
        v = clean.lower()
        if ("coating", v) in self.aliases:
            canon, rule = self.aliases[("coating", v)]
            return canon, rule
        return v.upper(), "COATING_UPPERCASE"

    def canonicalize_connection(self, val: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
        clean = _clean_val(val)
        if not clean:
            return None, None
        v = clean.lower()
        if ("connection", v) in self.aliases:
            canon, rule = self.aliases[("connection", v)]
            return canon, rule
        return v.upper(), "CONNECTION_UPPERCASE"

    def canonicalize_construction(self, val: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
        clean = _clean_val(val)
        if not clean:
            return None, None
        v = clean.lower()
        if ("construction", v) in self.aliases:
            canon, rule = self.aliases[("construction", v)]
            return canon, rule
        return v.upper(), "CONSTRUCTION_UPPERCASE"

    def canonicalize_orientation(self, val: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
        clean = _clean_val(val)
        if not clean:
            return None, None
        v = clean.lower()
        if ("orientation", v) in self.aliases:
            canon, rule = self.aliases[("orientation", v)]
            return canon, rule
        return v.upper(), "ORIENTATION_UPPERCASE"

    def canonicalize_unit(self, val: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
        clean = _clean_val(val)
        if not clean:
            return None, None
        v = clean.lower()
        if ("unit", v) in self.aliases:
            canon, rule = self.aliases[("unit", v)]
            return canon, rule
        return v.upper(), "UNIT_UPPERCASE"

    def canonicalize_opaque_field(self, val: Optional[str], field_name: str) -> Tuple[Optional[str], Optional[str]]:
        clean = _clean_val(val)
        if not clean:
            return None, None
        cleaned_str = re.sub(r"\s+", " ", clean).upper()
        return cleaned_str, f"{field_name.upper()}_TRIM"

    # ─────────────────────────────────────────────────────────────────────────
    # Record-Level Standardization
    # ─────────────────────────────────────────────────────────────────────────

    def standardize_record(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """
        Standardize a single material record from Phase 3 output.
        Returns a dict of all canonical fields, audit metadata,
        Standardized_Description, and Canonical_Material_Key.
        """
        canon_attrs: Dict[str, Optional[str]] = {}
        rules_applied: List[str] = []

        def _apply(attr: str, canonical_val: Optional[str], rule_id: Optional[str], orig_val: Optional[str]):
            canon_attrs[attr] = canonical_val
            if canonical_val is not None and rule_id is not None:
                rules_applied.append(rule_id)

        # 1. Material Family
        cf, rf = self.canonicalize_family(row.get("EX_material_family"))
        _apply("material_family", cf, rf, row.get("EX_material_family"))

        # 2. Material Type
        ct, rt = self.canonicalize_type(row.get("EX_material_type"))
        _apply("material_type", ct, rt, row.get("EX_material_type"))

        # 3. Material Subtype
        csub, rsub = self.canonicalize_subtype(row.get("EX_material_subtype"))
        _apply("material_subtype", csub, rsub, row.get("EX_material_subtype"))

        # 4. Material
        cmat, rmat = self.canonicalize_material(row.get("EX_material"))
        _apply("material", cmat, rmat, row.get("EX_material"))

        # 5. Material Grade (strictly kept separate from material)
        cgrade, rgrade = self.canonicalize_grade(row.get("EX_material_grade"))
        _apply("material_grade", cgrade, rgrade, row.get("EX_material_grade"))

        # 6. Nominal Size
        cnom, rnom = self.canonicalize_size(row.get("EX_nominal_size"))
        _apply("nominal_size", cnom, rnom, row.get("EX_nominal_size"))

        # 7. Size
        csize, rsize = self.canonicalize_size(row.get("EX_size"))
        _apply("size", csize, rsize, row.get("EX_size"))

        # 8. Length
        clen, rlen = self.canonicalize_dimension(row.get("EX_length"), "length")
        _apply("length", clen, rlen, row.get("EX_length"))

        # 9. Width
        cwid, rwid = self.canonicalize_dimension(row.get("EX_width"), "width")
        _apply("width", cwid, rwid, row.get("EX_width"))

        # 10. Height
        chgt, rhgt = self.canonicalize_dimension(row.get("EX_height"), "height")
        _apply("height", chgt, rhgt, row.get("EX_height"))

        # 11. Diameter
        cdia, rdia = self.canonicalize_dimension(row.get("EX_diameter"), "diameter")
        _apply("diameter", cdia, rdia, row.get("EX_diameter"))

        # 12. Thickness
        cthk, rthk = self.canonicalize_dimension(row.get("EX_thickness"), "thickness")
        _apply("thickness", cthk, rthk, row.get("EX_thickness"))

        # 13. Pressure Class
        cpc, rpc = self.canonicalize_opaque_field(row.get("EX_pressure_class"), "pressure_class")
        _apply("pressure_class", cpc, rpc, row.get("EX_pressure_class"))

        # 14. Schedule
        csch, rsch = self.canonicalize_opaque_field(row.get("EX_schedule"), "schedule")
        _apply("schedule", csch, rsch, row.get("EX_schedule"))

        # 15. Rating
        crat, rrat = self.canonicalize_rating(row.get("EX_rating"))
        _apply("rating", crat, rrat, row.get("EX_rating"))

        # 16. Standard
        cstd, rstd = self.canonicalize_standard(row.get("EX_standard"))
        _apply("standard", cstd, rstd, row.get("EX_standard"))

        # 17. Specification (preserved as-is with normalized spacing)
        cspec, rspec = self.canonicalize_opaque_field(row.get("EX_specification"), "specification")
        _apply("specification", cspec, rspec, row.get("EX_specification"))

        # 18. Coating
        ccoat, rcoat = self.canonicalize_coating(row.get("EX_coating"))
        _apply("coating", ccoat, rcoat, row.get("EX_coating"))

        # 19. Connection Type
        cconn, rconn = self.canonicalize_connection(row.get("EX_connection_type"))
        _apply("connection_type", cconn, rconn, row.get("EX_connection_type"))

        # 20. End Type
        cend, rend = self.canonicalize_opaque_field(row.get("EX_end_type"), "end_type")
        _apply("end_type", cend, rend, row.get("EX_end_type"))

        # 21. Construction
        ccon, rcon = self.canonicalize_construction(row.get("EX_construction"))
        _apply("construction", ccon, rcon, row.get("EX_construction"))

        # 22. Orientation
        cori, rori = self.canonicalize_orientation(row.get("EX_orientation"))
        _apply("orientation", cori, rori, row.get("EX_orientation"))

        # 23. Manufacturer
        cmfg, rmfg = self.canonicalize_opaque_field(row.get("Manufacturer") or row.get("EX_manufacturer"), "manufacturer")
        _apply("manufacturer", cmfg, rmfg, row.get("Manufacturer") or row.get("EX_manufacturer"))

        # 24. Manufacturer Part No
        cpn, rpn = self.canonicalize_opaque_field(row.get("Manufacturer_Part_No") or row.get("EX_manufacturer_part_no"), "manufacturer_part_no")
        _apply("manufacturer_part_no", cpn, rpn, row.get("Manufacturer_Part_No") or row.get("EX_manufacturer_part_no"))

        # 25. Unit
        cunit, runit = self.canonicalize_unit(row.get("Unit") or row.get("EX_unit"))
        _apply("unit", cunit, runit, row.get("Unit") or row.get("EX_unit"))

        # ─────────────────────────────────────────────────────────────────────
        # Build Standardized_Description
        # Concise human-readable pipe-separated representation of populated attributes
        # ─────────────────────────────────────────────────────────────────────
        desc_parts = []
        for k in DESCRIPTION_ATTR_ORDER:
            val = canon_attrs.get(k)
            c = _clean_val(val)
            if c:
                desc_parts.append(c)
        standardized_desc = " | ".join(desc_parts)

        # ─────────────────────────────────────────────────────────────────────
        # Build Canonical_Material_Key
        # Machine-readable, order-consistent, case-consistent, whitespace-free
        # ─────────────────────────────────────────────────────────────────────
        key_parts = []
        for k in KEY_ATTR_ORDER:
            val = canon_attrs.get(k)
            c = _clean_val(val)
            if c:
                clean_token = re.sub(r"[\s/\-]+", "_", c.upper())
                clean_token = re.sub(r"[^A-Z0-9_]+", "", clean_token).strip("_")
                if clean_token:
                    key_parts.append(clean_token)
        canonical_key = "|".join(key_parts)

        # ─────────────────────────────────────────────────────────────────────
        # Change Detection
        # Compare canonical values to Phase 3 values
        # ─────────────────────────────────────────────────────────────────────
        changed = False
        for attr in CANONICAL_ATTR_ORDER:
            p3_val = _clean_val(row.get(f"EX_{attr}")) or ""
            c_val = _clean_val(canon_attrs.get(attr)) or ""
            if p3_val != c_val:
                changed = True
                break

        # Conflict Preservation: Must preserve Phase 3 conflict metadata strictly
        has_conflict = str(row.get("extraction_has_conflict", "")).lower() in ["true", "1"]
        conflict_detail = row.get("extraction_conflicts_detail")

        # Distinct rule list
        distinct_rules = sorted(list(set(rules_applied)))

        out = {
            "Standardized_Description": standardized_desc,
            "Canonical_Material_Key": canonical_key,
            "Canonical_Material_Family": canon_attrs["material_family"],
            "Canonical_Material_Type": canon_attrs["material_type"],
            "Canonical_Material_Subtype": canon_attrs["material_subtype"],
            "Canonical_Material": canon_attrs["material"],
            "Canonical_Material_Grade": canon_attrs["material_grade"],
            "Canonical_Nominal_Size": canon_attrs["nominal_size"],
            "Canonical_Size": canon_attrs["size"],
            "Canonical_Length": canon_attrs["length"],
            "Canonical_Width": canon_attrs["width"],
            "Canonical_Height": canon_attrs["height"],
            "Canonical_Diameter": canon_attrs["diameter"],
            "Canonical_Thickness": canon_attrs["thickness"],
            "Canonical_Pressure_Class": canon_attrs["pressure_class"],
            "Canonical_Schedule": canon_attrs["schedule"],
            "Canonical_Rating": canon_attrs["rating"],
            "Canonical_Standard": canon_attrs["standard"],
            "Canonical_Specification": canon_attrs["specification"],
            "Canonical_Coating": canon_attrs["coating"],
            "Canonical_Connection_Type": canon_attrs["connection_type"],
            "Canonical_End_Type": canon_attrs["end_type"],
            "Canonical_Construction": canon_attrs["construction"],
            "Canonical_Orientation": canon_attrs["orientation"],
            "Canonical_Manufacturer": canon_attrs["manufacturer"],
            "Canonical_Manufacturer_Part_No": canon_attrs["manufacturer_part_no"],
            "Canonical_Unit": canon_attrs["unit"],
            "Standardization_Changed": changed,
            "Standardization_Rule_Count": len(distinct_rules),
            "Standardization_Rules_Applied": "; ".join(distinct_rules) if distinct_rules else None,
            "Standardization_Conflict_Preserved": has_conflict,
            "extraction_has_conflict": has_conflict,
            "extraction_conflicts_detail": conflict_detail,
        }
        return out

    # ─────────────────────────────────────────────────────────────────────────
    # Dataset Standardization
    # ─────────────────────────────────────────────────────────────────────────

    def standardize_dataset(self, df: pd.DataFrame, norm_df: Optional[pd.DataFrame] = None) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Run standardization across the entire extracted attributes dataset.
        Preserves original fields and Phase 3 data while appending canonical fields.
        """
        total_rows = len(df)
        records_changed = 0
        rule_counts: Dict[str, int] = {}
        canonical_keys: List[str] = []
        conflicts_preserved_count = 0
        conflict_types: Dict[str, int] = {}

        # Attribute impact tracking
        input_uniques: Dict[str, set] = {attr: set() for attr in CANONICAL_ATTR_ORDER}
        output_uniques: Dict[str, set] = {attr: set() for attr in CANONICAL_ATTR_ORDER}
        attr_changed_counts: Dict[str, int] = {attr: 0 for attr in CANONICAL_ATTR_ORDER}

        # Build lookup for business metadata if norm_df provided
        business_lookup: Dict[str, Dict[str, Any]] = {}
        if norm_df is not None and "Material_Code" in norm_df.columns:
            for _, r in norm_df.iterrows():
                code = str(r["Material_Code"])
                business_lookup[code] = {
                    "Manufacturer": r.get("Manufacturer"),
                    "Manufacturer_Part_No": r.get("Manufacturer_Part_No"),
                    "Plant": r.get("Plant"),
                    "Material_Status": r.get("Material_Status"),
                    "Annual_Consumption": r.get("Annual_Consumption"),
                    "Last_Purchase_Date": r.get("Last_Purchase_Date"),
                }

        output_rows = []
        for _, row in df.iterrows():
            row_dict = row.where(pd.notna(row), None).to_dict()
            code = str(row_dict.get("Material_Code", ""))

            # Augment with business metadata if available
            if code in business_lookup:
                for k, v in business_lookup[code].items():
                    if k not in row_dict or row_dict[k] is None:
                        row_dict[k] = v

            std = self.standardize_record(row_dict)

            # Track stats
            if std["Standardization_Changed"]:
                records_changed += 1

            if std["Standardization_Conflict_Preserved"]:
                conflicts_preserved_count += 1
                detail = str(row_dict.get("extraction_conflicts_detail") or "")
                for part in detail.split(";"):
                    attr_name = part.split(":")[0].strip()
                    if attr_name:
                        conflict_types[attr_name] = conflict_types.get(attr_name, 0) + 1

            if std["Standardization_Rules_Applied"]:
                for r in std["Standardization_Rules_Applied"].split("; "):
                    rule_counts[r] = rule_counts.get(r, 0) + 1

            canonical_keys.append(std["Canonical_Material_Key"])

            # Track attribute unique counts & changes
            for attr in CANONICAL_ATTR_ORDER:
                in_val = row_dict.get(f"EX_{attr}")
                out_val = std[f"Canonical_{'_'.join([part.capitalize() for part in attr.split('_')])}"]
                if in_val:
                    input_uniques[attr].add(str(in_val))
                if out_val:
                    output_uniques[attr].add(str(out_val))
                if str(in_val or "").strip() != str(out_val or "").strip():
                    attr_changed_counts[attr] += 1

            # Combine original columns + EX_ columns + canonical columns
            merged_row = dict(row_dict)
            merged_row.update(std)
            output_rows.append(merged_row)

        out_df = pd.DataFrame(output_rows)

        # Canonical key statistics
        from collections import Counter
        key_freq = Counter(canonical_keys)
        unique_keys_count = len(key_freq)
        records_with_unique_key = sum(1 for k, c in key_freq.items() if c == 1)
        records_sharing_key = sum(c for k, c in key_freq.items() if c > 1)

        # Generate up to 15 representative real examples by sampling directly from the dataset
        examples = []
        try:
            # Mix: some with conflicts, some clean
            conflict_rows = out_df[out_df["Standardization_Conflict_Preserved"] == True]
            clean_rows = out_df[out_df["Standardization_Conflict_Preserved"] == False]
            n_conflict = min(8, len(conflict_rows))
            n_clean = min(7, len(clean_rows))
            sample_df = pd.concat([
                conflict_rows.sample(n=n_conflict, random_state=42) if n_conflict > 0 else pd.DataFrame(),
                clean_rows.sample(n=n_clean, random_state=42) if n_clean > 0 else pd.DataFrame(),
            ])
            # Fall back if both empty
            if sample_df.empty:
                sample_df = out_df.sample(n=min(15, len(out_df)), random_state=42)

            for _, r in sample_df.iterrows():
                code = str(r.get("Material_Code", ""))
                if not code or code == "nan":
                    continue
                examples.append({
                    "material_code": code,
                    "original_description": str(r.get("Material_Description", "")),
                    "phase3_extracted": {
                        k.replace("EX_", ""): str(r[k]).strip()
                        for k in out_df.columns
                        if k.startswith("EX_")
                        and r.get(k) is not None
                        and not pd.isna(r.get(k))
                        and str(r.get(k)).strip()
                        and str(r.get(k)).strip().lower() != "nan"
                    },
                    "standardized_description": str(r.get("Standardized_Description", "")),
                    "canonical_material_key": str(r.get("Canonical_Material_Key", "")),
                    "rules_applied": str(r.get("Standardization_Rules_Applied", "")),
                    "conflict_preserved": bool(r.get("Standardization_Conflict_Preserved", False)),
                })
        except Exception:
            examples = []


        report = {
            "phase": "Phase 05: Material Standardization & Canonicalization",
            "dataset": {
                "input_rows": total_rows,
                "output_rows": len(out_df),
                "input_columns": len(df.columns),
                "output_columns": len(out_df.columns),
            },
            "standardization": {
                "records_processed": total_rows,
                "records_changed": records_changed,
                "records_unchanged": total_rows - records_changed,
                "change_rate": round(records_changed / total_rows, 4) if total_rows else 0,
            },
            "canonical_keys": {
                "total_records": total_rows,
                "unique_canonical_keys": unique_keys_count,
                "records_with_unique_keys": records_with_unique_key,
                "records_sharing_canonical_key": records_sharing_key,
            },
            "conflicts": {
                "records_with_preserved_conflicts": conflicts_preserved_count,
                "conflicts_resolved": 0,
                "conflict_types": conflict_types,
            },
            "rule_usage": [
                {"rule_id": k, "count": v}
                for k, v in sorted(rule_counts.items(), key=lambda x: -x[1])
            ],
            "attribute_impact": {
                attr: {
                    "input_unique_values": len(input_uniques[attr]),
                    "output_unique_values": len(output_uniques[attr]),
                    "changed_count": attr_changed_counts[attr],
                }
                for attr in CANONICAL_ATTR_ORDER
            },
            "examples": examples,
        }

        return out_df, report


standardization_service = StandardizationService()
