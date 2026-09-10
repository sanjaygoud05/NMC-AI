import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json, Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { z } from 'zod';

export type Request = Tables<'requests'> & {
  request_type: Pick<Tables<'request_types'>, 'id' | 'name' | 'category'> | null;
};

export type CreateRequestInput = Omit<TablesInsert<'requests'>, 'id' | 'created_at' | 'updated_at'>;

const isJsonValue = (value: unknown): value is Json => {
  if (value === null) return true;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every(
      (entry) => entry === undefined || isJsonValue(entry),
    );
  }
  return false;
};

const jsonSchema = z.custom<Json>(isJsonValue, {
  message: 'Invalid JSON payload',
});

const requestStatusSchema = z.enum([
  'draft',
  'submitted',
  'in_review',
  'approved',
  'rejected',
  'change_requested',
]);

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'Date must be YYYY-MM-DD');

const createRequestSchema = z
  .object({
    request_type_id: z.string().uuid(),
    submitter_id: z.string().uuid(),
    status: requestStatusSchema,
    description: z.string().trim().min(1, 'Description is required').max(1000),
    start_date: dateOnlySchema.nullable().optional(),
    end_date: dateOnlySchema.nullable().optional(),
    form_data: jsonSchema.optional(),
    current_step: z.number().int().min(1).max(100),
  })
  .superRefine((data, ctx) => {
    if (data.start_date && data.end_date && data.end_date < data.start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End date must be on or after start date',
        path: ['end_date'],
      });
    }
  });

const updateRequestSchema = z
  .object({
    id: z.string().uuid(),
    status: requestStatusSchema.optional(),
    description: z.string().trim().min(1).max(1000).optional(),
    start_date: dateOnlySchema.nullable().optional(),
    end_date: dateOnlySchema.nullable().optional(),
    form_data: jsonSchema.nullable().optional(),
    current_step: z.number().int().min(1).max(100).optional(),
    request_type_id: z.string().uuid().optional(),
    submitter_id: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.start_date && data.end_date && data.end_date < data.start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End date must be on or after start date',
        path: ['end_date'],
      });
    }
  });

export function useRequests(submitterId?: string) {
  return useQuery({
    queryKey: ['requests', submitterId],
    queryFn: async () => {
      if (!submitterId) return [];

      const { data, error } = await supabase
        .from('requests')
        .select(`
          *,
          request_type:request_types(id, name, category)
        `)
        .eq('submitter_id', submitterId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Request[];
    },
    enabled: !!submitterId,
  });
}

export function useCreateRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateRequestInput) => {
      const validatedInput = createRequestSchema.parse(input) as CreateRequestInput;

      const { data, error } = await supabase
        .from('requests')
        .insert(validatedInput)
        .select(`
          *,
          request_type:request_types(id, name, category)
        `)
        .single();

      if (error) throw error;
      return data as Request;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });
}

export function useUpdateRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CreateRequestInput> & { id: string }) => {
      const validated = updateRequestSchema.parse({ id, ...input });
      const { id: requestId, ...validatedInput } = validated;
      const updateData: TablesUpdate<'requests'> = validatedInput;

      const { data, error } = await supabase
        .from('requests')
        .update(updateData)
        .eq('id', requestId)
        .select(`
          *,
          request_type:request_types(id, name, category)
        `)
        .single();

      if (error) throw error;
      return data as Request;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });
}

export type RequestWithSubmitter = Request & {
  submitter: Pick<Tables<'profiles'>, 'id' | 'first_name' | 'last_name' | 'email'> | null;
};

export function useAllRequests() {
  return useQuery({
    queryKey: ['requests', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('requests')
        .select(`
          *,
          request_type:request_types(id, name, category),
          submitter:profiles!requests_submitter_id_fkey(id, first_name, last_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as RequestWithSubmitter[];
    },
  });
}
