/**
 * Material Explorer Page
 * Searchable, filterable, and paginated table of CPSE materials scoped by active dataset.
 */

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  Filter,
  ExternalLink,
  Loader2,
  Database,
  Upload,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
  Building2,
  Tag,
  CheckCircle2,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { materialService } from '@/services/materialService';
import { useDataset } from '@/contexts/DatasetContext';
import type { Material } from '@/types';

const CPSE_OPTIONS = [
  { value: 'all', label: 'All CPSEs' },
  { value: 'ONGC', label: 'ONGC' },
  { value: 'IOCL', label: 'IOCL' },
  { value: 'HPCL', label: 'HPCL' },
  { value: 'CPCL', label: 'CPCL' },
];

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'Bearings', label: 'Bearings' },
  { value: 'Electrical', label: 'Electrical' },
  { value: 'Fasteners', label: 'Fasteners' },
  { value: 'Hoses', label: 'Hoses' },
  { value: 'Instrumentation', label: 'Instrumentation' },
  { value: 'Lubricants', label: 'Lubricants' },
  { value: 'Pipes & Fittings', label: 'Pipes & Fittings' },
  { value: 'Pumps', label: 'Pumps' },
  { value: 'Safety', label: 'Safety' },
  { value: 'Seals', label: 'Seals' },
  { value: 'Valves', label: 'Valves' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
  { value: 'Blocked', label: 'Blocked' },
];

const PAGE_SIZE_OPTIONS = [15, 25, 50, 100];

