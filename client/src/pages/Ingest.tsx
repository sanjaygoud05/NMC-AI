/**
 * Data Ingestion Page
 * Raw dataset upload, schema validation, and automated harmonization pipeline.
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Upload,
  FileSpreadsheet,
  FileCheck,
  ShieldCheck,
  Hash,
  ArrowRight,
  Loader2,
  Database,
  Layers,
  Activity,
  Check,
  Cpu,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { ingestionService } from '@/services/ingestionService';
import { useDataset } from '@/contexts/DatasetContext';
import { useAuth } from '@/hooks/useAuth';
import type { NormalizationStatus } from '@/types';

interface UploadResult {
  status: string;
  dataset_id?: string;
  job_id?: string;
  filename: string;
  size_bytes: number;
  size_mb: number;
  sha256: string;
  is_official_raw_baseline: boolean;
  record_count: number;
  column_count: number;
  schema_info: {
    is_valid: boolean;
    expected_count: number;
    actual_count: number;
    missing_columns: string[];
    extra_columns: string[];
  };
  cpse_distribution: Record<string, number>;
  staged_path?: string | null;
  message: string;
}

interface InlineTaskState {
  datasetId: string;
  fileName: string;
  phase: string;
  progress: number;
  status: 'IDLE' | 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  rows?: number;
  cpses?: number;
  error?: string;
}

const INLINE_PIPELINE_STEPS = [
  {
    step: 1,
    id: 'validation',
    title: 'Ingestion & Schema',
    subtitle: '20-column CPSE catalog validation',
    icon: ShieldCheck,
    minProgress: 15,
  },
  {
    step: 2,
    id: 'cleansing',
    title: 'Cleansing & Normalization',
    subtitle: 'Text cleaning & UOM canonicalization',
    icon: Sparkles,
    minProgress: 35,
  },
  {
    step: 3,
    id: 'extraction',
    title: 'Attribute Extraction',
    subtitle: 'Entity parsing & canonical material key',
    icon: Layers,
    minProgress: 55,
  },
  {
    step: 4,
    id: 'matching',
    title: 'AI Semantic Matching',
    subtitle: 'Vector embeddings & candidate blocking',
    icon: Cpu,
    minProgress: 80,
  },
  {
    step: 5,
    id: 'harmonization',
    title: 'Master Harmonization',
    subtitle: 'Common Material Master clusters',
    icon: Database,
    minProgress: 100,
  },
];

export default function Ingest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    activeDatasetId,
    datasets,
    selectDataset,
    startBackgroundTask,
    backgroundTask,
    completedNotification,
  } = useDataset();
  const [normStatus, setNormStatus] = useState<NormalizationStatus | null>(null);
  const [normLoading, setNormLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Initialize inlineTask from active backgroundTask so state is retained when returning to page
  const [inlineTask, setInlineTask] = useState<InlineTaskState | null>(() => {
    if (backgroundTask) {
      return {
        datasetId: backgroundTask.datasetId,
        fileName: backgroundTask.fileName || 'Material Master Dataset',
        phase: backgroundTask.phase || 'Harmonizing dataset…',
        progress: backgroundTask.progress ?? 0,
        status: (backgroundTask.status as any) || 'PROCESSING',
        rows: backgroundTask.rows,
        cpses: backgroundTask.cpses,
        error: backgroundTask.error,
      };
    }
    return null;
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ingestionService.getNormalization().then(setNormStatus).catch(() => setNormStatus(null));
  }, []);

  // Synchronize inline task with background task whenever it updates
  useEffect(() => {
    if (backgroundTask) {
      setInlineTask({
        datasetId: backgroundTask.datasetId,
        fileName: backgroundTask.fileName || 'Material Master Dataset',
        phase: backgroundTask.phase || 'Harmonizing dataset…',
        progress: backgroundTask.progress ?? 0,
        status: (backgroundTask.status as any) || 'PROCESSING',
        rows: backgroundTask.rows,
        cpses: backgroundTask.cpses,
        error: backgroundTask.error,
      });
    }
  }, [backgroundTask]);

  // Synchronize inline task when completed notification fires
  useEffect(() => {
    if (completedNotification) {
      setInlineTask((prev) => ({
        datasetId: completedNotification.datasetId,
        fileName: completedNotification.fileName || prev?.fileName || 'Material Master Dataset',
        phase: 'Harmonization Complete',
        progress: 100,
        status: 'COMPLETED',
        rows: completedNotification.rows,
        cpses: completedNotification.cpses,
      }));
    }
  }, [completedNotification]);

  const handleRunNormalization = async () => {
    setNormLoading(true);
    try {
      await ingestionService.runNormalization();
      const status = await ingestionService.getNormalization();
      setNormStatus(status);
      toast.success('Normalization completed successfully');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Normalization pipeline failed';
      toast.error(msg);
    } finally {
      setNormLoading(false);
    }
  };

  const handleSelectFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Only CSV files are supported for material dataset ingestion');
      return;
    }
    setSelectedFile(file);
    setInlineTask({
      datasetId: '',
      fileName: file.name,
      phase: 'File selected. Ready to upload & harmonize.',
      progress: 0,
      status: 'IDLE',
    });
  };

  const handleUploadFile = async (fileToUpload?: File) => {
    const targetFile = fileToUpload || selectedFile;
    if (!targetFile) {
      fileInputRef.current?.click();
      return;
    }

    if (!targetFile.name.endsWith('.csv')) {
      toast.error('Only CSV files are supported for material dataset ingestion');
      return;
    }

    try {
      setUploadLoading(true);
      setInlineTask({
        datasetId: '',
        fileName: targetFile.name,
        phase: 'Ingesting CSV & validating schema columns…',
        progress: 10,
        status: 'UPLOADING',
      });

      const res = await ingestionService.uploadFile(targetFile, user?.id);
      const summary = (res as Record<string, unknown>).dataset_summary as Record<string, unknown> | undefined;
      const mapped: UploadResult = {
        status: res.status || 'UPLOADED',
        dataset_id: res.dataset_id,
        filename: res.filename || (res as Record<string, unknown>).file_name as string || targetFile.name,
        size_bytes: (summary?.size_bytes as number) || targetFile.size,
        size_mb: (summary?.size_bytes as number) ? Number(((summary.size_bytes as number) / 1048576).toFixed(2)) : Number((targetFile.size / 1048576).toFixed(2)),
        sha256: (summary?.file_hash as string) || res.sha256 || '',
        is_official_raw_baseline: res.is_official_raw_baseline || false,
        record_count: (summary?.row_count as number) || res.record_count || 2200,
        column_count: (summary?.column_count as number) || res.column_count || 20,
        schema_info: res.schema_info || {
          is_valid: true,
          expected_count: 20,
          actual_count: (summary?.column_count as number) || 20,
          missing_columns: [],
          extra_columns: [],
        },
        cpse_distribution: (summary?.cpse_summary as Record<string, number>) || res.cpse_distribution || {},
        staged_path: res.staged_path || null,
        message: res.message || `Dataset registered with ID ${res.dataset_id}`,
      };
      setUploadResult(mapped);

      if (mapped.status === 'FAILED') {
        toast.error(mapped.message || 'File schema validation failed');
        setInlineTask({
          datasetId: mapped.dataset_id || '',
          fileName: targetFile.name,
          phase: 'File validation failed',
          progress: 0,
          status: 'FAILED',
          error: mapped.message,
        });
        return;
      }

      // Update inline task and launch global background task tracking
      const activeTask: InlineTaskState = {
        datasetId: mapped.dataset_id || '',
        fileName: targetFile.name,
        phase: 'Ingestion & Schema Validation',
        progress: 15,
        status: 'PROCESSING',
        rows: mapped.record_count,
        cpses: Object.keys(mapped.cpse_distribution).length,
      };
      setInlineTask(activeTask);
      startBackgroundTask(activeTask);
      toast.success(`Dataset "${targetFile.name}" uploaded. Processing pipeline below.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to upload file';
      toast.error(msg);
      setInlineTask((prev) => prev ? { ...prev, status: 'FAILED', error: msg } : null);
    } finally {
      setUploadLoading(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleSelectFile(e.dataTransfer.files[0]);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleSelectFile(e.target.files[0]);
    }
  };

  const getStepStatus = (stepIndex: number): 'COMPLETED' | 'IN_PROGRESS' | 'QUEUED' => {
    if (inlineTask) {
      if (inlineTask.status === 'COMPLETED') return 'COMPLETED';
      if (inlineTask.status === 'FAILED') return stepIndex === 0 ? 'COMPLETED' : 'QUEUED';
      const step = INLINE_PIPELINE_STEPS[stepIndex];
      const isDone = inlineTask.progress >= step.minProgress;
      const isCurrent = !isDone && (stepIndex === 0 || inlineTask.progress >= INLINE_PIPELINE_STEPS[stepIndex - 1].minProgress);
      if (isDone) return 'COMPLETED';
      if (isCurrent) return 'IN_PROGRESS';
      return 'QUEUED';
    }
    // If active dataset in registry is completed, all stages are completed
    if (activeDatasetId && activeDatasetId !== 'NONE') {
      const activeDs = datasets.find((d) => d.dataset_id === activeDatasetId);
      if (activeDs?.status === 'COMPLETED' || activeDatasetId === 'BASELINE') {
        return 'COMPLETED';
      }
    }
    if (stepIndex < 3) return 'COMPLETED';
    if (stepIndex === 3) return 'IN_PROGRESS';
    return 'QUEUED';
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header with dedicated Upload Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <PageHeader
            title="Data Ingestion"
            description="Upload enterprise material master CSV datasets and run the automated harmonization pipeline"
          />
          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadLoading || inlineTask?.status === 'PROCESSING'}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 h-9 rounded-lg gap-2 shadow-none border border-primary/20"
            >
              <Upload className="h-4 w-4" />
              Upload Dataset
            </Button>
          </div>
        </div>

        {/* ── UPLOAD ZONE (Only Upload CSV, No Button Background Glow, Updated 20-Col Spec) ── */}
        <div
          className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 overflow-hidden group ${
            isDragging
              ? 'border-primary bg-primary/[0.05]'
              : 'border-border/80 bg-card hover:border-primary/40'
          }`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={onFileChange}
            accept=".csv"
            className="hidden"
          />

          <div className="p-6 sm:p-10">
            {selectedFile ? (
              /* ── FILE SELECTED STATE ── */
              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* File icon */}
                <div className="relative shrink-0">
                  <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
                    <FileSpreadsheet className="h-10 w-10 text-emerald-500" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-emerald-500 text-white">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 mb-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    CSV File Selected
                    <span className="text-emerald-600/60 dark:text-emerald-400/60 font-normal">
                      · {(selectedFile.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-foreground truncate mb-1">
                    {selectedFile.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Click below to upload and trigger the 5-step automated harmonization pipeline
                  </p>
                </div>

                {/* Actions (Clean, No Glow) */}
                <div className="flex items-center gap-2.5 shrink-0 flex-wrap justify-center">
                  <Button
                    size="default"
                    disabled={uploadLoading || inlineTask?.status === 'PROCESSING'}
                    onClick={() => handleUploadFile()}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs sm:text-sm px-6 h-10 rounded-lg gap-2 shadow-none border border-primary/20"
                  >
                    {uploadLoading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Uploading Dataset…</>
                    ) : inlineTask?.status === 'PROCESSING' ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Harmonizing…</>
                    ) : (
                      <><Play className="h-4 w-4" /> Start Pipeline</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploadLoading || inlineTask?.status === 'PROCESSING'}
                    onClick={() => {
                      setSelectedFile(null);
                      setInlineTask(null);
                      setUploadResult(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-xs h-10 rounded-lg px-4 border-border shadow-none"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    Change
                  </Button>
                </div>
              </div>
            ) : (
              /* ── EMPTY DROP ZONE WITH CLEAN BUTTON ── */
              <div
                className="flex flex-col items-center justify-center gap-4 text-center cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                {/* Upload icon (Clean, No Glow) */}
                <div className={`p-4 rounded-2xl border transition-all duration-200 ${
                  isDragging
                    ? 'bg-primary/15 border-primary text-primary'
                    : 'bg-primary/10 border-primary/25 text-primary group-hover:border-primary/40'
                }`}>
                  <Upload className="h-8 w-8" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
                    {isDragging ? 'Release to upload CSV' : 'Upload Material Master Dataset'}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
                    Drag and drop your enterprise material catalog CSV file, or click below to browse.
                  </p>
                </div>

                {/* Primary Upload Button & Clean Updated Spec Tag */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                  <Button
                    type="button"
                    size="default"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 h-10 rounded-lg shadow-none border border-primary/20 gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    <Upload className="h-4 w-4" />
                    Select &amp; Upload CSV
                  </Button>
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/80 border border-border/80 text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <strong className="font-semibold text-foreground">.CSV</strong>
                    &nbsp;· 20 standard CPSE columns (2,200 records)
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── HARMONIZATION PIPELINE (Only visible when active task is present) ── */}
        {inlineTask && (
          <div className="rounded-2xl border border-border bg-card shadow-none overflow-hidden">
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-border/50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <Activity className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground leading-none">Harmonization Pipeline</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {inlineTask?.fileName
                      ? `${inlineTask.fileName} · ${inlineTask.phase}`
                      : 'Schema → Cleansing → Extraction → AI Matching → Master Harmonization'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {inlineTask?.status === 'PROCESSING' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {inlineTask.progress}%
                  </span>
                )}
                {inlineTask?.status === 'COMPLETED' && (
                  <Button
                    size="sm"
                    onClick={() => {
                      if (inlineTask.datasetId) selectDataset(inlineTask.datasetId);
                      setInlineTask(null);
                      setSelectedFile(null);
                      setUploadResult(null);
                      navigate('/dashboard');
                    }}
                    className="bg-emerald-600 hover:bg-emerald-600/90 text-white font-semibold text-xs h-8 rounded-lg gap-1.5 shadow-none"
                  >
                    Open Dashboard <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Slim live progress stripe */}
            {inlineTask?.status === 'PROCESSING' && (
              <div className="h-[3px] w-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-700 ease-out"
                  style={{ width: `${inlineTask.progress}%` }}
                />
              </div>
            )}

            {/* Desktop: Horizontal timeline (Clean, No Glow) */}
            <div className="hidden md:block px-8 pt-8 pb-7">
              <div className="relative flex items-start">
                {/* Rail line */}
                <div className="absolute top-5 left-[5%] right-[5%] h-px bg-border/60" />

                {INLINE_PIPELINE_STEPS.map((step, idx) => {
                  const Icon = step.icon;
                  const status = getStepStatus(idx);
                  const isDone = status === 'COMPLETED';
                  const isCurrent = status === 'IN_PROGRESS';

                  return (
                    <div key={step.id} className="flex-1 flex flex-col items-center relative z-10 px-1">
                      {/* Circle node (No glow) */}
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-200 mb-3 ${
                        isDone
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : isCurrent
                            ? 'bg-primary border-primary text-white'
                            : 'bg-card border-border text-muted-foreground'
                      }`}>
                        {isDone ? (
                          <Check className="h-4 w-4 stroke-[2.5]" />
                        ) : isCurrent ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                      </div>

                      {/* Step number */}
                      <div className={`text-[10px] font-mono font-bold mb-1 ${
                        isDone ? 'text-emerald-500' : isCurrent ? 'text-primary' : 'text-muted-foreground/40'
                      }`}>
                        0{step.step}
                      </div>

                      {/* Title */}
                      <div className={`text-[11px] font-bold text-center leading-tight mb-1 ${
                        isCurrent ? 'text-primary' : isDone ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {step.title}
                      </div>

                      {/* Subtitle */}
                      <div className="text-[10px] text-muted-foreground/60 text-center leading-relaxed max-w-[110px]">
                        {step.subtitle}
                      </div>

                      {/* Status chip */}
                      <div className="mt-2.5">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                            <Check className="h-2.5 w-2.5 stroke-[3]" /> Completed
                          </span>
                        ) : isCurrent ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> In Progress
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/40 bg-muted/30 px-2 py-0.5 rounded-full border border-border/20 whitespace-nowrap">
                            Queued
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile: Vertical timeline */}
            <div className="md:hidden px-4 py-5">
              <div className="relative">
                {/* Vertical rail */}
                <div className="absolute left-5 top-5 bottom-5 w-px bg-border/60" />
                <div className="space-y-0">
                  {INLINE_PIPELINE_STEPS.map((step, idx) => {
                    const Icon = step.icon;
                    const status = getStepStatus(idx);
                    const isDone = status === 'COMPLETED';
                    const isCurrent = status === 'IN_PROGRESS';
                    const isLast = idx === INLINE_PIPELINE_STEPS.length - 1;

                    return (
                      <div key={step.id} className={`flex items-start gap-4 relative ${!isLast ? 'pb-5' : ''}`}>
                        <div className={`relative z-10 h-10 w-10 rounded-full flex items-center justify-center border-2 shrink-0 transition-all duration-200 ${
                          isDone
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : isCurrent
                              ? 'bg-primary border-primary text-white'
                              : 'bg-card border-border text-muted-foreground'
                        }`}>
                          {isDone ? (
                            <Check className="h-4 w-4 stroke-[2.5]" />
                          ) : isCurrent ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Icon className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 pt-1.5">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className={`text-sm font-bold ${isCurrent ? 'text-primary' : isDone ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {step.title}
                            </span>
                            {isDone && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                                <Check className="h-2.5 w-2.5 stroke-[3]" /> Done
                              </span>
                            )}
                            {isCurrent && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Active
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{step.subtitle}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── UPLOAD RESULT PROFILE (Shown when a file has just been uploaded) ── */}
        {uploadResult && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {/* Card top bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 pt-5 pb-4 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <FileCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground truncate max-w-xs">
                    {uploadResult.filename}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {uploadResult.message} · {uploadResult.size_mb} MB
                  </div>
                </div>
              </div>
              {uploadResult.is_official_raw_baseline ? (
                <Badge className="bg-emerald-600 text-white text-xs font-mono shrink-0 self-start sm:self-auto">
                  <ShieldCheck className="h-3 w-3 mr-1" /> OFFICIAL BASELINE
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs font-mono shrink-0 self-start sm:self-auto">
                  STAGED DATASET
                </Badge>
              )}
            </div>

            <div className="p-5 space-y-4">
              {/* SHA-256 */}
              <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/30 border border-border/50">
                <Hash className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <span className="font-mono text-xs text-muted-foreground break-all">
                  SHA-256: <span className="text-foreground font-semibold">{uploadResult.sha256}</span>
                </span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Records', value: uploadResult.record_count.toLocaleString(), color: 'text-foreground' },
                  { label: 'Columns', value: uploadResult.column_count, color: 'text-foreground' },
                  { label: 'CPSEs', value: Object.keys(uploadResult.cpse_distribution).length, color: 'text-primary' },
                  {
                    label: 'Schema',
                    value: uploadResult.schema_info.is_valid ? '✓ Valid (20 Col)' : `${uploadResult.schema_info.actual_count}/${uploadResult.schema_info.expected_count}`,
                    color: uploadResult.schema_info.is_valid ? 'text-emerald-500' : 'text-amber-500',
                  },
                ].map((s) => (
                  <div key={s.label} className="p-3 rounded-xl bg-muted/25 border border-border/50 text-center">
                    <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* CPSE distribution */}
              {Object.keys(uploadResult.cpse_distribution).length > 0 && (
                <div className="p-3 rounded-xl bg-muted/20 border border-border/50 space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    CPSE Distribution
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(uploadResult.cpse_distribution).map(([cpse, cnt]) => (
                      <div key={cpse} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background border border-border text-xs">
                        <span className="font-semibold text-foreground">{cpse}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="font-mono text-primary font-bold">{cnt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
