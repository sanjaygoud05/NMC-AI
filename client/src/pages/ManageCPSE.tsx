import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { nmcApi } from '@/services/nmcApi';
import {
  Plus,
  RefreshCw,
  Upload,
  Trash2,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock,
  GitMerge,
  ExternalLink,
  CheckCheck,
  Cpu,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function DatasetStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; icon?: React.ReactNode }> = {
    NO_DATASET: {
      label: 'No Dataset',
      className: 'bg-muted/60 text-muted-foreground border-border/40',
    },
    UPLOADED: {
      label: 'Uploaded',
      className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      icon: <Upload className="h-3 w-3" />,
    },
    VALIDATED: {
      label: 'Validated',
      className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    PROCESSING: {
      label: 'Processing',
      className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      icon: <RefreshCw className="h-3 w-3 animate-spin" />,
    },
    NORMALIZED: {
      label: 'Normalized',
      className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      icon: <CheckCheck className="h-3 w-3" />,
    },
    READY: {
      label: 'Ready',
      className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    FAILED: {
      label: 'Failed',
      className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
      icon: <AlertCircle className="h-3 w-3" />,
    },
  };

  const cfg = map[status] ?? { label: status, className: 'bg-muted text-muted-foreground' };
  return (
    <Badge
      variant="outline"
      className={`text-[11px] gap-1 px-1.5 py-0.5 font-medium ${cfg.className}`}
    >
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ManageCPSE() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Selection state
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Matching state
  const [matchResult, setMatchResult] = useState<any | null>(null);
  const [isMatchingRunning, setIsMatchingRunning] = useState(false);

  const startMatching = async () => {
    setIsMatchingRunning(true);
    setMatchResult(null);
    try {
      const trigger = await nmcApi.matching.run();
      toast.info('Matching engine started. Evaluating candidate pairs...');

      if (trigger.status === 'COMPLETED' && trigger.matches_created !== undefined) {
        setMatchResult(trigger);
        toast.success(`Matching and Harmonization completed! Generated ${trigger.matches_created} candidate matches.`);
        setIsMatchingRunning(false);
        queryClient.invalidateQueries({ queryKey: ['nmc', 'dashboard-metrics'] });
        queryClient.invalidateQueries({ queryKey: ['nmc', 'matching-readiness'] });
        queryClient.invalidateQueries({ queryKey: ['nmc', 'review-queue'] });
        queryClient.invalidateQueries({ queryKey: ['nmc', 'cpses-list'] });
        queryClient.invalidateQueries({ queryKey: ['nmc', 'materials'] });
        return;
      }

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
            queryClient.invalidateQueries({ queryKey: ['nmc', 'matching-readiness'] });
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
          toast.error(e.message || 'Polling failed.');
        }
      }, 1500);
    } catch (err: any) {
      setIsMatchingRunning(false);
      toast.error(err.message || 'Failed to trigger matching.');
    }
  };

  // Create CPSE state
  const [createOpen, setCreateOpen] = useState(false);
  const [cpseName, setCpseName] = useState('');
  const [cpseCode, setCpseCode] = useState('');
  const [cpseDesc, setCpseDesc] = useState('');
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [isCreatingWithUpload, setIsCreatingWithUpload] = useState(false);

  // Upload Dataset state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [targetCpse, setTargetCpse] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: cpses, isLoading, refetch } = useQuery({
    queryKey: ['nmc', 'cpses-list'],
    queryFn: () => nmcApi.cpses.list(),
    refetchInterval: 5000,
  });

  const { data: readiness } = useQuery({
    queryKey: ['nmc', 'matching-readiness'],
    queryFn: () => nmcApi.matching.checkReadiness(),
    refetchInterval: 8000,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: { name: string; code: string; description?: string }) =>
      nmcApi.cpses.create(data),
    onSuccess: () => {
      toast.success('CPSE enterprise created successfully');
      setCreateOpen(false);
      setCpseName('');
      setCpseCode('');
      setCpseDesc('');
      queryClient.invalidateQueries({ queryKey: ['nmc', 'cpses-list'] });
      queryClient.invalidateQueries({ queryKey: ['nmc', 'dashboard-metrics'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create CPSE'),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ cpseId, file }: { cpseId: string; file: File }) =>
      nmcApi.cpses.uploadDataset(cpseId, file),
    onSuccess: (data) => {
      toast.success(data.message || 'Dataset uploaded successfully');
      setUploadOpen(false);
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ['nmc', 'cpses-list'] });
      queryClient.invalidateQueries({ queryKey: ['nmc', 'dashboard-metrics'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to upload dataset'),
  });

  const normalizeMutation = useMutation({
    mutationFn: (cpseId: string) => nmcApi.cpses.normalizeDataset(cpseId),
    onSuccess: () => {
      toast.success('Normalization pipeline started');
      queryClient.invalidateQueries({ queryKey: ['nmc', 'cpses-list'] });
      queryClient.invalidateQueries({ queryKey: ['nmc', 'matching-readiness'] });
      queryClient.invalidateQueries({ queryKey: ['nmc', 'dashboard-metrics'] });
    },
    onError: (err: any) => toast.error(err.message || 'Normalization failed to trigger'),
  });

  const normalizeAllMutation = useMutation({
    mutationFn: async () => {
      if (!cpses) return;
      const eligible = cpses.filter((c: any) => {
        const st = c.active_dataset?.status;
        return st === 'VALIDATED' || st === 'NORMALIZED';
      });
      if (eligible.length === 0) throw new Error('No eligible CPSEs to normalize');
      for (const c of eligible) {
        await nmcApi.cpses.normalizeDataset(c.id);
      }
    },
    onSuccess: () => {
      toast.success('Normalization triggered for all eligible CPSEs');
      queryClient.invalidateQueries({ queryKey: ['nmc', 'cpses-list'] });
      queryClient.invalidateQueries({ queryKey: ['nmc', 'matching-readiness'] });
      queryClient.invalidateQueries({ queryKey: ['nmc', 'dashboard-metrics'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to normalize all'),
  });

  const deleteMutation = useMutation({
    mutationFn: (cpseId: string) => nmcApi.cpses.delete(cpseId),
    onSuccess: () => {
      toast.success('CPSE deleted');
      setDeleteOpen(false);
      setDeleteTarget(null);
      if (selectedId === deleteTarget?.id) setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ['nmc', 'cpses-list'] });
      queryClient.invalidateQueries({ queryKey: ['nmc', 'matching-readiness'] });
      queryClient.invalidateQueries({ queryKey: ['nmc', 'dashboard-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['nmc', 'review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['nmc', 'review-stats'] });
      queryClient.invalidateQueries({ queryKey: ['nmc', 'materials'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to delete CPSE'),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpseName || !cpseCode) return;
    setIsCreatingWithUpload(true);
    try {
      const created = await nmcApi.cpses.create({
        name: cpseName.trim(),
        code: cpseCode.trim().toUpperCase(),
        description: cpseDesc.trim(),
      });
      toast.success('CPSE enterprise registered successfully');

      if (createFile && created?.id) {
        toast.info(`Uploading material dataset for ${created.name}...`);
        try {
          const uploadRes = await nmcApi.cpses.uploadDataset(created.id, createFile);
          toast.success(uploadRes.message || 'Dataset uploaded successfully');
        } catch (uploadErr: any) {
          toast.error(uploadErr.message || 'CPSE created, but dataset upload failed');
        }
      }

      setCreateOpen(false);
      setCpseName('');
      setCpseCode('');
      setCpseDesc('');
      setCreateFile(null);
      queryClient.invalidateQueries({ queryKey: ['nmc', 'cpses-list'] });
      queryClient.invalidateQueries({ queryKey: ['nmc', 'dashboard-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['nmc', 'materials'] });
      queryClient.invalidateQueries({ queryKey: ['nmc', 'matching-readiness'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to register CPSE');
    } finally {
      setIsCreatingWithUpload(false);
    }
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCpse || !selectedFile) return;
    uploadMutation.mutate({ cpseId: targetCpse.id, file: selectedFile });
  };

  const openUpload = (c: any) => {
    setTargetCpse(c);
    setSelectedFile(null);
    setUploadOpen(true);
  };

  const openDelete = (c: any) => {
    setDeleteTarget(c);
    setDeleteOpen(true);
  };

  const openMaterials = (c: any) => {
    navigate(`/materials?cpse_id=${c.id}`);
  };

  const handleRefresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['nmc', 'matching-readiness'] });
    toast.success('Refreshed');
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const totalCpses = cpses?.length ?? 0;
  const normalizedCount = readiness?.normalized ?? 0;
  const totalMaterials = readiness?.total ?? 0;
  const allReady = readiness?.all_ready ?? false;

  // Auto-select first CPSE when list loads
  useEffect(() => {
    if (cpses && cpses.length > 0 && !selectedId) {
      setSelectedId(cpses[0].id);
    }
  }, [cpses]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AppLayout requireAdmin>
      <div className="space-y-4">

        {/* ── Page Header ── */}
        <div className="flex flex-col gap-3">
          {/* Title row */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Central Public Sector Enterprises
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">
                  {totalCpses} {totalCpses === 1 ? 'enterprise' : 'enterprises'} registered
                </span>
                {readiness && (
                  <Badge
                    variant="outline"
                    className={`text-xs gap-1.5 px-2.5 py-0.5 font-normal transition-colors ${
                      allReady
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : 'bg-muted/70 text-muted-foreground border-border/80 hover:bg-muted'
                    }`}
                  >
                    {allReady ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span>
                      Normalization: <span className="font-semibold text-foreground">{normalizedCount}/{totalMaterials}</span> ready
                    </span>
                  </Badge>
                )}
              </div>
            </div>

            {/* Action buttons — row on sm+, 2-col grid on mobile */}
            <div className="grid grid-cols-2 sm:flex sm:items-start gap-2 w-full sm:w-auto shrink-0">
              {/* Find Matches — spans full width on mobile */}
              <div className="col-span-2 sm:col-span-1 flex flex-col gap-1">
                <Button
                  size="sm"
                  className="h-9 sm:h-8 text-xs gap-1.5 shadow-sm w-full sm:w-auto"
                  disabled={!allReady || isMatchingRunning}
                  onClick={startMatching}
                  title={allReady ? 'Run cross-CPSE matching' : 'Normalize all CPSE materials before matching'}
                >
                  {isMatchingRunning ? (
                    <>
                      <Cpu className="h-3.5 w-3.5 animate-spin" />
                      Running Matching...
                    </>
                  ) : (
                    <>
                      <GitMerge className="h-3.5 w-3.5" />
                      <span>Find Matches</span>
                      <span className="hidden sm:inline"> Across All CPSEs</span>
                    </>
                  )}
                </Button>
                {!allReady && totalCpses > 0 && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                    Normalize all CPSEs first.
                  </p>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="h-9 sm:h-8 text-xs gap-1.5 w-full sm:w-auto"
                onClick={handleRefresh}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>

              {/* Add CPSE dialog trigger */}
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="default" className="h-9 sm:h-8 text-xs gap-1.5 w-full sm:w-auto">
                    <Plus className="h-3.5 w-3.5" />
                    Add CPSE
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[calc(100vw-2rem)] max-w-md sm:max-w-lg rounded-lg">
                <DialogHeader>
                  <DialogTitle>Register CPSE Enterprise</DialogTitle>
                  <DialogDescription>
                    Add a Central Public Sector Enterprise to participate in the National Material
                    Code platform.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateSubmit} className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="cpse-name">Enterprise Name</Label>
                    <Input
                      id="cpse-name"
                      placeholder="e.g. Oil and Natural Gas Corporation"
                      value={cpseName}
                      onChange={(e) => setCpseName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpse-code">Enterprise Code</Label>
                    <Input
                      id="cpse-code"
                      placeholder="e.g. ONGC"
                      value={cpseCode}
                      onChange={(e) => setCpseCode(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpse-desc">Description (Optional)</Label>
                    <Textarea
                      id="cpse-desc"
                      placeholder="Brief description of enterprise domain or plants..."
                      value={cpseDesc}
                      onChange={(e) => setCpseDesc(e.target.value)}
                      rows={2}
                    />
                  </div>

                  {/* ── Dataset File Upload (Integrated right in form) ── */}
                  <div className="space-y-2 pt-2 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="create-file-input" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
                        Initial Material Dataset (Optional)
                      </Label>
                      {createFile && (
                        <button
                          type="button"
                          onClick={() => setCreateFile(null)}
                          className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        id="create-file-input"
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                        onChange={(e) => setCreateFile(e.target.files?.[0] || null)}
                      />
                      <label
                        htmlFor="create-file-input"
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium border border-border bg-background hover:bg-muted text-foreground rounded-md cursor-pointer transition-colors shadow-2xs shrink-0"
                      >
                        <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                        {createFile ? 'Change File' : 'Choose CSV / Excel'}
                      </label>
                      <span className="text-xs text-muted-foreground truncate">
                        {createFile ? (
                          <span className="text-foreground font-medium">{createFile.name}</span>
                        ) : (
                          'No file chosen (can upload later)'
                        )}
                      </span>
                    </div>

                    {createFile && (
                      <div className="p-2.5 rounded-lg bg-muted/60 flex items-center gap-2.5 text-xs border border-border/50">
                        <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground truncate">{createFile.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {(createFile.size / 1024).toFixed(1)} KB • Auto-uploads & validates with enterprise
                          </p>
                        </div>
                      </div>
                    )}

                    <p className="text-[11px] text-muted-foreground">
                      Upload a CSV (.csv) or Excel (.xlsx) file with Material Code & Description.
                    </p>
                  </div>

                  <DialogFooter className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setCreateOpen(false);
                        setCreateFile(null);
                      }}
                      disabled={isCreatingWithUpload}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isCreatingWithUpload || !cpseName || !cpseCode}>
                      {isCreatingWithUpload
                        ? (createFile ? 'Creating & Uploading...' : 'Registering...')
                        : (createFile ? 'Register & Upload Dataset' : 'Register CPSE')}
                    </Button>
                  </DialogFooter>
                </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>


        {/* ── Match Result Card ── */}
        {matchResult && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-semibold text-foreground">Matching and Harmonization Completed</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              <div className="flex sm:block items-center justify-between rounded-lg bg-card border border-border/60 px-4 py-2.5 sm:p-3 sm:text-center">
                <p className="text-xs text-muted-foreground">Materials Scanned</p>
                <p className="text-lg sm:text-xl font-bold text-foreground sm:mt-1">{matchResult.materials_count ?? '—'}</p>
              </div>
              <div className="flex sm:block items-center justify-between rounded-lg bg-card border border-border/60 px-4 py-2.5 sm:p-3 sm:text-center">
                <p className="text-xs text-muted-foreground">Pairs Evaluated</p>
                <p className="text-lg sm:text-xl font-bold text-foreground sm:mt-1">{matchResult.pairs_evaluated ?? '—'}</p>
              </div>
              <div className="flex sm:block items-center justify-between rounded-lg bg-card border border-border/60 px-4 py-2.5 sm:p-3 sm:text-center">
                <p className="text-xs text-muted-foreground">Matches Created</p>
                <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 sm:mt-1">{matchResult.matches_created ?? 0}</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
              <span className="text-[11px] text-muted-foreground">
                Queued for certified Reviewer evaluation.
              </span>
              <Link to="/find-mapping">
                <button className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                  View AI Matching Engine
                  <ArrowRight className="h-3 w-3" />
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* ── Upload Dataset Dialog ── */}
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogContent>
            <DialogHeader className="space-y-2">
              <DialogTitle>
                {targetCpse?.active_dataset ? 'Replace Dataset' : 'Upload Dataset'} for{' '}
                {targetCpse?.name}
              </DialogTitle>
              <DialogDescription className="space-y-1.5 text-xs text-muted-foreground pt-1">
                <p>Upload a CSV (.csv) or Excel (.xlsx) file.</p>
                <p className="font-medium text-foreground/90">
                  Required columns: Material Code and Description.
                </p>
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleUploadSubmit} className="space-y-4 pt-3 pb-2">
              <div className="space-y-2.5">
                <Label htmlFor="file-input" className="text-xs font-medium">Select File</Label>

                {/* Only 'Choose File' button — no browser default 'No file chosen' text */}
                <div className="flex items-center gap-3">
                  <input
                    id="file-input"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    required
                  />
                  <label
                    htmlFor="file-input"
                    className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-medium border border-border bg-background hover:bg-muted text-foreground rounded-md cursor-pointer transition-colors shadow-2xs"
                  >
                    <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                    Choose File
                  </label>
                  {selectedFile && (
                    <span className="text-xs text-foreground font-medium truncate max-w-[220px]">
                      {selectedFile.name}
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground pt-1">
                  Accepted formats: CSV, XLSX. Duplicate records will be pruned automatically.
                </p>
              </div>

              {selectedFile && (
                <div className="p-3 rounded-lg bg-muted/60 flex items-center gap-3 text-xs border border-border/50">
                  <FileSpreadsheet className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{selectedFile.name}</p>
                    <p className="text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              )}
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={uploadMutation.isPending || !selectedFile}>
                  {uploadMutation.isPending ? 'Uploading...' : 'Upload & Validate'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Delete Confirmation Dialog ── */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete CPSE</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete{' '}
                <span className="font-semibold text-foreground">{deleteTarget?.name}</span>? This
                will permanently remove the enterprise, its dataset, and all associated materials.
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete CPSE'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Enterprise List ── */}
        <div className="rounded-lg border border-border/60 overflow-hidden bg-card">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading enterprise list...
            </div>
          ) : !cpses || cpses.length === 0 ? (
            <div className="py-14 text-center space-y-3 px-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">No CPSEs Registered</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Register active CPSEs like ONGC, IOCL, or NTPC to begin.
                </p>
              </div>
              <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 text-xs h-8">
                <Plus className="h-3.5 w-3.5" />
                Add CPSE
              </Button>
            </div>
          ) : (
            <>
              {/* ── Desktop Table (hidden on mobile) ── */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs table-fixed">
                  <colgroup>
                    <col className="w-8" />
                    <col />
                    <col className="w-36" />
                    <col className="w-32" />
                    <col className="w-64" />
                  </colgroup>
                  <thead className="bg-muted/30 border-b border-border/50">
                    <tr>
                      <th className="px-4 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">#</th>
                      <th className="px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Enterprise Name</th>
                      <th className="px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Code</th>
                      <th className="px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Registered</th>
                      <th className="px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {cpses.map((c: any) => {
                      const isSelected = selectedId === c.id;
                      const activeDs = c.active_dataset;
                      const status = activeDs?.status || 'NO_DATASET';
                      const hasDataset = !!activeDs;
                      const materialCount = activeDs?.record_count ?? 0;
                      return (
                        <tr
                          key={c.id}
                          onClick={() => setSelectedId(isSelected ? null : c.id)}
                          className={`cursor-pointer transition-colors select-none ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/30'}`}
                        >
                          <td className={`py-2.5 ${isSelected ? 'pl-[14px] pr-3' : 'px-4'}`}>
                            <span className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-primary bg-primary' : 'border-border bg-transparent'}`}>
                              {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium text-foreground truncate">{c.name}</span>
                              <DatasetStatusBadge status={status} />
                              {hasDataset && materialCount > 0 && (
                                <span className="text-[11px] text-muted-foreground shrink-0">{materialCount} items</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-xs text-muted-foreground">{formatDate(c.created_at)}</span>
                          </td>
                          <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5 justify-end">
                              {isSelected ? (
                                !hasDataset ? (
                                  <>
                                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => openUpload(c)} disabled={uploadMutation.isPending}>
                                      <Upload className="h-3 w-3" />Upload File
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => openDelete(c)}>
                                      <Trash2 className="h-3 w-3" />Delete
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => openDelete(c)}>
                                      <Trash2 className="h-3 w-3" />Delete
                                    </Button>
                                    <Button size="sm" className="h-7 text-xs gap-1" onClick={() => openMaterials(c)}>
                                      Open Materials<ExternalLink className="h-3 w-3" />
                                    </Button>
                                  </>
                                )
                              ) : (
                                <>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => openDelete(c)} title={`Delete ${c.name}`}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelectedId(c.id)}>Select</Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Mobile Card List (hidden on sm+) ── */}
              <div className="sm:hidden divide-y divide-border/40">
                {cpses.map((c: any) => {
                  const isSelected = selectedId === c.id;
                  const activeDs = c.active_dataset;
                  const status = activeDs?.status || 'NO_DATASET';
                  const hasDataset = !!activeDs;
                  const materialCount = activeDs?.record_count ?? 0;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedId(isSelected ? null : c.id)}
                      className={`px-4 py-3.5 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-primary/5 border-l-2 border-l-primary'
                          : 'hover:bg-muted/30'
                      }`}
                    >
                      {/* Top row: radio + name + badge */}
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                          isSelected ? 'border-primary bg-primary' : 'border-border bg-transparent'
                        }`}>
                          {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground leading-snug">{c.name}</span>
                            <DatasetStatusBadge status={status} />
                          </div>
                          {/* Meta row */}
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="font-mono text-[11px] text-muted-foreground">{c.code}</span>
                            <span className="text-[11px] text-muted-foreground">{formatDate(c.created_at)}</span>
                            {hasDataset && materialCount > 0 && (
                              <span className="text-[11px] text-muted-foreground">{materialCount} items</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons — only shown when selected */}
                      {isSelected && (
                        <div className="mt-3 flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                          {!hasDataset ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1.5 flex-1"
                                onClick={() => openUpload(c)}
                                disabled={uploadMutation.isPending}
                              >
                                <Upload className="h-3.5 w-3.5" />Upload Dataset
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={() => openDelete(c)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                className="h-8 text-xs gap-1.5 flex-1"
                                onClick={() => openMaterials(c)}
                              >
                                Open Materials<ExternalLink className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={() => openDelete(c)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 bg-muted/20 border-t border-border/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span className="text-xs text-muted-foreground">Total CPSEs registered: {totalCpses}</span>
                <span className="text-xs text-muted-foreground hidden sm:block">Click a row to select the enterprise workspace.</span>
                <span className="text-xs text-muted-foreground sm:hidden">Tap a row to select it.</span>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

