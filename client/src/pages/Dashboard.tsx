import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { nmcApi } from '@/services/nmcApi';
import {
  Building2,
  Layers,
  ShieldCheck,
  GitMerge,
  Clock,
  Database,
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

  const totalMaterials = metrics?.total_materials || 0;

  return (
    <AppLayout requireAdmin>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Material Harmonization Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cross-CPSE National Material Code (NMC) Governance &amp; Standardization Hub
          </p>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="border-border/60">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                Active CPSEs
              </CardDescription>
              <CardTitle className="text-2xl font-bold">
                {metrics?.total_cpsEs ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-[11px] text-muted-foreground">Registered enterprises</p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-primary" />
                Total Materials
              </CardDescription>
              <CardTitle className="text-2xl font-bold">
                {totalMaterials.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-[11px] text-muted-foreground">Raw catalog items</p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                Decisions Recorded
              </CardDescription>
              <CardTitle className="text-2xl font-bold">
                {metrics?.decisions_recorded ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <Link
                to="/audit"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                <span>Governance Log</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                Pending Review
              </CardDescription>
              <CardTitle className="text-2xl font-bold">
                {metrics?.pending_reviews ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <Link
                to="/review"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:underline"
              >
                <span>Review Queue</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs flex items-center gap-1.5">
                <GitMerge className="h-3.5 w-3.5 text-blue-500" />
                Mapped Items
              </CardDescription>
              <CardTitle className="text-2xl font-bold">
                {metrics?.mapped_materials ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-[11px] text-muted-foreground">Mapped to Common Master</p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-indigo-500" />
                NMC Master Codes
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-primary">
                {metrics?.total_national_codes ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-[11px] text-muted-foreground">Harmonized identities</p>
            </CardContent>
          </Card>
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
      </div>
    </AppLayout>
  );
}

