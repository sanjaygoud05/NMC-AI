import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { nmcApi } from '@/services/nmcApi';
import { DashboardAnalyticsOverview } from '@/components/dashboard/DashboardAnalyticsOverview';
import {
  Database,
  Building2,
  CheckCircle2,
  Box,
  Clock,
  GitFork,
  Layers,
  BarChart3,
  ArrowRight,
} from 'lucide-react';

export default function Dashboard() {
  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['nmc', 'dashboard-metrics'],
    queryFn: () => nmcApi.analytics.getDashboardMetrics(),
    refetchInterval: 10000,
  });

  const { data: cpses, isLoading: loadingCpses } = useQuery({
    queryKey: ['nmc', 'cpses-list'],
    queryFn: () => nmcApi.cpses.list(),
  });

  const { data: cpseAnalytics } = useQuery({
    queryKey: ['nmc', 'cpse-analytics'],
    queryFn: () => nmcApi.analytics.getCPSEAnalytics(),
  });

  const kpis = [
    {
      title: 'Total Materials',
      value: metrics?.total_materials != null ? Number(metrics.total_materials).toLocaleString() : '0',
      icon: Database,
      subtext: 'All CPSEs combined',
      trend: null,
    },
    {
      title: 'CPSEs Integrated',
      value: metrics?.total_cpses != null ? metrics.total_cpses : (metrics?.total_cpsEs != null ? metrics.total_cpsEs : '0'),
      icon: Building2,
      subtext: 'Active public enterprises',
      trend: null,
    },
    {
      title: 'Standardized Records',
      value: metrics?.standardized_records != null ? Number(metrics.standardized_records).toLocaleString() : (metrics?.normalized_materials != null ? Number(metrics.normalized_materials).toLocaleString() : '0'),
      icon: CheckCircle2,
      subtext: `${metrics?.total_materials ? Math.round(((metrics.standardized_records ?? metrics.normalized_materials ?? 0) / metrics.total_materials) * 100) : 100}% catalog standardized`,
      trend: 'up',
    },
    {
      title: 'Harmonized Groups',
      value: metrics?.harmonized_groups != null ? Number(metrics.harmonized_groups).toLocaleString() : (metrics?.total_national_codes != null ? Number(metrics.total_national_codes).toLocaleString() : '0'),
      icon: Box,
      subtext: 'Golden common master records',
      trend: 'up',
    },
    {
      title: 'Pending Reviews',
      value: metrics?.pending_reviews != null ? Number(metrics.pending_reviews).toLocaleString() : '0',
      icon: Clock,
      subtext: 'Awaiting human decision',
      trend: 'down',
    },
    {
      title: 'High Confidence Matches',
      value: metrics?.high_confidence_matches != null ? Number(metrics.high_confidence_matches).toLocaleString() : '0',
      icon: GitFork,
      subtext: 'AI consensus verified',
      trend: 'up',
    },
    {
      title: 'Match Candidates',
      value: metrics?.match_candidates != null ? Number(metrics.match_candidates).toLocaleString() : '0',
      icon: Layers,
      subtext: 'Cross-CPSE candidate pairs',
      trend: null,
    },
    {
      title: 'Data Quality Score',
      value: metrics?.data_quality_score != null ? `${metrics.data_quality_score}%` : '0%',
      icon: BarChart3,
      subtext: 'Overall completeness & validity',
      trend: 'up',
    },
  ];

  return (
    <AppLayout requireAdmin>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-sans">
              Material Harmonization Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Overview of cross-enterprise material deduplication, quality health, and harmonization pipeline.
            </p>
          </div>
        </div>

        {/* 8 KPI Cards Grid - Theme Adaptive (Pure black in dark mode, light card in light mode) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <div
                key={idx}
                className="bg-card dark:bg-black border border-border dark:border-zinc-800/90 rounded-lg p-5 flex flex-col justify-between hover:border-foreground/20 dark:hover:border-zinc-700/80 transition-colors shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-muted-foreground">{kpi.title}</span>
                  <Icon className="h-4 w-4 text-muted-foreground stroke-[1.5]" />
                </div>
                <div className="my-2.5">
                  <span className="text-3xl font-bold tracking-tight text-foreground font-sans">
                    {kpi.value}
                  </span>
                </div>
                <div>
                  {kpi.trend === 'up' ? (
                    <div className="text-xs font-normal text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <span className="text-[11px] leading-none">↑</span>
                      <span>{kpi.subtext}</span>
                    </div>
                  ) : kpi.trend === 'down' ? (
                    <div className="text-xs font-normal text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <span className="text-[11px] leading-none">↓</span>
                      <span>{kpi.subtext}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground font-normal">
                      {kpi.subtext}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* CPSE Catalog Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">CPSE Catalog Breakdown</h2>
            <Link to="/manage-cpses">
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground">
                Manage CPSEs →
              </Button>
            </Link>
          </div>

          <div className="rounded-lg border border-border/60 overflow-hidden bg-card">
            {loadingCpses ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Loading enterprise datasets...
              </div>
            ) : !cpses || cpses.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <p className="text-sm text-muted-foreground">No CPSE enterprises registered yet.</p>
                <Link to="/manage-cpses">
                  <Button size="sm" className="gap-1.5 text-xs h-8 mt-1">
                    <Building2 className="h-3.5 w-3.5" />
                    Add First CPSE
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                {/* Table header */}
                <div className="grid grid-cols-[2rem_1fr_8rem_8rem_6rem] gap-x-3 px-4 py-2 border-b border-border/50 bg-muted/30">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">#</span>
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Enterprise</span>
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Materials</span>
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Mapped</span>
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide text-right">Progress</span>
                </div>

                {/* Table rows */}
                {cpses.map((c: any, idx: number) => {
                  const activeDs = c.active_dataset;
                  const status = activeDs?.status || 'NO_DATASET';
                  const totalItems = activeDs?.record_count ?? 0;
                  const mapped = c.mapped_count ?? 0;
                  const pct = totalItems > 0 ? Math.round((mapped / totalItems) * 100) : 0;

                  return (
                    <div
                      key={c.id}
                      className="grid grid-cols-[2rem_1fr_8rem_8rem_6rem] gap-x-3 px-4 py-2.5 border-b border-border/40 last:border-b-0 hover:bg-muted/20 transition-colors"
                    >
                      {/* # */}
                      <span className="text-xs text-muted-foreground/60 flex items-center">{idx + 1}</span>

                      {/* Enterprise */}
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{c.name}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 shrink-0 ${
                            status === 'NORMALIZED'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              : status === 'VALIDATED'
                              ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                              : status === 'PROCESSING'
                              ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                              : 'bg-muted text-muted-foreground border-border/40'
                          }`}
                        >
                          {status}
                        </Badge>
                      </div>

                      {/* Materials */}
                      <div className="flex items-center">
                        <span className="text-xs text-muted-foreground">
                          {totalItems > 0 ? totalItems.toLocaleString() : '—'}
                        </span>
                      </div>

                      {/* Mapped */}
                      <div className="flex items-center">
                        <span className="text-xs text-muted-foreground">{mapped}</span>
                      </div>

                      {/* Progress */}
                      <div className="flex items-center justify-end">
                        <span className="text-xs text-muted-foreground">{pct}%</span>
                      </div>
                    </div>
                  );
                })}

                {/* Footer */}
                <div className="px-4 py-2 bg-muted/20 border-t border-border/40 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Participating enterprises: {cpses.length}
                  </span>
                  <Link to="/common-master">
                    <Button variant="ghost" size="sm" className="text-xs h-6 px-2 text-muted-foreground hover:text-foreground">
                      Central catalog ledger
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Harmonization Analytics & Distribution Overview */}
        <DashboardAnalyticsOverview metrics={metrics} cpses={cpses} cpseAnalytics={cpseAnalytics} />
      </div>
    </AppLayout>
  );
}

