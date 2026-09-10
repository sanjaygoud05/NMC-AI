import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useDemoScenario } from '@/hooks/useDemoScenario';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { TimeRangeSelector } from '@/components/dashboard/TimeRangeSelector';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { RequestVolumeChart } from '@/components/dashboard/RequestVolumeChart';
import { StatusDistributionChart } from '@/components/dashboard/StatusDistributionChart';
import { RequestsByTypeChart } from '@/components/dashboard/RequestsByTypeChart';
import { NewRequestSheet } from '@/components/requests/NewRequestSheet';
import { useDemoBanner } from '@/components/dashboard/DemoBanner';
import { FileText, Clock, CheckCircle, XCircle, Plus } from 'lucide-react';
import { 
  getScenarioRequestsInRange,
  getScenarioRequestMetrics,
  getScenarioStatusDistribution,
  getScenarioRequestsByType,
  getScenarioRequestVolume,
  timeRangeToDays,
  getTimeRangeLabel,
} from '@/lib/mockData';

export default function Dashboard() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { profile } = useAuth();
  const { scenario } = useDemoScenario();
  const displayName = profile?.first_name ? profile.first_name : 'there';

  // Filter state
  const [timeRange, setTimeRange] = useState<string>('7d');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Reset type filter when scenario changes (since types differ per scenario)
  useEffect(() => {
    setSelectedType('all');
  }, [scenario]);

  // Show demo banner on mount
  useDemoBanner();

  // Filter requests based on all three filters using scenario-aware data
  const filteredRequests = useMemo(() => {
    const days = timeRangeToDays(timeRange);
    let requests = getScenarioRequestsInRange(scenario, days);
    
    if (selectedType !== 'all') {
      requests = requests.filter(r => r.type_name === selectedType);
    }
    
    if (selectedStatus !== 'all') {
      requests = requests.filter(r => r.status === selectedStatus);
    }
    
    return requests;
  }, [scenario, timeRange, selectedType, selectedStatus]);

  // Calculate metrics from filtered data
  const metrics = useMemo(() => {
    return getScenarioRequestMetrics(filteredRequests);
  }, [filteredRequests]);

  // Get chart data from filtered requests
  const days = timeRangeToDays(timeRange);
  const timeLabel = getTimeRangeLabel(timeRange);

  const volumeData = useMemo(() => {
    return getScenarioRequestVolume(filteredRequests, days);
  }, [filteredRequests, days]);

  const statusData = useMemo(() => {
    return getScenarioStatusDistribution(filteredRequests);
  }, [filteredRequests]);

  const typeData = useMemo(() => {
    return getScenarioRequestsByType(filteredRequests);
  }, [filteredRequests]);
  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header Section */}
        <PageHeader title={`Welcome back, ${displayName}`} description="Track and manage your workflow activity">
          {/* Controls Row - Responsive layout 
              - Desktop (lg+): All on one row
              - Tablet (md-lg): Time range row 1, filters + CTA row 2
              - Mobile (below md): Three rows, each full width
          */}
          <div className="flex flex-col gap-3 w-full">
            {/* Desktop: Single row with all controls */}
            <div className="hidden lg:flex lg:flex-row lg:items-center lg:gap-3 w-full">
              <TimeRangeSelector 
                value={timeRange} 
                onChange={setTimeRange} 
                className="border shrink-0" 
              />
              <div className="flex items-center gap-3 ml-auto">
                <DashboardFilters
                  selectedType={selectedType}
                  selectedStatus={selectedStatus}
                  onTypeChange={setSelectedType}
                  onStatusChange={setSelectedStatus}
                />
                <Button className="gap-2 shrink-0" onClick={() => setSheetOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New Request
                </Button>
              </div>
            </div>

            {/* Tablet (md to lg): Two rows */}
            <div className="hidden md:flex md:flex-col md:gap-3 lg:hidden w-full">
              <TimeRangeSelector 
                value={timeRange} 
                onChange={setTimeRange} 
                className="border w-full" 
              />
              <div className="flex items-center gap-3 w-full">
                <DashboardFilters
                  selectedType={selectedType}
                  selectedStatus={selectedStatus}
                  onTypeChange={setSelectedType}
                  onStatusChange={setSelectedStatus}
                />
                <Button className="gap-2 flex-1" onClick={() => setSheetOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New Request
                </Button>
              </div>
            </div>

            {/* Mobile (below md): Three rows, full width */}
            <div className="flex flex-col gap-3 md:hidden w-full">
              <TimeRangeSelector 
                value={timeRange} 
                onChange={setTimeRange} 
                className="border w-full" 
              />
              <DashboardFilters
                selectedType={selectedType}
                selectedStatus={selectedStatus}
                onTypeChange={setSelectedType}
                onStatusChange={setSelectedStatus}
                className="w-full"
              />
              <Button className="gap-2 w-full" onClick={() => setSheetOpen(true)}>
                <Plus className="h-4 w-4" />
                New Request
              </Button>
            </div>
          </div>
        </PageHeader>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
            label="Total Requests" 
            value={metrics.total.toString()} 
            change={{
              value: timeLabel,
              trend: 'neutral'
            }} 
            icon={FileText} 
            animationDelay="50ms" 
          />
          <MetricCard 
            label="Pending Review" 
            value={metrics.pending.toString()} 
            change={{
              value: metrics.pending > 0 ? 'Needs attention' : 'All clear',
              trend: metrics.pending > 5 ? 'down' : 'neutral'
            }} 
            icon={Clock} 
            animationDelay="100ms" 
          />
          <MetricCard 
            label="Approved" 
            value={metrics.approved.toString()} 
            change={{
              value: timeLabel,
              trend: 'up'
            }} 
            icon={CheckCircle} 
            animationDelay="150ms" 
          />
          <MetricCard 
            label="Rejected" 
            value={metrics.rejected.toString()} 
            change={{
              value: timeLabel,
              trend: 'neutral'
            }} 
            icon={XCircle} 
            animationDelay="200ms" 
          />
        </div>

        {/* Request Volume Chart - Full Width */}
        <RequestVolumeChart data={volumeData} timeLabel={timeLabel} />

        {/* Two Charts Side by Side - show side-by-side on desktop only */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StatusDistributionChart data={statusData} />
          <RequestsByTypeChart data={typeData} />
        </div>
      </div>

      <NewRequestSheet 
        open={sheetOpen} 
        onOpenChange={setSheetOpen} 
      />
    </AppLayout>
  );
}
