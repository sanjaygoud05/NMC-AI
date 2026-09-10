import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, User, Check, X, MessageSquare, Eye } from 'lucide-react';
import { format } from 'date-fns';

import type { PendingRequest } from '@/hooks/usePendingApprovals';

type RequestStatus = 'draft' | 'submitted' | 'pending' | 'in_review' | 'approved' | 'rejected' | 'change_requested';

interface ApprovalCardProps {
  request: PendingRequest;
  onApprove: () => void;
  onReject: () => void;
  onRequestChanges: () => void;
  onViewDetails: () => void;
  isProcessing?: boolean;
}

export function ApprovalCard({
  request,
  onApprove,
  onReject,
  onRequestChanges,
  onViewDetails,
  isProcessing = false,
}: ApprovalCardProps) {
  const formattedDate = format(new Date(request.created_at), 'MMM d, yyyy');
  
  const dateRange = request.start_date && request.end_date
    ? `${format(new Date(request.start_date), 'MMM d')} - ${format(new Date(request.end_date), 'MMM d')}`
    : null;

  const typeName = request.request_type?.name || 'Unknown Type';
  const submitterName = request.submitter
    ? `${request.submitter.first_name || ''} ${request.submitter.last_name || ''}`.trim() || request.submitter.email
    : 'Unknown';

  return (
    <Card className="p-4 space-y-4 border-border bg-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs font-medium">
              {typeName}
            </Badge>
            <StatusBadge status={request.status as RequestStatus} />
          </div>
          
          <p className="text-sm text-foreground">
            {request.description || 'No description provided'}
          </p>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {submitterName}
            </span>
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
      </div>

      {/* Responsive button layout */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border">
        {/* Primary actions row */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={onApprove}
            disabled={isProcessing}
            className="gap-1 flex-1 sm:flex-none"
          >
            <Check className="h-3.5 w-3.5" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onReject}
            disabled={isProcessing}
            className="gap-1 flex-1 sm:flex-none"
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </Button>
        </div>
        {/* Secondary actions row */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onRequestChanges}
            disabled={isProcessing}
            className="gap-1 flex-1 sm:flex-none"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Request Changes</span>
            <span className="xs:hidden">Changes</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onViewDetails}
            className="gap-1 flex-1 sm:flex-none sm:ml-auto"
          >
            <Eye className="h-3.5 w-3.5 sm:hidden" />
            <span>View Details</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}
