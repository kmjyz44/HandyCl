import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';

export default function IdentityVerification() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [status, setStatus] = useState<string>('unverified');
  const [verified, setVerified] = useState(false);
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [error, setError] = useState<string>('');

  const load = async () => {
    try {
      const r = await api.identityStatus();
      setVerified(!!r.identity_verified);
      setStatus(r.status || 'unverified');
      setVerifiedName(r.verified_name || null);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not load status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const startVerification = async () => {
    setStarting(true);
    setError('');
    try {
      const r = await api.identityStart();
      if (r.already_verified) { setVerified(true); setStatus('verified'); return; }
      if (r.url) {
        if (Platform.OS === 'web') {
          window.location.assign(r.url);
        } else {
          setError('Please open this page in a web browser to verify.');
        }
      } else {
        setError('Verification could not be started right now.');
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not start verification. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} data-testid="identity-back">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Identity verification</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} data-testid="identity-screen">
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="shield-checkmark-outline" size={34} color="#2563eb" />
          </View>
          <Text style={styles.h1}>Verify who you are</Text>
          <Text style={styles.lead}>
            To keep Ono-Fix safe and to sign the Service Provider Agreement as a real person,
            we verify your identity with Stripe Identity. You'll photograph a government ID and take a quick selfie.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} />
        ) : verified ? (
          <View style={[styles.statusCard, styles.okCard]} data-testid="identity-status-verified">
            <Ionicons name="checkmark-circle" size={22} color="#059669" />
            <View style={{ flex: 1 }}>
              <Text style={styles.okTitle}>Identity verified</Text>
              <Text style={styles.okSub}>
                {verifiedName ? `Verified as ${verifiedName}. ` : ''}You can appear to clients and accept jobs.
              </Text>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.steps}>
              {[
                { icon: 'card-outline', t: 'Photograph your ID', d: 'Driver license, passport or state ID.' },
                { icon: 'camera-outline', t: 'Take a selfie', d: 'Stripe matches your face to the ID.' },
                { icon: 'lock-closed-outline', t: 'Private & secure', d: 'Handled by Stripe. We only store the result.' },
              ].map((st) => (
                <View key={st.t} style={styles.stepRow}>
                  <View style={styles.stepIcon}><Ionicons name={st.icon as any} size={20} color="#2563eb" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepTitle}>{st.t}</Text>
                    <Text style={styles.stepDesc}>{st.d}</Text>
                  </View>
                </View>
              ))}
            </View>

            {status === 'processing' && (
              <View style={[styles.statusCard, styles.infoCard]}>
                <Ionicons name="hourglass-outline" size={20} color="#2563eb" />
                <Text style={styles.infoText}>Your verification is being reviewed. This can take a few minutes.</Text>
              </View>
            )}
            {status === 'requires_input' && (
              <View style={[styles.statusCard, styles.warnCard]}>
                <Ionicons name="alert-circle-outline" size={20} color="#b45309" />
                <Text style={styles.warnText}>We couldn't verify your last submission. Please try again with a clear, supported document.</Text>
              </View>
            )}

            {!!error && <Text style={styles.error} data-testid="identity-error">{error}</Text>}

            <TouchableOpacity
              style={[styles.cta, starting && { opacity: 0.6 }]}
              onPress={startVerification}
              disabled={starting}
              data-testid="identity-start-btn"
            >
              {starting ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="shield-checkmark" size={18} color="#fff" />
                  <Text style={styles.ctaText}>{status === 'requires_input' ? 'Try again' : 'Verify ID and selfie'}</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={load} style={styles.refresh} data-testid="identity-refresh">
              <Text style={styles.refreshText}>Refresh status</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  back: { padding: 4, marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  content: { padding: 20, paddingBottom: 60 },
  hero: { alignItems: 'center', marginBottom: 20 },
  heroIcon: { width: 68, height: 68, borderRadius: 20, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  h1: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 8 },
  lead: { fontSize: 14, color: '#4b5563', lineHeight: 21, textAlign: 'center' },
  steps: { gap: 14, marginTop: 4, marginBottom: 20 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  stepDesc: { fontSize: 13, color: '#6b7280', marginTop: 1 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 14, marginBottom: 16 },
  okCard: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' },
  okTitle: { fontSize: 15, fontWeight: '800', color: '#065f46' },
  okSub: { fontSize: 13, color: '#047857', marginTop: 2 },
  infoCard: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' },
  infoText: { flex: 1, fontSize: 13, color: '#1d4ed8' },
  warnCard: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a' },
  warnText: { flex: 1, fontSize: 13, color: '#b45309' },
  error: { color: '#dc2626', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 15 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  refresh: { alignItems: 'center', marginTop: 16 },
  refreshText: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
});
