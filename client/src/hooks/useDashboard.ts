import { useQuery } from '@tanstack/react-query';
import type { DashboardMetrics, DataQualityMetrics, MaterialStats } from '@/types';
import { dashboardService } from '@/services/dashboardService';

export function useDashboardMetrics() {
  return useQuery<DashboardMetrics | null>({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      const data = await dashboardService.getDashboardMetrics();
      return data;
    },
    staleTime: 30_000,
  });
}

export function useDataQualityMetrics() {
  return useQuery<DataQualityMetrics | null>({
    queryKey: ['data-quality-metrics'],
    queryFn: async () => {
      return await dashboardService.getDataQualityMetrics();
    },
    staleTime: 60_000,
  });
}

export function useMaterialStats() {
  return useQuery<MaterialStats | null>({
    queryKey: ['material-stats'],
    queryFn: async () => {
      return await dashboardService.getMaterialStats();
    },
    staleTime: 60_000,
  });
}

