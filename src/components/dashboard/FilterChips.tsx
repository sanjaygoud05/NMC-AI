import { ChevronDown, Filter, Sliders } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterChip {
  label: string;
  value: string;
  icon?: 'filter' | 'sliders' | 'chevron';
}

const defaultFilters: FilterChip[] = [
  { label: 'All types', value: 'all', icon: 'chevron' },
  { label: 'Status', value: 'status', icon: 'chevron' },
  { label: 'Filters', value: 'filters', icon: 'sliders' },
];

interface FilterChipsProps {
  filters?: FilterChip[];
  onFilterClick?: (value: string) => void;
  className?: string;
}

export function FilterChips({
  filters = defaultFilters,
  onFilterClick,
  className,
}: FilterChipsProps) {
  const getIcon = (iconType?: string) => {
    switch (iconType) {
      case 'filter':
        return <Filter className="h-3.5 w-3.5" />;
      case 'sliders':
        return <Sliders className="h-3.5 w-3.5" />;
      case 'chevron':
        return <ChevronDown className="h-3.5 w-3.5" />;
      default:
        return null;
    }
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {filters.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onFilterClick?.(filter.value)}
          className="filter-chip"
        >
          {filter.label}
          {getIcon(filter.icon)}
        </button>
      ))}
    </div>
  );
}
