import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormFieldSchema } from '@/hooks/useRequestTypesAdmin';

interface FormFieldEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field?: FormFieldSchema | null;
  onSave: (field: FormFieldSchema) => void;
  existingFieldNames: string[];
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'select', label: 'Select (Dropdown)' },
  { value: 'date', label: 'Date' },
] as const;

function generateFieldName(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
}

export function FormFieldEditor({
  open,
  onOpenChange,
  field,
  onSave,
  existingFieldNames,
}: FormFieldEditorProps) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState<FormFieldSchema['type']>('text');
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!field;

  useEffect(() => {
    if (field) {
      setLabel(field.label);
      setType(field.type);
      setRequired(field.required);
      setOptions(field.options?.join('\n') || '');
      setPlaceholder(field.placeholder || '');
    } else {
      setLabel('');
      setType('text');
      setRequired(false);
      setOptions('');
      setPlaceholder('');
    }
    setErrors({});
  }, [field, open]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!label.trim()) {
      newErrors.label = 'Field label is required';
    }

    const generatedName = generateFieldName(label);
    if (!isEditing && existingFieldNames.includes(generatedName)) {
      newErrors.label = 'A field with this name already exists';
    }

    if (type === 'select') {
      const optionLines = options.split('\n').filter((o) => o.trim());
      if (optionLines.length < 2) {
        newErrors.options = 'Select fields need at least 2 options';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    const fieldData: FormFieldSchema = {
      name: field?.name || generateFieldName(label),
      label: label.trim(),
      type,
      required,
      placeholder: placeholder.trim() || undefined,
      options:
        type === 'select'
          ? options
              .split('\n')
              .map((o) => o.trim())
              .filter(Boolean)
          : undefined,
    };

    onSave(fieldData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Field' : 'Add Field'}</DialogTitle>
          <DialogDescription>
            Configure the form field settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Field Label */}
          <div className="space-y-2">
            <Label htmlFor="field-label">
              Field Label <span className="text-destructive">*</span>
            </Label>
            <Input
              id="field-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Leave Type"
            />
            {errors.label && (
              <p className="text-sm text-destructive">{errors.label}</p>
            )}
          </div>

          {/* Field Type */}
          <div className="space-y-2">
            <Label htmlFor="field-type">Field Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as FormFieldSchema['type'])}>
              <SelectTrigger id="field-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((ft) => (
                  <SelectItem key={ft.value} value={ft.value}>
                    {ft.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Required Toggle */}
          <div className="flex items-start space-x-3 rounded-md border border-border p-4">
            <Checkbox
              id="field-required"
              checked={required}
              onCheckedChange={(checked) => setRequired(checked === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="field-required" className="cursor-pointer font-medium">
                Required Field
              </Label>
              <p className="text-sm text-muted-foreground">
                Users must fill this field to submit their request
              </p>
            </div>
          </div>

          {/* Options (only for select type) */}
          {type === 'select' && (
            <div className="space-y-2">
              <Label htmlFor="field-options">
                Options <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="field-options"
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                placeholder="Enter one option per line&#10;Vacation&#10;Personal&#10;Sick"
                rows={4}
              />
              {errors.options && (
                <p className="text-sm text-destructive">{errors.options}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Enter one option per line
              </p>
            </div>
          )}

          {/* Placeholder */}
          <div className="space-y-2">
            <Label htmlFor="field-placeholder">Placeholder (optional)</Label>
            <Input
              id="field-placeholder"
              value={placeholder}
              onChange={(e) => setPlaceholder(e.target.value)}
              placeholder="e.g., Select an option..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {isEditing ? 'Save Changes' : 'Add Field'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
