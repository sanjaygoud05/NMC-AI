/**
 * Material Detail Page
 * Shows full detail of a single material record including attributes and match status.
 */

import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Package, Loader2 } from 'lucide-react';
import { useDataset } from '@/contexts/DatasetContext';
import { materialService } from '@/services/materialService';
import { useQuery } from '@tanstack/react-query';
import type { Material } from '@/types';

export default function MaterialDetail() {
  const { id } = useParams<{ id: string }>();
  const { activeDatasetId } = useDataset();

  const { data: material, isLoading, error } = useQuery({
    queryKey: ['material', id, activeDatasetId],
    queryFn: () => materialService.getMaterialById(id!),
    enabled: !!id && activeDatasetId !== 'NONE',
  });

  if (activeDatasetId === 'NONE') {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Package className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">No Dataset Selected</h2>
          <p className="text-muted-foreground">Please select a dataset to view material details</p>
          <Button asChild variant="outline">
            <Link to="/materials"><ArrowLeft className="h-4 w-4 mr-2" />Back to Explorer</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />
          <p className="text-muted-foreground">Loading material details...</p>
        </div>
      </AppLayout>
    );
  }

  if (error || !material) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Package className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Material not found</h2>
          <p className="text-muted-foreground">ID: {id}</p>
          <Button asChild variant="outline">
            <Link to="/materials"><ArrowLeft className="h-4 w-4 mr-2" />Back to Explorer</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/materials"><ArrowLeft className="h-4 w-4 mr-1" />Materials</Link>
          </Button>
        </div>

        <PageHeader
          title={material.material_code || material.materialCode}
          description={material.description}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <Card className="lg:col-span-2 border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Material Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                {[
                  { label: 'Material Code', value: material.material_code || material.materialCode },
                  { label: 'CPSE', value: material.cpse || material.cpseId },
                  { label: 'Category', value: material.category ?? '—' },
                  { label: 'Material Type', value: (material.material_type || material.materialType) ?? '—' },
                  { label: 'Unit of Measure', value: (material.unit_of_measure || material.unit) ?? '—' },
                  { label: 'Manufacturer', value: material.manufacturer ?? '—' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="text-sm font-medium text-foreground mt-0.5">{value}</dd>
                  </div>
                ))}
              </dl>

              {material.attributes && Object.keys(material.attributes).length > 0 && (
                <div className="mt-6 pt-4 border-t border-border">
                  <h4 className="text-sm font-medium text-foreground mb-3">Extracted Attributes</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(material.attributes).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center bg-muted/30 rounded px-3 py-2">
                        <span className="text-xs text-muted-foreground capitalize">{key}</span>
                        <span className="text-xs font-medium text-foreground">{String(value ?? '—')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Panel */}
          <div className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Processing Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Standardization</p>
                  <StatusBadge status={material.standardization_status || material.standardizationStatus} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Match Status</p>
                  <Badge variant="outline" className="text-xs capitalize">
                    {(material.match_status || material.matchStatus)?.replace(/_/g, ' ') || '—'}
                  </Badge>
                </div>
                {(material.confidence_score !== undefined && material.confidence_score !== null) || 
                 (material.confidenceScore !== undefined && material.confidenceScore !== null) ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Confidence Score</p>
                    <p className="text-2xl font-bold text-foreground">
                      {((material.confidence_score || material.confidenceScore) * 100).toFixed(0)}%
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {(material.standardized_description || material.normalized_description || 
              material.standardizedDescription || material.normalizedDescription) && (
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Descriptions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Original</p>
                    <p className="text-sm text-foreground mt-0.5">{material.description}</p>
                  </div>
                  {(material.normalized_description || material.normalizedDescription) && (
                    <div>
                      <p className="text-xs text-muted-foreground">Normalized</p>
                      <p className="text-sm text-foreground font-mono mt-0.5">
                        {material.normalized_description || material.normalizedDescription}
                      </p>
                    </div>
                  )}
                  {(material.standardized_description || material.standardizedDescription) && (
                    <div>
                      <p className="text-xs text-muted-foreground">Standardized</p>
                      <p className="text-sm text-primary font-medium mt-0.5">
                        {material.standardized_description || material.standardizedDescription}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
