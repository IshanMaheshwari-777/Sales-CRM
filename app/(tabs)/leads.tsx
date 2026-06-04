import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Phone, Search, SlidersHorizontal } from '../../mobile/components/icons';
import { Avatar, EmptyState, Pill, ToneDot } from '../../mobile/components/design';
import { LeadFiltersModal } from '../../mobile/components/LeadFiltersModal';
import { useAuth } from '../../mobile/contexts/AuthContext';
import { useMobilePreferences } from '../../mobile/contexts/MobilePreferencesContext';
import {
  EMPTY_MOBILE_LEAD_FILTERS,
  getMobileLeadFilterOptions,
  searchLeads,
} from '../../mobile/lib/leadQueue';
import type { MobileLeadFilterOptions, MobileLeadFilters, MobileQueueLead } from '../../mobile/lib/types';

function countActiveFilters(filters: MobileLeadFilters) {
  return (
    filters.assignedTo.length +
    filters.campaignNames.length +
    filters.channels.length +
    filters.sources.length +
    filters.statuses.length +
    filters.subStatuses.length +
    filters.cities.length +
    (filters.dateAddedFrom ? 1 : 0) +
    (filters.dateAddedTo ? 1 : 0) +
    (filters.dateEditedFrom ? 1 : 0) +
    (filters.dateEditedTo ? 1 : 0) +
    (filters.callCountMin !== undefined ? 1 : 0) +
    (filters.callCountMax !== undefined ? 1 : 0)
  );
}

function getFilterSummary(filters: MobileLeadFilters, options: MobileLeadFilterOptions | null) {
  if (!options) return [];

  const getLabels = (selected: string[], source: Array<{ value: string; label: string }>) =>
    source.filter((item) => selected.includes(item.value)).map((item) => item.label);

  const statusOptions = options.statuses.map((status) => ({
    value: status.id,
    label: status.display_name,
  }));

  const chips = [
    ...getLabels(filters.assignedTo, options.owners),
    ...getLabels(filters.campaignNames, options.campaigns),
    ...getLabels(filters.channels, options.channels),
    ...getLabels(filters.sources, options.sources),
    ...getLabels(filters.statuses, statusOptions),
    ...getLabels(filters.subStatuses, statusOptions),
    ...getLabels(filters.cities, options.cities),
  ];

  if (filters.dateAddedFrom || filters.dateAddedTo) chips.push(`Added ${filters.dateAddedFrom || 'Any'}-${filters.dateAddedTo || 'Any'}`);
  if (filters.dateEditedFrom || filters.dateEditedTo) chips.push(`Edited ${filters.dateEditedFrom || 'Any'}-${filters.dateEditedTo || 'Any'}`);
  if (filters.callCountMin !== undefined || filters.callCountMax !== undefined) {
    chips.push(`Calls ${filters.callCountMin ?? '0'}-${filters.callCountMax ?? 'Any'}`);
  }

  return chips;
}

