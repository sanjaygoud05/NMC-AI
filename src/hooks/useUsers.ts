import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export interface UserWithRole {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: string;
  role: AppRole;
  manager: {
    id: string;
    name: string;
  } | null;
}

export function useAllUsers() {
  return useQuery({
    queryKey: ['all-users'],
    queryFn: async (): Promise<UserWithRole[]> => {
      // Fetch profiles with their managers
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          email,
          first_name,
          last_name,
          status,
          manager_id
        `)
        .order('created_at', { ascending: true });

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Create a map of user_id to role
      const roleMap = new Map<string, AppRole>();
      roles?.forEach(r => {
        // Keep the highest priority role (admin > manager > employee)
        const existing = roleMap.get(r.user_id);
        if (!existing || getRolePriority(r.role) < getRolePriority(existing)) {
          roleMap.set(r.user_id, r.role);
        }
      });

      // Create a map of profile id to profile for manager lookup
      const profileMap = new Map<string, typeof profiles[0]>();
      profiles?.forEach(p => profileMap.set(p.id, p));

      // Combine the data
      return (profiles || []).map(profile => {
        const manager = profile.manager_id ? profileMap.get(profile.manager_id) : null;
        return {
          id: profile.id,
          user_id: profile.user_id,
          email: profile.email,
          first_name: profile.first_name,
          last_name: profile.last_name,
          status: profile.status,
          role: roleMap.get(profile.user_id) || 'employee',
          manager: manager ? {
            id: manager.id,
            name: [manager.first_name, manager.last_name].filter(Boolean).join(' ') || manager.email
          } : null
        };
      });
    },
  });
}

function getRolePriority(role: AppRole): number {
  switch (role) {
    case 'admin': return 1;
    case 'manager': return 2;
    case 'employee': return 3;
    default: return 4;
  }
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      // First, delete existing roles for this user
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Then, insert the new role
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: newRole });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
    },
  });
}

export function useUpdateUserManager() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profileId, managerId }: { profileId: string; managerId: string | null }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ manager_id: managerId })
        .eq('id', profileId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
    },
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      profileId, 
      firstName, 
      lastName, 
      email,
      status 
    }: { 
      profileId: string; 
      firstName: string; 
      lastName: string; 
      email: string;
      status: string;
    }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          first_name: firstName,
          last_name: lastName,
          email: email,
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', profileId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
    },
  });
}

export function useEligibleManagers(excludeProfileId?: string) {
  const { data: users } = useAllUsers();

  // Filter to only show managers and admins, excluding the current user
  return (users || []).filter(user => 
    (user.role === 'manager' || user.role === 'admin') && 
    user.id !== excludeProfileId
  );
}
