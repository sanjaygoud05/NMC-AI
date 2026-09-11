"""
SQLAlchemy ORM models for Phase 7 Human Review
Defines the Supabase PostgreSQL schema for review_decisions and review_events.
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    Boolean,
    DateTime,
    CheckConstraint,
    Index,
)
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class ReviewDecision(Base):
    """
    Current-state table for candidate review decisions.
    Each candidate has at most one current decision row.
    """
    __tablename__ = "review_decisions"

    candidate_id = Column(String(64), primary_key=True, index=True)
    source_material_code = Column(String(64), nullable=False, index=True)
    candidate_material_code = Column(String(64), nullable=False, index=True)
    decision = Column(String(20), nullable=False)
    reviewer_id = Column(String(64), nullable=False)
    reviewer_email = Column(String(255), nullable=False)
    rationale = Column(Text, nullable=False)
    escalated = Column(Boolean, default=False, nullable=False)
    needs_spec_sheet = Column(Boolean, default=False, nullable=False)
    version = Column(Integer, default=1, nullable=False)
    evidence_snapshot_hash = Column(String(64), nullable=False)
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
        CheckConstraint("decision IN ('ACCEPT', 'REJECT', 'DEFER')", name="valid_decision_check"),
        Index("idx_review_decisions_decision", "decision"),
    )

    def to_dict(self) -> dict:
        return {
            "candidate_id": self.candidate_id,
            "source_material_code": self.source_material_code,
            "candidate_material_code": self.candidate_material_code,
            "decision": self.decision,
            "reviewer_id": self.reviewer_id,
            "reviewer_email": self.reviewer_email,
            "rationale": self.rationale,
            "escalated": self.escalated,
            "needs_spec_sheet": self.needs_spec_sheet,
            "version": self.version,
            "evidence_snapshot_hash": self.evidence_snapshot_hash,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ReviewEvent(Base):
    """
    Append-only audit log table.
    Captures every human decision event with complete evidence snapshot hash and versioning.
    """
    __tablename__ = "review_events"

    event_id = Column(String(64), primary_key=True)
    candidate_id = Column(String(64), nullable=False, index=True)
    version = Column(Integer, nullable=False)
    previous_decision = Column(String(20), nullable=True)
    new_decision = Column(String(20), nullable=False)
    reviewer_id = Column(String(64), nullable=False)
    reviewer_email = Column(String(255), nullable=False)
    rationale = Column(Text, nullable=False)
    escalated = Column(Boolean, default=False, nullable=False)
    needs_spec_sheet = Column(Boolean, default=False, nullable=False)
    evidence_snapshot_hash = Column(String(64), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint("new_decision IN ('ACCEPT', 'REJECT', 'DEFER')", name="valid_new_decision_check"),
        Index("idx_review_events_candidate_version", "candidate_id", "version"),
    )

    def to_dict(self) -> dict:
        return {
            "event_id": self.event_id,
            "candidate_id": self.candidate_id,
            "version": self.version,
            "previous_decision": self.previous_decision,
            "new_decision": self.new_decision,
            "reviewer_id": self.reviewer_id,
            "reviewer_email": self.reviewer_email,
            "rationale": self.rationale,
            "escalated": self.escalated,
            "needs_spec_sheet": self.needs_spec_sheet,
            "evidence_snapshot_hash": self.evidence_snapshot_hash,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
