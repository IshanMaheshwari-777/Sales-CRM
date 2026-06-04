# Webhook Integration Guide

## Overview

This CRM system provides a webhook integration system that allows you to:
- Receive leads from external sources via one canonical incoming webhook contract
- Push lead data to external systems via outgoing webhooks
- Integrate with Slack for real-time notifications
- Track webhook activity and monitor health

## Table of Contents

1. [Incoming Webhooks](#incoming-webhooks)
2. [Outgoing Webhooks](#outgoing-webhooks)
3. [Slack Integration](#slack-integration)
4. [Lead Source Usage](#lead-source-usage)
5. [Security](#security)
6. [Monitoring & Logs](#monitoring--logs)
7. [Troubleshooting](#troubleshooting)

---

## Incoming Webhooks

### Setup

1. Navigate to **Settings → Webhook Integrations → Incoming Webhooks**
2. Click **Add Configuration** to create a new webhook configuration
3. Provide a descriptive name (e.g., "Pabbly Lead Import")
4. Set your desired rate limit (default: 60 requests/minute)
5. Save the configuration

After creation, you'll receive:
- **API Key**: Used to identify and authorize your organization
- **Webhook URL**: The endpoint to send leads to

### Webhook Endpoint

```
POST {SUPABASE_URL}/functions/v1/webhook-inbound
```

### Required Headers

```
X-API-Key: your_api_key
Content-Type: application/json
```

### Request Payload

```json
{
  "source": "Facebook Ads",
  "lead": {
    "full_name": "John Doe",
    "mobile_number": "+1234567890",
    "email": "john.doe@example.com",
    "company": "Acme Corp",
    "city": "New York",
    "state": "NY",
    "country": "USA",
    "course": "MBA",
    "specialization": "Marketing",
    "campaign_name": "Fall 2024 Campaign",
    "campaign_id": "123456",
    "adgroup_id": "789012",
    "keyword": "mba admissions"
  }
}
```

### Required Lead Fields

- `source`
- `lead.full_name`
- `lead.mobile_number`
- `lead.email`

`mobile_number` is the strongest duplicate identifier in the CRM because the database enforces uniqueness there. Email is also checked during webhook ingestion to catch duplicate leads before insert.

### Canonical Field Rules

- The incoming payload shape is the same for every lead source
- `source` is still required, but it is only used for attribution/reporting and channel labeling
- Source does **not** change expected field names anymore
- New leads go through the assignment rule engine first, then fallback round-robin if no rule matches
- Duplicate leads are updated in place and keep their current assignee

### cURL Example

```bash
PAYLOAD='{"source":"Website Contact Form","lead":{"full_name":"John Doe","mobile_number":"+919999999999","email":"john@example.com","city":"Pune","state":"Maharashtra","country":"India","company":"Acme","course":"MBA","specialization":"Marketing"}}'

curl -X POST https://your-project.supabase.co/functions/v1/webhook-inbound \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d "$PAYLOAD"
```

### Response Codes

- **201 Created**: Lead created successfully
- **200 OK**: Duplicate lead updated in place
- **401 Unauthorized**: Invalid API key
- **429 Too Many Requests**: Rate limit exceeded
- **400 Bad Request**: Missing required canonical fields
- **500 Internal Server Error**: Server error

### Response Format

**Success (New Lead):**
```json
{
  "success": true,
  "message": "Lead created successfully",
  "lead_id": "uuid-here",
  "action": "created"
}
```

**Success (Duplicate):**
```json
{
  "success": true,
  "message": "Existing lead updated successfully",
  "lead_id": "existing-uuid",
  "action": "updated"
}
```

**Error:**
```json
{
  "success": false,
  "error": "Missing required field: lead.mobile_number"
}
```

---

## Outgoing Webhooks

### Setup

1. Navigate to **Settings → Webhook Integrations → Outgoing Integrations**
2. Click **Add Endpoint** to create a new integration
3. Configure:
   - **Endpoint Name**: Descriptive name
   - **Endpoint Type**: webhook, slack, or custom
   - **Endpoint URL**: Your webhook receiver URL
   - **Authentication**: Choose none, API key, HMAC, or Bearer token
   - **Event Subscriptions**: Select which events trigger webhooks

### Supported Events

- **lead.created**: Triggered when a new lead is created and assigned
- **lead.reassigned**: Triggered when a lead is reassigned to a different user

### Outbound Payload Format

**Lead Created Event:**
```json
{
  "event_type": "lead.created",
  "event_id": "unique-event-id",
  "timestamp": "2024-04-05T12:00:00Z",
  "organization_id": "org-uuid",
  "lead": {
    "id": "lead-uuid",
    "name": "John Doe",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "mobile_number": "+1234567890",
    "company": "Acme Corp",
    "course": "MBA",
    "specialization": "Marketing",
    "channel": "Facebook Ads",
    "campaign_name": "Fall 2024",
    "created_at": "2024-04-05T12:00:00Z"
  },
  "assignment": {
    "assigned_to_id": "user-uuid",
    "assigned_to_name": "Sarah Johnson",
    "assigned_to_email": "sarah@example.com",
    "assigned_at": "2024-04-05T12:00:00Z"
  }
}
```

### Outbound Headers

```
Content-Type: application/json
X-Webhook-Timestamp: unix_timestamp
X-Event-Type: lead.created
X-Organization-Id: org-uuid
X-Webhook-Signature: hmac_signature (if HMAC auth enabled)
X-API-Key: your_api_key (if API key auth enabled)
Authorization: Bearer token (if Bearer auth enabled)
```

### Retry Logic

Failed webhook deliveries are automatically retried with exponential backoff:
- **1st retry**: 5 minutes after failure
- **2nd retry**: 10 minutes after 1st retry
- **3rd retry**: 20 minutes after 2nd retry
- **After 3 failures**: Marked as permanently failed

---

## Slack Integration

### Setup

1. Create a Slack Incoming Webhook in your Slack workspace:
   - Go to Slack App Directory
   - Search for "Incoming Webhooks"
   - Add to your workspace and select a channel
   - Copy the webhook URL

2. In the CRM:
   - Navigate to **Settings → Webhook Integrations → Outgoing Integrations**
   - Click **Add Endpoint**
   - Set **Endpoint Type** to "Slack"
   - Paste your Slack webhook URL
   - Subscribe to desired events (lead.created, lead.reassigned)
   - Save

### Slack Message Format

New leads are sent to Slack with rich formatting including:
- Lead name and contact information
- Course and specialization details
- Marketing channel and campaign
- Assigned counselor information
- Lead ID and creation timestamp

---

## Lead Source Usage

Use `source` as a plain attribution label such as:
- `Facebook Ads`
- `Landing Page`
- `Pabbly`
- `Google Ads`

That value is stored on the lead as the channel/source label, but it no longer changes the request schema.

---

## Security

### Organization API Key

All incoming webhooks must include a valid organization API key:
- `X-API-Key` identifies the tenant and authorizes the request
- Each webhook configuration has its own key
- Keys can be rotated by creating a new configuration and disabling the old one

### IP Whitelisting (Optional)

You can restrict webhook access to specific IP addresses:
1. Edit your webhook configuration
2. Add allowed IP addresses
3. Only requests from these IPs will be accepted

### API Key Rotation

To rotate your API keys:
1. Create a new webhook configuration
2. Update external systems to use the new API key
3. Delete old configuration after migration

### Rate Limiting

Each webhook configuration has a configurable rate limit (default 60 req/min) to prevent abuse.

---

## Monitoring & Logs

### Webhook Activity Logs

View all webhook activity in **Settings → Webhook Integrations → Webhook Logs**:
- Filter by incoming/outgoing/all
- Search by event type or error message
- View request/response payloads
- Track response times and status codes

### Health Metrics

Monitor webhook health with aggregated metrics:
- Success/failure rates
- Average response times
- Request volume over time
- Endpoint-specific performance

### Alerts

Configure alerts for:
- Failed webhook deliveries
- Rate limit violations
- Repeated authentication failures

---

## Troubleshooting

### Common Issues

**401 Unauthorized - Invalid API Key**
- Verify you're using the correct API key
- Check that the configuration is enabled
- Ensure API key matches your organization

**400 Bad Request - Missing Required Field**
- Verify `source`, `lead.full_name`, `lead.mobile_number`, and `lead.email` are present
- Check that the payload uses the canonical field names

**429 Too Many Requests**
- You've exceeded the rate limit
- Wait before sending more requests
- Consider increasing rate limit in configuration

**Existing Lead Updated Successfully**
- Lead with same mobile number or email already exists
- This is expected behavior for duplicate webhook submissions
- Returns the existing lead ID with `action: updated`

**Lead Not Assigned to Counselor**
- Check assignment rules are configured
- Verify rules match the lead criteria
- Ensure counselors are available for assignment

**Outbound Webhook Not Firing**
- Verify endpoint is active
- Check event subscription is enabled
- Confirm lead was actually assigned (required for lead.created)
- Review webhook delivery queue for pending items

### Testing Webhooks

Use the built-in test functionality:
1. Navigate to webhook configuration
2. Click "Test Webhook"
3. Review response and logs

Or use tools like:
- [Webhook.site](https://webhook.site) - Inspect incoming webhooks
- [Postman](https://www.postman.com) - Test API calls
- [RequestBin](https://requestbin.com) - Debug webhook deliveries

### Support

For additional help:
- Check the webhook activity logs for detailed error messages
- Review the health metrics dashboard
- Contact your system administrator

---

## Best Practices

1. **Use the canonical payload** for every source
2. **Send all three mandatory lead fields** every time
3. **Handle duplicate updates gracefully** in your upstream integration
4. **Monitor webhook health** regularly
5. **Set appropriate rate limits** based on your traffic
6. **Use retry logic** for outbound webhooks
7. **Log all webhook activity** for troubleshooting
8. **Rotate API keys** periodically for security
9. **Test thoroughly** before going live
10. **Keep `source` values consistent** for reporting

---

## API Reference Quick Links

- Incoming Webhook Endpoint: `POST /functions/v1/webhook-inbound`
- Outbound Processor: `POST /functions/v1/webhook-outbound` (internal use)
- Database Tables: See schema in migrations

## Change Log

- **2026-04-18**: Simplified inbound webhook contract
  - Canonical payload for all sources
  - Single `X-API-Key` auth model
  - Duplicate webhook leads update existing records
  - `source` retained only for attribution/reporting
