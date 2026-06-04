import { Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useMobilePreferences } from '../mobile/contexts/MobilePreferencesContext';

export default function NotFoundScreen() {
  const { theme } = useMobilePreferences();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg, padding: 24 }}>
      <View
        style={{
          width: 58,
          height: 58,
          borderRadius: 29,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.border,
          marginBottom: 14,
        }}
      >
        <Text style={{ color: theme.accent, fontSize: 24, fontWeight: '900' }}>?</Text>
      </View>
      <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800', marginBottom: 6 }}>Screen not found</Text>
      <Text style={{ color: theme.textDim, fontSize: 13, textAlign: 'center', marginBottom: 18 }}>
        This CRM mobile screen is not available.
      </Text>
      <Link href="/(tabs)" style={{ color: theme.accent, fontSize: 13, fontWeight: '800' }}>
        Go to Home
      </Link>
    </View>
  );
}
