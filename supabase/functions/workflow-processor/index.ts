import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

type Workflow = {
  id: string;
  organization_id: string;
  name: string;
  category: 'UPDATE_ATTRIBUTES' | 'SEND_IMMEDIATE_COMMUNICATION';
  start_at: string;
  is_active: boolean;
};

type WorkflowCondition = {
  id: string;
  field_key: string;
  operator: string;
  value_json: Record<string, unknown>;
  logical_gate?: 'AND' | 'OR';
};

type WorkflowAction = {
  id: string;
  position: number;
  action_type: 'update_field' | 'create_followup' | 'send_email';
  payload_json: Record<string, unknown>;
};

type Lead = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  mobile_number: string | null;
  status_id: string | null;
  sub_status_id: string | null;
  source_id: string | null;
  current_lead_owner: string | null;
  channel: string | null;
  campaign_name: string | null;
  country: string | null;
  city: string | null;
  call_count: number | null;
  is_re_enquired: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  organization_id: string | null;
  university: string | null;
  course: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  mobile_number: string | null;
};

function normalizeString(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function replaceTemplateVariables(template: string, lead: Lead, counselor?: Profile | null) {
  const leadName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.name || '';
  const leadFirstName = lead.first_name || lead.name?.split(' ')[0] || '';
  const counselorName = counselor?.full_name || '';
  const counselorFirstName = counselorName.split(' ')[0] || '';
  const counselorLastName = counselorName.split(' ').slice(1).join(' ') || '';

  return template
    .replace(/\{\{counselor_name\}\}/g, counselorName)
    .replace(/\{\{counselor_first_name\}\}/g, counselorFirstName)
    .replace(/\{\{counselor_last_name\}\}/g, counselorLastName)
    .replace(/\{\{counselor_mobile\}\}/g, counselor?.mobile_number || '')
    .replace(/\{\{counselor_email\}\}/g, counselor?.email || '')
    .replace(/\{\{lead_name\}\}/g, leadName)
    .replace(/\{\{lead_first_name\}\}/g, leadFirstName)
    .replace(/\{\{lead_mobile\}\}/g, lead.mobile_number || '')
    .replace(/\{\{lead_email\}\}/g, lead.email || '')
    .replace(/\{\{university\}\}/g, lead.university || '')
    .replace(/\{\{course\}\}/g, lead.course || '');
}

function getLeadValue(lead: Lead, fieldKey: string): unknown {
  if (fieldKey === 'lead_age_days') {
    if (!lead.created_at) return null;
    const createdAt = new Date(lead.created_at).getTime();
    return Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24));
  }

  return (lead as Record<string, unknown>)[fieldKey];
}

function matchesCondition(lead: Lead, condition: WorkflowCondition) {
  const rawLeadValue = getLeadValue(lead, condition.field_key);
  const comparisonValue = condition.value_json?.value;
  const comparisonValues = Array.isArray(condition.value_json?.values) ? condition.value_json.values : [];

  switch (condition.operator) {
    case 'equals':
      return normalizeString(rawLeadValue) === normalizeString(comparisonValue);
    case 'not_equals':
      return normalizeString(rawLeadValue) !== normalizeString(comparisonValue);
    case 'contains':
      return normalizeString(rawLeadValue).includes(normalizeString(comparisonValue));
    case 'greater_than':
      return Number(rawLeadValue ?? 0) > Number(comparisonValue ?? 0);
    case 'less_than':
      return Number(rawLeadValue ?? 0) < Number(comparisonValue ?? 0);
    case 'on_or_after':
      return rawLeadValue ? new Date(String(rawLeadValue)) >= new Date(String(comparisonValue)) : false;
    case 'on_or_before':
      return rawLeadValue ? new Date(String(rawLeadValue)) <= new Date(String(comparisonValue)) : false;
    case 'in':
      return comparisonValues.map(normalizeString).includes(normalizeString(rawLeadValue));
    case 'not_in':
      return !comparisonValues.map(normalizeString).includes(normalizeString(rawLeadValue));
    case 'is_true':
      return rawLeadValue === true;
    case 'is_false':
      return rawLeadValue === false;
    default:
      return false;
  }
}

