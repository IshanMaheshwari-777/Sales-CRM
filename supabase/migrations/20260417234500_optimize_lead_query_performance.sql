/*
  # Optimize lead query performance

  1. Add composite indexes for the most common organization-scoped lead queries.
  2. Add trigram-based search indexes for fast lead search.
  3. Add an RPC to fetch distinct campaign names without scanning all lead rows
     into the browser.
*/

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_leads_org_created_at_desc
  ON public.leads (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_org_status_created_at_desc
  ON public.leads (organization_id, status_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_org_sub_status_created_at_desc
  ON public.leads (organization_id, sub_status_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_org_owner_created_at_desc
  ON public.leads (organization_id, current_lead_owner, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_org_source_created_at_desc
  ON public.leads (organization_id, source_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_org_channel_created_at_desc
  ON public.leads (organization_id, channel, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_org_campaign_created_at_desc
  ON public.leads (organization_id, campaign_name, created_at DESC)
  WHERE campaign_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_org_updated_at_desc
  ON public.leads (organization_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_org_city
  ON public.leads (organization_id, city)
  WHERE city IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_org_country
  ON public.leads (organization_id, country)
  WHERE country IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_org_reenquired
  ON public.leads (organization_id, is_re_enquired);

CREATE INDEX IF NOT EXISTS idx_leads_org_call_count
  ON public.leads (organization_id, call_count);

CREATE INDEX IF NOT EXISTS idx_leads_search_first_name_trgm
  ON public.leads USING gin (lower(coalesce(first_name, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_leads_search_last_name_trgm
  ON public.leads USING gin (lower(coalesce(last_name, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_leads_search_name_trgm
  ON public.leads USING gin (lower(coalesce(name, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_leads_search_email_trgm
  ON public.leads USING gin (lower(coalesce(email, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_leads_search_mobile_trgm
  ON public.leads USING gin (lower(coalesce(mobile_number, '')) gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.get_distinct_campaign_names(
  p_organization_id uuid,
  p_limit integer DEFAULT 200
)
RETURNS TABLE(campaign_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT l.campaign_name
  FROM public.leads l
  WHERE l.organization_id = p_organization_id
    AND l.campaign_name IS NOT NULL
    AND btrim(l.campaign_name) <> ''
  ORDER BY l.campaign_name
  LIMIT greatest(coalesce(p_limit, 200), 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_distinct_campaign_names(uuid, integer) TO authenticated;
