import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  XCircle,
  Split,
  ShieldAlert,
  Sparkles,
  Building2,
  AlertTriangle,
  Lock,
  LinkIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canSubmitDecisions, isAdmin, reviewerKey } = useAuth();

  const [decision, setDecision] = useState<'ACCEPT' | 'REJECT' | 'DIFFERENT' | 'OVERRIDE'>('ACCEPT');
  const [overrideOutcome, setOverrideOutcome] = useState<'EQUIVALENT' | 'DIFFERENT' | null>(null);
  const [reason, setReason] = useState('');

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
        reviewer: reviewerKey || 'Reviewer',
        cpse_code: match?.source_material?.cpse_code,
      }),
    onSuccess: (res) => {
      toast.success(res.message || 'Review decision submitted successfully');
      queryClient.invalidateQueries({ queryKey: ['nmc', 'match-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['nmc', 'review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['nmc', 'dashboard-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['nmc', 'cmm-list'] });
      navigate('/review');
    },
    onError: (err: any) => {
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
  const explanation = match.explanation || {};
  const confScore = match.final_confidence ? Math.round(match.final_confidence * 100) : 0;
  const semScore = match.semantic_similarity ? Math.round(match.semantic_similarity * 100) : 0;
  const txtScore = match.text_similarity ? Math.round(match.text_similarity * 100) : 0;
  const attrScore = match.attribute_similarity ? Math.round(match.attribute_similarity * 100) : 0;

  return (
    <AppLayout requireReviewer>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/review')} className="gap-2 text-xs">
            <ArrowLeft className="h-4 w-4" />
            Back to Review Queue
          </Button>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Status: <strong className="ml-1 text-foreground">{match.status}</strong>
            </Badge>
            <Badge
              className={`text-xs ${
                match.confidence_label === 'HIGH'
                  ? 'bg-emerald-600 text-white'
                  : match.confidence_label === 'MEDIUM'
                  ? 'bg-sky-600 text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {match.confidence_label || 'LOW'} CONFIDENCE ({confScore}%)
            </Badge>
          </div>
        </div>

        {/* Side-by-Side Comparison Header */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Source Material Card */}
          <Card className="border-border/70 border-t-4 border-t-blue-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-mono text-xs">
                  Source: {src?.cpse_code || 'CPSE 1'}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground">
                  {src?.original_material_code || 'No Code'}
                </span>
              </div>
              <CardTitle className="text-base mt-2 leading-snug">
                {src?.original_description}
              </CardTitle>
              <CardDescription className="text-xs">
                Standardized: <span className="text-foreground font-medium">{src?.standardized_description || '—'}</span>
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-2 space-y-2 text-xs divide-y divide-border/40">
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
            </CardContent>
          </Card>

          {/* Candidate Material Card */}
          <Card className="border-border/70 border-t-4 border-t-indigo-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-mono text-xs">
                  Candidate: {cand?.cpse_code || 'CPSE 2'}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground">
                  {cand?.original_material_code || 'No Code'}
                </span>
              </div>
              <CardTitle className="text-base mt-2 leading-snug">
                {cand?.original_description}
              </CardTitle>
              <CardDescription className="text-xs">
                Standardized: <span className="text-foreground font-medium">{cand?.standardized_description || '—'}</span>
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-2 space-y-2 text-xs divide-y divide-border/40">
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
            </CardContent>
          </Card>
        </div>

        {/* AI Similarity & Evidence Breakdown */}
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

            {explanation.conflict_details && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldAlert className="h-4 w-4" />
                  Engineering Variance / Conflict Identified:
                </div>
                <p className="mt-1 text-xs">{explanation.conflict_details}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CMM/NMC Info for accepted matches */}
        {match.cmm && (
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <LinkIcon className="h-4 w-4" />
                Common Material Master Record
              </CardTitle>
              <CardDescription className="text-xs">
                This match has been accepted and mapped to the following National Material Code.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs space-y-2 divide-y divide-border/40">
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">NMC Code:</span>
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
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Source CPSEs:</span>
                  <span className="font-semibold text-foreground">{match.cmm.source_cpses.join(', ')}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Review Action Form — only for PENDING_REVIEW matches */}
        {match.status === 'PENDING_REVIEW' ? (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Submit Reviewer Determination</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Every action is recorded in the append-only audit trail and establishes or updates Common Material Master records.
                </CardDescription>
              </div>
              {!canSubmitDecisions && (
                <Badge variant="outline" className="text-muted-foreground border-border bg-muted/40 text-[11px] gap-1">
                  <Lock className="h-3 w-3" /> Read-Only (Admin)
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!canSubmitDecisions && (
              <div className="p-3 rounded-lg bg-muted/60 border border-border flex items-center gap-2.5 text-xs text-muted-foreground">
                <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>
                  <strong>Admin Read-Only:</strong> You can inspect match evidence, scores, and attributes. Decision actions (Accept, Reject, Mark Different, Override) are strictly reserved for verified Reviewers.
                </span>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs">Select Action</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button
                  type="button"
                  disabled={!canSubmitDecisions}
                  variant={decision === 'ACCEPT' ? 'default' : 'outline'}
                  onClick={() => setDecision('ACCEPT')}
                  className={'text-xs h-9 gap-1.5 ' + (decision === 'ACCEPT' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : '')}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Accept & Harmonize
                </Button>

                <Button
                  type="button"
                  disabled={!canSubmitDecisions}
                  variant={decision === 'DIFFERENT' ? 'default' : 'outline'}
                  onClick={() => setDecision('DIFFERENT')}
                  className={'text-xs h-9 gap-1.5 ' + (decision === 'DIFFERENT' ? 'bg-slate-700 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white' : '')}
                >
                  <Split className="h-3.5 w-3.5" />
                  Mark as Different
                </Button>

                <Button
                  type="button"
                  disabled={!canSubmitDecisions}
                  variant={decision === 'REJECT' ? 'default' : 'outline'}
                  onClick={() => setDecision('REJECT')}
                  className={'text-xs h-9 gap-1.5 ' + (decision === 'REJECT' ? 'bg-destructive hover:bg-destructive/90 text-white' : '')}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject Match
                </Button>

                <Button
                  type="button"
                  disabled={!canSubmitDecisions}
                  variant={decision === 'OVERRIDE' ? 'default' : 'outline'}
                  onClick={() => setDecision('OVERRIDE')}
                  className={'text-xs h-9 gap-1.5 ' + (decision === 'OVERRIDE' ? 'bg-purple-600 hover:bg-purple-700 text-white' : '')}
                >
                  Override Rule
                </Button>
              </div>
            </div>

            {decision === 'OVERRIDE' && (
              <div className="p-4 rounded-lg border border-purple-500/30 bg-purple-500/5 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Override Determination Required:</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  When overriding automated rules, you must explicitly choose whether this pair is an <strong>Equivalent</strong> engineering match (which creates or updates the Common Material Master record and maps both items) or confirmed as <strong>Different</strong> materials (which records the decision without creating a mapping).
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    disabled={!canSubmitDecisions}
                    variant={overrideOutcome === 'EQUIVALENT' ? 'default' : 'outline'}
                    onClick={() => setOverrideOutcome('EQUIVALENT')}
                    className={'text-xs h-8 gap-1.5 ' + (
                      overrideOutcome === 'EQUIVALENT'
                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                        : 'border-purple-500/30 hover:bg-purple-500/10'
                    )}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Equivalent (Harmonize & Map to CMM)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!canSubmitDecisions}
                    variant={overrideOutcome === 'DIFFERENT' ? 'default' : 'outline'}
                    onClick={() => setOverrideOutcome('DIFFERENT')}
                    className={'text-xs h-8 gap-1.5 ' + (
                      overrideOutcome === 'DIFFERENT'
                        ? 'bg-slate-700 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white'
                        : 'border-border hover:bg-muted'
                    )}
                  >
                    <Split className="h-3.5 w-3.5" />
                    Different (Record Decision, Do Not Map)
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="review-reason" className="text-xs">
                Engineering Rationale / Notes (Optional)
              </Label>
              <Textarea
                id="review-reason"
                placeholder="Document justification for acceptance, rejection, or technical differences..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                disabled={!canSubmitDecisions}
                className="text-xs"
              />
            </div>
          </CardContent>

          <CardFooter className="pt-2 flex justify-between border-t border-border/40">
            <Button variant="ghost" size="sm" onClick={() => navigate('/review')} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={
                decisionMutation.isPending ||
                !canSubmitDecisions ||
                (decision === 'OVERRIDE' && !overrideOutcome)
              }
              onClick={() =>
                decisionMutation.mutate({
                  decision,
                  override_outcome: decision === 'OVERRIDE' ? overrideOutcome! : undefined,
                  reason,
                })
              }
              className="gap-2"
            >
              {decisionMutation.isPending
                ? 'Recording Decision...'
                : decision === 'OVERRIDE'
                ? overrideOutcome
                  ? 'Confirm Override (' + overrideOutcome + ')'
                  : 'Select Override Outcome Above'
                : 'Confirm Decision (' + decision + ')'}
            </Button>
          </CardFooter>
        </Card>
        ) : (
          /* Already decided — show read-only status banner */
          <Card className="border-border/60">
            <CardContent className="pt-4 pb-4">
              <div className={'p-3 rounded-lg border flex items-center gap-2.5 text-xs ' + (
                match.status === 'ACCEPTED' || match.status === 'OVERRIDDEN'
                  ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : match.status === 'DIFFERENT' || match.status === 'REJECTED'
                  ? 'bg-muted/50 border-border text-foreground dark:text-zinc-300'
                  : 'bg-muted/60 border-border text-muted-foreground'
              )}>
                {match.status === 'ACCEPTED' || match.status === 'OVERRIDDEN' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0" />
                )}
                <span>
                  <strong>Decision recorded:</strong> This match was marked as <strong>{match.status}</strong>.
                  {match.cmm && (
                    <> Assigned NMC Code: <strong className="font-mono">{match.cmm.national_material_code}</strong>.</>  
                  )}
                  {' '}No further actions are available.
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
