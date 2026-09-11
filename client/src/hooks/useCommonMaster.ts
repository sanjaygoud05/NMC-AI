import { useQuery } from '@tanstack/react-query';
import { materialService } from '@/services/materialService';
import type { CommonMaterial } from '@/types';

export function useCommonMaterials() {
  return useQuery({
    queryKey: ['common-materials'],
    queryFn: () => materialService.getCommonMaterials(),
  });
}

export function useCommonMaterial(commonCode: string) {
  return useQuery({
    queryKey: ['common-material', commonCode],
    queryFn: () => materialService.getCommonMaterial(commonCode),
    enabled: !!commonCode,
  });
}
