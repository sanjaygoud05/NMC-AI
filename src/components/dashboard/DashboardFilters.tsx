import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDemoScenario } from '@/hooks/useDemoScenario';
import { getUniqueRequestTypesForScenario, getUniqueStatuses } from '@/lib/mockData';
import { cn } from '@/lib/utils';

interface DashboardFiltersProps {
  selectedType: string;
  selectedStatus: string;
  onTypeChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  className?: string;
}

// Status label mapping
const statusLabels: Record<string, string> = {
  pending: 'Pending',
  in_review: 'In Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function DashboardFilters({
  selectedType,
  selectedStatus,
  onTypeChange,
  onStatusChange,
  className,
}: DashboardFiltersProps) {
  const { scenario } = useDemoScenario();
  const requestTypes = getUniqueRequestTypesForScenario(scenario);
  const statuses = getUniqueStatuses();

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Type Filter */}
      <Select value={selectedType} onValueChange={onTypeChange}>
        <SelectTrigger className="h-10 w-full md:w-auto md:min-w-[120px] bg-card border-border text-sm">
          <SelectValue placeholder="All Types" />
        </SelectTrigger>
        <SelectContent className="bg-card border-border z-50">
          <SelectItem value="all">All Types</SelectItem>
          {requestTypes.map((type) => (
            <SelectItem key={type} value={type}>
              {type}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status Filter */}
      <Select value={selectedStatus} onValueChange={onStatusChange}>
        <SelectTrigger className="h-10 w-full md:w-auto md:min-w-[120px] bg-card border-border text-sm">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent className="bg-card border-border z-50">
          <SelectItem value="all">All Statuses</SelectItem>
          {statuses.map((status) => (
            <SelectItem key={status} value={status}>
              {statusLabels[status] || status}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
