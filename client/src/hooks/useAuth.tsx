import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Define AppRole locally since we removed mockData
export type AppRole = 'admin' | 'manager' | 'employee';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  manager_id: string | null;
  status: string;
  custom_fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  availableRoles: AppRole[];
  isLoading: boolean;
  isSwitchingRole: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, firstName?: string, lastName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  switchRole: (role: AppRole) => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAdmin: boolean;
  isManager: boolean;
  isEmployee: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [availableRoles, setAvailableRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData as Profile);
      }

      // Fetch role (get highest privilege role)
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .order('role');

      if (roleData && roleData.length > 0) {
        // Priority: admin > manager > employee
        const roles = roleData.map(r => r.role as AppRole);
        setAvailableRoles(roles);
        if (roles.includes('admin')) {
          setRole('admin');
        } else if (roles.includes('manager')) {
          setRole('manager');
        } else {
          setRole('employee');
        }
      } else {
        setAvailableRoles([]);
      }
    } catch (error) {
      setProfile(null);
      setRole(null);
      setAvailableRoles([]);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Defer Supabase calls with setTimeout to prevent deadlock
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
          setAvailableRoles([]);
        }
        setIsLoading(false);
      }
    );

    // THEN check for existing authenticated user (server-validated)
    void (async () => {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        setSession(null);
        setUser(null);
        setProfile(null);
        setRole(null);
        setAvailableRoles([]);
        setIsLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(user);
      await fetchUserData(user.id);
      setIsLoading(false);
    })();

    return () => subscription.unsubscribe();
  }, []);

  const switchRole = async (newRole: AppRole) => {
    if (!user) {
      toast.error('Error', {
        description: 'You must be logged in to switch roles',
      });
      return;
    }

    if (isSwitchingRole) return;

    if (!availableRoles.includes(newRole)) {
      toast.error('Not allowed', {
        description: 'You do not have permission to switch to this role.',
      });
      return;
    }

    setIsSwitchingRole(true);
    try {
      // Role switching is now a client-side view change only
      // The actual role is determined by the user_roles table
      setRole(newRole);
      toast.success('Role switched', {
        description: `You are now viewing as ${newRole.charAt(0).toUpperCase() + newRole.slice(1)}`,
      });
    } catch {
      toast.error('Error switching role', {
        description: 'Unable to switch roles right now. Please try again.',
      });
    } finally {
      setIsSwitchingRole(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, firstName?: string, lastName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          first_name: firstName || '',
          last_name: lastName || '',
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRole(null);
    setAvailableRoles([]);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    role,
    availableRoles,
    isLoading,
    isSwitchingRole,
    signIn,
    signUp,
    signOut,
    switchRole,
    refreshProfile,
    isAdmin: role === 'admin',
    isManager: role === 'manager',
    isEmployee: role === 'employee',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
