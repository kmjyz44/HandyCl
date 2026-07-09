import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';

export default function VerifyPhone() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const { phone: phoneParam } = useLocalSearchParams<{ phone?: string }>();
  const [phone, setPhone] = useState(phoneParam || user?.phone || '');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const [smsConsent, setSmsConsent] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async () => {
    if (!phone || phone.replace(/\D/g, '').length < 8) {
      setError('Enter a valid number in +1... format');
      return;
    }
    if (!smsConsent) {
      setError('Please agree to receive SMS messages to continue');
      return;
    }
    setSending(true);
    setError('');
    try {
      const res = await api.sendPhoneCode({ phone });
      if (res?.sent) {
        setSent(true);
        setCooldown(60);
        Alert.alert('Sent', 'A verification code was sent via SMS');
      } else {
        // HTTP 200 but Twilio did not deliver — surface the real reason
        setError(res?.error || 'Could not send SMS. Please try again later.');
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.response?.data?.error || 'Error';
      if (String(detail).includes('60')) { setSent(true); setCooldown(60); }
      setError(detail);
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    if (code.length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.verifyPhone({ code });
      if (user) setUser({ ...user, phone, phone_verified: true } as any);
      Alert.alert('Done!', 'Your phone number is verified.');
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container} data-testid="verify-phone-screen">
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={s.title}>Verify your phone</Text>
      </View>
      <View style={s.body}>
        <View style={s.iconCircle}>
          <Ionicons name="chatbubble-ellipses-outline" size={48} color="#2563eb" />
        </View>
        {!sent ? (
          <>
            <Text style={s.h1}>Phone Number</Text>
            <Text style={s.subtitle}>We'll send a 6-digit code via SMS</Text>
            <TextInput
              style={s.phoneInput}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+1 (___) ___-____"
              placeholderTextColor="#d1d5db"
              data-testid="phone-input"
            />
            {!!error && <Text style={s.error}>{error}</Text>}

            <View style={s.consentRow}>
              <TouchableOpacity
                onPress={() => setSmsConsent(v => !v)}
                activeOpacity={0.7}
                data-testid="sms-consent-checkbox"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={smsConsent ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={smsConsent ? '#2563eb' : '#9ca3af'}
                />
              </TouchableOpacity>
              <Text style={s.consentText}>
                <Text onPress={() => setSmsConsent(v => !v)}>
                  I agree to receive SMS messages from Ono-Fix for account verification, appointment updates, job notifications, and customer support. Message frequency varies. Message and data rates may apply. Reply STOP to opt out and HELP for help. I have read and agree to the{' '}
                </Text>
                <Text style={s.link} onPress={() => router.push('/privacy')}>Privacy Policy</Text>
                <Text onPress={() => setSmsConsent(v => !v)}> and </Text>
                <Text style={s.link} onPress={() => router.push('/terms')}>Terms of Service</Text>
                <Text onPress={() => setSmsConsent(v => !v)}>.</Text>
              </Text>
            </View>

            <View style={s.linksRow}>
              <Text style={s.link} onPress={() => router.push('/privacy')} data-testid="consent-privacy-link">Privacy Policy</Text>
              <Text style={s.linkSep}> | </Text>
              <Text style={s.link} onPress={() => router.push('/terms')} data-testid="consent-terms-link">Terms of Service</Text>
            </View>

            <TouchableOpacity
              style={[s.btn, (sending || !smsConsent) && s.btnDisabled]}
              onPress={sendCode}
              disabled={sending || !smsConsent}
              data-testid="send-phone-code-btn"
            >
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Send Verification Code</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.h1}>Enter the code</Text>
            <Text style={s.subtitle}>
              Code sent to{'\n'}
              <Text style={{ fontWeight: '700', color: '#111827' }}>{phone}</Text>
            </Text>
            <TextInput
              style={s.input}
              value={code}
              onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              placeholder="------"
              placeholderTextColor="#d1d5db"
              maxLength={6}
              autoFocus
              data-testid="verify-phone-code-input"
            />
            {!!error && <Text style={s.error}>{error}</Text>}
            <TouchableOpacity
              style={[s.btn, (loading || code.length !== 6) && s.btnDisabled]}
              onPress={verify}
              disabled={loading || code.length !== 6}
              data-testid="verify-phone-submit-btn"
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Confirm</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={sendCode} disabled={sending || cooldown > 0} data-testid="resend-phone-code-btn">
              <Text style={s.resend}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : sending ? 'Sending…' : "Didn't get the code? Resend"}
              </Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={{ marginTop: 20 }} data-testid="skip-phone-verify-btn">
          <Text style={s.skip}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  back: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  body: { flex: 1, padding: 24, alignItems: 'center' },
  iconCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginTop: 32, marginBottom: 24 },
  h1: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 32, lineHeight: 20 },
  phoneInput: { width: '100%', maxWidth: 320, height: 56, borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 16, fontSize: 18, color: '#111827', marginBottom: 12 },
  input: { width: '100%', maxWidth: 280, height: 64, borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 12, textAlign: 'center', fontSize: 28, fontWeight: '700', letterSpacing: 8, color: '#111827', marginBottom: 12 },
  error: { fontSize: 13, color: '#dc2626', marginBottom: 12 },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', width: '100%', maxWidth: 340, marginBottom: 12, paddingHorizontal: 4 },
  consentText: { flex: 1, marginLeft: 10, fontSize: 12, color: '#6b7280', lineHeight: 18 },
  link: { color: '#2563eb', fontWeight: '700', textDecorationLine: 'underline' },
  linksRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 340, marginBottom: 16 },
  linkSep: { fontSize: 12, color: '#9ca3af' },
  btn: { width: '100%', maxWidth: 320, height: 50, backgroundColor: '#2563eb', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  btnDisabled: { backgroundColor: '#9ca3af' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resend: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
  skip: { fontSize: 14, color: '#9ca3af', fontWeight: '500' },
});
