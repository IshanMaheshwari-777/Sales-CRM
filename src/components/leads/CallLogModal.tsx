// @ts-nocheck
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { logCallLogged } from '../../services/activityLogger';
import { openPhoneDialer } from '../../lib/communicationUtils';

interface CallLogModalProps {
  leadId: string;
  leadName: string;
  leadPhone?: string;
  autoOpen?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CALL_OUTCOMES = [
  { value: 'connected', label: 'Connected' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'busy', label: 'Busy' },
  { value: 'wrong_number', label: 'Wrong Number' },
  { value: 'callback_requested', label: 'Callback Requested' },
];

export function CallLogModal({ leadId, leadName, leadPhone, autoOpen = false, onClose, onSuccess }: CallLogModalProps) {
  const { user } = useAuth();
  const { showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(!autoOpen);
  const [formData, setFormData] = useState({
    call_date: new Date().toISOString().slice(0, 16),
    duration_minutes: '',
    outcome: 'connected',
    notes: '',
  });

  useEffect(() => {
    if (autoOpen && leadPhone) {
      openPhoneDialer(leadPhone);
      const timer = setTimeout(() => {
        setShowModal(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [autoOpen, leadPhone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: lead } = await supabase
      .from('leads')
      .select('organization_id')
      .eq('id', leadId)
      .single();

    const { error } = await supabase.from('calls').insert({
      lead_id: leadId,
      user_id: user?.id || null,
      call_date: formData.call_date,
      duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : null,
      outcome: formData.outcome as any,
      notes: formData.notes || null,
      organization_id: lead?.organization_id || null,
    });

    setLoading(false);

    if (error) {
      showError('Error logging call: ' + error.message);
    } else {
      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        const outcomeLabel = CALL_OUTCOMES.find(o => o.value === formData.outcome)?.label || formData.outcome;
        const duration = formData.duration_minutes ? `${formData.duration_minutes} min` : undefined;

        await logCallLogged(leadId, user.id, profile?.full_name || 'Unknown User', outcomeLabel, duration, formData.notes);
      }
      onSuccess();
    }
  };

  if (!showModal) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="bg-orange-500 text-white px-6 py-4 rounded-t-xl flex items-center justify-between">
          <h2 className="text-xl font-bold">Log Call - {leadName}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-orange-600 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Call Date & Time
            </label>
            <input
              type="datetime-local"
              required
              value={formData.call_date}
              onChange={(e) => setFormData({ ...formData, call_date: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Duration (minutes)
            </label>
            <input
              type="number"
              min="0"
              value={formData.duration_minutes}
              onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              placeholder="5"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Outcome <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.outcome}
              onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            >
              {CALL_OUTCOMES.map((outcome) => (
                <option key={outcome.value} value={outcome.value}>
                  {outcome.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-none"
              placeholder="Add call notes here..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Log Call'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
