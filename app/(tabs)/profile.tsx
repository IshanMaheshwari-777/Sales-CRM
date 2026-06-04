import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Building2, LogOut, Mail, Phone, Shield, User } from '../../mobile/components/icons';
import { Avatar, Card, PrimaryButton } from '../../mobile/components/design';
import { useAuth } from '../../mobile/contexts/AuthContext';
import {
  type MobileThemeKey,
  useMobilePreferences,
} from '../../mobile/contexts/MobilePreferencesContext';
import { getDashboardSummary } from '../../mobile/lib/leadQueue';
import type { MobileDashboardSummary } from '../../mobile/lib/types';

type PeriodKey = 'today' | 'week' | 'month';

export default function ProfileScreen() {
  const { user, profile, signOut } = useAuth();
  const { preferences, setPreference, theme } = useMobilePreferences();
  const router = useRouter();
  const [period, setPeriod] = useState<PeriodKey>('week');
  const [summary, setSummary] = useState<MobileDashboardSummary | null>(null);

  useEffect(() => {
    if (!profile?.organization_id || !user?.id) return;
    getDashboardSummary(profile.organization_id, user.id)
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [profile?.organization_id, user?.id]);

  const handleSignOut = async () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const InfoRow = ({ icon: Icon, label, value }: any) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: theme.borderSoft }}>
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.surface2,
          marginRight: 12,
        }}
      >
        <Icon size={18} color={theme.textDim} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.textMute, fontSize: 11, fontWeight: '800' }}>{label}</Text>
        <Text style={{ color: theme.text, fontSize: 14, fontWeight: '800', marginTop: 2 }}>{value || 'Not set'}</Text>
      </View>
    </View>
  );

  const StatCard = ({
    label,
    value,
    tone = theme.text,
    half = false,
  }: {
    label: string;
    value: string | number;
    tone?: string;
    half?: boolean;
  }) => (
    <View
      style={{
        flex: half ? 1 : undefined,
        width: half ? undefined : '31.8%',
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 12,
        padding: half ? 12 : 10,
      }}
    >
      <Text style={{ color: theme.textMute, fontSize: half ? 10 : 9.5, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text style={{ color: tone, fontSize: half ? 26 : 18, fontWeight: '800', marginTop: 7, letterSpacing: -0.6 }}>
        {value}
      </Text>
    </View>
  );

  const periodPending = summary?.pending_followups ?? 0;
  const periodRecent = summary?.recent_updates ?? 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: preferences.bottomNavStyle === 'pill' ? 112 : 88 }}
    >
      <View style={{ paddingTop: 6, paddingBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar name={profile?.full_name || user?.email} theme={theme} size={64} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }} numberOfLines={1}>
            {profile?.full_name || 'User Profile'}
          </Text>
          <Text style={{ color: theme.textDim, fontSize: 12.5, marginTop: 3 }} numberOfLines={1}>
            {profile?.role_name || 'User'} · {profile?.organization_name || 'Organization'}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ color: theme.textMute, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 }}>YOUR STATS</Text>
        <View style={{ flexDirection: 'row', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 3, gap: 2 }}>
          {(['today', 'week', 'month'] as PeriodKey[]).map((item) => {
            const active = period === item;
            return (
              <TouchableOpacity
                key={item}
                onPress={() => setPeriod(item)}
                style={{ height: 26, paddingHorizontal: 10, borderRadius: 7, backgroundColor: active ? theme.accent : 'transparent', justifyContent: 'center' }}
              >
                <Text style={{ color: active ? theme.onAccent : theme.textDim, fontSize: 11, fontWeight: '800' }}>
                  {item === 'today' ? 'Today' : item === 'week' ? 'Week' : 'Month'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 8, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <StatCard label="Dialled calls" value={periodRecent || '0'} tone={theme.info} half />
          <StatCard label="Connected calls" value="-" tone={theme.success} half />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <StatCard label="Converted" value="0" tone={theme.success} />
          <StatCard label="Pending" value={periodPending} tone={theme.warning} />
          <StatCard label="Avg" value={period === 'today' ? '0/hr' : '0/day'} />
        </View>
      </View>

      <Text style={{ color: theme.textMute, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8 }}>APPEARANCE</Text>
      <Card theme={theme} style={{ marginBottom: 16 }}>
        <Text style={{ color: theme.text, fontSize: 13.5, fontWeight: '800' }}>Theme</Text>
        <Text style={{ color: theme.textDim, fontSize: 11.5, marginTop: 2, marginBottom: 12 }}>Switch between light and dark mode</Text>
        <View style={{ flexDirection: 'row', backgroundColor: theme.surface2, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 3, gap: 2, marginBottom: 16 }}>
          {[
            { value: 'navy-orange' as MobileThemeKey, label: 'Light', desc: 'Navy + Orange' },
            { value: 'dark-orange' as MobileThemeKey, label: 'Dark', desc: 'Charcoal + Orange' },
          ].map((option) => {
            const active = preferences.theme === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => setPreference('theme', option.value)}
                style={{ flex: 1, height: 52, borderRadius: 8, backgroundColor: active ? theme.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: active ? theme.onAccent : theme.text, fontSize: 13, fontWeight: '800' }}>{option.label}</Text>
                <Text style={{ color: active ? theme.onAccent : theme.textDim, opacity: 0.75, fontSize: 10, fontWeight: '700', marginTop: 2 }}>{option.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      <Text style={{ color: theme.textMute, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8 }}>ACCOUNT</Text>
      <Card theme={theme} style={{ marginBottom: 16, paddingVertical: 0 }}>
        <InfoRow icon={Mail} label="Email" value={user?.email} />
        <InfoRow icon={Phone} label="Mobile" value={profile?.mobile_number} />
        <InfoRow icon={User} label="User ID" value={user?.id} />
        <InfoRow icon={Shield} label="Role" value={profile?.role_name || 'User'} />
        <InfoRow icon={Building2} label="Organization" value={profile?.organization_name} />
      </Card>

      <PrimaryButton
        label="Sign out"
        theme={theme}
        tone="danger"
        onPress={handleSignOut}
        icon={<LogOut size={18} color={theme.onAccent} />}
        style={{ marginBottom: 16 }}
      />

      <Text style={{ color: theme.textMute, textAlign: 'center', fontSize: 12, fontWeight: '700' }}>
        degreebaba CRM · v2.4.1
      </Text>
    </ScrollView>
  );
}
