import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
};

interface WebhookConfig {
  id: string;
  organization_id: string;
  is_enabled: boolean;
  allowed_ip_addresses: string[] | null;
  rate_limit_per_minute: number;
}

interface CanonicalWebhookLead {
  full_name: string;
  mobile_number: string;
  email: string;
  city?: string;
  state?: string;
  country?: string;
  company?: string;
  course?: string;
  specialization?: string;
  campaign_name?: string;
  campaign_id?: string;
  adgroup_id?: string;
  keyword?: string;
  lead_value?: number;
  pincode?: string;
  address_line1?: string;
  address_line2?: string;
  university?: string;
  tags?: string[];
}

interface CanonicalWebhookPayload {
  source: string;
  lead: CanonicalWebhookLead;
}

interface ExistingLead {
  id: string;
}

function splitFullName(fullName: string) {
  const trimmed = fullName.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return { name: '', first_name: null, last_name: null };
  }

  const parts = trimmed.split(' ');
  const first_name = parts[0] || null;
  const last_name = parts.length > 1 ? parts.slice(1).join(' ') : null;

  return {
    name: trimmed,
    first_name,
    last_name,
  };
}

function validateCanonicalPayload(body: unknown): CanonicalWebhookPayload {
  const payload = body as Partial<CanonicalWebhookPayload> | null;

  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid JSON payload');
  }

  if (!payload.source || typeof payload.source !== 'string' || !payload.source.trim()) {
    throw new Error('Missing required field: source');
  }

  const lead = payload.lead as Partial<CanonicalWebhookLead> | undefined;
  if (!lead || typeof lead !== 'object') {
    throw new Error('Missing required object: lead');
  }

  const requiredFields: Array<keyof CanonicalWebhookLead> = ['full_name', 'mobile_number', 'email'];
  for (const field of requiredFields) {
    const value = lead[field];
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`Missing required field: lead.${field}`);
    }
  }

  return {
    source: payload.source.trim(),
    lead: {
      ...lead,
      full_name: lead.full_name!.trim(),
      mobile_number: lead.mobile_number!.trim(),
      email: lead.email!.trim().toLowerCase(),
    },
  };
}

