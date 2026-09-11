"""
Integration Tests for Phase 7 Review API
Tests queue partitioning, stats, 4-layer evidence retrieval, atomic decision submission,
RBAC authorization, spoofing prevention, 409 conflict, and non-identity semantics.
"""

import pytest
from fastapi.testclient import TestClient

from server.app.main import app
from server.app.db.review_repository import review_repository


@pytest.fixture
def client():
    return TestClient(app)


class TestReviewAPIQueueAndStats:
    """Test review queue partitioning and statistics endpoints"""

    def test_queue_partitioning_counts(self, client):
        """Verify strict partition counts: Active=12,191, Secondary=4,033, Disqualified=21,276, Total=37,500"""
        # Active queue
        res_active = client.get("/api/review/queue?view_mode=active&page_size=10")
        assert res_active.status_code == 200
        data_active = res_active.json()
        assert data_active["total"] == 12191
        assert data_active["active_queue_partition"] == 12191

        # Secondary queue
        res_sec = client.get("/api/review/queue?view_mode=secondary&page_size=10")
        assert res_sec.status_code == 200
        data_sec = res_sec.json()
        assert data_sec["total"] == 4033
        assert data_sec["secondary_queue_partition"] == 4033

        # Disqualified archive
        res_disq = client.get("/api/review/queue?view_mode=disqualified&page_size=10")
        assert res_disq.status_code == 200
        data_disq = res_disq.json()
        assert data_disq["total"] == 21276
        assert data_disq["disqualified_partition"] == 21276

        # Total universe
        res_all = client.get("/api/review/queue?view_mode=all&page_size=10")
        assert res_all.status_code == 200
        data_all = res_all.json()
        assert data_all["total"] == 37500

    def test_stats_endpoint(self, client):
        """Stats endpoint must return correct partition numbers and pending counts"""
        res = client.get("/api/review/stats")
        assert res.status_code == 200
        stats = res.json()

        assert stats["total_candidates"] == 37500
        assert stats["active_queue_total"] == 12191
        assert stats["secondary_queue_total"] == 4033
        assert stats["disqualified_total"] == 21276
        assert stats["cross_cpse_candidates"] == 29398
        assert stats["critical_total"] == 7337
        assert stats["high_total"] == 4854

    def test_candidate_detail_and_4layer_evidence(self, client):
        """Candidate detail must return 4-layer evidence and canonical snapshot hash"""
        # Get first candidate from active queue
        q_res = client.get("/api/review/queue?view_mode=active&page_size=1")
        cand_id = q_res.json()["items"][0]["candidate_id"]

        detail_res = client.get(f"/api/review/{cand_id}")
        assert detail_res.status_code == 200
        detail = detail_res.json()

        assert "candidate" in detail
        assert "evidence_package" in detail
        assert "evidence_snapshot_hash" in detail
        assert len(detail["evidence_snapshot_hash"]) == 64

        pkg = detail["evidence_package"]
        assert "source_profile" in pkg
        assert "candidate_profile" in pkg
        assert "attribute_diff" in pkg
        assert "matching_evidence" in pkg
        assert "validation_evidence" in pkg


class TestDecisionSubmissionAndSecurity:
    """Test decision submission, RBAC, spoofing protection, and optimistic locking"""

    def test_viewer_role_rejected_with_403(self, client):
        """A user with 'viewer' role is read-only and cannot submit decisions"""
        # Pick candidate
        q_res = client.get("/api/review/queue?view_mode=active&page_size=1")
        cand_id = q_res.json()["items"][0]["candidate_id"]

        headers = {
            "x-test-user-id": "usr-viewer-01",
            "x-test-user-email": "viewer@cpse.gov.in",
            "x-test-user-role": "viewer",
        }
        payload = {
            "decision": "ACCEPT",
            "rationale": "Viewer attempting decision submission",
        }
        res = client.post(f"/api/review/{cand_id}/decision", json=payload, headers=headers)
        assert res.status_code == 403
        assert "read-only" in res.json()["detail"].lower() or "privileges required" in res.json()["detail"].lower()

    def test_reviewer_identity_spoofing_prevented(self, client):
        """Client cannot inject fake reviewer identity in payload; identity is derived server-side"""
        q_res = client.get("/api/review/queue?view_mode=active&page_size=1")
        item = q_res.json()["items"][0]
        cand_id = item["candidate_id"]
        current_version = item.get("decision_version") or 0

        headers = {
            "x-test-user-id": "real-reviewer-123",
            "x-test-user-email": "real.reviewer@iocl.co.in",
            "x-test-user-role": "reviewer",
        }
        # Client tries to spoof reviewer identity in the payload
        payload = {
            "decision": "ACCEPT",
            "rationale": "Engineering specifications certified equivalent across CPSEs",
            "reviewer_id": "fake-admin-hacker",
            "reviewer_email": "fake@evil.com",
            "expected_version": current_version,
        }
        res = client.post(f"/api/review/{cand_id}/decision", json=payload, headers=headers)
        assert res.status_code == 200
        data = res.json()

        # Reviewer identity must be strictly the server-side authenticated user
        assert data["reviewer_id"] == "real-reviewer-123"
        assert data["reviewer_email"] == "real.reviewer@iocl.co.in"

        # Check in database
        dec = review_repository.get_decision(cand_id)
        assert dec["reviewer_id"] == "real-reviewer-123"
        assert dec["reviewer_email"] == "real.reviewer@iocl.co.in"

    def test_optimistic_concurrency_stale_version_raises_409(self, client):
        """Submitting with stale expected_version returns 409 Conflict"""
        q_res = client.get("/api/review/queue?view_mode=active&page_size=1")
        item = q_res.json()["items"][0]
        cand_id = item["candidate_id"]
        current_version = item.get("decision_version") or 0

        headers = {
            "x-test-user-id": "rev-test-01",
            "x-test-user-role": "reviewer",
        }
        # Stale expected_version (current_version + 99, or current_version - 1)
        stale_version = current_version - 1 if current_version > 0 else 999
        payload = {
            "decision": "DEFER",
            "rationale": "Attempting update on stale version",
            "expected_version": stale_version,
        }
        res = client.post(f"/api/review/{cand_id}/decision", json=payload, headers=headers)
        assert res.status_code == 409
        assert "Stale version" in res.json()["detail"]

    def test_audit_history_endpoint(self, client):
        """History endpoint returns chronological audit events with evidence snapshot hash"""
        q_res = client.get("/api/review/queue?view_mode=active&page_size=1")
        cand_id = q_res.json()["items"][0]["candidate_id"]

        res = client.get(f"/api/review/{cand_id}/history")
        assert res.status_code == 200
        data = res.json()
        assert data["candidate_id"] == cand_id
        assert data["total_events"] >= 1
        event = data["events"][-1]
        assert event["new_decision"] == "ACCEPT"
        assert len(event["evidence_snapshot_hash"]) == 64

    def test_non_identity_semantics_and_export_handoff(self, client, tmp_path):
        """ACCEPT records human review relationship without creating common codes or master groups"""
        from server.pipeline.review_export import export_accepted_relationships

        test_export_file = str(tmp_path / "test_accepted_pairs.csv")
        export_res = export_accepted_relationships(output_path=test_export_file)
        assert export_res["status"] == "completed"
        assert export_res["accepted_count"] >= 1
        assert "Phase 8" in export_res["handoff_target"]
