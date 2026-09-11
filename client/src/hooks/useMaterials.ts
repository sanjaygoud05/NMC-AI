import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { materialService } from '@/services/materialService';
import type { Material, MaterialFilters } from '@/types';

export function useMaterials(filters?: MaterialFilters) {
  return useQuery({
    queryKey: ['materials', filters],
    queryFn: () => materialService.getMaterials(filters),
  });
}

export function useMaterial(id: string) {
  return useQuery({
    queryKey: ['material', id],
    queryFn: () => materialService.getMaterial(id),
    enabled: !!id,
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

export function useDeleteMaterial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => materialService.deleteMaterial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    },
  });
}
