import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ActivityTimeline } from './ActivityTimeline';
import { Separator } from '@/components/ui/separator';
import { Calendar, User, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useRequestActivity } from '@/hooks/useRequestActivity';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  SheetHeader,
  SheetTitle,
  SheetDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/responsive-sheet';
import type { Request, RequestWithSubmitter } from '@/hooks/useRequests';

type RequestStatus = 'draft' | 'submitted' | 'pending' | 'in_review' | 'approved' | 'rejected' | 'change_requested';

interface RequestDetailSheetProps {
  request: Request | RequestWithSubmitter | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function hasSubmitter(request: Request | RequestWithSubmitter): request is RequestWithSubmitter {
  return 'submitter' in request && request.submitter !== undefined;
}

export function RequestDetailSheet({ request, open, onOpenChange }: RequestDetailSheetProps) {
  const { data: activities = [], isLoading: activitiesLoading } = useRequestActivity(request?.id);
  const isMobile = useIsMobile();

  if (!request) return null;

  const typeName = request.request_type?.name || 'Unknown Type';
  const formattedDate = format(new Date(request.created_at), 'MMMM d, yyyy');
  
  const submitterName = hasSubmitter(request) && request.submitter
    ? (request.submitter.first_name || request.submitter.last_name
        ? `${request.submitter.first_name || ''} ${request.submitter.last_name || ''}`.trim()
        : request.submitter.email)
    : null;
  
  const dateRange = request.start_date && request.end_date
    ? `${format(new Date(request.start_date), 'MMM d, yyyy')} - ${format(new Date(request.end_date), 'MMM d, yyyy')}`
    : request.start_date
    ? `Starting ${format(new Date(request.start_date), 'MMM d, yyyy')}`
    : null;

  // Find the most recent change_requested activity for feedback display
  const changeRequestFeedback = request.status === 'change_requested'
    ? activities.find(a => a.action === 'change_requested')?.details?.comment
    : null;

  const headerContent = isMobile ? (
    <DrawerHeader className="text-left px-4 pt-4 pb-2">
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className="text-xs font-medium">
          {typeName}
        </Badge>
        <StatusBadge status={request.status as RequestStatus} />
      </div>
      <DrawerTitle className="text-lg">Request Details</DrawerTitle>
      <DrawerDescription className="flex flex-col gap-1 text-sm">
        {submitterName && (
          <span className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Submitted by {submitterName}
          </span>
        )}
        <span className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          {submitterName ? `on ${formattedDate}` : `Submitted on ${formattedDate}`}
        </span>
      </DrawerDescription>
    </DrawerHeader>
  ) : (
    <SheetHeader className="space-y-3 pb-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className="text-xs font-medium">
          {typeName}
        </Badge>
        <StatusBadge status={request.status as RequestStatus} />
      </div>
      <SheetTitle className="text-lg text-foreground">
        Request Details
      </SheetTitle>
      <SheetDescription className="flex flex-col gap-1 text-sm">
        {submitterName && (
          <span className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Submitted by {submitterName}
          </span>
        )}
        <span className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          {submitterName ? `on ${formattedDate}` : `Submitted on ${formattedDate}`}
        </span>
      </SheetDescription>
    </SheetHeader>
  );

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-[520px]"
      header={headerContent}
    >
      {/* Change Request Alert */}
      {request.status === 'change_requested' && (
        <div className="mb-6 p-4 rounded-md bg-[hsl(var(--status-change-requested))]/10 border border-[hsl(var(--status-change-requested))]/30">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-[hsl(var(--status-change-requested))] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Changes Requested</p>
              {changeRequestFeedback ? (
                <p className="text-sm text-muted-foreground">"{changeRequestFeedback}"</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  An approver has requested changes to this request. Please review and resubmit.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Description */}
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">Description</h3>
          <p className="text-sm text-muted-foreground">
            {request.description || 'No description provided'}
          </p>
        </div>

        {/* Date Range */}
        {dateRange && (
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">Date Range</h3>
            <p className="text-sm text-muted-foreground">{dateRange}</p>
          </div>
        )}

        {/* Form Data */}
        {request.form_data && Object.keys(request.form_data).length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">Additional Details</h3>
            <div className="space-y-2">
              {Object.entries(request.form_data as Record<string, unknown>).map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-muted-foreground capitalize">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="text-foreground font-medium">
                    {String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator className="bg-border" />

        {/* Activity Timeline */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-4">Activity</h3>
          <ActivityTimeline activities={activities} isLoading={activitiesLoading} />
        </div>
      </div>
    </ResponsiveSheet>
  );
}
