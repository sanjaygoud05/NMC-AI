import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { nmcApi } from '@/services/nmcApi';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LabelList,
  RadialBarChart, RadialBar,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';

import {
  Building2, Database, GitMerge, Layers,
  RotateCw, ArrowRight, Search, ChevronLeft, ChevronRight,
} from 'lucide-react';

// ─── Color Palette ────────────────────────────────────────────────────────────
const C = {
  blue:    '#3b82f6',
  emerald: '#10b981',
  amber:   '#f59e0b',
  indigo:  '#6366f1',
  cyan:    '#06b6d4',
  purple:  '#8b5cf6',
  orange:  '#f97316',
  slate:   '#64748b',
};

// Truly distinct vivid colors — one per bar
const CPSE_BAR_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // rose
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#6366f1', // indigo
];

// ─── Recharts requires hard-coded hex (CSS vars don't work in SVG) ────────────
const TICK_COLOR   = '#94a3b8'; // slate-400 — muted text
const AXIS_COLOR   = '#334155'; // slate-700 — subtle axis line
const LABEL_COLOR  = '#64748b'; // slate-500 — axis title
const FG_COLOR     = '#f1f5f9'; // slate-100 — foreground / value labels

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'rgba(15,23,42,0.95)',
        border: '1px solid rgba(51,65,85,0.8)',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 12,
        minWidth: 140,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
    >
      {label !== undefined && (
        <p style={{ color: FG_COLOR, fontWeight: 600, marginBottom: 4 }}>{label}</p>
      )}
      {payload.map((e: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: e.color || e.fill || '#3b82f6',
              flexShrink: 0,
            }}
          />
          <span style={{ color: TICK_COLOR }}>{e.name}:</span>
          <span style={{ color: FG_COLOR, fontWeight: 600 }}>
            {typeof e.value === 'number' ? e.value.toLocaleString() : e.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Pie Tooltip (pie slices have different payload structure) ────────────────
const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const slice = payload[0];
  const name  = slice.name  || slice.payload?.name  || '';
  const value = Number(slice.value  ?? slice.payload?.value ?? 0);
  const color = slice.payload?.color || slice.color || slice.fill || '#10b981';
  const total = slice.payload?._total ?? 0;
  const pct   = total > 0 ? Math.round((value / total) * 100) : null;
  return (
    <div
      style={{
        background: 'rgba(15,23,42,0.97)',
        border: `1.5px solid ${color}66`,
        borderRadius: 8,
        padding: '8px 14px',
        fontSize: 12,
        minWidth: 160,
        boxShadow: `0 8px 28px rgba(0,0,0,0.5), 0 0 0 1px ${color}22`,
        pointerEvents: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ color: FG_COLOR, fontWeight: 700, fontSize: 13 }}>{name}</span>
      </div>
      <div style={{ paddingLeft: 18, fontSize: 12 }}>
        <span style={{ color: FG_COLOR, fontWeight: 700 }}>{value.toLocaleString()}</span>
        <span style={{ color: TICK_COLOR }}> pairs</span>
        {pct !== null && (
          <span style={{ marginLeft: 6, color, fontWeight: 600 }}>({pct}%)</span>
        )}
      </div>
    </div>
  );
};

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
function Spinner({ color = 'text-blue-500' }: { color?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-8">
      <RotateCw className={`h-4 w-4 animate-spin ${color}`} />
      Loading...
    </div>
  );
}

// ─── Main Analytics Page ──────────────────────────────────────────────────────
export default function Analytics() {
  const [cmmSearch, setCmmSearch] = useState('');
  const [cmmPage, setCmmPage] = useState(1);
  const cmmPageSize = 8;

  // ── Primary full analytics query (rich data) ─────────────────────────────
  const {
    data: fullData,
    isLoading: fullLoading,
    isFetching: fullFetching,
    refetch: refetchFull,
    isError: fullError,
  } = useQuery({
    queryKey: ['nmc', 'analytics-full'],
    queryFn: () => nmcApi.analytics.getFullAnalytics(),
    refetchInterval: 30000,
    retry: 2,
  });

  // ── Dashboard metrics as secondary source for KPIs ───────────────────────
  const { data: dashData, refetch: refetchDash } = useQuery({
    queryKey: ['nmc', 'dashboard-metrics'],
    queryFn: () => nmcApi.analytics.getDashboardMetrics(),
    refetchInterval: 30000,
  });

  const isLoading = fullLoading;
  const isFetching = fullFetching;

  const handleRefresh = () => { refetchFull(); refetchDash(); };

  // Merge: prefer fullData, fallback to dashData for KPI fields
  const d = fullData as any;
  const dd = dashData as any;

  // ── KPI Values ───────────────────────────────────────────────────────────
  const totalCpses     = d?.active_cpses ?? d?.total_cpses ?? dd?.total_cpsEs ?? 0;
  const totalMaterials = d?.total_materials ?? dd?.total_materials ?? 0;
  const totalMatches   = d?.total_matches ?? 0;
  const totalCmm       = d?.total_cmm ?? dd?.total_national_codes ?? 0;

  // ── Materials by CPSE ────────────────────────────────────────────────────
  const materialsByCpse: { cpse_code: string; material_count: number }[] = useMemo(() => {
    if (!d?.cpse_material_distribution?.length) return [];
    return [...d.cpse_material_distribution].sort(
      (a: any, b: any) => b.material_count - a.material_count
    );
  }, [d]);

  const maxCpseCount = Math.max(...(materialsByCpse.length ? materialsByCpse.map((c: any) => c.material_count) : [0]), 1);
  const cpseYMax = (() => {
    const ceil = maxCpseCount * 1.4;
    if (ceil <= 10) return 10;
    const mag = Math.pow(10, Math.floor(Math.log10(ceil)));
    return Math.ceil(ceil / mag) * mag;
  })();
  const cpseYTicks = [0, Math.round(cpseYMax * 0.25), Math.round(cpseYMax * 0.5), Math.round(cpseYMax * 0.75), cpseYMax];

  // ── Harmonization Status Donut ───────────────────────────────────────────
  const harmonizationStatusData = useMemo(() => {
    if (!d) return [];
    const ms = d?.match_by_status || {};
    const mc = d?.match_by_category || {};
    return [
      { name: 'Potentially Same',      value: mc.POTENTIALLY_SAME || 0,  color: C.amber   },
      { name: 'Accepted / Harmonized', value: ms.ACCEPTED || 0,          color: C.emerald },
      { name: 'Different',             value: ms.DIFFERENT || 0,         color: C.indigo  },
      { name: 'Pending Review',        value: ms.PENDING_REVIEW || 0,    color: C.cyan    },
    ].filter(item => item.value > 0);
  }, [d]);

  const totalStatusCount = harmonizationStatusData.reduce((s, i) => s + i.value, 0);

  // ── AI Confidence Distribution ───────────────────────────────────────────
  const confidenceData = useMemo(() => {
    if (!d?.confidence_distribution?.length) return [];
    const colors = [C.emerald, C.cyan, C.amber, C.orange, C.slate];
    return d.confidence_distribution.map((item: any, idx: number) => ({
      range: item.range,
      count: item.count,
      color: colors[idx] ?? C.blue,
    }));
  }, [d]);

  const maxConfCount = Math.max(...confidenceData.map((c: any) => c.count), 1);
  // Use a visible floor — scale Y so smallest bar is at least 10% of chart height
  const minConfCount = Math.min(...(confidenceData.length ? confidenceData.map((c: any) => c.count) : [0]));
  const confFloor = minConfCount > 0 ? Math.floor(minConfCount * 0.5) : 0;
  const confYMax = (() => {
    const ceil = maxConfCount * 1.25;
    if (ceil <= 10) return 10;
    const mag = Math.pow(10, Math.floor(Math.log10(ceil)));
    return Math.ceil(ceil / mag) * mag;
  })();
  const confYTicks = (() => {
    const step = confYMax / 4;
    return [0, Math.round(step), Math.round(step * 2), Math.round(step * 3), confYMax];
  })();
  // If data is very skewed (max > 20x min), use a "floor" domain so small bars still render visibly
  const confDomainMin = (maxConfCount / Math.max(minConfCount, 1)) > 20 ? Math.floor(minConfCount * 0.5) : 0;

  // ── Harmonization Progress (funnel) ─────────────────────────────────────
  const progressData = useMemo(() => [
    { stage: 'Processed',  count: d?.total_materials          ?? dd?.total_materials ?? 0 },
    { stage: 'Matched',    count: d?.total_matches            ?? 0 },
    { stage: 'Reviewed',   count: d?.total_review_decisions   ?? dd?.decisions_recorded ?? 0 },
    { stage: 'Harmonized', count: d?.mapped_materials         ?? dd?.mapped_materials ?? 0 },
  ], [d, dd]);

  // ── CMM Table ────────────────────────────────────────────────────────────
  const cmmRecords = useMemo(() => {
    let list: any[] = d?.shared_cmms ?? [];
    if (cmmSearch.trim()) {
      const q = cmmSearch.toLowerCase();
      list = list.filter((r: any) =>
        r.nmc_code?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [d, cmmSearch]);

  const totalCmmPages = Math.ceil(cmmRecords.length / cmmPageSize) || 1;
  const paginatedCmm = useMemo(() => {
    const start = (cmmPage - 1) * cmmPageSize;
    return cmmRecords.slice(start, start + cmmPageSize);
  }, [cmmRecords, cmmPage, cmmPageSize]);

  return (
    <AppLayout requireAdmin>
      <div className="space-y-6">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Platform Harmonization Analytics
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Overview of cross-CPSE material standardization and harmonization
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
            className="h-8 gap-1.5 text-xs border-border/70 shrink-0 self-start sm:self-auto"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* ── Error Banner ──────────────────────────────────────────────────── */}
        {fullError && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-400 flex items-center gap-2">
            <RotateCw className="h-3.5 w-3.5 shrink-0" />
            Could not load full analytics data. Showing partial data from dashboard endpoint.
          </div>
        )}

        {/* ── ROW 1: 4 KPI Cards (Dashboard-style compact) ──────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

          <Card className="border-border/60">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-blue-500" />
                Total CPSEs
              </CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums">
                {isLoading ? <span className="opacity-40">—</span> : totalCpses}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-[11px] text-muted-foreground">Active enterprises</p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-purple-500" />
                Total Materials
              </CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums">
                {isLoading ? <span className="opacity-40">—</span> : totalMaterials.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-[11px] text-muted-foreground">Raw catalog items</p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs flex items-center gap-1.5">
                <GitMerge className="h-3.5 w-3.5 text-amber-500" />
                Cross-CPSE Matches
              </CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums">
                {isLoading ? <span className="opacity-40">—</span> : totalMatches.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-[11px] text-muted-foreground">AI match pairs found</p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-emerald-500" />
                Common Material Masters
              </CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums">
                {isLoading ? <span className="opacity-40">—</span> : totalCmm.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-[11px] text-muted-foreground">NMC canonical records</p>
            </CardContent>
          </Card>

        </div>

        {/* ── ROW 2: Materials by CPSE + Harmonization Status ───────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Left: Materials by CPSE (Vertical Bar Chart with labels) */}
          <Card className="border-border/60">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold text-foreground">Materials by CPSE</CardTitle>
              <CardDescription className="text-xs">
                Material catalog distribution across participating enterprises
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              {isLoading ? (
                <Spinner color="text-blue-500" />
              ) : materialsByCpse.length === 0 ? (
                <div className="flex items-center justify-center h-44 text-xs text-muted-foreground">
                  No CPSE distribution data available.
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={materialsByCpse}
                      margin={{ top: 26, right: 20, left: 20, bottom: 40 }}
                      barSize={42}
                      barCategoryGap="30%"
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={AXIS_COLOR} opacity={0.6} />
                      <XAxis
                        dataKey="cpse_code"
                        tick={{ fontSize: 12, fontWeight: 700, fill: FG_COLOR }}
                        axisLine={{ stroke: AXIS_COLOR }}
                        tickLine={false}
                        label={{
                          value: 'CPSE Code',
                          position: 'insideBottom',
                          offset: -24,
                          fill: LABEL_COLOR,
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      />
                      <YAxis
                        domain={[0, cpseYMax]}
                        ticks={cpseYTicks}
                        tick={{ fontSize: 10, fill: TICK_COLOR }}
                        axisLine={{ stroke: AXIS_COLOR }}
                        tickLine={false}
                        tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                        width={52}
                        label={{
                          value: 'No. of Materials',
                          angle: -90,
                          position: 'insideLeft',
                          offset: 12,
                          fill: LABEL_COLOR,
                          fontSize: 10,
                          fontWeight: 400,
                        }}
                      />
                      <Tooltip
                        content={<CustomTooltip />}
                        cursor={false}
                      />
                      <Bar dataKey="material_count" name="Materials" radius={[5, 5, 0, 0]}>
                        {materialsByCpse.map((_, idx) => (
                          <Cell key={idx} fill={CPSE_BAR_COLORS[idx % CPSE_BAR_COLORS.length]} />
                        ))}
                        <LabelList
                          dataKey="material_count"
                          position="top"
                          formatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
                          style={{ fontSize: 11, fill: TICK_COLOR, fontWeight: 500 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: Harmonization Status — Radar Chart */}
          <Card className="border-border/60">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold text-foreground">Harmonization Status</CardTitle>
              <CardDescription className="text-xs">
                Candidate pair evaluation and review status breakdown
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              {isLoading ? (
                <Spinner color="text-emerald-500" />
              ) : harmonizationStatusData.length === 0 ? (
                <div className="flex items-center justify-center h-44 text-xs text-muted-foreground">
                  No harmonization status data. Run AI matching first.
                </div>
              ) : (() => {
                const radarData = harmonizationStatusData.map(item => ({
                  status: item.name,
                  pct: totalStatusCount > 0 ? parseFloat(((item.value / totalStatusCount) * 100).toFixed(1)) : 0,
                  count: item.value,
                  color: item.color,
                }));
                return (
                  <div className="space-y-4">
                    <div className="h-[220px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarData} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
                          <PolarGrid stroke="rgba(148,163,184,0.15)" strokeDasharray="3 3" />
                          <PolarAngleAxis
                            dataKey="status"
                            tick={({ x, y, payload, textAnchor }: any) => {
                              const words = (payload.value as string).split(' ');
                              const lines: string[] = [];
                              for (let i = 0; i < words.length; i += 2) {
                                lines.push(words.slice(i, i + 2).join(' '));
                              }
                              return (
                                <g>
                                  {lines.map((line: string, i: number) => (
                                    <text
                                      key={i}
                                      x={x}
                                      y={y + i * 12}
                                      textAnchor={textAnchor}
                                      fontSize={10}
                                      fontWeight={600}
                                      fill="#94a3b8"
                                    >
                                      {line}
                                    </text>
                                  ))}
                                </g>
                              );
                            }}
                          />
                          <PolarRadiusAxis
                            angle={30}
                            domain={[0, 100]}
                            tick={{ fontSize: 9, fill: '#64748b' }}
                            tickCount={4}
                            tickFormatter={(v: number) => `${v}%`}
                            axisLine={false}
                          />
                          <Radar
                            name="Share"
                            dataKey="pct"
                            stroke="#6366f1"
                            fill="#6366f1"
                            fillOpacity={0.3}
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: '#6366f1', strokeWidth: 0 } as any}
                            activeDot={{ r: 6, fill: '#818cf8', strokeWidth: 0 } as any}
                          />
                          <Tooltip
                            cursor={false}
                            content={({ active, payload }: any) => {
                              if (!active || !payload?.length) return null;
                              const p = payload[0].payload;
                              return (
                                <div style={{
                                  background: 'rgba(9,9,11,0.96)',
                                  border: '1px solid rgba(99,102,241,0.45)',
                                  borderRadius: 8,
                                  padding: '10px 14px',
                                  fontSize: 12,
                                  minWidth: 160,
                                }}>
                                  <p className="font-bold text-foreground mb-1">{p.status}</p>
                                  <p className="text-muted-foreground">
                                    Count: <span className="font-bold text-foreground">{p.count.toLocaleString()}</span>
                                  </p>
                                  <p className="text-indigo-400 font-semibold">
                                    Share: {p.pct}%
                                  </p>
                                </div>
                              );
                            }}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Legend rows */}
                    <div className="space-y-1.5 border-t border-border/40 pt-3">
                      {radarData.map((item) => (
                        <div key={item.status} className="flex items-center gap-2.5 text-xs">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-foreground font-medium flex-1 truncate">{item.status}</span>
                          <span className="tabular-nums font-bold text-foreground">{item.count.toLocaleString()}</span>
                          <span className="tabular-nums text-muted-foreground w-11 text-right">{item.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>


        </div>

        {/* ── ROW 3: AI Match Confidence + Harmonization Progress ───────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Left: AI Match Confidence — vertical bar chart */}
          <Card className="border-border/60">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold text-foreground">AI Match Confidence</CardTitle>
              <CardDescription className="text-xs">
                Confidence score tier distribution across matched material pairs
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              {isLoading ? (
                <Spinner color="text-amber-500" />
              ) : confidenceData.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-xs text-muted-foreground">
                  No confidence data. Run AI matching first.
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={confidenceData}
                      margin={{ top: 26, right: 20, left: 20, bottom: 40 }}
                      barSize={38}
                      barCategoryGap="28%"
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={AXIS_COLOR} opacity={0.6} />
                      <XAxis
                        dataKey="range"
                        tick={{ fontSize: 11, fill: TICK_COLOR, fontWeight: 400 }}
                        axisLine={{ stroke: AXIS_COLOR }}
                        tickLine={false}
                        label={{
                          value: 'Confidence Tier',
                          position: 'insideBottom',
                          offset: -24,
                          fill: LABEL_COLOR,
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      />
                      <YAxis
                        domain={[confDomainMin, confYMax]}
                        ticks={confYTicks}
                        tick={{ fontSize: 10, fill: TICK_COLOR }}
                        axisLine={{ stroke: AXIS_COLOR }}
                        tickLine={false}
                        tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                        width={52}
                        label={{
                          value: 'Match Count',
                          angle: -90,
                          position: 'insideLeft',
                          offset: 12,
                          fill: LABEL_COLOR,
                          fontSize: 10,
                          fontWeight: 400,
                        }}
                      />
                      <Tooltip
                        content={<CustomTooltip />}
                        cursor={false}
                      />
                      <Bar dataKey="count" name="Matches" radius={[4, 4, 0, 0]}>
                        {confidenceData.map((tier: any, idx: number) => (
                          <Cell key={idx} fill={tier.color} />
                        ))}
                        <LabelList
                          dataKey="count"
                          position="top"
                          formatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
                          style={{ fontSize: 11, fill: TICK_COLOR, fontWeight: 400 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: Harmonization Progress area chart */}
          <Card className="border-border/60">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold text-foreground">Harmonization Progress</CardTitle>
              <CardDescription className="text-xs">
                Pipeline: Processed → Matched → Reviewed → Harmonized
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              {isLoading ? (
                <Spinner color="text-blue-500" />
              ) : (
                <>
                  <div className="h-36 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={progressData} margin={{ top: 10, right: 20, left: 10, bottom: 4 }}>
                        <defs>
                          <linearGradient id="progressGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={C.blue} stopOpacity={0.35} />
                            <stop offset="95%" stopColor={C.blue} stopOpacity={0.0}  />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={AXIS_COLOR} opacity={0.5} />
                        <XAxis
                          dataKey="stage"
                          tick={{ fontSize: 11, fontWeight: 600, fill: FG_COLOR }}
                          axisLine={{ stroke: AXIS_COLOR }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: TICK_COLOR }}
                          axisLine={{ stroke: AXIS_COLOR }}
                          tickLine={false}
                          tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                          width={44}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: AXIS_COLOR, strokeWidth: 1, strokeDasharray: '4 3' }} />
                        <Area
                          type="monotone"
                          dataKey="count"
                          name="Records"
                          stroke={C.blue}
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#progressGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Step summary strip */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px]">
                    {progressData.map((step, idx) => (
                      <React.Fragment key={step.stage}>
                        <div className="flex flex-col items-center text-center">
                          <span className="font-bold text-foreground tabular-nums">
                            {step.count.toLocaleString()}
                          </span>
                          <span className="text-muted-foreground">{step.stage}</span>
                        </div>
                        {idx < progressData.length - 1 && (
                          <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

        </div>

        {/* ── ROW 4: Common National Material Master Table ───────────────────── */}
        <Card className="border-border/60">
          <CardHeader className="p-4 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold text-foreground">
                Common National Material Master
              </CardTitle>
              <CardDescription className="text-xs">
                Canonical material master records consolidated across CPSE enterprises
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter by NMC Code or Material…"
                value={cmmSearch}
                onChange={(e) => { setCmmSearch(e.target.value); setCmmPage(1); }}
                className="h-8 pl-8 text-xs bg-background/50 border-border/70"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-t border-border/60 overflow-hidden rounded-b-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border/60 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="py-2.5 px-4">NMC Code</th>
                      <th className="py-2.5 px-4">Canonical Material</th>
                      <th className="py-2.5 px-4 text-center">CPSEs</th>
                      <th className="py-2.5 px-4 text-right">Mapped Materials</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {isLoading ? (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-xs text-muted-foreground">
                          <RotateCw className="h-4 w-4 animate-spin inline mr-2 text-indigo-500" />
                          Loading common material masters…
                        </td>
                      </tr>
                    ) : paginatedCmm.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-xs text-muted-foreground">
                          {cmmSearch
                            ? 'No records matching the filter.'
                            : 'No Common Material Master records found. Ensure materials have been matched and harmonized.'}
                        </td>
                      </tr>
                    ) : (
                      paginatedCmm.map((c: any, idx: number) => (
                        <tr key={c.nmc_code ?? idx} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-indigo-500 whitespace-nowrap">
                            {c.nmc_code || '—'}
                          </td>
                          <td className="py-3 px-4 text-foreground font-medium max-w-xs">
                            <span className="line-clamp-1" title={c.description}>
                              {c.description || 'Standard Engineering Material Record'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
                              title={(c.source_cpses || []).join(', ')}
                              style={{
                                background: (c.cpse_count || 1) >= 2 ? 'rgba(16,185,129,0.12)' : 'rgba(59,130,246,0.10)',
                                color:      (c.cpse_count || 1) >= 2 ? C.emerald : C.blue,
                                border:     `1px solid ${(c.cpse_count || 1) >= 2 ? 'rgba(16,185,129,0.28)' : 'rgba(59,130,246,0.22)'}`,
                              }}
                            >
                              {c.cpse_count ?? (c.source_cpses?.length ?? 1)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-foreground tabular-nums">
                            {c.mapped_materials ?? c.mapping_count ?? 1}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {!isLoading && totalCmmPages > 1 && (
                <div className="flex items-center justify-between px-4 py-2 border-t border-border/50 bg-muted/20 text-xs text-muted-foreground">
                  <span>
                    Showing {(cmmPage - 1) * cmmPageSize + 1}–{Math.min(cmmPage * cmmPageSize, cmmRecords.length)} of {cmmRecords.length}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline" size="icon" className="h-7 w-7"
                      disabled={cmmPage <= 1}
                      onClick={() => setCmmPage(p => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="font-semibold text-foreground px-1">{cmmPage} / {totalCmmPages}</span>
                    <Button
                      variant="outline" size="icon" className="h-7 w-7"
                      disabled={cmmPage >= totalCmmPages}
                      onClick={() => setCmmPage(p => Math.min(totalCmmPages, p + 1))}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </AppLayout>
  );
}
