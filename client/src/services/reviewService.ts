/**
 * Review Service (Phase 7)
 * Client service for human review queue, 4-layer evidence packages,
 * atomic decision submission, and append-only audit history.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface ValidatedCandidateRecord {
  candidate_id: string;
  source_material_code: string;
  source_cpse: string;
  candidate_material_code: string;
  candidate_cpse: string;
  source_canonical_key: string;
  candidate_canonical_key: string;
  canonical_key_exact: boolean;
  description_similarity: number;
  embedding_similarity: number;
  attribute_agreement: number;
  evaluated_attribute_count: number;
  blocking_strategies: string;
  conflict_present: boolean;
  conflict_details: string | null;
  engineering_conflict_class: 'NO_CONFLICT' | 'REPRESENTATION_DIFFERENCE' | 'SOFT_ENGINEERING_DIFFERENCE' | 'HARD_INCOMPATIBLE';
  engineering_incompatibility: boolean;
  final_match_score: number;
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  candidate_rank: number;
  validation_status: 'VALIDATED_COMPATIBLE' | 'PROBABLE_COMPATIBLE' | 'REVIEW_REQUIRED' | 'ENGINEERING_INCOMPATIBLE' | 'INSUFFICIENT_EVIDENCE';
  validation_reason_codes: string;
  refined_score: number;
  refined_confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  review_priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  validation_evidence: string;
  upstream_conflict_present: boolean;
  upstream_conflict_details: string | null;
  upstream_conflict_preserved: boolean;

  // Human Review Overlays
  human_decision: 'PENDING' | 'ACCEPT' | 'REJECT' | 'DEFER';
  human_rationale: string | null;
  human_reviewer_id: string | null;
  human_reviewer_email: string | null;
  human_reviewed_at: string | null;
  decision_version: number;
  escalated: boolean;
  needs_spec_sheet: boolean;
}

export interface ReviewStats {
  total_candidates: number;
  active_queue_total: number;
  secondary_queue_total: number;
  disqualified_total: number;
  pending_active: number;
  critical_total: number;
  critical_pending: number;
  high_total: number;
  high_pending: number;
  total_reviewed: number;
  accepted: number;
  rejected: number;
  deferred: number;
  escalated: number;
  acceptance_rate: number;
  cross_cpse_candidates: number;
}

export interface ReviewQueueResponse {
  items: ValidatedCandidateRecord[];
  total: number;
  page: number;
  page_size: number;
  view_mode: 'active' | 'secondary' | 'disqualified' | 'all';
  active_queue_partition: number;
  secondary_queue_partition: number;
  disqualified_partition: number;
  total_candidate_universe: number;
}

export interface AttributeDiffItem {
  source: string | null;
  candidate: string | null;
  similarity: number | null;
  status: 'MATCH' | 'DIFF' | 'PARTIAL' | 'NEUTRAL';
}

export interface EvidencePackage {
  candidate_id: string;
  source_profile: {
    cpse: string;
    material_code: string;
    raw_description: string;
    standardized_description: string;
    canonical_material_key: string;
    material_family: string;
    material_type: string;
    plant: string;
    manufacturer: string;
    manufacturer_part_no: string;
    unit: string;
    attributes: Record<string, string>;
  };
  candidate_profile: {
    cpse: string;
    material_code: string;
    raw_description: string;
    standardized_description: string;
    canonical_material_key: string;
    material_family: string;
    material_type: string;
    plant: string;
    manufacturer: string;
    manufacturer_part_no: string;
    unit: string;
    attributes: Record<string, string>;
  };
  attribute_diff: Record<string, AttributeDiffItem>;
  matching_evidence: {
    embedding_similarity: number;
    description_similarity: number;
    attribute_agreement: number;
    canonical_key_exact: boolean;
    blocking_strategies: string;
    candidate_rank: number;
    phase5_score: number;
  };
  validation_evidence: {
    validation_status: string;
    refined_score: number;
    refined_confidence: string;
    review_priority: string;
    engineering_conflict_class: string;
    validation_reason_codes: string[];
    upstream_conflict_present: boolean;
    upstream_conflict_details: string;
    upstream_conflict_preserved: boolean;
    evidence_summary: string;
  };
}

export interface ReviewEventRecord {
  event_id: string;
  candidate_id: string;
  version: number;
  previous_decision: string | null;
  new_decision: 'ACCEPT' | 'REJECT' | 'DEFER';
  reviewer_id: string;
  reviewer_email: string;
  rationale: string;
  escalated: boolean;
  needs_spec_sheet: boolean;
  evidence_snapshot_hash: string;
  created_at: string;
}

export const reviewService = {
  async getReviewStats(): Promise<ReviewStats> {
    const res = await fetch(`${API_BASE}/api/review/stats`);
    if (!res.ok) {
      throw new Error(`Failed to load review stats: ${res.statusText}`);
    }
    return await res.json();
  },

  async getReviewQueue(params?: {
    page?: number;
    page_size?: number;
    view_mode?: 'active' | 'secondary' | 'disqualified' | 'all';
    status?: string;
    priority?: string;
    decision_filter?: string;
    source_cpse?: string;
    candidate_cpse?: string;
    cross_cpse_only?: boolean;
    search?: string;
  }): Promise<ReviewQueueResponse> {
    const query = new URLSearchParams();
    if (params?.page !== undefined) query.set('page', params.page.toString());
    if (params?.page_size !== undefined) query.set('page_size', params.page_size.toString());
    if (params?.view_mode) query.set('view_mode', params.view_mode);
    if (params?.status && params.status !== 'all') query.set('status', params.status);
    if (params?.priority && params.priority !== 'all') query.set('priority', params.priority);
    if (params?.decision_filter && params.decision_filter !== 'all') query.set('decision_filter', params.decision_filter);
    if (params?.source_cpse && params.source_cpse !== 'all') query.set('source_cpse', params.source_cpse);
    if (params?.candidate_cpse && params.candidate_cpse !== 'all') query.set('candidate_cpse', params.candidate_cpse);
    if (params?.cross_cpse_only) query.set('cross_cpse_only', 'true');
    if (params?.search) query.set('search', params.search);

    const res = await fetch(`${API_BASE}/api/review/queue?${query.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch review queue: ${res.statusText}`);
    }
    return await res.json();
  },

  async getReviewDetail(candidateId: string): Promise<{
    candidate: ValidatedCandidateRecord;
    evidence_package: EvidencePackage;
    evidence_snapshot_hash: string;
    current_decision: Record<string, unknown> | null;
    history_count: number;
    is_read_only: boolean;
  }> {
    const res = await fetch(`${API_BASE}/api/review/${candidateId}`);
    if (!res.ok) {
      throw new Error(`Failed to load review candidate details: ${res.statusText}`);
    }
    return await res.json();
  },

  async submitDecision(
    candidateId: string,
    payload: {
      decision: 'ACCEPT' | 'REJECT' | 'DEFER';
      rationale: string;
      escalated?: boolean;
      needs_spec_sheet?: boolean;
      expected_version?: number;
    }
  ): Promise<Record<string, unknown>> {
    const res = await fetch(`${API_BASE}/api/review/${candidateId}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.detail || `Failed to submit review decision (${res.status})`);
    }
    return await res.json();
  },

  async getReviewHistory(candidateId: string): Promise<{
    candidate_id: string;
    events: ReviewEventRecord[];
    total_events: number;
  }> {
    const res = await fetch(`${API_BASE}/api/review/${candidateId}/history`);
    if (!res.ok) {
      throw new Error(`Failed to load review history: ${res.statusText}`);
    }
    return await res.json();
  },
};