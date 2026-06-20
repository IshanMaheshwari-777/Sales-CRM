// @ts-nocheck
import { useState, useEffect } from 'react';
import { X, Search, Download, Pin, Filter, Calendar, User, FileText, Phone, Mail, MessageCircle, RefreshCw, ArrowRightLeft, UserCheck, Flag, Activity } from 'lucide-react';
import { getLeadActivities, toggleActivityPin, getActivityStats, ActivityType } from '../../services/activityLogger';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

interface LeadActivityModalProps {
  leadId: string;
  leadName: string;
  onClose: () => void;
}

type ActivityLog = {
  id: string;
  lead_id: string;
  user_id: string;
  activity_type: string;
  activity_description: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  metadata: any;
  is_pinned: boolean;
  created_at: string;
  profiles: {
    id: string;
    full_name: string;
    email: string;
  } | null;
};

type FilterType = 'all' | 'lead_changes' | 'status_changes' | 'interactions' | 'comments' | 'assignments' | 'pinned';

const ACTIVITY_TYPE_FILTERS: Record<FilterType, ActivityType[] | undefined> = {
  all: undefined,
  lead_changes: ['lead_created', 'lead_created_bulk', 'lead_edited'],
  status_changes: ['status_changed', 'sub_status_changed'],
  interactions: ['call_logged', 'email_sent', 'whatsapp_sent', 'followup_created'],
  comments: ['comment_added'],
  assignments: ['ownership_transferred', 'lead_referred'],
  pinned: undefined,
};

const DATE_PRESETS = [
  { label: 'Today', days: 0 },
  { label: 'Yesterday', days: 1 },
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'This Month', days: -1 },
];