async function findDuplicateLead(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  email: string,
  mobileNumber: string
): Promise<ExistingLead | null> {
  const { data, error } = await supabase
    .from('leads')
    .select('id')
    .eq('organization_id', organizationId)
    .or(`mobile_number.eq.${mobileNumber},email.eq.${email}`)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to check duplicates: ${error.message}`);
  }

  return data?.[0] ?? null;
}

function buildLeadWritePayload(payload: CanonicalWebhookPayload) {
  const { source, lead } = payload;
  const nameParts = splitFullName(lead.full_name);

  return {
    name: nameParts.name,
    first_name: nameParts.first_name,
    last_name: nameParts.last_name,
    email: lead.email,
    mobile_number: lead.mobile_number,
    company: lead.company ?? null,
    lead_value: lead.lead_value ?? null,
    channel: source,
    campaign_name: lead.campaign_name ?? null,
    campaign_id: lead.campaign_id ?? null,
    adgroup_id: lead.adgroup_id ?? null,
    keyword: lead.keyword ?? null,
    country: lead.country ?? null,
    city: lead.city ?? null,
    state: lead.state ?? null,
    pincode: lead.pincode ?? null,
    address_line1: lead.address_line1 ?? null,
    address_line2: lead.address_line2 ?? null,
    university: lead.university ?? null,
    course: lead.course ?? null,
    specialization: lead.specialization ?? null,
    tags: Array.isArray(lead.tags) ? lead.tags : null,
  };
}

function buildLeadUpdatePayload(payload: CanonicalWebhookPayload) {
  const { source, lead } = payload;
  const nameParts = splitFullName(lead.full_name);
  const updates: Record<string, unknown> = {
    name: nameParts.name,
    first_name: nameParts.first_name,
    last_name: nameParts.last_name,
    email: lead.email,
    mobile_number: lead.mobile_number,
    channel: source,
  };

  const optionalFields: Array<[keyof CanonicalWebhookLead, string]> = [
    ['company', 'company'],
    ['lead_value', 'lead_value'],
    ['campaign_name', 'campaign_name'],
    ['campaign_id', 'campaign_id'],
    ['adgroup_id', 'adgroup_id'],
    ['keyword', 'keyword'],
    ['country', 'country'],
    ['city', 'city'],
    ['state', 'state'],
    ['pincode', 'pincode'],
    ['address_line1', 'address_line1'],
    ['address_line2', 'address_line2'],
    ['university', 'university'],
    ['course', 'course'],
    ['specialization', 'specialization'],
    ['tags', 'tags'],
  ];

  for (const [leadField, dbField] of optionalFields) {
    if (leadField in lead) {
      updates[dbField] = lead[leadField] ?? null;
    }
  }

  return updates;
}

async function logWebhookRequest(
  supabase: ReturnType<typeof createClient>,
  organizationId: string | null,
  request: Request,
  requestBody: unknown,
  responseStatus: number,
  errorMessage: string | null,
  durationMs: number
) {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (!lowerKey.includes('authorization') && !lowerKey.includes('api-key') && lowerKey !== 'apikey') {
      headers[key] = value;
    }
  });

  await supabase.from('webhook_request_log').insert({
    organization_id: organizationId,
    request_path: new URL(request.url).pathname,
    request_method: request.method,
    request_headers: headers,
    request_body: requestBody,
    response_status: responseStatus,
    error_message: errorMessage,
    ip_address: request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for'),
    user_agent: request.headers.get('user-agent'),
    duration_ms: durationMs,
  });
}

async function updateHealthMetrics(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  metricType: 'incoming_success' | 'incoming_failed',
  durationMs: number
) {
  const hourBucket = new Date();
  hourBucket.setMinutes(0, 0, 0);

  await supabase.rpc('upsert_webhook_health_metric', {
    p_organization_id: organizationId,
    p_metric_type: metricType,
    p_endpoint_id: null,
    p_count: 1,
    p_duration_ms: durationMs,
    p_hour_bucket: hourBucket.toISOString(),
  });
}

Deno.serve(async (req: Request) => {
  const startTime = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let organizationId: string | null = null;
  let requestBody: unknown = null;

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    const apiKey = req.headers.get('X-API-Key');
    if (!apiKey) {
      throw new Error('Missing API key');
    }

    const { data: webhookConfig, error: configError } = await supabase
      .from('webhook_configurations')
      .select('id, organization_id, is_enabled, allowed_ip_addresses, rate_limit_per_minute')
      .eq('api_key', apiKey)
      .eq('is_enabled', true)
      .maybeSingle<WebhookConfig>();

    if (configError || !webhookConfig) {
      throw new Error('Invalid API key');
    }

    organizationId = webhookConfig.organization_id;

    if (webhookConfig.allowed_ip_addresses && webhookConfig.allowed_ip_addresses.length > 0) {
      const clientIp = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for');
      if (!clientIp || !webhookConfig.allowed_ip_addresses.includes(clientIp)) {
        throw new Error('IP address not allowed');
      }
    }

    if (webhookConfig.rate_limit_per_minute > 0) {
      const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
      const { count: recentRequests, error: countError } = await supabase
        .from('webhook_request_log')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .gte('created_at', oneMinuteAgo);

      if (!countError && recentRequests !== null && recentRequests >= webhookConfig.rate_limit_per_minute) {
        throw new Error('Rate limit exceeded');
      }
    }

    requestBody = await req.json();
    const payload = validateCanonicalPayload(requestBody);
    const leadWritePayload = buildLeadWritePayload(payload);

    const existingLead = await findDuplicateLead(
      supabase,
      organizationId,
      payload.lead.email,
      payload.lead.mobile_number
    );

    if (existingLead) {
      const { error: updateError } = await supabase
        .from('leads')
        .update(buildLeadUpdatePayload(payload))
        .eq('id', existingLead.id)
        .eq('organization_id', organizationId);

      if (updateError) {
        throw new Error(`Failed to update duplicate lead: ${updateError.message}`);
      }

      const durationMs = Date.now() - startTime;
      await logWebhookRequest(supabase, organizationId, req, requestBody, 200, null, durationMs);
      await updateHealthMetrics(supabase, organizationId, 'incoming_success', durationMs);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Existing lead updated successfully',
          lead_id: existingLead.id,
          action: 'updated',
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

    const { data: newLead, error: leadError } = await supabase
      .from('leads')
      .insert({
        organization_id: organizationId,
        ...leadWritePayload,
      })
      .select('id')
      .single();

    if (leadError) {
      throw new Error(`Failed to create lead: ${leadError.message}`);
    }

    const durationMs = Date.now() - startTime;
    await logWebhookRequest(supabase, organizationId, req, requestBody, 201, null, durationMs);
    await updateHealthMetrics(supabase, organizationId, 'incoming_success', durationMs);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Lead created successfully',
        lead_id: newLead.id,
        action: 'created',
      }),
      {
        status: 201,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: unknown) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const status =
      errorMessage === 'Method not allowed' ? 405 :
      errorMessage.includes('Rate limit exceeded') ? 429 :
      errorMessage.includes('required field') || errorMessage.includes('Invalid JSON payload') ? 400 :
      errorMessage.includes('Missing API key') || errorMessage.includes('Invalid API key') || errorMessage.includes('IP address not allowed') ? 401 :
      500;

    await logWebhookRequest(supabase, organizationId, req, requestBody, status, errorMessage, durationMs);

    if (organizationId) {
      await updateHealthMetrics(supabase, organizationId, 'incoming_failed', durationMs);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
