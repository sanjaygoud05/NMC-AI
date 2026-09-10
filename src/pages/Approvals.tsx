import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ApprovalCard } from '@/components/approvals/ApprovalCard';
import { ApprovalDialog } from '@/components/approvals/ApprovalDialog';
import { RequestDetailSheet } from '@/components/requests/RequestDetailSheet';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckSquare } from 'lucide-react';
import { usePendingApprovals, useProcessApproval, type PendingRequest, type ApprovalAction } from '@/hooks/usePendingApprovals';
import { toast } from 'sonner';

export default function Approvals() {
  const { data: pendingRequests, isLoading, error } = usePendingApprovals();
  const processApproval = useProcessApproval();
  
  const [selectedRequest, setSelectedRequest] = useState<PendingRequest | null>(null);
  const [dialogAction, setDialogAction] = useState<ApprovalAction | null>(null);
  const [detailRequest, setDetailRequest] = useState<PendingRequest | null>(null);

  const handleAction = (request: PendingRequest, action: ApprovalAction) => {
    setSelectedRequest(request);
    setDialogAction(action);
  };

  const handleConfirmAction = async (comment: string) => {
    if (!selectedRequest || !dialogAction) return;

    try {
      await processApproval.mutateAsync({
        requestId: selectedRequest.id,
        action: dialogAction,
        comment,
      });

      const title = dialogAction === 'approved' 
        ? 'Request Approved' 
        : dialogAction === 'rejected'
        ? 'Request Rejected'
        : 'Changes Requested';
      const description = `The request has been ${dialogAction === 'approved' ? 'approved' : dialogAction === 'rejected' ? 'rejected' : 'sent back for changes'}.`;
      
      toast.success(title, { description });

      setDialogAction(null);
      setSelectedRequest(null);
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to process the request',
      });
    }
  };

  return (
    <AppLayout requireRole={['admin', 'manager']}>
      <div className="space-y-8">
        <PageHeader
          title="Pending Approvals"
          description="Review and process approval requests"
        />

        <Card className="animate-fade-up opacity-0 [animation-fill-mode:forwards] border-border bg-card" style={{ animationDelay: '100ms' }}>
          <CardHeader>
            <CardTitle className="text-foreground">Awaiting Your Review</CardTitle>
            <CardDescription>
              Requests that need your approval or rejection
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-8 text-destructive">
                Failed to load pending approvals. Please try again.
              </div>
            ) : !pendingRequests || pendingRequests.length === 0 ? (
              <EmptyState
                icon={CheckSquare}
                title="No pending approvals"
                description="All requests have been processed"
              />
            ) : (
              <div className="space-y-4">
                {pendingRequests.map((request) => (
                  <ApprovalCard
                    key={request.id}
                    request={request}
                    onApprove={() => handleAction(request, 'approved')}
                    onReject={() => handleAction(request, 'rejected')}
                    onRequestChanges={() => handleAction(request, 'change_requested')}
                    onViewDetails={() => setDetailRequest(request)}
                    isProcessing={processApproval.isPending && selectedRequest?.id === request.id}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ApprovalDialog
        open={!!dialogAction}
        onOpenChange={(open) => {
          if (!open) {
            setDialogAction(null);
            setSelectedRequest(null);
          }
        }}
        action={dialogAction}
        onConfirm={handleConfirmAction}
        isProcessing={processApproval.isPending}
      />

      {detailRequest && (
        <RequestDetailSheet
          request={detailRequest}
          open={!!detailRequest}
          onOpenChange={(open) => {
            if (!open) setDetailRequest(null);
          }}
        />
      )}
    </AppLayout>
  );
}
