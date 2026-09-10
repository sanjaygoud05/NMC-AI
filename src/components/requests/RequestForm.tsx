import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, ArrowLeft, Save, Send, Loader2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { DynamicFormField, FormFieldSchema } from './DynamicFormField';
import type { RequestType } from '@/hooks/useRequestTypes';

const baseSchema = z.object({
  description: z.string().min(1, 'Description is required').max(1000, 'Description must be less than 1000 characters'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  formData: z.record(z.any()).optional(),
});

type FormValues = z.infer<typeof baseSchema>;

interface InitialValues {
  description: string;
  startDate?: string;
  endDate?: string;
  formData?: Record<string, any>;
}

interface RequestFormProps {
  requestType: RequestType;
  onBack?: () => void;
  onSubmit: (data: FormValues, isDraft: boolean) => void;
  isSubmitting: boolean;
  initialValues?: InitialValues;
  mode?: 'create' | 'edit';
  isChangeRequested?: boolean;
}

export function RequestForm({ 
  requestType, 
  onBack, 
  onSubmit, 
  isSubmitting, 
  initialValues,
  mode = 'create',
  isChangeRequested = false,
}: RequestFormProps) {
  const formSchema = (requestType.form_schema as unknown as FormFieldSchema[]) || [];
  // Check if this request type requires dates (column added via migration)
  const requiresDates = (requestType as RequestType & { requires_dates?: boolean }).requires_dates ?? false;

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      description: initialValues?.description || '',
      startDate: initialValues?.startDate,
      endDate: initialValues?.endDate,
      formData: initialValues?.formData || {},
    },
  });

  const startDate = watch('startDate');
  const endDate = watch('endDate');

  const handleFormSubmit = (isDraft: boolean) => {
    handleSubmit((data) => {
      onSubmit(data, isDraft);
    })();
  };

  return (
    <div className="space-y-6">
      {/* Back button - only show in create mode */}
      {mode === 'create' && onBack && (
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Change request type
        </button>
      )}

      {/* Request type info */}
      <div className="pb-4 border-b border-border">
        <h3 className="font-medium text-foreground">{requestType.name}</h3>
        {requestType.description && (
          <p className="text-sm text-muted-foreground mt-1">{requestType.description}</p>
        )}
      </div>

      <form className="space-y-5">
        {/* Description field - always present */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-medium">
            Description
            <span className="text-destructive ml-1">*</span>
          </Label>
          <Textarea
            id="description"
            placeholder="Describe your request..."
            className="min-h-[100px] resize-none"
            disabled={isSubmitting}
            {...register('description')}
          />
          {errors.description && (
            <p className="text-xs text-destructive">{errors.description.message}</p>
          )}
        </div>

        {/* Date range fields - only show when requires_dates is true */}
        {requiresDates && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Start Date
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !startDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(new Date(startDate), 'MMM d, yyyy') : 'Select'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate ? new Date(startDate) : undefined}
                    onSelect={(date) => setValue('startDate', date?.toISOString())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                End Date
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !endDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(new Date(endDate), 'MMM d, yyyy') : 'Select'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate ? new Date(endDate) : undefined}
                    onSelect={(date) => setValue('endDate', date?.toISOString())}
                    disabled={(date) => startDate ? date < new Date(startDate) : false}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        {/* Dynamic fields from form schema */}
        {formSchema.length > 0 && (
          <div className="space-y-5 pt-2">
            {formSchema.map((field) => (
              <DynamicFormField
                key={field.name}
                field={field}
                control={control}
                error={errors.formData?.[field.name]?.message as string | undefined}
              />
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={isSubmitting}
            onClick={() => handleFormSubmit(true)}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {mode === 'edit' ? 'Save Draft' : 'Save as Draft'}
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={isSubmitting}
            onClick={() => handleFormSubmit(false)}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : isChangeRequested ? (
              <RefreshCw className="h-4 w-4 mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {isChangeRequested ? 'Resubmit Request' : 'Submit Request'}
          </Button>
        </div>
      </form>
    </div>
  );
}
