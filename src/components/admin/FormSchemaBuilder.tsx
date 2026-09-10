import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { FormFieldEditor } from './FormFieldEditor';
import { FormFieldSchema } from '@/hooks/useRequestTypesAdmin';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface FormSchemaBuilderProps {
  fields: FormFieldSchema[];
  onChange: (fields: FormFieldSchema[]) => void;
}

const TYPE_LABELS: Record<FormFieldSchema['type'], string> = {
  text: 'Text',
  textarea: 'Textarea',
  select: 'Select',
  date: 'Date',
};

export function FormSchemaBuilder({ fields, onChange }: FormSchemaBuilderProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingField, setEditingField] = useState<FormFieldSchema | null>(null);
  const [deleteConfirmField, setDeleteConfirmField] = useState<FormFieldSchema | null>(null);

  const handleAddField = () => {
    setEditingField(null);
    setEditorOpen(true);
  };

  const handleEditField = (field: FormFieldSchema) => {
    setEditingField(field);
    setEditorOpen(true);
  };

  const handleSaveField = (savedField: FormFieldSchema) => {
    if (editingField) {
      // Update existing field
      onChange(
        fields.map((f) => (f.name === editingField.name ? savedField : f))
      );
    } else {
      // Add new field
      onChange([...fields, savedField]);
    }
  };

  const handleDeleteField = (field: FormFieldSchema) => {
    setDeleteConfirmField(field);
  };

  const confirmDelete = () => {
    if (deleteConfirmField) {
      onChange(fields.filter((f) => f.name !== deleteConfirmField.name));
      setDeleteConfirmField(null);
    }
  };

  const handleToggleRequired = (field: FormFieldSchema) => {
    onChange(
      fields.map((f) =>
        f.name === field.name ? { ...f, required: !f.required } : f
      )
    );
  };

  const existingFieldNames = fields
    .filter((f) => f.name !== editingField?.name)
    .map((f) => f.name);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">Custom Form Fields</h4>
        <Button variant="outline" size="sm" onClick={handleAddField}>
          <Plus className="mr-2 h-4 w-4" />
          Add Field
        </Button>
      </div>

      {fields.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No custom fields added. Click "Add Field" to create form inputs.
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Required</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field) => (
                <TableRow key={field.name}>
                  <TableCell className="font-medium">{field.label}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{TYPE_LABELS[field.type]}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={field.required}
                      onCheckedChange={() => handleToggleRequired(field)}
                      aria-label={`Mark ${field.label} as required`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditField(field)}
                        aria-label={`Edit ${field.label}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteField(field)}
                        aria-label={`Delete ${field.label}`}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <FormFieldEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        field={editingField}
        onSave={handleSaveField}
        existingFieldNames={existingFieldNames}
      />

      <AlertDialog
        open={!!deleteConfirmField}
        onOpenChange={() => setDeleteConfirmField(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Field</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the "{deleteConfirmField?.label}" field?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
