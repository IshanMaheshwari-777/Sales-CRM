// @ts-nocheck
import { supabase } from '../lib/supabase';

export type ActivityType =
  | 'lead_created'
  | 'lead_created_bulk'
  | 'lead_edited'
  | 'status_changed'
  | 'sub_status_changed'
  | 'ownership_transferred'
  | 'lead_referred'
  | 'comment_added'
  | 'followup_created'
  | 'call_logged'
  | 'email_sent'
  | 'whatsapp_sent'
  | 'lead_deleted';

interface ActivityLogParams {
  leadId: string;
  userId: string;
  activityType: ActivityType;
  activityDescription: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  metadata?: Record<string, any>;
}

interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
}

const FIELD_DISPLAY_NAMES: Record<string, string> = {
  first_name: 'First Name',
  last_name: 'Last Name',
  name: 'Name',
  email: 'Email',
  mobile_number: 'Mobile Number',
  company: 'University',
  course: 'Course',
  channel: 'Channel',
  source_id: 'Source',
  campaign_name: 'Campaign Name',
  campaign_id: 'Campaign ID',
  adgroup_id: 'Ad Group ID',
  keyword: 'Keyword',
  country: 'Country',
  city: 'City',
  status_id: 'Status',
  sub_status_id: 'Sub-Status',
  assigned_to: 'Lead Owner',
};

