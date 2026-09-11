"""
Unit Tests for Phase 7 Human Review Workflow
Tests decision state machine, atomic transactions, optimistic locking,
rollback guarantees, evidence snapshot hashing, spoofing prevention, and pending state invariants.
"""

import pytest
from server.services.review_service import review_service, ValidationError
from server.app.db.review_repository import ReviewRepository, StaleVersionError, RepositoryError


@pytest.fixture
def repo():
    """Create an isolated in-memory or test repository"""
    return ReviewRepository("sqlite:///:memory:")


class TestReviewDecisionWorkflow:
    """Test decision state rules, rationale stringency, and hash generation"""

    def test_accept_decision_requires_rationale(self):
        """Empty rationale must be rejected for all decisions"""
        with pytest.raises(ValidationError, match="rationale is mandatory"):
            review_service.validate_decision_input("ACCEPT", "")

        with pytest.raises(ValidationError, match="rationale is mandatory"):
            review_service.validate_decision_input("ACCEPT", "   ")

    def test_reject_and_defer_require_detailed_rationale(self):
        """Reject and Defer decisions require at least 10 characters of technical justification"""
        with pytest.raises(ValidationError, match="at least 10 characters"):
            review_service.validate_decision_input("REJECT", "too short")

        with pytest.raises(ValidationError, match="at least 10 characters"):
            review_service.validate_decision_input("DEFER", "hold")

        # Valid rationale
        review_service.validate_decision_input("REJECT", "Incompatible metallurgy observed between ASTM A105 and SS 316")
        review_service.validate_decision_input("DEFER", "Pending physical drawing and vendor datasheet review")
        review_service.validate_decision_input("ACCEPT", "Verified identical")

    def test_invalid_decision_verdict_rejected(self):
        """Only ACCEPT, REJECT, and DEFER are allowed"""
        with pytest.raises(ValidationError, match="Invalid decision"):
            review_service.validate_decision_input("APPROVE", "Valid length rationale")

        with pytest.raises(ValidationError, match="Invalid decision"):
            review_service.validate_decision_input("MERGE", "Valid length rationale")

    def test_deterministic_evidence_snapshot_hash(self):
        """Identical evidence packages must yield identical SHA256 fingerprints"""
        cand_row = {
            "candidate_id": "CAN-000100",
            "source_cpse": "IOCL",
            "source_material_code": "IOCL-100",
            "candidate_cpse": "ONGC",
            "candidate_material_code": "ONGC-200",
            "embedding_similarity": 0.95,
            "description_similarity": 0.92,
            "attribute_agreement": 0.88,
            "canonical_key_exact": True,
            "validation_status": "VALIDATED_COMPATIBLE",
            "refined_score": 0.92,
            "refined_confidence": "HIGH",
            "review_priority": "HIGH",
            "engineering_conflict_class": "NO_CONFLICT",
            "validation_reason_codes": "EXACT_CANONICAL_KEY;CORE_ATTR_MATCH",
        }
        src_mat = {"Canonical_Material_Family": "VALVE", "Canonical_Material_Type": "BALL VALVE"}
        tgt_mat = {"Canonical_Material_Family": "VALVE", "Canonical_Material_Type": "BALL VALVE"}

        pkg1 = review_service.build_evidence_package(cand_row, src_mat, tgt_mat)
        pkg2 = review_service.build_evidence_package(cand_row, src_mat, tgt_mat)

        hash1 = review_service.compute_canonical_evidence_hash(pkg1)
        hash2 = review_service.compute_canonical_evidence_hash(pkg2)

        assert hash1 == hash2
        assert len(hash1) == 64

        # If any attribute changes, the hash must change
        cand_row_modified = dict(cand_row, refined_score=0.91)
        pkg3 = review_service.build_evidence_package(cand_row_modified, src_mat, tgt_mat)
        hash3 = review_service.compute_canonical_evidence_hash(pkg3)
        assert hash1 != hash3


