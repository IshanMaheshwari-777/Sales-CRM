// @ts-nocheck
// @ts-nocheck
import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { isIgnorableRequestError } from '../../lib/requestErrors';

interface Role {
  id: string;
  role_name: string;
  hierarchy_level: number;
}

interface Permission {
  id: string;
  module_name: string;
  action_name: string;
  permission_key: string;
  description: string;
}

interface RolePermission {
  role_id: string;
  permission_id: string;
}

interface GroupedPermissions {
  [module: string]: Permission[];
}

export function RolePermissionsMatrix() {
  const { showError } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [groupedPermissions, setGroupedPermissions] = useState<GroupedPermissions>({});
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const grouped: GroupedPermissions = {};
    permissions.forEach((perm) => {
      if (!grouped[perm.module_name]) {
        grouped[perm.module_name] = [];
      }
      grouped[perm.module_name].push(perm);
    });
    setGroupedPermissions(grouped);
  }, [permissions]);

  const loadData = async (signal?: AbortSignal) => {
    try {
      setLoading(true);

      const [rolesRes, permsRes, rolePermsRes] = await Promise.all([
        supabase.from('roles').select('*').order('hierarchy_level').abortSignal(signal ?? new AbortController().signal),
        supabase.from('permissions').select('*').order('module_name, action_name').abortSignal(signal ?? new AbortController().signal),
        supabase.from('role_permissions').select('role_id, permission_id').abortSignal(signal ?? new AbortController().signal),
      ]);

      if (rolesRes.error) throw rolesRes.error;
      if (permsRes.error) throw permsRes.error;
      if (rolePermsRes.error) throw rolePermsRes.error;

      setRoles(rolesRes.data || []);
      setPermissions(permsRes.data || []);
      setRolePermissions(rolePermsRes.data || []);
    } catch (error) {
      if (!isIgnorableRequestError(error)) {
        console.error('Error loading permissions data:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (roleId: string, permissionId: string): boolean => {
    return rolePermissions.some(
      (rp) => rp.role_id === roleId && rp.permission_id === permissionId
    );
  };

  const togglePermission = async (roleId: string, permissionId: string) => {
    if (updating) return;

    const has = hasPermission(roleId, permissionId);
    setUpdating(true);

    try {
      if (has) {
        const { error } = await supabase
          .from('role_permissions')
          .delete()
          .eq('role_id', roleId)
          .eq('permission_id', permissionId);

        if (error) throw error;

        setRolePermissions((prev) =>
          prev.filter((rp) => !(rp.role_id === roleId && rp.permission_id === permissionId))
        );
      } else {
        const { error } = await supabase
          .from('role_permissions')
          .insert({ role_id: roleId, permission_id: permissionId });

        if (error) throw error;

        setRolePermissions((prev) => [...prev, { role_id: roleId, permission_id: permissionId }]);
      }

      await supabase.from('audit_log').insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        action_type: 'permission_change',
        metadata: {
          role_id: roleId,
          permission_id: permissionId,
          action: has ? 'removed' : 'added',
        },
      });
    } catch (error) {
      console.error('Error toggling permission:', error);
      showError('Failed to update permission');
    } finally {
      setUpdating(false);
    }
  };

  const selectAllForRole = async (roleId: string) => {
    if (updating) return;
    setUpdating(true);

    try {
      const toAdd = permissions
        .filter((perm) => !hasPermission(roleId, perm.id))
        .map((perm) => ({ role_id: roleId, permission_id: perm.id }));

      if (toAdd.length > 0) {
        const { error } = await supabase.from('role_permissions').insert(toAdd);
        if (error) throw error;

        setRolePermissions((prev) => [...prev, ...toAdd]);

        await supabase.from('audit_log').insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          action_type: 'permission_bulk_add',
          metadata: { role_id: roleId, count: toAdd.length },
        });
      }
    } catch (error) {
      console.error('Error selecting all permissions:', error);
      showError('Failed to update permissions');
    } finally {
      setUpdating(false);
    }
  };

  const clearAllForRole = async (roleId: string) => {
    if (updating) return;
    if (!confirm('Are you sure you want to remove all permissions for this role?')) {
      return;
    }

    setUpdating(true);

    try {
      const { error } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', roleId);

      if (error) throw error;

      setRolePermissions((prev) => prev.filter((rp) => rp.role_id !== roleId));

      await supabase.from('audit_log').insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        action_type: 'permission_bulk_remove',
        metadata: { role_id: roleId },
      });
    } catch (error) {
      console.error('Error clearing permissions:', error);
      showError('Failed to clear permissions');
    } finally {
      setUpdating(false);
    }
  };

  const getPermissionCount = (roleId: string): number => {
    return rolePermissions.filter((rp) => rp.role_id === roleId).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading permissions...</div>
      </div>
    );
  }

  return (
    <div className="p-6 relative">
      {updating && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-50 flex items-center justify-center">
          <div className="bg-white px-4 py-2 rounded shadow text-blue-600 font-medium">Updating permissions...</div>
        </div>
      )}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 sticky left-0 bg-gray-50 z-10 border-r border-gray-200">
                  Module / Permission
                </th>
                {roles.map((role) => (
                  <th key={role.id} className="px-4 py-4 text-center border-r border-gray-200 last:border-r-0">
                    <div className="text-sm font-semibold text-gray-900">{role.role_name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {getPermissionCount(role.id)} permissions
                    </div>
                    <div className="flex gap-2 justify-center mt-2">
                      <button
                        onClick={() => selectAllForRole(role.id)}
                        disabled={updating || role.hierarchy_level === 1}
                        className={`text-xs ${updating || role.hierarchy_level === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800'}`}
                      >
                        Select All
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={() => clearAllForRole(role.id)}
                        disabled={updating || role.hierarchy_level === 1}
                        className={`text-xs ${updating || role.hierarchy_level === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:text-red-800'}`}
                      >
                        Clear All
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedPermissions).map(([module, perms], moduleIndex) => (
                <>
                  <tr key={`module-${module}`} className="bg-gray-100">
                    <td
                      colSpan={roles.length + 1}
                      className="px-6 py-3 text-sm font-semibold text-gray-900 sticky left-0 bg-gray-100"
                    >
                      {module}
                    </td>
                  </tr>
                  {perms.map((permission, permIndex) => (
                    <tr
                      key={permission.id}
                      className={`${
                        permIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      } hover:bg-blue-50 transition-colors`}
                    >
                      <td className="px-6 py-3 sticky left-0 bg-inherit z-10 border-r border-gray-200">
                        <div className="text-sm font-medium text-gray-900">
                          {permission.action_name}
                        </div>
                        <div className="text-xs text-gray-500">{permission.description}</div>
                      </td>
                      {roles.map((role) => (
                        <td
                          key={`${role.id}-${permission.id}`}
                          className="text-center border-r border-gray-200 last:border-r-0"
                        >
                          <button
                            onClick={() => togglePermission(role.id, permission.id)}
                            disabled={updating || role.hierarchy_level === 1}
                            className={`
                              w-8 h-8 rounded flex items-center justify-center transition-colors mx-auto
                              ${
                                hasPermission(role.id, permission.id)
                                  ? 'bg-green-500 hover:bg-green-600 text-white'
                                  : 'bg-gray-200 hover:bg-gray-300 text-gray-400'
                              }
                              ${updating || role.hierarchy_level === 1 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                            `}
                          >
                            {hasPermission(role.id, permission.id) && (
                              <Check className="w-5 h-5" />
                            )}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>

          {Object.keys(groupedPermissions).length === 0 && (
            <div className="text-center py-12 text-gray-500">No permissions found</div>
          )}
        </div>
      </div>

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> Click on any checkbox to grant or revoke a permission for a role.
          Changes are saved immediately. Use "Select All" or "Clear All" to quickly manage all
          permissions for a role.
        </p>
      </div>
    </div>
  );
}
