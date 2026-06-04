import { useState, useEffect } from 'react';
import { Mail, UserPlus, Copy, Check, X, Clock, Trash2, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../contexts/PermissionsContext';
import { buildInvitationLink } from '../../utils/invitations';

interface Invitation {
  id: string;
  email: string;
  role_id: string;
  invited_by: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  resend_count?: number;
  last_resent_at?: string;
  expires_at: string;
  created_at: string;
  role?: {
    role_name: string;
    hierarchy_level: number;
  };
  inviter?: {
    full_name: string;
    email: string;
  };
}

interface OrgCapacity {
  current_users: number;
  max_users: number | null;
  can_invite: boolean;
  remaining_slots: number | null;
}

export function InvitationManagement() {
  const { userProfile } = usePermissions();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [capacity, setCapacity] = useState<OrgCapacity | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    role_id: '',
  });
  const [roles, setRoles] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load capacity info
      const { data: capacityData, error: capacityError } = await supabase
        .rpc('get_organization_capacity');

      if (capacityError) throw capacityError;
      setCapacity(capacityData);

      // Load invitations
      const { data: invites, error: invitesError } = await supabase
        .from('invitations')
        .select(`
          *,
          role:roles!invitations_role_id_fkey(*),
          inviter:profiles!invitations_invited_by_fkey(full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (invitesError) throw invitesError;
      setInvitations(invites || []);

      // Load roles and teams for the form
      const [rolesRes, teamsRes] = await Promise.all([
        supabase.from('roles').select('*').order('hierarchy_level'),
        supabase.from('teams').select('*').order('team_name'),
      ]);

      if (rolesRes.error) throw rolesRes.error;
      if (teamsRes.error) throw teamsRes.error;

      setRoles(rolesRes.data || []);
      setTeams(teamsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.email || !formData.role_id) {
      setError('Email and role are required');
      return;
    }

    try {
      setSending(true);

      const { error: inviteError } = await supabase
        .from('invitations')
        .insert({
          email: formData.email.toLowerCase().trim(),
          role_id: formData.role_id,
          invited_by: userProfile?.id,
          organization_id: userProfile?.organization_id,
        });

      if (inviteError) throw inviteError;

      setFormData({ email: '', role_id: '' });
      setShowInviteForm(false);
      loadData();
    } catch (err: any) {
      console.error('Error sending invitation:', err);
      if (err.code === '23505') {
        setError('An invitation for this email already exists');
      } else if (err.message?.includes('capacity')) {
        setError('Cannot send invitation: user capacity limit reached');
      } else {
        setError(err.message || 'Failed to send invitation');
      }
    } finally {
      setSending(false);
    }
  };

  const handleCopyInviteLink = async (invitationId: string) => {
    const inviteLink = buildInvitationLink(invitationId);
    await navigator.clipboard.writeText(inviteLink);
    setCopiedId(invitationId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResendInvitation = async (invitationId: string) => {
    try {
      const newExpiry = new Date();
      newExpiry.setHours(newExpiry.getHours() + 48);

      const { data: currentInvite } = await supabase
        .from('invitations')
        .select('resend_count')
        .eq('id', invitationId)
        .single();

      const { error } = await supabase
        .from('invitations')
        .update({
          expires_at: newExpiry.toISOString(),
          status: 'pending',
          resend_count: (currentInvite?.resend_count || 0) + 1,
          last_resent_at: new Date().toISOString(),
        })
        .eq('id', invitationId);

      if (error) throw error;

      await supabase.from('audit_log').insert({
        actor_user_id: userProfile?.id,
        action_type: 'invite_resent',
        metadata: { invitation_id: invitationId },
      });

      loadData();
    } catch (error) {
      console.error('Error resending invitation:', error);
      alert('Failed to resend invitation');
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('invitations')
        .update({
          status: 'cancelled',
        })
        .eq('id', invitationId);

      if (error) throw error;

      await supabase.from('audit_log').insert({
        actor_user_id: userProfile?.id,
        action_type: 'invite_cancelled',
        metadata: { invitation_id: invitationId },
      });

      loadData();
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      alert('Failed to cancel invitation');
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();

    if (diff <= 0) return 'Expired';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h remaining`;
    }
    return `${hours}h ${minutes}m remaining`;
  };

  const getStatusBadge = (invitation: Invitation) => {
    const isExpired = new Date(invitation.expires_at) < new Date();
    const status = isExpired && invitation.status === 'pending' ? 'expired' : invitation.status;

    const badges = {
      pending: <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
        <Clock className="w-3 h-3" />
        Pending
      </span>,
      accepted: <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
        <Check className="w-3 h-3" />
        Accepted
      </span>,
      expired: <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
        <X className="w-3 h-3" />
        Expired
      </span>,
      cancelled: <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">
        <X className="w-3 h-3" />
        Cancelled
      </span>,
    };

    return badges[status];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading invitations...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Capacity Banner */}
      {capacity && (
        <div className={`mb-6 p-4 rounded-lg border ${
          !capacity.can_invite
            ? 'bg-red-50 border-red-200'
            : capacity.remaining_slots && capacity.remaining_slots <= 2
            ? 'bg-yellow-50 border-yellow-200'
            : 'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">
                Organization Capacity: {capacity.current_users}
                {capacity.max_users ? ` / ${capacity.max_users}` : ' / ∞'} users
              </p>
              {capacity.remaining_slots !== null && (
                <p className="text-sm text-gray-600 mt-1">
                  {capacity.remaining_slots} slot{capacity.remaining_slots !== 1 ? 's' : ''} remaining
                </p>
              )}
            </div>
            {capacity.can_invite && (
              <button
                onClick={() => setShowInviteForm(true)}
                data-testid="admin-invite-user-button"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Invite User
              </button>
            )}
          </div>
          {!capacity.can_invite && (
            <p className="text-sm text-red-800 mt-2">
              You've reached your organization's user limit. Contact support to upgrade.
            </p>
          )}
        </div>
      )}

      {/* Invite Form */}
      {showInviteForm && (
        <div data-testid="admin-invitation-form" className="mb-6 bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Send Invitation</h3>
            <button
              onClick={() => {
                setShowInviteForm(false);
                setError(null);
              }}
              data-testid="admin-invitation-close"
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSendInvitation} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                data-testid="admin-invitation-email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="user@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role *
              </label>
              <select
                value={formData.role_id}
                data-testid="admin-invitation-role"
                onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select a role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.role_name}
                  </option>
                ))}
              </select>
            </div>


            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowInviteForm(false);
                  setError(null);
                }}
                data-testid="admin-invitation-cancel"
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                data-testid="admin-invitation-submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Invitations List */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Invitations</h3>
        </div>

        {invitations.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No invitations sent yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="p-5 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-medium text-gray-900">{invitation.email}</span>
                      {getStatusBadge(invitation)}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Role: <span className="font-medium">{invitation.role?.role_name}</span></p>
                      <p>
                        Invited by {invitation.inviter?.full_name || 'Unknown'} on{' '}
                        {new Date(invitation.created_at).toLocaleDateString()}
                      </p>
                      {invitation.status === 'pending' && (
                        <p className={`font-medium ${new Date(invitation.expires_at) < new Date() ? 'text-red-600' : 'text-blue-600'}`}>
                          {getTimeRemaining(invitation.expires_at)}
                        </p>
                      )}
                      {invitation.status !== 'pending' && (
                        <p>
                          Expires: {new Date(invitation.expires_at).toLocaleDateString()}
                        </p>
                      )}
                      {invitation.resend_count && invitation.resend_count > 0 && (
                        <p className="text-xs text-gray-500">
                          Resent {invitation.resend_count} time{invitation.resend_count > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {invitation.status === 'pending' && new Date(invitation.expires_at) > new Date() && (
                      <>
                        <button
                          onClick={() => handleCopyInviteLink(invitation.id)}
                          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                          title="Copy invitation link"
                        >
                          {copiedId === invitation.id ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-600" />
                          )}
                        </button>
                        <button
                          onClick={() => handleResendInvitation(invitation.id)}
                          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                          title="Resend invitation"
                        >
                          <RefreshCw className="w-4 h-4 text-gray-600" />
                        </button>
                      </>
                    )}
                    {invitation.status === 'pending' && (
                      <button
                        onClick={() => handleCancelInvitation(invitation.id)}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                        title="Cancel invitation"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
