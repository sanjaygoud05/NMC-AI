import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  HelpCircle,
  Loader2,
  Filter,
  Search,
  ArrowRight,
  Sparkles,
  ListOrdered,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  reviewService,
  type ValidatedCandidateRecord,
  type ReviewStats,
} from '@/services/reviewService';
import { useDataset } from '@/contexts/DatasetContext';

export default function Review() {
  const { activeDatasetId, selectDataset } = useDataset();
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [items, setItems] = useState<ValidatedCandidateRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Review state
  const [reviewComment, setReviewComment] = useState('');
  const [filterDecision, setFilterDecision] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('pending');
  const [search, setSearch] = useState('');

  const loadStats = useCallback(async () => {
    try {
      const data = await reviewService.getReviewStats(activeDatasetId);
      setStats(data);
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
        search: search.trim() || undefined,
        dataset_id: activeDatasetId,
      });
      setItems(res.items);
      setTotal(res.total);
      setCurrentIndex(0);
    } catch (err) {
      console.error('Failed to load review queue', err);
    } finally {
      setLoading(false);
    }
  }, [filterDecision, search, activeDatasetId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const currentItem: ValidatedCandidateRecord | undefined = items[currentIndex];

  const handleDecision = async (decision: 'ACCEPT' | 'REJECT' | 'DEFER') => {
    if (!currentItem) return;
    setSubmitting(true);
    try {
      await reviewService.submitDecision(currentItem.candidate_id, {
        decision,
        rationale: reviewComment.trim() || (decision === 'ACCEPT' ? 'Approved by reviewer' : decision === 'REJECT' ? 'Rejected by reviewer' : 'Flagged for further spec review'),
        expected_version: currentItem.decision_version,
      });

      const label = decision === 'ACCEPT' ? 'Approved' : decision === 'REJECT' ? 'Rejected' : 'Marked as Needs Review';
      toast.success(`Match ${currentItem.candidate_id} ${label}`);

      // Update item in local list
      setItems((prev) =>
        prev.map((it, idx) =>
          idx === currentIndex
            ? { ...it, human_decision: decision, human_rationale: reviewComment }
            : it
        )
      );

      // Reset comment
      setReviewComment('');
      loadStats();

      // Automatically advance to next pending item if available
      if (currentIndex < items.length - 1) {
        setCurrentIndex((i) => i + 1);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record review decision';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
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

  const scorePercent = currentItem?.score_percent ?? Math.round((currentItem?.refined_score || currentItem?.final_match_score || 0.74) * 100);
  const pendingCount = items.filter((it) => !it.human_decision || it.human_decision === 'PENDING').length;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/40 pb-4">
          <PageHeader
            title="Review Queue"
            description="Side-by-side engineering attribute comparison and authoritative decision recording"
          />
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="text-xs h-9">
              <a href="/matches">
                View All Matches
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </a>
            </Button>
          </div>
        </div>

        {/* Filter Pills & Quick Jump */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border text-xs">
          <div className="flex flex-wrap items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/50 overflow-x-auto">
            <button
              onClick={() => setFilterDecision('pending')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition-all shrink-0 ${
                filterDecision === 'pending'
                  ? 'bg-background font-semibold text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setFilterDecision('all')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition-all shrink-0 ${
                filterDecision === 'all'
                  ? 'bg-background font-semibold text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({total})
            </button>
            <button
              onClick={() => setFilterDecision('accepted')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition-all shrink-0 ${
                filterDecision === 'accepted'
                  ? 'bg-background font-semibold text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Approved
            </button>
            <button
              onClick={() => setFilterDecision('rejected')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition-all shrink-0 ${
                filterDecision === 'rejected'
                  ? 'bg-background font-semibold text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Rejected
            </button>
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-border/40">
            <Button
              variant="outline"
              size="sm"
              disabled={currentIndex === 0}
              onClick={() => {
                setCurrentIndex((i) => Math.max(0, i - 1));
                setReviewComment('');
              }}
              className="h-8 px-2.5 text-xs rounded-xl"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
            </Button>
            <span className="font-mono text-xs text-muted-foreground">
              {items.length > 0 ? `${currentIndex + 1} / ${items.length}` : '0 / 0'}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentIndex >= items.length - 1}
              onClick={() => {
                setCurrentIndex((i) => Math.min(items.length - 1, i + 1));
                setReviewComment('');
              }}
              className="h-8 px-2.5 text-xs rounded-xl"
            >
              Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>

        {/* Main Review Card matching Image 2 */}
        {loading ? (
          <Card className="p-10 sm:p-16 text-center border-border bg-card rounded-2xl space-y-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
            <p className="text-sm font-medium">Loading match candidate for review...</p>
          </Card>
        ) : !currentItem ? (
          <Card className="p-10 sm:p-16 text-center border-border bg-card rounded-2xl space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <p className="text-base font-semibold text-foreground">Review Queue Cleared</p>
            <p className="text-xs text-muted-foreground">
              {filterDecision === 'pending'
                ? 'All pending matches in this queue partition have been reviewed.'
                : 'No candidate matches match the current filter.'}
            </p>
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilterDecision('all')}
                className="text-xs rounded-xl"
              >
                View All Matches
              </Button>
            </div>
          </Card>
        ) : (
          <div className="bg-card rounded-2xl border border-border/80 shadow-sm p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6 animate-fade-in">
            {/* Header Line matching Image 2: "Match 46 of 312 pending" & "Confidence 74%" */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 text-sm font-medium border-b border-border/40 pb-4">
              <div className="text-foreground font-semibold flex items-center flex-wrap gap-2">
                <span>
                  Match {currentIndex + 1} of {total} {filterDecision === 'pending' ? 'pending' : 'candidates'}
                </span>
                {currentItem.human_decision && currentItem.human_decision !== 'PENDING' && (
                  <Badge
                    className={
                      currentItem.human_decision === 'ACCEPT'
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        : currentItem.human_decision === 'REJECT'
                        ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30'
                    }
                  >
                    {currentItem.human_decision}
                  </Badge>
                )}
              </div>
              <div className="text-muted-foreground text-xs sm:text-sm font-medium">
                Confidence <span className="font-bold text-foreground">{scorePercent}%</span>
              </div>
            </div>

            {/* Mobile Attribute Comparison List (< sm) */}
            <div className="block sm:hidden space-y-2">
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/40 border border-border text-xs">
                <div className="font-semibold text-foreground truncate">
                  {currentItem.source_title || currentItem.source_material_code}
                  <span className="text-muted-foreground font-normal ml-1">({currentItem.source_cpse})</span>
                </div>
                <span className="font-mono text-muted-foreground font-bold">&rarr;</span>
                <div className="font-semibold text-foreground truncate">
                  {currentItem.candidate_title || currentItem.candidate_material_code}
                  <span className="text-muted-foreground font-normal ml-1">({currentItem.candidate_cpse})</span>
                </div>
              </div>

              {['Type', 'Grade', 'Size', 'Coating', 'Unit'].map((attr) => {
                const attrObj = currentItem.attributes?.[attr];
                const sVal = attrObj?.source || '-';
                const cVal = attrObj?.candidate || '-';
                const isDiff =
                  sVal !== '-' &&
                  cVal !== '-' &&
                  sVal.toLowerCase().trim() !== cVal.toLowerCase().trim();

                return (
                  <div key={attr} className="p-2.5 rounded-lg border border-border/60 bg-muted/15 space-y-1">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center justify-between">
                      <span>{attr}</span>
                      {isDiff && <span className="text-[10px] text-rose-500 font-medium">Difference</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-[10px] text-muted-foreground">{currentItem.source_cpse}</div>
                        <div className={`font-medium ${isDiff ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-foreground'}`}>
                          {sVal}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground">{currentItem.candidate_cpse}</div>
                        <div className={`font-medium ${isDiff ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-foreground'}`}>
                          {cVal}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tablet & Desktop Side-by-Side Comparison Table (>= sm) */}
            <div className="hidden sm:block overflow-x-auto rounded-xl border border-border/60 w-full">
              <table className="w-full min-w-[520px] text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border/80 text-muted-foreground">
                    <th className="py-3 px-4 text-left font-medium w-1/4">Attribute</th>
                    <th className="py-3 px-4 text-left font-semibold text-foreground w-3/8">
                      {currentItem.source_title || currentItem.source_material_code} &mdash;{' '}
                      <span className="text-muted-foreground font-normal">{currentItem.source_cpse}</span>
                    </th>
                    <th className="py-3 px-4 text-left font-semibold text-foreground w-3/8">
                      {currentItem.candidate_title || currentItem.candidate_material_code} &mdash;{' '}
                      <span className="text-muted-foreground font-normal">{currentItem.candidate_cpse}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {['Type', 'Grade', 'Size', 'Coating', 'Unit'].map((attr) => {
                    const attrObj = currentItem.attributes?.[attr];
                    const sVal = attrObj?.source || '-';
                    const cVal = attrObj?.candidate || '-';
                    const isDiff =
                      sVal !== '-' &&
                      cVal !== '-' &&
                      sVal.toLowerCase().trim() !== cVal.toLowerCase().trim();

                    return (
                      <tr key={attr} className="hover:bg-muted/15 transition-colors">
                        <td className="py-3 px-4 text-muted-foreground font-medium">{attr}</td>
                        <td
                          className={`py-3 px-4 font-medium ${
                            isDiff ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-foreground'
                          }`}
                        >
                          {sVal}
                        </td>
                        <td
                          className={`py-3 px-4 font-medium ${
                            isDiff ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-foreground'
                          }`}
                        >
                          {cVal}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Optional Comment Textarea matching Image 2 */}
            <div className="pt-2">
              <Textarea
                placeholder="Add a review comment (optional)"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={3}
                className="w-full rounded-xl bg-background border-border/80 text-sm focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60 resize-none p-4"
              />
            </div>

            {/* Action Buttons Bar matching Image 2: Approve (green), Reject (red), Needs review (neutral) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {/* Approve Button (Solid Green) */}
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleDecision('ACCEPT')}
                className="flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all shadow-xs disabled:opacity-50 cursor-pointer active:scale-[0.98]"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 stroke-[2.5]" />
                )}
                Approve
              </button>

              {/* Reject Button (Solid Red) */}
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleDecision('REJECT')}
                className="flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm transition-all shadow-xs disabled:opacity-50 cursor-pointer active:scale-[0.98]"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4 stroke-[2.5]" />
                )}
                Reject
              </button>

              {/* Needs Review / Defer Button */}
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleDecision('DEFER')}
                className="flex items-center justify-center gap-2 py-3 px-6 rounded-xl border border-border/80 bg-background hover:bg-muted text-foreground font-semibold text-sm transition-all disabled:opacity-50 cursor-pointer active:scale-[0.98]"
              >
                Needs review
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
