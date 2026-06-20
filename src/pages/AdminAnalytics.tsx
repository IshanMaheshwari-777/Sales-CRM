// @ts-nocheck
import { useState, useEffect } from 'react';
import { Activity, TrendingUp, Users, BarChart3, Download, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CommunicationMetrics } from '../components/admin/CommunicationMetrics';
import { useAuth } from '../contexts/AuthContext';

interface ActivityStats {
  total_activities: number;
  activities_today: number;
  activities_this_week: number;
  activities_this_month: number;
}

interface TopUser {
  user_id: string;
  full_name: string;
  email: string;
  activity_count: number;
}

interface ActivityTypeBreakdown {
  activity_type: string;
  count: number;
  percentage: number;
}

interface DailyActivity {
  date: string;
  count: number;
}

export function AdminAnalytics() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [activityBreakdown, setActivityBreakdown] = useState<ActivityTypeBreakdown[]>([]);
  const [dailyActivities, setDailyActivities] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(30);
  const [organizationId, setOrganizationId] = useState<string | undefined>(undefined);

  useEffect(() => {
    loadOrganizationId();
  }, [user]);

  useEffect(() => {
    if (organizationId) {
      loadAnalytics();
    }
  }, [dateRange, organizationId]);

  const loadOrganizationId = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();
    if (data) {
      setOrganizationId(data.organization_id || undefined);
    }
  };

  const loadAnalytics = async () => {
    setLoading(true);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dateRange);

    const { data: activities } = (await supabase
      .from('lead_activity_log')
      .select(`
        *,
        profiles:user_id (
          id,
          full_name,
          email
        )
      `)
      .eq('organization_id', organizationId)
      .gte('created_at', startDate.toISOString())) as any;

    if (activities) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);

      setStats({
        total_activities: activities.length,
        activities_today: activities.filter(a => new Date(a.created_at) >= today).length,
        activities_this_week: activities.filter(a => new Date(a.created_at) >= weekAgo).length,
        activities_this_month: activities.filter(a => new Date(a.created_at) >= monthAgo).length,
      });

      const userCounts = new Map<string, { name: string; email: string; count: number }>();
      activities.forEach(a => {
        const profile = a.profiles as any;
        if (profile) {
          const current = userCounts.get(a.user_id) || { name: profile.full_name, email: profile.email, count: 0 };
          current.count++;
          userCounts.set(a.user_id, current);
        }
      });

      const sortedUsers = Array.from(userCounts.entries())
        .map(([user_id, data]) => ({
          user_id,
          full_name: data.name,
          email: data.email,
          activity_count: data.count,
        }))
        .sort((a, b) => b.activity_count - a.activity_count)
        .slice(0, 10);

      setTopUsers(sortedUsers);

      const typeCounts = new Map<string, number>();
      activities.forEach(a => {
        typeCounts.set(a.activity_type, (typeCounts.get(a.activity_type) || 0) + 1);
      });

      const breakdown = Array.from(typeCounts.entries())
        .map(([activity_type, count]) => ({
          activity_type,
          count,
          percentage: (count / activities.length) * 100,
        }))
        .sort((a, b) => b.count - a.count);

      setActivityBreakdown(breakdown);

      const dailyCounts = new Map<string, number>();
      activities.forEach(a => {
        const date = new Date(a.created_at).toISOString().split('T')[0];
        dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
      });

      const daily = Array.from(dailyCounts.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30);

      setDailyActivities(daily);
    }

    setLoading(false);
  };

  const formatActivityType = (type: string) => {
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const exportAnalytics = () => {
    const csvContent = [
      ['Admin Analytics Report', `Generated: ${new Date().toLocaleString()}`],
      [],
      ['Overview Statistics'],
      ['Total Activities', stats?.total_activities || 0],
      ['Activities Today', stats?.activities_today || 0],
      ['Activities This Week', stats?.activities_this_week || 0],
      ['Activities This Month', stats?.activities_this_month || 0],
      [],
      ['Top Active Users'],
      ['Rank', 'Name', 'Email', 'Activity Count'],
      ...topUsers.map((user, idx) => [idx + 1, user.full_name, user.email, user.activity_count]),
      [],
      ['Activity Type Breakdown'],
      ['Activity Type', 'Count', 'Percentage'],
      ...activityBreakdown.map(item => [formatActivityType(item.activity_type), item.count, `${item.percentage.toFixed(1)}%`]),
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">System Analytics</h1>
            <p className="text-slate-600 mt-1">Activity insights and user engagement metrics</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(Number(e.target.value))}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
              <option value={365}>Last Year</option>
            </select>
            <button
              onClick={exportAnalytics}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Communication Activity</h2>
          <CommunicationMetrics
            organizationId={organizationId}
            dateRange={dateRange === 7 ? 'week' : dateRange === 30 ? 'month' : 'year'}
          />
        </div>

        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{stats?.total_activities || 0}</div>
            <div className="text-sm text-slate-600">Total Activities</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{stats?.activities_today || 0}</div>
            <div className="text-sm text-slate-600">Today</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Calendar className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{stats?.activities_this_week || 0}</div>
            <div className="text-sm text-slate-600">This Week</div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{stats?.activities_this_month || 0}</div>
            <div className="text-sm text-slate-600">This Month</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <Users className="w-6 h-6 text-slate-700" />
              <h2 className="text-xl font-bold text-slate-900">Top Active Users</h2>
            </div>
            <div className="space-y-4">
              {topUsers.map((user, idx) => (
                <div key={user.user_id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                      idx === 0 ? 'bg-yellow-500' :
                      idx === 1 ? 'bg-slate-400' :
                      idx === 2 ? 'bg-orange-600' :
                      'bg-slate-300'
                    }`}>
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">{user.full_name}</div>
                      <div className="text-sm text-slate-600">{user.email}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-slate-900">{user.activity_count}</div>
                    <div className="text-xs text-slate-600">activities</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="w-6 h-6 text-slate-700" />
              <h2 className="text-xl font-bold text-slate-900">Activity Type Distribution</h2>
            </div>
            <div className="space-y-3">
              {activityBreakdown.map((item, idx) => (
                <div key={item.activity_type}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">{formatActivityType(item.activity_type)}</span>
                    <span className="text-sm text-slate-600">{item.count} ({item.percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        idx === 0 ? 'bg-orange-500' :
                        idx === 1 ? 'bg-blue-500' :
                        idx === 2 ? 'bg-green-500' :
                        idx === 3 ? 'bg-purple-500' :
                        'bg-slate-500'
                      }`}
                      style={{ width: `${item.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-6 h-6 text-slate-700" />
            <h2 className="text-xl font-bold text-slate-900">Activity Volume Trend</h2>
          </div>
          <div className="h-64 flex items-end justify-between gap-1">
            {dailyActivities.map((day, idx) => {
              const maxCount = Math.max(...dailyActivities.map(d => d.count));
              const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;

              return (
                <div key={day.date} className="flex-1 flex flex-col items-center group">
                  <div
                    className="w-full bg-orange-500 rounded-t hover:bg-orange-600 transition cursor-pointer"
                    style={{ height: `${height}%` }}
                    title={`${new Date(day.date).toLocaleDateString()}: ${day.count} activities`}
                  >
                    <div className="opacity-0 group-hover:opacity-100 transition text-xs text-white font-semibold text-center pt-1">
                      {day.count}
                    </div>
                  </div>
                  {idx % 5 === 0 && (
                    <div className="text-xs text-slate-500 mt-2 transform -rotate-45 origin-top-left">
                      {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
  );
}
