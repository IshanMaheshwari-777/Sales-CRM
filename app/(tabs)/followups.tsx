import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CheckCircle2, Circle, Phone } from '../../mobile/components/icons';
import { EmptyState, ToneDot } from '../../mobile/components/design';
import { useAuth } from '../../mobile/contexts/AuthContext';
import { useMobilePreferences } from '../../mobile/contexts/MobilePreferencesContext';
import { getFollowups, markFollowupComplete } from '../../mobile/lib/leadQueue';
import type { FollowupItem } from '../../mobile/lib/types';

export default function FollowupsScreen() {
  const { profile } = useAuth();
  const { theme, preferences } = useMobilePreferences();
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'today' | 'pending'>('pending');
  const [followups, setFollowups] = useState<FollowupItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadFollowups = async () => {
    if (!profile?.organization_id) return;
    try {
      const data = await getFollowups(profile.organization_id, filter);
      setFollowups(data);
    } catch (error) {
      console.error('Error loading follow-ups:', error);
      Alert.alert('Unable to load follow-ups', 'Please try again in a moment.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFollowups();
  }, [filter, profile?.organization_id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadFollowups();
  };

  const handleMarkComplete = async (followupId: string) => {
    try {
      await markFollowupComplete(followupId);
      await loadFollowups();
    } catch (error) {
      console.error('Error marking follow-up complete:', error);
      Alert.alert('Could not update', 'The follow-up could not be marked complete.');
    }
  };

  const renderFollowup = ({ item }: { item: FollowupItem }) => {
    const dueDate = new Date(`${item.next_action_date}T${item.next_action_time}`);
    const overdue = item.status === 'pending' && dueDate.getTime() < Date.now();
    const leadName = item.lead?.name || 'Lead follow-up';

    return (
      <TouchableOpacity
        style={{
          marginBottom: 12,
          borderRadius: 14,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: overdue ? theme.dangerSoft : theme.border,
          padding: 12,
          overflow: 'hidden',
        }}
        onPress={() => router.push(`/lead/${item.lead_id}`)}
      >
        {overdue ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: theme.danger }} /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <Text style={{ color: theme.text, fontSize: 14.5, fontWeight: '800', flex: 1 }} numberOfLines={1}>
                {leadName}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <ToneDot color={overdue ? theme.danger : theme.accent} size={5} />
                <Text style={{ color: overdue ? theme.danger : theme.accent, fontSize: 10.5, fontWeight: '800' }}>
                  {overdue ? 'Overdue' : item.status}
                </Text>
              </View>
            </View>
            <Text style={{ color: theme.textDim, fontSize: 12.5, lineHeight: 18, marginBottom: 6 }}>
              {item.followup_remarks || 'Follow up with this lead.'}
            </Text>
            <Text style={{ color: overdue ? theme.danger : theme.textDim, fontSize: 11.5, fontWeight: '800' }}>
              {item.next_action_date} · {item.next_action_time}
            </Text>
          </View>
          <TouchableOpacity
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: theme.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={(event) => {
              event.stopPropagation();
              if (item.lead?.mobile_number) {
                Linking.openURL(`tel:${item.lead.mobile_number}`);
              }
            }}
          >
            <Phone size={13} color={theme.onAccent} />
          </TouchableOpacity>
          {item.status === 'pending' ? (
            <TouchableOpacity
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: 'transparent',
                borderWidth: 1.5,
                borderColor: theme.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={(event) => {
                event.stopPropagation();
                handleMarkComplete(item.id);
              }}
            >
              <Circle size={12} color={theme.textMute} />
            </TouchableOpacity>
          ) : (
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: theme.successSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={12} color={theme.success} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const overdueCount = followups.filter((item) => {
    const dueDate = new Date(`${item.next_action_date}T${item.next_action_time}`);
    return item.status === 'pending' && dueDate.getTime() < Date.now();
  }).length;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
        <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }}>Follow-ups</Text>
        <Text style={{ color: theme.textDim, fontSize: 12, marginTop: 3 }}>
          {followups.length} open · <Text style={{ color: theme.danger, fontWeight: '800' }}>{overdueCount} overdue</Text>
        </Text>

        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            marginTop: 14,
            backgroundColor: theme.surface,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 4,
          }}
        >
          {(['today', 'pending', 'all'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={{
                flex: 1,
                borderRadius: 14,
                paddingVertical: 11,
                backgroundColor: filter === tab ? theme.accent : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
              }}
              onPress={() => setFilter(tab)}
            >
              <Text style={{ color: filter === tab ? theme.onAccent : theme.textDim, fontWeight: '900', fontSize: 13 }}>
                {tab === 'pending' ? 'Pending' : tab === 'today' ? 'Today' : 'All'}
              </Text>
              <View
                style={{
                  borderRadius: 6,
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  backgroundColor: filter === tab ? 'rgba(0,0,0,0.15)' : theme.surface2,
                  marginLeft: 6,
                }}
              >
                <Text style={{ color: filter === tab ? theme.onAccent : theme.textMute, fontSize: 10, fontWeight: '800' }}>
                  {tab === 'all' ? followups.length : followups.filter((item) => {
                    const dueDate = new Date(`${item.next_action_date}T${item.next_action_time}`);
                    if (tab === 'today') return dueDate.toDateString() === new Date().toDateString();
                    return item.status === 'pending';
                  }).length}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {filter === 'today' && overdueCount > 0 ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <View
            style={{
              backgroundColor: theme.dangerSoft,
              borderWidth: 1,
              borderColor: theme.dangerSoft,
              borderRadius: 12,
              paddingVertical: 10,
              paddingHorizontal: 12,
            }}
          >
            <Text style={{ color: theme.text, fontSize: 12.5, fontWeight: '700' }}>
              <Text style={{ color: theme.danger }}>{overdueCount} overdue</Text> from earlier this week
            </Text>
          </View>
        </View>
      ) : null}

      <FlatList
        data={followups}
        renderItem={renderFollowup}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: preferences.bottomNavStyle === 'pill' ? 110 : 88 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        ListEmptyComponent={
          <View style={{ paddingTop: 40 }}>
            <EmptyState
              title="No follow-ups here"
              body="When a lead needs another touchpoint, it will show up in this workspace."
              theme={theme}
            />
          </View>
        }
      />
    </View>
  );
}
