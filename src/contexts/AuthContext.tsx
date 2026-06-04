import { createContext, useContext, useEffect, useState } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Organization = Database['public']['Tables']['organizations']['Row'];
type OrganizationMember = Database['public']['Tables']['organization_members']['Row'];

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  organization: Organization | null;
  organizationMember: OrganizationMember | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | Error | null }>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ data?: { user: User | null } | null; error: AuthError | Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizationMember, setOrganizationMember] = useState<OrganizationMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setOrganization(null);
        setOrganizationMember(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);

        const { data: memberData } = await supabase
          .from('organization_members')
          .select('*')
          .eq('profile_id', userId)
          .maybeSingle();

        if (memberData) {
          setOrganizationMember(memberData);
        } else {
          setOrganizationMember(null);
        }

        const selectedOrganizationId =
          profileData.organization_id || memberData?.organization_id || null;

        if (selectedOrganizationId) {
          const { data: orgData } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', selectedOrganizationId)
            .maybeSingle();

          setOrganization(orgData || null);
        } else {
          setOrganization(null);
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.id);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && data.user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('status, organization_id')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileData?.status === 'disabled') {
        await supabase.auth.signOut();
        return {
          error: new Error('Your account has been disabled. Please contact your administrator.'),
        };
      }

      if (profileData?.organization_id) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('status')
          .eq('id', profileData.organization_id)
          .maybeSingle();

        if (orgData?.status === 'suspended') {
          await supabase.auth.signOut();
          return {
            error: new Error('Your organization account has been suspended. Please contact support.'),
          };
        }
      }

      await supabase
        .from('profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', data.user.id);

      await loadProfile(data.user.id);
    }

    return { error };
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    });

    return { data, error };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setOrganization(null);
    setOrganizationMember(null);
  };

  const value = {
    user,
    profile,
    organization,
    organizationMember,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    resetPassword,
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
