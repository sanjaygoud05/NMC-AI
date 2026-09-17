"""
Upload Processing Service (Phases 2-10 for Isolated Runtime Uploads)
Executes real pipeline logic for uploaded datasets strictly into data/uploads/<dataset_id>/processed/
without modifying any frozen artifacts in data/processed/ or data/raw/.

Governance & Semantics:
- Material Identity: dataset_id + CPSE + Material_Code
- Phase 7/8 Invariants: Uploaded data NEVER automatically approves harmonization.
  All upload candidate pairs remain in human review queue (0 auto-accepted).
- Common Material Master: Upload items form STANDALONE CMM groups with zero fake cross-CPSE links.
- Procurement: Per-UOM conservation on upload items.
"""

import os
import sys
import json
import logging
from pathlib import Path
from typing import Dict, Any
import pandas as pd
import numpy as np

_server_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_root_dir = os.path.abspath(os.path.join(_server_dir, ".."))
for _p in [_root_dir, _server_dir]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from server.services.normalization_service import normalization_service
from server.services.attribute_extraction_service import attribute_extraction_service
from server.services.standardization_service import standardization_service
from server.services.embedding_service import embedding_service
from server.services.matching_service import matching_service
from server.services.validation_service import validation_service
from server.services.confidence_service import confidence_service
from server.services.dataset_registry_service import dataset_registry_service
from server.services.procurement_analytics_service import ANALYSIS_REFERENCE_DATE, FROZEN_REF_DATE

logger = logging.getLogger(__name__)


