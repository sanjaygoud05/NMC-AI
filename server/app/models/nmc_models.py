"""
NMC — National Material Code Platform
Core SQLAlchemy ORM models for the complete NMC data model.
All tables share one declarative Base.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    CheckConstraint,
)
from sqlalchemy.orm import declarative_base, relationship

try:
    from sqlalchemy import JSON
except ImportError:
    from sqlalchemy.types import JSON  # older SQLAlchemy

Base = declarative_base()


def _now():
    return datetime.now(timezone.utc)


def _uuid():
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# CPSE
# ---------------------------------------------------------------------------

class CPSE(Base):
    """
    Central Public Sector Enterprise.
    Each CPSE may upload one active dataset at a time.
    """
    __tablename__ = "cpsEs"

    id = Column(String(36), primary_key=True, default=_uuid)
    name = Column(String(128), nullable=False)
    code = Column(String(32), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default="ACTIVE")  # ACTIVE | INACTIVE
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    datasets = relationship("Dataset", back_populates="cpse", cascade="all, delete-orphan")
    materials = relationship("Material", back_populates="cpse")

    __table_args__ = (
        CheckConstraint("status IN ('ACTIVE', 'INACTIVE')", name="cpse_status_check"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "code": self.code,
            "description": self.description,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------

class Dataset(Base):
    """
    A material master dataset uploaded by a CPSE.
    Lifecycle: UPLOADED → VALIDATED → PROCESSING → NORMALIZED → READY
            or FAILED at any stage.
    """
    __tablename__ = "datasets"

    id = Column(String(36), primary_key=True, default=_uuid)
    cpse_id = Column(String(36), ForeignKey("cpsEs.id", ondelete="CASCADE"), nullable=False, index=True)
    file_name = Column(String(256), nullable=False)
    file_type = Column(String(16), nullable=False)    # csv | xlsx
    record_count = Column(Integer, nullable=True)
    status = Column(
        String(32), nullable=False, default="UPLOADED",
        index=True,
    )  # UPLOADED | VALIDATED | PROCESSING | NORMALIZED | READY | FAILED
    error_message = Column(Text, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    validated_at = Column(DateTime(timezone=True), nullable=True)
    normalized_at = Column(DateTime(timezone=True), nullable=True)
    version = Column(Integer, nullable=False, default=1)
    is_active = Column(Boolean, nullable=False, default=True)

    cpse = relationship("CPSE", back_populates="datasets")
    materials = relationship("Material", back_populates="dataset", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint(
            "status IN ('UPLOADED','VALIDATED','PROCESSING','NORMALIZED','READY','FAILED')",
            name="dataset_status_check",
        ),
        Index("idx_datasets_cpse_active", "cpse_id", "is_active"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "cpse_id": self.cpse_id,
            "file_name": self.file_name,
            "file_type": self.file_type,
            "record_count": self.record_count,
            "status": self.status,
            "error_message": self.error_message,
            "uploaded_at": self.uploaded_at.isoformat() if self.uploaded_at else None,
            "validated_at": self.validated_at.isoformat() if self.validated_at else None,
            "normalized_at": self.normalized_at.isoformat() if self.normalized_at else None,
            "version": self.version,
            "is_active": self.is_active,
        }


# ---------------------------------------------------------------------------
# Material
# ---------------------------------------------------------------------------

class Material(Base):
    """
    A single material item from a CPSE dataset.
    Stores both the original values and the NMC pipeline outputs.
    """
    __tablename__ = "materials"

    id = Column(String(36), primary_key=True, default=_uuid)
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True)
    cpse_id = Column(String(36), ForeignKey("cpsEs.id", ondelete="CASCADE"), nullable=False, index=True)

    # Original values as uploaded
    original_material_code = Column(String(128), nullable=True, index=True)
    original_description = Column(Text, nullable=False)

    # Pipeline outputs
    normalized_description = Column(Text, nullable=True)
    standardized_description = Column(Text, nullable=True)
    material_family = Column(String(64), nullable=True, index=True)
    material_type = Column(String(64), nullable=True)
    grade = Column(String(64), nullable=True)
    dimensions = Column(String(128), nullable=True)
    specifications = Column(String(256), nullable=True)
    uom = Column(String(32), nullable=True)
    attributes = Column(JSON, nullable=True)    # Full extracted attributes dict

    # Status
    processing_status = Column(
        String(32), nullable=False, default="RAW",
    )  # RAW | NORMALIZED | ATTRIBUTED | EMBEDDED | MATCHED
    mapping_status = Column(
        String(32), nullable=False, default="UNMAPPED",
    )  # UNMAPPED | MAPPED | DIFFERENT

    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    dataset = relationship("Dataset", back_populates="materials")
    cpse = relationship("CPSE", back_populates="materials")

    __table_args__ = (
        Index("idx_materials_cpse_status", "cpse_id", "processing_status"),
        Index("idx_materials_family", "material_family"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "dataset_id": self.dataset_id,
            "cpse_id": self.cpse_id,
            "original_material_code": self.original_material_code,
            "original_description": self.original_description,
            "normalized_description": self.normalized_description,
            "standardized_description": self.standardized_description,
            "material_family": self.material_family,
            "material_type": self.material_type,
            "grade": self.grade,
            "dimensions": self.dimensions,
            "specifications": self.specifications,
            "uom": self.uom,
            "attributes": self.attributes,
            "processing_status": self.processing_status,
            "mapping_status": self.mapping_status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# ---------------------------------------------------------------------------
# MaterialMatch
# ---------------------------------------------------------------------------

class MaterialMatch(Base):
    """
    A candidate match pair between two materials from different CPSEs.
    Generated by the AI matching engine.
    """
    __tablename__ = "material_matches"

    id = Column(String(36), primary_key=True, default=_uuid)
    source_material_id = Column(String(36), ForeignKey("materials.id"), nullable=False, index=True)
    candidate_material_id = Column(String(36), ForeignKey("materials.id"), nullable=False, index=True)

    # Scores (0.0–1.0)
    semantic_similarity = Column(Float, nullable=True)
    text_similarity = Column(Float, nullable=True)
    attribute_similarity = Column(Float, nullable=True)
    rule_validation_status = Column(String(32), nullable=True)  # PASSED | FAILED | PARTIAL

    # Decision
    final_confidence = Column(Float, nullable=True)
    confidence_label = Column(String(16), nullable=True)    # HIGH | MEDIUM | LOW
    match_category = Column(
        String(32), nullable=False, default="POTENTIALLY_SAME",
    )  # POTENTIALLY_SAME | DIFFERENT | ALREADY_MAPPED
    explanation = Column(JSON, nullable=True)   # Human-readable breakdown

    status = Column(
        String(32), nullable=False, default="PENDING_REVIEW",
        index=True,
    )  # PENDING_REVIEW | ACCEPTED | REJECTED | DIFFERENT | OVERRIDDEN

    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    source_material = relationship("Material", foreign_keys=[source_material_id])
    candidate_material = relationship("Material", foreign_keys=[candidate_material_id])
    review_decisions = relationship("ReviewDecision", back_populates="match", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint(
            "match_category IN ('POTENTIALLY_SAME','DIFFERENT','ALREADY_MAPPED')",
            name="match_category_check",
        ),
        CheckConstraint(
            "status IN ('PENDING_REVIEW','ACCEPTED','REJECTED','DIFFERENT','OVERRIDDEN')",
            name="match_status_check",
        ),
        Index("idx_matches_status_category", "status", "match_category"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "source_material_id": self.source_material_id,
            "candidate_material_id": self.candidate_material_id,
            "semantic_similarity": self.semantic_similarity,
            "text_similarity": self.text_similarity,
            "attribute_similarity": self.attribute_similarity,
            "rule_validation_status": self.rule_validation_status,
            "final_confidence": self.final_confidence,
            "confidence_label": self.confidence_label,
            "match_category": self.match_category,
            "explanation": self.explanation,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# ---------------------------------------------------------------------------
# NMCCommonMaterial (Common Material Master)
# ---------------------------------------------------------------------------

class NMCCommonMaterial(Base):
    """
    Common Material Master record.
    Represents a finalized harmonized material identity across CPSEs.
    Each record has a unique, stable Common National Material Code.
    """
    __tablename__ = "nmc_common_materials"

    id = Column(String(36), primary_key=True, default=_uuid)
    national_material_code = Column(String(64), unique=True, nullable=False, index=True)
    # Format: NMC-{FAMILY_ABBREV}-{NNNN}  e.g. NMC-BOLT-0001

    canonical_description = Column(Text, nullable=False)
    material_type = Column(String(64), nullable=True)
    material_family = Column(String(64), nullable=True, index=True)
    grade = Column(String(64), nullable=True)
    dimensions = Column(String(128), nullable=True)
    specifications = Column(Text, nullable=True)
    uom = Column(String(32), nullable=True)
    source_cpses = Column(JSON, nullable=False, default=list)    # ["ONGC", "IOCL"]
    attributes = Column(JSON, nullable=True)

    status = Column(
        String(32), nullable=False, default="ACTIVE",
    )  # ACTIVE | INACTIVE | DRAFT

    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)
    created_by = Column(String(128), nullable=True)

    mappings = relationship("MaterialMapping", back_populates="cmm", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "national_material_code": self.national_material_code,
            "canonical_description": self.canonical_description,
            "material_type": self.material_type,
            "material_family": self.material_family,
            "grade": self.grade,
            "dimensions": self.dimensions,
            "specifications": self.specifications,
            "uom": self.uom,
            "source_cpses": self.source_cpses,
            "attributes": self.attributes,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by,
        }


# ---------------------------------------------------------------------------
# MaterialMapping
# ---------------------------------------------------------------------------

class MaterialMapping(Base):
    """
    Links a CPSE Material to a Common Material Master record.
    Created when a reviewer accepts a match.
    """
    __tablename__ = "material_mappings"

    id = Column(String(36), primary_key=True, default=_uuid)
    material_id = Column(String(36), ForeignKey("materials.id"), nullable=False, index=True)
    cmm_id = Column(String(36), ForeignKey("nmc_common_materials.id"), nullable=False, index=True)
    mapping_status = Column(
        String(32), nullable=False, default="ACTIVE",
    )  # ACTIVE | SUPERSEDED
    decision_source = Column(String(32), nullable=False)    # REVIEWER | ADMIN | AUTO
    reviewer = Column(String(128), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)

    material = relationship("Material", foreign_keys=[material_id])
    cmm = relationship("NMCCommonMaterial", back_populates="mappings")

    def to_dict(self):
        return {
            "id": self.id,
            "material_id": self.material_id,
            "cmm_id": self.cmm_id,
            "mapping_status": self.mapping_status,
            "decision_source": self.decision_source,
            "reviewer": self.reviewer,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# ReviewDecision
# ---------------------------------------------------------------------------

class ReviewDecision(Base):
    """
    A human reviewer's decision on a MaterialMatch.
    Every action (Accept/Reject/Different/Override) is recorded here.
    """
    __tablename__ = "review_decisions"

    id = Column(String(36), primary_key=True, default=_uuid)
    match_id = Column(String(36), ForeignKey("material_matches.id"), nullable=False, index=True)
    reviewer = Column(String(128), nullable=False)
    decision = Column(
        String(32), nullable=False,
    )  # ACCEPT | REJECT | DIFFERENT | OVERRIDE
    override_outcome = Column(
        String(32), nullable=True,
    )  # EQUIVALENT | DIFFERENT | None
    reason = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, default=_now)

    match = relationship("MaterialMatch", back_populates="review_decisions")

    __table_args__ = (
        CheckConstraint(
            "decision IN ('ACCEPT','REJECT','DIFFERENT','OVERRIDE')",
            name="review_decision_check",
        ),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "match_id": self.match_id,
            "reviewer": self.reviewer,
            "decision": self.decision,
            "override_outcome": self.override_outcome,
            "reason": self.reason,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }


# ---------------------------------------------------------------------------
# AuditLog
# ---------------------------------------------------------------------------

class AuditLog(Base):
    """
    Append-only audit trail for all significant NMC platform actions.
    """
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=_uuid)
    timestamp = Column(DateTime(timezone=True), nullable=False, default=_now, index=True)
    actor = Column(String(128), nullable=False)         # "Admin" | "System" | "Reviewer"
    cpse_code = Column(String(32), nullable=True, index=True)
    action = Column(String(64), nullable=False, index=True)
    # Actions: CPSE_CREATED, DATASET_UPLOADED, DATASET_VALIDATED,
    #          DATASET_NORMALIZED, MATCHING_STARTED, MATCHING_COMPLETED,
    #          REVIEW_ACCESSED, MATCH_ACCEPTED, MATCH_REJECTED,
    #          MATCH_DIFFERENT, MATCH_OVERRIDDEN, CMM_CREATED, CMM_UPDATED
    material_code = Column(String(128), nullable=True)
    previous_status = Column(String(64), nullable=True)
    new_status = Column(String(64), nullable=True)
    reason = Column(Text, nullable=True)
    extra_metadata = Column("metadata", JSON, nullable=True)

    def to_dict(self):
        ts_iso = None
        if self.timestamp:
            ts = self.timestamp
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            ts_iso = ts.isoformat()
            if not ts_iso.endswith("Z") and "+00:00" in ts_iso:
                ts_iso = ts_iso.replace("+00:00", "Z")
            elif not ts_iso.endswith("Z") and "+" not in ts_iso:
                ts_iso = ts_iso + "Z"
        return {
            "id": self.id,
            "timestamp": ts_iso,
            "actor": self.actor,
            "cpse_code": self.cpse_code,
            "action": self.action,
            "material_code": self.material_code,
            "previous_status": self.previous_status,
            "new_status": self.new_status,
            "reason": self.reason,
            "metadata": self.extra_metadata,
        }

# ---------------------------------------------------------------------------
# InventoryRecord
# ---------------------------------------------------------------------------

class InventoryRecord(Base):
    """
    Inventory quantity data for a CPSE material.
    Linked to NMCCommonMaterial when the material has been harmonized.
    """
    __tablename__ = "inventory_records"

    id = Column(String(36), primary_key=True, default=_uuid)
    material_id = Column(String(36), ForeignKey("materials.id", ondelete="CASCADE"), nullable=False, index=True)
    cpse_id = Column(String(36), ForeignKey("cpsEs.id", ondelete="CASCADE"), nullable=False, index=True)
    cmm_id = Column(String(36), ForeignKey("nmc_common_materials.id", ondelete="SET NULL"), nullable=True, index=True)

    quantity_on_hand = Column(Float, nullable=False, default=0.0)
    reserved_quantity = Column(Float, nullable=False, default=0.0)
    available_quantity = Column(Float, nullable=False, default=0.0)
    plant = Column(String(64), nullable=True)
    uom = Column(String(32), nullable=True)
    inventory_date = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    material = relationship("Material", foreign_keys=[material_id])
    cpse = relationship("CPSE", foreign_keys=[cpse_id])
    cmm = relationship("NMCCommonMaterial", foreign_keys=[cmm_id])

    __table_args__ = (
        Index("idx_inventory_cpse", "cpse_id"),
        Index("idx_inventory_cmm", "cmm_id"),
        Index("idx_inventory_material", "material_id"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "material_id": self.material_id,
            "cpse_id": self.cpse_id,
            "cmm_id": self.cmm_id,
            "quantity_on_hand": self.quantity_on_hand,
            "reserved_quantity": self.reserved_quantity,
            "available_quantity": self.available_quantity,
            "plant": self.plant,
            "uom": self.uom,
            "inventory_date": self.inventory_date.isoformat() if self.inventory_date else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# ---------------------------------------------------------------------------
# DemandRecord
# ---------------------------------------------------------------------------

class DemandRecord(Base):
    """
    Demand/requirement data for a CPSE material.
    Linked to NMCCommonMaterial when the material has been harmonized.
    """
    __tablename__ = "demand_records"

    id = Column(String(36), primary_key=True, default=_uuid)
    material_id = Column(String(36), ForeignKey("materials.id", ondelete="CASCADE"), nullable=False, index=True)
    cpse_id = Column(String(36), ForeignKey("cpsEs.id", ondelete="CASCADE"), nullable=False, index=True)
    cmm_id = Column(String(36), ForeignKey("nmc_common_materials.id", ondelete="SET NULL"), nullable=True, index=True)

    required_quantity = Column(Float, nullable=False, default=0.0)
    forecast_quantity = Column(Float, nullable=True)
    demand_period = Column(String(64), nullable=True)
    plant = Column(String(64), nullable=True)
    uom = Column(String(32), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    material = relationship("Material", foreign_keys=[material_id])
    cpse = relationship("CPSE", foreign_keys=[cpse_id])
    cmm = relationship("NMCCommonMaterial", foreign_keys=[cmm_id])

    __table_args__ = (
        Index("idx_demand_cpse", "cpse_id"),
        Index("idx_demand_cmm", "cmm_id"),
        Index("idx_demand_material", "material_id"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "material_id": self.material_id,
            "cpse_id": self.cpse_id,
            "cmm_id": self.cmm_id,
            "required_quantity": self.required_quantity,
            "forecast_quantity": self.forecast_quantity,
            "demand_period": self.demand_period,
            "plant": self.plant,
            "uom": self.uom,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# ---------------------------------------------------------------------------
# ProcurementHistoryRecord
# ---------------------------------------------------------------------------

class ProcurementHistoryRecord(Base):
    """
    Historical purchase orders for CPSE materials.
    Linked to NMCCommonMaterial when the material has been harmonized.
    Kept separate from inventory and demand due to distinct lifecycle and cardinality.
    """
    __tablename__ = "procurement_history_records"

    id = Column(String(36), primary_key=True, default=_uuid)
    material_id = Column(String(36), ForeignKey("materials.id", ondelete="CASCADE"), nullable=False, index=True)
    cpse_id = Column(String(36), ForeignKey("cpsEs.id", ondelete="CASCADE"), nullable=False, index=True)
    cmm_id = Column(String(36), ForeignKey("nmc_common_materials.id", ondelete="SET NULL"), nullable=True, index=True)

    po_number = Column(String(64), nullable=False)
    supplier_name = Column(String(128), nullable=False)
    quantity = Column(Float, nullable=False, default=0.0)
    unit_price = Column(Float, nullable=False, default=0.0)
    uom = Column(String(32), nullable=True)
    po_date = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    material = relationship("Material", foreign_keys=[material_id])
    cpse = relationship("CPSE", foreign_keys=[cpse_id])
    cmm = relationship("NMCCommonMaterial", foreign_keys=[cmm_id])

    __table_args__ = (
        Index("idx_proc_hist_cpse", "cpse_id"),
        Index("idx_proc_hist_cmm", "cmm_id"),
        Index("idx_proc_hist_material", "material_id"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "material_id": self.material_id,
            "cpse_id": self.cpse_id,
            "cmm_id": self.cmm_id,
            "po_number": self.po_number,
            "supplier_name": self.supplier_name,
            "quantity": self.quantity,
            "unit_price": self.unit_price,
            "uom": self.uom,
            "po_date": self.po_date.isoformat() if self.po_date else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