function matchesWorkflow(lead: Lead, conditions: WorkflowCondition[]) {
  if (conditions.length === 0) return true;

  return conditions.slice(1).reduce((currentResult, condition) => {
    const conditionResult = matchesCondition(lead, condition);
    return condition.logical_gate === 'OR'
      ? currentResult || conditionResult
      : currentResult && conditionResult;
  }, matchesCondition(lead, conditions[0]));
}

async function logExecution(
  supabase: any,
  workflowId: string,
  enrollmentId: string | null,
  leadId: string | null,
  actionIndex: number | null,
  actionType: string | null,
  status: 'success' | 'failed' | 'skipped',
  message: string,
  details: Record<string, unknown> = {},
) {
  await supabase.from('workflow_execution_logs').insert({
    workflow_id: workflowId,
    enrollment_id: enrollmentId,
    lead_id: leadId,
    action_index: actionIndex,
    action_type: actionType,
    status,
    message,
    details,
  });
}

async function loadWorkflowBundle(supabase: any, workflowId: string) {
  const [{ data: workflow }, { data: conditions }, { data: actions }] = await Promise.all([
    supabase.from('workflows').select('*').eq('id', workflowId).single(),
    supabase.from('workflow_conditions').select('*').eq('workflow_id', workflowId).order('position'),
    supabase.from('workflow_actions').select('*').eq('workflow_id', workflowId).order('position'),
  ]);

  return {
    workflow: workflow as Workflow,
    conditions: (conditions || []) as WorkflowCondition[],
    actions: (actions || []) as WorkflowAction[],
  };
}

async function getLeadOwnerProfile(supabase: any, lead: Lead) {
  if (!lead.current_lead_owner) return null;
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, mobile_number')
    .eq('id', lead.current_lead_owner)
    .maybeSingle();
  return (data || null) as Profile | null;
}

async function enrollEligibleLeads(supabase: any) {
  const nowIso = new Date().toISOString();
  const { data: workflows } = await supabase
    .from('workflows')
    .select('*')
    .eq('is_active', true)
    .lte('start_at', nowIso);

  let createdEnrollments = 0;

  for (const workflow of (workflows || []) as Workflow[]) {
    const { conditions } = await loadWorkflowBundle(supabase, workflow.id);
    const { data: leads } = await supabase
      .from('leads')
      .select('id, email, first_name, last_name, name, mobile_number, status_id, sub_status_id, source_id, current_lead_owner, channel, campaign_name, country, city, call_count, is_re_enquired, created_at, updated_at, organization_id, university, course')
      .eq('organization_id', workflow.organization_id);

    for (const lead of (leads || []) as Lead[]) {
      if (!matchesWorkflow(lead, conditions)) {
        continue;
      }

      const { error } = await supabase
        .from('workflow_enrollments')
        .insert({
          workflow_id: workflow.id,
          lead_id: lead.id,
          status: 'pending',
          current_action_index: 0,
          next_run_at: new Date().toISOString(),
        });

      if (!error) {
        createdEnrollments += 1;
        await logExecution(supabase, workflow.id, null, lead.id, null, null, 'success', 'Lead enrolled in workflow');
      }
    }
  }

  return createdEnrollments;
}

