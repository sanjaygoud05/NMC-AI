import React, { useState } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { nmcApi } from '@/services/nmcApi';
import {
  ArrowLeft,
  CheckCircle2,
  CheckCheck,
  XCircle,
  Split,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  LinkIcon,
  Clock,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { getCpseLogo } from '@/lib/cpseLogos';

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { canSubmitDecisions, isAdmin, reviewerKey, reviewerName, reviewerCpse } = useAuth();

  const fromTab = searchParams.get('fromTab') || (location.state as any)?.fromTab || 'pending';

  const backLabel =
    fromTab === 'alerts'
      ? 'Back to Action Alerts'
      : fromTab === 'conflicts'
        ? 'Back to Conflicts'
        : fromTab === 'awaiting_peer'
          ? 'Back to Awaiting Peer'
          : fromTab === 'mapped'
            ? 'Back to All Mapped'
            : fromTab === 'different'
              ? 'Back to Different'
              : fromTab === 'rejected'
                ? 'Back to Rejected'
                : 'Back to Review Queue';

  const backUrl = `/review?tab=${fromTab}`;

  const [decision, setDecision] = useState<'ACCEPT' | 'REJECT' | 'DIFFERENT' | 'OVERRIDE'>('ACCEPT');
  const [overrideOutcome, setOverrideOutcome] = useState<'EQUIVALENT' | 'DIFFERENT'>('EQUIVALENT');
  const [reason, setReason] = useState('');
  const [isOverriding, setIsOverriding] = useState(false);

  const { data: match, isLoading } = useQuery({
    queryKey: ['nmc', 'match-detail', id],
    queryFn: () => nmcApi.review.getMatch(id!),
    enabled: !!id,
  });

  const decisionMutation = useMutation({
    mutationFn: (data: {
      decision: 'ACCEPT' | 'REJECT' | 'DIFFERENT' | 'OVERRIDE';
      override_outcome?: 'EQUIVALENT' | 'DIFFERENT';
      reason?: string;
    }) =>
      nmcApi.review.submitDecision(id!, {
        decision: data.decision,
        override_outcome: data.override_outcome,
        reason: data.reason,
        reviewer: isAdmin ? (reviewerName || 'Administrator') : (reviewerKey || reviewerName || 'Reviewer'),
        cpse_code: isAdmin ? undefined : (reviewerCpse || match?.source_material?.cpse_code),
      }),
    onSuccess: (res) => {
      toast.dismiss();
      toast.success(res.message || 'Review decision submitted successfully');
      setIsOverriding(false);
      queryClient.invalidateQueries({ queryKey: ['nmc', 'match-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['nmc', 'review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['nmc', 'review-stats'] });
      queryClient.invalidateQueries({ queryKey: ['nmc', 'dashboard-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['nmc', 'cmm-list'] });
      navigate(backUrl, { state: { tab: fromTab } });
    },
    onError: (err: any) => {
      toast.dismiss();
      toast.error(err.message || 'Failed to submit decision');
    },
  });

  if (isLoading) {
    return (
      <AppLayout requireReviewer>
        <div className="py-16 text-center text-sm text-muted-foreground">
          Loading match evaluation details...
        </div>
      </AppLayout>
    );
  }

  if (!match) {
    return (
      <AppLayout requireReviewer>
        <div className="py-16 text-center text-sm text-muted-foreground">
          Match record not found.
        </div>
      </AppLayout>
    );
  }

  const src = match.source_material;
  const cand = match.candidate_material;
  const srcLogo = getCpseLogo(src?.cpse_code, src?.cpse_name);
  const candLogo = getCpseLogo(cand?.cpse_code, cand?.cpse_name);
  const disputeLogo = getCpseLogo(match.dispute_cpse_code || src?.cpse_code);
  const explanation = match.explanation || {};
  const confScore = match.final_confidence ? Math.round(match.final_confidence * 100) : 0;
  const semScore = match.semantic_similarity ? Math.round(match.semantic_similarity * 100) : 0;
  const txtScore = match.text_similarity ? Math.round(match.text_similarity * 100) : 0;
  const attrScore = match.attribute_similarity ? Math.round(match.attribute_similarity * 100) : 0;

  const isConflict =
    match.status === 'DIFFERENT' ||
    (match.status === 'REJECTED' && Boolean(match.gate1_cpse_code)) ||
    match.dispute_decision === 'DIFFERENT' ||
    (match.review_decisions &&
      match.review_decisions.some(
        (d: any) =>
          d.decision === 'DIFFERENT' ||
          (d.decision === 'REJECT' && Boolean(match.gate1_cpse_code))
      ));

  const isGate1Approved = match.status === 'GATE_1_APPROVED';
  const gate1Cpse =
    match.gate1_cpse_code ||
    (match.review_decisions && match.review_decisions.length > 0
      ? match.review_decisions[0].cpse_code
      : null);
  const isSameCpseAsGate1 = Boolean(
    reviewerCpse &&
      gate1Cpse &&
      reviewerCpse.trim().toUpperCase() === gate1Cpse.trim().toUpperCase()
  );

  // Can the current user submit a routine or peer co-endorsement decision?
  const canReview =
    !isConflict &&
    (match.status === 'PENDING_REVIEW' ||
      (isGate1Approved && (!isSameCpseAsGate1 || isAdmin)));

  const isAwaitingPeerForViewer =
    !isConflict && isGate1Approved && isSameCpseAsGate1 && !isAdmin;

  const counterpartCpse =
    gate1Cpse && src?.cpse_code && gate1Cpse.toUpperCase() === src.cpse_code.toUpperCase()
      ? cand?.cpse_code || cand?.cpse_name
      : src?.cpse_code || src?.cpse_name;

  return (
    <AppLayout requireReviewer>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(backUrl, { state: { tab: fromTab } })}
            className="gap-2 text-xs w-fit -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{backLabel}</span>
          </Button>

          <div className="flex items-center flex-wrap gap-2">
            <Badge
              variant="outline"
              className={
                'text-xs font-semibold px-2.5 py-1 ' +
                (match.status === 'DIFFERENT'
                  ? 'border-rose-500/40 text-rose-700 dark:text-rose-300 bg-rose-500/10'
                  : match.status === 'ACCEPTED' || match.status === 'OVERRIDDEN'
                    ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10'
                    : match.status === 'GATE_1_APPROVED'
                      ? 'border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10'
                      : 'border-border text-foreground')
              }
            >
              Status:{' '}
              <span className="ml-1 uppercase font-bold">
                {match.status === 'GATE_1_APPROVED'
                  ? canReview
                    ? 'ACTION REQUIRED (PEER VERIFICATION)'
                    : 'INITIAL ENDORSEMENT (AWAITING PEER)'
                  : match.status}
              </span>
            </Badge>
            <Badge
              className={`text-xs px-2.5 py-1 font-medium shadow-none whitespace-nowrap ${
                match.confidence_label === 'HIGH'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                  : match.confidence_label === 'MEDIUM'
                    ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30'
                    : 'bg-muted text-muted-foreground border border-border'
              }`}
            >
              {match.confidence_label || 'Low'} Confidence ({confScore}%)
            </Badge>
          </div>
        </div>

        {/* 1. Side-by-Side Comparison Header */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Source Material Card */}
          <Card className="border-border/70 border-t-4 border-t-blue-500 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 bg-muted/15 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {srcLogo ? (
                    <div className="h-8 w-8 rounded-full overflow-hidden border border-blue-500/30 bg-white flex items-center justify-center p-0.5 shadow-2xs shrink-0 ring-2 ring-blue-500/10">
                      <img
                        src={srcLogo}
                        alt={src?.cpse_code || 'Source CPSE'}
                        className={`h-full w-full object-contain rounded-full ${src?.cpse_code?.toUpperCase().includes('ONGC') ? 'scale-110' : ''}`}
                      />
                    </div>
                  ) : null}
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-mono text-xs font-semibold hover:bg-blue-500/10 hover:text-blue-600">
                    Source: {src?.cpse_code || 'CPSE 1'}
                  </Badge>
                </div>
                <span className="font-mono text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/40">
                  {src?.original_material_code || 'No Code'}
                </span>
              </div>
              <CardTitle className="text-base mt-2.5 leading-snug">
                {src?.original_description}
              </CardTitle>
              <CardDescription className="text-xs">
                Standardized: <span className="text-foreground font-medium">{src?.standardized_description || '—'}</span>
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-2.5 space-y-2 text-xs divide-y divide-border/40">
              <div className="flex justify-between py-1.5 items-center">
                <span className="text-muted-foreground">Enterprise:</span>
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  {srcLogo && (
                    <span className="h-5 w-5 rounded-full overflow-hidden border border-border/50 bg-white inline-flex items-center justify-center shrink-0">
                      <img src={srcLogo} alt="" className={`h-full w-full object-contain rounded-full ${src?.cpse_code?.toUpperCase().includes('ONGC') ? 'scale-110' : ''}`} />
                    </span>
                  )}
                  {src?.cpse_code || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Material Family:</span>
                <span className="font-semibold text-foreground capitalize">{src?.material_family || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Material Type:</span>
                <span className="font-semibold text-foreground capitalize">{src?.material_type || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Material Grade:</span>
                <span className="font-semibold text-foreground">{src?.grade || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Dimensions / Size:</span>
                <span className="font-semibold text-foreground">{src?.dimensions || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Specification / Standard:</span>
                <span className="font-semibold text-foreground">{src?.specifications || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Unit of Measurement (UOM):</span>
                <span className="font-semibold text-foreground">{src?.uom || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Plant / Site:</span>
                <span className="font-medium text-foreground">{src?.plant_site || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">ERP Source:</span>
                <span className="font-mono text-muted-foreground text-[11px]">{src?.erp_source || '—'}</span>
              </div>
            </CardContent>
          </Card>

          {/* Candidate Material Card */}
          <Card className="border-border/70 border-t-4 border-t-indigo-500 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 bg-muted/15 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {candLogo ? (
                    <div className="h-8 w-8 rounded-full overflow-hidden border border-indigo-500/30 bg-white flex items-center justify-center p-0.5 shadow-2xs shrink-0 ring-2 ring-indigo-500/10">
                      <img
                        src={candLogo}
                        alt={cand?.cpse_code || 'Candidate CPSE'}
                        className={`h-full w-full object-contain rounded-full ${cand?.cpse_code?.toUpperCase().includes('ONGC') ? 'scale-110' : ''}`}
                      />
                    </div>
                  ) : null}
                  <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-mono text-xs font-semibold hover:bg-indigo-500/10 hover:text-indigo-600">
                    Candidate: {cand?.cpse_code || 'CPSE 2'}
                  </Badge>
                </div>
                <span className="font-mono text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/40">
                  {cand?.original_material_code || 'No Code'}
                </span>
              </div>
              <CardTitle className="text-base mt-2.5 leading-snug">
                {cand?.original_description}
              </CardTitle>
              <CardDescription className="text-xs">
                Standardized: <span className="text-foreground font-medium">{cand?.standardized_description || '—'}</span>
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-2.5 space-y-2 text-xs divide-y divide-border/40">
              <div className="flex justify-between py-1.5 items-center">
                <span className="text-muted-foreground">Enterprise:</span>
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  {candLogo && (
                    <span className="h-5 w-5 rounded-full overflow-hidden border border-border/50 bg-white inline-flex items-center justify-center shrink-0">
                      <img src={candLogo} alt="" className={`h-full w-full object-contain rounded-full ${cand?.cpse_code?.toUpperCase().includes('ONGC') ? 'scale-110' : ''}`} />
                    </span>
                  )}
                  {cand?.cpse_code || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Material Family:</span>
                <span className="font-semibold text-foreground capitalize">{cand?.material_family || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Material Type:</span>
                <span className="font-semibold text-foreground capitalize">{cand?.material_type || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Material Grade:</span>
                <span className="font-semibold text-foreground">{cand?.grade || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Dimensions / Size:</span>
                <span className="font-semibold text-foreground">{cand?.dimensions || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Specification / Standard:</span>
                <span className="font-semibold text-foreground">{cand?.specifications || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Unit of Measurement (UOM):</span>
                <span className="font-semibold text-foreground">{cand?.uom || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Plant / Site:</span>
                <span className="font-medium text-foreground">{cand?.plant_site || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">ERP Source:</span>
                <span className="font-mono text-muted-foreground text-[11px]">{cand?.erp_source || '—'}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 2. AI Similarity & Evidence Breakdown */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Composite AI Scoring & Engineering Evidence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-muted/40 border border-border/40 space-y-1">
                <div className="flex justify-between font-medium">
                  <span>Semantic (Sentence-BERT)</span>
                  <span className="text-primary font-bold">{semScore}%</span>
                </div>
                <Progress value={semScore} className="h-1.5" />
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-border/40 space-y-1">
                <div className="flex justify-between font-medium">
                  <span>Text Description Similarity</span>
                  <span className="text-primary font-bold">{txtScore}%</span>
                </div>
                <Progress value={txtScore} className="h-1.5" />
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-border/40 space-y-1">
                <div className="flex justify-between font-medium">
                  <span>Attribute Agreement</span>
                  <span className="text-primary font-bold">{attrScore}%</span>
                </div>
                <Progress value={attrScore} className="h-1.5" />
              </div>
            </div>

            {explanation.evidence_summary && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                <span className="font-semibold text-foreground">Evidence Summary:</span>
                <p className="text-muted-foreground mt-0.5">{explanation.evidence_summary}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. CONFLICT DETAILS & OVERRIDE (BELOW comparison and AI engine) */}
        {isConflict && (
          <Card className="border-rose-500/40 bg-rose-500/[0.02] shadow-sm">
            <CardHeader className="pb-3 border-b border-rose-500/20 bg-rose-500/5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <div>
                    <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                      Conflict Details
                      <Badge className="bg-rose-600 text-white text-[10px] uppercase font-bold">
                        Disputed
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Flagged as technically different during peer evaluation.
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* Who raised it and what the conflict is */}
              <div className="p-3.5 rounded-lg bg-background border border-border/70 text-xs space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    <span className="font-semibold text-muted-foreground">Raised by:</span>
                    {disputeLogo && (
                      <span className="h-5 w-5 rounded-full overflow-hidden border border-rose-500/30 bg-white inline-flex items-center justify-center shrink-0 p-0.5">
                        <img src={disputeLogo} alt="" className="h-full w-full object-contain rounded-full" />
                      </span>
                    )}
                    <Badge variant="outline" className="border-rose-500/30 text-rose-700 dark:text-rose-300 bg-rose-500/10 font-mono text-xs">
                      {match.dispute_cpse_code || src?.cpse_code || 'CPSE'}
                    </Badge>
                    <span className="font-bold text-foreground">
                      {match.dispute_reviewer_name || match.dispute_reviewer || 'Reviewer'}
                    </span>
                  </div>

                  {match.dispute_timestamp && (
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {new Date(match.dispute_timestamp).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-1">
                  <p className="text-xs text-foreground leading-relaxed">
                    {match.dispute_reason && match.dispute_reason !== 'Review decision from review queue'
                      ? match.dispute_reason
                      : 'Marked as technically different during peer evaluation. Items possess conflicting engineering specifications.'}
                  </p>
                </div>
              </div>

              {/* OVERRIDE BUTTONS & CONTROLS FOR ADMIN */}
              {isAdmin && (
                <div className="pt-3 border-t border-rose-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      Administrator Executive Override:
                    </Label>
                    <span className="text-[11px] text-muted-foreground">
                      Select outcome to resolve conflict
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Override to Equivalent */}
                    <Button
                      type="button"
                      variant={overrideOutcome === 'EQUIVALENT' ? 'default' : 'outline'}
                      onClick={() => setOverrideOutcome('EQUIVALENT')}
                      className={
                        'h-auto py-2.5 px-3 text-xs justify-start text-left flex-col items-start gap-1 ' +
                        (overrideOutcome === 'EQUIVALENT'
                          ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'
                          : 'border-purple-500/30 hover:bg-purple-500/10 text-foreground')
                      }
                    >
                      <div className="font-semibold flex items-center gap-1.5">
                        <CheckCheck className="h-3.5 w-3.5 text-emerald-400" />
                        Override to Equivalent
                      </div>
                      <span className="text-[11px] opacity-80 font-normal">
                        Harmonize both items into a Common Material Master (CMM)
                      </span>
                    </Button>

                    {/* Confirm Different */}
                    <Button
                      type="button"
                      variant={overrideOutcome === 'DIFFERENT' ? 'default' : 'outline'}
                      onClick={() => setOverrideOutcome('DIFFERENT')}
                      className={
                        'h-auto py-2.5 px-3 text-xs justify-start text-left flex-col items-start gap-1 ' +
                        (overrideOutcome === 'DIFFERENT'
                          ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
                          : 'border-amber-500/30 hover:bg-amber-500/10 text-foreground')
                      }
                    >
                      <div className="font-semibold flex items-center gap-1.5">
                        <Split className="h-3.5 w-3.5 text-amber-300" />
                        Confirm Different
                      </div>
                      <span className="text-[11px] opacity-80 font-normal">
                        Ratify that materials are distinct; conclude dispute
                      </span>
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="override-reason" className="text-[11px] text-muted-foreground">
                      Override Reason (Optional)
                    </Label>
                    <Textarea
                      id="override-reason"
                      placeholder="Add reason for administrative override..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={2}
                      className="text-xs"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      size="sm"
                      disabled={decisionMutation.isPending}
                      onClick={() =>
                        decisionMutation.mutate({
                          decision: 'OVERRIDE',
                          override_outcome: overrideOutcome,
                          reason:
                            reason.trim() ||
                            (overrideOutcome === 'EQUIVALENT'
                              ? 'Admin override: materials deemed equivalent'
                              : 'Admin override: materials confirmed as distinct'),
                        })
                      }
                      className={
                        'gap-2 font-semibold text-xs px-4 ' +
                        (overrideOutcome === 'EQUIVALENT'
                          ? 'bg-purple-600 hover:bg-purple-700 text-white'
                          : 'bg-amber-600 hover:bg-amber-700 text-white')
                      }
                    >
                      {decisionMutation.isPending
                        ? 'Applying Override...'
                        : overrideOutcome === 'EQUIVALENT'
                          ? '⚡ Confirm Override (Equivalent)'
                          : '⇌ Confirm Override (Different)'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Notice for non-admin viewers */}
              {!isAdmin && (
                <div className="text-[11px] text-muted-foreground italic border-t border-border/40 pt-2">
                  Note: As a CPSE Reviewer, this conflict is under arbitration by the National Administrator.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 4. CMM/NMC Info for accepted matches */}
        {match.cmm && (
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <LinkIcon className="h-4 w-4" />
                Common Material Master Record Established
              </CardTitle>
              <CardDescription className="text-xs">
                This match has been accepted and mapped to the following National Material Code.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs space-y-2 divide-y divide-border/40">
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">National Master Code (NMC):</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  {match.cmm.national_material_code}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Canonical Description:</span>
                <span className="font-semibold text-foreground text-right max-w-[60%]">
                  {match.cmm.canonical_description}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Material Family:</span>
                <span className="font-semibold text-foreground capitalize">{match.cmm.material_family || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Material Type:</span>
                <span className="font-semibold text-foreground capitalize">{match.cmm.material_type || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">UOM:</span>
                <span className="font-semibold text-foreground">{match.cmm.uom || '—'}</span>
              </div>
              {match.cmm.source_cpses && match.cmm.source_cpses.length > 0 && (
                <div className="flex justify-between py-1.5 items-center">
                  <span className="text-muted-foreground">Source CPSEs:</span>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {match.cmm.source_cpses.map((cCode: string) => {
                      const cLogo = getCpseLogo(cCode);
                      return (
                        <span key={cCode} className="inline-flex items-center gap-1.5 font-semibold text-foreground bg-muted/60 px-2 py-0.5 rounded-full text-[11px] border border-border/50">
                          {cLogo && (
                            <span className="h-3.5 w-3.5 rounded-full overflow-hidden border border-border/40 bg-white inline-flex items-center justify-center shrink-0">
                              <img src={cLogo} alt="" className="h-full w-full object-contain rounded-full" />
                            </span>
                          )}
                          {cCode}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 5. REVIEW ACTIONS (Initial Endorsement or Peer Verification Alert) */}

        {/* Actionable Review Card: For PENDING_REVIEW or GATE_1_APPROVED (when viewer is eligible for peer verification) */}
        {canReview && (
          <Card className={isGate1Approved ? "border-emerald-500/40 shadow-sm" : "border-border/60"}>
            <CardHeader className={isGate1Approved ? "pb-3 bg-emerald-500/5 border-b border-emerald-500/20" : "pb-3"}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {isGate1Approved ? (
                    <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <UserCheck className="h-4 w-4 text-primary" />
                  )}
                  <CardTitle className="text-base">
                    {isGate1Approved
                      ? 'Peer Review & Co-Endorsement (Action Alert)'
                      : match.match_category === 'ALREADY_MAPPED'
                        ? 'Confirm Link to Established National Master Code'
                        : 'Submit Reviewer Determination'}
                  </CardTitle>
                </div>

                <Badge
                  className={
                    isGate1Approved
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs'
                      : 'bg-muted text-foreground border border-border text-xs'
                  }
                >
                  {isGate1Approved
                    ? `Endorsed by ${gate1Cpse || 'Peer CPSE'}`
                    : 'Pending Verification'}
                </Badge>
              </div>

              <CardDescription className="text-xs mt-1">
                {isGate1Approved
                  ? `${gate1Cpse || 'Counterpart CPSE'} evaluated and endorsed this candidate match. Please inspect the engineering attributes below and submit your co-endorsement to mint the National Master Code.`
                  : 'Review this candidate match pair across technical and metallurgical dimensions.'}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Select Action</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDecision('ACCEPT')}
                    className={
                      'text-xs h-11 sm:h-10 px-3 gap-2 font-semibold border-2 transition-all w-full justify-center ' +
                      (decision === 'ACCEPT'
                        ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white shadow-sm'
                        : 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-800 dark:hover:text-emerald-300')
                    }
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {isGate1Approved
                        ? 'Co-Endorse (Accept)'
                        : match.match_category === 'ALREADY_MAPPED'
                          ? 'Accept & Link'
                          : 'Accept'}
                    </span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDecision('DIFFERENT')}
                    className={
                      'text-xs h-11 sm:h-10 px-3 gap-2 font-semibold border-2 transition-all w-full justify-center ' +
                      (decision === 'DIFFERENT'
                        ? 'bg-amber-500 hover:bg-amber-600 border-amber-500 text-white shadow-sm'
                        : 'border-amber-400/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300')
                    }
                  >
                    <Split className="h-4 w-4 shrink-0" />
                    <span className="truncate">Mark as Different</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDecision('REJECT')}
                    className={
                      'text-xs h-11 sm:h-10 px-3 gap-2 font-semibold border-2 transition-all w-full justify-center ' +
                      (decision === 'REJECT'
                        ? 'bg-rose-600 hover:bg-rose-700 border-rose-600 text-white shadow-sm'
                        : 'border-rose-400/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-300')
                    }
                  >
                    <XCircle className="h-4 w-4 shrink-0" />
                    <span className="truncate">Reject</span>
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="review-reason" className="text-xs font-semibold">
                  Engineering Rationale / Notes
                </Label>
                <Textarea
                  id="review-reason"
                  placeholder={
                    isGate1Approved
                      ? 'Document engineering confirmation for peer co-endorsement (e.g. Dimensions and grade verified)...'
                      : 'Document justification for acceptance, rejection, or technical differences...'
                  }
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="text-xs"
                />
              </div>
            </CardContent>

            <CardFooter className="pt-3 flex flex-col-reverse sm:flex-row sm:justify-between gap-2.5 border-t border-border/40">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(backUrl, { state: { tab: fromTab } })}
                className="text-xs w-full sm:w-auto hover:bg-muted/70 hover:text-foreground"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={decisionMutation.isPending || (!canSubmitDecisions && !isAdmin)}
                onClick={() =>
                  decisionMutation.mutate({
                    decision,
                    reason:
                      reason.trim() ||
                      (isGate1Approved && decision === 'ACCEPT'
                        ? 'Peer consensus co-endorsement confirmed'
                        : undefined),
                  })
                }
                className={
                  'gap-2 font-semibold px-5 transition-all text-xs w-full sm:w-auto h-10 sm:h-9 ' +
                  (decision === 'ACCEPT'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : decision === 'REJECT'
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-amber-500 hover:bg-amber-600 text-white')
                }
              >
                {decisionMutation.isPending
                  ? 'Recording...'
                  : isGate1Approved && decision === 'ACCEPT'
                    ? 'Confirm Peer Co-Endorsement'
                    : decision === 'ACCEPT'
                      ? 'Confirm & Endorse'
                      : decision === 'REJECT'
                        ? 'Confirm Rejection'
                        : 'Confirm Marked as Different'}
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Awaiting Peer banner for reviewer whose CPSE already endorsed */}
        {isAwaitingPeerForViewer && (
          <Card className="border-sky-500/40 bg-sky-500/5 shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 mt-0.5 border border-sky-500/30">
                  <Clock className="h-4 w-4 animate-pulse" />
                </div>
                <div className="space-y-1.5 flex-1 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-foreground text-sm">Initial Endorsement Recorded</span>
                    <Badge variant="outline" className="border-sky-500/40 text-sky-700 dark:text-sky-300 bg-sky-500/10 font-mono text-[10px]">
                      AWAITING PEER CONFIRMATION
                    </Badge>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Your enterprise (<strong>{gate1Cpse}</strong>) has evaluated and endorsed this candidate pair.
                    An <strong>Action Alert</strong> has been broadcast to <strong>{counterpartCpse || 'the counterpart CPSE'}</strong> for independent peer verification.
                    Once confirmed by their technical reviewer, the National Master Code will be minted.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Finalized or Decided non-conflict match (Accepted or Rejected) */}
        {!isConflict && !canReview && !isAwaitingPeerForViewer && (
          <Card className="border-border/60">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between gap-3">
                <div className="p-3 rounded-lg border flex items-center gap-2.5 text-xs bg-muted/40 border-border flex-1">
                  {match.status === 'ACCEPTED' || match.status === 'OVERRIDDEN' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  )}
                  <span>
                    <strong>Status:</strong> Marked as <strong>{match.status}</strong>.
                    {match.cmm && (
                      <> Assigned National Code: <strong className="font-mono">{match.cmm.national_material_code}</strong>.</>
                    )}
                  </span>
                </div>

                {isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setOverrideOutcome('EQUIVALENT');
                      setIsOverriding(true);
                    }}
                    className="gap-1.5 text-xs font-semibold text-purple-600 border-purple-500/40 hover:bg-purple-500/10"
                  >
                    <Split className="h-3.5 w-3.5" />
                    Override
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
