/*
  # Backfill organization_members from profiles

  Fix invited users whose profile was updated with organization and role details
  but who never received a matching organization_members row, or whose membership
  role drifted out of sync with their profile.
*/

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
  COALESCE(p.last_login_at, now())
FROM public.profiles p
WHERE p.organization_id IS NOT NULL
  AND p.role_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.profile_id = p.id
  );

UPDATE public.organization_members om
SET
  organization_id = p.organization_id,
  role_id = p.role_id
FROM public.profiles p
WHERE p.id = om.profile_id
  AND p.organization_id IS NOT NULL
  AND p.role_id IS NOT NULL
  AND (
    om.organization_id IS DISTINCT FROM p.organization_id
    OR om.role_id IS DISTINCT FROM p.role_id
  );
