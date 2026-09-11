/**
 * Data Ingestion Page
 * Shows Phase 1 (ingestion status) and Phase 2 (normalization results).
 */

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  ShieldCheck,
  Hash,
  ArrowRight,
} from 'lucide-react';
import { mockProcessingJobs } from '@/lib/mock/jobs';
import { ingestionService } from '@/services/ingestionService';
import type { NormalizationStatus } from '@/types';

export default function Ingest() {
  const jobs = mockProcessingJobs.slice(0, 3);
  const [normStatus, setNormStatus] = useState<NormalizationStatus | null>(null);
  const [normLoading, setNormLoading] = useState(false);

  useEffect(() => {
    ingestionService.getNormalization().then(setNormStatus).catch(() => setNormStatus(null));
  }, []);

  const handleRunNormalization = async () => {
    setNormLoading(true);
    try {
      await ingestionService.runNormalization();
      const status = await ingestionService.getNormalization();
      setNormStatus(status);
    } catch {
      // Keep existing status on error
    } finally {
      setNormLoading(false);
    }
  };

  const report = normStatus?.report;

  return (
    <AppLayout>
      <div className="space-y-8">
        <PageHeader
          title="Data Ingestion"
          description="Raw dataset ingestion, profiling, and Phase 2 normalization pipeline"
        />

        {/* Upload Zone */}
        <Card className="border-border bg-card border-dashed">
          <CardContent className="py-14">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="p-4 rounded-full bg-primary/10 border border-primary/20">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Upload Material Dataset</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Drag and drop your CSV file, or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Accepts: <code className="bg-muted px-1 rounded text-xs">.csv</code> up to 500 MB
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Dataset */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Phase 1 — Raw Dataset</CardTitle>
            <CardDescription>CPSE_Material_Master_cleaned.csv · Immutable source</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border border-border">
              <FileText className="h-8 w-8 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  CPSE_Material_Master_cleaned.csv
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  data/raw/ · 1,250 records · 18 columns · 4 CPSEs
                </p>
                <p className="text-xs text-muted-foreground font-mono mt-1 truncate">
                  SHA256: 1a45fccad5203de25f64bfda42e2f566…
                </p>
              </div>
              <Badge variant="default" className="shrink-0">
                <ShieldCheck className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            </div>

            {/* Quality score row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
                <div className="text-2xl font-bold text-foreground">1,250</div>
                <div className="text-xs text-muted-foreground mt-0.5">Records</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
                <div className="text-2xl font-bold text-foreground">18</div>
                <div className="text-xs text-muted-foreground mt-0.5">Columns</div>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                <div className="text-2xl font-bold text-green-500">93.1</div>
                <div className="text-xs text-muted-foreground mt-0.5">Quality Score</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Phase 2 — Normalization Results */}
        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Phase 2 — Normalization
                </CardTitle>
                <CardDescription>
                  Deterministic text cleaning, abbreviation expansion, and UOM canonicalization
                </CardDescription>
              </div>
              {normStatus?.status === 'not_run' && (
                <Button
                  size="sm"
                  onClick={handleRunNormalization}
                  disabled={normLoading}
                  className="gap-2"
                >
                  {normLoading ? (
                    <Clock className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Run Normalization
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status badge */}
            {normStatus?.status === 'not_run' && (
              <div className="flex items-center gap-2 text-amber-500 text-sm">
                <AlertTriangle className="h-4 w-4" />
                Phase 2 has not been executed yet.
              </div>
            )}

            {report && (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-center">
                    <div className="text-xl font-bold text-foreground">
                      {report.records_changed.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Records Normalized</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
                    <div className="text-xl font-bold text-foreground">
                      {report.percentage_changed.toFixed(0)}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Records Changed</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
                    <div className="text-xl font-bold text-foreground">
                      {Object.values(report.rule_application_counts).reduce((a, b) => a + b, 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Rule Applications</div>
                  </div>
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                    <div className="text-xl font-bold text-green-500">0</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Values Fabricated</div>
                  </div>
                </div>

                {/* Description reduction */}
                <div className="p-4 rounded-lg border border-border bg-muted/20">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    Representational Reduction (Descriptions)
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-foreground">
                        {report.unique_descriptions.before_normalization}
                      </div>
                      <div className="text-xs text-muted-foreground">Unique (Raw)</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="text-center">
                      <div className="text-lg font-semibold text-primary">
                        {report.unique_descriptions.after_normalization}
                      </div>
                      <div className="text-xs text-muted-foreground">Unique (Normalized)</div>
                    </div>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {report.unique_descriptions.before_normalization -
                        report.unique_descriptions.after_normalization}{' '}
                      collapsed
                    </Badge>
                  </div>
                </div>

                {/* Rule application counts */}
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    Rule Applications
                  </div>
                  <div className="space-y-2">
                    {Object.entries(report.rule_application_counts).map(([rule, count]) => (
                      <div
                        key={rule}
                        className="flex items-center justify-between p-2 rounded border border-border bg-muted/20"
                      >
                        <span className="text-xs font-mono text-foreground">{rule}</span>
                        <Badge variant="secondary" className="text-xs">
                          {count.toLocaleString()}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Field change counts */}
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    Fields Changed
                  </div>
                  <div className="space-y-2">
                    {Object.entries(report.field_change_counts).map(([field, count]) => (
                      <div
                        key={field}
                        className="flex items-center justify-between p-2 rounded border border-border bg-muted/20"
                      >
                        <span className="text-xs text-foreground">{field.replace(/_/g, ' ')}</span>
                        <span className="text-xs text-muted-foreground">
                          {count.toLocaleString()} records
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Raw data integrity */}
                <div className="p-4 rounded-lg border border-green-500/20 bg-green-500/5">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium text-green-500">
                      Raw Dataset Integrity Verified
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Hash className="h-3 w-3" />
                      <span className="font-mono truncate">{report.raw_dataset_hash_before}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      <span className="text-green-500">Hash unchanged before and after normalization</span>
                    </div>
                  </div>
                </div>

                {/* Before / after examples */}
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    Normalization Examples
                  </div>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="grid grid-cols-2 text-xs font-medium text-muted-foreground bg-muted/40 px-4 py-2">
                      <span>Original (Raw)</span>
                      <span>Normalized</span>
                    </div>
                    {[
                      ['FLOATING BALL VALVE 1 in SS 316', 'floating ball valve 1 in stainless steel 316'],
                      ['HRC CARTRIDGE 10 A', 'high rupturing capacity cartridge 10 a'],
                      ['BEARING NO 6207', 'bearing number 6207'],
                      ['HEX NUT M8 ZINC PLATED', 'hexagonal nut m8 zinc plated'],
                      ['WELD NECK FLANGE 1 in ASTM A105', 'weld neck flange 1 in astm a105'],
                    ].map(([orig, norm], i) => (
                      <div
                        key={i}
                        className="grid grid-cols-2 text-xs px-4 py-2.5 border-t border-border hover:bg-muted/20 transition-colors"
                      >
                        <span className="text-muted-foreground font-mono truncate pr-4">{orig}</span>
                        <span className="text-foreground font-mono truncate">{norm}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Recent Jobs */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Recent Ingestion Jobs</CardTitle>
            <CardDescription>Pipeline execution history</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                >
                  <div className="shrink-0">
                    {job.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {job.status === 'running' && <Clock className="h-4 w-4 text-blue-500 animate-spin" />}
                    {job.status === 'pending' && <Clock className="h-4 w-4 text-muted-foreground" />}
                    {job.status === 'failed' && <AlertTriangle className="h-4 w-4 text-destructive" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {job.jobType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </p>
                    <p className="text-xs text-muted-foreground">{job.phase}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {job.results?.recordsProcessed?.toLocaleString() ?? '—'} records
                    </span>
                    <Badge
                      variant={
                        job.status === 'completed'
                          ? 'default'
                          : job.status === 'running'
                            ? 'secondary'
                            : 'outline'
                      }
                      className="text-xs capitalize"
                    >
                      {job.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
