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
    <View style={s.wrap} data-testid="email-verify-link-wrap">
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: '/verify-email', params: { email: user.email } } as any)}
        data-testid="email-verify-link"
      >
        <Text style={s.link}>⚠ Verify your email — tap to enter your code</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setDismissed(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} data-testid="email-verify-dismiss">
        <Ionicons name="close" size={13} color="#b45309" />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fffbeb', paddingVertical: 5, paddingHorizontal: 12,
  },
  link: {
    fontSize: 12, color: '#b45309', fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
