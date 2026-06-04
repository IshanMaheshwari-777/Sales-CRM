import { useEffect, useRef, useState } from 'react';
import { Building2, Check, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { isIgnorableRequestError } from '../../lib/requestErrors';

interface Organization {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended';
}

interface OrganizationSwitcherProps {
  currentOrgId: string | null;
  onOrgChange: (orgId: string) => void;
}

export function OrganizationSwitcher({ currentOrgId, onOrgChange }: OrganizationSwitcherProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    loadOrganizations(controller.signal);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!showDropdown) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowDropdown(false);
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [showDropdown]);

  const loadOrganizations = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setLoadError(null);

      const { data, error } = await supabase
        .rpc('get_accessible_organizations')
        .abortSignal(signal ?? new AbortController().signal);

      if (error) throw error;
      setOrganizations(data || []);
    } catch (error) {
      if (!isIgnorableRequestError(error)) {
        console.error('Error loading organizations:', error);
        setLoadError('Unable to load organizations');
      }
    } finally {
      setLoading(false);
    }
  };

  const currentOrg = organizations.find(org => org.id === currentOrgId);
  const canSwitchOrganizations = organizations.length > 1;

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-600 rounded-lg text-sm">
        <Building2 className="w-4 h-4" />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (canSwitchOrganizations) {
            setShowDropdown((current) => !current);
          }
        }}
        data-testid="organization-switcher-trigger"
        aria-expanded={showDropdown}
        disabled={!canSwitchOrganizations}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
          canSwitchOrganizations
            ? 'bg-slate-600 hover:bg-slate-500'
            : 'bg-slate-600/70 cursor-default'
        }`}
      >
        <Building2 className="w-4 h-4" />
        <span className="max-w-[150px] truncate">
          {currentOrg?.name || 'Select Organization'}
        </span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {showDropdown && (
        <div data-testid="organization-switcher-menu" className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50 max-h-96 overflow-y-auto">
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">
            Switch Organization
          </div>
          {organizations.map((org) => (
            <button
              key={org.id}
              type="button"
              data-testid={`organization-switcher-option-${org.id}`}
              onClick={() => {
                onOrgChange(org.id);
                setShowDropdown(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                currentOrgId === org.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Building2 className="w-4 h-4 flex-shrink-0" />
                <div className="flex-1 min-w-0 text-left">
                  <div className="font-medium truncate">{org.name}</div>
                  <div className="text-xs text-gray-500 truncate">{org.slug}</div>
                </div>
              </div>
              {currentOrgId === org.id && (
                <Check className="w-4 h-4 flex-shrink-0 text-blue-700" />
              )}
            </button>
          ))}
          {organizations.length === 0 && (
            <div className="px-3 py-4 text-sm text-gray-500 text-center">
              {loadError || 'No accessible organizations found'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
