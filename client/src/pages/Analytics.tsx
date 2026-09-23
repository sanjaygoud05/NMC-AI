import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { nmcApi } from '@/services/nmcApi';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import {
  Building2, Database, CheckCircle2, GitMerge, Layers, ClipboardList,
  RotateCw, TrendingUp, ShieldCheck, ArrowRight, Link2, ExternalLink,
  AlertCircle,
} from 'lucide-react';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  pending:   '#f59e0b',
  accepted:  '#10b981',
  rejected:  '#ef4444',
  different: '#6366f1',
  mapped:    '#3b82f6',
  unmapped:  '#e2e8f0',
  high:      '#22c55e',
  medium:    '#f59e0b',
  low:       '#ef4444',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pct = (num: number, den: number) =>
  den > 0 ? `${Math.round((num / den) * 100)}%` : '0%';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-xl text-xs space-y-1">
      {label !== undefined && <p className="font-semibold text-foreground mb-1">{label}</p>}
      {payload.map((e: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: e.color || e.fill }} />
          <span className="text-muted-foreground">{e.name}:</span>
          <span className="font-semibold text-foreground">
            {typeof e.value === 'number' ? e.value.toLocaleString() : e.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent: string;
}) {
  return (
    <Card className="border-border/60 hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`mt-0.5 rounded-lg p-2 shrink-0 ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide leading-none">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{value ?? '—'}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  title, description, children, action,
}: {
  title: string; description?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2 flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
          {description && <CardDescription className="text-xs mt-0.5">{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

// ─── Empty / Loading states ───────────────────────────────────────────────────
const Loading = () => (
  <div className="h-32 flex items-center justify-center text-xs text-muted-foreground gap-2">
    <RotateCw className="h-3.5 w-3.5 animate-spin" /> Loading…
  </div>
);
const Empty = ({ msg = 'No data available yet.' }: { msg?: string }) => (
  <div className="h-32 flex items-center justify-center text-xs text-muted-foreground gap-2">
    <AlertCircle className="h-3.5 w-3.5" /> {msg}
  </div>
);

// ─── Pipeline Funnel ──────────────────────────────────────────────────────────
function PipelineFunnel({ stages }: { stages: { stage: string; count: number; color: string }[] }) {
  if (!stages?.length) return <Empty />;
  const max = Math.max(...stages.map(s => s.count), 1);
  return (
    <div className="space-y-2 py-2">
      {stages.map((s, i) => {
        const widthPct = Math.max(20, Math.round((s.count / max) * 100));
        return (
          <div key={i} className="flex items-center gap-3">
            <div className="text-[11px] text-muted-foreground w-44 text-right shrink-0 font-medium">{s.stage}</div>
            <div className="flex-1 relative h-7 bg-muted/30 rounded overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full rounded flex items-center px-2 transition-all"
                style={{ width: `${widthPct}%`, background: s.color, opacity: 0.9 }}
              />
              <span className="absolute left-3 top-0 h-full flex items-center text-[11px] font-bold text-white z-10">
                {s.count.toLocaleString()}
              </span>
            </div>
            {i < stages.length - 1 && (
              <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Network Graph (SVG-based, no extra library) ──────────────────────────────
function CpseNetworkGraph({
  pairs,
  cpseMatDist,
}: {
  pairs: { source_cpse: string; target_cpse: string; match_count: number; avg_confidence: number | null }[];
  cpseMatDist: { cpse_code: string; material_count: number }[];
}) {
  const nodes = useMemo(() => {
    const codes = new Set<string>();
    pairs.forEach(p => { codes.add(p.source_cpse); codes.add(p.target_cpse); });
    cpseMatDist.forEach(d => codes.add(d.cpse_code));
    const matMap = Object.fromEntries(cpseMatDist.map(d => [d.cpse_code, d.material_count]));
    const arr = Array.from(codes);
    const maxMat = Math.max(...arr.map(c => matMap[c] || 0), 1);
    const cx = 300, cy = 160, r = 120;
    return arr.map((code, i) => {
      const angle = (2 * Math.PI * i) / arr.length - Math.PI / 2;
      const matCount = matMap[code] || 0;
      const nodeR = 22 + Math.round((matCount / maxMat) * 18);
      return {
        code,
        x: arr.length === 1 ? cx : cx + r * Math.cos(angle),
        y: arr.length === 1 ? cy : cy + r * Math.sin(angle),
        matCount,
        nodeR,
      };
    });
  }, [pairs, cpseMatDist]);

  const maxMatch = Math.max(...pairs.map(p => p.match_count), 1);

  if (!pairs.length && !cpseMatDist.length) return <Empty msg="No cross-CPSE relationships yet." />;

  const nodeMap = Object.fromEntries(nodes.map(n => [n.code, n]));

  return (
    <div className="flex flex-col items-center">
      <svg width="100%" viewBox="0 0 600 320" className="max-w-2xl">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Edges */}
        {pairs.map((p, i) => {
          const src = nodeMap[p.source_cpse];
          const tgt = nodeMap[p.target_cpse];
          if (!src || !tgt) return null;
          const strokeW = 1.5 + Math.round((p.match_count / maxMatch) * 6);
          return (
            <g key={i}>
              <line
                x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                stroke="#6366f1" strokeWidth={strokeW} strokeOpacity={0.45}
                strokeDasharray={p.match_count < 10 ? '4 4' : undefined}
              />
              <text
                x={(src.x + tgt.x) / 2} y={(src.y + tgt.y) / 2 - 6}
                textAnchor="middle" fontSize="10" fill="var(--muted-foreground)"
                className="font-mono"
              >
                {p.match_count.toLocaleString()} pairs
              </text>
              {p.avg_confidence !== null && (
                <text
                  x={(src.x + tgt.x) / 2} y={(src.y + tgt.y) / 2 + 8}
                  textAnchor="middle" fontSize="9" fill="var(--muted-foreground)"
                >
                  avg {p.avg_confidence}% conf
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map(n => (
          <g key={n.code} filter="url(#glow)">
            <circle cx={n.x} cy={n.y} r={n.nodeR} fill="#6366f1" fillOpacity={0.15}
              stroke="#6366f1" strokeWidth={1.5} />
            <text x={n.x} y={n.y - 2} textAnchor="middle" fontSize="12"
              fontWeight="bold" fill="var(--foreground)">{n.code}</text>
            <text x={n.x} y={n.y + 13} textAnchor="middle" fontSize="9"
              fill="var(--muted-foreground)">{n.matCount.toLocaleString()} mat.</text>
          </g>
        ))}
      </svg>
      <p className="text-[11px] text-muted-foreground mt-1">
        Node size = material count · Edge thickness = match count
      </p>
    </div>
  );
}

// ─── Main Analytics Page ───────────────────────────────────────────────────────
export default function Analytics() {
  const navigate = useNavigate();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['nmc', 'analytics-full'],
    queryFn: () => nmcApi.analytics.getFullAnalytics(),
    refetchInterval: 30000,
  });

  const d = data as any;

  // ── Derived values ──────────────────────────────────────────────────────────
  const totalMat   = d?.total_materials    || 0;
  const normMat    = d?.normalized_materials || 0;
  const mappedMat  = d?.mapped_materials   || 0;
  const totalCMM   = d?.total_cmm          || 0;
  const totalMatch = d?.total_matches      || 0;
  const pending    = d?.match_by_status?.PENDING_REVIEW || 0;

  // Match status donut data
  const matchDonut = useMemo(() => {
    if (!d?.match_by_status) return [];
    return [
      { name: 'Pending Review', value: d.match_by_status.PENDING_REVIEW || 0, fill: C.pending   },
      { name: 'Accepted',       value: d.match_by_status.ACCEPTED        || 0, fill: C.accepted  },
      { name: 'Different',      value: d.match_by_status.DIFFERENT       || 0, fill: C.different },
      { name: 'Rejected',       value: d.match_by_status.REJECTED        || 0, fill: C.rejected  },
    ].filter(x => x.value > 0);
  }, [d]);

  // Review decisions donut
  const reviewDonut = useMemo(() => {
    if (!d?.decisions_by_type) return [];
    const map: Record<string, { color: string; label: string }> = {
      ACCEPT:   { color: C.accepted,  label: 'Accept'   },
      REJECT:   { color: C.rejected,  label: 'Reject'   },
      DIFFERENT:{ color: C.different, label: 'Different' },
      OVERRIDE: { color: '#a855f7',   label: 'Override' },
    };
    return Object.entries(d.decisions_by_type).map(([k, v]) => ({
      name:  map[k]?.label || k,
      value: v as number,
      fill:  map[k]?.color || '#94a3b8',
    })).filter(x => x.value > 0);
  }, [d]);

  // CMM by CPSE count bar
  const cmmCpseBar = useMemo(() => {
    if (!d?.cmm_by_cpse_count) return [];
    return d.cmm_by_cpse_count.map((r: any) => ({
      name:  `${r.cpse_count} CPSE${r.cpse_count !== 1 ? 's' : ''}`,
      count: r.cmm_count,
    }));
  }, [d]);

  // Audit summary
  const auditSummary = useMemo(() => {
    if (!d?.audit_by_action) return [];
    const groups: Record<string, string[]> = {
      'Dataset Events':   ['DATASET_UPLOADED', 'DATASET_VALIDATED', 'DATASET_NORMALIZED', 'DATASET_PROCESSING_STARTED'],
      'Matching Events':  ['MATCHING_STARTED', 'MATCHING_COMPLETED'],
      'Review Events':    ['MATCH_ACCEPTED', 'MATCH_REJECTED', 'MATCH_DIFFERENT', 'MATCH_OVERRIDDEN'],
      'CMM Events':       ['CMM_CREATED', 'CMM_UPDATED'],
      'CPSE Events':      ['CPSE_CREATED', 'CPSE_DELETED'],
      'Auth Events':      ['ADMIN_LOGIN', 'REVIEWER_LOGIN'],
    };
    return Object.entries(groups).map(([label, actions]) => ({
      label,
      count: actions.reduce((sum, a) => sum + (d.audit_by_action[a] || 0), 0),
    })).filter(g => g.count > 0);
  }, [d]);

  return (
    <AppLayout requireAdmin>
      <div className="space-y-5">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Analytics</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Material standardization, cross-CPSE harmonization, review, and NMC insights
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}
            className="h-8 gap-1.5 text-xs border-border/70 shrink-0">
            <RotateCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {isError && (
          <div className="rounded-md border border-rose-400/30 bg-rose-50/60 dark:bg-rose-950/20 px-4 py-3 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Unable to load analytics. Please refresh and try again.
          </div>
        )}

        {/* ── KPI Row 1 ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard label="Total CPSEs"    value={d?.total_cpses ?? '—'}
            sub={`${d?.active_cpses ?? '—'} active`}
            icon={Building2} accent="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400" />
          <KpiCard label="Total Datasets" value={d?.total_datasets ?? '—'}
            sub="uploaded datasets"
            icon={Database} accent="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" />
          <KpiCard label="Total Materials" value={totalMat.toLocaleString()}
            sub="across all CPSEs"
            icon={Database} accent="bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400" />
          <KpiCard label="Normalized" value={normMat.toLocaleString()}
            sub={`${pct(normMat, totalMat)} of materials`}
            icon={CheckCircle2} accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400" />
          <KpiCard label="Cross-CPSE Matches" value={totalMatch.toLocaleString()}
            sub="AI-generated pairs"
            icon={GitMerge} accent="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400" />
        </div>

        {/* ── KPI Row 2 ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <KpiCard label="Pending Reviews"   value={pending.toLocaleString()}
            sub="awaiting reviewer decision"
            icon={ClipboardList} accent="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400" />
          <KpiCard label="Common Material Masters" value={totalCMM.toLocaleString()}
            sub={`${d?.multi_cpse_cmm_count ?? 0} shared across CPSEs`}
            icon={Layers} accent="bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400" />
          <KpiCard label="NMC Mappings"  value={(d?.total_mappings ?? 0).toLocaleString()}
            sub={`${pct(mappedMat, totalMat)} materials mapped`}
            icon={Link2} accent="bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400" />
          <KpiCard label="Review Decisions" value={(d?.total_review_decisions ?? 0).toLocaleString()}
            sub={`${d?.review_completion_pct ?? 0}% of reviewable matches`}
            icon={ShieldCheck} accent="bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400" />
        </div>

        {/* ── Processing Pipeline ────────────────────────────────────────── */}
        <Section title="Material Processing Pipeline"
          description="End-to-end NMC workflow — actual record counts at each stage">
          {isLoading ? <Loading /> : <PipelineFunnel stages={d?.pipeline_stages || []} />}
        </Section>

        {/* ── Row: CPSE Distribution + Match Outcome ──────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Section title="CPSE Material Distribution"
            description="Number of materials uploaded per enterprise">
            {isLoading ? <Loading /> : !d?.cpse_material_distribution?.length ? <Empty /> : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d.cpse_material_distribution} layout="vertical" barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="cpse_code" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={60} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
                    <Bar dataKey="material_count" name="Materials" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>

          <Section title="Harmonization Results"
            description="Current status distribution of all AI-generated match pairs">
            {isLoading ? <Loading /> : !matchDonut.length ? <Empty /> : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={matchDonut} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={2} dataKey="value">
                      {matchDonut.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <p className="text-center text-xs text-muted-foreground -mt-1">
                  <strong className="text-foreground">{totalMatch.toLocaleString()}</strong> total pairs evaluated
                </p>
              </div>
            )}
          </Section>
        </div>

        {/* ── CPSE Harmonization Network ──────────────────────────────────── */}
        <Section title="CPSE Harmonization Network"
          description="Actual cross-CPSE material match relationships — node size = material count, edge = matched pairs">
          {isLoading ? <Loading /> : (
            <CpseNetworkGraph
              pairs={d?.cpse_pairs || []}
              cpseMatDist={d?.cpse_material_distribution || []}
            />
          )}
        </Section>

        {/* ── AI Confidence Distribution + Score Breakdown ─────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Section title="AI Matching Confidence Distribution"
            description={`Persisted final_confidence scores — avg: ${d?.avg_final_confidence ?? '—'}%`}>
            {isLoading ? <Loading /> : !d?.confidence_distribution?.some((c: any) => c.count > 0)
              ? <Empty msg="No match confidence data." />
              : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d.confidence_distribution} barSize={36}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="range" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
                    <Bar dataKey="count" name="Matches" radius={[4, 4, 0, 0]}>
                      {(d.confidence_distribution || []).map((_: any, i: number) => (
                        <Cell key={i} fill={[C.high, C.high, C.medium, C.medium, C.low][i] || '#94a3b8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>

          <Section title="AI Score Breakdown"
            description="Average persisted scores across all match pairs — from the matching engine">
            {isLoading ? <Loading /> : (() => {
              const scores = [
                { name: 'Semantic Similarity', value: d?.avg_semantic_similarity ?? 0,  fill: '#6366f1' },
                { name: 'Text Similarity',      value: d?.avg_text_similarity     ?? 0,  fill: '#3b82f6' },
                { name: 'Attribute Similarity', value: d?.avg_attribute_similarity ?? 0, fill: '#06b6d4' },
                { name: 'Final Confidence',     value: d?.avg_final_confidence    ?? 0,  fill: '#10b981' },
              ];
              return (
                <div className="space-y-3 pt-1">
                  {scores.map(s => (
                    <div key={s.name}>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-muted-foreground">{s.name}</span>
                        <span className="font-bold" style={{ color: s.fill }}>{s.value}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${s.value}%`, background: s.fill }} />
                      </div>
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground pt-1">
                    Values are averages across <strong className="text-foreground">{totalMatch.toLocaleString()}</strong> AI-generated match pairs
                  </p>
                </div>
              );
            })()}
          </Section>
        </div>

        {/* ── Review Analytics + Trend ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Section title="Review Analytics"
            description={`Review completion: ${d?.review_completion_pct ?? 0}% of potentially-same pairs`}>
            {isLoading ? <Loading /> : (() => {
              const total = d?.total_review_decisions || 0;
              const items = [
                { label: 'Accepted (Same)',    count: d?.decisions_by_type?.ACCEPT    || 0, color: C.accepted,  bg: 'bg-emerald-500/10 border-emerald-400/30' },
                { label: 'Rejected',           count: d?.decisions_by_type?.REJECT    || 0, color: C.rejected,  bg: 'bg-rose-500/10 border-rose-400/30'     },
                { label: 'Marked Different',   count: d?.decisions_by_type?.DIFFERENT || 0, color: C.different, bg: 'bg-indigo-500/10 border-indigo-400/30'  },
                { label: 'Override',           count: d?.decisions_by_type?.OVERRIDE  || 0, color: '#a855f7',   bg: 'bg-purple-500/10 border-purple-400/30'  },
              ];
              if (!total) return <Empty msg="No reviewer decisions recorded yet." />;
              return (
                <div className="space-y-2">
                  {items.map(item => (
                    <div key={item.label} className={`rounded-lg border p-2.5 ${item.bg}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                        <span className="text-sm font-bold" style={{ color: item.color }}>{item.count.toLocaleString()}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-white/30 dark:bg-black/20 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${total > 0 ? Math.round(item.count/total*100) : 0}%`, background: item.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Section>

          <Section title="Review Decision Trend"
            description="Daily reviewer activity from actual ReviewDecision timestamps">
            {isLoading ? <Loading /> : !d?.review_trend?.length
              ? <Empty msg="Not enough timestamp data to generate trend." />
              : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={d.review_trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="decisions" name="Decisions" stroke="#6366f1" strokeWidth={2} dot={{ r: 4, fill: '#6366f1' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>
        </div>

        {/* ── CMM / NMC Analytics ─────────────────────────────────────────── */}
        <Section title="Common Material Master (NMC) Analytics"
          description="Consolidation achieved — how many CMMs span multiple CPSEs">
          {isLoading ? <Loading /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total CMMs Created',          value: totalCMM },
                  { label: 'Total NMC Mappings',          value: d?.total_mappings || 0 },
                  { label: 'Materials Mapped to NMC',     value: mappedMat },
                  { label: 'Avg CPSEs per CMM',           value: d?.avg_cpses_per_cmm || 0 },
                  { label: 'Multi-CPSE CMMs',             value: d?.multi_cpse_cmm_count || 0 },
                  { label: 'Consolidation %',             value: pct(mappedMat, totalMat) },
                ].map(item => (
                  <div key={item.label} className="rounded-lg border border-border/60 bg-muted/20 p-3 text-center">
                    <p className="text-xl font-bold text-foreground tabular-nums">{typeof item.value === 'number' ? item.value.toLocaleString() : item.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{item.label}</p>
                  </div>
                ))}
              </div>
              {/* Bar: CMMs by CPSE count */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">CMMs by number of source CPSEs</p>
                {!cmmCpseBar.length ? <Empty msg="No CMM data yet." /> : (
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cmmCpseBar} barSize={32}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
                        <Bar dataKey="count" name="CMMs" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          )}
        </Section>

        {/* ── Shared CMMs ──────────────────────────────────────────────────── */}
        <Section title="Multi-CPSE Common Materials"
          description="NMC codes shared across multiple enterprises — demonstrating consolidation">
          {isLoading ? <Loading /> : !d?.shared_cmms?.length ? <Empty /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/30 border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                    <th className="px-3 py-2 text-left">NMC Code</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-left">Family</th>
                    <th className="px-3 py-2 text-left">Source CPSEs</th>
                    <th className="px-3 py-2 text-center w-20">CPSE Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {d.shared_cmms.map((c: any) => (
                    <tr key={c.nmc_code} className="hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2 font-mono font-bold text-foreground whitespace-nowrap">{c.nmc_code}</td>
                      <td className="px-3 py-2 text-muted-foreground max-w-xs truncate" title={c.description}>{c.description}</td>
                      <td className="px-3 py-2">
                        {c.material_family && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">{c.material_family}</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {(c.source_cpses || []).map((cpse: string) => (
                            <Badge key={cpse} variant="outline" className="text-[10px] px-1.5 py-0 font-mono">{cpse}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge className={`text-[10px] px-1.5 ${c.cpse_count >= 2 ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-300/50' : 'bg-muted text-muted-foreground border-border'}`}>
                          {c.cpse_count}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* ── CPSE Cross-CPSE Pair Table ────────────────────────────────────── */}
        <Section title="Top Cross-CPSE Match Relationships"
          description="Actual MaterialMatch records grouped by CPSE pair — sorted by match count">
          {isLoading ? <Loading /> : !d?.cpse_pairs?.length ? <Empty msg="No cross-CPSE matches found." /> : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                  <th className="px-3 py-2 text-left">CPSE Pair</th>
                  <th className="px-3 py-2 text-right w-36">Matched Pairs</th>
                  <th className="px-3 py-2 text-right w-36">Avg Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {d.cpse_pairs.map((p: any, i: number) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2 font-mono font-bold text-foreground">
                      {p.source_cpse} ↔ {p.target_cpse}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-foreground">{p.match_count.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">
                      <Badge variant="secondary" className={`text-[10px] ${
                        (p.avg_confidence || 0) >= 70 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : (p.avg_confidence || 0) >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                      }`}>
                        {p.avg_confidence !== null ? `${p.avg_confidence}%` : 'N/A'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* ── Material Type Distribution ─────────────────────────────────────── */}
        <Section title="Material Type Distribution"
          description="Actual material_type values extracted from normalized descriptions">
          {isLoading ? <Loading /> : !d?.material_type_distribution?.length
            ? <Empty msg="No material-type analytics available yet." />
            : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.material_type_distribution} layout="vertical" barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="type" width={120} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
                  <Bar dataKey="count" name="Materials" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>

        {/* ── Harmonization Impact ──────────────────────────────────────────── */}
        <Section title="Harmonization Impact Summary"
          description="The story of fragmented data consolidated into National Material Codes">
          {isLoading ? <Loading /> : (
            <div className="flex flex-wrap items-center justify-center gap-2 py-3">
              {[
                { label: 'Materials Processed',        value: totalMat,                         color: '#6366f1' },
                { label: 'Pairs AI-Evaluated',          value: totalMatch,                        color: '#3b82f6' },
                { label: 'Potentially Same',            value: d?.match_by_category?.POTENTIALLY_SAME || 0, color: '#f59e0b' },
                { label: 'Human-Reviewed',              value: d?.total_review_decisions || 0,    color: '#8b5cf6' },
                { label: 'CMMs Created',                value: totalCMM,                          color: '#10b981' },
                { label: 'Mapped to NMC',               value: mappedMat,                         color: '#22c55e' },
              ].map((step, i, arr) => (
                <React.Fragment key={step.label}>
                  <div className="flex flex-col items-center text-center min-w-[100px]">
                    <div className="rounded-xl px-3 py-2 border-2" style={{ borderColor: step.color, background: `${step.color}15` }}>
                      <p className="text-xl font-bold tabular-nums" style={{ color: step.color }}>{step.value.toLocaleString()}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 max-w-[90px] leading-tight">{step.label}</p>
                  </div>
                  {i < arr.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
                </React.Fragment>
              ))}
            </div>
          )}
        </Section>

        {/* ── Governance / Audit Summary ────────────────────────────────────── */}
        <Section
          title="Governance & Audit Summary"
          description={`${d?.audit_total ?? 0} total audit events — full traceability of the NMC workflow`}
          action={
            <Button variant="outline" size="sm" onClick={() => navigate('/audit')}
              className="h-7 gap-1.5 text-xs border-border/70 shrink-0">
              <ExternalLink className="h-3 w-3" /> View Audit Trail
            </Button>
          }
        >
          {isLoading ? <Loading /> : !auditSummary.length ? <Empty /> : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {auditSummary.map(g => (
                <div key={g.label} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-xs font-medium text-muted-foreground">{g.label}</p>
                  <p className="text-xl font-bold text-foreground mt-1 tabular-nums">{g.count.toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </Section>

      </div>
    </AppLayout>
  );
}
