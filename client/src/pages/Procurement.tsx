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

  const getOppBadge = (type: string) => {
    switch (type) {
      case 'MULTI_CPSE_DEMAND_AGGREGATION':
        return <Badge className="bg-emerald-600 text-white font-mono text-[11px]">MULTI-CPSE AGGREGATION</Badge>;
      case 'HIGH_VOLUME_CONCENTRATION':
        return <Badge className="bg-amber-600 text-white font-mono text-[11px]">HIGH-VOLUME (P95)</Badge>;
      case 'PURCHASE_DORMANCY_SIGNAL':
        return <Badge className="bg-rose-600 text-white font-mono text-[11px]">DORMANCY SIGNAL</Badge>;
      case 'MANUFACTURER_DIVERSITY_SIGNAL':
        return <Badge className="bg-blue-600 text-white font-mono text-[11px]">OEM DIVERSITY</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
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
              <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                <span>Active: {kpis ? kpis.active_materials_count : '—'}</span>
                <span>Inactive: {kpis ? kpis.inactive_materials_count : '—'}</span>
                <span>({kpis ? kpis.active_materials_pct : '—'}%)</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">CMM Master Entities</span>
                <Layers className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-3xl font-extrabold text-foreground mt-2">
                {kpis ? kpis.total_cmm_entities.toLocaleString() : '—'}
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                <span className="text-emerald-500 font-medium">Multi-CPSE: {kpis?.multi_cpse_cmms_count ?? '—'}</span>
                <span>Standalone: {kpis?.standalone_cmms_count ?? '—'}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Physical Volumes (Per UOM)</span>
                <Package className="h-4 w-4 text-blue-500" />
              </div>
              <div className="mt-2 space-y-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">NOS:</span>
                  <span className="font-mono">{kpis?.volume_by_uom?.NOS ? kpis.volume_by_uom.NOS.toLocaleString() : '—'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">MTR:</span>
                  <span className="font-mono">{kpis?.volume_by_uom?.MTR ? kpis.volume_by_uom.MTR.toLocaleString() : '—'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">LTR:</span>
                  <span className="font-mono">{kpis?.volume_by_uom?.LTR ? kpis.volume_by_uom.LTR.toLocaleString() : '—'}</span>
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
                <Sparkles className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-3xl font-extrabold text-amber-500 mt-2">
                {kpis ? kpis.total_opportunities_count : '—'}
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                <span>P95 Conc: {kpis?.opportunities_by_type?.HIGH_VOLUME_CONCENTRATION ?? '—'}</span>
                <span>Multi-CPSE: {kpis?.opportunities_by_type?.MULTI_CPSE_DEMAND_AGGREGATION ?? '—'}</span>
                <span>OEM Div: {kpis?.opportunities_by_type?.MANUFACTURER_DIVERSITY_SIGNAL ?? '—'}</span>
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
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto w-full">
                <Table className="min-w-[850px]">
                  <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-[220px]">Signal Type</TableHead>
                    <TableHead className="w-[180px]">CMM Code</TableHead>
                    <TableHead className="w-[140px]">Consuming CPSEs</TableHead>
                    <TableHead className="w-[140px]">Trigger Metric</TableHead>
                    <TableHead className="w-[140px]">Observed Value</TableHead>
                    <TableHead className="w-[140px]">Rule Threshold</TableHead>
                    <TableHead>Explainable Provenance & Evidence</TableHead>
                    <TableHead className="w-[100px] text-right">Drill-Down</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opportunities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                        No sourcing signals found matching the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    opportunities.map((opp) => (
                      <TableRow key={opp.opportunity_id} className="hover:bg-muted/20">
                        <TableCell className="align-top py-3">
                          {getOppBadge(opp.opportunity_type)}
                          <div className="font-mono text-[10px] text-muted-foreground mt-1 truncate" title={opp.opportunity_id}>
                            ID: {opp.opportunity_id.substring(0, 16)}...
                          </div>
                        </TableCell>
                        <TableCell className="align-top font-mono font-semibold text-xs py-3 text-primary">
                          {opp.cmm_code}
                        </TableCell>
                        <TableCell className="align-top py-3">
                          <div className="flex flex-wrap gap-1">
                            {opp.source_cpses.split(';').map((c) => (
                              <Badge key={c} variant="secondary" className="text-[10px] px-1.5 py-0">
                                {c}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="align-top font-mono text-xs text-muted-foreground py-3">
                          {opp.trigger_metric}
                        </TableCell>
                        <TableCell className="align-top font-mono font-semibold text-xs py-3">
                          {opp.trigger_value}
                        </TableCell>
                        <TableCell className="align-top font-mono text-xs text-muted-foreground py-3">
                          {opp.threshold}
                        </TableCell>
                        <TableCell className="align-top py-3">
                          <div className="text-xs text-foreground font-medium">{opp.reason}</div>
                          <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                            Ref: {opp.evidence_reference}
                          </div>
                        </TableCell>
                        <TableCell className="align-top text-right py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={() => handleOpenCmmDetail(opp.cmm_code)}
                          >
                            Explore <ArrowRight className="h-3 w-3" />
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
            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card p-3 rounded-lg border border-border">
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <div className="relative w-full sm:w-[260px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search CMM code, description, plant..."
                    value={cmmSearch}
                    onChange={(e) => { setCmmSearch(e.target.value); setCmmPage(1); }}
                    className="pl-8 h-9 text-xs"
                  />
                </div>

                <Select value={cmmFamilyFilter} onValueChange={(v) => { setCmmFamilyFilter(v); setCmmPage(1); }}>
                  <SelectTrigger className="w-[140px] h-9 text-xs">
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
                  </SelectContent>
                </Select>

                <Select value={cmmUomFilter} onValueChange={(v) => { setCmmUomFilter(v); setCmmPage(1); }}>
                  <SelectTrigger className="w-[120px] h-9 text-xs">
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
                  <SelectTrigger className="w-[120px] h-9 text-xs">
                    <SelectValue placeholder="CPSE" />
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
                Showing {cmmSummaries.length} of {cmmTotal} CMM records
              </div>
            </div>

            {/* CMM Summaries Table */}
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto w-full">
                <Table className="min-w-[850px]">
                  <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-[180px]">CMM Code</TableHead>
                    <TableHead>Common Description</TableHead>
                    <TableHead className="w-[130px]">Classification</TableHead>
                    <TableHead className="w-[120px]">CPSEs</TableHead>
                    <TableHead className="w-[130px]">Annual Volume</TableHead>
                    <TableHead className="w-[130px]">Dominant Plant</TableHead>
                    <TableHead className="w-[140px]">Purchase Recency</TableHead>
                    <TableHead className="w-[100px]">OEM Diversity</TableHead>
                    <TableHead className="w-[80px] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cmmSummaries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                        No CMM demand records found matching criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    cmmSummaries.map((c) => (
                      <TableRow key={c.cmm_code} className="hover:bg-muted/20">
                        <TableCell className="font-mono font-semibold text-xs py-3 text-primary">
                          {c.cmm_code}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="text-xs font-medium text-foreground line-clamp-1">
                            {c.common_description}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            Family: {c.material_family} | Status: {c.governance_status}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          {c.cpse_count >= 2 ? (
                            <Badge className="bg-emerald-600 text-white text-[10px] font-mono">
                              Multi-CPSE ({c.cpse_count})
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                              Standalone
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex flex-wrap gap-1">
                            {c.consuming_cpses.split(';').map((cpse) => (
                              <Badge key={cpse} variant="secondary" className="text-[10px] px-1.5 py-0">
                                {cpse}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold py-3">
                          {c.total_annual_consumption.toLocaleString()} {c.primary_uom}
                          {c.member_count > 1 && (
                            <div className="text-[10px] font-normal text-muted-foreground">
                              Avg: {c.avg_consumption_per_member.toLocaleString()} / member
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs py-3">
                          <span className="font-medium text-foreground">{c.dominant_plant || '—'}</span>
                          {c.plant_count > 1 && (
                            <div className="text-[10px] text-muted-foreground">({c.plant_count} plants)</div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-mono py-3">
                          {c.purchase_recency_days !== undefined && c.purchase_recency_days !== null ? (
                            <div>
                              <span className="font-medium">{c.purchase_recency_days} days</span>
                              <div className="text-[10px] text-muted-foreground">{c.latest_purchase_date}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No date</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          {c.manufacturer_diversity_flag ? (
                            <Badge className="bg-blue-600 text-white text-[10px]">
                              {c.unique_manufacturers_count} OEMs
                            </Badge>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">
                              {c.unique_manufacturers_count || 1} OEM
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleOpenCmmDetail(c.cmm_code)}
                          >
                            Details
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
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <div>Page {cmmPage} of {cmmTotalPages}</div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={cmmPage <= 1}
                    onClick={() => setCmmPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={cmmPage >= cmmTotalPages}
                    onClick={() => setCmmPage((p) => Math.min(cmmTotalPages, p + 1))}
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
          <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[85vh] overflow-y-auto p-4 sm:p-6 rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-mono">
                <Layers className="h-5 w-5 text-primary" />
                {selectedCmm?.cmm_code}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Governed Common Material Master details and contributing legacy source materials
              </DialogDescription>
            </DialogHeader>

            {modalLoading || !selectedCmm ? (
              <div className="py-12 text-center text-xs text-muted-foreground">Loading CMM details...</div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Master Summary Card */}
                <div className="p-4 rounded-lg bg-muted/40 border border-border space-y-3">
                  <div className="text-sm font-semibold text-foreground">
                    {selectedCmm.common_description}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-muted-foreground">
                    <div>
                      <span className="block text-[10px] uppercase font-semibold">Material Family</span>
                      <span className="font-mono text-foreground">{selectedCmm.material_family}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-semibold">Governance Status</span>
                      <span className="font-mono text-foreground">{selectedCmm.governance_status}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-semibold">Total Consumption</span>
                      <span className="font-mono font-bold text-foreground">
                        {selectedCmm.total_annual_consumption.toLocaleString()} {selectedCmm.primary_uom}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-semibold">Purchase Recency</span>
                      <span className="font-mono text-foreground">
                        {selectedCmm.purchase_recency_days !== undefined && selectedCmm.purchase_recency_days !== null
                          ? `${selectedCmm.purchase_recency_days} days to 2026-03-31`
                          : 'No purchase date'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Legacy Members Table */}
                <div className="space-y-2">
                  <div className="font-semibold text-foreground text-xs uppercase tracking-wider">
                    Contributing Legacy Materials ({selectedCmm.members?.length || 0})
                  </div>
                  <div className="rounded border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="w-[100px]">CPSE</TableHead>
                          <TableHead className="w-[130px]">Material Code</TableHead>
                          <TableHead>Legacy Description</TableHead>
                          <TableHead className="w-[130px]">Plant</TableHead>
                          <TableHead className="w-[110px]">Consumption</TableHead>
                          <TableHead className="w-[80px]">Status</TableHead>
                          <TableHead className="w-[120px]">Manufacturer</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedCmm.members?.map((m) => (
                          <TableRow key={m.fact_id}>
                            <TableCell className="font-mono font-semibold">{m.source_cpse}</TableCell>
                            <TableCell className="font-mono text-primary">{m.material_code}</TableCell>
                            <TableCell className="line-clamp-1">{m.material_description}</TableCell>
                            <TableCell>{m.plant}</TableCell>
                            <TableCell className="font-mono font-semibold">
                              {m.annual_consumption.toLocaleString()} {m.unit_of_measure}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={m.material_status.toLowerCase() === 'active' ? 'default' : 'secondary'}
                                className="text-[10px]"
                              >
                                {m.material_status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-[11px] truncate max-w-[120px]" title={m.manufacturer}>
                              {m.manufacturer || '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
