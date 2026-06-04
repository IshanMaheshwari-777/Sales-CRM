export type WorkflowCategory = 'UPDATE_ATTRIBUTES' | 'SEND_IMMEDIATE_COMMUNICATION';
export type WorkflowConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'greater_than'
  | 'less_than'
  | 'on_or_after'
  | 'on_or_before'
  | 'in'
  | 'not_in'
  | 'is_true'
  | 'is_false';

export type WorkflowConditionGate = 'AND' | 'OR';

export type WorkflowActionType = 'update_field' | 'create_followup' | 'send_email';

export interface WorkflowConditionDraft {
  id: string;
  fieldKey: string;
  operator: WorkflowConditionOperator;
  value: string;
  gate: WorkflowConditionGate;
}

export interface WorkflowActionDraft {
  id: string;
  actionType: WorkflowActionType;
  payload: Record<string, unknown>;
}

export interface WorkflowFieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'date' | 'boolean';
}

export const WORKFLOW_CATEGORIES: Array<{ value: WorkflowCategory; label: string; description: string }> = [
  {
    value: 'UPDATE_ATTRIBUTES',
    label: 'Update Attributes',
    description: 'Update lead attributes, assign owners, create follow-ups, and trigger queued emails.',
  },
  {
    value: 'SEND_IMMEDIATE_COMMUNICATION',
    label: 'Send Immediate Communication',
    description: 'Queue a single email immediately when a lead matches the workflow.',
  },
];

export const WORKFLOW_FILTER_FIELDS: WorkflowFieldDefinition[] = [
  { key: 'current_lead_owner', label: 'Current Lead Owner', type: 'select' },
  { key: 'source_id', label: 'Lead Source', type: 'select' },
  { key: 'channel', label: 'Channel', type: 'select' },
  { key: 'campaign_name', label: 'Campaign Name', type: 'text' },
  { key: 'status_id', label: 'Main Status', type: 'select' },
  { key: 'sub_status_id', label: 'Sub Status', type: 'select' },
  { key: 'city', label: 'City', type: 'text' },
  { key: 'country', label: 'Country', type: 'text' },
  { key: 'created_at', label: 'Created On', type: 'date' },
  { key: 'updated_at', label: 'Updated On', type: 'date' },
  { key: 'lead_age_days', label: 'Lead Age (days)', type: 'number' },
  { key: 'call_count', label: 'Call Count', type: 'number' },
  { key: 'is_re_enquired', label: 'Re-enquired', type: 'boolean' },
];

export const UPDATEABLE_LEAD_FIELDS: WorkflowFieldDefinition[] = [
  { key: 'status_id', label: 'Main Status', type: 'select' },
  { key: 'sub_status_id', label: 'Sub Status', type: 'select' },
  { key: 'current_lead_owner', label: 'Current Lead Owner', type: 'select' },
  { key: 'channel', label: 'Channel', type: 'select' },
  { key: 'campaign_name', label: 'Campaign Name', type: 'text' },
  { key: 'city', label: 'City', type: 'text' },
  { key: 'country', label: 'Country', type: 'text' },
  { key: 'is_re_enquired', label: 'Re-enquired', type: 'boolean' },
];

export const CHANNEL_OPTIONS = [
  'Offline',
  'Online',
  'Digital Marketing',
  'Publishers',
  'Referrals',
  'Walk-in',
  'Direct',
  'Partner',
];

export function getOperatorsForFieldType(type: WorkflowFieldDefinition['type']) {
  switch (type) {
    case 'number':
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'greater_than', label: 'Greater than' },
        { value: 'less_than', label: 'Less than' },
      ];
    case 'date':
      return [
        { value: 'on_or_after', label: 'On or after' },
        { value: 'on_or_before', label: 'On or before' },
      ];
    case 'boolean':
      return [
        { value: 'is_true', label: 'Is true' },
        { value: 'is_false', label: 'Is false' },
      ];
    case 'select':
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'not_equals', label: 'Does not equal' },
      ];
    case 'text':
    default:
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'not_equals', label: 'Does not equal' },
        { value: 'contains', label: 'Contains' },
      ];
  }
}

export function getCategoryLabel(category: WorkflowCategory) {
  return WORKFLOW_CATEGORIES.find((item) => item.value === category)?.label || category;
}
