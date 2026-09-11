/**
 * Dashboard Service
 * Abstracts API communication for dashboard metrics and analytics
 */

import type { DashboardMetrics, DataQualityMetrics, MaterialStats } from '@/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface ColumnProfile {
  null_percentage?: number;
}

interface CPSEInfo {
  record_count: number;
}

export const dashboardService = {
  async getDashboardMetrics(datasetId?: string): Promise<DashboardMetrics | null> {
    if (!datasetId || datasetId === 'NONE') return null;
    try {
      const query = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
      const res = await fetch(`${API_BASE}/api/analytics/dashboard${query}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const d = await res.json();
      if (!d.has_dataset || !d.data_available) return null;
      return {
        totalMaterials: d.total_materials,
        totalCPSEs: d.total_cpse,
        standardizedMaterials: d.standardized_materials,
        harmonizedGroups: d.harmonized_groups,
        pendingReviews: d.pending_reviews,
        highConfidenceMatches: d.high_confidence_matches,
        duplicateCandidates: d.duplicate_candidates,
        dataQualityScore: Math.round(d.data_quality_score),
        processingProgress: d.processing_progress,
      };
    } catch (err) {
      console.error('[dashboardService] getDashboardMetrics failed:', err);
      return null;
    }
  },

  async getDataQualityMetrics(datasetId?: string): Promise<DataQualityMetrics | null> {
    if (!datasetId || datasetId === 'NONE') return null;
    try {
      const query = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
      const res = await fetch(`${API_BASE}/api/analytics/data-quality${query}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const d = await res.json();
      if (!d.has_dataset || !d.data_available) return null;
      const dims = d.quality_scoring?.dimensions || {};
      
      let fieldQuality: any[] = [];
      if (Array.isArray(d.column_profiles)) {
        fieldQuality = d.column_profiles.map((p: any) => ({
          field: p.column_name || 'Column',
          dataType: p.data_type || 'string',
          completeness: Math.round(100 - (p.null_percentage || 0)),
          validity: Math.round(100 - (p.null_percentage || 0) * 0.5),
          consistency: 90,
          uniqueCount: p.unique_count || 0,
          status: (p.null_percentage || 0) > 20 ? 'Needs Attention' : (p.null_percentage || 0) > 5 ? 'Fair' : 'Healthy',
        }));
      } else if (typeof d.column_profiles === 'object' && d.column_profiles !== null) {
        fieldQuality = Object.entries(d.column_profiles).map(([col, prof]: [string, any]) => ({
          field: col,
          dataType: prof.data_type || 'string',
          completeness: Math.round(100 - (prof.null_percentage || 0)),
          validity: Math.round(100 - (prof.null_percentage || 0) * 0.5),
          consistency: 90,
          uniqueCount: prof.unique_count || 0,
          status: (prof.null_percentage || 0) > 20 ? 'Needs Attention' : (prof.null_percentage || 0) > 5 ? 'Fair' : 'Healthy',
        }));
      }

      return {
        overallScore: Math.round(d.data_quality_score ?? 0),
        completeness: Math.round(dims.completeness?.score ?? 0),
        validity: Math.round(dims.validity?.score ?? 0),
        consistency: Math.round(dims.consistency?.score ?? 0),
        uniqueness: Math.round(dims.uniqueness?.score ?? 0),
        missingnessRate: 0,
        duplicateRate: 0,
        fieldQuality,
      };
    } catch (err) {
      console.error('[dashboardService] getDataQualityMetrics failed:', err);
      return null;
    }
  },

  async getMaterialStats(datasetId?: string): Promise<MaterialStats | null> {
    if (!datasetId || datasetId === 'NONE') return null;
    try {
      const query = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
      const res = await fetch(`${API_BASE}/api/analytics/cpse${query}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const d = await res.json();
      if (!d.has_dataset || !d.data_available) return null;
      const cpseData = (d.cpse_data || {}) as Record<string, CPSEInfo>;
      const byCpse: Record<string, number> = {};
      Object.entries(cpseData).forEach(([cpse, val]) => {
        byCpse[cpse] = val.record_count;
      });
      return {
        byCPSE: Object.entries(byCpse).map(([cpseId, count]) => ({
          cpseId,
          cpseName: cpseId,
          materialCount: count,
          standardizationRate: 100,
          qualityScore: 90,
        })),
        byCategory: [],
        byStatus: [
          { status: 'standardized', count: Object.values(byCpse).reduce((a, b) => a + b, 0), percentage: 100 },
          { status: 'pending', count: 0, percentage: 0 },
          { status: 'rejected', count: 0, percentage: 0 },
        ],
        byQuality: [],
        temporalTrends: [],
      };
    } catch (err) {
      console.error('[dashboardService] getMaterialStats failed:', err);
      return null;
    }
  },

  async getCPSEAnalytics(datasetId?: string) {
    if (!datasetId || datasetId === 'NONE') return null;
    try {
      const query = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
      const res = await fetch(`${API_BASE}/api/analytics/cpse${query}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[dashboardService] getCPSEAnalytics failed:', err);
      return null;
    }
  },

  async getProcessingJobs(): Promise<unknown[]> {
    return [];
  },

  async getProcessingJob(_id: string): Promise<unknown | null> {
    return null;
  },

  async getProcurementInsights(): Promise<unknown[]> {
    return [];
  },

  async getEvaluationMetrics(): Promise<unknown | null> {
    return null;
  },
};