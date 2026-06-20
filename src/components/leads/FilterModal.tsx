// @ts-nocheck
import { useState, useEffect } from 'react';
import { X, Filter, Save, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Database } from '../../lib/database.types';
import { SearchableMultiSelect, type Option } from '../common/SearchableMultiSelect';
import { DateRangePicker } from '../common/DateRangePicker';
import { NumericRangeDropdown } from '../common/NumericRangeDropdown';
import { CascadingDropdown, type CascadingOption } from '../common/CascadingDropdown';

type LeadSource = Database['public']['Tables']['lead_sources']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type LeadStatus = Database['public']['Tables']['lead_statuses']['Row'];
type FilterPreset = Database['public']['Tables']['filter_presets']['Row'];

interface FilterModalProps {
  onClose: () => void;
  onApplyFilters: (filters: FilterCriteria) => void;
  currentFilters: FilterCriteria;
}

export interface FilterCriteria {
  assignedTo: string[];
  campaignNames: string[];
  channels: string[];
  sources: string[];
  statuses: string[];
  subStatuses: string[];
  dateAddedFrom?: string;
  dateAddedTo?: string;
  dateEditedFrom?: string;
  dateEditedTo?: string;
  leadAgeMin?: number;
  leadAgeMax?: number;
  leadNumberMin?: number;
  leadNumberMax?: number;
  cities?: string[];
  countries?: string[];
  currentOwners?: string[];
  previousOwners?: string[];
  isReEnquired?: boolean | null;
  callCountMin?: number;
  callCountMax?: number;
  dateFrom?: string;
  dateTo?: string;
}

const CHANNELS = ['Offline', 'Online', 'Digital Marketing', 'Publishers', 'Referrals', 'Walk-in', 'Direct', 'Partner'];
const COUNTRIES = ['India', 'USA', 'UK', 'UAE', 'Singapore', 'Other'];
const INDIAN_CITIES = [
  'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata',
  'Pune', 'Ahmedabad', 'Surat', 'Jaipur', 'Lucknow', 'Kanpur', 'Other'
];

