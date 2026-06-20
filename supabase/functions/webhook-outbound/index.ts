import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface QueueItem {
  id: string;
  organization_id: string;
  lead_id: string;
  endpoint_id: string;
  event_type: string;
  payload: any;
  retry_count: number;
  max_retries: number;
}

interface IntegrationEndpoint {
  id: string;
  endpoint_name: string;
  endpoint_type: string;
  endpoint_url: string;
  authentication_type: string;
  authentication_config: any;
}

async function generateHmacSignature(
  secret: string,
  timestamp: string,
  payload: string
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const data = encoder.encode(`${timestamp}.${payload}`);
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, data);
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return signature;
}

function isAllowedUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname;
    
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('169.254.') ||
      /^192\.168\.\d+\.\d+$/.test(hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/.test(hostname)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function sendWebhook(
  endpoint: IntegrationEndpoint,
  payload: any,
  organizationId: string
): Promise<{ success: boolean; status: number; body: string; error?: string; durationMs: number }> {
  const startTime = Date.now();

  try {
    if (!isAllowedUrl(endpoint.endpoint_url)) {
      throw new Error('Invalid or restricted endpoint URL');
    }
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payloadString = JSON.stringify(payload);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Timestamp': timestamp,
      'X-Event-Type': payload.event_type,
      'X-Organization-Id': organizationId,
    };

    if (endpoint.authentication_type === 'hmac' && endpoint.authentication_config?.secret) {
      const signature = await generateHmacSignature(
        endpoint.authentication_config.secret,
        timestamp,
        payloadString
      );
      headers['X-Webhook-Signature'] = signature;
    } else if (endpoint.authentication_type === 'api_key' && endpoint.authentication_config?.api_key) {
      headers['X-API-Key'] = endpoint.authentication_config.api_key;
    } else if (endpoint.authentication_type === 'bearer' && endpoint.authentication_config?.token) {
      headers['Authorization'] = `Bearer ${endpoint.authentication_config.token}`;
    }

    const response = await fetch(endpoint.endpoint_url, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: AbortSignal.timeout(30000),
    });

    const responseBody = await response.text();
    const durationMs = Date.now() - startTime;

    return {
      success: response.ok,
      status: response.status,
      body: responseBody,
      durationMs,
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    return {
      success: false,
      status: 0,
      body: '',
      error: error.message || 'Unknown error',
      durationMs,
    };
  }
}

function buildSlackMessage(payload: any): any {
  const lead = payload.lead;
  const assignment = payload.assignment || payload.assignment_change;

  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: payload.event_type === 'lead.created' ? '🎯 New Lead Assigned!' : '🔄 Lead Reassigned',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Lead Name:*\n${lead.name || 'N/A'}`,
        },
        {
          type: 'mrkdwn',
          text: `*Email:*\n${lead.email || 'N/A'}`,
        },
        {
          type: 'mrkdwn',
          text: `*Mobile:*\n${lead.mobile_number || 'N/A'}`,
        },
        {
          type: 'mrkdwn',
          text: `*Company:*\n${lead.company || 'N/A'}`,
        },
      ],
    },
  ];

  if (lead.course || lead.specialization) {
    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Course:*\n${lead.course || 'N/A'}`,
        },
        {
          type: 'mrkdwn',
          text: `*Specialization:*\n${lead.specialization || 'N/A'}`,
        },
      ],
    });
  }

  if (lead.channel || lead.campaign_name) {
    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Channel:*\n${lead.channel || 'N/A'}`,
        },
        {
          type: 'mrkdwn',
          text: `*Campaign:*\n${lead.campaign_name || 'N/A'}`,
        },
      ],
    });
  }

  if (payload.event_type === 'lead.created' && assignment?.assigned_to_name) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Assigned to:* ${assignment.assigned_to_name} (${assignment.assigned_to_email})`,
      },
    });
  }

  if (payload.event_type === 'lead.reassigned') {
    const prevAssignee = assignment?.previous_assignee;
    const newAssignee = assignment?.new_assignee;

    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Previous Assignee:*\n${prevAssignee ? `${prevAssignee.name} (${prevAssignee.email})` : 'None'}`,
        },
        {
          type: 'mrkdwn',
          text: `*New Assignee:*\n${newAssignee ? `${newAssignee.name} (${newAssignee.email})` : 'Unassigned'}`,
        },
      ],
    });
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Lead ID: ${lead.id} | Created: ${new Date(lead.created_at || payload.timestamp).toLocaleString()}`,
      },
    ],
  });

  return {
    blocks,
    text: `${payload.event_type === 'lead.created' ? 'New Lead' : 'Lead Reassignment'}: ${lead.name}`,
  };
}

