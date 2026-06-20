// @ts-nocheck
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { OrganizationSelector } from '../common/OrganizationSelector';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useToast } from '../../contexts/ToastContext';

interface Team {
  id: string;
  team_name: string;
  team_lead_id: string | null;
  organization_id: string;
  organization?: {
    id: string;
    name: string;
  };
}

interface AddEditTeamModalProps {
  team: Team | null;
  organizationId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddEditTeamModal({ team, organizationId, onClose, onSuccess }: AddEditTeamModalProps) {
  const { userProfile, isSuperAdmin } = usePermissions();
  const { showError, showSuccess } = useToast();
  const [formData, setFormData] = useState({
    team_name: '',
    team_lead_id: '',
    organization_id: '',
  });
  const [teamLeads, setTeamLeads] = useState<any[]>([]);
  const [organizationName, setOrganizationName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (team) {
      setFormData({
        team_name: team.team_name,
        team_lead_id: team.team_lead_id || '',
        organization_id: team.organization_id || '',
      });
      loadOrganizationName(team.organization_id);
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
  }, [team, organizationId, userProfile, isSuperAdmin]);

  const loadOrganizationName = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single();

      if (error) throw error;
      setOrganizationName(data?.name || '');
    } catch (error) {
      console.error('Error loading organization name:', error);
    }
  };

  useEffect(() => {
    if (formData.organization_id) {
      loadTeamLeads(formData.organization_id);
    }
  }, [formData.organization_id]);

  const loadTeamLeads = async (organizationId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          organization_id,
          role:roles(hierarchy_level)
        `)
        .eq('organization_id', organizationId)
        .lte('role.hierarchy_level', 3)
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;

      setTeamLeads(data || []);
    } catch (error) {
      console.error('Error loading team leads:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.organization_id) {
      showError('Please select an organization');
      return;
    }

    setLoading(true);

    try {
      if (team) {
        const { error: updateError } = await supabase
          .from('teams')
          .update({
            team_name: formData.team_name,
            team_lead_id: formData.team_lead_id || null,
          })
          .eq('id', team.id);

        if (updateError) throw updateError;

        await supabase.from('audit_log').insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          action_type: 'team_updated',
          metadata: { team_id: team.id, changes: formData },
        });
      } else {
        const { error: insertError } = await supabase.from('teams').insert({
          team_name: formData.team_name,
          team_lead_id: formData.team_lead_id || null,
          organization_id: formData.organization_id,
        });

        if (insertError) throw insertError;

        await supabase.from('audit_log').insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          action_type: 'team_created',
          metadata: { team_name: formData.team_name },
        });
      }

      showSuccess(team ? 'Team updated successfully' : 'Team created successfully');
      onSuccess();
    } catch (err: any) {
      console.error('Error saving team:', err);
      showError(err.message || 'Failed to save team');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {team ? 'Edit Team' : 'Create New Team'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {team ? (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organization
              </label>
              <div className="flex items-center gap-2">
                <span className="text-base font-medium text-orange-600">
                  {organizationName || 'Loading...'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Organization cannot be changed after team creation
              </p>
            </div>
          ) : (
            <OrganizationSelector
              value={formData.organization_id}
              onChange={(organizationId) => setFormData({ ...formData, organization_id: organizationId, team_lead_id: '' })}
              error={''}
            />
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Team Name
            </label>
            <input
              type="text"
              required
              value={formData.team_name}
              onChange={(e) => setFormData({ ...formData, team_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="e.g., Sales Team A"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Team Lead (Optional)
            </label>
            <select
              value={formData.team_lead_id}
              onChange={(e) => setFormData({ ...formData, team_lead_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="">No Team Lead</option>
              {teamLeads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.full_name} ({lead.email})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Only users with Team Lead, Admin, or Super Admin roles can be assigned as team leads
            </p>
          </div>

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
              {loading ? 'Saving...' : team ? 'Update Team' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
