import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Pill, PrimaryButton } from './design';
import { useMobilePreferences } from '../contexts/MobilePreferencesContext';
import type {
  MobileFilterOption,
  MobileLeadFilterOptions,
  MobileLeadFilters,
  StatusOption,
} from '../lib/types';

type LeadFiltersModalProps = {
  visible: boolean;
  currentFilters: MobileLeadFilters;
  options: MobileLeadFilterOptions | null;
  loading?: boolean;
  onClose: () => void;
  onApply: (filters: MobileLeadFilters) => void;
  onClear: () => void;
};

function MultiSelectSection({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: MobileFilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const { theme } = useMobilePreferences();
  if (options.length === 0) return null;

  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ color: theme.textMute, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 10 }}>
        {title.toUpperCase()}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <Pill
              key={option.value}
              label={option.label}
              theme={theme}
              active={active}
              tone={active ? 'accent' : 'muted'}
              onPress={() => onToggle(option.value)}
            />
          );
        })}
      </View>
    </View>
  );
}

function DateInputRow({
  title,
  from,
  to,
  onChange,
}: {
  title: string;
  from?: string;
  to?: string;
  onChange: (next: { from?: string; to?: string }) => void;
}) {
  const { theme } = useMobilePreferences();
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ color: theme.textMute, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 10 }}>
        {title.toUpperCase()}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          style={{
            flex: 1,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surface2,
            paddingHorizontal: 13,
            paddingVertical: 12,
            color: theme.text,
          }}
          placeholder="From YYYY-MM-DD"
          placeholderTextColor={theme.textMute}
          value={from || ''}
          onChangeText={(value) => onChange({ from: value || undefined, to })}
          autoCapitalize="none"
        />
        <TextInput
          style={{
            flex: 1,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surface2,
            paddingHorizontal: 13,
            paddingVertical: 12,
            color: theme.text,
          }}
          placeholder="To YYYY-MM-DD"
          placeholderTextColor={theme.textMute}
          value={to || ''}
          onChangeText={(value) => onChange({ from, to: value || undefined })}
          autoCapitalize="none"
        />
      </View>
    </View>
  );
}

function NumberRangeRow({
  title,
  min,
  max,
  onChange,
}: {
  title: string;
  min?: number;
  max?: number;
  onChange: (next: { min?: number; max?: number }) => void;
}) {
  const { theme } = useMobilePreferences();
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ color: theme.textMute, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 10 }}>
        {title.toUpperCase()}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          style={{
            flex: 1,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surface2,
            paddingHorizontal: 13,
            paddingVertical: 12,
            color: theme.text,
          }}
          placeholder="Min"
          placeholderTextColor={theme.textMute}
          value={min !== undefined ? String(min) : ''}
          keyboardType="numeric"
          onChangeText={(value) =>
            onChange({
              min: value ? Number(value) : undefined,
              max,
            })
          }
        />
        <TextInput
          style={{
            flex: 1,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surface2,
            paddingHorizontal: 13,
            paddingVertical: 12,
            color: theme.text,
          }}
          placeholder="Max"
          placeholderTextColor={theme.textMute}
          value={max !== undefined ? String(max) : ''}
          keyboardType="numeric"
          onChangeText={(value) =>
            onChange({
              min,
              max: value ? Number(value) : undefined,
            })
          }
        />
      </View>
    </View>
  );
}

