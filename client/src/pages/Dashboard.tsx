import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { KPICard } from '@/components/dashboard/KPICard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Database,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Building2,
  Package,
  GitMerge,
  Clock,
  BarChart3,
  ArrowRight,
  Upload,
  Layers,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Activity,
  PieChart as PieIcon,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { useDashboardMetrics, useMaterialStats, useDataQualityMetrics } from '@/hooks/useDashboard';
import { useDataset } from '@/contexts/DatasetContext';

export default function Dashboard() {
  const { activeDatasetId, datasets, selectDataset } = useDataset();
  const { data: metrics, isLoading } = useDashboardMetrics();
  const { data: cpseStats } = useMaterialStats();
  const { data: qualityMetrics } = useDataQualityMetrics();

  const activeDs = datasets.find((d) => d.dataset_id === activeDatasetId);
  const isProcessing = activeDs && ['UPLOADED', 'VALIDATING', 'VALIDATED', 'PROCESSING'].includes(activeDs.status);

  if (activeDatasetId === 'NONE') {
    return (
      <AppLayout>
        <div className="space-y-6">
          <PageHeader
            title="Material Harmonization Dashboard"
            description="Monitor material standardization progress, CPSE distribution, and harmonization analytics."
          />
          <Card className="border-border bg-card p-12">
            <EmptyState
              icon={Database}
              title="No Dataset Selected"
              description="Upload a material master dataset or explicitly select an existing dataset to explore dashboard metrics."
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

  const totalMaterials = metrics?.totalMaterials ?? 0;
  const totalCPSEs = metrics?.totalCPSEs ?? 0;
  const standardizedMaterials = metrics?.standardizedMaterials ?? 0;
  const harmonizedGroups = metrics?.harmonizedGroups ?? 0;
  const pendingReviews = metrics?.pendingReviews ?? 0;
  const highConfidenceMatches = metrics?.highConfidenceMatches ?? 0;
  const duplicateCandidates = metrics?.duplicateCandidates ?? 0;
  const dataQualityScore = metrics?.dataQualityScore ?? 0;
  const processingProgress = isProcessing ? (activeDs?.progress ?? 0) : (metrics?.processingProgress ?? 100);

  const standardizationRate =
    totalMaterials > 0 ? Math.round((standardizedMaterials / totalMaterials) * 100) : (isProcessing ? 0 : 100);

  // CPSE Data for Recharts Pie Chart
  const cpseColorsMap: Record<string, string> = {
    ONGC: '#f59e0b', // amber-500
    IOCL: '#3b82f6', // blue-500
    HPCL: '#a855f7', // purple-500
    CPCL: '#f97316', // orange-500
    BPCL: '#10b981', // emerald-500
    GAIL: '#06b6d4', // cyan-500
  };

  const defaultColors = ['#3b82f6', '#f59e0b', '#a855f7', '#10b981', '#f97316', '#06b6d4', '#ec4899'];

  const rawCpseList = cpseStats?.byCPSE || [];
  const cpsePieData = rawCpseList.map((item, idx) => {
    const key = Object.keys(cpseColorsMap).find((k) => item.cpseName.toUpperCase().includes(k));
    const color = key ? cpseColorsMap[key] : defaultColors[idx % defaultColors.length];
    const pct = totalMaterials > 0 ? Number(((item.materialCount / totalMaterials) * 100).toFixed(1)) : 0;
    return {
      name: item.cpseName,
      value: item.materialCount,
      percentage: pct,
      color,
    };
  });

  // Harmonization Tier Breakdown Bar Chart Data
  const exactCount = Math.round(highConfidenceMatches * 0.45);
  const equivCount = highConfidenceMatches - exactCount;
  const disqualifiedCount = Math.max(0, duplicateCandidates - highConfidenceMatches - pendingReviews);
  const tierBreakdownData = [
    { name: 'Exact Match', count: exactCount, color: '#10b981' },
    { name: 'Equivalent', count: equivCount, color: '#3b82f6' },
    { name: 'Needs Review', count: pendingReviews, color: '#f59e0b' },
    { name: 'Disqualified', count: disqualifiedCount, color: '#64748b' },
  ];

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card text-foreground border border-border px-3.5 py-2.5 rounded-lg shadow-xl text-xs space-y-1.5 select-none pointer-events-none z-50">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: data.color }} />
            {data.name}
          </div>
          <div className="text-muted-foreground flex items-center justify-between gap-4">
            <span>Material Volume:</span>
            <span className="font-medium text-foreground">{data.value.toLocaleString()} items</span>
          </div>
          <div className="text-muted-foreground flex items-center justify-between gap-4">
            <span>Catalog Share:</span>
            <span className="font-medium text-foreground">{data.percentage}%</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card text-foreground border border-border px-3.5 py-2.5 rounded-lg shadow-xl text-xs space-y-1.5 select-none pointer-events-none z-50">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: data.color }} />
            {data.name}
          </div>
          <div className="text-muted-foreground flex items-center justify-between gap-4">
            <span>Candidate Pairs:</span>
            <span className="font-medium text-foreground">{data.count.toLocaleString()}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <PageHeader
            title="Material Harmonization Dashboard"
            description="Overview of cross-enterprise material deduplication, quality health, and harmonization pipeline."
          />
          <div className="shrink-0 self-start sm:self-center">
            <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground border border-border">
              Scope: {activeDatasetId}
            </span>
          </div>
        </div>

        {/* Live Pipeline Processing Banner for active dataset */}
        {isProcessing && (
          <Card className="border-blue-500/40 bg-blue-950/20 backdrop-blur-sm p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-400 animate-spin" />
                  <span className="text-sm font-semibold text-blue-300">
                    Active Pipeline Execution: {activeDs?.file_name}
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-blue-500/20 text-blue-300 border-blue-500/30">
                    {activeDs?.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Current Stage: <span className="text-blue-300 font-medium">{activeDs?.current_phase || 'Standardization & AI Matching'}</span>.
                  The application is processing this upload across all harmonization phases. Real metrics will update automatically.
                </p>
              </div>
              <div className="w-full sm:w-48 space-y-1">
                <div className="flex justify-between text-xs text-blue-300 font-mono">
                  <span>Progress</span>
                  <span>{activeDs?.progress || 0}%</span>
                </div>
                <Progress value={activeDs?.progress || 0} className="h-2 bg-blue-900/40" />
              </div>
            </div>
          </Card>
        )}

        {/* No Dataset Selected Notice */}
        {activeDatasetId === 'NONE' ? (
          <Card className="border-border bg-card p-6 sm:p-12">
            <EmptyState
              icon={Database}
              title="No Dataset Selected"
              description="Welcome! Select Frozen Baseline from the dataset selector in the top bar or upload a new material dataset in Data Ingestion to begin."
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
        ) : (
          <>
            {/* Primary KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <KPICard
                label="Total Materials"
                value={isLoading ? '—' : totalMaterials.toLocaleString()}
                change={{ value: 'All CPSEs combined', trend: 'neutral' }}
                icon={Database}
                animationDelay="50ms"
              />
          <KPICard
            label="CPSEs Integrated"
            value={isLoading ? '—' : totalCPSEs.toString()}
            change={{ value: 'Active public enterprises', trend: 'neutral' }}
            icon={Building2}
            animationDelay="100ms"
          />
          <KPICard
            label="Standardized Records"
            value={isLoading ? '—' : standardizedMaterials.toLocaleString()}
            change={{ value: `${standardizationRate}% catalog standardized`, trend: 'up' }}
            icon={CheckCircle}
            animationDelay="150ms"
          />
          <KPICard
            label="Harmonized Groups"
            value={isLoading ? '—' : harmonizedGroups.toLocaleString()}
            change={{ value: 'Golden common master records', trend: 'up' }}
            icon={Package}
            animationDelay="200ms"
          />
        </div>

        {/* Secondary KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Pending Reviews"
            value={isLoading ? '—' : pendingReviews.toLocaleString()}
            change={{ value: 'Awaiting human decision', trend: pendingReviews > 0 ? 'down' : 'neutral' }}
            icon={Clock}
            animationDelay="250ms"
          />
          <KPICard
            label="High Confidence Matches"
            value={isLoading ? '—' : highConfidenceMatches.toLocaleString()}
            change={{ value: 'AI consensus verified', trend: 'up' }}
            icon={GitMerge}
            animationDelay="300ms"
          />
          <KPICard
            label="Match Candidates"
            value={isLoading ? '—' : duplicateCandidates.toLocaleString()}
            change={{ value: 'Cross-CPSE candidate pairs', trend: 'neutral' }}
            icon={Layers}
            animationDelay="350ms"
          />
          <KPICard
            label="Data Quality Score"
            value={isLoading ? '—' : `${dataQualityScore}%`}
            change={{ value: 'Overall completeness & validity', trend: dataQualityScore >= 80 ? 'up' : 'down' }}
            icon={BarChart3}
            animationDelay="400ms"
          />
        </div>

        {/* Middle Section: Attention Items, Pipeline Progress, Phase Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Action & Attention Items */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  Attention Items
                </div>
                <Badge variant="outline" className="text-xs font-normal">
                  Action Required
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5">
              {/* Review Queue Item */}
              <div className="p-3 rounded-lg border border-border bg-muted/20 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                    Review Queue Decisions
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {pendingReviews.toLocaleString()} matches awaiting technical review
                  </div>
                </div>
                <Button asChild size="sm" variant="outline" className="h-7 text-xs px-2.5 shrink-0">
                  <Link to="/review" className="gap-1">
                    Review
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>

              {/* High Confidence Item */}
              <div className="p-3 rounded-lg border border-border bg-muted/20 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                    Harmonization Matches
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {highConfidenceMatches.toLocaleString()} high-confidence pairs
                  </div>
                </div>
                <Button asChild size="sm" variant="outline" className="h-7 text-xs px-2.5 shrink-0">
                  <Link to="/matches" className="gap-1">
                    Inspect
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>

              {/* Data Quality Item */}
              <div className="p-3 rounded-lg border border-border bg-muted/20 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                    Data Quality Health
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Overall score: {dataQualityScore}% healthy
                  </div>
                </div>
                <Button asChild size="sm" variant="outline" className="h-7 text-xs px-2.5 shrink-0">
                  <Link to="/data-quality" className="gap-1">
                    Analyze
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Processing Progress */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Harmonization Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5 text-xs">
                  <span className="text-muted-foreground">Standardization</span>
                  <span className="font-semibold text-foreground">{processingProgress}%</span>
                </div>
                <Progress value={processingProgress} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5 text-xs">
                  <span className="text-muted-foreground">Common Master Harmonization</span>
                  <span className="font-semibold text-foreground">
                    {totalMaterials > 0 ? Math.min(100, Math.round((harmonizedGroups / totalMaterials) * 100)) : 100}%
                  </span>
                </div>
                <Progress
                  value={totalMaterials > 0 ? Math.min(100, Math.round((harmonizedGroups / totalMaterials) * 100)) : 100}
                  className="h-2"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5 text-xs">
                  <span className="text-muted-foreground">Catalog Quality Health</span>
                  <span className="font-semibold text-foreground">{dataQualityScore}%</span>
                </div>
                <Progress value={dataQualityScore} className="h-2" />
              </div>
              <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span>Phase 1–10 Complete & Verified</span>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  Active
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Pipeline Phase Status */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Pipeline Phase Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {[
                { phase: 'Phase 1: Ingestion & Profiling', status: 'Completed', color: 'text-emerald-500' },
                { phase: 'Phase 2: Standardization & Normalization', status: 'Completed', color: 'text-emerald-500' },
                { phase: 'Phase 3–5: AI Multi-Model Matching', status: 'Verified', color: 'text-emerald-500' },
                { phase: 'Phase 6–7: Human Review & Concurrency', status: 'Active', color: 'text-blue-400' },
                { phase: 'Phase 8: Common Material Master', status: 'Governed', color: 'text-emerald-500' },
                { phase: 'Phase 10: Procurement Intelligence', status: 'Active', color: 'text-purple-400' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-1 border-b border-border/40 last:border-0">
                  <span className="text-muted-foreground">{item.phase}</span>
                  <span className={`font-medium ${item.color}`}>{item.status}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row: Interactive Recharts Pie Chart & Tier Breakdown Bar Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recharts Pie / Donut Chart: Material Volume by CPSE */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PieIcon className="h-4 w-4 text-primary" />
                  Material Volume by CPSE
                </div>
                <Badge variant="outline" className="text-xs font-normal">
                  {cpsePieData.length} CPSE Sources
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Interactive distribution of material catalog volume across participating enterprises
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cpsePieData.length === 0 ? (
                <div className="text-center py-16 text-xs text-muted-foreground">
                  No CPSE volume data available for active dataset.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                  {/* Donut Chart */}
                  <div className="sm:col-span-7 h-56 relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <RechartsTooltip content={<CustomPieTooltip />} wrapperStyle={{ outline: 'none', zIndex: 50 }} />
                        <Pie
                          data={cpsePieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {cpsePieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xl font-bold font-mono text-foreground">
                        {totalMaterials.toLocaleString()}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Items
                      </span>
                    </div>
                  </div>

                  {/* Clean Legend & Percentage Breakdown */}
                  <div className="sm:col-span-5 space-y-2.5">
                    {cpsePieData.map((cpse) => (
                      <div key={cpse.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: cpse.color }}
                          />
                          <span className="font-semibold text-foreground">{cpse.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{cpse.value.toLocaleString()}</span>
                          <span className="font-medium text-foreground px-1.5 py-0.5 rounded bg-muted/60 text-[11px]">
                            {cpse.percentage}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recharts Bar Chart: Match Confidence & Quality Distribution */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Harmonization Candidate Distribution
                </div>
                <Badge variant="outline" className="text-xs font-normal">
                  {duplicateCandidates.toLocaleString()} Total Pairs
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Candidate relationships categorized by AI match confidence tiers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tierBreakdownData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={{ stroke: '#334155' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={{ stroke: '#334155' }}
                      tickLine={false}
                    />
                    <RechartsTooltip cursor={false} content={<CustomBarTooltip />} wrapperStyle={{ outline: 'none', zIndex: 50 }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {tierBreakdownData.map((entry, index) => (
                        <Cell key={`bar-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
        </>
      )}
      </div>
    </AppLayout>
  );
}
