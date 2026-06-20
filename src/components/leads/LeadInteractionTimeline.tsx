// @ts-nocheck
import { useEffect, useState } from 'react';
import { Phone, Mail, MessageCircle, FileText, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

type LeadInteraction = Database['public']['Tables']['lead_interactions']['Row'];
type Call = Database['public']['Tables']['calls']['Row'];
type Note = Database['public']['Tables']['notes']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface TimelineItem {
  id: string;
  type: 'call' | 'email' | 'whatsapp' | 'note';
  timestamp: string;
  user: Profile | null;
  content: string;
  metadata?: any;
}

interface LeadInteractionTimelineProps {
  leadId: string;
}

export function LeadInteractionTimeline({ leadId }: LeadInteractionTimelineProps) {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'call' | 'email' | 'whatsapp' | 'note'>('all');

  useEffect(() => {
    loadTimeline();
  }, [leadId]);

  const loadTimeline = async () => {
    setLoading(true);

    const [interactionsRes, callsRes, notesRes] = await Promise.all([
      supabase
        .from('lead_interactions')
        .select('*, profiles(*)')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false }),
      supabase
        .from('calls')
        .select('*, profiles(*)')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false }),
      supabase
        .from('notes')
        .select('*, profiles(*)')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false }),
    ]);

    const items: TimelineItem[] = [];

    if (interactionsRes.data) {
      interactionsRes.data.forEach((interaction: any) => {
        items.push({
          id: interaction.id,
          type: interaction.interaction_type,
          timestamp: interaction.created_at,
          user: interaction.profiles,
          content: interaction.interaction_notes || '',
          metadata: interaction.interaction_metadata,
        });
      });
    }

    if (callsRes.data) {
      callsRes.data.forEach((call: any) => {
        items.push({
          id: call.id,
          type: 'call',
          timestamp: call.created_at,
          user: call.profiles,
          content: call.notes || '',
          metadata: {
            outcome: call.outcome,
            duration: call.duration_minutes,
            call_date: call.call_date,
          },
        });
      });
    }

    if (notesRes.data) {
      notesRes.data.forEach((note: any) => {
        items.push({
          id: note.id,
          type: 'note',
          timestamp: note.created_at,
          user: note.profiles,
          content: note.content,
        });
      });
    }

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setTimeline(items);
    setLoading(false);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'call':
        return <Phone className="w-4 h-4" />;
      case 'email':
        return <Mail className="w-4 h-4" />;
      case 'whatsapp':
        return <MessageCircle className="w-4 h-4" />;
      case 'note':
        return <FileText className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'call':
        return 'bg-orange-100 text-orange-600';
      case 'email':
        return 'bg-blue-100 text-blue-600';
      case 'whatsapp':
        return 'bg-green-100 text-green-600';
      case 'note':
        return 'bg-slate-100 text-slate-600';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) {
      return `${diffMins} minutes ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  const filteredTimeline = filter === 'all'
    ? timeline
    : timeline.filter(item => item.type === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
            filter === 'all' ? 'bg-orange-100 text-orange-700' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('call')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
            filter === 'call' ? 'bg-orange-100 text-orange-700' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Calls
        </button>
        <button
          onClick={() => setFilter('email')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
            filter === 'email' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Emails
        </button>
        <button
          onClick={() => setFilter('whatsapp')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
            filter === 'whatsapp' ? 'bg-green-100 text-green-700' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          WhatsApp
        </button>
        <button
          onClick={() => setFilter('note')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
            filter === 'note' ? 'bg-slate-100 text-slate-700' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Notes
        </button>
      </div>

      {filteredTimeline.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No interactions yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTimeline.map((item) => (
            <div key={item.id} className="flex gap-3 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition">
              <div className={`p-2 rounded-lg h-fit ${getIconColor(item.type)}`}>
                {getIcon(item.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <p className="font-medium text-slate-800 capitalize">{item.type}</p>
                    <p className="text-xs text-slate-500">
                      {item.user?.full_name || 'Unknown User'} • {formatDate(item.timestamp)}
                    </p>
                  </div>
                  {item.metadata?.outcome && (
                    <span className="text-xs px-2 py-1 bg-white rounded-md text-slate-600 capitalize">
                      {item.metadata.outcome.replace('_', ' ')}
                    </span>
                  )}
                </div>
                {item.content && (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{item.content}</p>
                )}
                {item.metadata?.subject && (
                  <p className="text-sm font-medium text-slate-700 mt-1">
                    Subject: {item.metadata.subject}
                  </p>
                )}
                {item.metadata?.message && (
                  <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                    {item.metadata.message}
                  </p>
                )}
                {item.metadata?.duration && (
                  <p className="text-xs text-slate-500 mt-1">
                    Duration: {item.metadata.duration} minutes
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
