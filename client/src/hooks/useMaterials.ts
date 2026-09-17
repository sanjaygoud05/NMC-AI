import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { materialService } from '@/services/materialService';
import { useDataset } from '@/contexts/DatasetContext';
import type { Material, MaterialFilters } from '@/types';

export function useMaterials(filters?: MaterialFilters) {
  const { activeDatasetId } = useDataset();
  return useQuery({
    queryKey: ['materials', filters, activeDatasetId],
    queryFn: () => materialService.getMaterials({ ...filters, datasetId: activeDatasetId }),
    placeholderData: keepPreviousData,
    enabled: activeDatasetId !== 'NONE',
  });
}

export function useMaterial(id: string) {
  const { activeDatasetId } = useDataset();
  return useQuery({
    queryKey: ['material', id, activeDatasetId],
    queryFn: () => materialService.getMaterial(id, activeDatasetId),
    enabled: !!id && activeDatasetId !== 'NONE',
  });
}

export function useUpdateMaterial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Material> }) =>
      materialService.updateMaterial(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['material'] });
    },
  });
}
