import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Tables, Enums } from '@/integrations/supabase/types';
import { z } from 'zod';

export type PendingRequest = Tables<'requests'> & {
  request_type: Pick<Tables<'request_types'>, 'id' | 'name' | 'category'> | null;
  submitter: Pick<Tables<'profiles'>, 'id' | 'first_name' | 'last_name' | 'email'> | null;
};

export type ApprovalAction = Enums<'approval_action'>;

interface ProcessApprovalInput {
  requestId: string;
  action: ApprovalAction;
  comment?: string;
}

const approvalActionSchema = z.enum(['approved', 'rejected', 'change_requested']);
const uuidSchema = z.string().uuid('Invalid identifier');
const commentSchema = z.string().trim().max(2000, 'Comment is too long');

const processApprovalSchema = z
  .object({
    requestId: uuidSchema,
    action: approvalActionSchema,
    comment: commentSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if ((data.action === 'rejected' || data.action === 'change_requested') && !data.comment?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Comment is required for this action',
        path: ['comment'],
      });
    }
  });

export function usePendingApprovals() {
  const { profile, role } = useAuth();

  return useQuery({
    queryKey: ['pending-approvals', profile?.id, role],
    queryFn: async () => {
      if (!profile?.id) return [];

      // For managers: get requests from their direct reports that are in_review or submitted
      // For admins: get all requests that are in_review or submitted
      const { data, error } = await supabase
        .from('requests')
        .select(`
          *,
          request_type:request_types(id, name, category),
          submitter:profiles!requests_submitter_id_fkey(id, first_name, last_name, email)
        `)
        .in('status', ['submitted', 'in_review'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PendingRequest[];
    },
    enabled: !!profile?.id && (role === 'manager' || role === 'admin'),
  });
}

export function useProcessApproval() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ requestId, action, comment }: ProcessApprovalInput) => {
      if (!profile?.id) throw new Error('Not authenticated');
      const validated = processApprovalSchema.parse({ requestId, action, comment });

      // 1. Get the current request to determine the step
      const { data: request, error: requestError } = await supabase
        .from('requests')
        .select('current_step, status')
        .eq('id', validated.requestId)
        .single();

      if (requestError) throw requestError;

      // 2. Insert the approval record
      const { data: approvalRow, error: approvalError } = await supabase
        .from('request_approvals')
        .insert({
          request_id: validated.requestId,
          approver_id: profile.id,
          action: validated.action,
          step_order: request.current_step,
          comment: validated.comment?.trim() || null,
        })
        .select('id')
        .single();

      if (approvalError) throw approvalError;

      // 3. Update the request status based on action
      let newStatus: Enums<'request_status'>;
      if (validated.action === 'approved') {
        newStatus = 'approved';
      } else if (validated.action === 'rejected') {
        newStatus = 'rejected';
      } else {
        newStatus = 'change_requested';
      }

      const { error: updateError } = await supabase
        .from('requests')
        .update({ status: newStatus })
        .eq('id', validated.requestId);

      if (updateError) {
        // Roll back the approval row so retries don't hit a unique-key conflict
        if (approvalRow?.id) {
          await supabase.from('request_approvals').delete().eq('id', approvalRow.id);
        }
        throw updateError;
      }

      return { requestId: validated.requestId, action: validated.action };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });
}
