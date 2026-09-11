import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { matchingService } from '@/services/matchingService';
import { reviewService } from '@/services/reviewService';
import { useDataset } from '@/contexts/DatasetContext';
import type { MatchFilters } from '@/types';

export function useMatches(filters?: MatchFilters) {
  const { activeDatasetId } = useDataset();
  return useQuery({
    queryKey: ['matches', filters, activeDatasetId],
    queryFn: () => matchingService.getMatches({ ...filters, dataset_id: activeDatasetId }),
    enabled: activeDatasetId !== 'NONE',
  });
}

export function useMatch(id: string) {
  const { activeDatasetId } = useDataset();
  return useQuery({
    queryKey: ['match', id, activeDatasetId],
    queryFn: () => matchingService.getMatchDetail(id, activeDatasetId),
    enabled: !!id && activeDatasetId !== 'NONE',
  });
}

export function useAcceptMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => reviewService.submitDecision(id, { decision: 'ACCEPT', rationale: 'Accepted via matches' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['match'] });
    },
  });
}

export function useRejectMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => reviewService.submitDecision(id, { decision: 'REJECT', rationale: 'Rejected via matches' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['match'] });
    },
  });
}
