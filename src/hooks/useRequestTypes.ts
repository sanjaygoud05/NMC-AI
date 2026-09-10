import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type RequestType = Tables<'request_types'>;

export function useRequestTypes() {
  return useQuery({
    queryKey: ['request-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('request_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as RequestType[];
    },
  });
}

export function useRequestType(id: string | null) {
  return useQuery({
    queryKey: ['request-type', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('request_types')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as RequestType;
    },
    enabled: !!id,
  });
}
