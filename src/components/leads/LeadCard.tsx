// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { Phone, Mail, MoreVertical, ChevronDown, ChevronUp, MessageCircle, Clock, RefreshCw, CreditCard as Edit, UserPlus, Trash2, Flag, ScrollText } from 'lucide-react';
import type { Database } from '../../lib/database.types';
import { CallLogModal } from './CallLogModal';
import { EmailInteractionModal } from './EmailInteractionModal';
import { WhatsAppInteractionModal } from './WhatsAppInteractionModal';
import { LeadInteractionTimeline } from './LeadInteractionTimeline';
import { ReferLeadsModal } from './ReferLeadsModal';
import { ConfirmationDialog } from './ConfirmationDialog';
import { AddFollowUpModal } from './AddFollowUpModal';
import { LeadActivityModal } from './LeadActivityModal';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useToast } from '../../contexts/ToastContext';
import { isValidEmail, isValidPhoneNumber } from '../../lib/communicationUtils';
import { fetchTemplateData } from '../../lib/templateVariables';

type LeadStatus = Database['public']['Tables']['lead_statuses']['Row'];
type Lead = Database['public']['Tables']['leads']['Row'] & {
  lead_statuses: LeadStatus | null;
  sub_status: LeadStatus | null;
  profiles: { full_name: string } | null;
  previous_owner_profile?: { full_name: string } | null;
  lead_sources: { name: string; color: string } | null;
};

interface LeadCardProps {
  lead: Lead;
  onUpdate: () => void;
  isSelected?: boolean;
  onSelectChange?: (leadId: string, selected: boolean) => void;
  onEdit?: (leadId: string) => void;
}

interface InteractionCounts {
  calls: number;
  emails: number;
  whatsapp: number;
}

