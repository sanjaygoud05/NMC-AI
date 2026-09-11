/**
 * CPSE Analytics Page
 * Comparative cross-enterprise metrics: catalog volume, consumption by UOM, and verified harmonization.
 */

import { useState, useEffect } from 'react';
import { useDataset } from '@/contexts/DatasetContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Building2, Layers, TrendingUp, Network, CheckCircle, BarChart3, Database, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { procurementService, CPSEProcurementSummaryRecord } from '@/services/procurementService';

export default function CPSEAnalytics() {
  const { activeDatasetId, selectDataset } = useDataset();
  const [cpseSummaries, setCpseSummaries] = useState<CPSEProcurementSummaryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!activeDatasetId || activeDatasetId === 'NONE') {
        setCpseSummaries([]);
        setLoading(false);
        return;
      }
      try {
        const data = await procurementService.getCPSESummaries(activeDatasetId);
        setCpseSummaries(data);
      } catch (err) {
        console.error('Failed to load CPSE summaries:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activeDatasetId]);

  if (activeDatasetId === 'NONE') {
    return (
      <AppLayout>
        <div className="space-y-6">
          <PageHeader
            title="CPSE Cross-Enterprise Analytics"
            description="Enterprise-level comparisons, catalog volumes, and verified cross-CPSE harmonization"
          />
          <Card className="border-border bg-card p-12">
            <EmptyState
              icon={Database}
              title="No Dataset Selected"
              description="Upload a material master dataset or explicitly select an existing dataset to begin."
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
        </div>
      </AppLayout>
    );
  }

  const totalMaterials = cpseSummaries.reduce((acc, c) => acc + c.total_material_records, 0);
  const totalActive = cpseSummaries.reduce((acc, c) => acc + c.active_material_count, 0);
  const totalNosVolume = cpseSummaries.reduce((acc, c) => acc + c.total_volume_nos, 0);

  const catalogChartData = cpseSummaries.map((c, i) => ({
    cpse: c.source_cpse,
    count: c.total_material_records,
    fill: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][i % 4],
  }));

  const nosChartData = cpseSummaries.map((c, i) => ({
    cpse: c.source_cpse,
    volume: c.total_volume_nos,
    fill: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][i % 4],
  }));

  const CustomCatalogTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-card text-foreground border border-border px-4 py-3 rounded-lg shadow-xl text-xs space-y-1.5 select-none pointer-events-none z-50">
          <div className="font-semibold text-foreground flex items-center gap-2 text-sm">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: data.payload.fill }} />
            {label} Petroleum
          </div>
          <div className="flex items-center justify-between gap-6 text-muted-foreground pt-0.5">
            <span>Material Records:</span>
            <span className="font-bold text-foreground text-xs">{data.value?.toLocaleString()} items</span>
          </div>
          <div className="text-[11px] text-muted-foreground">Directly queried from CPSE Catalog</div>
        </div>
      );
    }
    return null;
  };

  const CustomVolumeTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-card text-foreground border border-border px-4 py-3 rounded-lg shadow-xl text-xs space-y-1.5 select-none pointer-events-none z-50">
          <div className="font-semibold text-foreground flex items-center gap-2 text-sm">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: data.payload.fill }} />
            {label} Petroleum
          </div>
          <div className="flex items-center justify-between gap-6 text-muted-foreground pt-0.5">
            <span>Annual Volume:</span>
            <span className="font-bold text-foreground text-xs">{data.value?.toLocaleString()} NOS</span>
          </div>
          <div className="text-[11px] text-muted-foreground">Conserved Physical Discrete Units (NOS)</div>
        </div>
      );
    }
    return null;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="CPSE Cross-Enterprise Analytics"
          description="Enterprise-level comparisons, catalog volumes, and verified cross-CPSE harmonization"
        />

        {/* Global KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Connected CPSEs</div>
              <div className="text-3xl font-bold text-foreground mt-1">{cpseSummaries.length}</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {cpseSummaries.length > 0 ? cpseSummaries.map(c => c.source_cpse).join(', ') : 'No CPSE data'}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Total Material Universe</div>
              <div className="text-3xl font-bold text-foreground mt-1">{totalMaterials.toLocaleString()}</div>
              <div className="text-[11px] text-muted-foreground mt-1">100% verified baseline items</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Active Materials</div>
              <div className="text-3xl font-bold text-emerald-500 mt-1">
                {totalMaterials > 0 ? ((totalActive / totalMaterials) * 100).toFixed(1) : '—'}%
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">{totalActive.toLocaleString()} active items</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Annual NOS Volume</div>
              <div className="text-3xl font-bold text-primary mt-1">
                {totalNosVolume.toLocaleString()}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">Strict per-UOM aggregation</div>
            </CardContent>
          </Card>
        </div>

        {/* Recharts Visualizations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Material Records per CPSE
              </CardTitle>
              <CardDescription>Directly queried from Phase 10 CPSE summaries</CardDescription>
            </CardHeader>
            <CardContent>
              {catalogChartData.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={catalogChartData}>
                      <XAxis dataKey="cpse" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip
                        cursor={false}
                        content={<CustomCatalogTooltip />}
                        wrapperStyle={{ outline: 'none', zIndex: 50 }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {catalogChartData.map((entry, index) => (
                          <Cell key={`cell-cat-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 w-full flex items-center justify-center text-muted-foreground text-sm">
                  No CPSE data available
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Annual Consumption Volume (NOS) per CPSE
              </CardTitle>
              <CardDescription>UOM: NOS (Number / Pieces) — Conserved physical volume</CardDescription>
            </CardHeader>
            <CardContent>
              {nosChartData.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={nosChartData}>
                      <XAxis dataKey="cpse" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                      <Tooltip
                        cursor={false}
                        content={<CustomVolumeTooltip />}
                        wrapperStyle={{ outline: 'none', zIndex: 50 }}
                      />
                      <Bar dataKey="volume" radius={[4, 4, 0, 0]}>
                        {nosChartData.map((entry, index) => (
                          <Cell key={`cell-vol-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 w-full flex items-center justify-center text-muted-foreground text-sm">
                  No volume data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* CPSE Breakdown Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {cpseSummaries.map((cpse) => {
            const activePct = ((cpse.active_material_count / cpse.total_material_records) * 100).toFixed(0);

            return (
              <Card key={cpse.source_cpse} className="border-border bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="font-mono text-xs">
                      {cpse.source_cpse}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] text-emerald-500">
                      {cpse.distinct_plants_count} Plants
                    </Badge>
                  </div>
                  <CardTitle className="text-sm font-semibold truncate mt-1">
                    {cpse.source_cpse} Petroleum Master
                  </CardTitle>
                  <CardDescription className="text-xs">{cpse.distinct_manufacturers_count} Registered Mfrs</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Active Item Ratio</span>
                      <span className="font-mono font-medium">{activePct}%</span>
                    </div>
                    <Progress value={Number(activePct)} className="h-1.5" />
                  </div>

                  <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Total Records:</span>
                      <span className="font-semibold text-foreground">{cpse.total_material_records}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Volume (NOS):</span>
                      <span className="font-semibold text-foreground">{cpse.total_volume_nos.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Volume (MTR):</span>
                      <span className="font-semibold text-foreground">{cpse.total_volume_mtr.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Harmonized Pairs:</span>
                      <span className="font-semibold text-primary">{cpse.multi_cpse_harmonized_members}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Verified Overlap Matrix - removed hardcoded data, will be replaced with API */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Network className="h-4 w-4 text-primary" />
              Verified Multi-CPSE Harmonization Relationships (Phase 8 & 9)
            </CardTitle>
            <CardDescription>
              Technically validated and human-reviewed cross-enterprise common materials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-16 text-muted-foreground text-sm">
              Verified multi-CPSE harmonization relationships will appear here after dataset-driven API integration.
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
