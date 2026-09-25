import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { nmcApi } from '@/services/nmcApi';
import {
  CheckCircle2,
  XCircle,
  Split,
  ChevronLeft,
  ChevronRight,
  Eye,
  Building2,
  AlertTriangle,
  Filter,
  Clock,
  Layers,
  GitMerge,
  ArrowRight,
  InboxIcon,
} from 'lucide-react';
import { toast } from 'sonner';

// Confidence band options for the dropdown filter
const CONF_OPTIONS = [
  { value: 'ALL',    label: 'All Confidence' },
  { value: 'HIGH',   label: 'High (≥70%)' },
  { value: 'MEDIUM', label: 'Medium (40–69%)' },
  { value: 'LOW',    label: 'Low (<40%)' },
] as const;

// Sort pending records by confidence: HIGH → MEDIUM → LOW then by score desc
const CONF_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
function sortByConfidence(items: any[]): any[] {
  return [...items].sort((a, b) => {
    const la = a.confidence_label || 'LOW';
    const lb = b.confidence_label || 'LOW';
    if (CONF_ORDER[la] !== CONF_ORDER[lb]) return CONF_ORDER[la] - CONF_ORDER[lb];
    return (b.final_confidence ?? 0) - (a.final_confidence ?? 0);
  });
}

