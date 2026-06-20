// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { Search, UserPlus, MoreVertical, CreditCard as Edit, Ban, UserX, UserCheck, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { AddEditUserModal } from './AddEditUserModal';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  role_id: string | null;
  team_id: string | null;
  is_active: boolean | null;
  status: 'pending' | 'active' | 'disabled';
  disabled_at: string | null;
  disabled_by: string | null;
  disabled_reason: string | null;
  last_login_at: string | null;
  role?: {
    role_name: string;
    hierarchy_level: number;
  };
  team?: {
    team_name: string;
  };
}

interface RoleCounts {
  [key: string]: number;
}

interface UserManagementProps {
  organizationId?: string | null;
  isSuperAdminView?: boolean;
}

export function UserManagement({ organizationId, isSuperAdminView = false }: UserManagementProps) {
  const { showError } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [roleCounts, setRoleCounts] = useState<RoleCounts>({});

  useEffect(() => {
    loadData();
  }, [organizationId]);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, filterRole, filterTeam, filterStatus]);

  const loadData = async () => {
    try {
      setLoading(true);

      let usersQuery = supabase
        .from('profiles')
        .select(`
          *,
          role:roles!role_id(*),
          team:teams!team_id(*)
        `);

      let teamsQuery = supabase
        .from('teams')
        .select('*');

      if (organizationId) {
        usersQuery = usersQuery.eq('organization_id', organizationId);
        teamsQuery = teamsQuery.eq('organization_id', organizationId);
      }

      usersQuery = usersQuery.order('created_at', { ascending: false });
      teamsQuery = teamsQuery.order('team_name');

      const [usersRes, rolesRes, teamsRes] = await Promise.all([
        usersQuery,
        supabase
          .from('roles')
          .select('*')
          .order('hierarchy_level'),
        teamsQuery,
      ]);

      if (usersRes.error) throw usersRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (teamsRes.error) throw teamsRes.error;

      setUsers(usersRes.data || []);
      setRoles(rolesRes.data || []);
      setTeams(teamsRes.data || []);

      const counts: RoleCounts = {};
      usersRes.data?.forEach((user) => {
        const roleName = user.role?.role_name || 'No Role';
        counts[roleName] = (counts[roleName] || 0) + 1;
      });
      setRoleCounts(counts);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.full_name.toLowerCase().includes(term) ||
          user.email.toLowerCase().includes(term)
      );
    }

    if (filterRole !== 'all') {
      filtered = filtered.filter((user) => user.role_id === filterRole);
    }

    if (filterTeam !== 'all') {
      filtered = filtered.filter((user) => user.team_id === filterTeam);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((user) => {
        if (filterStatus === 'active') return user.status === 'active';
        if (filterStatus === 'disabled') return user.status === 'disabled';
        if (filterStatus === 'pending') return user.status === 'pending';
        return true;
      });
    }

    setFilteredUsers(filtered);
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      await supabase.from('audit_log').insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        action_type: 'user_status_change',
        target_user_id: userId,
        old_value: currentStatus.toString(),
        new_value: (!currentStatus).toString(),
      });

      loadData();
    } catch (error) {
      console.error('Error toggling user status:', error);
    }
  };

  const handleDisableUser = async (userId: string) => {
    const reason = prompt('Please provide a reason for disabling this user (optional):');

    if (reason === null) return;

    try {
      const currentUser = (await supabase.auth.getUser()).data.user;

      const { error } = await supabase.rpc('disable_user', {
        target_user_id: userId,
        actor_id: currentUser?.id,
        reason: reason || null,
      });

      if (error) throw error;

      await supabase.from('audit_log').insert({
        actor_user_id: currentUser?.id,
        action_type: 'user_disabled',
        target_user_id: userId,
        notes: reason || 'No reason provided',
      });

      loadData();
    } catch (error) {
      console.error('Error disabling user:', error);
      showError('Failed to disable user. Please try again.');
    }
  };

  const handleEnableUser = async (userId: string) => {
    if (!confirm('Are you sure you want to enable this user?')) {
      return;
    }

    try {
      const currentUser = (await supabase.auth.getUser()).data.user;

      const { error } = await supabase.rpc('enable_user', {
        target_user_id: userId,
        actor_id: currentUser?.id,
      });

      if (error) throw error;

      await supabase.from('audit_log').insert({
        actor_user_id: currentUser?.id,
        action_type: 'user_enabled',
        target_user_id: userId,
      });

      loadData();
    } catch (error) {
      console.error('Error enabling user:', error);
      showError('Failed to enable user. Please try again.');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {Object.entries(roleCounts).map(([role, count]) => (
            <div key={role} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-600">{role}</div>
              <div className="text-2xl font-semibold text-gray-900 mt-1">{count}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            <UserPlus className="w-5 h-5" />
            Add User
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Roles</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.role_name}
              </option>
            ))}
          </select>

          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Teams</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.team_name}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Team
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">{user.full_name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                      {user.role?.role_name || 'No Role'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {user.team?.team_name || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        user.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : user.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {user.status === 'active' ? 'Active' : user.status === 'pending' ? 'Pending' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(user.last_login_at)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1 relative">
                      <div className="relative">
                        <button
                          onClick={() =>
                            setSelectedUserId(selectedUserId === user.id ? null : user.id)
                          }
                          className="p-1.5 hover:bg-gray-100 rounded transition"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-600" />
                        </button>
                        {selectedUserId === user.id && (
                          <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                            <button
                              onClick={() => {
                                setEditingUser(user);
                                setSelectedUserId(null);
                              }}
                              className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                            >
                              <Edit className="w-4 h-4" />
                              Edit User
                            </button>
                            {user.status === 'disabled' ? (
                              <button
                                onClick={() => {
                                  handleEnableUser(user.id);
                                  setSelectedUserId(null);
                                }}
                                className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-green-600 hover:bg-green-50 transition"
                              >
                                <RotateCcw className="w-4 h-4" />
                                Enable User
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  handleDisableUser(user.id);
                                  setSelectedUserId(null);
                                }}
                                className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                              >
                                <Ban className="w-4 h-4" />
                                Disable User
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No users found matching your filters
            </div>
          )}
        </div>
      </div>

      {(showAddModal || editingUser) && (
        <AddEditUserModal
          user={editingUser}
          roles={roles}
          teams={teams}
          organizationId={organizationId}
          onClose={() => {
            setShowAddModal(false);
            setEditingUser(null);
          }}
          onSuccess={() => {
            loadData();
            setShowAddModal(false);
            setEditingUser(null);
          }}
        />
      )}
    </div>
  );
}
