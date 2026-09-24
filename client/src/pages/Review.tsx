import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
  CheckSquare,
} from 'lucide-react';
import { toast } from 'sonner';

export default function Review() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canSubmitDecisions, reviewerKey } = useAuth();

  const [activeTab, setActiveTab] = useState<'potentially_same' | 'different' | 'already_mapped'>('potentially_same');
  const [selectedCpse, setSelectedCpse] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: cpses } = useQuery({
    queryKey: ['nmc', 'cpses-list'],
    queryFn: () => nmcApi.cpses.list(),
  });

  const { data: stats } = useQuery({
    queryKey: ['nmc', 'review-stats', selectedCpse],
    queryFn: () => nmcApi.review.getStats(selectedCpse === 'ALL' ? undefined : selectedCpse),
    refetchInterval: 15000,
  });

  const statusParam =
    activeTab === 'potentially_same'
      ? 'PENDING_REVIEW'
      : activeTab === 'different'
      ? 'DIFFERENT,REJECTED'
      : 'ACCEPTED,OVERRIDDEN';

  const { data: queueData, isLoading } = useQuery({
    queryKey: ['nmc', 'review-queue', selectedCpse, activeTab, page],
    queryFn: () =>
      nmcApi.review.getQueue({
        cpse_id: selectedCpse === 'ALL' ? undefined : selectedCpse,
        status: statusParam,
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

  const pendingCount = stats?.pending ?? 0;
  const differentCount = stats?.different ?? 0;
  const mappedCount = stats?.mapped ?? 0;

  return (
    <AppLayout requireReviewer>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Harmonization Review Queue
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Review and confirm cross-CPSE material equivalences to establish Common Material Master records.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Tabs
            value={activeTab}
            onValueChange={(val: any) => {
              setActiveTab(val);
              setPage(1);
            }}
            className="w-full sm:w-auto"
          >
            <TabsList className="grid w-full sm:w-auto grid-cols-3 h-9">
              <TabsTrigger value="potentially_same" className="text-xs px-3 gap-1.5">
                Potentially Same
                {pendingCount > 0 && (
                  <Badge className="h-4 min-w-4 px-1 text-[9px] bg-primary/20 text-primary border-0 rounded-full">
                    {pendingCount > 9999 ? '9999+' : pendingCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="different" className="text-xs px-3 gap-1.5">
                Different
                {differentCount > 0 && (
                  <Badge className="h-4 min-w-4 px-1 text-[9px] bg-slate-500/15 text-slate-600 dark:text-slate-400 border-0 rounded-full">
                    {differentCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="already_mapped" className="text-xs px-3 gap-1.5">
                Already Mapped
                {mappedCount > 0 && (
                  <Badge className="h-4 min-w-4 px-1 text-[9px] bg-emerald-500/20 text-emerald-600 border-0 rounded-full">
                    {mappedCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Select
                value={selectedCpse}
                onValueChange={(val) => {
                  setSelectedCpse(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[180px] h-9 text-xs">
                  <SelectValue placeholder="Filter by CPSE" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All CPSEs</SelectItem>
                  {cpses?.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
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
                  {activeTab === 'already_mapped' ? (
                    <th className="p-3 min-w-[160px]">NMC Code</th>
                  ) : (
                    <th className="p-3 w-28">Category</th>
                  )}
                  <th className="p-3 w-28 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Loading review queue...
                    </td>
                  </tr>
                ) : !queueData?.items || queueData.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      {activeTab === 'potentially_same'
                        ? 'No matches are currently pending review. Run AI matching from Manage CPSEs to generate matches.'
                        : activeTab === 'different'
                        ? 'No different or rejected matches yet.'
                        : 'No approved mappings yet. Accept a match to create a Common Material Master record.'}
                    </td>
                  </tr>
                ) : (
                  queueData.items.map((m: any) => {
                    const confScore = m.final_confidence ? Math.round(m.final_confidence * 100) : 0;
                    const confLabel = m.confidence_label || 'LOW';
                    const isPending = m.status === 'PENDING_REVIEW';

                    return (
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
                        <td className="p-3">
                          {activeTab === 'already_mapped' ? (
                            m.nmc_code ? (
                              <div>
                                <div className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold text-[10px]">
                                  {m.nmc_code}
                                </div>
                                {m.canonical_description && (
                                  <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                                    {m.canonical_description}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 bg-emerald-500/10">
                                MAPPED
                              </Badge>
                            )
                          ) : (
                            <Badge
                              variant="secondary"
                              className={'text-[10px] ' + (
                                m.match_category === 'POTENTIALLY_SAME'
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {m.match_category}
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                          {isPending && canSubmitDecisions ? (
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
                                title="Inspect Details & Override"
                                onClick={() => navigate('/matches/' + m.id)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              {m.status === 'ACCEPTED' || m.status === 'OVERRIDDEN' ? (
                                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 bg-emerald-500/10 gap-1">
                                  <CheckSquare className="h-2.5 w-2.5" />
                                  {m.status}
                                </Badge>
                              ) : m.status === 'DIFFERENT' || m.status === 'REJECTED' ? (
                                <Badge variant="outline" className="text-[10px] border-border text-muted-foreground bg-muted/50">
                                  {m.status}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px]">
                                  {m.status}
                                </Badge>
                              )}
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
                  })
                )}
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
      </div>
    </AppLayout>
  );
}
