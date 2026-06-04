import { Tabs } from 'expo-router';
import { Bell, Home, User, Users } from '../../mobile/components/icons';
import { useMobilePreferences } from '../../mobile/contexts/MobilePreferencesContext';

export default function TabLayout() {
  const { preferences, theme } = useMobilePreferences();
  const showLabels = preferences.bottomNavStyle !== 'icons';
  const pill = preferences.bottomNavStyle === 'pill';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMute,
        headerShown: false,
        tabBarShowLabel: showLabels,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '800',
          marginTop: 2,
        },
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: showLabels ? 66 : 58,
          marginHorizontal: pill ? 16 : 0,
          marginBottom: pill ? 14 : 0,
          borderRadius: pill ? 24 : 0,
          position: pill ? 'absolute' : 'relative',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="leads"
        options={{
          title: 'Leads',
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="followups"
        options={{
          title: 'Follow-ups',
          tabBarIcon: ({ color, size }) => <Bell size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
