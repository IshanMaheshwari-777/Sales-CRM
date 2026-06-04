/*
  # Allow super admins to manage webhook resources for the actively selected org

  The Webhook Integration module is driven by the active organization selected in the
  super-admin org switcher (stored on profiles.organization_id). Super admins may not
  always have a matching organization_members row for every accessible org, which blocks
  webhook config creation for switched orgs under the existing membership-only policies.

  This migration keeps normal admin scoping unchanged while allowing super admins to
  manage webhook configurations, endpoints, and request logs across accessible orgs.
*/

DROP POLICY IF EXISTS "Admins can delete webhook configs" ON public.webhook_configurations;
DROP POLICY IF EXISTS "Admins can insert webhook configs" ON public.webhook_configurations;
DROP POLICY IF EXISTS "Admins can update webhook configs" ON public.webhook_configurations;
DROP POLICY IF EXISTS "Users can view own organization webhook configs" ON public.webhook_configurations;

CREATE POLICY "Admins can delete webhook configs"
  ON public.webhook_configurations FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (
      organization_id IN (
        SELECT organization_id
        FROM public.organization_members
        WHERE profile_id = auth.uid()
      )
      AND public.get_my_role_hierarchy_level() <= 2
    )
  );

CREATE POLICY "Admins can insert webhook configs"
  ON public.webhook_configurations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (
      organization_id IN (
        SELECT organization_id
        FROM public.organization_members
        WHERE profile_id = auth.uid()
      )
      AND public.get_my_role_hierarchy_level() <= 2
    )
  );

CREATE POLICY "Admins can update webhook configs"
  ON public.webhook_configurations FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (
      organization_id IN (
        SELECT organization_id
        FROM public.organization_members
        WHERE profile_id = auth.uid()
      )
      AND public.get_my_role_hierarchy_level() <= 2
    )
  );

CREATE POLICY "Users can view own organization webhook configs"
  ON public.webhook_configurations FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage integration endpoints" ON public.integration_endpoints;
DROP POLICY IF EXISTS "Users can view own organization endpoints" ON public.integration_endpoints;

CREATE POLICY "Admins can manage integration endpoints"
  ON public.integration_endpoints FOR ALL
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (
      organization_id IN (
        SELECT organization_id
        FROM public.organization_members
        WHERE profile_id = auth.uid()
      )
      AND public.get_my_role_hierarchy_level() <= 2
    )
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (
      organization_id IN (
        SELECT organization_id
        FROM public.organization_members
        WHERE profile_id = auth.uid()
      )
      AND public.get_my_role_hierarchy_level() <= 2
    )
  );

CREATE POLICY "Users can view own organization endpoints"
  ON public.integration_endpoints FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can view webhook request logs" ON public.webhook_request_log;

CREATE POLICY "Admins can view webhook request logs"
  ON public.webhook_request_log FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (
      organization_id IN (
        SELECT organization_id
        FROM public.organization_members
        WHERE profile_id = auth.uid()
      )
      AND public.get_my_role_hierarchy_level() <= 2
    )
  );
