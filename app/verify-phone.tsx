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

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async () => {
    if (!phone || phone.replace(/\D/g, '').length < 8) {
      setError('Введіть коректний номер у форматі +1...');
      return;
    }
    setSending(true);
    setError('');
    try {
      const res = await api.sendPhoneCode({ phone });
      if (res?.sent) {
        setSent(true);
        setCooldown(60);
        Alert.alert('Надіслано', 'Код підтвердження надіслано у SMS');
      } else {
        // HTTP 200 but Twilio did not deliver — surface the real reason
        setError(res?.error || 'Не вдалося надіслати SMS. Спробуйте пізніше.');
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.response?.data?.error || 'Помилка';
      if (String(detail).includes('60')) { setSent(true); setCooldown(60); }
      setError(detail);
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    if (code.length !== 6) {
      setError('Введіть 6-значний код');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.verifyPhone({ code });
      if (user) setUser({ ...user, phone, phone_verified: true } as any);
      Alert.alert('Готово!', 'Номер телефону підтверджено.');
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Помилка');
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
        <Text style={s.title}>Підтвердіть телефон</Text>
      </View>
      <View style={s.body}>
        <View style={s.iconCircle}>
          <Ionicons name="chatbubble-ellipses-outline" size={48} color="#2563eb" />
        </View>
        {!sent ? (
          <>
            <Text style={s.h1}>Номер телефону</Text>
            <Text style={s.subtitle}>Ми надішлемо 6-значний код у SMS</Text>
            <TextInput
              style={s.phoneInput}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+1 555 123 4567"
              placeholderTextColor="#d1d5db"
              data-testid="phone-input"
            />
            {!!error && <Text style={s.error}>{error}</Text>}
            <TouchableOpacity
              style={[s.btn, sending && s.btnDisabled]}
              onPress={sendCode}
              disabled={sending}
              data-testid="send-phone-code-btn"
            >
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Надіслати код</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.h1}>Введіть код</Text>
            <Text style={s.subtitle}>
              Код надіслано на{'\n'}
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
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Підтвердити</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={sendCode} disabled={sending || cooldown > 0} data-testid="resend-phone-code-btn">
              <Text style={s.resend}>
                {cooldown > 0 ? `Надіслати знов через ${cooldown}с` : sending ? 'Надсилаю…' : 'Не отримали код? Надіслати знов'}
              </Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={{ marginTop: 20 }} data-testid="skip-phone-verify-btn">
          <Text style={s.skip}>Пропустити поки що</Text>
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
  btn: { width: '100%', maxWidth: 320, height: 50, backgroundColor: '#2563eb', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  btnDisabled: { backgroundColor: '#9ca3af' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resend: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
  skip: { fontSize: 14, color: '#9ca3af', fontWeight: '500' },
});
