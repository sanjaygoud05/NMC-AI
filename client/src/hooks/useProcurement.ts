import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboardService';
import type { ProcurementInsight } from '@/types';

export function useProcurementInsights() {
  return useQuery({
    queryKey: ['procurement-insights'],
    queryFn: () => dashboardService.getProcurementInsights(),
  });
}
