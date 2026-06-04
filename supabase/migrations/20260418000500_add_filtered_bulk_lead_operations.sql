/*
  # Add filtered bulk lead operations

  Moves bulk "all matching leads" actions to the database so the browser does not
  need to fetch huge lead ID lists first.
*/

CREATE OR REPLACE FUNCTION public.filtered_leads_scope(
  p_organization_id uuid,
  p_search text DEFAULT NULL,
  p_active_status_id uuid DEFAULT NULL,
  p_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(lead_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH filter_values AS (
    SELECT
      nullif(btrim(coalesce(p_search, '')), '') AS search_term,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filters->'assignedTo', '[]'::jsonb)))::uuid[] AS assigned_to,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filters->'campaignNames', '[]'::jsonb))) AS campaign_names,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filters->'channels', '[]'::jsonb))) AS channels,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filters->'sources', '[]'::jsonb)))::uuid[] AS sources,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filters->'statuses', '[]'::jsonb)))::uuid[] AS statuses,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filters->'subStatuses', '[]'::jsonb)))::uuid[] AS sub_statuses,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filters->'cities', '[]'::jsonb))) AS cities,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filters->'countries', '[]'::jsonb))) AS countries,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filters->'currentOwners', '[]'::jsonb)))::uuid[] AS current_owners,
      nullif(p_filters->>'dateAddedFrom', '')::timestamptz AS date_added_from,
      nullif(p_filters->>'dateAddedTo', '')::timestamptz AS date_added_to,
      nullif(p_filters->>'dateEditedFrom', '')::timestamptz AS date_edited_from,
      nullif(p_filters->>'dateEditedTo', '')::timestamptz AS date_edited_to,
      nullif(p_filters->>'dateFrom', '')::timestamptz AS created_from,
      nullif(p_filters->>'dateTo', '')::timestamptz AS created_to,
      nullif(p_filters->>'leadAgeMin', '')::integer AS lead_age_min,
      nullif(p_filters->>'leadAgeMax', '')::integer AS lead_age_max,
      nullif(p_filters->>'callCountMin', '')::integer AS call_count_min,
      nullif(p_filters->>'callCountMax', '')::integer AS call_count_max,
      CASE
        WHEN p_filters ? 'isReEnquired' AND p_filters->>'isReEnquired' <> '' THEN (p_filters->>'isReEnquired')::boolean
        ELSE NULL
      END AS is_re_enquired
  )
  SELECT l.id
  FROM public.leads l
  CROSS JOIN filter_values f
  WHERE l.organization_id = p_organization_id
    AND (p_active_status_id IS NULL OR l.status_id = p_active_status_id)
    AND (
      f.search_term IS NULL
      OR coalesce(l.first_name, '') ILIKE '%' || f.search_term || '%'
      OR coalesce(l.last_name, '') ILIKE '%' || f.search_term || '%'
      OR coalesce(l.name, '') ILIKE '%' || f.search_term || '%'
      OR coalesce(l.email, '') ILIKE '%' || f.search_term || '%'
      OR coalesce(l.mobile_number, '') ILIKE '%' || f.search_term || '%'
    )
    AND (coalesce(array_length(f.assigned_to, 1), 0) = 0 OR l.current_lead_owner = ANY(f.assigned_to))
    AND (coalesce(array_length(f.campaign_names, 1), 0) = 0 OR l.campaign_name = ANY(f.campaign_names))
    AND (coalesce(array_length(f.channels, 1), 0) = 0 OR l.channel = ANY(f.channels))
    AND (coalesce(array_length(f.sources, 1), 0) = 0 OR l.source_id = ANY(f.sources))
    AND (coalesce(array_length(f.statuses, 1), 0) = 0 OR l.status_id = ANY(f.statuses))
    AND (coalesce(array_length(f.sub_statuses, 1), 0) = 0 OR l.sub_status_id = ANY(f.sub_statuses))
    AND (coalesce(array_length(f.cities, 1), 0) = 0 OR l.city = ANY(f.cities))
    AND (coalesce(array_length(f.countries, 1), 0) = 0 OR l.country = ANY(f.countries))
    AND (coalesce(array_length(f.current_owners, 1), 0) = 0 OR l.current_lead_owner = ANY(f.current_owners))
    AND (f.date_added_from IS NULL OR l.created_at >= f.date_added_from)
    AND (f.date_added_to IS NULL OR l.created_at <= f.date_added_to)
    AND (f.date_edited_from IS NULL OR l.updated_at >= f.date_edited_from)
    AND (f.date_edited_to IS NULL OR l.updated_at <= f.date_edited_to)
    AND (f.created_from IS NULL OR l.created_at >= f.created_from)
    AND (f.created_to IS NULL OR l.created_at <= f.created_to)
    AND (f.lead_age_min IS NULL OR l.created_at <= now() - make_interval(days => f.lead_age_min))
    AND (f.lead_age_max IS NULL OR l.created_at >= now() - make_interval(days => f.lead_age_max))
    AND (f.call_count_min IS NULL OR coalesce(l.call_count, 0) >= f.call_count_min)
    AND (f.call_count_max IS NULL OR coalesce(l.call_count, 0) <= f.call_count_max)
    AND (f.is_re_enquired IS NULL OR l.is_re_enquired = f.is_re_enquired);
