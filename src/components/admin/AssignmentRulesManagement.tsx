import { useState, useRef, useEffect, useMemo } from 'react';
import { RefreshCw, Filter, CreditCard as Edit, MoreVertical } from 'lucide-react';
import { AddRuleModal } from '../settings/AddRuleModal';
import { supabase } from '../../lib/supabase';
import { isIgnorableRequestError } from '../../lib/requestErrors';

interface AssignmentRule {
  id: string;
  ruleName: string;
  createdOn: string;
  channel: {
    type: 'includes' | 'excludes' | 'any';
    values: string[];
  };
  source: {
    type: 'includes' | 'excludes';
    values: string[];
  };
  specialization: {
    type: 'includes' | 'excludes' | 'any';
    values: string[];
  };
  assignedCounselors: { id: string; name: string }[];
  status: 'active' | 'inactive';
  totalAssignments?: number;
  lastAssignmentDate?: string;
}

export function AssignmentRulesManagement() {
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AssignmentRule | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState({
    status: '' as '' | 'active' | 'inactive',
    channel: '',
    source: '',
    counselor: ''
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilterModal(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchAssignmentRules(controller.signal);
    return () => controller.abort();
  }, []);

  const fetchAssignmentRules = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('assignment_rules_detailed')
        .select('*')
        .abortSignal(signal ?? new AbortController().signal)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedRules: AssignmentRule[] = (data || []).map((rule: any) => ({
        id: rule.id,
        ruleName: rule.rule_name,
        createdOn: new Date(rule.created_at).toLocaleDateString('en-GB'),
        channel: {
          type: rule.channel_criteria?.condition_type || 'any',
          values: rule.channel_criteria?.values || []
        },
        source: {
          type: rule.source_criteria?.condition_type || 'any',
          values: rule.source_criteria?.values || []
        },
        specialization: {
          type: rule.specialization_criteria?.condition_type || 'any',
          values: rule.specialization_criteria?.values || []
        },
        assignedCounselors: (rule.counselors || []).map((c: any) => ({
          id: c.id,
          name: c.full_name
        })),
        status: rule.is_active ? 'active' : 'inactive',
        totalAssignments: rule.total_assignments || 0,
        lastAssignmentDate: rule.last_assignment_date
      }));

      setRules(formattedRules);
    } catch (error) {
      if (!isIgnorableRequestError(error)) {
        console.error('Error fetching assignment rules:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddRule = async (ruleData: any) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('create_assignment_rule', {
        p_rule_name: ruleData.ruleName,
        p_channel_condition_type: ruleData.channelType,
        p_channel_values: ruleData.channelType === 'includes'
          ? ruleData.selectedChannels || []
          : [],
        p_source_condition_type: ruleData.sourceType,
        p_source_values: ruleData.sourceType === 'includes'
          ? ruleData.selectedSources || []
          : [],
        p_specialization_condition_type: ruleData.specializationType,
        p_specialization_values: ruleData.specializationType === 'includes'
          ? ruleData.selectedSpecializations || []
          : [],
        p_counselor_ids: ruleData.selectedCounselors || []
      });

      if (error) {
        alert('Error creating rule: ' + error.message);
        return;
      }

      await fetchAssignmentRules();
      setShowAddRuleModal(false);
    } catch (error: any) {
      alert('Error creating rule: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditRule = async (ruleData: any) => {
    if (!editingRule) return;

    setLoading(true);
    try {
      const { error } = await supabase.rpc('update_assignment_rule', {
        p_rule_id: editingRule.id,
        p_rule_name: ruleData.ruleName,
        p_channel_condition_type: ruleData.channelType,
        p_channel_values: ruleData.channelType === 'includes'
          ? ruleData.selectedChannels || []
          : [],
        p_source_condition_type: ruleData.sourceType,
        p_source_values: ruleData.sourceType === 'includes'
          ? ruleData.selectedSources || []
          : [],
        p_specialization_condition_type: ruleData.specializationType,
        p_specialization_values: ruleData.specializationType === 'includes'
          ? ruleData.selectedSpecializations || []
          : [],
        p_counselor_ids: ruleData.selectedCounselors || []
      });

      if (error) {
        alert('Error updating rule: ' + error.message);
        return;
      }

      await fetchAssignmentRules();
      setEditingRule(null);
    } catch (error: any) {
      alert('Error updating rule: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (rule: AssignmentRule) => {
    setEditingRule(rule);
  };

  const handleRefresh = () => {
    fetchAssignmentRules();
    setFilters({
      status: '',
      channel: '',
      source: '',
      counselor: ''
    });
  };

  const handleToggleStatus = async (ruleId: string, currentStatus: 'active' | 'inactive') => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('toggle_assignment_rule_status', {
        p_rule_id: ruleId,
        p_is_active: currentStatus === 'inactive'
      });

      if (error) {
        alert('Error toggling rule status: ' + error.message);
        return;
      }

      await fetchAssignmentRules();
      setOpenDropdown(null);
    } catch (error: any) {
      alert('Error toggling rule status: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc('delete_assignment_rule', {
        p_rule_id: ruleId
      });

      if (error) {
        alert('Error deleting rule: ' + error.message);
        return;
      }

      await fetchAssignmentRules();
      setOpenDropdown(null);
    } catch (error: any) {
      alert('Error deleting rule: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredRules = useMemo(() => {
    return rules.filter(rule => {
      if (filters.status && rule.status !== filters.status) return false;
      if (filters.channel && !rule.channel.values.includes(filters.channel) && rule.channel.type !== 'any') return false;
      if (filters.source && !rule.source.values.includes(filters.source)) return false;
      if (filters.counselor && !rule.assignedCounselors.some(c => c.name === filters.counselor)) return false;
      return true;
    });
  }, [rules, filters]);

  const activeFiltersCount = Object.values(filters).filter(v => v !== '').length;

  const clearFilters = () => {
    setFilters({
      status: '',
      channel: '',
      source: '',
      counselor: ''
    });
  };

  return (
    <div className="flex flex-col h-full bg-white p-6">
      <div className="flex items-center justify-end gap-3 mb-4">
        <button
          onClick={handleRefresh}
          className="p-2 hover:bg-gray-100 rounded transition"
          title="Refresh"
        >
          <RefreshCw className="w-5 h-5 text-orange-500" />
        </button>
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setShowFilterModal(!showFilterModal)}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition flex items-center gap-2 text-sm font-medium text-gray-700 relative"
          >
            <Filter className="w-4 h-4" />
            Filter
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                {activeFiltersCount}
              </span>
            )}
          </button>
          {showFilterModal && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">Filter Rules</h3>
                {activeFiltersCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-orange-500 hover:text-orange-600 font-medium"
                  >
                    Clear All
                  </button>
                )}
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  >
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Channel</label>
                  <select
                    value={filters.channel}
                    onChange={(e) => setFilters({ ...filters, channel: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  >
                    <option value="">All Channels</option>
                    <option value="Digital Marketing">Digital Marketing</option>
                    <option value="Publishers">Publishers</option>
                    <option value="Referrals">Referrals</option>
                    <option value="Walk-in">Walk-in</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Source</label>
                  <select
                    value={filters.source}
                    onChange={(e) => setFilters({ ...filters, source: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  >
                    <option value="">All Sources</option>
                    <option value="Google Ads">Google Ads</option>
                    <option value="Facebook Ads">Facebook Ads</option>
                    <option value="Shiksha">Shiksha</option>
                    <option value="Collegedunia">Collegedunia</option>
                    <option value="Instagram">Instagram</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => setShowAddRuleModal(true)}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded transition text-sm font-medium"
        >
          Add Rule
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="border-y border-gray-200 bg-orange-50">
              <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Rule Name</th>
              <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Created On</th>
              <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Channel</th>
              <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Source</th>
              <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Specialization</th>
              <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Assigned Counselors</th>
              <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700">Status</th>
              <th className="w-16"></th>
            </tr>
          </thead>
          <tbody>
            {filteredRules.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Filter className="w-12 h-12 text-gray-300" />
                    <p className="font-medium">No rules found</p>
                    <p className="text-sm">Try adjusting your filters or create a new rule</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRules.map((rule) => (
              <tr key={rule.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="py-4 px-4 text-sm text-gray-900">{rule.ruleName}</td>
                <td className="py-4 px-4 text-sm text-gray-600">{rule.createdOn}</td>
                <td className="py-4 px-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-600 capitalize">{rule.channel.type}</span>
                    {rule.channel.type !== 'any' && rule.channel.values.map((value, idx) => (
                      <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-gray-200 text-gray-700 w-fit">
                        {value}
                      </span>
                    ))}
                    {rule.channel.type === 'any' && (
                      <span className="text-sm text-gray-900">Any Channel</span>
                    )}
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-600 capitalize">{rule.source.type}</span>
                    {rule.source.values.map((value, idx) => (
                      <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-gray-200 text-gray-700 w-fit">
                        {value}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-600 capitalize">{rule.specialization.type}</span>
                    {rule.specialization.type !== 'any' && rule.specialization.values.map((value, idx) => (
                      <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-gray-200 text-gray-700 w-fit">
                        {value}
                      </span>
                    ))}
                    {rule.specialization.type === 'any' && (
                      <span className="text-sm text-gray-900">Any Specialization</span>
                    )}
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex flex-wrap gap-1">
                    {rule.assignedCounselors.map((counselor, idx) => (
                      <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-gray-200 text-gray-700">
                        {counselor.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-4 px-4">
                  <span className={`inline-flex items-center px-3 py-1.5 rounded text-xs font-medium ${
                    rule.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {rule.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-1 relative">
                    <button
                      onClick={() => openEditModal(rule)}
                      className="p-1.5 hover:bg-gray-200 rounded transition"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4 text-orange-500" />
                    </button>
                    <div className="relative">
                      <button
                        className="p-1.5 hover:bg-gray-200 rounded transition"
                        title="More"
                        onClick={() => setOpenDropdown(openDropdown === rule.id ? null : rule.id)}
                      >
                        <MoreVertical className="w-4 h-4 text-gray-600" />
                      </button>
                      {openDropdown === rule.id && (
                        <div
                          ref={dropdownRef}
                          className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10"
                        >
                          <button
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                            onClick={() => handleToggleStatus(rule.id, rule.status)}
                          >
                            {rule.status === 'active' ? 'Disable Rule' : 'Enable Rule'}
                          </button>
                          <button
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                            onClick={() => handleDeleteRule(rule.id)}
                          >
                            Delete Rule
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddRuleModal
        isOpen={showAddRuleModal || editingRule !== null}
        onClose={() => {
          setShowAddRuleModal(false);
          setEditingRule(null);
        }}
        onAdd={editingRule ? handleEditRule : handleAddRule}
        editingRule={editingRule}
      />
    </div>
  );
}
