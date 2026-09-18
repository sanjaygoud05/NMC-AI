/**
 * Model Evaluation & Benchmarking Page
 * Candidate generation performance, embedding metrics, and threshold calibration.
 * Wired to real /api/matches/report data.
 */

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Cpu,
  Activity,
  BarChart3,
  Clock,
  Database,
  Layers,
  TrendingUp,
  ShieldCheck,
  Hash,
  Upload,
  Braces,
} from 'lucide-react';
import { useDataset } from '@/contexts/DatasetContext';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { API_BASE } from '@/services/apiConfig';

interface MatchReport {
  phase: string;
  dataset: {
    input_rows: number;
    unique_material_codes: number;
    input_sha256: string;
    output_sha256: string;
  };
  performance: {
    naive_all_pairs: number;
    blocked_candidate_pairs: number;
    blocking_reduction_ratio_percent: number;
    retained_candidate_pairs: number;
    average_candidates_per_material: number;
    embedding_time_seconds: number;
    blocking_time_seconds: number;
    scoring_time_seconds: number;
    total_runtime_seconds: number;
  };
  embedding: {
    embedding_method: string;
    embedding_model: string;
    embedding_dimension: number;
    fallback_used: boolean;
    input_sha256: string;
  };
  candidate_summary: {
    total_candidates: number;
    cross_cpse_candidates: number;
    same_cpse_candidates: number;
    high_confidence_candidates: number;
    medium_confidence_candidates: number;
    low_confidence_candidates: number;
    exact_canonical_key_candidates: number;
    engineering_incompatibilities: number;
  };
  cpse_distribution: Record<string, number>;
  has_dataset: boolean;
  data_available: boolean;
}