export function LeadActivityModal({ leadId, leadName, onClose }: LeadActivityModalProps) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({});
  const [stats, setStats] = useState<any>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    loadActivities();
    loadStats();

    const channel = supabase
      .channel(`lead-activities-${leadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_activity_log',
          filter: `lead_id=eq.${leadId}`,
        },
        () => {
          loadActivities();
          loadStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadId]);

  useEffect(() => {
    applyFilters();
  }, [activities, activeFilter, searchQuery, dateRange]);

  const loadActivities = async () => {
    setLoading(true);
    const data = await getLeadActivities(leadId, {
      limit: 100,
    });
    setActivities(data as ActivityLog[]);
    setLoading(false);
  };

  const loadStats = async () => {
    const data = await getActivityStats(leadId);
    setStats(data);
  };

  const applyFilters = () => {
    let filtered = [...activities];

    if (activeFilter === 'pinned') {
      filtered = filtered.filter(a => a.is_pinned);
    } else if (ACTIVITY_TYPE_FILTERS[activeFilter]) {
      filtered = filtered.filter(a => ACTIVITY_TYPE_FILTERS[activeFilter]?.includes(a.activity_type as ActivityType));
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(a =>
        a.activity_description.toLowerCase().includes(query) ||
        a.profiles?.full_name.toLowerCase().includes(query) ||
        a.old_value?.toLowerCase().includes(query) ||
        a.new_value?.toLowerCase().includes(query)
      );
    }

    if (dateRange.start) {
      const startDate = new Date(dateRange.start);
      startDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(a => new Date(a.created_at) >= startDate);
    }

    if (dateRange.end) {
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(a => new Date(a.created_at) <= endDate);
    }

    setFilteredActivities(filtered);
  };

  const handlePinToggle = async (activityId: string, currentPinned: boolean) => {
    const success = await toggleActivityPin(activityId, !currentPinned);
    if (success) {
      setActivities(prev =>
        prev.map(a => a.id === activityId ? { ...a, is_pinned: !currentPinned } : a)
      );
    }
  };

  const handleDatePreset = (days: number) => {
    if (days === -1) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setDateRange({ start: start.toISOString().split('T')[0], end: undefined });
    } else if (days === 0) {
      const today = new Date().toISOString().split('T')[0];
      setDateRange({ start: today, end: today });
    } else if (days === 1) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      setDateRange({ start: yesterdayStr, end: yesterdayStr });
    } else {
      const start = new Date();
      start.setDate(start.getDate() - days);
      setDateRange({ start: start.toISOString().split('T')[0], end: undefined });
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'lead_created':
      case 'lead_created_bulk':
        return <UserCheck className="w-4 h-4" />;
      case 'lead_edited':
        return <FileText className="w-4 h-4" />;
      case 'status_changed':
      case 'sub_status_changed':
        return <RefreshCw className="w-4 h-4" />;
      case 'ownership_transferred':
      case 'lead_referred':
        return <ArrowRightLeft className="w-4 h-4" />;
      case 'comment_added':
        return <MessageCircle className="w-4 h-4" />;
      case 'followup_created':
        return <Flag className="w-4 h-4" />;
      case 'call_logged':
        return <Phone className="w-4 h-4" />;
      case 'email_sent':
        return <Mail className="w-4 h-4" />;
      case 'whatsapp_sent':
        return <MessageCircle className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getActivityColor = (type: string, isPinned: boolean) => {
    if (isPinned) return 'bg-red-100 text-red-600 border-red-200';

    switch (type) {
      case 'lead_created':
      case 'lead_created_bulk':
      case 'lead_edited':
        return 'bg-orange-100 text-orange-600 border-orange-200';
      case 'status_changed':
      case 'sub_status_changed':
        return 'bg-green-100 text-green-600 border-green-200';
      case 'ownership_transferred':
      case 'lead_referred':
        return 'bg-yellow-100 text-yellow-600 border-yellow-200';
      case 'comment_added':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'call_logged':
      case 'email_sent':
      case 'whatsapp_sent':
        return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'followup_created':
        return 'bg-purple-100 text-purple-600 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const formatExactTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const groupActivitiesByDate = (activities: ActivityLog[]) => {
    const groups: Record<string, ActivityLog[]> = {};

    activities.forEach(activity => {
      const date = new Date(activity.created_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });

      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(activity);
    });

    return groups;
  };

  const activityGroups = groupActivitiesByDate(filteredActivities);

  const getFilterCount = (filter: FilterType) => {
    if (filter === 'all') return activities.length;
    if (filter === 'pinned') return activities.filter(a => a.is_pinned).length;

    const types = ACTIVITY_TYPE_FILTERS[filter];
    if (!types) return 0;

    return activities.filter(a => types.includes(a.activity_type as ActivityType)).length;
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Time', 'User', 'Activity Type', 'Description', 'Field Changed', 'Old Value', 'New Value'];
    const rows = filteredActivities.map(a => [
      new Date(a.created_at).toLocaleDateString(),
      new Date(a.created_at).toLocaleTimeString(),
      a.profiles?.full_name || 'Unknown',
      a.activity_type,
      a.activity_description,
      a.field_name || '',
      a.old_value || '',
      a.new_value || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lead-activity-${leadName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white px-6 py-5 rounded-t-xl flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Activity History</h2>
            <p className="text-slate-300 text-sm mt-1">{leadName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-600 rounded-lg transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-4 gap-4 p-6 border-b border-slate-200 bg-slate-50">
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <div className="text-sm text-slate-600 mb-1">Total Activities</div>
              <div className="text-2xl font-bold text-slate-900">{stats.total_activities || 0}</div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <div className="text-sm text-slate-600 mb-1">Last 24 Hours</div>
              <div className="text-2xl font-bold text-blue-600">{stats.activities_last_24h || 0}</div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <div className="text-sm text-slate-600 mb-1">Pinned Items</div>
              <div className="text-2xl font-bold text-red-600">{stats.pinned_count || 0}</div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <div className="text-sm text-slate-600 mb-1">Activity Types</div>
              <div className="text-2xl font-bold text-slate-900">
                {stats.activity_type_breakdown ? Object.keys(stats.activity_type_breakdown).length : 0}
              </div>
            </div>
          </div>
        )}

        <div className="p-6 border-b border-slate-200 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search activities..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-10">
                  <button
                    onClick={exportToCSV}
                    className="w-full px-4 py-2 text-left hover:bg-slate-50 transition"
                  >
                    Export as CSV
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {(['all', 'lead_changes', 'status_changes', 'interactions', 'comments', 'assignments', 'pinned'] as FilterType[]).map(filter => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  activeFilter === filter
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {filter.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                <span className="ml-2 text-xs opacity-75">({getFilterCount(filter)})</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {DATE_PRESETS.map(preset => (
              <button
                key={preset.label}
                onClick={() => handleDatePreset(preset.days)}
                className="px-3 py-1.5 rounded-lg text-sm bg-white border border-slate-300 hover:bg-slate-50 transition"
              >
                {preset.label}
              </button>
            ))}
            {(dateRange.start || dateRange.end) && (
              <button
                onClick={() => setDateRange({})}
                className="px-3 py-1.5 rounded-lg text-sm bg-red-50 text-red-600 hover:bg-red-100 transition"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800"></div>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 text-lg">No activities found</p>
              <p className="text-slate-500 text-sm mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(activityGroups).map(([date, dateActivities]) => (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-4">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{date}</h3>
                    <div className="flex-1 h-px bg-slate-200"></div>
                  </div>

                  <div className="space-y-4">
                    {dateActivities.map((activity, idx) => (
                      <div
                        key={activity.id}
                        className="flex gap-4 group"
                      >
                        <div className="flex flex-col items-center">
                          <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${getActivityColor(activity.activity_type, activity.is_pinned)}`}>
                            {getActivityIcon(activity.activity_type)}
                          </div>
                          {idx < dateActivities.length - 1 && (
                            <div className="w-px h-full bg-slate-200 mt-2"></div>
                          )}
                        </div>

                        <div className="flex-1 pb-6">
                          <div className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-700">
                                  {getInitials(activity.profiles?.full_name || 'Unknown')}
                                </div>
                                <div>
                                  <div className="font-medium text-slate-900">
                                    {activity.profiles?.full_name || 'Unknown User'}
                                  </div>
                                  <div className="text-xs text-slate-500" title={formatExactTime(activity.created_at)}>
                                    {formatRelativeTime(activity.created_at)}
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => handlePinToggle(activity.id, activity.is_pinned)}
                                className={`p-2 rounded-lg transition opacity-0 group-hover:opacity-100 ${
                                  activity.is_pinned
                                    ? 'bg-red-100 text-red-600 opacity-100'
                                    : 'hover:bg-slate-100 text-slate-400'
                                }`}
                                title={activity.is_pinned ? 'Unpin' : 'Pin'}
                              >
                                <Pin className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="text-slate-700">
                              {activity.activity_description}
                            </div>

                            {activity.field_name && activity.old_value && activity.new_value && (
                              <div className="mt-3 flex items-center gap-2 text-sm">
                                <span className="px-2 py-1 bg-red-50 text-red-700 rounded line-through">
                                  {activity.old_value}
                                </span>
                                <span className="text-slate-400">→</span>
                                <span className="px-2 py-1 bg-green-50 text-green-700 rounded font-medium">
                                  {activity.new_value}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
