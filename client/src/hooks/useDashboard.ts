import { useQuery } from '@tanstack/react-query';
import type { DashboardMetrics, DataQualityMetrics, MaterialStats } from '@/types';
import { dashboardService } from '@/services/dashboardService';
import { useDataset } from '@/contexts/DatasetContext';

export function useDashboardMetrics() {
  const { activeDatasetId } = useDataset();
  return useQuery<DashboardMetrics | null>({
    queryKey: ['dashboard-metrics', activeDatasetId],
    queryFn: async () => {
      const data = await dashboardService.getDashboardMetrics(activeDatasetId);
      return data;
    },
    staleTime: 10_000,
  });
}

export function useDataQualityMetrics() {
  const { activeDatasetId } = useDataset();
  return useQuery<DataQualityMetrics | null>({
    queryKey: ['data-quality-metrics', activeDatasetId],
    queryFn: async () => {
      return await dashboardService.getDataQualityMetrics(activeDatasetId);
    },
    staleTime: 30_000,
  });
}

export function useMaterialStats() {
  const { activeDatasetId } = useDataset();
  return useQuery<MaterialStats | null>({
    queryKey: ['material-stats', activeDatasetId],
    queryFn: async () => {
      return await dashboardService.getMaterialStats(activeDatasetId);
    },
    staleTime: 30_000,
  });
}
