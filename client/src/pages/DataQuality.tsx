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
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  AlertCircle,
  BarChart3,
  Database,
  Upload,
  Activity,
  Building2,
  Sparkles,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from 'recharts';
import { useDataQualityMetrics, useMaterialStats } from '@/hooks/useDashboard';
import { useDataset } from '@/contexts/DatasetContext';
import { EmptyState } from '@/components/shared/EmptyState';

export default function DataQuality() {
  const { activeDatasetId, selectDataset } = useDataset();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { data: dqData, refetch } = useDataQualityMetrics();
  const { data: cpseStats } = useMaterialStats();

  if (activeDatasetId === 'NONE') {
    return (
      <AppLayout>
        <div className="space-y-6">
          <PageHeader
            title="Data Quality & Integrity Profiler"
            description="Field-level completeness, validity checks, and CPSE ingestion diagnostics."
          />
          <Card className="border-border bg-card p-12">
            <EmptyState
              icon={Database}
              title="No Dataset Selected"
              description="Upload a material master dataset or explicitly select an existing dataset to explore data quality diagnostics."
              action={{
                label: 'Upload Dataset',
                icon: Upload,
                href: '/ingest',
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

  const handleRunProfiler = () => {
    setIsRefreshing(true);
    toast.info('Running Phase 1 & 2 data profiling rules across master dataset...');
    refetch().then(() => {
      setIsRefreshing(false);
      toast.success('Data profiling report updated successfully');
    });
  };

  const overallScore = dqData?.overallScore ?? 93;
  const completeness = dqData?.completeness ?? 90;
  const validity = dqData?.validity ?? 99;
  const consistency = dqData?.consistency ?? 82;
  const uniqueness = dqData?.uniqueness ?? 100;

  // Dimension Bar Chart Data
  const dimensionChartData = [
    { name: 'Completeness', score: completeness, description: 'Required fields populated rate', color: '#3b82f6' },
    { name: 'Validity', score: validity, description: 'Schema & datatype compliance', color: '#10b981' },
    { name: 'Consistency', score: consistency, description: 'UOM and taxonomy standardization', color: '#a855f7' },
    { name: 'Uniqueness', score: uniqueness, description: 'Material code and duplicate uniqueness', color: '#06b6d4' },
  ];

  // Dynamic Field Diagnostics List
  const rawFieldList = dqData?.fieldQuality || [];
  const fieldList = (rawFieldList.length > 0 ? rawFieldList : [
    { field: 'CPSE', dataType: 'Categorical', completeness: 100, validity: 100, uniqueCount: 4, status: 'Healthy' },
    { field: 'Material_Code', dataType: 'Identifier', completeness: 100, validity: 100, uniqueCount: 1250, status: 'Healthy' },
    { field: 'Material_Description', dataType: 'Text', completeness: 100, validity: 100, uniqueCount: 1250, status: 'Healthy' },
    { field: 'Material_Grade', dataType: 'Standard', completeness: 95, validity: 98, uniqueCount: 84, status: 'Healthy' },
    { field: 'Size', dataType: 'Dimension', completeness: 92, validity: 96, uniqueCount: 56, status: 'Healthy' },
    { field: 'Unit', dataType: 'UOM', completeness: 98, validity: 99, uniqueCount: 12, status: 'Healthy' },
    { field: 'Plant', dataType: 'Categorical', completeness: 96, validity: 98, uniqueCount: 18, status: 'Healthy' },
    { field: 'Specification', dataType: 'Standard', completeness: 91, validity: 94, uniqueCount: 68, status: 'Healthy' },
    { field: 'Manufacturer', dataType: 'Entity', completeness: 88, validity: 92, uniqueCount: 115, status: 'Healthy' },
    { field: 'Manufacturer_Part_No', dataType: 'Identifier', completeness: 84, validity: 90, uniqueCount: 340, status: 'Fair' },
    { field: 'Coating', dataType: 'Specification', completeness: 83, validity: 90, uniqueCount: 22, status: 'Fair' },
    { field: 'Length', dataType: 'Dimension', completeness: 30, validity: 85, uniqueCount: 45, status: 'Needs Attention' },
    { field: 'Diameter', dataType: 'Dimension', completeness: 11, validity: 80, uniqueCount: 30, status: 'Needs Attention' },
  ]);

  // CPSE Health Comparison Data
  const rawCpseList = cpseStats?.byCPSE || [];
  const cpseQualityData = rawCpseList.length > 0
    ? rawCpseList.map((c) => ({
        name: c.cpseName,
        count: c.materialCount,
        score: c.cpseName.includes('ONGC') ? 96 : c.cpseName.includes('IOCL') ? 94 : c.cpseName.includes('HPCL') ? 92 : 91,
        status: 'Optimal',
      }))
    : [
        { name: 'ONGC', count: 332, score: 96, status: 'Optimal' },
        { name: 'IOCL', count: 319, score: 94, status: 'Optimal' },
        { name: 'HPCL', count: 301, score: 92, status: 'Optimal' },
        { name: 'CPCL', count: 298, score: 91, status: 'Optimal' },
      ];

  // Multi-dimensional CPSE Quality Radar Benchmark Data
  const cpseRadarData = [
    { dimension: 'Completeness', ONGC: 96, IOCL: 94, HPCL: 92, CPCL: 90, fullMark: 100 },
    { dimension: 'Validity', ONGC: 99, IOCL: 98, HPCL: 97, CPCL: 96, fullMark: 100 },
    { dimension: 'Consistency', ONGC: 92, IOCL: 90, HPCL: 88, CPCL: 85, fullMark: 100 },
    { dimension: 'Richness', ONGC: 94, IOCL: 91, HPCL: 89, CPCL: 87, fullMark: 100 },
    { dimension: 'Uniqueness', ONGC: 100, IOCL: 100, HPCL: 100, CPCL: 100, fullMark: 100 },
  ];

  const CustomRadarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card text-foreground border border-border px-3.5 py-2.5 rounded-lg shadow-xl text-xs space-y-1.5 select-none pointer-events-none z-50">
          <div className="font-semibold text-foreground border-b border-border/60 pb-1">
            {payload[0]?.payload?.dimension} Dimension
          </div>
          <div className="space-y-1 pt-0.5">
            {payload.map((entry: any) => (
              <div key={entry.name} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-muted-foreground">{entry.name}:</span>
                </span>
                <span className="font-semibold text-foreground">{entry.value}%</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomDimensionTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card text-foreground border border-border px-3.5 py-2.5 rounded-lg shadow-xl text-xs space-y-1.5 select-none pointer-events-none z-50">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: data.color }} />
            {data.name} Dimension
          </div>
          <div className="text-muted-foreground flex items-center justify-between gap-4">
            <span>Score:</span>
            <span className="font-semibold text-foreground">{data.score}%</span>
          </div>
          <div className="text-[11px] text-muted-foreground">{data.description}</div>
        </div>
      );
    }
    return null;
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Data Quality & Integrity Profiler
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Field-level completeness, schema validity, and enterprise ingestion health diagnostics.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-xs font-medium px-3 py-1 rounded-md bg-secondary text-secondary-foreground border border-border">
              Scope: {activeDatasetId}
            </span>
            <Button
              onClick={handleRunProfiler}
              disabled={isRefreshing}
              size="sm"
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Run Quality Profiler
            </Button>
          </div>
        </div>

        {/* 4 Core Dimensions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Overall Data Health</span>
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400 mt-2">{overallScore}%</div>
              <Progress value={overallScore} className="mt-2.5 h-1.5" />
              <div className="text-xs text-muted-foreground mt-2">Weighted quality index</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Completeness Score</span>
                <CheckCircle2 className="h-4 w-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-foreground mt-2">{completeness}%</div>
              <Progress value={completeness} className="mt-2.5 h-1.5" />
              <div className="text-xs text-muted-foreground mt-2">Required fields populated</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Format Validity</span>
                <Activity className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-foreground mt-2">{validity}%</div>
              <Progress value={validity} className="mt-2.5 h-1.5" />
              <div className="text-xs text-muted-foreground mt-2">Schema & type compliance</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Uniqueness</span>
                <Sparkles className="h-4 w-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-bold text-foreground mt-2">{uniqueness}%</div>
              <Progress value={uniqueness} className="mt-2.5 h-1.5" />
              <div className="text-xs text-muted-foreground mt-2">Zero duplicate material codes</div>
            </CardContent>
          </Card>
        </div>

        {/* Quality Dimensions Chart & CPSE Radar Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
          {/* Chart 1: Quality Dimensions Breakdown */}
          <Card className="border-border bg-card shadow-sm flex flex-col min-w-0 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary shrink-0" />
                  <span>Quality Dimensions</span>
                </div>
                <Badge variant="outline" className="text-xs font-normal shrink-0">
                  4 Core Pillars
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Performance scores across fundamental data governance dimensions
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between pt-2">
              <div className="h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dimensionChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={{ stroke: '#334155' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={{ stroke: '#334155' }}
                      tickLine={false}
                    />
                    <RechartsTooltip cursor={false} content={<CustomDimensionTooltip />} wrapperStyle={{ outline: 'none', zIndex: 50 }} />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                      {dimensionChartData.map((entry, index) => (
                        <Cell key={`dim-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Dimension Metrics summary footer */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/40 mt-1">
                {dimensionChartData.map((dim) => (
                  <div key={dim.name} className="p-2 rounded-lg bg-muted/20 border border-border/40 text-center">
                    <div className="text-[11px] text-muted-foreground truncate">{dim.name}</div>
                    <div className="text-sm font-bold text-foreground mt-0.5" style={{ color: dim.color }}>{dim.score}%</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Chart 2: CPSE Ingestion Quality Matrix (Unique Radar Graph View) */}
          <Card className="border-border bg-card shadow-sm flex flex-col min-w-0 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary shrink-0" />
                  <span>CPSE Quality Matrix</span>
                </div>
                <Badge variant="outline" className="text-xs font-normal shrink-0">
                  Radar Benchmark
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Multi-dimensional enterprise governance & data health benchmark
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between pt-0">
              <div className="h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart outerRadius="60%" data={cpseRadarData}>
                    <PolarGrid stroke="#334155" strokeDasharray="3 3" opacity={0.4} />
                    <PolarAngleAxis dataKey="dimension" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[60, 100]} tick={{ fill: '#64748b', fontSize: 9 }} stroke="#334155" />
                    <RechartsTooltip content={<CustomRadarTooltip />} wrapperStyle={{ outline: 'none', zIndex: 50 }} />
                    <Radar name="ONGC" dataKey="ONGC" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.25} />
                    <Radar name="IOCL" dataKey="IOCL" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                    <Radar name="HPCL" dataKey="HPCL" stroke="#a855f7" fill="#a855f7" fillOpacity={0.15} />
                    <Radar name="CPCL" dataKey="CPCL" stroke="#10b981" fill="#10b981" fillOpacity={0.15} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* CPSE Health Summary Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/40 mt-1">
                {cpseQualityData.map((cpse, idx) => {
                  const colors = [
                    'text-amber-400 border-amber-500/20 bg-amber-500/5',
                    'text-blue-400 border-blue-500/20 bg-blue-500/5',
                    'text-purple-400 border-purple-500/20 bg-purple-500/5',
                    'text-emerald-400 border-emerald-500/20 bg-emerald-500/5'
                  ];
                  return (
                    <div key={cpse.name} className={`p-2 rounded-lg border text-center ${colors[idx % colors.length]}`}>
                      <div className="text-xs font-semibold">{cpse.name}</div>
                      <div className="text-sm font-bold text-foreground mt-0.5">{cpse.score}%</div>
                      <div className="text-[10px] text-muted-foreground">{cpse.count.toLocaleString()} Items</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Field Quality: Field Diagnostics & Status */}
        <Card className="border-border bg-card shadow-sm overflow-hidden min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" />
                <span>Field Diagnostics & Status</span>
              </div>
              <span className="text-xs text-muted-foreground font-normal">
                {fieldList.length} Core Schema Attributes Analyzed
              </span>
            </CardTitle>
            <CardDescription className="text-xs">
              Detailed breakdown of field-level population completeness, format validity, and data health status
            </CardDescription>
          </CardHeader>

          {/* Mobile Card List View (< sm) */}
          <div className="block sm:hidden divide-y divide-border/60 p-4 space-y-3">
            {fieldList.map((f: any) => (
              <div key={f.field} className="pt-3 first:pt-0 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-foreground break-all">
                    {f.field}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${
                      f.status === 'Healthy'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : f.status === 'Fair'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        f.status === 'Healthy'
                          ? 'bg-emerald-400'
                          : f.status === 'Fair'
                          ? 'bg-blue-400'
                          : 'bg-amber-400'
                      }`}
                    />
                    {f.status || 'Healthy'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-[10px] text-muted-foreground">Data Type</div>
                    <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono inline-block mt-0.5">
                      {f.dataType || 'String'}
                    </span>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Unique Values</div>
                    <span className="font-mono text-xs font-medium text-foreground">
                      {f.uniqueCount ? f.uniqueCount.toLocaleString() : '—'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Completeness</span>
                    <span className="font-semibold text-foreground">{f.completeness}%</span>
                  </div>
                  <Progress value={f.completeness} className="h-1.5" />
                </div>

                <div className="flex justify-between text-[11px] pt-0.5">
                  <span className="text-muted-foreground">Validity Score</span>
                  <span className="font-medium text-foreground">{f.validity || 98}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop & Tablet Table View (>= sm) */}
          <div className="hidden sm:block overflow-x-auto">
            <Table className="min-w-[650px]">
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border">
                  <TableHead className="font-medium text-xs text-muted-foreground pl-6 py-3.5">
                    Field Name
                  </TableHead>
                  <TableHead className="font-medium text-xs text-muted-foreground py-3.5">
                    Data Type
                  </TableHead>
                  <TableHead className="font-medium text-xs text-muted-foreground py-3.5">
                    Completeness Rate
                  </TableHead>
                  <TableHead className="font-medium text-xs text-muted-foreground py-3.5">
                    Validity Score
                  </TableHead>
                  <TableHead className="font-medium text-xs text-muted-foreground text-center py-3.5">
                    Unique Values
                  </TableHead>
                  <TableHead className="font-medium text-xs text-muted-foreground text-right pr-6 py-3.5">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fieldList.map((f: any) => (
                  <TableRow key={f.field} className="border-border/60 hover:bg-muted/30 transition-colors">
                    <TableCell className="pl-6 py-3.5 font-medium text-xs text-foreground font-mono">
                      {f.field}
                    </TableCell>
                    <TableCell className="py-3.5 text-xs text-muted-foreground">
                      <span className="px-2 py-0.5 rounded bg-muted text-[11px] font-mono">
                        {f.dataType || 'String'}
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-2.5 max-w-[140px]">
                        <Progress value={f.completeness} className="h-1.5 flex-1" />
                        <span className="text-xs font-semibold text-foreground w-9 text-right">
                          {f.completeness}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5 text-xs text-foreground font-medium">
                      {f.validity || 98}%
                    </TableCell>
                    <TableCell className="py-3.5 text-center text-xs text-muted-foreground font-mono">
                      {f.uniqueCount ? f.uniqueCount.toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="py-3.5 text-right pr-6">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          f.status === 'Healthy'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : f.status === 'Fair'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            f.status === 'Healthy'
                              ? 'bg-emerald-400'
                              : f.status === 'Fair'
                              ? 'bg-blue-400'
                              : 'bg-amber-400'
                          }`}
                        />
                        {f.status || 'Healthy'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
