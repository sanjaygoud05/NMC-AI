import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type RequestStatus = 'draft' | 'submitted' | 'pending' | 'in_review' | 'approved' | 'rejected' | 'change_requested';

interface StatusBadgeProps {
  status: RequestStatus;
  className?: string;
}

const statusConfig: Record<RequestStatus, { label: string; variant: string }> = {
  draft: {
    label: 'Draft',
    variant: 'bg-[hsl(var(--status-draft))]/20 text-[hsl(var(--status-draft))]',
  },
  submitted: {
    label: 'Submitted',
    variant: 'bg-[hsl(var(--status-pending))]/20 text-[hsl(var(--status-pending))]',
  },
  pending: {
    label: 'Pending',
    variant: 'bg-[hsl(var(--status-pending))]/20 text-[hsl(var(--status-pending))]',
  },
  in_review: {
    label: 'In Review',
    variant: 'bg-[hsl(var(--status-in-review))]/20 text-[hsl(var(--status-in-review))]',
  },
  approved: {
    label: 'Approved',
    variant: 'bg-[hsl(var(--status-approved))]/20 text-[hsl(var(--status-approved))]',
  },
  rejected: {
    label: 'Rejected',
    variant: 'bg-[hsl(var(--status-rejected))]/20 text-[hsl(var(--status-rejected))]',
  },
  change_requested: {
    label: 'Changes Requested',
    variant: 'bg-[hsl(var(--status-change-requested))]/20 text-[hsl(var(--status-change-requested))]',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <Badge 
      variant="secondary" 
      className={cn(
        'font-medium border-0',
        config.variant,
        className
      )}
    >
      {config.label}
    </Badge>
  );
}
