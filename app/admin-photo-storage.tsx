import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';
import { showAlert } from '../utils/alert';

type Status = {
  storage_enabled?: boolean; running?: boolean; mode?: string; profiles?: number; users?: number;
  errors?: number; started_at?: string; finished_at?: string; last_upload_error?: string;
};

const when = (v?: string) => (v ? new Date(v).toLocaleString() : '—');
const errMsg = (e: any) => e?.response?.data?.detail || e?.message || 'Something went wrong';

export default function AdminPhotoStorage() {
  const router = useRouter();
  const [st, setSt] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setSt(await api.getPhotoOptimizeStatus()); } catch (e) { showAlert('Error', errMsg(e)); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!st?.running) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [st?.running, load]);

  const toggle = async (v: boolean) => {
    setBusy(true);
    try { await api.setPhotoStorage(v); await load(); } catch (e) { showAlert('Error', errMsg(e)); } finally { setBusy(false); }
  };

  const runNow = async () => {
    setBusy(true);
    try { await api.runPhotoOptimize(); setTimeout(load, 1500); } catch (e) { showAlert('Error', errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="photo-storage-back-btn"><Ionicons name="arrow-back" size={24} color="#111827" /></TouchableOpacity>
        <Text style={s.title}>Photos & storage</Text>
        <View style={{ width: 24 }} />
      </View>
      {!st ? <ActivityIndicator style={{ marginTop: 40 }} color="#2563eb" /> : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <View style={s.card}>
            <Text style={s.cardTitle}>Photo optimization</Text>
            <Text style={s.text}>Pro photos are automatically resized to 1920 px and compressed (good quality on phone and PC). Limit: 15 photos per service.</Text>
          </View>
          <View style={s.card}>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>Save photos in cloud storage</Text>
                <Text style={s.text}>{st.storage_enabled ? 'ON — new and existing photos are moved to file storage.' : 'OFF — photos are kept in your own database (compressed).'}</Text>
              </View>
              <Switch value={!!st.storage_enabled} onValueChange={toggle} disabled={busy} testID="photo-storage-switch" data-testid="photo-storage-switch" />
            </View>
          </View>
          <View style={s.card} data-testid="photo-optimize-status">
            <Text style={s.cardTitle}>Last run</Text>
            <Text style={s.text}>Status: {st.running ? 'running…' : st.finished_at ? 'finished' : 'not run yet'}{st.mode ? ` (${st.mode})` : ''}</Text>
            <Text style={s.text}>Profiles updated: {st.profiles ?? 0} · Avatars updated: {st.users ?? 0} · Errors: {st.errors ?? 0}</Text>
            <Text style={s.text}>Started: {when(st.started_at)} · Finished: {when(st.finished_at)}</Text>
            {st.last_upload_error ? <Text style={s.err}>Storage error: {st.last_upload_error}</Text> : null}
            <TouchableOpacity style={[s.btn, (busy || st.running) && { opacity: 0.6 }]} onPress={runNow} disabled={busy || !!st.running} data-testid="photo-optimize-run-btn">
              {st.running ? <ActivityIndicator color="#fff" /> : <Ionicons name="flash" size={18} color="#fff" />}
              <Text style={s.btnText}>Optimize existing photos now</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 48, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', padding: 16, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  text: { fontSize: 13, color: '#4b5563', lineHeight: 19 },
  err: { fontSize: 12, color: '#b91c1c' },
  btn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 13, marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