export default function Materials() {
  const { activeDatasetId, selectDataset } = useDataset();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [search, setSearch] = useState('');
  const [selectedCpse, setSelectedCpse] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Pagination States (chunk of data)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const hasActiveFilters = search.trim() !== '' || selectedCpse !== 'all' || selectedCategory !== 'all' || selectedStatus !== 'all';

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Reset page to 1 when filters change
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleCpseChange = (val: string) => {
    setSelectedCpse(val);
    setPage(1);
  };

  const handleCategoryChange = (val: string) => {
    setSelectedCategory(val);
    setPage(1);
  };

  const handleStatusChange = (val: string) => {
    setSelectedStatus(val);
    setPage(1);
  };

  const handlePageSizeChange = (val: string) => {
    const size = parseInt(val, 10);
    setPageSize(size);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedCpse('all');
    setSelectedCategory('all');
    setSelectedStatus('all');
    setPage(1);
  };

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
        search: search.trim() || undefined,
        cpseId: selectedCpse !== 'all' ? selectedCpse : undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        page,
        limit: pageSize,
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
  }, [activeDatasetId, search, selectedCpse, selectedCategory, selectedStatus, page, pageSize]);

  // Generate visible page numbers for chunk navigation
  const pageNumbers = useMemo(() => {
    const items: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) items.push(i);
    } else {
      items.push(1);
      if (page > 3) items.push('...');
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) items.push(i);
      if (page < totalPages - 2) items.push('...');
      items.push(totalPages);
    }
    return items;
  }, [page, totalPages]);

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

  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, total);

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Material Explorer"
          description="Browse, search, and filter all CPSE materials across the harmonization pipeline"
        />

        {/* Search & Comprehensive Filters Bar */}
        <Card className="border-border bg-card shadow-xs rounded-2xl p-4">
          <div className="flex flex-col gap-3">
            {/* Top row: Search and Quick stats */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search material description, code, manufacturer…"
                  className="pl-9 pr-8 text-xs sm:text-sm h-9 rounded-xl bg-background"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
                {search && (
                  <button
                    onClick={() => handleSearchChange('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Total count badge */}
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="secondary" className="text-xs py-1 px-3 rounded-lg font-medium">
                  {loading ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" /> Loading chunk…
                    </span>
                  ) : (
                    <span>
                      <strong className="text-foreground">{total.toLocaleString()}</strong> materials found
                    </span>
                  )}
                </Badge>

                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetFilters}
                    className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5 px-2.5"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </Button>
                )}
              </div>
            </div>

            {/* Bottom row: Dropdown Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1 border-t border-border/60">
              {/* CPSE Select */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> CPSE Enterprise
                </label>
                <Select value={selectedCpse} onValueChange={handleCpseChange}>
                  <SelectTrigger className="h-8 text-xs bg-background border-border rounded-lg">
                    <SelectValue placeholder="All CPSEs" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {CPSE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category Select */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Material Category
                </label>
                <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                  <SelectTrigger className="h-8 text-xs bg-background border-border rounded-lg">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border max-h-56">
                    {CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Select */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Material Status
                </label>
                <Select value={selectedStatus} onValueChange={handleStatusChange}>
                  <SelectTrigger className="h-8 text-xs bg-background border-border rounded-lg">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Chunk Size / Rows Per Page */}
              <div className="space-y-1 sm:col-span-3 lg:col-span-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Chunk Size (Per Page)
                </label>
                <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="h-8 text-xs bg-background border-border rounded-lg">
                    <SelectValue placeholder="25 rows" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {PAGE_SIZE_OPTIONS.map((sz) => (
                      <SelectItem key={sz} value={sz.toString()} className="text-xs">
                        {sz} rows per page
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </Card>

        {/* Mobile Material Cards View (< sm) */}
        <div className="block sm:hidden space-y-3">
          {materials.length === 0 && !loading && (
            <Card className="p-8 text-center text-muted-foreground text-xs border-border bg-card rounded-2xl">
              No materials match the selected filters for dataset {activeDatasetId}
            </Card>
          )}

          {materials.map((material) => (
            <Card key={material.id} className="p-4 border-border bg-card space-y-2.5 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-primary">{material.materialCode}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-semibold">{material.cpseId}</Badge>
                  <StatusBadge status={material.standardizationStatus} />
                </div>
              </div>
              <div className="text-xs font-semibold text-foreground leading-snug">
                {material.description}
              </div>
              {material.standardizedDescription && (
                <div className="text-[11px] text-muted-foreground leading-snug p-2 rounded-lg bg-muted/30 border border-border/50">
                  <span className="text-primary font-medium mr-1">Std:</span>
                  {material.standardizedDescription}
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                <span>{material.category || 'General'} · {material.unit || 'NOS'}</span>
                <Button asChild variant="ghost" size="sm" className="h-7 px-2.5 text-xs text-primary">
                  <Link to={`/materials/${material.id}`}>
                    Details <ExternalLink className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Tablet & Desktop Materials Table (>= sm) */}
        <Card className="hidden sm:block border-border bg-card shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto w-full">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border">
                    <TableHead className="w-28 font-semibold">Material Code</TableHead>
                    <TableHead className="font-semibold">Raw Description / Standardized</TableHead>
                    <TableHead className="w-24 font-semibold">CPSE</TableHead>
                    <TableHead className="w-32 font-semibold">Category</TableHead>
                    <TableHead className="w-20 font-semibold">Unit</TableHead>
                    <TableHead className="w-28 font-semibold">Status</TableHead>
                    <TableHead className="w-24 font-semibold">Confidence</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                        No materials found matching your filters in dataset <span className="font-mono text-foreground">{activeDatasetId}</span>.
                      </TableCell>
                    </TableRow>
                  )}
                  {materials.map((material) => (
                    <TableRow key={material.id} className="hover:bg-muted/30 transition-colors border-b border-border/60">
                      <TableCell className="font-mono text-xs font-semibold text-primary">
                        {material.materialCode}
                      </TableCell>
                      <TableCell className="max-w-md py-3">
                        <div className="text-xs font-medium text-foreground line-clamp-1">{material.description}</div>
                        {material.standardizedDescription && (
                          <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                            <span className="text-primary font-medium mr-1">↳</span>
                            {material.standardizedDescription}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5">
                          {material.cpseId}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-medium">
                        {material.category || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {material.unit || 'NOS'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={material.standardizationStatus} />
                      </TableCell>
                      <TableCell>
                        {material.confidenceScore !== undefined && material.confidenceScore !== null ? (
                          <span className={`text-xs font-bold ${material.confidenceScore >= 0.9 ? 'text-emerald-500' : material.confidenceScore >= 0.8 ? 'text-amber-500' : 'text-rose-500'}`}>
                            {(material.confidenceScore * 100).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
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

        {/* Pagination & Chunk Navigation Bar (Previous and Next Buttons) */}
        {total > 0 && (
          <Card className="border-border bg-card shadow-xs rounded-2xl p-3.5 sm:p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Record Range Info */}
              <div className="text-xs text-muted-foreground text-center sm:text-left">
                Showing <strong className="text-foreground font-semibold">{startRecord}</strong> to{' '}
                <strong className="text-foreground font-semibold">{endRecord}</strong> of{' '}
                <strong className="text-foreground font-semibold">{total.toLocaleString()}</strong> materials
                {hasActiveFilters && <span className="ml-1 text-primary">(filtered)</span>}
              </div>

              {/* Previous / Page Numbers / Next Button Controls */}
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                {/* Previous Button */}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 text-xs px-3 gap-1 rounded-lg border-border hover:border-primary/40 font-medium"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </Button>

                {/* Page Number Chips */}
                <div className="hidden sm:flex items-center gap-1">
                  {pageNumbers.map((pNum, idx) => {
                    if (pNum === '...') {
                      return (
                        <span key={`ellipsis-${idx}`} className="px-1.5 text-xs text-muted-foreground font-mono">
                          …
                        </span>
                      );
                    }
                    const isCurrent = pNum === page;
                    return (
                      <Button
                        key={`page-${pNum}`}
                        variant={isCurrent ? 'default' : 'outline'}
                        size="sm"
                        disabled={loading}
                        onClick={() => setPage(pNum as number)}
                        className={`h-8 w-8 p-0 text-xs rounded-lg font-semibold transition-all ${
                          isCurrent
                            ? 'bg-primary text-primary-foreground shadow-xs shadow-primary/30'
                            : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {pNum}
                      </Button>
                    );
                  })}
                </div>

                {/* Mobile Page indicator */}
                <span className="sm:hidden text-xs font-medium px-2 text-muted-foreground">
                  {page} / {totalPages}
                </span>

                {/* Next Button */}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 text-xs px-3 gap-1 rounded-lg border-border hover:border-primary/40 font-medium"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
