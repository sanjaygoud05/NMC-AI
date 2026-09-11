/**
 * Legacy Mapping Service (Phase 9)
 * Client service for querying legacy material cross-walk mappings,
 * stats, single material lookups, and reverse lookups by CMM code.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface LegacyMaterialMappingRecord {
  mapping_id: string;
  source_cpse: string;
  material_code: string;
  source_description: string;
  cmm_code: string | null;
  cmm_group_id: string | null;
  mapping_status:
    | 'MAPPED_VERIFIED'
    | 'MAPPED_STANDALONE'
    | 'REVIEW_REQUIRED'
    | 'CONFLICT'
    | 'UNMAPPED';
  membership_type: 'DIRECT_ACCEPTED' | 'TRANSITIVE_VERIFIED' | 'STANDALONE' | 'NONE';
  confidence_score: number;
  confidence_semantics:
    | 'VERIFIED_CROSS_CPSE'
    | 'STANDALONE_IDENTITY'
    | 'TRANSITIVE_VERIFIED'
    | 'REVIEW_REQUIRED'
    | 'CONFLICT'
    | 'UNMAPPED';
  mapping_method: string;
  mapping_reason: string;
  accepted_candidate_id: string | null;
  phase6_validation_status: string | null;
  phase7_review_decision: string | null;
  evidence_hash: string | null;
  canonical_material_key: string;
  created_at: string;
  updated_at: string;
}

export interface LegacyMappingCatalogResponse {
  items: LegacyMaterialMappingRecord[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface LegacyMappingStats {
  total_source_materials: number;
  total_mappings: number;
  mapped_verified: number;
  mapped_standalone: number;
  review_required: number;
  conflict: number;
  unmapped: number;
  cpse_distribution: Record<string, number>;
  mapping_coverage_pct: number;
}

export const legacyMappingService = {
  /**
   * Fetch paginated legacy material cross-walk mappings
   */
  async getCatalog(params: {
    search?: string;
    source_cpse?: string;
    mapping_status?: string;
    confidence_semantics?: string;
    cmm_code?: string;
    page?: number;
    page_size?: number;
  }): Promise<LegacyMappingCatalogResponse> {
    const q = new URLSearchParams();
    if (params.search) q.append('search', params.search);
    if (params.source_cpse && params.source_cpse !== 'all') q.append('source_cpse', params.source_cpse);
    if (params.mapping_status && params.mapping_status !== 'all') {
      q.append('mapping_status', params.mapping_status);
    }
    if (params.confidence_semantics && params.confidence_semantics !== 'all') {
      q.append('confidence_semantics', params.confidence_semantics);
    }
    if (params.cmm_code) q.append('cmm_code', params.cmm_code);
    q.append('page', String(params.page || 1));
    q.append('page_size', String(params.page_size || 20));

    const token = localStorage.getItem('supabase.auth.token') || '';
    const res = await fetch(`${API_BASE}/api/legacy-mapping?${q.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch legacy material mappings');
    }
    return res.json();
  },

  /**
   * Fetch legacy mapping summary stats and KPIs
   */
  async getStats(): Promise<LegacyMappingStats> {
    const token = localStorage.getItem('supabase.auth.token') || '';
    const res = await fetch(`${API_BASE}/api/legacy-mapping/stats`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      throw new Error('Failed to fetch legacy mapping statistics');
    }
    return res.json();
  },

  /**
   * Fetch single legacy mapping record with full provenance
   */
  async getDetail(sourceCpse: string, materialCode: string): Promise<LegacyMaterialMappingRecord> {
    const token = localStorage.getItem('supabase.auth.token') || '';
    const res = await fetch(
      `${API_BASE}/api/legacy-mapping/${encodeURIComponent(sourceCpse)}/${encodeURIComponent(materialCode)}`,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch legacy mapping detail');
    }
    return res.json();
  },

  /**
   * List all legacy CPSE materials mapped to a given CMM code
   */
  async getByCmmCode(cmmCode: string): Promise<LegacyMaterialMappingRecord[]> {
    const token = localStorage.getItem('supabase.auth.token') || '';
    const res = await fetch(`${API_BASE}/api/legacy-mapping/by-cmm/${encodeURIComponent(cmmCode)}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      throw new Error('Failed to fetch materials for CMM code');
    }
    return res.json();
  },
};
