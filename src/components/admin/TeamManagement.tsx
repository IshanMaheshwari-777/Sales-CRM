// @ts-nocheck
// @ts-nocheck
import { useState, useEffect } from 'react';
import { Plus, Users, CreditCard as Edit, Trash2, UserPlus, UserMinus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { AddEditTeamModal } from './AddEditTeamModal';

interface Team {
  id: string;
  team_name: string;
  team_lead_id: string | null;
  organization_id: string;
  is_active: boolean | null;
  team_lead?: {
    full_name: string;
    email: string;
  };
  organization?: {
    id: string;
    name: string;
  };
}

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  organization_id: string;
  role?: {
    role_name: string;
  };
}

interface TeamManagementProps {
  organizationId?: string | null;
  isSuperAdminView?: boolean;
}

export function TeamManagement({ organizationId, isSuperAdminView = false }: TeamManagementProps) {
  const { showError } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [availableUsers, setAvailableUsers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  useEffect(() => {
    loadTeams();
  }, [organizationId]);

  useEffect(() => {
    if (selectedTeam) {
      loadTeamMembers(selectedTeam.id);
      loadAvailableUsers(selectedTeam.id);
    }
  }, [selectedTeam]);

  const loadTeams = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('teams')
        .select(`
          *,
          team_lead:profiles!teams_team_lead_id_fkey(full_name, email),
          organization:organizations(id, name)
        `);

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      query = query.order('team_name');

      const { data, error } = await query;

      if (error) throw error;

      setTeams(data || []);
      if (data && data.length > 0 && !selectedTeam) {
        setSelectedTeam(data[0]);
      }
    } catch (error) {
      console.error('Error loading teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTeamMembers = async (teamId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          role:roles(role_name)
        `)
        .eq('team_id', teamId)
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;

      setTeamMembers(data || []);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const loadAvailableUsers = async (teamId: string) => {
    try {
      if (!selectedTeam) return;

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          organization_id,
          role:roles(role_name)
        `)
        .is('team_id', null)
        .eq('organization_id', selectedTeam.organization_id)
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;

      setAvailableUsers(data || []);
    } catch (error) {
      console.error('Error loading available users:', error);
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!selectedTeam) return;

    try {
      const user = availableUsers.find((u) => u.id === userId);
      if (user && user.organization_id !== selectedTeam.organization_id) {
        showError('Cannot add user from a different organization to this team');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ team_id: selectedTeam.id })
        .eq('id', userId);

      if (error) throw error;

      await supabase.from('audit_log').insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        action_type: 'team_member_added',
        target_user_id: userId,
        metadata: { team_id: selectedTeam.id, organization_id: selectedTeam.organization_id },
      });

      loadTeamMembers(selectedTeam.id);
      loadAvailableUsers(selectedTeam.id);
    } catch (error) {
      console.error('Error adding team member:', error);
      showError('Failed to add team member');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedTeam) return;

    if (!confirm('Are you sure you want to remove this member from the team?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ team_id: null })
        .eq('id', userId);

      if (error) throw error;

      await supabase.from('audit_log').insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        action_type: 'team_member_removed',
        target_user_id: userId,
        metadata: { team_id: selectedTeam.id },
      });

      loadTeamMembers(selectedTeam.id);
      loadAvailableUsers(selectedTeam.id);
    } catch (error) {
      console.error('Error removing team member:', error);
      showError('Failed to remove team member');
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team? Team members will be unassigned.')) {
      return;
    }

    try {
      const { error } = await supabase.from('teams').delete().eq('id', teamId);

      if (error) throw error;

      await supabase.from('audit_log').insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        action_type: 'team_deleted',
        metadata: { team_id: teamId },
      });

      loadTeams();
      setSelectedTeam(null);
    } catch (error) {
      console.error('Error deleting team:', error);
      showError('Failed to delete team');
    }
  };

  const getTeamStats = (teamId: string) => {
    return teamMembers.length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading teams...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-end mb-6">
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create Team
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Teams</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedTeam?.id === team.id ? 'bg-orange-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedTeam(team)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{team.team_name}</div>
                      {isSuperAdminView && team.organization && (
                        <div className="mt-1">
                          <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
                            {team.organization.name}
                          </span>
                        </div>
                      )}
                      {team.team_lead && (
                        <div className="text-sm text-gray-600 mt-1">
                          Lead: {team.team_lead.full_name}
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                        <Users className="w-4 h-4" />
                        {getTeamStats(team.id)} members
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTeam(team);
                        }}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <Edit className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTeam(team.id);
                        }}
                        className="p-1 hover:bg-red-100 rounded"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {teams.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  No teams created yet. Click "Create Team" to add one.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedTeam ? (
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Team Members</h3>
                  <p className="text-sm text-gray-600 mt-1">{selectedTeam.team_name}</p>
                </div>
                <div className="p-4">
                  {teamMembers.length > 0 ? (
                    <div className="space-y-2">
                      {teamMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div>
                            <div className="font-medium text-gray-900">{member.full_name}</div>
                            <div className="text-sm text-gray-600">{member.email}</div>
                            {member.role && (
                              <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                {member.role.role_name}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <UserMinus className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No members in this team yet
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Available Users</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedTeam?.organization
                      ? `Users from ${selectedTeam.organization.name} without a team`
                      : 'Users not assigned to any team'}
                  </p>
                </div>
                <div className="p-4">
                  {availableUsers.length > 0 ? (
                    <div className="space-y-2">
                      {availableUsers.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div>
                            <div className="font-medium text-gray-900">{user.full_name}</div>
                            <div className="text-sm text-gray-600">{user.email}</div>
                            {user.role && (
                              <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                {user.role.role_name}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleAddMember(user.id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          >
                            <UserPlus className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No available users to add
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
              Select a team to view and manage its members
            </div>
          )}
        </div>
      </div>

      {(showAddModal || editingTeam) && (
        <AddEditTeamModal
          team={editingTeam}
          organizationId={organizationId}
          onClose={() => {
            setShowAddModal(false);
            setEditingTeam(null);
          }}
          onSuccess={() => {
            loadTeams();
            setShowAddModal(false);
            setEditingTeam(null);
          }}
        />
      )}
    </div>
  );
}
