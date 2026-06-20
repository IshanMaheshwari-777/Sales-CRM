// @ts-nocheck
import { useState, useEffect } from 'react';
import { RefreshCw, Search, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface WebhookLog {
  id: string;
  event_type: string;
  response_status: number;
  error_message: string | null;
  duration_ms: number;
  created_at: string;
  endpoint_name?: string;
  request_payload?: any;
  response_body?: string;
}

type LogType = 'all' | 'incoming' | 'outgoing';

interface WebhookLogsViewerProps {
  activeOrganizationId: string;
}

export function WebhookLogsViewer({ activeOrganizationId }: WebhookLogsViewerProps) {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [logType, setLogType] = useState<LogType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState('7');

  useEffect(() => {
    fetchLogs();
  }, [activeOrganizationId, logType, dateFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(dateFilter));

      if (logType === 'incoming' || logType === 'all') {
        const { data: incomingLogs, error: incomingError } = await supabase
          .from('webhook_request_log')
          .select('*')
          .eq('organization_id', activeOrganizationId)
          .gte('created_at', daysAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(100);

        if (incomingError) throw incomingError;

        const formattedIncoming = (incomingLogs || []).map(log => ({
          id: log.id,
          event_type: 'incoming',
          response_status: log.response_status,
          error_message: log.error_message,
          duration_ms: log.duration_ms,
          created_at: log.created_at,
          request_payload: log.request_body,
        }));

        if (logType === 'incoming') {
          setLogs(formattedIncoming);
          setLoading(false);
          return;
        }
      }

      if (logType === 'outgoing' || logType === 'all') {
        const { data: outgoingLogs, error: outgoingError } = await supabase
          .from('webhook_delivery_log')
          .select(`
            *,
            integration_endpoints (endpoint_name)
          `)
          .eq('organization_id', activeOrganizationId)
          .gte('created_at', daysAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(100);

        if (outgoingError) throw outgoingError;

        const formattedOutgoing = (outgoingLogs || []).map(log => ({
          id: log.id,
          event_type: log.event_type,
          response_status: log.response_status,
          error_message: log.error_message,
          duration_ms: log.duration_ms,
          created_at: log.created_at,
          endpoint_name: log.integration_endpoints?.endpoint_name,
          request_payload: log.request_payload,
          response_body: log.response_body,
        }));

        if (logType === 'outgoing') {
          setLogs(formattedOutgoing);
        } else {
          const { data: incomingLogs } = await supabase
            .from('webhook_request_log')
            .select('*')
            .eq('organization_id', activeOrganizationId)
            .gte('created_at', daysAgo.toISOString())
            .order('created_at', { ascending: false })
            .limit(100);

          const formattedIncoming = (incomingLogs || []).map(log => ({
            id: log.id,
            event_type: 'incoming',
            response_status: log.response_status,
            error_message: log.error_message,
            duration_ms: log.duration_ms,
            created_at: log.created_at,
            request_payload: log.request_body,
          }));

          const allLogs = [...formattedIncoming, ...formattedOutgoing].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          setLogs(allLogs);
        }
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      log.event_type.toLowerCase().includes(search) ||
      log.endpoint_name?.toLowerCase().includes(search) ||
      log.error_message?.toLowerCase().includes(search)
    );
  });

  const getStatusIcon = (status: number | null) => {
    if (!status || status === 0) {
      return <XCircle className="w-5 h-5 text-red-500" />;
    } else if (status >= 200 && status < 300) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    } else {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusColor = (status: number | null) => {
    if (!status || status === 0) return 'text-red-600 bg-red-50';
    if (status >= 200 && status < 300) return 'text-green-600 bg-green-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Webhook Activity Logs</h3>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search logs..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <select
          value={logType}
          onChange={(e) => setLogType(e.target.value as LogType)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Logs</option>
          <option value="incoming">Incoming Only</option>
          <option value="outgoing">Outgoing Only</option>
        </select>

        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="1">Last 24 Hours</option>
          <option value="7">Last 7 Days</option>
          <option value="30">Last 30 Days</option>
          <option value="90">Last 90 Days</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No webhook logs found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map((log) => (
            <div key={log.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div
                className="p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    {getStatusIcon(log.response_status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{log.event_type}</span>
                        {log.endpoint_name && (
                          <span className="text-sm text-gray-500">→ {log.endpoint_name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(log.response_status)}`}>
                          {log.response_status || 'Failed'}
                        </span>
                        <span>{log.duration_ms}ms</span>
                      </div>
                    </div>
                    {expandedLog === log.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {log.error_message && (
                  <div className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
                    {log.error_message}
                  </div>
                )}
              </div>

              {expandedLog === log.id && (
                <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-3">
                  {log.request_payload && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Request Payload</h4>
                      <pre className="bg-white p-3 rounded border border-gray-200 text-xs overflow-x-auto">
                        {JSON.stringify(log.request_payload, null, 2)}
                      </pre>
                    </div>
                  )}

                  {log.response_body && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Response</h4>
                      <pre className="bg-white p-3 rounded border border-gray-200 text-xs overflow-x-auto">
                        {log.response_body}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
