import { useState, useEffect } from 'react';
import { X, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { BulkLeadFilterContext } from './bulkFilterContext';

interface ReferLeadsModalProps {
  leadIds: string[];
  filterContext?: BulkLeadFilterContext;
  onClose: () => void;
  onSuccess: () => void;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

export function ReferLeadsModal({ leadIds, filterContext, onClose, onSuccess }: ReferLeadsModalProps) {
  const { user, profile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUsers();
  }, [profile?.organization_id]);

  const loadUsers = async () => {
    if (!profile?.organization_id) {
      setUsers([]);
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('organization_id', profile.organization_id)
      .order('full_name');

    if (data) {
      setUsers(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUserId) {
      setError('Please select a user to refer the leads to');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: currentUserProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user?.id || '')
        .maybeSingle();

      const { data: newOwnerProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', selectedUserId)
        .maybeSingle();

      const rpcArgs = {
        p_new_owner_id: selectedUserId,
        p_new_owner_name: newOwnerProfile?.full_name || 'Unknown',
        p_assigned_by_id: user?.id || null,
        p_assigned_by_name: currentUserProfile?.full_name || 'Unknown User'
      };

      const { data: result, error: rpcError } = leadIds.length > 0
        ? await supabase.rpc('bulk_assign_leads', {
            p_lead_ids: leadIds,
            ...rpcArgs,
          })
        : await supabase.rpc('bulk_assign_filtered_leads', {
            p_organization_id: filterContext?.organizationId,
            p_search: filterContext?.searchQuery || null,
            p_active_status_id: filterContext?.activeStatusId || null,
            p_filters: filterContext?.appliedFilters || {},
            ...rpcArgs,
            p_note: remarks || null,
          });

      if (rpcError) {
        console.error('RPC Error:', rpcError);
        throw rpcError;
      }

      console.log('Bulk assign result:', result);

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to assign leads');
      }

      // Show warning if no ownership changes occurred
      if (result.leads_with_ownership_change === 0) {
        console.warn('No ownership changes - leads may already be assigned to this user');
      }

      // Add remarks as notes if provided for explicit lead selections
      if (remarks && leadIds.length > 0) {
        const notePromises = leadIds.map(leadId =>
          supabase
            .from('notes')
            .insert({
              lead_id: leadId,
              note: `Lead referred: ${remarks}`,
              created_at: new Date().toISOString()
            })
        );

        await Promise.all(notePromises);
      }

      onSuccess();
    } catch (err) {
      setError('Failed to refer leads. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-end z-50">
      <div className="bg-white h-full w-full max-w-xs shadow-2xl flex flex-col animate-slide-in-right">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-slate-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Refer Leads/Application</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200 rounded transition"
          >
            <X className="w-6 h-6 text-slate-600" />
          </button>
        </div>

        <div className="h-1 bg-gradient-to-r from-orange-500 to-orange-400"></div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto px-6 py-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="mb-4 p-3 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600">
                Referring <span className="font-semibold text-slate-900">{leadIds.length > 0 ? leadIds.length : filterContext?.totalCount || 0}</span> lead{(leadIds.length > 0 ? leadIds.length : filterContext?.totalCount || 0) !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Refer To<span className="text-red-500">*</span>
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-700"
                required
              >
                <option value="">Select Referred To</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} ({user.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Referral Remarks
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Comment"
                rows={8}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-700 resize-none"
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 border border-orange-500 text-orange-500 rounded-lg font-medium hover:bg-orange-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedUserId}
              className="px-6 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Referring...' : 'Refer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
