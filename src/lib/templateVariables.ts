import { supabase } from './supabase';
import { isIgnorableRequestError } from './requestErrors';

export interface TemplateVariable {
  key: string;
  label: string;
  placeholder: string;
  category: 'counselor' | 'lead';
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { key: 'counselor_name', label: 'Counselor Name', placeholder: 'John Doe', category: 'counselor' },
  { key: 'counselor_first_name', label: 'Counselor First Name', placeholder: 'John', category: 'counselor' },
  { key: 'counselor_last_name', label: 'Counselor Last Name', placeholder: 'Doe', category: 'counselor' },
  { key: 'counselor_mobile', label: 'Counselor Mobile', placeholder: '+91 98765 43210', category: 'counselor' },
  { key: 'counselor_email', label: 'Counselor Email', placeholder: 'john.doe@example.com', category: 'counselor' },
  { key: 'lead_name', label: 'Lead Name', placeholder: 'Jane Smith', category: 'lead' },
  { key: 'lead_first_name', label: 'Lead First Name', placeholder: 'Jane', category: 'lead' },
  { key: 'lead_mobile', label: 'Lead Mobile', placeholder: '+91 12345 67890', category: 'lead' },
  { key: 'lead_email', label: 'Lead Email', placeholder: 'jane.smith@example.com', category: 'lead' },
  { key: 'university', label: 'University', placeholder: 'Sample University', category: 'lead' },
  { key: 'course', label: 'Course', placeholder: 'MBA', category: 'lead' },
];

export interface TemplateData {
  counselorName: string;
  counselorFirstName: string;
  counselorLastName: string;
  counselorMobile: string;
  counselorEmail: string;
  leadName: string;
  leadFirstName: string;
  leadMobile: string;
  leadEmail: string;
  university: string;
  course: string;
}

export async function fetchTemplateData(leadId: string, userId: string): Promise<TemplateData | null> {
  const controller = new AbortController();

  try {
    const [leadResult, counselorResult] = await Promise.all([
      (supabase
        .from('leads')
        .select('first_name, last_name, name, mobile_number, email, university, course')
        .abortSignal(controller.signal)
        .eq('id', leadId)
        .maybeSingle() as any),
      (supabase
        .from('profiles')
        .select('full_name, email, mobile_number')
        .abortSignal(controller.signal)
        .eq('id', userId)
        .maybeSingle() as any)
    ]);

    if (leadResult.error || counselorResult.error || !leadResult.data || !counselorResult.data) {
      const relevantError = leadResult.error || counselorResult.error;
      if (relevantError && !isIgnorableRequestError(relevantError)) {
        console.error('Error fetching template data:', relevantError);
      }
      return null;
    }

    const lead = leadResult.data;
    const counselor = counselorResult.data;

    const counselorFullName = counselor.full_name || '';
    const counselorNameParts = counselorFullName.split(' ');
    const counselorFirstName = counselorNameParts[0] || '';
    const counselorLastName = counselorNameParts.slice(1).join(' ') || '';

    const leadFullName = lead.first_name && lead.last_name
      ? `${lead.first_name} ${lead.last_name}`.trim()
      : lead.name || '';
    const leadFirstName = lead.first_name || lead.name?.split(' ')[0] || '';

    return {
      counselorName: counselorFullName,
      counselorFirstName,
      counselorLastName,
      counselorMobile: counselor.mobile_number || '',
      counselorEmail: counselor.email || '',
      leadName: leadFullName,
      leadFirstName,
      leadMobile: lead.mobile_number || '',
      leadEmail: lead.email || '',
      university: lead.university || '',
      course: lead.course || '',
    };
  } catch (error) {
    if (!isIgnorableRequestError(error)) {
      console.error('Error in fetchTemplateData:', error);
    }
    return null;
  } finally {
    controller.abort();
  }
}

export function replaceTemplateVariables(template: string, data: TemplateData): string {
  let result = template;

  result = result.replace(/\{\{counselor_name\}\}/g, data.counselorName);
  result = result.replace(/\{\{counselor_first_name\}\}/g, data.counselorFirstName);
  result = result.replace(/\{\{counselor_last_name\}\}/g, data.counselorLastName);
  result = result.replace(/\{\{counselor_mobile\}\}/g, data.counselorMobile);
  result = result.replace(/\{\{counselor_email\}\}/g, data.counselorEmail);
  result = result.replace(/\{\{lead_name\}\}/g, data.leadName);
  result = result.replace(/\{\{lead_first_name\}\}/g, data.leadFirstName);
  result = result.replace(/\{\{lead_mobile\}\}/g, data.leadMobile);
  result = result.replace(/\{\{lead_email\}\}/g, data.leadEmail);
  result = result.replace(/\{\{university\}\}/g, data.university);
  result = result.replace(/\{\{course\}\}/g, data.course);

  return result;
}

export function getPreviewData(): TemplateData {
  return {
    counselorName: 'John Doe',
    counselorFirstName: 'John',
    counselorLastName: 'Doe',
    counselorMobile: '+91 98765 43210',
    counselorEmail: 'john.doe@example.com',
    leadName: 'Jane Smith',
    leadFirstName: 'Jane',
    leadMobile: '+91 12345 67890',
    leadEmail: 'jane.smith@example.com',
    university: 'Sample University',
    course: 'MBA',
  };
}

export function insertVariableAtCursor(
  textareaRef: HTMLTextAreaElement,
  variable: string,
  setValue: (value: string) => void
): void {
  const start = textareaRef.selectionStart;
  const end = textareaRef.selectionEnd;
  const text = textareaRef.value;
  const before = text.substring(0, start);
  const after = text.substring(end);
  const variableText = `{{${variable}}}`;
  const newText = before + variableText + after;
  setValue(newText);

  setTimeout(() => {
    textareaRef.focus();
    const newPosition = start + variableText.length;
    textareaRef.setSelectionRange(newPosition, newPosition);
  }, 0);
}

export function validateTemplateVariables(template: string): string[] {
  const variablePattern = /\{\{([^}]+)\}\}/g;
  const matches = template.matchAll(variablePattern);
  const invalidVariables: string[] = [];
  const validKeys = TEMPLATE_VARIABLES.map(v => v.key);

  for (const match of matches) {
    const variableName = match[1].trim();
    if (!validKeys.includes(variableName)) {
      invalidVariables.push(variableName);
    }
  }

  return invalidVariables;
}
