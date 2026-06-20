import Papa from 'papaparse';

export interface CSVParseResult {
  data: Record<string, string>[];
  headers: string[];
  errors: Array<{ row: number; message: string }>;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidatedRow {
  rowNumber: number;
  data: Record<string, string>;
  isValid: boolean;
  isDuplicate: boolean;
  errors: ValidationError[];
  existingLeadId?: string;
}

export const parseCSVFile = (file: File): Promise<CSVParseResult> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header: string) => header.trim(),
      transform: (value: string) => value.trim(),
      complete: (results) => {
        const errors: Array<{ row: number; message: string }> = [];

        results.errors.forEach((error) => {
          errors.push({
            row: error.row || 0,
            message: error.message,
          });
        });

        const headers = results.meta.fields || [];
        const data = results.data as Record<string, string>[];

        resolve({
          data,
          headers,
          errors,
        });
      },
      error: (error) => {
        reject(new Error(`Failed to parse CSV: ${error.message}`));
      },
    });
  });
};

export const validateMobileNumber = (mobile: string): boolean => {
  if (!mobile) return false;

  const cleaned = mobile.replace(/[\s\-\(\)]/g, '');
  const mobileRegex = /^(\+91)?[6-9]\d{9}$/;

  return mobileRegex.test(cleaned);
};

export const normalizeMobileNumber = (mobile: string): string => {
  if (!mobile) return '';

  const cleaned = mobile.replace(/[\s\-\(\)]/g, '');

  if (cleaned.startsWith('+91')) {
    return cleaned.substring(3);
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    return cleaned.substring(2);
  }

  return cleaned;
};

export const validateEmail = (email: string): boolean => {
  if (!email) return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateLeadRow = (
  row: Record<string, string>,
  _rowNumber: number,
  requiredFields: string[] = ['mobile_number', 'first_name', 'email', 'channel', 'source', 'campaign_name']
): { isValid: boolean; errors: ValidationError[] } => {
  const errors: ValidationError[] = [];

  requiredFields.forEach((field) => {
    if (!row[field] || row[field].trim() === '') {
      errors.push({
        field,
        message: `${field.replace(/_/g, ' ')} is required`,
      });
    }
  });

  if (row.mobile_number) {
    if (!validateMobileNumber(row.mobile_number)) {
      errors.push({
        field: 'mobile_number',
        message: 'Invalid mobile number format. Must be 10 digits starting with 6-9',
      });
    }
  }

  if (row.email && !validateEmail(row.email)) {
    errors.push({
      field: 'email',
      message: 'Invalid email format',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const autoDetectColumnMapping = (csvHeaders: string[]): Record<string, string> => {
  const mapping: Record<string, string> = {};

  const fieldMappings: Record<string, string[]> = {
    mobile_number: ['mobile', 'mobile_number', 'mobile number', 'phone', 'contact', 'mobile no'],
    first_name: ['first_name', 'first name', 'firstname', 'fname', 'given name'],
    last_name: ['last_name', 'last name', 'lastname', 'lname', 'surname', 'family name'],
    email: ['email', 'email address', 'e-mail', 'mail'],
    university: ['university', 'college', 'institution', 'school'],
    course: ['course', 'program', 'degree'],
    specialization: ['specialization', 'specialisation', 'branch', 'stream', 'major'],
    city: ['city', 'town'],
    country: ['country', 'nation'],
    channel: ['channel', 'source channel', 'lead channel'],
    source: ['source', 'lead source', 'origin', 'lead origin'],
    campaign_name: ['campaign_name', 'campaign name', 'campaign'],
  };

  csvHeaders.forEach((header) => {
    const normalizedHeader = header.toLowerCase().trim();

    for (const [systemField, variations] of Object.entries(fieldMappings)) {
      if (variations.some((variation) => normalizedHeader === variation || normalizedHeader.includes(variation))) {
        if (!mapping[systemField]) {
          mapping[systemField] = header;
        }
      }
    }
  });

  return mapping;
};

export const formatErrorReport = (validatedRows: ValidatedRow[]): string => {
  const errorRows = validatedRows.filter((row) => !row.isValid || row.errors.length > 0);

  if (errorRows.length === 0) {
    return '';
  }

  const headers = ['Row Number', 'Error Type', 'Error Message', 'Field', 'Value'];
  const rows: string[][] = [];

  errorRows.forEach((row) => {
    row.errors.forEach((error) => {
      rows.push([
        row.rowNumber.toString(),
        'Validation Error',
        error.message,
        error.field,
        row.data[error.field] || '',
      ]);
    });
  });

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  return csvContent;
};

export const downloadCSV = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

export const getFieldDescription = (field: string): string => {
  const descriptions: Record<string, string> = {
    mobile_number: 'Required. 10-digit mobile number (6-9 followed by 9 digits)',
    first_name: 'Required. First name of the lead',
    last_name: 'Last name of the lead',
    email: 'Required. Valid email address',
    university: 'Name of university or institution',
    course: 'Course or program name',
    specialization: 'Specialization or branch',
    city: 'City name',
    country: 'Country name',
    channel: 'Required. Lead source channel (e.g., Google, Facebook)',
    source: 'Required. Lead source (e.g., Website, Referral)',
    campaign_name: 'Required. Marketing campaign name',
  };

  return descriptions[field] || '';
};

export const MAX_FILE_SIZE_MB = 20;
export const MAX_ROWS = 50000;
export const BATCH_SIZE = 100;
