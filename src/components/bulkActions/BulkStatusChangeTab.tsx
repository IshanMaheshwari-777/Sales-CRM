// @ts-nocheck
import { useState, useEffect } from 'react';
import { Eye, Loader2, RefreshCw, Calendar, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface StatusChangeRecord {
  id: string;
  user_id: string;
  activity_type: string;
  activity_description: string;
  metadata: any;
  created_at: string;
  profiles?: { full_name: string };
  affected_leads_count?: number;
}

export function BulkStatusChangeTab() {
  const [records, setRecords] = useState<StatusChangeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedUser, setSelectedUser] = useState('all');
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<StatusChangeRecord | null>(null);

  useEffect(() => {
    loadUsers();
    loadStatusChangeHistory();
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

  const loadStatusChangeHistory = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('lead_activity_log')
        .select('*, profiles:user_id(full_name)')
        .in('activity_type', ['status_changed', 'sub_status_changed'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (selectedUser && selectedUser !== 'all') {
        query = query.eq('user_id', selectedUser);
      }

      if (dateRange.start) {
        query = query.gte('created_at', new Date(dateRange.start).toISOString());
      }

      if (dateRange.end) {
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter only bulk operations and extract affected count from metadata
      const bulkRecords = (data || [])
        .filter((record: any) => record.metadata?.is_bulk_operation)
        .map((record: any) => ({
          ...record,
          affected_leads_count: record.metadata?.affected_count || 1
        }));

      setRecords(bulkRecords);
    } catch (error) {
      console.error('Error loading status change history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatusChangeHistory();
  }, [selectedUser, dateRange]);

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

  const handleViewDetails = (record: StatusChangeRecord) => {
    setSelectedRecord(record);
    setShowDetailsModal(true);
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
                placeholder="Please Select Created Date"
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
            onClick={loadStatusChangeHistory}
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
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <RotateCcw className="w-16 h-16 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No Status Changes</h3>
            <p className="text-slate-600">
              No bulk status changes found for the selected filters.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Created By
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Created Date
                  </th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Total Records
                  </th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Action Status
                  </th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 text-sm text-slate-900">
                      {record.profiles?.full_name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {formatDate(record.created_at)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-semibold text-slate-900">
                        {record.affected_leads_count || 1}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        Completed
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleViewDetails(record)}
                          className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition"
                          title="Revert (Coming Soon)"
                          disabled
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showDetailsModal && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Status Change Details</h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-600">Changed By</label>
                  <p className="text-slate-900 mt-1">{selectedRecord.profiles?.full_name || 'Unknown'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">Date & Time</label>
                  <p className="text-slate-900 mt-1">{formatDate(selectedRecord.created_at)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">Description</label>
                  <p className="text-slate-900 mt-1">{selectedRecord.activity_description}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">Old Value</label>
                  <p className="text-slate-900 mt-1">{selectedRecord.old_value || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">New Value</label>
                  <p className="text-slate-900 mt-1">{selectedRecord.new_value || 'N/A'}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end p-6 border-t border-slate-200">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
