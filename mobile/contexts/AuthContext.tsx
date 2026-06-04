import React, { createContext, useContext, useState, useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { splitFullName } from '../lib/leadQueue';
import { mobileSupabase } from '../lib/supabaseClient';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  first_name: string;
  last_name: string;
  mobile_number: string | null;
  role_id: string | null;
  role_name: string;
  team_id: string | null;
  manager_id: string | null;
  organization_id: string | null;
  organization_name: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mobileSupabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = mobileSupabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await mobileSupabase
        .from('profiles')
        .select('id, email, full_name, mobile_number, role_id, team_id, manager_id, organization_id')
        .eq('id', userId)
        .single();

      if (error) throw error;

      if (data) {
        const [{ data: roleData }, { data: organizationData }] = await Promise.all([
          data.role_id
            ? mobileSupabase.from('roles').select('role_name').eq('id', data.role_id).single()
            : Promise.resolve({ data: null }),
          data.organization_id
            ? mobileSupabase.from('organizations').select('name').eq('id', data.organization_id).single()
            : Promise.resolve({ data: null }),
        ]);

        const { firstName, lastName } = splitFullName(data.full_name);
        setProfile({
          id: data.id,
          email: data.email,
          full_name: data.full_name,
          first_name: firstName,
          last_name: lastName,
          mobile_number: data.mobile_number,
          role_id: data.role_id,
          role_name: roleData?.role_name || 'User',
          team_id: data.team_id,
          manager_id: data.manager_id,
          organization_id: data.organization_id,
          organization_name: organizationData?.name || 'Unknown',
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await mobileSupabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await mobileSupabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
