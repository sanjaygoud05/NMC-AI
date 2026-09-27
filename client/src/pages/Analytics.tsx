import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { nmcApi } from '@/services/nmcApi';
import { useTheme } from '@/hooks/useTheme';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LabelList,
  RadialBarChart, RadialBar,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Sector,
} from 'recharts';

import {
  Building2, Database, GitMerge, Layers,
  RotateCw, ArrowRight, Search, ChevronLeft, ChevronRight,
  Clock, Split, XCircle, CheckCircle2, PieChart as PieIcon, BarChart2, ShieldCheck,
  TrendingUp, Activity, ExternalLink, ArrowUpRight, Sparkles, Check,
  ClipboardCheck, Percent, Network, Inbox, FolderKanban,
} from 'lucide-react';

// ─── Color Palette ────────────────────────────────────────────────────────────
const C = {
  blue: '#3b82f6',
  emerald: '#10b981',
  amber: '#f59e0b',
  indigo: '#6366f1',
  cyan: '#06b6d4',
  purple: '#8b5cf6',
  orange: '#f97316',
  slate: '#64748b',
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

// Fallback tokens for Recharts static attributes
const TICK_COLOR = '#94a3b8';
const AXIS_COLOR = '#334155';
const LABEL_COLOR = '#64748b';
const FG_COLOR = '#f1f5f9';

// ─── Custom Tooltip — theme-adaptive card matching light and dark modes ──────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover/95 text-popover-foreground border border-border/80 rounded-lg px-3 py-2 text-xs shadow-xl min-w-[140px] pointer-events-none backdrop-blur-sm">
      {label !== undefined && (
        <p className="font-semibold text-foreground mb-1">{label}</p>
      )}
      {payload.map((e: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mt-1">
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ background: e.color || e.fill || '#3b82f6' }}
          />
          <span className="text-muted-foreground">{e.name}:</span>
          <span className="font-semibold font-mono text-foreground">
            {typeof e.value === 'number' ? e.value.toLocaleString() : e.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// Custom SVG tick renderer ensuring material names are 100% visible in both light & dark themes
const renderCategoryTick = (props: any) => {
  const { x, y, payload } = props;
  return (
    <text
      x={x - 6}
      y={y + 4}
      textAnchor="end"
      fill="currentColor"
      className="fill-foreground text-[11px] font-semibold"
      style={{ fill: 'currentColor' }}
    >
      {payload.value}
    </text>
  );
};

// ─── Pie ActiveShape — expands hovered slice, shows name+pct in center ──────
const renderPieActiveShape = (props: any) => {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle,
    fill,
  } = props;
  return (
    <g>
      {/* Expanded active slice */}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 4}
        outerRadius={outerRadius + 10}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={1}
        stroke={fill}
        strokeWidth={2}
      />
      {/* Outer glow ring */}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={outerRadius + 13}
        outerRadius={outerRadius + 17}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.3}
      />
    </g>
  );
};

// ─── Pie Tooltip — invisible; center label drives the UX instead ────────────
const PieTooltip = () => null;

