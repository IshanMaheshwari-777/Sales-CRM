import type { FilterCriteria } from './FilterModal';

export interface BulkLeadFilterContext {
  organizationId: string;
  searchQuery: string;
  activeStatusId: string | null;
  appliedFilters: FilterCriteria;
  totalCount: number;
}
