import { Control, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export interface FormFieldSchema {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'date';
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

interface DynamicFormFieldProps {
  field: FormFieldSchema;
  control: Control<any>;
  error?: string;
}

export function DynamicFormField({ field, control, error }: DynamicFormFieldProps) {
  const fieldId = `dynamic-${field.name}`;

  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId} className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>

      <Controller
        name={`formData.${field.name}`}
        control={control}
        rules={{ required: field.required ? `${field.label} is required` : false }}
        render={({ field: formField }) => {
          switch (field.type) {
            case 'text':
              return (
                <Input
                  id={fieldId}
                  placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                  {...formField}
                  value={formField.value || ''}
                />
              );

            case 'textarea':
              return (
                <Textarea
                  id={fieldId}
                  placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                  className="min-h-[80px] resize-none"
                  {...formField}
                  value={formField.value || ''}
                />
              );

            case 'select':
              return (
                <Select
                  value={formField.value || ''}
                  onValueChange={formField.onChange}
                >
                  <SelectTrigger id={fieldId}>
                    <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );

            case 'date':
              return (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id={fieldId}
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !formField.value && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formField.value ? (
                        format(new Date(formField.value), 'PPP')
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formField.value ? new Date(formField.value) : undefined}
                      onSelect={(date) => formField.onChange(date?.toISOString())}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              );

            default:
              return (
                <Input
                  id={fieldId}
                  placeholder={field.placeholder}
                  {...formField}
                  value={formField.value || ''}
                />
              );
          }
        }}
      />

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
