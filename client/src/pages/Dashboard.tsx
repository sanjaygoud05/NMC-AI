import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { KPICard } from '@/components/dashboard/KPICard';
import { AttentionPanel } from '@/components/dashboard/AttentionPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Database,
  FileText,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Building2,
  Package,
  GitMerge,
  Clock,
  BarChart3,
} from 'lucide-react';
import { useDashboardMetrics } from '@/hooks/useDashboard';

export default function Dashboard() {
  const { data: metrics, isLoading } = useDashboardMetrics();

  const attentionItems = [
    {
      id: '1',
      type: 'critical' as const,
      title: 'Critical Data Quality Issues',
      description: '23 materials have missing critical attributes',
      count: 23,
    },
    {
      id: '2',
      type: 'warning' as const,
      title: 'Pending Standardization',
      description: '156 materials awaiting standardization review',
      count: 156,
    },
    {
      id: '3',
      type: 'info' as const,
      title: 'High Confidence Matches',
      description: '89 matches ready for auto-acceptance',
      count: 89,
    },
  ];

  const totalMaterials = metrics?.totalMaterials ?? 0;
  const totalCPSEs = metrics?.totalCPSEs ?? 0;
  const standardizedMaterials = metrics?.standardizedMaterials ?? 0;
  const harmonizedGroups = metrics?.harmonizedGroups ?? 0;
  const pendingReviews = metrics?.pendingReviews ?? 0;
  const highConfidenceMatches = metrics?.highConfidenceMatches ?? 0;
  const duplicateCandidates = metrics?.duplicateCandidates ?? 0;
  const dataQualityScore = metrics?.dataQualityScore ?? 0;
  const processingProgress = metrics?.processingProgress ?? 0;

  const standardizationRate = totalMaterials > 0
    ? Math.round((standardizedMaterials / totalMaterials) * 100)
    : 0;

  return (
    <AppLayout>
      <div className="space-y-8">
        <PageHeader
          title="Material Harmonization Dashboard"
          description="Monitor material standardization progress and harmonization metrics across all CPSEs"
        />

        {/* Primary KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Total Materials"
            value={isLoading ? '—' : totalMaterials.toLocaleString()}
            change={{ value: 'All CPSEs combined', trend: 'neutral' }}
            icon={Database}
            animationDelay="50ms"
          />
          <KPICard
            label="CPSEs Integrated"
            value={isLoading ? '—' : totalCPSEs.toString()}
            change={{ value: 'Active data sources', trend: 'neutral' }}
            icon={Building2}
            animationDelay="100ms"
          />
          <KPICard
            label="Standardized"
            value={isLoading ? '—' : standardizedMaterials.toLocaleString()}
            change={{ value: `${standardizationRate}% complete`, trend: 'up' }}
            icon={CheckCircle}
            animationDelay="150ms"
          />
          <KPICard
            label="Harmonized Groups"
            value={isLoading ? '—' : harmonizedGroups.toLocaleString()}
            change={{ value: 'Unique common materials', trend: 'up' }}
            icon={Package}
            animationDelay="200ms"
          />
        </div>

        {/* Secondary KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Pending Reviews"
            value={isLoading ? '—' : pendingReviews.toString()}
            change={{ value: 'Awaiting decision', trend: pendingReviews > 50 ? 'down' : 'neutral' }}
            icon={Clock}
            animationDelay="250ms"
          />
          <KPICard
            label="High Confidence Matches"
            value={isLoading ? '—' : highConfidenceMatches.toLocaleString()}
            change={{ value: 'Ready for auto-accept', trend: 'up' }}
            icon={GitMerge}
            animationDelay="300ms"
          />
          <KPICard
            label="Duplicate Candidates"
            value={isLoading ? '—' : duplicateCandidates.toString()}
            change={{ value: 'Across CPSEs', trend: 'neutral' }}
            icon={FileText}
            animationDelay="350ms"
          />
          <KPICard
            label="Data Quality Score"
            value={isLoading ? '—' : `${dataQualityScore}%`}
            change={{ value: 'Overall across all CPSEs', trend: dataQualityScore >= 80 ? 'up' : 'down' }}
            icon={BarChart3}
            animationDelay="400ms"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Attention Panel */}
          <AttentionPanel items={attentionItems} />

          {/* Processing Progress */}
          <Card className="border-border bg-card animate-fade-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: '100ms' }}>
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Pipeline Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Standardization</span>
                  <span className="text-sm font-medium text-foreground">{processingProgress}%</span>
                </div>
                <Progress value={processingProgress} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Harmonization</span>
                  <span className="text-sm font-medium text-foreground">
                    {totalMaterials > 0 ? Math.round((harmonizedGroups / totalMaterials) * 100 * 6.25) : 0}%
                  </span>
                </div>
                <Progress
                  value={totalMaterials > 0 ? Math.round((harmonizedGroups / totalMaterials) * 100 * 6.25) : 0}
                  className="h-2"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Data Quality</span>
                  <span className="text-sm font-medium text-foreground">{dataQualityScore}%</span>
                </div>
                <Progress value={dataQualityScore} className="h-2" />
              </div>
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Phase 3 (Attribute Extraction) in progress — mock data
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Status Summary */}
          <Card className="border-border bg-card animate-fade-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: '150ms' }}>
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Status Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: 'Data Ingestion', status: 'Completed', variant: 'default' as const },
                  { label: 'Data Profiling', status: 'Completed', variant: 'default' as const },
                  { label: 'Cleaning & Normalization', status: 'Completed', variant: 'default' as const },
                  { label: 'Attribute Extraction', status: 'In Progress', variant: 'secondary' as const },
                  { label: 'Standardization', status: 'Pending', variant: 'outline' as const },
                  { label: 'Embeddings & Matching', status: 'Pending', variant: 'outline' as const },
                  { label: 'Human Review', status: 'Pending', variant: 'outline' as const },
                  { label: 'Common Master', status: 'Pending', variant: 'outline' as const },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <Badge variant={item.variant} className="text-xs">
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analytics placeholder */}
        <Card className="border-border bg-card animate-fade-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: '200ms' }}>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Material Harmonization Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={AlertTriangle}
              title="Analytics Coming in Phase 1+"
              description="Category distribution charts, CPSE comparison, and temporal trends will appear here once the pipeline runs on the actual dataset."
            />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
