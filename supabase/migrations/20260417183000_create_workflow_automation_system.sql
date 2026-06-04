/*
  # Workflow Automation System

  Adds workflow automation tables, indexes, RLS policies, and permissions for
  lead-based backend-driven automations.
*/

CREATE TABLE IF NOT EXISTS public.workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('UPDATE_ATTRIBUTES', 'SEND_IMMEDIATE_COMMUNICATION')),
  start_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  field_key text NOT NULL,
  operator text NOT NULL,
  value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workflow_id, position)
);

CREATE TABLE IF NOT EXISTS public.workflow_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  action_type text NOT NULL CHECK (action_type IN ('update_field', 'create_followup', 'send_email')),
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workflow_id, position)
);

CREATE TABLE IF NOT EXISTS public.workflow_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  current_action_index integer NOT NULL DEFAULT 0,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workflow_id, lead_id)
);

CREATE TABLE IF NOT EXISTS public.workflow_execution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES public.workflow_enrollments(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  action_index integer,
  action_type text,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_workflows_org_active_start ON public.workflows(organization_id, is_active, start_at);
CREATE INDEX IF NOT EXISTS idx_workflow_conditions_workflow ON public.workflow_conditions(workflow_id, position);
CREATE INDEX IF NOT EXISTS idx_workflow_actions_workflow ON public.workflow_actions(workflow_id, position);
CREATE INDEX IF NOT EXISTS idx_workflow_enrollments_status_next_run ON public.workflow_enrollments(status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_workflow_enrollments_workflow ON public.workflow_enrollments(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_workflow_created ON public.workflow_execution_logs(workflow_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_workflow_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_workflows_updated_at ON public.workflows;
CREATE TRIGGER set_workflows_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW
  EXECUTE FUNCTION public.set_workflow_updated_at();

DROP TRIGGER IF EXISTS set_workflow_conditions_updated_at ON public.workflow_conditions;
CREATE TRIGGER set_workflow_conditions_updated_at
  BEFORE UPDATE ON public.workflow_conditions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_workflow_updated_at();

DROP TRIGGER IF EXISTS set_workflow_actions_updated_at ON public.workflow_actions;
CREATE TRIGGER set_workflow_actions_updated_at
  BEFORE UPDATE ON public.workflow_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_workflow_updated_at();

DROP TRIGGER IF EXISTS set_workflow_enrollments_updated_at ON public.workflow_enrollments;
CREATE TRIGGER set_workflow_enrollments_updated_at
  BEFORE UPDATE ON public.workflow_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_workflow_updated_at();

DROP POLICY IF EXISTS "Admins can manage workflows in their organization" ON public.workflows;
CREATE POLICY "Admins can manage workflows in their organization"
  ON public.workflows FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE profile_id = (SELECT auth.uid())
    )
    AND public.get_my_role_hierarchy_level() <= 2
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE profile_id = (SELECT auth.uid())
    )
    AND public.get_my_role_hierarchy_level() <= 2
  );

DROP POLICY IF EXISTS "Admins can manage workflow conditions" ON public.workflow_conditions;
CREATE POLICY "Admins can manage workflow conditions"
  ON public.workflow_conditions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.workflows w
      JOIN public.organization_members om ON om.organization_id = w.organization_id
      WHERE w.id = workflow_conditions.workflow_id
      AND om.profile_id = (SELECT auth.uid())
      AND public.get_my_role_hierarchy_level() <= 2
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.workflows w
      JOIN public.organization_members om ON om.organization_id = w.organization_id
      WHERE w.id = workflow_conditions.workflow_id
      AND om.profile_id = (SELECT auth.uid())
      AND public.get_my_role_hierarchy_level() <= 2
    )
  );

DROP POLICY IF EXISTS "Admins can manage workflow actions" ON public.workflow_actions;
CREATE POLICY "Admins can manage workflow actions"
  ON public.workflow_actions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.workflows w
      JOIN public.organization_members om ON om.organization_id = w.organization_id
      WHERE w.id = workflow_actions.workflow_id
      AND om.profile_id = (SELECT auth.uid())
      AND public.get_my_role_hierarchy_level() <= 2
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.workflows w
      JOIN public.organization_members om ON om.organization_id = w.organization_id
      WHERE w.id = workflow_actions.workflow_id
      AND om.profile_id = (SELECT auth.uid())
      AND public.get_my_role_hierarchy_level() <= 2
    )
  );

DROP POLICY IF EXISTS "Admins can view workflow enrollments in their organization" ON public.workflow_enrollments;
CREATE POLICY "Admins can view workflow enrollments in their organization"
  ON public.workflow_enrollments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.workflows w
      JOIN public.organization_members om ON om.organization_id = w.organization_id
      WHERE w.id = workflow_enrollments.workflow_id
      AND om.profile_id = (SELECT auth.uid())
      AND public.get_my_role_hierarchy_level() <= 2
    )
  );

DROP POLICY IF EXISTS "Admins can view workflow execution logs in their organization" ON public.workflow_execution_logs;
CREATE POLICY "Admins can view workflow execution logs in their organization"
  ON public.workflow_execution_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.workflows w
      JOIN public.organization_members om ON om.organization_id = w.organization_id
      WHERE w.id = workflow_execution_logs.workflow_id
      AND om.profile_id = (SELECT auth.uid())
      AND public.get_my_role_hierarchy_level() <= 2
    )
  );

INSERT INTO public.permissions (module_name, action_name, permission_key, description)
SELECT 'Workflow Automation', 'View', 'workflow.view', 'View workflow automations'
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions WHERE permission_key = 'workflow.view'
);

INSERT INTO public.permissions (module_name, action_name, permission_key, description)
SELECT 'Workflow Automation', 'Manage', 'workflow.manage', 'Create and manage workflow automations'
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions WHERE permission_key = 'workflow.manage'
);

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.hierarchy_level <= 2
AND p.permission_key IN ('workflow.view', 'workflow.manage')
AND NOT EXISTS (
  SELECT 1
  FROM public.role_permissions rp
  WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
);
