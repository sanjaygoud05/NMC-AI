import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Network,
  Layers,
  Building2,
  GitMerge,
  Share2,
  Sparkles,
  Info,
  CheckCircle2,
  RotateCw,
  ExternalLink,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

interface TopologyData {
  kpis: {
    total_active_cpses: number;
    multi_cpse_cmms: number;
    cross_cpse_pairs: number;
    avg_materials_per_cmm: number;
  };
  cpses: string[];
  overlap_matrix: { cpse1: string; cpse2: string; shared_count: number }[];
  cmm_clusters: {
    cmm_id: string;
    canonical_name: string;
    category: string;
    cpse_count: number;
    cpses: string[];
    mapped_count: number;
  }[];
}

interface Props {
  data?: TopologyData;
  isLoading: boolean;
}

const CPSE_COLORS: Record<string, string> = {
  CPCL: '#3b82f6',
  IOCL: '#10b981',
  HPCL: '#f59e0b',
  ONGC: '#ef4444',
  GAIL: '#8b5cf6',
  BPCL: '#06b6d4',
  OIL:  '#ec4899',
  NRL:  '#14b8a6',
  NTPL: '#6366f1',
  HPTL: '#eab308',
};

const DEFAULT_CPSE_COLOR = '#64748b';

export function CpseTopologySection({ data, isLoading }: Props) {
  const [selectedCpse, setSelectedCpse] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <RotateCw className="h-8 w-8 animate-spin text-emerald-500" />
        <p className="text-sm font-medium">Computing multi-CPSE harmonization topology mesh...</p>
      </div>
    );
  }

  const kpis = data?.kpis || {
    total_active_cpses: 8,
    multi_cpse_cmms: 1920,
    cross_cpse_pairs: 4281,
    avg_materials_per_cmm: 3.4,
  };

  const cpses = data?.cpses?.length ? data.cpses : ['CPCL', 'IOCL', 'HPCL', 'ONGC', 'GAIL', 'BPCL', 'OIL', 'NRL'];
  const overlapList = data?.overlap_matrix || [];
  const clusters = data?.cmm_clusters || [];

  // Radial node coordinates around center (cx=250, cy=250, r=160)
  const cx = 250;
  const cy = 250;
  const radius = 155;
  const totalNodes = cpses.length;

  const nodePositions = cpses.map((cpse, idx) => {
    const angle = (idx / totalNodes) * 2 * Math.PI - Math.PI / 2;
    return {
      cpse,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      color: CPSE_COLORS[cpse] || DEFAULT_CPSE_COLOR,
    };
  });

  const topOverlaps = [...overlapList]
    .sort((a, b) => b.shared_count - a.shared_count)
    .slice(0, 8);

  return (
    <div className="space-y-6">
      {/* ── KPI Strip ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60 bg-card/60 backdrop-blur">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Interconnected CPSEs
              </p>
              <p className="text-2xl font-black text-foreground mt-1 tabular-nums">
                {kpis.total_active_cpses}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Harmonized CMMs
              </p>
              <p className="text-2xl font-black text-foreground mt-1 tabular-nums">
                {kpis.multi_cpse_cmms.toLocaleString()}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Cross-CPSE Bridges
              </p>
              <p className="text-2xl font-black text-foreground mt-1 tabular-nums">
                {kpis.cross_cpse_pairs.toLocaleString()}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
              <GitMerge className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Avg Materials / CMM
              </p>
              <p className="text-2xl font-black text-foreground mt-1 tabular-nums">
                {kpis.avg_materials_per_cmm}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500">
              <Sparkles className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Topology Section (SVG Mesh + Sidebar) ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SVG Mesh Visualization */}
        <Card className="lg:col-span-2 border-border/60 bg-card/80 backdrop-blur">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Network className="h-4 w-4 text-emerald-500" />
                  National Material Master Multi-CPSE Mesh
                </CardTitle>
                <CardDescription className="text-xs">
                  Topology representing enterprise convergence around standardized Common Material Masters
                </CardDescription>
              </div>
              {selectedCpse && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCpse(null)}
                  className="text-xs h-7 text-muted-foreground hover:text-foreground"
                >
                  Clear Selection
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-2 flex flex-col items-center justify-center">
            <div className="w-full max-w-[500px] aspect-square relative flex items-center justify-center">
              <svg viewBox="0 0 500 500" className="w-full h-full drop-shadow-md select-none">
                {/* Background ambient circular rings */}
                <circle cx={cx} cy={cy} r={radius} fill="none" stroke="currentColor" strokeOpacity={0.1} strokeDasharray="4 4" />
                <circle cx={cx} cy={cy} r={radius * 0.6} fill="none" stroke="currentColor" strokeOpacity={0.06} />

                {/* Overlap bridge lines between selected node and others */}
                {nodePositions.map((n1, idx1) =>
                  nodePositions.slice(idx1 + 1).map((n2, idx2) => {
                    const isHighlighted =
                      selectedCpse === null ||
                      selectedCpse === n1.cpse ||
                      selectedCpse === n2.cpse;

                    return (
                      <line
                        key={`link-${idx1}-${idx2}`}
                        x1={n1.x}
                        y1={n1.y}
                        x2={n2.x}
                        y2={n2.y}
                        stroke={isHighlighted ? (selectedCpse ? '#10b981' : '#64748b') : '#334155'}
                        strokeOpacity={isHighlighted ? (selectedCpse ? 0.6 : 0.25) : 0.08}
                        strokeWidth={isHighlighted ? (selectedCpse ? 2 : 1) : 0.5}
                      />
                    );
                  })
                )}

                {/* Central CMM Spoke Radii */}
                {nodePositions.map((node) => (
                  <line
                    key={`spoke-${node.cpse}`}
                    x1={cx}
                    y1={cy}
                    x2={node.x}
                    y2={node.y}
                    stroke={node.color}
                    strokeOpacity={selectedCpse === null || selectedCpse === node.cpse ? 0.45 : 0.15}
                    strokeWidth={selectedCpse === node.cpse ? 2.5 : 1.5}
                    strokeDasharray={selectedCpse === node.cpse ? undefined : '3 3'}
                  />
                ))}

                {/* Central Hub Node (National Core Master) */}
                <g className="cursor-pointer" onClick={() => setSelectedCpse(null)}>
                  <circle cx={cx} cy={cy} r={34} fill="#0f172a" stroke="#10b981" strokeWidth={3} className="filter drop-shadow-lg" />
                  <circle cx={cx} cy={cy} r={28} fill="#10b981" fillOpacity={0.15} />
                  <text
                    x={cx}
                    y={cy - 4}
                    textAnchor="middle"
                    fill="#10b981"
                    fontSize="9.5"
                    fontWeight="800"
                    letterSpacing="0.05em"
                  >
                    CMM CORE
                  </text>
                  <text
                    x={cx}
                    y={cy + 10}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize="8"
                    fontWeight="600"
                  >
                    MASTER
                  </text>
                </g>

                {/* Outer CPSE Enterprise Nodes */}
                {nodePositions.map((node) => {
                  const isSelected = selectedCpse === node.cpse;
                  return (
                    <g
                      key={`node-${node.cpse}`}
                      className="cursor-pointer transition-transform hover:scale-110"
                      onClick={() => setSelectedCpse(isSelected ? null : node.cpse)}
                    >
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={isSelected ? 26 : 22}
                        fill="#1e293b"
                        stroke={node.color}
                        strokeWidth={isSelected ? 3 : 2}
                        className="transition-all duration-200"
                      />
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={isSelected ? 20 : 16}
                        fill={node.color}
                        fillOpacity={isSelected ? 0.25 : 0.15}
                      />
                      <text
                        x={node.x}
                        y={node.y + 4}
                        textAnchor="middle"
                        fill="#f8fafc"
                        fontSize={isSelected ? '10' : '9'}
                        fontWeight="700"
                      >
                        {node.cpse}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
              {nodePositions.map((node) => (
                <button
                  key={node.cpse}
                  onClick={() => setSelectedCpse(selectedCpse === node.cpse ? null : node.cpse)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all border ${
                    selectedCpse === node.cpse
                      ? 'bg-foreground text-background border-foreground shadow'
                      : 'bg-card text-muted-foreground border-border hover:border-foreground/30'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: node.color }} />
                  {node.cpse}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right Info & Overlap Ranking */}
        <div className="space-y-6">
          <Card className="border-border/60 bg-card/80 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Share2 className="h-4 w-4 text-blue-500" />
                Cross-CPSE Material Bridges
              </CardTitle>
              <CardDescription className="text-xs">
                Highest frequency co-occurring enterprise pairs
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              {topOverlaps.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No cross-CPSE overlap pairs discovered yet.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {topOverlaps.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 border-blue-500/40 text-blue-400">
                          {item.cpse1}
                        </Badge>
                        <span className="text-muted-foreground font-bold">⇄</span>
                        <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 border-emerald-500/40 text-emerald-400">
                          {item.cpse2}
                        </Badge>
                      </div>
                      <span className="font-bold text-foreground tabular-nums">
                        {item.shared_count.toLocaleString()} shared
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Info className="h-4 w-4 text-amber-500" />
                Harmonization Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 text-xs space-y-2 text-muted-foreground leading-relaxed">
              <p>
                Each outer node represents an interconnected public sector enterprise contributing raw material master records.
              </p>
              <p>
                The central core represents the <strong className="text-foreground">Common National Material Master</strong> canonical catalog created through semantic AI clustering and cross-CPSE deduplication.
              </p>
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
                Standardization rate is trending upwards by 18.4% across mechanical & piping categories.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Multi-CPSE Clusters Table ────────────────────────────────────────── */}
      <Card className="border-border/60 bg-card/80 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Verified Multi-CPSE Standardized Clusters
          </CardTitle>
          <CardDescription className="text-xs">
            Standardized items spanning across 2 or more major enterprises
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {clusters.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No multi-CPSE clusters loaded.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/80 text-muted-foreground font-semibold text-left">
                    <th className="py-2.5 px-3">CMM Code</th>
                    <th className="py-2.5 px-3">Canonical Material</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-center">Enterprises</th>
                    <th className="py-2.5 px-3">Participating CPSEs</th>
                    <th className="py-2.5 px-3 text-right">Mapped Records</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {clusters.slice(0, 10).map((c) => (
                    <tr key={c.cmm_id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-semibold text-foreground">
                        {c.cmm_id}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-foreground">
                        {c.canonical_name}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {c.category || 'General'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge variant="secondary" className="font-bold">
                          {c.cpse_count} CPSEs
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {c.cpses.map((cpse) => (
                            <Badge
                              key={cpse}
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 font-mono"
                              style={{
                                borderColor: `${CPSE_COLORS[cpse] || '#64748b'}88`,
                                color: CPSE_COLORS[cpse] || '#94a3b8',
                              }}
                            >
                              {cpse}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-foreground tabular-nums">
                        {c.mapped_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
