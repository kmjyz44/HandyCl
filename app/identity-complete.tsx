import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';

// Landing page Stripe redirects back to after the hosted verification flow.
// The return URL is NOT proof of success — we poll our backend for the real status.
export default function IdentityComplete() {
  const router = useRouter();
  const [status, setStatus] = useState<string>('processing');
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(true);
  const attempts = useRef(0);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await api.identityStatus();
        if (!alive) return;
        setVerified(!!r.identity_verified);
        setStatus(r.status || 'processing');
        if (r.identity_verified || r.status === 'requires_input') {
          setChecking(false);
          return;
        }
      } catch {
        // ignore, keep trying
      }
      attempts.current += 1;
      if (attempts.current >= 6) { setChecking(false); return; }
      setTimeout(poll, 2500);
    };
    poll();
    return () => { alive = false; };
  }, []);

  return (
    <View style={styles.container} data-testid="identity-complete-screen">
      <View style={styles.card}>
        {checking ? (
          <>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.title}>Checking your verification…</Text>
            <Text style={styles.sub}>This can take a few moments. Please don't close this page.</Text>
          </>
        ) : verified ? (
          <>
            <Ionicons name="checkmark-circle" size={56} color="#059669" />
            <Text style={styles.title}>You're verified!</Text>
            <Text style={styles.sub}>Your identity has been confirmed. You can now appear to clients and accept jobs.</Text>
          </>
        ) : status === 'requires_input' ? (
          <>
            <Ionicons name="alert-circle" size={56} color="#d97706" />
            <Text style={styles.title}>We couldn't verify that</Text>
            <Text style={styles.sub}>Something went wrong with your document or selfie. Please try again.</Text>
          </>
        ) : (
          <>
            <Ionicons name="hourglass" size={56} color="#2563eb" />
            <Text style={styles.title}>Verification in progress</Text>
            <Text style={styles.sub}>Stripe is still reviewing your submission. We'll update your status shortly.</Text>
          </>
        )}

        <TouchableOpacity
          style={styles.btn}
          onPress={() => router.replace('/identity' as any)}
          data-testid="identity-complete-continue"
        >
          <Text style={styles.btnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 28, alignItems: 'center', gap: 10, maxWidth: 420, width: '100%', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  title: { fontSize: 20, fontWeight: '800', color: '#111827', marginTop: 6, textAlign: 'center' },
  sub: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20 },
  btn: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 32, marginTop: 12 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
