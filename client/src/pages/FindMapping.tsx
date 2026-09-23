import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { nmcApi } from '@/services/nmcApi';
import {
  GitMerge,
  CheckCircle2,
  AlertTriangle,
  Play,
  ArrowRight,
  Cpu,
  Layers,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

export default function FindMapping() {
  const queryClient = useQueryClient();
  const [matchResult, setMatchResult] = useState<any | null>(null);

  const { data: readiness, isLoading: loadingReadiness } = useQuery({
    queryKey: ['nmc', 'matching-readiness'],
    queryFn: () => nmcApi.matching.checkReadiness(),
    refetchInterval: 5000,
  });

  const { data: metrics } = useQuery({
    queryKey: ['nmc', 'dashboard-metrics'],
    queryFn: () => nmcApi.analytics.getDashboardMetrics(),
  });

  const [isMatchingRunning, setIsMatchingRunning] = useState(false);

  const startMatching = async () => {
    setIsMatchingRunning(true);
    setMatchResult(null);
    try {
      const trigger = await nmcApi.matching.run();
      toast.info('AI Matching job started. Evaluating candidate pairs in background...');

      // If backend returns COMPLETED immediately
      if (trigger.status === 'COMPLETED' && trigger.matches_created !== undefined) {
        setMatchResult(trigger);
        toast.success(`Matching and Harmonization completed! Generated ${trigger.matches_created} candidate matches.`);
        setIsMatchingRunning(false);
        queryClient.invalidateQueries({ queryKey: ['nmc', 'dashboard-metrics'] });
        queryClient.invalidateQueries({ queryKey: ['nmc', 'review-queue'] });
        queryClient.invalidateQueries({ queryKey: ['nmc', 'cpses-list'] });
        queryClient.invalidateQueries({ queryKey: ['nmc', 'materials'] });
        return;
      }

      // Poll until COMPLETED or FAILED
      const pollInterval = setInterval(async () => {
        try {
          const poll = await nmcApi.matching.getResult();
          if (poll.status === 'COMPLETED') {
            clearInterval(pollInterval);
            setIsMatchingRunning(false);
            const res = poll.result || trigger;
            setMatchResult(res);
            toast.success(`Matching and Harmonization completed! Generated ${res.matches_created ?? 0} candidate matches.`);
            queryClient.invalidateQueries({ queryKey: ['nmc', 'dashboard-metrics'] });
            queryClient.invalidateQueries({ queryKey: ['nmc', 'review-queue'] });
            queryClient.invalidateQueries({ queryKey: ['nmc', 'cpses-list'] });
            queryClient.invalidateQueries({ queryKey: ['nmc', 'materials'] });
          } else if (poll.status === 'FAILED') {
            clearInterval(pollInterval);
            setIsMatchingRunning(false);
            toast.error(poll.error || 'Matching execution failed.');
          }
        } catch (e: any) {
          clearInterval(pollInterval);
          setIsMatchingRunning(false);
          toast.error(e.message || 'Polling matching status failed.');
        }
      }, 1500);
    } catch (err: any) {
      setIsMatchingRunning(false);
      toast.error(err.message || 'Failed to trigger matching.');
    }
  };

  const isReady = readiness?.all_ready ?? false;

  return (
    <AppLayout requireAdmin>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Cross-CPSE Material Matching
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI-driven candidate pair generation and semantic similarity matching across enterprise catalogs.
          </p>
        </div>

        {/* Readiness Gate Banner */}
        <Card className={`border ${isReady ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/5'}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {isReady ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                )}
                <CardTitle className="text-base">
                  {isReady ? 'Matching Engine Ready' : 'Normalization Prerequisite Pending'}
                </CardTitle>
              </div>

              <Badge
                variant="outline"
                className={`text-xs ${
                  isReady
                    ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                    : 'border-amber-500/40 text-amber-600 dark:text-amber-400'
                }`}
              >
                {readiness ? `${readiness.normalized} / ${readiness.total} CPSEs Normalized` : 'Checking...'}
              </Badge>
            </div>
            <CardDescription className="text-xs mt-1">
              {isReady
                ? 'All registered CPSE datasets have been cleaned, extracted, and normalized. Cross-CPSE candidate generation is unlocked.'
                : `Cross-CPSE matching requires all active CPSE datasets to be normalized. Pending CPSEs: ${
                    readiness?.pending_cpses?.join(', ') || 'No active CPSEs'
                  }`}
            </CardDescription>
          </CardHeader>

          <CardFooter className="pt-2 flex items-center justify-between border-t border-border/40">
            {!isReady ? (
              <Link to="/manage-cpses">
                <Button variant="outline" size="sm" className="gap-2 text-xs">
                  Go to CPSE Management & Normalize
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : (
              <div className="text-xs text-muted-foreground">
                Current pending review items: <strong className="text-foreground">{metrics?.pending_reviews ?? 0}</strong>
              </div>
            )}

            <Button
              size="sm"
              disabled={!isReady || isMatchingRunning}
              onClick={startMatching}
              className="gap-2 bg-primary text-primary-foreground font-semibold"
            >
              {isMatchingRunning ? (
                <>
                  <Cpu className="h-4 w-4 animate-spin" />
                  Running AI Matching Engine...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Find Mapping (Run AI Matching)
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Match Execution Results (if just run) */}
        {matchResult && (
          <Card className="border-primary/40 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <Sparkles className="h-4 w-4" />
                Match Execution Completed Successfully
              </div>
              <CardTitle className="text-lg mt-1">Candidate Generation Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center py-2">
              <div className="p-3 rounded-lg bg-card border border-border/60">
                <span className="text-xs text-muted-foreground">Normalized Materials</span>
                <p className="text-xl font-bold text-foreground mt-1">
                  {matchResult.materials_count}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-card border border-border/60">
                <span className="text-xs text-muted-foreground">Pairs Evaluated (Blocking)</span>
                <p className="text-xl font-bold text-foreground mt-1">
                  {matchResult.pairs_evaluated}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-card border border-border/60">
                <span className="text-xs text-muted-foreground">Candidate Matches Saved</span>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {matchResult.matches_created}
                </p>
              </div>
            </CardContent>
            <CardFooter className="pt-2 flex justify-end">
              <Link to="/review">
                <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                  Proceed to Review Queue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardFooter>
          </Card>
        )}

        {/* Architecture & Heuristic Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-border/60">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center gap-2 text-primary text-sm font-semibold">
                <Layers className="h-4 w-4" />
                Multi-Block Candidate Generation
              </div>
              <CardDescription className="text-xs mt-1">
                Deterministic blocking heuristics prevent quadratic explosion while maintaining recall.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <span className="font-mono text-primary font-bold">1.</span>
                <span><strong>Family & Type Blocks:</strong> Pairs must share engineering material family or type.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono text-primary font-bold">2.</span>
                <span><strong>Standard & Size Blocks:</strong> Strict nominal size and ASTM/API standard indexing.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono text-primary font-bold">3.</span>
                <span><strong>Grade & Metallurgy:</strong> Incompatible base metallurgies (SS vs Carbon Steel) are hard-capped.</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center gap-2 text-primary text-sm font-semibold">
                <Cpu className="h-4 w-4" />
                Composite Semantic Scoring
              </div>
              <CardDescription className="text-xs mt-1">
                Explainable scoring combining text, embeddings, and engineering attributes.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <span className="font-mono text-primary font-bold">&bull;</span>
                <span><strong>Sentence-BERT Embeddings:</strong> 384-dimensional domain embeddings via <code>all-MiniLM-L6-v2</code>.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono text-primary font-bold">&bull;</span>
                <span><strong>Attribute Agreement:</strong> Direct comparison across up to 21 structured engineering fields.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono text-primary font-bold">&bull;</span>
                <span><strong>Hard Incompatibility Rules:</strong> Automatic penalty capping for engineering mismatches.</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

