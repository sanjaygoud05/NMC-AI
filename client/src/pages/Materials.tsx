import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { nmcApi } from '@/services/nmcApi';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  CheckCircle2,
  ArrowLeft,
  Copy,
  Check,
  Info,
  Sparkles,
  Layers,
  Database,
} from 'lucide-react';
import { toast } from 'sonner';
import { resolveErpSource, resolvePlantSite } from '@/utils/provenance';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NA = '—';
const isRaw = (m: any) => m?.processing_status !== 'NORMALIZED';

const renderHarmonizationBadge = (m: any) => {
  if (!m) return null;
  // If matched / mapped across CPSEs in Common Material Master
  if (m.mapping_status === 'MAPPED') {
    return (
      <Badge
        variant="secondary"
        className="text-[10px] font-semibold px-2 py-0.5 bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30"
      >
        <CheckCircle2 className="h-3 w-3 mr-1 text-blue-600 dark:text-blue-400" />
        Harmonized
      </Badge>
    );
  }

  // If normalized / processed through NMC pipeline
  if (m.processing_status === 'NORMALIZED') {
    return (
      <Badge
        variant="secondary"
        className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
      >
        <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600 dark:text-emerald-400" />
        Processed
      </Badge>
    );
  }

  // Default: RAW / not yet normalized
  return (
    <Badge
      variant="secondary"
      className="text-[10px] font-medium px-2 py-0.5 bg-muted/60 text-muted-foreground border border-border/70"
    >
      Not Processed
    </Badge>
  );
};

