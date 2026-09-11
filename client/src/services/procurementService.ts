/**
 * Procurement Service
 * Abstracts API communication for procurement intelligence operations
 */

import type { ProcurementInsight, ConsolidationOpportunity, DemandChart } from '@/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const procurementService = {
  async getProcurementInsights(params?: {
    page?: number;
    limit?: number;
    category?: string;
    consolidationLevel?: string;
  }) {
    console.log('[procurementService] getProcurementInsights called:', params);
    return [] as ProcurementInsight[];
  },

  async getProcurementInsight(id: string) {
    console.log('[procurementService] getProcurementInsight called:', id);
    return null as ProcurementInsight | null;
  },

  async getConsolidationOpportunities() {
    console.log('[procurementService] getConsolidationOpportunities called');
    return [] as ConsolidationOpportunity[];
  },

  async getDemandChart(materialId: string) {
    console.log('[procurementService] getDemandChart called:', materialId);
    return null as DemandChart | null;
  },

  async getTotalSavingsPotential() {
    console.log('[procurementService] getTotalSavingsPotential called');
    return { totalSavings: 0, savingsPercentage: 0, materialsEligible: 0 };
  },
};
