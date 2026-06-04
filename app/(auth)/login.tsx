import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, EyeOff } from '../../mobile/components/icons';
import { PrimaryButton } from '../../mobile/components/design';
import { useAuth } from '../../mobile/contexts/AuthContext';
import { useMobilePreferences } from '../../mobile/contexts/MobilePreferencesContext';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { theme } = useMobilePreferences();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing details', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Login failed', error.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: theme.bg }}
    >
      <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: 58, paddingBottom: 24, overflow: 'hidden' }}>
        <View
          style={{
            position: 'absolute',
            top: -90,
            alignSelf: 'center',
            width: 320,
            height: 320,
            borderRadius: 160,
            backgroundColor: theme.accentSoft,
          }}
        />

        <View style={{ alignItems: 'center', marginTop: 28, marginBottom: 48 }}>
          <Text style={{ color: theme.accent, fontSize: 36, fontWeight: '900', letterSpacing: -1.4 }}>
            degreebaba
          </Text>
          <Text style={{ marginTop: 14, color: theme.textMute, fontSize: 12, fontWeight: '800', letterSpacing: 2 }}>
            SALES CRM
          </Text>
        </View>

        <View>
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }}>
            Welcome back
          </Text>
          <Text style={{ color: theme.textDim, fontSize: 13, marginTop: 5, marginBottom: 24 }}>
            Sign in to your account
          </Text>

          <Text style={{ color: theme.textDim, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>Email</Text>
          <TextInput
            style={{
              height: 52,
              borderRadius: 12,
              paddingHorizontal: 16,
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.border,
              color: theme.text,
              fontSize: 15,
              marginBottom: 14,
            }}
            placeholder="your@email.com"
            placeholderTextColor={theme.textMute}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />

          <Text style={{ color: theme.textDim, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>Password</Text>
          <View style={{ position: 'relative' }}>
            <TextInput
              style={{
                height: 52,
                borderRadius: 12,
                paddingLeft: 16,
                paddingRight: 52,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.border,
                color: theme.text,
                fontSize: 15,
                marginBottom: 10,
              }}
              placeholder="Enter your password"
              placeholderTextColor={theme.textMute}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!loading}
            />
            <Pressable
              onPress={() => setShowPassword((value) => !value)}
              style={{ position: 'absolute', right: 10, top: 10, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
            >
              {showPassword ? <EyeOff size={16} color={theme.textDim} /> : <Eye size={16} color={theme.textDim} />}
            </Pressable>
          </View>

          <TouchableOpacity style={{ alignItems: 'flex-end', marginBottom: 18 }} onPress={() => {}}>
            <Text style={{ color: theme.accent, fontSize: 12.5, fontWeight: '800' }}>
              Forgot password?
            </Text>
          </TouchableOpacity>

          <PrimaryButton
            label={loading ? 'Signing in...' : 'Sign in'}
            theme={theme}
            onPress={handleLogin}
            disabled={loading}
            style={{ minHeight: 56, borderRadius: 14 }}
          />

          <Text style={{ color: theme.textMute, textAlign: 'center', fontSize: 11, fontWeight: '700', marginTop: 14 }}>
            v2.4.1 · Secure login
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
