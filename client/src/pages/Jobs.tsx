/**
 * Processing Jobs & Pipeline Monitor Page
 * Real-time monitoring of asynchronous harmonization pipeline jobs, ETL status, and execution metrics.
 */

import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/EmptyState';
import { Activity, Info } from 'lucide-react';

export default function Jobs() {
  const jobs: never[] = [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Pipeline Jobs & Orchestration"
          description="Background task queue, execution phases, and performance telemetry"
        />
        
        <Card className="border-border bg-card p-12">
          <EmptyState
            icon={Activity}
            title="No Pipeline Jobs Recorded"
            description="Job tracking will appear here after dataset uploads are processed through the pipeline. The upload-processing lifecycle is preserved for future job tracking integration."
          />
        </Card>
      </div>
    </AppLayout>
  );
}
