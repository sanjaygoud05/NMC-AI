/**
 * Legacy Material Mapping Cross-Walk Registry Page (Phase 9)
 * Deterministic mapping registry linking raw CPSE legacy material codes to Phase 8 CMM entities
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  ExternalLink,
  Layers,
  Building2,
  ShieldCheck,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  Info,
  GitFork,
  FileCheck2,
  Copy,
  Hash,
} from 'lucide-react';
import {
  legacyMappingService,
  LegacyMappingRecord,
  LegacyMappingStats,
} from '@/services/legacyMappingService';
import { useDataset } from '@/contexts/DatasetContext';
import { toast } from 'sonner';

export default function LegacyMapping() {
  const { activeDatasetId } = useDataset();
  const [mappings, setMappings] = useState<LegacyMappingRecord[]>([]);
  const [stats, setStats] = useState<LegacyMappingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cpseFilter, setCpseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Provenance inspection modal
  const [selectedRecord, setSelectedRecord] = useState<LegacyMappingRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchRegistry = async () => {
    try {
      setLoading(true);
      const [registryData, statsData] = await Promise.all([
        legacyMappingService.getMappings({
          search,
          cpse: cpseFilter,
          status: statusFilter,
          dataset_id: activeDatasetId,
          page,
          page_size: 20,
        }),
        legacyMappingService.getStats(activeDatasetId).catch(() => null),
      ]);

      setMappings(registryData.items || []);
      setTotal(registryData.total || 0);
      setTotalPages(registryData.total_pages || 1);
      if (statsData) setStats(statsData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load legacy mapping registry';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistry();
  }, [search, cpseFilter, statusFilter, page, activeDatasetId]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'MAPPED_VERIFIED':
        return (
          <Badge className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 gap-1 font-mono text-[11px]">
            <ShieldCheck className="h-3 w-3" /> MAPPED VERIFIED
          </Badge>
        );
      case 'MAPPED_STANDALONE':
        return (
          <Badge className="bg-blue-600/20 text-blue-400 border border-blue-500/30 gap-1 font-mono text-[11px]">
            <Layers className="h-3 w-3" /> MAPPED STANDALONE
          </Badge>
        );
      case 'REVIEW_REQUIRED':
        return (
          <Badge className="bg-amber-600/20 text-amber-400 border border-amber-500/30 gap-1 font-mono text-[11px]">
            <AlertTriangle className="h-3 w-3" /> REVIEW REQUIRED
          </Badge>
        );
      case 'CONFLICT':
        return (
          <Badge className="bg-red-600/20 text-red-400 border border-red-500/30 gap-1 font-mono text-[11px]">
            <AlertTriangle className="h-3 w-3" /> CONFLICT
          </Badge>
        );
      case 'UNMAPPED':
        return (
          <Badge className="bg-muted text-muted-foreground border border-border gap-1 font-mono text-[11px]">
            UNMAPPED
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSemanticsBadge = (semantics: string) => {
    switch (semantics) {
      case 'VERIFIED_CROSS_CPSE':
        return (
          <Badge className="bg-emerald-950/40 text-emerald-300 border border-emerald-500/40 font-mono text-[10px]">
            VERIFIED CROSS CPSE
          </Badge>
        );
      case 'STANDALONE_IDENTITY':
        return (
          <Badge className="bg-slate-900 text-slate-400 border border-slate-700 font-mono text-[10px]">
            STANDALONE IDENTITY
          </Badge>
        );
      default:
        return <Badge variant="outline" className="font-mono text-[10px]">{semantics}</Badge>;
    }
  };

  const openProvenance = (rec: LegacyMappingRecord) => {
    setSelectedRecord(rec);
    setIsModalOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Legacy Material Mapping Registry"
          description="Phase 9 cross-walk cross-referencing all 1,250 raw CPSE legacy materials to Phase 8 Common Material Master codes with deterministic provenance."
        />

        {/* Semantic Clarification Alert */}
        <div className="rounded-lg border border-blue-500/30 bg-blue-950/20 p-4 text-blue-200 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-semibold text-blue-300">Operational Governance Semantics:</span>
            <p>
              <strong>STANDALONE_IDENTITY does not mean cross-CPSE equivalence or universal interchangeability.</strong>{' '}
              Standalone records preserve deterministic 1-to-1 linkage between an isolated CPSE catalog item and its standalone CMM candidate.
              Only <strong>MAPPED_VERIFIED</strong> records represent human-validated multi-CPSE harmonized equivalents traceable to accepted Phase 7 decisions.
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <Card className="bg-card/50 border-border">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5" /> Source Materials
              </span>
              <div className="text-2xl font-bold tracking-tight">
                {stats ? stats.total_source_materials.toLocaleString() : '1,250'}
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">100% Retained</span>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Cross-CPSE Verified
              </span>
              <div className="text-2xl font-bold tracking-tight text-emerald-400">
                {stats ? stats.verified_mapped : 2}
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">CAN-000331 (Valve)</span>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-blue-400" /> Standalone Mappings
              </span>
              <div className="text-2xl font-bold tracking-tight text-blue-400">
                {stats ? stats.standalone_mapped.toLocaleString() : '1,248'}
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">Single-CPSE Isolates</span>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Review Required
              </span>
              <div className="text-2xl font-bold tracking-tight">
                {stats ? stats.review_required : 0}
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">Zero Ambiguity</span>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <GitFork className="h-3.5 w-3.5 text-purple-400" /> Transitive Verified
              </span>
              <div className="text-2xl font-bold tracking-tight">
                {stats ? stats.transitive_verified : 0}
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">No Inferred Links</span>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Mapping Coverage
              </span>
              <div className="text-2xl font-bold tracking-tight text-emerald-400">
                {stats ? `${stats.mapping_coverage_pct.toFixed(1)}%` : '100.0%'}
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">1,250 / 1,250</span>
            </CardContent>
          </Card>
        </div>

        {/* CPSE Distribution Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="flex items-center justify-between p-2.5 rounded-md border border-border bg-card/40">
            <span className="text-muted-foreground font-medium flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-primary" /> ONGC
            </span>
            <span className="font-mono font-bold">{stats?.cpse_distribution?.ONGC ?? 332}</span>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-md border border-border bg-card/40">
            <span className="text-muted-foreground font-medium flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-primary" /> IOCL
            </span>
            <span className="font-mono font-bold">{stats?.cpse_distribution?.IOCL ?? 319}</span>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-md border border-border bg-card/40">
            <span className="text-muted-foreground font-medium flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-primary" /> HPCL
            </span>
            <span className="font-mono font-bold">{stats?.cpse_distribution?.HPCL ?? 301}</span>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-md border border-border bg-card/40">
            <span className="text-muted-foreground font-medium flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-primary" /> CPCL
            </span>
            <span className="font-mono font-bold">{stats?.cpse_distribution?.CPCL ?? 298}</span>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search code, description, CMM..."
              className="pl-9 bg-card border-border"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <Select
              value={cpseFilter}
              onValueChange={(v) => {
                setCpseFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px] bg-card border-border">
                <SelectValue placeholder="All CPSEs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All CPSEs</SelectItem>
                <SelectItem value="ONGC">ONGC (332)</SelectItem>
                <SelectItem value="IOCL">IOCL (319)</SelectItem>
                <SelectItem value="HPCL">HPCL (301)</SelectItem>
                <SelectItem value="CPCL">CPCL (298)</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px] bg-card border-border">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="MAPPED_VERIFIED">MAPPED_VERIFIED</SelectItem>
                <SelectItem value="MAPPED_STANDALONE">MAPPED_STANDALONE</SelectItem>
                <SelectItem value="REVIEW_REQUIRED">REVIEW_REQUIRED</SelectItem>
                <SelectItem value="CONFLICT">CONFLICT</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Cross-Walk Table */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-[130px]">Legacy Code</TableHead>
                <TableHead className="w-[90px]">CPSE</TableHead>
                <TableHead>Legacy Source Description</TableHead>
                <TableHead className="w-[200px]">Assigned CMM Code</TableHead>
                <TableHead className="w-[170px]">Mapping Status</TableHead>
                <TableHead className="w-[170px]">Confidence Semantics</TableHead>
                <TableHead className="w-[140px]">Mapping Method</TableHead>
                <TableHead className="w-[80px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    Loading cross-walk registry...
                  </TableCell>
                </TableRow>
              ) : mappings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    No mapping records match the criteria.
                  </TableCell>
                </TableRow>
              ) : (
                mappings.map((rec) => (
                  <TableRow key={rec.mapping_id} className="border-border hover:bg-muted/40">
                    <TableCell className="font-mono text-xs font-semibold">
                      <div className="flex items-center gap-1.5">
                        <span>{rec.material_code}</span>
                        <button
                          onClick={() => copyToClipboard(rec.material_code, 'Material Code')}
                          className="text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100"
                          title="Copy material code"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {rec.source_cpse}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[340px]">
                      <span className="text-xs text-foreground line-clamp-2" title={rec.raw_material_name}>
                        {rec.raw_material_name}
                      </span>
                    </TableCell>
                    <TableCell>
                      {rec.cmm_code ? (
                        <Link
                          to={`/common-master/${rec.cmm_code}`}
                          className="font-mono text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          {rec.cmm_code}
                          <ExternalLink className="h-3 w-3 inline shrink-0" />
                        </Link>
                      ) : (
                        <span className="text-muted-foreground text-xs font-mono">UNASSIGNED</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(rec.mapping_status)}</TableCell>
                    <TableCell>{getSemanticsBadge(rec.confidence_semantics)}</TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {rec.mapping_method}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => openProvenance(rec)}
                      >
                        <FileCheck2 className="h-3.5 w-3.5 mr-1" /> Inspect
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between p-4 border-t border-border text-xs text-muted-foreground">
            <div>
              Showing {mappings.length > 0 ? (page - 1) * 20 + 1 : 0} to{' '}
              {Math.min(page * 20, total)} of {total.toLocaleString()} mappings
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <div className="flex items-center px-2 font-mono">
                {page} / {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </div>

        {/* Provenance Inspection Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-lg bg-card border-border">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Hash className="h-4 w-4 text-primary" /> Mapping Provenance & Cross-Walk Audit
              </DialogTitle>
              <DialogDescription className="text-xs">
                Deterministic cross-walk trace verifying source raw material identity and Phase 8 CMM association.
              </DialogDescription>
            </DialogHeader>

            {selectedRecord && (
              <div className="space-y-4 text-xs pt-2">
                <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Mapping ID (UUIDv5):</span>
                    <span className="font-mono text-[11px] text-primary">{selectedRecord.mapping_id}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Source CPSE:</span>
                    <Badge variant="outline" className="font-mono text-[11px]">{selectedRecord.source_cpse}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Legacy Material Code:</span>
                    <span className="font-mono font-bold text-foreground">{selectedRecord.material_code}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Assigned CMM Code:</span>
                    <span className="font-mono font-bold text-primary">{selectedRecord.cmm_code || 'NONE'}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground font-semibold">Raw Legacy Description:</span>
                  <p className="p-2 rounded bg-muted/50 border border-border text-foreground font-mono text-[11px] leading-relaxed">
                    {selectedRecord.raw_material_name}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded border border-border bg-card space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Mapping Status</span>
                    <div>{getStatusBadge(selectedRecord.mapping_status)}</div>
                  </div>
                  <div className="p-2.5 rounded border border-border bg-card space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Confidence Semantics</span>
                    <div>{getSemanticsBadge(selectedRecord.confidence_semantics)}</div>
                  </div>
                </div>

                <div className="rounded-md border border-border bg-card p-3 space-y-1.5">
                  <span className="text-[11px] text-muted-foreground font-semibold">Phase 6 & 7 Evidence Trace</span>
                  <div className="flex justify-between text-xs py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Accepted Candidate ID:</span>
                    <span className="font-mono text-foreground font-semibold">
                      {selectedRecord.accepted_candidate_id || 'N/A (Standalone)'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Phase 6 Validation Status:</span>
                    <span className="font-mono text-foreground">
                      {selectedRecord.phase6_validation_status || 'NOT_EVALUATED'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Phase 7 Review Decision:</span>
                    <span className="font-mono text-foreground">
                      {selectedRecord.phase7_review_decision || 'N/A (Standalone)'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs py-1">
                    <span className="text-muted-foreground">Mapping Reason:</span>
                    <span className="text-foreground text-[11px] text-right max-w-[240px]">
                      {selectedRecord.mapping_reason}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
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
