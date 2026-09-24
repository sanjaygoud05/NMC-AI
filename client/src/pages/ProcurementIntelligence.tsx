import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { nmcApi } from '@/services/nmcApi';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent,
} from '@/components/ui/dialog';
import {
  Boxes, TrendingUp, Layers, RotateCw, Search, ChevronLeft, ChevronRight,
  PackageSearch, ClipboardList, AlertCircle, Info,
  CheckCircle2, ArrowRightLeft, History, X, Eye,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  PieChart, Pie, LabelList, RadialBarChart, RadialBar,
} from 'recharts';

// ── helpers ──────────────────────────────────────────────────────────────────
const TICK = '#94a3b8';
const GRID = 'rgba(148,163,184,0.12)';
const FG   = '#f1f5f9';
const BLUE  = '#3b82f6';

function fmt(n: number | null | undefined, d = 0) {
  if (n == null) return '—';
  return n.toLocaleString('en-IN', { maximumFractionDigits: d });
}

function Spinner() {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
      <RotateCw className="h-4 w-4 animate-spin text-primary" /> Loading…
    </div>
  );
}

function Empty({ msg, sub }: { msg: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
      <PackageSearch className="h-9 w-9 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{msg}</p>
      {sub && <p className="text-xs text-muted-foreground/60 max-w-xs">{sub}</p>}
    </div>
  );
}

// ── Dashboard-style KPI card ──────────────────────────────────────────────────
function KpiCard({ title, value, sub, icon: Icon, loading }: {
  title: string; value: string | number; sub?: string;
  icon: React.ComponentType<{ className?: string }>; loading?: boolean;
}) {
  return (
    <div className="bg-card dark:bg-black border border-border dark:border-zinc-800/90 rounded-lg p-5 flex flex-col justify-between hover:border-foreground/20 dark:hover:border-zinc-700/80 transition-colors shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted-foreground">{title}</span>
        <Icon className="h-4 w-4 text-muted-foreground stroke-[1.5]" />
      </div>
      <div className="my-2.5">
        <span className="text-3xl font-bold tracking-tight text-foreground font-sans">
          {loading ? <span className="opacity-30">—</span> : value}
        </span>
      </div>
      <div className="text-xs text-muted-foreground font-normal">{sub}</div>
    </div>
  );
}