function toggleInArray(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export function LeadFiltersModal({
  visible,
  currentFilters,
  options,
  loading = false,
  onClose,
  onApply,
  onClear,
}: LeadFiltersModalProps) {
  const { theme } = useMobilePreferences();
  const [draft, setDraft] = useState<MobileLeadFilters>(currentFilters);

  useEffect(() => {
    if (visible) {
      setDraft(currentFilters);
    }
  }, [visible, currentFilters]);

  const mainStatuses = useMemo(
    () => (options?.statuses || []).filter((status) => status.status_type === 'main'),
    [options?.statuses]
  );

  const availableSubStatuses = useMemo(() => {
    const source = options?.statuses || [];
    if (draft.statuses.length === 0) {
      return [] as StatusOption[];
    }

    return source.filter(
      (status) => status.parent_status_id && draft.statuses.includes(status.parent_status_id)
    );
  }, [draft.statuses, options?.statuses]);

  const statusOptions: MobileFilterOption[] = mainStatuses.map((status) => ({
    value: status.id,
    label: status.display_name,
    color: status.color,
  }));

  const subStatusOptions: MobileFilterOption[] = availableSubStatuses.map((status) => ({
    value: status.id,
    label: status.display_name,
    color: status.color,
  }));

  const handleStatusToggle = (statusId: string) => {
    const nextStatuses = toggleInArray(draft.statuses, statusId);
    const validSubStatuses = availableSubStatuses
      .filter((status) => nextStatuses.includes(status.parent_status_id || ''))
      .map((status) => status.id);

    setDraft((prev) => ({
      ...prev,
      statuses: nextStatuses,
      subStatuses: prev.subStatuses.filter((subStatusId) => validSubStatuses.includes(subStatusId)),
    }));
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <View style={{ borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.bg, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 48 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: theme.textDim, fontSize: 14, fontWeight: '800' }}>Close</Text>
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900' }}>Lead filters</Text>
              <Text style={{ color: theme.textMute, fontSize: 11, marginTop: 2 }}>Narrow down your leads</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                onClear();
                onClose();
              }}
            >
              <Text style={{ color: theme.accent, fontSize: 14, fontWeight: '900' }}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading || !options ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : (
          <>
            <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 18 }} contentContainerStyle={{ paddingBottom: 140 }}>
              <MultiSelectSection
                title="Lead Owner"
                options={options.owners}
                selected={draft.assignedTo}
                onToggle={(value) =>
                  setDraft((prev) => ({ ...prev, assignedTo: toggleInArray(prev.assignedTo, value) }))
                }
              />

              <MultiSelectSection
                title="Campaign"
                options={options.campaigns}
                selected={draft.campaignNames}
                onToggle={(value) =>
                  setDraft((prev) => ({
                    ...prev,
                    campaignNames: toggleInArray(prev.campaignNames, value),
                  }))
                }
              />

              <MultiSelectSection
                title="Channel"
                options={options.channels}
                selected={draft.channels}
                onToggle={(value) =>
                  setDraft((prev) => ({ ...prev, channels: toggleInArray(prev.channels, value) }))
                }
              />

              <MultiSelectSection
                title="Source"
                options={options.sources}
                selected={draft.sources}
                onToggle={(value) =>
                  setDraft((prev) => ({ ...prev, sources: toggleInArray(prev.sources, value) }))
                }
              />

              <MultiSelectSection
                title="Main Status"
                options={statusOptions}
                selected={draft.statuses}
                onToggle={handleStatusToggle}
              />

              {subStatusOptions.length > 0 ? (
                <MultiSelectSection
                  title="Sub-status"
                  options={subStatusOptions}
                  selected={draft.subStatuses}
                  onToggle={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      subStatuses: toggleInArray(prev.subStatuses, value),
                    }))
                  }
                />
              ) : null}

              <MultiSelectSection
                title="City"
                options={options.cities}
                selected={draft.cities}
                onToggle={(value) =>
                  setDraft((prev) => ({ ...prev, cities: toggleInArray(prev.cities, value) }))
                }
              />

              <DateInputRow
                title="Date Added"
                from={draft.dateAddedFrom}
                to={draft.dateAddedTo}
                onChange={({ from, to }) =>
                  setDraft((prev) => ({
                    ...prev,
                    dateAddedFrom: from,
                    dateAddedTo: to,
                  }))
                }
              />

              <DateInputRow
                title="Date Edited"
                from={draft.dateEditedFrom}
                to={draft.dateEditedTo}
                onChange={({ from, to }) =>
                  setDraft((prev) => ({
                    ...prev,
                    dateEditedFrom: from,
                    dateEditedTo: to,
                  }))
                }
              />

              <NumberRangeRow
                title="Call Count"
                min={draft.callCountMin}
                max={draft.callCountMax}
                onChange={({ min, max }) =>
                  setDraft((prev) => ({
                    ...prev,
                    callCountMin: min,
                    callCountMax: max,
                  }))
                }
              />
            </ScrollView>

            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.bg, paddingHorizontal: 16, paddingBottom: 28, paddingTop: 14 }}>
              <PrimaryButton
                label="Apply filters"
                theme={theme}
                onPress={() => {
                  onApply(draft);
                  onClose();
                }}
              />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}
