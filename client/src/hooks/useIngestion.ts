import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { materialService } from '@/services/materialService';
import type { IngestionResult, ValidationResult } from '@/types';

export function useIngestDataset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => materialService.ingestDataset(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    },
  });
}

export function useValidateDataset(file: File) {
  return useQuery({
    queryKey: ['validate-dataset', file.name],
    queryFn: () => materialService.validateDataset(file),
    enabled: !!file,
  });
}
