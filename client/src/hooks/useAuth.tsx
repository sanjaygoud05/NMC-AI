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
  // Initialize from cache for instant 0ms refresh
  const getCached = <T,>(key: string): T | null => {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  };

  const cachedUser = getCached<User>('nmc_cached_user');
  const cachedProfile = getCached<Profile>('nmc_cached_profile');
  const cachedRole = (localStorage.getItem('nmc_cached_role') as AppRole) || null;
  const cachedRoles = getCached<AppRole[]>('nmc_cached_available_roles') || [];

  const [user, setUser] = useState<User | null>(cachedUser);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(cachedProfile);
  const [role, setRole] = useState<AppRole | null>(cachedRole);
  const [availableRoles, setAvailableRoles] = useState<AppRole[]>(cachedRoles);
  // If we already have a cached user, we don't need to block rendering!
  const [isLoading, setIsLoading] = useState(!cachedUser);
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);

  const clearAuthCache = () => {
    localStorage.removeItem('nmc_cached_user');
    localStorage.removeItem('nmc_cached_profile');
    localStorage.removeItem('nmc_cached_role');
    localStorage.removeItem('nmc_cached_available_roles');
  };

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
        localStorage.setItem('nmc_cached_profile', JSON.stringify(profileData));
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
        localStorage.setItem('nmc_cached_available_roles', JSON.stringify(roles));

        const activeRole = roles.includes('admin')
          ? 'admin'
          : roles.includes('manager')
          ? 'manager'
          : 'employee';
        setRole(activeRole);
        localStorage.setItem('nmc_cached_role', activeRole);
      } else {
        setAvailableRoles([]);
      }
    } catch (error) {
      // Keep cached state if offline/network error occurs
      console.warn('Silent background auth fetch notice:', error);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          localStorage.setItem('nmc_cached_user', JSON.stringify(newSession.user));
          setTimeout(() => {
            fetchUserData(newSession.user.id);
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
          setRole(null);
          setAvailableRoles([]);
          clearAuthCache();
        }
        setIsLoading(false);
      }
    );

    // Fast session validation via local session first
    void (async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          localStorage.setItem('nmc_cached_user', JSON.stringify(currentSession.user));
          setIsLoading(false);
          // Background refresh user data without blocking
          fetchUserData(currentSession.user.id);
        } else {
          // If no local session found, check user once
          const { data: { user: currentUser }, error } = await supabase.auth.getUser();
          if (error || !currentUser) {
            setSession(null);
            setUser(null);
            setProfile(null);
            setRole(null);
            setAvailableRoles([]);
            clearAuthCache();
          } else {
            setUser(currentUser);
            localStorage.setItem('nmc_cached_user', JSON.stringify(currentUser));
            fetchUserData(currentUser.id);
          }
          setIsLoading(false);
        }
      } catch {
        setIsLoading(false);
      }
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
    clearAuthCache();
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
