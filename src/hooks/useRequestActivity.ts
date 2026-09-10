import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ActivityLogEntry {
  id: string;
  request_id: string;
  actor_id: string | null;
  action: string;
  details: {
    from?: string;
    to?: string;
    status?: string;
    step?: number;
    comment?: string;
  } | null;
  created_at: string;
  actor: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

export function useRequestActivity(requestId: string | undefined) {
  return useQuery({
    queryKey: ['request-activity', requestId],
    queryFn: async () => {
      if (!requestId) return [];

      const { data, error } = await supabase
        .from('request_activity_log')
        .select(`
          *,
          actor:profiles!request_activity_log_actor_id_fkey(
            first_name,
            last_name,
            email
          )
        `)
        .eq('request_id', requestId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as ActivityLogEntry[];
    },
    enabled: !!requestId,
  });
}
