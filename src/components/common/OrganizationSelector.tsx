import React, { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../contexts/PermissionsContext';
import { isIgnorableRequestError } from '../../lib/requestErrors';

interface Organization {
  id: string;
  name: string;
  status: string;
}

interface OrganizationSelectorProps {
  value: string;
  onChange: (organizationId: string) => void;
  error?: string;
  disabled?: boolean;
  label?: string;
  required?: boolean;
}

export function OrganizationSelector({
  value,
  onChange,
  error,
  disabled = false,
  label = 'Organization',
  required = true,
}: OrganizationSelectorProps) {
  const { userProfile, isSuperAdmin } = usePermissions();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    loadOrganizations(controller.signal);
    return () => controller.abort();
  }, []);

  async function loadOrganizations(signal?: AbortSignal) {
    try {
      setLoading(true);
      setOrganizations([]);

      const { data, error: fetchError } = await supabase
        .rpc('get_accessible_organizations')
        .abortSignal(signal ?? new AbortController().signal);

      if (fetchError) throw fetchError;

      setOrganizations((data || []).map((org: any) => ({
        id: org.id,
        name: org.name,
        status: org.status,
      })));

      // Auto-select organization for non-super admins
      if (!isSuperAdmin && userProfile?.organization_id && !value) {
        onChange(userProfile.organization_id);
      }
    } catch (error) {
      if (!isIgnorableRequestError(error)) {
        console.error('Error loading organizations:', error);
      }
    } finally {
      setLoading(false);
    }
  }

  // For non-super admins, show the organization name as read-only text
  if (!isSuperAdmin) {
    const userOrganization = organizations.find(org => org.id === userProfile?.organization_id);

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
          <Building2 className="w-4 h-4 text-gray-400" />
          <span className="text-gray-900">
            {loading ? 'Loading...' : userOrganization?.name || 'Your Organization'}
          </span>
        </div>
      </div>
    );
  }

  // For super admins, show a dropdown selector
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative">
        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || loading}
          className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            error ? 'border-red-300' : 'border-gray-300'
          } ${disabled || loading ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'}`}
        >
          <option value="">
            {loading ? 'Loading organizations...' : 'Select an organization'}
          </option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
