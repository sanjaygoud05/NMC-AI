import { useState, useEffect, useCallback } from 'react';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
  const [report, setReport] = useState<MatchingReport | null>(null);
  const [matches, setMatches] = useState<MatchCandidateRecord[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [loading, setLoading] = useState(true);
  const [decisions, setDecisions] = useState<Record<string, 'ACCEPT' | 'REJECT' | 'DEFER'>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const activeDataset = datasets.find((d) => d.dataset_id === activeDatasetId);

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

        {/* Candidate Detail / Review Inspection Modal matching Image 2 style */}
        <Dialog open={!!selectedCandidate} onOpenChange={(open) => !open && setSelectedCandidate(null)}>
          <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-4 sm:p-6">
            {selectedCandidate && (
              <div className="space-y-5">
                <DialogHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                    <div>
                      <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                        Match Review: {selectedCandidate.candidate_id}
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                        Rank #{selectedCandidate.candidate_rank} cross-CPSE equivalence assessment
                      </DialogDescription>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span className="font-mono font-bold text-sm text-foreground">
                        {selectedCandidate.score_percent ?? Math.round((selectedCandidate.final_match_score || 0) * 100)}%
                      </span>
                      {getStatusBadge(selectedCandidate.status_tier, selectedCandidate.score_percent ?? Math.round((selectedCandidate.final_match_score || 0) * 100))}
                    </div>
                  </div>
                </DialogHeader>

                {/* Attribute Comparison Table matching Image 2 */}
                <div className="border border-border/80 rounded-xl overflow-x-auto bg-card">
                  <table className="w-full min-w-[440px] text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-muted-foreground font-medium">
                        <th className="p-3 text-left w-28">Attribute</th>
                        <th className="p-3 text-left">
                          <span className="font-semibold text-foreground">
                            {selectedCandidate.source_title || selectedCandidate.source_material_code}
                          </span>{' '}
                          <span className="text-muted-foreground">— {selectedCandidate.source_cpse}</span>
                        </th>
                        <th className="p-3 text-left">
                          <span className="font-semibold text-foreground">
                            {selectedCandidate.candidate_title || selectedCandidate.candidate_material_code}
                          </span>{' '}
                          <span className="text-muted-foreground">— {selectedCandidate.candidate_cpse}</span>
                        </th>
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
                            <td className="p-3 font-semibold text-muted-foreground">{attr}</td>
                            <td className={`p-3 font-medium ${isDiff ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-foreground'}`}>
                              {sVal}
                            </td>
                            <td className={`p-3 font-medium ${isDiff ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-foreground'}`}>
                              {cVal}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Explainable summary quote */}
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground space-y-1">
                  <span className="font-semibold uppercase tracking-wider text-[11px] text-foreground">Evidence:</span>
                  <p className="text-foreground leading-relaxed font-mono text-xs">
                    {selectedCandidate.explainable_summary || selectedCandidate.evidence_summary}
                  </p>
                </div>

                {/* Footer Action Buttons matching Image 2 */}
                <DialogFooter className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedCandidate(null)}
                    className="rounded-xl text-xs h-10 sm:h-9"
                  >
                    Close
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="destructive"
                      disabled={actionLoading[selectedCandidate.candidate_id] || decisions[selectedCandidate.candidate_id] === 'REJECT'}
                      onClick={() => handleDecision(selectedCandidate.candidate_id, 'REJECT')}
                      className="flex-1 sm:flex-initial bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl text-xs h-10 sm:h-9 px-4 gap-1.5"
                    >
                      {actionLoading[selectedCandidate.candidate_id] ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                      &times; Reject
                    </Button>
                    <Button
                      disabled={actionLoading[selectedCandidate.candidate_id] || decisions[selectedCandidate.candidate_id] === 'ACCEPT'}
                      onClick={() => handleDecision(selectedCandidate.candidate_id, 'ACCEPT')}
                      className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-xs h-10 sm:h-9 px-4 gap-1.5 shadow-xs"
                    >
                      {actionLoading[selectedCandidate.candidate_id] ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      &check; Approve
                    </Button>
                  </div>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
