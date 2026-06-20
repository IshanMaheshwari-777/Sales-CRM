// @ts-nocheck
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface Role {
  id: string;
  role_name: string;
  hierarchy_level: number;
  is_active: boolean;
}

interface Permission {
  id: string;
  module_name: string;
  action_name: string;
  permission_key: string;
  description: string;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role_id: string | null;
  team_id: string | null;
  manager_id: string | null;
  organization_id: string | null;
  is_active: boolean | null;
  role?: Role;
}

interface PermissionsContextType {
  userProfile: UserProfile | null;
  permissions: string[];
  hasPermission: (permissionKey: string) => boolean;
  hasAnyPermission: (permissionKeys: string[]) => boolean;
  hasAllPermissions: (permissionKeys: string[]) => boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isTeamLead: boolean;
  hierarchyLevel: number;
  loading: boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserPermissions = async () => {
    if (!user) {
      setUserProfile(null);
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(`
          *,
          roles(*)
        `)
        .eq('id', user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      const roleData = (profile as any)?.roles;
      const profileWithRole = {
        ...profile,
        role: roleData
      };

      setUserProfile(profileWithRole as UserProfile);

      if (profile.role_id) {
        const { data: rolePermissions, error: permError } = await supabase
          .from('role_permissions')
          .select(`
            permission:permissions(permission_key)
          `)
          .eq('role_id', profile.role_id);

        if (permError) throw permError;

        const permissionKeys = rolePermissions
          .map((rp: any) => rp.permission?.permission_key)
          .filter(Boolean);

        setPermissions(permissionKeys);
      } else {
        setPermissions([]);
      }
    } catch (error) {
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserPermissions();
  }, [user]);

  const hasPermission = (permissionKey: string): boolean => {
    return permissions.includes(permissionKey);
  };

  const hasAnyPermission = (permissionKeys: string[]): boolean => {
    return permissionKeys.some(key => permissions.includes(key));
  };

  const hasAllPermissions = (permissionKeys: string[]): boolean => {
    return permissionKeys.every(key => permissions.includes(key));
  };

  const hierarchyLevel = userProfile?.role?.hierarchy_level ?? 4;
  const isAdmin = hierarchyLevel <= 2;
  const isSuperAdmin = hierarchyLevel === 1;
  const isTeamLead = hierarchyLevel === 3;

  return (
    <PermissionsContext.Provider
      value={{
        userProfile,
        permissions,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        isAdmin,
        isSuperAdmin,
        isTeamLead,
        hierarchyLevel,
        loading,
        refreshPermissions: loadUserPermissions,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}
