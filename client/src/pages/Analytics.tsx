import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { nmcApi } from '@/services/nmcApi';
import { BarChart3, Building2, CheckCircle2, GitMerge, Database, PieChart } from 'lucide-react';

export default function Analytics() {
  const { data: metrics } = useQuery({
    queryKey: ['nmc', 'dashboard-metrics'],
    queryFn: () => nmcApi.analytics.getDashboardMetrics(),
  });

  const { data: cpseStats, isLoading } = useQuery({
    queryKey: ['nmc', 'cpse-analytics'],
    queryFn: () => nmcApi.analytics.getCPSEAnalytics(),
  });

  const total = metrics?.total_materials || 0;
  const normalized = metrics?.normalized_materials || 0;
  const mapped = metrics?.mapped_materials || 0;

  const normPct = total > 0 ? Math.round((normalized / total) * 100) : 0;
  const mappedPct = total > 0 ? Math.round((mapped / total) * 100) : 0;

  return (
    <AppLayout requireAdmin>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Platform Harmonization Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Enterprise-level standardization progress, data maturity, and National Material Code adoption rates.
          </p>
        </div>

        {/* Global Progress Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Catalog Normalization Rate
                </CardTitle>
                <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                  {normPct}%
                </span>
              </div>
              <CardDescription className="text-xs">
                {normalized.toLocaleString()} of {total.toLocaleString()} catalog records cleaned and standardized
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Progress value={normPct} className="h-2" />
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <GitMerge className="h-4 w-4 text-primary" />
                  Common Master Adoption
                </CardTitle>
                <span className="font-bold text-lg text-primary">
                  {mappedPct}%
                </span>
              </div>
              <CardDescription className="text-xs">
                {mapped.toLocaleString()} materials mapped to {metrics?.total_national_codes || 0} unique NMC codes
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Progress value={mappedPct} className="h-2" />
            </CardContent>
          </Card>
        </div>

        {/* CPSE Breakdown Table */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              CPSE Enterprise Performance Breakdown
            </CardTitle>
            <CardDescription className="text-xs">
              Line-level harmonization progress across participating public sector enterprises.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="p-3 w-28">CPSE Code</th>
                    <th className="p-3">Enterprise Name</th>
                    <th className="p-3 w-32">Total Catalog Items</th>
                    <th className="p-3 w-32">Normalized Items</th>
                    <th className="p-3 w-32">Mapped Items</th>
                    <th className="p-3 w-40">Harmonization Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        Loading CPSE performance analytics...
                      </td>
                    </tr>
                  ) : !cpseStats || cpseStats.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No enterprise statistics available yet.
                      </td>
                    </tr>
                  ) : (
                    cpseStats.map((c: any) => {
                      const cTotal = c.total_materials || 0;
                      const cNorm = c.normalized_materials || 0;
                      const cMapped = c.mapped_materials || 0;
                      const cPct = cTotal > 0 ? Math.round((cNorm / cTotal) * 100) : 0;

                      return (
                        <tr key={c.cpse_id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-mono font-bold text-foreground">{c.cpse_code}</td>
                          <td className="p-3 font-medium text-foreground">{c.cpse_name}</td>
                          <td className="p-3 text-muted-foreground">{cTotal.toLocaleString()}</td>
                          <td className="p-3 text-emerald-600 dark:text-emerald-400 font-medium">
                            {cNorm.toLocaleString()}
                          </td>
                          <td className="p-3 text-primary font-medium">{cMapped.toLocaleString()}</td>
                          <td className="p-3">
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>Normalized</span>
                                <span className="font-semibold text-foreground">{cPct}%</span>
                              </div>
                              <Progress value={cPct} className="h-1.5" />
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
      </div>
    </AppLayout>
  );
}