export function FilterModal({ onClose, onApplyFilters, currentFilters }: FilterModalProps) {
  const { user, profile } = useAuth();
  const [filters, setFilters] = useState<FilterCriteria>(currentFilters);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [campaignNames, setCampaignNames] = useState<string[]>([]);
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    priority: true,
    secondary: false,
  });
  const [loading, setLoading] = useState(false);
  const [resultCount, setResultCount] = useState<number | null>(null);

  useEffect(() => {
    loadOptions();
    loadPresets();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchResultCount();
    }, 500);
    return () => clearTimeout(debounce);
  }, [filters]);

  const loadOptions = async () => {
    if (!profile?.organization_id) return;

    setLoading(true);
    const [sourcesRes, usersRes, statusesRes, campaignsRes] = await Promise.all([
      supabase.from('lead_sources').select('*').eq('is_active', true),
      supabase.from('profiles').select('id, full_name, email').eq('organization_id', profile.organization_id).order('full_name'),
      supabase.from('lead_statuses').select('*').eq('is_active', true).order('order_index'),
      supabase.rpc('get_distinct_campaign_names', {
        p_organization_id: profile.organization_id,
        p_limit: 200,
      }),
    ]);

    if (sourcesRes.data) setSources(sourcesRes.data);
    if (usersRes.data) setUsers(usersRes.data);
    if (statusesRes.data) setStatuses(statusesRes.data);
    if (campaignsRes.data) {
      const unique = campaignsRes.data
        .map((row: any) => row.campaign_name)
        .filter(Boolean) as string[];
      setCampaignNames(unique);
    }
    setLoading(false);
  };

  const loadPresets = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('filter_presets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) setPresets(data);
  };

  const fetchResultCount = async () => {
    if (!profile?.organization_id) return;

    let query = supabase.from('leads').select('id', { count: 'exact', head: true }).eq('organization_id', profile.organization_id);

    if (filters.assignedTo?.length > 0) {
      query = query.in('current_lead_owner', filters.assignedTo);
    }
    if (filters.campaignNames?.length > 0) {
      query = query.in('campaign_name', filters.campaignNames);
    }
    if (filters.channels?.length > 0) {
      query = query.in('channel', filters.channels);
    }
    if (filters.sources?.length > 0) {
      query = query.in('source_id', filters.sources);
    }
    if (filters.statuses?.length > 0) {
      query = query.in('status_id', filters.statuses);
    }
    if (filters.subStatuses?.length > 0) {
      query = query.in('sub_status_id', filters.subStatuses);
    }
    if (filters.dateAddedFrom) {
      query = query.gte('created_at', filters.dateAddedFrom);
    }
    if (filters.dateAddedTo) {
      query = query.lte('created_at', filters.dateAddedTo);
    }
    if (filters.dateEditedFrom) {
      query = query.gte('updated_at', filters.dateEditedFrom);
    }
    if (filters.dateEditedTo) {
      query = query.lte('updated_at', filters.dateEditedTo);
    }

    const { count } = await query;
    setResultCount(count ?? null);
  };

  const savePreset = async () => {
    if (!user || !presetName.trim() || !profile?.organization_id) return;

    const { error } = await supabase.from('filter_presets').insert({
      user_id: user.id,
      preset_name: presetName,
      filter_criteria: filters,
      organization_id: profile.organization_id,
    });

    if (!error) {
      setShowSavePreset(false);
      setPresetName('');
      loadPresets();
    }
  };

  const loadPreset = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setFilters(preset.filter_criteria as FilterCriteria);
      setSelectedPreset(presetId);
    }
  };

  const deletePreset = async (presetId: string) => {
    await supabase.from('filter_presets').delete().eq('id', presetId);
    loadPresets();
    if (selectedPreset === presetId) {
      setSelectedPreset('');
    }
  };

  const clearAll = () => {
    setFilters({
      assignedTo: [],
      campaignNames: [],
      channels: [],
      sources: [],
      statuses: [],
      subStatuses: [],
      stages: [],
      cities: [],
      countries: [],
      currentOwners: [],
      previousOwners: [],
    });
    setSelectedPreset('');
  };

  const handleApply = () => {
    onApplyFilters(filters);
    onClose();
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const userOptions: Option[] = users.map(u => ({ value: u.id, label: u.full_name }));
  const sourceOptions: Option[] = sources.map(s => ({ value: s.id, label: s.name, color: s.color || undefined }));
  const channelOptions: Option[] = CHANNELS.map(c => ({ value: c, label: c }));
  const campaignOptions: Option[] = campaignNames.map(c => ({ value: c, label: c }));

  const statusCascadingOptions: CascadingOption[] = statuses
    .filter(s => s.status_type === 'main')
    .map(mainStatus => ({
      value: mainStatus.id,
      label: mainStatus.display_name,
      color: mainStatus.color || undefined,
      children: statuses
        .filter(s => s.parent_status_id === mainStatus.id)
        .map(subStatus => ({
          value: subStatus.id,
          label: subStatus.display_name,
          color: subStatus.color || undefined,
        })),
    }));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Filter className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Advanced Filters</h2>
              {resultCount !== null && (
                <p className="text-sm text-slate-500 mt-0.5">{resultCount} leads match current filters</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden rounded-b-xl">
          <div className="p-6 space-y-6 pb-32">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <select
                  value={selectedPreset}
                  onChange={(e) => loadPreset(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                >
                  <option value="">Select a saved preset...</option>
                  {presets.map(preset => (
                    <option key={preset.id} value={preset.id}>
                      {preset.preset_name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setShowSavePreset(!showSavePreset)}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition flex items-center gap-2 font-medium"
              >
                <Save className="w-4 h-4" />
                Save Preset
              </button>
              {selectedPreset && (
                <button
                  onClick={() => deletePreset(selectedPreset)}
                  className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition font-medium"
                >
                  Delete
                </button>
              )}
            </div>

            {showSavePreset && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <label className="block text-sm font-medium text-slate-700 mb-2">Preset Name</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="e.g., Hot Leads, High Value Prospects"
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  />
                  <button
                    onClick={savePreset}
                    disabled={!presetName.trim()}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-medium disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setShowSavePreset(false);
                      setPresetName('');
                    }}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('priority')}
                className="w-full px-6 py-4 bg-gradient-to-r from-orange-50 to-orange-100 border-b border-orange-200 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-orange-600" />
                  <h3 className="text-lg font-bold text-slate-800">Priority Filters</h3>
                </div>
                {expandedSections.priority ? (
                  <ChevronUp className="w-5 h-5 text-slate-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-600" />
                )}
              </button>

              {expandedSections.priority && (
                <div className="p-6 pb-80 space-y-4 bg-white">
                  <div className="grid grid-cols-2 gap-4">
                    <SearchableMultiSelect
                      label="Assigned To"
                      options={userOptions}
                      selected={filters.assignedTo || []}
                      onChange={(selected) => setFilters({ ...filters, assignedTo: selected })}
                      placeholder="Select users..."
                      loading={loading}
                    />

                    <SearchableMultiSelect
                      label="Campaign Name"
                      options={campaignOptions}
                      selected={filters.campaignNames || []}
                      onChange={(selected) => setFilters({ ...filters, campaignNames: selected })}
                      placeholder="Select campaigns..."
                      loading={loading}
                    />

                    <SearchableMultiSelect
                      label="Channel"
                      options={channelOptions}
                      selected={filters.channels || []}
                      onChange={(selected) => setFilters({ ...filters, channels: selected })}
                      placeholder="Select channels..."
                    />

                    <SearchableMultiSelect
                      label="Source"
                      options={sourceOptions}
                      selected={filters.sources || []}
                      onChange={(selected) => setFilters({ ...filters, sources: selected })}
                      placeholder="Select sources..."
                      loading={loading}
                    />
                  </div>

                  <CascadingDropdown
                    label="Status & Sub-Status"
                    options={statusCascadingOptions}
                    selectedParents={filters.statuses || []}
                    selectedChildren={filters.subStatuses || []}
                    onChangeParents={(selected) => setFilters({ ...filters, statuses: selected })}
                    onChangeChildren={(selected) => setFilters({ ...filters, subStatuses: selected })}
                    placeholder="Select status and sub-status..."
                    parentLabel="Status"
                    childLabel="Sub-Status"
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <DateRangePicker
                      label="Date Added"
                      fromDate={filters.dateAddedFrom}
                      toDate={filters.dateAddedTo}
                      onChange={(from, to) => setFilters({ ...filters, dateAddedFrom: from, dateAddedTo: to })}
                      placeholder="Select date range..."
                    />

                    <DateRangePicker
                      label="Date Edited"
                      fromDate={filters.dateEditedFrom}
                      toDate={filters.dateEditedTo}
                      onChange={(from, to) => setFilters({ ...filters, dateEditedFrom: from, dateEditedTo: to })}
                      placeholder="Select date range..."
                    />

                    <NumericRangeDropdown
                      label="Lead Age"
                      min={filters.leadAgeMin}
                      max={filters.leadAgeMax}
                      onChange={(min, max) => setFilters({ ...filters, leadAgeMin: min, leadAgeMax: max })}
                      placeholder="Select age range..."
                      unit=" days"
                    />

                    <NumericRangeDropdown
                      label="Lead Number Range"
                      min={filters.leadNumberMin}
                      max={filters.leadNumberMax}
                      onChange={(min, max) => setFilters({ ...filters, leadNumberMin: min, leadNumberMax: max })}
                      placeholder="Select number range..."
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('secondary')}
                className="w-full px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between"
              >
                <h3 className="text-lg font-bold text-slate-800">Additional Filters</h3>
                {expandedSections.secondary ? (
                  <ChevronUp className="w-5 h-5 text-slate-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-600" />
                )}
              </button>

              {expandedSections.secondary && (
                <div className="p-6 pb-80 space-y-4 bg-white">
                  <div className="grid grid-cols-2 gap-4">
                    <SearchableMultiSelect
                      label="City"
                      options={INDIAN_CITIES.map(c => ({ value: c, label: c }))}
                      selected={filters.cities || []}
                      onChange={(selected) => setFilters({ ...filters, cities: selected })}
                      placeholder="Select cities..."
                    />

                    <SearchableMultiSelect
                      label="Country"
                      options={COUNTRIES.map(c => ({ value: c, label: c }))}
                      selected={filters.countries || []}
                      onChange={(selected) => setFilters({ ...filters, countries: selected })}
                      placeholder="Select countries..."
                    />

                    <NumericRangeDropdown
                      label="Call Count"
                      min={filters.callCountMin}
                      max={filters.callCountMax}
                      onChange={(min, max) => setFilters({ ...filters, callCountMin: min, callCountMax: max })}
                      placeholder="Select call count range..."
                      unit=" calls"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Re-enquired Status</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFilters({ ...filters, isReEnquired: true })}
                        className={`px-4 py-2 text-sm rounded-lg font-medium transition ${
                          filters.isReEnquired === true
                            ? 'bg-orange-100 text-orange-700 border-2 border-orange-500'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Re-enquired Only
                      </button>
                      <button
                        onClick={() => setFilters({ ...filters, isReEnquired: false })}
                        className={`px-4 py-2 text-sm rounded-lg font-medium transition ${
                          filters.isReEnquired === false
                            ? 'bg-slate-200 text-slate-700 border-2 border-slate-500'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        New Only
                      </button>
                      <button
                        onClick={() => setFilters({ ...filters, isReEnquired: null })}
                        className={`px-4 py-2 text-sm rounded-lg font-medium transition ${
                          filters.isReEnquired === null || filters.isReEnquired === undefined
                            ? 'bg-slate-200 text-slate-700 border-2 border-slate-500'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        All
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex gap-3 rounded-b-xl">
          <button
            onClick={clearAll}
            className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition"
          >
            Clear All
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="flex-1 px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition"
          >
            Apply Filters {resultCount !== null && `(${resultCount})`}
          </button>
        </div>
      </div>
    </div>
  );
}
