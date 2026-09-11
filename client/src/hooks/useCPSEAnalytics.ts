import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboardService';
import type { CPSEAnalytics } from '@/types';

export function useCPSEAnalytics() {
  return useQuery({
    queryKey: ['cpse-analytics'],
    queryFn: () => dashboardService.getCPSEAnalytics(),
  });
}
