// @ts-nocheck
import { useState, useRef } from 'react';
import { X, Upload, Download, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { downloadLeadTemplate } from '../../lib/csvTemplates';
import {
  parseCSVFile,
  autoDetectColumnMapping,
  validateLeadRow,
  MAX_FILE_SIZE_MB,
  MAX_ROWS,
  formatErrorReport,
  downloadCSV,
  ValidatedRow,
} from '../../lib/csvUtils';
import { BulkUploadProcessor, DuplicateStrategy } from '../../lib/bulkUploadProcessor';
import ColumnMapper from './ColumnMapper';
import ValidationPreview from './ValidationPreview';
import UploadProgress from './UploadProgress';
import type { ProcessingProgress } from '../../lib/bulkUploadProcessor';

interface BulkUploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'upload' | 'mapping' | 'duplicate' | 'preview' | 'processing' | 'complete';

export default function BulkUploadModal({ onClose, onSuccess }: BulkUploadModalProps) {
  const { showError } = useToast();
  const [currentStep, setCurrentStep] = useState<Step>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('skip');
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [uploadProgress, setUploadProgress] = useState<ProcessingProgress>({
    totalRows: 0,
    processedRows: 0,
    successfulRows: 0,
    failedRows: 0,
    skippedRows: 0,
    currentBatch: 0,
    totalBatches: 0,
  });
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {

    if (!file.name.endsWith('.csv')) {
      showError('Please select a CSV file');
      return;
    }

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      showError(`File size must be less than ${MAX_FILE_SIZE_MB}MB. Your file is ${fileSizeMB.toFixed(2)}MB`);
      return;
    }

    try {
      setIsProcessing(true);
      const result = await parseCSVFile(file);

      if (result.errors.length > 0) {
        showError(`CSV parsing errors: ${result.errors.map((e) => e.message).join(', ')}`);
        setIsProcessing(false);
        return;
      }

      if (result.data.length === 0) {
        showError('CSV file is empty');
        setIsProcessing(false);
        return;
      }

      if (result.data.length > MAX_ROWS) {
        showError(`CSV file contains ${result.data.length} rows. Maximum allowed is ${MAX_ROWS} rows`);
        setIsProcessing(false);
        return;
      }

      setSelectedFile(file);
      setCsvData(result.data);
      setCsvHeaders(result.headers);

      const detectedMapping = autoDetectColumnMapping(result.headers);
      setColumnMapping(detectedMapping);

      setCurrentStep('mapping');
    } catch (err) {
      showError((err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleNextFromMapping = () => {
    const requiredFields = ['mobile_number', 'first_name', 'email', 'channel', 'source', 'campaign_name'];
    const missingFields = requiredFields.filter(field => !columnMapping[field]);

    if (missingFields.length > 0) {
      const fieldLabels = missingFields.map(field => field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
      showError(`The following required fields must be mapped: ${fieldLabels.join(', ')}`);
      return;
    }

    setCurrentStep('duplicate');
  };

  const handleNextFromDuplicate = async () => {
    setIsProcessing(true);

    try {
      const processor = new BulkUploadProcessor();
      const duplicateMap = await processor.detectDuplicates(csvData, columnMapping);

      const validated: ValidatedRow[] = csvData.map((row, index) => {
        const mappedData: Record<string, string> = {};
        Object.entries(columnMapping).forEach(([systemField, csvField]) => {
          if (csvField && row[csvField] !== undefined) {
            mappedData[systemField] = row[csvField];
          }
        });

        const validation = validateLeadRow(mappedData, index + 1);
        const isDuplicate = duplicateMap.has(index);

        return {
          rowNumber: index + 1,
          data: row,
          isValid: validation.isValid,
          isDuplicate,
          errors: validation.errors,
          existingLeadId: duplicateMap.get(index),
        };
      });

      setValidatedRows(validated);
      setCurrentStep('preview');
    } catch (err) {
      showError((err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartUpload = async () => {
    setCurrentStep('processing');
    setIsProcessing(true);

    try {
      const processor = new BulkUploadProcessor();

      const jobId = await processor.createUploadJob(
        selectedFile!.name,
        selectedFile!.size,
        csvData.length,
        duplicateStrategy,
        columnMapping
      );

      const result = await processor.processUpload(
        jobId,
        csvData,
        columnMapping,
        duplicateStrategy,
        (progress) => {
          setUploadProgress(progress);
        }
      );

      setUploadResult(result);
      setCurrentStep('complete');
      onSuccess();
    } catch (err) {
      showError((err as Error).message);
      setCurrentStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadErrorReport = () => {
    if (uploadResult && uploadResult.errors.length > 0) {
      const errorData = uploadResult.errors.map((err: any) => ({
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

      downloadCSV(csvContent, `upload_errors_${new Date().toISOString().split('T')[0]}.csv`);
    }
  };

  const handleBack = () => {
    if (currentStep === 'mapping') setCurrentStep('upload');
    else if (currentStep === 'duplicate') setCurrentStep('mapping');
    else if (currentStep === 'preview') setCurrentStep('duplicate');
  };

  const handleReset = () => {
    setCurrentStep('upload');
    setSelectedFile(null);
    setCsvData([]);
    setCsvHeaders([]);
    setColumnMapping({});
    setDuplicateStrategy('skip');
    setValidatedRows([]);
    setUploadProgress({
      totalRows: 0,
      processedRows: 0,
      successfulRows: 0,
      failedRows: 0,
      skippedRows: 0,
      currentBatch: 0,
      totalBatches: 0,
    });
    setUploadResult(null);
    setIsProcessing(false);
  };

  const getStepNumber = (step: Step): number => {
    const steps: Step[] = ['upload', 'mapping', 'duplicate', 'preview', 'processing', 'complete'];
    return steps.indexOf(step) + 1;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Bulk Lead Upload</h2>
            <p className="text-sm text-gray-600 mt-1">
              Import multiple leads from a CSV file
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isProcessing && currentStep === 'processing'}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {currentStep !== 'processing' && currentStep !== 'complete' && (
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              {['Upload', 'Mapping', 'Duplicates', 'Preview'].map((label, index) => {
                const stepNumber = index + 1;
                const isActive = getStepNumber(currentStep) === stepNumber;
                const isCompleted = getStepNumber(currentStep) > stepNumber;

                return (
                  <div key={label} className="flex items-center flex-1">
                    <div className="flex items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                          isCompleted
                            ? 'bg-green-600 text-white'
                            : isActive
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {isCompleted ? <CheckCircle className="w-5 h-5" /> : stepNumber}
                      </div>
                      <span
                        className={`ml-2 font-medium ${
                          isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                    {index < 3 && (
                      <div
                        className={`flex-1 h-1 mx-4 ${
                          isCompleted ? 'bg-green-600' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {currentStep === 'upload' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-blue-900 mb-2">Before you begin</p>
                    <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                      <li>Maximum file size: {MAX_FILE_SIZE_MB}MB</li>
                      <li>Maximum rows: {MAX_ROWS.toLocaleString()} leads per upload</li>
                      <li>Required fields: Mobile Number, First Name, Email, Channel, Source, Campaign Name, Stage, Sub Stage</li>
                      <li>Supported format: CSV files only</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={() => downloadLeadTemplate()}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  <Download className="w-5 h-5" />
                  Download CSV Template
                </button>
              </div>

              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Drop your CSV file here, or click to browse
                </p>
                <p className="text-sm text-gray-600">
                  Accepted format: CSV (up to {MAX_FILE_SIZE_MB}MB)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>

              {selectedFile && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-8 h-8 text-blue-600" />
                      <div>
                        <p className="font-medium text-gray-900">{selectedFile.name}</p>
                        <p className="text-sm text-gray-600">
                          {(selectedFile.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 'mapping' && (
            <ColumnMapper
              csvHeaders={csvHeaders}
              initialMapping={columnMapping}
              onMappingChange={setColumnMapping}
            />
          )}

          {currentStep === 'duplicate' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-blue-900 mb-1">Duplicate Handling</p>
                    <p className="text-sm text-blue-800">
                      Choose how to handle leads with mobile numbers that already exist in the system.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-start gap-4 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 transition-colors">
                  <input
                    type="radio"
                    name="duplicateStrategy"
                    value="skip"
                    checked={duplicateStrategy === 'skip'}
                    onChange={(e) => setDuplicateStrategy(e.target.value as DuplicateStrategy)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Skip Duplicates</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Don't import leads with existing mobile numbers. They will be marked as skipped
                      in the report.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-4 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 transition-colors">
                  <input
                    type="radio"
                    name="duplicateStrategy"
                    value="update"
                    checked={duplicateStrategy === 'update'}
                    onChange={(e) => setDuplicateStrategy(e.target.value as DuplicateStrategy)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Update Existing Leads</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Update existing leads with new information from the CSV. Existing data will be
                      overwritten for mapped fields.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-4 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 transition-colors">
                  <input
                    type="radio"
                    name="duplicateStrategy"
                    value="create_new"
                    checked={duplicateStrategy === 'create_new'}
                    onChange={(e) => setDuplicateStrategy(e.target.value as DuplicateStrategy)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Create as Re-enquiries</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Import duplicates as new leads and mark them as re-enquiries. Use this for
                      tracking repeat interest.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {currentStep === 'preview' && (
            <ValidationPreview validatedRows={validatedRows} columnMapping={columnMapping} />
          )}

          {currentStep === 'processing' && (
            <UploadProgress progress={uploadProgress} isComplete={false} />
          )}

          {currentStep === 'complete' && uploadResult && (
            <div className="space-y-6">
              <UploadProgress progress={uploadProgress} isComplete={true} />

              <div className="flex gap-4 justify-center">
                {uploadResult.errors.length > 0 && (
                  <button
                    onClick={handleDownloadErrorReport}
                    className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    <Download className="w-5 h-5" />
                    Download Error Report ({uploadResult.errors.length} rows)
                  </button>
                )}

                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Upload className="w-5 h-5" />
                  Upload Another File
                </button>
              </div>
            </div>
          )}
        </div>

        {currentStep !== 'processing' && currentStep !== 'complete' && (
          <div className="flex items-center justify-between p-6 border-t border-gray-200">
            <button
              onClick={handleBack}
              disabled={currentStep === 'upload' || isProcessing}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>

            <button
              onClick={() => {
                if (currentStep === 'mapping') handleNextFromMapping();
                else if (currentStep === 'duplicate') handleNextFromDuplicate();
                else if (currentStep === 'preview') handleStartUpload();
              }}
              disabled={
                isProcessing ||
                (currentStep === 'mapping' &&
                  (!columnMapping.mobile_number || !columnMapping.first_name || !columnMapping.email ||
                   !columnMapping.channel || !columnMapping.source || !columnMapping.campaign_name)) ||
                (currentStep === 'preview' && validatedRows.every((r) => !r.isValid))
              }
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {currentStep === 'preview' ? 'Start Upload' : 'Next'}
            </button>
          </div>
        )}

        {currentStep === 'complete' && (
          <div className="flex items-center justify-end p-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
