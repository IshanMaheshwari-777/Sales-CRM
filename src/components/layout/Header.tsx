// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Info, Clock, User, LogOut, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useToast } from '../../contexts/ToastContext';
import { useTimer } from '../../hooks/useTimer';
import { OrganizationSwitcher } from '../admin/OrganizationSwitcher';
import { supabase } from '../../lib/supabase';

interface HeaderProps {
  onAddLead: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearch: () => void;
  onClearSearch: () => void;
}

export function Header({ onAddLead, searchQuery, onSearchChange, onSearch, onClearSearch }: HeaderProps) {
  const { profile, organizationMember, signOut } = useAuth();
  const { userProfile, isSuperAdmin } = usePermissions();
  const { showError } = useToast();
  const { formattedTime, endSession } = useTimer(profile?.id);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  const roleName = userProfile?.role?.role_name || profile?.role?.replace('_', ' ') || 'User';

  useEffect(() => {
    if (isSuperAdmin && profile?.organization_id) {
      setCurrentOrgId(profile.organization_id);
      return;
    }

    if (organizationMember?.organization_id) {
      setCurrentOrgId(organizationMember.organization_id);
      return;
    }

    if (profile?.organization_id) {
      setCurrentOrgId(profile.organization_id);
      return;
    }

    if (userProfile?.id) {
      loadCurrentOrganization();
    }
  }, [isSuperAdmin, profile?.organization_id, organizationMember?.organization_id, userProfile?.id]);

  const loadCurrentOrganization = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', userProfile?.id)
        .single();

      if (error) throw error;
      setCurrentOrgId(data?.organization_id || null);
    } catch (error) {
      console.error('Error loading organization:', error);
    }
  };

  const handleOrgChange = async (orgId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ organization_id: orgId })
        .eq('id', userProfile?.id);

      if (error) throw error;
      setCurrentOrgId(orgId);

      // Reload the page to refresh all data in the new organization context
      window.location.reload();
    } catch (error) {
      console.error('Error switching organization:', error);
      showError('Failed to switch organization');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearch();
    }
  };

  return (
    <header className="bg-slate-700 text-white px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative flex-1 max-w-xl">
          <div className="flex items-center gap-2 bg-slate-600 rounded-lg px-4 py-2">
            <input
              data-testid="header-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search by name, mobile, or email"
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-400 outline-none"
            />
            {searchQuery && (
              <button
                onClick={onClearSearch}
                data-testid="header-search-clear"
                className="p-1 hover:bg-slate-500 rounded transition"
                title="Clear search"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            )}
            <button
              onClick={onSearch}
              data-testid="header-search-submit"
              className="p-1 hover:bg-slate-500 rounded transition"
              title="Search"
            >
              <Search className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {isSuperAdmin && currentOrgId && (
          <OrganizationSwitcher
            currentOrgId={currentOrgId}
            onOrgChange={handleOrgChange}
          />
        )}

        <button
          onClick={onAddLead}
          data-testid="header-add-lead-button"
          className="p-2 hover:bg-slate-600 rounded-lg transition"
          title="Add New Lead"
        >
          <Plus className="w-5 h-5" />
        </button>

        {/* Info button removed */}

        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4" />
          <span className="font-mono">{formattedTime}</span>
        </div>

        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            data-testid="header-user-menu-toggle"
            className="flex items-center gap-2 p-2 hover:bg-slate-600 rounded-lg transition"
          >
            <div className="w-8 h-8 bg-slate-500 rounded-full flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl py-2 z-50">
              <div className="px-4 py-3 border-b border-slate-200">
                <p className="text-sm font-medium text-slate-800">{profile?.full_name}</p>
                <p className="text-xs text-slate-500">{profile?.email}</p>
                <p className="text-xs text-orange-600 mt-1">{roleName}</p>
              </div>
              <button
                onClick={async () => {
                  setShowUserMenu(false);
                  await endSession();
                  signOut();
                }}
                data-testid="header-sign-out-button"
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
