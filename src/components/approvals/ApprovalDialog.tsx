import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import type { ApprovalAction } from '@/hooks/usePendingApprovals';

interface ApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: ApprovalAction | null;
  onConfirm: (comment: string) => void;
  isProcessing: boolean;
}

const actionConfig: Record<ApprovalAction, { title: string; description: string; confirmLabel: string; variant: 'default' | 'destructive' }> = {
  approved: {
    title: 'Approve Request',
    description: 'Are you sure you want to approve this request? You can add an optional comment.',
    confirmLabel: 'Approve',
    variant: 'default',
  },
  rejected: {
    title: 'Reject Request',
    description: 'Are you sure you want to reject this request? Please provide a reason for rejection.',
    confirmLabel: 'Reject',
    variant: 'destructive',
  },
  change_requested: {
    title: 'Request Changes',
    description: 'Please describe what changes need to be made to this request.',
    confirmLabel: 'Request Changes',
    variant: 'default',
  },
};

export function ApprovalDialog({
  open,
  onOpenChange,
  action,
  onConfirm,
  isProcessing,
}: ApprovalDialogProps) {
  const [comment, setComment] = useState('');

  if (!action) return null;

  const config = actionConfig[action];
  const requiresComment = action === 'rejected' || action === 'change_requested';

  const handleConfirm = () => {
    onConfirm(comment);
    setComment('');
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setComment('');
    }
    onOpenChange(open);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{config.title}</AlertDialogTitle>
          <AlertDialogDescription>{config.description}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4">
          <Label htmlFor="comment" className="text-sm font-medium">
            {requiresComment ? 'Comment (required)' : 'Comment (optional)'}
          </Label>
          <Textarea
            id="comment"
            placeholder={
              action === 'rejected'
                ? 'Please explain why this request is being rejected...'
                : action === 'change_requested'
                ? 'Describe the changes needed...'
                : 'Add any additional notes...'
            }
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="mt-2"
            rows={3}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isProcessing || (requiresComment && !comment.trim())}
            className={config.variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
          >
            {isProcessing ? 'Processing...' : config.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
