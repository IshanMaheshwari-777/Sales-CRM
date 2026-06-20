// @ts-nocheck
import { useState, useEffect } from 'react';
import { X, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';

interface Organization {
  id: string;
  name: string;
  slug: string;
  tier: string;
  max_users: number | null;
  status: 'active' | 'suspended';
}

interface AddEditOrganizationModalProps {
  organization?: Organization;
  onClose: () => void;
  onSave: () => void;
}

export function AddEditOrganizationModal({ organization, onClose, onSave }: AddEditOrganizationModalProps) {
  const { showError, showSuccess } = useToast();
  const [formData, setFormData] = useState({
    name: organization?.name || '',
    slug: organization?.slug || '',
    tier: organization?.tier || 'starter',
    max_users: organization?.max_users?.toString() || '',
    status: organization?.status || 'active' as 'active' | 'suspended',
  });
  const [saving, setSaving] = useState(false);

  const isEditing = !!organization;

  // Auto-generate slug from name
  useEffect(() => {
    if (!isEditing && formData.name && !organization) {
      const slug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setFormData(prev => ({ ...prev, slug }));
    }
  }, [formData.name, isEditing, organization]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showError('Organization name is required');
      return;
    }

    if (!formData.slug.trim()) {
      showError('Organization slug is required');
      return;
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      showError('Slug can only contain lowercase letters, numbers, and hyphens');
      return;
    }

    try {
      setSaving(true);

      const orgData = {
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        tier: formData.tier,
        max_users: formData.max_users ? parseInt(formData.max_users) : null,
        status: formData.status,
      };

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('organizations')
          .update(orgData)
          .eq('id', organization.id);

        if (updateError) throw updateError;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: newOrg, error: insertError } = await supabase
          .from('organizations')
          .insert({
            ...orgData,
            owner_id: user.id,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        if (!newOrg) throw new Error('Failed to create organization');

        const { data: profile } = await supabase
          .from('profiles')
          .select('role_id')
          .eq('id', user.id)
          .single();

        if (profile?.role_id) {
          const { error: memberError } = await supabase
            .from('organization_members')
            .insert({
              organization_id: newOrg.id,
              profile_id: user.id,
              role_id: profile.role_id,
              invited_by: user.id,
            });

          if (memberError) {
            console.error('Failed to add creator as member:', memberError);
          }
        }
      }

      showSuccess(organization ? 'Organization updated successfully' : 'Organization created successfully');
      onSave();
    } catch (err: any) {
      console.error('Error saving organization:', err);
      if (err.code === '23505') {
        showError('An organization with this slug already exists');
      } else {
        showError(err.message || 'Failed to save organization');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Edit Organization' : 'Create Organization'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Organization Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Acme Corporation"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Slug *
            </label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              placeholder="acme-corporation"
              pattern="[a-z0-9-]+"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Used in URLs. Only lowercase letters, numbers, and hyphens.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tier *
            </label>
            <select
              value={formData.tier}
              onChange={(e) => setFormData({ ...formData, tier: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maximum Users
            </label>
            <input
              type="number"
              value={formData.max_users}
              onChange={(e) => setFormData({ ...formData, max_users: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Leave empty for unlimited"
              min="1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty for unlimited users.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status *
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'suspended' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : (isEditing ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
