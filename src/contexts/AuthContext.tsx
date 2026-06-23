// @ts-nocheck
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
        if (_event === 'INITIAL_SESSION' || _event === 'SIGNED_IN' || _event === 'PASSWORD_RECOVERY') {
          loadProfile(session.user.id);
        }
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
      // Refresh the JWT so it always carries the latest role_id in app_metadata.
      // This is critical because:
      // 1. On signUp, the JWT is issued BEFORE the handle_new_user trigger sets role_id.
      //    refreshSession() exchanges the refresh token for a new access token that
      //    includes the role_id written by the trigger.
      // 2. When an admin changes a user's role, the old JWT has the stale role.
      //    refreshSession() picks up the new role immediately.
      await supabase.auth.refreshSession();

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      }

      if (profileData) {
        setProfile(profileData);

        const { data: memberData, error: memberError } = await supabase
          .from('organization_members')
          .select('*')
          .eq('profile_id', userId)
          .maybeSingle();

        if (memberError) {
          console.error('Error fetching organization member:', memberError);
        }

        if (memberData) {
          setOrganizationMember(memberData);
        } else {
          setOrganizationMember(null);
        }

        const selectedOrganizationId =
          profileData.organization_id || memberData?.organization_id || null;

        if (selectedOrganizationId) {
          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', selectedOrganizationId)
            .maybeSingle();

          if (orgError) {
            console.error('Error fetching organization:', orgError);
          }

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
      const { data: profileData } = await (supabase
        .from('profiles')
        .select('*, organization_id, status')
        .eq('id', data.user.id)
        .single() as any);

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

      await (supabase
        .from('profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', data.user.id) as any);

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
