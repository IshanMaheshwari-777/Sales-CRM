/*
  # Harden message template creation

  1. Add an effective organization helper that falls back to profiles.organization_id
     when organization_members is missing or delayed.
  2. Auto-populate message_templates.organization_id before insert/update.
  3. Relax regular-user template policies to use the effective organization helper.

  This makes template creation resilient even when an older frontend sends
  organization_id as null.
*/

CREATE OR REPLACE FUNCTION public.get_effective_user_organization_id(user_uuid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.profile_id = user_uuid
      LIMIT 1
    ),
    (
      SELECT p.organization_id
      FROM public.profiles p
      WHERE p.id = user_uuid
      LIMIT 1
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.set_message_template_organization_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.get_effective_user_organization_id(NEW.created_by);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_message_template_organization_id ON public.message_templates;
CREATE TRIGGER set_message_template_organization_id
  BEFORE INSERT OR UPDATE ON public.message_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_message_template_organization_id();

DROP POLICY IF EXISTS "Users can create own unapproved templates" ON public.message_templates;
DROP POLICY IF EXISTS "Users can update own unapproved templates" ON public.message_templates;

CREATE POLICY "Users can create own unapproved templates"
  ON public.message_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND organization_id = public.get_effective_user_organization_id((SELECT auth.uid()))
    AND is_approved = false
    AND approved_by IS NULL
    AND approved_at IS NULL
  );

CREATE POLICY "Users can update own unapproved templates"
  ON public.message_templates FOR UPDATE
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    AND is_approved = false
  )
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND organization_id = public.get_effective_user_organization_id((SELECT auth.uid()))
    AND is_approved = false
    AND approved_by IS NULL
    AND approved_at IS NULL
  );
