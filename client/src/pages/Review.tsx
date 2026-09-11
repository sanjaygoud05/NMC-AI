/**
 * Human Review Queue Page (Phase 7)
 * Authoritative human decision layer for cross-CPSE candidate validation.
 * Supports three-tier queue partitioning (Active: 12,191, Secondary: 4,033, Disqualified: 21,276),
 * 4-layer evidence inspection, side-by-side attribute diffs, atomic versioned decisions, and audit history.
 */

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Info,
  GitCompare,
  History,
  FileSpreadsheet,
  Layers,
} from 'lucide-react';
import {
  reviewService,
  type ValidatedCandidateRecord,
  type ReviewStats,
  type EvidencePackage,
  type ReviewEventRecord,
} from '@/services/reviewService';
import { useDataset } from '@/contexts/DatasetContext';

export default function Review() {
  const { activeDatasetId } = useDataset();
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [items, setItems] = useState<ValidatedCandidateRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Queue Partition View Mode
  // 'active' (12,191), 'secondary' (4,033), 'disqualified' (21,276), 'all' (37,500)
  const [viewMode, setViewMode] = useState<'active' | 'secondary' | 'disqualified' | 'all'>('active');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [decisionFilter, setDecisionFilter] = useState('all');
  const [sourceCpse, setSourceCpse] = useState('all');
  const [candidateCpse, setCandidateCpse] = useState('all');
  const [crossCpseOnly, setCrossCpseOnly] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const pageSize = 25;

  // Selected candidate detail state
  const [selectedCandidate, setSelectedCandidate] = useState<ValidatedCandidateRecord | null>(null);
  const [evidencePackage, setEvidencePackage] = useState<EvidencePackage | null>(null);
  const [evidenceHash, setEvidenceHash] = useState<string>('');
  const [auditHistory, setAuditHistory] = useState<ReviewEventRecord[]>([]);
  const [isReadOnly, setIsReadOnly] = useState(false);

  // Review Form state
  const [reviewerRationale, setReviewerRationale] = useState('');
  const [escalateFlag, setEscalateFlag] = useState(false);
  const [needsSpecSheetFlag, setNeedsSpecSheetFlag] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const data = await reviewService.getReviewStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load review stats', err);
    }
  }, []);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reviewService.getReviewQueue({
        page,
        page_size: pageSize,
        view_mode: viewMode,
        status: statusFilter,
        priority: priorityFilter,
        decision_filter: decisionFilter,
        source_cpse: sourceCpse,
        candidate_cpse: candidateCpse,
        cross_cpse_only: crossCpseOnly,
        search: search.trim() || undefined,
        dataset_id: activeDatasetId,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load review queue', err);
    } finally {
      setLoading(false);
    }
  }, [page, viewMode, statusFilter, priorityFilter, decisionFilter, sourceCpse, candidateCpse, crossCpseOnly, search, activeDatasetId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // Open candidate details modal
  const handleOpenDetail = async (cand: ValidatedCandidateRecord) => {
    setSelectedCandidate(cand);
    setReviewerRationale(cand.human_rationale || '');
    setEscalateFlag(cand.escalated || false);
    setNeedsSpecSheetFlag(cand.needs_spec_sheet || false);

    try {
      const detail = await reviewService.getReviewDetail(cand.candidate_id);
      setEvidencePackage(detail.evidence_package);
      setEvidenceHash(detail.evidence_snapshot_hash);
      setIsReadOnly(detail.is_read_only);

      const hist = await reviewService.getReviewHistory(cand.candidate_id);
      setAuditHistory(hist.events);
    } catch (err) {
      console.error('Failed to load candidate details', err);
      toast.error('Failed to load full candidate evidence');
    }
  };

  const handleDecisionSubmit = async (decisionVerdict: 'ACCEPT' | 'REJECT' | 'DEFER') => {
    if (!selectedCandidate) return;

    if (!reviewerRationale.trim()) {
      toast.error('Please enter a technical rationale before submitting');
      return;
    }

    if ((decisionVerdict === 'REJECT' || decisionVerdict === 'DEFER') && reviewerRationale.trim().length < 10) {
      toast.error(`A detailed rationale (at least 10 characters) is required for ${decisionVerdict}`);
      return;
    }

    setSubmitting(true);
    try {
      await reviewService.submitDecision(selectedCandidate.candidate_id, {
        decision: decisionVerdict,
        rationale: reviewerRationale.trim(),
        escalated: escalateFlag,
        needs_spec_sheet: needsSpecSheetFlag,
        expected_version: selectedCandidate.decision_version,
      });

      toast.success(
        decisionVerdict === 'ACCEPT'
          ? 'Relationship accepted for Phase 8 consideration'
          : `Candidate marked as ${decisionVerdict}`
      );

      setSelectedCandidate(null);
      setReviewerRationale('');
      setEvidencePackage(null);
      loadQueue();
      loadStats();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Submission failed';
      toast.error(errorMsg);
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 text-xs">CRITICAL</Badge>;
      case 'HIGH':
        return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs">HIGH</Badge>;
      case 'MEDIUM':
        return <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 text-xs">MEDIUM</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">LOW</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VALIDATED_COMPATIBLE':
        return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs">Compatible</Badge>;
      case 'PROBABLE_COMPATIBLE':
        return <Badge className="bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30 text-xs">Probable</Badge>;
      case 'REVIEW_REQUIRED':
        return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs">Review Required</Badge>;
      case 'ENGINEERING_INCOMPATIBLE':
        return <Badge variant="destructive" className="text-xs">Incompatible</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case 'ACCEPT':
        return <Badge className="bg-emerald-600 text-white text-xs gap-1"><CheckCircle2 className="h-3 w-3" /> Accepted</Badge>;
      case 'REJECT':
        return <Badge variant="destructive" className="text-xs gap-1"><XCircle className="h-3 w-3" /> Rejected</Badge>;
      case 'DEFER':
        return <Badge className="bg-blue-600 text-white text-xs gap-1"><Clock className="h-3 w-3" /> Deferred</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs text-muted-foreground">Pending Review</Badge>;
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Human Review & Expert Validation"
          description="Phase 7: Authoritative domain engineering review layer for cross-CPSE material candidates."
        />

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {stats?.active_queue_total?.toLocaleString() ?? '12,191'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Active Review Queue (CRITICAL + HIGH)</div>
                </div>
                <div className="p-3 bg-primary/10 rounded-xl text-primary">
                  <GitCompare className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                <span className="text-amber-500 font-semibold">{stats?.pending_active?.toLocaleString() ?? '12,191'}</span> pending triage
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-rose-500">
                    {stats?.critical_pending?.toLocaleString() ?? '7,337'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Critical Priority Pending</div>
                </div>
                <div className="p-3 bg-rose-500/10 rounded-xl text-rose-500">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Soft differences / cross-CPSE conflicts
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-emerald-500">
                    {stats?.accepted?.toLocaleString() ?? '0'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Accepted Relationships</div>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                {stats?.acceptance_rate ?? 0}% acceptance rate
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-destructive">
                    {stats?.disqualified_total?.toLocaleString() ?? '21,276'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Disqualified Archive</div>
                </div>
                <div className="p-3 bg-destructive/10 rounded-xl text-destructive">
                  <ShieldAlert className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Hard incompatibilities segregated
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Three-Tier Queue Partition Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
          <Tabs
            value={viewMode}
            onValueChange={(val) => {
              setViewMode(val as 'active' | 'secondary' | 'disqualified' | 'all');
              setPage(0);
            }}
            className="w-full sm:w-auto"
          >
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full sm:w-auto">
              <TabsTrigger value="active" className="text-xs">
                Active Queue ({stats?.active_queue_total?.toLocaleString() ?? '12,191'})
              </TabsTrigger>
              <TabsTrigger value="secondary" className="text-xs">
                Secondary ({stats?.secondary_queue_total?.toLocaleString() ?? '4,033'})
              </TabsTrigger>
              <TabsTrigger value="disqualified" className="text-xs">
                Disqualified Archive ({stats?.disqualified_total?.toLocaleString() ?? '21,276'})
              </TabsTrigger>
              <TabsTrigger value="all" className="text-xs">
                All Candidates (37,500)
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="text-xs text-muted-foreground font-mono">
            Showing {total.toLocaleString()} candidates in current partition
          </div>
        </div>

        {/* Filter Toolbar */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" /> Filter Candidates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search code, key, reason..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  className="pl-9"
                />
              </div>

              <Select value={decisionFilter} onValueChange={(v) => { setDecisionFilter(v); setPage(0); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Decision" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Decisions</SelectItem>
                  <SelectItem value="pending">Pending Only</SelectItem>
                  <SelectItem value="accepted">Accepted Only</SelectItem>
                  <SelectItem value="rejected">Rejected Only</SelectItem>
                  <SelectItem value="deferred">Deferred Only</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Validation Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="VALIDATED_COMPATIBLE">Validated Compatible</SelectItem>
                  <SelectItem value="PROBABLE_COMPATIBLE">Probable Compatible</SelectItem>
                  <SelectItem value="REVIEW_REQUIRED">Review Required</SelectItem>
                  <SelectItem value="ENGINEERING_INCOMPATIBLE">Engineering Incompatible</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sourceCpse} onValueChange={(v) => { setSourceCpse(v); setPage(0); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Source CPSE" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Source CPSEs</SelectItem>
                  <SelectItem value="IOCL">IOCL</SelectItem>
                  <SelectItem value="ONGC">ONGC</SelectItem>
                  <SelectItem value="HPCL">HPCL</SelectItem>
                  <SelectItem value="BPCL">BPCL</SelectItem>
                  <SelectItem value="CPCL">CPCL</SelectItem>
                </SelectContent>
              </Select>

              <Select value={candidateCpse} onValueChange={(v) => { setCandidateCpse(v); setPage(0); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Candidate CPSE" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Candidate CPSEs</SelectItem>
                  <SelectItem value="IOCL">IOCL</SelectItem>
                  <SelectItem value="ONGC">ONGC</SelectItem>
                  <SelectItem value="HPCL">HPCL</SelectItem>
                  <SelectItem value="BPCL">BPCL</SelectItem>
                  <SelectItem value="CPCL">CPCL</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={crossCpseOnly}
                  onChange={(e) => {
                    setCrossCpseOnly(e.target.checked);
                    setPage(0);
                  }}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                <span className="text-foreground font-medium">Cross-CPSE Candidate Pairs Only</span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Review Queue Table */}
        <Card className="border-border bg-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Priority</TableHead>
                  <TableHead>Source CPSE Material</TableHead>
                  <TableHead>Candidate CPSE Material</TableHead>
                  <TableHead>Validation Status</TableHead>
                  <TableHead>Human Decision</TableHead>
                  <TableHead className="text-right">Refined Score</TableHead>
                  <TableHead>Review Attribution</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      Loading candidate review queue...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      No candidates found matching the selected review filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((cand) => (
                    <TableRow
                      key={cand.candidate_id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleOpenDetail(cand)}
                    >
                      <TableCell>{getPriorityBadge(cand.review_priority)}</TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs font-mono">{cand.source_cpse}</Badge>
                          <span className="font-mono text-xs font-semibold text-foreground">{cand.source_material_code}</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs font-mono">{cand.candidate_cpse}</Badge>
                          <span className="font-mono text-xs font-semibold text-foreground">{cand.candidate_material_code}</span>
                        </div>
                      </TableCell>

                      <TableCell>{getStatusBadge(cand.validation_status)}</TableCell>

                      <TableCell>{getDecisionBadge(cand.human_decision)}</TableCell>

                      <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                        {cand.refined_score.toFixed(3)}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {cand.human_reviewer_email ? (
                          <div className="truncate max-w-[150px]" title={cand.human_reviewer_email}>
                            {cand.human_reviewer_email} (v{cand.decision_version})
                          </div>
                        ) : (
                          <span className="font-mono text-muted-foreground">-</span>
                        )}
                      </TableCell>

                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(cand);
                          }}
                          className="h-7 px-2 text-xs"
                        >
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Page {page + 1} of {Math.max(1, totalPages)} ({total.toLocaleString()} candidates)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Detailed Review Evidence & Decision Modal */}
        <Dialog open={!!selectedCandidate} onOpenChange={(open) => !open && setSelectedCandidate(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            {selectedCandidate && (
              <div className="space-y-6">
                <DialogHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <DialogTitle className="text-lg font-bold flex items-center gap-2">
                        Candidate Pair Review: {selectedCandidate.candidate_id}
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground mt-1">
                        Rank #{selectedCandidate.candidate_rank} match evaluation | Version {selectedCandidate.decision_version}
                      </DialogDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {getPriorityBadge(selectedCandidate.review_priority)}
                      {getStatusBadge(selectedCandidate.validation_status)}
                      {getDecisionBadge(selectedCandidate.human_decision)}
                    </div>
                  </div>
                </DialogHeader>

                {/* Material Comparison Banner */}
                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/40 border border-border">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Source Material</div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-mono">{selectedCandidate.source_cpse}</Badge>
                      <span className="font-mono font-bold text-sm text-foreground">{selectedCandidate.source_material_code}</span>
                    </div>
                    <div className="text-xs font-mono text-muted-foreground truncate" title={selectedCandidate.source_canonical_key}>
                      {selectedCandidate.source_canonical_key || 'No canonical key'}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Candidate Material</div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-mono">{selectedCandidate.candidate_cpse}</Badge>
                      <span className="font-mono font-bold text-sm text-foreground">{selectedCandidate.candidate_material_code}</span>
                    </div>
                    <div className="text-xs font-mono text-muted-foreground truncate" title={selectedCandidate.candidate_canonical_key}>
                      {selectedCandidate.candidate_canonical_key || 'No canonical key'}
                    </div>
                  </div>
                </div>

                {/* Multi-Layer Evidence Tabs */}
                <Tabs defaultValue="diff" className="w-full">
                  <TabsList className="grid grid-cols-3 w-full">
                    <TabsTrigger value="diff" className="text-xs flex items-center gap-1.5">
                      <FileSpreadsheet className="h-3.5 w-3.5" /> Attribute Diff Matrix
                    </TabsTrigger>
                    <TabsTrigger value="evidence" className="text-xs flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5" /> Technical Evidence
                    </TabsTrigger>
                    <TabsTrigger value="history" className="text-xs flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5" /> Audit History ({auditHistory.length})
                    </TabsTrigger>
                  </TabsList>

                  {/* Tab 1: Attribute Diff Matrix */}
                  <TabsContent value="diff" className="space-y-3 mt-3">
                    <div className="rounded-md border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="w-40 text-xs">Attribute</TableHead>
                            <TableHead className="text-xs">Source Material</TableHead>
                            <TableHead className="text-xs">Candidate Material</TableHead>
                            <TableHead className="w-24 text-center text-xs">Diff Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {evidencePackage?.attribute_diff &&
                            Object.entries(evidencePackage.attribute_diff).map(([attr, diff]) => {
                              const isPopulated = diff.source || diff.candidate;
                              if (!isPopulated) return null;
                              return (
                                <TableRow key={attr} className="text-xs font-mono">
                                  <TableCell className="font-semibold text-muted-foreground capitalize">
                                    {attr.replace(/_/g, ' ')}
                                  </TableCell>
                                  <TableCell className="text-foreground">{diff.source || '-'}</TableCell>
                                  <TableCell className="text-foreground">{diff.candidate || '-'}</TableCell>
                                  <TableCell className="text-center">
                                    {diff.status === 'MATCH' && (
                                      <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]">
                                        MATCH
                                      </Badge>
                                    )}
                                    {diff.status === 'DIFF' && (
                                      <Badge variant="destructive" className="text-[10px]">
                                        CONFLICT
                                      </Badge>
                                    )}
                                    {diff.status === 'PARTIAL' && (
                                      <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px]">
                                        PARTIAL
                                      </Badge>
                                    )}
                                    {diff.status === 'NEUTRAL' && (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  {/* Tab 2: Technical Evidence */}
                  <TabsContent value="evidence" className="space-y-4 mt-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-lg bg-card border border-border">
                        <div className="text-xs text-muted-foreground">Refined Score</div>
                        <div className="text-xl font-bold font-mono text-foreground mt-1">
                          {selectedCandidate.refined_score.toFixed(3)}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-card border border-border">
                        <div className="text-xs text-muted-foreground">Embedding Sim</div>
                        <div className="text-xl font-bold font-mono text-foreground mt-1">
                          {(selectedCandidate.embedding_similarity * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-card border border-border">
                        <div className="text-xs text-muted-foreground">Attr Agreement</div>
                        <div className="text-xl font-bold font-mono text-foreground mt-1">
                          {(selectedCandidate.attribute_agreement * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-card border border-border">
                        <div className="text-xs text-muted-foreground">Canonical Key</div>
                        <div className="text-xl font-bold font-mono text-foreground mt-1">
                          {selectedCandidate.canonical_key_exact ? 'EXACT' : 'PARTIAL'}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-card border border-border space-y-2">
                      <div className="text-xs font-semibold uppercase text-muted-foreground">
                        Phase 6 Reason Codes & Conflicts
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedCandidate.validation_reason_codes.split(';').filter(Boolean).map((c) => (
                          <Badge key={c} variant="secondary" className="font-mono text-xs">
                            {c}
                          </Badge>
                        ))}
                      </div>
                      {selectedCandidate.upstream_conflict_present && (
                        <div className="mt-2 text-xs p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-mono">
                          Upstream Conflict: {selectedCandidate.upstream_conflict_details || 'Flagged in Phase 3/4'}
                        </div>
                      )}
                    </div>

                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-1">
                      <div className="text-xs font-semibold uppercase text-primary flex items-center gap-1.5">
                        <Info className="h-4 w-4" /> Cryptographic Evidence Fingerprint
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground break-all">
                        SHA256: {evidenceHash || 'Computing...'}
                      </div>
                    </div>
                  </TabsContent>

                  {/* Tab 3: Audit History */}
                  <TabsContent value="history" className="space-y-3 mt-3">
                    {auditHistory.length === 0 ? (
                      <div className="p-8 text-center text-xs text-muted-foreground">
                        No previous review decisions recorded for this candidate. Currently PENDING.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {auditHistory.map((ev) => (
                          <div key={ev.event_id} className="p-3 rounded-lg border border-border bg-card space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">Version {ev.version}:</span>
                                {getDecisionBadge(ev.new_decision)}
                              </div>
                              <span className="text-muted-foreground font-mono">
                                {new Date(ev.created_at).toLocaleString()}
                              </span>
                            </div>
                            <div className="text-xs text-foreground font-mono bg-muted/30 p-2 rounded">
                              {ev.rationale}
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono pt-1">
                              <span>Reviewer: {ev.reviewer_email} ({ev.reviewer_id})</span>
                              <span title={ev.evidence_snapshot_hash}>Hash: {ev.evidence_snapshot_hash.slice(0, 12)}...</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                {/* Auditable Decision Action Panel */}
                <div className="space-y-4 border-t border-border pt-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground">
                      Technical Reviewer Rationale (Mandatory)
                    </label>
                    <Textarea
                      placeholder="Provide clear technical engineering justification for this review decision..."
                      value={reviewerRationale}
                      onChange={(e) => setReviewerRationale(e.target.value)}
                      className="min-h-[80px] text-xs font-mono"
                      disabled={isReadOnly || submitting}
                    />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Minimum 10 characters required for Reject / Defer.</span>
                      <span>{reviewerRationale.length} characters</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={escalateFlag}
                        onChange={(e) => setEscalateFlag(e.target.checked)}
                        disabled={isReadOnly || submitting}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                      />
                      <span className="text-foreground">Escalate to Senior Engineering Lead</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={needsSpecSheetFlag}
                        onChange={(e) => setNeedsSpecSheetFlag(e.target.checked)}
                        disabled={isReadOnly || submitting}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                      />
                      <span className="text-foreground">Request OEM Technical Datasheet</span>
                    </label>
                  </div>

                  {isReadOnly ? (
                    <div className="p-3 rounded bg-muted text-xs text-muted-foreground text-center">
                      Read-only viewer account. Decision submission controls are disabled.
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-3 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={submitting}
                        onClick={() => handleDecisionSubmit('REJECT')}
                        className="text-destructive border-destructive/30 hover:bg-destructive/10 text-xs gap-1"
                      >
                        <XCircle className="h-4 w-4" /> Reject Candidate
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={submitting}
                        onClick={() => handleDecisionSubmit('DEFER')}
                        className="text-blue-600 border-blue-500/30 hover:bg-blue-500/10 text-xs gap-1"
                      >
                        <Clock className="h-4 w-4" /> Defer Decision
                      </Button>

                      <Button
                        size="sm"
                        disabled={submitting}
                        onClick={() => handleDecisionSubmit('ACCEPT')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Accept for Downstream Master
                      </Button>
                    </div>
                  )}

                  <div className="text-[11px] text-muted-foreground italic border-t border-border pt-3">
                    Note: In compliance with Phase 7 boundaries, ACCEPT marks this candidate relationship as human-reviewed and accepted for downstream Phase 8 consideration. Common Material Master creation, material merging, and common code generation occur in Phase 8.
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
