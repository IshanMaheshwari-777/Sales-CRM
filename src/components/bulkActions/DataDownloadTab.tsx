// @ts-nocheck
import { useState, useEffect } from 'react';
import { Download, Loader2, RefreshCw, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface DownloadHistory {
  id: string;
  user_id: string;
  cc_users: string[];
  bcc_users: string[];
  download_source: string;
  total_records: number;
  filter_criteria: any;
  file_format: string;
  status: string;
  downloaded_at: string;
  completed_at: string | null;
  profiles?: { full_name: string };
}

export function DataDownloadTab() {
  const [downloads, setDownloads] = useState<DownloadHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedUser, setSelectedUser] = useState('all');
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);

  useEffect(() => {
    loadUsers();
    loadDownloadHistory();
  }, []);

  const loadUsers = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name');

      if (data) {
        setUsers(data);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadDownloadHistory = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('bulk_download_history')
        .select('*, profiles:user_id(full_name)')
        .order('downloaded_at', { ascending: false })
        .limit(100);

      if (selectedUser && selectedUser !== 'all') {
        query = query.eq('user_id', selectedUser);
      }

      if (dateRange.start) {
        query = query.gte('downloaded_at', new Date(dateRange.start).toISOString());
      }

      if (dateRange.end) {
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('downloaded_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      setDownloads(data || []);
    } catch (error) {
      console.error('Error loading download history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDownloadHistory();
  }, [selectedUser, dateRange]);

  const getStatusBadge = (status: string) => {
    const styles = {
      completed: 'bg-slate-700 text-white',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`px-3 py-1 text-xs font-medium rounded ${styles[status as keyof typeof styles] || 'bg-slate-100 text-slate-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCCBCCDisplay = (ccUsers: string[], bccUsers: string[]) => {
    const ccNames = ccUsers?.join(', ') || '-';
    const bccNames = bccUsers?.join(', ') || '-';
    return ccNames !== '-' || bccNames !== '-' ? `${ccNames} / ${bccNames}` : '-';
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="bg-white border-b border-slate-200 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
            >
              <option value="all">All Counselors</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              />
            </div>
          </div>

          <button
            onClick={loadDownloadHistory}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        ) : downloads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Download className="w-16 h-16 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No Download History</h3>
            <p className="text-slate-600">
              No data downloads found for the selected filters.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Downloaded By
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Person in CC/BCC
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Downloaded From
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Download Date
                  </th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Total Records
                  </th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Download Stage
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {downloads.map((download) => (
                  <tr key={download.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 text-sm text-slate-900">
                      {download.profiles?.full_name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {download.profiles?.full_name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {download.download_source}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatDate(download.downloaded_at)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-semibold text-slate-900">{download.total_records}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getStatusBadge(download.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
