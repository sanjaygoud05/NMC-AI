/**
 * Procurement Intelligence & Joint Sourcing Analytics (Phase 10)
 * Deterministic, evidence-based procurement analytics layer.
 * Implements strict per-UOM volume conservation and auditable opportunity provenance.
 */

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Search,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  BarChart3,
  Factory,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Package,
  Boxes,
  HelpCircle,
  Database,
  Upload,
  Download,
  Loader2,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, Legend } from 'recharts';
import {
  procurementService,
  ProcurementKPIs,
  CMMProcurementSummaryRecord,
  CPSEProcurementSummaryRecord,
  ProcurementOpportunityRecord,
  PlantDistributionRecord,
} from '@/services/procurementService';
import { useDataset } from '@/contexts/DatasetContext';

export default function Procurement() {
  const { activeDatasetId, selectDataset } = useDataset();
  const [activeTab, setActiveTab] = useState('opportunities');
  const [kpis, setKpis] = useState<ProcurementKPIs | null>(null);
  const [loading, setLoading] = useState(true);

  // Opportunities state
  const [opportunities, setOpportunities] = useState<ProcurementOpportunityRecord[]>([]);
  const [oppTypeFilter, setOppTypeFilter] = useState('all');
  const [oppCpseFilter, setOppCpseFilter] = useState('all');
  const [oppPage, setOppPage] = useState(1);
  const [oppTotal, setOppTotal] = useState(0);
  const [oppTotalPages, setOppTotalPages] = useState(1);

  // CMM Explorer state
  const [cmmSummaries, setCmmSummaries] = useState<CMMProcurementSummaryRecord[]>([]);
  const [cmmSearch, setCmmSearch] = useState('');
  const [cmmFamilyFilter, setCmmFamilyFilter] = useState('all');
  const [cmmUomFilter, setCmmUomFilter] = useState('all');
  const [cmmCpseFilter, setCmmCpseFilter] = useState('all');
  const [cmmPage, setCmmPage] = useState(1);
  const [cmmTotal, setCmmTotal] = useState(0);
  const [cmmTotalPages, setCmmTotalPages] = useState(1);

  // CPSE Summaries state
  const [cpseSummaries, setCpseSummaries] = useState<CPSEProcurementSummaryRecord[]>([]);

  // Plant Distribution state
  const [plantDistributions, setPlantDistributions] = useState<PlantDistributionRecord[]>([]);
  const [plantSearch, setPlantSearch] = useState('');
  const [plantUomFilter, setPlantUomFilter] = useState('all');

  // Drill-down modal state
  const [selectedCmm, setSelectedCmm] = useState<CMMProcurementSummaryRecord | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Initial load: KPIs & CPSE summaries
  useEffect(() => {
    const loadCoreData = async () => {
      try {
        setLoading(true);
        const [kpiData, cpseData] = await Promise.all([
          procurementService.getKPIs(activeDatasetId),
          procurementService.getCPSESummaries(activeDatasetId),
        ]);
        setKpis(kpiData);
        setCpseSummaries(cpseData);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load procurement baseline';
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    loadCoreData();
  }, [activeDatasetId]);

  // Fetch opportunities when filters/page change
  useEffect(() => {
    const fetchOpps = async () => {
      try {
        const res = await procurementService.getOpportunities({
          opportunity_type: oppTypeFilter !== 'all' ? oppTypeFilter : undefined,
          source_cpse: oppCpseFilter !== 'all' ? oppCpseFilter : undefined,
          dataset_id: activeDatasetId,
          page: oppPage,
          page_size: 15,
        });
        setOpportunities(res.items || []);
        setOppTotal(res.total || 0);
        setOppTotalPages(res.total_pages || 1);
      } catch (err: unknown) {
        console.error('Error loading opportunities:', err);
      }
    };
    fetchOpps();
  }, [oppTypeFilter, oppCpseFilter, oppPage, activeDatasetId]);

  // Fetch CMM summaries when filters/page change
  useEffect(() => {
    const fetchCmm = async () => {
      try {
        const res = await procurementService.getCMMDemandSummaries({
          search: cmmSearch,
          material_family: cmmFamilyFilter !== 'all' ? cmmFamilyFilter : undefined,
          primary_uom: cmmUomFilter !== 'all' ? cmmUomFilter : undefined,
          cpse: cmmCpseFilter !== 'all' ? cmmCpseFilter : undefined,
          dataset_id: activeDatasetId,
          page: cmmPage,
          page_size: 15,
        });
        setCmmSummaries(res.items || []);
        setCmmTotal(res.total || 0);
        setCmmTotalPages(res.total_pages || 1);
      } catch (err: unknown) {
        console.error('Error loading CMM summaries:', err);
      }
    };
    fetchCmm();
  }, [cmmSearch, cmmFamilyFilter, cmmUomFilter, cmmCpseFilter, cmmPage, activeDatasetId]);

  const [exportingCmm, setExportingCmm] = useState(false);

  const handleExportCmmCSV = async () => {
    try {
      setExportingCmm(true);
      toast.info('Generating complete CMM Demand summary export...');
      const res = await procurementService.getCMMDemandSummaries({
        search: cmmSearch || undefined,
        material_family: cmmFamilyFilter !== 'all' ? cmmFamilyFilter : undefined,
        primary_uom: cmmUomFilter !== 'all' ? cmmUomFilter : undefined,
        cpse: cmmCpseFilter !== 'all' ? cmmCpseFilter : undefined,
        dataset_id: activeDatasetId,
        page: 1,
        page_size: 10000,
      });

      const records = res.items || [];
      if (records.length === 0) {
        toast.error('No CMM demand records found to export');
        return;
      }

      const headers = [
        'CMM_Code',
        'Material_Description',
        'Material_Family',
        'Governance_Status',
        'Consuming_CPSEs',
        'CPSE_Count',
        'Annual_Demand_Volume',
        'Primary_UOM',
        'Dominant_Plant',
        'Plant_Count',
        'Purchase_Recency_Days',
        'Latest_Purchase_Date',
        'OEM_Count',
      ];

      const rows = records.map((r) => [
        `"${r.cmm_code || ''}"`,
        `"${(r.common_description || '').replace(/"/g, '""')}"`,
        `"${r.material_family || ''}"`,
        `"${r.governance_status || ''}"`,
        `"${(r.consuming_cpses || '').replace(/"/g, '""')}"`,
        r.cpse_count || 1,
        r.total_annual_consumption || 0,
        `"${r.primary_uom || ''}"`,
        `"${(r.dominant_plant || '').replace(/"/g, '""')}"`,
        r.plant_count || 1,
        r.purchase_recency_days ?? '',
        `"${r.latest_purchase_date || ''}"`,
        r.unique_manufacturers_count || 1,
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `cmm_demand_summary_${activeDatasetId || 'BASELINE'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${records.length.toLocaleString()} CMM demand records to CSV`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to export CMM demand CSV';
      toast.error(msg);
    } finally {
      setExportingCmm(false);
    }
  };

  // Fetch plant distribution
  useEffect(() => {
    if (activeTab === 'plants') {
      procurementService
        .getPlantDistribution(activeDatasetId)
        .then((data) => setPlantDistributions(data))
        .catch((err) => console.error('Error loading plant distributions:', err));
    }
  }, [activeTab, activeDatasetId]);

  // Drill down into single CMM
  const handleOpenCmmDetail = async (cmmCode: string) => {
    try {
      setModalLoading(true);
      setIsModalOpen(true);
      const detail = await procurementService.getCMMDetail(cmmCode);
      setSelectedCmm(detail);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load CMM detail';
      toast.error(msg);
      setIsModalOpen(false);
    } finally {
      setModalLoading(false);
    }
  };

  /** Clean signal type label — no colored badges */
  const getSignalLabel = (type: string): string => {
    const map: Record<string, string> = {
      HIGH_VOLUME_CONCENTRATION: 'High-Volume (P95)',
      MULTI_CPSE_DEMAND_AGGREGATION: 'Multi-CPSE Demand',
      PURCHASE_DORMANCY_SIGNAL: 'Dormancy Signal',
      MANUFACTURER_DIVERSITY_SIGNAL: 'OEM Diversity',
    };
    return map[type] ?? type.replace(/_/g, ' ');
  };

  const filteredPlants = plantDistributions.filter((p) => {
    const matchesSearch =
      !plantSearch ||
      p.plant.toLowerCase().includes(plantSearch.toLowerCase()) ||
      p.source_cpse.toLowerCase().includes(plantSearch.toLowerCase());
    const matchesUom = plantUomFilter === 'all' || p.unit_of_measure === plantUomFilter;
    return matchesSearch && matchesUom;
  });

  if (activeDatasetId === 'NONE') {
    return (
      <AppLayout>
        <div className="space-y-6">
          <PageHeader
            title="Procurement Intelligence & Joint Sourcing Analytics"
            description="Deterministic, evidence-based procurement analytics layer with volume conservation"
          />
          <Card className="border-border bg-card p-12">
            <EmptyState
              icon={Database}
              title="No Dataset Selected"
              description="Upload a material master dataset or explicitly select an existing dataset to begin."
              action={{
                label: "Upload Dataset",
                icon: Upload,
                href: "/ingest",
              }}
            />
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectDataset('BASELINE')}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Or select Frozen Baseline (1,250 records)
              </Button>
            </div>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageHeader
            title="Procurement Intelligence & Joint Sourcing"
            description="Phase 10 — Deterministic cross-CPSE demand exploration, volume concentration, and explainable sourcing signals"
          />
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="px-3 py-1 font-mono text-xs border-primary/40 text-primary bg-primary/5">
              <Calendar className="h-3.5 w-3.5 mr-1.5 inline" />
              Reference Date: 2026-03-31 (Frozen)
            </Badge>
          </div>
        </div>

        {/* Top KPI Cards */}
        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Source Materials</span>
                <Boxes className="h-4 w-4 text-primary" />
              </div>
              <div className="text-3xl font-extrabold text-foreground mt-2">
                {kpis ? kpis.total_materials_analyzed.toLocaleString() : '—'}
              </div>
              <div className="text-xs text-muted-foreground mt-2 flex items-center gap-2 text-[11px]">
                <span>Active: <strong className="font-semibold text-foreground">{kpis ? kpis.active_materials_count : '—'}</strong></span>
                <span className="text-border">&bull;</span>
                <span>Inactive: <strong className="font-semibold text-foreground">{kpis ? kpis.inactive_materials_count : '—'}</strong></span>
                <span className="text-muted-foreground">({kpis ? kpis.active_materials_pct : '—'}%)</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">CMM Master Entities</span>
                <Layers className="h-4 w-4 text-foreground/80" />
              </div>
              <div className="text-3xl font-extrabold text-foreground mt-2">
                {kpis ? kpis.total_cmm_entities.toLocaleString() : '—'}
              </div>
              <div className="text-xs text-muted-foreground mt-2 flex items-center gap-2 text-[11px]">
                <span>Multi-CPSE: <strong className="font-semibold text-foreground">{kpis?.multi_cpse_cmms_count ?? '—'}</strong></span>
                <span className="text-border">&bull;</span>
                <span>Standalone: <strong className="font-semibold text-foreground">{kpis?.standalone_cmms_count ?? '—'}</strong></span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Physical Volumes (Per UOM)</span>
                <Package className="h-4 w-4 text-foreground/80" />
              </div>
              <div className="mt-2 space-y-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">NOS:</span>
                  <span className="font-mono tabular-nums">{kpis?.volume_by_uom?.NOS ? kpis.volume_by_uom.NOS.toLocaleString() : '—'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">MTR:</span>
                  <span className="font-mono tabular-nums">{kpis?.volume_by_uom?.MTR ? kpis.volume_by_uom.MTR.toLocaleString() : '—'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">LTR:</span>
                  <span className="font-mono tabular-nums">{kpis?.volume_by_uom?.LTR ? kpis.volume_by_uom.LTR.toLocaleString() : '—'}</span>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground/80 mt-1 italic">
                Strictly partitioned by UOM (never mixed)
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Auditable Sourcing Signals</span>
                <Sparkles className="h-4 w-4 text-foreground/80" />
              </div>
              <div className="text-3xl font-extrabold text-foreground mt-2">
                {kpis ? kpis.total_opportunities_count : '—'}
              </div>
              <div className="text-xs text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                <span>P95 Conc: <strong className="font-semibold text-foreground">{kpis?.opportunities_by_type?.HIGH_VOLUME_CONCENTRATION ?? '—'}</strong></span>
                <span className="text-border">&bull;</span>
                <span>Multi-CPSE: <strong className="font-semibold text-foreground">{kpis?.opportunities_by_type?.MULTI_CPSE_DEMAND_AGGREGATION ?? '—'}</strong></span>
                <span className="text-border">&bull;</span>
                <span>OEM Div: <strong className="font-semibold text-foreground">{kpis?.opportunities_by_type?.MANUFACTURER_DIVERSITY_SIGNAL ?? '—'}</strong></span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="w-full flex overflow-x-auto justify-start sm:justify-center p-1 rounded-lg bg-muted scrollbar-none">
            <TabsTrigger value="opportunities" className="gap-2 shrink-0">
              <Sparkles className="h-4 w-4" />
              Sourcing Opportunities ({oppTotal})
            </TabsTrigger>
            <TabsTrigger value="cmm_demand" className="gap-2 shrink-0">
              <Layers className="h-4 w-4" />
              CMM Demand Explorer
            </TabsTrigger>
            <TabsTrigger value="cpse_comparison" className="gap-2 shrink-0">
              <Building2 className="h-4 w-4" />
              CPSE Demand Comparison
            </TabsTrigger>
            <TabsTrigger value="plants" className="gap-2 shrink-0">
              <Factory className="h-4 w-4" />
              Facility & Plant Distribution
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Sourcing Opportunities */}
          <TabsContent value="opportunities" className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card p-3 rounded-lg border border-border">
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <Select value={oppTypeFilter} onValueChange={(v) => { setOppTypeFilter(v); setOppPage(1); }}>
                  <SelectTrigger className="w-[260px] h-9 text-xs">
                    <SelectValue placeholder="Signal Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sourcing Signals</SelectItem>
                    <SelectItem value="MULTI_CPSE_DEMAND_AGGREGATION">Multi-CPSE Demand Aggregation</SelectItem>
                    <SelectItem value="HIGH_VOLUME_CONCENTRATION">High-Volume Concentration (P95)</SelectItem>
                    <SelectItem value="PURCHASE_DORMANCY_SIGNAL">Purchase Dormancy Signal</SelectItem>
                    <SelectItem value="MANUFACTURER_DIVERSITY_SIGNAL">Manufacturer Diversity Signal</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={oppCpseFilter} onValueChange={(v) => { setOppCpseFilter(v); setOppPage(1); }}>
                  <SelectTrigger className="w-[150px] h-9 text-xs">
                    <SelectValue placeholder="Source CPSE" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All CPSEs</SelectItem>
                    <SelectItem value="CPCL">CPCL</SelectItem>
                    <SelectItem value="HPCL">HPCL</SelectItem>
                    <SelectItem value="IOCL">IOCL</SelectItem>
                    <SelectItem value="ONGC">ONGC</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="text-xs text-muted-foreground w-full sm:w-auto text-right">
                Showing {opportunities.length} of {oppTotal} auditable signals
              </div>
            </div>

            {/* Sourcing Signals Recharts Chart */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Sourcing Opportunity Signals Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'Volume Concentration (P95)', count: kpis?.opportunities_by_type?.HIGH_VOLUME_CONCENTRATION ?? 0, fill: '#3b82f6' },
                      { name: 'Joint Sourcing (Multi-CPSE)', count: kpis?.opportunities_by_type?.MULTI_CPSE_DEMAND_AGGREGATION ?? 0, fill: '#10b981' },
                      { name: 'OEM Diversity Signal', count: kpis?.opportunities_by_type?.MANUFACTURER_DIVERSITY_SIGNAL ?? 0, fill: '#f59e0b' },
                    ]}>
                      <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip
                        cursor={false}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        formatter={(val: number) => [`${val} opportunities`, 'Count']}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {[
                          { fill: '#3b82f6' },
                          { fill: '#10b981' },
                          { fill: '#f59e0b' },
                        ].map((entry, index) => (
                          <Cell key={`opp-cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Opportunities Table */}
            <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto w-full">
                <Table className="min-w-[980px]">
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent bg-muted/40 text-xs">
                      <TableHead className="w-[180px] font-semibold text-foreground">Signal Type</TableHead>
                      <TableHead className="w-[160px] font-semibold text-foreground">CMM Code</TableHead>
                      <TableHead className="w-[170px] font-semibold text-foreground">Consuming CPSEs</TableHead>
                      <TableHead className="w-[140px] font-semibold text-foreground">Trigger Metric</TableHead>
                      <TableHead className="w-[120px] font-semibold text-foreground">Observed Value</TableHead>
                      <TableHead className="w-[120px] font-semibold text-foreground">Rule Threshold</TableHead>
                      <TableHead className="min-w-[240px] font-semibold text-foreground">Explainable Provenance &amp; Evidence</TableHead>
                      <TableHead className="w-[100px] text-right font-semibold text-foreground">Drill-Down</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {opportunities.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-xs">
                          No sourcing signals found matching the selected filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      opportunities.map((opp) => (
                        <TableRow key={opp.opportunity_id} className="hover:bg-muted/20 border-border/50 text-xs">
                          <TableCell className="align-top py-3">
                            <div className="font-medium text-foreground">{getSignalLabel(opp.opportunity_type)}</div>
                            <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                              {opp.opportunity_id.substring(0, 16)}…
                            </div>
                          </TableCell>
                          <TableCell className="align-top font-mono text-xs py-3">
                            <span
                              className="font-medium text-primary hover:underline cursor-pointer"
                              onClick={() => handleOpenCmmDetail(opp.cmm_code)}
                            >
                              {opp.cmm_code}
                            </span>
                          </TableCell>
                          <TableCell className="align-top py-3">
                            <div className="flex flex-wrap gap-1">
                              {opp.source_cpses.split(';').map((cpse) => (
                                <span
                                  key={cpse}
                                  className="inline-block px-1.5 py-0.5 rounded border border-border bg-muted/60 text-[10px] font-mono text-foreground"
                                >
                                  {cpse.trim()}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="align-top font-mono text-[11px] text-muted-foreground py-3">
                            {opp.trigger_metric}
                          </TableCell>
                          <TableCell className="align-top font-mono text-xs text-foreground font-semibold py-3">
                            {opp.trigger_value}
                          </TableCell>
                          <TableCell className="align-top font-mono text-[11px] text-muted-foreground py-3">
                            {opp.threshold}
                          </TableCell>
                          <TableCell className="align-top py-3">
                            <p className="text-foreground leading-relaxed text-xs">
                              {opp.reason}
                            </p>
                            {opp.evidence_reference && (
                              <div className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded border border-border/60">
                                <span>Ref:</span>
                                <span>{opp.evidence_reference}</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="align-top text-right py-3">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 text-xs gap-1 border-border hover:bg-muted"
                              onClick={() => handleOpenCmmDetail(opp.cmm_code)}
                            >
                              <span>Drill-Down</span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Opportunities Pagination */}
            {oppTotalPages > 1 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <div>Page {oppPage} of {oppTotalPages}</div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={oppPage <= 1}
                    onClick={() => setOppPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={oppPage >= oppTotalPages}
                    onClick={() => setOppPage((p) => Math.min(oppTotalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB 2: CMM Demand Explorer */}
          <TabsContent value="cmm_demand" className="space-y-4">
            {/* Search & Filter Toolbar */}
            <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between bg-card p-3 rounded-lg border border-border shadow-sm">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="relative min-w-[220px] flex-1 sm:max-w-[300px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search CMM code, description, plant…"
                    value={cmmSearch}
                    onChange={(e) => { setCmmSearch(e.target.value); setCmmPage(1); }}
                    className="pl-8 h-9 text-xs bg-background border-border"
                  />
                </div>

                <Select value={cmmFamilyFilter} onValueChange={(v) => { setCmmFamilyFilter(v); setCmmPage(1); }}>
                  <SelectTrigger className="w-[135px] h-9 text-xs bg-background border-border">
                    <SelectValue placeholder="Material Family" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Families</SelectItem>
                    <SelectItem value="VALVE">VALVE</SelectItem>
                    <SelectItem value="PIPE">PIPE</SelectItem>
                    <SelectItem value="FLANGE">FLANGE</SelectItem>
                    <SelectItem value="GASKET">GASKET</SelectItem>
                    <SelectItem value="PUMP">PUMP</SelectItem>
                    <SelectItem value="BEARING">BEARING</SelectItem>
                    <SelectItem value="CABLE">CABLE</SelectItem>
                    <SelectItem value="MOTOR">MOTOR</SelectItem>
                    <SelectItem value="SEAL">SEAL</SelectItem>
                    <SelectItem value="INSTRUMENTATION">INSTRUMENTATION</SelectItem>
                    <SelectItem value="STRUCTURAL">STRUCTURAL</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={cmmUomFilter} onValueChange={(v) => { setCmmUomFilter(v); setCmmPage(1); }}>
                  <SelectTrigger className="w-[110px] h-9 text-xs bg-background border-border">
                    <SelectValue placeholder="Unit (UOM)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Units</SelectItem>
                    <SelectItem value="NOS">NOS</SelectItem>
                    <SelectItem value="MTR">MTR</SelectItem>
                    <SelectItem value="SET">SET</SelectItem>
                    <SelectItem value="KG">KG</SelectItem>
                    <SelectItem value="LTR">LTR</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={cmmCpseFilter} onValueChange={(v) => { setCmmCpseFilter(v); setCmmPage(1); }}>
                  <SelectTrigger className="w-[130px] h-9 text-xs bg-background border-border">
                    <SelectValue placeholder="CPSE Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All CPSEs</SelectItem>
                    <SelectItem value="BHEL">BHEL</SelectItem>
                    <SelectItem value="Coal India">Coal India</SelectItem>
                    <SelectItem value="HPCL">HPCL</SelectItem>
                    <SelectItem value="IOCL">IOCL</SelectItem>
                    <SelectItem value="NMDC">NMDC</SelectItem>
                    <SelectItem value="NTPC">NTPC</SelectItem>
                    <SelectItem value="ONGC">ONGC</SelectItem>
                    <SelectItem value="SAIL">SAIL</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={exportingCmm}
                  onClick={handleExportCmmCSV}
                  className="h-9 px-3 text-xs gap-1.5 border-border bg-background hover:bg-muted text-foreground"
                  title="Export all matching records to CSV"
                >
                  {exportingCmm ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Exporting...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Export CSV</span>
                    </>
                  )}
                </Button>

                {(cmmSearch || cmmFamilyFilter !== 'all' || cmmUomFilter !== 'all' || cmmCpseFilter !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCmmSearch('');
                      setCmmFamilyFilter('all');
                      setCmmUomFilter('all');
                      setCmmCpseFilter('all');
                      setCmmPage(1);
                    }}
                    className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Reset
                  </Button>
                )}
              </div>

              <div className="text-xs font-mono text-muted-foreground whitespace-nowrap bg-muted/40 px-3 py-1.5 rounded border border-border/50 text-right self-end lg:self-center">
                Showing <strong className="text-foreground">{cmmSummaries.length}</strong> of{' '}
                <strong className="text-foreground">{cmmTotal.toLocaleString()}</strong> CMM records
              </div>
            </div>

            {/* CMM Summaries Table - Streamlined, Non-Clumsy Design */}
            <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto w-full">
                <Table className="min-w-[960px]">
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40 border-border text-xs">
                      <TableHead className="w-[200px] font-semibold text-foreground">CMM Entity Code</TableHead>
                      <TableHead className="min-w-[320px] font-semibold text-foreground">Common Material Description</TableHead>
                      <TableHead className="w-[260px] font-semibold text-foreground">Consuming CPSEs</TableHead>
                      <TableHead className="w-[180px] text-right font-semibold text-foreground">Annual Demand Volume</TableHead>
                      <TableHead className="w-[110px] text-right font-semibold text-foreground">Drill-Down</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cmmSummaries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-xs">
                          No CMM demand records found matching criteria.
                        </TableCell>
                      </TableRow>
                    ) : (
                      cmmSummaries.map((c) => (
                        <TableRow key={c.cmm_code} className="hover:bg-muted/30 border-border/50 text-xs transition-colors">
                          <TableCell className="py-3.5 align-middle">
                            <span
                              className="font-mono text-xs font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer transition-colors"
                              onClick={() => handleOpenCmmDetail(c.cmm_code)}
                              title="Inspect contributing CPSE legacy materials"
                            >
                              {c.cmm_code}
                            </span>
                          </TableCell>
                          <TableCell className="py-3.5 align-middle">
                            <div className="text-xs font-medium text-slate-100 line-clamp-1" title={c.common_description}>
                              {c.common_description}
                            </div>
                            <div className="text-[11px] font-mono mt-0.5 flex items-center gap-2">
                              <span className="text-indigo-300">Family: {c.material_family}</span>
                              {c.dominant_plant && (
                                <>
                                  <span className="text-muted-foreground/60">&bull;</span>
                                  <span className="text-muted-foreground truncate max-w-[200px]" title={c.dominant_plant}>
                                    Plant: {c.dominant_plant}
                                  </span>
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-3.5 align-middle">
                            {(() => {
                              const rawCpses = c.consuming_cpses.split(';').map((s) => s.trim()).filter(Boolean);
                              if (rawCpses.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
                              if (rawCpses.length <= 3) {
                                return (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {rawCpses.map((cpse) => (
                                      <span key={cpse} className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono border border-sky-500/30 bg-sky-500/10 text-sky-300 font-medium">
                                        {cpse}
                                      </span>
                                    ))}
                                  </div>
                                );
                              }
                              return (
                                <div className="flex items-center gap-1.5 flex-nowrap">
                                  {rawCpses.slice(0, 2).map((cpse) => (
                                    <span key={cpse} className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono border border-sky-500/30 bg-sky-500/10 text-sky-300 font-medium shrink-0">
                                      {cpse}
                                    </span>
                                  ))}
                                  <span
                                    className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono border border-border bg-muted/60 text-muted-foreground font-medium shrink-0 cursor-help hover:text-foreground transition-colors"
                                    title={`All Consuming CPSEs:\n${rawCpses.join(', ')}`}
                                  >
                                    +{rawCpses.length - 2} more
                                  </span>
                                </div>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="py-3.5 align-middle text-right">
                            <div className="font-mono text-xs font-bold text-emerald-400 tabular-nums">
                              {c.total_annual_consumption.toLocaleString()} <span className="text-emerald-400/70 text-[11px] font-medium">{c.primary_uom}</span>
                            </div>
                            <div className="text-[10px] mt-0.5">
                              {c.cpse_count >= 2 ? (
                                <span className="text-sky-300/80 font-medium">Multi-CPSE ({c.cpse_count} enterprises)</span>
                              ) : (
                                <span className="text-muted-foreground">Standalone Enterprise</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-3.5 align-middle">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 text-xs gap-1 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/15 text-emerald-400 hover:text-emerald-300 transition-colors shadow-none"
                              onClick={() => handleOpenCmmDetail(c.cmm_code)}
                            >
                              <span>Drill-Down</span>
                              <ArrowRight className="h-3 w-3 text-emerald-400/80" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* CMM Pagination */}
            {cmmTotalPages > 1 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground px-2 py-1">
                <span className="font-mono">
                  Page {cmmPage} of {cmmTotalPages} ({cmmTotal.toLocaleString()} total items)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={cmmPage <= 1}
                    onClick={() => setCmmPage((p) => Math.max(1, p - 1))}
                    className="h-8 text-xs border-border"
                  >
                    Previous
                  </Button>
                  <span className="font-mono px-1">{cmmPage} / {cmmTotalPages}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={cmmPage >= cmmTotalPages}
                    onClick={() => setCmmPage((p) => Math.min(cmmTotalPages, p + 1))}
                    className="h-8 text-xs border-border"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB 3: CPSE Demand Comparison */}
          <TabsContent value="cpse_comparison" className="space-y-4">
            {/* Recharts CPSE Volume Comparison Chart */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Comparative Physical Consumption Volume by CPSE (Conserved UOMs)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cpseSummaries.map((c) => ({
                      cpse: c.source_cpse,
                      nos: c.total_volume_nos,
                      mtr: c.total_volume_mtr,
                    }))}>
                      <XAxis dataKey="cpse" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                      <Tooltip
                        cursor={false}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        formatter={(val: number, name: string) => [`${val.toLocaleString()} ${name.toUpperCase()}`, name.toUpperCase()]}
                      />
                      <Legend />
                      <Bar dataKey="nos" name="NOS Volume" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="mtr" name="MTR Volume" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {cpseSummaries.map((cpse) => (
                <Card key={cpse.source_cpse} className="border-border bg-card">
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div className="text-xl font-extrabold text-foreground">{cpse.source_cpse}</div>
                      <Badge variant="outline" className="font-mono text-xs">
                        {cpse.total_material_records} Items
                      </Badge>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">
                        Consumption Volume By UOM
                      </div>
                      <div className="flex justify-between font-mono bg-muted/30 px-2 py-1 rounded">
                        <span>NOS Volume:</span>
                        <span className="font-bold">{cpse.total_volume_nos.toLocaleString()} NOS</span>
                      </div>
                      <div className="flex justify-between font-mono bg-muted/30 px-2 py-1 rounded">
                        <span>MTR Volume:</span>
                        <span className="font-bold">{cpse.total_volume_mtr.toLocaleString()} MTR</span>
                      </div>
                      <div className="flex justify-between font-mono bg-muted/30 px-2 py-1 rounded">
                        <span>SET Volume:</span>
                        <span className="font-bold">{cpse.total_volume_set.toLocaleString()} SET</span>
                      </div>
                      <div className="flex justify-between font-mono bg-muted/30 px-2 py-1 rounded">
                        <span>Other Volume:</span>
                        <span className="font-bold">{cpse.total_volume_other.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="border-t border-border pt-3 space-y-1 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Active Materials:</span>
                        <span className="font-medium text-foreground">{cpse.active_material_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Inactive Materials:</span>
                        <span className="font-medium text-foreground">{cpse.inactive_material_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Operating Plants:</span>
                        <span className="font-medium text-foreground">{cpse.distinct_plants_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Distinct OEMs:</span>
                        <span className="font-medium text-foreground">{cpse.distinct_manufacturers_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Multi-CPSE Members:</span>
                        <span className={`font-medium ${cpse.multi_cpse_harmonized_members > 0 ? 'text-emerald-500 font-bold' : ''}`}>
                          {cpse.multi_cpse_harmonized_members}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Comparative Explanatory Panel */}
            <div className="p-4 rounded-lg bg-card border border-border space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldAlert className="h-4 w-4 text-primary" />
                Physical Volume Conservation Governance
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                All physical consumption metrics are partitioned strictly by individual Unit of Measure (UOM).
                In accordance with physical conservation standards, quantities of disparate units (NOS, MTR, SET, KG, LTR)
                are never summed together. Volume conservation holds identically across granular facts, CPSE enterprise summaries,
                and Common Material Master records.
              </p>
            </div>
          </TabsContent>

          {/* TAB 4: Facility & Plant Distribution */}
          <TabsContent value="plants" className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card p-3 rounded-lg border border-border">
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <div className="relative w-full sm:w-[260px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search plant or refinery name..."
                    value={plantSearch}
                    onChange={(e) => setPlantSearch(e.target.value)}
                    className="pl-8 h-9 text-xs"
                  />
                </div>

                <Select value={plantUomFilter} onValueChange={setPlantUomFilter}>
                  <SelectTrigger className="w-[140px] h-9 text-xs">
                    <SelectValue placeholder="Filter Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Units</SelectItem>
                    <SelectItem value="NOS">NOS</SelectItem>
                    <SelectItem value="MTR">MTR</SelectItem>
                    <SelectItem value="SET">SET</SelectItem>
                    <SelectItem value="KG">KG</SelectItem>
                    <SelectItem value="LTR">LTR</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="text-xs text-muted-foreground w-full sm:w-auto text-right">
                Showing {filteredPlants.length} plant-unit consumption records
              </div>
            </div>

            {/* Plant Volume Recharts Chart */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Factory className="h-4 w-4 text-primary" />
                  Facility Annual Volume Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredPlants.slice(0, 8).map((p) => ({
                      name: p.plant,
                      volume: p.total_volume,
                      uom: p.unit_of_measure,
                    }))}>
                      <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={45} />
                      <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                      <Tooltip
                        cursor={false}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        formatter={(val: number, _name: string, item: { payload: { uom: string } }) => [`${val.toLocaleString()} ${item.payload.uom}`, 'Annual Volume']}
                      />
                      <Bar dataKey="volume" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Plant Distribution Table */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto w-full">
                <Table className="min-w-[650px]">
                  <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Operating Plant / Refinery</TableHead>
                    <TableHead className="w-[140px]">Parent CPSE</TableHead>
                    <TableHead className="w-[120px]">Unit of Measure</TableHead>
                    <TableHead className="w-[140px] text-right">Material Count</TableHead>
                    <TableHead className="w-[180px] text-right">Total Annual Volume</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                        No plant distribution records found matching criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPlants.map((p, idx) => (
                      <TableRow key={`${p.plant}-${p.unit_of_measure}-${idx}`} className="hover:bg-muted/20">
                        <TableCell className="font-semibold text-xs py-3 text-foreground">
                          {p.plant || 'Enterprise General / Unspecified'}
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            {p.source_cpse}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono font-semibold text-xs py-3">
                          {p.unit_of_measure}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-right py-3">
                          {p.material_count.toLocaleString()} items
                        </TableCell>
                        <TableCell className="font-mono font-bold text-xs text-right py-3 text-primary">
                          {p.total_volume.toLocaleString()} {p.unit_of_measure}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* CMM Drill-Down Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="w-[95vw] sm:max-w-5xl max-h-[88vh] overflow-y-auto p-5 sm:p-6 rounded-xl border border-border/80 bg-card shadow-2xl">
            <DialogHeader className="space-y-3 border-b border-border/80 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shrink-0">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold font-mono text-emerald-400 flex items-center gap-2">
                      {selectedCmm?.cmm_code}
                    </DialogTitle>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 font-medium">
                        Family: {selectedCmm?.material_family}
                      </span>
                      <span className="text-muted-foreground/60">&bull;</span>
                      <span className="text-muted-foreground font-mono text-[11px]">{selectedCmm?.governance_status}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedCmm && selectedCmm.cpse_count >= 2 ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      Multi-CPSE ({selectedCmm.cpse_count} Enterprises)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono border border-border/60 bg-muted/40 text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
                      Standalone Enterprise
                    </span>
                  )}
                </div>
              </div>

              {selectedCmm && (
                <div className="p-3 rounded-lg bg-muted/40 border border-border/70 text-slate-100 text-xs font-medium leading-relaxed">
                  {selectedCmm.common_description}
                </div>
              )}
            </DialogHeader>

            {modalLoading || !selectedCmm ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                <span>Loading CMM specifications and legacy members...</span>
              </div>
            ) : (
              <div className="space-y-5 pt-2 text-xs">
                {/* 4 Themed Summary Stat Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.04] space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/80 block">
                      Total Demand Volume
                    </span>
                    <div className="text-lg font-bold font-mono text-emerald-400 tabular-nums">
                      {selectedCmm.total_annual_consumption.toLocaleString()} <span className="text-xs text-emerald-400/70 font-medium">{selectedCmm.primary_uom}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Across {selectedCmm.member_count} catalog item{selectedCmm.member_count === 1 ? '' : 's'}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-sky-500/25 bg-sky-500/[0.04] space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-400/80 block">
                      Consuming Enterprises
                    </span>
                    <div className="text-lg font-bold text-sky-300">
                      {selectedCmm.cpse_count} Enterprise{selectedCmm.cpse_count === 1 ? '' : 's'}
                    </div>
                    <div className="text-[11px] text-sky-200/70 truncate" title={selectedCmm.consuming_cpses.replace(/;/g, ', ')}>
                      {selectedCmm.consuming_cpses.replace(/;/g, ', ')}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-indigo-500/25 bg-indigo-500/[0.04] space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400/80 block">
                      Dominant Facility
                    </span>
                    <div className="text-lg font-bold text-indigo-300 truncate" title={selectedCmm.dominant_plant || 'Unspecified'}>
                      {selectedCmm.dominant_plant || 'Unspecified'}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Active across {selectedCmm.plant_count} plant{selectedCmm.plant_count === 1 ? '' : 's'}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.04] space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/80 block">
                      Purchase Recency
                    </span>
                    <div className="text-lg font-bold font-mono text-amber-400">
                      {selectedCmm.purchase_recency_days !== undefined && selectedCmm.purchase_recency_days !== null
                        ? `${selectedCmm.purchase_recency_days} days`
                        : '—'}
                    </div>
                    <div className="text-[11px] text-amber-300/70">
                      Latest: {selectedCmm.latest_purchase_date || 'No date recorded'}
                    </div>
                  </div>
                </div>

                {/* Sourcing Signals / Opportunities (if any) */}
                {selectedCmm.opportunities && selectedCmm.opportunities.length > 0 && (
                  <div className="space-y-2">
                    <div className="font-semibold text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                      <span>Detected Joint Sourcing Signals ({selectedCmm.opportunities.length})</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {selectedCmm.opportunities.map((opp, idx) => (
                        <div key={opp.opportunity_id || idx} className="p-3 rounded-lg border border-border/80 bg-muted/40 space-y-1.5 hover:border-border transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-xs text-slate-100">
                              {getSignalLabel(opp.opportunity_type)}
                            </span>
                            <span className="font-mono text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded">
                              {opp.threshold}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {opp.reason}
                          </p>
                          <div className="text-[10px] font-mono text-muted-foreground/70 truncate">
                            Evidence: {opp.evidence_reference}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contributing Legacy Source Materials Table */}
                <div className="space-y-2">
                  <div className="font-semibold text-foreground text-xs uppercase tracking-wider flex items-center justify-between">
                    <span>Contributing CPSE Catalog Items ({selectedCmm.members?.length || 0})</span>
                    <span className="text-[11px] font-normal text-muted-foreground">
                      100% deterministic traceability to source ERP catalogs
                    </span>
                  </div>

                  <div className="rounded-lg border border-border overflow-hidden bg-card">
                    <div className="overflow-x-auto">
                      <Table className="min-w-[850px] text-xs">
                        <TableHeader>
                          <TableRow className="bg-muted/40 hover:bg-muted/40 border-border text-xs">
                            <TableHead className="w-[100px] font-semibold text-foreground">CPSE</TableHead>
                            <TableHead className="w-[140px] font-semibold text-foreground">Material Code</TableHead>
                            <TableHead className="min-w-[220px] font-semibold text-foreground">ERP Source Description</TableHead>
                            <TableHead className="w-[160px] font-semibold text-foreground">Plant / Facility</TableHead>
                            <TableHead className="w-[130px] text-right font-semibold text-foreground">Annual Volume</TableHead>
                            <TableHead className="w-[140px] font-semibold text-foreground">Manufacturer</TableHead>
                            <TableHead className="w-[90px] text-center font-semibold text-foreground">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(!selectedCmm.members || selectedCmm.members.length === 0) ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                No legacy member records associated with this CMM entity.
                              </TableCell>
                            </TableRow>
                          ) : (
                            selectedCmm.members.map((m) => (
                              <TableRow key={m.fact_id} className="hover:bg-muted/25 border-border/50 text-xs">
                                <TableCell className="py-3 align-middle">
                                  <span className="inline-block px-2 py-0.5 rounded border border-sky-500/25 bg-sky-500/10 text-sky-300 font-mono text-[10px] font-semibold">
                                    {m.source_cpse}
                                  </span>
                                </TableCell>
                                <TableCell className="font-mono text-xs font-semibold py-3 align-middle text-emerald-400">
                                  {m.material_code}
                                </TableCell>
                                <TableCell className="py-3 align-middle">
                                  <div className="font-medium text-slate-100 text-xs leading-snug" title={m.material_description}>
                                    {m.material_description}
                                  </div>
                                  {m.material_type && (
                                    <div className="text-[10px] font-mono text-indigo-300/80 mt-0.5">
                                      Type: {m.material_type}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="py-3 align-middle text-muted-foreground text-xs">
                                  {m.plant || '—'}
                                </TableCell>
                                <TableCell className="font-mono text-xs font-bold text-emerald-400 py-3 align-middle text-right tabular-nums">
                                  {m.annual_consumption.toLocaleString()} <span className="text-emerald-400/70 text-[10px]">{m.unit_of_measure}</span>
                                </TableCell>
                                <TableCell className="py-3 align-middle">
                                  <div className="font-medium text-slate-200 text-xs">{m.manufacturer || '—'}</div>
                                  {m.manufacturer_part_no && (
                                    <div className="text-[10px] font-mono text-muted-foreground/80 mt-0.5 truncate max-w-[130px]" title={m.manufacturer_part_no}>
                                      {m.manufacturer_part_no}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-center py-3 align-middle">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono border ${
                                      m.material_status.toLowerCase() === 'active'
                                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-medium'
                                        : 'border-amber-500/30 bg-amber-500/10 text-amber-400 font-medium'
                                    }`}
                                  >
                                    {m.material_status}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
