import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Request } from '@/hooks/useRequests';

type RequestStatus = 'draft' | 'submitted' | 'pending' | 'in_review' | 'approved' | 'rejected' | 'change_requested';

interface RequestCardProps {
  request: Request;
  showSubmitter?: boolean;
  submitterName?: string;
  onClick?: () => void;
}

export function RequestCard({ request, showSubmitter = false, submitterName, onClick }: RequestCardProps) {
  const formattedDate = format(new Date(request.created_at), 'MMM d, yyyy');
  
  const dateRange = request.start_date && request.end_date
    ? `${format(new Date(request.start_date), 'MMM d')} - ${format(new Date(request.end_date), 'MMM d')}`
    : null;

  const typeName = request.request_type?.name || 'Unknown Type';
  const needsAttention = request.status === 'change_requested';

  return (
    <Card 
      interactive 
      className={cn(
        "p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between cursor-pointer",
        needsAttention && "border-[hsl(var(--status-change-requested))]/50"
      )}
      onClick={onClick}
    >
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs font-medium">
            {typeName}
          </Badge>
          <StatusBadge status={request.status as RequestStatus} />
          {needsAttention && (
            <span className="flex items-center gap-1 text-xs text-[hsl(var(--status-change-requested))]">
              <AlertCircle className="h-3 w-3" />
              Needs attention
            </span>
          )}
        </div>
        
        <p className="text-sm text-foreground truncate">
          {request.description || 'No description provided'}
        </p>
        
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {showSubmitter && submitterName && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {submitterName}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formattedDate}
          </span>
          {dateRange && (
            <span className="text-muted-foreground/70">
              {dateRange}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
