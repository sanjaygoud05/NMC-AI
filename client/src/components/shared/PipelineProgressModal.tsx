import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Activity,
  Loader2,
  ArrowRight,
  Database,
  Layers,
  Sparkles,
  ShieldCheck,
  Cpu,
  Check,
} from 'lucide-react';
import { useDataset, BackgroundTaskState } from '@/contexts/DatasetContext';

interface PipelineProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: BackgroundTaskState | null;
  onRunInBackground?: () => void;
}

const PIPELINE_STEPS = [
  {
    step: 1,
    id: 'validation',
    title: '1. Ingestion & Validation',
    subtitle: '18-column schema, CPSE classification, file checksum',
    icon: ShieldCheck,
    minProgress: 15,
  },
  {
    step: 2,
    id: 'cleansing',
    title: '2. Cleansing & Normalization',
    subtitle: 'Deterministic cleaning, abbreviations, UOM canonicalization',
    icon: Sparkles,
    minProgress: 35,
  },
  {
    step: 3,
    id: 'extraction',
    title: '3. Attribute Extraction',
    subtitle: 'Engineering attribute parsing & canonical material key',
    icon: Layers,
    minProgress: 55,
  },
  {
    step: 4,
    id: 'matching',
    title: '4. AI Semantic Matching',
    subtitle: 'Sentence transformers, candidate blocking & vector similarity',
    icon: Cpu,
    minProgress: 80,
  },
  {
    step: 5,
    id: 'harmonization',
    title: '5. Master Harmonization',
    subtitle: 'Technical validation, Common Material Master & Procurement',
    icon: Database,
    minProgress: 100,
  },
];

export function PipelineProgressModal({
  open,
  onOpenChange,
  task,
  onRunInBackground,
}: PipelineProgressModalProps) {
  const navigate = useNavigate();
  const { selectDataset } = useDataset();

  if (!task) return null;

  const isCompleted = task.status === 'COMPLETED';
  const isFailed = task.status === 'FAILED';
  const progress = task.progress ?? (isCompleted ? 100 : 10);

  const handleViewDashboard = () => {
    onOpenChange(false);
    if (task.datasetId) {
      selectDataset(task.datasetId);
    }
    navigate('/dashboard');
  };

  const handleRunInBackgroundClick = () => {
    onOpenChange(false);
    if (onRunInBackground) {
      onRunInBackground();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl bg-card border-border shadow-2xl p-6 rounded-2xl overflow-hidden">
        {isCompleted ? (
          <>
            <DialogHeader className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-foreground">
                    Dataset Harmonization Complete!
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Dataset <span className="font-semibold text-foreground font-mono">"{task.fileName}"</span> has finished all pipeline phases.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Completion Progress & Checkmarks */}
            <div className="space-y-4 py-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5" /> All 5 Phases Completed
                  </span>
                  <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">100%</span>
                </div>
                <Progress value={100} className="h-2 bg-emerald-500/20 [&>div]:bg-emerald-500" />
              </div>

              {/* Step Summary Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {PIPELINE_STEPS.map((step) => {
                  const Icon = step.icon;
                  return (
                    <div
                      key={step.id}
                      className="flex items-center gap-2.5 p-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-foreground"
                    >
                      <div className="p-1 rounded bg-emerald-500/20 text-emerald-500">
                        <Check className="h-3 w-3" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-xs truncate">{step.title}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{step.subtitle}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="p-3 rounded-xl bg-muted/40 border border-border text-center">
                  <div className="text-xs text-muted-foreground">Processed Records</div>
                  <div className="text-xl font-bold text-foreground mt-0.5">
                    {task.rows ? task.rows.toLocaleString() : '—'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-muted/40 border border-border text-center">
                  <div className="text-xs text-muted-foreground">CPSE Entities</div>
                  <div className="text-xl font-bold text-foreground mt-0.5">
                    {task.cpses ?? '—'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center col-span-2 sm:col-span-1">
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Pipeline Status</div>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    READY
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs"
              >
                Stay Here
              </Button>
              <Button
                size="sm"
                onClick={handleViewDashboard}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-1.5 shadow-md shadow-primary/25"
              >
                View Dashboard
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-full bg-primary/10 border border-primary/20 text-primary">
                    <Activity className="h-5 w-5 animate-pulse" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold text-foreground truncate max-w-[280px] sm:max-w-sm">
                      Harmonizing: {task.fileName}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                      Executing automated pipeline phases with deterministic governance
                    </DialogDescription>
                  </div>
                </div>
                <Badge variant="outline" className="font-mono text-[11px] py-0.5 px-2 bg-muted/60 border-primary/30 text-primary shrink-0 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                  {task.status || 'PROCESSING'}
                </Badge>
              </div>
            </DialogHeader>

            {/* Active Progress Bar */}
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    {task.phase || 'Processing Pipeline…'}
                  </span>
                  <span className="font-mono font-bold text-primary">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2 bg-muted [&>div]:bg-primary transition-all duration-300" />
              </div>

              {/* Detailed Steps List */}
              <div className="space-y-2">
                {PIPELINE_STEPS.map((step, idx) => {
                  const Icon = step.icon;
                  const isDone = progress >= step.minProgress;
                  const isCurrent = !isDone && (idx === 0 || progress >= PIPELINE_STEPS[idx - 1].minProgress);

                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-200 ${
                        isDone
                          ? 'border-emerald-500/40 bg-emerald-500/5 text-foreground'
                          : isCurrent
                            ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10 text-foreground ring-1 ring-primary/30'
                            : 'border-border/60 bg-muted/20 text-muted-foreground'
                      }`}
                    >
                      <div
                        className={`p-1.5 rounded-lg shrink-0 flex items-center justify-center ${
                          isDone
                            ? 'bg-emerald-500/20 text-emerald-500'
                            : isCurrent
                              ? 'bg-primary/20 text-primary'
                              : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {isDone ? (
                          <Check className="h-4 w-4 stroke-[2.5]" />
                        ) : isCurrent ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Icon className="h-4 w-4 opacity-50" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs font-semibold truncate ${isCurrent ? 'text-primary' : ''}`}>
                            {step.title}
                          </span>
                          {isDone && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                              Done
                            </Badge>
                          )}
                          {isCurrent && (
                            <Badge className="text-[10px] py-0 px-1.5 bg-primary text-primary-foreground animate-pulse">
                              In Progress
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {step.subtitle}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sub-note */}
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/80 text-center text-xs text-muted-foreground">
                You can let processing run here or switch to background mode. When finished, you'll be prompted to view the dashboard.
              </div>
            </div>

            <DialogFooter className="pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunInBackgroundClick}
                className="w-full sm:w-auto text-xs hover:border-primary/50"
              >
                Run in Background
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
