import { useQuery } from '@tanstack/react-query';
import type { DashboardMetrics, DataQualityMetrics, MaterialStats } from '@/types';
import { mockDashboardMetrics } from '@/lib/mock/dashboard';

export function useDashboardMetrics() {
  return useQuery<DashboardMetrics>({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      // TODO: replace with actual API call once backend is ready
      // return dashboardService.getDashboardMetrics();
      return mockDashboardMetrics;
    },
    staleTime: 30_000,
  });
}

export function useDataQualityMetrics() {
  return useQuery<DataQualityMetrics | null>({
    queryKey: ['data-quality-metrics'],
    queryFn: async () => {
      // Placeholder — will call GET /api/analytics/data-quality
      return null;
    },
    staleTime: 60_000,
  });
}

export function useMaterialStats() {
  return useQuery<MaterialStats | null>({
    queryKey: ['material-stats'],
    queryFn: async () => {
      // Placeholder — will call GET /api/analytics/stats
      return null;
    },
    staleTime: 60_000,
  });
}
