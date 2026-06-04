CREATE OR REPLACE FUNCTION public.get_accessible_organizations()
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.name, o.slug, o.status::text
  FROM public.organizations o
  WHERE o.status = 'active'
    AND (
      public.is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.organization_id = o.id
          AND om.profile_id = auth.uid()
      )
    )
  ORDER BY o.name;
$$;

REVOKE ALL ON FUNCTION public.get_accessible_organizations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_accessible_organizations() TO authenticated;
