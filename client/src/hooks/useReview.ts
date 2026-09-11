import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewService } from '@/services/reviewService';
import type { ReviewItem, ReviewDecision } from '@/types';

export function useReviewQueue() {
  return useQuery({
    queryKey: ['review-queue'],
    queryFn: () => reviewService.getReviewQueue(),
  });
}

export function useReviewItem(id: string) {
  return useQuery({
    queryKey: ['review-item', id],
    queryFn: () => reviewService.getReviewItem(id),
    enabled: !!id,
  });
}

export function useSubmitDecision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: ReviewDecision }) =>
      reviewService.submitDecision(id, decision),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['review-item'] });
    },
  });
}
