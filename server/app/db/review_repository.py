"""
Review Repository (Phase 7)
Handles transactional persistence to Supabase PostgreSQL for review_decisions and review_events.
Guarantees atomic transactions, optimistic concurrency control, rollback on failure,
and append-only audit event logging.
"""

import os
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.models.review import Base, ReviewDecision, ReviewEvent


class StaleVersionError(Exception):
    """Raised when an update fails due to optimistic concurrency version mismatch"""
    pass


class RepositoryError(Exception):
    """General repository failure"""
    pass


class ReviewRepository:
    """
    Repository for Phase 7 human review decisions and audit events.
    Supports atomic multi-table commits and optimistic locking.
    """

    def __init__(self, db_url: Optional[str] = None):
        if db_url is None:
            # Check environment or configuration
            env_url = os.environ.get("DATABASE_URL")
            if env_url:
                db_url = env_url
            else:
                # Default to transactional local SQLite for isolated execution and tests
                data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "data"))
                os.makedirs(data_dir, exist_ok=True)
                db_path = os.path.join(data_dir, "review_store.db")
                db_url = f"sqlite:///{db_path}"

        self.db_url = db_url
        self.engine = create_engine(
            self.db_url,
            echo=False,
            future=True,
            connect_args={"check_same_thread": False} if "sqlite" in self.db_url else {}
        )
        self.SessionLocal = sessionmaker(bind=self.engine, autoflush=False, autocommit=False, expire_on_commit=False)
        self._init_db()

    def _init_db(self):
        """Create database tables if they do not exist"""
        Base.metadata.create_all(bind=self.engine)

    def get_session(self) -> Session:
        """Get a new database session"""
        return self.SessionLocal()

    def get_decision(self, candidate_id: str) -> Optional[Dict[str, Any]]:
        """Get current decision for a candidate"""
        with self.get_session() as session:
            stmt = select(ReviewDecision).where(ReviewDecision.candidate_id == candidate_id)
            row = session.execute(stmt).scalar_one_or_none()
            return row.to_dict() if row else None

    def get_all_decisions(self) -> Dict[str, Dict[str, Any]]:
        """Get all decisions indexed by candidate_id"""
        with self.get_session() as session:
            stmt = select(ReviewDecision)
            rows = session.execute(stmt).scalars().all()
            return {r.candidate_id: r.to_dict() for r in rows}

    def get_history(self, candidate_id: str) -> List[Dict[str, Any]]:
        """Get append-only audit event history for a candidate, ordered chronologically"""
        with self.get_session() as session:
            stmt = (
                select(ReviewEvent)
                .where(ReviewEvent.candidate_id == candidate_id)
                .order_by(ReviewEvent.version.asc(), ReviewEvent.created_at.asc())
            )
            rows = session.execute(stmt).scalars().all()
            return [r.to_dict() for r in rows]

    def record_decision_atomic(
        self,
        candidate_id: str,
        source_material_code: str,
        candidate_material_code: str,
        decision: str,
        reviewer_id: str,
        reviewer_email: str,
        rationale: str,
        escalated: bool,
        needs_spec_sheet: bool,
        evidence_snapshot_hash: str,
        expected_version: Optional[int] = None,
        force_fail_event: bool = False,  # For rollback testing
    ) -> Dict[str, Any]:
        """
        Record a human review decision in one single atomic transaction:
        1. Checks optimistic concurrency version.
        2. Upserts review_decisions.
        3. Appends immutable event to review_events.
        Rolls back both if either fails.
        """
        with self.get_session() as session:
            try:
                # 1. Optimistic locking / version check
                stmt = select(ReviewDecision).where(ReviewDecision.candidate_id == candidate_id)
                current = session.execute(stmt).scalar_one_or_none()

                current_version = current.version if current else 0
                previous_decision = current.decision if current else None

                if expected_version is not None and expected_version != current_version:
                    raise StaleVersionError(
                        f"Stale version conflict: expected version {expected_version} "
                        f"but current candidate version is {current_version}"
                    )

                new_version = current_version + 1
                now = datetime.now(timezone.utc)

                # 2. Upsert review_decisions
                if current:
                    current.decision = decision
                    current.reviewer_id = reviewer_id
                    current.reviewer_email = reviewer_email
                    current.rationale = rationale
                    current.escalated = escalated
                    current.needs_spec_sheet = needs_spec_sheet
                    current.version = new_version
                    current.evidence_snapshot_hash = evidence_snapshot_hash
                    current.updated_at = now
                    decision_obj = current
                else:
                    decision_obj = ReviewDecision(
                        candidate_id=candidate_id,
                        source_material_code=source_material_code,
                        candidate_material_code=candidate_material_code,
                        decision=decision,
                        reviewer_id=reviewer_id,
                        reviewer_email=reviewer_email,
                        rationale=rationale,
                        escalated=escalated,
                        needs_spec_sheet=needs_spec_sheet,
                        version=new_version,
                        evidence_snapshot_hash=evidence_snapshot_hash,
                        created_at=now,
                        updated_at=now,
                    )
                    session.add(decision_obj)

                # 3. Simulate failure if requested (for rollback test)
                if force_fail_event:
                    raise IntegrityError("Simulated event failure for transaction rollback test", params=None, orig=None)

                # 4. Append immutable event to review_events
                event_id = str(uuid.uuid4())
                event_obj = ReviewEvent(
                    event_id=event_id,
                    candidate_id=candidate_id,
                    version=new_version,
                    previous_decision=previous_decision,
                    new_decision=decision,
                    reviewer_id=reviewer_id,
                    reviewer_email=reviewer_email,
                    rationale=rationale,
                    escalated=escalated,
                    needs_spec_sheet=needs_spec_sheet,
                    evidence_snapshot_hash=evidence_snapshot_hash,
                    created_at=now,
                )
                session.add(event_obj)

                # Commit atomic transaction
                session.commit()

                return {
                    "candidate_id": candidate_id,
                    "decision": decision,
                    "version": new_version,
                    "event_id": event_id,
                    "evidence_snapshot_hash": evidence_snapshot_hash,
                    "updated_at": now.isoformat(),
                }

            except StaleVersionError:
                session.rollback()
                raise
            except Exception as e:
                session.rollback()
                raise RepositoryError(f"Atomic decision transaction failed: {str(e)}") from e

    def get_stats(self) -> Dict[str, Any]:
        """Aggregate counts of decisions"""
        with self.get_session() as session:
            total_decisions = session.query(func.count(ReviewDecision.candidate_id)).scalar() or 0
            accepted = session.query(func.count(ReviewDecision.candidate_id)).filter(ReviewDecision.decision == "ACCEPT").scalar() or 0
            rejected = session.query(func.count(ReviewDecision.candidate_id)).filter(ReviewDecision.decision == "REJECT").scalar() or 0
            deferred = session.query(func.count(ReviewDecision.candidate_id)).filter(ReviewDecision.decision == "DEFER").scalar() or 0
            escalated = session.query(func.count(ReviewDecision.candidate_id)).filter(ReviewDecision.escalated.is_(True)).scalar() or 0

            return {
                "total_reviewed": total_decisions,
                "accepted": accepted,
                "rejected": rejected,
                "deferred": deferred,
                "escalated": escalated,
            }

    def get_accepted_pairs(self) -> List[Dict[str, Any]]:
        """Get all ACCEPTED candidate records for Phase 8 handoff"""
        with self.get_session() as session:
            stmt = select(ReviewDecision).where(ReviewDecision.decision == "ACCEPT")
            rows = session.execute(stmt).scalars().all()
            return [r.to_dict() for r in rows]


# Global instance
review_repository = ReviewRepository()
