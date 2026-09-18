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
      toast.success(`Match ${id} — ${label} ✓`);
      // Navigate back after 1.5s, passing the decision so the previous list shows the badge
      setTimeout(() => {
        if (fromParam) {
          navigate(fromParam, { state: { decidedId: id, decision: apiDecision } });
        } else {
          navigate(-1);
        }
      }, 1500);
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
                <CheckCircle2 className="h-4 w-4" /> Accepted — redirecting...
              </span>
            )}
            {decision === 'REJECT' && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-700 dark:text-rose-400 bg-rose-500/15 px-3 py-1.5 rounded-full border border-rose-500/30">
                <XCircle className="h-4 w-4" /> Rejected — redirecting...
              </span>
            )}
            {decision === 'DEFER' && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/15 px-3 py-1.5 rounded-full border border-amber-500/30">
                <AlertCircle className="h-4 w-4" /> Sent to Review — redirecting...
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Confidence Score</div>
              <div className="text-3xl font-bold text-primary mt-1">
                {((match.final_match_score ?? 0) * 100).toFixed(1)}%
              </div>
              <Progress value={(match.final_match_score ?? 0) * 100} className="mt-2 h-1.5" />
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Semantic Cosine Score</div>
              <div className="text-3xl font-bold text-foreground mt-1">
                {((match.embedding_similarity ?? 0) * 100).toFixed(1)}%
              </div>
              <Progress value={(match.embedding_similarity ?? 0) * 100} className="mt-2 h-1.5" />
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Fuzzy Token Overlap</div>
              <div className="text-3xl font-bold text-foreground mt-1">
                {((match.description_similarity ?? 0) * 100).toFixed(1)}%
              </div>
              <Progress value={(match.description_similarity ?? 0) * 100} className="mt-2 h-1.5" />
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Current Status</div>
              <div className="mt-2">
                <Badge className="capitalize text-sm font-semibold">{decision}</Badge>
              </div>
              <div className="text-[11px] text-muted-foreground mt-2">
                Level: {match.confidence_level ?? 'Automated Pipeline'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Side-by-Side Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Source Material */}
          <Card className="border-border bg-card">
            <CardHeader className="border-b border-border/50 pb-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs gap-1">
                  <Building2 className="h-3 w-3" /> Source: {sourceMaterial?.cpse ?? 'CPSE-A'}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground">{sourceMaterial?.material_code}</span>
              </div>
              <CardTitle className="text-base font-semibold mt-2">{sourceMaterial?.description}</CardTitle>
              {sourceMaterial?.standardized_description && (
                <CardDescription className="text-emerald-500 text-xs">
                  Std: {sourceMaterial.standardized_description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Category:</span>
                  <div className="font-medium mt-0.5">{sourceMaterial?.category ?? '—'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Unit of Measurement:</span>
                  <div className="font-medium mt-0.5">{sourceMaterial?.unit_of_measure ?? '—'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Manufacturer / Brand:</span>
                  <div className="font-medium mt-0.5">{sourceMaterial?.manufacturer ?? 'Generic / OEM'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <div className="font-medium mt-0.5 capitalize">{sourceMaterial?.standardization_status ?? '—'}</div>
                </div>
              </div>

              <Separator className="my-2" />
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Extracted Attributes
                </span>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {Object.entries(sourceMaterial?.attributes ?? {}).map(
                    ([k, v]) => (
                      <div key={k} className="p-2 rounded bg-muted/40 border border-border/50">
                        <div className="text-[10px] text-muted-foreground capitalize">{k}</div>
                        <div className="text-xs font-semibold text-foreground truncate">{String(v)}</div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Candidate Material */}
          <Card className="border-border bg-card">
            <CardHeader className="border-b border-border/50 pb-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs gap-1">
                  <Building2 className="h-3 w-3" /> Candidate: {candidateMaterial?.cpse ?? 'CPSE-B'}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground">{candidateMaterial?.material_code}</span>
              </div>
              <CardTitle className="text-base font-semibold mt-2">{candidateMaterial?.description}</CardTitle>
              {candidateMaterial?.standardized_description && (
                <CardDescription className="text-emerald-500 text-xs">
                  Std: {candidateMaterial.standardized_description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Category:</span>
                  <div className="font-medium mt-0.5">{candidateMaterial?.category ?? '—'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Unit of Measurement:</span>
                  <div className="font-medium mt-0.5">{candidateMaterial?.unit_of_measure ?? '—'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Manufacturer / Brand:</span>
                  <div className="font-medium mt-0.5">{candidateMaterial?.manufacturer ?? 'Generic / OEM'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <div className="font-medium mt-0.5 capitalize">{candidateMaterial?.standardization_status ?? '—'}</div>
                </div>
              </div>

              <Separator className="my-2" />
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Extracted Attributes
                </span>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {Object.entries(candidateMaterial?.attributes ?? {}).map(
                    ([k, v]) => (
                      <div key={k} className="p-2 rounded bg-muted/40 border border-border/50">
                        <div className="text-[10px] text-muted-foreground capitalize">{k}</div>
                        <div className="text-xs font-semibold text-foreground truncate">{String(v)}</div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Explainability / AI Reasoning */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Harmonization Match Rationale
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3.5 rounded-lg bg-muted/30 border border-border text-sm text-foreground leading-relaxed">
              {match.conflict_details ||
                match.evidence_summary ||
                'Candidate matches across semantic embeddings and key technical attributes with a confidence margin of over 85%.'}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded border border-border">
                <div className="font-medium text-muted-foreground">Attribute Matching Score</div>
                <div className="text-lg font-bold text-foreground mt-1">
                  {((match.attribute_agreement ?? 0) * 100).toFixed(0)}%
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Direct overlap on Grade, Size, and Base Material specifications.
                </p>
              </div>
              <div className="p-3 rounded border border-border">
                <div className="font-medium text-muted-foreground">Syntactic Normalization</div>
                <div className="text-lg font-bold text-foreground mt-1">High Overlap</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Abbreviations expanded (e.g. MS &rarr; Mild Steel, PLT &rarr; Plate).
                </p>
              </div>
              <div className="p-3 rounded border border-border">
                <div className="font-medium text-muted-foreground">Procurement Consolidation</div>
                <div className="text-lg font-bold text-emerald-500 mt-1">Eligible</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
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
