import { useState, useEffect } from 'react';
import { X, UserPlus, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Database } from '../../lib/database.types';
import type { BulkLeadFilterContext } from './bulkFilterContext';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface BulkAssignModalProps {
  leadIds: string[];
  filterContext?: BulkLeadFilterContext;
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkAssignModal({ leadIds, filterContext, onClose, onSuccess }: BulkAssignModalProps) {
  const { user, profile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
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

  const handleAssign = async () => {
    if (!selectedUser) {
      setError('Please select a user');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get selected user details
      const { data: selectedUserData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', selectedUser)
        .single();

      const { data: currentUserData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user?.id)
        .single();

      const rpcArgs = {
        p_new_owner_id: selectedUser,
        p_new_owner_name: selectedUserData?.full_name || 'Unknown',
        p_assigned_by_id: user?.id,
        p_assigned_by_name: currentUserData?.full_name || 'Unknown User',
      };

      const { data, error: rpcError } = leadIds.length > 0
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
            p_note: null,
          });

      if (rpcError) throw rpcError;

      if (data && !data.success) {
        throw new Error(data.error || 'Failed to assign leads');
      }

      onSuccess();
    } catch (err) {
      setError('Failed to assign leads. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <UserPlus className="w-5 h-5 text-orange-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Assign Leads</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800">
              You are about to assign <strong>{leadIds.length > 0 ? leadIds.length : filterContext?.totalCount || 0}</strong> lead{(leadIds.length > 0 ? leadIds.length : filterContext?.totalCount || 0) !== 1 ? 's' : ''} to a new owner.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Assign To <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            >
              <option value="">Select User</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.email})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={loading || !selectedUser}
            className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50"
          >
            {loading ? 'Assigning...' : 'Assign Leads'}
          </button>
        </div>
      </div>
    </div>
  );
}
