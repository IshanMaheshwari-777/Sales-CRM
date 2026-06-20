// @ts-nocheck
import { useState, useEffect } from 'react';
import { Download, FileText, CheckCircle, XCircle, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { downloadCSV } from '../../lib/csvUtils';

interface BulkUploadJob {
  id: string;
  filename: string;
  file_size_bytes: number;
  total_rows: number;
  processed_rows: number;
  successful_rows: number;
  failed_rows: number;
  skipped_rows: number;
  duplicate_handling_strategy: string;
  status: string;
  error_log: any[];
  uploaded_at: string;
  completed_at: string | null;
}

interface UploadHistoryProps {
  onClose: () => void;
}

export default function UploadHistory({ onClose }: UploadHistoryProps) {
  const [jobs, setJobs] = useState<BulkUploadJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<BulkUploadJob | null>(null);

  useEffect(() => {
    loadUploadHistory();
  }, []);

  const loadUploadHistory = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('bulk_upload_jobs')
        .select('*')
        .order('uploaded_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setJobs(data || []);
    } catch (error) {
      console.error('Error loading upload history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'processing':
      case 'validating':
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'cancelled':
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      processing: 'bg-blue-100 text-blue-800',
      validating: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number) => {
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(2)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  const handleDownloadErrorReport = (job: BulkUploadJob) => {
    if (job.error_log && job.error_log.length > 0) {
      const errorData = job.error_log.map((err: any) => ({
        'Row Number': err.rowNumber,
        ...err.data,
        Errors: err.errors.join('; '),
      }));

      const headers = Object.keys(errorData[0]);
      const csvContent = [
        headers.join(','),
        ...errorData.map((row: any) =>
          headers.map((h) => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\n');

      downloadCSV(csvContent, `upload_errors_${job.id}_${new Date().toISOString().split('T')[0]}.csv`);
    }
  };

  const getSuccessRate = (job: BulkUploadJob) => {
    if (job.total_rows === 0) return 0;
    return Math.round((job.successful_rows / job.total_rows) * 100);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Upload History</h2>
            <p className="text-sm text-gray-600 mt-1">
              View and manage your past bulk upload jobs
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <FileText className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Upload History</h3>
              <p className="text-gray-600">
                You haven't performed any bulk uploads yet. Start by uploading your first CSV file.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3 flex-1">
                      {getStatusIcon(job.status)}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="font-semibold text-gray-900">{job.filename}</h4>
                          {getStatusBadge(job.status)}
                        </div>
                        <p className="text-sm text-gray-600">
                          Uploaded on {formatDate(job.uploaded_at)} • {formatFileSize(job.file_size_bytes)}
                        </p>
                      </div>
                    </div>

                    {job.error_log && job.error_log.length > 0 && (
                      <button
                        onClick={() => handleDownloadErrorReport(job)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                      >
                        <Download className="w-4 h-4" />
                        Error Report
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-600 mb-1">Total Rows</p>
                      <p className="text-lg font-bold text-gray-900">{job.total_rows}</p>
                    </div>

                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs text-green-700 mb-1">Successful</p>
                      <p className="text-lg font-bold text-green-900">{job.successful_rows}</p>
                    </div>

                    <div className="bg-yellow-50 rounded-lg p-3">
                      <p className="text-xs text-yellow-700 mb-1">Skipped</p>
                      <p className="text-lg font-bold text-yellow-900">{job.skipped_rows}</p>
                    </div>

                    <div className="bg-red-50 rounded-lg p-3">
                      <p className="text-xs text-red-700 mb-1">Failed</p>
                      <p className="text-lg font-bold text-red-900">{job.failed_rows}</p>
                    </div>
                  </div>

                  {job.status === 'completed' && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-900">Success Rate</span>
                        <span className="text-sm font-bold text-blue-900">{getSuccessRate(job)}%</span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${getSuccessRate(job)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {job.status === 'processing' && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-900">Progress</span>
                        <span className="text-sm font-bold text-blue-900">
                          {job.processed_rows} / {job.total_rows}
                        </span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${(job.processed_rows / job.total_rows) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>
                        Duplicate Strategy:{' '}
                        <span className="font-medium">
                          {job.duplicate_handling_strategy === 'skip'
                            ? 'Skip Duplicates'
                            : job.duplicate_handling_strategy === 'update'
                            ? 'Update Existing'
                            : 'Create New'}
                        </span>
                      </span>
                      {job.completed_at && (
                        <span>
                          Completed: {formatDate(job.completed_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
