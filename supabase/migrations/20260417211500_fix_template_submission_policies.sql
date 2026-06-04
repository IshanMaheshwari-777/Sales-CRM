/*
  # Fix template submission policies for regular users

  1. Allow users to create their own unapproved templates in their organization,
     including "submit for approval" records that are not drafts.
  2. Allow users to update their own unapproved templates.
  3. Allow users to manage assignees for templates they created while those
     templates are still unapproved.
*/

DROP POLICY IF EXISTS "Users can create draft templates" ON public.message_templates;
DROP POLICY IF EXISTS "Users can update own draft templates" ON public.message_templates;

CREATE POLICY "Users can create own unapproved templates"
  ON public.message_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE profile_id = (SELECT auth.uid())
    )
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
    AND organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE profile_id = (SELECT auth.uid())
    )
    AND is_approved = false
    AND approved_by IS NULL
    AND approved_at IS NULL
  );

DROP POLICY IF EXISTS "Users can manage own unapproved template users" ON public.message_template_users;

CREATE POLICY "Users can manage own unapproved template users"
  ON public.message_template_users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.message_templates mt
      WHERE mt.id = message_template_users.template_id
      AND mt.created_by = (SELECT auth.uid())
      AND mt.is_approved = false
    )
  );

CREATE POLICY "Users can delete own unapproved template users"
  ON public.message_template_users FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.message_templates mt
      WHERE mt.id = message_template_users.template_id
      AND mt.created_by = (SELECT auth.uid())
      AND mt.is_approved = false
    )
  );