class TestAtomicTransactionsAndConcurrency:
    """Test atomic transactions, optimistic locking, and rollback guarantees"""

    def test_atomic_decision_and_event_persistence(self, repo):
        """Recording a decision must create both a review_decisions entry and a review_events entry"""
        res = repo.record_decision_atomic(
            candidate_id="CAN-000201",
            source_material_code="IOCL-01",
            candidate_material_code="ONGC-01",
            decision="ACCEPT",
            reviewer_id="rev-01",
            reviewer_email="rev1@cpse.gov.in",
            rationale="Verified equivalent specifications across IOCL and ONGC",
            escalated=False,
            needs_spec_sheet=False,
            evidence_snapshot_hash="a" * 64,
        )
        assert res["version"] == 1

        # Verify current state
        dec = repo.get_decision("CAN-000201")
        assert dec is not None
        assert dec["decision"] == "ACCEPT"
        assert dec["version"] == 1

        # Verify append-only history
        history = repo.get_history("CAN-000201")
        assert len(history) == 1
        assert history[0]["version"] == 1
        assert history[0]["new_decision"] == "ACCEPT"
        assert history[0]["previous_decision"] is None

    def test_transaction_rollback_on_event_failure(self, repo):
        """If event insertion fails, decision update must roll back cleanly with zero orphaned state"""
        with pytest.raises(RepositoryError):
            repo.record_decision_atomic(
                candidate_id="CAN-000202",
                source_material_code="IOCL-02",
                candidate_material_code="ONGC-02",
                decision="ACCEPT",
                reviewer_id="rev-01",
                reviewer_email="rev1@cpse.gov.in",
                rationale="Rollback test rationale",
                escalated=False,
                needs_spec_sheet=False,
                evidence_snapshot_hash="b" * 64,
                force_fail_event=True,  # Triggers rollback
            )

        # Confirm rollback: neither decision nor event must exist
        assert repo.get_decision("CAN-000202") is None
        assert len(repo.get_history("CAN-000202")) == 0

    def test_optimistic_concurrency_stale_version_rejected(self, repo):
        """Concurrent reviewer submissions with stale version must raise StaleVersionError"""
        # Reviewer 1 records initial decision (version 1)
        repo.record_decision_atomic(
            candidate_id="CAN-000203",
            source_material_code="HPCL-03",
            candidate_material_code="BPCL-03",
            decision="DEFER",
            reviewer_id="rev-01",
            reviewer_email="rev1@cpse.gov.in",
            rationale="Initial triage deferred for further analysis",
            escalated=False,
            needs_spec_sheet=False,
            evidence_snapshot_hash="c" * 64,
            expected_version=0,
        )

        dec = repo.get_decision("CAN-000203")
        assert dec["version"] == 1

        # Reviewer 2 tries to update with stale expected_version=0 (conflict!)
        with pytest.raises(StaleVersionError, match="Stale version conflict"):
            repo.record_decision_atomic(
                candidate_id="CAN-000203",
                source_material_code="HPCL-03",
                candidate_material_code="BPCL-03",
                decision="REJECT",
                reviewer_id="rev-02",
                reviewer_email="rev2@cpse.gov.in",
                rationale="Attempted concurrent reject on stale version",
                escalated=False,
                needs_spec_sheet=False,
                evidence_snapshot_hash="c" * 64,
                expected_version=0,  # STALE: current is 1
            )

        # Successful update with correct expected_version=1
        res2 = repo.record_decision_atomic(
            candidate_id="CAN-000203",
            source_material_code="HPCL-03",
            candidate_material_code="BPCL-03",
            decision="ACCEPT",
            reviewer_id="rev-02",
            reviewer_email="rev2@cpse.gov.in",
            rationale="Senior review concluded items are technically compatible",
            escalated=False,
            needs_spec_sheet=False,
            evidence_snapshot_hash="c" * 64,
            expected_version=1,
        )
        assert res2["version"] == 2

        # Verify audit history has 2 chronological events
        history = repo.get_history("CAN-000203")
        assert len(history) == 2
        assert history[0]["version"] == 1
        assert history[0]["new_decision"] == "DEFER"
        assert history[1]["version"] == 2
        assert history[1]["new_decision"] == "ACCEPT"
        assert history[1]["previous_decision"] == "DEFER"

    def test_pending_state_invariant(self, repo):
        """Unreviewed candidate remains in PENDING state with no decisions recorded"""
        dec = repo.get_decision("CAN-UNREVIEWED")
        assert dec is None
        assert len(repo.get_history("CAN-UNREVIEWED")) == 0
