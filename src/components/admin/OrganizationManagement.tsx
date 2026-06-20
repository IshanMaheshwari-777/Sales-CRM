// @ts-nocheck

import { useState, useEffect } from 'react';
import { Building2, UserPlus, MoreVertical, CreditCard as Edit, Trash2, Users, Crown, Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AddEditOrganizationModal } from './AddEditOrganizationModal';
import { isIgnorableRequestError } from '../../lib/requestErrors';
import { useToast } from '../../contexts/ToastContext';

interface Organization {
  id: string;
  name: string;
  slug: string;
  tier: string;
  max_users: number | null;
  status: 'active' | 'suspended';
  created_at: string;
  owner_id: string;
  member_count?: number;
}

export function OrganizationManagement() {
  const { showError } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTier, setFilterTier] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    loadOrganizations(controller.signal);
    return () => controller.abort();
  }, []);

  const loadOrganizations = async (signal?: AbortSignal) => {
    try {
      setLoading(true);

      // Get organizations first
      const { data: orgs, error } = await supabase
        .from('organizations')
        .select('*')
        .abortSignal(signal ?? new AbortController().signal)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get member counts separately using RPC or direct query
      const { data: memberCounts } = await supabase
        .from('organization_members')
        .select('organization_id')
        .abortSignal(signal ?? new AbortController().signal);

      // Count members per organization
      const countMap = new Map<string, number>();
      memberCounts?.forEach(member => {
        const current = countMap.get(member.organization_id) || 0;
        countMap.set(member.organization_id, current + 1);
      });

      // Combine the data
      const orgsWithCounts = orgs?.map(org => ({
        ...org,
        member_count: countMap.get(org.id) || 0,
      })) || [];

      setOrganizations(orgsWithCounts);
    } catch (error) {
      if (!isIgnorableRequestError(error)) {
        console.error('Error loading organizations:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (orgId: string, currentStatus: 'active' | 'suspended') => {
    try {
      const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
      const { error } = await supabase
        .from('organizations')
        .update({ status: newStatus })
        .eq('id', orgId);

      if (error) throw error;
      loadOrganizations();
    } catch (error) {
      console.error('Error toggling organization status:', error);
      showError('Failed to update organization status');
    }
  };

  const handleDeleteOrg = async (orgId: string) => {
    if (!confirm('Are you sure you want to delete this organization? This will affect all users and data associated with it.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', orgId);

      if (error) throw error;
      loadOrganizations();
    } catch (error) {
      console.error('Error deleting organization:', error);
      showError('Failed to delete organization. Make sure there are no dependent records.');
    }
  };

  const filteredOrgs = organizations.filter(org => {
    const matchesSearch = org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         org.slug.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTier = filterTier === 'all' || org.tier === filterTier;
    const matchesStatus = filterStatus === 'all' ||
                         (filterStatus === 'active' && org.status === 'active') ||
                         (filterStatus === 'suspended' && org.status === 'suspended');

    return matchesSearch && matchesTier && matchesStatus;
  });

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'enterprise': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pro': return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'custom': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'starter': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getUsageColor = (current: number, max: number | null) => {
    if (!max) return 'text-gray-600';
    const percentage = (current / max) * 100;
    if (percentage >= 90) return 'text-red-600 font-semibold';
    if (percentage >= 75) return 'text-orange-600 font-semibold';
    return 'text-green-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading organizations...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Organization Management</h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage all organizations across the platform
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Building2 className="w-4 h-4" />
            Create Organization
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search organizations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Tiers</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
            <option value="custom">Custom</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Organizations Grid */}
      {filteredOrgs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No organizations found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredOrgs.map((org) => (
            <div
              key={org.id}
              className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{org.name}</h3>
                      <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${getTierBadgeColor(org.tier)}`}>
                        {org.tier.charAt(0).toUpperCase() + org.tier.slice(1)}
                      </span>
                      {org.status === 'active' ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                          <Check className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                          <X className="w-3 h-3" />
                          Suspended
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-600 mb-3">
                      Slug: <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">{org.slug}</code>
                    </p>

                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className={getUsageColor(org.member_count || 0, org.max_users)}>
                          {org.member_count || 0}
                          {org.max_users ? ` / ${org.max_users}` : ' / ∞'} users
                        </span>
                      </div>
                      <div className="text-gray-500">
                        Created {new Date(org.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions Menu */}
                <div className="relative">
                  <button
                    onClick={() => setSelectedOrgId(selectedOrgId === org.id ? null : org.id)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <MoreVertical className="w-5 h-5 text-gray-600" />
                  </button>

                  {selectedOrgId === org.id && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      <button
                        onClick={() => {
                          setEditingOrg(org);
                          setSelectedOrgId(null);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        Edit Organization
                      </button>
                      <button
                        onClick={() => {
                          handleToggleActive(org.id, org.status);
                          setSelectedOrgId(null);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        {org.status === 'active' ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                        {org.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                      <button
                        onClick={() => {
                          handleDeleteOrg(org.id);
                          setSelectedOrgId(null);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2 border-t border-gray-200"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddEditOrganizationModal
          onClose={() => setShowAddModal(false)}
          onSave={() => {
            setShowAddModal(false);
            loadOrganizations();
          }}
        />
      )}

      {editingOrg && (
        <AddEditOrganizationModal
          organization={editingOrg}
          onClose={() => setEditingOrg(null)}
          onSave={() => {
            setEditingOrg(null);
            loadOrganizations();
          }}
        />
      )}
    </div>
  );
}
