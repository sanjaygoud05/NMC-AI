import { format } from 'date-fns';
import { 
  FileText, 
  Send, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Clock,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ActivityLogEntry } from '@/hooks/useRequestActivity';

interface ActivityTimelineProps {
  activities: ActivityLogEntry[];
  isLoading?: boolean;
}

const actionConfig: Record<string, { 
  icon: typeof FileText; 
  label: string; 
  colorClass: string;
}> = {
  created: {
    icon: FileText,
    label: 'Request created',
    colorClass: 'text-muted-foreground',
  },
  status_changed: {
    icon: Clock,
    label: 'Status changed',
    colorClass: 'text-muted-foreground',
  },
  submitted: {
    icon: Send,
    label: 'Request submitted',
    colorClass: 'text-[hsl(var(--status-submitted))]',
  },
  approved: {
    icon: CheckCircle,
    label: 'Approved',
    colorClass: 'text-[hsl(var(--status-approved))]',
  },
  rejected: {
    icon: XCircle,
    label: 'Rejected',
    colorClass: 'text-[hsl(var(--status-rejected))]',
  },
  change_requested: {
    icon: AlertCircle,
    label: 'Changes requested',
    colorClass: 'text-[hsl(var(--status-change-requested))]',
  },
};

function getActorName(actor: ActivityLogEntry['actor']): string {
  if (!actor) return 'System';
  if (actor.first_name || actor.last_name) {
    return [actor.first_name, actor.last_name].filter(Boolean).join(' ');
  }
  return actor.email;
}

function getActionLabel(action: string, details: ActivityLogEntry['details']): string {
  if (action === 'status_changed' && details) {
    const fromLabel = details.from?.replace('_', ' ') || 'unknown';
    const toLabel = details.to?.replace('_', ' ') || 'unknown';
    return `Status changed from ${fromLabel} to ${toLabel}`;
  }
  return actionConfig[action]?.label || action.replace('_', ' ');
}

export function ActivityTimeline({ activities, isLoading }: ActivityTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-muted rounded" />
              <div className="h-3 w-24 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No activity recorded yet
      </p>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
      
      <div className="space-y-6">
        {activities.map((activity, index) => {
          const config = actionConfig[activity.action] || {
            icon: Clock,
            label: activity.action,
            colorClass: 'text-muted-foreground',
          };
          const Icon = config.icon;
          const isLast = index === activities.length - 1;

          return (
            <div key={activity.id} className="relative flex gap-4">
              {/* Icon circle */}
              <div className={cn(
                'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background border border-border',
                config.colorClass
              )}>
                <Icon className="h-4 w-4" />
              </div>

              {/* Content */}
              <div className={cn('flex-1 pb-2', isLast && 'pb-0')}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">
                    {getActionLabel(activity.action, activity.details)}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span>{getActorName(activity.actor)}</span>
                  <span>•</span>
                  <span>{format(new Date(activity.created_at), 'MMM d, yyyy h:mm a')}</span>
                </div>

                {/* Show comment for change_requested, rejected, or approved with comment */}
                {activity.details?.comment && (
                  <div className="mt-2 p-3 rounded-md bg-muted/50 border border-border">
                    <p className="text-sm text-foreground">
                      "{activity.details.comment}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
