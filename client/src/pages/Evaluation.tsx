/**
 * Model Evaluation & Benchmark Page
 * Golden dataset evaluation, Precision/Recall/F1 metrics, and threshold sensitivity analysis.
 */

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { EmptyState } from '@/components/shared/EmptyState';
import { Info } from 'lucide-react';

export default function Evaluation() {
  const [threshold, setThreshold] = useState([85]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Model Evaluation & Benchmarking"
          description="Ground-truth validation, Precision/Recall trade-offs, and threshold calibration"
        />
        
        <Card className="border-border bg-card p-12">
          <EmptyState
            icon={Info}
            title="No Evaluation Results Available"
            description="Evaluation results will appear here after running benchmark evaluations against golden test datasets. The evaluation subsystem is not yet implemented."
          />
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Threshold Configuration</CardTitle>
            <CardDescription>
              Configure harmonization acceptance thresholds (saved for future evaluation implementation)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">Harmonization Acceptance Cutoff</span>
                <span className="font-mono text-primary font-bold">{threshold[0]}%</span>
              </div>
              <Slider
                value={threshold}
                onValueChange={setThreshold}
                min={50}
                max={98}
                step={1}
              />
              <div className="flex justify-between text-[11px] text-muted-foreground mt-2">
                <span>Higher Recall (50%)</span>
                <span>Balanced (85%)</span>
                <span>Higher Precision (98%)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
