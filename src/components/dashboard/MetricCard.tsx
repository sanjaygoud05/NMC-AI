import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: {
    value: string;
    trend: 'up' | 'down' | 'neutral';
  };
  icon?: LucideIcon;
  className?: string;
  animationDelay?: string;
}

export function MetricCard({
  label,
  value,
  change,
  icon: Icon,
  className,
  animationDelay = '0ms',
}: MetricCardProps) {
  return (
    <div
      className={cn(
        'p-6 transition-all duration-200',
        'bg-card border border-border',
        'hover:border-[hsl(0_1%_28%)]',
        'animate-fade-up opacity-0 [animation-fill-mode:forwards]',
        className
      )}
      style={{ animationDelay }}
    >
      <div className="flex items-start justify-between mb-4">
        <span className="metric-label">{label}</span>
        {Icon && (
          <Icon className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      
      <div className="space-y-1">
        <div className="metric-value">{value}</div>
        
        {change && (
          <div
            className={cn(
              'metric-change',
              change.trend === 'up' && 'metric-change-positive',
              change.trend === 'down' && 'metric-change-negative',
              change.trend === 'neutral' && 'text-muted-foreground'
            )}
          >
            {change.trend === 'up' && (
              <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                <path d="M6 2L10 6H7V10H5V6H2L6 2Z" fill="currentColor" />
              </svg>
            )}
            {change.trend === 'down' && (
              <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                <path d="M6 10L2 6H5V2H7V6H10L6 10Z" fill="currentColor" />
              </svg>
            )}
            <span>{change.value}</span>
          </div>
        )}
      </div>
    </div>
  );
}