export default function Evaluation() {
  const { activeDatasetId, selectDataset } = useDataset();
  const [report, setReport] = useState<MatchReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState([85]);

  useEffect(() => {
    async function load() {
      if (!activeDatasetId || activeDatasetId === 'NONE') {
        setReport(null);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/matches/report?dataset_id=${encodeURIComponent(activeDatasetId)}`);
        if (res.ok) setReport(await res.json());
      } catch {/* ignore */} finally {
        setLoading(false);
      }
    }
    load();
  }, [activeDatasetId]);

  if (activeDatasetId === 'NONE') {
    return (
      <AppLayout>
        <div className="space-y-6">
          <PageHeader title="Model Evaluation & Benchmarking" description="Candidate generation performance, embedding metrics, and threshold calibration." />
          <Card className="border-border bg-card p-12">
            <EmptyState
              icon={Database}
              title="No Dataset Selected"
              description="Select or upload a dataset to view evaluation results."
              action={{ label: 'Upload Dataset', icon: Upload, href: '/ingest' }}
            />
            <div className="mt-4 flex justify-center">
              <Button variant="outline" size="sm" onClick={() => selectDataset('BASELINE')} className="text-xs text-muted-foreground hover:text-foreground">
                Use Frozen Baseline (2,200 records)
              </Button>
            </div>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const perf = report?.performance;
  const emb = report?.embedding;
  const cs = report?.candidate_summary;

  // CPSE pair distribution — top 10 cross-CPSE pairs only
  const cpsePairs = Object.entries(report?.cpse_distribution ?? {})
    .filter(([key]) => !key.includes('->') || key.split('->')[0].trim() !== key.split('->')[1].trim())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  const maxPairCount = cpsePairs.length > 0 ? cpsePairs[0][1] : 1;

  return (
    <AppLayout>
      <div className="space-y-5">
        <PageHeader
          title="Model Evaluation & Benchmarking"
          description="Phase 5 candidate generation performance — embedding, blocking, and scoring metrics."
        />

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              icon: Database,
              label: 'Input Materials',
              value: report?.dataset.input_rows.toLocaleString() ?? '—',
              sub: 'Unique source records',
            },
            {
              icon: Layers,
              label: 'Total Candidates',
              value: cs?.total_candidates.toLocaleString() ?? '—',
              sub: `${cs?.cross_cpse_candidates.toLocaleString() ?? '—'} cross-CPSE`,
            },
            {
              icon: TrendingUp,
              label: 'Blocking Reduction',
              value: perf ? `${perf.blocking_reduction_ratio_percent.toFixed(1)}%` : '—',
              sub: `${perf?.naive_all_pairs.toLocaleString() ?? '—'} → ${perf?.blocked_candidate_pairs.toLocaleString() ?? '—'}`,
            },
            {
              icon: Clock,
              label: 'Total Runtime',
              value: perf ? `${perf.total_runtime_seconds.toFixed(1)}s` : '—',
              sub: `Embedding ${perf?.embedding_time_seconds.toFixed(1) ?? '—'}s · Scoring ${perf?.scoring_time_seconds.toFixed(1) ?? '—'}s`,
            },
          ].map(({ icon: Icon, label, value, sub }) => (
            <Card key={label} className="border-border bg-card">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </div>
                <div className="text-2xl font-bold tracking-tight text-foreground">{loading ? '…' : value}</div>
                <div className="text-[11px] text-muted-foreground">{sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Embedding Model Details */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                Embedding Model
              </CardTitle>
              <CardDescription className="text-xs">Phase 5 semantic encoder configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-0">
              {emb ? (
                <div className="divide-y divide-border/50 rounded-lg border border-border overflow-hidden">
                  {[
                    { label: 'Model', value: emb.embedding_model },
                    { label: 'Method', value: emb.embedding_method.replace('sentence_transformer_', '') },
                    { label: 'Dimension', value: `${emb.embedding_dimension}d vectors` },
                    { label: 'Fallback Used', value: emb.fallback_used ? 'Yes (TF-IDF)' : 'No (native)' },
                    { label: 'Input SHA-256', value: emb.input_sha256.substring(0, 20) + '…' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between px-3 py-2 text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-mono text-foreground font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground text-center py-6">{loading ? 'Loading…' : 'No data'}</div>
              )}
            </CardContent>
          </Card>

          {/* Candidate Confidence Breakdown */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                Candidate Confidence Bands
              </CardTitle>
              <CardDescription className="text-xs">Distribution of {cs?.total_candidates.toLocaleString() ?? '—'} candidate pairs by confidence tier</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {cs ? (
                <>
                  {[
                    { label: 'High Confidence (Exact key match)', value: cs.high_confidence_candidates, total: cs.total_candidates, note: 'Exact canonical key' },
                    { label: 'Medium Confidence', value: cs.medium_confidence_candidates, total: cs.total_candidates, note: 'Semantic similarity' },
                    { label: 'Low Confidence (Filtered)', value: cs.low_confidence_candidates, total: cs.total_candidates, note: 'Below threshold' },
                    { label: 'Engineering Incompatibilities', value: cs.engineering_incompatibilities, total: cs.total_candidates, note: 'Hard-rejected' },
                  ].map(({ label, value, total, note }) => {
                    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                    return (
                      <div key={label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-mono text-foreground font-medium">{value.toLocaleString()} <span className="text-muted-foreground font-normal">({pct}%)</span></span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                        <div className="text-[10px] text-muted-foreground/70">{note}</div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="text-xs text-muted-foreground text-center py-6">{loading ? 'Loading…' : 'No data'}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* CPSE Pair Distribution */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Top Cross-CPSE Candidate Pair Distribution
            </CardTitle>
            <CardDescription className="text-xs">Top 12 enterprise pairs by number of candidate matches generated</CardDescription>
          </CardHeader>
          <CardContent>
            {cpsePairs.length > 0 ? (
              <div className="space-y-2">
                {cpsePairs.map(([pair, count]) => {
                  const pct = Math.round((count / maxPairCount) * 100);
                  return (
                    <div key={pair} className="flex items-center gap-3 text-xs">
                      <div className="w-40 text-muted-foreground font-mono shrink-0 truncate">{pair}</div>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="w-14 text-right font-mono text-foreground">{count.toLocaleString()}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground text-center py-6">{loading ? 'Loading…' : 'No distribution data available'}</div>
            )}
          </CardContent>
        </Card>

        {/* Performance Timing */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Pipeline Runtime Breakdown
            </CardTitle>
            <CardDescription className="text-xs">End-to-end Phase 5 candidate generation timing</CardDescription>
          </CardHeader>
          <CardContent>
            {perf ? (
              <div className="rounded-lg border border-border overflow-hidden divide-y divide-border/50">
                {[
                  { label: 'Embedding (sentence-transformer)', value: `${perf.embedding_time_seconds.toFixed(2)}s`, pct: Math.round((perf.embedding_time_seconds / perf.total_runtime_seconds) * 100) },
                  { label: 'Blocking (LSH / canonical key)', value: `${perf.blocking_time_seconds.toFixed(2)}s`, pct: Math.round((perf.blocking_time_seconds / perf.total_runtime_seconds) * 100) },
                  { label: 'Scoring (cosine similarity)', value: `${perf.scoring_time_seconds.toFixed(2)}s`, pct: Math.round((perf.scoring_time_seconds / perf.total_runtime_seconds) * 100) },
                  { label: 'Total', value: `${perf.total_runtime_seconds.toFixed(2)}s`, pct: 100, bold: true },
                ].map(({ label, value, pct, bold }) => (
                  <div key={label} className={`flex items-center justify-between px-3 py-2 text-xs ${bold ? 'bg-muted/30' : ''}`}>
                    <span className={bold ? 'font-semibold text-foreground' : 'text-muted-foreground'}>{label}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                      </div>
                      <span className={`font-mono w-12 text-right ${bold ? 'font-bold text-foreground' : 'text-foreground'}`}>{value}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground text-center py-6">{loading ? 'Loading…' : 'No runtime data available'}</div>
            )}
          </CardContent>
        </Card>

        {/* Dataset Integrity */}
        {report?.dataset && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                Dataset Integrity Hashes
              </CardTitle>
              <CardDescription className="text-xs">SHA-256 fingerprints confirming raw data immutability through Phase 5</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border divide-y divide-border/50 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="text-muted-foreground">Input Dataset SHA-256</span>
                  <span className="font-mono text-[11px] text-foreground">{report.dataset.input_sha256.substring(0, 32)}…</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="text-muted-foreground">Output Candidates SHA-256</span>
                  <span className="font-mono text-[11px] text-foreground">{report.dataset.output_sha256.substring(0, 32)}…</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Threshold Configuration */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              Threshold Calibration
            </CardTitle>
            <CardDescription className="text-xs">
              Harmonization acceptance cutoff — affects Precision/Recall trade-off. Current: <span className="font-mono font-bold text-foreground">{threshold[0]}%</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Slider
              value={threshold}
              onValueChange={setThreshold}
              min={50}
              max={98}
              step={1}
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Higher Recall (50%)</span>
              <span>Balanced (85%)</span>
              <span>Higher Precision (98%)</span>
            </div>
            {cs && (
              <div className="grid grid-cols-3 gap-3 pt-1">
                {[
                  { label: 'Est. Accepted', value: Math.round(cs.high_confidence_candidates * (threshold[0] / 100)).toLocaleString() },
                  { label: 'Est. Rejected', value: Math.round(cs.total_candidates * ((100 - threshold[0]) / 100)).toLocaleString() },
                  { label: 'Precision Target', value: `~${threshold[0]}%` },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center p-2 rounded-lg border border-border bg-muted/20">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="font-mono text-sm font-bold text-foreground mt-0.5">{value}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
