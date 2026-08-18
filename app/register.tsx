import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';
import { showAlert } from '../utils/alert';
import Head from 'expo-router/head';

export default function Register() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { setUser, setToken } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'client' | 'provider'>('client');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedProviderAgreement, setAcceptedProviderAgreement] = useState(false);
  const [referralCode, setReferralCode] = useState(() => {
    if (typeof params?.ref === 'string' && params.ref) return (params.ref as string).toUpperCase();
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return (window.localStorage.getItem('ono_ref') || '').toUpperCase();
      }
    } catch {}
    return '';
  });

  const handleRegister = async () => {
    if (!email || !password || !name) {
      setErrorMsg('Fill in all required fields');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters');
      return;
    }
    if (!acceptedTerms) {
      setErrorMsg('Please agree to the Terms of Use and Privacy Policy');
      return;
    }
    if (role === 'provider' && !acceptedProviderAgreement) {
      setErrorMsg('Please review and agree to the Service Provider Agreement');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    try {
      const response = await api.register({ email, password, name, phone, role, accepted_terms: true, accepted_provider_agreement: role === 'provider' ? acceptedProviderAgreement : undefined, referral_code: referralCode || undefined } as any);
      await setToken(response.session_token);
      setUser(response.user);
      // Email verification is NOT required — send the user straight into the app.
      // A reminder banner appears on the home screen and in the profile until verified.
      router.replace('/(tabs)' as any);
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      let msg = (typeof detail === 'string' && detail) || error.message || 'Registration error';
      const lower = String(msg).toLowerCase();
      if (lower.includes('already registered')) {
        msg = 'This email is already registered. Try logging in or use a different email.';
      } else if (error.message && (error.message.includes('Network') || error.message.includes('fetch'))) {
        msg = 'Could not connect to the server.';
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Head>
        <title>Sign Up — Ono-Fix</title>
        <meta name="description" content="Create your free Ono-Fix account. Snap a photo, get matched with vetted local pros, and book home services in minutes." />
        <link rel="canonical" href="https://ono-fix.com/register" />
      </Head>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join Ono-Fix today</Text>
        </View>
        <View style={styles.form}>
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="Full Name" value={name} onChangeText={setName} autoCapitalize="words" />
          </View>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          </View>
          <View style={styles.inputContainer}>
            <Ionicons name="call-outline" size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </View>
          <View style={styles.inputContainer}>
            <Ionicons name="gift-outline" size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="Referral code (optional)" value={referralCode} onChangeText={(t) => setReferralCode(t.toUpperCase())} autoCapitalize="characters" autoCorrect={false} data-testid="register-referral-input" />
          </View>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="Password (min 6 characters)" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <View style={styles.roleContainer}>
            <Text style={styles.roleLabel}>I want to:</Text>
            <View style={styles.roleButtons}>
              <TouchableOpacity style={[styles.roleButton, role === 'client' && styles.roleButtonActive]} onPress={() => setRole('client')}>
                <Ionicons name="person" size={24} color={role === 'client' ? '#2563eb' : '#6b7280'} />
                <Text style={[styles.roleButtonText, role === 'client' && styles.roleButtonTextActive]}>Book Services</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.roleButton, role === 'provider' && styles.roleButtonActive]} onPress={() => setRole('provider')}>
                <Ionicons name="hammer" size={24} color={role === 'provider' ? '#2563eb' : '#6b7280'} />
                <Text style={[styles.roleButtonText, role === 'provider' && styles.roleButtonTextActive]}>Provide Services</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity
            style={termsStyles.row}
            onPress={() => setAcceptedTerms(v => !v)}
            data-testid="accept-terms-checkbox"
          >
            <View style={[termsStyles.box, acceptedTerms && termsStyles.boxActive]}>
              {acceptedTerms && <Ionicons name="checkmark" size={16} color="#fff" />}
            </View>
            <Text style={termsStyles.text}>
              I agree to the{' '}
              <Text style={termsStyles.link} onPress={() => router.push('/terms' as any)}>
                Terms of Use
              </Text>
              {' '}and{' '}
              <Text style={termsStyles.link} onPress={() => router.push('/privacy' as any)}>
                Privacy Policy
              </Text>
              . I understand that all payments and communications must be conducted through the Ono-Fix platform.
            </Text>
          </TouchableOpacity>

          {role === 'provider' && (
            <TouchableOpacity
              style={[termsStyles.row, termsStyles.providerRow]}
              onPress={() => setAcceptedProviderAgreement(v => !v)}
              data-testid="accept-provider-agreement-checkbox"
            >
              <View style={[termsStyles.box, acceptedProviderAgreement && termsStyles.boxActive]}>
                {acceptedProviderAgreement && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              <Text style={termsStyles.text}>
                I have read and agree to the{' '}
                <Text style={termsStyles.link} onPress={() => router.push('/provider-agreement' as any)} data-testid="provider-agreement-link">
                  Service Provider Agreement
                </Text>
                . I understand that I am an independent contractor (not an employee of Ono-Fix) and that I am responsible for my own licenses, permits, insurance, taxes, safety, and workmanship.
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Account</Text>}
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
            <Text style={{ marginHorizontal: 12, fontSize: 12, color: '#9ca3af' }}>or</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
          </View>

          <TouchableOpacity
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
              backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#d1d5db',
              paddingVertical: 12, borderRadius: 12,
            }}
            onPress={() => {
              if (!acceptedTerms) {
                setErrorMsg('Please accept the Terms & Privacy Policy first');
                showAlert(
                  'One more step',
                  'Please check "I agree to the Terms of Use and Privacy Policy" above before continuing with Google.'
                );
                return;
              }
              if (role === 'provider' && !acceptedProviderAgreement) {
                setErrorMsg('Please agree to the Service Provider Agreement first');
                showAlert(
                  'One more step',
                  'As a service provider, please review and agree to the Service Provider Agreement above before continuing with Google.'
                );
                return;
              }
              if (typeof window !== 'undefined') {
                const redirectUrl = window.location.origin + '/auth-callback';
                window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
              }
            }}
            data-testid="google-signup-btn"
          >
            <Ionicons name="logo-google" size={20} color="#ea4335" />
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>Sign up with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={styles.linkContainer}>
            <Text style={styles.linkText}>Already have an account? <Text style={styles.link}>Login</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { flexGrow: 1, padding: 24, paddingTop: 60 },
  backButton: { marginBottom: 24 },
  header: { marginBottom: 32 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#111827' },
  subtitle: { fontSize: 16, color: '#6b7280', marginTop: 8 },
  form: { width: '100%' },
  errorBox: { backgroundColor: '#fee2e2', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { color: '#dc2626', fontSize: 14, textAlign: 'center' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, marginBottom: 16, paddingHorizontal: 16, backgroundColor: '#f9fafb' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: 56, fontSize: 16, color: '#111827' },
  eyeIcon: { padding: 8 },
  roleContainer: { marginBottom: 24 },
  roleLabel: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 },
  roleButtons: { flexDirection: 'row', gap: 12 },
  roleButton: { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 12, padding: 16, backgroundColor: '#f9fafb' },
  roleButtonActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  roleButtonText: { fontSize: 14, color: '#6b7280', marginTop: 8 },
  roleButtonTextActive: { color: '#2563eb', fontWeight: '600' },
  button: { backgroundColor: '#2563eb', borderRadius: 12, height: 56, justifyContent: 'center', alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  linkContainer: { marginTop: 24, alignItems: 'center' },
  linkText: { fontSize: 14, color: '#6b7280' },
  link: { color: '#2563eb', fontWeight: '600' },
});

const termsStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, paddingHorizontal: 4, marginBottom: 8 },
  providerRow: { backgroundColor: '#eff6ff', borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe', paddingHorizontal: 12 },
  box: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#9ca3af',
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  boxActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  text: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 },
  link: { color: '#2563eb', fontWeight: '600', textDecorationLine: 'underline' },
});
