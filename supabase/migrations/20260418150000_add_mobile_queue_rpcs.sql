/*
  # Mobile Queue RPCs

  Adds a lightweight mobile-oriented contract for the Expo CRM app:
  - `mobile_get_rep_queue`: prioritized queue for the signed-in user
  - `mobile_get_next_lead`: first item from the queue
  - `mobile_quick_update_lead`: fast post-call update plus optional follow-up
  - `mobile_get_team_summary`: compact team health summary for team leads/admins
*/

CREATE OR REPLACE FUNCTION public.mobile_get_rep_queue(p_limit integer DEFAULT 25)
RETURNS TABLE (
  lead_id uuid,
  name text,
  email text,
  mobile_number text,
  city text,
  course text,
  specialization text,
  campaign_name text,
  call_count integer,
  lead_value numeric,
  status_id uuid,
  status_name text,
  status_color text,
  sub_status_id uuid,
  sub_status_name text,
  current_lead_owner uuid,
  owner_name text,
  next_action_date date,
  next_action_time time,
  followup_status text,
  is_overdue boolean,
  last_updated timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH visible_leads AS (
    SELECT
      l.id,
      l.name,
      l.email,
      l.mobile_number,
      l.city,
      l.course,
      l.specialization,
      l.campaign_name,
      l.call_count,
      l.lead_value,
      l.status_id,
      l.sub_status_id,
      l.current_lead_owner,
      l.updated_at,
      main_status.display_name AS status_name,
      main_status.color AS status_color,
      sub_status.display_name AS sub_status_name,
      owner.full_name AS owner_name
    FROM public.leads l
    LEFT JOIN public.lead_statuses main_status ON main_status.id = l.status_id
    LEFT JOIN public.lead_statuses sub_status ON sub_status.id = l.sub_status_id
    LEFT JOIN public.profiles owner ON owner.id = l.current_lead_owner
    WHERE (
      public.get_user_hierarchy_level(auth.uid()) <= 2
      OR l.current_lead_owner = auth.uid()
      OR l.assigned_to = auth.uid()
      OR public.is_same_team(auth.uid(), COALESCE(l.current_lead_owner, l.assigned_to))
    )
  ),
  next_followup AS (
    SELECT DISTINCT ON (f.lead_id)
      f.lead_id,
      f.next_action_date,
      f.next_action_time,
      f.status,
      (f.next_action_date < CURRENT_DATE OR (f.next_action_date = CURRENT_DATE AND f.next_action_time < CURRENT_TIME)) AS is_overdue
    FROM public.followups f
    WHERE f.status = 'pending'
    ORDER BY f.lead_id, f.next_action_date ASC, f.next_action_time ASC
  )
  SELECT
    vl.id AS lead_id,
    vl.name,
    vl.email,
    vl.mobile_number,
    vl.city,
    vl.course,
    vl.specialization,
    vl.campaign_name,
    vl.call_count,
    vl.lead_value,
    vl.status_id,
    vl.status_name,
    vl.status_color,
    vl.sub_status_id,
    vl.sub_status_name,
    vl.current_lead_owner,
    vl.owner_name,
    nf.next_action_date,
    nf.next_action_time,
    nf.status AS followup_status,
    COALESCE(nf.is_overdue, false) AS is_overdue,
    vl.updated_at AS last_updated
  FROM visible_leads vl
  LEFT JOIN next_followup nf ON nf.lead_id = vl.id
  ORDER BY
    COALESCE(nf.is_overdue, false) DESC,
    nf.next_action_date NULLS LAST,
    nf.next_action_time NULLS LAST,
    vl.call_count ASC,
    vl.updated_at ASC NULLS LAST
  LIMIT GREATEST(COALESCE(p_limit, 25), 1);
$$;

CREATE OR REPLACE FUNCTION public.mobile_get_next_lead()
RETURNS TABLE (
  lead_id uuid,
  name text,
  email text,
  mobile_number text,
  city text,
  course text,
  specialization text,
  campaign_name text,
  call_count integer,
  lead_value numeric,
  status_id uuid,
  status_name text,
  status_color text,
  sub_status_id uuid,
  sub_status_name text,
  current_lead_owner uuid,
  owner_name text,
  next_action_date date,
  next_action_time time,
  followup_status text,
  is_overdue boolean,
  last_updated timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.mobile_get_rep_queue(1);
$$;

CREATE OR REPLACE FUNCTION public.mobile_quick_update_lead(
  p_lead_id uuid,
  p_status_id uuid DEFAULT NULL,
  p_sub_status_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_next_followup_at timestamptz DEFAULT NULL,
  p_disposition text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_user_name text;
  v_status_name text;
  v_sub_status_name text;
  v_followup_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_lead_id IS NULL THEN
    RAISE EXCEPTION 'Lead is required';
  END IF;

  SELECT *
  INTO v_lead
  FROM public.leads
  WHERE id = p_lead_id
    AND (
      public.get_user_hierarchy_level(auth.uid()) <= 2
      OR current_lead_owner = auth.uid()
      OR assigned_to = auth.uid()
      OR public.is_same_team(auth.uid(), COALESCE(current_lead_owner, assigned_to))
    )
  LIMIT 1;

  IF v_lead.id IS NULL THEN
    RAISE EXCEPTION 'Lead not found or not accessible';
  END IF;

  SELECT full_name INTO v_user_name
  FROM public.profiles
  WHERE id = auth.uid();

  IF p_status_id IS NOT NULL THEN
    SELECT display_name INTO v_status_name
    FROM public.lead_statuses
    WHERE id = p_status_id;
  END IF;

  IF p_sub_status_id IS NOT NULL THEN
    SELECT display_name INTO v_sub_status_name
    FROM public.lead_statuses
    WHERE id = p_sub_status_id;
  END IF;

  UPDATE public.leads
  SET
    status_id = COALESCE(p_status_id, status_id),
    sub_status_id = CASE
      WHEN p_status_id IS NOT NULL THEN p_sub_status_id
      ELSE COALESCE(p_sub_status_id, sub_status_id)
    END,
    call_count = COALESCE(call_count, 0) + 1,
    updated_at = now()
  WHERE id = p_lead_id;

  IF COALESCE(trim(p_note), '') <> '' THEN
    INSERT INTO public.lead_activity_log (
      lead_id,
      user_id,
      organization_id,
      activity_type,
      activity_description,
      metadata
    ) VALUES (
      p_lead_id,
      auth.uid(),
      v_lead.organization_id,
      'comment_added',
      COALESCE(v_user_name, 'User') || ' added a mobile call note',
      jsonb_build_object(
        'note', trim(p_note),
        'source', 'mobile_app',
        'disposition', p_disposition
      )
    );
  END IF;

  IF p_status_id IS NOT NULL THEN
    INSERT INTO public.lead_activity_log (
      lead_id,
      user_id,
      organization_id,
      activity_type,
      activity_description,
      old_value,
      new_value,
      metadata
    ) VALUES (
      p_lead_id,
      auth.uid(),
      v_lead.organization_id,
      'status_changed',
      COALESCE(v_user_name, 'User') || ' updated the lead from mobile',
      NULL,
      COALESCE(v_status_name, 'Updated'),
      jsonb_build_object(
        'sub_status', v_sub_status_name,
        'disposition', p_disposition,
        'source', 'mobile_app'
      )
    );
  END IF;

  IF p_next_followup_at IS NOT NULL THEN
    INSERT INTO public.followups (
      lead_id,
      user_id,
      organization_id,
      next_action_date,
      next_action_time,
      followup_remarks,
      status
    ) VALUES (
      p_lead_id,
      auth.uid(),
      v_lead.organization_id,
      (p_next_followup_at AT TIME ZONE 'UTC')::date,
      ((p_next_followup_at AT TIME ZONE 'UTC')::time),
      COALESCE(NULLIF(trim(p_note), ''), COALESCE(p_disposition, 'Mobile follow-up')),
      'pending'
    )
    RETURNING id INTO v_followup_id;

    INSERT INTO public.lead_activity_log (
      lead_id,
      user_id,
      organization_id,
      activity_type,
      activity_description,
      metadata
    ) VALUES (
      p_lead_id,
      auth.uid(),
      v_lead.organization_id,
      'followup_created',
      COALESCE(v_user_name, 'User') || ' scheduled a mobile follow-up',
      jsonb_build_object(
        'followup_id', v_followup_id,
        'scheduled_at', p_next_followup_at,
        'source', 'mobile_app'
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'lead_id', p_lead_id,
    'followup_id', v_followup_id,
    'status_id', COALESCE(p_status_id, v_lead.status_id),
    'sub_status_id', COALESCE(p_sub_status_id, v_lead.sub_status_id),
    'disposition', p_disposition,
    'queued_followup', p_next_followup_at IS NOT NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mobile_get_team_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
  v_is_manager boolean;
  v_summary jsonb;
BEGIN
  SELECT team_id, public.get_user_hierarchy_level(auth.uid()) <= 3
  INTO v_team_id, v_is_manager
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT COALESCE(v_is_manager, false) OR v_team_id IS NULL THEN
    RETURN jsonb_build_object(
      'team_member_count', 0,
      'owned_lead_count', 0,
      'pending_followups', 0,
      'today_followups', 0,
      'recent_updates', 0
    );
  END IF;

  SELECT jsonb_build_object(
    'team_member_count', (
      SELECT count(*)
      FROM public.profiles p
      WHERE p.team_id = v_team_id
        AND p.is_active IS DISTINCT FROM false
    ),
    'owned_lead_count', (
      SELECT count(*)
      FROM public.leads l
      JOIN public.profiles p ON p.id = COALESCE(l.current_lead_owner, l.assigned_to)
      WHERE p.team_id = v_team_id
    ),
    'pending_followups', (
      SELECT count(*)
      FROM public.followups f
      JOIN public.profiles p ON p.id = f.user_id
      WHERE p.team_id = v_team_id
        AND f.status = 'pending'
    ),
    'today_followups', (
      SELECT count(*)
      FROM public.followups f
      JOIN public.profiles p ON p.id = f.user_id
      WHERE p.team_id = v_team_id
        AND f.status = 'pending'
        AND f.next_action_date = CURRENT_DATE
    ),
    'recent_updates', (
      SELECT count(*)
      FROM public.lead_activity_log log
      JOIN public.profiles p ON p.id = log.user_id
      WHERE p.team_id = v_team_id
        AND log.created_at >= now() - interval '1 day'
    )
  )
  INTO v_summary;

  RETURN COALESCE(v_summary, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mobile_get_rep_queue(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mobile_get_next_lead() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mobile_quick_update_lead(uuid, uuid, uuid, text, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mobile_get_team_summary() TO authenticated;
