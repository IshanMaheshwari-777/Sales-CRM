import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Database } from '../../lib/database.types';
import { logLeadCreated } from '../../services/activityLogger';

type LeadSource = Database['public']['Tables']['lead_sources']['Row'];
type LeadStatus = Database['public']['Tables']['lead_statuses']['Row'];

interface AddLeadModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type TabType = 'lead_details' | 'source_details';

const CHANNELS = ['Offline', 'Online', 'Digital Marketing', 'Publishers', 'Referrals', 'Walk-in', 'Direct', 'Partner'];

export function AddLeadModal({ onClose, onSuccess }: AddLeadModalProps) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('lead_details');
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [mainStatuses, setMainStatuses] = useState<LeadStatus[]>([]);
  const [subStatuses, setSubStatuses] = useState<LeadStatus[]>([]);
  const [mobileError, setMobileError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<{show: boolean, leadId?: string, leadName?: string}>({show: false});

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    mobile_number: '',
    university: '',
    course: '',
    specialization: '',
    status_id: '',
    sub_status_id: '',
    channel: '',
    source_id: '',
    campaign_name: '',
    campaign_id: '',
    adgroup_id: '',
    keyword: '',
  });

  useEffect(() => {
    loadOptions();
  }, []);

  const loadOptions = async () => {
    const [sourcesRes, statusesRes] = await Promise.all([
      supabase.from('lead_sources').select('*').eq('is_active', true),
      supabase.from('lead_statuses').select('*').eq('is_active', true).order('order_index'),
    ]);

    if (sourcesRes.data) setSources(sourcesRes.data);
    if (statusesRes.data) {
      const mains = statusesRes.data.filter(s => s.status_type === 'main');
      setMainStatuses(mains);
      if (mains[0]) {
        setFormData(prev => ({ ...prev, status_id: mains[0].id }));
        updateSubStatuses(mains[0].id, statusesRes.data);
      }
    }
  };

  const updateSubStatuses = (statusId: string, allStatuses: LeadStatus[]) => {
    const subs = allStatuses.filter(s => s.parent_status_id === statusId);
    setSubStatuses(subs);
    if (subs.length > 0) {
      setFormData(prev => ({ ...prev, sub_status_id: subs[0].id }));
    } else {
      setFormData(prev => ({ ...prev, sub_status_id: '' }));
    }
  };

  const handleStatusChange = (statusId: string) => {
    setFormData({ ...formData, status_id: statusId, sub_status_id: '' });
    const allStatuses = [...mainStatuses, ...subStatuses];
    updateSubStatuses(statusId, allStatuses);
  };

  const validateMobileNumber = (mobile: string): boolean => {
    const pattern = /^\+91[0-9]{10}$/;
    return pattern.test(mobile);
  };

  const handleMobileBlur = async () => {
    const mobile = formData.mobile_number.trim();

    if (!mobile) {
      setMobileError('');
      return;
    }

    if (!validateMobileNumber(mobile)) {
      setMobileError('Mobile number must be +91 followed by 10 digits');
      return;
    }

    setMobileError('');

    if (!profile?.organization_id) return;

    const { data } = await supabase
      .from('leads')
      .select('id, name, first_name, last_name')
      .eq('mobile_number', mobile)
      .eq('organization_id', profile.organization_id)
      .maybeSingle();

    if (data) {
      const displayName = data.first_name ? `${data.first_name} ${data.last_name || ''}`.trim() : data.name;
      setDuplicateWarning({
        show: true,
        leadId: data.id,
        leadName: displayName
      });
    }
  };

  const handleMergeWithExisting = async () => {
    if (!duplicateWarning.leadId) return;

    setLoading(true);

    const { error } = await supabase.rpc('merge_lead_data', {
      existing_lead_id: duplicateWarning.leadId,
      new_name: `${formData.first_name} ${formData.last_name}`.trim() || null,
      new_email: formData.email || null,
      new_company: formData.university || null,
      new_channel: formData.channel || null,
      new_source_id: formData.source_id || null,
      new_campaign_name: formData.campaign_name || null,
      new_city: null,
      new_country: null,
      new_lead_value: null,
      user_id: user?.id || null
    });

    setLoading(false);

    if (error) {
      alert('Error merging lead data: ' + error.message);
    } else {
      alert('Lead data merged successfully! Lead moved to Re-enquired status.');
      onSuccess();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mobileError) {
      alert('Please fix mobile number format');
      return;
    }

    if (!formData.mobile_number) {
      alert('Mobile number is required');
      return;
    }

    if (duplicateWarning.show) {
      return;
    }

    setLoading(true);

    const fullName = `${formData.first_name} ${formData.last_name}`.trim();

    const { data: newLead, error } = await supabase.from('leads').insert({
      name: fullName,
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.email || null,
      mobile_number: formData.mobile_number,
      university: formData.university || null,
      course: formData.course || null,
      specialization: formData.specialization || null,
      company: formData.university || null,
      source_id: formData.source_id || null,
      status_id: formData.status_id || null,
      sub_status_id: formData.sub_status_id || null,
      assigned_to: user?.id || null,
      current_lead_owner: user?.id || null,
      previous_lead_owner: user?.id || null,
      created_by: user?.id || null,
      channel: formData.channel || null,
      campaign_name: formData.campaign_name || null,
      campaign_id: formData.campaign_id || null,
      adgroup_id: formData.adgroup_id || null,
      keyword: formData.keyword || null,
      original_enquiry_date: new Date().toISOString(),
      organization_id: profile?.organization_id || null,
    }).select().single();

    setLoading(false);

    if (error) {
      alert('Error creating lead: ' + error.message);
    } else {
      if (newLead && user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        await logLeadCreated(newLead.id, user.id, profile?.full_name || 'Unknown User');
      }
      onSuccess();
    }
  };

  const renderTabButton = (tab: TabType, label: string) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      data-testid={`add-lead-tab-${tab}`}
      className={`px-6 py-3 text-sm font-medium transition border-b-2 ${
        activeTab === tab
          ? 'border-orange-500 text-slate-900 bg-orange-50'
          : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div data-testid="add-lead-modal" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800">Add New Lead</h2>
          <button
            onClick={onClose}
            data-testid="add-lead-close"
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="border-b border-slate-200 flex">
          {renderTabButton('lead_details', 'Lead/Applicant & Stage Details')}
          {renderTabButton('source_details', 'Source Details')}
        </div>

        {duplicateWarning.show && (
          <div className="p-6 bg-amber-50 border-b border-amber-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 mb-1">Duplicate Mobile Number Detected</h3>
                <p className="text-sm text-amber-800 mb-3">
                  This mobile number already exists for lead: <strong>{duplicateWarning.leadName}</strong>
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleMergeWithExisting}
                    disabled={loading}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition disabled:opacity-50"
                  >
                    {loading ? 'Merging...' : 'Merge with Existing Lead'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDuplicateWarning({show: false});
                      setFormData({...formData, mobile_number: ''});
                    }}
                    className="px-4 py-2 border border-amber-600 text-amber-600 rounded-lg font-medium hover:bg-amber-50 transition"
                  >
                    Change Mobile Number
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-auto">
          {activeTab === 'lead_details' && (
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Lead Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      data-testid="add-lead-first-name"
                      type="text"
                      required
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                      placeholder="First Name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      data-testid="add-lead-last-name"
                      type="text"
                      required
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                      placeholder="Last Name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Email ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      data-testid="add-lead-email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                      placeholder="Email ID"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Mobile No. <span className="text-red-500">*</span>
                    </label>
                    <input
                      data-testid="add-lead-mobile"
                      type="tel"
                      required
                      value={formData.mobile_number}
                      onChange={(e) => {
                        setFormData({ ...formData, mobile_number: e.target.value });
                        setMobileError('');
                        setDuplicateWarning({show: false});
                      }}
                      onBlur={handleMobileBlur}
                      className={`w-full px-4 py-2 border ${mobileError ? 'border-red-500' : 'border-slate-300'} rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none`}
                      placeholder="Mobile No."
                    />
                    {mobileError && (
                      <p className="text-red-500 text-xs mt-1">{mobileError}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      University
                    </label>
                    <input
                      type="text"
                      value={formData.university}
                      onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                      placeholder="University"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Course
                    </label>
                    <input
                      type="text"
                      value={formData.course}
                      onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                      placeholder="Select Course"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Specialization
                    </label>
                    <input
                      type="text"
                      value={formData.specialization}
                      onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                      placeholder="Select Specialization"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Change Lead /Application Stage</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Stage <span className="text-red-500">*</span>
                    </label>
                    <select
                      data-testid="add-lead-status"
                      required
                      value={formData.status_id}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    >
                      {mainStatuses.map((status) => (
                        <option key={status.id} value={status.id}>
                          {status.display_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {subStatuses.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Sub-Stage <span className="text-red-500">*</span>
                      </label>
                      <select
                        data-testid="add-lead-sub-status"
                        required
                        value={formData.sub_status_id}
                        onChange={(e) => setFormData({ ...formData, sub_status_id: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                      >
                        {subStatuses.map((status) => (
                          <option key={status.id} value={status.id}>
                            {status.display_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'source_details' && (
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Channel <span className="text-red-500">*</span>
                  </label>
                  <select
                    data-testid="add-lead-channel"
                    required
                    value={formData.channel}
                    onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  >
                    <option value="">Select Channel</option>
                    {CHANNELS.map((channel) => (
                      <option key={channel} value={channel}>
                        {channel}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Source <span className="text-red-500">*</span>
                  </label>
                  <select
                    data-testid="add-lead-source"
                    required
                    value={formData.source_id}
                    onChange={(e) => setFormData({ ...formData, source_id: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  >
                    <option value="">Select Source</option>
                    {sources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Campaign Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    data-testid="add-lead-campaign-name"
                    type="text"
                    required
                    value={formData.campaign_name}
                    onChange={(e) => setFormData({ ...formData, campaign_name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder="Campaign Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Campaign Id
                  </label>
                  <input
                    type="text"
                    value={formData.campaign_id}
                    onChange={(e) => setFormData({ ...formData, campaign_id: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder="Select Campaign Id"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Adgroup Id
                  </label>
                  <input
                    type="text"
                    value={formData.adgroup_id}
                    onChange={(e) => setFormData({ ...formData, adgroup_id: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder="Select Adgroup Id"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Keyword
                  </label>
                  <input
                    type="text"
                    value={formData.keyword}
                    onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder="Select Keyword"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={onClose}
              data-testid="add-lead-cancel"
              className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              data-testid="add-lead-submit"
              className="flex-1 px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
