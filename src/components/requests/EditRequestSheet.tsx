import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { RequestForm } from './RequestForm';
import { useRequestType } from '@/hooks/useRequestTypes';
import { useUpdateRequest, Request } from '@/hooks/useRequests';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  SheetHeader,
  SheetTitle,
  SheetDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/responsive-sheet';
import { toast } from 'sonner';

interface EditRequestSheetProps {
  request: Request | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditRequestSheet({ request, open, onOpenChange, onSuccess }: EditRequestSheetProps) {
  const { data: requestType, isLoading: isLoadingType } = useRequestType(request?.request_type_id ?? null);
  const updateRequest = useUpdateRequest();
  const isMobile = useIsMobile();

  const handleSubmit = async (
    data: { description: string; startDate?: string; endDate?: string; formData?: Record<string, any> },
    isDraft: boolean
  ) => {
    if (!request) return;

    try {
      await updateRequest.mutateAsync({
        id: request.id,
        description: data.description,
        start_date: data.startDate || null,
        end_date: data.endDate || null,
        form_data: data.formData || null,
        status: isDraft ? 'draft' : 'submitted',
      });

      const isResubmit = request.status === 'change_requested';
      
      if (isDraft) {
        toast.success('Request updated', {
          description: 'Your draft has been saved.',
        });
      } else {
        toast.success(isResubmit ? 'Request resubmitted' : 'Request submitted', {
          description: isResubmit 
            ? 'Your request has been resubmitted for approval.'
            : 'Your request has been submitted for approval.',
        });
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error('Failed to update request', {
        description: 'Please try again.',
      });
    }
  };

  const initialValues = request ? {
    description: request.description || '',
    startDate: request.start_date || undefined,
    endDate: request.end_date || undefined,
    formData: (request.form_data as Record<string, any>) || {},
  } : undefined;

  const isChangeRequested = request?.status === 'change_requested';

  const headerContent = isMobile ? (
    <DrawerHeader className="text-left px-4 pt-4 pb-2">
      <div className="flex items-center justify-between">
        <DrawerTitle className="text-foreground">Edit Request</DrawerTitle>
        {request && (
          <StatusBadge status={request.status} />
        )}
      </div>
      <DrawerDescription>
        {isChangeRequested 
          ? 'Make the requested changes and resubmit for approval.'
          : 'Update your draft request or submit it for approval.'
        }
      </DrawerDescription>
    </DrawerHeader>
  ) : (
    <SheetHeader className="space-y-3">
      <div className="flex items-center justify-between">
        <SheetTitle className="text-foreground">Edit Request</SheetTitle>
        {request && (
          <StatusBadge status={request.status} />
        )}
      </div>
      <SheetDescription>
        {isChangeRequested 
          ? 'Make the requested changes and resubmit for approval.'
          : 'Update your draft request or submit it for approval.'
        }
      </SheetDescription>
    </SheetHeader>
  );

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-lg"
      header={headerContent}
    >
      <div className={isMobile ? '' : 'mt-6'}>
        {isLoadingType ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : requestType ? (
          <RequestForm
            requestType={requestType}
            onSubmit={handleSubmit}
            isSubmitting={updateRequest.isPending}
            initialValues={initialValues}
            mode="edit"
            isChangeRequested={isChangeRequested}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Unable to load request type information.
          </p>
        )}
      </div>
    </ResponsiveSheet>
  );
}
