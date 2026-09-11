import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboardService';
import type { DataQualityMetrics } from '@/types';

export function useDataQualityMetrics() {
  return useQuery({
    queryKey: ['data-quality'],
    queryFn: () => dashboardService.getDataQualityMetrics(),
  });
}
