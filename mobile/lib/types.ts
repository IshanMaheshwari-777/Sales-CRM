export type MobileQueueLead = {
  lead_id: string;
  name: string;
  email: string | null;
  mobile_number: string | null;
  city: string | null;
  course: string | null;
  specialization: string | null;
  campaign_name: string | null;
  call_count: number;
  lead_value: number | null;
  status_id: string | null;
  status_name: string | null;
  status_color: string | null;
  sub_status_id: string | null;
  sub_status_name: string | null;
  current_lead_owner: string | null;
  owner_name: string | null;
  next_action_date: string | null;
  next_action_time: string | null;
  followup_status: string | null;
  is_overdue: boolean;
  last_updated: string | null;
};

export type StatusOption = {
  id: string;
  name: string;
  display_name: string;
  color: string | null;
  status_type: string | null;
  parent_status_id: string | null;
  requires_sub_status: boolean | null;
};

export type MobileLeadFilters = {
  assignedTo: string[];
  campaignNames: string[];
  channels: string[];
  sources: string[];
  statuses: string[];
  subStatuses: string[];
  cities: string[];
  dateAddedFrom?: string;
  dateAddedTo?: string;
  dateEditedFrom?: string;
  dateEditedTo?: string;
  callCountMin?: number;
  callCountMax?: number;
};

export type MobileFilterOption = {
  value: string;
  label: string;
  color?: string | null;
};

export type MobileLeadFilterOptions = {
  owners: MobileFilterOption[];
  campaigns: MobileFilterOption[];
  channels: MobileFilterOption[];
  sources: MobileFilterOption[];
  statuses: StatusOption[];
  cities: MobileFilterOption[];
};

export type TeamSummary = {
  team_member_count: number;
  owned_lead_count: number;
  pending_followups: number;
  today_followups: number;
  recent_updates: number;
};

export type MobileDashboardSummary = {
  owned_lead_count: number;
  pending_followups: number;
  today_followups: number;
  recent_updates: number;
};

export type QuickOutcomeKey =
  | 'no_answer'
  | 'connected'
  | 'callback'
  | 'wrong_number'
  | 'converted'
  | 'junk';

export type QuickUpdateInput = {
  leadId: string;
  disposition: QuickOutcomeKey | string;
  statusId?: string | null;
  subStatusId?: string | null;
  note?: string;
  nextFollowupAt?: string | null;
};

export type FollowupItem = {
  id: string;
  lead_id: string;
  next_action_date: string;
  next_action_time: string;
  followup_remarks: string;
  status: string;
  lead: {
    name: string | null;
    mobile_number: string | null;
  } | null;
};