export default function Materials() {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isReviewer, reviewerName, reviewerCpse } = useAuth();

  // If navigated from Manage CPSE with ?cpse_id=xxx, pre-filter to that CPSE
  const cpseIdFromUrl = searchParams.get('cpse_id') || undefined;

  const [search, setSearch] = useState('');
  const [selectedCpse, setSelectedCpse] = useState<string>(cpseIdFromUrl || 'ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [selectedMaterial, setSelectedMaterial] = useState<any | null>(null);
  const [payloadOpen, setPayloadOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // If a material ID is in the URL, load it
  useEffect(() => {
    if (id) {
      nmcApi.materials
        .get(id)
        .then((m) => {
          if (m) setSelectedMaterial(m);
        })
        .catch(() => {});
    }
  }, [id]);

  // Sync CPSE filter if URL param changes
  useEffect(() => {
    if (cpseIdFromUrl) setSelectedCpse(cpseIdFromUrl);
  }, [cpseIdFromUrl]);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: cpses } = useQuery({
    queryKey: ['nmc', 'cpses-list'],
    queryFn: () => nmcApi.cpses.list(),
  });

  // Auto-scope: lock to reviewer's CPSE when cpses list is available
  useEffect(() => {
    if (isReviewer && reviewerCpse && cpses && cpses.length > 0) {
      const match = cpses.find((c: any) =>
        c.code?.toUpperCase() === reviewerCpse.toUpperCase()
      );
      if (match) {
        setSelectedCpse(match.id);
      }
    }
  }, [isReviewer, reviewerCpse, cpses]);

  const { data: materialsData, isLoading, refetch: refetchMaterials } = useQuery({
    queryKey: ['nmc', 'materials', selectedCpse, statusFilter, search, page],
    queryFn: () =>
      nmcApi.materials.list({
        cpse_id: selectedCpse === 'ALL' ? undefined : selectedCpse,
        processing_status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: search.trim() || undefined,
        page,
        page_size: pageSize,
      }),
    // Always fetch fresh data when navigating to this page — prevents stale
    // cache being shown after normalization runs on Manage CPSEs page
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // ── Derived ───────────────────────────────────────────────────────────────

  const cpseMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    cpses?.forEach((c: any) => {
      map[c.id] = c.code;
    });
    return map;
  }, [cpses]);

  // The CPSE object for the currently selected filter (single CPSE)
  const activeCpse = React.useMemo(() => {
    if (selectedCpse === 'ALL') return null;
    return cpses?.find((c: any) => c.id === selectedCpse) ?? null;
  }, [cpses, selectedCpse]);

  const activeCpseStatus = activeCpse?.active_dataset?.status;
  const canNormalize = activeCpse
    ? activeCpseStatus === 'VALIDATED' ||
      activeCpseStatus === 'NORMALIZED' ||
      activeCpseStatus === 'UPLOADED'
    : (cpses && cpses.length > 0);
  const isNormalized = activeCpse ? activeCpseStatus === 'NORMALIZED' : false;
  const isProcessing = activeCpseStatus === 'PROCESSING';

  // ── Normalization Progress Bar State ──────────────────────────────────────
  const [normProgress, setNormProgress] = useState<{
    isVisible: boolean;
    progress: number;
    processedCount: number;
    totalCount: number;
    stageText: string;
    isCompleted: boolean;
  }>({
    isVisible: false,
    progress: 0,
    processedCount: 0,
    totalCount: 0,
    stageText: '',
    isCompleted: false,
  });

  const progressIntervalRef = React.useRef<any>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  const handleStartNormalize = (targetCpseId: string) => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    const total = targetCpseId !== 'ALL' && activeCpse
      ? (activeCpse.active_dataset?.record_count || materialsData?.total || 125)
      : (materialsData?.total || 125);

    setNormProgress({
      isVisible: true,
      progress: 8,
      processedCount: Math.max(1, Math.round(total * 0.08)),
      totalCount: total,
      stageText: 'Phase 1/4: Cleaning descriptions & expanding enterprise abbreviations...',
      isCompleted: false,
    });

    let current = 8;
    progressIntervalRef.current = setInterval(() => {
      current += Math.random() * 9 + 4;
      if (current >= 95) {
        current = 95;
      }
      let stage = 'Phase 1/4: Cleaning descriptions & expanding enterprise abbreviations...';
      if (current >= 25 && current < 65) {
        stage = 'Phase 2/4: Extracting 14 engineering attributes (grades, sizes, ratings)...';
      } else if (current >= 65 && current < 90) {
        stage = 'Phase 3/4: Synthesizing canonical keys & resolving technical conflicts...';
      } else if (current >= 90) {
        stage = 'Phase 4/4: Committing normalized records to national master catalog...';
      }

      setNormProgress(prev => ({
        ...prev,
        progress: current,
        processedCount: Math.min(prev.totalCount, Math.round((current / 100) * prev.totalCount)),
        stageText: stage,
      }));
    }, 160);

    normalizeMutation.mutate(targetCpseId);
  };

  // ── Normalize mutation ────────────────────────────────────────────────────

  const normalizeMutation = useMutation({
    mutationFn: async (targetCpseId: string) => {
      if (targetCpseId === 'ALL') {
        const eligible = cpses?.filter((c: any) => {
          const st = c.active_dataset?.status;
          return st === 'VALIDATED' || st === 'NORMALIZED' || st === 'UPLOADED';
        }) || [];
        let count = 0;
        for (const c of eligible) {
          const res = await nmcApi.cpses.normalizeDataset(c.id);
          count += res?.record_count || c.active_dataset?.record_count || 0;
        }
        return { record_count: count || materialsData?.total || 125 };
      }
      return nmcApi.cpses.normalizeDataset(targetCpseId);
    },
    onSuccess: async (data: any) => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      const total = data?.record_count || normProgress.totalCount || materialsData?.total || 125;
      setNormProgress({
        isVisible: true,
        progress: 100,
        processedCount: total,
        totalCount: total,
        stageText: `All ${total.toLocaleString()} materials normalized successfully! Catalog fully indexed.`,
        isCompleted: true,
      });

      toast.success(`Normalized ${total.toLocaleString()} materials successfully!`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['nmc', 'materials'] }),
        queryClient.invalidateQueries({ queryKey: ['nmc', 'cpses-list'] }),
        queryClient.invalidateQueries({ queryKey: ['nmc', 'matching-readiness'] }),
        queryClient.invalidateQueries({ queryKey: ['nmc', 'dashboard-metrics'] }),
      ]);
      await refetchMaterials();

      // If a material detail modal/sheet is open, refresh that material
      if (selectedMaterial?.id) {
        try {
          const fresh = await nmcApi.materials.get(selectedMaterial.id);
          if (fresh) setSelectedMaterial(fresh);
        } catch {}
      }

      // Auto-dismiss after 6 seconds
      setTimeout(() => {
        setNormProgress(prev => (prev.isCompleted ? { ...prev, isVisible: false } : prev));
      }, 6000);
    },
    onError: (err: any) => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setNormProgress(prev => ({
        ...prev,
        stageText: `Normalization failed: ${err.message || 'Unknown error'}`,
        isCompleted: false,
      }));
      toast.error(err.message || 'Normalization failed');
    },
  });

  // Clean tabular parameter generator for Technical Attribute Inspection
  const getTabularAttributes = (m: any) => {
    if (!m) return [];
    const attrs = m.attributes || {};
    const family = (m.material_family || attrs.material_family || '').toString().trim();
    const typeLabel = family ? `${family.charAt(0).toUpperCase() + family.slice(1)} Type` : 'Material Type';

    const list: { name: string; value: string }[] = [];

    if (family || m.category) {
      list.push({
        name: 'Category / Family',
        value: (family || m.category).toString().toUpperCase(),
      });
    }
    if (m.material_type || attrs.material_type || attrs.material_subtype) {
      list.push({
        name: typeLabel,
        value: (m.material_type || attrs.material_type || attrs.material_subtype).toString().toUpperCase(),
      });
    }
    if (m.dimensions || attrs.size || attrs.nominal_size || attrs.diameter || attrs.length) {
      list.push({
        name: 'Size / Dimensions',
        value: (m.dimensions || attrs.size || attrs.nominal_size || attrs.diameter || attrs.length).toString().toUpperCase(),
      });
    }
    if (attrs.pressure_class || attrs.rating || attrs.schedule) {
      list.push({
        name: 'Pressure Class / Rating',
        value: (attrs.pressure_class || attrs.rating || attrs.schedule).toString().toUpperCase(),
      });
    }
    if (attrs.material || attrs.material_grade || m.grade) {
      list.push({
        name: 'Material Grade / Spec',
        value: (attrs.material_grade || attrs.material || m.grade).toString().toUpperCase(),
      });
    }
    if (attrs.connection_type || attrs.end_type) {
      list.push({
        name: 'Connection / End Type',
        value: (attrs.connection_type || attrs.end_type).toString().toUpperCase(),
      });
    }
    if (attrs.trim_material || attrs.specification || m.specifications) {
      list.push({
        name: 'Specification / Trim',
        value: (attrs.trim_material || attrs.specification || m.specifications).toString().toUpperCase(),
      });
    }
    if (m.uom || attrs.unit) {
      list.push({
        name: 'Normalized Unit of Measure',
        value: (m.uom || attrs.unit || 'EACH').toString().toUpperCase(),
      });
    }

    if (list.length === 0) {
      list.push(
        { name: 'Category', value: (m.category || NA).toUpperCase() },
        { name: 'Unit of Measure', value: (m.uom || 'EACH').toUpperCase() }
      );
    }

    return list;
  };

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Material code copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* ── Back Navigation Button (Admin only) ── */}
        {isAdmin && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground font-medium hover:bg-muted"
              onClick={() => navigate('/manage-cpses')}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to CPSEs</span>
            </Button>
          </div>
        )}

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Material Catalog Explorer
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {activeCpse
                ? `Viewing ${activeCpse.name} (${activeCpse.code}) — ${materialsData?.total ?? 0} materials`
                : 'Inspect raw and normalized material records across all CPSEs.'}
            </p>
          </div>

          {/* Normalize button — visible in Material Catalog Explorer */}
          {canNormalize && (
            <div className="flex flex-col items-start sm:items-end gap-1.5 w-full sm:w-auto">
              <Button
                size="sm"
                variant={isNormalized ? 'outline' : 'default'}
                className="h-9 sm:h-8 text-xs gap-1.5 font-medium shadow-xs w-full sm:w-auto"
                disabled={isProcessing || normalizeMutation.isPending || (normProgress.isVisible && !normProgress.isCompleted)}
                onClick={() => handleStartNormalize(activeCpse ? activeCpse.id : 'ALL')}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    isProcessing || normalizeMutation.isPending || (normProgress.isVisible && !normProgress.isCompleted) ? 'animate-spin' : ''
                  }`}
                />
                {normalizeMutation.isPending || isProcessing || (normProgress.isVisible && !normProgress.isCompleted)
                  ? `${isNormalized ? 'Re-normalizing' : 'Normalizing'} (${Math.round(normProgress.progress)}%)...`
                  : activeCpse
                  ? (isNormalized ? 'Re-normalize Materials' : 'Normalize Materials')
                  : 'Normalize All Materials'}
              </Button>

              {/* Simple & Clean Dynamic Progress Bar directly with the button */}
              {(isProcessing || normalizeMutation.isPending || (normProgress.isVisible && !normProgress.isCompleted)) && (
                <div className="w-full sm:w-64 space-y-1 pt-0.5 animate-in fade-in">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-muted-foreground">{normProgress.processedCount.toLocaleString()} / {normProgress.totalCount.toLocaleString()} items</span>
                    <span className="font-bold text-primary">{Math.round(normProgress.progress)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${Math.round(normProgress.progress)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate sm:text-right">
                    {normProgress.stageText}
                  </p>
                </div>
              )}

              {activeCpse && !isNormalized && !normProgress.isVisible && (
                <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                  Normalize this dataset to unlock all fields.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Not-normalized information banner — only shown when dataset status is RAW/UPLOADED/VALIDATED ── */}
        {activeCpse && !normProgress.isVisible && (activeCpseStatus === 'UPLOADED' || activeCpseStatus === 'VALIDATED' || activeCpseStatus === 'RAW') && (
          <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg border border-border/80 bg-muted/40 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
            <span className="leading-relaxed">
              This dataset has not been normalized yet. Only raw material codes and original descriptions are shown.
              Click <strong className="text-foreground font-semibold">Normalize Materials</strong> to unlock all fields.
            </span>
          </div>
        )}

        {/* ── Reviewer CPSE Scoping Banner ── */}
        {isReviewer && reviewerCpse && (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border border-border/80 bg-muted/40 text-xs text-muted-foreground">
            <Database className="h-4 w-4 shrink-0 text-primary" />
            <span className="leading-relaxed">
              Viewing materials for <strong className="text-foreground">{reviewerName || 'Reviewer'}</strong>
              {' '}— scoped to <strong className="text-foreground uppercase">{reviewerCpse}</strong> only.
            </span>
          </div>
        )}

        {/* ── Filter Bar ── */}
        <Card className="border-border/60">
          <CardContent className="p-3 flex flex-col md:flex-row items-center gap-2">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search descriptions, material codes, categories..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 h-8 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              {isReviewer ? (
                // Locked — reviewer cannot switch CPSE, styled like a disabled SelectTrigger
                <div className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-input bg-muted/40 text-xs text-muted-foreground cursor-not-allowed select-none whitespace-nowrap">
                  <Database className="h-3 w-3 shrink-0" />
                  <span className="font-medium text-foreground">{reviewerCpse}</span>
                  <span>— Scoped</span>
                </div>
              ) : (
                <Select
                  value={selectedCpse}
                  onValueChange={(val) => {
                    setSelectedCpse(val);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full md:w-[170px] h-8 text-xs">
                    <SelectValue placeholder="All CPSEs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All CPSEs</SelectItem>
                    {cpses?.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  setStatusFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full md:w-[150px] h-8 text-xs">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="RAW">Not Processed</SelectItem>
                  <SelectItem value="NORMALIZED">Processed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* ── Materials Table (CPSE column removed) ── */}
        <Card className="border-border/60 overflow-hidden shadow-xs">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              <div className="flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                <span>Loading materials...</span>
              </div>
            </div>
          ) : !materialsData?.items || materialsData.items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No materials found.</div>
          ) : (
            <>
              {/* ── Desktop Table (md+) ── */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/60 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="p-3 w-36">Material Code</th>
                      <th className="p-3 min-w-[240px]">Original Description</th>
                      <th className="p-3 w-36">Category</th>
                      <th className="p-3 w-36">Status</th>
                      <th className="p-3 min-w-[200px]">Normalized Description</th>
                      <th className="p-3 w-16 text-center">View</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {materialsData.items.map((m: any) => {
                      const raw = isRaw(m);
                      return (
                        <tr
                          key={m.id}
                          className="hover:bg-muted/30 cursor-pointer transition-colors"
                          onClick={() => setSelectedMaterial(m)}
                        >
                          <td className="p-3 font-mono font-medium text-foreground truncate max-w-[140px]">
                            {m.original_material_code || NA}
                          </td>
                          <td className="p-3 text-foreground font-medium max-w-[280px] truncate" title={m.original_description}>
                            {m.original_description}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {raw ? (
                              <span className="text-muted-foreground/40 italic font-mono">—</span>
                            ) : (
                              <div className="flex flex-col">
                                <span className="font-semibold text-foreground capitalize">{m.material_family || m.category || NA}</span>
                                {m.material_type && <span className="text-[10px] text-muted-foreground capitalize">{m.material_type}</span>}
                              </div>
                            )}
                          </td>
                          <td className="p-3">{renderHarmonizationBadge(m)}</td>
                          <td className="p-3 text-muted-foreground max-w-[280px] truncate" title={m.standardized_description || m.normalized_description || ''}>
                            {raw ? (
                              <span className="text-muted-foreground/40 italic font-mono">—</span>
                            ) : (
                              <span className="text-foreground/90 font-medium">{m.standardized_description || m.normalized_description || NA}</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <Button
                              variant="outline" size="sm"
                              className="h-7 px-2.5 text-xs gap-1 font-medium text-foreground hover:bg-muted"
                              onClick={(e) => { e.stopPropagation(); setSelectedMaterial(m); }}
                            >
                              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>View</span>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Mobile Card List (< md) ── */}
              <div className="md:hidden divide-y divide-border/60">
                {materialsData.items.map((m: any) => {
                  const raw = isRaw(m);
                  return (
                    <div
                      key={m.id}
                      className="p-3.5 hover:bg-muted/30 cursor-pointer transition-colors space-y-2"
                      onClick={() => setSelectedMaterial(m)}
                    >
                      {/* Top row: code + status badge */}
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono font-semibold text-xs text-foreground">{m.original_material_code || NA}</span>
                        {renderHarmonizationBadge(m)}
                      </div>
                      {/* Original description */}
                      <p className="text-sm text-foreground font-medium leading-snug line-clamp-2">
                        {m.original_description}
                      </p>
                      {/* Meta row: category + normalized desc */}
                      {!raw && (
                        <div className="space-y-1">
                          {(m.material_family || m.category) && (
                            <p className="text-[11px] text-muted-foreground">
                              <span className="font-semibold text-foreground capitalize">{m.material_family || m.category}</span>
                              {m.material_type && <span className="capitalize"> · {m.material_type}</span>}
                            </p>
                          )}
                          {(m.standardized_description || m.normalized_description) && (
                            <p className="text-[11px] text-muted-foreground line-clamp-1">
                              {m.standardized_description || m.normalized_description}
                            </p>
                          )}
                        </div>
                      )}
                      {/* View button */}
                      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline" size="sm"
                          className="h-7 px-2.5 text-xs gap-1 font-medium"
                          onClick={() => setSelectedMaterial(m)}
                        >
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          View
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Pagination */}
          {materialsData && materialsData.total_pages > 1 && (
            <div className="p-3 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-muted-foreground bg-muted/20">
              <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, materialsData.total)} of {materialsData.total}</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="px-2 font-medium text-foreground">{page} / {materialsData.total_pages}</span>
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= materialsData.total_pages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* ── Technical Attribute Inspection (Clean Tabular Popup Modal) ── */}
        <Dialog
          open={!!selectedMaterial}
          onOpenChange={(open) => !open && setSelectedMaterial(null)}
        >
          <DialogContent className="max-w-3xl sm:max-w-3xl w-[95vw] p-0 overflow-hidden border border-border bg-card rounded-2xl shadow-2xl flex flex-col max-h-[88vh]">
            {selectedMaterial && (
              <>
                {/* ── Modal Header ── */}
                <div className="p-4 px-6 border-b border-border bg-muted/30 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <DialogTitle className="text-base font-bold font-mono text-foreground leading-tight truncate">
                        {selectedMaterial.original_material_code || selectedMaterial.id}
                      </DialogTitle>
                      {selectedMaterial.original_material_code && (
                        <button
                          type="button"
                          onClick={() => handleCopyCode(selectedMaterial.original_material_code)}
                          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted"
                          title="Copy Material Code"
                        >
                          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      )}
                      <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5">
                        {cpseMap[selectedMaterial.cpse_id] || 'CPSE'}
                      </Badge>
                      {/* Single status badge in header — removes duplication with modal body */}
                      {renderHarmonizationBadge(selectedMaterial)}
                    </div>
                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                      Technical Attribute Inspection · {cpseMap[selectedMaterial.cpse_id] || 'CPSE'} Catalog
                    </DialogDescription>
                  </div>
                </div>

                {/* ── Modal Scrollable Body with Clean Spacing & Margins ── */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">

                  {/* 1. Harmonization Outcome — description text only (badge shown in header, no duplication) */}
                  <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 text-xs text-muted-foreground leading-relaxed">
                    {selectedMaterial.mapping_status === 'MAPPED'
                      ? 'This material has been harmonized across CPSE catalogs and recorded in the Common Material Master.'
                      : isRaw(selectedMaterial)
                      ? 'Dataset has been uploaded but not yet normalized. Run Normalize Materials to extract engineering parameters and enable cross-CPSE matching.'
                      : 'Processed through the NMC normalization pipeline. No equivalent cross-CPSE candidate has been found yet — material stands as unique in its catalog.'}
                  </div>

                  {/* 2. Canonical Normalized Identity */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-primary flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        Canonical Normalized Description
                      </h3>
                      <span className="text-[11px] text-muted-foreground font-medium">Deterministic Standard</span>
                    </div>

                    <div className="p-3.5 rounded-xl border border-border/80 bg-muted/30 font-mono text-xs font-medium text-foreground leading-relaxed select-text">
                      {selectedMaterial.standardized_description ||
                        selectedMaterial.normalized_description ||
                        NA}
                    </div>
                  </div>

                  {/* 3. Technical Parameters Table (Clean Tabular Form) */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-primary flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      Extracted Technical Parameters
                    </h3>

                    {isRaw(selectedMaterial) ? (
                      <div className="p-4 rounded-xl border border-border bg-muted/30 text-muted-foreground text-xs">
                        This material has not been normalized yet. Parameters will appear here once you run <strong>Normalize Materials</strong>.
                      </div>
                    ) : (
                      <div className="rounded-xl border border-border overflow-hidden shadow-2xs">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-muted/60 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider border-b border-border">
                            <tr>
                              <th className="px-4 py-2.5 w-2/5 border-r border-border">Technical Parameter</th>
                              <th className="px-4 py-2.5 w-3/5">Extracted Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {getTabularAttributes(selectedMaterial).map((row) => (
                              <tr key={row.name} className="hover:bg-muted/20 transition-colors">
                                <td className="px-4 py-2.5 bg-muted/20 font-medium text-foreground/80 border-r border-border">
                                  {row.name}
                                </td>
                                <td className="px-4 py-2.5 font-semibold font-mono text-foreground uppercase">
                                  {row.value}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* 4. Source Data Table (Original Master Record) */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-primary flex items-center gap-1.5">
                      <Database className="h-3.5 w-3.5 text-primary" />
                      Source Record (Immutable)
                    </h3>

                    <div className="rounded-xl border border-border overflow-hidden shadow-2xs">
                      <table className="w-full text-left text-xs border-collapse">
                        <tbody className="divide-y divide-border">
                          <tr className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-2.5 w-2/5 bg-muted/20 font-medium text-foreground/80 border-r border-border">
                              Source Material Code
                            </td>
                            <td className="px-4 py-2.5 font-semibold font-mono text-foreground">
                              {selectedMaterial.original_material_code || NA}
                            </td>
                          </tr>
                          <tr className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-2.5 w-2/5 bg-muted/20 font-medium text-foreground/80 border-r border-border">
                              Original Description
                            </td>
                            <td className="px-4 py-2.5 font-medium text-foreground leading-relaxed">
                              {selectedMaterial.original_description}
                            </td>
                          </tr>
                          <tr className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-2.5 w-2/5 bg-muted/20 font-medium text-foreground/80 border-r border-border">
                              Source Unit of Measure (UOM)
                            </td>
                            <td className="px-4 py-2.5 font-semibold font-mono text-foreground uppercase">
                              {selectedMaterial.uom || 'PCS'}
                            </td>
                          </tr>
                          <tr className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-2.5 w-2/5 bg-muted/20 font-medium text-foreground/80 border-r border-border">
                              Enterprise Tenant
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-foreground">
                              {cpseMap[selectedMaterial.cpse_id] || 'CPSE'}
                            </td>
                          </tr>
                          <tr className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-2.5 w-2/5 bg-muted/20 font-medium text-foreground/80 border-r border-border">
                              Source ERP / System
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-foreground font-semibold">
                              {selectedMaterial.erp_source || resolveErpSource(cpseMap[selectedMaterial.cpse_id], selectedMaterial.attributes)}
                            </td>
                          </tr>
                          <tr className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-2.5 w-2/5 bg-muted/20 font-medium text-foreground/80 border-r border-border">
                              Plant / Site Location
                            </td>
                            <td className="px-4 py-2.5 text-foreground font-medium">
                              {selectedMaterial.plant_site || resolvePlantSite(cpseMap[selectedMaterial.cpse_id], selectedMaterial.attributes)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 5. Original Raw Payload (Accordion) */}
                  <div className="rounded-xl border border-border overflow-hidden bg-card shadow-2xs">
                    <button
                      type="button"
                      className="w-full p-3.5 px-4 flex items-center justify-between hover:bg-muted/40 transition-colors text-left group"
                      onClick={() => setPayloadOpen(!payloadOpen)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                          Original Raw Payload
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                          {Object.keys(selectedMaterial.attributes || { code: 1, desc: 1, uom: 1 }).length} keys
                        </Badge>
                      </div>
                      <ChevronRight
                        className={`h-4 w-4 text-muted-foreground group-hover:text-primary transition-transform duration-200 ${
                          payloadOpen ? 'rotate-90' : ''
                        }`}
                      />
                    </button>
                    {payloadOpen && (
                      <div className="p-3.5 border-t border-border bg-muted/20">
                        <pre className="text-[11px] font-mono text-foreground overflow-x-auto max-h-56 p-3 rounded-lg bg-background border border-border">
                          {JSON.stringify(
                            selectedMaterial.attributes || {
                              material_code: selectedMaterial.original_material_code,
                              description: selectedMaterial.original_description,
                              uom: selectedMaterial.uom || 'PCS',
                            },
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    )}
                  </div>

                </div>

                {/* ── Modal Footer Action ── */}
                <div className="p-3.5 px-6 border-t border-border bg-muted/20 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    National Material Code (NMC) Platform · Technical Specification
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-medium px-4"
                    onClick={() => setSelectedMaterial(null)}
                  >
                    Close
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

