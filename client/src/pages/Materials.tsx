/**
 * Material Explorer Page
 * Searchable, filterable table of CPSE materials scoped by active dataset.
 */

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Filter, ExternalLink, Loader2, Database, Upload } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { materialService } from '@/services/materialService';
import { useDataset } from '@/contexts/DatasetContext';
import type { Material } from '@/types';
import { Link } from 'react-router-dom';

export default function Materials() {
  const { activeDatasetId, selectDataset } = useDataset();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let isCurrent = true;
    if (activeDatasetId === 'NONE') {
      setMaterials([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    materialService
      .getMaterials({
        datasetId: activeDatasetId,
        search,
        limit: 100,
      })
      .then((res) => {
        if (isCurrent) {
          setMaterials(res.materials);
          setTotal(res.total);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [activeDatasetId, search]);

  if (activeDatasetId === 'NONE') {
    return (
      <AppLayout>
        <div className="space-y-6">
          <PageHeader
            title="Material Explorer"
            description="Browse, search, and filter all CPSE materials across the harmonization pipeline"
          />
          <Card className="border-border bg-card p-6 sm:p-12">
            <EmptyState
              icon={Database}
              title="No Dataset Selected"
              description="Upload a material master dataset or explicitly select an existing dataset to begin."
              action={{
                label: "Upload Dataset",
                icon: Upload,
                href: "/ingest",
              }}
            />
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectDataset('BASELINE')}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Or select Frozen Baseline (1,250 records)
              </Button>
            </div>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Material Explorer"
          description="Browse, search, and filter all CPSE materials across the harmonization pipeline"
        />

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search materials, codes, CPSEs…"
              className="pl-9 text-xs sm:text-sm h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-start">
            <Button variant="outline" size="sm" className="gap-2 text-xs h-9">
              <Filter className="h-3.5 w-3.5" />
              Filters
            </Button>
            <Badge variant="secondary" className="text-xs py-1">
              {loading ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                </span>
              ) : (
                `${materials.length} of ${total} materials`
              )}
            </Badge>
          </div>
        </div>

        {/* Mobile Material Cards View (< sm) */}
        <div className="block sm:hidden space-y-3">
          {materials.length === 0 && !loading && (
            <Card className="p-6 text-center text-muted-foreground text-xs border-border bg-card">
              No materials found for dataset {activeDatasetId}
            </Card>
          )}
          {materials.map((material) => (
            <Card key={material.id} className="p-3.5 border-border bg-card space-y-2 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-primary">{material.materialCode}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">{material.cpseId}</Badge>
                  <StatusBadge status={material.standardizationStatus} />
                </div>
              </div>
              <div className="text-xs font-medium text-foreground leading-snug">
                {material.description}
              </div>
              {material.standardizedDescription && (
                <div className="text-[11px] text-muted-foreground leading-snug">
                  → {material.standardizedDescription}
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                <span>{material.category || 'General'} · {material.unit || 'NOS'}</span>
                <div className="flex items-center gap-2">
                  {material.confidenceScore !== undefined && material.confidenceScore !== null && (
                    <span className={`font-semibold ${material.confidenceScore >= 0.9 ? 'text-green-500' : material.confidenceScore >= 0.8 ? 'text-yellow-500' : 'text-red-500'}`}>
                      {(material.confidenceScore * 100).toFixed(0)}%
                    </span>
                  )}
                  <Button asChild variant="ghost" size="sm" className="h-6 px-2 text-xs">
                    <Link to={`/materials/${material.id}`}>
                      Details <ExternalLink className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Tablet & Desktop Materials Table (>= sm) */}
        <Card className="hidden sm:block border-border bg-card overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto w-full">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>CPSE</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                        No materials found for dataset {activeDatasetId}
                      </TableCell>
                    </TableRow>
                  )}
                  {materials.map((material) => (
                    <TableRow key={material.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs">{material.materialCode}</TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate text-sm">{material.description}</div>
                        {material.standardizedDescription && (
                          <div className="truncate text-xs text-muted-foreground mt-0.5">
                            → {material.standardizedDescription}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{material.cpseId}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{material.category}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{material.unit}</TableCell>
                      <TableCell>
                        <StatusBadge status={material.standardizationStatus} />
                      </TableCell>
                      <TableCell>
                        {material.confidenceScore !== undefined && material.confidenceScore !== null ? (
                          <span className={`text-sm font-medium ${material.confidenceScore >= 0.9 ? 'text-green-500' : material.confidenceScore >= 0.8 ? 'text-yellow-500' : 'text-red-500'}`}>
                            {(material.confidenceScore * 100).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                          <Link to={`/materials/${material.id}`}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
