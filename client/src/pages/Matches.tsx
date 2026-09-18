import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  GitCompare,
  CheckCircle2,
  Layers,
  Sparkles,
  Info,
  ChevronLeft,
  ChevronRight,
  Filter,
  Database,
  Upload,
  Check,
  X,
  Loader2,
  SlidersHorizontal,
  ArrowRight,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { matchingService, type MatchCandidateRecord, type MatchingReport } from '@/services/matchingService';
import { reviewService } from '@/services/reviewService';
import { useDataset } from '@/contexts/DatasetContext';
import { toast } from 'sonner';

export default function Matches() {
  const { activeDatasetId, datasets, selectDataset } = useDataset();
  const location = useLocation();
  const [report, setReport] = useState<MatchingReport | null>(null);
  const [matches, setMatches] = useState<MatchCandidateRecord[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [loading, setLoading] = useState(true);
  const [decisions, setDecisions] = useState<Record<string, 'ACCEPT' | 'REJECT' | 'DEFER'>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const activeDataset = datasets.find((d) => d.dataset_id === activeDatasetId);

  // When navigating back from MatchDetail after a decision, immediately show the badge
  useEffect(() => {
    const state = location.state as { decidedId?: string; decision?: 'ACCEPT' | 'REJECT' | 'DEFER' } | null;
    if (state?.decidedId && state?.decision) {
      setDecisions((prev) => ({ ...prev, [state.decidedId!]: state.decision! }));
      // Clear state from history so refresh doesn't re-apply it
      window.history.replaceState({}, '');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Filters matching Image 1: Confidence, Category, Status
  const [confidenceFilter, setConfidenceFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sourceCpse, setSourceCpse] = useState('all');
  const [candidateCpse, setCandidateCpse] = useState('all');
  const [crossCpseOnly, setCrossCpseOnly] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Selected candidate for side-by-side evidence inspection modal
  const [selectedCandidate, setSelectedCandidate] = useState<MatchCandidateRecord | null>(null);

  const availableCpses = Array.from(
    new Set([
      ...Object.keys(report?.cpse_distribution || {}),
      ...Object.keys(activeDataset?.cpse_summary || {}),
      'IOCL',
      'ONGC',
      'HPCL',
      'BPCL',
      'CPCL',
    ])
  ).filter(Boolean);

  const loadReport = useCallback(async () => {
    try {
      const rep = await matchingService.getMatchingReport(activeDatasetId);
      setReport(rep);
    } catch (err) {
      console.error('Failed to load matching report', err);
    }
  }, [activeDatasetId]);

  const loadMatches = useCallback(async () => {
    setLoading(true);
    try {
      const [matchData, queueData] = await Promise.allSettled([
        matchingService.getMatches({
          skip: page * pageSize,
          limit: pageSize,
          confidence_level: confidenceFilter,
          category: categoryFilter,
          status_filter: statusFilter,
          source_cpse: sourceCpse,
          candidate_cpse: candidateCpse,
          cross_cpse_only: crossCpseOnly,
          search: search.trim() || undefined,
          dataset_id: activeDatasetId,
        }),
        reviewService.getReviewQueue({
          page: 1,
          page_size: 100,
          dataset_id: activeDatasetId,
        }),
      ]);

      if (matchData.status === 'fulfilled') {
        setMatches(matchData.value.matches);
        setTotalMatches(matchData.value.total);
        if (matchData.value.categories && matchData.value.categories.length > 0) {
          setCategories(matchData.value.categories);
        }
      }

      if (queueData.status === 'fulfilled' && queueData.value.items) {
        const decMap: Record<string, 'ACCEPT' | 'REJECT' | 'DEFER'> = {};
        queueData.value.items.forEach((item) => {
          if (item.human_decision && item.human_decision !== 'PENDING') {
            decMap[item.candidate_id] = item.human_decision;
          }
        });
        setDecisions((prev) => ({ ...decMap, ...prev }));
      }
    } catch (err) {
      console.error('Failed to load matches', err);
    } finally {
      setLoading(false);
    }
  }, [page, confidenceFilter, categoryFilter, statusFilter, sourceCpse, candidateCpse, crossCpseOnly, search, activeDatasetId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const handleDecision = async (
    candidateId: string,
    decision: 'ACCEPT' | 'REJECT',
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation();
    setActionLoading((prev) => ({ ...prev, [candidateId]: true }));
    try {
      await reviewService.submitDecision(candidateId, {
        decision,
        rationale: `${decision === 'ACCEPT' ? 'Approved' : 'Rejected'} via Matching & Harmonization`,
      });
      setDecisions((prev) => ({ ...prev, [candidateId]: decision }));
      toast.success(
        `Candidate match ${candidateId} ${decision === 'ACCEPT' ? 'Approved' : 'Rejected'}`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record decision';
      toast.error(msg);
    } finally {
      setActionLoading((prev) => ({ ...prev, [candidateId]: false }));
    }
  };

  const getStatusBadge = (tier: string | undefined, score: number) => {
    const effectiveTier = tier || (score >= 95 ? 'Exact' : score >= 85 ? 'Equivalent' : score >= 60 ? 'Review' : 'Not match');
    switch (effectiveTier) {
      case 'Exact':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300/40">
            Exact
          </span>
        );
      case 'Equivalent':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300/40">
            Equivalent
          </span>
        );
      case 'Review':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/40">
            Review
          </span>
        );
      case 'Not match':
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300/40">
            Not match
          </span>
        );
    }
  };

  const totalPages = Math.ceil(totalMatches / pageSize);

  if (activeDatasetId === 'NONE') {
    return (
      <AppLayout>
        <div className="space-y-6">
          <PageHeader
            title="Matching & Harmonization"
            description="Intelligent multi-blocking, sentence embeddings, null-aware attribute comparison, and explainable equivalence scoring."
          />
          <Card className="border-border bg-card p-12">
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
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-4">
          <PageHeader
            title="Matching & Harmonization"
            description="Cross-CPSE candidate generation, semantic embeddings, and engineering equivalence classification"
          />
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="text-xs h-9">
              <a href="/review">
                Review Queue ({report?.candidate_summary?.total_candidates?.toLocaleString() ?? '37,500'})
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </a>
            </Button>
          </div>
        </div>

        {/* Filter Controls matching Image 1: Confidence, Category, Status */}
        <div className="bg-card p-3 sm:p-4 rounded-2xl border border-border/70 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {/* Confidence Dropdown */}
            <Select
              value={confidenceFilter}
              onValueChange={(val) => {
                setConfidenceFilter(val);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-full h-10 rounded-xl bg-background border-border text-xs font-medium px-3">
                <div className="flex items-center gap-1.5 truncate text-left">
                  <span className="text-muted-foreground shrink-0">Confidence:</span>
                  <span className="font-semibold text-foreground truncate">
                    <SelectValue placeholder="All" />
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">All Confidence</SelectItem>
                <SelectItem value="HIGH">High (&ge; 85%)</SelectItem>
                <SelectItem value="MEDIUM">Medium (60-84%)</SelectItem>
                <SelectItem value="LOW">Low (&lt; 60%)</SelectItem>
              </SelectContent>
            </Select>

            {/* Category Dropdown */}
            <Select
              value={categoryFilter}
              onValueChange={(val) => {
                setCategoryFilter(val);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-full h-10 rounded-xl bg-background border-border text-xs font-medium px-3">
                <div className="flex items-center gap-1.5 truncate text-left">
                  <span className="text-muted-foreground shrink-0">Category:</span>
                  <span className="font-semibold text-foreground truncate">
                    <SelectValue placeholder="All" />
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent className="bg-card border-border max-h-60">
                <SelectItem value="all">All Categories</SelectItem>
                {categories.filter(Boolean).map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Dropdown */}
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-full h-10 rounded-xl bg-background border-border text-xs font-medium px-3">
                <div className="flex items-center gap-1.5 truncate text-left">
                  <span className="text-muted-foreground shrink-0">Status:</span>
                  <span className="font-semibold text-foreground truncate">
                    <SelectValue placeholder="All" />
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Exact">Exact</SelectItem>
                <SelectItem value="Equivalent">Equivalent</SelectItem>
                <SelectItem value="Review">Review</SelectItem>
                <SelectItem value="Not match">Not match</SelectItem>
              </SelectContent>
            </Select>

            {/* Quick Search */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search description, standard..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pl-9 h-10 rounded-xl bg-background border-border text-xs w-full"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-muted-foreground border-t border-border/40">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={crossCpseOnly}
                  onChange={(e) => {
                    setCrossCpseOnly(e.target.checked);
                    setPage(0);
                  }}
                  className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                />
                <span className="text-foreground font-medium text-xs">Cross-CPSE Only</span>
              </label>

              {/* Source CPSE filter with matching Select UI */}
              <div className="flex items-center">
                <Select
                  value={sourceCpse}
                  onValueChange={(val) => {
                    setSourceCpse(val);
                    setPage(0);
                  }}
                >
                  <SelectTrigger className="h-8 rounded-lg bg-background border-border text-xs font-medium px-2.5 min-w-[130px]">
                    <div className="flex items-center gap-1.5 truncate text-left">
                      <span className="text-muted-foreground shrink-0">CPSE:</span>
                      <span className="font-semibold text-foreground truncate">
                        <SelectValue placeholder="All CPSEs" />
                      </span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="all">All CPSEs</SelectItem>
                    {availableCpses.filter(Boolean).map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="font-mono text-xs text-muted-foreground">
              Showing {totalMatches.toLocaleString()} matching candidate pairs
            </div>
          </div>
        </div>

        {/* Candidate List Display matching Image 1 */}
        {loading ? (
          <div className="p-12 text-center text-muted-foreground bg-card rounded-2xl border border-border space-y-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
            <p className="text-sm font-medium">Loading candidate matches...</p>
          </div>
        ) : matches.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground bg-card rounded-2xl border border-border space-y-3">
            <GitCompare className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">No candidate matches found</p>
            <p className="text-xs text-muted-foreground">Try adjusting your filters or search keywords.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map((item) => {
              const currentDecision = decisions[item.candidate_id];
              const isBusy = actionLoading[item.candidate_id];
              const score = item.score_percent ?? Math.round((item.final_match_score || 0) * 100);

              const sourceTitle = item.source_title || item.source_material_code;
              const candidateTitle = item.candidate_title || item.candidate_material_code;

              return (
                <div
                  key={item.candidate_id}
                  onClick={() => setSelectedCandidate(item)}
                  className={`p-4 rounded-xl border transition-all duration-150 cursor-pointer bg-card hover:bg-muted/30 hover:border-border/80 shadow-xs ${
                    currentDecision === 'ACCEPT'
                      ? 'border-emerald-500/40 bg-emerald-500/[0.02]'
                      : currentDecision === 'REJECT'
                      ? 'border-rose-500/40 bg-rose-500/[0.02]'
                      : 'border-border/70'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    {/* Left Column: Material comparison title & Subtitle */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-1.5 text-sm sm:text-base leading-snug break-words [overflow-wrap:anywhere]">
                        <span className="font-bold text-foreground hover:text-primary transition-colors">
                          {sourceTitle}
                        </span>
                        <span className="text-muted-foreground font-normal">
                          ({item.source_cpse})
                        </span>
                        <span className="text-muted-foreground/80 mx-1 font-mono">
                          &rarr;
                        </span>
                        <span className="font-bold text-foreground hover:text-primary transition-colors">
                          {candidateTitle}
                        </span>
                        <span className="text-muted-foreground font-normal">
                          ({item.candidate_cpse})
                        </span>
                      </div>

                      {/* Subtitle matching Image 1: Explainable Summary */}
                      <p className="text-xs text-muted-foreground leading-relaxed break-words">
                        {item.explainable_summary || 'Multi-attribute canonical evaluation completed'}
                      </p>
                    </div>

                    {/* Right Column: Score % + Status Badge matching Image 1 */}
                    <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
                      <span className="font-bold font-mono text-base text-foreground">
                        {score}%
                      </span>
                      {getStatusBadge(item.status_tier, score)}

                      {/* Decision Badge if already reviewed */}
                      {currentDecision === 'ACCEPT' && (
                        <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-semibold py-0.5 px-2">
                          APPROVED
                        </Badge>
                      )}
                      {currentDecision === 'REJECT' && (
                        <Badge className="bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[11px] font-semibold py-0.5 px-2">
                          REJECTED
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="text-xs text-muted-foreground text-center sm:text-left">
            Page {page + 1} of {Math.max(1, totalPages)} ({totalMatches.toLocaleString()} pairs)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="h-8 text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="h-8 text-xs"
            >
              Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>

        {/* Candidate Detail / Review Inspection Modal */}
        <Dialog open={!!selectedCandidate} onOpenChange={(open) => !open && setSelectedCandidate(null)}>
          <DialogContent
            hideCloseButton
            className={[
              // Mobile: override base centering — float up from bottom with side margins
              '!top-auto !bottom-0 !left-3 !right-3',
              '!translate-x-0 !translate-y-0',
              '!w-auto !max-w-full rounded-2xl mb-3',
              // Desktop: centered, compact width
              'sm:!top-1/2 sm:!bottom-auto sm:!left-1/2 sm:!right-auto',
              'sm:!translate-x-[-50%] sm:!translate-y-[-50%]',
              'sm:!w-[480px] sm:!max-w-[90vw] sm:mb-0',
              // Shared layout
              'max-h-[88vh] sm:max-h-[88vh] overflow-hidden flex flex-col',
              'p-0 gap-0 border-border bg-card shadow-2xl',
            ].join(' ')}
          >
            {selectedCandidate && (
              <>
                {/* Drag handle — mobile only */}
                <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
                  <div className="w-10 h-1 rounded-full bg-border" />
                </div>

                {/* Header */}
                <div className="flex items-start justify-between gap-3 px-4 sm:px-5 pt-4 sm:pt-5 pb-3 border-b border-border shrink-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">
                      {selectedCandidate.candidate_id} · Rank #{selectedCandidate.candidate_rank}
                    </p>
                    <DialogTitle className="text-sm sm:text-base font-bold text-foreground leading-tight">
                      Match Review
                    </DialogTitle>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-bold text-sm text-foreground">
                      {selectedCandidate.score_percent ?? Math.round((selectedCandidate.final_match_score || 0) * 100)}%
                    </span>
                    {getStatusBadge(selectedCandidate.status_tier, selectedCandidate.score_percent ?? Math.round((selectedCandidate.final_match_score || 0) * 100))}
                    <button
                      onClick={() => setSelectedCandidate(null)}
                      className="ml-1 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">

                  {/* Material pair summary */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-xl bg-background border border-border space-y-0.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Source</p>
                      <p className="text-xs font-bold text-foreground truncate">
                        {selectedCandidate.source_title || selectedCandidate.source_material_code}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{selectedCandidate.source_cpse}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-background border border-border space-y-0.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Candidate</p>
                      <p className="text-xs font-bold text-foreground truncate">
                        {selectedCandidate.candidate_title || selectedCandidate.candidate_material_code}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{selectedCandidate.candidate_cpse}</p>
                    </div>
                  </div>

                  {/* Attribute Comparison Table */}
                  <div className="border border-border/80 rounded-xl overflow-x-auto bg-card">
                    <table className="w-full min-w-[360px] text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 text-muted-foreground font-medium">
                          <th className="p-2.5 text-left w-20 text-[11px]">Attribute</th>
                          <th className="p-2.5 text-left text-[11px]">Source</th>
                          <th className="p-2.5 text-left text-[11px]">Candidate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {['Type', 'Grade', 'Size', 'Coating', 'Unit'].map((attr) => {
                          const attrObj = selectedCandidate.attributes?.[attr];
                          const sVal = attrObj?.source || '-';
                          const cVal = attrObj?.candidate || '-';
                          const isDiff = sVal !== '-' && cVal !== '-' && sVal.toLowerCase() !== cVal.toLowerCase();
                          return (
                            <tr key={attr} className="hover:bg-muted/20 transition-colors">
                              <td className="p-2.5 font-semibold text-muted-foreground text-[11px]">{attr}</td>
                              <td className={`p-2.5 font-medium ${isDiff ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-foreground'}`}>
                                {sVal}
                              </td>
                              <td className={`p-2.5 font-medium ${isDiff ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-foreground'}`}>
                                {cVal}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Evidence */}
                  <div className="p-3 rounded-xl bg-muted/40 border border-border">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Evidence</p>
                    <p className="text-xs text-foreground leading-relaxed font-mono">
                      {selectedCandidate.explainable_summary || selectedCandidate.evidence_summary || 'Multi-attribute canonical evaluation completed.'}
                    </p>
                  </div>
                </div>

                {/* Footer — sticky at bottom */}
                <div className="shrink-0 border-t border-border px-4 sm:px-5 py-3 sm:py-4 bg-card space-y-2">
                  {/* Row 1: Reject / Approve */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="destructive"
                      disabled={actionLoading[selectedCandidate.candidate_id] || decisions[selectedCandidate.candidate_id] === 'REJECT'}
                      onClick={() => handleDecision(selectedCandidate.candidate_id, 'REJECT')}
                      className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-xs h-10 gap-1.5"
                    >
                      {actionLoading[selectedCandidate.candidate_id] ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                      {decisions[selectedCandidate.candidate_id] === 'REJECT' ? 'Rejected' : 'Reject'}
                    </Button>
                    <Button
                      disabled={actionLoading[selectedCandidate.candidate_id] || decisions[selectedCandidate.candidate_id] === 'ACCEPT'}
                      onClick={() => handleDecision(selectedCandidate.candidate_id, 'ACCEPT')}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs h-10 gap-1.5"
                    >
                      {actionLoading[selectedCandidate.candidate_id] ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      {decisions[selectedCandidate.candidate_id] === 'ACCEPT' ? 'Approved' : 'Approve'}
                    </Button>
                  </div>
                  {/* Row 2: View Full Detail only */}
                  <Button asChild variant="outline" size="sm" className="w-full rounded-xl text-xs h-9 gap-1.5">
                    <Link
                      to={`/matches/${selectedCandidate.candidate_id}?from=/matches`}
                      onClick={() => setSelectedCandidate(null)}
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      View Full Detail
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
