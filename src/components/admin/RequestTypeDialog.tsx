import { useState, useEffect } from 'react';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { FormSchemaBuilder } from './FormSchemaBuilder';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  SheetHeader,
  SheetTitle,
  SheetDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/responsive-sheet';
import {
  RequestType,
  FormFieldSchema,
  useCreateRequestType,
  useUpdateRequestType,
} from '@/hooks/useRequestTypesAdmin';
import { Json } from '@/integrations/supabase/types';

interface RequestTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestType?: RequestType | null;
}

function parseFormSchema(schema: Json | null): FormFieldSchema[] {
  if (!schema || !Array.isArray(schema)) return [];
  return schema as unknown as FormFieldSchema[];
}

export function RequestTypeDialog({
  open,
  onOpenChange,
  requestType,
}: RequestTypeDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [requiresDates, setRequiresDates] = useState(false);
  const [formSchema, setFormSchema] = useState<FormFieldSchema[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isMobile = useIsMobile();

  const createMutation = useCreateRequestType();
  const updateMutation = useUpdateRequestType();

  const isEditing = !!requestType;
  const isLoading = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (requestType) {
      setName(requestType.name);
      setDescription(requestType.description || '');
      setCategory(requestType.category || '');
      setRequiresDates(requestType.requires_dates);
      setFormSchema(parseFormSchema(requestType.form_schema));
    } else {
      setName('');
      setDescription('');
      setCategory('');
      setRequiresDates(false);
      setFormSchema([]);
    }
    setErrors({});
  }, [requestType, open]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      if (isEditing && requestType) {
        await updateMutation.mutateAsync({
          id: requestType.id,
          updates: {
            name: name.trim(),
            description: description.trim() || null,
            category: category.trim() || null,
            requires_dates: requiresDates,
            form_schema: formSchema,
          },
        });
      } else {
        await createMutation.mutateAsync({
          name: name.trim(),
          description: description.trim() || undefined,
          category: category.trim() || undefined,
          requires_dates: requiresDates,
          form_schema: formSchema,
        });
      }
      onOpenChange(false);
    } catch {
      // Error is handled by the mutation
    }
  };

  const headerContent = isMobile ? (
    <DrawerHeader className="text-left px-4 pt-4 pb-2">
      <DrawerTitle>
        {isEditing ? 'Edit Request Type' : 'Create Request Type'}
      </DrawerTitle>
      <DrawerDescription>
        {isEditing
          ? 'Update the request type settings and form fields'
          : 'Configure a new request type for your organization'}
      </DrawerDescription>
    </DrawerHeader>
  ) : (
    <SheetHeader>
      <SheetTitle>
        {isEditing ? 'Edit Request Type' : 'Create Request Type'}
      </SheetTitle>
      <SheetDescription>
        {isEditing
          ? 'Update the request type settings and form fields'
          : 'Configure a new request type for your organization'}
      </SheetDescription>
    </SheetHeader>
  );

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      className="w-full sm:max-w-xl"
      header={headerContent}
    >
      <div className={isMobile ? 'space-y-6' : 'mt-6 space-y-6'}>
        {/* Basic Information Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Basic Information</h3>

          <div className="space-y-2">
            <Label htmlFor="type-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="type-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Paid Time Off"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="type-description">Description</Label>
            <Textarea
              id="type-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe when employees should use this request type"
              rows={3}
              maxLength={500}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="type-category">Category</Label>
            <Input
              id="type-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., HR, IT, Admin"
              maxLength={50}
            />
            {errors.category && (
              <p className="text-sm text-destructive">{errors.category}</p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="requires-dates" className="text-base">
                Requires Date Range
              </Label>
              <p className="text-sm text-muted-foreground">
                Show start and end date fields in the request form
              </p>
            </div>
            <Switch
              id="requires-dates"
              checked={requiresDates}
              onCheckedChange={setRequiresDates}
            />
          </div>
        </div>

        <Separator />

        {/* Form Fields Section */}
        <FormSchemaBuilder fields={formSchema} onChange={setFormSchema} />

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading
              ? 'Saving...'
              : isEditing
              ? 'Save Changes'
              : 'Create Request Type'}
          </Button>
        </div>
      </div>
    </ResponsiveSheet>
  );
}
