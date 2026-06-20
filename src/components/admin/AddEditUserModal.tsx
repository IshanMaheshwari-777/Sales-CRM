// @ts-nocheck
// @ts-nocheck
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { OrganizationSelector } from '../common/OrganizationSelector';
import { usePermissions } from '../../contexts/PermissionsContext';
import { buildInvitationLink } from '../../utils/invitations';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  mobile_number: string | null;
  role_id: string | null;
  team_id: string | null;
  manager_id: string | null;
  organization_id: string;
}

interface Role {
  id: string;
  role_name: string;
  hierarchy_level: number;
}

interface Team {
  id: string;
  team_name: string;
  organization_id: string;
}

interface AddEditUserModalProps {
  user: UserProfile | null;
  roles: Role[];
  teams: Team[];
  organizationId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddEditUserModal({ user, roles, teams, organizationId, onClose, onSuccess }: AddEditUserModalProps) {
  const { userProfile, isSuperAdmin } = usePermissions();
  const { showError, showSuccess } = useToast();
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    mobile_number: '',
    role_id: '',
    team_id: '',
    manager_id: '',
    organization_id: '',
  });
  const [loading, setLoading] = useState(false);
  const [filteredTeams, setFilteredTeams] = useState<Team[]>([]);

  const selectedRole = roles.find(role => role.id === formData.role_id);
  const isSuperAdminRole = selectedRole?.hierarchy_level === 1;

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        mobile_number: user.mobile_number || '',
        role_id: user.role_id || '',
        team_id: user.team_id || '',
        manager_id: user.manager_id || '',
        organization_id: user.organization_id || '',
      });
    } else if (organizationId) {
      setFormData(prev => ({
        ...prev,
        organization_id: organizationId,
      }));
    } else if (userProfile?.organization_id && !isSuperAdmin) {
      setFormData(prev => ({
        ...prev,
        organization_id: userProfile.organization_id,
      }));
    }
  }, [user, organizationId, userProfile, isSuperAdmin]);



  useEffect(() => {
    if (formData.organization_id) {
      const teamsInOrg = teams.filter(team => team.organization_id === formData.organization_id);
      setFilteredTeams(teamsInOrg);

      if (formData.team_id) {
        const selectedTeam = teams.find(t => t.id === formData.team_id);
        if (selectedTeam && selectedTeam.organization_id !== formData.organization_id) {
          setFormData(prev => ({ ...prev, team_id: '' }));
        }
      }
    } else {
      setFilteredTeams([]);
      setFormData(prev => ({ ...prev, team_id: '' }));
    }
  }, [formData.organization_id, teams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isSuperAdminRole && !formData.organization_id) {
      showError('Please select an organization');
      return;
    }

    if (formData.team_id) {
      const selectedTeam = teams.find(t => t.id === formData.team_id);
      if (selectedTeam && selectedTeam.organization_id !== formData.organization_id) {
        showError('Selected team does not belong to the selected organization');
        return;
      }
    }

    if (formData.mobile_number) {
      const mobileRegex = /^\+[0-9]{10,15}$/;
      if (!mobileRegex.test(formData.mobile_number)) {
        showError('Please enter a valid mobile number starting with + followed by 10-15 digits');
        return;
      }
    }

    setLoading(true);

    try {
      if (user) {
        if (!formData.role_id) {
          showError('Role is required');
          setLoading(false);
          return;
        }

        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            first_name: formData.first_name,
            last_name: formData.last_name,
            mobile_number: formData.mobile_number || null,
            role_id: formData.role_id || null,
            team_id: formData.team_id || null,
            manager_id: formData.manager_id || null,
            organization_id: isSuperAdminRole ? null : (formData.organization_id || null),
          })
          .eq('id', user.id);

        if (updateError) throw updateError;

        // Also update organization_members table if they belong to an organization
        if (!isSuperAdminRole && formData.organization_id) {
            await supabase.from('organization_members').upsert({
                organization_id: formData.organization_id,
                user_id: user.id
            });
        }

        await supabase.from('audit_log').insert({
          actor_user_id: (await supabase.auth.getUser()).data.user?.id,
          action_type: 'user_updated',
          target_user_id: user.id,
          metadata: { changes: formData },
        });

        showSuccess('User updated successfully');
        onSuccess();
      } else {
        if (!formData.role_id) {
          showError('Role is required for new users');
          setLoading(false);
          return;
        }

        const { data: invitationData, error: inviteError } = await supabase
          .from('invitations')
          .insert({
            email: formData.email.toLowerCase().trim(),
            role_id: formData.role_id,
            invited_by: (await supabase.auth.getUser()).data.user?.id,
            organization_id: formData.organization_id || null,
          })
          .select('id, token, email')
          .single();

        if (inviteError) {
          if (inviteError.code === '23505') {
            throw new Error('An invitation for this email already exists or user already exists');
          }
          throw inviteError;
        }

        const invitationLink = buildInvitationLink(invitationData.token);

        await supabase.from('email_queue').insert({
          organization_id: formData.organization_id || null,
          to_email: formData.email.toLowerCase().trim(),
          subject: 'You have been invited to join the team',
          body_html: `
            <p>Hello,</p>
            <p>You have been invited to join the organization. Click the link below to accept your invitation and set up your account:</p>
            <p><a href="${invitationLink}">${invitationLink}</a></p>
            <p>This invitation will expire in 48 hours.</p>
            <p>Best regards,<br/>The Team</p>
          `,
          body_text: `You have been invited to join the organization. Visit this link to accept: ${invitationLink}\n\nThis invitation will expire in 48 hours.`,
          priority: 8,
        });

        await supabase.from('audit_log').insert({
          actor_user_id: (await supabase.auth.getUser()).data.user?.id,
          action_type: 'user_invited',
          metadata: {
            email: formData.email,
            role_id: formData.role_id,
            organization_id: formData.organization_id,
          },
        });

        showSuccess(`Invitation sent successfully to ${formData.email}! Check the Invitations tab to view the link.`);
        onSuccess();
      }
    } catch (err: any) {
      console.error('Error saving user:', err);
      showError(err.message || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {user ? 'Edit User' : 'Add New User'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {roles.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
              Loading roles and teams. Please wait...
            </div>
          )}



          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              disabled={!!user}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <input
                type="text"
                required
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                required
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mobile Number
            </label>
            <input
              type="tel"
              value={formData.mobile_number}
              onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="+1234567890"
            />
          </div>

          {!isSuperAdminRole && isSuperAdmin && (
            <OrganizationSelector
              value={formData.organization_id}
              onChange={(organizationId) => setFormData({ ...formData, organization_id: organizationId, team_id: '' })}
              error={''}
            />
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              value={formData.role_id}
              onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="">No Role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.role_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Team
            </label>
            <select
              value={formData.team_id}
              onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
              disabled={!formData.organization_id && !user}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">No Team</option>
              {filteredTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.team_name}
                </option>
              ))}
            </select>
            {formData.organization_id && filteredTeams.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                Only teams from the selected organization
              </p>
            )}
            {formData.organization_id && filteredTeams.length === 0 && (
              <p className="text-xs text-yellow-600 mt-1">
                No teams available in this organization
              </p>
            )}
            {!formData.organization_id && !user && (
              <p className="text-xs text-gray-500 mt-1">
                Select an organization first
              </p>
            )}
          </div>

          {!user && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                An invitation will be sent to <strong>{formData.email || 'the user'}</strong>. They will receive an email to set up their account and create their password.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : user ? 'Update User' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
