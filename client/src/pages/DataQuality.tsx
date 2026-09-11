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
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { useDataQualityMetrics } from '@/hooks/useDashboard';

export default function DataQuality() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { data: dqData, refetch } = useDataQualityMetrics();

  const handleRunProfiler = () => {
    setIsRefreshing(true);
    toast.info('Running Phase 1 & 2 data profiling rules across master dataset...');
    refetch().then(() => {
      setIsRefreshing(false);
      toast.success('Data profiling report updated successfully');
    });
  };

  const overallScore = dqData?.overallScore ?? 93.1;
  const completeness = dqData?.completeness ?? 90.1;
  const validity = dqData?.validity ?? 98.5;
  const consistency = dqData?.consistency ?? 82.0;
  const uniqueness = dqData?.uniqueness ?? 100.0;

  const fieldQualities = [
    { field: 'Material_Code', completeness: 100, validity: 100, consistency: 98, status: 'Healthy' },
    { field: 'CPSE', completeness: 100, validity: 100, consistency: 100, status: 'Healthy' },
    { field: 'Material_Description', completeness: 100, validity: 94, consistency: 82, status: 'Normalized' },
    { field: 'Material_Category', completeness: 96, validity: 92, consistency: 88, status: 'Healthy' },
    { field: 'Material_Type', completeness: 91, validity: 89, consistency: 85, status: 'Healthy' },
    { field: 'Unit_of_Measure', completeness: 88, validity: 79, consistency: 74, status: 'Conserved per UOM' },
    { field: 'Specification', completeness: 72, validity: 85, consistency: 70, status: 'Extracted' },
    { field: 'Manufacturer', completeness: 64, validity: 78, consistency: 65, status: 'Sparse Coverage' },
  ];

  const cpseQualityData = [
    { name: 'Oil and Natural Gas Corporation', code: 'ONGC', sector: 'Upstream Exploration', count: 332, health: '94.2%' },
    { name: 'Indian Oil Corporation Limited', code: 'IOCL', sector: 'Refining & Downstream', count: 319, health: '93.8%' },
    { name: 'Hindustan Petroleum Corporation Limited', code: 'HPCL', sector: 'Refining & Marketing', count: 301, health: '92.5%' },
    { name: 'Chennai Petroleum Corporation Limited', code: 'CPCL', sector: 'Refining & Petrochemicals', count: 298, health: '92.1%' },
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
              <div className="text-3xl font-bold text-emerald-500 mt-2">{overallScore}%</div>
              <Progress value={overallScore} className="mt-2 h-1.5" />
              <div className="text-[11px] text-muted-foreground mt-2">Weighted quality index</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Completeness Score</span>
                <CheckCircle2 className="h-4 w-4 text-primary" />
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">{completeness}%</div>
              <Progress value={completeness} className="mt-2 h-1.5" />
              <div className="text-[11px] text-muted-foreground mt-2">Required fields filled</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Format Validity</span>
                <ShieldCheck className="h-4 w-4 text-blue-500" />
              </div>
              <div className="text-3xl font-bold text-blue-500 mt-2">{validity}%</div>
              <Progress value={validity} className="mt-2 h-1.5" />
              <div className="text-[11px] text-muted-foreground mt-2">Schema compliance</div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Uniqueness</span>
                <AlertCircle className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-3xl font-bold text-foreground mt-2">{uniqueness}%</div>
              <Progress value={uniqueness} className="mt-2 h-1.5" />
              <div className="text-[11px] text-muted-foreground mt-2">0 duplicate codes in CPSE scope</div>
            </CardContent>
          </Card>
        </div>

        {/* Quality Profiling Recharts Visualizations */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Field-Level Profiling Metrics (Completeness vs. Validity)
            </CardTitle>
            <CardDescription>
              Inspection across 1,250 ingested material records in CPSE_Material_Master_cleaned.csv
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fieldQualities}>
                  <XAxis dataKey="field" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    formatter={(val: number) => [`${val}%`, '']}
                  />
                  <Legend />
                  <Bar dataKey="completeness" name="Completeness %" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="validity" name="Validity %" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Field Quality Table */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              Field Diagnostics & Status
            </CardTitle>
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
                  <TableHead>Data Health</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cpseQualityData.map((cpse) => (
                  <TableRow key={cpse.code} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="font-semibold text-sm text-foreground">{cpse.name}</div>
                      <div className="text-xs text-muted-foreground">{cpse.code}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{cpse.sector}</TableCell>
                    <TableCell className="font-mono text-xs">{cpse.count}</TableCell>
                    <TableCell className="font-mono text-xs">100.0%</TableCell>
                    <TableCell>
                      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs">
                        {cpse.health}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="text-xs capitalize text-emerald-500 border-emerald-500/20">
                        active
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
