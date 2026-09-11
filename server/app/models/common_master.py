"""
SQLAlchemy ORM models for Phase 8 Common Material Master
Defines the Supabase PostgreSQL schema for common_material_master and common_material_members.
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    Float,
    DateTime,
    CheckConstraint,
    Index,
    ForeignKey,
    JSON,
)
from sqlalchemy.orm import relationship
from app.models.review import Base


class CommonMaterialMaster(Base):
    """
    Common Material Master catalog records.
    Represents a unified, governed material identity across CPSEs.
    """
    __tablename__ = "common_material_master"

    common_material_id = Column(String(64), primary_key=True, index=True)
    common_code = Column(String(64), unique=True, nullable=False, index=True)
    common_description = Column(Text, nullable=False)
    material_family = Column(String(64), nullable=False, index=True)
    material_type = Column(String(64), nullable=True)
    material_grade = Column(String(64), nullable=True)
    nominal_size = Column(String(64), nullable=True)
    pressure_rating = Column(String(64), nullable=True)
    standard_spec = Column(String(128), nullable=True)
    unit_of_measure = Column(String(32), nullable=True)
    consolidated_attributes = Column(JSON, nullable=False)
    cpse_coverage = Column(JSON, nullable=False)  # List of CPSEs e.g. ["IOCL", "ONGC"]
    member_count = Column(Integer, nullable=False)
    governance_status = Column(String(32), nullable=False, index=True)
    group_confidence = Column(Float, nullable=False)
    group_identity_hash = Column(String(64), unique=True, nullable=False, index=True)
    
    # Governance metadata (for human sign-off)
    approved_by = Column(String(128), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approval_rationale = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    members = relationship(
        "CommonMaterialMember",
        back_populates="master",
        cascade="all, delete-orphan",
        order_by="CommonMaterialMember.source_material_code.asc()",
    )

    __table_args__ = (
        CheckConstraint(
            "governance_status IN ('DRAFT_CANDIDATE', 'VERIFIED_HARMONIZED', 'STANDALONE_CANDIDATE', 'AMBIGUOUS_REVIEW_REQUIRED', 'SPLIT_CONFLICT', 'APPROVED_MASTER')",
            name="valid_governance_status_check",
        ),
        Index("idx_cmm_family_status", "material_family", "governance_status"),
    )

    def to_dict(self) -> dict:
        return {
            "common_material_id": self.common_material_id,
            "common_code": self.common_code,
            "common_description": self.common_description,
            "material_family": self.material_family,
            "material_type": self.material_type,
            "material_grade": self.material_grade,
            "nominal_size": self.nominal_size,
            "pressure_rating": self.pressure_rating,
            "standard_spec": self.standard_spec,
            "unit_of_measure": self.unit_of_measure,
            "consolidated_attributes": self.consolidated_attributes,
            "cpse_coverage": self.cpse_coverage,
            "member_count": self.member_count,
            "governance_status": self.governance_status,
            "group_confidence": self.group_confidence,
            "group_identity_hash": self.group_identity_hash,
            "approved_by": self.approved_by,
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
            "approval_rationale": self.approval_rationale,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "members": [m.to_dict() for m in self.members] if self.members else [],
        }


class CommonMaterialMember(Base):
    """
    Provenance and membership linking source CPSE material items to a Common Material Master record.
    """
    __tablename__ = "common_material_members"

    id = Column(String(36), primary_key=True, index=True)
    common_material_id = Column(
        String(64),
        ForeignKey("common_material_master.common_material_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_material_code = Column(String(64), nullable=False, index=True)
    source_cpse = Column(String(32), nullable=False, index=True)
    source_description = Column(Text, nullable=False)
    canonical_material_key = Column(String(256), nullable=False)
    membership_type = Column(String(32), nullable=False)
    accepted_edge_candidate_ids = Column(JSON, nullable=False)  # List of candidate IDs
    reviewer_ids = Column(JSON, nullable=False)  # List of reviewer IDs
    evidence_snapshot_hashes = Column(JSON, nullable=False)  # List of SHA-256 evidence hashes
    
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    master = relationship("CommonMaterialMaster", back_populates="members")

    __table_args__ = (
        CheckConstraint(
            "membership_type IN ('DIRECT_ACCEPTED', 'TRANSITIVE_VERIFIED', 'STANDALONE')",
            name="valid_membership_type_check",
        ),
        Index("idx_cmm_member_cpse_code", "source_cpse", "source_material_code"),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "common_material_id": self.common_material_id,
            "source_material_code": self.source_material_code,
            "source_cpse": self.source_cpse,
            "source_description": self.source_description,
            "canonical_material_key": self.canonical_material_key,
            "membership_type": self.membership_type,
            "accepted_edge_candidate_ids": self.accepted_edge_candidate_ids,
            "reviewer_ids": self.reviewer_ids,
            "evidence_snapshot_hashes": self.evidence_snapshot_hashes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
