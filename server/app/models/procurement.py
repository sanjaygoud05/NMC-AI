"""
SQLAlchemy ORM models for Phase 10 Procurement Intelligence + Analytics
Defines schemas for:
- procurement_facts (line-level legacy procurement facts joined with CMM)
- cmm_procurement_summary (CMM-level demand, volume, and recency aggregation)
- procurement_opportunities (deterministic, evidence-backed sourcing signals with full provenance)
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    Float,
    Date,
    DateTime,
    Boolean,
    CheckConstraint,
    UniqueConstraint,
    Index,
    ForeignKey,
)
try:
    from app.models.review import Base
except ImportError:
    from server.app.models.review import Base


class ProcurementFact(Base):
    """
    Granular line-level procurement facts.
    Joins legacy source material items with Phase 8 CMM entities and physical procurement fields.
    """
    __tablename__ = "procurement_facts"

    fact_id = Column(String(64), primary_key=True, index=True)
    source_cpse = Column(String(32), nullable=False, index=True)
    material_code = Column(String(64), nullable=False, index=True)
    material_description = Column(Text, nullable=False)
    cmm_code = Column(
        String(64),
        ForeignKey("common_material_master.common_code", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    material_category = Column(String(64), nullable=False, index=True)
    material_type = Column(String(64), nullable=True)
    unit_of_measure = Column(String(32), nullable=False, index=True)
    plant = Column(String(128), nullable=False, index=True)
    material_status = Column(String(32), nullable=False, index=True)
    annual_consumption = Column(Integer, nullable=False)
    last_purchase_date = Column(Date, nullable=True)
    manufacturer = Column(String(128), nullable=True)
    manufacturer_part_no = Column(String(128), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("source_cpse", "material_code", name="uq_procurement_fact_cpse_code"),
        CheckConstraint("annual_consumption >= 0", name="ck_fact_consumption_positive"),
        Index("idx_fact_cmm_uom", "cmm_code", "unit_of_measure"),
        Index("idx_fact_cpse_uom", "source_cpse", "unit_of_measure"),
        {"extend_existing": True},
    )

    def to_dict(self) -> dict:
        return {
            "fact_id": self.fact_id,
            "source_cpse": self.source_cpse,
            "material_code": self.material_code,
            "material_description": self.material_description,
            "cmm_code": self.cmm_code,
            "material_category": self.material_category,
            "material_type": self.material_type,
            "unit_of_measure": self.unit_of_measure,
            "plant": self.plant,
            "material_status": self.material_status,
            "annual_consumption": self.annual_consumption,
            "last_purchase_date": self.last_purchase_date.isoformat() if self.last_purchase_date else None,
            "manufacturer": self.manufacturer,
            "manufacturer_part_no": self.manufacturer_part_no,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class CMMProcurementSummary(Base):
    """
    CMM-level demand, volume, and purchase recency aggregation.
    """
    __tablename__ = "cmm_procurement_summary"

    cmm_code = Column(
        String(64),
        ForeignKey("common_material_master.common_code", ondelete="RESTRICT"),
        primary_key=True,
        index=True,
    )
    common_description = Column(Text, nullable=False)
    material_family = Column(String(64), nullable=False, index=True)
    governance_status = Column(String(32), nullable=False, index=True)
    member_count = Column(Integer, nullable=False)
    cpse_count = Column(Integer, nullable=False, index=True)
    consuming_cpses = Column(String(128), nullable=False)
    primary_uom = Column(String(32), nullable=False, index=True)
    total_annual_consumption = Column(Integer, nullable=False)
    avg_consumption_per_member = Column(Float, nullable=False)
    plant_count = Column(Integer, nullable=False)
    dominant_plant = Column(String(128), nullable=True)
    earliest_purchase_date = Column(Date, nullable=True)
    latest_purchase_date = Column(Date, nullable=True)
    purchase_recency_days = Column(Integer, nullable=True)
    active_member_count = Column(Integer, nullable=False)
    inactive_member_count = Column(Integer, nullable=False)
    unique_manufacturers_count = Column(Integer, nullable=False)
    unique_part_numbers_count = Column(Integer, nullable=False)
    manufacturer_diversity_flag = Column(Boolean, nullable=False, default=False)

    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        Index("idx_cmm_proc_family_uom", "material_family", "primary_uom"),
        Index("idx_cmm_proc_cpse_count", "cpse_count"),
        {"extend_existing": True},
    )

    def to_dict(self) -> dict:
        return {
            "cmm_code": self.cmm_code,
            "common_description": self.common_description,
            "material_family": self.material_family,
            "governance_status": self.governance_status,
            "member_count": self.member_count,
            "cpse_count": self.cpse_count,
            "consuming_cpses": self.consuming_cpses,
            "primary_uom": self.primary_uom,
            "total_annual_consumption": self.total_annual_consumption,
            "avg_consumption_per_member": self.avg_consumption_per_member,
            "plant_count": self.plant_count,
            "dominant_plant": self.dominant_plant,
            "earliest_purchase_date": self.earliest_purchase_date.isoformat() if self.earliest_purchase_date else None,
            "latest_purchase_date": self.latest_purchase_date.isoformat() if self.latest_purchase_date else None,
            "purchase_recency_days": self.purchase_recency_days,
            "active_member_count": self.active_member_count,
            "inactive_member_count": self.inactive_member_count,
            "unique_manufacturers_count": self.unique_manufacturers_count,
            "unique_part_numbers_count": self.unique_part_numbers_count,
            "manufacturer_diversity_flag": self.manufacturer_diversity_flag,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ProcurementOpportunity(Base):
    """
    Deterministic, evidence-backed procurement opportunities and rationalization signals.
    Enforces full provenance: trigger metric, trigger value, threshold, reason, and evidence reference.
    """
    __tablename__ = "procurement_opportunities"

    opportunity_id = Column(String(64), primary_key=True, index=True)
    opportunity_type = Column(String(64), nullable=False, index=True)
    cmm_code = Column(
        String(64),
        ForeignKey("common_material_master.common_code", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    source_cpses = Column(String(128), nullable=False)
    material_codes = Column(Text, nullable=False)
    trigger_metric = Column(String(64), nullable=False)
    trigger_value = Column(String(64), nullable=False)
    threshold = Column(String(64), nullable=False)
    reason = Column(Text, nullable=False)
    evidence_reference = Column(Text, nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("opportunity_type", "cmm_code", name="uq_opp_type_cmm"),
        CheckConstraint(
            "opportunity_type IN ("
            "'MULTI_CPSE_DEMAND_AGGREGATION', "
            "'HIGH_VOLUME_CONCENTRATION', "
            "'PURCHASE_DORMANCY_SIGNAL', "
            "'MANUFACTURER_DIVERSITY_SIGNAL'"
            ")",
            name="ck_valid_opportunity_type",
        ),
        Index("idx_opp_type_cmm", "opportunity_type", "cmm_code"),
        {"extend_existing": True},
    )

    def to_dict(self) -> dict:
        return {
            "opportunity_id": self.opportunity_id,
            "opportunity_type": self.opportunity_type,
            "cmm_code": self.cmm_code,
            "source_cpses": self.source_cpses,
            "material_codes": self.material_codes,
            "trigger_metric": self.trigger_metric,
            "trigger_value": self.trigger_value,
            "threshold": self.threshold,
            "reason": self.reason,
            "evidence_reference": self.evidence_reference,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
