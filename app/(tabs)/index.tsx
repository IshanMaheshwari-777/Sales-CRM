import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowRight,
  CalendarClock,
  Phone,
  RefreshCcw,
  Signal,
  Users,
} from '../../mobile/components/icons';
import {
  Avatar,
  Card,
  EmptyState,
  KpiCard,
  LoadingState,
  Pill,
  PrimaryButton,
  SectionTitle,
} from '../../mobile/components/design';
import { useAuth } from '../../mobile/contexts/AuthContext';
import { useMobilePreferences } from '../../mobile/contexts/MobilePreferencesContext';
import {
  formatLeadSubtitle,
  flushPendingQuickUpdates,
  getDashboardSummary,
  getRepQueue,
  getTeamSummary,
} from '../../mobile/lib/leadQueue';
import { listPendingQuickUpdates } from '../../mobile/lib/offlineQueue';
import type { MobileDashboardSummary, MobileQueueLead, TeamSummary } from '../../mobile/lib/types';

type PeriodKey = 'today' | 'week' | 'month';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function LeadMiniCard({
  lead,
  onPress,
  theme,
}: {
  lead: MobileQueueLead;
  onPress: () => void;
  theme: ReturnType<typeof useMobilePreferences>['theme'];
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        borderRadius: 18,
        borderWidth: 1,
        borderColor: lead.is_overdue ? theme.dangerSoft : theme.borderSoft,
        backgroundColor: theme.surface2,
        padding: 13,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={lead.name} theme={theme} size={38} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: '900' }} numberOfLines={1}>
            {lead.name}
          </Text>
          <Text style={{ color: theme.textDim, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
            {formatLeadSubtitle(lead) || lead.email || 'Lead action available'}
          </Text>
        </View>
        <Pill
          label={lead.status_name || 'Unstaged'}
          theme={theme}
          tone={lead.is_overdue ? 'danger' : 'muted'}
        />
      </View>
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const { profile, user } = useAuth();
  const { theme, preferences } = useMobilePreferences();
  const router = useRouter();
  const [period, setPeriod] = useState<PeriodKey>('week');
  const [queue, setQueue] = useState<MobileQueueLead[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<MobileDashboardSummary | null>(null);
  const [teamSummary, setTeamSummary] = useState<TeamSummary | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const nextLead = queue[0] ?? null;
  const actionNeededLeads = useMemo(
    () => (preferences.dashboardLayout === 'summary' ? queue.slice(0, 3) : queue.slice(0, 5)),
    [preferences.dashboardLayout, queue]
  );
  const isLeadManager =
    (profile?.role_name || '').toLowerCase().includes('lead') ||
    (profile?.role_name || '').toLowerCase().includes('admin');

  const loadDashboard = async (showRefreshSpinner = false) => {
    if (!profile?.organization_id || !user?.id) return;

    try {
      if (!showRefreshSpinner) setLoading(true);

      const [summaryData, queueData, pendingUpdates, flushedCount, teamData] = await Promise.all([
        getDashboardSummary(profile.organization_id, user.id),
        getRepQueue(user.id, 25),
        listPendingQuickUpdates(user.id),
        flushPendingQuickUpdates(user.id).catch(() => 0),
        isLeadManager ? getTeamSummary().catch(() => null) : Promise.resolve(null),
      ]);

      setDashboardSummary(summaryData);
      setQueue(queueData);
      setTeamSummary(teamData);
      setPendingSyncCount(Math.max(pendingUpdates.length - flushedCount, 0));
      setLoadFailed(false);
    } catch (error) {
      console.error('Error loading mobile dashboard:', error);
      setLoadFailed(true);
      setDashboardSummary({
        owned_lead_count: 0,
        pending_followups: 0,
        today_followups: 0,
        recent_updates: 0,
      });
      Alert.alert('Dashboard unavailable', 'We could not refresh the dashboard right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [profile?.organization_id, user?.id, preferences.dashboardLayout]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard(true);
  };

  const handleCall = async (lead: MobileQueueLead) => {
    if (!lead.mobile_number) {
      Alert.alert('No mobile number', 'This lead does not have a mobile number yet.');
      return;
    }
    await Linking.openURL(`tel:${lead.mobile_number}`);
  };

  if (loading || !dashboardSummary) {
    return <LoadingState theme={theme} label="Loading your dashboard..." />;
  }

  const showQueueHigh = preferences.dashboardLayout === 'queue';
  const showTeam = isLeadManager && teamSummary && preferences.dashboardLayout !== 'queue';
  const untouched = queue.filter((lead) => !lead.call_count).length;
  const periodMeta: Record<PeriodKey, { owned: number; ownedDelta: string; convertedLabel: string }> = {
    today: {
      owned: dashboardSummary.owned_lead_count,
      ownedDelta: `${dashboardSummary.recent_updates} updated today`,
      convertedLabel: 'today',
    },
    week: {
      owned: dashboardSummary.owned_lead_count,
      ownedDelta: `${dashboardSummary.recent_updates} recent`,
      convertedLabel: 'this week',
    },
    month: {
      owned: dashboardSummary.owned_lead_count,
      ownedDelta: `${dashboardSummary.recent_updates} recent`,
      convertedLabel: 'this month',
    },
  };
  const selectedPeriod = periodMeta[period];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: preferences.bottomNavStyle === 'pill' ? 110 : 88 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
    >
      <View style={{ paddingTop: 8, paddingBottom: 12 }}>
        <Text style={{ color: theme.textMute, fontSize: 12, fontWeight: '600' }}>
          {greeting()}, {profile?.first_name || 'there'}
        </Text>
        <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.7, marginTop: 4, lineHeight: 27 }}>
          You have <Text style={{ color: theme.accent }}>{untouched}</Text> new un-touched leads
        </Text>
        <Text style={{ color: theme.textDim, fontSize: 12.5, marginTop: 4, lineHeight: 18 }}>
          {dashboardSummary.today_followups} follow-ups today ·{' '}
          <Text style={{ color: theme.danger, fontWeight: '800' }}>
            {queue.filter((lead) => lead.is_overdue).length} overdue
          </Text>{' '}
          · {dashboardSummary.pending_followups} pending
        </Text>
      </View>

      {pendingSyncCount > 0 ? (
        <Card theme={theme} style={{ marginBottom: 14, backgroundColor: theme.warningSoft }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Signal size={18} color={theme.warning} />
            <Text style={{ flex: 1, color: theme.warning, fontSize: 13, fontWeight: '800' }}>
              {pendingSyncCount} update{pendingSyncCount === 1 ? '' : 's'} waiting to sync
            </Text>
            <TouchableOpacity onPress={() => loadDashboard(true)}>
              <RefreshCcw size={18} color={theme.warning} />
            </TouchableOpacity>
          </View>
        </Card>
      ) : null}

      {loadFailed ? (
        <Card theme={theme} style={{ marginBottom: 14, backgroundColor: theme.dangerSoft }}>
          <Text style={{ color: theme.danger, fontSize: 13, fontWeight: '800' }}>
            Some metrics could not be refreshed. Pull down to try again.
          </Text>
        </Card>
      ) : null}

      {showQueueHigh && nextLead ? (
        <Card theme={theme} elevated style={{ marginBottom: 14, backgroundColor: theme.accentSoft }}>
          <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '900', letterSpacing: 1.3 }}>NEXT BEST ACTION</Text>
          <Text style={{ color: theme.text, fontSize: 23, fontWeight: '900', marginTop: 8 }}>{nextLead.name}</Text>
          <Text style={{ color: theme.textDim, marginTop: 4 }}>{formatLeadSubtitle(nextLead) || nextLead.mobile_number || 'Ready to call'}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <PrimaryButton label="Call now" theme={theme} onPress={() => handleCall(nextLead)} icon={<Phone size={16} color={theme.onAccent} />} style={{ flex: 1 }} />
            <PrimaryButton label="Open" theme={theme} tone="soft" onPress={() => router.push(`/lead/${nextLead.lead_id}`)} icon={<ArrowRight size={16} color={theme.text} />} />
          </View>
        </Card>
      ) : null}

      {!showQueueHigh ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={{ color: theme.textMute, fontSize: 10.5, fontWeight: '900', letterSpacing: 1.3 }}>OVERVIEW</Text>
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: theme.surface,
              borderColor: theme.border,
              borderWidth: 1,
              borderRadius: 9,
              padding: 2,
              gap: 2,
            }}
          >
            {[
              ['today', 'Today'],
              ['week', 'Week'],
              ['month', 'Month'],
            ].map(([value, label]) => {
              const active = period === value;
              return (
                <TouchableOpacity
                  key={value}
                  onPress={() => setPeriod(value as PeriodKey)}
                  style={{
                    height: 24,
                    paddingHorizontal: 10,
                    borderRadius: 7,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: active ? theme.accent : 'transparent',
                  }}
                >
                  <Text style={{ color: active ? theme.onAccent : theme.textDim, fontSize: 11, fontWeight: '800' }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      {!showQueueHigh ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <KpiCard label="Owned leads" value={selectedPeriod.owned} theme={theme} tone="info" detail={selectedPeriod.ownedDelta} />
          <KpiCard label="New leads · last 30m" value={untouched} theme={theme} tone="accent" detail="untouched" />
          <KpiCard label="Follow-up due today" value={dashboardSummary.today_followups} theme={theme} tone="warning" detail={`${queue.filter((lead) => lead.is_overdue).length} overdue`} />
          <KpiCard label="Converted" value={0} theme={theme} tone="success" detail={selectedPeriod.convertedLabel} />
        </View>
      ) : (
        <Card theme={theme} elevated style={{ marginBottom: 14 }}>
          <SectionTitle title="Overview" theme={theme} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <KpiCard label="Owned leads" value={dashboardSummary.owned_lead_count} theme={theme} tone="accent" />
          <KpiCard label="Pending" value={dashboardSummary.pending_followups} theme={theme} tone="warning" />
          <KpiCard label="Due today" value={dashboardSummary.today_followups} theme={theme} tone="info" />
          <KpiCard label="Recent" value={dashboardSummary.recent_updates} theme={theme} tone="success" detail="last 24h" />
        </View>
        </Card>
      )}

      {showTeam ? (
        <Card theme={theme} style={{ marginBottom: 14 }}>
          <SectionTitle title="Team pulse" theme={theme} action={<Users size={18} color={theme.textMute} />} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <KpiCard label="Members" value={teamSummary.team_member_count} theme={theme} tone="muted" />
            <KpiCard label="Team leads" value={teamSummary.owned_lead_count} theme={theme} tone="accent" />
            <KpiCard label="Pending" value={teamSummary.pending_followups} theme={theme} tone="warning" />
            <KpiCard label="Today" value={teamSummary.today_followups} theme={theme} tone="info" />
          </View>
        </Card>
      ) : null}

      <Card theme={theme} style={{ marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[
            ['Next lead', nextLead ? () => router.push(`/lead/${nextLead.lead_id}`) : () => router.push('/(tabs)/leads'), true],
            ['Leads', () => router.push('/(tabs)/leads'), false],
            ['Follow-up', () => router.push('/(tabs)/followups'), false],
            ['Recent', () => router.push('/(tabs)/leads'), false],
          ].map(([label, onPress, accent]) => (
            <TouchableOpacity
              key={String(label)}
              onPress={onPress as () => void}
              style={{
                flex: 1,
                minHeight: 70,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: accent ? theme.accentRing : theme.border,
                backgroundColor: accent ? theme.accentSoft : theme.surface2,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
              }}
            >
              <Text style={{ color: accent ? theme.accent : theme.text, fontSize: 11, fontWeight: '900', textAlign: 'center' }}>
                {String(label)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      <Card theme={theme} style={{ marginBottom: 14 }}>
        <SectionTitle
          title="Needs attention"
          theme={theme}
          action={
            <TouchableOpacity onPress={() => router.push('/(tabs)/followups')}>
              <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '900' }}>See all</Text>
            </TouchableOpacity>
          }
        />
        {actionNeededLeads.length > 0 ? (
          actionNeededLeads.map((lead) => (
            <LeadMiniCard
              key={lead.lead_id}
              lead={lead}
              theme={theme}
              onPress={() => router.push(`/lead/${lead.lead_id}`)}
            />
          ))
        ) : (
          <EmptyState title="No urgent actions" body="You are caught up for now." theme={theme} />
        )}
      </Card>

      {!showQueueHigh && nextLead ? (
        <Card theme={theme} style={{ backgroundColor: theme.accentSoft }}>
          <SectionTitle title="Resume calling" theme={theme} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name={nextLead.name} theme={theme} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900' }}>{nextLead.name}</Text>
              <Text style={{ color: theme.textDim, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                {formatLeadSubtitle(nextLead) || nextLead.mobile_number || 'Ready to call now'}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <PrimaryButton label="Call" theme={theme} onPress={() => handleCall(nextLead)} icon={<Phone size={16} color={theme.onAccent} />} style={{ flex: 1 }} />
            <PrimaryButton label="Open" theme={theme} tone="soft" onPress={() => router.push(`/lead/${nextLead.lead_id}`)} style={{ flex: 1 }} />
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}
