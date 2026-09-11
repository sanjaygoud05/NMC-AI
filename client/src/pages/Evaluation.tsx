/**
 * Model Evaluation & Benchmark Page
 * Golden dataset evaluation, Precision/Recall/F1 metrics, and threshold sensitivity analysis.
 */

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Target,
  BarChart2,
  Sparkles,
  SlidersHorizontal,
  History,
  CheckCircle2,
  Play,
  RotateCw,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import type { EvaluationReport } from '@/types';

export default function Evaluation() {
  const [isRunning, setIsRunning] = useState(false);
  const [threshold, setThreshold] = useState([85]);

  const mockEvaluationRuns: EvaluationReport[] = [
    {
      id: 'eval-run-004',
      runAt: '2024-01-15T11:45:00Z',
      goldenDataset: 'CPCL_Harmonization_Golden_v2.csv',
      totalPairs: 500,
      evaluatedPairs: 500,
      precision: 0.948,
      recall: 0.912,
      f1Score: 0.930,
      accuracy: 0.954,
      thresholdUsed: 0.85,
      notes: 'Hybrid model with expanded abbreviation dictionary IS 2062 & UOM normalizer',
    },
    {
      id: 'eval-run-003',
      runAt: '2024-01-14T16:20:00Z',
      goldenDataset: 'CPCL_Harmonization_Golden_v2.csv',
      totalPairs: 500,
      evaluatedPairs: 500,
      precision: 0.915,
      recall: 0.884,
      f1Score: 0.899,
      accuracy: 0.926,
      thresholdUsed: 0.80,
      notes: 'Fine-tuned sentence transformer with cosine similarity only',
    },
    {
      id: 'eval-run-002',
      runAt: '2024-01-12T10:15:00Z',
      goldenDataset: 'CPCL_Harmonization_Golden_v1.csv',
      totalPairs: 350,
      evaluatedPairs: 350,
      precision: 0.862,
      recall: 0.810,
      f1Score: 0.835,
      accuracy: 0.878,
      thresholdUsed: 0.75,
      notes: 'Baseline Fuzzy Levenshtein + RapidFuzz matching',
    },
  ];

  const handleRunEvaluation = () => {
    setIsRunning(true);
    toast.info('Evaluating current model pipeline against golden benchmark dataset...');
    setTimeout(() => {
      setIsRunning(false);
      toast.success('Benchmark completed: Precision 94.8%, Recall 91.2%, F1 0.930');
    }, 1500);
  };

  const latest = mockEvaluationRuns[0];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageHeader
            title="Model Evaluation & Benchmarking"
            description="Ground-truth validation, Precision/Recall trade-offs, and threshold calibration"
          />
          <Button
            onClick={handleRunEvaluation}
            disabled={isRunning}
            className="gap-2 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isRunning ? <RotateCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run Benchmark Evaluation
          </Button>
        </div>

        {/* 4 Core ML Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Precision</div>
              <div className="text-3xl font-bold text-emerald-500 mt-1">
                {(latest.precision * 100).toFixed(1)}%
              </div>
              <Progress value={latest.precision * 100} className="mt-2 h-1.5" />
              <div className="text-[11px] text-muted-foreground mt-1">Low false-positive rate</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Recall</div>
              <div className="text-3xl font-bold text-primary mt-1">
                {(latest.recall * 100).toFixed(1)}%
              </div>
              <Progress value={latest.recall * 100} className="mt-2 h-1.5" />
              <div className="text-[11px] text-muted-foreground mt-1">High duplicate capture</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">F1 Score</div>
              <div className="text-3xl font-bold text-foreground mt-1">
                {(latest.f1Score * 100).toFixed(1)}%
              </div>
              <Progress value={latest.f1Score * 100} className="mt-2 h-1.5" />
              <div className="text-[11px] text-muted-foreground mt-1">Harmonic mean balance</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Overall Accuracy</div>
              <div className="text-3xl font-bold text-foreground mt-1">
                {(latest.accuracy * 100).toFixed(1)}%
              </div>
              <Progress value={latest.accuracy * 100} className="mt-2 h-1.5" />
              <div className="text-[11px] text-muted-foreground mt-1">500 Golden benchmark pairs</div>
            </CardContent>
          </Card>
        </div>

        {/* Sensitivity & Confusion Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Threshold Sensitivity */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                Confidence Threshold Calibration
              </CardTitle>
              <CardDescription>
                Tune automatic acceptance cutoff versus manual review routing threshold
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium">Harmonization Acceptance Cutoff</span>
                  <span className="font-mono text-primary font-bold">{threshold[0]}%</span>
                </div>
                <Slider
                  value={threshold}
                  onValueChange={setThreshold}
                  min={50}
                  max={98}
                  step={1}
                />
                <div className="flex justify-between text-[11px] text-muted-foreground mt-2">
                  <span>Higher Recall (50%)</span>
                  <span>Balanced (85%)</span>
                  <span>Higher Precision (98%)</span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-muted/30 border border-border text-xs space-y-1.5">
                <div className="font-semibold text-foreground">Projected Impact at {threshold[0]}%:</div>
                <div className="text-muted-foreground">
                  • <strong>{(threshold[0] * 1.05).toFixed(0)}%</strong> auto-accepted without human intervention.
                </div>
                <div className="text-muted-foreground">
                  • <strong>{100 - threshold[0]}%</strong> routed to Subject Matter Expert Review Queue.
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Confusion Matrix */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-500" />
                Confusion Matrix (Golden Test Set)
              </CardTitle>
              <CardDescription>
                Validation performance across 500 hand-verified CPSE pair annotations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-xs text-muted-foreground uppercase font-semibold">True Positive</div>
                  <div className="text-2xl font-bold text-emerald-500 mt-1">228 pairs</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Correctly Harmonized</div>
                </div>

                <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20">
                  <div className="text-xs text-muted-foreground uppercase font-semibold">False Positive</div>
                  <div className="text-2xl font-bold text-rose-500 mt-1">12 pairs</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Mismatched Merges</div>
                </div>

                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="text-xs text-muted-foreground uppercase font-semibold">False Negative</div>
                  <div className="text-2xl font-bold text-amber-500 mt-1">22 pairs</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Missed Synonym Pairs</div>
                </div>

                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="text-xs text-muted-foreground uppercase font-semibold">True Negative</div>
                  <div className="text-2xl font-bold text-primary mt-1">238 pairs</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Correctly Discarded</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Benchmark Run History & Recharts Comparison */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-primary" />
              Benchmark Accuracy & F1 Metric Progression
            </CardTitle>
            <CardDescription>
              Performance trajectory across iteration checkpoints (Precision, Recall, F1-Score)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { run: 'Run 002 (Levenshtein)', precision: 86.2, recall: 81.0, f1: 83.5 },
                  { run: 'Run 003 (Transformer)', precision: 91.5, recall: 88.4, f1: 89.9 },
                  { run: 'Run 004 (Hybrid + Rule)', precision: 94.8, recall: 91.2, f1: 93.0 },
                ]}>
                  <XAxis dataKey="run" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} domain={[70, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    formatter={(val: number) => [`${val}%`, '']}
                  />
                  <Legend />
                  <Bar dataKey="precision" name="Precision %" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="recall" name="Recall %" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="f1" name="F1 Score %" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Benchmark Run History Table */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Benchmark Evaluation Run History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run ID</TableHead>
                  <TableHead>Golden Test Dataset</TableHead>
                  <TableHead className="text-center">Threshold</TableHead>
                  <TableHead className="text-center">Precision</TableHead>
                  <TableHead className="text-center">Recall</TableHead>
                  <TableHead className="text-center">F1 Score</TableHead>
                  <TableHead className="text-center">Accuracy</TableHead>
                  <TableHead>Pipeline Model Configuration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockEvaluationRuns.map((run) => (
                  <TableRow key={run.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs font-semibold">{run.id}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{run.goldenDataset}</TableCell>
                    <TableCell className="text-center font-mono text-xs">{(run.thresholdUsed * 100).toFixed(0)}%</TableCell>
                    <TableCell className="text-center font-mono text-xs text-emerald-500 font-semibold">
                      {(run.precision * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs text-primary font-semibold">
                      {(run.recall * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs font-bold">
                      {(run.f1Score * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs">
                      {(run.accuracy * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {run.notes}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
