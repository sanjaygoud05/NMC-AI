/**
 * Data Quality & Profiling Page
 * In-depth health inspection across CPSE material masters: completeness, accuracy, consistency, validity.
 */

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  AlertCircle,
  BarChart3,
} from 'lucide-react';
import { mockCPSEs } from '@/lib/mock/cpse';

export default function DataQuality() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRunProfiler = () => {
    setIsRefreshing(true);
    toast.info('Running Phase 2 data profiling rules across master dataset...');
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success('Data profiling report updated successfully');
    }, 1200);
  };

  const fieldQualities = [
    { field: 'material_code', completeness: 100, validity: 100, consistency: 98, status: 'Healthy' },
    { field: 'description', completeness: 100, validity: 94, consistency: 82, status: 'Needs Normalization' },
    { field: 'category', completeness: 96, validity: 92, consistency: 88, status: 'Healthy' },
    { field: 'material_type', completeness: 91, validity: 89, consistency: 85, status: 'Healthy' },
    { field: 'unit_of_measure', completeness: 88, validity: 79, consistency: 74, status: 'Inconsistent UOMs' },
    { field: 'technical_attributes', completeness: 72, validity: 85, consistency: 70, status: 'Attribute Extraction Needed' },
    { field: 'manufacturer', completeness: 64, validity: 78, consistency: 65, status: 'Sparse Coverage' },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageHeader
            title="Data Quality & Integrity Profiler"
            description="Field-level completeness, validity checks, and CPSE ingestion diagnostics"
          />
          <Button
            onClick={handleRunProfiler}
            disabled={isRefreshing}
            className="gap-2 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Run Quality Profiler
          </Button>
        </div>

        {/* 4 Core Dimensions */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Overall Data Health</span>
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-3xl font-bold text-emerald-500 mt-2">91.4%</div>
              <Progress value={91.4} className="mt-2 h-1.5" />
              <div className="text-[11px] text-muted-foreground mt-2">+2.4% after text cleaning</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Completeness Score</span>
                <CheckCircle2 className="h-4 w-4 text-primary" />
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">87.3%</div>
              <Progress value={87.3} className="mt-2 h-1.5" />
              <div className="text-[11px] text-muted-foreground mt-2">Required fields filled</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">UOM Consistency</span>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-3xl font-bold text-amber-500 mt-2">78.6%</div>
              <Progress value={78.6} className="mt-2 h-1.5" />
              <div className="text-[11px] text-muted-foreground mt-2">41 variant abbreviations flagged</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Duplicate Entropy</span>
                <AlertCircle className="h-4 w-4 text-rose-500" />
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">14.2%</div>
              <Progress value={14.2} className="mt-2 h-1.5" />
              <div className="text-[11px] text-muted-foreground mt-2">Harmonization opportunities</div>
            </CardContent>
          </Card>
        </div>

        {/* Field Quality Table */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              Field-Level Profiling & Validation Rules
            </CardTitle>
            <CardDescription>
              Inspection across 1,250 ingested material records in CPSE_Material_Master_cleaned.csv
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field Name</TableHead>
                  <TableHead>Completeness</TableHead>
                  <TableHead>Format Validity</TableHead>
                  <TableHead>Cross-CPSE Consistency</TableHead>
                  <TableHead>Diagnostic Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fieldQualities.map((f) => (
                  <TableRow key={f.field} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs font-semibold text-foreground">
                      {f.field}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 max-w-[140px]">
                        <Progress value={f.completeness} className="h-1.5 flex-1" />
                        <span className="text-xs font-mono">{f.completeness}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 max-w-[140px]">
                        <Progress value={f.validity} className="h-1.5 flex-1" />
                        <span className="text-xs font-mono">{f.validity}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 max-w-[140px]">
                        <Progress value={f.consistency} className="h-1.5 flex-1" />
                        <span className="text-xs font-mono">{f.consistency}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={f.status === 'Healthy' ? 'secondary' : 'outline'}
                        className={`text-xs ${
                          f.status === 'Healthy'
                            ? 'text-emerald-500 border-emerald-500/20'
                            : 'text-amber-500 border-amber-500/20'
                        }`}
                      >
                        {f.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* CPSE Quality Matrix */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              CPSE Ingestion Quality Matrix
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CPSE Entity</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Standardization Rate</TableHead>
                  <TableHead>Harmonization Rate</TableHead>
                  <TableHead>Data Health</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockCPSEs.map((cpse) => (
                  <TableRow key={cpse.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="font-semibold text-sm text-foreground">{cpse.name}</div>
                      <div className="text-xs text-muted-foreground">{cpse.code} • {cpse.region}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{cpse.sector}</TableCell>
                    <TableCell className="font-mono text-xs">{cpse.materialCount.toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-xs">{((cpse.standardizedCount / cpse.materialCount) * 100).toFixed(1)}%</TableCell>
                    <TableCell className="font-mono text-xs">{((cpse.harmonizedCount / cpse.materialCount) * 100).toFixed(1)}%</TableCell>
                    <TableCell>
                      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs">
                        94.2%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="text-xs capitalize text-emerald-500 border-emerald-500/20">
                        {cpse.status}
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
