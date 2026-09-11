"""
Legacy Mapping Service (Phase 9)
Deterministic legacy material cross-walk synthesis:
1. Ingests all 5 read-only inputs (raw master, CMM master, CMM members, standardized materials, accepted pairs).
2. Reconciles exact 1-to-1 mapping for all 1,250 source materials across ONGC, IOCL, HPCL, and CPCL.
3. Maps multi-CPSE group members (ONGC-437562, IOCL-875352 -> CMM-VALVE-A79389-001) as MAPPED_VERIFIED.
4. Maps 1,248 standalone materials as MAPPED_STANDALONE with explicit STANDALONE_IDENTITY semantics.
5. Strictly prohibits Phase 9 transitive inference (preserves TRANSITIVE_VERIFIED = 0).
6. Generates deterministic UUIDv5 mapping IDs.
7. Produces deterministic CSV and JSON outputs sorted by (source_cpse, material_code).
"""

import os
import uuid
from typing import Dict, Any, List, Tuple, Optional
import pandas as pd


class LegacyMappingService:
    """
    Service for generating and querying deterministic legacy CPSE -> CMM code cross-walk mappings.
    """

    def __init__(self, data_dir: Optional[str] = None):
        if data_dir is None:
            data_dir = os.path.abspath(
                os.path.join(os.path.dirname(__file__), "..", "..", "data")
            )
        self.data_dir = data_dir
        self.raw_csv = os.path.join(data_dir, "raw", "CPSE_Material_Master_cleaned.csv")
        self.cmm_master_csv = os.path.join(data_dir, "processed", "common_material_master.csv")
        self.cmm_members_csv = os.path.join(data_dir, "processed", "common_material_members.csv")
        self.standardized_csv = os.path.join(data_dir, "processed", "standardized_materials.csv")
        self.accepted_csv = os.path.join(data_dir, "processed", "accepted_harmonization_pairs.csv")

    def load_inputs(self) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """Load all five read-only inputs"""
        df_raw = pd.read_csv(self.raw_csv, dtype=str).fillna("")
        df_cmm = pd.read_csv(self.cmm_master_csv, dtype=str).fillna("")
        df_mem = pd.read_csv(self.cmm_members_csv, dtype=str).fillna("")
        df_std = pd.read_csv(self.standardized_csv, dtype=str).fillna("")
        df_acc = pd.read_csv(self.accepted_csv, dtype=str).fillna("") if os.path.exists(self.accepted_csv) else pd.DataFrame()
        return df_raw, df_cmm, df_mem, df_std, df_acc

    @staticmethod
    def generate_deterministic_mapping_id(source_cpse: str, material_code: str, cmm_code: Optional[str]) -> str:
        """
        Generate deterministic mapping ID using UUIDv5 under NAMESPACE_DNS:
        f"LEGACY_MAP:{source_cpse}:{material_code}:{cmm_code or 'NONE'}"
        """
        target_cmm = cmm_code if cmm_code else "NONE"
        seed = f"LEGACY_MAP:{source_cpse.strip()}:{material_code.strip()}:{target_cmm.strip()}"
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, seed))

    def build_legacy_mappings(self) -> Dict[str, Any]:
        """
        Build the complete deterministic legacy cross-walk catalog:
        - Exactly 1,250 source materials.
        - Exactly 1,250 mapping records.
        - Zero transitive inference.
        - Deterministic fields only.
        """
        df_raw, df_cmm, df_mem, df_std, df_acc = self.load_inputs()

        # 1. Index CMM masters by common_code
        cmm_by_code = {}
        for _, row in df_cmm.iterrows():
            code = str(row["common_code"]).strip()
            cmm_by_code[code] = row.to_dict()

        # 2. Index Phase 8 member records by (source_cpse, source_material_code)
        mem_lookup = {}
        for _, row in df_mem.iterrows():
            cpse = str(row["source_cpse"]).strip()
            mat_code = str(row["source_material_code"]).strip()
            mem_lookup[(cpse, mat_code)] = row.to_dict()

        # 3. Index raw dataset descriptions and metadata by (CPSE, Material_Code)
        raw_lookup = {}
        for _, row in df_raw.iterrows():
            cpse = str(row["CPSE"]).strip()
            mat_code = str(row["Material_Code"]).strip()
            raw_lookup[(cpse, mat_code)] = row.to_dict()

        # 4. Index standardized materials for canonical keys
        std_lookup = {}
        for _, row in df_std.iterrows():
            cpse = str(row["CPSE"]).strip()
            mat_code = str(row["Material_Code"]).strip()
            std_lookup[(cpse, mat_code)] = row.to_dict()

        # 5. Index Phase 7 accepted relationships
        acc_lookup = {}
        if not df_acc.empty:
            for _, row in df_acc.iterrows():
                cand_id = str(row.get("candidate_id", "")).strip()
                s_code = str(row.get("source_material_code", "")).strip()
                c_code = str(row.get("candidate_material_code", "")).strip()
                s_cpse = str(row.get("source_cpse", "")).strip()
                c_cpse = str(row.get("candidate_cpse", "")).strip()

                acc_lookup[(s_cpse, s_code)] = row.to_dict()
                acc_lookup[(c_cpse, c_code)] = row.to_dict()

        # Sort raw materials deterministically by (CPSE, Material_Code)
        sorted_raw_keys = sorted(list(raw_lookup.keys()), key=lambda x: (x[0], x[1]))

        mapping_records = []
        status_counts = {
            "MAPPED_VERIFIED": 0,
            "MAPPED_STANDALONE": 0,
            "REVIEW_REQUIRED": 0,
            "CONFLICT": 0,
            "UNMAPPED": 0,
        }
        semantics_counts = {
            "VERIFIED_CROSS_CPSE": 0,
            "STANDALONE_IDENTITY": 0,
            "TRANSITIVE_VERIFIED": 0,
            "REVIEW_REQUIRED": 0,
            "CONFLICT": 0,
            "UNMAPPED": 0,
        }

        for cpse, mat_code in sorted_raw_keys:
            raw_item = raw_lookup[(cpse, mat_code)]
            source_desc = raw_item.get("Material_Description", "").strip()

            std_item = std_lookup.get((cpse, mat_code), {})
            canon_key = std_item.get("Canonical_Material_Key", "").strip()

            mem_item = mem_lookup.get((cpse, mat_code))
            if not mem_item:
                # Should not occur in validated Phase 8 universe
                mapping_id = self.generate_deterministic_mapping_id(cpse, mat_code, None)
                rec = {
                    "mapping_id": mapping_id,
                    "source_cpse": cpse,
                    "material_code": mat_code,
                    "source_description": source_desc,
                    "cmm_code": None,
                    "cmm_group_id": None,
                    "mapping_status": "UNMAPPED",
                    "membership_type": "NONE",
                    "confidence_score": 0.000,
                    "confidence_semantics": "UNMAPPED",
                    "mapping_method": "UNMAPPED_SOURCE_RECORD",
                    "mapping_reason": "No Phase 8 Common Material Master candidate found for source item",
                    "accepted_candidate_id": "",
                    "phase6_validation_status": "",
                    "phase7_review_decision": "",
                    "evidence_hash": "",
                    "canonical_material_key": canon_key,
                }
                mapping_records.append(rec)
                status_counts["UNMAPPED"] += 1
                semantics_counts["UNMAPPED"] += 1
                continue

            cmm_id = str(mem_item.get("common_material_id", "")).strip()
            cmm_master = cmm_by_code.get(cmm_id, {})
            cmm_code = cmm_master.get("common_code", cmm_id)
            gov_status = cmm_master.get("governance_status", "")
            mem_type = str(mem_item.get("membership_type", "")).strip()

            mapping_id = self.generate_deterministic_mapping_id(cpse, mat_code, cmm_code)

            # Evaluate mapping status and confidence semantics
            if mem_type == "DIRECT_ACCEPTED" and gov_status == "VERIFIED_HARMONIZED":
                status = "MAPPED_VERIFIED"
                semantics = "VERIFIED_CROSS_CPSE"
                conf_score = 1.000
                method = "HUMAN_ACCEPTED_HARMONIZATION"

                # Extract Phase 7 evidence
                acc_info = acc_lookup.get((cpse, mat_code), {})
                cand_id = acc_info.get("candidate_id", "")
                val_status = acc_info.get("validation_status", "VALIDATED_COMPATIBLE")
                p7_decision = "ACCEPT"
                ev_hash = acc_info.get("evidence_snapshot_hash", "")
                reason = (
                    f"Verified cross-CPSE harmonization mapping supported by Phase 7 human review ACCEPT "
                    f"on candidate {cand_id} with cryptographic evidence hash {ev_hash[:12]}..."
                )
            elif mem_type == "STANDALONE":
                status = "MAPPED_STANDALONE"
                semantics = "STANDALONE_IDENTITY"
                conf_score = 1.000
                method = "STANDALONE_CANONICAL_SYNTHESIS"
                cand_id = ""
                val_status = ""
                p7_decision = ""
                ev_hash = ""
                reason = (
                    f"1-to-1 deterministic identity mapping to governed Phase 8 standalone CMM candidate. "
                    f"Does not imply cross-CPSE equivalence or harmonization."
                )
            elif mem_type == "TRANSITIVE_VERIFIED":
                # Only if explicitly present in Phase 8 (0 in baseline)
                status = "MAPPED_VERIFIED"
                semantics = "TRANSITIVE_VERIFIED"
                conf_score = 0.850
                method = "TRANSITIVE_VERIFIED_CLIQUE"
                cand_id = ""
                val_status = "VALIDATED_COMPATIBLE"
                p7_decision = "ACCEPT"
                ev_hash = ""
                reason = "Transitive membership verified in Phase 8 guarded clique with zero engineering conflicts."
            elif gov_status == "SPLIT_CONFLICT":
                status = "CONFLICT"
                semantics = "CONFLICT"
                conf_score = 0.400
                method = "INCOMPATIBLE_CLIQUE_SPLIT"
                cand_id = ""
                val_status = "ENGINEERING_INCOMPATIBLE"
                p7_decision = ""
                ev_hash = ""
                reason = "Conflict detected in upstream clique partitioning; human resolution required."
            elif gov_status == "AMBIGUOUS_REVIEW_REQUIRED":
                status = "REVIEW_REQUIRED"
                semantics = "REVIEW_REQUIRED"
                conf_score = 0.600
                method = "AMBIGUOUS_ATTRIBUTE_HOLD"
                cand_id = ""
                val_status = "REVIEW_REQUIRED"
                p7_decision = ""
                ev_hash = ""
                reason = "Attribute ambiguity in upstream candidate group; human review required."
            else:
                status = "MAPPED_STANDALONE"
                semantics = "STANDALONE_IDENTITY"
                conf_score = 1.000
                method = "STANDALONE_CANONICAL_SYNTHESIS"
                cand_id = ""
                val_status = ""
                p7_decision = ""
                ev_hash = ""
                reason = "1-to-1 mapping to Phase 8 CMM candidate."

            rec = {
                "mapping_id": mapping_id,
                "source_cpse": cpse,
                "material_code": mat_code,
                "source_description": source_desc,
                "cmm_code": cmm_code,
                "cmm_group_id": cmm_id,
                "mapping_status": status,
                "membership_type": mem_type,
                "confidence_score": conf_score,
                "confidence_semantics": semantics,
                "mapping_method": method,
                "mapping_reason": reason,
                "accepted_candidate_id": cand_id,
                "phase6_validation_status": val_status,
                "phase7_review_decision": p7_decision,
                "evidence_hash": ev_hash,
                "canonical_material_key": canon_key,
            }
            mapping_records.append(rec)
            status_counts[status] = status_counts.get(status, 0) + 1
            semantics_counts[semantics] = semantics_counts.get(semantics, 0) + 1

        # Strict deterministic sorting by (source_cpse, material_code)
        mapping_records = sorted(mapping_records, key=lambda x: (x["source_cpse"], x["material_code"]))

        # CPSE breakdown
        cpse_counts = {}
        for r in mapping_records:
            c = r["source_cpse"]
            cpse_counts[c] = cpse_counts.get(c, 0) + 1

        summary = {
            "total_source_materials": len(sorted_raw_keys),
            "total_mappings": len(mapping_records),
            "mapped_verified": status_counts["MAPPED_VERIFIED"],
            "mapped_standalone": status_counts["MAPPED_STANDALONE"],
            "review_required": status_counts["REVIEW_REQUIRED"],
            "conflict": status_counts["CONFLICT"],
            "unmapped": status_counts["UNMAPPED"],
            "transitive_verified": semantics_counts.get("TRANSITIVE_VERIFIED", 0),
            "cpse_distribution": cpse_counts,
            "unique_cmm_codes_mapped": len(set(r["cmm_code"] for r in mapping_records if r["cmm_code"])),
        }

        return {
            "mapping_records": mapping_records,
            "mappings": mapping_records,
            "summary": summary,
            "metrics": summary,
        }

    def build_legacy_mapping_crosswalk(self) -> Dict[str, Any]:
        """Convenience alias for build_legacy_mappings"""
        return self.build_legacy_mappings()

    def generate_crosswalk_dataframe(self) -> pd.DataFrame:
        """Generate pandas DataFrame of deterministic cross-walk mappings"""
        result = self.build_legacy_mappings()
        return pd.DataFrame(result["mapping_records"])

    def load_raw_materials(self) -> pd.DataFrame:
        """Load raw CPSE material master dataset"""
        return pd.read_csv(self.raw_csv, dtype=str).fillna("")

    def load_common_material_master(self) -> pd.DataFrame:
        """Load Phase 8 Common Material Master catalog"""
        return pd.read_csv(self.cmm_master_csv, dtype=str).fillna("")


# Global service instance
legacy_mapping_service = LegacyMappingService()