function getFieldDisplayName(fieldName: string): string {
  return FIELD_DISPLAY_NAMES[fieldName] || fieldName.split('_').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

function formatValue(value: any): string {
  if (value === null || value === undefined || value === '') return 'Empty';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

async function logActivity(params: ActivityLogParams): Promise<void> {
  try {
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('organization_id')
      .eq('id', params.leadId)
      .maybeSingle();

    if (leadError) {
      console.warn('Could not find lead organization:', leadError);
    }

    const { error } = await (supabase
      .from('lead_activity_log')
      .insert({
        lead_id: params.leadId,
        user_id: params.userId,
        activity_type: params.activityType,
        activity_description: params.activityDescription,
        field_name: params.fieldName,
        old_value: params.oldValue,
        new_value: params.newValue,
        metadata: params.metadata,
        organization_id: lead?.organization_id || null,
      }) as any);

    if (error) {
      console.error('Failed to log activity:', error);
    }
  } catch (err) {
    console.error('Activity logging error:', err);
  }
}

export async function logLeadCreated(leadId: string, userId: string, userName: string, isBulkUpload: boolean = false, jobId?: string): Promise<void> {
  const description = isBulkUpload && jobId
    ? `${userName} created this lead via bulk upload (Job #${jobId})`
    : `${userName} created this lead`;

  await logActivity({
    leadId,
    userId,
    activityType: isBulkUpload ? 'lead_created_bulk' : 'lead_created',
    activityDescription: description,
    metadata: isBulkUpload ? { job_id: jobId } : undefined,
  });
}

export async function logLeadEdited(
  leadId: string,
  userId: string,
  userName: string,
  changes: FieldChange[]
): Promise<void> {
  for (const change of changes) {
    const fieldDisplayName = getFieldDisplayName(change.field);
    const oldValueStr = formatValue(change.oldValue);
    const newValueStr = formatValue(change.newValue);

    const description = `${userName} changed ${fieldDisplayName} from "${oldValueStr}" to "${newValueStr}"`;

    await logActivity({
      leadId,
      userId,
      activityType: 'lead_edited',
      activityDescription: description,
      fieldName: change.field,
      oldValue: oldValueStr,
      newValue: newValueStr,
    });
  }
}

export async function logStatusChange(
  leadId: string,
  userId: string,
  userName: string,
  oldStatus: string,
  newStatus: string,
  isSubStatus: boolean = false
): Promise<void> {
  const description = `${userName} changed ${isSubStatus ? 'sub-status' : 'status'} from ${oldStatus} to ${newStatus}`;

  await logActivity({
    leadId,
    userId,
    activityType: isSubStatus ? 'sub_status_changed' : 'status_changed',
    activityDescription: description,
    oldValue: oldStatus,
    newValue: newStatus,
  });
}

export async function logOwnershipChange(
  leadId: string,
  userId: string,
  userName: string,
  oldOwnerName: string,
  newOwnerName: string,
  isRefer: boolean = false
): Promise<void> {
  const description = isRefer
    ? `${userName} referred this lead to ${newOwnerName}`
    : `${userName} transferred lead from ${oldOwnerName} to ${newOwnerName}`;

  await logActivity({
    leadId,
    userId,
    activityType: isRefer ? 'lead_referred' : 'ownership_transferred',
    activityDescription: description,
    oldValue: oldOwnerName,
    newValue: newOwnerName,
  });
}

export async function logCommentAdded(
  leadId: string,
  userId: string,
  userName: string,
  commentPreview?: string
): Promise<void> {
  const description = commentPreview
    ? `${userName} added a comment: "${commentPreview.substring(0, 50)}${commentPreview.length > 50 ? '...' : ''}"`
    : `${userName} added a comment`;

  await logActivity({
    leadId,
    userId,
    activityType: 'comment_added',
    activityDescription: description,
    metadata: commentPreview ? { comment_preview: commentPreview } : undefined,
  });
}

export async function logFollowupCreated(
  leadId: string,
  userId: string,
  userName: string,
  followupDate: string,
  remarks?: string
): Promise<void> {
  const formattedDate = new Date(followupDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const description = `${userName} scheduled a follow-up for ${formattedDate}`;

  await logActivity({
    leadId,
    userId,
    activityType: 'followup_created',
    activityDescription: description,
    metadata: { followup_date: followupDate, remarks },
  });
}

export async function logCallLogged(
  leadId: string,
  userId: string,
  userName: string,
  callOutcome: string,
  callDuration?: string,
  notes?: string
): Promise<void> {
  const durationText = callDuration ? ` (${callDuration})` : '';
  const description = `${userName} logged a ${callOutcome} call${durationText}`;

  await logActivity({
    leadId,
    userId,
    activityType: 'call_logged',
    activityDescription: description,
    metadata: { call_outcome: callOutcome, call_duration: callDuration, notes },
  });
}

export async function logEmailSent(
  leadId: string,
  userId: string,
  userName: string,
  subject: string,
  body?: string
): Promise<void> {
  const description = `${userName} sent an email: "${subject}"`;

  await logActivity({
    leadId,
    userId,
    activityType: 'email_sent',
    activityDescription: description,
    metadata: { email_subject: subject, email_body: body },
  });
}

export async function logWhatsAppSent(
  leadId: string,
  userId: string,
  userName: string,
  messagePreview?: string
): Promise<void> {
  const description = messagePreview
    ? `${userName} sent a WhatsApp message: "${messagePreview.substring(0, 50)}${messagePreview.length > 50 ? '...' : ''}"`
    : `${userName} sent a WhatsApp message`;

  await logActivity({
    leadId,
    userId,
    activityType: 'whatsapp_sent',
    activityDescription: description,
    metadata: messagePreview ? { message_preview: messagePreview } : undefined,
  });
}

export async function getLeadActivities(
  leadId: string,
  options?: {
    limit?: number;
    offset?: number;
    activityTypes?: ActivityType[];
    isPinned?: boolean;
    startDate?: string;
    endDate?: string;
    searchQuery?: string;
  }
) {
  let query = supabase
      .from('lead_activity_log')
      .select(`
        *,
        profiles:user_id (
          id,
          full_name,
          email
        )
      `)
      .eq('lead_id', leadId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false }) as any;

  if (options?.activityTypes && options.activityTypes.length > 0) {
    query = query.in('activity_type', options.activityTypes);
  }

  if (options?.isPinned !== undefined) {
    query = query.eq('is_pinned', options.isPinned);
  }

  if (options?.startDate) {
    query = query.gte('created_at', options.startDate);
  }

  if (options?.endDate) {
    query = query.lte('created_at', options.endDate);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch activities:', error);
    return [];
  }

  let activities = data || [];

  if (options?.searchQuery) {
    const searchLower = options.searchQuery.toLowerCase();
    activities = activities.filter(activity =>
      activity.activity_description.toLowerCase().includes(searchLower) ||
      (activity.profiles as any)?.full_name?.toLowerCase().includes(searchLower) ||
      activity.old_value?.toLowerCase().includes(searchLower) ||
      activity.new_value?.toLowerCase().includes(searchLower)
    );
  }

  return activities;
}

export async function toggleActivityPin(activityId: string, isPinned: boolean): Promise<boolean> {
  try {
    const { error } = await (supabase
      .from('lead_activity_log')
      .update({ is_pinned: isPinned })
      .eq('id', activityId) as any);

    if (error) {
      console.error('Failed to toggle pin:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Pin toggle error:', err);
    return false;
  }
}

export async function getActivityStats(leadId: string) {
  try {
    const { data, error } = await supabase.rpc('get_lead_activity_stats', { p_lead_id: leadId });

    if (error) {
      console.error('Failed to fetch activity stats:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Activity stats error:', err);
    return null;
  }
}
