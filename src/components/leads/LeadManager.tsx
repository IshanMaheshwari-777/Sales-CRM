// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { LeadList } from './LeadList';
import { AddLeadModal } from './AddLeadModal';
import { FilterModal, type FilterCriteria } from './FilterModal';
import { ReferLeadsModal } from './ReferLeadsModal';
import { ConfirmationDialog } from './ConfirmationDialog';
import { ChangeStageModal } from './ChangeStageModal';
import BulkUploadModal from './BulkUploadModal';
import { BulkActionsMenu } from './BulkActionsMenu';
import { BulkAssignModal } from './BulkAssignModal';
import { exportLeadsToCSV, type LeadExportData } from '../../lib/csvExport';
import { ChevronLeft, ChevronRight, RefreshCw, Filter, Upload } from 'lucide-react';
import type { BulkLeadFilterContext } from './bulkFilterContext';

type LeadStatus = Database['public']['Tables']['lead_statuses']['Row'];
type Lead = Database['public']['Tables']['leads']['Row'] & {
  lead_statuses: LeadStatus | null;
  sub_status: LeadStatus | null;
  profiles: { full_name: string } | null;
  lead_sources: { name: string; color: string } | null;
};

const PAGE_SIZE = 50;

interface LeadManagerProps {
  onAddLead: () => void;
  showAddLead: boolean;
  onCloseAddLead: () => void;
  searchQuery?: string;
}

