import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';

export default function EmailVerificationBanner() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [dismissed, setDismissed] = useState(false);

  if (!user || user.role === 'admin') return null;
  if (user.email_verified !== false) return null; // hide when verified or unknown
  if (dismissed) return null;

  return (
    <TouchableOpacity
      style={s.banner}
      activeOpacity={0.85}
      onPress={() => router.push({ pathname: '/verify-email', params: { email: user.email } } as any)}
      data-testid="email-verify-banner"
    >
      <View style={s.iconBox}>
        <Ionicons name="mail-unread-outline" size={20} color="#b45309" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>Verify your email</Text>
        <Text style={s.sub}>Tap to enter the verification code</Text>
      </View>
      <TouchableOpacity onPress={() => setDismissed(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} data-testid="email-verify-dismiss">
        <Ionicons name="close" size={18} color="#92400e" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fffbeb', borderColor: '#fde68a', borderWidth: 1,
    borderRadius: 12, padding: 12, marginHorizontal: 16, marginBottom: 12,
  },
  iconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: '#92400e' },
  sub: { fontSize: 12, color: '#b45309', marginTop: 1 },
});
