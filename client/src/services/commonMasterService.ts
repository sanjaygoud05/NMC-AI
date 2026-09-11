/**
 * Common Master Service (Phase 8)
 * Client service for querying Common Material Master catalog, stats,
 * detailed member provenance, and human governance updates.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface CommonMaterialMemberDTO {
  id: string;
  common_material_id: string;
  source_material_code: string;
  source_cpse: string;
  source_description: string;
  canonical_material_key: string;
  membership_type: 'DIRECT_ACCEPTED' | 'TRANSITIVE_VERIFIED' | 'STANDALONE';
  accepted_edge_candidate_ids: string[];
  reviewer_ids: string[];
  evidence_snapshot_hashes: string[];
  created_at: string;
}

export interface CommonMaterialRecord {
  common_material_id: string;
  common_code: string;
  common_description: string;
  material_family: string;
  material_type?: string;
  material_grade?: string;
  nominal_size?: string;
  pressure_rating?: string;
  standard_spec?: string;
  unit_of_measure?: string;
  consolidated_attributes: Record<string, string | number | boolean | null>;
  cpse_coverage: string[];
  member_count: number;
  governance_status:
    | 'DRAFT_CANDIDATE'
    | 'VERIFIED_HARMONIZED'
    | 'STANDALONE_CANDIDATE'
    | 'AMBIGUOUS_REVIEW_REQUIRED'
    | 'SPLIT_CONFLICT'
    | 'APPROVED_MASTER';
  group_confidence: number;
  group_identity_hash: string;
  approved_by?: string | null;
  approved_at?: string | null;
  approval_rationale?: string | null;
  created_at: string;
  updated_at: string;
  members: CommonMaterialMemberDTO[];
}

export interface CommonMasterCatalogResponse {
  items: CommonMaterialRecord[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CommonMasterStats {
  total_common_materials: number;
  multi_cpse_harmonized: number;
  standalone_candidates: number;
  verified_harmonized: number;
  approved_master: number;
  ambiguous_review_required: number;
  split_conflict: number;
  total_members_mapped: number;
  unique_families_count: number;
  unique_families: string[];
}

export interface GovernanceUpdateRequest {
  new_status: 'APPROVED_MASTER' | 'VERIFIED_HARMONIZED' | 'AMBIGUOUS_REVIEW_REQUIRED' | 'SPLIT_CONFLICT';
  rationale: string;
}

export const commonMasterService = {
  /**
   * Fetch paginated common material master catalog
   */
  async getCatalog(params: {
    search?: string;
    family?: string;
    governance_status?: string;
    cpse?: string;
    page?: number;
    page_size?: number;
    dataset_id?: string;
  } = {}): Promise<CommonMasterCatalogResponse> {
    const q = new URLSearchParams();
    if (params.search) q.append('search', params.search);
    if (params.family && params.family !== 'all') q.append('family', params.family);
    if (params.governance_status && params.governance_status !== 'all') {
      q.append('governance_status', params.governance_status);
    }
    if (params.cpse && params.cpse !== 'all') q.append('cpse', params.cpse);
    if (params.dataset_id) q.append('dataset_id', params.dataset_id);
    q.append('page', String(params.page || 1));
    q.append('page_size', String(params.page_size || 20));

    const token = localStorage.getItem('supabase.auth.token') || '';
    const res = await fetch(`${API_BASE}/api/common-master?${q.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch common material catalog');
    }
    return res.json();
  },

  /**
   * Fetch catalog summary stats and KPIs
   */
  async getStats(datasetId?: string): Promise<CommonMasterStats> {
    const token = localStorage.getItem('supabase.auth.token') || '';
    const query = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
    const res = await fetch(`${API_BASE}/api/common-master/stats${query}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      throw new Error('Failed to fetch common material master statistics');
    }
    return res.json();
  },

  /**
   * Fetch single common material detail with members
   */
  async getDetail(commonId: string, datasetId?: string): Promise<CommonMaterialRecord> {
    const token = localStorage.getItem('supabase.auth.token') || '';
    const query = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
    const res = await fetch(`${API_BASE}/api/common-master/${encodeURIComponent(commonId)}${query}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch common material details');
    }
    return res.json();
  },

  /**
   * Submit governance status update / sign-off
   */
  async updateGovernanceStatus(
    commonId: string,
    payload: GovernanceUpdateRequest
  ): Promise<CommonMaterialRecord> {
    const token = localStorage.getItem('supabase.auth.token') || '';
    const res = await fetch(`${API_BASE}/api/common-master/${encodeURIComponent(commonId)}/governance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update governance status');
    }
    return res.json();
  },
};
