import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CalendarClock, Mail, MessageCircle, MoreHorizontal, Phone, X } from '../../mobile/components/icons';
import { Avatar, Pill, ToneDot } from '../../mobile/components/design';
import { useAuth } from '../../mobile/contexts/AuthContext';
import { useMobilePreferences } from '../../mobile/contexts/MobilePreferencesContext';
import {
  getLeadDetails,
  getLeadStatuses,
  QUICK_OUTCOMES,
  quickUpdateLead,
  resolveQuickOutcome,
} from '../../mobile/lib/leadQueue';
import type { QuickOutcomeKey, StatusOption } from '../../mobile/lib/types';

const OUTCOME_TONES: Record<QuickOutcomeKey, 'success' | 'warning' | 'info' | 'danger' | 'muted'> = {
  connected: 'success',
  no_answer: 'warning',
  callback: 'info',
  wrong_number: 'danger',
  converted: 'success',
  junk: 'muted',
};

function toFollowupIso(preset: 'today' | 'tomorrow' | 'three_days' | 'week') {
  const date = new Date();
  if (preset === 'today') date.setHours(17, 0, 0, 0);
  if (preset === 'tomorrow') {
    date.setDate(date.getDate() + 1);
    date.setHours(11, 0, 0, 0);
  }
  if (preset === 'three_days') date.setDate(date.getDate() + 3);
  if (preset === 'week') date.setDate(date.getDate() + 7);
  return date.toISOString();
}

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile, user } = useAuth();
  const { theme } = useMobilePreferences();
  const [lead, setLead] = useState<any>(null);
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [selectedStatusId, setSelectedStatusId] = useState<string | null>(null);
  const [selectedSubStatusId, setSelectedSubStatusId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [followupAt, setFollowupAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const mainStatuses = useMemo(() => statuses.filter((status) => status.status_type === 'main'), [statuses]);
  const subStatuses = useMemo(
    () => statuses.filter((status) => status.parent_status_id === selectedStatusId),
    [statuses, selectedStatusId]
  );

  useEffect(() => {
    const load = async () => {
      if (!id || !profile?.organization_id) return;
      try {
        const [details, statusOptions] = await Promise.all([
          getLeadDetails(id, profile.organization_id),
          getLeadStatuses(profile.organization_id),
        ]);
        setLead(details);
        setStatuses(statusOptions);
        setSelectedStatusId(details.status_id);
        setSelectedSubStatusId(details.sub_status_id);
      } catch (error) {
        console.error('Error loading lead details:', error);
        Alert.alert('Lead unavailable', 'We could not load this lead right now.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, profile?.organization_id]);

  const handleDial = async () => {
    if (!lead?.mobile_number) {
      Alert.alert('No mobile number', 'This lead does not have a callable number yet.');
      return;
    }
    await Linking.openURL(`tel:${lead.mobile_number}`);
  };

  const handleQuickOutcome = async (outcome: QuickOutcomeKey) => {
    if (!lead || !user?.id) return;
    const resolved = resolveQuickOutcome(statuses, outcome);
    setSaving(true);
    try {
      await quickUpdateLead(user.id, {
        leadId: lead.id,
        disposition: outcome,
        statusId: resolved.statusId,
        subStatusId: resolved.subStatusId,
        note: note.trim() || undefined,
        nextFollowupAt: resolved.defaultFollowupAt,
      });
      router.back();
    } catch (error) {
      console.error('Quick outcome failed:', error);
      Alert.alert('Save failed', 'We could not save that outcome.');
    } finally {
      setSaving(false);
    }
  };

  const handleManualSave = async () => {
    if (!lead || !user?.id) return;
    setSaving(true);
    try {
      await quickUpdateLead(user.id, {
        leadId: lead.id,
        disposition: 'manual_update',
        statusId: selectedStatusId,
        subStatusId: selectedSubStatusId,
        note: note.trim() || undefined,
        nextFollowupAt: followupAt || undefined,
      });
      router.back();
    } catch (error) {
      console.error('Manual lead save failed:', error);
      Alert.alert('Save failed', 'We could not save that lead update.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  if (!lead) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
        <Text style={{ color: theme.textDim }}>Lead not found.</Text>
      </View>
    );
  }

  const currentStatus = lead.lead_statuses?.display_name || 'Unstaged';
  const currentSubStatus = lead.sub_status?.display_name || 'No sub-status';

  const ActionTile = ({
    icon,
    label,
    color,
    filled,
    onPress,
  }: {
    icon: React.ReactNode;
    label: string;
    color: string;
    filled?: boolean;
    onPress?: () => void;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flex: 1,
        height: 64,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: filled ? color : theme.border,
        backgroundColor: filled ? color : theme.surface,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
      }}
    >
      {icon}
      <Text style={{ color: filled ? theme.onAccent : color, fontSize: 11.5, fontWeight: '800' }}>{label}</Text>
    </TouchableOpacity>
  );

  const FieldRow = ({ icon, label, value, mono = false }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) => (
    <View style={{ paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: theme.borderSoft }}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.surface2, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.textMute, fontSize: 11, fontWeight: '700', marginBottom: 2 }}>{label}</Text>
        <Text style={{ color: theme.text, fontSize: 13.5, fontWeight: '700', fontFamily: mono ? 'monospace' : undefined }} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );

  const ContextCell = ({ label, value }: { label: string; value: string | number | null | undefined }) => (
    <View style={{ width: '48.5%', borderRadius: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, paddingVertical: 9, paddingHorizontal: 10 }}>
      <Text style={{ color: theme.textMute, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ color: theme.text, fontSize: 12.5, fontWeight: '700', marginTop: 3 }} numberOfLines={1}>
        {value || 'Not set'}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ paddingHorizontal: 12, paddingTop: 44, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.borderSoft, backgroundColor: theme.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}
          >
            <ArrowLeft size={16} color={theme.text} />
          </TouchableOpacity>
          <Text style={{ flex: 1, color: theme.textDim, fontSize: 13, fontWeight: '700', fontFamily: 'monospace' }} numberOfLines={1}>
            {lead.id}
          </Text>
          <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
            <MoreHorizontal size={16} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar name={lead.name} theme={theme} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }} numberOfLines={1}>{lead.name}</Text>
            <Text style={{ color: theme.textDim, fontSize: 12.5, marginTop: 3 }} numberOfLines={1}>
              {[lead.course, lead.city].filter(Boolean).join(' · ') || lead.mobile_number || lead.email || 'Lead'}
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
          <TouchableOpacity
            style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.textMute, fontSize: 10.5, fontWeight: '800', letterSpacing: 1, marginBottom: 7 }}>STATUS</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Pill label={currentStatus} theme={theme} tone="accent" />
                <Text style={{ color: theme.textDim, fontSize: 12.5 }}>· {currentSubStatus}</Text>
              </View>
            </View>
            <Text style={{ color: theme.textMute, fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 16, paddingBottom: 16, flexDirection: 'row', gap: 10 }}>
          <ActionTile icon={<Phone size={20} color={theme.onAccent} />} label="Call" color={theme.accent} filled onPress={handleDial} />
          <ActionTile icon={<MessageCircle size={20} color="#25D366" />} label="WhatsApp" color="#25D366" onPress={() => lead.mobile_number && Linking.openURL(`https://wa.me/${lead.mobile_number.replace(/\D/g, '')}`)} />
          <ActionTile icon={<Mail size={20} color={theme.info} />} label="Email" color={theme.info} onPress={() => lead.email && Linking.openURL(`mailto:${lead.email}`)} />
        </View>

        <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
          <View style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 14, overflow: 'hidden' }}>
            <FieldRow icon={<Phone size={14} color={theme.textDim} />} label="Mobile" value={lead.mobile_number || 'Not set'} mono />
            <FieldRow icon={<Mail size={14} color={theme.textDim} />} label="Email" value={lead.email || 'Not set'} />
            <FieldRow icon={<ToneDot color={theme.textDim} size={8} />} label="City" value={lead.city || 'Not set'} />
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
          <Text style={{ color: theme.textMute, fontSize: 11, fontWeight: '800', letterSpacing: 1.1, marginBottom: 8 }}>LEAD CONTEXT</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <ContextCell label="Campaign" value={lead.campaign_name} />
            <ContextCell label="Channel" value={lead.channel} />
            <ContextCell label="Owner" value={lead.owner?.full_name || 'Unassigned'} />
            <ContextCell label="Calls" value={lead.call_count ?? 0} />
            <ContextCell label="Course" value={lead.course} />
            <ContextCell label="University" value={lead.university} />
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
          <View style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <CalendarClock size={16} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.textMute, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>NEXT FOLLOW-UP</Text>
              <Text style={{ color: followupAt ? theme.text : theme.textDim, fontSize: 14, fontWeight: '800', marginTop: 3 }} numberOfLines={1}>
                {followupAt || 'Choose a quick follow-up below'}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
          <Text style={{ color: theme.textMute, fontSize: 11, fontWeight: '800', letterSpacing: 1.1, marginBottom: 8 }}>QUICK OUTCOME</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(Object.keys(QUICK_OUTCOMES) as QuickOutcomeKey[]).map((key) => {
              const tone = OUTCOME_TONES[key];
              const color = tone === 'success' ? theme.success : tone === 'danger' ? theme.danger : tone === 'warning' ? theme.warning : tone === 'info' ? theme.info : theme.textDim;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => handleQuickOutcome(key)}
                  disabled={saving}
                  style={{ width: '48.5%', borderRadius: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, padding: 12 }}
                >
                  <Text style={{ color, fontSize: 13, fontWeight: '800' }}>{QUICK_OUTCOMES[key].label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
          <Text style={{ color: theme.textMute, fontSize: 11, fontWeight: '800', letterSpacing: 1.1, marginBottom: 8 }}>STATUS UPDATE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {mainStatuses.map((status) => (
              <Pill
                key={status.id}
                label={status.display_name}
                theme={theme}
                active={selectedStatusId === status.id}
                onPress={() => {
                  setSelectedStatusId(status.id);
                  setSelectedSubStatusId(null);
                }}
                style={{ marginRight: 8 }}
              />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {subStatuses.length > 0 ? (
              subStatuses.map((status) => (
                <Pill key={status.id} label={status.display_name} theme={theme} active={selectedSubStatusId === status.id} onPress={() => setSelectedSubStatusId(status.id)} style={{ marginRight: 8 }} />
              ))
            ) : (
              <Text style={{ color: theme.textMute, fontSize: 12 }}>Choose a main status first.</Text>
            )}
          </ScrollView>
        </View>

        <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
          <Text style={{ color: theme.textMute, fontSize: 11, fontWeight: '800', letterSpacing: 1.1, marginBottom: 8 }}>FOLLOW-UP PRESETS</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[
              ['Today 5pm', 'today'],
              ['Tomorrow 11am', 'tomorrow'],
              ['In 3 days', 'three_days'],
              ['Next week', 'week'],
            ].map(([label, preset]) => (
              <Pill key={preset} label={label} theme={theme} tone="info" onPress={() => setFollowupAt(toFollowupIso(preset as any))} />
            ))}
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: theme.textMute, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 }}>NOTE</Text>
            {note ? (
              <TouchableOpacity onPress={() => setNote('')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <X size={12} color={theme.accent} />
                <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '800' }}>Clear</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <TextInput
            style={{ minHeight: 86, borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, color: theme.text, padding: 13, fontSize: 14, textAlignVertical: 'top' }}
            placeholder="Add a short note..."
            placeholderTextColor={theme.textMute}
            value={note}
            onChangeText={setNote}
            multiline
          />
          <TouchableOpacity
            onPress={handleManualSave}
            disabled={saving}
            style={{ minHeight: 52, borderRadius: 14, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center', marginTop: 12, opacity: saving ? 0.6 : 1 }}
          >
            <Text style={{ color: theme.onAccent, fontSize: 14, fontWeight: '800' }}>{saving ? 'Saving...' : 'Save update'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