$$;

CREATE OR REPLACE FUNCTION public.bulk_assign_filtered_leads(
  p_organization_id uuid,
  p_search text,
  p_active_status_id uuid,
  p_filters jsonb,
  p_new_owner_id uuid,
  p_new_owner_name text,
  p_assigned_by_id uuid,
  p_assigned_by_name text DEFAULT 'Unknown User',
  p_note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_affected_count integer := 0;
  v_changed_count integer := 0;
  v_reference_lead_id uuid;
BEGIN
  IF p_organization_id IS NULL OR p_new_owner_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Organization and new owner are required', 'affected_count', 0);
  END IF;

  WITH scoped AS (
    SELECT lead_id
    FROM public.filtered_leads_scope(p_organization_id, p_search, p_active_status_id, coalesce(p_filters, '{}'::jsonb))
  ), changed AS (
    INSERT INTO public.lead_ownership_history (lead_id, from_owner_id, to_owner_id, changed_by)
    SELECT l.id, l.current_lead_owner, p_new_owner_id, p_assigned_by_id
    FROM public.leads l
    JOIN scoped s ON s.lead_id = l.id
    WHERE l.current_lead_owner IS DISTINCT FROM p_new_owner_id
    RETURNING lead_id
  ), updated AS (
    UPDATE public.leads l
    SET current_lead_owner = p_new_owner_id,
        assigned_to = p_new_owner_id,
        updated_at = now()
    FROM scoped s
    WHERE l.id = s.lead_id
    RETURNING l.id
  )
  SELECT
    (SELECT count(*) FROM updated),
    (SELECT count(*) FROM changed),
    (SELECT min(id) FROM updated)
  INTO v_affected_count, v_changed_count, v_reference_lead_id;

  IF p_note IS NOT NULL AND btrim(p_note) <> '' THEN
    INSERT INTO public.notes (lead_id, note, created_at)
    SELECT lead_id, p_note, now()
    FROM public.filtered_leads_scope(p_organization_id, p_search, p_active_status_id, coalesce(p_filters, '{}'::jsonb));
  END IF;

  IF v_changed_count > 0 AND v_reference_lead_id IS NOT NULL THEN
    INSERT INTO public.lead_activity_log (
      lead_id, user_id, activity_type, activity_description, new_value, metadata
    ) VALUES (
      v_reference_lead_id,
      p_assigned_by_id,
      'ownership_transferred',
      p_assigned_by_name || ' assigned ' || v_changed_count || ' lead' ||
        CASE WHEN v_changed_count > 1 THEN 's' ELSE '' END || ' to ' || p_new_owner_name,
      p_new_owner_name,
      json_build_object(
        'affected_count', v_changed_count,
        'is_bulk_operation', true,
        'operation_type', 'bulk_assign_filtered',
        'new_owner_id', p_new_owner_id
      )
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'affected_count', v_affected_count,
    'leads_with_ownership_change', v_changed_count
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM, 'affected_count', 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_change_filtered_lead_status(
  p_organization_id uuid,
  p_search text,
  p_active_status_id uuid,
  p_filters jsonb,
  p_status_id uuid,
  p_sub_status_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_user_name text DEFAULT 'Unknown User'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_affected_count integer := 0;
  v_status_changed_count integer := 0;
  v_substatus_changed_count integer := 0;
  v_reference_lead_id uuid;
  v_new_status_name text;
  v_new_substatus_name text;
  v_description text;
  v_new_value text;
BEGIN
  IF p_organization_id IS NULL OR p_status_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Organization and status are required', 'affected_count', 0);
  END IF;

  SELECT display_name INTO v_new_status_name FROM public.lead_statuses WHERE id = p_status_id;
  IF p_sub_status_id IS NOT NULL THEN
    SELECT display_name INTO v_new_substatus_name FROM public.lead_statuses WHERE id = p_sub_status_id;
  END IF;

  WITH scoped AS (
    SELECT lead_id
    FROM public.filtered_leads_scope(p_organization_id, p_search, p_active_status_id, coalesce(p_filters, '{}'::jsonb))
  ), counts AS (
    SELECT
      count(*) FILTER (WHERE l.status_id IS DISTINCT FROM p_status_id) AS status_changed_count,
      count(*) FILTER (WHERE l.sub_status_id IS DISTINCT FROM p_sub_status_id) AS substatus_changed_count
    FROM public.leads l
    JOIN scoped s ON s.lead_id = l.id
  ), updated AS (
    UPDATE public.leads l
    SET status_id = p_status_id,
        sub_status_id = p_sub_status_id,
        updated_at = now()
    FROM scoped s
    WHERE l.id = s.lead_id
    RETURNING l.id
  )
  SELECT
    (SELECT count(*) FROM updated),
    (SELECT status_changed_count FROM counts),
    (SELECT substatus_changed_count FROM counts),
    (SELECT min(id) FROM updated)
  INTO v_affected_count, v_status_changed_count, v_substatus_changed_count, v_reference_lead_id;

  IF v_status_changed_count > 0 OR v_substatus_changed_count > 0 THEN
    IF v_status_changed_count > 0 AND v_substatus_changed_count > 0 THEN
      v_description := p_user_name || ' changed status to ' || coalesce(v_new_status_name, 'Unknown') ||
        ' and sub-status to ' || coalesce(v_new_substatus_name, 'None') ||
        ' for ' || greatest(v_status_changed_count, v_substatus_changed_count) || ' lead' ||
        CASE WHEN greatest(v_status_changed_count, v_substatus_changed_count) > 1 THEN 's' ELSE '' END;
      v_new_value := coalesce(v_new_status_name, 'Unknown') || ' -> ' || coalesce(v_new_substatus_name, 'None');
    ELSIF v_status_changed_count > 0 THEN
      v_description := p_user_name || ' changed status to ' || coalesce(v_new_status_name, 'Unknown') ||
        ' for ' || v_status_changed_count || ' lead' ||
        CASE WHEN v_status_changed_count > 1 THEN 's' ELSE '' END;
      v_new_value := coalesce(v_new_status_name, 'Unknown');
    ELSE
      v_description := p_user_name || ' changed sub-status to ' || coalesce(v_new_substatus_name, 'None') ||
        ' for ' || v_substatus_changed_count || ' lead' ||
        CASE WHEN v_substatus_changed_count > 1 THEN 's' ELSE '' END;
      v_new_value := coalesce(v_new_substatus_name, 'None');
    END IF;

    IF v_reference_lead_id IS NOT NULL THEN
      INSERT INTO public.lead_activity_log (
        lead_id, user_id, activity_type, activity_description, new_value, metadata
      ) VALUES (
        v_reference_lead_id,
        p_user_id,
        'status_changed',
        v_description,
        v_new_value,
        json_build_object(
          'affected_count', v_affected_count,
          'is_bulk_operation', true,
          'operation_type', 'bulk_status_change_filtered',
          'status_changed_count', v_status_changed_count,
          'substatus_changed_count', v_substatus_changed_count
        )
      );
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'affected_count', v_affected_count,
    'status_changed_count', v_status_changed_count,
    'substatus_changed_count', v_substatus_changed_count
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM, 'affected_count', 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_delete_filtered_leads(
  p_organization_id uuid,
  p_search text,
  p_active_status_id uuid,
  p_filters jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_affected_count integer := 0;
BEGIN
  WITH scoped AS (
    SELECT lead_id
    FROM public.filtered_leads_scope(p_organization_id, p_search, p_active_status_id, coalesce(p_filters, '{}'::jsonb))
  ), deleted AS (
    DELETE FROM public.leads l
    USING scoped s
    WHERE l.id = s.lead_id
    RETURNING l.id
  )
  SELECT count(*) INTO v_affected_count FROM deleted;

  RETURN json_build_object('success', true, 'affected_count', v_affected_count);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM, 'affected_count', 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.filtered_leads_scope(uuid, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_assign_filtered_leads(uuid, text, uuid, jsonb, uuid, text, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_change_filtered_lead_status(uuid, text, uuid, jsonb, uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_delete_filtered_leads(uuid, text, uuid, jsonb) TO authenticated;
