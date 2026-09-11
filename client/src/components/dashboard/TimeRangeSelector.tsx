import { cn } from '@/lib/utils';
import { useBreakpoint } from '@/hooks/use-mobile';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TimeRangeOption {
  label: string;
  value: string;
}

const defaultOptions: TimeRangeOption[] = [
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
];

interface TimeRangeSelectorProps {
  options?: TimeRangeOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function TimeRangeSelector({
  options = defaultOptions,
  value,
  onChange,
  className,
}: TimeRangeSelectorProps) {
  const { isMobileOrTablet } = useBreakpoint();

  // On mobile/tablet, use a Select dropdown for better touch UX and to prevent text wrapping
  if (isMobileOrTablet) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={cn('h-10 bg-card border-border text-sm', className)}>
          <SelectValue placeholder="Select time range" />
        </SelectTrigger>
        <SelectContent className="bg-card border-border z-50">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // On tablet/desktop, use pill buttons
  return (
    <div className={cn('pill-selector whitespace-nowrap', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'pill-option whitespace-nowrap flex-1 lg:flex-none text-center justify-center',
            value === option.value && 'pill-option-active'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
