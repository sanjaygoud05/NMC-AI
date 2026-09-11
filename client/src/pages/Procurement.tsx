/**
 * Procurement Intelligence & Joint Sourcing Page
 * Identification of cross-CPSE volume aggregation, price variance, and consolidation opportunities.
 */

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
  TrendingDown,
  CircleDollarSign,
  ShoppingCart,
  Users,
  Search,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import { mockProcurementInsights } from '@/lib/mock/procurement';

export default function Procurement() {
  const [search, setSearch] = useState('');

  const totalValue = mockProcurementInsights.reduce((acc, p) => acc + p.totalAnnualValue, 0);
  const totalSavings = mockProcurementInsights.reduce((acc, p) => acc + p.potentialSavings, 0);
  const avgSavingsPct = (
    mockProcurementInsights.reduce((acc, p) => acc + p.savingsPercentage, 0) /
    mockProcurementInsights.length
  ).toFixed(1);

  const filteredInsights = mockProcurementInsights.filter((p) => {
    const q = search.toLowerCase();
    return (
      !search ||
      p.commonCode.toLowerCase().includes(q) ||
      p.commonDescription.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.recommendedAction.toLowerCase().includes(q)
    );
  });

  const handleExportBrief = (code: string) => {
    toast.success(`Exporting joint procurement brief for ${code}`);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageHeader
            title="Procurement Intelligence & Joint Sourcing"
            description="Consolidated demand aggregation, inter-enterprise price variances, and savings opportunities"
          />
          <Button
            onClick={() => toast.success('Exporting full CPSE Joint Sourcing Dossier (PDF/Excel)')}
            variant="outline"
            size="sm"
            className="gap-2 shrink-0"
          >
            <Download className="h-4 w-4" />
            Export Sourcing Dossier
          </Button>
        </div>

        {/* Financial KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Aggregated Annual Spend</span>
                <CircleDollarSign className="h-4 w-4 text-primary" />
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">
                ₹{(totalValue / 10000000).toFixed(2)} Cr
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">Across analyzed categories</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Identified Net Savings</span>
                <TrendingDown className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-3xl font-bold text-emerald-500 mt-2">
                ₹{(totalSavings / 100000).toFixed(1)} Lakhs
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                Avg {avgSavingsPct}% savings via bulk tender
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Pooled Sourcing Items</span>
                <ShoppingCart className="h-4 w-4 text-primary" />
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">
                {mockProcurementInsights.length} Categories
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">High-impact bulk items</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Participating CPSEs</span>
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">5 CPSEs</div>
              <div className="text-[11px] text-muted-foreground mt-1">Ready for unified tender</div>
            </CardContent>
          </Card>
        </div>

        {/* Filter bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search joint procurement opportunities..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Badge variant="secondary" className="text-xs">
            {filteredInsights.length} opportunities identified
          </Badge>
        </div>

        {/* Opportunities Table */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Consolidated Sourcing Opportunities
            </CardTitle>
            <CardDescription>
              Volume-weighted pricing analysis and AI-recommended contracting frameworks
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Common Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Annual Demand</TableHead>
                  <TableHead className="text-right">Combined Value</TableHead>
                  <TableHead className="text-center">CPSEs</TableHead>
                  <TableHead className="text-right">Potential Savings</TableHead>
                  <TableHead>Recommended Strategic Action</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInsights.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/30">
                    <TableCell className="max-w-[200px]">
                      <div className="font-mono text-xs font-semibold text-primary">{item.commonCode}</div>
                      <div className="text-xs text-foreground font-medium truncate">{item.commonDescription}</div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {item.category}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right font-mono text-xs">
                      {item.totalAnnualDemand.toLocaleString()}
                    </TableCell>

                    <TableCell className="text-right font-mono text-xs font-semibold">
                      ₹{(item.totalAnnualValue / 100000).toFixed(1)}L
                    </TableCell>

                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-xs">
                        {item.cpseCount} CPSEs
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="text-xs font-semibold text-emerald-500">
                        ₹{(item.potentialSavings / 100000).toFixed(1)}L
                      </div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                        {item.savingsPercentage}% savings
                      </div>
                    </TableCell>

                    <TableCell className="max-w-[260px]">
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {item.recommendedAction}
                      </p>
                      {item.riskFactors && item.riskFactors.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {item.riskFactors.map((r) => (
                            <span key={r} className="text-[10px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                              {r}
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <Button
                        onClick={() => handleExportBrief(item.commonCode)}
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Export sourcing brief"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                      </Button>
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
