/**
 * Provider: Account pause
 * Toggle whether you appear in search. While paused, clients can't find or book you.
 * Reads/writes via /provider/pending-alert, /provider/pause, /provider/unpause.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';
import { showAlert } from '../utils/alert';

export default function AccountPausePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await api.getProviderPendingAlert();
      setPaused(!!r.search_paused);
      setReason(r.paused_reason || null);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const toggle = async (next: boolean) => {
    setBusy(true);
    setPaused(next);
    try {
      if (next) {
        await api.providerPause();
        setReason('manual');
      } else {
        const res = await api.providerUnpause();
        setReason(null);
        if (res?.released_tasks > 0) {
          showAlert('Reactivated', `You're back in search. ${res.released_tasks} unaccepted task(s) were released.`);
        }
      }
    } catch (e: any) {
      setPaused(!next);
      showAlert('Error', e?.response?.data?.detail || 'Could not update.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#2563eb" /></View>;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} data-testid="pause-back-btn">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={s.title}>Account pause</Text>
      </View>

      <View style={s.content}>
        <View style={[s.statusCard, { backgroundColor: paused ? '#fef2f2' : '#ecfdf5', borderColor: paused ? '#fca5a5' : '#a7f3d0' }]} data-testid="pause-status-card">
          <Ionicons name={paused ? 'pause-circle' : 'checkmark-circle'} size={40} color={paused ? '#dc2626' : '#059669'} />
          <Text style={[s.statusTitle, { color: paused ? '#dc2626' : '#059669' }]}>
            {paused ? 'Paused — hidden from search' : 'Active — visible in search'}
          </Text>
          <Text style={s.statusSub}>
            {paused
              ? (reason === 'auto_unaccepted'
                  ? "Your account was paused automatically because a task wasn't accepted within 24 hours."
                  : 'Clients cannot find or book you right now.')
              : 'Clients can find and book you.'}
          </Text>
        </View>

        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleLabel}>Pause my account</Text>
            <Text style={s.toggleHelp}>Turn on to temporarily stop receiving new jobs and hide from search.</Text>
          </View>
          <Switch value={paused} onValueChange={toggle} disabled={busy} data-testid="account-pause-toggle" />
        </View>

        {paused ? (
          <TouchableOpacity style={s.reactivateBtn} onPress={() => toggle(false)} disabled={busy} data-testid="account-reactivate-btn">
            {busy ? <ActivityIndicator color="#fff" /> : <><Ionicons name="play" size={18} color="#fff" /><Text style={s.reactivateText}>Reactivate now</Text></>}
          </TouchableOpacity>
        ) : null}

        <Text style={s.note}>
          Tip: if you don't accept an assigned task within 24 hours, your account is paused automatically. Reactivating releases that task.
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  back: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  content: { padding: 16 },
  statusCard: { alignItems: 'center', borderRadius: 16, borderWidth: 1.5, padding: 22, marginBottom: 20, gap: 6 },
  statusTitle: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  statusSub: { fontSize: 13, color: '#4b5563', textAlign: 'center', lineHeight: 19 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', padding: 16 },
  toggleLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  toggleHelp: { fontSize: 12, color: '#6b7280', marginTop: 3, lineHeight: 17 },
  reactivateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#059669', borderRadius: 12, paddingVertical: 14, marginTop: 16 },
  reactivateText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  note: { fontSize: 12, color: '#9ca3af', marginTop: 18, lineHeight: 17 },
});
