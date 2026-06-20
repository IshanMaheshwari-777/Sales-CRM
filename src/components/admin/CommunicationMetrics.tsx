// @ts-nocheck
import { useState, useEffect } from 'react';
import { Phone, Mail, MessageCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface MetricData {
  current: number;
  previous: number;
  trend: number;
}

interface CommunicationMetricsProps {
  organizationId?: string;
  userId?: string;
  teamId?: string;
  dateRange?: 'week' | 'month' | 'year';
}

export function CommunicationMetrics({
  organizationId,
  userId,
  teamId,
  dateRange = 'week',
}: CommunicationMetricsProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<{
    calls: MetricData;
    emails: MetricData;
    whatsapp: MetricData;
  }>({
    calls: { current: 0, previous: 0, trend: 0 },
    emails: { current: 0, previous: 0, trend: 0 },
    whatsapp: { current: 0, previous: 0, trend: 0 },
  });

  useEffect(() => {
    loadMetrics();
  }, [organizationId, userId, teamId, dateRange]);

  async function loadMetrics() {
    setLoading(true);

    try {
      const now = new Date();
      let currentStart: Date;
      let currentEnd: Date;
      let previousStart: Date;
      let previousEnd: Date;

      if (dateRange === 'week') {
        currentEnd = now;
        currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousEnd = currentStart;
        previousStart = new Date(previousEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (dateRange === 'month') {
        currentEnd = now;
        currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousEnd = currentStart;
        previousStart = new Date(previousEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else {
        currentEnd = now;
        currentStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        previousEnd = currentStart;
        previousStart = new Date(previousEnd.getTime() - 365 * 24 * 60 * 60 * 1000);
      }

      const [callsData, interactionsData] = await Promise.all([
        fetchCallsMetrics(currentStart, currentEnd, previousStart, previousEnd),
        fetchInteractionsMetrics(currentStart, currentEnd, previousStart, previousEnd),
      ]);

      setMetrics({
        calls: callsData,
        emails: interactionsData.emails,
        whatsapp: interactionsData.whatsapp,
      });
    } catch (error) {
      console.error('Error loading communication metrics:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCallsMetrics(
    currentStart: Date,
    currentEnd: Date,
    previousStart: Date,
    previousEnd: Date
  ): Promise<MetricData> {
    let currentQuery = supabase
      .from('calls')
      .select('id', { count: 'exact', head: true })
      .gte('call_date', currentStart.toISOString())
      .lte('call_date', currentEnd.toISOString());

    let previousQuery = supabase
      .from('calls')
      .select('id', { count: 'exact', head: true })
      .gte('call_date', previousStart.toISOString())
      .lte('call_date', previousEnd.toISOString());

    if (organizationId) {
      currentQuery = currentQuery.eq('organization_id', organizationId);
      previousQuery = previousQuery.eq('organization_id', organizationId);
    }

    if (userId) {
      currentQuery = currentQuery.eq('user_id', userId);
      previousQuery = previousQuery.eq('user_id', userId);
    }

    const [currentResult, previousResult] = await Promise.all([
      currentQuery,
      previousQuery,
    ]);

    const current = currentResult.count || 0;
    const previous = previousResult.count || 0;
    const trend = previous > 0 ? ((current - previous) / previous) * 100 : 0;

    return { current, previous, trend };
  }

  async function fetchInteractionsMetrics(
    currentStart: Date,
    currentEnd: Date,
    previousStart: Date,
    previousEnd: Date
  ): Promise<{ emails: MetricData; whatsapp: MetricData }> {
    let currentEmailQuery = supabase
      .from('lead_interactions')
      .select('id', { count: 'exact', head: true })
      .eq('interaction_type', 'email')
      .gte('created_at', currentStart.toISOString())
      .lte('created_at', currentEnd.toISOString());

    let previousEmailQuery = supabase
      .from('lead_interactions')
      .select('id', { count: 'exact', head: true })
      .eq('interaction_type', 'email')
      .gte('created_at', previousStart.toISOString())
      .lte('created_at', previousEnd.toISOString());

    let currentWhatsAppQuery = supabase
      .from('lead_interactions')
      .select('id', { count: 'exact', head: true })
      .eq('interaction_type', 'whatsapp')
      .gte('created_at', currentStart.toISOString())
      .lte('created_at', currentEnd.toISOString());

    let previousWhatsAppQuery = supabase
      .from('lead_interactions')
      .select('id', { count: 'exact', head: true })
      .eq('interaction_type', 'whatsapp')
      .gte('created_at', previousStart.toISOString())
      .lte('created_at', previousEnd.toISOString());

    if (userId) {
      currentEmailQuery = currentEmailQuery.eq('user_id', userId);
      previousEmailQuery = previousEmailQuery.eq('user_id', userId);
      currentWhatsAppQuery = currentWhatsAppQuery.eq('user_id', userId);
      previousWhatsAppQuery = previousWhatsAppQuery.eq('user_id', userId);
    }

    const [
      currentEmailResult,
      previousEmailResult,
      currentWhatsAppResult,
      previousWhatsAppResult,
    ] = await Promise.all([
      currentEmailQuery,
      previousEmailQuery,
      currentWhatsAppQuery,
      previousWhatsAppQuery,
    ]);

    const currentEmails = currentEmailResult.count || 0;
    const previousEmails = previousEmailResult.count || 0;
    const emailTrend =
      previousEmails > 0 ? ((currentEmails - previousEmails) / previousEmails) * 100 : 0;

    const currentWhatsApp = currentWhatsAppResult.count || 0;
    const previousWhatsApp = previousWhatsAppResult.count || 0;
    const whatsappTrend =
      previousWhatsApp > 0
        ? ((currentWhatsApp - previousWhatsApp) / previousWhatsApp) * 100
        : 0;

    return {
      emails: { current: currentEmails, previous: previousEmails, trend: emailTrend },
      whatsapp: { current: currentWhatsApp, previous: previousWhatsApp, trend: whatsappTrend },
    };
  }

  function formatTrend(trend: number): string {
    if (trend === 0) return '0%';
    const sign = trend > 0 ? '+' : '';
    return `${sign}${trend.toFixed(1)}%`;
  }

  const MetricCard = ({
    title,
    icon: Icon,
    iconColor,
    bgColor,
    data,
  }: {
    title: string;
    icon: any;
    iconColor: string;
    bgColor: string;
    data: MetricData;
  }) => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 ${bgColor} rounded-lg`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
            data.trend > 0
              ? 'bg-green-100 text-green-700'
              : data.trend < 0
              ? 'bg-red-100 text-red-700'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          {data.trend > 0 ? (
            <TrendingUp className="w-3 h-3" />
          ) : data.trend < 0 ? (
            <TrendingDown className="w-3 h-3" />
          ) : null}
          {formatTrend(data.trend)}
        </div>
      </div>
      <h3 className="text-2xl font-bold text-slate-800 mb-1">{data.current}</h3>
      <p className="text-sm text-slate-600">{title}</p>
      <p className="text-xs text-slate-400 mt-2">
        Previous period: {data.previous}
      </p>
    </div>
  );

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-pulse"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-slate-200 rounded-lg"></div>
              <div className="w-16 h-6 bg-slate-200 rounded-full"></div>
            </div>
            <div className="h-8 bg-slate-200 rounded w-20 mb-2"></div>
            <div className="h-4 bg-slate-200 rounded w-32"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <MetricCard
        title={`Calls This ${dateRange === 'week' ? 'Week' : dateRange === 'month' ? 'Month' : 'Year'}`}
        icon={Phone}
        iconColor="text-orange-600"
        bgColor="bg-orange-100"
        data={metrics.calls}
      />
      <MetricCard
        title={`WhatsApp This ${dateRange === 'week' ? 'Week' : dateRange === 'month' ? 'Month' : 'Year'}`}
        icon={MessageCircle}
        iconColor="text-green-600"
        bgColor="bg-green-100"
        data={metrics.whatsapp}
      />
      <MetricCard
        title={`Emails This ${dateRange === 'week' ? 'Week' : dateRange === 'month' ? 'Month' : 'Year'}`}
        icon={Mail}
        iconColor="text-blue-600"
        bgColor="bg-blue-100"
        data={metrics.emails}
      />
    </div>
  );
}
