import React from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type { MobileTheme } from '../contexts/MobilePreferencesContext';

export function initialsFromName(name?: string | null) {
  const clean = (name || '?').trim();
  return clean
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
}

export function ToneDot({ color, size = 7 }: { color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
      }}
    />
  );
}

export function Avatar({
  name,
  size = 42,
  theme,
}: {
  name?: string | null;
  size?: number;
  theme: MobileTheme;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.accentSoft,
        borderWidth: 1,
        borderColor: theme.accentRing,
      }}
    >
      <Text style={{ color: theme.accent, fontWeight: '800', fontSize: size * 0.35 }}>
        {initialsFromName(name)}
      </Text>
    </View>
  );
}

export function Card({
  children,
  theme,
  style,
  elevated = false,
}: {
  children: React.ReactNode;
  theme: MobileTheme;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderWidth: 1,
          borderRadius: 14,
          padding: 14,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: elevated ? 18 : 8 },
          shadowOpacity: elevated ? 0.24 : 0.12,
          shadowRadius: elevated ? 28 : 16,
          elevation: elevated ? 8 : 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({
  title,
  action,
  theme,
}: {
  title: string;
  action?: React.ReactNode;
  theme: MobileTheme;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 }}>
        {title}
      </Text>
      {action}
    </View>
  );
}

export function Pill({
  label,
  theme,
  active = false,
  tone,
  onPress,
  style,
}: {
  label: string;
  theme: MobileTheme;
  active?: boolean;
  tone?: 'accent' | 'success' | 'danger' | 'warning' | 'info' | 'muted';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const color =
    tone === 'success'
      ? theme.success
      : tone === 'danger'
        ? theme.danger
        : tone === 'warning'
          ? theme.warning
          : tone === 'info'
            ? theme.info
            : tone === 'muted'
              ? theme.textDim
              : theme.accent;

  const bg =
    active || !tone
      ? theme.accentSoft
      : tone === 'success'
        ? theme.successSoft
        : tone === 'danger'
          ? theme.dangerSoft
          : tone === 'warning'
            ? theme.warningSoft
            : tone === 'info'
              ? theme.infoSoft
              : theme.surface2;

  const content = (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: 6,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: active ? theme.accent : bg,
          borderWidth: 1,
          borderColor: active ? theme.accent : theme.border,
        },
        style,
      ]}
    >
      <Text style={{ color: active ? theme.onAccent : color, fontSize: 12, fontWeight: '800' }}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) return content;
  return <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>;
}

export function PrimaryButton({
  label,
  theme,
  onPress,
  disabled,
  tone = 'accent',
  icon,
  style,
}: {
  label: string;
  theme: MobileTheme;
  onPress?: () => void;
  disabled?: boolean;
  tone?: 'accent' | 'dark' | 'soft' | 'danger' | 'success';
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const backgroundColor =
    tone === 'dark'
      ? theme.surface3
      : tone === 'soft'
        ? theme.surface2
        : tone === 'danger'
          ? theme.danger
          : tone === 'success'
            ? theme.success
            : theme.accent;
  const color = tone === 'soft' ? theme.text : theme.onAccent;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          minHeight: 50,
          borderRadius: 16,
          paddingHorizontal: 16,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          backgroundColor,
          opacity: disabled ? 0.55 : 1,
        },
        style,
      ]}
    >
      {icon}
      <Text style={{ color, fontSize: 14, fontWeight: '800' }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function KpiCard({
  label,
  value,
  theme,
  tone = 'accent',
  detail,
  style,
}: {
  label: string;
  value: string | number;
  theme: MobileTheme;
  tone?: 'accent' | 'success' | 'danger' | 'warning' | 'info' | 'muted';
  detail?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const color =
    tone === 'success'
      ? theme.success
      : tone === 'danger'
        ? theme.danger
        : tone === 'warning'
          ? theme.warning
          : tone === 'info'
            ? theme.info
            : tone === 'muted'
              ? theme.textDim
              : theme.accent;

  return (
    <View
      style={[
        {
          flex: 1,
          minWidth: '47%',
          borderRadius: 12,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 12,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <ToneDot color={color} />
        <Text style={{ color: theme.textMute, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          {label}
        </Text>
      </View>
      <Text style={{ color: theme.text, fontSize: 26, fontWeight: '800', marginTop: 8, letterSpacing: -0.6 }}>
        {value}
      </Text>
      {detail ? <Text style={{ color: theme.textDim, fontSize: 12, marginTop: 3 }}>{detail}</Text> : null}
    </View>
  );
}

export function LoadingState({ theme, label = 'Loading...' }: { theme: MobileTheme; label?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
      <ActivityIndicator size="large" color={theme.accent} />
      <Text style={{ marginTop: 12, color: theme.textDim, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  body,
  theme,
}: {
  title: string;
  body: string;
  theme: MobileTheme;
}) {
  return (
    <Card theme={theme} style={{ alignItems: 'center', paddingVertical: 32 }}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: theme.surface2,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
        }}
      >
        <Text style={{ color: theme.textMute, fontSize: 24, fontWeight: '900' }}>!</Text>
      </View>
      <Text style={{ color: theme.text, fontSize: 17, fontWeight: '900', textAlign: 'center' }}>{title}</Text>
      <Text style={{ color: theme.textDim, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 }}>
        {body}
      </Text>
    </Card>
  );
}

export function keyValueTextStyle(theme: MobileTheme): { label: TextStyle; value: TextStyle } {
  return {
    label: { width: 118, color: theme.textMute, fontSize: 12, fontWeight: '700' },
    value: { flex: 1, color: theme.text, fontSize: 13, fontWeight: '700' },
  };
}
