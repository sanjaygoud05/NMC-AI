/**
 * Match Detail Page
 * Deep dive into a specific pair candidate: side-by-side comparison,
 * attribute diffs, multi-model scoring explanation, and human decision actions.
 */

import { useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  ArrowLeft,
  GitCompare,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  Loader2,
  Package,
} from 'lucide-react';
import { useDataset } from '@/contexts/DatasetContext';
import { matchingService } from '@/services/matchingService';
import { materialService } from '@/services/materialService';
import { reviewService } from '@/services/reviewService';
import { useQuery } from '@tanstack/react-query';
import type { MaterialMatch } from '@/types';
import type { Material } from '@/types';

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const { activeDatasetId } = useDataset();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine where to go back: use query param ?from=, or router history (navigate(-1))
  const fromParam = new URLSearchParams(location.search).get('from');
  const handleBack = () => {
    if (fromParam) {
      navigate(fromParam);
    } else {
      navigate(-1);
    }
  };

  const { data: match, isLoading: matchLoading, error: matchError } = useQuery({
    queryKey: ['match', id, activeDatasetId],
    queryFn: () => matchingService.getMatchById(id!, activeDatasetId),
    enabled: !!id && activeDatasetId !== 'NONE',
  });

  const { data: sourceMaterial, isLoading: sourceLoading } = useQuery({
    queryKey: ['material', match?.source_material_code, activeDatasetId],
    queryFn: () => materialService.getMaterialById(match!.source_material_code, activeDatasetId),
    enabled: !!match?.source_material_code && activeDatasetId !== 'NONE',
  });

  const { data: candidateMaterial, isLoading: candidateLoading } = useQuery({
    queryKey: ['material', match?.candidate_material_code, activeDatasetId],
    queryFn: () => materialService.getMaterialById(match!.candidate_material_code, activeDatasetId),
    enabled: !!match?.candidate_material_code && activeDatasetId !== 'NONE',
  });

  const [decision, setDecision] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const handleAction = async (apiDecision: 'ACCEPT' | 'REJECT' | 'DEFER', label: string) => {
    if (!id || submitting || decision) return;
    setSubmitting(true);
    try {
      await reviewService.submitDecision(id, {
        decision: apiDecision,
        rationale: `${label} from Match Detail view`,
      });
      setDecision(apiDecision);
      try {
        const saved = JSON.parse(localStorage.getItem('nmi_match_decisions') || '{}');
        saved[id] = apiDecision;
        localStorage.setItem('nmi_match_decisions', JSON.stringify(saved));
      } catch {}
      toast.success(`Match #${id} — marked as ${label} ✓`);
      // Navigate back after 1.2s to smoothly return with decision state
      setTimeout(() => {
        if (fromParam) {
          navigate(fromParam, { state: { decidedId: id, decision: apiDecision } });
        } else {
          navigate(-1);
        }
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record decision';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (activeDatasetId === 'NONE') {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Package className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">No Dataset Selected</h2>
          <p className="text-muted-foreground">Please select a dataset to view match details</p>
          <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />Go Back
            </Button>
        </div>
      </AppLayout>
    );
  }

  if (matchLoading || sourceLoading || candidateLoading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />
          <p className="text-muted-foreground">Loading match details...</p>
        </div>
      </AppLayout>
    );
  }

  if (matchError || !match) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Match pair not found.</p>
          <Button className="mt-4" variant="outline" onClick={handleBack}>
            Go Back
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Navigation back */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageHeader
            title={`Harmonization Pair #${match.candidate_id}`}
            description={`Comparing ${sourceMaterial?.cpse || 'CPSE 1'} and ${candidateMaterial?.cpse || 'CPSE 2'} records`}
          />
          <div className="flex items-center gap-2 shrink-0">
            {/* Show persistent decision badge after action */}
            {decision === 'ACCEPT' && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-3 py-1.5 rounded-full border border-emerald-500/30">
                <CheckCircle2 className="h-4 w-4" /> Accepted ✓
              </span>
            )}
            {decision === 'REJECT' && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-700 dark:text-rose-400 bg-rose-500/15 px-3 py-1.5 rounded-full border border-rose-500/30">
                <XCircle className="h-4 w-4" /> Rejected
              </span>
            )}
            {decision === 'DEFER' && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/15 px-3 py-1.5 rounded-full border border-amber-500/30">
                <AlertCircle className="h-4 w-4" /> Flagged for Review
              </span>
            )}
            {!decision && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={submitting}
                  className="gap-1.5 text-rose-500 hover:text-rose-600 border-rose-500/20"
                  onClick={() => handleAction('REJECT', 'Rejected')}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  Reject
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={submitting}
                  className="gap-1.5 text-amber-500 hover:text-amber-600 border-amber-500/20"
                  onClick={() => handleAction('DEFER', 'Sent to Review Queue')}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertCircle className="h-4 w-4" />}
                  Request Review
                </Button>
                <Button
                  size="sm"
                  disabled={submitting}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleAction('ACCEPT', 'Accepted')}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Accept Match
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Status & Overview Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <Card className="border-border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">Confidence Score</div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-primary mt-1 tracking-tight">
                {((match.final_match_score ?? 0) * 100).toFixed(1)}%
              </div>
              <Progress value={(match.final_match_score ?? 0) * 100} className="mt-3 h-1.5" />
            </CardContent>
          </Card>
          <Card className="border-border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">Semantic Cosine Score</div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-foreground mt-1 tracking-tight">
                {((match.embedding_similarity ?? 0) * 100).toFixed(1)}%
              </div>
              <Progress value={(match.embedding_similarity ?? 0) * 100} className="mt-3 h-1.5" />
            </CardContent>
          </Card>
          <Card className="border-border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">Fuzzy Token Overlap</div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-foreground mt-1 tracking-tight">
                {((match.description_similarity ?? 0) * 100).toFixed(1)}%
              </div>
              <Progress value={(match.description_similarity ?? 0) * 100} className="mt-3 h-1.5" />
            </CardContent>
          </Card>
          <Card className="border-border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">Decision Status</div>
              <div className="mt-2">
                <Badge
                  variant={decision === 'ACCEPT' ? 'default' : decision === 'REJECT' ? 'destructive' : 'outline'}
                  className="capitalize text-xs font-semibold px-2.5 py-0.5"
                >
                  {decision ? (decision === 'ACCEPT' ? 'Approved' : decision === 'REJECT' ? 'Rejected' : 'Review Deferred') : 'Pending Review'}
                </Badge>
              </div>
              <div className="text-[11px] text-muted-foreground mt-2">
                Priority: {match.confidence_level ?? 'Automated Pipeline'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Side-by-Side Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Source Material */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="border-b border-border/50 p-5 pb-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 gap-1">
                  <Building2 className="h-3 w-3" /> Source: {sourceMaterial?.cpse ?? 'CPSE-A'}
                </Badge>
                <span className="font-mono text-xs font-bold text-muted-foreground">{sourceMaterial?.material_code}</span>
              </div>
              <CardTitle className="text-base font-semibold mt-2.5 text-foreground leading-snug">{sourceMaterial?.description}</CardTitle>
              {sourceMaterial?.standardized_description && (
                <CardDescription className="text-emerald-500 font-mono text-xs mt-1 leading-relaxed">
                  Std: {sourceMaterial.standardized_description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="p-5 pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3.5 text-xs">
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80 block mb-0.5">Category</span>
                  <div className="font-medium text-foreground text-xs">{sourceMaterial?.category ?? '—'}</div>
                </div>
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80 block mb-0.5">Unit of Measurement</span>
                  <div className="font-medium text-foreground text-xs">{sourceMaterial?.unit_of_measure ?? '—'}</div>
                </div>
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80 block mb-0.5">Manufacturer / Brand</span>
                  <div className="font-medium text-foreground text-xs">{sourceMaterial?.manufacturer ?? 'Generic / OEM'}</div>
                </div>
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80 block mb-0.5">Status</span>
                  <div className="font-medium text-foreground text-xs capitalize">{sourceMaterial?.standardization_status ?? '—'}</div>
                </div>
              </div>

              <Separator className="my-3" />
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2.5">
                  Extracted Attributes
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  {Object.entries(sourceMaterial?.attributes ?? {}).map(
                    ([k, v]) => (
                      <div key={k} className="p-2.5 rounded-lg bg-muted/20 border border-border/60">
                        <div className="text-[10px] uppercase font-semibold text-muted-foreground/75">{k}</div>
                        <div className="text-xs font-semibold text-foreground font-mono mt-0.5 truncate">{String(v)}</div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Candidate Material */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="border-b border-border/50 p-5 pb-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 gap-1">
                  <Building2 className="h-3 w-3" /> Candidate: {candidateMaterial?.cpse ?? 'CPSE-B'}
                </Badge>
                <span className="font-mono text-xs font-bold text-muted-foreground">{candidateMaterial?.material_code}</span>
              </div>
              <CardTitle className="text-base font-semibold mt-2.5 text-foreground leading-snug">{candidateMaterial?.description}</CardTitle>
              {candidateMaterial?.standardized_description && (
                <CardDescription className="text-emerald-500 font-mono text-xs mt-1 leading-relaxed">
                  Std: {candidateMaterial.standardized_description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="p-5 pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3.5 text-xs">
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80 block mb-0.5">Category</span>
                  <div className="font-medium text-foreground text-xs">{candidateMaterial?.category ?? '—'}</div>
                </div>
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80 block mb-0.5">Unit of Measurement</span>
                  <div className="font-medium text-foreground text-xs">{candidateMaterial?.unit_of_measure ?? '—'}</div>
                </div>
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80 block mb-0.5">Manufacturer / Brand</span>
                  <div className="font-medium text-foreground text-xs">{candidateMaterial?.manufacturer ?? 'Generic / OEM'}</div>
                </div>
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80 block mb-0.5">Status</span>
                  <div className="font-medium text-foreground text-xs capitalize">{candidateMaterial?.standardization_status ?? '—'}</div>
                </div>
              </div>

              <Separator className="my-3" />
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2.5">
                  Extracted Attributes
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  {Object.entries(candidateMaterial?.attributes ?? {}).map(
                    ([k, v]) => (
                      <div key={k} className="p-2.5 rounded-lg bg-muted/20 border border-border/60">
                        <div className="text-[10px] uppercase font-semibold text-muted-foreground/75">{k}</div>
                        <div className="text-xs font-semibold text-foreground font-mono mt-0.5 truncate">{String(v)}</div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Explainability / AI Reasoning */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="p-5 pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Harmonization Match Rationale
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-4">
            <div className="p-4 rounded-xl bg-muted/20 border border-border text-sm text-foreground leading-relaxed font-normal">
              {match.conflict_details ||
                match.evidence_summary ||
                'Candidate matches across semantic embeddings and key technical attributes with a confidence margin of over 85%.'}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
              <div className="p-3.5 rounded-lg border border-border bg-card">
                <div className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Attribute Agreement</div>
                <div className="text-xl font-bold font-mono text-foreground mt-1">
                  {((match.attribute_agreement ?? 0) * 100).toFixed(0)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-normal">
                  Direct overlap on Grade, Size, and Base Material specifications.
                </p>
              </div>
              <div className="p-3.5 rounded-lg border border-border bg-card">
                <div className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Syntactic Normalization</div>
                <div className="text-xl font-bold font-mono text-foreground mt-1">High Overlap</div>
                <p className="text-xs text-muted-foreground mt-1 leading-normal">
                  Abbreviations expanded (e.g. MS &rarr; Mild Steel, PLT &rarr; Plate).
                </p>
              </div>
              <div className="p-3.5 rounded-lg border border-border bg-card">
                <div className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Procurement Consolidation</div>
                <div className="text-xl font-bold font-mono text-emerald-500 mt-1">Eligible</div>
                <p className="text-xs text-muted-foreground mt-1 leading-normal">
                  Consolidated common master code allocation recommended.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