// ─── PieDonutWithActiveCenter — interactive donut with hover-driven center ───
interface PieDonutProps {
  data: Array<{ name: string; value: number; color: string; desc?: string }>;
  total: number;
  viewLabel: string;
}
function PieDonutWithActiveCenter({ data, total, viewLabel }: PieDonutProps) {
  const { theme } = useTheme();
  const isDark = theme !== 'light';
  const [activeIdx, setActiveIdx] = React.useState<number | null>(null);

  const activeSlice = activeIdx !== null ? data[activeIdx] : null;
  const activePct =
    activeSlice && total > 0
      ? Math.round((activeSlice.value / total) * 100)
      : null;

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
        No decisions recorded yet in this view.
      </div>
    );
  }

  return (
    <div className="relative h-64 w-full flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={68}
            outerRadius={98}
            paddingAngle={4}
            stroke={isDark ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.9)'}
            strokeWidth={2}
            activeIndex={activeIdx ?? undefined}
            activeShape={renderPieActiveShape}
            onMouseEnter={(_: any, index: number) => setActiveIdx(index)}
            onMouseLeave={() => setActiveIdx(null)}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                opacity={activeIdx === null || activeIdx === index ? 1 : 0.35}
                style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
              />
            ))}
          </Pie>
          <Tooltip content={<PieTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Center overlay — changes on hover */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
        {activeSlice ? (
          <>
            <span
              className="text-xl font-black tabular-nums"
              style={{ color: activeSlice.color, transition: 'color 0.15s' }}
            >
              {activePct}%
            </span>
            <span
              className="text-[10px] font-bold tracking-wide text-center px-3 leading-tight mt-0.5"
              style={{ color: activeSlice.color, opacity: 0.85 }}
            >
              {activeSlice.name}
            </span>
            <span className="text-[9px] text-muted-foreground mt-0.5 font-mono">
              {activeSlice.value.toLocaleString()} entries
            </span>
          </>
        ) : (
          <>
            <span className="text-2xl font-black text-foreground tabular-nums">
              {total.toLocaleString()}
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
              {viewLabel}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

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
  const { theme } = useTheme();
  const isDark = theme !== 'light';

  // Dynamic SVG theme colors (for high-contrast visibility in both light & dark modes)
  const chartText = isDark ? '#f8fafc' : '#0f172a';
  const chartMuted = isDark ? '#94a3b8' : '#475569';
  const chartAxis = isDark ? '#334155' : '#cbd5e1';
  const chartGrid = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(100, 116, 139, 0.18)';
  const chartLabel = isDark ? '#cbd5e1' : '#1e293b';

  const { isAdmin, isReviewer, reviewerName, reviewerCpse } = useAuth();
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

  // ── Review stats for real-time queue synchronization ────────────────────
  const { data: reviewStats } = useQuery({
    queryKey: ['nmc', 'review-stats', 'all'],
    queryFn: () => nmcApi.review.getStats(),
    refetchInterval: 15000,
  });

  // ── Reviewer-scoped stats (their CPSE only) ───────────────────────────────
  const { data: cpses } = useQuery({
    queryKey: ['nmc', 'cpses-list'],
    queryFn: () => nmcApi.cpses.list(),
    enabled: isReviewer,
  });
  const reviewerCpseId = useMemo(() => {
    if (!isReviewer || !reviewerCpse || !cpses) return undefined;
    return cpses.find((c: any) => c.code?.toUpperCase() === reviewerCpse.toUpperCase())?.id;
  }, [isReviewer, reviewerCpse, cpses]);
  const { data: reviewerStats, isLoading: reviewerStatsLoading } = useQuery({
    queryKey: ['nmc', 'review-stats', reviewerCpseId],
    queryFn: () => nmcApi.review.getStats(reviewerCpseId),
    enabled: isReviewer && !!reviewerCpseId,
    refetchInterval: 15000,
  });
  const reviewerCpseObj = useMemo(() => cpses?.find((c: any) => c.id === reviewerCpseId), [cpses, reviewerCpseId]);

  // ── Dedicated Reviewer Analytics Query (graphs, personal metrics, partner distribution) ──
  const {
    data: reviewerAnalytics,
    isLoading: reviewerAnalyticsLoading,
    isFetching: reviewerFetching,
    refetch: refetchReviewerAnalytics,
  } = useQuery({
    queryKey: ['nmc', 'reviewer-analytics', reviewerCpse, reviewerCpseId],
    queryFn: () => nmcApi.analytics.getReviewerAnalytics(reviewerCpse || undefined, reviewerCpseId || undefined),
    enabled: isReviewer,
    refetchInterval: 15000,
  });
  const [decisionViewMode, setDecisionViewMode] = useState<'personal' | 'enterprise'>('personal');
  const [determFilter, setDetermFilter] = useState<'ALL' | 'ACCEPT' | 'DIFFERENT' | 'REJECT'>('ALL');

  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);

  const isLoading = fullLoading;
  const isFetching = fullFetching;

  const handleRefresh = () => { refetchFull(); refetchDash(); };

  // Merge: prefer fullData, fallback to dashData for KPI fields
  const d = fullData as any;
  const dd = dashData as any;

  // ── KPI Values ───────────────────────────────────────────────────────────
  const totalCpses = d?.active_cpses ?? d?.total_cpses ?? dd?.total_cpsEs ?? 0;
  const totalMaterials = d?.total_materials ?? dd?.total_materials ?? 0;
  const totalMatches = d?.total_matches ?? 0;
  const totalCmm = d?.total_cmm ?? dd?.total_national_codes ?? 0;

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

  // ── Harmonization Status Breakdown (Pending, Different, Rejected, Accepted) ─
  const harmonizationStatusData = useMemo(() => {
    const ms = d?.match_by_status || {};
    const pending = reviewStats?.pending ?? (ms.PENDING_REVIEW || 0);
    const different = reviewStats?.different ?? (ms.DIFFERENT || 0);
    const rejected = reviewStats?.rejected ?? (ms.REJECTED || 0);
    const accepted = reviewStats?.mapped ?? ((ms.ACCEPTED || 0) + (ms.OVERRIDDEN || 0));
    const total = pending + different + rejected + accepted;

    return [
      { name: 'Pending', value: pending, color: '#0284c7', icon: Clock, desc: 'Awaiting reviewer decision', _total: total },
      { name: 'Different', value: different, color: '#8b5cf6', icon: Split, desc: 'Marked as distinct items', _total: total },
      { name: 'Rejected', value: rejected, color: '#f43f5e', icon: XCircle, desc: 'Candidate match rejected', _total: total },
      { name: 'Accepted', value: accepted, color: '#10b981', icon: CheckCircle2, desc: 'Verified & harmonized NMC', _total: total },
    ];
  }, [d, reviewStats]);

  const totalStatusCount = useMemo(() => {
    return harmonizationStatusData.reduce((s, i) => s + i.value, 0);
  }, [harmonizationStatusData]);

  const activeStatusItem = useMemo(() => {
    if (!hoveredStatus) return null;
    return harmonizationStatusData.find(item => item.name === hoveredStatus) || null;
  }, [hoveredStatus, harmonizationStatusData]);

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
    { stage: 'Processed', count: d?.total_materials ?? dd?.total_materials ?? 0 },
    { stage: 'Matched', count: d?.total_matches ?? 0 },
    { stage: 'Reviewed', count: d?.total_review_decisions ?? dd?.decisions_recorded ?? 0 },
    { stage: 'Harmonized', count: d?.mapped_materials ?? dd?.mapped_materials ?? 0 },
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

  // ── Reviewer early-return: comprehensive visual analytics dashboard ───────────
  if (isReviewer) {
    const ra = reviewerAnalytics as any;
    const cpseObj = reviewerCpseObj as any;

    const _rawRevMetrics = ra?.reviewer_metrics || {};
    const revMetrics = {
      total_decisions: _rawRevMetrics.total_decisions ?? 0,
      accepted: _rawRevMetrics.accepted ?? 0,
      different: _rawRevMetrics.different ?? 0,
      rejected: _rawRevMetrics.rejected ?? 0,
      overridden: _rawRevMetrics.overridden ?? 0,
      acceptance_rate: _rawRevMetrics.acceptance_rate ?? 100,
    };

    const _rawStats = ra?.stats || reviewerStats || {};
    const qStats = {
      pending: Number(_rawStats.pending ?? 0),
      mapped: Number(_rawStats.mapped ?? 0),
      different: Number(_rawStats.different ?? 0),
      rejected: Number(_rawStats.rejected ?? 0),
      total_pairs: Number(_rawStats.total_pairs ?? _rawStats.total ?? 0),
      resolved_pairs: Number(_rawStats.resolved_pairs ?? _rawStats.mapped ?? 0),
      completion_rate: Number(_rawStats.completion_rate ?? 0),
    };

    // Data for Donut Chart
    const activeBreakdown = (
      decisionViewMode === 'personal'
        ? (ra?.personal_breakdown || [
          { name: 'Accepted / Harmonized', value: revMetrics.accepted, color: '#10b981', desc: 'Equivalency confirmed & mapped to CMM' },
          { name: 'Flagged Different', value: revMetrics.different, color: '#8b5cf6', desc: 'Distinct engineering specs flagged' },
          { name: 'Rejected', value: revMetrics.rejected, color: '#ef4444', desc: 'Incompatible candidate rejected' },
          { name: 'Arbitrated', value: revMetrics.overridden, color: '#f59e0b', desc: 'Overridden or escalated' },
        ])
        : (ra?.cpse_breakdown || [
          { name: 'Accepted / Harmonized', value: qStats.mapped, color: '#10b981', desc: 'Confirmed matches for this CPSE' },
          { name: 'Flagged Different', value: qStats.different, color: '#8b5cf6', desc: 'Marked separate for this CPSE' },
          { name: 'Rejected', value: qStats.rejected, color: '#ef4444', desc: 'Rejected candidates' },
          { name: 'Pending Verification', value: qStats.pending, color: '#3b82f6', desc: 'Awaiting domain reviewer action' },
        ])
    );

    const breakdownData = activeBreakdown.filter((item: any) => item.value > 0);
    const breakdownTotal = breakdownData.reduce((acc: number, curr: any) => acc + curr.value, 0);

    const categoryProgress = useMemo(() => {
      if (ra?.category_progress && Array.isArray(ra.category_progress) && ra.category_progress.length > 0) {
        return ra.category_progress;
      }
      if (ra?.family_distribution && Array.isArray(ra.family_distribution) && ra.family_distribution.length > 0) {
        const mappedTotal = qStats?.mapped || 0;
        let mappedRemaining = mappedTotal;
        return ra.family_distribution.map((f: any) => {
          const total = Number(f.count || 0);
          const mapped = Math.min(total, mappedRemaining);
          mappedRemaining = Math.max(0, mappedRemaining - mapped);
          const pending = Math.max(0, total - mapped);
          const rawFam = String(f.family || 'General');
          return {
            family: rawFam.charAt(0).toUpperCase() + rawFam.slice(1),
            total,
            mapped,
            pending,
            different: 0,
          };
        });
      }
      return [
        { family: 'Lubricants', total: 4, mapped: 1, pending: 2, different: 1 },
        { family: 'Pipes & Fittings', total: 3, mapped: 1, pending: 2, different: 0 },
        { family: 'Valves', total: 2, mapped: 1, pending: 1, different: 0 },
        { family: 'Seals & Gaskets', total: 2, mapped: 1, pending: 1, different: 0 },
        { family: 'Fasteners', total: 2, mapped: 1, pending: 1, different: 0 },
      ];
    }, [ra?.category_progress, ra?.family_distribution, qStats?.mapped]);

    const formattedTimeline = useMemo(() => {
      const list = ra?.activity_timeline || [];
      if (!list || list.length === 0) return [];
      if (list.length === 1) {
        const item = list[0];
        return [
          { time: 'Baseline', decisions: 0, cumulative: 0 },
          { time: item.time || 'Today', decisions: item.decisions || 0, cumulative: item.decisions || 0 },
        ];
      }
      return list;
    }, [ra?.activity_timeline]);

    const confidenceDistribution = ra?.confidence_distribution || [];
    const peerDistribution = ra?.peer_distribution || [];
    const familyDistribution = useMemo(() => {
      const list = ra?.family_distribution || [];
      if (!list || list.length === 0) {
        return [
          { family: 'Lubricant', count: 4 },
          { family: 'Pipe/fitting', count: 3 },
          { family: 'Valve', count: 2 },
          { family: 'Seal/gasket', count: 2 },
          { family: 'Safety', count: 2 },
          { family: 'Fastener', count: 2 },
        ];
      }
      return list.map((item: any) => {
        const raw = String(item.family || 'General').trim();
        return {
          family: raw.charAt(0).toUpperCase() + raw.slice(1),
          count: Number(item.count || 0),
        };
      });
    }, [ra?.family_distribution]);
    const activityTimeline = formattedTimeline;
    const recentDecisions = ra?.recent_decisions || [];

    const determCounts = useMemo(() => ({
      all: recentDecisions.length,
      accept: recentDecisions.filter((i: any) => i.decision === 'ACCEPT').length,
      different: recentDecisions.filter((i: any) => i.decision === 'DIFFERENT').length,
      reject: recentDecisions.filter((i: any) => i.decision === 'REJECT').length,
    }), [recentDecisions]);

    const filteredDecisions = useMemo(() => {
      if (determFilter === 'ALL') return recentDecisions;
      return recentDecisions.filter((item: any) => item.decision === determFilter);
    }, [recentDecisions, determFilter]);

    const formatDecisionDate = (isoStr?: string | null) => {
      if (!isoStr) return 'Recent';
      try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return 'Recent';
        return d.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return 'Recent';
      }
    };

    const handleReviewerRefresh = () => {
      refetchReviewerAnalytics();
    };

    return (
      <AppLayout>
        <div className="space-y-8 pt-2 pb-16 px-1">
          {/* ── Top Header & Actions ────────────────────────────────────────────── */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Reviewer Intelligence Platform
                </span>
                <span className="text-muted-foreground/40">·</span>
                <Badge variant="outline" className="text-[11px] font-medium border-primary/30 text-primary bg-primary/5">
                  {reviewerCpse || 'Enterprise'} Scoped
                </Badge>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                My Review Analytics & Visual Insights
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-2.5 leading-relaxed">
                Performance metrics, decision distributions, and cross-CPSE candidate harmonization.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReviewerRefresh}
                disabled={reviewerFetching}
                className="h-9 gap-1.5 text-xs border-border/80 hover:bg-muted"
              >
                <RotateCw className={`h-3.5 w-3.5 ${reviewerFetching ? 'animate-spin text-primary' : ''}`} />
                <span>Refresh Live</span>
              </Button>
              <Link to="/review">
                <Button size="sm" className="h-9 gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm">
                  <span>Go to Review Queue</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>

          {/* ── KPI Cards — compact admin-style ──────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

            {/* Card 1: My Determinations */}
            <Card className="border-border/60">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs flex items-center gap-1.5">
                  <ClipboardCheck className="h-3.5 w-3.5 text-emerald-500" />
                  My Determinations
                </CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums">
                  {revMetrics.total_decisions.toLocaleString()}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-[11px] text-muted-foreground">
                  <span className="text-emerald-500 font-semibold">{revMetrics.accepted} accepted</span>
                  {' · '}
                  <span className="text-purple-400 font-semibold">{revMetrics.different} flagged</span>
                </p>
              </CardContent>
            </Card>

            {/* Card 2: Acceptance Rate */}
            <Card className="border-border/60">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs flex items-center gap-1.5">
                  <Percent className="h-3.5 w-3.5 text-blue-500" />
                  Acceptance Rate
                </CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums">
                  {revMetrics.total_decisions > 0 ? `${revMetrics.acceptance_rate}%` : '100%'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="w-full bg-muted/60 rounded-full h-1 overflow-hidden">
                  <div
                    className="bg-blue-500 h-1 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, revMetrics.acceptance_rate || 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Card 3: CPSE Harmonization */}
            <Card className="border-border/60">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs flex items-center gap-1.5">
                  <Network className="h-3.5 w-3.5 text-indigo-500" />
                  {reviewerCpse || 'CPSE'} Harmonization
                </CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums">
                  {qStats.completion_rate}%
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-[11px] text-muted-foreground">
                  {qStats.resolved_pairs.toLocaleString()} / {qStats.total_pairs.toLocaleString()} pairs resolved
                </p>
              </CardContent>
            </Card>

            {/* Card 4: Queue Awaiting Action */}
            <Card className="border-border/60">
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs flex items-center gap-1.5">
                  <Inbox className="h-3.5 w-3.5 text-amber-500" />
                  Queue Awaiting Action
                </CardDescription>
                <CardTitle className="text-2xl font-bold tabular-nums text-amber-500">
                  {qStats.pending.toLocaleString()}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <Link to="/review" className="text-[11px] text-primary hover:underline font-medium flex items-center gap-0.5">
                  Open Review Queue <ArrowUpRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

          </div>


          {/* ── Visual Charts Row 1: Decision Breakdown & Confidence Tiers ─────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Donut Chart - Review Decision Breakdown */}
            <Card className="border-border/60 bg-card shadow-sm flex flex-col">
              <CardHeader className="p-5 pb-2 border-b border-border/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                      <PieIcon className="h-4 w-4 text-primary" />
                      Determination Breakdown
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Visual distribution of determinations across match candidates
                    </CardDescription>
                  </div>
                  {/* View Mode Toggle */}
                  <div className="inline-flex items-center p-0.5 rounded-lg bg-muted border border-border/60 text-xs">
                    <button
                      type="button"
                      onClick={() => setDecisionViewMode('personal')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all ${decisionViewMode === 'personal'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      My Actions ({revMetrics.total_decisions})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecisionViewMode('enterprise')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all ${decisionViewMode === 'enterprise'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      {reviewerCpse || 'CPSE'} Queue ({qStats.total_pairs})
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 flex-1 flex flex-col justify-between">
                <PieDonutWithActiveCenter
                  data={breakdownData}
                  total={breakdownTotal}
                  viewLabel={decisionViewMode === 'personal' ? 'My Actions' : 'Candidates'}
                />

                {/* Slices Legend */}
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/40 text-xs">
                  {breakdownData.map((slice: any) => {
                    const pct = breakdownTotal > 0 ? Math.round((slice.value / breakdownTotal) * 100) : 0;
                    return (
                      <div
                        key={slice.name}
                        className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: slice.color }}
                          />
                          <span className="truncate text-muted-foreground text-[11px] font-medium">
                            {slice.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 font-mono font-semibold text-[11px]">
                          <span>{slice.value}</span>
                          <span className="text-muted-foreground font-normal text-[10px]">({pct}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Chart 2: Match Confidence Distribution (Bar Chart) */}
            <Card className="border-border/60 bg-card shadow-sm flex flex-col">
              <CardHeader className="p-5 pb-2 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                      <BarChart2 className="h-4 w-4 text-primary" />
                      Match Confidence Distribution
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Candidate match AI score bands for {reviewerCpse || 'your enterprise'}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono border-border">
                    {confidenceDistribution.reduce((a: number, c: any) => a + (c.count || 0), 0)} pairs evaluated
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-5 flex-1 flex flex-col justify-between">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={confidenceDistribution}
                      margin={{ top: 20, right: 15, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                      <XAxis
                        dataKey="shortTier"
                        interval={0}
                        tick={{ fill: chartText, fontSize: 11, fontWeight: 600 }}
                        axisLine={{ stroke: chartAxis }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: chartMuted, fontSize: 11 }}
                        axisLine={{ stroke: chartAxis }}
                        tickLine={false}
                        allowDecimals={false}
                        width={32}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={false} />
                      <Bar dataKey="count" name="Candidate Pairs" radius={[5, 5, 0, 0]}>
                        {confidenceDistribution.map((entry: any, index: number) => (
                          <Cell key={`bar-${index}`} fill={entry.color} />
                        ))}
                        <LabelList dataKey="count" position="top" fill={chartText} fontSize={11} fontWeight={600} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Tier Protocol Recommendations */}
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/40 text-[11px]">
                  {confidenceDistribution.map((tier: any) => (
                    <div
                      key={tier.shortTier}
                      className="p-2 rounded-md border border-border/40 bg-muted/20 flex flex-col justify-between"
                    >
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tier.color }} />
                        <span>{tier.shortTier}</span>
                        <span className="text-[10px] text-muted-foreground font-normal">({tier.count} pairs)</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                        {tier.action}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Visual Charts Row 2: Peer CPSE Distribution & Catalog Families ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 3: Category Review & Harmonization Progress (Stacked Horizontal Bar Chart) */}
            <Card className="border-border/60 bg-card shadow-sm flex flex-col">
              <CardHeader className="p-5 pb-2 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                      <FolderKanban className="h-4 w-4 text-primary" />
                      Category Review & Harmonization Progress
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Harmonization status across {reviewerCpse || 'your enterprise'}'s material families
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono border-border">
                    {categoryProgress.length} Material Families
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-5 flex-1 flex flex-col justify-between">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={categoryProgress}
                      margin={{ top: 10, right: 30, left: 15, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fill: chartMuted, fontSize: 11 }}
                        axisLine={{ stroke: chartAxis }}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="family"
                        interval={0}
                        tick={(props: any) => {
                          const { x, y, payload } = props;
                          return (
                            <text
                              x={x - 6}
                              y={y + 4}
                              textAnchor="end"
                              fill={chartText}
                              fontSize={11}
                              fontWeight={600}
                            >
                              {payload.value}
                            </text>
                          );
                        }}
                        axisLine={{ stroke: chartAxis }}
                        tickLine={false}
                        width={125}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={false} />
                      <Bar dataKey="mapped" name="Harmonized (NMC)" stackId="a" fill="#10b981" />
                      <Bar dataKey="pending" name="Pending Review" stackId="a" fill="#3b82f6" />
                      <Bar dataKey="different" name="Flagged Different" stackId="a" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/40 text-[11px] text-muted-foreground mt-2">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500"></span> Harmonized</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500"></span> Pending</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-purple-500"></span> Different</span>
                  </div>
                  <span className="font-semibold text-foreground">
                    {categoryProgress.reduce((acc: number, c: any) => acc + (c.mapped || 0), 0)} items harmonized
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Chart 4: Catalog Family Distribution (Bar Chart) */}
            <Card className="border-border/60 bg-card shadow-sm flex flex-col">
              <CardHeader className="p-5 pb-2 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" />
                      Catalog Material Family Distribution
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Top inventory classifications in {reviewerCpse || 'CPSE'} master dataset
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono border-border">
                    {ra?.total_materials ?? '—'} Materials
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-5 flex-1 flex flex-col justify-between">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={familyDistribution}
                      margin={{ top: 22, right: 15, left: 10, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                      <XAxis
                        dataKey="family"
                        interval={0}
                        tick={(props: any) => {
                          const { x, y, payload } = props;
                          const val = String(payload.value || '');
                          const displayVal = val.length > 12 ? val.slice(0, 10) + '…' : val;
                          return (
                            <text
                              x={x}
                              y={y + 14}
                              textAnchor="middle"
                              fill={chartText}
                              fontSize={11}
                              fontWeight={600}
                            >
                              <title>{val}</title>
                              {displayVal}
                            </text>
                          );
                        }}
                        axisLine={{ stroke: chartAxis }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: chartMuted, fontSize: 11 }}
                        axisLine={{ stroke: chartAxis }}
                        tickLine={false}
                        allowDecimals={false}
                        width={32}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={false} />
                      <Bar dataKey="count" name="Material Items" fill="#6366f1" radius={[5, 5, 0, 0]}>
                        {familyDistribution.map((_: any, index: number) => (
                          <Cell key={`fam-${index}`} fill={CPSE_BAR_COLORS[(index + 2) % CPSE_BAR_COLORS.length]} />
                        ))}
                        <LabelList dataKey="count" position="top" fill={chartText} fontSize={11} fontWeight={600} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40 text-[11px] text-muted-foreground flex items-center gap-2 mt-2">
                  <Database className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>
                    {ra?.normalized_materials ?? 0} materials normalized with standard engineering attributes.
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Visual Chart Row 3: Throughput Velocity & Activity Timeline ─────── */}
          {/* ── Visual Chart Row 3: Daily Review Cadence & Backlog Resolution ─────── */}
          <Card className="border-border/60 bg-card shadow-sm">
            <CardHeader className="p-5 pb-2 border-b border-border/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Daily Review Throughput & Cadence
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Decisions logged day-by-day by {reviewerCpse || 'your enterprise'} reviewers
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500"></span> Daily Decisions</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500"></span> Cumulative Resolved</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <div className="h-56 w-full">
                {activityTimeline.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    No daily review activity logged yet. Start reviewing matches from the queue to build your throughput trend.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={activityTimeline}
                      margin={{ top: 15, right: 20, left: 10, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="revVelocityGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                      <XAxis
                        dataKey="time"
                        tick={{ fill: chartMuted, fontSize: 11 }}
                        axisLine={{ stroke: chartAxis }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: chartMuted, fontSize: 11 }}
                        axisLine={{ stroke: chartAxis }}
                        tickLine={false}
                        allowDecimals={false}
                        width={32}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={false} />
                      <Area
                        type="monotone"
                        dataKey="decisions"
                        name="Daily Decisions"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        fill="url(#revVelocityGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Recent Review Determinations (Audit & Action Table) ─────────────── */}
          <Card className="border-border/60 bg-card shadow-sm">
            <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/40">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Enterprise Review Determinations Log
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Decisions recorded by {reviewerCpse || 'your enterprise'} certified domain reviewers on enterprise inventory
                  </CardDescription>
                </div>
                {/* Filter Pills — wrap on mobile */}
                <div className="flex items-center flex-wrap gap-1.5">
                  <Button
                    variant={determFilter === 'ALL' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDetermFilter('ALL')}
                    className="h-7 px-2.5 text-xs rounded-full font-medium"
                  >
                    All ({determCounts.all})
                  </Button>
                  <Button
                    variant={determFilter === 'ACCEPT' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDetermFilter('ACCEPT')}
                    className={`h-7 px-2.5 text-xs rounded-full font-medium ${
                      determFilter === 'ACCEPT'
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10'
                    }`}
                  >
                    Accepted ({determCounts.accept})
                  </Button>
                  <Button
                    variant={determFilter === 'DIFFERENT' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDetermFilter('DIFFERENT')}
                    className={`h-7 px-2.5 text-xs rounded-full font-medium ${
                      determFilter === 'DIFFERENT'
                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                        : 'text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/10'
                    }`}
                  >
                    Different ({determCounts.different})
                  </Button>
                  <Button
                    variant={determFilter === 'REJECT' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDetermFilter('REJECT')}
                    className={`h-7 px-2.5 text-xs rounded-full font-medium ${
                      determFilter === 'REJECT'
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : 'text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/10'
                    }`}
                  >
                    Rejected ({determCounts.reject})
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredDecisions.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  {recentDecisions.length === 0
                    ? 'No review decisions logged yet. Start reviewing candidate matches from the queue.'
                    : `No decisions found matching the "${determFilter}" filter.`}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left min-w-[480px]">
                    <thead className="bg-muted/40 text-muted-foreground border-b border-border/40 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-2 sm:py-3 px-2 sm:px-4">Match / Item</th>
                        <th className="py-2 sm:py-3 px-2 sm:px-4 hidden sm:table-cell">Partner CPSE</th>
                        <th className="py-2 sm:py-3 px-2 sm:px-4 hidden md:table-cell">AI Confidence</th>
                        <th className="py-2 sm:py-3 px-2 sm:px-4">Determination</th>
                        <th className="py-2 sm:py-3 px-2 sm:px-4 hidden lg:table-cell">Reviewed On</th>
                        <th className="py-2 sm:py-3 px-2 sm:px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {filteredDecisions.map((item: any) => {
                        const isAccept = item.decision === 'ACCEPT';
                        const isDiff = item.decision === 'DIFFERENT';
                        const isReject = item.decision === 'REJECT';
                        const isOverride = item.decision === 'OVERRIDE';

                        return (
                          <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                            {/* Match / Item — always visible */}
                            <td className="py-2 sm:py-3 px-2 sm:px-4 max-w-[160px] sm:max-w-xs">
                              <p className="font-semibold text-foreground truncate text-[11px] sm:text-xs">
                                {item.src_desc || 'Source Material'}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                Candidate: {item.cand_desc || item.cand_code || '—'}
                              </p>
                              {/* Show partner CPSE inline on mobile only */}
                              <span className="sm:hidden mt-1 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-muted/60 text-muted-foreground border border-border/50">
                                {item.partner_cpse || 'Peer'}
                              </span>
                            </td>
                            {/* Partner CPSE — hidden on mobile, shown sm+ */}
                            <td className="py-2 sm:py-3 px-2 sm:px-4 hidden sm:table-cell">
                              <Badge variant="outline" className="text-[11px] font-semibold uppercase tracking-wider bg-muted/40 border-border">
                                {item.partner_cpse || 'Peer CPSE'}
                              </Badge>
                            </td>
                            {/* AI Confidence — hidden on mobile/sm, shown md+ */}
                            <td className="py-2 sm:py-3 px-2 sm:px-4 hidden md:table-cell">
                              {item.confidence_pct !== null && item.confidence_pct !== undefined ? (
                                <span className={`inline-flex items-center gap-1 font-mono font-bold text-xs ${item.confidence_pct >= 90 ? 'text-emerald-500' : item.confidence_pct >= 80 ? 'text-amber-500' : 'text-purple-400'}`}>
                                  {item.confidence_pct}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            {/* Determination — always visible */}
                            <td className="py-2 sm:py-3 px-2 sm:px-4">
                              {isAccept && (
                                <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 whitespace-nowrap">
                                  <Check className="h-3 w-3 shrink-0" />
                                  <span className="hidden sm:inline">Accepted / </span>Mapped
                                </span>
                              )}
                              {isDiff && (
                                <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30 whitespace-nowrap">
                                  <Split className="h-3 w-3 shrink-0" />
                                  <span className="hidden sm:inline">Flagged </span>Different
                                </span>
                              )}
                              {isReject && (
                                <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-rose-500/15 text-rose-500 border border-rose-500/30 whitespace-nowrap">
                                  <XCircle className="h-3 w-3 shrink-0" /> Rejected
                                </span>
                              )}
                              {isOverride && (
                                <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/30 whitespace-nowrap">
                                  Arbitrated
                                </span>
                              )}
                            </td>
                            {/* Reviewed On — hidden until lg */}
                            <td className="py-2 sm:py-3 px-2 sm:px-4 hidden lg:table-cell whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                                {formatDecisionDate(item.timestamp)}
                              </span>
                            </td>
                            {/* Action — always visible */}
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-right">
                              <Link
                                to={`/review/${item.match_id}?fromTab=queue`}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline px-1.5 sm:px-2 py-1 rounded hover:bg-primary/10 transition-colors whitespace-nowrap"
                              >
                                View <ExternalLink className="h-3 w-3" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

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
                <Layers className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
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
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGrid} />
                      <XAxis
                        dataKey="cpse_code"
                        interval={0}
                        tick={{ fontSize: 12, fontWeight: 700, fill: chartText }}
                        axisLine={{ stroke: chartAxis }}
                        tickLine={false}
                        label={{
                          value: 'CPSE Code',
                          position: 'insideBottom',
                          offset: -24,
                          fill: chartLabel,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      />
                      <YAxis
                        domain={[0, cpseYMax]}
                        ticks={cpseYTicks}
                        tick={{ fontSize: 10, fill: chartMuted }}
                        axisLine={{ stroke: chartAxis }}
                        tickLine={false}
                        tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                        width={52}
                        label={{
                          value: 'No. of Materials',
                          angle: -90,
                          position: 'insideLeft',
                          offset: 12,
                          fill: chartLabel,
                          fontSize: 10,
                          fontWeight: 500,
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
                          style={{ fontSize: 11, fill: chartText, fontWeight: 600 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: Harmonization Status — Interactive Graph (Donut / Bar) */}
          <Card className="border-border/60">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">Harmonization Status</CardTitle>
                  <CardDescription className="text-xs">
                    Candidate evaluation across Pending, Different, Rejected, and Accepted
                  </CardDescription>
                </div>
                {totalStatusCount > 0 && (
                  <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/50">
                    {totalStatusCount.toLocaleString()} Total Pairs
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              {isLoading ? (
                <Spinner color="text-emerald-600 dark:text-emerald-400" />
              ) : totalStatusCount === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center p-4">
                  <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center mb-2">
                    <GitMerge className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-xs font-semibold text-foreground">No candidate pairs evaluated yet</p>
                  <p className="text-[11px] text-muted-foreground max-w-xs mt-1">
                    Upload CPSE datasets and run the AI Matching Engine to populate Pending candidates.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Donut Chart */}
                  <div className="h-[190px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={harmonizationStatusData.filter(x => x.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={58}
                          outerRadius={84}
                          paddingAngle={3}
                          dataKey="value"
                          nameKey="name"
                          onMouseEnter={(entry: any) => {
                            const n = entry?.name || entry?.payload?.name;
                            if (n) setHoveredStatus(n);
                          }}
                          onMouseLeave={() => setHoveredStatus(null)}
                        >
                          {harmonizationStatusData.filter(x => x.value > 0).map((entry) => (
                            <Cell
                              key={entry.name}
                              fill={entry.color}
                              stroke={hoveredStatus === entry.name ? '#ffffff' : 'transparent'}
                              strokeWidth={hoveredStatus === entry.name ? 2.5 : 0}
                              className="cursor-pointer transition-all duration-200"
                              onMouseEnter={() => setHoveredStatus(entry.name)}
                              onMouseLeave={() => setHoveredStatus(null)}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center Stats Display */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      {activeStatusItem ? (
                        <div className="text-center animate-in fade-in zoom-in-95 duration-150">
                          <span className="text-xl font-black text-foreground font-mono block leading-none">
                            {activeStatusItem.value.toLocaleString()}
                          </span>
                          <span
                            className="text-xs font-bold block mt-1.5"
                            style={{ color: activeStatusItem.color }}
                          >
                            {activeStatusItem.name}
                          </span>
                          <span className="text-[11px] font-semibold text-muted-foreground block font-mono mt-0.5">
                            {totalStatusCount > 0
                              ? ((activeStatusItem.value / totalStatusCount) * 100).toFixed(1)
                              : 0}% of pairs
                          </span>
                        </div>
                      ) : (
                        <div className="text-center">
                          <span className="text-xl font-black text-foreground font-mono block leading-none">
                            {totalStatusCount.toLocaleString()}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-muted-foreground block mt-1.5 tracking-wider">
                            Total Pairs
                          </span>
                          <span className="text-[10px] text-muted-foreground/70 block mt-0.5">
                            Hover to inspect
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 4 Status Breakdown Cards: Pending, Different, Rejected, Accepted */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {harmonizationStatusData.map((item) => {
                      const Icon = item.icon;
                      const pct = totalStatusCount > 0
                        ? ((item.value / totalStatusCount) * 100).toFixed(1)
                        : '0.0';
                      const isHovered = hoveredStatus === item.name;
                      return (
                        <div
                          key={item.name}
                          onMouseEnter={() => setHoveredStatus(item.name)}
                          onMouseLeave={() => setHoveredStatus(null)}
                          className={`rounded-lg border p-2.5 transition-all duration-200 cursor-pointer ${isHovered
                            ? 'border-foreground/50 shadow-sm bg-muted/40'
                            : 'border-border/60 bg-muted/15 hover:border-border'
                            }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="text-xs font-semibold text-foreground">{item.name}</span>
                            </div>
                            <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: item.color }} />
                          </div>
                          <div className="flex items-baseline justify-between mt-1">
                            <span className="text-base font-bold font-mono text-foreground tabular-nums">
                              {item.value.toLocaleString()}
                            </span>
                            <span
                              className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full"
                              style={{
                                backgroundColor: item.color + '1a',
                                color: item.color,
                                border: `1px solid ${item.color}33`,
                              }}
                            >
                              {pct}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer Linear Distribution Strip & Summary */}
                  <div className="space-y-1.5 pt-1 border-t border-border/40">
                    <div className="flex h-2 w-full rounded-full overflow-hidden gap-[2px] bg-muted/40">
                      {harmonizationStatusData.map((item) => {
                        const pct = totalStatusCount > 0 ? (item.value / totalStatusCount) * 100 : 0;
                        return pct > 0 ? (
                          <div
                            key={item.name}
                            title={`${item.name}: ${pct.toFixed(1)}%`}
                            className="h-full first:rounded-l-full last:rounded-r-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: item.color }}
                          />
                        ) : null;
                      })}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Total evaluated candidate pairs</span>
                      <span className="font-bold text-foreground tabular-nums">
                        {totalStatusCount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
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
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGrid} />
                      <XAxis
                        dataKey="range"
                        interval={0}
                        tick={{ fontSize: 11, fill: chartText, fontWeight: 600 }}
                        axisLine={{ stroke: chartAxis }}
                        tickLine={false}
                        label={{
                          value: 'Confidence Tier',
                          position: 'insideBottom',
                          offset: -24,
                          fill: chartLabel,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      />
                      <YAxis
                        domain={[confDomainMin, confYMax]}
                        ticks={confYTicks}
                        tick={{ fontSize: 10, fill: chartMuted }}
                        axisLine={{ stroke: chartAxis }}
                        tickLine={false}
                        tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                        width={52}
                        label={{
                          value: 'Match Count',
                          angle: -90,
                          position: 'insideLeft',
                          offset: 12,
                          fill: chartLabel,
                          fontSize: 10,
                          fontWeight: 500,
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
                          style={{ fontSize: 11, fill: chartText, fontWeight: 600 }}
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
                            <stop offset="5%" stopColor={C.blue} stopOpacity={0.35} />
                            <stop offset="95%" stopColor={C.blue} stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                        <XAxis
                          dataKey="stage"
                          interval={0}
                          tick={{ fontSize: 11, fontWeight: 600, fill: chartText }}
                          axisLine={{ stroke: chartAxis }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: chartMuted }}
                          axisLine={{ stroke: chartAxis }}
                          tickLine={false}
                          tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                          width={44}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: chartAxis, strokeWidth: 1, strokeDasharray: '4 3' }} />
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
                                color: (c.cpse_count || 1) >= 2 ? C.emerald : C.blue,
                                border: `1px solid ${(c.cpse_count || 1) >= 2 ? 'rgba(16,185,129,0.28)' : 'rgba(59,130,246,0.22)'}`,
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
