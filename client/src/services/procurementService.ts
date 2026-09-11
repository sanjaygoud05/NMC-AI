/**
/**
 * Procurement Intelligence Service (Phase 10)
 * Client service for querying enterprise KPIs, CMM demand summaries,
 * CPSE comparisons, plant distributions, and auditable sourcing opportunities.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface ProcurementKPIs {
  total_materials_analyzed: number;
  total_cmm_entities: number;
  multi_cpse_cmms_count: number;
  standalone_cmms_count: number;
  volume_by_uom: Record<string, number>;
  multi_cpse_volume_by_uom: Record<string, number>;
  active_materials_count: number;
  inactive_materials_count: number;
  active_materials_pct: number;
  distinct_plants_count: number;
  distinct_manufacturers_count: number;
  opportunities_by_type: Record<string, number>;
  total_opportunities_count: number;
  analysis_reference_date: string;
}

export interface ProcurementFactRecord {
  fact_id: string;
  source_cpse: string;
  material_code: string;
  material_description: string;
  cmm_code: string;
  material_category: string;
  material_type?: string;
  unit_of_measure: string;
  plant: string;
  material_status: string;
  annual_consumption: number;
  last_purchase_date?: string;
  manufacturer?: string;
  manufacturer_part_no?: string;
}

export interface CMMProcurementSummaryRecord {
  cmm_code: string;
  common_description: string;
  material_family: string;
  governance_status: string;
  member_count: number;
  cpse_count: number;
  consuming_cpses: string;
  primary_uom: string;
  total_annual_consumption: number;
  avg_consumption_per_member: number;
  plant_count: number;
  dominant_plant: string;
  earliest_purchase_date?: string;
  latest_purchase_date?: string;
  purchase_recency_days?: number;
  active_member_count?: number;
  inactive_member_count?: number;
  unique_manufacturers_count?: number;
  unique_part_numbers_count?: number;
  manufacturer_diversity_flag?: boolean;
  members?: ProcurementFactRecord[];
}

export interface CMMCatalogResponse {
  items: CMMProcurementSummaryRecord[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CPSEProcurementSummaryRecord {
  source_cpse: string;
  total_material_records: number;
  active_material_count: number;
  inactive_material_count: number;
  total_volume_nos: number;
  total_volume_mtr: number;
  total_volume_set: number;
  total_volume_other: number;
  distinct_plants_count: number;
  distinct_manufacturers_count: number;
  multi_cpse_harmonized_members: number;
}

export interface ProcurementOpportunityRecord {
  opportunity_id: string;
  opportunity_type:
    | 'MULTI_CPSE_DEMAND_AGGREGATION'
    | 'HIGH_VOLUME_CONCENTRATION'
    | 'PURCHASE_DORMANCY_SIGNAL'
    | 'MANUFACTURER_DIVERSITY_SIGNAL'
    | string;
  cmm_code: string;
  source_cpses: string;
  material_codes: string;
  trigger_metric: string;
  trigger_value: string;
  threshold: string;
  reason: string;
  evidence_reference: string;
}

export interface OpportunityCatalogResponse {
  items: ProcurementOpportunityRecord[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PlantDistributionRecord {
  plant: string;
  source_cpse: string;
  unit_of_measure: string;
  total_volume: number;
  material_count: number;
}

export const procurementService = {
  /**
   * Fetch enterprise procurement KPIs partitioned by UOM
   */
  async getKPIs(datasetId?: string): Promise<ProcurementKPIs> {
    const token = localStorage.getItem('supabase.auth.token') || '';
    const query = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
    const res = await fetch(`${API_BASE}/api/procurement/kpis${query}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      throw new Error('Failed to fetch procurement KPIs');
    }
    return res.json();
  },

  /**
   * Fetch paginated CMM demand summaries
   */
  async getCMMDemandSummaries(params: {
    search?: string;
    material_family?: string;
    primary_uom?: string;
    cpse?: string;
    min_consumption?: number;
    page?: number;
    page_size?: number;
    dataset_id?: string;
  }): Promise<CMMCatalogResponse> {
    const q = new URLSearchParams();
    if (params.search) q.append('search', params.search);
    if (params.material_family && params.material_family !== 'all') {
      q.append('material_family', params.material_family);
    }
    if (params.primary_uom && params.primary_uom !== 'all') {
      q.append('primary_uom', params.primary_uom);
    }
    if (params.cpse && params.cpse !== 'all') {
      q.append('cpse', params.cpse);
    }
    if (params.dataset_id) {
      q.append('dataset_id', params.dataset_id);
    }
    if (params.min_consumption !== undefined && params.min_consumption > 0) {
      q.append('min_consumption', String(params.min_consumption));
    }
    q.append('page', String(params.page || 1));
    q.append('page_size', String(params.page_size || 20));

    const token = localStorage.getItem('supabase.auth.token') || '';
    const res = await fetch(`${API_BASE}/api/procurement/cmm-summary?${q.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch CMM procurement summaries');
    }
    return res.json();
  },

  /**
   * Fetch single CMM summary with legacy member drill-down
   */
  async getCMMDetail(cmmCode: string): Promise<CMMProcurementSummaryRecord> {
    const token = localStorage.getItem('supabase.auth.token') || '';
    const res = await fetch(`${API_BASE}/api/procurement/cmm-summary/${encodeURIComponent(cmmCode)}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to fetch CMM details for ${cmmCode}`);
    }
    return res.json();
  },

  /**
   * Fetch enterprise CPSE procurement summaries (4 CPSEs)
   */
  async getCPSESummaries(datasetId?: string): Promise<CPSEProcurementSummaryRecord[]> {
    const token = localStorage.getItem('supabase.auth.token') || '';
    const query = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
    const res = await fetch(`${API_BASE}/api/procurement/cpse-summary${query}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      throw new Error('Failed to fetch CPSE procurement summaries');
    }
    return res.json();
  },

  /**
   * Fetch auditable sourcing opportunities with full provenance
   */
  async getOpportunities(params: {
    opportunity_type?: string;
    cmm_code?: string;
    source_cpse?: string;
    page?: number;
    page_size?: number;
  }): Promise<OpportunityCatalogResponse> {
    const q = new URLSearchParams();
    if (params.opportunity_type && params.opportunity_type !== 'all') {
      q.append('opportunity_type', params.opportunity_type);
    }
    if (params.cmm_code) q.append('cmm_code', params.cmm_code);
    if (params.source_cpse && params.source_cpse !== 'all') {
      q.append('source_cpse', params.source_cpse);
    }
    q.append('page', String(params.page || 1));
    q.append('page_size', String(params.page_size || 20));

    const token = localStorage.getItem('supabase.auth.token') || '';
    const res = await fetch(`${API_BASE}/api/procurement/opportunities?${q.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch procurement opportunities');
    }
    return res.json();
  },

  /**
   * Fetch plant distribution partitioned by UOM
   */
  async getPlantDistribution(): Promise<PlantDistributionRecord[]> {
    const token = localStorage.getItem('supabase.auth.token') || '';
    const res = await fetch(`${API_BASE}/api/procurement/plants`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      throw new Error('Failed to fetch plant distribution');
    }
    return res.json();
  },
};
