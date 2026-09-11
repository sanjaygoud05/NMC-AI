/**
 * Processing Jobs & Pipeline Monitor Page
 * Real-time monitoring of asynchronous harmonization pipeline jobs, ETL status, and execution metrics.
 */

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
  Activity,
  Play,
  RotateCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCode,
  Terminal,
} from 'lucide-react';
import { mockProcessingJobs } from '@/lib/mock/jobs';
import type { ProcessingJob } from '@/types';

export default function Jobs() {
  const [jobs, setJobs] = useState<ProcessingJob[]>(mockProcessingJobs);
  const [isStarting, setIsStarting] = useState(false);

  const handleTriggerPipeline = () => {
    setIsStarting(true);
    toast.info('Triggering SIH26099 end-to-end pipeline execution...');

    const newJob: ProcessingJob = {
      id: `job-${Date.now()}`,
      jobType: 'matching',
      phase: 'phase07_candidate_matching',
      status: 'running',
      progress: 15,
      startedAt: new Date().toISOString(),
      metadata: {
        source: 'CPSE_Material_Master_cleaned.csv',
        target: 'database.matches',
        parameters: { threshold: 0.85 },
        priority: 'high',
        requestedBy: 'current_user',
      },
      results: {
        recordsProcessed: 320,
        recordsSucceeded: 320,
        recordsFailed: 0,
        executionTime: 45,
      },
    };

    setTimeout(() => {
      setJobs((prev) => [newJob, ...prev]);
      setIsStarting(false);
      toast.success('Harmonization job spawned in background');
    }, 800);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1 text-xs">
            <CheckCircle2 className="h-3 w-3" /> Completed
          </Badge>
        );
      case 'running':
        return (
          <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20 gap-1 text-xs">
            <RotateCw className="h-3 w-3 animate-spin" /> Running
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20 gap-1 text-xs">
            <AlertCircle className="h-3 w-3" /> Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1 text-xs">
            <Clock className="h-3 w-3" /> Pending
          </Badge>
        );
    }
  };

  const completedCount = jobs.filter((j) => j.status === 'completed').length;
  const runningCount = jobs.filter((j) => j.status === 'running').length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageHeader
            title="Pipeline Jobs & Orchestration"
            description="Background task queue, execution phases, and performance telemetry"
          />
          <Button
            onClick={handleTriggerPipeline}
            disabled={isStarting}
            className="gap-2 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Play className="h-4 w-4" />
            Trigger New Pipeline Run
          </Button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Active Running Jobs</div>
              <div className="text-3xl font-bold text-blue-500 mt-1">{runningCount}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Executing async workers</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Successful Jobs</div>
              <div className="text-3xl font-bold text-emerald-500 mt-1">{completedCount}</div>
              <div className="text-[11px] text-muted-foreground mt-1">100% completion rate</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Records Processed</div>
              <div className="text-3xl font-bold text-foreground mt-1">3,312</div>
              <div className="text-[11px] text-muted-foreground mt-1">Across 5 pipeline phases</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Mean Processing Speed</div>
              <div className="text-3xl font-bold text-foreground mt-1">0.69 /sec</div>
              <div className="text-[11px] text-muted-foreground mt-1">Optimized vector batching</div>
            </CardContent>
          </Card>
        </div>

        {/* Jobs Table */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Pipeline Execution History
            </CardTitle>
            <CardDescription>
              Chronological log of batch jobs, ingestion runs, and AI extraction phases
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Phase</TableHead>
                  <TableHead>Operation Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-48">Progress</TableHead>
                  <TableHead>Processed</TableHead>
                  <TableHead className="text-right">Execution Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs font-semibold text-foreground">
                      {job.id}
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {job.phase}
                      </Badge>
                    </TableCell>

                    <TableCell className="capitalize text-xs font-medium">
                      {job.jobType.replace('_', ' ')}
                    </TableCell>

                    <TableCell>{getStatusBadge(job.status)}</TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={job.progress} className="h-1.5 flex-1" />
                        <span className="font-mono text-xs w-8 text-right">{job.progress}%</span>
                      </div>
                    </TableCell>

                    <TableCell className="text-xs font-mono">
                      {job.results?.recordsProcessed ? (
                        <span>
                          {job.results.recordsProcessed} items
                          {job.results.recordsFailed ? (
                            <span className="text-rose-500 ml-1">({job.results.recordsFailed} failed)</span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell className="text-right text-xs font-mono text-muted-foreground">
                      {job.results?.executionTime ? `${job.results.executionTime}s` : '—'}
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
