"""
SQLAlchemy ORM models for Phase 9 Legacy Mapping
Defines the schema for legacy_material_mappings with natural composite uniqueness
on (source_cpse, material_code), foreign key to common_material_master.common_code,
and conditional integrity constraints for nullable cmm_code.
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Text,
    Float,
    DateTime,
    CheckConstraint,
    Index,
    UniqueConstraint,
    ForeignKey,
)
from app.models.review import Base


class LegacyMaterialMapping(Base):
    """
    Legacy Material Mapping entity.
    Cross-walk connecting legacy CPSE (source_cpse, material_code) pairs
    to governed Phase 8 Common Material Master (CMM) codes.
    """
    __tablename__ = "legacy_material_mappings"

    mapping_id = Column(String(64), primary_key=True, index=True)
    source_cpse = Column(String(32), nullable=False, index=True)
    material_code = Column(String(64), nullable=False, index=True)
    source_description = Column(Text, nullable=False)
    cmm_code = Column(
        String(64),
        ForeignKey("common_material_master.common_code", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    cmm_group_id = Column(String(64), nullable=True, index=True)
    mapping_status = Column(String(32), nullable=False, index=True)
    membership_type = Column(String(32), nullable=False)
    confidence_score = Column(Float, nullable=False)
    confidence_semantics = Column(String(32), nullable=False, index=True)
    mapping_method = Column(String(64), nullable=False)
    mapping_reason = Column(Text, nullable=False)
    accepted_candidate_id = Column(String(64), nullable=True)
    phase6_validation_status = Column(String(32), nullable=True)
    phase7_review_decision = Column(String(20), nullable=True)
    evidence_hash = Column(String(64), nullable=True)
    canonical_material_key = Column(String(256), nullable=False)

    # Operational timestamps (quarantined to DB; never exported to deterministic CSV)
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

    __table_args__ = (
        # Natural composite uniqueness constraint: (source_cpse, material_code)
        UniqueConstraint("source_cpse", "material_code", name="uq_legacy_mapping_cpse_material_code"),
        
        # Mapping status domain check
        CheckConstraint(
            "mapping_status IN ('MAPPED_VERIFIED', 'MAPPED_STANDALONE', 'REVIEW_REQUIRED', 'CONFLICT', 'UNMAPPED')",
            name="valid_mapping_status_check",
        ),

        # Confidence semantics domain check
        CheckConstraint(
            "confidence_semantics IN ('VERIFIED_CROSS_CPSE', 'STANDALONE_IDENTITY', 'TRANSITIVE_VERIFIED', 'REVIEW_REQUIRED', 'CONFLICT', 'UNMAPPED')",
            name="valid_confidence_semantics_check",
        ),

        # Conditional CMM code integrity check:
        # - MAPPED_VERIFIED and MAPPED_STANDALONE must have cmm_code NOT NULL
        # - UNMAPPED must have cmm_code NULL
        # - REVIEW_REQUIRED and CONFLICT may have cmm_code populated or NULL
        CheckConstraint(
            "((mapping_status IN ('MAPPED_VERIFIED', 'MAPPED_STANDALONE') AND cmm_code IS NOT NULL) OR "
            "(mapping_status = 'UNMAPPED' AND cmm_code IS NULL) OR "
            "(mapping_status IN ('REVIEW_REQUIRED', 'CONFLICT')))",
            name="conditional_cmm_code_integrity_check",
        ),

        Index("idx_legacy_mapping_cpse_status", "source_cpse", "mapping_status"),
        Index("idx_legacy_mapping_cmm_code", "cmm_code"),
        {"extend_existing": True},
    )

    def to_dict(self) -> dict:
        return {
            "mapping_id": self.mapping_id,
            "source_cpse": self.source_cpse,
            "material_code": self.material_code,
            "source_description": self.source_description,
            "raw_material_name": self.source_description,
            "cmm_code": self.cmm_code,
            "cmm_group_id": self.cmm_group_id,
            "mapping_status": self.mapping_status,
            "membership_type": self.membership_type,
            "confidence_score": self.confidence_score,
            "confidence_semantics": self.confidence_semantics,
            "mapping_method": self.mapping_method,
            "mapping_reason": self.mapping_reason,
            "accepted_candidate_id": self.accepted_candidate_id,
            "phase6_validation_status": self.phase6_validation_status,
            "phase7_review_decision": self.phase7_review_decision,
            "evidence_hash": self.evidence_hash,
            "canonical_material_key": self.canonical_material_key,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
