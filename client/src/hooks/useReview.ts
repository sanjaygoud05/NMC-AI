import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewService } from '@/services/reviewService';
import { useDataset } from '@/contexts/DatasetContext';
import type { ReviewItem, ReviewDecision } from '@/types';

export function useReviewQueue() {
  const { activeDatasetId } = useDataset();
  return useQuery({
    queryKey: ['review-queue', activeDatasetId],
    queryFn: () => reviewService.getReviewQueue({ dataset_id: activeDatasetId }),
    enabled: activeDatasetId !== 'NONE',
  });
}

export function useReviewItem(id: string) {
  const { activeDatasetId } = useDataset();
  return useQuery({
    queryKey: ['review-item', id, activeDatasetId],
    queryFn: () => reviewService.getReviewDetail(id, activeDatasetId),
    enabled: !!id && activeDatasetId !== 'NONE',
  });
}

export function useSubmitDecision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, decision, rationale = '' }: { id: string; decision: 'ACCEPT' | 'REJECT' | 'DEFER'; rationale?: string }) =>
      reviewService.submitDecision(id, { decision, rationale }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['review-item'] });
    },
  });
}
