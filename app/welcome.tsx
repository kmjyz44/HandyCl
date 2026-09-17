import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';

export default function Welcome() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [hasBooking, setHasBooking] = useState(false);

  useEffect(() => {
    let pending = false;
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        pending = !!window.localStorage.getItem('pending_booking_draft');
      }
    } catch { /* ignore */ }
    setHasBooking(pending);

    // Never stay on this page — continue into the client cabinet automatically.
    // The home screen picks up any pending booking draft and resumes the booking.
    const t = setTimeout(() => {
      router.replace('/(tabs)' as any);
    }, 2200);
    return () => clearTimeout(t);
  }, []);

  const goNow = () => router.replace('/(tabs)' as any);

  return (
    <View style={s.container} data-testid="welcome-screen">
      <View style={s.badge}>
        <Ionicons name="checkmark" size={44} color="#fff" />
      </View>
      <Text style={s.title}>Welcome to Ono-Fix{user?.name ? `, ${String(user.name).split(' ')[0]}` : ''}!</Text>
      <Text style={s.subtitle}>
        {hasBooking
          ? 'Your account is ready. Taking you to your booking…'
          : 'Your account is ready. Taking you to your dashboard…'}
      </Text>

      <View style={s.loaderRow}>
        <ActivityIndicator color="#2563eb" />
      </View>

      <TouchableOpacity style={s.btn} onPress={goNow} data-testid="welcome-continue-btn">
        <Text style={s.btnText}>{hasBooking ? 'Continue to my booking' : 'Go to my account'}</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', padding: 28 },
  badge: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: '#10b981',
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
    shadowColor: '#10b981', shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
  },
  title: { fontSize: 26, fontWeight: '800', color: '#0f172a', textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: '#64748b', textAlign: 'center', marginTop: 10, lineHeight: 22, maxWidth: 360 },
  loaderRow: { marginTop: 24, marginBottom: 8 },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20,
    backgroundColor: '#2563eb', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 999,
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
