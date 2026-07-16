import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';
import { showAlert } from '../utils/alert';

export default function AdminWaitlistPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => { load(); }, []);
  const load = async () => {
    try {
      const d = await api.adminGetWaitlist();
      setItems(d.items || []);
    } catch (e) { showAlert('Error', 'Failed to load waitlist'); }
    finally { setLoading(false); }
  };

  const exportCsv = () => {
    const cols = ['created_at', 'category_name', 'email', 'name', 'phone', 'city', 'state', 'zip', 'address', 'source'];
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.join(','), ...items.map((it) => cols.map((c) => esc(it[c])).join(','))].join('\n');
    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'onofix-waitlist.csv'; a.click();
      URL.revokeObjectURL(url);
    } else {
      showAlert('Export', 'CSV export is available on the web dashboard.');
    }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" /></View>;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><Ionicons name="arrow-back" size={24} color="#111827" /></TouchableOpacity>
        <Text style={s.title}>Waitlist ({items.length})</Text>
        <TouchableOpacity style={s.exportBtn} onPress={exportCsv} disabled={!items.length} data-testid="export-waitlist-btn">
          <Ionicons name="download-outline" size={16} color="#fff" />
          <Text style={s.exportText}>CSV</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={s.content} data-testid="admin-waitlist-screen">
        {items.length === 0 ? (
          <View style={s.empty}><Ionicons name="people-outline" size={40} color="#d1d5db" /><Text style={s.emptyText}>No out-of-area sign-ups yet.</Text></View>
        ) : items.map((it, i) => (
          <View key={it.waitlist_id || i} style={s.card} data-testid={`waitlist-item-${i}`}>
            <View style={s.cardTop}>
              <Text style={s.name}>{it.name || 'Anonymous'}</Text>
              <Text style={s.date}>{it.created_at ? new Date(it.created_at).toLocaleDateString() : ''}</Text>
            </View>
            {!!it.category_name && (
              <View style={s.catChip}>
                <Ionicons name="pricetag-outline" size={12} color="#2563eb" />
                <Text style={s.catChipText}>{it.category_name}</Text>
                {it.source === 'no_pros' && <Text style={s.noProsTag}>· no pros in area</Text>}
              </View>
            )}
            {!!it.email && <Text style={s.line}><Ionicons name="mail-outline" size={12} color="#6b7280" /> {it.email}</Text>}
            {!!it.phone && <Text style={s.line}><Ionicons name="call-outline" size={12} color="#6b7280" /> {it.phone}</Text>}
            <Text style={s.line}><Ionicons name="location-outline" size={12} color="#6b7280" /> {[it.city, it.state, it.zip].filter(Boolean).join(', ') || '—'}</Text>
            {!!it.address && <Text style={s.addr}>{it.address}</Text>}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  back: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', flex: 1 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#2563eb', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  exportText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText: { color: '#9ca3af', fontSize: 14 },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  name: { fontSize: 15, fontWeight: '700', color: '#111827' },
  date: { fontSize: 12, color: '#9ca3af' },
  line: { fontSize: 13, color: '#374151', marginTop: 3 },
  addr: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: '#eff6ff', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6 },
  catChipText: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  noProsTag: { fontSize: 11, color: '#b45309', fontWeight: '600' },
});
