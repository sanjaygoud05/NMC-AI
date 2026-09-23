import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { nmcApi } from '@/services/nmcApi';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  RadialBarChart,
  RadialBar,
} from 'recharts';
import {
  Building2,
  CheckCircle2,
  GitMerge,
  Database,
  ShieldCheck,
  ClipboardList,
  Layers,
  TrendingUp,
  RotateCw,
} from 'lucide-react';

// ─── colour palette (used consistently across all charts) ─────────────────────
const COLORS = {
  pending:  '#f59e0b',   // amber
  accepted: '#10b981',   // emerald
  rejected: '#ef4444',   // red
  different:'#6366f1',   // indigo
  mapped:   '#3b82f6',   // blue
  unmapped: '#e2e8f0',   // slate-200
  normalized:'#22c55e',  // green
  raw:      '#cbd5e1',   // slate-300
};

// ─── custom tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs space-y-1">
      {label && <p className="font-semibold text-foreground mb-1">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: entry.color || entry.fill }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold text-foreground">{entry.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

// ─── KPI stat card ─────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card className="border-border/60 hover:shadow-md transition-shadow">
      <CardContent className="p-5 flex items-start gap-4">
        <div className={`rounded-xl p-2.5 shrink-0 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── section wrapper ──────────────────────────────────────────────────────────
function Section({ title, description, children }: {
  title: string; description?: string; children: React.ReactNode;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
        {description && (
          <CardDescription className="text-xs">{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ─── CPSE bar data label ───────────────────────────────────────────────────────
const CustomBarLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (!value) return null;
  return (
    <text x={x + width / 2} y={y - 4} fill="var(--muted-foreground)" textAnchor="middle" fontSize={10}>
      {value}
    </text>
  );
};

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function Analytics() {
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['nmc', 'dashboard-metrics'],
    queryFn: () => nmcApi.analytics.getDashboardMetrics(),
    refetchInterval: 15000,
  });

  const { data: cpseStats, isLoading: cpseLoading } = useQuery({
    queryKey: ['nmc', 'cpse-analytics'],
    queryFn: () => nmcApi.analytics.getCPSEAnalytics(),
    refetchInterval: 15000,
  });

  const { data: matchStats, isLoading: matchLoading } = useQuery({
    queryKey: ['nmc', 'match-stats'],
    queryFn: () => nmcApi.analytics.getMatchStats(),
    refetchInterval: 15000,
  });

  const isLoading = metricsLoading || cpseLoading || matchLoading;

  // Derived numbers
  const total = metrics?.total_materials || 0;
  const normalized = metrics?.normalized_materials || 0;
  const mapped = metrics?.mapped_materials || 0;
  const pending = metrics?.pending_reviews || 0;
  const nmcCodes = metrics?.total_national_codes || 0;
  const decisions = metrics?.decisions_recorded || 0;

  const normPct = total > 0 ? Math.round((normalized / total) * 100) : 0;
  const mappedPct = total > 0 ? Math.round((mapped / total) * 100) : 0;

  // ─── Chart data ──────────────────────────────────────────────────────────────

  // Donut: match outcome breakdown
  const matchTotal = matchStats?.total || 0;
  const matchDonutData = matchTotal > 0 ? [
    { name: 'Pending Review', value: matchStats?.pending_review || 0, fill: COLORS.pending },
    { name: 'Accepted',       value: matchStats?.accepted       || 0, fill: COLORS.accepted },
    { name: 'Different',      value: matchStats?.different      || 0, fill: COLORS.different },
    { name: 'Rejected',       value: matchStats?.rejected       || 0, fill: COLORS.rejected },
  ].filter(d => d.value > 0) : [];

  // Donut: material status
  const unmapped = total - mapped;
  const materialStatusData = total > 0 ? [
    { name: 'Mapped to NMC', value: mapped,   fill: COLORS.mapped },
    { name: 'Unmapped',      value: unmapped,  fill: COLORS.unmapped },
  ] : [];

  // Bar: per-CPSE breakdown
  const cpseBarData = (cpseStats || []).map((c: any) => ({
    name:       c.cpse_code,
    Total:      c.total_materials,
    Normalized: c.normalized_materials,
    Mapped:     c.mapped_materials,
    Different:  c.different_materials || 0,
  }));

  // Radial: normalization progress per CPSE
  const radialData = (cpseStats || []).map((c: any) => ({
    name:  c.cpse_code,
    value: c.normalization_progress,
    fill:  c.normalization_progress >= 80 ? COLORS.accepted
         : c.normalization_progress >= 50 ? COLORS.pending
         : COLORS.rejected,
  }));

  // Bar: normalization vs raw
  const normBarData = (cpseStats || []).map((c: any) => ({
    name:       c.cpse_code,
    Normalized: c.normalized_materials,
    Raw:        c.total_materials - c.normalized_materials,
  }));

  return (
    <AppLayout requireAdmin>
      <div className="space-y-6">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Analytics
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Real-time harmonization progress, review throughput, and enterprise data quality insights.
            </p>
          </div>
          {isLoading && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <RotateCw className="h-3.5 w-3.5 animate-spin" />
              Refreshing…
            </div>
          )}
        </div>

        {/* ── KPI Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiCard
            label="Active CPSEs"
            value={metrics?.total_cpsEs ?? '—'}
            icon={Building2}
            color="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
          />
          <KpiCard
            label="Total Materials"
            value={total.toLocaleString()}
            sub="across all enterprises"
            icon={Database}
            color="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          />
          <KpiCard
            label="Normalized"
            value={`${normPct}%`}
            sub={`${normalized.toLocaleString()} records`}
            icon={CheckCircle2}
            color="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          />
          <KpiCard
            label="Mapped to NMC"
            value={`${mappedPct}%`}
            sub={`${mapped.toLocaleString()} materials`}
            icon={GitMerge}
            color="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
          />
          <KpiCard
            label="NMC Codes Created"
            value={nmcCodes.toLocaleString()}
            sub="unique master codes"
            icon={Layers}
            color="bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400"
          />
          <KpiCard
            label="Decisions Recorded"
            value={decisions.toLocaleString()}
            sub={`${pending.toLocaleString()} pending`}
            icon={ClipboardList}
            color="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
          />
        </div>

        {/* ── Global progress bars ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Catalog Normalization Rate
                </CardTitle>
                <span className="font-bold text-xl text-emerald-600 dark:text-emerald-400">{normPct}%</span>
              </div>
              <CardDescription className="text-xs">
                {normalized.toLocaleString()} of {total.toLocaleString()} records cleaned &amp; standardized
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Progress value={normPct} className="h-2.5" />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {total - normalized > 0
                  ? `${(total - normalized).toLocaleString()} records still need normalization`
                  : 'All records normalized ✓'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <GitMerge className="h-4 w-4 text-primary" />
                  Common Master Adoption
                </CardTitle>
                <span className="font-bold text-xl text-primary">{mappedPct}%</span>
              </div>
              <CardDescription className="text-xs">
                {mapped.toLocaleString()} materials mapped to {nmcCodes} unique NMC codes
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Progress value={mappedPct} className="h-2.5" />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {total - mapped > 0
                  ? `${(total - mapped).toLocaleString()} materials still unmapped`
                  : 'Full mapping coverage achieved ✓'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Charts row ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

          {/* Donut: Match Outcome Breakdown */}
          <Section
            title="Match Outcome Breakdown"
            description="Distribution of AI-generated match recommendations by reviewer status"
          >
            {matchDonutData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
                No match data available yet.
              </div>
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={matchDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {matchDonutData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: '11px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="text-center -mt-2 text-xs text-muted-foreground">
                  <span className="font-bold text-foreground text-sm">{matchTotal.toLocaleString()}</span> total pairs evaluated
                </div>
              </div>
            )}
          </Section>

          {/* Donut: Material Mapping Coverage */}
          <Section
            title="Material Mapping Coverage"
            description="Share of catalog materials successfully mapped to an NMC code"
          >
            {materialStatusData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
                No material data yet.
              </div>
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={materialStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {materialStatusData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: '11px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="text-center -mt-2 text-xs text-muted-foreground">
                  <span className="font-bold text-foreground text-sm">{mappedPct}%</span> mapping coverage
                </div>
              </div>
            )}
          </Section>

          {/* Radial: Per-CPSE normalisation progress */}
          <Section
            title="Normalization Progress by CPSE"
            description="Percentage of catalog normalized per enterprise — green ≥ 80%, amber ≥ 50%"
          >
            {radialData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
                No CPSE data yet.
              </div>
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius={20}
                    outerRadius={80}
                    data={radialData}
                    startAngle={180}
                    endAngle={0}
                  >
                    <RadialBar
                      label={{ position: 'insideStart', fill: 'var(--muted-foreground)', fontSize: 10 }}
                      background={{ fill: 'var(--muted)' }}
                      dataKey="value"
                    />
                    <Legend
                      iconSize={8}
                      wrapperStyle={{ fontSize: '11px' }}
                    />
                    <Tooltip content={<CustomTooltip />} formatter={(v: any) => `${v}%`} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>
        </div>

        {/* ── Stacked bar: Normalization breakdown per CPSE ────────────────── */}
        <Section
          title="Normalization Breakdown per Enterprise"
          description="Normalized vs raw catalog items for each participating CPSE"
        >
          {normBarData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
              No data available yet.
            </div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={normBarData} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
                  <Legend iconType="square" iconSize={9} wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="Normalized" stackId="a" fill={COLORS.normalized} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Raw"        stackId="a" fill={COLORS.raw}        radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>

        {/* ── Grouped bar: Full CPSE Material Status ──────────────────────── */}
        <Section
          title="Enterprise Material Status Comparison"
          description="Total, Normalized, Mapped, and Different counts per CPSE — useful for prioritizing remediation work"
        >
          {cpseBarData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
              No data available yet.
            </div>
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cpseBarData} barCategoryGap="25%" barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.35 }} />
                  <Legend iconType="square" iconSize={9} wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="Total"      fill="#94a3b8" radius={[3,3,0,0]}><CustomBarLabel /></Bar>
                  <Bar dataKey="Normalized" fill={COLORS.normalized} radius={[3,3,0,0]}><CustomBarLabel /></Bar>
                  <Bar dataKey="Mapped"     fill={COLORS.mapped}     radius={[3,3,0,0]}><CustomBarLabel /></Bar>
                  <Bar dataKey="Different"  fill={COLORS.different}  radius={[3,3,0,0]}><CustomBarLabel /></Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>

        {/* ── CPSE Performance Table ──────────────────────────────────────── */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              CPSE Performance Details
            </CardTitle>
            <CardDescription className="text-xs">
              Line-level harmonization progress across participating public sector enterprises.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
                  <tr>
                    <th className="px-4 py-2.5 w-28">CPSE</th>
                    <th className="px-4 py-2.5">Enterprise Name</th>
                    <th className="px-4 py-2.5 w-28 text-right">Total</th>
                    <th className="px-4 py-2.5 w-28 text-right">Normalized</th>
                    <th className="px-4 py-2.5 w-28 text-right">Mapped</th>
                    <th className="px-4 py-2.5 w-28 text-right">Different</th>
                    <th className="px-4 py-2.5 w-44">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {cpseLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <RotateCw className="h-4 w-4 animate-spin text-primary" />
                          Loading CPSE analytics…
                        </div>
                      </td>
                    </tr>
                  ) : !cpseStats || cpseStats.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        No enterprise statistics available yet.
                      </td>
                    </tr>
                  ) : (
                    cpseStats.map((c: any) => {
                      const cTotal  = c.total_materials      || 0;
                      const cNorm   = c.normalized_materials  || 0;
                      const cMapped = c.mapped_materials      || 0;
                      const cDiff   = c.different_materials   || 0;
                      const pct     = c.normalization_progress || 0;
                      const color   = pct >= 80 ? 'text-emerald-600 dark:text-emerald-400'
                                    : pct >= 50 ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-rose-600 dark:text-rose-400';

                      return (
                        <tr key={c.cpse_id} className="hover:bg-muted/25 transition-colors">
                          <td className="px-4 py-2.5 font-mono font-bold text-foreground">{c.cpse_code}</td>
                          <td className="px-4 py-2.5 font-medium text-foreground">{c.cpse_name}</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground">{cTotal.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right text-emerald-600 dark:text-emerald-400 font-medium">{cNorm.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right text-blue-600 dark:text-blue-400 font-medium">{cMapped.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right text-indigo-600 dark:text-indigo-400 font-medium">{cDiff.toLocaleString()}</td>
                          <td className="px-4 py-2.5">
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px]">
                                <span className="text-muted-foreground">Normalization</span>
                                <span className={`font-semibold ${color}`}>{pct}%</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${pct}%`,
                                    background: pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444',
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── Decision Health Indicators ──────────────────────────────────── */}
        {matchStats && matchTotal > 0 && (
          <Section
            title="Review Queue Health"
            description="Current snapshot of match review throughput — use this to spot bottlenecks or data quality issues"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: 'Pending Review',
                  count: matchStats.pending_review,
                  total: matchTotal,
                  bg: 'bg-amber-500/10 border-amber-400/40',
                  text: 'text-amber-600 dark:text-amber-400',
                },
                {
                  label: 'Accepted (Same)',
                  count: matchStats.accepted,
                  total: matchTotal,
                  bg: 'bg-emerald-500/10 border-emerald-400/40',
                  text: 'text-emerald-600 dark:text-emerald-400',
                },
                {
                  label: 'Marked Different',
                  count: matchStats.different,
                  total: matchTotal,
                  bg: 'bg-indigo-500/10 border-indigo-400/40',
                  text: 'text-indigo-600 dark:text-indigo-400',
                },
                {
                  label: 'Rejected',
                  count: matchStats.rejected,
                  total: matchTotal,
                  bg: 'bg-rose-500/10 border-rose-400/40',
                  text: 'text-rose-600 dark:text-rose-400',
                },
              ].map(({ label, count, total: tot, bg, text }) => {
                const pct = tot > 0 ? Math.round((count / tot) * 100) : 0;
                return (
                  <div key={label} className={`rounded-lg border p-3 ${bg}`}>
                    <p className="text-[11px] text-muted-foreground font-medium mb-1">{label}</p>
                    <p className={`text-2xl font-bold ${text}`}>{count.toLocaleString()}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{pct}% of all pairs</p>
                    <div className="mt-2 h-1.5 rounded-full bg-white/30 dark:bg-black/20 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: 'currentColor' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {matchStats.pending_review > 0 && (
              <div className="mt-3 rounded-md border border-amber-400/30 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  <strong>{matchStats.pending_review.toLocaleString()} matches</strong> are awaiting reviewer decisions.
                  {matchStats.pending_review > 100
                    ? ' Consider assigning more reviewers to clear the backlog.'
                    : ' The queue is manageable.'}
                </span>
              </div>
            )}
          </Section>
        )}
      </div>
    </AppLayout>
  );
}
