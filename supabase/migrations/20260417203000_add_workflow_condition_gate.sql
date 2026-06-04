/*
  # Add logical gate to workflow conditions

  Stores the boolean connector used between workflow conditions.
*/

ALTER TABLE public.workflow_conditions
ADD COLUMN IF NOT EXISTS logical_gate text NOT NULL DEFAULT 'AND'
CHECK (logical_gate IN ('AND', 'OR'));
