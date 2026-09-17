import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { DashboardMetrics, DataQualityMetrics, MaterialStats } from '@/types';
import { dashboardService } from '@/services/dashboardService';
import { useDataset } from '@/contexts/DatasetContext';

export function useDashboardMetrics() {
  const { activeDatasetId, datasets } = useDataset();
  const activeDs = datasets.find((d) => d.dataset_id === activeDatasetId);
  const isProcessing = activeDs && ['UPLOADED', 'VALIDATING', 'VALIDATED', 'PROCESSING'].includes(activeDs.status);

  return useQuery<DashboardMetrics | null>({
    queryKey: ['dashboard-metrics', activeDatasetId],
    queryFn: async () => {
      const data = await dashboardService.getDashboardMetrics(activeDatasetId);
      return data;
    },
    placeholderData: keepPreviousData,
    staleTime: isProcessing ? 2000 : 30_000,
    refetchInterval: isProcessing ? 3000 : false,
  });
}

export function useDataQualityMetrics() {
  const { activeDatasetId, datasets } = useDataset();
  const activeDs = datasets.find((d) => d.dataset_id === activeDatasetId);
  const isProcessing = activeDs && ['UPLOADED', 'VALIDATING', 'VALIDATED', 'PROCESSING'].includes(activeDs.status);

  return useQuery<DataQualityMetrics | null>({
    queryKey: ['data-quality-metrics', activeDatasetId],
    queryFn: async () => {
      return await dashboardService.getDataQualityMetrics(activeDatasetId);
    },
    placeholderData: keepPreviousData,
    staleTime: isProcessing ? 2000 : 30_000,
    refetchInterval: isProcessing ? 3000 : false,
  });
}

export function useMaterialStats() {
  const { activeDatasetId, datasets } = useDataset();
  const activeDs = datasets.find((d) => d.dataset_id === activeDatasetId);
  const isProcessing = activeDs && ['UPLOADED', 'VALIDATING', 'VALIDATED', 'PROCESSING'].includes(activeDs.status);

  return useQuery<MaterialStats | null>({
    queryKey: ['material-stats', activeDatasetId],
    queryFn: async () => {
      return await dashboardService.getMaterialStats(activeDatasetId);
    },
    placeholderData: keepPreviousData,
    staleTime: isProcessing ? 2000 : 30_000,
    refetchInterval: isProcessing ? 3000 : false,
  });
}

