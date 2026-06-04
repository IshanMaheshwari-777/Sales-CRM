import { useState, useEffect } from 'react';
import { X, CreditCard as Edit, Calendar, Clock, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { logStatusChange, logFollowupCreated } from '../../services/activityLogger';
import type { Database } from '../../lib/database.types';
import type { BulkLeadFilterContext } from './bulkFilterContext';

type LeadStatus = Database['public']['Tables']['lead_statuses']['Row'];

interface ChangeStageModalProps {
  leadIds: string[];
  filterContext?: BulkLeadFilterContext;
  onClose: () => void;
  onSuccess: () => void;
}

export function ChangeStageModal({ leadIds, filterContext, onClose, onSuccess }: ChangeStageModalProps) {
  const { user } = useAuth();
  const [mainStatuses, setMainStatuses] = useState<LeadStatus[]>([]);
  const [subStatuses, setSubStatuses] = useState<LeadStatus[]>([]);
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [selectedSubStage, setSelectedSubStage] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Follow-up fields
  const [nextActionDate, setNextActionDate] = useState<string>('');
  const [nextActionTime, setNextActionTime] = useState<string>('');
  const [followupRemarks, setFollowupRemarks] = useState<string>('');

  useEffect(() => {
    loadMainStatuses();
  }, []);

  useEffect(() => {
    if (selectedStage) {
      loadSubStatuses(selectedStage);
    } else {
      setSubStatuses([]);
      setSelectedSubStage('');
    }
  }, [selectedStage]);

  const loadMainStatuses = async () => {
    const { data } = await supabase
      .from('lead_statuses')
      .select('*')
      .eq('is_active', true)
      .eq('status_type', 'main')
      .order('order_index');

    if (data) {
      setMainStatuses(data);
    }
  };

  const loadSubStatuses = async (parentId: string) => {
    const { data } = await supabase
      .from('lead_statuses')
      .select('*')
      .eq('is_active', true)
      .eq('status_type', 'sub')
      .eq('parent_status_id', parentId)
      .order('order_index');

    if (data) {
      setSubStatuses(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStage) {
      alert('Please select a stage');
      return;
    }

    // Validate follow-up fields if any are filled
    const hasFollowupData = nextActionDate || nextActionTime || followupRemarks;
    if (hasFollowupData && (!nextActionDate || !nextActionTime)) {
      alert('Please provide both date and time for follow-up');
      return;
    }

    setLoading(true);

    try {
      const { data: currentUserProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user?.id || '')
        .single();

      const rpcArgs = {
        p_status_id: selectedStage,
        p_sub_status_id: selectedSubStage || null,
        p_user_id: user?.id || null,
        p_user_name: currentUserProfile?.full_name || 'Unknown User'
      };

      const { data: rpcResult, error: rpcError } = leadIds.length > 0
        ? await supabase.rpc('bulk_change_lead_status', {
            p_lead_ids: leadIds,
            ...rpcArgs,
          })
        : await supabase.rpc('bulk_change_filtered_lead_status', {
            p_organization_id: filterContext?.organizationId,
            p_search: filterContext?.searchQuery || null,
            p_active_status_id: filterContext?.activeStatusId || null,
            p_filters: filterContext?.appliedFilters || {},
            ...rpcArgs,
          });

      if (rpcError) throw rpcError;

      if (!rpcResult?.success) {
        throw new Error(rpcResult?.error || 'Failed to update leads');
      }

      // Create follow-up if data is provided and only one lead is selected
      if (leadIds.length === 1 && nextActionDate && nextActionTime && user?.id) {
        try {
          const followupDateTime = `${nextActionDate}T${nextActionTime}:00`;

          const { error: followupError } = await supabase
            .from('followups')
            .insert({
              lead_id: leadIds[0],
              user_id: user.id,
              next_action_date: followupDateTime,
              next_action_time: nextActionTime,
              followup_remarks: followupRemarks || '',
              status: 'planned',
            });

          if (followupError) {
            console.error('Failed to create follow-up:', followupError);
            throw followupError;
          }

          await logFollowupCreated(
            leadIds[0],
            user.id,
            currentUserProfile?.full_name || 'Unknown User',
            followupDateTime,
            followupRemarks || undefined
          );
        } catch (followupErr) {
          console.error('Follow-up creation error:', followupErr);
          alert('Stage updated successfully, but failed to create follow-up. Please add it manually.');
        }
      }

      onSuccess();
    } catch (err) {
      console.error('Failed to update leads:', err);
      alert('Failed to update leads. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-end z-50">
      <div className="bg-white h-full w-full max-w-xs shadow-xl flex flex-col animate-slide-in-right">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <Edit className="w-6 h-6 text-slate-700" />
            <h2 className="text-xl font-semibold text-slate-800">Change Stage</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-6 h-6 text-slate-600" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Category
              </label>
              <div className="relative">
                <input
                  type="text"
                  value="Lead"
                  disabled
                  className="w-full px-4 py-3 bg-slate-100 border border-slate-300 rounded-lg text-slate-600 cursor-not-allowed"
                />
                <X className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Stage<span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-100 border border-slate-300 rounded-lg text-slate-600 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                >
                  <option value="">Select Stage</option>
                  {mainStatuses.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.display_name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Sub-Stage<span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedSubStage}
                  onChange={(e) => setSelectedSubStage(e.target.value)}
                  disabled={!selectedStage || subStatuses.length === 0}
                  className="w-full px-4 py-3 bg-slate-100 border border-slate-300 rounded-lg text-slate-600 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">Select Sub-Stage</option>
                  {subStatuses.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.display_name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Follow-up Section */}
            {leadIds.length === 1 ? (
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Next Action Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="date"
                        value={nextActionDate}
                        onChange={(e) => setNextActionDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-100 border border-slate-300 rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Time
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="time"
                        value={nextActionTime}
                        onChange={(e) => setNextActionTime(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-100 border border-slate-300 rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Followup Remarks
                  </label>
                  <textarea
                    value={followupRemarks}
                    onChange={(e) => setFollowupRemarks(e.target.value)}
                    placeholder="Call the lead tomorrow morning"
                    rows={4}
                    className="w-full px-4 py-3 bg-slate-100 border border-slate-300 rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>
            ) : (
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800">
                    Follow-up scheduling is only available when updating a single lead
                  </p>
                </div>
              </div>
            )}
          </form>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 border border-orange-500 text-orange-500 rounded-lg font-medium hover:bg-orange-50 transition"
          >
            Close
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedStage}
            className="px-6 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Updating Stage...' : 'Update Stage'}
          </button>
        </div>
      </div>
    </div>
  );
}