export function LeadCard({ lead, onUpdate, isSelected = false, onSelectChange, onEdit }: LeadCardProps) {
  const { hasPermission } = usePermissions();
  const { showError, showSuccess } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'personal' | 'followup'>('personal');
  const [showCallLog, setShowCallLog] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [interactionCounts, setInteractionCounts] = useState<InteractionCounts>({ calls: 0, emails: 0, whatsapp: 0 });
  const [notesCounts, setNotesCounts] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showReferModal, setShowReferModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddFollowUpModal, setShowAddFollowUpModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [leadData, setLeadData] = useState<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const canCall = hasPermission('communications.make_call');
  const canEmail = hasPermission('communications.send_email');
  const canWhatsApp = hasPermission('communications.send_whatsapp');

  const hasPhone = isValidPhoneNumber(lead.mobile_number || '');
  const hasEmail = isValidEmail(lead.email || '');

  useEffect(() => {
    loadInteractionCounts();
    loadLeadData();
  }, [lead.id]);

  const loadLeadData = async () => {
    const data = await fetchTemplateData(lead.id, lead.assigned_to || '');
    if (data) {
      setLeadData(data);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const loadInteractionCounts = async () => {
    const [interactionsRes, notesRes] = await Promise.all([
      supabase
        .from('lead_interactions')
        .select('interaction_type')
        .eq('lead_id', lead.id),
      supabase
        .from('notes')
        .select('id', { count: 'exact', head: true })
        .eq('lead_id', lead.id)
    ]);

    if (interactionsRes.data) {
      const counts = {
        calls: lead.call_count || 0,
        emails: interactionsRes.data.filter(i => i.interaction_type === 'email').length,
        whatsapp: interactionsRes.data.filter(i => i.interaction_type === 'whatsapp').length,
      };
      setInteractionCounts(counts);
    }

    if (notesRes.count !== null) {
      setNotesCounts(notesRes.count);
    }
  };

  const calculateLeadAge = () => {
    const created = new Date(lead.created_at);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getLeadAgeColor = () => {
    const age = calculateLeadAge();
    if (age <= 7) return 'bg-green-100 text-green-700';
    if (age <= 30) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  const handleDeleteLead = async () => {
    setShowDeleteConfirm(false);
    setShowDropdown(false);

    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', lead.id);

      if (error) throw error;

      showSuccess('Lead deleted successfully');
      onUpdate();
    } catch (err) {
      console.error('Failed to delete lead:', err);
      showError('Failed to delete lead. Please try again.');
    }
  };

  return (
    <>
      <div className="border-b border-slate-200 hover:bg-slate-50 transition">
        <div className="px-6 py-4 flex items-center gap-4">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelectChange?.(lead.id, e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-slate-800 text-base">
                {lead.first_name || lead.last_name
                  ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
                  : lead.name}
              </h3>
              {lead.is_re_enquired && (
                <span className="text-xs px-2 py-0.5 rounded bg-slate-900 text-white font-medium">
                  Re-enquired
                </span>
              )}
            </div>
            <div className="text-sm text-slate-600">
              {lead.mobile_number}
            </div>
          </div>

          <div className="px-4 py-2 rounded text-sm font-medium bg-slate-800 text-white whitespace-nowrap">
            {lead.profiles?.full_name || 'Unassigned'}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowCallLog(true)}
                disabled={!canCall || !hasPhone}
                className={`p-2 rounded-lg transition ${
                  !canCall || !hasPhone
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-orange-50'
                }`}
                title={
                  !canCall
                    ? 'No permission to make calls'
                    : !hasPhone
                    ? 'Phone number not available'
                    : 'Make Call'
                }
              >
                <Phone className="w-5 h-5 text-orange-500" />
              </button>
              <button
                onClick={() => setShowWhatsAppModal(true)}
                disabled={!canWhatsApp || !hasPhone}
                className={`p-2 rounded-lg transition ${
                  !canWhatsApp || !hasPhone
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-green-50'
                }`}
                title={
                  !canWhatsApp
                    ? 'No permission to send WhatsApp messages'
                    : !hasPhone
                    ? 'Phone number not available'
                    : 'Send WhatsApp Message'
                }
              >
                <MessageCircle className="w-5 h-5 text-green-600" />
              </button>
              <button
                onClick={() => setShowEmailModal(true)}
                disabled={!canEmail || !hasEmail}
                className={`p-2 rounded-lg transition ${
                  !canEmail || !hasEmail
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-blue-50'
                }`}
                title={
                  !canEmail
                    ? 'No permission to send emails'
                    : !hasEmail
                    ? 'Email not available'
                    : 'Send Email'
                }
              >
                <Mail className="w-5 h-5 text-blue-600" />
              </button>
              <button
                onClick={() => setShowActivityModal(true)}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
                title="Activity History"
              >
                <ScrollText className="w-5 h-5 text-slate-600" />
              </button>
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition"
                  title="More"
                >
                  <MoreVertical className="w-5 h-5 text-slate-600" />
                </button>

                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-50">
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        onEdit?.(lead.id);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-50 transition flex items-center gap-3"
                    >
                      <Edit className="w-5 h-5 text-slate-600" />
                      <span className="text-slate-800 font-medium">Edit Lead</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        setShowReferModal(true);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-50 transition flex items-center gap-3"
                    >
                      <UserPlus className="w-5 h-5 text-slate-600" />
                      <span className="text-slate-800 font-medium">Refer Lead</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        setShowDeleteConfirm(true);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-50 transition flex items-center gap-3"
                    >
                      <Trash2 className="w-5 h-5 text-slate-600" />
                      <span className="text-slate-800 font-medium">Delete</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        setShowAddFollowUpModal(true);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-50 transition flex items-center gap-3"
                    >
                      <Flag className="w-5 h-5 text-slate-600" />
                      <span className="text-slate-800 font-medium">Add Follow Up</span>
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                {expanded ? (
                  <ChevronUp className="w-5 h-5 text-slate-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-600" />
                )}
              </button>
            </div>
          </div>
        </div>

        {expanded && (
          <div className="bg-white">
            <div className="border-b border-slate-200 px-6 pt-4">
              <div className="flex gap-6">
                <button
                  onClick={() => setActiveTab('personal')}
                  className={`pb-3 px-1 text-sm font-medium transition border-b-2 ${
                    activeTab === 'personal'
                      ? 'border-orange-500 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Personal Details
                </button>
                <button
                  onClick={() => setActiveTab('followup')}
                  className={`pb-3 px-1 text-sm font-medium transition border-b-2 ${
                    activeTab === 'followup'
                      ? 'border-orange-500 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Followup Details
                </button>
              </div>
            </div>

            {activeTab === 'personal' && (
              <div className="px-6 py-6">
                <div className="grid grid-cols-4 gap-x-8 gap-y-6">
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase mb-1">UNIVERSITY</div>
                    <div className="text-sm text-slate-900">{lead.company || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase mb-1">COURSE</div>
                    <div className="text-sm text-slate-900">{lead.course || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase mb-1">SPECIALIZATION</div>
                    <div className="text-sm text-slate-900">-</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase mb-1">CHANNEL</div>
                    <div className="text-sm text-slate-900 underline">{lead.channel || '-'}</div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase mb-1">SOURCE</div>
                    <div className="text-sm text-slate-900 underline">{lead.lead_sources?.name || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase mb-1">MEDIUM</div>
                    <div className="text-sm text-slate-900">-</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase mb-1">CAMPAIGN NAME</div>
                    <div className="text-sm text-slate-900 underline">{lead.campaign_name || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase mb-1">COUNTRY</div>
                    <div className="text-sm text-slate-900">{lead.country || '-'}</div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase mb-1">STATE</div>
                    <div className="text-sm text-slate-900">-</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase mb-1">CITY</div>
                    <div className="text-sm text-slate-900">{lead.city || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase mb-1">LEAD ADDED ON</div>
                    <div className="text-sm text-slate-900">
                      {new Date(lead.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase mb-1">LAST UPDATED ON</div>
                    <div className="text-sm text-slate-900">
                      {new Date(lead.updated_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase mb-1">PREVIOUS LEAD OWNER</div>
                    <div className="text-sm text-slate-900">{lead.previous_owner_profile?.full_name || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase mb-1">CURRENT LEAD OWNER</div>
                    <div className="text-sm text-slate-900">{lead.profiles?.full_name || 'Unassigned'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase mb-1">LEAD AGE</div>
                    <div className="text-sm text-slate-900">{calculateLeadAge()} Days</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase mb-1">STATUS</div>
                    <div className="text-sm text-slate-900">
                      {lead.lead_statuses?.display_name || '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500 uppercase mb-1">SUB-STATUS</div>
                    <div className="text-sm text-slate-900">
                      {lead.sub_status?.display_name || '-'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'followup' && (
              <div className="px-6 py-6">
                <LeadInteractionTimeline leadId={lead.id} />
              </div>
            )}
          </div>
        )}
      </div>

      {showCallLog && (
        <CallLogModal
          leadId={lead.id}
          leadName={lead.first_name || lead.last_name ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() : lead.name}
          leadPhone={lead.mobile_number || undefined}
          autoOpen={true}
          onClose={() => setShowCallLog(false)}
          onSuccess={() => {
            setShowCallLog(false);
            onUpdate();
            loadInteractionCounts();
          }}
        />
      )}

      {showEmailModal && leadData && (
        <EmailInteractionModal
          leadId={lead.id}
          leadName={lead.first_name || lead.last_name ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() : lead.name}
          leadEmail={lead.email || ''}
          leadData={leadData}
          onClose={() => setShowEmailModal(false)}
          onSuccess={() => {
            setShowEmailModal(false);
            onUpdate();
            loadInteractionCounts();
          }}
        />
      )}

      {showWhatsAppModal && leadData && (
        <WhatsAppInteractionModal
          leadId={lead.id}
          leadName={lead.first_name || lead.last_name ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() : lead.name}
          leadPhone={lead.mobile_number || ''}
          leadData={leadData}
          onClose={() => setShowWhatsAppModal(false)}
          onSuccess={() => {
            setShowWhatsAppModal(false);
            onUpdate();
            loadInteractionCounts();
          }}
        />
      )}

      {showReferModal && (
        <ReferLeadsModal
          leadIds={[lead.id]}
          onClose={() => setShowReferModal(false)}
          onSuccess={() => {
            setShowReferModal(false);
            onUpdate();
          }}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmationDialog
          title="Delete Lead"
          message={`Are you sure you want to delete this lead: ${lead.first_name || lead.last_name ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() : lead.name}? This action cannot be undone.`}
          confirmText="Delete"
          onConfirm={handleDeleteLead}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {showAddFollowUpModal && (
        <AddFollowUpModal
          leadId={lead.id}
          leadName={lead.first_name || lead.last_name ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() : lead.name}
          onClose={() => setShowAddFollowUpModal(false)}
          onSuccess={() => {
            setShowAddFollowUpModal(false);
            onUpdate();
          }}
        />
      )}

      {showActivityModal && (
        <LeadActivityModal
          leadId={lead.id}
          leadName={lead.first_name || lead.last_name ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() : lead.name}
          onClose={() => setShowActivityModal(false)}
        />
      )}
    </>
  );
}
