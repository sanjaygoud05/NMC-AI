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
import { Search, Filter, ExternalLink, Loader2 } from 'lucide-react';
import { materialService } from '@/services/materialService';
import { useDataset } from '@/contexts/DatasetContext';
import type { Material } from '@/types';
import { Link } from 'react-router-dom';

export default function Materials() {
  const { activeDatasetId } = useDataset();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let isCurrent = true;
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

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Material Explorer"
          description="Browse, search, and filter all CPSE materials across the harmonization pipeline"
        />

        {/* Search & Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search materials, codes, CPSEs…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
          <Badge variant="secondary" className="text-xs">
            {loading ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading...
              </span>
            ) : (
              `${materials.length} of ${total} materials (${activeDatasetId})`
            )}
          </Badge>
        </div>

        {/* Materials Table */}
        <Card className="border-border bg-card">
          <CardContent className="p-0">
            <Table>
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
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
