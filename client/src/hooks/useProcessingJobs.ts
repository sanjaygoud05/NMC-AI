import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboardService';
import type { ProcessingJob } from '@/types';

export function useProcessingJobs() {
  return useQuery({
    queryKey: ['processing-jobs'],
    queryFn: () => dashboardService.getProcessingJobs(),
  });
}

export function useProcessingJob(id: string) {
  return useQuery({
    queryKey: ['processing-job', id],
    queryFn: () => dashboardService.getProcessingJob(id),
    enabled: !!id,
  });
}
