import { useState } from 'react';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { Badge } from '@/components/ui/badge';
import { RequestTypeSelector } from './RequestTypeSelector';
import { RequestForm } from './RequestForm';
import { useRequestTypes, RequestType } from '@/hooks/useRequestTypes';
import { useCreateRequest } from '@/hooks/useRequests';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  SheetHeader,
  SheetTitle,
  SheetDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/responsive-sheet';

interface NewRequestSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function NewRequestSheet({ open, onOpenChange, onSuccess }: NewRequestSheetProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<RequestType | null>(null);
  const isMobile = useIsMobile();

  const { profile } = useAuth();
  const { data: requestTypes = [], isLoading: typesLoading } = useRequestTypes();
  const createRequest = useCreateRequest();

  const handleTypeSelect = (type: RequestType) => {
    setSelectedType(type);
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
    setSelectedType(null);
  };

  const handleClose = () => {
    setStep(1);
    setSelectedType(null);
    onOpenChange(false);
  };

  const handleSubmit = async (
    data: { description: string; startDate?: string; endDate?: string; formData?: Record<string, any> },
    isDraft: boolean
  ) => {
    if (!selectedType || !profile?.id) {
      toast.error('Unable to submit request. Please try again.');
      return;
    }

    try {
      await createRequest.mutateAsync({
        request_type_id: selectedType.id,
        submitter_id: profile.id,
        status: isDraft ? 'draft' : 'submitted',
        description: data.description,
        start_date: data.startDate ? data.startDate.split('T')[0] : null,
        end_date: data.endDate ? data.endDate.split('T')[0] : null,
        form_data: data.formData || {},
        current_step: 1,
      });

      toast.success(
        isDraft ? 'Request saved as draft' : 'Request submitted',
        {
          description: isDraft
            ? 'You can continue editing and submit later.'
            : 'Your request has been submitted for approval.',
        }
      );
      
      handleClose();
      onSuccess?.();
    } catch (error) {
      toast.error('Failed to create request', {
        description: 'Please try again or contact support if the issue persists.',
      });
    }
  };

  const headerContent = isMobile ? (
    <DrawerHeader className="text-left px-4 pt-4 pb-2">
      <div className="flex items-center gap-3">
        <DrawerTitle className="text-lg">New Request</DrawerTitle>
        <Badge variant="secondary" className="text-xs">
          Step {step} of 2
        </Badge>
      </div>
      <DrawerDescription>
        {step === 1
          ? 'Select the type of request you want to submit'
          : `Fill out the details for your ${selectedType?.name || 'request'}`}
      </DrawerDescription>
    </DrawerHeader>
  ) : (
    <SheetHeader className="space-y-3 pb-6">
      <div className="flex items-center gap-3">
        <SheetTitle className="text-lg">New Request</SheetTitle>
        <Badge variant="secondary" className="text-xs">
          Step {step} of 2
        </Badge>
      </div>
      <SheetDescription>
        {step === 1
          ? 'Select the type of request you want to submit'
          : `Fill out the details for your ${selectedType?.name || 'request'}`}
      </SheetDescription>
    </SheetHeader>
  );

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={handleClose}
      className="sm:max-w-[480px]"
      header={headerContent}
    >
      {step === 1 ? (
        <RequestTypeSelector
          requestTypes={requestTypes}
          isLoading={typesLoading}
          onSelect={handleTypeSelect}
        />
      ) : selectedType ? (
        <RequestForm
          requestType={selectedType}
          onBack={handleBack}
          onSubmit={handleSubmit}
          isSubmitting={createRequest.isPending}
        />
      ) : null}
    </ResponsiveSheet>
  );
}
