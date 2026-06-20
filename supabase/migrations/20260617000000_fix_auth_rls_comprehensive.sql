/*
  # Comprehensive Auth & RLS Fix

  ROOT CAUSES FIXED:
  1. handle_new_user() created profiles with NULL role_id
     → JWT had no role → ALL role-based RLS policies failed silently
  2. handle_new_user() did NOT create an organization_members record
     → org-based RLS checks failed → users couldn't insert/view anything
  3. Existing users have NULL role_id and/or missing org membership
  4. JWT metadata out of sync for existing users

  STEPS:
  A. Fix handle_new_user trigger (prevents all future signup issues)
  B. Backfill organization_id for profiles where it is NULL
  C. Backfill role_id for profiles where it is NULL (→ Sales Representative)
  D. Create organization_members for every user who does not have one
  E. Sync organization_members role with profile role (fix drift)
  F. Re-sync JWT app_metadata (role_id) for ALL existing users
  G. Add sync_user_jwt_claims() admin RPC for manual use
*/

-- ============================================================
-- A. Fix handle_new_user trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_org_id  uuid;
  v_role_id uuid;
BEGIN
  -- Get the first/default organization
  SELECT id INTO v_org_id
  FROM public.organizations
  ORDER BY created_at ASC
  LIMIT 1;

  -- Default role: Sales Representative (lowest privilege)
  SELECT id INTO v_role_id
  FROM public.roles
  WHERE role_name = 'Sales Representative'
  LIMIT 1;

  -- Fallback: role with highest hierarchy_level = lowest privilege
  IF v_role_id IS NULL THEN
    SELECT id INTO v_role_id
    FROM public.roles
    ORDER BY hierarchy_level DESC NULLS LAST
    LIMIT 1;
  END IF;

  -- Create profile (ON CONFLICT: Supabase can occasionally fire trigger twice)
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    first_name,
    last_name,
    organization_id,
    role_id,
    status
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(TRIM(
        COALESCE(NEW.raw_user_meta_data->>'first_name', '') ||
        ' ' ||
        COALESCE(NEW.raw_user_meta_data->>'last_name', '')
      ), ''),
      NEW.email
    ),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'first_name', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'last_name', '')), ''),
    v_org_id,
    v_role_id,
    'active'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create organization membership immediately
  IF v_org_id IS NOT NULL AND v_role_id IS NOT NULL THEN
    INSERT INTO public.organization_members (
      organization_id,
      profile_id,
      role_id,
      joined_at
    )
    VALUES (
      v_org_id,
      NEW.id,
      v_role_id,
      now()
    )
    ON CONFLICT (profile_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Re-bind the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- B. Backfill profiles with NULL organization_id
-- ============================================================
UPDATE public.profiles
SET organization_id = (
  SELECT id FROM public.organizations ORDER BY created_at ASC LIMIT 1
)
WHERE organization_id IS NULL;

-- ============================================================
-- C. Backfill profiles with NULL role_id -> Sales Representative
-- ============================================================
DO $$
DECLARE
  v_default_role_id uuid;
BEGIN
  SELECT id INTO v_default_role_id
  FROM public.roles
  WHERE role_name = 'Sales Representative'
  LIMIT 1;

  IF v_default_role_id IS NULL THEN
    SELECT id INTO v_default_role_id
    FROM public.roles
    ORDER BY hierarchy_level DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_default_role_id IS NOT NULL THEN
    UPDATE public.profiles
    SET role_id = v_default_role_id
    WHERE role_id IS NULL;
    RAISE NOTICE 'Backfilled role_id for all profiles with NULL role';
  ELSE
    RAISE WARNING 'No roles found — skipping role backfill';
  END IF;
END $$;

-- ============================================================
-- D. Create organization_members for every profile that lacks one
-- ============================================================
INSERT INTO public.organization_members (
  organization_id,
  profile_id,
  role_id,
  joined_at
)
SELECT
  p.organization_id,
  p.id,
  p.role_id,
  COALESCE(p.created_at, now())
FROM public.profiles p
WHERE p.organization_id IS NOT NULL
  AND p.role_id         IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.profile_id = p.id
  )
ON CONFLICT (profile_id) DO NOTHING;

-- ============================================================
-- E. Sync organization_members role/org with profile (fix drift)
-- ============================================================
UPDATE public.organization_members om
SET
  role_id         = p.role_id,
  organization_id = p.organization_id
FROM public.profiles p
WHERE om.profile_id      = p.id
  AND p.role_id          IS NOT NULL
  AND p.organization_id  IS NOT NULL
  AND (
    om.role_id         IS DISTINCT FROM p.role_id
    OR
    om.organization_id IS DISTINCT FROM p.organization_id
  );

-- ============================================================
-- F. Re-sync JWT app_metadata (role_id) for ALL existing users
--    After this, every user's next login (or refreshSession call)
--    will have the correct role in their JWT.
-- ============================================================
DO $$
DECLARE
  rec           RECORD;
  updated_count integer := 0;
BEGIN
  FOR rec IN
    SELECT p.id, p.role_id
    FROM public.profiles p
    WHERE p.role_id IS NOT NULL
  LOOP
    UPDATE auth.users
    SET raw_app_meta_data =
      COALESCE(raw_app_meta_data, '{}'::jsonb) ||
      jsonb_build_object('role_id', rec.role_id::text)
    WHERE id = rec.id;

    updated_count := updated_count + 1;
  END LOOP;

  RAISE NOTICE 'Re-synced JWT app_metadata for % users', updated_count;
END $$;

-- ============================================================
-- G. Admin helper RPC: sync_user_jwt_claims(user_id uuid)
--    Call after manually changing a user's role so the next
--    refreshSession() picks it up immediately.
--    Pass NULL to sync ALL users at once.
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_user_jwt_claims(p_user_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer := 0;
BEGIN
  IF p_user_id IS NOT NULL THEN
    UPDATE auth.users u
    SET raw_app_meta_data =
      COALESCE(u.raw_app_meta_data, '{}'::jsonb) ||
      jsonb_build_object('role_id', p.role_id::text)
    FROM public.profiles p
    WHERE u.id    = p_user_id
      AND p.id    = p_user_id
      AND p.role_id IS NOT NULL;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN format('Synced JWT claims for user %s (%s row updated)', p_user_id, updated_count);
  ELSE
    UPDATE auth.users u
    SET raw_app_meta_data =
      COALESCE(u.raw_app_meta_data, '{}'::jsonb) ||
      jsonb_build_object('role_id', p.role_id::text)
    FROM public.profiles p
    WHERE u.id        = p.id
      AND p.role_id   IS NOT NULL;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN format('Synced JWT claims for all users (%s rows updated)', updated_count);
  END IF;
END;
$$;
