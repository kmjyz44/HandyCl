import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';

// Shows providers their Stripe Identity verification state and a CTA to verify.
export default function IdentityVerificationBanner() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('unverified');
  const [verified, setVerified] = useState<boolean>(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.identityStatus();
        if (!alive) return;
        setVerified(!!r.identity_verified);
        setStatus(r.status || 'unverified');
      } catch {
        // ignore — banner just stays hidden on error
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (!user || user.role !== 'provider') return null;
  if (loading) return null;

  if (verified) {
    return (
      <View style={s.verifiedWrap} data-testid="identity-verified-badge">
        <Ionicons name="shield-checkmark" size={16} color="#059669" />
        <Text style={s.verifiedText}>Identity verified</Text>
      </View>
    );
  }

  const isProcessing = status === 'processing';
  return (
    <View style={s.card} data-testid="identity-verify-banner">
      <View style={s.iconWrap}>
        <Ionicons name={isProcessing ? 'hourglass-outline' : 'shield-outline'} size={20} color="#b45309" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>
          {isProcessing ? 'Identity check in progress' : 'Verify your identity'}
        </Text>
        <Text style={s.sub}>
          {isProcessing
            ? 'We are reviewing your document. This can take a few minutes.'
            : status === 'requires_input'
              ? 'We could not verify your last submission. Please try again.'
              : 'Required before you can appear to clients and accept jobs.'}
        </Text>
      </View>
      <TouchableOpacity
        style={s.btn}
        onPress={() => router.push('/identity' as any)}
        data-testid="identity-verify-cta"
      >
        <Text style={s.btnText}>{status === 'requires_input' ? 'Retry' : 'Verify'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a',
    borderRadius: 14, padding: 12, marginHorizontal: 16, marginTop: 12,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: '#fef3c7',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 14, fontWeight: '700', color: '#92400e' },
  sub: { fontSize: 12, color: '#b45309', marginTop: 2, lineHeight: 16 },
  btn: { backgroundColor: '#d97706', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  verifiedWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0',
    borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10,
    marginHorizontal: 16, marginTop: 12,
  },
  verifiedText: { color: '#059669', fontWeight: '700', fontSize: 12 },
});
