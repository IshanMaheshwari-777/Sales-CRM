// @ts-nocheck
import { useState } from 'react';
import { X, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { logFollowupCreated } from '../../services/activityLogger';

interface AddFollowUpModalProps {
  leadId: string;
  leadName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddFollowUpModal({ leadId, leadName, onClose, onSuccess }: AddFollowUpModalProps) {
  const { user } = useAuth();
  const { showError, showWarning } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    next_action_date: '',
    next_action_time: '',
    followup_remarks: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.next_action_date || !formData.next_action_time || !formData.followup_remarks) {
      showWarning('Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      const { data: lead } = await supabase
        .from('leads')
        .select('organization_id')
        .eq('id', leadId)
        .single();

      const { error } = await supabase.from('followups').insert({
        lead_id: leadId,
        user_id: user?.id,
        next_action_date: formData.next_action_date,
        next_action_time: formData.next_action_time,
        followup_remarks: formData.followup_remarks,
        status: 'planned',
        organization_id: lead?.organization_id || null,
      });

      if (error) throw error;

      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        const followupDateTime = `${formData.next_action_date}T${formData.next_action_time}`;
        await logFollowupCreated(leadId, user.id, profile?.full_name || 'Unknown User', followupDateTime, formData.followup_remarks);
      }

      onSuccess();
    } catch (err) {
      console.error('Failed to add follow-up:', err);
      showError('Failed to add follow-up. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-end z-50">
      <div className="bg-white h-full w-full max-w-xs shadow-xl flex flex-col animate-slide-in-right">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-slate-700" />
            <h2 className="text-xl font-semibold text-slate-800">Add Follow Up for {leadName}</h2>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Next Action Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={formData.next_action_date}
                    onChange={(e) => setFormData({ ...formData, next_action_date: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-100 border border-slate-300 rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Time<span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  required
                  value={formData.next_action_time}
                  onChange={(e) => setFormData({ ...formData, next_action_time: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-100 border border-slate-300 rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Followup Remarks<span className="text-red-500">*</span>
              </label>
              <textarea
                required
                value={formData.followup_remarks}
                onChange={(e) => setFormData({ ...formData, followup_remarks: e.target.value })}
                rows={10}
                className="w-full px-4 py-3 bg-slate-100 border border-slate-300 rounded-lg text-slate-600 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Enter follow-up remarks..."
              />
            </div>
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
            disabled={loading}
            className="px-6 py-2.5 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