function LeadCard({
  item,
  onOpen,
  density,
  theme,
}: {
  item: MobileQueueLead;
  onOpen: () => void;
  density: 'comfortable' | 'compact';
  theme: ReturnType<typeof useMobilePreferences>['theme'];
}) {
  const compact = density === 'compact';
  const statusColor = item.status_color || theme.accent;

  return (
    <TouchableOpacity
      onPress={onOpen}
      style={{
        marginBottom: 12,
        borderRadius: 14,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
        paddingVertical: compact ? 10 : 12,
        paddingHorizontal: compact ? 12 : 14,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={item.name} theme={theme} size={compact ? 36 : 42} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <Text style={{ color: theme.text, fontSize: compact ? 13.5 : 15, fontWeight: '700', flex: 1 }} numberOfLines={1}>
              {item.name}
            </Text>
            {item.is_overdue ? <ToneDot color={theme.danger} size={6} /> : null}
          </View>
          {!compact ? (
            <Text style={{ color: theme.textDim, fontSize: 12, marginBottom: 5 }} numberOfLines={1}>
              {item.campaign_name || item.course || item.city || item.email || 'Lead source not set'}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <ToneDot color={statusColor} size={5} />
              <Text style={{ color: statusColor, fontSize: 11, fontWeight: '800' }} numberOfLines={1}>
                {item.status_name || 'Unstaged'}
              </Text>
            </View>
            <Text style={{ color: theme.textMute, fontSize: 11, fontWeight: '700' }}>· {item.call_count} calls</Text>
            <Text style={{ color: theme.textMute, fontSize: 11, flex: 1 }} numberOfLines={1}>
              · {item.last_updated ? 'updated' : 'new'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={(event) => {
            event.stopPropagation();
            if (item.mobile_number) Linking.openURL(`tel:${item.mobile_number}`);
          }}
          style={{
            width: compact ? 32 : 36,
            height: compact ? 32 : 36,
            borderRadius: compact ? 16 : 18,
            backgroundColor: theme.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Phone size={14} color={theme.onAccent} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function LeadsScreen() {
  const { profile } = useAuth();
  const { theme, preferences } = useMobilePreferences();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [leads, setLeads] = useState<MobileQueueLead[]>([]);
  const [filters, setFilters] = useState<MobileLeadFilters>(EMPTY_MOBILE_LEAD_FILTERS);
  const [filterOptions, setFilterOptions] = useState<MobileLeadFilterOptions | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const activeFilterCount = countActiveFilters(filters);
  const filterSummary = getFilterSummary(filters, filterOptions);
  const statusChips = [
    { id: 'all', label: 'All', count: leads.length },
    ...Array.from(
      leads.reduce((map, lead) => {
        const id = lead.status_id || 'unstaged';
        const label = lead.status_name || 'Unstaged';
        const current = map.get(id) || { id, label, count: 0 };
        current.count += 1;
        map.set(id, current);
        return map;
      }, new Map<string, { id: string; label: string; count: number }>())
    ).map(([, value]) => value),
  ];
  const visibleLeads = statusFilter === 'all'
    ? leads
    : leads.filter((lead) => (lead.status_id || 'unstaged') === statusFilter);

  const loadLeads = async (query = searchQuery, nextFilters = filters) => {
    if (!profile?.organization_id) return;
    try {
      const data = await searchLeads(profile.organization_id, query, nextFilters);
      setLeads(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadFilterOptions = async () => {
    if (!profile?.organization_id) return;
    setLoadingOptions(true);
    try {
      const options = await getMobileLeadFilterOptions(profile.organization_id);
      setFilterOptions(options);
    } finally {
      setLoadingOptions(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => loadLeads(searchQuery, filters), 200);
    return () => clearTimeout(timeout);
  }, [searchQuery, filters, profile?.organization_id]);

  useEffect(() => {
    loadFilterOptions();
  }, [profile?.organization_id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadLeads(searchQuery, filters);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <LeadFiltersModal
        visible={showFilters}
        currentFilters={filters}
        options={filterOptions}
        loading={loadingOptions}
        onClose={() => setShowFilters(false)}
        onApply={setFilters}
        onClear={() => setFilters(EMPTY_MOBILE_LEAD_FILTERS)}
      />

      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, backgroundColor: theme.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <View>
            <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }}>Leads</Text>
            <Text style={{ color: theme.textDim, fontSize: 12, marginTop: 2 }}>
              {visibleLeads.length} of {leads.length}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => setShowFilters(true)}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: activeFilterCount > 0 ? theme.accentSoft : theme.surface,
                borderWidth: 1,
                borderColor: activeFilterCount > 0 ? theme.accentRing : theme.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SlidersHorizontal size={16} color={activeFilterCount > 0 ? theme.accent : theme.textDim} />
            </TouchableOpacity>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: theme.accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: theme.onAccent, fontSize: 22, fontWeight: '700', lineHeight: 24 }}>+</Text>
            </View>
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderWidth: 1,
            borderRadius: 12,
            paddingHorizontal: 12,
            height: 44,
          }}
        >
          <Search size={18} color={theme.textMute} />
          <TextInput
            style={{ flex: 1, color: theme.text, fontSize: 15 }}
            placeholder="Search name, phone, email"
            placeholderTextColor={theme.textMute}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity
            onPress={() => setShowFilters(true)}
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: activeFilterCount > 0 ? theme.accent : theme.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SlidersHorizontal size={16} color={activeFilterCount > 0 ? theme.onAccent : theme.textDim} />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <Pill
            label={activeFilterCount > 0 ? `${activeFilterCount} filters active` : 'No filters'}
            theme={theme}
            tone={activeFilterCount > 0 ? 'accent' : 'muted'}
            onPress={() => setShowFilters(true)}
          />
          {activeFilterCount > 0 ? (
            <TouchableOpacity onPress={() => setFilters(EMPTY_MOBILE_LEAD_FILTERS)}>
              <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '900' }}>Clear all</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {filterSummary.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            {filterSummary.map((item) => (
              <Pill key={item} label={item} theme={theme} tone="info" style={{ marginRight: 8 }} />
            ))}
          </ScrollView>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 48 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}
      >
        {statusChips.map((chip) => (
          <TouchableOpacity
            key={chip.id}
            onPress={() => setStatusFilter(chip.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              borderRadius: 999,
              paddingHorizontal: 12,
              height: 36,
              backgroundColor: statusFilter === chip.id ? theme.accentSoft : theme.surface,
              borderWidth: 1,
              borderColor: statusFilter === chip.id ? theme.accentRing : theme.border,
            }}
          >
            <Text style={{ color: statusFilter === chip.id ? theme.accent : theme.text, fontSize: 13, fontWeight: '800' }}>
              {chip.label}
            </Text>
            <View
              style={{
                borderRadius: 8,
                paddingHorizontal: 6,
                paddingVertical: 1,
                backgroundColor: statusFilter === chip.id ? theme.accent : theme.surface2,
              }}
            >
              <Text style={{ color: statusFilter === chip.id ? theme.onAccent : theme.textDim, fontSize: 10, fontWeight: '900' }}>
                {chip.count}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={visibleLeads}
        renderItem={({ item }) => (
          <LeadCard
            item={item}
            theme={theme}
            density={preferences.leadCardDensity}
            onOpen={() => router.push(`/lead/${item.lead_id}`)}
          />
        )}
        keyExtractor={(item) => item.lead_id}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: preferences.bottomNavStyle === 'pill' ? 110 : 88,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        ListEmptyComponent={
          <View style={{ paddingTop: 40 }}>
            <EmptyState
              title="No matching leads"
              body="Try clearing filters or searching with a different name, mobile number, email, or course."
              theme={theme}
            />
          </View>
        }
      />
    </View>
  );
}
