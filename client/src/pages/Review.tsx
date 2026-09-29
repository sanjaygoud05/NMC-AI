import React, { useState, useEffect } from 'react';
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
  Hourglass,
  Bell,
  ShieldAlert,
  CheckCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { getCpseLogo } from '@/lib/cpseLogos';

// Confidence band options for the dropdown filter
const CONF_OPTIONS = [
  { value: 'ALL', label: 'All Confidence' },
  { value: 'HIGH', label: 'High (≥85%)' },
  { value: 'MEDIUM', label: 'Medium (40–84%)' },
  { value: 'LOW', label: 'Low (<40%)' },
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
  const { canSubmitDecisions, reviewerKey, isAdmin, isReviewer, reviewerName, reviewerCpse } = useAuth();

  // Seven top-level tabs: pending | alerts | awaiting_peer | mapped | different | rejected | conflicts (admin-only)
  const [activeTab, setActiveTab] = useState<'pending' | 'alerts' | 'awaiting_peer' | 'mapped' | 'different' | 'rejected' | 'conflicts'>('pending');

  // Confidence band dropdown filter (applies across tabs)
  const [confFilter, setConfFilter] = useState<string>('ALL');

  const [selectedCpse, setSelectedCpse] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: cpses } = useQuery({
    queryKey: ['nmc', 'cpses-list'],
    queryFn: () => nmcApi.cpses.list(),
  });

  // Auto-scope: when reviewer logs in, lock selectedCpse to their CPSE id
  useEffect(() => {
    if (isReviewer && reviewerCpse && cpses && cpses.length > 0) {
      const match = cpses.find((c: any) =>
        c.code?.toUpperCase() === reviewerCpse.toUpperCase()
      );
      if (match) {
        setSelectedCpse(match.id);
      }
    }
  }, [isReviewer, reviewerCpse, cpses]);

  // Guard: Admin should never see or stay on the CPSE-scoped 'alerts' tab
  useEffect(() => {
    if (isAdmin && activeTab === 'alerts') {
      setActiveTab('pending');
    }
  }, [isAdmin, activeTab]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['nmc', 'review-stats', selectedCpse],
    queryFn: () => nmcApi.review.getStats(selectedCpse === 'ALL' ? undefined : selectedCpse),
    refetchInterval: 15000,
  });

  // Build the status param sent to the API
  const statusParam =
    activeTab === 'pending'
      ? 'pending'
      : activeTab === 'alerts'
        ? 'alerts'
        : activeTab === 'awaiting_peer'
          ? 'awaiting_peer'
          : activeTab === 'mapped'
            ? 'ACCEPTED,OVERRIDDEN'
            : activeTab === 'different'
              ? 'DIFFERENT'
              : activeTab === 'conflicts'
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
        reason: 'Review decision from review queue',
        reviewer: reviewerKey || 'Reviewer',
        cpse_code: reviewerCpse || undefined,
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

  // Admin-only override mutation — resolves disputed DIFFERENT-status matches
  const overrideMutation = useMutation({
    mutationFn: ({ matchId, outcome }: { matchId: string; outcome: 'EQUIVALENT' | 'DIFFERENT' }) =>
      nmcApi.review.submitDecision(matchId, {
        decision: 'OVERRIDE',
        override_outcome: outcome,
        reason: outcome === 'EQUIVALENT'
          ? 'Admin override: materials deemed equivalent — National Master Code established'
          : 'Admin override: materials confirmed as distinct — marked Different',
        reviewer: 'Admin',
      }),
    onSuccess: (data) => {
      toast.success(data.message || 'Override applied');
      queryClient.invalidateQueries({ queryKey: ['nmc', 'review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['nmc', 'review-stats'] });
      queryClient.invalidateQueries({ queryKey: ['nmc', 'dashboard-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['nmc', 'cmm-list'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Override failed');
    },
  });

  const pendingCount = stats?.pending ?? stats?.action_needed ?? 0;
  const alertsCount = stats?.alerts ?? 0;
  const awaitingPeerCount = stats?.awaiting_peer ?? 0;
  const mappedCount = stats?.mapped ?? 0;
  const differentCount = stats?.different ?? 0;
  const rejectedCount = stats?.rejected ?? 0;
  // Conflicts = DIFFERENT matches needing admin override (same count as different for admin)
  const conflictsCount = isAdmin ? (stats?.different ?? 0) : 0;

  // ── Derive total-activity state ──────────────────────────────────────────
  const totalActivity = pendingCount + alertsCount + awaitingPeerCount + mappedCount + differentCount + rejectedCount;
  const noCpsesExist = !cpses || cpses.length === 0;
  const noMatchesYet = !statsLoading && totalActivity === 0;

  // ── Context-aware empty state renderer ──
  const renderEmptyContent = (): React.ReactNode => {
    if (activeTab === 'pending') {
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
          <CheckCircle2 className="h-8 w-8 text-emerald-600/60 dark:text-emerald-400/60" />
          <p className="text-sm font-semibold text-foreground">All pending matches reviewed!</p>
          <p className="text-xs text-muted-foreground">No records pending review for the selected filters.</p>
        </div>
      );
    }

    if (activeTab === 'alerts') {
      return (
        <div className="flex flex-col items-center gap-3 py-14">
          <Bell className="h-8 w-8 text-amber-500/50" />
          <p className="text-sm font-semibold text-foreground">No active alerts</p>
          <p className="text-xs text-muted-foreground max-w-sm text-center">
            Alerts appear here when a peer CPSE approves a match (arrives irrespective of confidence, awaiting your confirmation) or when an established National Master Code matches your catalog at ≥85% confidence.
          </p>
          <div className="flex flex-col gap-1.5 mt-1 text-[11px] text-muted-foreground max-w-xs">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-violet-500/70"></span>
              <span><strong className="text-foreground">≥90%</strong> — NMC Priority Match</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500/70"></span>
              <span><strong className="text-foreground">85–89%</strong> — NMC Candidate</span>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'awaiting_peer') {
      return (
        <div className="flex flex-col items-center gap-2 py-14">
          <Hourglass className="h-8 w-8 text-sky-500/50" />
          <p className="text-sm font-semibold text-foreground">No items awaiting peer confirmation</p>
          <p className="text-xs text-muted-foreground max-w-xs text-center">
            When you <strong>Approve</strong> a match (Gate 1), it moves here and waits for the counterpart CPSE to confirm it (Gate 2).
          </p>
        </div>
      );
    }

    if (activeTab === 'mapped') {
      return (
        <div className="flex flex-col items-center gap-2 py-14">
          <Layers className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-semibold text-foreground">No mapped records yet</p>
          <p className="text-xs text-muted-foreground max-w-xs text-center">
            Records appear here after consensus approval establishes a National Master Code.
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

    if (activeTab === 'conflicts') {
      return (
        <div className="flex flex-col items-center gap-3 py-14">
          <ShieldAlert className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-semibold text-foreground">No conflicts requiring resolution</p>
          <p className="text-xs text-muted-foreground max-w-sm text-center">
            Matches flagged as <strong>Different</strong> by reviewers appear here for administrative arbitration.
            Use <strong>Override: Equivalent</strong> to establish an NMC, or <strong>Confirm: Different</strong> to finalise the dispute.
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-2 py-14">
        <XCircle className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-semibold text-foreground">No rejected records yet</p>
        <p className="text-xs text-muted-foreground max-w-xs text-center">
          Records appear here only after a reviewer <strong>Rejects</strong> a match from the Pending queue.
        </p>
      </div>
    );
  };

  // ── Render table rows ──
  const renderTableRows = (): React.ReactNode => {
    const colSpan = activeTab === 'conflicts' ? 8 : 7;
    if (isLoading) {
      return (
        <tr>
          <td colSpan={colSpan} className="p-8 text-center text-muted-foreground">
            Loading review queue...
          </td>
        </tr>
      );
    }
    if (!queueData?.items || queueData.items.length === 0) {
      return (
        <tr>
          <td colSpan={colSpan} className="p-0">
            {renderEmptyContent()}
          </td>
        </tr>
      );
    }

    const displayItems = activeTab === 'pending'
      ? sortByConfidence(queueData.items)
      : activeTab === 'alerts'
        ? queueData.items.filter((m: any) => {
          if (m.match_category === 'ALREADY_MAPPED') {
            return (m.final_confidence ?? 0) >= 0.85;
          }
          return true;
        })
        : queueData.items;

    const rows: React.ReactNode[] = [];

    displayItems.forEach((m: any) => {
      const confScore = m.final_confidence ? Math.round(m.final_confidence * 100) : 0;
      const confLabel = m.confidence_label || 'LOW';

      // Distinguish alert types for the Alerts tab
      const isPeerEndorsementAlert = m.status === 'GATE_1_APPROVED' && (!reviewerCpse || m.gate1_cpse_code !== reviewerCpse);
      const isNmcLinkAlert = m.match_category === 'ALREADY_MAPPED';
      const isHighPriorityNmc = isNmcLinkAlert && (m.final_confidence ?? 0) >= 0.90;

      rows.push(
        <tr
          key={m.id}
          className="hover:bg-muted/30 cursor-pointer transition-colors"
          onClick={() => navigate('/matches/' + m.id, { state: { fromTab: activeTab } })}
        >
          <td className="p-3 font-mono font-semibold text-foreground">
            {m.source_cpse_code || '—'}
          </td>
          <td className="p-3 max-w-[280px]">
            <div className="font-semibold text-foreground text-xs leading-snug truncate" title={m.source_description || m.source_code || '—'}>
              {m.source_description || m.source_code || '—'}
            </div>
            {m.source_code && (
              <div className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">
                {m.source_code}
              </div>
            )}
          </td>
          <td className="p-3 font-mono font-semibold text-foreground">
            {m.candidate_cpse_code || '—'}
          </td>
          <td className="p-3 max-w-[280px]">
            <div className="font-semibold text-foreground text-xs leading-snug truncate" title={m.candidate_description || m.candidate_code || '—'}>
              {m.candidate_description || m.candidate_code || '—'}
            </div>
            {m.candidate_code && (
              <div className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">
                {m.candidate_code}
              </div>
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

          {/* Dispute Reason (shown in Conflicts tab for Admin) */}
          {activeTab === 'conflicts' && (
            <td className="p-3 min-w-[200px] max-w-[280px]">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs">
                  {getCpseLogo(m.dispute_cpse_code || m.source_cpse_code) && (
                    <span className="h-4 w-4 rounded-full overflow-hidden border border-rose-500/30 bg-white inline-flex items-center justify-center shrink-0 p-0.5">
                      <img src={getCpseLogo(m.dispute_cpse_code || m.source_cpse_code)!} alt="" className="h-full w-full object-contain rounded-full" />
                    </span>
                  )}
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 font-mono font-bold border-rose-500/30 text-rose-700 dark:text-rose-300 bg-rose-500/10"
                  >
                    {m.dispute_cpse_code || m.source_cpse_code || 'CPSE'}
                  </Badge>
                  <span className="font-medium text-foreground truncate text-[11px]">
                    {m.dispute_reviewer_name || m.dispute_reviewer || 'Reviewer'}
                  </span>
                </div>
                <p
                  className="text-xs text-muted-foreground line-clamp-2 leading-snug"
                  title={m.dispute_reason || undefined}
                >
                  {m.dispute_reason && m.dispute_reason !== 'Review decision from review queue'
                    ? m.dispute_reason
                    : 'Marked as technically different during peer evaluation'}
                </p>
              </div>
            </td>
          )}

          {/* Status / Stage column */}
          <td className="p-3 text-center">
            <div className="flex items-center justify-center">
              {activeTab === 'alerts' ? (
                isPeerEndorsementAlert ? (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10 text-[11px] font-medium whitespace-nowrap">
                    Peer Endorsed
                  </Badge>
                ) : isHighPriorityNmc ? (
                  <Badge variant="outline" className="border-violet-500/40 text-violet-700 dark:text-violet-300 bg-violet-500/10 text-[11px] font-medium whitespace-nowrap">
                    NMC Priority Match
                  </Badge>
                ) : isNmcLinkAlert ? (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 text-[11px] font-medium whitespace-nowrap">
                    NMC Candidate
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-600 bg-amber-500/10 text-[11px] font-medium whitespace-nowrap">
                    Action Required
                  </Badge>
                )
              ) : activeTab === 'awaiting_peer' ? (
                <Badge variant="outline" className="border-sky-500/40 text-sky-600 dark:text-sky-400 bg-sky-500/10 text-[11px] font-medium whitespace-nowrap">
                  Awaiting Peer ({m.candidate_cpse_code || 'Counterpart'})
                </Badge>
              ) : activeTab === 'pending' ? (
                <span title="Awaiting review decision" className="inline-flex items-center justify-center">
                  <Clock className="h-3.5 w-3.5 text-amber-500/70" />
                </span>
              ) : activeTab === 'conflicts' ? (
                <Badge variant="outline" className="border-rose-500/40 text-rose-700 dark:text-rose-300 bg-rose-500/10 text-[11px] font-semibold whitespace-nowrap">
                  Disputed
                </Badge>
              ) : m.status === 'ACCEPTED' || m.status === 'OVERRIDDEN' ? (
                <span className="font-mono text-xs font-semibold whitespace-nowrap text-emerald-600 dark:text-emerald-400">
                  {m.nmc_code || m.status}
                </span>
              ) : m.status === 'DIFFERENT' ? (
                <span className="font-mono text-xs font-semibold whitespace-nowrap text-amber-600 dark:text-amber-400">
                  DIFFERENT
                </span>
              ) : (
                <span className="font-mono text-xs font-semibold whitespace-nowrap text-rose-600 dark:text-rose-400">
                  {m.status || 'REJECTED'}
                </span>
              )}
            </div>
          </td>

          <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
            {/* Reviewer Pending Tab: Gate 1 Actions */}
            {activeTab === 'pending' && isReviewer && canSubmitDecisions ? (
              <div className="flex items-center justify-end gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-700"
                  title="Gate 1: Approve this match and send to peer CPSE for confirmation"
                  disabled={decisionMutation.isPending}
                  onClick={() => decisionMutation.mutate({ matchId: m.id, decision: 'ACCEPT' })}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                  title="Mark as Different — these are not the same material"
                  disabled={decisionMutation.isPending}
                  onClick={() => decisionMutation.mutate({ matchId: m.id, decision: 'DIFFERENT' })}
                >
                  <Split className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                  title="Reject — poor quality match"
                  disabled={decisionMutation.isPending}
                  onClick={() => decisionMutation.mutate({ matchId: m.id, decision: 'REJECT' })}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="View full details"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/matches/' + m.id, { state: { fromTab: activeTab } });
                  }}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            ) : activeTab === 'alerts' && isReviewer && canSubmitDecisions ? (
              /* Reviewer Alerts Tab: Gate 2 / NMC Link Actions */
              <div className="flex items-center justify-end gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-700"
                  title={isNmcLinkAlert ? 'Accept & Link to NMC' : 'Gate 2: Confirm & Endorse Match (Accept)'}
                  disabled={decisionMutation.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    decisionMutation.mutate({ matchId: m.id, decision: 'ACCEPT' });
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                  title="Mark as Different"
                  disabled={decisionMutation.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    decisionMutation.mutate({ matchId: m.id, decision: 'DIFFERENT' });
                  }}
                >
                  <Split className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                  title="Reject Match"
                  disabled={decisionMutation.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    decisionMutation.mutate({ matchId: m.id, decision: 'REJECT' });
                  }}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="Inspect Details"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/matches/' + m.id, { state: { fromTab: activeTab } });
                  }}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            ) : activeTab === 'conflicts' && isAdmin ? (
              /* Admin Conflict Arbitration — Override buttons */
              <div className="flex items-center justify-end gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-700"
                  title="Override: Equivalent — establish National Master Code"
                  disabled={overrideMutation.isPending}
                  onClick={() => overrideMutation.mutate({ matchId: m.id, outcome: 'EQUIVALENT' })}
                >
                  <CheckCheck className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                  title="Confirm: Different — finalise as distinct materials"
                  disabled={overrideMutation.isPending}
                  onClick={() => overrideMutation.mutate({ matchId: m.id, outcome: 'DIFFERENT' })}
                >
                  <Split className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="Inspect Details"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/matches/' + m.id, { state: { fromTab: activeTab } });
                  }}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              /* Read-only monitoring for all other scenarios (Admin on Pending, Admin on Awaiting Peer, All Mapped, Different, Rejected) */
              <div className="flex items-center justify-end">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="Inspect Details"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/matches/' + m.id, { state: { fromTab: activeTab } });
                  }}
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
          <GitMerge className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-1.5">
          <p className="text-base font-semibold text-foreground">No Matches Yet</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            Once you upload datasets and run the AI Matching Engine on the Manage CPSEs page, all candidate pairs will appear here in the <strong>Pending</strong> queue for your review.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-2 w-full max-w-sm px-4">
          <Link to="/manage-cpses" className="w-full sm:w-auto">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 w-full sm:w-auto">
              <Building2 className="h-3.5 w-3.5" />
              Manage CPSEs
            </Button>
          </Link>
          <Link to="/manage-cpses" className="w-full sm:w-auto">
            <Button size="sm" className="gap-1.5 text-xs h-8 w-full sm:w-auto">
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
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Harmonization Review Queue
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Review and harmonize material codes across CPSEs with human verification and automated audit trails.
            </p>
          </div>
          {/* Matches counter — lives in the header so it's always visible above the CPSE banner */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md border border-border/60">
              <span>Matches:</span>
              <strong className="text-foreground font-mono">{queueData?.total ?? 0}</strong>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>Human decision required</span>
            </div>
          </div>
        </div>

        {/* ── Reviewer CPSE Scoping Banner ── */}
        {isReviewer && reviewerCpse && (
          <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg border border-border/80 bg-muted/40 text-xs text-muted-foreground shadow-2xs">
            {getCpseLogo(reviewerCpse) ? (
              <span className="h-6 w-6 rounded-full overflow-hidden border border-border/80 bg-white inline-flex items-center justify-center shrink-0 p-0.5 shadow-2xs">
                <img
                  src={getCpseLogo(reviewerCpse)!}
                  alt={reviewerCpse}
                  className="h-full w-full object-contain rounded-full"
                />
              </span>
            ) : (
              <Building2 className="h-4 w-4 shrink-0 text-primary" />
            )}
            <span className="leading-relaxed">
              Signed in as <strong className="text-foreground">{reviewerName || 'Reviewer'}</strong>
              {' '}— review queue is scoped exclusively to{' '}
              <strong className="text-foreground uppercase">{reviewerCpse}</strong>.
              Other CPSE records are not accessible.
            </span>
          </div>
        )}

        {/* ── Gateway: No CPSE / No Matches ── */}
        {noMatchesYet && !statsLoading ? (
          <Card className="border-border/60">
            {renderGatewayState()}
          </Card>
        ) : (
          <>
            {/* ── Mobile Toolbar: Dropdown for Queue Status + Filters ── */}
            <div className="flex md:hidden flex-col gap-2 w-full">
              <div className="flex items-center gap-2 w-full">
                {/* Mobile Queue Status Dropdown */}
                <div className="flex-1 min-w-0">
                  <Select
                    value={activeTab}
                    onValueChange={(val: any) => {
                      setActiveTab(val);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full h-9 text-xs font-medium bg-card">
                      <SelectValue placeholder="Queue Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending" className="text-xs">
                        Pending {pendingCount > 0 ? `(${pendingCount > 9999 ? '9999+' : pendingCount})` : ''}
                      </SelectItem>
                      {!isAdmin && (
                        <SelectItem value="alerts" className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                          Action Alerts {alertsCount > 0 ? `(${alertsCount > 9999 ? '9999+' : alertsCount})` : ''}
                        </SelectItem>
                      )}
                      <SelectItem value="awaiting_peer" className="text-xs">
                        Awaiting Peer {awaitingPeerCount > 0 ? `(${awaitingPeerCount > 9999 ? '9999+' : awaitingPeerCount})` : ''}
                      </SelectItem>
                      <SelectItem value="mapped" className="text-xs">
                        All Mapped {mappedCount > 0 ? `(${mappedCount > 9999 ? '9999+' : mappedCount})` : ''}
                      </SelectItem>
                      <SelectItem value="different" className="text-xs">
                        Different {differentCount > 0 ? `(${differentCount > 9999 ? '9999+' : differentCount})` : ''}
                      </SelectItem>
                      <SelectItem value="rejected" className="text-xs text-rose-600 dark:text-rose-400">
                        Rejected {rejectedCount > 0 ? `(${rejectedCount > 9999 ? '9999+' : rejectedCount})` : ''}
                      </SelectItem>
                      {isAdmin && (
                        <SelectItem value="conflicts" className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                          Conflicts {conflictsCount > 0 ? `(${conflictsCount > 9999 ? '9999+' : conflictsCount})` : ''}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Mobile Confidence filter on Pending */}
                {activeTab === 'pending' && (
                  <div className="w-[125px] shrink-0">
                    <Select
                      value={confFilter}
                      onValueChange={(val) => { setConfFilter(val); setPage(1); }}
                    >
                      <SelectTrigger className="w-full h-9 text-xs">
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

                {/* Mobile CPSE Selector for Admin */}
                {isAdmin && (
                  <div className="w-[110px] shrink-0">
                    <Select
                      value={selectedCpse}
                      onValueChange={(val) => { setSelectedCpse(val); setPage(1); }}
                    >
                      <SelectTrigger className="w-full h-9 text-xs truncate">
                        <SelectValue placeholder="CPSE" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL" className="text-xs">All CPSEs</SelectItem>
                        {cpses?.map((c: any) => (
                          <SelectItem key={c.id} value={c.id} className="text-xs">
                            {c.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* ── Desktop Toolbar: tabs scrollable LEFT + filters pinned RIGHT ── */}
            <div className="hidden md:flex items-center gap-2 w-full min-w-0">

              {/* LEFT: Tabs — scroll horizontally, take remaining width */}
              <div className="flex-1 overflow-x-auto pb-0.5 scrollbar-none min-w-0">
                <Tabs
                  value={activeTab}
                  onValueChange={(val: any) => {
                    setActiveTab(val);
                    setPage(1);
                  }}
                  className="w-auto"
                >
                  <TabsList className="inline-flex w-max h-9 p-1 gap-1">
                    {/* Tab 1: Pending */}
                    <TabsTrigger value="pending" className="text-xs px-3 sm:px-4 gap-1.5 whitespace-nowrap">
                      <Clock className="h-3.5 w-3.5 text-amber-500" />
                      Pending
                      {pendingCount > 0 && (
                        <Badge className="h-4 min-w-4 px-1 text-[9px] bg-amber-500/20 text-amber-700 dark:text-amber-300 border-0 rounded-full font-medium">
                          {pendingCount > 9999 ? '9999+' : pendingCount}
                        </Badge>
                      )}
                    </TabsTrigger>

                    {/* Tab 2: Action Alerts (Reviewer only) */}
                    {!isAdmin && (
                      <TabsTrigger value="alerts" className="text-xs px-3 sm:px-4 gap-1.5 whitespace-nowrap">
                        <Bell className={`h-3.5 w-3.5 ${alertsCount > 0 ? 'text-rose-500 animate-pulse' : 'text-muted-foreground'}`} />
                        Action Alerts
                        {alertsCount > 0 && (
                          <Badge className="h-4 min-w-4 px-1.5 text-[9px] bg-rose-500/20 text-rose-700 dark:text-rose-300 border-0 rounded-full font-bold">
                            {alertsCount > 9999 ? '9999+' : alertsCount}
                          </Badge>
                        )}
                      </TabsTrigger>
                    )}

                    {/* Tab 3: Awaiting Peer */}
                    <TabsTrigger value="awaiting_peer" className="text-xs px-3 sm:px-4 gap-1.5 whitespace-nowrap">
                      <Hourglass className="h-3.5 w-3.5 text-sky-500" />
                      Awaiting Peer
                      {awaitingPeerCount > 0 && (
                        <Badge className="h-4 min-w-4 px-1 text-[9px] bg-sky-500/20 text-sky-700 dark:text-sky-300 border-0 rounded-full font-medium">
                          {awaitingPeerCount > 9999 ? '9999+' : awaitingPeerCount}
                        </Badge>
                      )}
                    </TabsTrigger>

                    {/* Tab 4: All Mapped */}
                    <TabsTrigger value="mapped" className="text-xs px-3 sm:px-4 gap-1.5 whitespace-nowrap">
                      <Layers className="h-3.5 w-3.5 text-emerald-500" />
                      All Mapped
                      {mappedCount > 0 && (
                        <Badge className="h-4 min-w-4 px-1 text-[9px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0 rounded-full font-medium">
                          {mappedCount > 9999 ? '9999+' : mappedCount}
                        </Badge>
                      )}
                    </TabsTrigger>

                    {/* Tab 5: Different */}
                    <TabsTrigger value="different" className="text-xs px-3 sm:px-4 gap-1.5 whitespace-nowrap">
                      <Split className="h-3.5 w-3.5 text-amber-500" />
                      Different
                      {differentCount > 0 && (
                        <Badge className="h-4 min-w-4 px-1 text-[9px] bg-amber-500/15 text-amber-700 dark:text-amber-400 border-0 rounded-full font-medium">
                          {differentCount > 9999 ? '9999+' : differentCount}
                        </Badge>
                      )}
                    </TabsTrigger>

                    {/* Tab 6: Rejected */}
                    <TabsTrigger value="rejected" className="text-xs px-3 sm:px-4 gap-1.5 whitespace-nowrap">
                      <XCircle className="h-3.5 w-3.5 text-rose-500" />
                      Rejected
                      {rejectedCount > 0 && (
                        <Badge className="h-4 min-w-4 px-1 text-[9px] bg-destructive/15 text-destructive border-0 rounded-full font-medium">
                          {rejectedCount > 9999 ? '9999+' : rejectedCount}
                        </Badge>
                      )}
                    </TabsTrigger>

                    {/* Tab 7: Conflicts — Admin only */}
                    {isAdmin && (
                      <TabsTrigger value="conflicts" className="text-xs px-3 sm:px-4 gap-1.5 whitespace-nowrap">
                        <ShieldAlert className={`h-3.5 w-3.5 ${conflictsCount > 0 ? 'text-rose-500 animate-pulse' : 'text-muted-foreground'}`} />
                        Conflicts
                        {conflictsCount > 0 && (
                          <Badge className="h-4 min-w-4 px-1.5 text-[9px] bg-rose-500/20 text-rose-700 dark:text-rose-300 border-0 rounded-full font-bold">
                            {conflictsCount > 9999 ? '9999+' : conflictsCount}
                          </Badge>
                        )}
                      </TabsTrigger>
                    )}
                  </TabsList>
                </Tabs>
              </div>

              {/* Thin divider */}
              <div className="h-6 w-px bg-border/60 shrink-0" />

              {/* RIGHT: Filters pinned — same height as tabs */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Confidence Dropdown — only on Pending tab */}
                {activeTab === 'pending' && (
                  <div className="flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <Select
                      value={confFilter}
                      onValueChange={(val) => { setConfFilter(val); setPage(1); }}
                    >
                      <SelectTrigger className="w-[130px] h-9 text-xs">
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

                {/* CPSE Dropdown — locked for reviewers, open for admins */}
                {isReviewer ? (
                  <div className="flex items-center gap-1.5 h-9 px-2.5 w-[160px] rounded-md border border-input bg-muted/40 text-xs text-muted-foreground cursor-not-allowed select-none">
                    {getCpseLogo(reviewerCpse) ? (
                      <span className="h-4 w-4 rounded-full overflow-hidden border border-border/60 bg-white inline-flex items-center justify-center shrink-0 p-0.5">
                        <img src={getCpseLogo(reviewerCpse)!} alt="" className="h-full w-full object-contain rounded-full" />
                      </span>
                    ) : (
                      <Building2 className="h-3 w-3 shrink-0" />
                    )}
                    <span className="font-medium text-foreground truncate">{reviewerCpse}</span>
                    <span className="text-muted-foreground text-[10px] whitespace-nowrap">— Scoped</span>
                  </div>
                ) : (
                  <Select
                    value={selectedCpse}
                    onValueChange={(val) => { setSelectedCpse(val); setPage(1); }}
                  >
                    <SelectTrigger className="w-[150px] h-9 text-xs">
                      <SelectValue placeholder="Filter by CPSE" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="text-xs">All CPSEs</SelectItem>
                      {cpses?.map((c: any) => {
                        const logo = getCpseLogo(c.code, c.name);
                        return (
                          <SelectItem key={c.id} value={c.id} className="text-xs">
                            <div className="flex items-center gap-2">
                              {logo && (
                                <span className="h-4 w-4 rounded-full overflow-hidden border border-border/60 bg-white inline-flex items-center justify-center shrink-0 p-0.5">
                                  <img src={logo} alt="" className="h-full w-full object-contain rounded-full" />
                                </span>
                              )}
                              <span>{c.code}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
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

            {/* ── Direct Table View ── */}
            <Card className="border-border/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="p-3 w-24">Source CPSE</th>
                      <th className="p-3 min-w-[180px]">Source Material</th>
                      <th className="p-3 w-24">Candidate CPSE</th>
                      <th className="p-3 min-w-[180px]">Candidate Material</th>
                      <th className="p-3 w-20">Confidence</th>
                      {activeTab === 'conflicts' && (
                        <th className="p-3 min-w-[200px]">Dispute Reason</th>
                      )}
                      <th className="p-3 min-w-[130px] text-center">Status</th>
                      <th className="p-3 w-36 text-right">Action</th>
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
