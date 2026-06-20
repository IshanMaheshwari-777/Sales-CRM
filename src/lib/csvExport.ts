// @ts-nocheck
import type { Database } from './database.types';
import { supabase } from './supabase';

type Lead = Database['public']['Tables']['leads']['Row'];

export interface LeadExportData extends Lead {
  lead_statuses?: { name: string; display_name: string } | null;
  sub_status?: { name: string; display_name: string } | null;
  profiles?: { full_name: string } | null;
  lead_sources?: { name: string } | null;
}

async function trackDownload(totalRecords: number, filterCriteria: any = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      await (supabase.from('bulk_download_history') as any).insert({
        user_id: user.id,
        download_source: 'Leads',
        total_records: totalRecords,
        filter_criteria: filterCriteria,
        file_format: 'csv',
        status: 'completed',
        completed_at: new Date().toISOString(),
        organization_id: profile?.organization_id || null,
      });
    }
  } catch (error) {
    console.error('Error tracking download:', error);
  }
}

export async function exportLeadsToCSV(leads: LeadExportData[], filename: string = 'leads_export.csv', filterCriteria: any = {}) {
  if (leads.length === 0) {
    // No leads — caller should show appropriate feedback
    return;
  }

  await trackDownload(leads.length, filterCriteria);

  const headers = [
    'ID',
    'Name',
    'First Name',
    'Last Name',
    'Email',
    'Mobile Number',
    'Company/University',
    'Course',
    'Specialization',
    'Status',
    'Sub-Status',
    'Channel',
    'Source',
    'Campaign Name',
    'Campaign ID',
    'Adgroup ID',
    'Keyword',
    'City',
    'State',
    'Country',
    'Pincode',
    'Address Line 1',
    'Address Line 2',
    'Father Name',
    'Mother Name',
    'Current Owner',
    'Call Count',
    'Is Re-enquired',
    'Created At',
    'Updated At',
  ];

  const rows = leads.map(lead => [
    lead.id,
    lead.name || '',
    lead.first_name || '',
    lead.last_name || '',
    lead.email || '',
    lead.mobile_number || '',
    lead.university || lead.company || '',
    lead.course || '',
    lead.specialization || '',
    lead.lead_statuses?.display_name || '',
    lead.sub_status?.display_name || '',
    lead.channel || '',
    lead.lead_sources?.name || '',
    lead.campaign_name || '',
    lead.campaign_id || '',
    lead.adgroup_id || '',
    lead.keyword || '',
    lead.city || '',
    lead.state || '',
    lead.country || '',
    lead.pincode || '',
    lead.address_line1 || '',
    lead.address_line2 || '',
    lead.father_name || '',
    lead.mother_name || '',
    lead.profiles?.full_name || '',
    lead.call_count?.toString() || '0',
    lead.is_re_enquired ? 'Yes' : 'No',
    lead.created_at ? new Date(lead.created_at).toLocaleString() : '',
    lead.updated_at ? new Date(lead.updated_at).toLocaleString() : '',
  ]);

  const csvContent = [
    headers.map(escapeCSVField).join(','),
    ...rows.map(row => row.map(escapeCSVField).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function escapeCSVField(field: string | number): string {
  const stringField = String(field);

  if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
    return `"${stringField.replace(/"/g, '""')}"`;
  }

  return stringField;
}
