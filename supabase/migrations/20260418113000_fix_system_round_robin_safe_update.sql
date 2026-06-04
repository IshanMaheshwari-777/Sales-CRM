/*
  # Fix System Round Robin Safe Update

  ## Purpose
  Supabase Safe Update rejects UPDATE statements without a WHERE clause.
  The fallback lead auto-assignment function `get_next_system_counselor()`
  updated `system_round_robin_state` without targeting a specific row,
  which caused webhook-created leads to fail during insert.

  ## Changes
  - Recreate `get_next_system_counselor()` so it targets a single state row
  - Seed the state row if it is missing
*/

CREATE OR REPLACE FUNCTION public.get_next_system_counselor()
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_counselor_id uuid;
  v_last_assigned_id uuid;
  v_counselor_count integer;
  v_state_id uuid;
BEGIN
  -- Ensure a state row exists and capture its id for safe updates.
  SELECT id, last_assigned_counselor_id
  INTO v_state_id, v_last_assigned_id
  FROM public.system_round_robin_state
  ORDER BY updated_at ASC, id ASC
  LIMIT 1;

  IF v_state_id IS NULL THEN
    INSERT INTO public.system_round_robin_state (last_assigned_counselor_id, updated_at)
    VALUES (NULL, now())
    RETURNING id, last_assigned_counselor_id INTO v_state_id, v_last_assigned_id;
  END IF;

  -- Get count of active counselors
  SELECT COUNT(*) INTO v_counselor_count
  FROM public.profiles
  WHERE id IN (SELECT id FROM auth.users);

  -- If no counselors, return null
  IF v_counselor_count = 0 THEN
    RETURN NULL;
  END IF;

  -- If no one has been assigned yet, get the first counselor
  IF v_last_assigned_id IS NULL THEN
    SELECT id INTO v_counselor_id
    FROM public.profiles
    WHERE id IN (SELECT id FROM auth.users)
    ORDER BY created_at ASC
    LIMIT 1;
  ELSE
    -- Get the next counselor in order (circular by created_at)
    SELECT id INTO v_counselor_id
    FROM public.profiles
    WHERE id IN (SELECT id FROM auth.users)
      AND created_at > (
        SELECT created_at FROM public.profiles WHERE id = v_last_assigned_id
      )
    ORDER BY created_at ASC
    LIMIT 1;

    -- If no next counselor (end of list), wrap around to first
    IF v_counselor_id IS NULL THEN
      SELECT id INTO v_counselor_id
      FROM public.profiles
      WHERE id IN (SELECT id FROM auth.users)
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;
  END IF;

  -- Update system round robin state
  IF v_counselor_id IS NOT NULL THEN
    UPDATE public.system_round_robin_state
    SET last_assigned_counselor_id = v_counselor_id,
        updated_at = now()
    WHERE id = v_state_id;
  END IF;

  RETURN v_counselor_id;
END;
$$;