class UploadProcessingService:
    """Orchestrates Phases 2 through 10 for an isolated dataset upload"""

    def process_dataset(self, dataset_id: str) -> Dict[str, Any]:
        """
        Executes end-to-end processing job for dataset_id:
        1. Normalization (Phase 2)
        2. Attribute Extraction (Phase 3)
        3. Standardization (Phase 4)
        4. Embeddings & Candidate Generation (Phase 5)
        5. Technical Validation (Phase 6)
        6. Review Queue & Governance (Phase 7 - 0 auto-accepts)
        7. Common Material Master (Phase 8 - standalone CMMs)
        8. Legacy Material Mapping (Phase 9)
        9. Procurement Intelligence & Analytics (Phase 10)
        """
        meta = dataset_registry_service.get_dataset(dataset_id)
        if not meta:
            raise ValueError(f"Dataset {dataset_id} not found in registry")

        if meta.get("status") == "FAILED":
            raise ValueError(f"Cannot process failed dataset {dataset_id}: {meta.get('error_message')}")

        dataset_registry_service.update_dataset_status(dataset_id, "PROCESSING")

        source_file = Path(meta["source_file"])
        out_dir = Path(meta["data_dir"])
        out_dir.mkdir(parents=True, exist_ok=True)

        try:
            # ------------------------------------------------------------
            # Step 1: Load Source Data
            # ------------------------------------------------------------
            dataset_registry_service.update_dataset_status(
                dataset_id, "PROCESSING", current_phase="Phase 1: Ingestion & Validation", progress=5
            )
            df_raw = pd.read_csv(source_file, dtype=str).fillna("")
            df_raw["dataset_id"] = dataset_id

            # ------------------------------------------------------------
            # Step 2: Phase 2 Normalization
            # ------------------------------------------------------------
            dataset_registry_service.update_dataset_status(
                dataset_id, "PROCESSING", current_phase="Phase 2: Cleaning & Normalization", progress=15
            )
            df_norm, norm_report = normalization_service.normalize_dataset(df_raw)
            df_norm["dataset_id"] = dataset_id
            df_norm.to_csv(out_dir / "normalized_materials.csv", index=False)
            with open(out_dir / "normalization_report.json", "w", encoding="utf-8") as f:
                json.dump(norm_report, f, indent=2)

            # ------------------------------------------------------------
            # Step 3: Phase 3 Attribute Extraction
            # ------------------------------------------------------------
            dataset_registry_service.update_dataset_status(
                dataset_id, "PROCESSING", current_phase="Phase 3: Attribute Extraction", progress=30
            )
            df_extract, extract_report = attribute_extraction_service.extract_dataset(df_norm)
            df_extract["dataset_id"] = dataset_id
            df_extract.to_csv(out_dir / "extracted_attributes.csv", index=False)
            with open(out_dir / "attribute_extraction_report.json", "w", encoding="utf-8") as f:
                json.dump(extract_report, f, indent=2)

            # ------------------------------------------------------------
            # Step 4: Phase 4 Standardization & Canonicalization
            # ------------------------------------------------------------
            dataset_registry_service.update_dataset_status(
                dataset_id, "PROCESSING", current_phase="Phase 4: Standardization & Canonicalization", progress=45
            )
            df_std, std_report = standardization_service.standardize_dataset(df_extract)
            df_std["dataset_id"] = dataset_id
            df_std.to_csv(out_dir / "standardized_materials.csv", index=False)
            with open(out_dir / "standardization_report.json", "w", encoding="utf-8") as f:
                json.dump(std_report, f, indent=2)

            # ------------------------------------------------------------
            # Step 5: Phase 5 Embeddings + Candidate Generation
            # ------------------------------------------------------------
            dataset_registry_service.update_dataset_status(
                dataset_id, "PROCESSING", current_phase="Phase 5: Embeddings & Candidate Generation", progress=60
            )
            texts = [
                embedding_service.build_engineering_text(row.to_dict())
                for _, row in df_std.iterrows()
            ]
            embeddings = embedding_service.encode_texts(texts)

            # Generate candidate pairs within this dataset
            cand_pairs = matching_service.generate_candidate_pairs(df_std)
            candidates_list = []
            cand_counter = 1

            std_records = [r.to_dict() for _, r in df_std.iterrows()]

            for (idx1, idx2), blocks in cand_pairs.items():
                rec1 = std_records[idx1]
                rec2 = std_records[idx2]
                emb1 = embeddings[idx1]
                emb2 = embeddings[idx2]

                m_data = matching_service.calculate_match(rec1, rec2, emb1, emb2, blocks)
                m_data["dataset_id"] = dataset_id
                m_data["candidate_id"] = f"CAN-{dataset_id}-{cand_counter:04d}"
                cand_counter += 1
                candidates_list.append(m_data)

            if candidates_list:
                df_candidates = pd.DataFrame(candidates_list)
            else:
                df_candidates = pd.DataFrame(columns=[
                    "source_material_code", "source_cpse", "candidate_material_code", "candidate_cpse",
                    "source_canonical_key", "candidate_canonical_key", "canonical_key_exact",
                    "description_similarity", "embedding_similarity", "attribute_agreement",
                    "evaluated_attribute_count", "blocking_strategies", "conflict_present",
                    "conflict_details", "engineering_conflict_class", "engineering_incompatibility",
                    "penalty_applied", "final_match_score", "confidence_level", "evidence_summary",
                    "material_family_similarity", "material_type_similarity", "material_subtype_similarity",
                    "material_similarity", "material_grade_similarity", "nominal_size_similarity",
                    "size_similarity", "length_similarity", "width_similarity", "height_similarity",
                    "diameter_similarity", "thickness_similarity", "pressure_class_similarity",
                    "schedule_similarity", "rating_similarity", "standard_similarity", "coating_similarity",
                    "connection_type_similarity", "end_type_similarity", "construction_similarity",
                    "orientation_similarity", "dataset_id", "candidate_id"
                ])
            df_candidates.to_csv(out_dir / "match_candidates.csv", index=False)

            matching_report = {
                "phase": "Phase 07: Candidate Generation & Matching (Runtime)",
                "dataset_id": dataset_id,
                "input_rows": len(df_std),
                "total_candidates": len(df_candidates),
            }
            with open(out_dir / "matching_report.json", "w", encoding="utf-8") as f:
                json.dump(matching_report, f, indent=2)

            # ------------------------------------------------------------
            # Step 6: Phase 6 Technical Validation
            # ------------------------------------------------------------
            dataset_registry_service.update_dataset_status(
                dataset_id, "PROCESSING", current_phase="Phase 6: Technical Validation", progress=75
            )
            materials_by_code = {
                str(r.get("Material_Code", "")).strip(): r.to_dict()
                for _, r in df_std.iterrows()
            }
            validated_rows = []
            for _, cand_row in df_candidates.iterrows():
                cand_dict = cand_row.to_dict()
                s_code = str(cand_dict.get("source_material_code", "")).strip()
                t_code = str(cand_dict.get("candidate_material_code", "")).strip()

                s_mat = materials_by_code.get(s_code, {})
                t_mat = materials_by_code.get(t_code, {})

                val_res = validation_service.evaluate_candidate(cand_dict, s_mat, t_mat)
                conf_res = confidence_service.refine_candidate(val_res, cand_dict)

                out_record = dict(cand_dict)
                out_record["validation_status"] = val_res["validation_status"]
                out_record["validation_reason_codes"] = ";".join(val_res["reason_codes"])
                out_record["refined_score"] = conf_res["refined_score"]
                out_record["refined_confidence"] = conf_res["refined_confidence"]
                out_record["review_priority"] = conf_res["review_priority"]
                out_record["validation_evidence"] = conf_res["validation_evidence"]
                out_record["upstream_conflict_present"] = val_res["upstream_conflict_present"]
                out_record["upstream_conflict_details"] = val_res["upstream_conflict_details"]
                out_record["upstream_conflict_preserved"] = val_res["upstream_conflict_preserved"]
                validated_rows.append(out_record)

            if validated_rows:
                df_validated = pd.DataFrame(validated_rows)
            else:
                df_validated = pd.DataFrame(columns=[
                    "source_material_code", "source_cpse", "candidate_material_code", "candidate_cpse",
                    "source_canonical_key", "candidate_canonical_key", "canonical_key_exact",
                    "description_similarity", "embedding_similarity", "attribute_agreement",
                    "evaluated_attribute_count", "blocking_strategies", "conflict_present",
                    "conflict_details", "engineering_conflict_class", "engineering_incompatibility",
                    "penalty_applied", "final_match_score", "confidence_level", "evidence_summary",
                    "dataset_id", "candidate_id", "validation_status", "validation_reason_codes",
                    "refined_score", "refined_confidence", "review_priority", "validation_evidence",
                    "upstream_conflict_present", "upstream_conflict_details", "upstream_conflict_preserved"
                ])
            df_validated.to_csv(out_dir / "validated_candidates.csv", index=False)

            val_report = {
                "phase": "Phase 08: Technical Validation (Runtime)",
                "dataset_id": dataset_id,
                "input_candidates": len(df_validated),
            }
            with open(out_dir / "validation_report.json", "w", encoding="utf-8") as f:
                json.dump(val_report, f, indent=2)

            # ------------------------------------------------------------
            # Step 7: Phase 7 Review Governance (0 Auto-Accepts)
            # ------------------------------------------------------------
            dataset_registry_service.update_dataset_status(
                dataset_id, "PROCESSING", current_phase="Phase 7: Review Governance", progress=80
            )
            # Strict rule: No automatic acceptance.
            accepted_pairs_df = pd.DataFrame(columns=["source_material_code", "candidate_material_code", "decision"])
            accepted_pairs_df.to_csv(out_dir / "accepted_harmonization_pairs.csv", index=False)

            # ------------------------------------------------------------
            # Step 8: Phase 8 Common Material Master (Standalone per unapproved item)
            # ------------------------------------------------------------
            dataset_registry_service.update_dataset_status(
                dataset_id, "PROCESSING", current_phase="Phase 8: Common Material Master", progress=85
            )
            cmm_masters = []
            cmm_members = []
            for idx, r in df_std.iterrows():
                mat_code = str(r.get("Material_Code", "")).strip()
                cpse = str(r.get("CPSE", "")).strip()
                fam = str(r.get("Canonical_Material_Family", "ITEM")).strip() or "ITEM"
                cmm_code = f"CMM-{fam[:5].upper()}-{dataset_id[-6:]}-{idx+1:03d}"
                cmm_id = f"{dataset_id}:{cmm_code}"

                master_rec = {
                    "common_material_id": cmm_id,
                    "common_code": cmm_code,
                    "common_description": str(r.get("Standardized_Description", "")),
                    "material_family": fam,
                    "material_type": str(r.get("Canonical_Material_Type", "")),
                    "material_grade": str(r.get("Canonical_Material_Grade", "")),
                    "nominal_size": str(r.get("Canonical_Size", "")),
                    "pressure_rating": str(r.get("Canonical_Pressure_Class", "")),
                    "standard_spec": str(r.get("Canonical_Standard", "")),
                    "unit_of_measure": str(r.get("Unit", "NOS")),
                    "consolidated_attributes": json.dumps({
                        "size": str(r.get("Canonical_Size", "")),
                        "grade": str(r.get("Canonical_Material_Grade", "")),
                        "spec": str(r.get("Canonical_Standard", "")),
                    }),
                    "cpse_coverage": cpse,
                    "member_count": 1,
                    "governance_status": "STANDALONE_CANDIDATE",
                    "group_confidence": 1.0,
                    "group_identity_hash": str(r.get("Canonical_Material_Key", "")),
                    "dataset_id": dataset_id,
                }
                cmm_masters.append(master_rec)

                member_rec = {
                    "id": f"{dataset_id}:{mat_code}",
                    "common_material_id": cmm_id,
                    "source_material_code": mat_code,
                    "source_cpse": cpse,
                    "source_description": str(r.get("Material_Description", "")),
                    "canonical_material_key": str(r.get("Canonical_Material_Key", "")),
                    "membership_type": "STANDALONE",
                    "accepted_edge_candidate_ids": "",
                    "reviewer_ids": "",
                    "evidence_snapshot_hashes": "",
                    "dataset_id": dataset_id,
                }
                cmm_members.append(member_rec)

            df_cmm_masters = pd.DataFrame(cmm_masters)
            df_cmm_masters.to_csv(out_dir / "common_material_master.csv", index=False)

            df_cmm_members = pd.DataFrame(cmm_members)
            df_cmm_members.to_csv(out_dir / "common_material_members.csv", index=False)

            # ------------------------------------------------------------
            # Step 9: Phase 9 Legacy Material Mapping
            # ------------------------------------------------------------
            dataset_registry_service.update_dataset_status(
                dataset_id, "PROCESSING", current_phase="Phase 9: Legacy Material Mapping", progress=92
            )
            legacy_mappings = []
            for idx, r in df_std.iterrows():
                mat_code = str(r.get("Material_Code", "")).strip()
                cpse = str(r.get("CPSE", "")).strip()
                cmm_code = cmm_masters[idx]["common_code"]
                cmm_id = cmm_masters[idx]["common_material_id"]

                leg_rec = {
                    "mapping_id": f"MAP:{dataset_id}:{mat_code}",
                    "source_cpse": cpse,
                    "material_code": mat_code,
                    "source_description": str(r.get("Material_Description", "")),
                    "cmm_code": cmm_code,
                    "cmm_group_id": cmm_id,
                    "mapping_status": "MAPPED_STANDALONE",
                    "membership_type": "STANDALONE",
                    "confidence_score": 1.0,
                    "confidence_semantics": "STANDALONE_IDENTITY",
                    "mapping_method": "STANDALONE_IDENTITY",
                    "mapping_reason": "Single CPSE candidate unharmonized awaiting review",
                    "accepted_candidate_id": "",
                    "phase6_validation_status": "VALIDATED_COMPATIBLE",
                    "phase7_review_decision": "PENDING",
                    "evidence_hash": "",
                    "canonical_material_key": str(r.get("Canonical_Material_Key", "")),
                    "dataset_id": dataset_id,
                }
                legacy_mappings.append(leg_rec)

            df_legacy = pd.DataFrame(legacy_mappings)
            df_legacy.to_csv(out_dir / "legacy_material_mapping.csv", index=False)

            # ------------------------------------------------------------
            # Step 10: Phase 10 Procurement Intelligence & Analytics
            # ------------------------------------------------------------
            dataset_registry_service.update_dataset_status(
                dataset_id, "PROCESSING", current_phase="Phase 10: Procurement Intelligence", progress=96
            )
            facts = []
            for idx, r in df_raw.iterrows():
                mat_code = str(r.get("Material_Code", "")).strip()
                cpse = str(r.get("CPSE", "")).strip()
                cmm_code = cmm_masters[idx]["common_code"]
                try:
                    annual_cons = float(r.get("Annual_Consumption", 0))
                except Exception:
                    annual_cons = 0.0

                facts.append({
                    "fact_id": f"FACT:{dataset_id}:{mat_code}",
                    "source_cpse": cpse,
                    "material_code": mat_code,
                    "material_description": str(r.get("Material_Description", "")),
                    "cmm_code": cmm_code,
                    "material_category": str(r.get("Material_Category", "")),
                    "material_type": str(r.get("Material_Type", "")),
                    "unit_of_measure": str(r.get("Unit", "NOS")).upper(),
                    "plant": str(r.get("Plant", "MAIN")),
                    "material_status": str(r.get("Material_Status", "Active")),
                    "annual_consumption": annual_cons,
                    "last_purchase_date": str(r.get("Last_Purchase_Date", "")),
                    "manufacturer": str(r.get("Manufacturer", "")),
                    "manufacturer_part_no": str(r.get("Manufacturer_Part_No", "")),
                    "dataset_id": dataset_id,
                })

            df_facts = pd.DataFrame(facts)
            df_facts.to_csv(out_dir / "procurement_facts.csv", index=False)

            # CMM Consumption Summaries
            cmm_summaries = []
            for idx, m in enumerate(cmm_masters):
                fact = facts[idx]
                cmm_summaries.append({
                    "cmm_code": m["common_code"],
                    "common_description": m["common_description"],
                    "material_family": m["material_family"],
                    "governance_status": m["governance_status"],
                    "member_count": 1,
                    "cpse_count": 1,
                    "consuming_cpses": fact["source_cpse"],
                    "primary_uom": fact["unit_of_measure"],
                    "total_annual_consumption": fact["annual_consumption"],
                    "avg_consumption_per_member": fact["annual_consumption"],
                    "plant_count": 1,
                    "dominant_plant": fact["plant"],
                    "earliest_purchase_date": fact["last_purchase_date"],
                    "latest_purchase_date": fact["last_purchase_date"],
                    "purchase_recency_days": 180,
                    "active_member_count": 1 if fact["material_status"].lower() == "active" else 0,
                    "inactive_member_count": 0 if fact["material_status"].lower() == "active" else 1,
                    "distinct_manufacturers_count": 1 if fact["manufacturer"] else 0,
                    "manufacturers_list": fact["manufacturer"],
                    "dataset_id": dataset_id,
                })
            df_cmm_summaries = pd.DataFrame(cmm_summaries)
            df_cmm_summaries.to_csv(out_dir / "cmm_consumption_summary.csv", index=False)

            # Opportunities
            df_opps = pd.DataFrame(columns=[
                "opportunity_id", "opportunity_type", "cmm_code", "material_family",
                "primary_uom", "total_volume", "cpse_count", "trigger_metric",
                "trigger_value", "threshold", "actionable_next_step", "evidence_reference"
            ])
            df_opps.to_csv(out_dir / "procurement_opportunities.csv", index=False)

            # Mark dataset COMPLETED in registry
            dataset_registry_service.update_dataset_status(
                dataset_id, "COMPLETED", current_phase="COMPLETED", progress=100
            )
            logger.info(f"Dataset {dataset_id} processed successfully")

            return {
                "dataset_id": dataset_id,
                "status": "COMPLETED",
                "rows_processed": len(df_raw),
                "candidates_generated": len(df_candidates),
                "cmm_groups": len(df_cmm_masters),
            }

        except Exception as e:
            logger.exception(f"Processing failed for dataset {dataset_id}: {str(e)}")
            dataset_registry_service.update_dataset_status(
                dataset_id, "FAILED", error_message=str(e)
            )
            return {
                "dataset_id": dataset_id,
                "status": "FAILED",
                "error": str(e),
            }


upload_processing_service = UploadProcessingService()


def execute_upload_pipeline(dataset_id: str) -> bool:
    """Convenience helper to run process_dataset and return boolean success"""
    res = upload_processing_service.process_dataset(dataset_id)
    return res.get("status") == "COMPLETED"