export function LeadManager({ onAddLead, showAddLead, onCloseAddLead, searchQuery = '' }: LeadManagerProps) {
  const { profile } = useAuth();
  const { showError, showSuccess } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [activeStatus, setActiveStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [totalLeadCount, setTotalLeadCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<FilterCriteria>({
    assignedTo: [],
    campaignNames: [],
    channels: [],
    sources: [],
    statuses: [],
    subStatuses: [],
    cities: [],
    countries: [],
    currentOwners: [],
    previousOwners: [],
  });
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [showReferModal, setShowReferModal] = useState(false);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [showDeleteAllConfirmDialog, setShowDeleteAllConfirmDialog] = useState(false);
  const [showChangeStageModal, setShowChangeStageModal] = useState(false);
  const [showChangeStageConfirmDialog, setShowChangeStageConfirmDialog] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [bulkActionScope, setBulkActionScope] = useState<'selected' | 'filtered'>('selected');

  useEffect(() => {
    if (profile?.organization_id) {
      loadStatuses();
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, appliedFilters, activeStatus]);

  useEffect(() => {
    if (profile?.organization_id) {
      loadLeads();
    }
  }, [profile?.organization_id, searchQuery, appliedFilters, activeStatus, currentPage]);

  useEffect(() => {
    if (profile?.organization_id && statuses.length > 0) {
      loadStatusCounts();
    }
  }, [profile?.organization_id, statuses, searchQuery, appliedFilters]);

  const loadStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from('lead_statuses')
        .select('*')
        .eq('is_active', true)
        .eq('status_type', 'main')
        .order('order_index');

      if (error) throw error;
      if (data) setStatuses(data);
    } catch (error: any) {
      showError('Failed to load statuses: ' + error.message);
    }
  };

  const applySearch = (query: any) => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      return query;
    }

    const escapedQuery = trimmedQuery.replace(/[%_]/g, '\\$&');
    return query.or(
      `first_name.ilike.%${escapedQuery}%,last_name.ilike.%${escapedQuery}%,name.ilike.%${escapedQuery}%,email.ilike.%${escapedQuery}%,mobile_number.ilike.%${escapedQuery}%`
    );
  };

  const applyFilters = (query: any, includeActiveStatus = true) => {
    let nextQuery = query;

    if (profile?.organization_id) {
      nextQuery = nextQuery.eq('organization_id', profile.organization_id);
    }

    nextQuery = applySearch(nextQuery);

    if (includeActiveStatus && activeStatus !== 'all') {
      const selectedStatus = statuses.find((status) => status.name === activeStatus);
      if (selectedStatus) {
        nextQuery = nextQuery.eq('status_id', selectedStatus.id);
      }
    }

    if (appliedFilters.assignedTo?.length) {
      nextQuery = nextQuery.in('current_lead_owner', appliedFilters.assignedTo);
    }
    if (appliedFilters.campaignNames?.length) {
      nextQuery = nextQuery.in('campaign_name', appliedFilters.campaignNames);
    }
    if (appliedFilters.channels?.length) {
      nextQuery = nextQuery.in('channel', appliedFilters.channels);
    }
    if (appliedFilters.sources?.length) {
      nextQuery = nextQuery.in('source_id', appliedFilters.sources);
    }
    if (appliedFilters.statuses?.length) {
      nextQuery = nextQuery.in('status_id', appliedFilters.statuses);
    }
    if (appliedFilters.subStatuses?.length) {
      nextQuery = nextQuery.in('sub_status_id', appliedFilters.subStatuses);
    }
    if (appliedFilters.dateAddedFrom) {
      nextQuery = nextQuery.gte('created_at', appliedFilters.dateAddedFrom);
    }
    if (appliedFilters.dateAddedTo) {
      nextQuery = nextQuery.lte('created_at', appliedFilters.dateAddedTo);
    }
    if (appliedFilters.dateEditedFrom) {
      nextQuery = nextQuery.gte('updated_at', appliedFilters.dateEditedFrom);
    }
    if (appliedFilters.dateEditedTo) {
      nextQuery = nextQuery.lte('updated_at', appliedFilters.dateEditedTo);
    }
    if (appliedFilters.leadAgeMin !== undefined) {
      const maxCreatedAt = new Date(Date.now() - (appliedFilters.leadAgeMin * 24 * 60 * 60 * 1000)).toISOString();
      nextQuery = nextQuery.lte('created_at', maxCreatedAt);
    }
    if (appliedFilters.leadAgeMax !== undefined) {
      const minCreatedAt = new Date(Date.now() - (appliedFilters.leadAgeMax * 24 * 60 * 60 * 1000)).toISOString();
      nextQuery = nextQuery.gte('created_at', minCreatedAt);
    }
    if (appliedFilters.cities?.length) {
      nextQuery = nextQuery.in('city', appliedFilters.cities);
    }
    if (appliedFilters.countries?.length) {
      nextQuery = nextQuery.in('country', appliedFilters.countries);
    }
    if (appliedFilters.currentOwners?.length) {
      nextQuery = nextQuery.in('current_lead_owner', appliedFilters.currentOwners);
    }
    if (appliedFilters.isReEnquired !== null && appliedFilters.isReEnquired !== undefined) {
      nextQuery = nextQuery.eq('is_re_enquired', appliedFilters.isReEnquired);
    }
    if (appliedFilters.callCountMin !== undefined) {
      nextQuery = nextQuery.gte('call_count', appliedFilters.callCountMin);
    }
    if (appliedFilters.callCountMax !== undefined) {
      nextQuery = nextQuery.lte('call_count', appliedFilters.callCountMax);
    }
    if (appliedFilters.dateFrom) {
      nextQuery = nextQuery.gte('created_at', appliedFilters.dateFrom);
    }
    if (appliedFilters.dateTo) {
      nextQuery = nextQuery.lte('created_at', appliedFilters.dateTo);
    }

    return nextQuery;
  };

  const loadLeads = async () => {
    if (!profile?.organization_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const countQuery = applyFilters(
      supabase.from('leads').select('id', { count: 'exact', head: true })
    );

    const dataQuery = applyFilters(
      supabase
        .from('leads')
        .select(`
          *,
          lead_statuses:status_id (*),
          sub_status:sub_status_id (*),
          profiles:current_lead_owner (full_name),
          previous_owner_profile:previous_lead_owner (full_name),
          lead_sources (name, color)
        `)
    )
      .order('created_at', { ascending: false })
      .range(from, to);

    try {
      const [{ count, error: countError }, { data, error: dataError }] = await Promise.all([countQuery, dataQuery]);

      if (countError) throw countError;
      if (dataError) throw dataError;

      setTotalLeadCount(count || 0);
      setLeads((data || []) as Lead[]);
    } catch (error: any) {
      showError('Failed to load leads: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStatusCounts = async () => {
    const countEntries = await Promise.all([
      Promise.resolve(['all', await applyFilters(
        supabase.from('leads').select('id', { count: 'exact', head: true }),
        false
      )] as const),
      ...statuses.map(async (status) => {
        const result = await applyFilters(
          supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status_id', status.id),
          false
        );
        return [status.name, result] as const;
      }),
    ]);

    const nextCounts: Record<string, number> = {};
    countEntries.forEach(([key, result]) => {
      nextCounts[key] = result.count || 0;
    });
    setStatusCounts(nextCounts);
  };

  const refreshData = () => {
    loadLeads();
    if (profile?.organization_id && statuses.length > 0) {
      loadStatusCounts();
    }
  };

  const getStatusCount = (statusName: string) => statusCounts[statusName] || 0;

  const hasActiveFilters = () => {
    return (
      (searchQuery && searchQuery.trim() !== '') ||
      (appliedFilters.assignedTo && appliedFilters.assignedTo.length > 0) ||
      (appliedFilters.campaignNames && appliedFilters.campaignNames.length > 0) ||
      (appliedFilters.channels && appliedFilters.channels.length > 0) ||
      (appliedFilters.sources && appliedFilters.sources.length > 0) ||
      (appliedFilters.statuses && appliedFilters.statuses.length > 0) ||
      (appliedFilters.subStatuses && appliedFilters.subStatuses.length > 0) ||
      appliedFilters.dateAddedFrom !== undefined ||
      appliedFilters.dateAddedTo !== undefined ||
      appliedFilters.dateEditedFrom !== undefined ||
      appliedFilters.dateEditedTo !== undefined ||
      appliedFilters.leadAgeMin !== undefined ||
      appliedFilters.leadAgeMax !== undefined ||
      appliedFilters.leadNumberMin !== undefined ||
      appliedFilters.leadNumberMax !== undefined ||
      (appliedFilters.cities && appliedFilters.cities.length > 0) ||
      (appliedFilters.countries && appliedFilters.countries.length > 0) ||
      (appliedFilters.currentOwners && appliedFilters.currentOwners.length > 0) ||
      appliedFilters.isReEnquired !== null ||
      appliedFilters.callCountMin !== undefined ||
      appliedFilters.callCountMax !== undefined ||
      appliedFilters.dateFrom !== undefined ||
      appliedFilters.dateTo !== undefined
    );
  };

  const handleSelectChange = (leadId: string, selected: boolean) => {
    setSelectedLeadIds(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(leadId);
      } else {
        newSet.delete(leadId);
      }
      return newSet;
    });
  };

  const handleReferClick = () => {
    if (selectedLeadIds.size > 0) {
      setBulkActionScope('selected');
      setShowReferModal(true);
    } else {
      setShowConfirmDialog(true);
    }
  };

  const handleConfirmReferAll = () => {
    setBulkActionScope('filtered');
    setSelectedLeadIds(new Set());
    setShowConfirmDialog(false);
    setShowReferModal(true);
  };

  const handleReferSuccess = () => {
    setShowReferModal(false);
    setBulkActionScope('selected');
    setSelectedLeadIds(new Set());
    refreshData();
  };

  const handleDeleteClick = () => {
    if (selectedLeadIds.size > 0) {
      setShowDeleteConfirmDialog(true);
    } else {
      setShowDeleteAllConfirmDialog(true);
    }
  };

  const handleConfirmDelete = async () => {
    setShowDeleteConfirmDialog(false);
    const leadIdsToDelete = Array.from(selectedLeadIds);

    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .in('id', leadIdsToDelete);

      if (error) throw error;

      setSelectedLeadIds(new Set());
      refreshData();
      showSuccess('Leads deleted successfully');
    } catch (err) {
      console.error('Failed to delete leads:', err);
      showError(err instanceof Error ? err.message : 'Failed to delete leads');
    }
  };

  const handleConfirmDeleteAll = async () => {
    setShowDeleteAllConfirmDialog(false);

    try {
      const filterContext = getBulkFilterContext();
      const { data, error } = await supabase.rpc('bulk_delete_filtered_leads', {
        p_organization_id: filterContext.organizationId,
        p_search: filterContext.searchQuery || null,
        p_active_status_id: filterContext.activeStatusId || null,
        p_filters: filterContext.appliedFilters,
      });

      if (error) throw error;
      if (data && !data.success) {
        throw new Error(data.error || 'Failed to delete leads');
      }

      setSelectedLeadIds(new Set());
      refreshData();
      showSuccess('Leads deleted successfully');
    } catch (err) {
      console.error('Failed to delete leads:', err);
      showError(err instanceof Error ? err.message : 'Failed to delete leads');
    }
  };

  const handleEditClick = () => {
    if (selectedLeadIds.size > 0) {
      setShowChangeStageModal(true);
    } else {
      setShowChangeStageConfirmDialog(true);
    }
  };

  const handleConfirmChangeStageAll = () => {
    setBulkActionScope('filtered');
    setSelectedLeadIds(new Set());
    setShowChangeStageConfirmDialog(false);
    setShowChangeStageModal(true);
  };

  const handleChangeStageSuccess = () => {
    setShowChangeStageModal(false);
    setBulkActionScope('selected');
    setSelectedLeadIds(new Set());
    refreshData();
  };

  const handleEditFromCard = (leadId: string) => {
    setBulkActionScope('selected');
    setSelectedLeadIds(new Set([leadId]));
    setShowChangeStageModal(true);
  };

  const handleExportLeads = async () => {
    const leadsToExport = selectedLeadIds.size > 0
      ? leads.filter(lead => selectedLeadIds.has(lead.id))
      : leads;

    const exportData = leadsToExport as LeadExportData[];
    const timestamp = new Date().toISOString().split('T')[0];
    exportLeadsToCSV(exportData, `leads_export_${timestamp}.csv`);
    showSuccess('Leads exported successfully');
  };

  const handleBulkAssign = () => {
    if (selectedLeadIds.size === 0) {
      setBulkActionScope('filtered');
      setSelectedLeadIds(new Set());
    } else {
      setBulkActionScope('selected');
    }
    setShowBulkAssignModal(true);
  };

  const handleBulkAssignSuccess = () => {
    setShowBulkAssignModal(false);
    setBulkActionScope('selected');
    setSelectedLeadIds(new Set());
    refreshData();
  };

  const handleBulkChangeStatus = () => {
    if (selectedLeadIds.size === 0) {
      setBulkActionScope('filtered');
      setSelectedLeadIds(new Set());
    } else {
      setBulkActionScope('selected');
    }
    setShowChangeStageModal(true);
  };

  const getBulkFilterContext = (): BulkLeadFilterContext => {
    const activeStatusId = activeStatus === 'all'
      ? null
      : statuses.find((status) => status.name === activeStatus)?.id || null;

    return {
      organizationId: profile?.organization_id || '',
      searchQuery,
      activeStatusId,
      appliedFilters,
      totalCount: totalLeadCount,
    };
  };

  const totalPages = Math.max(1, Math.ceil(totalLeadCount / PAGE_SIZE));

  const handleBulkDelete = () => {
    if (selectedLeadIds.size > 0) {
      setShowDeleteConfirmDialog(true);
    } else {
      setShowDeleteAllConfirmDialog(true);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="border-b border-slate-200">
        <div className="flex items-center gap-2 px-6 py-3 overflow-x-auto">
          <button
            onClick={() => {
              setActiveStatus('all');
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition ${
              activeStatus === 'all'
                ? 'bg-orange-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({getStatusCount('all')})
          </button>

          {statuses.map((status) => (
            <button
              key={status.id}
              onClick={() => {
                setActiveStatus(status.name);
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition ${
                activeStatus === status.name
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status.display_name} ({getStatusCount(status.name)})
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between">
        {searchQuery && searchQuery.trim() !== '' && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="font-medium">Search results:</span>
            <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-lg font-semibold">
              {totalLeadCount} lead{totalLeadCount !== 1 ? 's' : ''} found
            </span>
          </div>
        )}
        <div className={`flex items-center gap-2 ${!searchQuery || searchQuery.trim() === '' ? 'ml-auto' : ''}`}>
          <button
            onClick={() => setShowBulkUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-medium"
            title="Bulk Upload"
          >
            <Upload className="w-5 h-5" />
            Bulk Upload
          </button>
          <div className="w-px h-6 bg-slate-200" />
          <BulkActionsMenu
            selectedCount={selectedLeadIds.size > 0 ? selectedLeadIds.size : totalLeadCount}
            onExport={handleExportLeads}
            onDownload={handleExportLeads}
            onAssign={handleBulkAssign}
            onChangeStatus={handleBulkChangeStatus}
            onDelete={handleBulkDelete}
          />
          <button
            onClick={() => setShowFilterModal(true)}
            className={`p-2 hover:bg-slate-100 rounded-lg transition relative ${
              hasActiveFilters() ? 'bg-orange-50' : ''
            }`}
            title="Filter"
          >
            <Filter className="w-5 h-5 text-orange-500" />
            {hasActiveFilters() && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center">
                !
              </span>
            )}
          </button>
          <button
            onClick={refreshData}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5 text-orange-500" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
          </div>
        ) : (
          <LeadList
            leads={leads}
            onRefresh={refreshData}
            selectedLeadIds={selectedLeadIds}
            onSelectChange={handleSelectChange}
            onEdit={handleEditFromCard}
            isSearching={searchQuery.trim() !== ''}
            isFiltering={hasActiveFilters()}
          />
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3 text-sm text-slate-600">
        <span>
          Showing {leads.length === 0 ? '0' : `${((currentPage - 1) * PAGE_SIZE) + 1}-${((currentPage - 1) * PAGE_SIZE) + leads.length}`} of {totalLeadCount}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1 || loading}
            className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <span className="px-2 font-medium text-slate-700">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={currentPage >= totalPages || loading}
            className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showAddLead && (
        <AddLeadModal
          onClose={onCloseAddLead}
          onSuccess={() => {
            onCloseAddLead();
            refreshData();
          }}
        />
      )}

      {showFilterModal && (
        <FilterModal
          onClose={() => setShowFilterModal(false)}
          currentFilters={appliedFilters}
          onApplyFilters={(filters) => setAppliedFilters(filters)}
        />
      )}

      {showReferModal && (
        <ReferLeadsModal
          leadIds={Array.from(selectedLeadIds)}
          filterContext={bulkActionScope === 'filtered' ? getBulkFilterContext() : undefined}
          onClose={() => setShowReferModal(false)}
          onSuccess={handleReferSuccess}
        />
      )}

      {showBulkAssignModal && (
        <BulkAssignModal
          leadIds={Array.from(selectedLeadIds)}
          filterContext={bulkActionScope === 'filtered' ? getBulkFilterContext() : undefined}
          onClose={() => setShowBulkAssignModal(false)}
          onSuccess={handleBulkAssignSuccess}
        />
      )}

      {showConfirmDialog && (
        <ConfirmationDialog
          title="Refer All Leads"
          message={`No leads are selected. Do you want to refer all ${totalLeadCount} lead${totalLeadCount !== 1 ? 's' : ''} in the current ${activeStatus === 'all' ? 'view' : activeStatus + ' status'}?`}
          confirmText="Refer All"
          onConfirm={handleConfirmReferAll}
          onCancel={() => setShowConfirmDialog(false)}
        />
      )}

      {showDeleteConfirmDialog && (
        <ConfirmationDialog
          title="Delete Leads"
          message={`Are you sure you want to delete ${selectedLeadIds.size} selected lead${selectedLeadIds.size !== 1 ? 's' : ''}? This action cannot be undone.`}
          confirmText="Delete"
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowDeleteConfirmDialog(false)}
        />
      )}

      {showDeleteAllConfirmDialog && (
        <ConfirmationDialog
          title="Delete All Leads"
          message={`No leads are selected. Do you want to delete all ${totalLeadCount} lead${totalLeadCount !== 1 ? 's' : ''} in the current ${activeStatus === 'all' ? 'view' : activeStatus + ' status'}? This action cannot be undone.`}
          confirmText="Delete All"
          onConfirm={handleConfirmDeleteAll}
          onCancel={() => setShowDeleteAllConfirmDialog(false)}
        />
      )}

      {showChangeStageModal && (
        <ChangeStageModal
          leadIds={Array.from(selectedLeadIds)}
          filterContext={bulkActionScope === 'filtered' ? getBulkFilterContext() : undefined}
          onClose={() => setShowChangeStageModal(false)}
          onSuccess={handleChangeStageSuccess}
        />
      )}

      {showChangeStageConfirmDialog && (
        <ConfirmationDialog
          title="Change Stage for All Leads"
          message={`No leads are selected. Do you want to change the stage for all ${totalLeadCount} lead${totalLeadCount !== 1 ? 's' : ''} in the current ${activeStatus === 'all' ? 'view' : activeStatus + ' status'}?`}
          confirmText="Change All"
          onConfirm={handleConfirmChangeStageAll}
          onCancel={() => setShowChangeStageConfirmDialog(false)}
        />
      )}

      {showBulkUploadModal && (
        <BulkUploadModal
          onClose={() => setShowBulkUploadModal(false)}
          onSuccess={() => {
            setShowBulkUploadModal(false);
            refreshData();
          }}
        />
      )}
    </div>
  );
}
