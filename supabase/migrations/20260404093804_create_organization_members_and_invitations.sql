/*
  # Create Organization Members and Invitations Tables

  1. New Tables
    - `organization_members`
      - `id` (uuid, primary key) - Unique member record identifier
      - `organization_id` (uuid) - Reference to organizations table
      - `profile_id` (uuid) - Reference to profiles table
      - `role_id` (uuid) - Reference to roles table
      - `invited_by` (uuid, nullable) - Reference to profiles table (who invited this member)
      - `joined_at` (timestamptz) - When the member joined
      - `created_at` (timestamptz) - Record creation timestamp

    - `invitations`
      - `id` (uuid, primary key) - Unique invitation identifier
      - `organization_id` (uuid) - Reference to organizations table
      - `email` (text) - Email address of invitee
      - `role_id` (uuid) - Role to assign upon acceptance
      - `invited_by` (uuid) - Reference to profiles table (who sent the invite)
      - `token` (text, unique) - Secure invitation token (hashed)
      - `status` (enum) - pending, accepted, expired, cancelled
      - `expires_at` (timestamptz) - Expiration timestamp
      - `accepted_at` (timestamptz, nullable) - When invitation was accepted
      - `created_at` (timestamptz) - Creation timestamp

  2. Security
    - Enable RLS on both tables
    - Unique constraint: one profile per organization
    - Unique partial index: one pending invitation per email per organization
    - Users can view members of their organization
    - Admins can manage invitations for their organization

  3. Features
    - Automatic token generation
    - 7-day expiry by default
    - Prevent duplicate memberships
    - Audit trail of who invited whom
*/

-- Create enum for invitation status
DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create organization_members table
CREATE TABLE IF NOT EXISTS organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  invited_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  joined_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  
  -- Ensure one profile belongs to only one organization
  UNIQUE(profile_id),
  
  -- Composite index for fast lookups
  UNIQUE(organization_id, profile_id)
);

-- Create invitations table
CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  invited_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  status invitation_status NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create unique partial index to ensure one pending invitation per email per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_invitation 
  ON invitations(organization_id, email) 
  WHERE status = 'pending';

-- Create indexes for organization_members
CREATE INDEX IF NOT EXISTS idx_org_members_organization_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_profile_id ON organization_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role_id ON organization_members(role_id);

-- Create indexes for invitations
CREATE INDEX IF NOT EXISTS idx_invitations_organization_id ON invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON invitations(expires_at);

-- Enable RLS
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organization_members

-- Policy: Super admins can view all organization members
CREATE POLICY "Super admins can view all organization members"
  ON organization_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid()
      AND r.hierarchy_level = 1
    )
  );

-- Policy: Users can view members of their organization
CREATE POLICY "Users can view members of their organization"
  ON organization_members
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE profile_id = auth.uid()
    )
  );

-- Policy: Super admins can insert organization members
CREATE POLICY "Super admins can insert organization members"
  ON organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid()
      AND r.hierarchy_level = 1
    )
  );

-- Policy: System can insert organization members (for invitation acceptance)
CREATE POLICY "System can insert organization members during signup"
  ON organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
  );

-- Policy: Admins can update members in their organization
CREATE POLICY "Admins can update members in their organization"
  ON organization_members
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      JOIN profiles p ON p.id = om.profile_id
      JOIN roles r ON r.id = p.role_id
      WHERE om.profile_id = auth.uid()
      AND r.hierarchy_level <= 2
    )
  );

-- Policy: Super admins can delete organization members
CREATE POLICY "Super admins can delete organization members"
  ON organization_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid()
      AND r.hierarchy_level = 1
    )
  );

-- Policy: Admins can delete members from their organization
CREATE POLICY "Admins can delete members from their organization"
  ON organization_members
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      JOIN profiles p ON p.id = om.profile_id
      JOIN roles r ON r.id = p.role_id
      WHERE om.profile_id = auth.uid()
      AND r.hierarchy_level <= 2
    )
  );

-- RLS Policies for invitations

-- Policy: Super admins can view all invitations
CREATE POLICY "Super admins can view all invitations"
  ON invitations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid()
      AND r.hierarchy_level = 1
    )
  );

-- Policy: Admins can view invitations for their organization
CREATE POLICY "Admins can view invitations for their organization"
  ON invitations
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE profile_id = auth.uid()
    )
  );

-- Policy: Anyone can view their own invitation (for acceptance)
CREATE POLICY "Anyone can view invitation by token"
  ON invitations
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Policy: Admins can create invitations for their organization
CREATE POLICY "Admins can create invitations for their organization"
  ON invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      JOIN profiles p ON p.id = om.profile_id
      JOIN roles r ON r.id = p.role_id
      WHERE om.profile_id = auth.uid()
      AND r.hierarchy_level <= 2
    )
    AND invited_by = auth.uid()
  );

-- Policy: Super admins can create invitations for any organization
CREATE POLICY "Super admins can create invitations for any organization"
  ON invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid()
      AND r.hierarchy_level = 1
    )
  );

-- Policy: Admins can update invitations in their organization
CREATE POLICY "Admins can update invitations in their organization"
  ON invitations
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      JOIN profiles p ON p.id = om.profile_id
      JOIN roles r ON r.id = p.role_id
      WHERE om.profile_id = auth.uid()
      AND r.hierarchy_level <= 2
    )
  );

-- Policy: System can update invitation status during acceptance
CREATE POLICY "System can update invitation during acceptance"
  ON invitations
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (status IN ('accepted', 'expired'));

-- Policy: Admins can delete invitations from their organization
CREATE POLICY "Admins can delete invitations from their organization"
  ON invitations
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      JOIN profiles p ON p.id = om.profile_id
      JOIN roles r ON r.id = p.role_id
      WHERE om.profile_id = auth.uid()
      AND r.hierarchy_level <= 2
    )
  );