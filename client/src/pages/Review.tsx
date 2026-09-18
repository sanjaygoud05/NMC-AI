import { useState, useEffect, useCallback, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Link, useLocation } from 'react-router-dom';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Database,
  Upload,
  Check,
  X,
  Loader2,
  ArrowRight,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  reviewService,
  type ValidatedCandidateRecord,
  type ReviewStats,
} from '@/services/reviewService';
import { useDataset } from '@/contexts/DatasetContext';

interface AttrDiff {
  name: string;
  sourceVal: string;
  candVal: string;
  isDiff: boolean;
}

const PAGE_SIZE = 10;

export default function Review() {
  const { activeDatasetId, selectDataset } = useDataset();
  const location = useLocation();
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [items, setItems] = useState<ValidatedCandidateRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Review & tab state
  const [reviewComment, setReviewComment] = useState('');
  const [filterDecision, setFilterDecision] = useState<'pending' | 'accepted' | 'rejected'>('pending');
  // Track local decisions made in this session (item stays visible with badge)
  const [localDecisions, setLocalDecisions] = useState<Record<string, 'ACCEPT' | 'REJECT' | 'DEFER'>>({});

  // When navigating back from MatchDetail after a decision, pre-seed the badge
  useEffect(() => {
    const state = location.state as { decidedId?: string; decision?: 'ACCEPT' | 'REJECT' | 'DEFER' } | null;
    if (state?.decidedId && state?.decision) {
      setLocalDecisions((prev) => ({ ...prev, [state.decidedId!]: state.decision! }));
      window.history.replaceState({}, '');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track totals per tab so tab badges match list totals 100%
  const [tabTotals, setTabTotals] = useState<{ pending: number; accepted: number; rejected: number }>({
    pending: 0,
    accepted: 0,
    rejected: 0,
  });

  // Page pagination state for Approved & Rejected lists
  const [listPage, setListPage] = useState(0);

  // Filters state: Confidence & Search
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Track expanded cards inline (NO popup)
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const loadStats = useCallback(async () => {
    try {
      const data = await reviewService.getReviewStats(activeDatasetId);
      setStats(data);
      if (data) {
        setTabTotals((prev) => ({
          ...prev,
          pending: data.pending_active,
          accepted: data.accepted,
          rejected: data.rejected,
        }));
      }
    } catch (err) {
      console.error('Failed to load review stats', err);
    }
  }, [activeDatasetId]);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reviewService.getReviewQueue({
        page: 0,
        page_size: 100,
        view_mode: 'active',
        decision_filter: filterDecision,
        dataset_id: activeDatasetId,
      });
      setItems(res.items);
      setTotal(res.total);

      // Sync tab count with actual server response
      setTabTotals((prev) => ({
        ...prev,
        [filterDecision === 'accepted' ? 'accepted' : filterDecision === 'rejected' ? 'rejected' : 'pending']: res.total,
      }));

      setCurrentIndex(0);
      setListPage(0);
      setExpandedIds({});
    } catch (err) {
      console.error('Failed to load review queue', err);
    } finally {
      setLoading(false);
    }
  }, [filterDecision, activeDatasetId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // Client-side filtering for confidence and search
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const score =
        item.score_percent ??
        Math.round((item.refined_score || item.final_match_score || 0.74) * 100);

      // 1. Confidence filter
      if (confidenceFilter === 'high' && score < 90) return false;
      if (confidenceFilter === 'medium' && (score < 70 || score >= 90)) return false;
      if (confidenceFilter === 'low' && score >= 70) return false;

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchSrc =
          (item.source_title || '').toLowerCase().includes(q) ||
          item.source_material_code.toLowerCase().includes(q) ||
          item.source_cpse.toLowerCase().includes(q);
        const matchCand =
          (item.candidate_title || '').toLowerCase().includes(q) ||
          item.candidate_material_code.toLowerCase().includes(q) ||
          item.candidate_cpse.toLowerCase().includes(q);
        const matchId = item.candidate_id.toLowerCase().includes(q);
        if (!matchSrc && !matchCand && !matchId) return false;
      }

      return true;
    });
  }, [items, confidenceFilter, searchQuery]);

  // Page pagination for Approved/Rejected list view
  const totalListPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));

  const currentPageItems = useMemo(() => {
    const start = listPage * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, listPage]);

  const currentItem: ValidatedCandidateRecord | undefined = filteredItems[currentIndex];

  const handleDecision = async (decision: 'ACCEPT' | 'REJECT' | 'DEFER') => {
    if (!currentItem) return;
    setSubmitting(true);
    try {
      const rationale =
        reviewComment.trim() ||
        (decision === 'ACCEPT'
          ? 'Approved by reviewer'
          : decision === 'REJECT'
          ? 'Rejected by reviewer'
          : 'Flagged for further engineering review');

      await reviewService.submitDecision(currentItem.candidate_id, {
        decision,
        rationale,
        expected_version: currentItem.decision_version,
      });

      const label =
        decision === 'ACCEPT'
          ? 'Approved ✓'
          : decision === 'REJECT'
          ? 'Rejected'
          : 'Marked as Needs Review';
      toast.success(`Match ${currentItem.candidate_id} — ${label}`);

      // Mark item with local decision (keeps it visible with badge), then advance
      setLocalDecisions((prev) => ({ ...prev, [currentItem.candidate_id]: decision }));
      setReviewComment('');
      loadStats();

      // Auto-advance to next pending item after a short delay
      setTimeout(() => {
        setItems((prev) => prev.filter((it) => it.candidate_id !== currentItem.candidate_id));
        setCurrentIndex((i) => Math.max(0, i - 1));
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record review decision';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to extract and compare attributes
  const getAttributesAnalysis = (item?: ValidatedCandidateRecord) => {
    if (!item) return { rows: [], diffs: [], diffCount: 0 };
    const attrs = item.attributes || {};
    const defaultKeys = ['Type', 'Grade', 'Size', 'Coating', 'Unit'];
    const keys = Array.from(new Set([...defaultKeys, ...Object.keys(attrs)]));

    const rows: AttrDiff[] = [];
    const diffs: AttrDiff[] = [];

    for (const k of keys) {
      const sVal = attrs[k]?.source?.trim() || '-';
      const cVal = attrs[k]?.candidate?.trim() || '-';
      if (sVal === '-' && cVal === '-' && !defaultKeys.includes(k)) continue;

      const isDiff = sVal !== '-' && cVal !== '-' && sVal.toLowerCase() !== cVal.toLowerCase();
      const row: AttrDiff = { name: k, sourceVal: sVal, candVal: cVal, isDiff };
      rows.push(row);
      if (isDiff) diffs.push(row);
    }

    return { rows, diffs, diffCount: diffs.length };
  };

  const currentAnalysis = useMemo(() => getAttributesAnalysis(currentItem), [currentItem]);

  const hasActiveFilters = confidenceFilter !== 'all' || searchQuery.trim() !== '';

  const resetFilters = () => {
    setConfidenceFilter('all');
    setSearchQuery('');
    setCurrentIndex(0);
    setListPage(0);
  };

  if (activeDatasetId === 'NONE') {
    return (
      <AppLayout>
        <div className="space-y-6">
          <PageHeader
            title="Review Queue"
            description="Authoritative human decision interface for material harmonization equivalence."
          />
          <Card className="border-border bg-card p-12">
            <EmptyState
              icon={Database}
              title="No Dataset Selected"
              description="Upload a material master dataset or select an existing dataset to begin reviewing matches."
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

  const scorePercent =
    currentItem?.score_percent ??
    Math.round((currentItem?.refined_score || currentItem?.final_match_score || 0.74) * 100);

  const pendingCount = tabTotals.pending || items.length;
  const approvedCount = tabTotals.accepted;
  const rejectedCount = tabTotals.rejected;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto px-2 sm:px-4">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/40 pb-4">
          <PageHeader
            title="Review Queue"
            description="Side-by-side engineering attribute comparison and authoritative decision recording"
          />
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="text-xs sm:text-sm h-9">
              <Link to="/matches">
                View All Matches
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Clean Segmented Tab Control + Confidence & Search Filters Bar (Perfect Mobile & Desktop Layout) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card p-2.5 sm:p-3 rounded-xl border border-border text-xs sm:text-sm">
          {/* Section Tabs with Specified Symbols */}
          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-lg border border-border/50 w-full md:w-auto overflow-x-auto shrink-0 no-scrollbar">
            {/* 1. Pending Tab: Yellow Clock */}
            <button
              onClick={() => {
                setFilterDecision('pending');
                setCurrentIndex(0);
                setListPage(0);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer shrink-0 ${
                filterDecision === 'pending'
                  ? 'bg-background font-semibold text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0" />
              <span>Pending</span>
              <span className="text-xs text-muted-foreground ml-0.5">({pendingCount})</span>
            </button>

            {/* 2. Approved Tab: Green Check */}
            <button
              onClick={() => {
                setFilterDecision('accepted');
                setCurrentIndex(0);
                setListPage(0);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer shrink-0 ${
                filterDecision === 'accepted'
                  ? 'bg-background font-semibold text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Approved</span>
              <span className="text-xs text-muted-foreground ml-0.5">({approvedCount})</span>
            </button>

            {/* 3. Rejected Tab: Red X */}
            <button
              onClick={() => {
                setFilterDecision('rejected');
                setCurrentIndex(0);
                setListPage(0);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer shrink-0 ${
                filterDecision === 'rejected'
                  ? 'bg-background font-semibold text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>Rejected</span>
              <span className="text-xs text-muted-foreground ml-0.5">({rejectedCount})</span>
            </button>
          </div>

          {/* FILTERS TOOLBAR: Confidence Filter & Search Input (Visible & Styled on Mobile & Desktop) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto pt-2.5 md:pt-0 border-t md:border-t-0 border-border/40">
            {/* Search Input (100% visible & wide on Mobile & Desktop) */}
            <div className="relative w-full sm:w-56 shrink-0 order-1 sm:order-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search materials..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentIndex(0);
                  setListPage(0);
                }}
                className="pl-9 pr-7 h-10 sm:h-9 text-xs sm:text-sm bg-background rounded-xl border-border w-full shadow-xs focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentIndex(0);
                    setListPage(0);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm font-bold p-1"
                >
                  &times;
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto order-2 sm:order-1">
              {/* Confidence Dropdown Filter */}
              <Select
                value={confidenceFilter}
                onValueChange={(val: 'all' | 'high' | 'medium' | 'low') => {
                  setConfidenceFilter(val);
                  setCurrentIndex(0);
                  setListPage(0);
                }}
              >
                <SelectTrigger className="h-10 sm:h-9 text-xs sm:text-sm flex-1 sm:w-[155px] rounded-xl bg-background border-border shrink-0 font-medium">
                  <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Confidence" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-xs sm:text-sm">
                  <SelectItem value="all">All Confidence</SelectItem>
                  <SelectItem value="high">High (≥ 90%)</SelectItem>
                  <SelectItem value="medium">Medium (70–89%)</SelectItem>
                  <SelectItem value="low">Low (&lt; 70%)</SelectItem>
                </SelectContent>
              </Select>

              {/* Reset Filters button if active */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-10 sm:h-9 px-3 text-xs sm:text-sm text-muted-foreground hover:text-foreground shrink-0 font-medium rounded-xl"
                  title="Reset filters"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Clear
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Filter status indicator badge if filters active */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground px-1 py-0.5">
            <span>
              Showing <strong className="text-foreground">{filteredItems.length}</strong> of{' '}
              {items.length} records{' '}
              {confidenceFilter !== 'all' && (
                <span className="font-medium text-foreground">
                  ({confidenceFilter === 'high' ? 'High ≥90%' : confidenceFilter === 'medium' ? 'Medium 70–89%' : 'Low <70%'})
                </span>
              )}
              {searchQuery && <span> matching "{searchQuery}"</span>}
            </span>
            <button
              onClick={resetFilters}
              className="text-xs text-primary hover:underline cursor-pointer font-medium"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 1: PENDING SECTION (COMPARE & ACTION BUTTONS ARE HERE ONLY)   */}
        {/* ================================================================= */}
        {filterDecision === 'pending' ? (
          loading ? (
            <Card className="p-12 text-center border-border bg-card rounded-xl space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
              <p className="text-xs sm:text-sm text-muted-foreground">Loading match candidate for review...</p>
            </Card>
          ) : filteredItems.length === 0 ? (
            <Card className="p-12 text-center border-border bg-card rounded-xl space-y-2">
              {hasActiveFilters ? (
                <>
                  <SlidersHorizontal className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="text-sm sm:text-base font-semibold text-foreground">No Pending Matches Found</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    No pending candidate matches meet the current confidence or search filter.
                  </p>
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetFilters}
                      className="text-xs sm:text-sm rounded-lg"
                    >
                      Reset Filters
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
                  <p className="text-sm sm:text-base font-semibold text-foreground">Review Queue Cleared</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    All pending candidate matches in this partition have been reviewed.
                  </p>
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilterDecision('accepted')}
                      className="text-xs sm:text-sm rounded-lg"
                    >
                      View Approved Records
                    </Button>
                  </div>
                </>
              )}
            </Card>
          ) : (
            <div className="bg-card rounded-xl border border-border/80 shadow-sm p-4 sm:p-6 space-y-5 animate-fade-in">
              {/* Header: Match counter + Navigation + Confidence + Local decision status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm font-medium border-b border-border/40 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-foreground font-semibold text-sm sm:text-base">
                    Match {currentIndex + 1} of {filteredItems.length} pending
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">
                    ({currentItem?.candidate_id})
                  </span>
                  {/* Show local decision badge if just decided */}
                  {currentItem && localDecisions[currentItem.candidate_id] === 'ACCEPT' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30 animate-fade-in">
                      <CheckCircle2 className="h-3 w-3" /> Approved
                    </span>
                  )}
                  {currentItem && localDecisions[currentItem.candidate_id] === 'REJECT' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-500/15 px-2.5 py-0.5 rounded-full border border-rose-500/30 animate-fade-in">
                      <XCircle className="h-3 w-3" /> Rejected
                    </span>
                  )}
                  {currentItem && localDecisions[currentItem.candidate_id] === 'DEFER' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/30 animate-fade-in">
                      <Clock className="h-3 w-3" /> Needs Review
                    </span>
                  )}
                </div>

                {/* Right: Prev / Next + Confidence */}
                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    Confidence <span className="font-bold text-foreground">{scorePercent}%</span>
                  </div>

                  {filteredItems.length > 1 && (
                    <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/60">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={currentIndex === 0}
                        onClick={() => {
                          setCurrentIndex((i) => Math.max(0, i - 1));
                          setReviewComment('');
                        }}
                        className="h-7 px-2 text-xs rounded-md"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <span className="font-mono text-xs text-muted-foreground px-1">
                        {currentIndex + 1} / {filteredItems.length}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={currentIndex >= filteredItems.length - 1}
                        onClick={() => {
                          setCurrentIndex((i) => Math.min(filteredItems.length - 1, i + 1));
                          setReviewComment('');
                        }}
                        className="h-7 px-2 text-xs rounded-md"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Explicit Difference Mention Banner */}
              {currentAnalysis.diffCount > 0 ? (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 dark:border-rose-500/20 text-xs sm:text-sm text-rose-800 dark:text-rose-300">
                  <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-semibold text-rose-900 dark:text-rose-200">
                      {currentAnalysis.diffCount} Attribute Difference
                      {currentAnalysis.diffCount > 1 ? 's' : ''} Detected:
                    </span>
                    <p className="text-rose-800 dark:text-rose-300/90 leading-relaxed">
                      {currentAnalysis.diffs
                        .map(
                          (d) =>
                            `${d.name}: "${d.sourceVal}" (${currentItem?.source_cpse}) vs "${d.candVal}" (${currentItem?.candidate_cpse})`
                        )
                        .join(' • ')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 dark:border-emerald-500/20 text-xs sm:text-sm text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>
                    Canonical attribute match &mdash; all evaluated specifications match between{' '}
                    <strong>{currentItem?.source_cpse}</strong> and{' '}
                    <strong>{currentItem?.candidate_cpse}</strong>.
                  </span>
                </div>
              )}

              {/* Side-by-Side Comparison Table */}
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground bg-muted/20">
                      <th className="py-2.5 px-3.5 text-left font-medium w-1/4">Attribute</th>
                      <th className="py-2.5 px-3.5 text-left font-semibold text-foreground w-3/8">
                        {currentItem?.source_title || currentItem?.source_material_code}{' '}
                        <span className="text-muted-foreground font-normal">({currentItem?.source_cpse})</span>
                      </th>
                      <th className="py-2.5 px-3.5 text-left font-semibold text-foreground w-3/8">
                        {currentItem?.candidate_title || currentItem?.candidate_material_code}{' '}
                        <span className="text-muted-foreground font-normal">({currentItem?.candidate_cpse})</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {currentAnalysis.rows.map((row) => (
                      <tr
                        key={row.name}
                        className={`transition-colors ${
                          row.isDiff ? 'bg-rose-500/10 dark:bg-rose-500/5' : 'hover:bg-muted/10'
                        }`}
                      >
                        <td className="py-2.5 px-3.5 text-muted-foreground font-medium flex items-center justify-between">
                          <span>{row.name}</span>
                          {row.isDiff && (
                            <span className="text-[10px] text-rose-700 dark:text-rose-400 font-medium px-1.5 py-0.2 rounded bg-rose-500/15 dark:bg-rose-500/20">
                              Differs
                            </span>
                          )}
                        </td>
                        <td
                          className={`py-2.5 px-3.5 ${
                            row.isDiff ? 'text-rose-700 dark:text-rose-300 font-semibold' : 'text-foreground'
                          }`}
                        >
                          {row.sourceVal}
                        </td>
                        <td
                          className={`py-2.5 px-3.5 ${
                            row.isDiff ? 'text-rose-700 dark:text-rose-300 font-semibold' : 'text-foreground'
                          }`}
                        >
                          {row.candVal}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Review Comment Input */}
              <div className="pt-1">
                <Textarea
                  placeholder="Add a review comment (optional)"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg bg-background border-border text-xs sm:text-sm focus:ring-1 focus:ring-primary resize-none p-3"
                />
              </div>

              {/* Action Buttons: ONLY IN PENDING SECTION */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDecision('ACCEPT')}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm transition-all shadow-xs disabled:opacity-50 cursor-pointer active:scale-[0.98]"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 stroke-[2.5]" />}
                  Approve
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDecision('REJECT')}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs sm:text-sm transition-all shadow-xs disabled:opacity-50 cursor-pointer active:scale-[0.98]"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4 stroke-[2.5]" />}
                  Reject
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDecision('DEFER')}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-border bg-background hover:bg-muted text-foreground font-medium text-xs sm:text-sm transition-all disabled:opacity-50 cursor-pointer active:scale-[0.98]"
                >
                  Needs review
                </button>
              </div>
            </div>
          )
        ) : (
          /* ========================================================================= */
          /* TABS 2 & 3: APPROVED & REJECTED SECTIONS (PERFECT MOBILE & PADDING)       */
          /* NO POPUP DIALOG • NO APPROVE/REJECT BUTTONS                              */
          /* ========================================================================= */
          <div className="space-y-3">
            {loading ? (
              <Card className="p-12 text-center border-border bg-card rounded-xl space-y-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                <p className="text-xs sm:text-sm text-muted-foreground">Loading records...</p>
              </Card>
            ) : filteredItems.length === 0 ? (
              <Card className="p-12 text-center border-border bg-card rounded-xl space-y-2">
                {hasActiveFilters ? (
                  <>
                    <SlidersHorizontal className="h-8 w-8 text-muted-foreground mx-auto" />
                    <p className="text-sm sm:text-base font-semibold text-foreground">No Records Matching Filter</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Try adjusting the confidence filter or search query.
                    </p>
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetFilters}
                        className="text-xs sm:text-sm rounded-lg"
                      >
                        Reset Filters
                      </Button>
                    </div>
                  </>
                ) : filterDecision === 'accepted' ? (
                  <>
                    <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
                    <p className="text-sm sm:text-base font-semibold text-foreground">No Approved Records Yet</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Matches approved from the Pending queue will appear in this list.
                    </p>
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFilterDecision('pending')}
                        className="text-xs sm:text-sm rounded-lg"
                      >
                        Go to Pending Queue
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="h-8 w-8 text-rose-400 mx-auto" />
                    <p className="text-sm sm:text-base font-semibold text-foreground">No Rejected Records Yet</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Matches rejected during review will be archived here.
                    </p>
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFilterDecision('pending')}
                        className="text-xs sm:text-sm rounded-lg"
                      >
                        Go to Pending Queue
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            ) : (
              <div className="space-y-3">
                {/* Clean List of Records in Current Page */}
                <div className="space-y-2.5">
                  {currentPageItems.map((item) => {
                    const score =
                      item.score_percent ??
                      Math.round((item.refined_score || item.final_match_score || 0.74) * 100);
                    const isAccepted = filterDecision === 'accepted' || item.human_decision === 'ACCEPT';
                    const isExpanded = !!expandedIds[item.candidate_id];
                    const itemAnalysis = isExpanded ? getAttributesAnalysis(item) : { rows: [], diffs: [], diffCount: 0 };

                    return (
                      <div
                        key={item.candidate_id}
                        className="bg-card rounded-xl border border-border/80 hover:border-border transition-all overflow-hidden"
                      >
                        {/* Card Summary Header: Clickable to toggle attributes inline */}
                        <div
                          onClick={() => toggleExpand(item.candidate_id)}
                          className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                        >
                          {/* Left: Material Info & Comparison */}
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-medium text-xs sm:text-sm text-foreground">
                                {item.candidate_id}
                              </span>

                              {/* Status symbol & badge */}
                              {isAccepted ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 dark:bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30 dark:border-emerald-500/20">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                  Approved
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 dark:text-rose-400 bg-rose-500/15 dark:bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/30 dark:border-rose-500/20">
                                  <XCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                                  Rejected
                                </span>
                              )}

                              <span className="text-xs text-muted-foreground font-medium bg-muted/40 px-2 py-0.5 rounded border border-border/40">
                                Score: {score}%
                              </span>
                            </div>

                            {/* Comparison Pair with Clean Natural Font Weight */}
                            <div className="text-xs sm:text-sm text-foreground leading-relaxed">
                              <span className="text-muted-foreground font-medium">[{item.source_cpse}]</span>{' '}
                              <span className="font-medium text-foreground">{item.source_title || item.source_material_code}</span>
                              <span className="text-muted-foreground mx-1.5 font-normal">&rarr;</span>
                              <span className="text-muted-foreground font-medium">[{item.candidate_cpse}]</span>{' '}
                              <span className="font-medium text-foreground">{item.candidate_title || item.candidate_material_code}</span>
                            </div>

                            {/* High-Impact Audit Metadata (Reviewer, Date & Rationale) */}
                            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap pt-0.5">
                              {item.human_reviewer_email ? (
                                <span>Reviewed by <span className="text-foreground font-medium">{item.human_reviewer_email}</span></span>
                              ) : item.human_reviewer_id ? (
                                <span>Reviewer ID: <span className="text-foreground font-medium">{item.human_reviewer_id}</span></span>
                              ) : null}

                              {item.human_reviewed_at && (
                                <span>&bull; {new Date(item.human_reviewed_at).toLocaleDateString()}</span>
                              )}

                              {item.category && (
                                <span className="bg-muted/40 text-muted-foreground px-2 py-0.5 rounded font-mono text-xs border border-border/40">
                                  {item.category}
                                </span>
                              )}

                              {item.human_rationale && item.human_rationale !== 'Approved by reviewer' && item.human_rationale !== 'Rejected by reviewer' && (
                                <span className="italic text-muted-foreground/90">&bull; "{item.human_rationale}"</span>
                              )}
                            </div>
                          </div>

                          {/* Right: View Attributes + View Match Full Page */}
                          <div className="shrink-0 flex items-center gap-2 self-start sm:self-center pt-1 sm:pt-0">
                            <Button
                              asChild
                              variant="ghost"
                              size="sm"
                              className="h-auto py-2 px-3 text-xs rounded-lg border border-border/60 bg-background hover:bg-muted font-medium gap-1 shadow-xs"
                            >
                              <Link to={`/matches/${item.candidate_id}?from=/review`}>
                                <ArrowRight className="h-3.5 w-3.5" />
                                View Match
                              </Link>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => toggleExpand(item.candidate_id, e)}
                              className="h-auto py-2.5 px-5 sm:px-6 text-xs sm:text-sm rounded-xl border-border/80 bg-background hover:bg-muted/80 font-semibold gap-2 shadow-xs cursor-pointer active:scale-95 transition-all"
                            >
                              <span>{isExpanded ? 'Hide Attributes' : 'View Attributes'}</span>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* INLINE EXPANDED ATTRIBUTES (NO POPUP / MODAL) */}
                        {isExpanded && (
                          <div className="px-3.5 sm:px-4 pb-4 pt-1.5 border-t border-border/50 space-y-3 bg-muted/10 animate-fade-in text-xs sm:text-sm">
                            {/* Difference or Match summary */}
                            {itemAnalysis.diffCount > 0 ? (
                              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 dark:border-rose-500/20 text-xs sm:text-sm text-rose-800 dark:text-rose-300">
                                <span className="font-semibold text-rose-900 dark:text-rose-200">Differences Detected: </span>
                                {itemAnalysis.diffs
                                  .map((d) => `${d.name}: "${d.sourceVal}" (${item.source_cpse}) vs "${d.candVal}" (${item.candidate_cpse})`)
                                  .join(' • ')}
                              </div>
                            ) : (
                              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 dark:border-emerald-500/20 text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span>All compared engineering specifications match identically.</span>
                              </div>
                            )}

                            {/* Side-by-Side Comparison Table */}
                            <div className="rounded-lg border border-border/60 overflow-hidden bg-card">
                              <table className="w-full text-xs sm:text-sm border-collapse">
                                <thead>
                                  <tr className="border-b border-border text-muted-foreground bg-muted/20">
                                    <th className="py-2.5 px-3.5 text-left font-medium w-1/4">Attribute</th>
                                    <th className="py-2.5 px-3.5 text-left font-medium text-foreground w-3/8">
                                      {item.source_cpse} Value
                                    </th>
                                    <th className="py-2.5 px-3.5 text-left font-medium text-foreground w-3/8">
                                      {item.candidate_cpse} Value
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                  {itemAnalysis.rows.map((row) => (
                                    <tr
                                      key={row.name}
                                      className={row.isDiff ? 'bg-rose-500/10 dark:bg-rose-500/5' : 'hover:bg-muted/10'}
                                    >
                                      <td className="py-2.5 px-3.5 text-muted-foreground font-medium flex items-center justify-between">
                                        <span>{row.name}</span>
                                        {row.isDiff && (
                                          <span className="text-[10px] text-rose-700 dark:text-rose-400 font-medium px-1.5 py-0.2 rounded bg-rose-500/15 dark:bg-rose-500/20">
                                            Differs
                                          </span>
                                        )}
                                      </td>
                                      <td className={`py-2.5 px-3.5 ${row.isDiff ? 'text-rose-700 dark:text-rose-300 font-semibold' : 'text-foreground'}`}>
                                        {row.sourceVal}
                                      </td>
                                      <td className={`py-2.5 px-3.5 ${row.isDiff ? 'text-rose-700 dark:text-rose-300 font-semibold' : 'text-foreground'}`}>
                                        {row.candVal}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Page Navigation Footer (Rolled Back Clean Style & Smooth Scroll Top) */}
                {totalListPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border/40 text-xs sm:text-sm text-muted-foreground">
                    <span className="font-mono text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                      Page <strong className="text-foreground font-medium">{listPage + 1}</strong> of{' '}
                      <strong className="text-foreground font-medium">{totalListPages}</strong>
                    </span>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto justify-center sm:justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={listPage === 0}
                        onClick={() => {
                          setListPage((p) => Math.max(0, p - 1));
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="flex-1 sm:flex-initial h-9 px-4 text-xs sm:text-sm rounded-xl font-medium gap-1.5 border-border bg-card hover:bg-muted shadow-xs cursor-pointer disabled:opacity-40"
                      >
                        <ChevronLeft className="h-4 w-4" /> Previous
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={listPage >= totalListPages - 1}
                        onClick={() => {
                          setListPage((p) => Math.min(totalListPages - 1, p + 1));
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="flex-1 sm:flex-initial h-9 px-4 text-xs sm:text-sm rounded-xl font-medium gap-1.5 border-border bg-card hover:bg-muted shadow-xs cursor-pointer disabled:opacity-40"
                      >
                        Next <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
