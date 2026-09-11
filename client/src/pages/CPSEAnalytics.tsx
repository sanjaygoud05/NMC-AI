/**
 * CPSE Analytics Page
 * Comparative cross-enterprise metrics: catalog overlap, standardization rates, sector distribution.
 */

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
import { Building2, Layers, TrendingUp, Network, CheckCircle, PieChart } from 'lucide-react';
import { mockCPSEs } from '@/lib/mock/cpse';

export default function CPSEAnalytics() {
  const totalMaterials = mockCPSEs.reduce((acc, c) => acc + c.materialCount, 0);
  const totalStandardized = mockCPSEs.reduce((acc, c) => acc + c.standardizedCount, 0);
  const totalHarmonized = mockCPSEs.reduce((acc, c) => acc + c.harmonizedCount, 0);

  const overlapMatrix = [
    { from: 'CPCL', to: 'IOCL', sharedItems: 142, overlapPct: '31.5%' },
    { from: 'CPCL', to: 'ONGC', sharedItems: 98, overlapPct: '21.8%' },
    { from: 'IOCL', to: 'GAIL', sharedItems: 84, overlapPct: '22.1%' },
    { from: 'ONGC', to: 'GAIL', sharedItems: 67, overlapPct: '23.9%' },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="CPSE Cross-Enterprise Analytics"
          description="Enterprise-level comparisons, catalog overlaps, and harmonization velocity"
        />

        {/* Global KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Connected CPSEs</div>
              <div className="text-3xl font-bold text-foreground mt-1">{mockCPSEs.length}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Petroleum, Gas, Exploration</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Total Managed Items</div>
              <div className="text-3xl font-bold text-foreground mt-1">{totalMaterials.toLocaleString()}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Across all enterprise masters</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Standardized Items</div>
              <div className="text-3xl font-bold text-emerald-500 mt-1">
                {((totalStandardized / totalMaterials) * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">{totalStandardized.toLocaleString()} normalized</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">Harmonization Coverage</div>
              <div className="text-3xl font-bold text-primary mt-1">
                {((totalHarmonized / totalMaterials) * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">{totalHarmonized.toLocaleString()} mapped to Common Master</div>
            </CardContent>
          </Card>
        </div>

        {/* CPSE Breakdown Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {mockCPSEs.map((cpse) => {
            const stdPct = ((cpse.standardizedCount / cpse.materialCount) * 100).toFixed(0);
            const harmPct = ((cpse.harmonizedCount / cpse.materialCount) * 100).toFixed(0);

            return (
              <Card key={cpse.id} className="border-border bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="font-mono text-xs">
                      {cpse.code}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] text-emerald-500">
                      Active
                    </Badge>
                  </div>
                  <CardTitle className="text-sm font-semibold truncate mt-1">
                    {cpse.name}
                  </CardTitle>
                  <CardDescription className="text-xs">{cpse.sector}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Standardization</span>
                      <span className="font-mono font-medium">{stdPct}%</span>
                    </div>
                    <Progress value={Number(stdPct)} className="h-1.5" />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Harmonization</span>
                      <span className="font-mono font-medium">{harmPct}%</span>
                    </div>
                    <Progress value={Number(harmPct)} className="h-1.5" />
                  </div>

                  <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground flex justify-between">
                    <span>Region: {cpse.region}</span>
                    <span>{cpse.materialCount} items</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Overlap Matrix */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Network className="h-4 w-4 text-primary" />
              Cross-CPSE Material Overlap Matrix
            </CardTitle>
            <CardDescription>
              Identified duplicate or synonymous material demand across CPSE boundaries
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Primary CPSE</TableHead>
                  <TableHead>Target CPSE</TableHead>
                  <TableHead className="text-center">Identical / Mapped SKUs</TableHead>
                  <TableHead className="text-center">Catalog Overlap %</TableHead>
                  <TableHead className="text-right">Procurement Opportunity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overlapMatrix.map((row, idx) => (
                  <TableRow key={idx} className="hover:bg-muted/30">
                    <TableCell className="font-semibold text-sm">{row.from}</TableCell>
                    <TableCell className="font-semibold text-sm">{row.to}</TableCell>
                    <TableCell className="text-center font-mono text-sm font-semibold text-primary">
                      {row.sharedItems}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {row.overlapPct}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs">
                        High Potential
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
