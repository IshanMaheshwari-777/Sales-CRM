// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';

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
}

interface AddRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (rule: any) => void;
  editingRule?: AssignmentRule | null;
}

type CriteriaType = 'includes' | 'any';

interface Counselor {
  id: string;
  full_name: string;
  email: string;
}

interface LeadSource {
  id: string;
  name: string;
}

export function AddRuleModal({ isOpen, onClose, onAdd, editingRule }: AddRuleModalProps) {
  const [ruleName, setRuleName] = useState('');
  const [channelType, setChannelType] = useState<CriteriaType>('includes');
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [sourceType, setSourceType] = useState<CriteriaType>('includes');
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [specializationType, setSpecializationType] = useState<CriteriaType>('includes');
  const [selectedSpecializations, setSelectedSpecializations] = useState<string[]>([]);
  const [selectedCounselors, setSelectedCounselors] = useState<string[]>([]);
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [showChannelDropdown, setShowChannelDropdown] = useState(false);
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showSpecializationDropdown, setShowSpecializationDropdown] = useState(false);

  const channelDropdownRef = useRef<HTMLDivElement>(null);
  const sourceDropdownRef = useRef<HTMLDivElement>(null);
  const specializationDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCounselors();
      fetchSources();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (channelDropdownRef.current && !channelDropdownRef.current.contains(event.target as Node)) {
        setShowChannelDropdown(false);
      }
      if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(event.target as Node)) {
        setShowSourceDropdown(false);
      }
      if (specializationDropdownRef.current && !specializationDropdownRef.current.contains(event.target as Node)) {
        setShowSpecializationDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (editingRule) {
      setRuleName(editingRule.ruleName);
      setChannelType(editingRule.channel.type === 'any' ? 'any' : 'includes');
      setSelectedChannels(editingRule.channel.values || []);
      setSourceType(editingRule.source.type === 'any' ? 'any' : 'includes');
      setSelectedSources(editingRule.source.values || []);
      setSpecializationType(editingRule.specialization.type === 'any' ? 'any' : 'includes');
      setSelectedSpecializations(editingRule.specialization.values || []);
      setSelectedCounselors(editingRule.assignedCounselors.map(c => c.id));
    }
  }, [editingRule]);

  const fetchCounselors = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name');

      if (error) throw error;
      setCounselors(data || []);
    } catch (error) {
      console.error('Error fetching counselors:', error);
    }
  };

  const fetchSources = async () => {
    try {
      const { data, error } = await supabase
        .from('lead_sources')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSources(data || []);
    } catch (error) {
      console.error('Error fetching sources:', error);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = () => {
    const newRule = {
      ruleName,
      channelType,
      selectedChannels,
      sourceType,
      selectedSources,
      specializationType,
      selectedSpecializations,
      selectedCounselors
    };
    onAdd(newRule);
    handleClose();
  };

  const handleClose = () => {
    setRuleName('');
    setChannelType('includes');
    setSelectedChannels([]);
    setSourceType('includes');
    setSelectedSources([]);
    setSpecializationType('includes');
    setSelectedSpecializations([]);
    setSelectedCounselors([]);
    onClose();
  };

  const toggleCounselor = (counselorId: string) => {
    setSelectedCounselors(prev =>
      prev.includes(counselorId)
        ? prev.filter(id => id !== counselorId)
        : [...prev, counselorId]
    );
  };

  const toggleChannel = (channel: string) => {
    setSelectedChannels(prev =>
      prev.includes(channel)
        ? prev.filter(c => c !== channel)
        : [...prev, channel]
    );
  };

  const toggleSource = (source: string) => {
    setSelectedSources(prev =>
      prev.includes(source)
        ? prev.filter(s => s !== source)
        : [...prev, source]
    );
  };

  const toggleSpecialization = (spec: string) => {
    setSelectedSpecializations(prev =>
      prev.includes(spec)
        ? prev.filter(s => s !== spec)
        : [...prev, spec]
    );
  };

  const removeChannel = (channel: string) => {
    setSelectedChannels(prev => prev.filter(c => c !== channel));
  };

  const removeSource = (source: string) => {
    setSelectedSources(prev => prev.filter(s => s !== source));
  };

  const removeSpecialization = (spec: string) => {
    setSelectedSpecializations(prev => prev.filter(s => s !== spec));
  };

  const channelOptions = ['Digital Marketing', 'Publishers', 'Referrals', 'Walk-in'];
  const specializationOptions = ['MBA', 'Engineering', 'Medical', 'Law'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="px-8 py-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-800">
            {editingRule ? 'Edit Assignment Rule' : 'Add Assignment Rule'}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-slate-100 rounded transition"
          >
            <X className="w-6 h-6 text-slate-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Rule Name<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Enter Rule Name"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div>
              <h3 className="text-base font-medium text-slate-800 mb-3">Criteria 1: When "Channel"</h3>
              <div className="flex items-center gap-6 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="channelType"
                    checked={channelType === 'includes'}
                    onChange={() => setChannelType('includes')}
                    className="w-5 h-5 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-slate-700">Includes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="channelType"
                    checked={channelType === 'any'}
                    onChange={() => setChannelType('any')}
                    className="w-5 h-5 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-slate-700">Any Channel</span>
                </label>
              </div>
              {channelType === 'includes' && (
                <div className="relative" ref={channelDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowChannelDropdown(!showChannelDropdown)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent flex items-center justify-between"
                  >
                    <span className="text-sm text-slate-700">
                      {selectedChannels.length === 0
                        ? 'Select Channel(s)'
                        : `${selectedChannels.length} channel(s) selected`}
                    </span>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showChannelDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {selectedChannels.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedChannels.map((channel) => (
                        <span
                          key={channel}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-sm font-medium"
                        >
                          {channel}
                          <button
                            type="button"
                            onClick={() => removeChannel(channel)}
                            className="hover:bg-orange-200 rounded-full p-0.5 transition"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {showChannelDropdown && (
                    <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-lg shadow-lg">
                      <div className="p-2 space-y-1">
                        {channelOptions.map((channel) => (
                          <label
                            key={channel}
                            className="flex items-center gap-3 p-2 hover:bg-slate-100 rounded cursor-pointer transition"
                          >
                            <input
                              type="checkbox"
                              checked={selectedChannels.includes(channel)}
                              onChange={() => toggleChannel(channel)}
                              className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                            />
                            <span className="text-sm text-slate-900">{channel}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 pt-4">
              <div className="text-center mb-4">
                <span className="text-orange-500 font-semibold">AND</span>
              </div>
            </div>

            <div>
              <h3 className="text-base font-medium text-slate-800 mb-3">Criteria 2: When "Source"</h3>
              <div className="flex items-center gap-6 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sourceType"
                    checked={sourceType === 'includes'}
                    onChange={() => setSourceType('includes')}
                    className="w-5 h-5 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-slate-700">Includes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sourceType"
                    checked={sourceType === 'any'}
                    onChange={() => setSourceType('any')}
                    className="w-5 h-5 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-slate-700">Any Source</span>
                </label>
              </div>
              {sourceType === 'includes' && (
                <div className="relative" ref={sourceDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowSourceDropdown(!showSourceDropdown)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent flex items-center justify-between"
                  >
                    <span className="text-sm text-slate-700">
                      {selectedSources.length === 0
                        ? 'Select Source(s)'
                        : `${selectedSources.length} source(s) selected`}
                    </span>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showSourceDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {selectedSources.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedSources.map((source) => (
                        <span
                          key={source}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-sm font-medium"
                        >
                          {source}
                          <button
                            type="button"
                            onClick={() => removeSource(source)}
                            className="hover:bg-orange-200 rounded-full p-0.5 transition"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {showSourceDropdown && (
                    <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      <div className="p-2 space-y-1">
                        {sources.map((source) => (
                          <label
                            key={source.id}
                            className="flex items-center gap-3 p-2 hover:bg-slate-100 rounded cursor-pointer transition"
                          >
                            <input
                              type="checkbox"
                              checked={selectedSources.includes(source.name)}
                              onChange={() => toggleSource(source.name)}
                              className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                            />
                            <span className="text-sm text-slate-900">{source.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 pt-4">
              <div className="text-center mb-4">
                <span className="text-orange-500 font-semibold">AND</span>
              </div>
            </div>

            <div>
              <h3 className="text-base font-medium text-slate-800 mb-3">Criteria 3: When "Specialization"</h3>
              <div className="flex items-center gap-6 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="specializationType"
                    checked={specializationType === 'includes'}
                    onChange={() => setSpecializationType('includes')}
                    className="w-5 h-5 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-slate-700">Includes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="specializationType"
                    checked={specializationType === 'any'}
                    onChange={() => setSpecializationType('any')}
                    className="w-5 h-5 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-slate-700">Any Specialization</span>
                </label>
              </div>
              {specializationType === 'includes' && (
                <div className="relative" ref={specializationDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowSpecializationDropdown(!showSpecializationDropdown)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent flex items-center justify-between"
                  >
                    <span className="text-sm text-slate-700">
                      {selectedSpecializations.length === 0
                        ? 'Select Specialization(s)'
                        : `${selectedSpecializations.length} specialization(s) selected`}
                    </span>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showSpecializationDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {selectedSpecializations.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedSpecializations.map((spec) => (
                        <span
                          key={spec}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-sm font-medium"
                        >
                          {spec}
                          <button
                            type="button"
                            onClick={() => removeSpecialization(spec)}
                            className="hover:bg-orange-200 rounded-full p-0.5 transition"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {showSpecializationDropdown && (
                    <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-lg shadow-lg">
                      <div className="p-2 space-y-1">
                        {specializationOptions.map((spec) => (
                          <label
                            key={spec}
                            className="flex items-center gap-3 p-2 hover:bg-slate-100 rounded cursor-pointer transition"
                          >
                            <input
                              type="checkbox"
                              checked={selectedSpecializations.includes(spec)}
                              onChange={() => toggleSpecialization(spec)}
                              className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                            />
                            <span className="text-sm text-slate-900">{spec}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-base font-medium text-slate-800 mb-3">
                Then Assigned Counselor(s) will be<span className="text-red-500">*</span>
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg p-3">
                {counselors.map(counselor => (
                  <label
                    key={counselor.id}
                    className="flex items-center gap-3 p-2 hover:bg-slate-100 rounded cursor-pointer transition"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCounselors.includes(counselor.id)}
                      onChange={() => toggleCounselor(counselor.id)}
                      className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900">{counselor.full_name}</div>
                      <div className="text-xs text-slate-600">{counselor.email}</div>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-sm text-slate-600 italic mt-3">
                If multiple counselors are selected, lead distribution will be done in round robin manner to equally distribute the leads.
              </p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-6 py-2.5 border-2 border-orange-500 text-orange-500 rounded-lg hover:bg-orange-50 transition font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !ruleName || selectedCounselors.length === 0}
            className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : (editingRule ? 'Save Changes' : 'Add Rule')}
          </button>
        </div>
      </div>
    </div>
  );
}
