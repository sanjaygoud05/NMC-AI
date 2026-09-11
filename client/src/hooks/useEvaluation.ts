import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboardService';
import type { EvaluationMetrics } from '@/types';

export function useEvaluationMetrics() {
  return useQuery({
    queryKey: ['evaluation-metrics'],
    queryFn: () => dashboardService.getEvaluationMetrics(),
  });
}
