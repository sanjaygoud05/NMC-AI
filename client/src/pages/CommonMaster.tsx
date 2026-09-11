import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  Database,
  Upload,
  ExternalLink,
  RotateCcw,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  commonMasterService,
  CommonMaterialRecord,
  CommonMasterStats,
} from '@/services/commonMasterService';
import { useDataset } from '@/contexts/DatasetContext';
import { toast } from 'sonner';

/** Format uppercase or raw strings into clean readable title case while preserving standards */
function formatReadableText(text: string | null | undefined): string {
  if (!text || text.trim() === '' || text.trim() === '-') return '—';
  const acronyms = new Set([
    'ASTM', 'ASME', 'ISO', 'DIN', 'ANSI', 'API', 'BS', 'IS', 'XLPE', 'PVC',
    'SS', 'CS', 'MS', 'GI', 'CI', 'WCB', 'CF8M', 'NBR', 'PTFE', 'EPDM',
    'FKM', 'CPSE', 'IOCL', 'ONGC', 'HPCL', 'BPCL', 'CPCL', 'GAIL', 'NIL',
    'NPT', 'BSP', 'BSPT', 'FLG', 'SW', 'BW', 'NB', 'OD', 'ID', 'PN', 'CL',
    'SCH', 'NOS', 'MTR', 'KG', 'LTR', 'SET', 'BOX', 'PKT', 'PAIR', 'IN', 'MM', 'CM', 'M'
  ]);

  const clean = text.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  const words = clean.split(' ');
  return words
    .map((w) => {
      const upper = w.toUpperCase();
      if (acronyms.has(upper)) return upper;
      if (/^\d+(\.\d+)?(IN|MM|CM|M|KG|L|#|CL|V|A|W)?$/i.test(w)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

export default function CommonMaster() {
  const { activeDatasetId, selectDataset } = useDataset();
  const [materials, setMaterials] = useState<CommonMaterialRecord[]>([]);
  const [stats, setStats] = useState<CommonMasterStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Inspector Modal
  const [selectedRecord, setSelectedRecord] = useState<CommonMaterialRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRecord, setDetailRecord] = useState<CommonMaterialRecord | null>(null);

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const [catData, statsData] = await Promise.all([
        commonMasterService.getCatalog({
          search: search.trim() || undefined,
          family: familyFilter,
          governance_status: statusFilter,
          dataset_id: activeDatasetId,
          page,
          page_size: 15,
        }),
        commonMasterService.getStats(activeDatasetId).catch(() => null),
      ]);

      setMaterials(catData.items || []);
      setTotal(catData.total || 0);
      setTotalPages(catData.total_pages || 1);
      if (statsData) setStats(statsData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load catalog';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, [search, familyFilter, statusFilter, page, activeDatasetId]);

  const openInspector = async (record: CommonMaterialRecord) => {
    setSelectedRecord(record);
    setDetailLoading(true);
    try {
      const full = await commonMasterService.getDetail(record.common_code, activeDatasetId);
      setDetailRecord(full);
    } catch {
      setDetailRecord(record);
    } finally {
      setDetailLoading(false);
    }
  };

  const isFiltered = search.trim() !== '' || familyFilter !== 'all' || statusFilter !== 'all';

  const resetFilters = () => {
    setSearch('');
    setFamilyFilter('all');
    setStatusFilter('all');
    setPage(1);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED_MASTER':
      case 'VERIFIED_HARMONIZED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Harmonized
          </span>
        );
      case 'STANDALONE_CANDIDATE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            Standalone
          </span>
        );
      case 'AMBIGUOUS_REVIEW_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Needs Review
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
            {formatReadableText(status)}
          </span>
        );
    }
  };

  const getCpseBadge = (cpse: string) => {
    const c = cpse.toUpperCase();
    if (c.includes('IOCL')) {
      return (
        <span key={cpse} className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          {cpse}
        </span>
      );
    }
    if (c.includes('ONGC')) {
      return (
        <span key={cpse} className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          {cpse}
        </span>
      );
    }
    if (c.includes('HPCL')) {
      return (
        <span key={cpse} className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
          {cpse}
        </span>
      );
    }
    if (c.includes('BPCL')) {
      return (
        <span key={cpse} className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          {cpse}
        </span>
      );
    }
    return (
      <span key={cpse} className="px-2 py-0.5 rounded text-xs font-medium bg-slate-500/10 text-slate-300 border border-slate-500/20">
        {cpse}
      </span>
    );
  };

  if (activeDatasetId === 'NONE') {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Common Material Master
            </h1>
            <p className="text-sm text-muted-foreground">
              Governed multi-CPSE master catalog unifying material descriptions and specifications.
            </p>
          </div>
          <Card className="border-border bg-card p-12">
            <EmptyState
              icon={Database}
              title="No Dataset Selected"
              description="Please upload or select a material dataset to view the Common Material Master."
              action={{
                label: 'Upload Dataset',
                icon: Upload,
                href: '/ingest',
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
        {/* Simple, Crisp Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Common Material Master
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Unified golden catalog synthesizing materials across CPSEs into a standardized master.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-3 py-1 rounded-md bg-secondary text-secondary-foreground border border-border">
              Dataset: {activeDatasetId}
            </span>
          </div>
        </div>

        {/* 4 Clean Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
            <div className="text-xs text-muted-foreground">Total Master Records</div>
            <div className="text-2xl font-semibold text-foreground mt-1">
              {stats ? stats.total_common_materials.toLocaleString() : '—'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Standardized items</div>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
            <div className="text-xs text-muted-foreground">Harmonized Across CPSEs</div>
            <div className="text-2xl font-semibold text-emerald-400 mt-1">
              {stats ? stats.multi_cpse_harmonized.toLocaleString() : '—'}
            </div>
            <div className="text-xs text-emerald-400/80 mt-1">Shared by 2+ enterprises</div>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
            <div className="text-xs text-muted-foreground">Verified Standards</div>
            <div className="text-2xl font-semibold text-blue-400 mt-1">
              {stats ? stats.verified_harmonized.toLocaleString() : '—'}
            </div>
            <div className="text-xs text-blue-400/80 mt-1">Governed master records</div>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
            <div className="text-xs text-muted-foreground">Source Items Mapped</div>
            <div className="text-2xl font-semibold text-foreground mt-1">
              {stats ? stats.total_members_mapped.toLocaleString() : '—'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">100% catalog coverage</div>
          </div>
        </div>

        {/* Clean Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-card border border-border p-2.5 rounded-xl shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search code, description, category, grade..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 pr-8 bg-background border-border text-sm h-9"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="w-full sm:w-48">
            <Select
              value={familyFilter}
              onValueChange={(val) => {
                setFamilyFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-sm bg-background border-border">
                <SelectValue placeholder="All Families" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Families</SelectItem>
                {(stats?.unique_families || []).map((fam) => (
                  <SelectItem key={fam} value={fam}>
                    {formatReadableText(fam)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-52">
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-sm bg-background border-border">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="VERIFIED_HARMONIZED">Harmonized</SelectItem>
                <SelectItem value="STANDALONE_CANDIDATE">Standalone</SelectItem>
                <SelectItem value="AMBIGUOUS_REVIEW_REQUIRED">Needs Review</SelectItem>
                <SelectItem value="APPROVED_MASTER">Approved Master</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-9 text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </div>

        {/* Clean, Readable Table */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border">
                  <TableHead className="font-medium text-xs text-muted-foreground pl-5 py-3.5 w-44">
                    Common Code
                  </TableHead>
                  <TableHead className="font-medium text-xs text-muted-foreground py-3.5">
                    Standardized Description
                  </TableHead>
                  <TableHead className="font-medium text-xs text-muted-foreground py-3.5 w-32">
                    Family
                  </TableHead>
                  <TableHead className="font-medium text-xs text-muted-foreground py-3.5 w-36">
                    Enterprises
                  </TableHead>
                  <TableHead className="font-medium text-xs text-muted-foreground text-center py-3.5 w-20">
                    Items
                  </TableHead>
                  <TableHead className="font-medium text-xs text-muted-foreground py-3.5 w-36">
                    Status
                  </TableHead>
                  <TableHead className="font-medium text-xs text-muted-foreground text-right pr-5 py-3.5 w-24">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16 text-muted-foreground text-sm">
                      Loading catalog records...
                    </TableCell>
                  </TableRow>
                ) : materials.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16 text-muted-foreground text-sm">
                      No common material records match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  materials.map((m) => {
                    const readableTitle = formatReadableText(m.common_description);
                    const specs = [
                      m.material_grade && m.material_grade !== '-' ? `Grade: ${formatReadableText(m.material_grade)}` : null,
                      m.nominal_size && m.nominal_size !== '-' ? `Size: ${formatReadableText(m.nominal_size)}` : null,
                      m.standard_spec && m.standard_spec !== '-' ? `Std: ${m.standard_spec.toUpperCase()}` : null,
                      m.unit_of_measure && m.unit_of_measure !== '-' ? `UOM: ${m.unit_of_measure.toUpperCase()}` : null,
                    ].filter(Boolean);

                    return (
                      <TableRow
                        key={m.common_material_id || m.common_code}
                        onClick={() => openInspector(m)}
                        className="border-border/60 hover:bg-muted/30 cursor-pointer transition-colors"
                      >
                        <TableCell className="pl-5 py-3.5 font-medium text-xs text-primary">
                          {m.common_code}
                        </TableCell>
                        <TableCell className="py-3.5 max-w-lg">
                          <div className="text-sm font-medium text-foreground leading-normal">
                            {readableTitle}
                          </div>
                          {specs.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {specs.join('  •  ')}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-3.5 text-xs text-muted-foreground">
                          {formatReadableText(m.material_family)}
                        </TableCell>
                        <TableCell className="py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {m.cpse_coverage.map((cpse) => getCpseBadge(cpse))}
                          </div>
                        </TableCell>
                        <TableCell className="py-3.5 text-center text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{m.member_count}</span>
                        </TableCell>
                        <TableCell className="py-3.5">
                          {getStatusBadge(m.governance_status)}
                        </TableCell>
                        <TableCell className="py-3.5 text-right pr-5" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openInspector(m)}
                            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Simple Pagination Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3 border-t border-border bg-muted/10 text-xs text-muted-foreground gap-3">
            <div>
              Showing {materials.length} of {total.toLocaleString()} records
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 px-3 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Previous
              </Button>
              <span className="px-2 text-foreground font-medium">
                {page} of {totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 px-3 text-xs"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </div>

        {/* Clear & Elegant Details Modal View */}
        <Dialog
          open={!!selectedRecord}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedRecord(null);
              setDetailRecord(null);
            }
          }}
        >
          <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6 bg-card border-border rounded-xl shadow-xl">
            {selectedRecord && (
              <div className="space-y-5">
                {/* Header with clear right padding so close X button is completely free */}
                <DialogHeader className="space-y-2 text-left pr-10">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                      {selectedRecord.common_code}
                    </span>
                    {getStatusBadge(selectedRecord.governance_status)}
                  </div>
                  <DialogTitle className="text-base font-semibold text-foreground leading-normal pt-1">
                    {formatReadableText(selectedRecord.common_description)}
                  </DialogTitle>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 pt-0.5">
                    <span>CPSEs: {selectedRecord.cpse_coverage.join(', ')}</span>
                    <span>•</span>
                    <span>{selectedRecord.member_count} Mapped Items</span>
                  </div>
                </DialogHeader>

                {/* Clean Key-Value Specifications List */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Specifications
                  </div>
                  <div className="rounded-lg border border-border divide-y divide-border/60 text-xs">
                    <div className="flex py-2 px-3.5 justify-between">
                      <span className="text-muted-foreground">Material Family</span>
                      <span className="font-medium text-foreground">{formatReadableText(selectedRecord.material_family)}</span>
                    </div>
                    <div className="flex py-2 px-3.5 justify-between">
                      <span className="text-muted-foreground">Material Type</span>
                      <span className="font-medium text-foreground">{formatReadableText(selectedRecord.material_type)}</span>
                    </div>
                    <div className="flex py-2 px-3.5 justify-between">
                      <span className="text-muted-foreground">Material Grade</span>
                      <span className="font-medium text-foreground">{formatReadableText(selectedRecord.material_grade)}</span>
                    </div>
                    <div className="flex py-2 px-3.5 justify-between">
                      <span className="text-muted-foreground">Nominal Size</span>
                      <span className="font-medium text-foreground">{formatReadableText(selectedRecord.nominal_size)}</span>
                    </div>
                    <div className="flex py-2 px-3.5 justify-between">
                      <span className="text-muted-foreground">Pressure Rating</span>
                      <span className="font-medium text-foreground">{formatReadableText(selectedRecord.pressure_rating)}</span>
                    </div>
                    <div className="flex py-2 px-3.5 justify-between">
                      <span className="text-muted-foreground">Standard / Spec</span>
                      <span className="font-medium text-foreground">{formatReadableText(selectedRecord.standard_spec)}</span>
                    </div>
                    <div className="flex py-2 px-3.5 justify-between">
                      <span className="text-muted-foreground">Unit of Measure</span>
                      <span className="font-medium text-foreground">{formatReadableText(selectedRecord.unit_of_measure)}</span>
                    </div>
                  </div>
                </div>

                {/* Clean Mapped Sources List */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Mapped CPSE Sources ({detailRecord?.members?.length || selectedRecord.member_count})
                  </div>
                  <div className="rounded-lg border border-border divide-y divide-border/60 text-xs">
                    {detailLoading ? (
                      <div className="p-4 text-center text-muted-foreground">Loading mapped items...</div>
                    ) : detailRecord?.members && detailRecord.members.length > 0 ? (
                      detailRecord.members.map((mem, i) => (
                        <div key={i} className="p-3 flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {getCpseBadge(mem.source_cpse)}
                              <span className="text-xs font-medium text-foreground">{mem.source_material_code}</span>
                            </div>
                            <div className="text-xs text-muted-foreground leading-normal">
                              {formatReadableText(mem.source_description || selectedRecord.common_description)}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-muted-foreground">
                        Participating CPSEs: {selectedRecord.cpse_coverage.join(', ')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Clean Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <Button asChild variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1 px-2">
                    <Link to={`/common-master/${encodeURIComponent(selectedRecord.common_code)}`}>
                      <ExternalLink className="h-3.5 w-3.5" />
                      View Full Details
                    </Link>
                  </Button>
                  <Button size="sm" onClick={() => setSelectedRecord(null)} className="text-xs px-4">
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
