import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../global.css';
import { AuthProvider, useAuth } from '../mobile/contexts/AuthContext'
import { MobilePreferencesProvider } from '../mobile/contexts/MobilePreferencesContext';
import { useFrameworkReady } from '../hooks/useFrameworkReady';

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    if (isWeb) return;
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isWeb, user, loading, segments]);

  return <Slot />;
}

export default function RootLayout() {
  useFrameworkReady();
  return (
    <SafeAreaProvider>
      <MobilePreferencesProvider>
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </MobilePreferencesProvider>
    </SafeAreaProvider>
  );
}
