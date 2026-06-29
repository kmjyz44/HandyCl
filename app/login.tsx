import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';

export default function Login() {
  const router = useRouter();
  const { setUser, setToken } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMsg('Fill in all fields');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    try {
      const response = await api.login({ email: email.trim().toLowerCase(), password });
      await setToken(response.session_token);
      setUser(response.user);
      // Cache user data for offline/slow-server fallback
      try { localStorage.setItem('cached_user', JSON.stringify(response.user)); } catch {}
      // Route to home tab so a pending guest booking draft can auto-resume.
      const hasPendingBooking = typeof window !== 'undefined' && !!window.localStorage.getItem('pending_booking_draft');
      router.replace(hasPendingBooking ? '/(tabs)/' : '/(tabs)');
    } catch (error: any) {
      let msg = error.message || 'Login error';
      if (msg.includes('Invalid credentials')) msg = 'Invalid email or password.';
      if (msg.includes('Network') || msg.includes('fetch')) msg = 'Could not connect to the server.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Ionicons name="hammer" size={64} color="#2563eb" />
          <Text style={styles.title}>HandyHub</Text>
          <Text style={styles.subtitle}>Handyman & cleaning services</Text>
        </View>
        <View style={styles.form}>
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          </View>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log in</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/forgot-password')} style={styles.forgotContainer} data-testid="forgot-password-link">
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          {/* OAuth divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
            <Text style={{ marginHorizontal: 12, fontSize: 12, color: '#9ca3af' }}>or</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
          </View>

          {/* Google OAuth button */}
          <TouchableOpacity
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
              backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#d1d5db',
              paddingVertical: 12, borderRadius: 12,
            }}
            onPress={() => {
              // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
              if (typeof window !== 'undefined') {
                const redirectUrl = window.location.origin + '/auth-callback';
                window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
              }
            }}
            data-testid="google-login-btn"
          >
            <Ionicons name="logo-google" size={20} color="#ea4335" />
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>Sign in with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/register')} style={styles.linkContainer}>
            <Text style={styles.linkText}>Don't have an account? <Text style={styles.link}>Sign up</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 48 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#111827', marginTop: 16 },
  subtitle: { fontSize: 16, color: '#6b7280', marginTop: 8 },
  form: { width: '100%' },
  errorBox: { backgroundColor: '#fee2e2', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { color: '#dc2626', fontSize: 14, textAlign: 'center' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, marginBottom: 16, paddingHorizontal: 16, backgroundColor: '#f9fafb' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: 56, fontSize: 16, color: '#111827' },
  eyeIcon: { padding: 8 },
  button: { backgroundColor: '#2563eb', borderRadius: 12, height: 56, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  linkContainer: { marginTop: 24, alignItems: 'center' },
  forgotContainer: { marginTop: 14, alignItems: 'center' },
  forgotText: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
  linkText: { fontSize: 14, color: '#6b7280' },
  link: { color: '#2563eb', fontWeight: '600' },
});