export default function Review() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canSubmitDecisions, reviewerKey } = useAuth();

  // Four top-level tabs: pending | different | rejected | mapped
  const [activeTab, setActiveTab] = useState<'pending' | 'mapped' | 'different' | 'rejected'>('pending');

  // Confidence band dropdown filter (applies across tabs)
  const [confFilter, setConfFilter] = useState<string>('ALL');

  const [selectedCpse, setSelectedCpse] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: cpses } = useQuery({
    queryKey: ['nmc', 'cpses-list'],
    queryFn: () => nmcApi.cpses.list(),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['nmc', 'review-stats', selectedCpse],
    queryFn: () => nmcApi.review.getStats(selectedCpse === 'ALL' ? undefined : selectedCpse),
    refetchInterval: 15000,
  });

  // Build the status param sent to the API
  const statusParam =
    activeTab === 'pending'
      ? 'PENDING_REVIEW'
      : activeTab === 'mapped'
        ? 'ACCEPTED,OVERRIDDEN'
        : activeTab === 'different'
          ? 'DIFFERENT'
          : 'REJECTED';

  // Real backend-queried data based on status, cpse, and confidence_label (confidence filter only applies in Pending)
  const { data: queueData, isLoading } = useQuery({
    queryKey: ['nmc', 'review-queue', selectedCpse, activeTab, activeTab === 'pending' ? confFilter : 'ALL', page],
    queryFn: () =>
      nmcApi.review.getQueue({
        cpse_id: selectedCpse === 'ALL' ? undefined : selectedCpse,
        status: statusParam,
        ...(activeTab === 'pending' && confFilter !== 'ALL' ? { confidence_label: confFilter } : {}),
        page,
        page_size: pageSize,
      }),
  });

  const decisionMutation = useMutation({
    mutationFn: ({ matchId, decision }: { matchId: string; decision: 'ACCEPT' | 'REJECT' | 'DIFFERENT' }) =>
      nmcApi.review.submitDecision(matchId, {
        decision,
        reason: 'Quick ' + decision + ' from review queue',
        reviewer: reviewerKey || 'Reviewer',
      }),
    onSuccess: (data) => {
      toast.success(data.message || 'Decision recorded');
      queryClient.invalidateQueries({ queryKey: ['nmc', 'review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['nmc', 'review-stats'] });
      queryClient.invalidateQueries({ queryKey: ['nmc', 'dashboard-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['nmc', 'cmm-list'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to record decision');
    },
  });

  const pendingCount  = stats?.pending  ?? 0;
  const mappedCount   = stats?.mapped   ?? 0;
  const differentCount = stats?.different ?? 0;
  const rejectedCount = stats?.rejected ?? 0;

  // ── Derive total-activity state ──────────────────────────────────────────
  const totalActivity = pendingCount + mappedCount + differentCount + rejectedCount;
  const noCpsesExist  = !cpses || cpses.length === 0;
  const noMatchesYet  = !statsLoading && totalActivity === 0;

  // ── Render table rows ──
  const renderTableRows = (): React.ReactNode => {
    if (isLoading) {
      return (
        <tr>
          <td colSpan={activeTab === 'pending' ? 6 : 7} className="p-8 text-center text-muted-foreground">
            Loading review queue...
          </td>
        </tr>
      );
    }
    if (!queueData?.items || queueData.items.length === 0) {
      // Context-aware empty messages per tab
      const emptyNode = (() => {
        if (activeTab === 'pending') {
          // If zero total activity, this is a "no matches run" scenario
          if (noMatchesYet) {
            return (
              <div className="flex flex-col items-center gap-3 py-16">
                <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                  <GitMerge className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-foreground">No matches generated yet</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Upload and normalize CPSE datasets, then run the AI Matching Engine to generate candidate pairs here.
                  </p>
                </div>
                <Link to="/manage-cpses">
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 mt-1">
                    <Building2 className="h-3.5 w-3.5" />
                    Go to Manage CPSEs
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            );
          }
          return (
            <div className="flex flex-col items-center gap-2 py-14">
              <CheckCircle2 className="h-8 w-8 text-emerald-500/60" />
              <p className="text-sm font-semibold text-foreground">All matches reviewed!</p>
              <p className="text-xs text-muted-foreground">No records pending review for the selected filters.</p>
            </div>
          );
        }

        if (activeTab === 'mapped') {
          return (
            <div className="flex flex-col items-center gap-2 py-14">
              <Layers className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-semibold text-foreground">No mapped records yet</p>
              <p className="text-xs text-muted-foreground max-w-xs text-center">
                Records appear here only after a reviewer <strong>Accepts</strong> a match from the Pending queue.
              </p>
            </div>
          );
        }

        if (activeTab === 'different') {
          return (
            <div className="flex flex-col items-center gap-2 py-14">
              <Split className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-semibold text-foreground">No different records yet</p>
              <p className="text-xs text-muted-foreground max-w-xs text-center">
                Records appear here only after a reviewer marks a Pending match as <strong>Different</strong>.
              </p>
            </div>
          );
        }

        // rejected
        return (
          <div className="flex flex-col items-center gap-2 py-14">
            <XCircle className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-foreground">No rejected records yet</p>
            <p className="text-xs text-muted-foreground max-w-xs text-center">
              Records appear here only after a reviewer <strong>Rejects</strong> a match from the Pending queue.
            </p>
          </div>
        );
      })();

      return (
        <tr>
          <td colSpan={activeTab === 'pending' ? 6 : 7} className="p-0">
            {emptyNode}
          </td>
        </tr>
      );
    }

    const displayItems = activeTab === 'pending'
      ? sortByConfidence(queueData.items)
      : queueData.items;

    const rows: React.ReactNode[] = [];

    displayItems.forEach((m: any) => {
      const confScore = m.final_confidence ? Math.round(m.final_confidence * 100) : 0;
      const confLabel = m.confidence_label || 'LOW';

      rows.push(
        <tr
          key={m.id}
          className="hover:bg-muted/30 cursor-pointer transition-colors"
          onClick={() => navigate('/matches/' + m.id)}
        >
          <td className="p-3 font-mono font-semibold text-foreground">
            {m.source_cpse_code || '—'}
          </td>
          <td className="p-3 font-medium text-foreground max-w-[240px]">
            <div className="truncate">{m.source_description || m.source_code || '—'}</div>
            {m.source_code && (
              <div className="text-[10px] text-muted-foreground font-mono truncate">{m.source_code}</div>
            )}
          </td>
          <td className="p-3 font-mono font-semibold text-foreground">
            {m.candidate_cpse_code || '—'}
          </td>
          <td className="p-3 font-medium text-foreground max-w-[240px]">
            <div className="truncate">{m.candidate_description || m.candidate_code || '—'}</div>
            {m.candidate_code && (
              <div className="text-[10px] text-muted-foreground font-mono truncate">{m.candidate_code}</div>
            )}
          </td>
          <td className="p-3">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-foreground">{confScore}%</span>
              <Badge
                variant="outline"
                className={'text-[9px] px-1 py-0 ' + (
                  confLabel === 'HIGH'
                    ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                    : confLabel === 'MEDIUM'
                      ? 'border-sky-500/30 text-sky-600 dark:text-sky-400 bg-sky-500/10'
                      : 'border-muted text-muted-foreground'
                )}
              >
                {confLabel}
              </Badge>
            </div>
          </td>

          {/* Decision column — green for All Mapped, amber for Different, rose for Rejected */}
          {activeTab !== 'pending' && (
            <td className="p-3">
              {activeTab === 'mapped' ? (
                <span className="font-mono text-xs font-semibold whitespace-nowrap text-emerald-600 dark:text-emerald-400">
                  {m.nmc_code || m.status}
                </span>
              ) : activeTab === 'different' ? (
                <span className="font-mono text-xs font-semibold whitespace-nowrap text-amber-600 dark:text-amber-400">
                  {m.status || 'DIFFERENT'}
                </span>
              ) : activeTab === 'rejected' ? (
                <span className="font-mono text-xs font-semibold whitespace-nowrap text-rose-600 dark:text-rose-400">
                  {m.status || 'REJECTED'}
                </span>
              ) : (
                <span className="font-mono text-xs font-semibold whitespace-nowrap text-foreground">
                  {m.nmc_code || m.status}
                </span>
              )}
            </td>
          )}

          <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
            {activeTab === 'pending' && canSubmitDecisions ? (
              <div className="flex items-center justify-end gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                  title="Accept & Harmonize"
                  disabled={decisionMutation.isPending}
                  onClick={() => decisionMutation.mutate({ matchId: m.id, decision: 'ACCEPT' })}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                  title="Mark as Different"
                  disabled={decisionMutation.isPending}
                  onClick={() => decisionMutation.mutate({ matchId: m.id, decision: 'DIFFERENT' })}
                >
                  <Split className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                  title="Reject Match"
                  disabled={decisionMutation.isPending}
                  onClick={() => decisionMutation.mutate({ matchId: m.id, decision: 'REJECT' })}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="Inspect Details"
                  onClick={() => navigate('/matches/' + m.id)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-end">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="Inspect Details"
                  onClick={() => navigate('/matches/' + m.id)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            )}
          </td>
        </tr>
      );
    });

    return rows;
  };

  // ── Full-page "no data" gateway state ────────────────────────────────────
  const renderGatewayState = () => {
    if (noCpsesExist) {
      return (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="h-16 w-16 rounded-full bg-muted/50 border border-border flex items-center justify-center">
            <Building2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <p className="text-base font-semibold text-foreground">No CPSEs Registered</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Register at least two CPSE enterprises and upload their material datasets before the review queue can be populated.
            </p>
          </div>
          <Link to="/manage-cpses">
            <Button size="sm" className="gap-1.5 text-xs h-8 mt-1">
              <Building2 className="h-3.5 w-3.5" />
              Register CPSEs
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      );
    }

    // CPSEs exist but no matches yet
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <div className="h-16 w-16 rounded-full bg-muted/50 border border-border flex items-center justify-center">
          <InboxIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-1.5">
          <p className="text-base font-semibold text-foreground">No Matches Yet</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            Once you upload datasets and run the AI Matching Engine on the Manage CPSEs page, all candidate pairs will appear here in the <strong>Pending</strong> queue for your review.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Link to="/manage-cpses">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
              <Building2 className="h-3.5 w-3.5" />
              Manage CPSEs
            </Button>
          </Link>
          <Link to="/manage-cpses">
            <Button size="sm" className="gap-1.5 text-xs h-8">
              <GitMerge className="h-3.5 w-3.5" />
              Run Matching Engine
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </div>
    );
  };

  return (
    <AppLayout requireReviewer>
      <div className="space-y-6">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Harmonization Review Queue
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Review and harmonize material codes across CPSEs with human verification and automated audit trails.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs shrink-0">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>Human decision required on all records</span>
          </div>
        </div>

        {/* ── Gateway: No CPSE / No Matches ── */}
        {noMatchesYet && !statsLoading ? (
          <Card className="border-border/60">
            {renderGatewayState()}
          </Card>
        ) : (
          <>
            {/* ── Toolbar: tabs + filters ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Tabs: Pending | Different | Rejected | All Mapped */}
              <Tabs
                value={activeTab}
                onValueChange={(val: any) => {
                  setActiveTab(val);
                  setPage(1);
                }}
                className="w-full sm:w-auto"
              >
                <TabsList className="grid w-full sm:w-auto grid-cols-4 h-9">
                  {/* Tab 1: Pending */}
                  <TabsTrigger value="pending" className="text-xs px-3 sm:px-4 gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Pending
                    {pendingCount > 0 && (
                      <Badge className="h-4 min-w-4 px-1 text-[9px] bg-primary/20 text-primary border-0 rounded-full">
                        {pendingCount > 9999 ? '9999+' : pendingCount}
                      </Badge>
                    )}
                  </TabsTrigger>

                  {/* Tab 2: Different */}
                  <TabsTrigger value="different" className="text-xs px-3 sm:px-4 gap-1.5">
                    <Split className="h-3.5 w-3.5" />
                    Different
                    {differentCount > 0 && (
                      <Badge className="h-4 min-w-4 px-1 text-[9px] bg-amber-500/15 text-amber-700 dark:text-amber-400 border-0 rounded-full">
                        {differentCount > 9999 ? '9999+' : differentCount}
                      </Badge>
                    )}
                  </TabsTrigger>

                  {/* Tab 3: Rejected */}
                  <TabsTrigger value="rejected" className="text-xs px-3 sm:px-4 gap-1.5">
                    <XCircle className="h-3.5 w-3.5" />
                    Rejected
                    {rejectedCount > 0 && (
                      <Badge className="h-4 min-w-4 px-1 text-[9px] bg-destructive/15 text-destructive border-0 rounded-full">
                        {rejectedCount > 9999 ? '9999+' : rejectedCount}
                      </Badge>
                    )}
                  </TabsTrigger>

                  {/* Tab 4: All Mapped */}
                  <TabsTrigger value="mapped" className="text-xs px-3 sm:px-4 gap-1.5">
                    <Layers className="h-3.5 w-3.5" />
                    All Mapped
                    {mappedCount > 0 && (
                      <Badge className="h-4 min-w-4 px-1 text-[9px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0 rounded-full">
                        {mappedCount > 9999 ? '9999+' : mappedCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Filters: Confidence Dropdown (Pending only) + CPSE Dropdown + Matches count */}
              <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                {/* Confidence Dropdown Filter — ONLY in Pending tab */}
                {activeTab === 'pending' && (
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Select
                      value={confFilter}
                      onValueChange={(val) => { setConfFilter(val); setPage(1); }}
                    >
                      <SelectTrigger className="w-[160px] h-9 text-xs">
                        <SelectValue placeholder="Confidence" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONF_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* CPSE Dropdown */}
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Select
                    value={selectedCpse}
                    onValueChange={(val) => { setSelectedCpse(val); setPage(1); }}
                  >
                    <SelectTrigger className="w-[170px] h-9 text-xs">
                      <SelectValue placeholder="Filter by CPSE" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="text-xs">All CPSEs</SelectItem>
                      {cpses?.map((c: any) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.code} — {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  Matches: <strong className="text-foreground">{queueData?.total ?? 0}</strong>
                </div>
              </div>
            </div>

            {/* ── Workflow hint banner — shown only when on a non-pending tab that is empty ── */}
            {activeTab !== 'pending' && !isLoading && (!queueData?.items || queueData.items.length === 0) && pendingCount > 0 && (
              <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg border border-border/80 bg-muted/40 text-xs text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                <span className="leading-relaxed">
                  There {pendingCount === 1 ? 'is' : 'are'} <strong className="text-foreground">{pendingCount}</strong> match{pendingCount === 1 ? '' : 'es'} waiting in the{' '}
                  <button
                    className="font-semibold text-primary underline-offset-2 hover:underline"
                    onClick={() => setActiveTab('pending')}
                  >
                    Pending
                  </button>{' '}
                  tab. Make decisions there to populate this section.
                </span>
              </div>
            )}

            {/* ── Table Card ── */}
            <Card className="border-border/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="p-3 w-28">Source CPSE</th>
                      <th className="p-3 min-w-[200px]">Source Material</th>
                      <th className="p-3 w-28">Candidate CPSE</th>
                      <th className="p-3 min-w-[200px]">Candidate Material</th>
                      <th className="p-3 w-24">Confidence</th>
                      {/* Decision column for Reviewed and All Mapped */}
                      {activeTab !== 'pending' && (
                        <th className="p-3 min-w-[150px]">Decision</th>
                      )}
                      <th className="p-3 w-36 text-right">Human Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {renderTableRows()}
                  </tbody>
                </table>
              </div>

              {queueData && queueData.total_pages > 1 && (
                <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
                  <span>
                    Page {page} of {queueData.total_pages} ({queueData.total} items)
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      disabled={page >= queueData.total_pages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
