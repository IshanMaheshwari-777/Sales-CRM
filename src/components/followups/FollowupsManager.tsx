// @ts-nocheck
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Calendar, RefreshCw, Phone, Mail, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useToast } from '../../contexts/ToastContext';
import { isValidEmail, isValidPhoneNumber } from '../../lib/communicationUtils';
import { fetchTemplateData } from '../../lib/templateVariables';
import { CallLogModal } from '../leads/CallLogModal';
import { EmailInteractionModal } from '../leads/EmailInteractionModal';
import { WhatsAppInteractionModal } from '../leads/WhatsAppInteractionModal';
import type { Database } from '../../lib/database.types';

type Followup = Database['public']['Tables']['followups']['Row'] & {
  leads?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    name: string;
    mobile_number: string;
    lead_statuses?: {
      display_name: string;
    };
    sub_statuses?: {
      display_name: string;
    };
  };
};

type FollowupStatus = 'all' | 'done' | 'missed' | 'planned';

interface FollowupsManagerProps {
  selectedFollowupId?: string | null;
  onFollowupViewed?: () => void;
}

const ITEMS_PER_PAGE = 50;

// Helper function to format date without timezone conversion
const formatDateToString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function FollowupsManager({ selectedFollowupId, onFollowupViewed }: FollowupsManagerProps) {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { showError } = useToast();
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FollowupStatus>('all');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const followupRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [selectedFollowup, setSelectedFollowup] = useState<{
    followupId: string;
    leadId: string;
    leadName: string;
    phone?: string;
    email?: string;
    leadData: any;
    modalType: 'call' | 'email' | 'whatsapp' | null;
  } | null>(null);

  const canCall = hasPermission('communications.make_call');
  const canEmail = hasPermission('communications.send_email');
  const canWhatsApp = hasPermission('communications.send_whatsapp');

  useEffect(() => {
    loadFollowups();
  }, [user, activeTab, selectedDate, currentPage]);

  useEffect(() => {
    if (selectedFollowupId && followups.length > 0) {
      const followup = followups.find(f => f.id === selectedFollowupId);

      if (followup) {
        const followupElement = followupRefs.current[selectedFollowupId];
        if (followupElement) {
          setTimeout(() => {
            followupElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            followupElement.classList.add('ring-4', 'ring-orange-300');

            setTimeout(() => {
              followupElement.classList.remove('ring-4', 'ring-orange-300');
              if (onFollowupViewed) {
                onFollowupViewed();
              }
            }, 3000);
          }, 300);
        }
      } else {
        setActiveTab('all');
        setSelectedDate(null);
      }
    }
  }, [selectedFollowupId, followups, onFollowupViewed]);

  const loadFollowups = async (forceRefresh: boolean = false) => {
    if (!user) return;

    setLoading(true);
    try {
      // First, get the total count for the current filters
      let countQuery = supabase
        .from('followups')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (activeTab !== 'all') {
        countQuery = countQuery.eq('status', activeTab);
      }

      if (selectedDate) {
        const dateStr = formatDateToString(selectedDate);
        countQuery = countQuery.gte('next_action_date', `${dateStr}T00:00:00`).lte('next_action_date', `${dateStr}T23:59:59.999`);
      }

      const { count } = await countQuery;

      // Build the main query with nested joins (single query instead of N+1)
      let query = supabase
        .from('followups')
        .select(`
          *,
          leads:lead_id (
            id,
            first_name,
            last_name,
            name,
            mobile_number,
            lead_statuses:status_id (
              display_name
            ),
            sub_statuses:sub_status_id (
              display_name
            )
          )
        `)
        .eq('user_id', user.id)
        .order('next_action_date', { ascending: true })
        .order('next_action_time', { ascending: true });

      if (activeTab !== 'all') {
        query = query.eq('status', activeTab);
      }

      if (selectedDate) {
        const dateStr = formatDateToString(selectedDate);
        query = query.gte('next_action_date', `${dateStr}T00:00:00`).lte('next_action_date', `${dateStr}T23:59:59.999`);
      }

      // Add pagination
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data, error } = await query;

      if (error) throw error;

      setFollowups(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Failed to load follow-ups:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadFollowups(true);
  };

  const counts = useMemo(() => {
    return {
      all: totalCount,
      done: followups.filter(f => f.status === 'done').length,
      missed: followups.filter(f => f.status === 'missed').length,
      planned: followups.filter(f => f.status === 'planned').length,
    };
  }, [followups, totalCount]);

  const tabs = [
    { id: 'all' as FollowupStatus, label: 'All', count: counts.all },
    { id: 'done' as FollowupStatus, label: 'Done Followups', count: counts.done, color: 'text-green-600' },
    { id: 'missed' as FollowupStatus, label: 'Missed Followups', count: counts.missed, color: 'text-red-600' },
    { id: 'planned' as FollowupStatus, label: 'Planned Followups', count: counts.planned, color: 'text-yellow-600' },
  ];

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, []);

  const formatTime = useCallback((timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  }, []);

  const handleDateClick = (date: Date) => {
    if (selectedDate && selectedDate.toDateString() === date.toDateString()) {
      setSelectedDate(null);
      setCurrentPage(1);
    } else {
      setSelectedDate(date);
      setCurrentPage(1);
    }
  };

  const getNext5Days = useMemo(() => {
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 5; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      days.push(date);
    }
    return days;
  }, []);

  const [calendarFollowups, setCalendarFollowups] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;

    const loadCalendarData = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const fiveDaysLater = new Date(today);
      fiveDaysLater.setDate(today.getDate() + 5);
      fiveDaysLater.setHours(23, 59, 59, 999);

      const { data } = await supabase
        .from('followups')
        .select('next_action_date')
        .eq('user_id', user.id)
        .gte('next_action_date', today.toISOString())
        .lte('next_action_date', fiveDaysLater.toISOString());

      const counts: Record<string, number> = {};
      data?.forEach(f => {
        // Convert timestamp to local date string for counting
        const date = new Date(f.next_action_date);
        const dateKey = formatDateToString(date);
        counts[dateKey] = (counts[dateKey] || 0) + 1;
      });
      setCalendarFollowups(counts);
    };

    loadCalendarData();
  }, [user]);

  const getFollowupsCountForDate = (date: Date) => {
    const dateString = formatDateToString(date);
    return calendarFollowups[dateString] || 0;
  };

  const isDateSelected = (date: Date) => {
    return selectedDate && selectedDate.toDateString() === date.toDateString();
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleCommunicationAction = async (
    followupId: string,
    leadId: string,
    leadName: string,
    phone: string | undefined,
    email: string | undefined,
    modalType: 'call' | 'email' | 'whatsapp'
  ) => {
    const leadData = await fetchTemplateData(leadId, user?.id || '');
    if (!leadData) {
      showError('Failed to load lead data');
      return;
    }

    setSelectedFollowup({
      followupId,
      leadId,
      leadName,
      phone,
      email,
      leadData,
      modalType,
    });
  };

  const handleCommunicationSuccess = async () => {
    if (!selectedFollowup) return;

    const shouldMarkDone = window.confirm(
      'Communication completed! Would you like to mark this follow-up as done?'
    );

    if (shouldMarkDone) {
      await supabase
        .from('followups')
        .update({ status: 'done', updated_at: new Date().toISOString() })
        .eq('id', selectedFollowup.followupId);
    }

    setSelectedFollowup(null);
    loadFollowups(true);
  };

  return (
    <div className="flex h-full bg-slate-50">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 font-medium rounded-t-lg transition ${
                    activeTab === tab.id
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
                title="Refresh data"
              >
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              {selectedDate && (
                <button
                  onClick={() => {
                    setSelectedDate(null);
                    setCurrentPage(1);
                  }}
                  className="px-4 py-2 text-sm font-medium text-orange-600 hover:bg-orange-50 rounded-lg transition"
                >
                  Clear Date Filter
                </button>
              )}
            </div>
          </div>
          {selectedDate && (
            <div className="text-sm text-slate-600">
              Showing follow-ups for <span className="font-semibold text-slate-800">{formatDate(selectedDate.toISOString())}</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white border-l-4 border-slate-200 rounded-lg shadow-sm animate-pulse">
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="h-6 bg-slate-200 rounded w-48"></div>
                          <div className="h-4 bg-slate-200 rounded w-32"></div>
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                          <div className="h-12 bg-slate-200 rounded"></div>
                          <div className="h-12 bg-slate-200 rounded"></div>
                          <div className="h-12 bg-slate-200 rounded"></div>
                          <div className="h-12 bg-slate-200 rounded"></div>
                        </div>
                      </div>
                      <div className="h-6 bg-slate-200 rounded w-20"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : followups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <Calendar className="w-16 h-16 mb-4 text-slate-300" />
              <p className="text-lg font-medium">No follow-ups found</p>
              <p className="text-sm">Add follow-ups from the Lead Manager</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {followups.map((followup) => {
                  const lead = followup.leads as any;
                  const leadName = lead?.first_name || lead?.last_name
                    ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
                    : lead?.name || 'Unknown Lead';

                  return (
                    <div
                      key={followup.id}
                      ref={(el) => (followupRefs.current[followup.id] = el)}
                      className="bg-white border-l-4 border-orange-500 rounded-lg shadow-sm hover:shadow-md transition"
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold text-slate-800">{leadName}</h3>
                              <span className="text-sm text-slate-500">{lead?.mobile_number}</span>
                            </div>

                            <div className="grid grid-cols-4 gap-4 mb-3">
                              <div>
                                <p className="text-xs text-slate-500 mb-1">STAGE</p>
                                <p className="text-sm font-medium text-slate-700">
                                  {lead?.lead_statuses?.display_name || '-'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 mb-1">SUB-STAGE</p>
                                <p className="text-sm font-medium text-slate-700">
                                  {lead?.sub_statuses?.display_name || '-'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 mb-1">NEXT ACTION DATE</p>
                                <p className="text-sm font-medium text-slate-700">
                                  {formatDate(followup.next_action_date)} {formatTime(followup.next_action_time)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 mb-1">FOLLOWUP REMARKS</p>
                                <p className="text-sm font-medium text-slate-700">
                                  {followup.followup_remarks}
                                </p>
                              </div>
                            </div>

                            {followup.status === 'planned' && (
                              <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                                <span className="text-xs text-slate-500 font-medium mr-2">Quick Actions:</span>
                                <button
                                  onClick={() =>
                                    handleCommunicationAction(
                                      followup.id,
                                      lead?.id || '',
                                      leadName,
                                      lead?.mobile_number || undefined,
                                      lead?.email || undefined,
                                      'call'
                                    )
                                  }
                                  disabled={!canCall || !isValidPhoneNumber(lead?.mobile_number || '')}
                                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                                    !canCall || !isValidPhoneNumber(lead?.mobile_number || '')
                                      ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-500'
                                      : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                                  }`}
                                  title={
                                    !canCall
                                      ? 'No permission'
                                      : !isValidPhoneNumber(lead?.mobile_number || '')
                                      ? 'Phone not available'
                                      : 'Call'
                                  }
                                >
                                  <Phone className="w-4 h-4" />
                                  Call
                                </button>
                                <button
                                  onClick={() =>
                                    handleCommunicationAction(
                                      followup.id,
                                      lead?.id || '',
                                      leadName,
                                      lead?.mobile_number || undefined,
                                      lead?.email || undefined,
                                      'whatsapp'
                                    )
                                  }
                                  disabled={!canWhatsApp || !isValidPhoneNumber(lead?.mobile_number || '')}
                                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                                    !canWhatsApp || !isValidPhoneNumber(lead?.mobile_number || '')
                                      ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-500'
                                      : 'bg-green-50 text-green-700 hover:bg-green-100'
                                  }`}
                                  title={
                                    !canWhatsApp
                                      ? 'No permission'
                                      : !isValidPhoneNumber(lead?.mobile_number || '')
                                      ? 'Phone not available'
                                      : 'WhatsApp'
                                  }
                                >
                                  <MessageCircle className="w-4 h-4" />
                                  WhatsApp
                                </button>
                                <button
                                  onClick={() =>
                                    handleCommunicationAction(
                                      followup.id,
                                      lead?.id || '',
                                      leadName,
                                      lead?.mobile_number || undefined,
                                      lead?.email || undefined,
                                      'email'
                                    )
                                  }
                                  disabled={!canEmail || !isValidEmail(lead?.email || '')}
                                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                                    !canEmail || !isValidEmail(lead?.email || '')
                                      ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-500'
                                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                  }`}
                                  title={
                                    !canEmail
                                      ? 'No permission'
                                      : !isValidEmail(lead?.email || '')
                                      ? 'Email not available'
                                      : 'Email'
                                  }
                                >
                                  <Mail className="w-4 h-4" />
                                  Email
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`px-3 py-1 text-xs font-medium rounded-full ${
                                followup.status === 'done'
                                  ? 'bg-green-100 text-green-700'
                                  : followup.status === 'missed'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}
                            >
                              {followup.status.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-sm text-slate-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="w-80 bg-white border-l border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Next 5 Days
          </h3>
        </div>

        <div className="space-y-3">
          {getNext5Days.map((date, index) => {
            const isToday = index === 0;
            const isSelected = isDateSelected(date);
            const followupCount = getFollowupsCountForDate(date);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNumber = date.getDate();
            const monthName = date.toLocaleDateString('en-US', { month: 'short' });

            return (
              <button
                key={date.toISOString()}
                onClick={() => handleDateClick(date)}
                className={`w-full flex items-center justify-between p-4 rounded-lg transition ${
                  isSelected
                    ? 'bg-orange-500 text-white shadow-md ring-2 ring-orange-300'
                    : isToday
                    ? 'bg-orange-50 text-orange-700 border-2 border-orange-200'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <div className={`text-xs font-medium ${isSelected ? 'text-orange-100' : 'text-slate-500'}`}>
                      {dayName}
                    </div>
                    <div className="text-2xl font-bold">
                      {dayNumber}
                    </div>
                    <div className={`text-xs ${isSelected ? 'text-orange-100' : 'text-slate-500'}`}>
                      {monthName}
                    </div>
                  </div>
                  {isToday && !isSelected && (
                    <span className="text-xs font-semibold px-2 py-1 bg-orange-200 text-orange-700 rounded">
                      Today
                    </span>
                  )}
                </div>
                {followupCount > 0 && (
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${
                    isSelected
                      ? 'bg-white text-orange-500'
                      : isToday
                      ? 'bg-orange-200 text-orange-700'
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    {followupCount}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-6 p-4 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-600 text-center">
            Click on a day to filter follow-ups
          </p>
        </div>
      </div>

      {selectedFollowup?.modalType === 'call' && (
        <CallLogModal
          leadId={selectedFollowup.leadId}
          leadName={selectedFollowup.leadName}
          leadPhone={selectedFollowup.phone}
          autoOpen={true}
          onClose={() => setSelectedFollowup(null)}
          onSuccess={handleCommunicationSuccess}
        />
      )}

      {selectedFollowup?.modalType === 'email' && selectedFollowup.email && (
        <EmailInteractionModal
          leadId={selectedFollowup.leadId}
          leadName={selectedFollowup.leadName}
          leadEmail={selectedFollowup.email}
          leadData={selectedFollowup.leadData}
          onClose={() => setSelectedFollowup(null)}
          onSuccess={handleCommunicationSuccess}
        />
      )}

      {selectedFollowup?.modalType === 'whatsapp' && selectedFollowup.phone && (
        <WhatsAppInteractionModal
          leadId={selectedFollowup.leadId}
          leadName={selectedFollowup.leadName}
          leadPhone={selectedFollowup.phone}
          leadData={selectedFollowup.leadData}
          onClose={() => setSelectedFollowup(null)}
          onSuccess={handleCommunicationSuccess}
        />
      )}
    </div>
  );
}