async function sendSlackMessage(
  endpoint: IntegrationEndpoint,
  payload: any
): Promise<{ success: boolean; status: number; body: string; error?: string; durationMs: number }> {
  const startTime = Date.now();

  try {
    if (!isAllowedUrl(endpoint.endpoint_url)) {
      throw new Error('Invalid or restricted endpoint URL');
    }

    const slackPayload = buildSlackMessage(payload);

    const response = await fetch(endpoint.endpoint_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(slackPayload),
      signal: AbortSignal.timeout(30000),
    });

    const responseBody = await response.text();
    const durationMs = Date.now() - startTime;

    return {
      success: response.ok,
      status: response.status,
      body: responseBody,
      durationMs,
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    return {
      success: false,
      status: 0,
      body: '',
      error: error.message || 'Unknown error',
      durationMs,
    };
  }
}

async function processQueueItem(
  supabase: any,
  queueItem: QueueItem,
  endpoint: IntegrationEndpoint
): Promise<void> {

  let result;
  if (endpoint.endpoint_type === 'slack') {
    result = await sendSlackMessage(endpoint, queueItem.payload);
  } else {
    result = await sendWebhook(endpoint, queueItem.payload, queueItem.organization_id);
  }

  await supabase.from('webhook_delivery_log').insert({
    queue_id: queueItem.id,
    organization_id: queueItem.organization_id,
    endpoint_id: queueItem.endpoint_id,
    event_type: queueItem.event_type,
    request_payload: queueItem.payload,
    response_status: result.status,
    response_body: result.body.substring(0, 5000),
    error_message: result.error || null,
    duration_ms: result.durationMs,
  });

  if (result.success) {
    await supabase
      .from('webhook_delivery_queue')
      .update({ status: 'completed' })
      .eq('id', queueItem.id);

    await supabase.rpc('upsert_webhook_health_metric', {
      p_organization_id: queueItem.organization_id,
      p_metric_type: 'outgoing_success',
      p_endpoint_id: queueItem.endpoint_id,
      p_count: 1,
      p_duration_ms: result.durationMs,
      p_hour_bucket: new Date(new Date().setMinutes(0, 0, 0)).toISOString(),
    });
  } else {
    const newRetryCount = queueItem.retry_count + 1;
    const shouldRetry = newRetryCount < queueItem.max_retries;

    if (shouldRetry) {
      const backoffMinutes = Math.pow(2, newRetryCount) * 5;
      const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

      await supabase
        .from('webhook_delivery_queue')
        .update({
          status: 'pending',
          retry_count: newRetryCount,
          next_retry_at: nextRetryAt.toISOString(),
        })
        .eq('id', queueItem.id);
    } else {
      await supabase
        .from('webhook_delivery_queue')
        .update({ status: 'failed' })
        .eq('id', queueItem.id);
    }

    await supabase.rpc('upsert_webhook_health_metric', {
      p_organization_id: queueItem.organization_id,
      p_metric_type: 'outgoing_failed',
      p_endpoint_id: queueItem.endpoint_id,
      p_count: 1,
      p_duration_ms: result.durationMs,
      p_hour_bucket: new Date(new Date().setMinutes(0, 0, 0)).toISOString(),
    });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data: queueItems, error: queueError } = await supabase
      .from('webhook_delivery_queue')
      .update({ status: 'processing' })
      .eq('status', 'pending')
      .lte('next_retry_at', new Date().toISOString())
      .select('*')
      .order('created_at', { ascending: true })
      .limit(50);

    if (queueError) {
      throw queueError;
    }

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending webhooks to process',
          processed: 0,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const { data: endpoints, error: endpointsError } = await supabase
      .from('integration_endpoints')
      .select('*')
      .eq('is_active', true);

    if (endpointsError) {
      throw endpointsError;
    }

    const endpointsMap = new Map(endpoints.map((ep: IntegrationEndpoint) => [ep.id, ep]));

    const processingPromises = queueItems.map(async (item: QueueItem) => {
      const endpoint = endpointsMap.get(item.endpoint_id);
      if (!endpoint) {
        await supabase
          .from('webhook_delivery_queue')
          .update({ status: 'failed' })
          .eq('id', item.id);
        return;
      }

      try {
        await processQueueItem(supabase, item, endpoint);
      } catch (error) {
        console.error(`Error processing queue item ${item.id}:`, error);
      }
    });

    await Promise.all(processingPromises);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhooks processed successfully',
        processed: queueItems.length,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error processing webhooks:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
