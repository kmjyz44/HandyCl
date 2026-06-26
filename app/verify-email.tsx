import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';

export default function VerifyEmail() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const [email] = useState(emailParam || user?.email || '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verify = async () => {
    if (code.length !== 6) {
      setError('Введіть 6-значний код');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.verifyEmail({ email, code });
      if (user) setUser({ ...user, email_verified: true } as any);
      Alert.alert('Готово!', 'Email підтверджено.');
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Помилка');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setResending(true);
    setError('');
    try {
      await api.resendVerification({ email });
      setCooldown(60);
      Alert.alert('Надіслано', 'Новий код надіслано на email');
    } catch (e: any) {
      const detail = e?.response?.data?.detail || 'Помилка';
      if (detail.includes('60')) setCooldown(60);
      setError(detail);
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={s.container} data-testid="verify-email-screen">
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={s.title}>Підтвердіть email</Text>
      </View>
      <View style={s.body}>
        <View style={s.iconCircle}>
          <Ionicons name="mail-open-outline" size={48} color="#2563eb" />
        </View>
        <Text style={s.h1}>Перевірте пошту</Text>
        <Text style={s.subtitle}>
          Ми надіслали 6-значний код на{'\n'}
          <Text style={{ fontWeight: '700', color: '#111827' }}>{email}</Text>
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
          data-testid="verify-code-input"
        />
        {!!error && <Text style={s.error}>{error}</Text>}
        <TouchableOpacity
          style={[s.btn, (loading || code.length !== 6) && s.btnDisabled]}
          onPress={verify}
          disabled={loading || code.length !== 6}
          data-testid="verify-submit-btn"
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Підтвердити</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={resend} disabled={resending || cooldown > 0} data-testid="resend-code-btn">
          <Text style={s.resend}>
            {cooldown > 0 ? `Надіслати знов через ${cooldown}с` : resending ? 'Надсилаю…' : 'Не отримали код? Надіслати знов'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={{ marginTop: 20 }} data-testid="skip-verify-btn">
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
  input: { width: '100%', maxWidth: 280, height: 64, borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 12, textAlign: 'center', fontSize: 28, fontWeight: '700', letterSpacing: 8, color: '#111827', marginBottom: 12 },
  error: { fontSize: 13, color: '#dc2626', marginBottom: 12 },
  btn: { width: '100%', maxWidth: 280, height: 50, backgroundColor: '#2563eb', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  btnDisabled: { backgroundColor: '#9ca3af' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resend: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
  skip: { fontSize: 14, color: '#9ca3af', fontWeight: '500' },
});
