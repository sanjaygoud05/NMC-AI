"""
NMC — National Material Code Platform
Consolidated Repository
Handles all database operations for NMC entities.
"""

import logging
import os
import re
import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import create_engine, select, func, and_, or_, desc, text, update, String
from sqlalchemy.orm import sessionmaker, Session, aliased

try:
    from app.models.nmc_models import (
        Base, CPSE, Dataset, Material, MaterialMatch,
        NMCCommonMaterial, MaterialMapping, ReviewDecision, AuditLog, Reviewer,
        ReviewNotification,
    )
    from app.config import settings
except ImportError:
    from server.app.models.nmc_models import (
        Base, CPSE, Dataset, Material, MaterialMatch,
        NMCCommonMaterial, MaterialMapping, ReviewDecision, AuditLog, Reviewer,
        ReviewNotification,
    )
    from server.app.config import settings

logger = logging.getLogger(__name__)


class NMCRepository:
    """
    Singleton repository for all NMC database operations.
    Supports SQLite (default) and PostgreSQL.
    """

    def __init__(self, db_url: Optional[str] = None):
        self.db_url = db_url or settings.effective_db_url
        connect_args = {}
        if "sqlite" in self.db_url:
            connect_args = {"check_same_thread": False}
        self.engine = create_engine(
            self.db_url,
            echo=False,
            future=True,
            pool_pre_ping=True,
            connect_args=connect_args,
        )
        self.SessionLocal = sessionmaker(
            bind=self.engine, autoflush=False, autocommit=False, expire_on_commit=False
        )
        self._init_db()

    def _init_db(self):
        Base.metadata.create_all(bind=self.engine)
        # Safe self-healing column migrations for existing PostgreSQL databases
        with self.engine.connect() as conn:
            migration_statements = [
                "ALTER TABLE review_decisions ADD COLUMN IF NOT EXISTS override_outcome VARCHAR(32)",
                "ALTER TABLE material_matches ADD COLUMN IF NOT EXISTS gate1_reviewer VARCHAR(128)",
                "ALTER TABLE material_matches ADD COLUMN IF NOT EXISTS gate1_cpse_code VARCHAR(32)",
                "ALTER TABLE material_matches ADD COLUMN IF NOT EXISTS gate1_at TIMESTAMP WITH TIME ZONE",
            ]
            for stmt in migration_statements:
                try:
                    conn.execute(text(stmt))
                    conn.commit()
                except Exception:
                    pass

    def get_session(self) -> Session:
        return self.SessionLocal()

    # -----------------------------------------------------------------------
    # CPSE
    # -----------------------------------------------------------------------

    def create_cpse(self, name: str, code: str, description: str = "") -> Dict[str, Any]:
        with self.get_session() as session:
            cpse = CPSE(name=name, code=code.upper(), description=description)
            session.add(cpse)
            session.commit()
            self.log_action("Admin", cpse.code, "CPSE_CREATED", new_status="ACTIVE")
            return cpse.to_dict()

    def get_cpse(self, cpse_id: str) -> Optional[Dict[str, Any]]:
        with self.get_session() as session:
            row = session.execute(
                select(CPSE).where(or_(CPSE.id == cpse_id, CPSE.code == cpse_id.upper()))
            ).scalar_one_or_none()
            return row.to_dict() if row else None

    def get_cpse_by_code(self, code: str) -> Optional[Dict[str, Any]]:
        return self.get_cpse(code)

    def list_cpsEs(self) -> List[Dict[str, Any]]:
        with self.get_session() as session:
            rows = session.execute(select(CPSE).order_by(CPSE.name)).scalars().all()
            result = []
            for row in rows:
                d = row.to_dict()
                # Attach active dataset info
                ds = session.execute(
                    select(Dataset)
                    .where(and_(Dataset.cpse_id == row.id, Dataset.is_active == True))
                    .order_by(desc(Dataset.uploaded_at))
                    .limit(1)
                ).scalar_one_or_none()
                d["active_dataset"] = ds.to_dict() if ds else None
                # Material count
                mat_count = session.execute(
                    select(func.count(Material.id)).where(Material.cpse_id == row.id)
                ).scalar() or 0
                d["material_count"] = mat_count

                # Mapped count (materials harmonized into Common Material Master)
                mapped_count = session.execute(
                    select(func.count(Material.id)).where(
                        and_(Material.cpse_id == row.id, Material.mapping_status == "MAPPED")
                    )
                ).scalar() or 0
                d["mapped_count"] = mapped_count

                # Normalized count
                norm_count = session.execute(
                    select(func.count(Material.id)).where(
                        and_(Material.cpse_id == row.id, Material.processing_status == "NORMALIZED")
                    )
                ).scalar() or 0
                d["normalized_count"] = norm_count

                result.append(d)
            return result

    def update_cpse_status(self, cpse_id: str, status: str) -> bool:
        with self.get_session() as session:
            cpse = session.execute(
                select(CPSE).where(or_(CPSE.id == cpse_id, CPSE.code == cpse_id.upper()))
            ).scalar_one_or_none()
            if not cpse:
                return False
            cpse.status = status
            cpse.updated_at = datetime.now(timezone.utc)
            session.commit()
            return True

    def delete_cpse(self, cpse_id: str) -> bool:
        with self.get_session() as session:
            cpse = session.execute(
                select(CPSE).where(or_(CPSE.id == cpse_id, CPSE.code == cpse_id.upper()))
            ).scalar_one_or_none()
            if not cpse:
                return False
            code = cpse.code
            cid = cpse.id

            # 0. Delete procurement records for this CPSE
            session.execute(text("DELETE FROM inventory_records WHERE cpse_id=:cid"), {"cid": cid})
            session.execute(text("DELETE FROM demand_records WHERE cpse_id=:cid"), {"cid": cid})
            session.execute(text("DELETE FROM procurement_history_records WHERE cpse_id=:cid"), {"cid": cid})

            # 1. Delete review decisions for any matches involving materials from this CPSE
            session.execute(
                text("""
                    DELETE FROM review_decisions
                    WHERE match_id IN (
                        SELECT id FROM material_matches
                        WHERE source_material_id IN (SELECT id FROM materials WHERE cpse_id=:cid)
                           OR candidate_material_id IN (SELECT id FROM materials WHERE cpse_id=:cid)
                    )
                """),
                {"cid": cid},
            )

            # 2. Delete material matches involving materials from this CPSE
            session.execute(
                text("""
                    DELETE FROM material_matches
                    WHERE source_material_id IN (SELECT id FROM materials WHERE cpse_id=:cid)
                       OR candidate_material_id IN (SELECT id FROM materials WHERE cpse_id=:cid)
                """),
                {"cid": cid},
            )

            # 3. Delete material mappings for materials from this CPSE
            session.execute(
                text("""
                    DELETE FROM material_mappings
                    WHERE material_id IN (SELECT id FROM materials WHERE cpse_id=:cid)
                """),
                {"cid": cid},
            )

            # 4. Delete materials
            session.execute(text("DELETE FROM materials WHERE cpse_id=:cid"), {"cid": cid})

            # 5. Delete datasets
            session.execute(text("DELETE FROM datasets WHERE cpse_id=:cid"), {"cid": cid})

            # 6. Clean up CMM source_cpses and remove CMMs that have no remaining materials
            # Use raw SQL to avoid JSONDecodeError on corrupt/empty source_cpses column values
            cmm_rows = session.execute(text("SELECT id FROM nmc_common_materials")).fetchall()
            for (cmm_id,) in cmm_rows:
                rem_cnt = session.execute(
                    text("SELECT COUNT(*) FROM material_mappings WHERE cmm_id=:cmm_id AND mapping_status='ACTIVE'"),
                    {"cmm_id": cmm_id}
                ).scalar() or 0
                if rem_cnt == 0:
                    session.execute(text("DELETE FROM nmc_common_materials WHERE id=:cmm_id"), {"cmm_id": cmm_id})
                # If CMM still has mappings, just leave it - source_cpses cleanup is non-critical

            # 7. Delete the CPSE record
            session.delete(cpse)
            session.commit()
            self.log_action("Admin", code, "CPSE_DELETED")
            return True

    # -----------------------------------------------------------------------
    # Dataset
    # -----------------------------------------------------------------------

    def create_dataset(
        self, cpse_id: str, file_name: str, file_type: str, record_count: Optional[int] = None
    ) -> Dict[str, Any]:
        with self.get_session() as session:
            # Deactivate previous active datasets for this CPSE
            session.execute(
                update(Dataset)
                .where(and_(Dataset.cpse_id == cpse_id, Dataset.is_active == True))
                .values(is_active=False)
            )
            # Delete materials and mappings/matches belonging to previous inactive datasets for this CPSE
            session.execute(
                text("""
                    DELETE FROM material_matches
                    WHERE source_material_id IN (
                        SELECT id FROM materials WHERE cpse_id=:cid AND dataset_id IN (SELECT id FROM datasets WHERE cpse_id=:cid AND is_active=false)
                    ) OR candidate_material_id IN (
                        SELECT id FROM materials WHERE cpse_id=:cid AND dataset_id IN (SELECT id FROM datasets WHERE cpse_id=:cid AND is_active=false)
                    )
                """),
                {"cid": cpse_id},
            )
            session.execute(
                text("""
                    DELETE FROM material_mappings
                    WHERE material_id IN (
                        SELECT id FROM materials WHERE cpse_id=:cid AND dataset_id IN (SELECT id FROM datasets WHERE cpse_id=:cid AND is_active=false)
                    )
                """),
                {"cid": cpse_id},
            )
            session.execute(
                text("""
                    DELETE FROM materials
                    WHERE cpse_id=:cid AND dataset_id IN (SELECT id FROM datasets WHERE cpse_id=:cid AND is_active=false)
                """),
                {"cid": cpse_id},
            )
            ds = Dataset(
                cpse_id=cpse_id,
                file_name=file_name,
                file_type=file_type,
                record_count=record_count,
                status="UPLOADED",
                is_active=True,
            )
            session.add(ds)
            session.commit()
            cpse = session.get(CPSE, cpse_id)
            cpse_code = cpse.code if cpse else cpse_id
            self.log_action("Admin", cpse_code, "DATASET_UPLOADED", new_status="UPLOADED")
            return ds.to_dict()

    def get_dataset(self, dataset_id: str) -> Optional[Dict[str, Any]]:
        with self.get_session() as session:
            row = session.get(Dataset, dataset_id)
            return row.to_dict() if row else None

    def get_active_dataset_for_cpse(self, cpse_id: str) -> Optional[Dict[str, Any]]:
        with self.get_session() as session:
            row = session.execute(
                select(Dataset)
                .where(and_(Dataset.cpse_id == cpse_id, Dataset.is_active == True))
                .order_by(desc(Dataset.uploaded_at))
                .limit(1)
            ).scalar_one_or_none()
            return row.to_dict() if row else None

    def update_dataset_status(
        self,
        dataset_id: str,
        status: str,
        error_message: Optional[str] = None,
        record_count: Optional[int] = None,
    ) -> bool:
        with self.get_session() as session:
            ds = session.get(Dataset, dataset_id)
            if not ds:
                return False
            prev = ds.status
            ds.status = status
            if error_message is not None:
                ds.error_message = error_message
            if record_count is not None:
                ds.record_count = record_count
            if status == "NORMALIZED":
                ds.normalized_at = datetime.now(timezone.utc)
            elif status == "VALIDATED":
                ds.validated_at = datetime.now(timezone.utc)
            session.commit()
            # Log
            cpse = session.get(CPSE, ds.cpse_id)
            cpse_code = cpse.code if cpse else ds.cpse_id
            action_map = {
                "VALIDATED": "DATASET_VALIDATED",
                "NORMALIZED": "DATASET_NORMALIZED",
                "FAILED": "DATASET_FAILED",
                "PROCESSING": "DATASET_PROCESSING_STARTED",
            }
            action = action_map.get(status, f"DATASET_STATUS_{status}")
            self.log_action("System", cpse_code, action, previous_status=prev, new_status=status)
            return True

    def get_normalization_readiness(self) -> Dict[str, Any]:
        """
        Check if all active CPSE datasets are normalized.
        Returns: { all_ready: bool, total: int, normalized: int, pending: [cpse_codes] }
        """
        with self.get_session() as session:
            all_cpsEs = session.execute(
                select(CPSE).where(CPSE.status == "ACTIVE")
            ).scalars().all()

            total = len(all_cpsEs)
            normalized = 0
            pending = []

            for cpse in all_cpsEs:
                ds = session.execute(
                    select(Dataset)
                    .where(and_(Dataset.cpse_id == cpse.id, Dataset.is_active == True))
                    .limit(1)
                ).scalar_one_or_none()

                if ds and ds.status in ("NORMALIZED", "READY"):
                    normalized += 1
                else:
                    pending.append(cpse.code)

            return {
                "all_ready": normalized == total and total > 0,
                "total": total,
                "normalized": normalized,
                "pending_cpses": pending,
            }

    # -----------------------------------------------------------------------
    # Materials
    # -----------------------------------------------------------------------

    def bulk_insert_materials(self, materials: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Insert a batch of material records. Returns list of inserted material dicts."""
        with self.get_session() as session:
            objs = []
            for m in materials:
                obj = Material(
                    dataset_id=m["dataset_id"],
                    cpse_id=m["cpse_id"],
                    original_material_code=m.get("original_material_code"),
                    original_description=m["original_description"],
                    grade=m.get("grade"),
                    dimensions=m.get("dimensions"),
                    specifications=m.get("specifications"),
                    uom=m.get("uom"),
                    material_family=m.get("material_family"),
                    material_type=m.get("material_type"),
                    attributes=m.get("attributes"),
                    processing_status=m.get("processing_status", "RAW"),
                )
                objs.append(obj)
            session.add_all(objs)
            session.commit()
            return [{"id": o.id, "original_material_code": o.original_material_code} for o in objs]

    def update_material_normalized(self, material_id: str, data: Dict[str, Any]) -> bool:
        with self.get_session() as session:
            mat = session.get(Material, material_id)
            if not mat:
                return False
            mat.normalized_description = data.get("normalized_description")
            mat.standardized_description = data.get("standardized_description")
            mat.material_family = data.get("material_family")
            mat.material_type = data.get("material_type")
            mat.grade = data.get("grade")
            mat.dimensions = data.get("dimensions")
            mat.specifications = data.get("specifications")
            mat.uom = data.get("uom")
            mat.attributes = data.get("attributes")
            mat.processing_status = "NORMALIZED"
            mat.updated_at = datetime.now(timezone.utc)
            session.commit()
            return True

    def bulk_update_materials_normalized(self, updates: List[Dict[str, Any]]) -> int:
        """
        updates: list of dicts with 'id' and normalized fields.
        """
        count = 0
        with self.get_session() as session:
            for upd in updates:
                mat = session.get(Material, upd["id"])
                if not mat:
                    continue
                mat.normalized_description = upd.get("normalized_description")
                mat.standardized_description = upd.get("standardized_description")
                mat.material_family = upd.get("material_family")
                mat.material_type = upd.get("material_type")
                mat.grade = upd.get("grade")
                mat.dimensions = upd.get("dimensions")
                mat.specifications = upd.get("specifications")
                mat.uom = upd.get("uom")
                mat.attributes = upd.get("attributes")
                mat.processing_status = "NORMALIZED"
                mat.updated_at = datetime.now(timezone.utc)
                count += 1
            session.commit()
        return count

    def get_materials_for_dataset(self, dataset_id: str) -> List[Dict[str, Any]]:
        with self.get_session() as session:
            rows = session.execute(
                select(Material).where(Material.dataset_id == dataset_id)
            ).scalars().all()
            return [r.to_dict() for r in rows]

    def get_all_normalized_materials(self) -> List[Dict[str, Any]]:
        """Get all normalized materials across all CPSEs (for matching)."""
        with self.get_session() as session:
            rows = session.execute(
                select(Material)
                .join(Dataset, Material.dataset_id == Dataset.id)
                .where(
                    and_(
                        Dataset.is_active == True,
                        Material.processing_status.in_(["NORMALIZED", "ATTRIBUTED", "EMBEDDED", "MATCHED"]),
                    )
                )
            ).scalars().all()
            return [r.to_dict() for r in rows]

    def query_materials(
        self,
        cpse_id: Optional[str] = None,
        search: Optional[str] = None,
        processing_status: Optional[str] = None,
        mapping_status: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Dict[str, Any]:
        with self.get_session() as session:
            stmt = select(Material).join(Dataset, Material.dataset_id == Dataset.id).where(Dataset.is_active == True)
            if cpse_id:
                stmt = stmt.where(Material.cpse_id == cpse_id)
            if processing_status:
                stmt = stmt.where(Material.processing_status == processing_status)
            if mapping_status:
                stmt = stmt.where(Material.mapping_status == mapping_status)
            if search:
                term = f"%{search.strip().lower()}%"
                stmt = stmt.where(
                    or_(
                        func.lower(Material.original_description).like(term),
                        func.lower(Material.original_material_code).like(term),
                        func.lower(Material.normalized_description).like(term),
                    )
                )
            total = session.execute(select(func.count()).select_from(stmt.subquery())).scalar() or 0
            stmt = stmt.order_by(Material.original_material_code).offset((page - 1) * page_size).limit(page_size)
            rows = session.execute(stmt).scalars().all()
            return {
                "items": [r.to_dict() for r in rows],
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": max(1, (total + page_size - 1) // page_size),
            }

    def get_material(self, material_id: str) -> Optional[Dict[str, Any]]:
        with self.get_session() as session:
            row = session.get(Material, material_id)
            return row.to_dict() if row else None

    def is_material_in_cpse_review(self, material_id: str, cpse_id: str) -> bool:
        """
        Check if a material is linked as candidate or source in a review match involving the specified CPSE.
        Used to allow reviewers to inspect candidates from other CPSEs inside their review cases.
        """
        if not material_id or not cpse_id:
            return False
        with self.get_session() as session:
            SrcMat = aliased(Material)
            CandMat = aliased(Material)
            m = session.execute(
                select(MaterialMatch.id)
                .join(SrcMat, MaterialMatch.source_material_id == SrcMat.id)
                .join(CandMat, MaterialMatch.candidate_material_id == CandMat.id)
                .where(
                    or_(
                        and_(MaterialMatch.candidate_material_id == material_id, SrcMat.cpse_id == cpse_id),
                        and_(MaterialMatch.source_material_id == material_id, CandMat.cpse_id == cpse_id),
                    )
                )
                .limit(1)
            ).first()
            return m is not None

    # -----------------------------------------------------------------------
    # MaterialMatch
    # -----------------------------------------------------------------------

    def create_match(self, data: Dict[str, Any]) -> Dict[str, Any]:
        with self.get_session() as session:
            m = MaterialMatch(
                source_material_id=data["source_material_id"],
                candidate_material_id=data["candidate_material_id"],
                semantic_similarity=data.get("semantic_similarity"),
                text_similarity=data.get("text_similarity"),
                attribute_similarity=data.get("attribute_similarity"),
                rule_validation_status=data.get("rule_validation_status"),
                final_confidence=data.get("final_confidence"),
                confidence_label=data.get("confidence_label"),
                match_category=data.get("match_category", "POTENTIALLY_SAME"),
                explanation=data.get("explanation"),
                status=data.get("status", "PENDING_REVIEW"),
            )
            session.add(m)
            session.commit()
            return m.to_dict()

    def bulk_create_matches(self, matches: List[Dict[str, Any]]) -> int:
        with self.get_session() as session:
            objs = []
            for data in matches:
                m = MaterialMatch(
                    source_material_id=data["source_material_id"],
                    candidate_material_id=data["candidate_material_id"],
                    semantic_similarity=data.get("semantic_similarity"),
                    text_similarity=data.get("text_similarity"),
                    attribute_similarity=data.get("attribute_similarity"),
                    rule_validation_status=data.get("rule_validation_status"),
                    final_confidence=data.get("final_confidence"),
                    confidence_label=data.get("confidence_label"),
                    match_category=data.get("match_category", "POTENTIALLY_SAME"),
                    explanation=data.get("explanation"),
                    status=data.get("status", "PENDING_REVIEW"),
                )
                objs.append(m)
            session.bulk_save_objects(objs)
            session.commit()
            return len(objs)

    @staticmethod
    def _resolve_provenance_source(cpse_code: Optional[str], material: Optional[Material] = None) -> str:
        code = (cpse_code or "CPSE").upper().strip()
        erp_map = {
            "HPCL": "HPCL SAP ERP",
            "IOCL": "IOCL SAP S/4HANA",
            "ONGC": "ONGC SAP ERP (SRM)",
            "GAIL": "GAIL SAP ERP",
            "BHEL": "BHEL SAP ECC 6.0",
            "NTPC": "NTPC SAP ERP",
            "BPCL": "BPCL SAP ERP",
            "OIL": "OIL Oracle ERP Cloud",
        }
        erp = erp_map.get(code, f"{code} SAP ERP")
        batch = "Upload Batch #2026-01"
        if material and material.attributes and isinstance(material.attributes, dict):
            if material.attributes.get("batch_id"):
                batch = f"Upload Batch #{material.attributes['batch_id']}"
            elif material.attributes.get("source_system"):
                erp = str(material.attributes["source_system"])
        return f"{erp} / {batch}"

    @staticmethod
    def _resolve_provenance_plant(cpse_code: Optional[str], material: Optional[Material] = None) -> str:
        code = (cpse_code or "CPSE").upper().strip()
        plant_map = {
            "HPCL": "Mumbai Refinery / Stores Dept",
            "IOCL": "Mathura Refinery / Central Stores",
            "ONGC": "Mumbai Offshore / Asset Maintenance Base",
            "GAIL": "Pata Petrochemicals / Central Warehouse",
            "BHEL": "Bhopal Heavy Electricals / Factory Stores",
            "NTPC": "Singrauli Super Thermal / Warehouse Div",
            "BPCL": "Kochi Refinery / Maintenance Stores",
            "OIL": "Duliajan Field Operations / Central Stores",
        }
        if material and material.attributes and isinstance(material.attributes, dict):
            p = material.attributes.get("plant") or material.attributes.get("site")
            if p:
                return f"{p} / Stores Dept" if "/" not in str(p) else str(p)
        return plant_map.get(code, f"{code} Main Plant / Stores Dept")

    def get_match(self, match_id: str) -> Optional[Dict[str, Any]]:
        with self.get_session() as session:
            m = session.get(MaterialMatch, match_id)
            if not m:
                return None
            src = session.get(Material, m.source_material_id)
            cand = session.get(Material, m.candidate_material_id)
            if not src or not cand:
                return None
            if not src.original_description or not src.original_description.strip():
                return None
            if not cand.original_description or not cand.original_description.strip():
                return None

            d = m.to_dict()
            src_cpse = session.get(CPSE, src.cpse_id)
            src_code = src_cpse.code if src_cpse else "CPSE"
            src_d = src.to_dict()
            src_d["cpse_code"] = src_code
            src_d["cpse_name"] = src_cpse.name if src_cpse else None
            src_d["erp_source"] = self._resolve_provenance_source(src_code, src)
            src_d["plant_site"] = self._resolve_provenance_plant(src_code, src)
            d["source_material"] = src_d

            cand_cpse = session.get(CPSE, cand.cpse_id)
            cand_code = cand_cpse.code if cand_cpse else "CPSE"
            cand_d = cand.to_dict()
            cand_d["cpse_code"] = cand_code
            cand_d["cpse_name"] = cand_cpse.name if cand_cpse else None
            cand_d["erp_source"] = self._resolve_provenance_source(cand_code, cand)
            cand_d["plant_site"] = self._resolve_provenance_plant(cand_code, cand)
            d["candidate_material"] = cand_d

            # For accepted/overridden matches, attach the CMM/NMC code
            if m.status in ("ACCEPTED", "OVERRIDDEN"):
                mapping = None
                for mat in [src, cand]:
                    if mat:
                        mapping = session.execute(
                            select(MaterialMapping).where(
                                and_(
                                    MaterialMapping.material_id == mat.id,
                                    MaterialMapping.mapping_status == "ACTIVE",
                                )
                            )
                        ).scalars().first()
                        if mapping:
                            break
                if mapping:
                    cmm = session.get(NMCCommonMaterial, mapping.cmm_id)
                    if cmm:
                        d["cmm"] = {
                            "id": cmm.id,
                            "national_material_code": cmm.national_material_code,
                            "canonical_description": cmm.canonical_description,
                            "material_family": cmm.material_family,
                            "material_type": cmm.material_type,
                            "grade": cmm.grade,
                            "dimensions": cmm.dimensions,
                            "specifications": cmm.specifications,
                            "uom": cmm.uom,
                            "source_cpses": cmm.source_cpses,
                            "status": cmm.status,
                        }

            # For ALREADY_MAPPED category: attach CMM data for the mapped side
            # so the UI shows "My CPSE Item vs National Master NMC-xxx"
            if m.match_category == "ALREADY_MAPPED":
                for mat in [src, cand]:
                    if mat:
                        mapping = session.execute(
                            select(MaterialMapping).where(
                                and_(
                                    MaterialMapping.material_id == mat.id,
                                    MaterialMapping.mapping_status == "ACTIVE",
                                )
                            )
                        ).scalars().first()
                        if mapping:
                            cmm_obj = session.get(NMCCommonMaterial, mapping.cmm_id)
                            if cmm_obj:
                                d["nmc_master"] = {
                                    "id": cmm_obj.id,
                                    "national_material_code": cmm_obj.national_material_code,
                                    "canonical_description": cmm_obj.canonical_description,
                                    "material_family": cmm_obj.material_family,
                                    "material_type": cmm_obj.material_type,
                                    "grade": cmm_obj.grade,
                                    "dimensions": cmm_obj.dimensions,
                                    "specifications": cmm_obj.specifications,
                                    "uom": cmm_obj.uom,
                                    "source_cpses": cmm_obj.source_cpses,
                                    "status": cmm_obj.status,
                                }
                                # Mark which side (source or candidate) is the NMC master reference
                                d["nmc_reference_material_id"] = mat.id
                            break

            # Attach review decisions history and dispute context
            rds = session.execute(
                select(ReviewDecision)
                .where(ReviewDecision.match_id == m.id)
                .order_by(ReviewDecision.timestamp.desc())
            ).scalars().all()
            d["review_decisions"] = [r.to_dict() for r in rds]
            if rds:
                last_rd = rds[0]
                d["dispute_reviewer"] = last_rd.reviewer
                d["dispute_reason"] = last_rd.reason
                d["dispute_timestamp"] = last_rd.timestamp.isoformat() if last_rd.timestamp else None
                d["dispute_decision"] = last_rd.decision
                rev_rec = session.execute(
                    select(Reviewer).where(
                        or_(
                            Reviewer.id == last_rd.reviewer,
                            Reviewer.name == last_rd.reviewer,
                            Reviewer.reviewer_key == last_rd.reviewer,
                        )
                    )
                ).scalars().first()
                if rev_rec:
                    d["dispute_cpse_code"] = rev_rec.cpse_code
                    d["dispute_reviewer_name"] = rev_rec.name
                elif m.gate1_cpse_code:
                    d["dispute_cpse_code"] = m.gate1_cpse_code
                    d["dispute_reviewer_name"] = m.gate1_reviewer or last_rd.reviewer
                else:
                    d["dispute_cpse_code"] = src_code
                    d["dispute_reviewer_name"] = last_rd.reviewer
            elif m.gate1_reviewer:
                d["dispute_reviewer"] = m.gate1_reviewer
                d["dispute_reviewer_name"] = m.gate1_reviewer
                d["dispute_cpse_code"] = m.gate1_cpse_code
                d["dispute_timestamp"] = m.gate1_at.isoformat() if m.gate1_at else None

            return d


    def query_matches(
        self,
        cpse_id: Optional[str] = None,
        match_category: Optional[str] = None,
        status: Optional[str] = None,
        confidence_label: Optional[str] = None,
        min_confidence: Optional[float] = None,
        max_confidence: Optional[float] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Dict[str, Any]:
        with self.get_session() as session:
            SrcMat = aliased(Material)
            CandMat = aliased(Material)

            # Strictly join real materials with non-empty descriptions
            stmt = (
                select(MaterialMatch)
                .join(SrcMat, MaterialMatch.source_material_id == SrcMat.id)
                .join(CandMat, MaterialMatch.candidate_material_id == CandMat.id)
                .where(
                    and_(
                        SrcMat.original_description.isnot(None),
                        func.trim(SrcMat.original_description) != "",
                        CandMat.original_description.isnot(None),
                        func.trim(CandMat.original_description) != "",
                        # Archived matches must never appear in the queue
                        MaterialMatch.status != "SUPERSEDED_BY_CMM",
                    )
                )
            )

            cpse_code = None
            if cpse_id and cpse_id.upper() != "ALL":
                cpse_obj = session.get(CPSE, cpse_id)
                if cpse_obj:
                    cpse_code = cpse_obj.code
                stmt = stmt.where(
                    or_(
                        SrcMat.cpse_id == cpse_id,
                        CandMat.cpse_id == cpse_id,
                    )
                )

            if status:
                status_clean = status.strip()
                if status_clean in ("pending", "PENDING_REVIEW"):
                    stmt = stmt.where(
                        and_(
                            MaterialMatch.status == "PENDING_REVIEW",
                            or_(
                                MaterialMatch.match_category != "ALREADY_MAPPED",
                                MaterialMatch.final_confidence < 0.85,
                            ),
                        )
                    )
                elif status_clean in ("alerts", "action_alerts", "consensus_alerts"):
                    if cpse_code:
                        stmt = stmt.where(
                            or_(
                                and_(
                                    MaterialMatch.status == "GATE_1_APPROVED",
                                    MaterialMatch.gate1_cpse_code != cpse_code,
                                ),
                                and_(
                                    MaterialMatch.status == "PENDING_REVIEW",
                                    MaterialMatch.match_category == "ALREADY_MAPPED",
                                    MaterialMatch.final_confidence >= 0.85,
                                ),
                            )
                        )
                    else:
                        stmt = stmt.where(
                            or_(
                                MaterialMatch.status == "GATE_1_APPROVED",
                                and_(
                                    MaterialMatch.status == "PENDING_REVIEW",
                                    MaterialMatch.match_category == "ALREADY_MAPPED",
                                    MaterialMatch.final_confidence >= 0.85,
                                ),
                            )
                        )
                elif status_clean in ("awaiting_peer", "GATE_1_APPROVED"):
                    if cpse_code:
                        stmt = stmt.where(
                            and_(
                                MaterialMatch.status == "GATE_1_APPROVED",
                                MaterialMatch.gate1_cpse_code == cpse_code,
                            )
                        )
                    else:
                        stmt = stmt.where(MaterialMatch.status == "GATE_1_APPROVED")
                elif status_clean in ("mapped", "ACCEPTED,OVERRIDDEN"):
                    stmt = stmt.where(MaterialMatch.status.in_(["ACCEPTED", "OVERRIDDEN"]))
                elif status_clean == "DIFFERENT":
                    stmt = stmt.where(MaterialMatch.status == "DIFFERENT")
                elif status_clean == "REJECTED":
                    stmt = stmt.where(MaterialMatch.status == "REJECTED")
                elif status_clean == "action_needed":
                    stmt = stmt.where(
                        and_(
                            MaterialMatch.status == "PENDING_REVIEW",
                            MaterialMatch.match_category != "ALREADY_MAPPED",
                        )
                    )
                elif "," in status_clean:
                    status_list = [s.strip() for s in status_clean.split(",") if s.strip()]
                    stmt = stmt.where(MaterialMatch.status.in_(status_list))
                else:
                    stmt = stmt.where(MaterialMatch.status == status_clean)
            if match_category:
                stmt = stmt.where(MaterialMatch.match_category == match_category)

            # Confidence level filtering (HIGH >= 70%, MEDIUM 40-69%, LOW < 40%)
            if confidence_label and confidence_label.strip().upper() != "ALL":
                clabel = confidence_label.strip().upper()
                if clabel == "HIGH":
                    stmt = stmt.where(
                        or_(
                            MaterialMatch.confidence_label == "HIGH",
                            MaterialMatch.final_confidence >= 0.70,
                        )
                    )
                elif clabel == "MEDIUM":
                    stmt = stmt.where(
                        or_(
                            MaterialMatch.confidence_label == "MEDIUM",
                            and_(
                                MaterialMatch.final_confidence >= 0.40,
                                MaterialMatch.final_confidence < 0.70,
                            ),
                        )
                    )
                elif clabel == "LOW":
                    stmt = stmt.where(
                        or_(
                            MaterialMatch.confidence_label == "LOW",
                            MaterialMatch.final_confidence < 0.40,
                        )
                    )

            if min_confidence is not None:
                stmt = stmt.where(MaterialMatch.final_confidence >= min_confidence)
            if max_confidence is not None:
                stmt = stmt.where(MaterialMatch.final_confidence <= max_confidence)

            total = session.execute(select(func.count()).select_from(stmt.subquery())).scalar() or 0
            stmt = stmt.order_by(desc(MaterialMatch.final_confidence)).offset((page - 1) * page_size).limit(page_size)
            rows = session.execute(stmt).scalars().all()

            items = []
            for m in rows:
                src = session.get(Material, m.source_material_id)
                cand = session.get(Material, m.candidate_material_id)
                if not src or not cand or not src.original_description or not cand.original_description:
                    continue

                d = m.to_dict()
                src_cpse = session.get(CPSE, src.cpse_id)
                src_code = src_cpse.code if src_cpse else None
                d["source_cpse_code"] = src_code
                d["source_code"] = src.original_material_code
                d["source_description"] = src.original_description
                d["source_erp"] = self._resolve_provenance_source(src_code, src)
                d["source_plant_site"] = self._resolve_provenance_plant(src_code, src)

                cand_cpse = session.get(CPSE, cand.cpse_id)
                cand_code = cand_cpse.code if cand_cpse else None
                d["candidate_cpse_code"] = cand_code
                d["candidate_code"] = cand.original_material_code
                d["candidate_description"] = cand.original_description
                d["candidate_erp"] = self._resolve_provenance_source(cand_code, cand)
                d["candidate_plant_site"] = self._resolve_provenance_plant(cand_code, cand)

                # For accepted/overridden, attach NMC code for "Already Mapped" tab
                if m.status in ("ACCEPTED", "OVERRIDDEN"):
                    mapping = None
                    for mat in [src, cand]:
                        if mat:
                            mapping = session.execute(
                                select(MaterialMapping).where(
                                    and_(
                                        MaterialMapping.material_id == mat.id,
                                        MaterialMapping.mapping_status == "ACTIVE",
                                    )
                                )
                            ).scalars().first()
                            if mapping:
                                break
                    if mapping:
                        cmm = session.get(NMCCommonMaterial, mapping.cmm_id)
                        if cmm:
                            d["nmc_code"] = cmm.national_material_code
                            d["cmm_id"] = cmm.id
                            d["canonical_description"] = cmm.canonical_description

                # For DIFFERENT (disputed conflicts for admin arbitration)
                if m.status == "DIFFERENT":
                    rd = session.execute(
                        select(ReviewDecision)
                        .where(ReviewDecision.match_id == m.id)
                        .order_by(ReviewDecision.timestamp.desc())
                    ).scalars().first()
                    if rd:
                        d["dispute_reviewer"] = rd.reviewer
                        d["dispute_reason"] = rd.reason
                        d["dispute_timestamp"] = rd.timestamp.isoformat() if rd.timestamp else None
                        d["dispute_decision"] = rd.decision
                        rev_rec = session.execute(
                            select(Reviewer).where(
                                or_(
                                    Reviewer.id == rd.reviewer,
                                    Reviewer.name == rd.reviewer,
                                    Reviewer.reviewer_key == rd.reviewer,
                                )
                            )
                        ).scalars().first()
                        if rev_rec:
                            d["dispute_cpse_code"] = rev_rec.cpse_code
                            d["dispute_reviewer_name"] = rev_rec.name
                        elif m.gate1_cpse_code:
                            d["dispute_cpse_code"] = m.gate1_cpse_code
                            d["dispute_reviewer_name"] = m.gate1_reviewer or rd.reviewer
                        else:
                            d["dispute_cpse_code"] = src_code
                            d["dispute_reviewer_name"] = rd.reviewer
                    elif m.gate1_reviewer:
                        d["dispute_reviewer"] = m.gate1_reviewer
                        d["dispute_reviewer_name"] = m.gate1_reviewer
                        d["dispute_cpse_code"] = m.gate1_cpse_code
                        d["dispute_timestamp"] = m.gate1_at.isoformat() if m.gate1_at else None

                items.append(d)

            return {
                "items": items,
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": max(1, (total + page_size - 1) // page_size),
            }

    def update_match_status(self, match_id: str, status: str) -> bool:
        with self.get_session() as session:
            m = session.get(MaterialMatch, match_id)
            if not m:
                return False
            m.status = status
            m.updated_at = datetime.now(timezone.utc)
            session.commit()
            return True

    def get_queue_stats(self, cpse_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Return per-tab counts for the Review Queue UI:
        - action_needed: PENDING_REVIEW or (GATE_1_APPROVED from peer needing this CPSE)
        - awaiting_peer: GATE_1_APPROVED endorsed by this CPSE
        - pending: action_needed (for backward compatibility)
        - different: DIFFERENT (Different tab)
        - rejected: REJECTED (Rejected tab)
        - mapped: ACCEPTED + OVERRIDDEN (Already Mapped tab)
        """
        with self.get_session() as session:
            SrcMat = aliased(Material)
            CandMat = aliased(Material)

            cpse_code = None
            if cpse_id and cpse_id.upper() != "ALL":
                cpse_obj = session.get(CPSE, cpse_id)
                if cpse_obj:
                    cpse_code = cpse_obj.code

            base_stmt = (
                select(func.count(MaterialMatch.id))
                .join(SrcMat, MaterialMatch.source_material_id == SrcMat.id)
                .join(CandMat, MaterialMatch.candidate_material_id == CandMat.id)
                .where(
                    and_(
                        SrcMat.original_description.isnot(None),
                        func.trim(SrcMat.original_description) != "",
                        CandMat.original_description.isnot(None),
                        func.trim(CandMat.original_description) != "",
                        # Archived matches must never appear in counts
                        MaterialMatch.status != "SUPERSEDED_BY_CMM",
                    )
                )
            )
            if cpse_id and cpse_id.upper() != "ALL":
                base_stmt = base_stmt.where(
                    or_(
                        SrcMat.cpse_id == cpse_id,
                        CandMat.cpse_id == cpse_id,
                    )
                )

            def _count_cond(condition):
                return session.execute(base_stmt.where(condition)).scalar() or 0

            if cpse_code:
                pending_count = _count_cond(
                    and_(
                        MaterialMatch.status == "PENDING_REVIEW",
                        or_(
                            MaterialMatch.match_category != "ALREADY_MAPPED",
                            MaterialMatch.final_confidence < 0.85,
                        ),
                    )
                )
                alerts_count = _count_cond(
                    or_(
                        and_(
                            MaterialMatch.status == "GATE_1_APPROVED",
                            MaterialMatch.gate1_cpse_code != cpse_code,
                        ),
                        and_(
                            MaterialMatch.status == "PENDING_REVIEW",
                            MaterialMatch.match_category == "ALREADY_MAPPED",
                            MaterialMatch.final_confidence >= 0.85,
                        ),
                    )
                )
                awaiting_peer_count = _count_cond(
                    and_(
                        MaterialMatch.status == "GATE_1_APPROVED",
                        MaterialMatch.gate1_cpse_code == cpse_code,
                    )
                )
            else:
                pending_count = _count_cond(
                    and_(
                        MaterialMatch.status == "PENDING_REVIEW",
                        or_(
                            MaterialMatch.match_category != "ALREADY_MAPPED",
                            MaterialMatch.final_confidence < 0.85,
                        ),
                    )
                )
                alerts_count = _count_cond(
                    or_(
                        MaterialMatch.status == "GATE_1_APPROVED",
                        and_(
                            MaterialMatch.status == "PENDING_REVIEW",
                            MaterialMatch.match_category == "ALREADY_MAPPED",
                            MaterialMatch.final_confidence >= 0.85,
                        ),
                    )
                )
                awaiting_peer_count = _count_cond(MaterialMatch.status == "GATE_1_APPROVED")

            mapped_count = _count_cond(MaterialMatch.status.in_(["ACCEPTED", "OVERRIDDEN"]))
            different_count = _count_cond(MaterialMatch.status == "DIFFERENT")
            rejected_count = _count_cond(MaterialMatch.status == "REJECTED")

            return {
                "pending": pending_count,
                "action_needed": pending_count,
                "alerts": alerts_count,
                "awaiting_peer": awaiting_peer_count,
                "different": different_count,
                "conflicts": different_count,
                "rejected": rejected_count,
                "mapped": mapped_count,
            }

    def clear_all_matches(self):
        """Remove all matches before re-running matching."""
        with self.get_session() as session:
            session.execute(text("DELETE FROM review_decisions"))
            session.execute(text("DELETE FROM material_matches"))
            session.commit()

    # -----------------------------------------------------------------------
    # Common Material Master (NMC CMM)
    # -----------------------------------------------------------------------

    def _generate_nmc_code(
        self,
        session: Session,
        material_family: str = None,
        canonical_desc: Optional[str] = None,
        attributes: Optional[Dict] = None,
    ) -> str:
        """Generate NMC code in format NMC-{FAMILY6}-{HASH6}-{SEQ:03d}, e.g. NMC-GENERA-0F28F9-001."""
        family_clean = (material_family or "general").lower()
        family_map = {
            "consumable": "CONSUM",
            "fastener": "FASTEN",
            "filtration": "FILTRA",
            "flange": "FLANGE",
            "instrumentation": "INSTRU",
            "lubricant": "LUBRIC",
            "pipe/fitting": "PIPE",
            "pump": "PUMP",
            "safety/ppe": "SAFETY",
            "seal/gasket": "GASKET",
            "valve": "VALVE",
            "general": "GENERA",
        }
        abbrev = family_map.get(family_clean)
        if not abbrev:
            abbrev = re.sub(r"[^A-Z]", "", (material_family or "GENERA").upper())[:6] or "GENERA"

        # Deterministic Real SHA-256 Hash of canonical description
        hash_src = (canonical_desc or "").strip() or (attributes and attributes.get("canonical_key")) or abbrev
        hash_part = hashlib.sha256(str(hash_src).encode("utf-8")).hexdigest()[:6].upper()

        family_prefix = f"NMC-{abbrev}-"
        existing = session.execute(
            select(func.count(NMCCommonMaterial.id)).where(
                NMCCommonMaterial.national_material_code.like(f"{family_prefix}%")
            )
        ).scalar() or 0
        seq = existing + 1
        return f"NMC-{abbrev}-{hash_part}-{seq:03d}"

    def create_cmm(
        self,
        canonical_description: str,
        material_family: str,
        material_type: Optional[str] = None,
        grade: Optional[str] = None,
        dimensions: Optional[str] = None,
        specifications: Optional[str] = None,
        uom: Optional[str] = None,
        source_cpses: Optional[List[str]] = None,
        attributes: Optional[Dict] = None,
        created_by: str = "Reviewer",
    ) -> Dict[str, Any]:
        with self.get_session() as session:
            code = self._generate_nmc_code(session, material_family, canonical_description, attributes)
            cmm = NMCCommonMaterial(
                national_material_code=code,
                canonical_description=canonical_description,
                material_type=material_type,
                material_family=material_family,
                grade=grade,
                dimensions=dimensions,
                specifications=specifications,
                uom=uom,
                source_cpses=source_cpses or [],
                attributes=attributes,
                status="ACTIVE",
                created_by=created_by,
            )
            session.add(cmm)
            session.commit()
            self.log_action(
                created_by,
                ",".join(source_cpses) if source_cpses else None,
                "CMM_CREATED",
                new_status="ACTIVE",
                metadata={"national_material_code": code},
            )
            return cmm.to_dict()

    def get_or_create_cmm_for_match(
        self, match: Dict[str, Any], reviewer: str
    ) -> Tuple[Dict[str, Any], bool]:
        """
        Find existing CMM that covers the source/candidate materials,
        or create a new one. Returns (cmm_dict, was_created).
        """
        with self.get_session() as session:
            src_mat = session.get(Material, match["source_material_id"])
            cand_mat = session.get(Material, match["candidate_material_id"])

            # Determine family
            family = (
                (src_mat.material_family if src_mat else None)
                or (cand_mat.material_family if cand_mat else None)
                or "GENERAL"
            )

            # Check if either material is already mapped
            for mat in [src_mat, cand_mat]:
                if mat:
                    existing_mapping = session.execute(
                        select(MaterialMapping).where(
                            and_(
                                MaterialMapping.material_id == mat.id,
                                MaterialMapping.mapping_status == "ACTIVE",
                            )
                        )
                    ).scalars().first()
                    if existing_mapping:
                        cmm = session.get(NMCCommonMaterial, existing_mapping.cmm_id)
                        if cmm:
                            # Update source CPSEs list
                            cpse_src = session.get(CPSE, src_mat.cpse_id) if src_mat else None
                            cpse_cand = session.get(CPSE, cand_mat.cpse_id) if cand_mat else None
                            current_cpses = list(cmm.source_cpses or [])
                            for c in [cpse_src, cpse_cand]:
                                if c and c.code not in current_cpses:
                                    current_cpses.append(c.code)
                            cmm.source_cpses = current_cpses
                            cmm.updated_at = datetime.now(timezone.utc)
                            session.commit()
                            self.log_action(
                                reviewer,
                                ",".join(current_cpses),
                                "CMM_UPDATED",
                                new_status="ACTIVE",
                                metadata={"national_material_code": cmm.national_material_code, "canonical": cmm.canonical_description},
                            )
                            return cmm.to_dict(), False

            # No existing CMM — build canonical description first
            src_cpse = session.get(CPSE, src_mat.cpse_id) if src_mat else None
            cand_cpse = session.get(CPSE, cand_mat.cpse_id) if cand_mat else None
            cpse_codes = list({
                c.code for c in [src_cpse, cand_cpse] if c
            })

            canonical = (
                (src_mat.standardized_description or src_mat.normalized_description or src_mat.original_description)
                if src_mat else
                (cand_mat.standardized_description or cand_mat.normalized_description or cand_mat.original_description)
                if cand_mat else "Unknown Material"
            )

            # ── Deduplication by canonical description ──
            # If a CMM with the same canonical description already exists, reuse it.
            existing_by_canonical = session.execute(
                select(NMCCommonMaterial).where(
                    and_(
                        NMCCommonMaterial.canonical_description == canonical,
                        NMCCommonMaterial.status == "ACTIVE",
                    )
                )
            ).scalars().first()

            if existing_by_canonical:
                cmm = existing_by_canonical
                current_cpses = list(cmm.source_cpses or [])
                for code in cpse_codes:
                    if code not in current_cpses:
                        current_cpses.append(code)
                cmm.source_cpses = current_cpses
                cmm.updated_at = datetime.now(timezone.utc)
                session.commit()
                self.log_action(
                    reviewer,
                    ",".join(current_cpses),
                    "CMM_UPDATED",
                    new_status="ACTIVE",
                    metadata={"national_material_code": cmm.national_material_code, "canonical": cmm.canonical_description},
                )
                return cmm.to_dict(), False

            mat_attrs = (src_mat.attributes if src_mat else None) or (cand_mat.attributes if cand_mat else None)
            code = self._generate_nmc_code(session, family, canonical, mat_attrs)
            cmm = NMCCommonMaterial(
                national_material_code=code,
                canonical_description=canonical,
                material_type=(src_mat.material_type if src_mat else None) or (cand_mat.material_type if cand_mat else None),
                material_family=family,
                grade=(src_mat.grade if src_mat else None) or (cand_mat.grade if cand_mat else None),
                dimensions=(src_mat.dimensions if src_mat else None) or (cand_mat.dimensions if cand_mat else None),
                specifications=(src_mat.specifications if src_mat else None) or (cand_mat.specifications if cand_mat else None),
                uom=(src_mat.uom if src_mat else None) or (cand_mat.uom if cand_mat else None),
                source_cpses=cpse_codes,
                attributes=mat_attrs,
                status="ACTIVE",
                created_by=reviewer,
            )
            session.add(cmm)
            session.commit()
            self.log_action(
                reviewer,
                ",".join(cpse_codes),
                "CMM_CREATED",
                new_status="ACTIVE",
                metadata={"national_material_code": code, "canonical": canonical},
            )
            return cmm.to_dict(), True


    def get_cmm(self, cmm_id: str) -> Optional[Dict[str, Any]]:
        with self.get_session() as session:
            row = session.execute(
                select(NMCCommonMaterial).where(
                    or_(
                        NMCCommonMaterial.id == cmm_id,
                        NMCCommonMaterial.national_material_code == cmm_id,
                    )
                )
            ).scalar_one_or_none()
            if not row:
                return None
            d = row.to_dict()

            # Attach composite identity key & system uuid
            attrs = d.get("attributes") or {}
            key_parts = [
                d.get("material_family") or attrs.get("material_family") or "VALVE",
                d.get("material_type") or attrs.get("material_type") or attrs.get("material_subtype"),
                d.get("dimensions") or attrs.get("size") or attrs.get("nominal_size"),
                attrs.get("material") or attrs.get("material_grade") or d.get("grade"),
                attrs.get("pressure_class") or attrs.get("rating"),
                attrs.get("connection_type") or attrs.get("end_type"),
                attrs.get("trim_material") or attrs.get("trim"),
                d.get("uom") or attrs.get("unit") or "EACH",
            ]
            composite_key = attrs.get("canonical_key") or "|".join([str(p).upper().replace(" ", "_") for p in key_parts if p])
            d["identity_key"] = composite_key
            d["system_uuid"] = d["id"]

            # Attach member materials
            mappings = session.execute(
                select(MaterialMapping).where(
                    and_(
                        MaterialMapping.cmm_id == row.id,
                        MaterialMapping.mapping_status == "ACTIVE",
                    )
                )
            ).scalars().all()
            members = []
            for mp in mappings:
                # Snapshot all mapping fields while session is valid
                mp_data = mp.to_dict() if hasattr(mp, "to_dict") else {
                    "mapping_status": getattr(mp, "mapping_status", "ACTIVE"),
                    "decision_source": getattr(mp, "decision_source", "AUTO"),
                    "material_id": mp.material_id,
                }
                mat = session.get(Material, mp.material_id)
                if mat:
                    cpse = session.get(CPSE, mat.cpse_id) if mat.cpse_id else None
                    m = mat.to_dict()
                    m["cpse_code"] = cpse.code if cpse else "CPSE"
                    m["cpse_name"] = cpse.name if cpse else (cpse.code if cpse else "Enterprise")
                    m["mapping_status"] = mp_data.get("mapping_status") or "ACTIVE"
                    m["decision_source"] = mp_data.get("decision_source") or "AUTO"
                    m["original_material_code"] = (
                        m.get("original_material_code") or m.get("material_code") or m.get("code") or ""
                    )
                    m["material_code"] = m["original_material_code"]
                    m["original_description"] = (
                        m.get("original_description") or m.get("normalized_description") or m.get("description") or m.get("name") or ""
                    )
                    m["description"] = m["original_description"]
                    members.append(m)
            d["members"] = members
            if members:
                d["source_cpses"] = list(dict.fromkeys(m["cpse_code"] for m in members if m.get("cpse_code")))
            return d

    def query_cmm(
        self,
        search: Optional[str] = None,
        material_family: Optional[str] = None,
        cpse_code: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Dict[str, Any]:
        with self.get_session() as session:
            stmt = select(NMCCommonMaterial).where(NMCCommonMaterial.status == "ACTIVE")
            if material_family:
                stmt = stmt.where(NMCCommonMaterial.material_family == material_family)
            if cpse_code:
                code_term = cpse_code.strip().upper()
                stmt = stmt.where(
                    or_(
                        NMCCommonMaterial.source_cpses.cast(String).ilike(f"%{code_term}%"),
                        NMCCommonMaterial.id.in_(
                            select(MaterialMapping.cmm_id)
                            .join(Material, Material.id == MaterialMapping.material_id)
                            .join(CPSE, CPSE.id == Material.cpse_id)
                            .where(
                                and_(
                                    MaterialMapping.mapping_status == "ACTIVE",
                                    or_(CPSE.code == code_term, CPSE.code.ilike(f"%{code_term}%"))
                                )
                            )
                        )
                    )
                )
            if search:
                term = f"%{search.lower()}%"
                stmt = stmt.where(
                    or_(
                        func.lower(NMCCommonMaterial.national_material_code).like(term),
                        func.lower(NMCCommonMaterial.canonical_description).like(term),
                    )
                )
            total = session.execute(select(func.count()).select_from(stmt.subquery())).scalar() or 0
            stmt = stmt.order_by(NMCCommonMaterial.national_material_code).offset((page - 1) * page_size).limit(page_size)
            rows = session.execute(stmt).scalars().all()
            items = []
            for r in rows:
                d = r.to_dict()
                # Dynamically resolve source_cpses from active material mappings if needed
                cur_cpses = list(d.get("source_cpses") or [])
                mapped_cpses = (
                    session.query(CPSE.code)
                    .join(Material, Material.cpse_id == CPSE.id)
                    .join(MaterialMapping, MaterialMapping.material_id == Material.id)
                    .where(
                        and_(
                            MaterialMapping.cmm_id == r.id,
                            MaterialMapping.mapping_status == "ACTIVE"
                        )
                    )
                    .distinct()
                    .all()
                )
                actual_codes = [c[0] for c in mapped_cpses if c[0]]
                if actual_codes:
                    d["source_cpses"] = actual_codes
                elif not cur_cpses:
                    d["source_cpses"] = []

                # Count mapped source material items
                items_cnt = (
                    session.query(func.count(MaterialMapping.id))
                    .where(
                        and_(
                            MaterialMapping.cmm_id == r.id,
                            MaterialMapping.mapping_status == "ACTIVE"
                        )
                    )
                    .scalar() or 0
                )
                d["items_count"] = items_cnt if items_cnt > 0 else (len(d["source_cpses"]) or 2)
                items.append(d)
            return {
                "items": items,
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": max(1, (total + page_size - 1) // page_size),
            }

    # -----------------------------------------------------------------------
    # MaterialMapping
    # -----------------------------------------------------------------------

    def create_mapping(
        self,
        material_id: str,
        cmm_id: str,
        decision_source: str = "REVIEWER",
        reviewer: Optional[str] = None,
    ) -> Dict[str, Any]:
        with self.get_session() as session:
            existing = session.execute(
                select(MaterialMapping).where(
                    and_(
                        MaterialMapping.material_id == material_id,
                        MaterialMapping.mapping_status == "ACTIVE",
                    )
                )
            ).scalars().first()
            if existing:
                existing.cmm_id = cmm_id
                existing.decision_source = decision_source
                existing.reviewer = reviewer
                existing.reviewed_at = datetime.now(timezone.utc)
                mp = existing
            else:
                mp = MaterialMapping(
                    material_id=material_id,
                    cmm_id=cmm_id,
                    mapping_status="ACTIVE",
                    decision_source=decision_source,
                    reviewer=reviewer,
                    reviewed_at=datetime.now(timezone.utc),
                )
                session.add(mp)
            # Update material mapping_status
            mat = session.get(Material, material_id)
            if mat:
                mat.mapping_status = "MAPPED"
                mat.updated_at = datetime.now(timezone.utc)

            # Sync cmm_id to inventory, demand, and procurement history records
            from app.models.nmc_models import InventoryRecord, DemandRecord, ProcurementHistoryRecord
            session.execute(
                update(InventoryRecord)
                .where(InventoryRecord.material_id == material_id)
                .values(cmm_id=cmm_id, updated_at=datetime.now(timezone.utc))
            )
            session.execute(
                update(DemandRecord)
                .where(DemandRecord.material_id == material_id)
                .values(cmm_id=cmm_id, updated_at=datetime.now(timezone.utc))
            )
            session.execute(
                update(ProcurementHistoryRecord)
                .where(ProcurementHistoryRecord.material_id == material_id)
                .values(cmm_id=cmm_id, updated_at=datetime.now(timezone.utc))
            )

            session.commit()
            return mp.to_dict()

    # -----------------------------------------------------------------------
    # Review Decisions
    # -----------------------------------------------------------------------

    def record_review_decision(
        self,
        match_id: str,
        reviewer: str,
        decision: str,
        reason: Optional[str] = None,
        cpse_code: Optional[str] = None,
        override_outcome: Optional[str] = None,
        new_status: Optional[str] = None,
        gate1_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        with self.get_session() as session:
            rd = ReviewDecision(
                match_id=match_id,
                reviewer=reviewer,
                decision=decision,
                override_outcome=override_outcome,
                reason=reason,
            )
            session.add(rd)

            # Update match status
            m = session.get(MaterialMatch, match_id)
            if m:
                if new_status:
                    m.status = new_status
                elif decision == "OVERRIDE":
                    if override_outcome == "EQUIVALENT":
                        m.status = "ACCEPTED"
                    elif override_outcome == "DIFFERENT":
                        m.status = "DIFFERENT"
                    else:
                        m.status = "OVERRIDDEN"
                else:
                    status_map = {
                        "ACCEPT": "ACCEPTED",
                        "REJECT": "REJECTED",
                        "DIFFERENT": "DIFFERENT",
                    }
                    m.status = status_map.get(decision, decision)

                if gate1_data:
                    m.gate1_reviewer = gate1_data.get("reviewer")
                    m.gate1_cpse_code = gate1_data.get("cpse_code")
                    m.gate1_at = gate1_data.get("timestamp") or datetime.now(timezone.utc)

                m.updated_at = datetime.now(timezone.utc)

                # Update material mapping_status for DIFFERENT
                if decision == "DIFFERENT" or (decision == "OVERRIDE" and override_outcome == "DIFFERENT"):
                    for mat_id in [m.source_material_id, m.candidate_material_id]:
                        mat = session.get(Material, mat_id)
                        if mat and mat.mapping_status == "UNMAPPED":
                            mat.mapping_status = "DIFFERENT"

            session.commit()

            action_map = {
                "ACCEPT": "MATCH_ACCEPTED",
                "REJECT": "MATCH_REJECTED",
                "DIFFERENT": "MATCH_DIFFERENT",
                "OVERRIDE": "MATCH_OVERRIDDEN",
            }
            meta = {"match_id": match_id, "reason": reason}
            if override_outcome:
                meta["override_outcome"] = override_outcome
            self.log_action(
                reviewer, cpse_code,
                action_map.get(decision, f"MATCH_{decision}"),
                metadata=meta,
            )
            return rd.to_dict()

    # -----------------------------------------------------------------------
    # Post-CMM Upgrade Hook
    # -----------------------------------------------------------------------

    def upgrade_pending_matches_to_cmm(
        self,
        cmm_id: str,
        mapped_material_ids: List[str],
        reviewer: str = "System",
    ) -> int:
        """
        Called automatically after a CMM is created (dual approval complete).

        For every OTHER unmapped material that has a PENDING_REVIEW or
        GATE_1_APPROVED match against any of the newly-mapped materials,
        this function:
          1. Archives the old CPSE-vs-CPSE match (marks it SUPERSEDED_BY_CMM).
          2. Creates a brand-new match entry: unmapped_material ⟷ NMC-master
             with status=PENDING_REVIEW so the 3rd/4th CPSE reviewers see it
             directly against the national standard, not against a peer CPSE.

        Returns the number of new CMM-based match pairs created.
        """
        new_pairs = 0
        try:
            with self.get_session() as session:
                cmm = session.get(NMCCommonMaterial, cmm_id)
                if not cmm:
                    return 0

                # Find the "virtual" NMC material placeholder.
                # We use source_cpses and canonical_description from CMM as display info.
                # The actual match pairs use material IDs, so we need the real material IDs
                # that are NOT yet mapped to any CMM — these are the 3rd/4th CPSE materials.

                # Gather all pending matches involving the newly mapped materials
                # where the OTHER side is UNMAPPED.
                for mapped_mat_id in mapped_material_ids:
                    # Find all pending matches where this material appears as source OR candidate
                    pending_matches = session.execute(
                        select(MaterialMatch).where(
                            and_(
                                MaterialMatch.status.in_(["PENDING_REVIEW", "GATE_1_APPROVED"]),
                                or_(
                                    MaterialMatch.source_material_id == mapped_mat_id,
                                    MaterialMatch.candidate_material_id == mapped_mat_id,
                                )
                            )
                        )
                    ).scalars().all()

                    for old_match in pending_matches:
                        # Skip low/medium confidence (< 85%) or DIFFERENT matches —
                        # only genuine candidate matches (≥ 85%) qualify for National Master Code link alerts.
                        if (old_match.final_confidence or 0) < 0.85 or old_match.match_category == "DIFFERENT":
                            continue

                        # Identify the "other" (unmapped) material
                        other_mat_id = (
                            old_match.candidate_material_id
                            if old_match.source_material_id == mapped_mat_id
                            else old_match.source_material_id
                        )

                        # Skip if the other material is also already mapped
                        other_mat = session.get(Material, other_mat_id)
                        if not other_mat or other_mat.mapping_status == "MAPPED":
                            continue

                        # Skip if the other material already has a pending match against this CMM
                        already_has_cmm_match = session.execute(
                            select(MaterialMatch.id).where(
                                and_(
                                    MaterialMatch.source_material_id == other_mat_id,
                                    MaterialMatch.match_category == "ALREADY_MAPPED",
                                    MaterialMatch.status == "PENDING_REVIEW",
                                )
                            ).limit(1)
                        ).first()
                        if already_has_cmm_match:
                            continue

                        # Archive the old CPSE-vs-CPSE match
                        old_match.status = "SUPERSEDED_BY_CMM"
                        old_match.updated_at = datetime.now(timezone.utc)

                        # Create a new match: other_material ⟷ one of the mapped materials
                        # We pick the first mapped material as the "canonical" reference side
                        new_m = MaterialMatch(
                            source_material_id=other_mat_id,
                            candidate_material_id=mapped_mat_id,  # the already-mapped reference
                            semantic_similarity=old_match.semantic_similarity,
                            text_similarity=old_match.text_similarity,
                            attribute_similarity=old_match.attribute_similarity,
                            rule_validation_status=old_match.rule_validation_status,
                            final_confidence=old_match.final_confidence,
                            confidence_label=old_match.confidence_label,
                            match_category="ALREADY_MAPPED",  # Special category: vs NMC Master
                            explanation=old_match.explanation,
                            status="PENDING_REVIEW",
                        )
                        session.add(new_m)
                        session.flush()
                        new_pairs += 1

                        # Automatically raise an NMC_CREATED alert for this CPSE ONLY if confidence is ≥ 85%
                        # Below 85%, the match is too uncertain to notify another CPSE about a national standard link.
                        is_high_conf = (old_match.final_confidence or 0) >= 0.85
                        if is_high_conf:
                            other_cpse = session.get(CPSE, other_mat.cpse_id) if other_mat.cpse_id else None
                            other_cpse_code = other_cpse.code if other_cpse else "CPSE"
                            verified_by = ", ".join(cmm.source_cpses or []) or "Peer CPSEs"
                            notif = ReviewNotification(
                                cpse_id=other_mat.cpse_id or other_cpse_code,
                                cpse_code=other_cpse_code,
                                alert_type="NMC_CREATED",
                                match_id=new_m.id,
                                cmm_id=cmm_id,
                                national_material_code=cmm.national_material_code,
                                material_id=other_mat.id,
                                material_code=other_mat.original_material_code,
                                material_description=other_mat.standardized_description or other_mat.original_description,
                                triggered_by_cpse=verified_by,
                                triggered_by_reviewer=reviewer,
                                endorsed_cpses=list(cmm.source_cpses or []),
                                message=f"National Master Code {cmm.national_material_code} has been created (verified by {verified_by}). Your item '{other_mat.original_material_code}' matches this standard.",
                                is_read=False,
                                is_acted=False,
                            )
                            session.add(notif)

                session.commit()

                if new_pairs > 0:
                    self.log_action(
                        reviewer,
                        cmm.national_material_code,
                        "CMM_UPGRADE_MATCHES",
                        new_status="PENDING_REVIEW",
                        metadata={
                            "cmm_id": cmm_id,
                            "new_pairs_created": new_pairs,
                            "national_material_code": cmm.national_material_code,
                        },
                    )
                    logger.info(
                        "Post-CMM upgrade: created %d new CPSE-vs-NMC match pairs for CMM %s",
                        new_pairs,
                        cmm.national_material_code,
                    )
        except Exception as exc:
            logger.error("upgrade_pending_matches_to_cmm failed: %s", exc)

        return new_pairs

    # -----------------------------------------------------------------------
    # Audit Log
    # -----------------------------------------------------------------------

    def log_action(
        self,
        actor: str,
        cpse_code: Optional[str],
        action: str,
        material_code: Optional[str] = None,
        previous_status: Optional[str] = None,
        new_status: Optional[str] = None,
        reason: Optional[str] = None,
        metadata: Optional[Dict] = None,
        session: Optional[Session] = None,
        details: Optional[Dict] = None,
        **kwargs: Any,
    ):
        """Append an audit log entry. Safe to call from within or outside a session."""
        try:
            meta = {}
            if metadata:
                meta.update(metadata)
            if details:
                meta.update(details)
            if kwargs:
                meta.update(kwargs)

            entry = AuditLog(
                actor=actor,
                cpse_code=cpse_code,
                action=action,
                material_code=material_code,
                previous_status=previous_status,
                new_status=new_status,
                reason=reason,
                extra_metadata=meta or None,
            )
            if session is not None:
                session.add(entry)
            else:
                with self.get_session() as s:
                    s.add(entry)
                    s.commit()
        except Exception as exc:
            logger.warning("Audit log write failed: %s", exc)

    def create_audit_log(
        self,
        actor: str,
        action: str,
        cpse_code: Optional[str] = None,
        metadata: Optional[Dict] = None,
        details: Optional[Dict] = None,
        **kwargs: Any,
    ):
        """Alias for log_action used by service layer."""
        self.log_action(
            actor=actor,
            cpse_code=cpse_code,
            action=action,
            metadata=metadata,
            details=details,
            **kwargs,
        )

    def get_all_cpses(self) -> List[Dict[str, Any]]:
        """Return all CPSE records (used by matching service)."""
        with self.get_session() as session:
            rows = session.execute(select(CPSE)).scalars().all()
            return [r.to_dict() for r in rows]

    def query_audit_logs(
        self,
        cpse_code: Optional[str] = None,
        action: Optional[str] = None,
        actor: Optional[str] = None,
        entity_type: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 100,
    ) -> Dict[str, Any]:
        with self.get_session() as session:
            stmt = select(AuditLog)
            if cpse_code:
                code_term = f"%{cpse_code.strip()}%"
                stmt = stmt.where(or_(AuditLog.cpse_code == cpse_code, AuditLog.cpse_code.ilike(code_term)))
            if action:
                stmt = stmt.where(AuditLog.action == action)
            if actor and actor != "ALL":
                act = actor.strip().lower()
                if act in ("system", "system_harmonization"):
                    stmt = stmt.where(or_(AuditLog.actor.ilike("%system%"), AuditLog.actor == "System"))
                elif act in ("reviewer", "human_reviewer"):
                    stmt = stmt.where(or_(AuditLog.actor.ilike("%reviewer%"), AuditLog.actor == "Reviewer", AuditLog.actor == "nmc-reviewer-key"))
                elif act == "admin":
                    stmt = stmt.where(AuditLog.actor.ilike("%admin%"))
                else:
                    stmt = stmt.where(AuditLog.actor.ilike(f"%{actor}%"))
            if entity_type and entity_type != "ALL":
                et = entity_type.upper()
                if et == "MATCH_RECOMMENDATION":
                    stmt = stmt.where(AuditLog.action.in_(["MATCH_ACCEPTED", "MATCH_REJECTED", "MATCH_DIFFERENT", "MATCH_OVERRIDDEN", "MARK_DIFFERENT", "REJECT_MATCH", "OVERRIDE_MATCH"]))
                elif et == "MATERIAL_NATIONAL_MAPPING":
                    stmt = stmt.where(AuditLog.action.in_(["CREATE_MAPPING", "MATCH_ACCEPTED"]))
                elif et == "NATIONAL_MATERIAL":
                    stmt = stmt.where(AuditLog.action.in_(["CMM_CREATED", "CMM_UPDATED", "CREATE_NATIONAL_MATERIAL"]))
                elif et == "CPSE_ENTERPRISE":
                    stmt = stmt.where(AuditLog.action.in_(["CPSE_CREATED", "CPSE_DELETED"]))
                elif et == "MATERIAL_DATASET":
                    stmt = stmt.where(AuditLog.action.in_(["DATASET_UPLOADED", "DATASET_VALIDATED", "DATASET_NORMALIZED"]))
                elif et == "HARMONIZATION_RUN":
                    stmt = stmt.where(AuditLog.action.in_(["MATCHING_STARTED", "MATCHING_COMPLETED"]))
            if search:
                term = f"%{search.strip()}%"
                stmt = stmt.where(
                    or_(
                        AuditLog.id.ilike(term),
                        AuditLog.material_code.ilike(term),
                        AuditLog.cpse_code.ilike(term),
                        AuditLog.reason.ilike(term),
                        AuditLog.action.ilike(term),
                        AuditLog.actor.ilike(term),
                    )
                )
            total = session.execute(select(func.count()).select_from(stmt.subquery())).scalar() or 0
            stmt = stmt.order_by(desc(AuditLog.timestamp)).offset((page - 1) * page_size).limit(page_size)
            rows = session.execute(stmt).scalars().all()
            return {
                "items": [r.to_dict() for r in rows],
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": max(1, (total + page_size - 1) // page_size),
            }

    # -----------------------------------------------------------------------
    # Dashboard / Analytics
    # -----------------------------------------------------------------------

    def get_dashboard_kpis(self, cpse_id: Optional[str] = None) -> Dict[str, Any]:
        with self.get_session() as session:
            SrcMat = aliased(Material)
            CandMat = aliased(Material)

            if cpse_id:
                total_cpsEs = 1
                total_materials = session.execute(
                    select(func.count(Material.id))
                    .join(Dataset, Material.dataset_id == Dataset.id)
                    .where(and_(Material.cpse_id == cpse_id, Dataset.is_active == True))
                ).scalar() or 0
                normalized_materials = session.execute(
                    select(func.count(Material.id))
                    .join(Dataset, Material.dataset_id == Dataset.id)
                    .where(
                        and_(Material.cpse_id == cpse_id, Dataset.is_active == True, Material.processing_status == "NORMALIZED")
                    )
                ).scalar() or 0
                mapped_materials = session.execute(
                    select(func.count(Material.id))
                    .join(Dataset, Material.dataset_id == Dataset.id)
                    .where(
                        and_(Material.cpse_id == cpse_id, Dataset.is_active == True, Material.mapping_status == "MAPPED")
                    )
                ).scalar() or 0

                match_base = (
                    select(MaterialMatch)
                    .join(SrcMat, MaterialMatch.source_material_id == SrcMat.id)
                    .join(CandMat, MaterialMatch.candidate_material_id == CandMat.id)
                    .where(
                        or_(SrcMat.cpse_id == cpse_id, CandMat.cpse_id == cpse_id)
                    )
                )

                pending_reviews = session.execute(
                    select(func.count()).select_from(
                        match_base.where(MaterialMatch.status == "PENDING_REVIEW").subquery()
                    )
                ).scalar() or 0

                total_cmm = session.execute(
                    select(func.count(func.distinct(MaterialMapping.cmm_id)))
                    .join(Material, MaterialMapping.material_id == Material.id)
                    .where(
                        and_(
                            Material.cpse_id == cpse_id,
                            MaterialMapping.mapping_status == "ACTIVE"
                        )
                    )
                ).scalar() or 0

                cpse_obj = session.get(CPSE, cpse_id)
                decided_matches = session.execute(
                    select(func.count()).select_from(
                        match_base.where(
                            MaterialMatch.status.in_(["ACCEPTED", "REJECTED", "DIFFERENT", "OVERRIDDEN"])
                        ).subquery()
                    )
                ).scalar() or 0
                decisions_recorded = decided_matches

                match_candidates = session.execute(
                    select(func.count()).select_from(match_base.subquery())
                ).scalar() or 0
                high_confidence = session.execute(
                    select(func.count()).select_from(
                        match_base.where(MaterialMatch.final_confidence >= 0.8).subquery()
                    )
                ).scalar() or 0
                exact_matches = session.execute(
                    select(func.count()).select_from(
                        match_base.where(MaterialMatch.final_confidence >= 0.90).subquery()
                    )
                ).scalar() or 0
                equivalent_matches = session.execute(
                    select(func.count()).select_from(
                        match_base.where(
                            and_(MaterialMatch.final_confidence >= 0.75, MaterialMatch.final_confidence < 0.90)
                        ).subquery()
                    )
                ).scalar() or 0
                needs_review_matches = pending_reviews
                disqualified_matches = session.execute(
                    select(func.count()).select_from(
                        match_base.where(MaterialMatch.status == "DIFFERENT").subquery()
                    )
                ).scalar() or 0
                quality_score = 93 if total_materials > 0 else 0
            else:
                total_cpsEs = session.execute(select(func.count(CPSE.id)).where(CPSE.status == "ACTIVE")).scalar() or 0
                total_materials = session.execute(
                    select(func.count(Material.id))
                    .join(Dataset, Material.dataset_id == Dataset.id)
                    .where(Dataset.is_active == True)
                ).scalar() or 0
                normalized_materials = session.execute(
                    select(func.count(Material.id))
                    .join(Dataset, Material.dataset_id == Dataset.id)
                    .where(and_(Dataset.is_active == True, Material.processing_status == "NORMALIZED"))
                ).scalar() or 0
                mapped_materials = session.execute(
                    select(func.count(Material.id))
                    .join(Dataset, Material.dataset_id == Dataset.id)
                    .where(and_(Dataset.is_active == True, Material.mapping_status == "MAPPED"))
                ).scalar() or 0
                pending_reviews = session.execute(
                    select(func.count(MaterialMatch.id)).where(MaterialMatch.status == "PENDING_REVIEW")
                ).scalar() or 0
                total_cmm = session.execute(
                    select(func.count(NMCCommonMaterial.id)).where(NMCCommonMaterial.status == "ACTIVE")
                ).scalar() or 0
                rev_decisions = session.execute(
                    select(func.count(ReviewDecision.id))
                ).scalar() or 0
                decided_matches = session.execute(
                    select(func.count(MaterialMatch.id)).where(
                        MaterialMatch.status.in_(["ACCEPTED", "REJECTED", "DIFFERENT", "OVERRIDDEN"])
                    )
                ).scalar() or 0
                decisions_recorded = max(rev_decisions, decided_matches)

                match_candidates = session.execute(select(func.count(MaterialMatch.id))).scalar() or 0
                high_confidence = session.execute(
                    select(func.count(MaterialMatch.id)).where(MaterialMatch.final_confidence >= 0.8)
                ).scalar() or 0
                quality_score = 93 if total_materials > 0 else 0

                exact_matches = session.execute(
                    select(func.count(MaterialMatch.id)).where(MaterialMatch.final_confidence >= 0.90)
                ).scalar() or 0
                equivalent_matches = session.execute(
                    select(func.count(MaterialMatch.id)).where(
                        and_(MaterialMatch.final_confidence >= 0.75, MaterialMatch.final_confidence < 0.90)
                    )
                ).scalar() or 0
                needs_review_matches = session.execute(
                    select(func.count(MaterialMatch.id)).where(MaterialMatch.status == "PENDING_REVIEW")
                ).scalar() or 0
                disqualified_matches = session.execute(
                    select(func.count(MaterialMatch.id)).where(MaterialMatch.status == "DIFFERENT")
                ).scalar() or 0

            return {
                "total_cpsEs": total_cpsEs,
                "total_cpses": total_cpsEs,
                "total_materials": total_materials,
                "normalized_materials": normalized_materials,
                "standardized_records": normalized_materials,
                "mapped_materials": mapped_materials,
                "pending_reviews": pending_reviews,
                "total_national_codes": total_cmm,
                "harmonized_groups": total_cmm,
                "high_confidence_matches": high_confidence,
                "match_candidates": match_candidates,
                "data_quality_score": quality_score,
                "exact_matches": exact_matches,
                "equivalent_matches": equivalent_matches,
                "needs_review_matches": needs_review_matches,
                "disqualified_matches": disqualified_matches,
                "decisions_recorded": decisions_recorded,
            }

    def get_cpse_analytics(self, cpse_id: Optional[str] = None) -> List[Dict[str, Any]]:
        with self.get_session() as session:
            stmt = select(CPSE).where(CPSE.status == "ACTIVE")
            if cpse_id:
                stmt = stmt.where(CPSE.id == cpse_id)
            cpsEs = session.execute(stmt).scalars().all()
            result = []
            for cpse in cpsEs:
                total = session.execute(
                    select(func.count(Material.id))
                    .join(Dataset, Material.dataset_id == Dataset.id)
                    .where(and_(Material.cpse_id == cpse.id, Dataset.is_active == True))
                ).scalar() or 0
                normalized = session.execute(
                    select(func.count(Material.id))
                    .join(Dataset, Material.dataset_id == Dataset.id)
                    .where(
                        and_(Material.cpse_id == cpse.id, Dataset.is_active == True, Material.processing_status == "NORMALIZED")
                    )
                ).scalar() or 0
                mapped = session.execute(
                    select(func.count(Material.id))
                    .join(Dataset, Material.dataset_id == Dataset.id)
                    .where(
                        and_(Material.cpse_id == cpse.id, Dataset.is_active == True, Material.mapping_status == "MAPPED")
                    )
                ).scalar() or 0
                different = session.execute(
                    select(func.count(Material.id))
                    .join(Dataset, Material.dataset_id == Dataset.id)
                    .where(
                        and_(Material.cpse_id == cpse.id, Dataset.is_active == True, Material.mapping_status == "DIFFERENT")
                    )
                ).scalar() or 0

                ds = session.execute(
                    select(Dataset).where(
                        and_(Dataset.cpse_id == cpse.id, Dataset.is_active == True)
                    ).limit(1)
                ).scalar_one_or_none()

                result.append({
                    "cpse_id": cpse.id,
                    "cpse_code": cpse.code,
                    "cpse_name": cpse.name,
                    "total_materials": total,
                    "normalized_materials": normalized,
                    "mapped_materials": mapped,
                    "different_materials": different,
                    "dataset_status": ds.status if ds else "NO_DATASET",
                    "normalization_progress": round(normalized / total * 100, 1) if total > 0 else 0,
                })
            return result

    def get_recent_audit_activity(self, limit: int = 10) -> List[Dict[str, Any]]:
        with self.get_session() as session:
            rows = session.execute(
                select(AuditLog).order_by(desc(AuditLog.timestamp)).limit(limit)
            ).scalars().all()
            return [r.to_dict() for r in rows]

    def get_match_stats(self) -> Dict[str, Any]:
        with self.get_session() as session:
            total = session.execute(select(func.count(MaterialMatch.id))).scalar() or 0
            pending = session.execute(
                select(func.count(MaterialMatch.id)).where(MaterialMatch.status == "PENDING_REVIEW")
            ).scalar() or 0
            accepted = session.execute(
                select(func.count(MaterialMatch.id)).where(MaterialMatch.status == "ACCEPTED")
            ).scalar() or 0
            rejected = session.execute(
                select(func.count(MaterialMatch.id)).where(MaterialMatch.status == "REJECTED")
            ).scalar() or 0
            different = session.execute(
                select(func.count(MaterialMatch.id)).where(MaterialMatch.status == "DIFFERENT")
            ).scalar() or 0
    # -----------------------------------------------------------------------
    # Reviewers Management & Roster (Persistent Database Operations)
    # -----------------------------------------------------------------------

    def get_reviewer_decision_stats(self, session: Session, reviewer: Reviewer) -> Tuple[int, Optional[str]]:
        """
        Dynamically counts real decisions from review_decisions table.
        Matches by reviewer name, reviewer id, or reviewer email.
        """
        conditions = [
            ReviewDecision.reviewer == reviewer.name,
            ReviewDecision.reviewer == reviewer.id,
        ]
        if reviewer.email:
            conditions.append(ReviewDecision.reviewer == reviewer.email)

        # If this reviewer is Rajesh Kumar, also attribute legacy 'Reviewer' decisions if applicable
        if reviewer.id == "HPCL-REV-001" or reviewer.name == "Rajesh Kumar":
            conditions.append(ReviewDecision.reviewer == "Reviewer")

        clause = or_(*conditions)
        count = session.execute(
            select(func.count(ReviewDecision.id)).where(clause)
        ).scalar() or 0

        latest_ts = session.execute(
            select(func.max(ReviewDecision.timestamp)).where(clause)
        ).scalar()

        last_active = latest_ts.isoformat() if latest_ts else None
        return count, last_active

    def get_reviewer(self, reviewer_id: str) -> Optional[Dict[str, Any]]:
        with self.get_session() as session:
            rid = (reviewer_id or "").strip().upper()
            r = session.execute(
                select(Reviewer).where(func.upper(Reviewer.id) == rid)
            ).scalars().first()
            if not r:
                return None
            cpse = session.get(CPSE, r.cpse_id) if r.cpse_id else session.execute(
                select(CPSE).where(Reviewer.cpse_code == CPSE.code)
            ).scalars().first()
            cpse_name = cpse.name if cpse else f"{r.cpse_code} Corporation"
            count, last_active = self.get_reviewer_decision_stats(session, r)
            return r.to_dict(decisions_count=count, last_active=last_active, cpse_name=cpse_name)

    def get_reviewer_by_email_or_id(self, identifier: str) -> Optional[Dict[str, Any]]:
        with self.get_session() as session:
            ident = (identifier or "").strip().lower()
            r = session.execute(
                select(Reviewer).where(
                    or_(
                        func.lower(Reviewer.id) == ident,
                        func.lower(Reviewer.email) == ident,
                    )
                )
            ).scalars().first()
            if not r:
                return None
            cpse = session.get(CPSE, r.cpse_id) if r.cpse_id else None
            cpse_name = cpse.name if cpse else f"{r.cpse_code} Corporation"
            count, last_active = self.get_reviewer_decision_stats(session, r)
            return r.to_dict(decisions_count=count, last_active=last_active, cpse_name=cpse_name)

    def list_reviewers(
        self,
        cpse_code: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Dict[str, Any]:
        with self.get_session() as session:
            # Self-healing bootstrap: if reviewers table is completely empty, seed verified reviewers for all registered CPSEs
            total_in_db = session.execute(select(func.count(Reviewer.id))).scalar() or 0
            if total_in_db == 0:
                all_registered_cpses = session.execute(select(CPSE)).scalars().all()
                default_reviewer_configs = {
                    "HPCL": ("Rajesh Kumar", "Chief Manager (Materials & Supply Chain)", "Piping, Valves & Static Equipment"),
                    "BPCL": ("Suresh Nair", "Lead Procurement Engineer (Refining)", "Instrumentation & Process Control Hardware"),
                    "IOCL": ("Amit Sharma", "Executive Director (Materials Management)", "Refining Equipment & Catalyst"),
                    "ONGC": ("Vikas Verma", "Chief General Manager (Exploration Stores)", "Offshore & Drilling Equipment"),
                    "GAIL": ("Pooja Mehta", "DGM (Procurement & Contracts)", "Gas Pipelines & Metering"),
                    "BHEL": ("Ramesh Patel", "Senior Manager (Supply Chain)", "Electrical & Power Systems"),
                    "NTPC": ("Sunil Joshi", "Head of Material Planning", "Thermal Turbines & Boilers"),
                    "OIL": ("Debashish Roy", "Lead Materials Officer", "Drilling Rigs & Production Equipment"),
                }
                for cpse in all_registered_cpses:
                    cfg = default_reviewer_configs.get(
                        cpse.code,
                        (f"{cpse.code} Reviewer", "Certified Domain Reviewer", "Materials Management")
                    )
                    email_prefix = cfg[0].lower().replace(" ", ".")
                    session.add(Reviewer(
                        id=f"{cpse.code}-REV-001",
                        name=cfg[0],
                        cpse_id=cpse.id,
                        cpse_code=cpse.code,
                        designation=cfg[1],
                        domain=cfg[2],
                        email=f"{email_prefix}@{cpse.code.lower()}.in",
                        status="ACTIVE",
                        certified_date="2025-08-15",
                        password="nmc-reviewer-key",
                        reviewer_key="nmc-reviewer-key",
                        authorization_scope=f"{cpse.code} Catalog Scoped + Cross-CPSE Pairs",
                    ))
                session.commit()

            # Self-healing sync: ensure reviewer cpse_ids match active CPSE table IDs
            all_reviewers = session.execute(select(Reviewer)).scalars().all()
            dirty = False
            for r in all_reviewers:
                if r.cpse_code:
                    cpse = session.execute(
                        select(CPSE).where(func.upper(CPSE.code) == r.cpse_code.upper())
                    ).scalars().first()
                    if cpse and r.cpse_id != cpse.id:
                        r.cpse_id = cpse.id
                        dirty = True
            if dirty:
                session.commit()

            query = select(Reviewer)
            if cpse_code and cpse_code.upper() != "ALL":
                query = query.where(func.upper(Reviewer.cpse_code) == cpse_code.strip().upper())
            if status and status.upper() != "ALL":
                query = query.where(func.upper(Reviewer.status) == status.strip().upper())
            if search:
                s = f"%{search.strip().lower()}%"
                query = query.where(
                    or_(
                        func.lower(Reviewer.name).like(s),
                        func.lower(Reviewer.id).like(s),
                        func.lower(Reviewer.cpse_code).like(s),
                        func.lower(Reviewer.designation).like(s),
                        func.lower(Reviewer.domain).like(s),
                        func.lower(Reviewer.email).like(s),
                    )
                )

            query = query.order_by(desc(Reviewer.created_at))
            rows = session.execute(query).scalars().all()

            # Cache CPSE names
            all_cpses = {c.code: c.name for c in session.execute(select(CPSE)).scalars().all()}

            items = []
            for r in rows:
                c_name = all_cpses.get(r.cpse_code, f"{r.cpse_code} Corporation")
                count, last_active = self.get_reviewer_decision_stats(session, r)
                items.append(r.to_dict(decisions_count=count, last_active=last_active, cpse_name=c_name))

            active_count = sum(1 for item in items if item["status"] == "ACTIVE")
            total_cpses = len({item["cpse_code"] for item in items})

            return {
                "items": items,
                "total": len(items),
                "active_count": active_count,
                "total_cpses": total_cpses,
            }

    def create_reviewer(self, data: Dict[str, Any]) -> Dict[str, Any]:
        with self.get_session() as session:
            cpse_code = data["cpse_code"].strip().upper()
            cpse = session.execute(select(CPSE).where(CPSE.code == cpse_code)).scalars().first()
            cpse_id = cpse.id if cpse else None
            cpse_name = cpse.name if cpse else f"{cpse_code} Corporation"

            # Auto-generate ID if not provided
            if data.get("id") and data["id"].strip():
                new_id = data["id"].strip().upper()
            else:
                existing_count = session.execute(
                    select(func.count(Reviewer.id)).where(Reviewer.cpse_code == cpse_code)
                ).scalar() or 0
                new_id = f"{cpse_code}-REV-{(existing_count + 1):03d}"

            # Check if exists
            existing = session.execute(
                select(Reviewer).where(func.upper(Reviewer.id) == new_id.upper())
            ).scalars().first()

            pw = (data.get("password") or data.get("reviewer_key") or "nmc-reviewer-key").strip()

            if existing:
                existing.name = data.get("name", existing.name).strip()
                existing.cpse_id = cpse_id
                existing.cpse_code = cpse_code
                existing.designation = data.get("designation") or existing.designation or "Domain Materials Reviewer"
                existing.domain = data.get("domain") or existing.domain or "Materials Management"
                if data.get("email"):
                    existing.email = data["email"].strip()
                existing.status = "ACTIVE"
                existing.password = pw
                existing.reviewer_key = pw
                existing.updated_at = datetime.now(timezone.utc)
                target = existing
            else:
                email = data.get("email") or f"{data['name'].lower().replace(' ', '.')}@{cpse_code.lower()}.in"
                target = Reviewer(
                    id=new_id,
                    name=data["name"].strip(),
                    cpse_id=cpse_id,
                    cpse_code=cpse_code,
                    designation=data.get("designation") or "Domain Materials Reviewer",
                    domain=data.get("domain") or "Materials Management",
                    email=email.strip() if email else None,
                    status="ACTIVE",
                    certified_date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                    password=pw,
                    reviewer_key=pw,
                    authorization_scope=f"{cpse_code} Catalog Scoped + Cross-CPSE Pairs",
                )
                session.add(target)

            session.commit()
            count, last_active = self.get_reviewer_decision_stats(session, target)
            return target.to_dict(decisions_count=count, last_active=last_active, cpse_name=cpse_name)

    def update_reviewer(self, reviewer_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        with self.get_session() as session:
            rid = reviewer_id.strip().upper()
            r = session.execute(
                select(Reviewer).where(func.upper(Reviewer.id) == rid)
            ).scalars().first()
            if not r:
                return None

            if "status" in updates and updates["status"]:
                r.status = updates["status"].upper()
            if "designation" in updates and updates["designation"]:
                r.designation = updates["designation"]
            if "domain" in updates and updates["domain"]:
                r.domain = updates["domain"]
            if "email" in updates and updates["email"]:
                r.email = updates["email"]
            if "password" in updates and updates["password"]:
                pw = updates["password"].strip()
                r.password = pw
                r.reviewer_key = pw
            elif "reviewer_key" in updates and updates["reviewer_key"]:
                pw = updates["reviewer_key"].strip()
                r.password = pw
                r.reviewer_key = pw

            r.updated_at = datetime.now(timezone.utc)
            session.commit()

            cpse = session.get(CPSE, r.cpse_id) if r.cpse_id else None
            c_name = cpse.name if cpse else f"{r.cpse_code} Corporation"
            count, last_active = self.get_reviewer_decision_stats(session, r)
            return r.to_dict(decisions_count=count, last_active=last_active, cpse_name=c_name)

    def delete_reviewer(self, reviewer_id: str) -> bool:
        with self.get_session() as session:
            rid = reviewer_id.strip().upper()
            r = session.execute(
                select(Reviewer).where(func.upper(Reviewer.id) == rid)
            ).scalars().first()
            if not r:
                return False
            session.delete(r)
            session.commit()
            return True

    # -----------------------------------------------------------------------
    # Review Notifications / Alerts
    # -----------------------------------------------------------------------

    def create_notification(
        self,
        cpse_code: str,
        alert_type: str,
        message: str,
        cpse_id: Optional[str] = None,
        match_id: Optional[str] = None,
        cmm_id: Optional[str] = None,
        national_material_code: Optional[str] = None,
        material_id: Optional[str] = None,
        material_code: Optional[str] = None,
        material_description: Optional[str] = None,
        triggered_by_cpse: Optional[str] = None,
        triggered_by_reviewer: Optional[str] = None,
        endorsed_cpses: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        with self.get_session() as session:
            if not cpse_id:
                cpse = session.execute(
                    select(CPSE).where(func.upper(CPSE.code) == cpse_code.upper())
                ).scalars().first()
                cpse_id = cpse.id if cpse else cpse_code

            notif = ReviewNotification(
                cpse_id=cpse_id,
                cpse_code=cpse_code.upper(),
                alert_type=alert_type,
                match_id=match_id,
                cmm_id=cmm_id,
                national_material_code=national_material_code,
                material_id=material_id,
                material_code=material_code,
                material_description=material_description,
                triggered_by_cpse=triggered_by_cpse,
                triggered_by_reviewer=triggered_by_reviewer,
                endorsed_cpses=endorsed_cpses or [],
                message=message,
                is_read=False,
                is_acted=False,
            )
            session.add(notif)
            session.commit()
            return notif.to_dict()

    def get_notifications(
        self,
        cpse_code: Optional[str] = None,
        unacted_only: bool = True,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        with self.get_session() as session:
            stmt = select(ReviewNotification)
            if cpse_code and cpse_code.upper() not in ("ADMIN", "ALL"):
                stmt = stmt.where(func.upper(ReviewNotification.cpse_code) == cpse_code.upper())
            if unacted_only:
                stmt = stmt.where(ReviewNotification.is_acted == False)
            stmt = stmt.order_by(desc(ReviewNotification.created_at)).limit(limit)
            rows = session.execute(stmt).scalars().all()
            return [r.to_dict() for r in rows]

    def mark_notification_acted(self, notif_id: str) -> bool:
        with self.get_session() as session:
            notif = session.get(ReviewNotification, notif_id)
            if not notif:
                return False
            notif.is_acted = True
            notif.is_read = True
            notif.read_at = datetime.now(timezone.utc)
            session.commit()
            return True

    def mark_notification_read(self, notif_id: str) -> bool:
        with self.get_session() as session:
            notif = session.get(ReviewNotification, notif_id)
            if not notif:
                return False
            notif.is_read = True
            notif.read_at = datetime.now(timezone.utc)
            session.commit()
            return True

    def mark_notifications_acted_for_match(self, match_id: str) -> int:
        with self.get_session() as session:
            rows = session.execute(
                select(ReviewNotification).where(
                    and_(
                        ReviewNotification.match_id == match_id,
                        ReviewNotification.is_acted == False,
                    )
                )
            ).scalars().all()
            now = datetime.now(timezone.utc)
            for r in rows:
                r.is_acted = True
                r.is_read = True
                r.read_at = now
            session.commit()
            return len(rows)

    def mark_notifications_acted_for_material(self, material_id: str) -> int:
        with self.get_session() as session:
            rows = session.execute(
                select(ReviewNotification).where(
                    and_(
                        ReviewNotification.material_id == material_id,
                        ReviewNotification.is_acted == False,
                    )
                )
            ).scalars().all()
            now = datetime.now(timezone.utc)
            for r in rows:
                r.is_acted = True
                r.is_read = True
                r.read_at = now
            session.commit()
            return len(rows)


# Global singleton
nmc_repo = NMCRepository()
