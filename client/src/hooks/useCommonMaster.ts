import { useQuery } from '@tanstack/react-query';
import { commonMasterService } from '@/services/commonMasterService';
import { useDataset } from '@/contexts/DatasetContext';

export function useCommonMaterials() {
  const { activeDatasetId } = useDataset();
  return useQuery({
    queryKey: ['common-materials', activeDatasetId],
    queryFn: () => commonMasterService.getCatalog({ dataset_id: activeDatasetId }),
    enabled: activeDatasetId !== 'NONE',
  });
}

export function useCommonMaterial(commonCode: string) {
  const { activeDatasetId } = useDataset();
  return useQuery({
    queryKey: ['common-material', commonCode, activeDatasetId],
    queryFn: () => commonMasterService.getDetail(commonCode, activeDatasetId),
    enabled: !!commonCode && activeDatasetId !== 'NONE',
  });
}