// ── Filter row ────────────────────────────────────────────────────────────────
function FilterRow({ filters, cpseId, setCpseId, matType, setMatType, uom, setUom, search, setSearch, showDate = false }: {
  filters: any; cpseId: string; setCpseId: (v: string) => void;
  matType: string; setMatType: (v: string) => void;
  uom: string; setUom: (v: string) => void;
  search: string; setSearch: (v: string) => void;
  showDate?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">CPSE</label>
        <Select value={cpseId} onValueChange={setCpseId}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="All CPSEs" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All CPSEs</SelectItem>
            {(filters?.cpses || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Material Type</label>
        <Select value={matType} onValueChange={setMatType}>
          <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="All Material Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Material Types</SelectItem>
            {(filters?.material_types || []).map((t: string) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">UOM</label>
        <Select value={uom} onValueChange={setUom}>
          <SelectTrigger className="h-8 text-xs w-28"><SelectValue placeholder="All UOMs" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All UOMs</SelectItem>
            {(filters?.uoms || []).map((u: string) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {showDate && (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">NMC</label>
          <Select value="ALL" onValueChange={() => {}}>
            <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="All NMCs" /></SelectTrigger>
            <SelectContent><SelectItem value="ALL">All NMCs</SelectItem></SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Search</label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search NMC / Material…" className="pl-8 h-8 text-xs"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
    </div>
  );
}

// ── CPSE Color Palette ────────────────────────────────────────────────────────
const CPSE_COLORS: Record<string, string> = {
  'IOCL': '#3b82f6',
  'HPCL': '#06b6d4',
  'ONGC': '#f59e0b',
  'BPCL': '#10b981',
  'CPCL': '#8b5cf6',
  'BHEL': '#ef4444',
  'SAIL': '#f97316',
  'NTPC': '#eab308',
  'Coal India': '#14b8a6',
  'NMDC': '#6366f1',
};
const FALLBACK_PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#6366f1'];

// ── Multi-color CPSE Vertical Column Bar Chart (Solid Bars, Dashboard-grade Tooltip) ──
function CpseBarChart({ data, metricLabel = 'Units' }: { data: { label: string; value: number }[]; metricLabel?: string }) {
  if (!data?.length) return <Empty msg="No data available." />;
  const max = Math.max(...data.map(d => d.value), 1);
  const total = data.reduce((acc, d) => acc + d.value, 0) || 1;
  // 35% headroom ensures top labels never get pushed out of the box
  const dom = Math.ceil(max * 1.35);

  return (
    <div style={{ height: 280 }} className="w-full pt-1">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 28, right: 20, left: 5, bottom: 10 }}
          barSize={Math.min(54, Math.max(38, Math.floor(360 / Math.max(data.length, 1))))}
          barCategoryGap="20%"
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
          <XAxis
            type="category"
            dataKey="label"
            tick={{ fontSize: 12, fill: FG, fontWeight: 700 }}
            axisLine={{ stroke: 'rgba(148,163,184,0.2)' }}
            tickLine={false}
          />
          <YAxis
            type="number"
            domain={[0, dom]}
            tick={{ fontSize: 11, fill: TICK }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            width={48}
          />
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload;
              const color = CPSE_COLORS[p.label] || FALLBACK_PALETTE[0];
              const pct = ((p.value / total) * 100).toFixed(1);
              return (
                <div className="bg-popover/95 dark:bg-zinc-900/95 border border-border dark:border-zinc-800 rounded-md px-3.5 py-2.5 text-xs shadow-xl backdrop-blur-xs min-w-[170px]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <p className="font-bold text-foreground text-sm">{p.label}</p>
                  </div>
                  <div className="border-t border-border/40 dark:border-zinc-800/80 pt-1.5 space-y-1">
                    <p className="text-muted-foreground text-[11px]">
                      {metricLabel}: <span className="font-mono font-bold text-foreground">{fmt(p.value)}</span>
                    </p>
                    <p className="text-primary text-[11px] font-semibold">
                      Share: <span className="font-mono font-bold">{pct}%</span> of total
                    </p>
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => {
              const color = CPSE_COLORS[d.label] || FALLBACK_PALETTE[i % FALLBACK_PALETTE.length];
              return <Cell key={`cell-${i}`} fill={color} />;
            })}
            <LabelList
              dataKey="value"
              position="top"
              formatter={(v: any) => fmt(Number(v))}
              style={{ fontSize: 11, fontWeight: 700, fill: '#f1f5f9' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Top Materials by Aggregated Demand Chart (Solid Bar, Dashboard-grade Tooltip) ──
function TopMaterialsChart({ data }: { data: { label: string; value: number; description?: string; uom?: string }[] }) {
  if (!data?.length) return <Empty msg="No data available." />;
  const max = Math.max(...data.map(d => d.value), 1);
  const dom = Math.ceil(max * 1.25);

  return (
    <div style={{ height: Math.max(260, data.length * 50 + 50) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 65, left: 10, bottom: 10 }} barSize={30}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID} />
          <XAxis type="number" domain={[0, dom]} tick={{ fontSize: 11, fill: TICK }} axisLine={false} tickLine={false}
            tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 10.5, fill: FG, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={185} />
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload;
              return (
                <div className="bg-popover/95 dark:bg-zinc-900/95 border border-border dark:border-zinc-800 rounded-md px-3.5 py-2.5 text-xs shadow-xl backdrop-blur-xs max-w-[300px]">
                  <div className="font-mono text-xs font-bold text-purple-400 mb-1">{p.label}</div>
                  {p.description && <div className="text-foreground text-xs font-medium mb-1.5 leading-snug">{p.description}</div>}
                  <div className="border-t border-border/40 dark:border-zinc-800/80 pt-1.5 text-muted-foreground text-[11px]">
                    Combined Demand: <span className="font-semibold text-foreground">{fmt(p.value)} {p.uom || 'Units'}</span>
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]}>
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v: any) => fmt(Number(v))}
              style={{ fontSize: 11, fontWeight: 600, fill: FG }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Inventory status radial chart ─────────────────────────────────────
function InvDonut({ s }: { s: any }) {
  if (!s) return <Spinner />;
  const onHand    = Number(s.total_on_hand ?? s.total_inventory_units ?? 0);
  const reserved  = Number(s.total_reserved ?? 0);
  const available = Number(s.total_available ?? Math.max(0, onHand - reserved));
  const total     = (available + reserved) || onHand || 1;
  const availablePct = total > 0 ? parseFloat(((available / total) * 100).toFixed(1)) : 0;
  const reservedPct  = total > 0 ? parseFloat(((reserved  / total) * 100).toFixed(1)) : 0;

  const pie = [
    { name: 'Available', value: available, fill: '#10b981', pct: `${availablePct}%` },
    { name: 'Reserved',  value: reserved,  fill: '#f59e0b', pct: `${reservedPct}%`  },
  ];

  const [hoveredSlice, setHoveredSlice] = useState<typeof pie[0] | null>(null);

  return (
    <div className="flex flex-col items-center gap-5">
      {/* ── Donut centered ── */}
      <div className="relative w-[210px] h-[210px] flex items-center justify-center">
        {/* SVG outline rings */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 210 210">
          <circle cx="105" cy="105" r="88" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-border dark:text-zinc-800" />
          <circle cx="105" cy="105" r="54" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-border dark:text-zinc-800" />
        </svg>

        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pie}
              cx="50%"
              cy="50%"
              innerRadius={56}
              outerRadius={87}
              paddingAngle={3}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              stroke="#09090b"
              strokeWidth={2}
              onMouseEnter={(data) => setHoveredSlice(data)}
              onMouseLeave={() => setHoveredSlice(null)}
            >
              {pie.map((e, i) => {
                const isHov = hoveredSlice?.name === e.name;
                return (
                  <Cell
                    key={`cell-${i}`}
                    fill={e.fill}
                    stroke={isHov ? '#ffffff' : '#09090b'}
                    strokeWidth={isHov ? 2.5 : 1.5}
                    className="cursor-pointer transition-all duration-200"
                  />
                );
              })}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {hoveredSlice ? (
            <div className="text-center px-2 animate-in fade-in zoom-in-95 duration-150">
              <span className="text-xl font-bold font-sans tracking-tight text-foreground block">
                {fmt(hoveredSlice.value)}
              </span>
              <span className="text-[11px] font-semibold truncate max-w-[90px] block" style={{ color: hoveredSlice.fill }}>
                {hoveredSlice.name}
              </span>
            </div>
          ) : (
            <div className="text-center">
              <span className="text-2xl font-bold font-sans tracking-tight text-foreground block">
                {fmt(onHand)}
              </span>
              <span className="text-[11px] font-medium tracking-wider text-muted-foreground block">
                TOTAL UNITS
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Stats below the donut ── */}
      <div className="w-full space-y-2">
        {/* Three stat rows */}
        {[
          { label: 'Available Stock', val: available, pctV: availablePct, color: '#10b981', pieName: 'Available' as const },
          { label: 'Reserved Stock',  val: reserved,  pctV: reservedPct,  color: '#f59e0b', pieName: 'Reserved' as const },
          { label: 'Total On Hand',   val: onHand,    pctV: 100,          color: '#3b82f6', pieName: null },
        ].map(({ label, val, pctV, color, pieName }) => {
          const isHov = hoveredSlice?.name === pieName;
          return (
            <div
              key={label}
              onMouseEnter={() => {
                const match = pie.find(p => p.name === pieName);
                if (match) setHoveredSlice(match);
              }}
              onMouseLeave={() => setHoveredSlice(null)}
              className={`flex items-center gap-3 text-xs py-2 px-3 rounded-lg cursor-pointer transition-colors ${
                isHov
                  ? 'bg-muted/80 dark:bg-zinc-900 border border-border/80 dark:border-zinc-700'
                  : 'hover:bg-muted/40 dark:hover:bg-zinc-900/60 border border-transparent'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="font-semibold text-foreground flex-1">{label}</span>
              <span className="font-mono font-bold text-foreground">{fmt(val)}</span>
              <span className="font-mono text-muted-foreground w-[42px] text-right">{pctV}%</span>
            </div>
          );
        })}

        {/* Emerald info bar */}
        <div className="mt-1 flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-3 py-2">
          <Info className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-emerald-300/90 leading-snug">
            <span className="font-semibold text-emerald-300">{fmt(available)} Units ({availablePct}%)</span>{' '}
            are unreserved and ready for multi-CPSE allocation.
          </p>
        </div>
      </div>
    </div>
  );
}
// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ label }: { label: string }) {
  if (!label) return null;
  const l = label.toLowerCase();
  if (l.includes('multi'))
    return <Badge className="text-[10px] px-2 py-0 bg-blue-500/10 text-blue-400 border border-blue-500/30">Multi-CPSE</Badge>;
  if (l.includes('single'))
    return <Badge className="text-[10px] px-2 py-0 bg-zinc-800 text-zinc-400 border border-zinc-700">Single-CPSE</Badge>;
  return <Badge variant="outline" className="text-[10px] px-2 py-0">{label}</Badge>;
}

// ── View Modal (inventory detail) ─────────────────────────────────────────────
function InvDetailModal({ row, onClose }: { row: any; onClose: () => void }) {
  const detailQ = useQuery({
    queryKey: ['pi', 'inv-d', row.cmm_id],
    queryFn: () => nmcApi.procurement.getInventoryDetail(row.cmm_id),
    enabled: !!row.cmm_id,
  });
  const d = detailQ.data;
  const totalOnHand   = (d?.cpse_inventory || []).reduce((s: number, r: any) => s + (r.quantity_on_hand || 0), 0);
  const totalReserved = (d?.cpse_inventory || []).reduce((s: number, r: any) => s + (r.reserved_quantity || 0), 0);
  const totalAvail    = (d?.cpse_inventory || []).reduce((s: number, r: any) => s + (r.available_quantity || 0), 0);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl w-[95vw] p-0 overflow-hidden border border-border bg-card dark:bg-zinc-950 rounded-xl shadow-2xl flex flex-col max-h-[90vh] [&>button:last-child]:hidden">
        {/* header */}
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold text-primary">{row.nmc_code}</span>
              {row.uom && <Badge variant="outline" className="text-[10px]">UOM: {row.uom}</Badge>}
            </div>
            <p className="text-sm font-medium text-foreground mt-0.5">{row.canonical_description}</p>
            <p className="text-xs text-muted-foreground">Selected NMC / Inventory Detail</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {detailQ.isLoading ? <Spinner /> : !d ? <Empty msg="Detail not available." /> : (
            <>
              {/* metadata chips */}
              {d.cmm && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {d.cmm.material_type && <span className="bg-muted/40 border border-border/50 rounded px-2 py-0.5 text-muted-foreground">Category: {d.cmm.material_type}</span>}
                  {d.cmm.grade && <span className="bg-muted/40 border border-border/50 rounded px-2 py-0.5 text-muted-foreground">Grade: {d.cmm.grade}</span>}
                  {d.cmm.specifications && <span className="bg-muted/40 border border-border/50 rounded px-2 py-0.5 text-muted-foreground">Spec: {d.cmm.specifications}</span>}
                </div>
              )}

              {/* CPSE table + stat cards side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 dark:bg-zinc-900/60">
                        {['CPSE','Material Code','On Hand','Reserved','Available'].map(h => (
                          <th key={h} className="text-left p-3 text-muted-foreground font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(d.cpse_inventory || []).length === 0
                        ? <tr><td colSpan={5} className="p-6 text-center text-muted-foreground text-xs">No CPSE records.</td></tr>
                        : (d.cpse_inventory || []).map((r: any, i: number) => (
                          <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                            <td className="p-3 font-semibold text-foreground">{r.cpse_code}</td>
                            <td className="p-3 font-mono text-muted-foreground">{r.original_material_code || '—'}</td>
                            <td className="p-3 text-right tabular-nums">{fmt(r.quantity_on_hand)}</td>
                            <td className="p-3 text-right tabular-nums text-muted-foreground">{fmt(r.reserved_quantity)}</td>
                            <td className="p-3 text-right tabular-nums font-semibold text-foreground">{fmt(r.available_quantity)}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Total On Hand',   val: totalOnHand,   icon: Boxes,         cls: 'text-blue-400'   },
                    { label: 'Total Reserved',  val: totalReserved, icon: Layers,        cls: 'text-amber-400'  },
                    { label: 'Total Available', val: totalAvail,    icon: CheckCircle2,  cls: 'text-emerald-400'},
                  ].map(({ label, val, icon: Ic, cls }) => (
                    <div key={label} className="bg-card dark:bg-black border border-border dark:border-zinc-800 rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Ic className={`h-4 w-4 ${cls}`} />
                        <span className="text-xs text-muted-foreground">{label}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold tabular-nums text-foreground">{fmt(val)}</p>
                        <p className="text-[10px] text-muted-foreground">{row.uom || 'EA'}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 bg-muted/20 border border-border/40 rounded-lg px-3 py-2">
                    <Info className="h-4 w-4 text-muted-foreground shrink-0" />
                    <p className="text-[11px] text-muted-foreground">Inventory As Of: 24 Sep 2026</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Combined detail modal (demand tab) ────────────────────────────────────────
function DemandDetailModal({ cmmId, onClose }: { cmmId: string; onClose: () => void }) {
  const [tab, setTab] = useState<'combined' | 'inventory' | 'demand' | 'history'>('combined');
  const invQ  = useQuery({ queryKey: ['pi','inv-d', cmmId], queryFn: () => nmcApi.procurement.getInventoryDetail(cmmId), enabled: !!cmmId });
  const demQ  = useQuery({ queryKey: ['pi','dem-d', cmmId], queryFn: () => nmcApi.procurement.getDemandDetail(cmmId), enabled: !!cmmId });
  const combQ = useQuery({ queryKey: ['pi','comb', cmmId], queryFn: () => nmcApi.procurement.getCombined(cmmId), enabled: !!cmmId });
  const histQ = useQuery({ queryKey: ['pi','hist', cmmId], queryFn: () => nmcApi.procurement.getProcurementHistory(cmmId), enabled: !!cmmId });
  const cmm   = invQ.data?.cmm || demQ.data?.cmm || combQ.data?.cmm;

  const TABS = [
    { key: 'combined',  label: 'Analysis',  Icon: ArrowRightLeft },
    { key: 'inventory', label: 'Inventory', Icon: Boxes },
    { key: 'demand',    label: 'Demand',    Icon: ClipboardList },
    { key: 'history',   label: 'History',   Icon: History },
  ] as const;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl w-[95vw] p-0 overflow-hidden border border-border bg-card dark:bg-zinc-950 rounded-xl shadow-2xl flex flex-col max-h-[90vh] [&>button:last-child]:hidden">
        <div className="px-6 py-5 border-b border-border flex items-start justify-between gap-4 shrink-0 bg-card">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-xs font-semibold tracking-wider text-primary bg-primary/10 border border-primary/25 px-2.5 py-1 rounded-md">
                {cmm?.national_material_code || '…'}
              </span>
              <Badge variant="outline" className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground border-border/80 bg-muted/40 px-2.5 py-0.5 rounded-md">
                {cmm?.material_type || 'Material'}
              </Badge>
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-foreground tracking-tight leading-snug">
              {cmm?.canonical_description || 'Common Material'}
            </h2>
            <div className="flex items-center gap-3 text-xs text-muted-foreground pt-0.5">
              <span className="inline-flex items-center gap-1.5">
                <span className="font-medium text-muted-foreground">Grade:</span>
                <span className="font-mono font-medium text-foreground bg-muted/50 px-2 py-0.5 rounded border border-border/60">
                  {cmm?.grade || '—'}
                </span>
              </span>
              <span className="text-muted-foreground/40 font-bold">·</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="font-medium text-muted-foreground">UOM:</span>
                <span className="font-mono font-medium text-foreground bg-muted/50 px-2 py-0.5 rounded border border-border/60">
                  {cmm?.uom || '—'}
                </span>
              </span>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 hover:bg-muted" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex border-b border-border shrink-0 px-4">
          {TABS.map(({ key, label, Icon }) => (
            <button key={key}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors ${tab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              onClick={() => setTab(key as any)}>
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {tab === 'combined' && (
            combQ.isLoading ? <Spinner /> : !combQ.data ? <Empty msg="No combined data." /> : (
              <div className="space-y-4">
                {(combQ.data.uom_analysis || []).map((ua: any, i: number) => {
                  const isSurplus = ua.net_requirement != null && ua.net_requirement <= 0;
                  return (
                    <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-border/60">
                        <span className="text-xs font-semibold text-foreground tracking-wide uppercase flex items-center gap-1.5">
                          <ArrowRightLeft className="h-3.5 w-3.5 text-primary" />
                          Material Balance Analysis ({ua.uom})
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            ua.net_requirement == null
                              ? 'text-[11px] text-muted-foreground border-border bg-muted/40'
                              : isSurplus
                              ? 'text-[11px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                              : 'text-[11px] text-primary border-primary/30 bg-primary/10'
                          }
                        >
                          {ua.net_requirement == null
                            ? 'No Net Data'
                            : isSurplus
                            ? 'Inventory Surplus'
                            : 'Net Procurement Required'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div className="bg-muted/20 border border-border/50 rounded-lg p-3">
                          <p className="text-muted-foreground text-[11px] font-medium mb-1">Available Inventory</p>
                          <p className="font-bold text-base tabular-nums text-foreground">
                            {fmt(ua.available_inventory)}{' '}
                            <span className="text-xs font-normal text-muted-foreground">{ua.uom}</span>
                          </p>
                        </div>
                        <div className="bg-muted/20 border border-border/50 rounded-lg p-3">
                          <p className="text-muted-foreground text-[11px] font-medium mb-1">Combined Demand</p>
                          <p className="font-bold text-base tabular-nums text-foreground">
                            {fmt(ua.combined_demand)}{' '}
                            <span className="text-xs font-normal text-muted-foreground">{ua.uom}</span>
                          </p>
                        </div>
                        <div className="bg-muted/20 border border-border/50 rounded-lg p-3">
                          <p className="text-muted-foreground text-[11px] font-medium mb-1">Net Requirement</p>
                          <p
                            className={`font-bold text-base tabular-nums ${
                              ua.net_requirement == null
                                ? 'text-muted-foreground'
                                : isSurplus
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-primary'
                            }`}
                          >
                            {ua.net_requirement != null ? (ua.net_requirement > 0 ? '+' : '') + fmt(ua.net_requirement) : '—'}{' '}
                            <span className="text-xs font-normal text-muted-foreground">{ua.uom}</span>
                          </p>
                        </div>
                      </div>

                      {ua.insight && (
                        <p className="text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded border border-border/50">
                          <span className="font-medium text-foreground">Insight: </span>
                          {ua.insight}
                        </p>
                      )}
                    </div>
                  );
                })}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 px-0.5">
                      <Boxes className="h-3.5 w-3.5 text-muted-foreground" />
                      <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
                        Inventory — What CPSEs Have
                      </h3>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            <th className="text-left p-2.5 text-muted-foreground font-semibold">CPSE</th>
                            <th className="text-right p-2.5 text-muted-foreground font-semibold">Available</th>
                            <th className="text-right p-2.5 text-muted-foreground font-semibold">On Hand</th>
                            <th className="text-left p-2.5 text-muted-foreground font-semibold">UOM</th>
                          </tr>
                        </thead>
                        <tbody>
                          {!combQ.data.inventory_present || !combQ.data.cpse_inventory?.length ? (
                            <tr>
                              <td colSpan={4} className="p-3 text-center text-muted-foreground italic">
                                No inventory data available.
                              </td>
                            </tr>
                          ) : (
                            combQ.data.cpse_inventory.map((r: any, i: number) => (
                              <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                                <td className="p-2.5 font-semibold text-foreground">{r.cpse_code}</td>
                                <td className="p-2.5 text-right tabular-nums font-semibold">{fmt(r.available_quantity)}</td>
                                <td className="p-2.5 text-right tabular-nums text-muted-foreground">{fmt(r.quantity_on_hand)}</td>
                                <td className="p-2.5 text-muted-foreground">{r.uom || '—'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 px-0.5">
                      <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                      <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
                        Demand — What CPSEs Need
                      </h3>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            <th className="text-left p-2.5 text-muted-foreground font-semibold">CPSE</th>
                            <th className="text-right p-2.5 text-muted-foreground font-semibold">Required</th>
                            <th className="text-left p-2.5 text-muted-foreground font-semibold">Period</th>
                            <th className="text-left p-2.5 text-muted-foreground font-semibold">UOM</th>
                          </tr>
                        </thead>
                        <tbody>
                          {!combQ.data.demand_present || !combQ.data.cpse_demand?.length ? (
                            <tr>
                              <td colSpan={4} className="p-3 text-center text-muted-foreground italic">
                                No demand data available.
                              </td>
                            </tr>
                          ) : (
                            combQ.data.cpse_demand.map((r: any, i: number) => (
                              <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                                <td className="p-2.5 font-semibold text-foreground">{r.cpse_code}</td>
                                <td className="p-2.5 text-right tabular-nums font-semibold">{fmt(r.required_quantity)}</td>
                                <td className="p-2.5 text-muted-foreground">{r.demand_period || '—'}</td>
                                <td className="p-2.5 text-muted-foreground">{r.uom || '—'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )
          )}
          {tab === 'inventory' && (
            invQ.isLoading ? <Spinner /> : !invQ.data ? <Empty msg="Detail not available." /> : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border bg-muted/30">
                    {['CPSE','Material Code','On Hand','Reserved','Available','UOM'].map(h =>
                      <th key={h} className="text-left p-3 text-muted-foreground font-semibold">{h}</th>
                    )}
                  </tr></thead>
                  <tbody>
                    {invQ.data.cpse_inventory.map((r: any) => (
                      <tr key={r.inventory_id} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="p-3 font-semibold text-foreground">{r.cpse_code}</td>
                        <td className="p-3 font-mono text-muted-foreground">{r.original_material_code || '—'}</td>
                        <td className="p-3 text-right tabular-nums">{fmt(r.quantity_on_hand)}</td>
                        <td className="p-3 text-right tabular-nums text-muted-foreground">{fmt(r.reserved_quantity)}</td>
                        <td className="p-3 text-right tabular-nums font-semibold">{fmt(r.available_quantity)}</td>
                        <td className="p-3 text-muted-foreground">{r.uom || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
          {tab === 'demand' && (
            demQ.isLoading ? <Spinner /> : !demQ.data ? <Empty msg="Detail not available." /> : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border bg-muted/30">
                    {['CPSE','Plant','Required Qty','Forecast Qty','Period','UOM'].map(h =>
                      <th key={h} className="text-left p-3 text-muted-foreground font-semibold">{h}</th>
                    )}
                  </tr></thead>
                  <tbody>
                    {demQ.data.cpse_demand.map((r: any) => (
                      <tr key={r.demand_id} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="p-3 font-semibold text-foreground">{r.cpse_code}</td>
                        <td className="p-3 text-muted-foreground">{r.plant || '—'}</td>
                        <td className="p-3 text-right tabular-nums font-semibold">{fmt(r.required_quantity)}</td>
                        <td className="p-3 text-right tabular-nums text-muted-foreground">{r.forecast_quantity != null ? fmt(r.forecast_quantity) : '—'}</td>
                        <td className="p-3 text-muted-foreground">{r.demand_period || '—'}</td>
                        <td className="p-3 text-muted-foreground">{r.uom || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
          {tab === 'history' && (
            histQ.isLoading ? <Spinner /> : !histQ.data ? <Empty msg="History not available." /> : (
              histQ.data.history.length === 0
                ? <Empty msg="No procurement history." sub="Populated from historical PO data linked to accepted NMC mappings." />
                : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-border bg-muted/30">
                        {['CPSE','PO Number','Supplier','Quantity','Unit Price','UOM','PO Date'].map(h =>
                          <th key={h} className="text-left p-3 text-muted-foreground font-semibold">{h}</th>
                        )}
                      </tr></thead>
                      <tbody>
                        {histQ.data.history.map((r: any) => (
                          <tr key={r.id} className="border-b border-border/40 hover:bg-muted/20">
                            <td className="p-3 font-semibold text-foreground">{r.cpse_code}</td>
                            <td className="p-3 font-mono text-muted-foreground">{r.po_number}</td>
                            <td className="p-3 text-foreground">{r.supplier_name}</td>
                            <td className="p-3 text-right tabular-nums font-semibold">{fmt(r.quantity)}</td>
                            <td className="p-3 text-right tabular-nums text-muted-foreground">{r.unit_price != null ? `₹${fmt(r.unit_price, 2)}` : '—'}</td>
                            <td className="p-3 text-muted-foreground">{r.uom || '—'}</td>
                            <td className="p-3 text-muted-foreground whitespace-nowrap">{r.po_date ? new Date(r.po_date).toLocaleDateString('en-IN') : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Section card wrapper ──────────────────────────────────────────────────────
function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-card dark:bg-black border border-border dark:border-zinc-800/90 rounded-lg shadow-xs overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Table section (no padding override) ──────────────────────────────────────
function TableSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card dark:bg-black border border-border dark:border-zinc-800/90 rounded-lg shadow-xs overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ── Inventory Tab ─────────────────────────────────────────────────────────────
function InventoryTab({ filters }: { filters: any }) {
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(1);
  const [cpseId, setCpseId] = useState('ALL');
  const [matType, setMatType] = useState('ALL');
  const [uom, setUom]       = useState('ALL');
  const [viewRow, setViewRow] = useState<any>(null);
  const PS = 15;

  const sumQ   = useQuery({ queryKey: ['pi','inv-sum'],  queryFn: () => nmcApi.procurement.getInventorySummary(), refetchInterval: 30000 });
  const cpseQ  = useQuery({ queryKey: ['pi','inv-cpse'], queryFn: () => nmcApi.procurement.getInventoryByCpse(), refetchInterval: 30000 });
  const nmcQ   = useQuery({
    queryKey: ['pi','inv-nmc', cpseId, matType, uom, search, page],
    queryFn: () => nmcApi.procurement.getInventoryByNmc({
      cpse_id: cpseId !== 'ALL' ? cpseId : undefined,
      material_type: matType !== 'ALL' ? matType : undefined,
      uom: uom !== 'ALL' ? uom : undefined,
      search: search || undefined,
      page, page_size: PS,
    }),
    refetchInterval: 30000,
  });

  const s = sumQ.data;
  const cpseChart = useMemo(() => (cpseQ.data || []).map((d: any) => ({ label: d.cpse_code, value: d.total_on_hand || d.total_available || 0 })), [cpseQ.data]);
  const reset = useCallback(() => setPage(1), []);

  const kpis = [
    { title: 'Total On Hand',               value: s ? fmt(s.total_inventory_units) : '—', sub: 'Units across all CPSEs',        icon: Boxes },
    { title: 'Total Available',              value: s ? fmt(s.total_available ?? s.total_inventory_units) : '—', sub: 'Ready for immediate use', icon: CheckCircle2 },
    { title: 'Multi-CPSE Stock',             value: s ? s.multi_cpse_stock : '—',          sub: 'NMCs held by 2+ CPSEs',          icon: Layers },
    { title: 'Consolidation Opportunities',  value: s ? s.consolidation_opportunities : '—', sub: 'NMCs available to consolidate', icon: TrendingUp },
  ];

  return (
    <div className="space-y-5">
      {/* Filters */}
      <FilterRow filters={filters} cpseId={cpseId} setCpseId={(v) => { setCpseId(v); reset(); }}
        matType={matType} setMatType={(v) => { setMatType(v); reset(); }}
        uom={uom} setUom={(v) => { setUom(v); reset(); }}
        search={search} setSearch={(v) => { setSearch(v); reset(); }} showDate />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => <KpiCard key={k.title} loading={sumQ.isLoading} {...k} />)}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Section title="Inventory by CPSE">
          {cpseQ.isLoading ? <Spinner /> : <CpseBarChart data={cpseChart} metricLabel="Available Inventory" />}
        </Section>
        <Section title="Inventory Status">
          {sumQ.isLoading ? <Spinner /> : <InvDonut s={s} />}
        </Section>
      </div>

      {/* Table */}
      <TableSection title="Inventory by Common Material">
        {nmcQ.isLoading
          ? <div className="p-6"><Spinner /></div>
          : (nmcQ.data?.items || []).length === 0
            ? <Empty msg="No inventory data yet." sub="Upload CPSE inventory linked to accepted NMC mappings." />
            : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/20 dark:bg-zinc-900/40 text-muted-foreground">
                        <th className="text-left px-4 py-2.5 font-semibold whitespace-nowrap">NMC</th>
                        <th className="text-left px-4 py-2.5 font-semibold">Common Material</th>
                        <th className="text-center px-4 py-2.5 font-semibold">CPSEs</th>
                        <th className="text-right px-4 py-2.5 font-semibold">On Hand</th>
                        <th className="text-right px-4 py-2.5 font-semibold">Available</th>
                        <th className="text-left px-4 py-2.5 font-semibold">UOM</th>
                        <th className="text-left px-4 py-2.5 font-semibold">Status</th>
                        <th className="text-right px-4 py-2.5 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nmcQ.data.items.map((row: any) => (
                        <tr key={`${row.cmm_id}::${row.uom}`} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5 font-mono font-semibold text-primary whitespace-nowrap">{row.nmc_code}</td>
                          <td className="px-4 py-2.5 max-w-[200px]">
                            <p className="font-medium text-foreground truncate" title={row.canonical_description}>{row.canonical_description || '—'}</p>
                          </td>
                          <td className="px-4 py-2.5 text-center tabular-nums text-foreground">{row.cpse_count}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{fmt(row.total_on_hand)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-foreground">{fmt(row.total_available)}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{row.uom || '—'}</td>
                          <td className="px-4 py-2.5"><StatusBadge label={row.consolidation_status} /></td>
                          <td className="px-4 py-2.5 text-right">
                            <Button variant="outline" size="sm" className="h-6 px-2.5 text-[11px] gap-1 hover:bg-muted"
                              onClick={() => setViewRow(row)}>
                              <Eye className="h-3 w-3" />View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {nmcQ.data.total_pages > 1 && (
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/40 bg-muted/10">
                    <p className="text-xs text-muted-foreground">Page {nmcQ.data.page} of {nmcQ.data.total_pages} · {nmcQ.data.total} records</p>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-7 px-2" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-3.5 w-3.5" /></Button>
                      <Button variant="outline" size="sm" className="h-7 px-2" disabled={page >= nmcQ.data.total_pages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                )}
              </>
            )
        }
      </TableSection>

      {viewRow && <InvDetailModal row={viewRow} onClose={() => setViewRow(null)} />}
    </div>
  );
}

// ── Demand Tab ────────────────────────────────────────────────────────────────
function DemandTab({ filters }: { filters: any }) {
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(1);
  const [cpseId, setCpseId] = useState('ALL');
  const [matType, setMatType] = useState('ALL');
  const [uom, setUom]       = useState('ALL');
  const [demPeriod, setDemPeriod] = useState('ALL');
  const [viewId, setViewId] = useState<string | null>(null);
  const PS = 15;

  const sumQ  = useQuery({ queryKey: ['pi','dem-sum'],  queryFn: () => nmcApi.procurement.getDemandSummary(), refetchInterval: 30000 });
  const cpseQ = useQuery({ queryKey: ['pi','dem-cpse'], queryFn: () => nmcApi.procurement.getDemandByCpse(), refetchInterval: 30000 });
  const nmcQ  = useQuery({
    queryKey: ['pi','dem-nmc', cpseId, matType, uom, demPeriod, search, page],
    queryFn: () => nmcApi.procurement.getDemandByNmc({
      cpse_id: cpseId !== 'ALL' ? cpseId : undefined,
      material_type: matType !== 'ALL' ? matType : undefined,
      uom: uom !== 'ALL' ? uom : undefined,
      demand_period: demPeriod !== 'ALL' ? demPeriod : undefined,
      search: search || undefined,
      page, page_size: PS,
    }),
    refetchInterval: 30000,
  });

  const s = sumQ.data;
  const cpseChart = useMemo(() => (cpseQ.data || []).map((d: any) => ({ label: d.cpse_code, value: d.total_required || 0 })), [cpseQ.data]);
  const topNmc    = useMemo(() => (nmcQ.data?.items || []).slice(0, 8).map((d: any) => ({
    label: d.nmc_code,
    value: d.combined_demand || 0,
    description: d.canonical_description,
    uom: d.uom,
  })), [nmcQ.data]);
  const reset = useCallback(() => setPage(1), []);

  const kpis = [
    { title: 'Total Demand',               value: s ? fmt(s.total_demand) : '—',              sub: 'Required units across CPSEs',   icon: ClipboardList },
    { title: 'Materials with Demand',      value: s ? s.materials_with_demand : '—',           sub: 'Distinct NMC demand records',   icon: PackageSearch },
    { title: 'Multi-CPSE Demand',          value: s ? s.multi_cpse_demand : '—',               sub: 'NMCs demanded by 2+ CPSEs',     icon: Layers },
    { title: 'Procurement Opportunities',  value: s ? s.procurement_opportunities : '—',       sub: 'Collaborative procurement',     icon: TrendingUp },
  ];

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <FilterRow filters={filters} cpseId={cpseId} setCpseId={(v) => { setCpseId(v); reset(); }}
          matType={matType} setMatType={(v) => { setMatType(v); reset(); }}
          uom={uom} setUom={(v) => { setUom(v); reset(); }}
          search={search} setSearch={(v) => { setSearch(v); reset(); }} />
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Period</label>
          <Select value={demPeriod} onValueChange={(v) => { setDemPeriod(v); reset(); }}>
            <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="All Periods" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Periods</SelectItem>
              {(filters?.demand_periods || []).map((p: string) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => <KpiCard key={k.title} loading={sumQ.isLoading} {...k} />)}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Section title="Demand by CPSE">
          {cpseQ.isLoading ? <Spinner /> : <CpseBarChart data={cpseChart} metricLabel="Required Demand" />}
        </Section>
        <Section title="Top Materials by Aggregated Demand">
          {nmcQ.isLoading ? <Spinner /> : <TopMaterialsChart data={topNmc} />}
        </Section>
      </div>

      {/* Table */}
      <TableSection title="Demand by Common Material">
        {nmcQ.isLoading
          ? <div className="p-6"><Spinner /></div>
          : (nmcQ.data?.items || []).length === 0
            ? <Empty msg="No demand data yet." sub="Upload CPSE demand linked to accepted NMC mappings." />
            : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/20 dark:bg-zinc-900/40 text-muted-foreground">
                        <th className="text-left px-4 py-2.5 font-semibold whitespace-nowrap">NMC</th>
                        <th className="text-left px-4 py-2.5 font-semibold">Canonical Material</th>
                        <th className="text-center px-4 py-2.5 font-semibold">CPSEs</th>
                        <th className="text-left px-4 py-2.5 font-semibold">CPSE Demand</th>
                        <th className="text-right px-4 py-2.5 font-semibold">Combined</th>
                        <th className="text-left px-4 py-2.5 font-semibold">UOM</th>
                        <th className="text-left px-4 py-2.5 font-semibold">Opportunity</th>
                        <th className="text-right px-4 py-2.5 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nmcQ.data.items.map((row: any) => (
                        <tr key={`${row.cmm_id}::${row.uom}`} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5 font-mono font-semibold text-primary whitespace-nowrap">{row.nmc_code}</td>
                          <td className="px-4 py-2.5 max-w-[180px]">
                            <p className="font-medium text-foreground truncate" title={row.canonical_description}>{row.canonical_description || '—'}</p>
                            {row.material_type && <p className="text-[10px] text-muted-foreground">{row.material_type}</p>}
                          </td>
                          <td className="px-4 py-2.5 text-center tabular-nums">{row.cpse_count}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-col gap-0.5">
                              {(row.cpse_demand || []).map((cd: any, i: number) => (
                                <span key={i} className="text-[10px] text-muted-foreground">{cd.cpse_code}: <span className="font-medium text-foreground">{fmt(cd.required_quantity)}</span></span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-foreground">{fmt(row.combined_demand)}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{row.uom || '—'}</td>
                          <td className="px-4 py-2.5"><StatusBadge label={row.procurement_opportunity} /></td>
                          <td className="px-4 py-2.5 text-right">
                            <Button variant="outline" size="sm" className="h-6 px-2.5 text-[11px] gap-1 hover:bg-muted"
                              onClick={() => setViewId(row.cmm_id)}>
                              <Eye className="h-3 w-3" />View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {nmcQ.data.total_pages > 1 && (
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/40 bg-muted/10">
                    <p className="text-xs text-muted-foreground">Page {nmcQ.data.page} of {nmcQ.data.total_pages} · {nmcQ.data.total} records</p>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-7 px-2" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-3.5 w-3.5" /></Button>
                      <Button variant="outline" size="sm" className="h-7 px-2" disabled={page >= nmcQ.data.total_pages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                )}
              </>
            )
        }
      </TableSection>

      {viewId && <DemandDetailModal cmmId={viewId} onClose={() => setViewId(null)} />}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ProcurementIntelligence() {
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'inventory' | 'demand'>('inventory');
  const filtersQ = useQuery({ queryKey: ['pi','filters'], queryFn: () => nmcApi.procurement.getFilters(), staleTime: 60000 });

  if (!isLoading && !isAuthenticated) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Please sign in to access Procurement Intelligence.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Procurement Intelligence</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-sans mt-2">
              {activeTab === 'inventory' ? 'Inventory Optimization' : 'Demand Aggregation'}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {activeTab === 'inventory'
                ? 'Analyze standardized inventory available across CPSEs'
                : 'Aggregate cross-CPSE demand for collaborative procurement'}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          <button id="tab-inventory"
            className={`px-5 py-2.5 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'inventory' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('inventory')}>
            <Boxes className="h-4 w-4" />Inventory Optimization
          </button>
          <button id="tab-demand"
            className={`px-5 py-2.5 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'demand' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('demand')}>
            <ClipboardList className="h-4 w-4" />Demand Aggregation
          </button>
        </div>

        {activeTab === 'inventory' ? <InventoryTab filters={filtersQ.data} /> : <DemandTab filters={filtersQ.data} />}
      </div>
    </AppLayout>
  );
}