async function executeAction(supabase: any, enrollment: any, action: WorkflowAction, lead: Lead) {
  switch (action.action_type) {
    case 'update_field': {
      const fieldKey = String(action.payload_json.fieldKey || '');
      const value = action.payload_json.value;

      if (!fieldKey) {
        throw new Error('Missing fieldKey in update action');
      }

      const { error } = await supabase
        .from('leads')
        .update({ [fieldKey]: value })
        .eq('id', lead.id);

      if (error) throw error;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', enrollment.workflow?.created_by || '')
        .maybeSingle();

      await supabase.from('lead_activity_log').insert({
        lead_id: lead.id,
        user_id: enrollment.workflow?.created_by || null,
        activity_type: 'lead_edited',
        activity_description: `${profile?.full_name || 'Workflow automation'} updated ${fieldKey} via workflow "${enrollment.workflow?.name || ''}"`,
        field_name: fieldKey,
        old_value: null,
        new_value: value == null ? null : String(value),
        metadata: { workflow_id: enrollment.workflow_id, action_type: action.action_type },
        organization_id: lead.organization_id,
      });

      return `Updated ${fieldKey}`;
    }
    case 'create_followup': {
      const offsetDays = Number(action.payload_json.offsetDays || 0);
      const time = String(action.payload_json.time || '09:00');
      const remarks = String(action.payload_json.remarks || 'Workflow follow-up');
      const assignToType = String(action.payload_json.assignToType || 'current_owner');
      const assignedUserId = assignToType === 'specific_user'
        ? String(action.payload_json.userId || '')
        : lead.current_lead_owner || '';

      if (!assignedUserId) {
        throw new Error('No assignee available for follow-up action');
      }

      const followupDate = new Date();
      followupDate.setDate(followupDate.getDate() + offsetDays);

      const { error } = await supabase.from('followups').insert({
        lead_id: lead.id,
        user_id: assignedUserId,
        organization_id: lead.organization_id,
        next_action_date: followupDate.toISOString().split('T')[0],
        next_action_time: time,
        followup_remarks: remarks,
        status: 'planned',
      });

      if (error) throw error;

      await supabase.from('lead_activity_log').insert({
        lead_id: lead.id,
        user_id: enrollment.workflow?.created_by || assignedUserId,
        activity_type: 'followup_created',
        activity_description: `Workflow "${enrollment.workflow?.name || ''}" created a follow-up`,
        metadata: { workflow_id: enrollment.workflow_id, remarks, scheduled_time: time, offset_days: offsetDays },
        organization_id: lead.organization_id,
      });

      return 'Created follow-up';
    }
    case 'send_email': {
      const templateId = String(action.payload_json.templateId || '');

      if (!templateId) {
        throw new Error('Missing templateId in email action');
      }

      const { data: template, error: templateError } = await supabase
        .from('message_templates')
        .select('*')
        .eq('id', templateId)
        .maybeSingle();

      if (templateError || !template) {
        throw new Error('Email template not found');
      }

      if (!lead.email) {
        throw new Error('Lead email is missing');
      }

      const counselor = await getLeadOwnerProfile(supabase, lead);
      const subject = replaceTemplateVariables(String(template.subject || ''), lead, counselor);
      const body = replaceTemplateVariables(String(template.body_content || ''), lead, counselor);

      const { error } = await supabase.from('email_queue').insert({
        organization_id: lead.organization_id,
        to_email: lead.email,
        subject: subject || `Workflow email: ${template.template_name}`,
        body_html: body.replace(/\n/g, '<br/>'),
        body_text: body,
        priority: 5,
        status: 'pending',
        scheduled_at: new Date().toISOString(),
      });

      if (error) throw error;

      await supabase.from('lead_activity_log').insert({
        lead_id: lead.id,
        user_id: enrollment.workflow?.created_by || lead.current_lead_owner,
        activity_type: 'email_sent',
        activity_description: `Workflow "${enrollment.workflow?.name || ''}" queued an email`,
        metadata: { workflow_id: enrollment.workflow_id, template_id: templateId, template_name: template.template_name, subject },
        organization_id: lead.organization_id,
      });

      return 'Queued email';
    }
    default:
      throw new Error(`Unsupported action type: ${action.action_type}`);
  }
}

