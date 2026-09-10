import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate, Json } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { z } from 'zod';

export type RequestType = Tables<'request_types'>;
export type RequestTypeInsert = TablesInsert<'request_types'>;
export type RequestTypeUpdate = TablesUpdate<'request_types'>;

export interface FormFieldSchema {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'date';
  required: boolean;
  options?: string[];
  placeholder?: string;
}

const formFieldSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .regex(/^[a-z][a-z0-9_]*$/u, 'Field name must use snake_case and start with a letter'),
    label: z.string().trim().min(1).max(100),
    type: z.enum(['text', 'textarea', 'select', 'date']),
    required: z.boolean(),
    options: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
    placeholder: z.string().trim().max(200).optional(),
  })
  .superRefine((field, ctx) => {
    if (field.type === 'select' && (!field.options || field.options.length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select fields require at least 2 options',
        path: ['options'],
      });
    }
  });

const createRequestTypeSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().max(50).optional(),
  requires_dates: z.boolean(),
  form_schema: z.array(formFieldSchema).max(50),
});

const updateRequestTypeSchema = z.object({
  id: z.string().uuid(),
  updates: z.object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    category: z.string().trim().max(50).nullable().optional(),
    requires_dates: z.boolean().optional(),
    form_schema: z.array(formFieldSchema).max(50).optional(),
    is_active: z.boolean().optional(),
  }),
});

// Fetch ALL request types (including inactive) - admin only
export function useAllRequestTypes() {
  return useQuery({
    queryKey: ['request-types', 'admin', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('request_types')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as RequestType[];
    },
  });
}

// Create a new request type
export function useCreateRequestType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newType: {
      name: string;
      description?: string;
      category?: string;
      requires_dates: boolean;
      form_schema: FormFieldSchema[];
    }) => {
      const validated = createRequestTypeSchema.parse(newType);

      const { data, error } = await supabase
        .from('request_types')
        .insert({
          name: validated.name,
          description: validated.description || null,
          category: validated.category || null,
          requires_dates: validated.requires_dates,
          form_schema: validated.form_schema as unknown as Json,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request-types'] });
      toast.success('Request type created', {
        description: 'The new request type is now available.',
      });
    },
    onError: (error) => {
      toast.error('Failed to create request type', {
        description: error.message,
      });
    },
  });
}

// Update an existing request type
export function useUpdateRequestType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: {
        name?: string;
        description?: string | null;
        category?: string | null;
        requires_dates?: boolean;
        form_schema?: FormFieldSchema[];
        is_active?: boolean;
      };
    }) => {
      const validated = updateRequestTypeSchema.parse({ id, updates });

      const updateData: TablesUpdate<'request_types'> = {
        ...validated.updates,
        form_schema: validated.updates.form_schema as unknown as Json,
      };

      const { data, error } = await supabase
        .from('request_types')
        .update(updateData)
        .eq('id', validated.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request-types'] });
      toast.success('Request type updated', {
        description: 'Your changes have been saved.',
      });
    },
    onError: (error) => {
      toast.error('Failed to update request type', {
        description: error.message,
      });
    },
  });
}

// Toggle is_active status
export function useToggleRequestTypeActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const validatedId = z.string().uuid().parse(id);
      const { data, error } = await supabase
        .from('request_types')
        .update({ is_active })
        .eq('id', validatedId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['request-types'] });
      toast.success(
        data.is_active ? 'Request type activated' : 'Request type deactivated',
        {
          description: data.is_active
            ? 'This request type is now available for use.'
            : 'This request type is no longer available.',
        }
      );
    },
    onError: (error) => {
      toast.error('Failed to update status', {
        description: error.message,
      });
    },
  });
}

// Delete a request type (hard delete - use with caution)
export function useDeleteRequestType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const validatedId = z.string().uuid().parse(id);
      const { error } = await supabase
        .from('request_types')
        .delete()
        .eq('id', validatedId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request-types'] });
      toast.success('Request type deleted', {
        description: 'The request type has been permanently removed.',
      });
    },
    onError: (error) => {
      toast.error('Failed to delete request type', {
        description: error.message,
      });
    },
  });
}
