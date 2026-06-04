import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type MobileThemeKey = 'dark-orange' | 'navy-orange' | 'dark-green';
export type DashboardLayoutKey = 'summary' | 'hybrid' | 'queue';
export type LeadCardDensityKey = 'comfortable' | 'compact';
export type BottomNavStyleKey = 'labels' | 'icons' | 'pill';

export type MobilePreferences = {
  theme: MobileThemeKey;
  dashboardLayout: DashboardLayoutKey;
  leadCardDensity: LeadCardDensityKey;
  bottomNavStyle: BottomNavStyleKey;
};

export type MobileTheme = {
  key: MobileThemeKey;
  name: string;
  bg: string;
  bgSoft: string;
  surface: string;
  surface2: string;
  surface3: string;
  border: string;
  borderSoft: string;
  text: string;
  textDim: string;
  textMute: string;
  accent: string;
  accentSoft: string;
  accentRing: string;
  onAccent: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  tabBar: string;
};

const STORAGE_KEY = 'crm_mobile_preferences_v1';

export const DEFAULT_MOBILE_PREFERENCES: MobilePreferences = {
  theme: 'dark-orange',
  dashboardLayout: 'hybrid',
  leadCardDensity: 'comfortable',
  bottomNavStyle: 'labels',
};

export const MOBILE_THEMES: Record<MobileThemeKey, MobileTheme> = {
  'dark-orange': {
    key: 'dark-orange',
    name: 'Dark + Orange',
    bg: '#0e0e10',
    bgSoft: '#0e0e10',
    surface: '#17171a',
    surface2: '#1f1f23',
    surface3: '#25252a',
    border: '#2a2a2f',
    borderSoft: '#202024',
    text: '#f5f5f7',
    textDim: '#a3a3a8',
    textMute: '#6b6b70',
    accent: '#F26A1F',
    accentSoft: 'rgba(242,106,31,0.14)',
    accentRing: 'rgba(242,106,31,0.35)',
    onAccent: '#ffffff',
    success: '#3ECF8E',
    successSoft: 'rgba(62,207,142,0.14)',
    danger: '#F05252',
    dangerSoft: 'rgba(240,82,82,0.14)',
    warning: '#FFB020',
    warningSoft: 'rgba(255,176,32,0.14)',
    info: '#5B8CFF',
    infoSoft: 'rgba(91,140,255,0.14)',
    tabBar: '#17171a',
  },
  'navy-orange': {
    key: 'navy-orange',
    name: 'Navy + Orange',
    bg: '#f5f7fb',
    bgSoft: '#ffffff',
    surface: '#ffffff',
    surface2: '#f0f2f7',
    surface3: '#e3e6ee',
    border: '#e3e6ee',
    borderSoft: '#eef0f5',
    text: '#0b1a3a',
    textDim: '#4a5578',
    textMute: '#8a93ac',
    accent: '#F26A1F',
    accentSoft: 'rgba(242,106,31,0.12)',
    accentRing: 'rgba(242,106,31,0.30)',
    onAccent: '#ffffff',
    success: '#12A373',
    successSoft: 'rgba(18,163,115,0.12)',
    danger: '#D93025',
    dangerSoft: 'rgba(217,48,37,0.12)',
    warning: '#C8860D',
    warningSoft: 'rgba(200,134,13,0.12)',
    info: '#3B5BDB',
    infoSoft: 'rgba(59,91,219,0.12)',
    tabBar: '#ffffff',
  },
  'dark-green': {
    key: 'dark-green',
    name: 'Dark + Green',
    bg: '#0b0c0b',
    bgSoft: '#0b0c0b',
    surface: '#151716',
    surface2: '#1d1f1d',
    surface3: '#272a28',
    border: '#272a28',
    borderSoft: '#1f2220',
    text: '#f5f5f3',
    textDim: '#a4a8a3',
    textMute: '#6c706b',
    accent: '#4ADE80',
    accentSoft: 'rgba(74,222,128,0.12)',
    accentRing: 'rgba(74,222,128,0.30)',
    onAccent: '#062011',
    success: '#4ADE80',
    successSoft: 'rgba(74,222,128,0.14)',
    danger: '#F05252',
    dangerSoft: 'rgba(240,82,82,0.14)',
    warning: '#FFB020',
    warningSoft: 'rgba(255,176,32,0.14)',
    info: '#5B8CFF',
    infoSoft: 'rgba(91,140,255,0.14)',
    tabBar: '#151716',
  },
};

type MobilePreferencesContextValue = {
  preferences: MobilePreferences;
  theme: MobileTheme;
  setPreference: <K extends keyof MobilePreferences>(key: K, value: MobilePreferences[K]) => void;
  resetPreferences: () => void;
};

const MobilePreferencesContext = createContext<MobilePreferencesContextValue | null>(null);

export function MobilePreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<MobilePreferences>(DEFAULT_MOBILE_PREFERENCES);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        setPreferences({
          ...DEFAULT_MOBILE_PREFERENCES,
          ...parsed,
        });
      })
      .catch(() => {});
  }, []);

  const persist = (next: MobilePreferences) => {
    setPreferences(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const value = useMemo<MobilePreferencesContextValue>(() => {
    const theme = MOBILE_THEMES[preferences.theme] || MOBILE_THEMES['dark-orange'];
    return {
      preferences,
      theme,
      setPreference: (key, prefValue) => {
        persist({ ...preferences, [key]: prefValue });
      },
      resetPreferences: () => persist(DEFAULT_MOBILE_PREFERENCES),
    };
  }, [preferences]);

  return (
    <MobilePreferencesContext.Provider value={value}>
      {children}
    </MobilePreferencesContext.Provider>
  );
}

export function useMobilePreferences() {
  const context = useContext(MobilePreferencesContext);
  if (!context) {
    throw new Error('useMobilePreferences must be used within MobilePreferencesProvider');
  }
  return context;
}