async function processDueEnrollments(supabase: any) {
  const nowIso = new Date().toISOString();
  const { data: enrollments } = await supabase
    .from('workflow_enrollments')
    .select('*, workflows(*)')
    .in('status', ['pending', 'running'])
    .lte('next_run_at', nowIso)
    .order('created_at', { ascending: true })
    .limit(100);

  let processed = 0;

  for (const enrollment of enrollments || []) {
    const bundle = await loadWorkflowBundle(supabase, enrollment.workflow_id);
    const currentAction = bundle.actions[enrollment.current_action_index];
    const { data: lead } = await supabase
      .from('leads')
      .select('id, email, first_name, last_name, name, mobile_number, status_id, sub_status_id, source_id, current_lead_owner, channel, campaign_name, country, city, call_count, is_re_enquired, created_at, updated_at, organization_id, university, course')
      .eq('id', enrollment.lead_id)
      .maybeSingle();

    if (!lead) {
      await supabase
        .from('workflow_enrollments')
        .update({ status: 'failed', last_error: 'Lead not found' })
        .eq('id', enrollment.id);
      await logExecution(supabase, enrollment.workflow_id, enrollment.id, enrollment.lead_id, enrollment.current_action_index, currentAction?.action_type || null, 'failed', 'Lead not found');
      continue;
    }

    if (!bundle.workflow?.is_active) {
      await supabase
        .from('workflow_enrollments')
        .update({ status: 'cancelled', last_error: 'Workflow deactivated' })
        .eq('id', enrollment.id);
      await logExecution(supabase, enrollment.workflow_id, enrollment.id, enrollment.lead_id, enrollment.current_action_index, currentAction?.action_type || null, 'skipped', 'Workflow is inactive');
      continue;
    }

    if (!matchesWorkflow(lead as Lead, bundle.conditions)) {
      await supabase
        .from('workflow_enrollments')
        .update({ status: 'cancelled', last_error: 'Lead no longer matches workflow conditions' })
        .eq('id', enrollment.id);
      await logExecution(supabase, enrollment.workflow_id, enrollment.id, enrollment.lead_id, enrollment.current_action_index, currentAction?.action_type || null, 'skipped', 'Lead no longer matches conditions');
      continue;
    }

    if (!currentAction) {
      await supabase
        .from('workflow_enrollments')
        .update({ status: 'completed', next_run_at: nowIso })
        .eq('id', enrollment.id);
      await logExecution(supabase, enrollment.workflow_id, enrollment.id, enrollment.lead_id, enrollment.current_action_index, null, 'success', 'Workflow completed');
      processed += 1;
      continue;
    }

    try {
      const message = await executeAction(
        supabase,
        { ...enrollment, workflow: bundle.workflow },
        currentAction,
        lead as Lead,
      );

      const nextIndex = enrollment.current_action_index + 1;
      const hasMoreActions = nextIndex < bundle.actions.length;

      await supabase
        .from('workflow_enrollments')
        .update({
          status: hasMoreActions ? 'running' : 'completed',
          current_action_index: nextIndex,
          next_run_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', enrollment.id);

      await logExecution(supabase, enrollment.workflow_id, enrollment.id, enrollment.lead_id, enrollment.current_action_index, currentAction.action_type, 'success', message);
      processed += 1;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown workflow execution error';
      await supabase
        .from('workflow_enrollments')
        .update({ status: 'failed', last_error: errorMessage })
        .eq('id', enrollment.id);
      await logExecution(supabase, enrollment.workflow_id, enrollment.id, enrollment.lead_id, enrollment.current_action_index, currentAction.action_type, 'failed', errorMessage);
    }
  }

  return processed;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const mode = body?.mode || 'run';

    const enrolled = mode === 'process' ? 0 : await enrollEligibleLeads(supabase);
    const processed = mode === 'enroll' ? 0 : await processDueEnrollments(supabase);

    return new Response(JSON.stringify({ success: true, enrolled, processed }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown workflow processor error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
