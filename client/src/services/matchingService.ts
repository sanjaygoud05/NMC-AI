/**
 * Matching Service (Phase 5)
 * Communicates with FastAPI backend for cross-CPSE candidate matches and evidence
 */

import { API_BASE } from './apiConfig';

export interface MatchCandidateRecord {
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
  penalty_applied: number;
  final_match_score: number;
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  candidate_rank: number;
  evidence_summary: string;

  // Enriched humanized fields
  source_title?: string;
  candidate_title?: string;
  category?: string;
  status_tier?: 'Exact' | 'Equivalent' | 'Review' | 'Not match';
  score_percent?: number;
  explainable_summary?: string;
  attributes?: Record<string, { source: string; candidate: string }>;

  // Key canonical attributes (source/canonical)
  material_family_similarity?: number | null;
  material_type_similarity?: number | null;
  material_subtype_similarity?: number | null;
  material_similarity?: number | null;
  material_grade_similarity?: number | null;
  size_similarity?: number | null;
  standard_similarity?: number | null;
  coating_similarity?: number | null;
}

export interface MatchingReport {
  phase: string;
  dataset: {
    input_rows: number;
    unique_material_codes: number;
    input_sha256: string;
    output_sha256: string;
  };
  performance: {
    naive_all_pairs: number;
    blocked_candidate_pairs: number;
    blocking_reduction_ratio_percent: number;
    retained_candidate_pairs: number;
    average_candidates_per_material: number;
    embedding_time_seconds: number;
    blocking_time_seconds: number;
    scoring_time_seconds: number;
    total_runtime_seconds: number;
  };
  embedding: {
    embedding_method: string;
    embedding_model: string;
    embedding_dimension: number;
    fallback_used: boolean;
    input_sha256: string;
  };
  candidate_summary: {
    total_candidates: number;
    cross_cpse_candidates: number;
    same_cpse_candidates: number;
    high_confidence_candidates: number;
    medium_confidence_candidates: number;
    low_confidence_candidates: number;
    exact_canonical_key_candidates: number;
    engineering_incompatibilities: number;
  };
  cpse_distribution: Record<string, number>;
  benchmark_examples: Array<{
    category: string;
    source_material_code: string;
    source_cpse: string;
    candidate_material_code: string;
    candidate_cpse: string;
    final_match_score: number;
    confidence_level: string;
    evidence_summary: string;
  }>;
  immutability: {
    raw_dataset_hash_before: string;
    raw_dataset_hash_after: string;
    raw_dataset_unchanged: boolean;
  };
}

export interface MatchesResponse {
  matches: MatchCandidateRecord[];
  total: number;
  skip: number;
  limit: number;
  categories?: string[];
}

export const matchingService = {
  async getMatchingReport(datasetId?: string): Promise<MatchingReport> {
    const q = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
    const res = await fetch(`${API_BASE}/api/matches/report${q}`);
    if (!res.ok) {
      throw new Error(`Failed to load matching report: ${res.statusText}`);
    }
    return await res.json();
  },

  async getMatches(params?: {
    skip?: number;
    limit?: number;
    source_cpse?: string;
    candidate_cpse?: string;
    confidence_level?: string;
    category?: string;
    status_filter?: string;
    cross_cpse_only?: boolean;
    exact_key_only?: boolean;
    incompatible_only?: boolean;
    search?: string;
    dataset_id?: string;
  }): Promise<MatchesResponse> {
    const query = new URLSearchParams();
    if (params?.skip !== undefined) query.set('skip', params.skip.toString());
    if (params?.limit !== undefined) query.set('limit', params.limit.toString());
    if (params?.source_cpse && params.source_cpse !== 'all') query.set('source_cpse', params.source_cpse);
    if (params?.candidate_cpse && params.candidate_cpse !== 'all') query.set('candidate_cpse', params.candidate_cpse);
    if (params?.confidence_level && params.confidence_level !== 'all') query.set('confidence_level', params.confidence_level);
    if (params?.category && params.category !== 'all') query.set('category', params.category);
    if (params?.status_filter && params.status_filter !== 'all') query.set('status_filter', params.status_filter);
    if (params?.cross_cpse_only) query.set('cross_cpse_only', 'true');
    if (params?.exact_key_only) query.set('exact_key_only', 'true');
    if (params?.incompatible_only) query.set('incompatible_only', 'true');
    if (params?.search) query.set('search', params.search);
    if (params?.dataset_id) query.set('dataset_id', params.dataset_id);

    const res = await fetch(`${API_BASE}/api/matches?${query.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch matches: ${res.statusText}`);
    }
    return await res.json();
  },

  async getMatchDetail(candidateId: string, datasetId?: string): Promise<{
    candidate: MatchCandidateRecord;
    attribute_breakdown: Record<string, { similarity: number | null }>;
  }> {
    const query = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
    const res = await fetch(`${API_BASE}/api/matches/${candidateId}${query}`);
    if (!res.ok) {
      throw new Error(`Failed to load candidate details: ${res.statusText}`);
    }
    return await res.json();
  },

  async getMatchById(id: string, datasetId?: string): Promise<MatchCandidateRecord | null> {
    if (!datasetId || datasetId === 'NONE') return null;
    try {
      const query = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
      const res = await fetch(`${API_BASE}/api/matches/${encodeURIComponent(id)}${query}`);
      if (res.ok) {
        const data = await res.json();
        return data.candidate || data;
      }
    } catch {
      // Backend unavailable - return null
    }
    return null;
  },

  async triggerMatching(): Promise<Record<string, unknown>> {
    const res = await fetch(`${API_BASE}/api/matches/run`, { method: 'POST' });
    if (!res.ok) {
      throw new Error(`Failed to run matching pipeline: ${res.statusText}`);
    }
    return await res.json();
  },
};