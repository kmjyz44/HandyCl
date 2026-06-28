import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, ScrollView, Linking, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { api } from '../utils/api';
import { showAlert } from '../utils/alert';

const STATUSES = [
  { id: '',            label: 'All',        color: '#6b7280' },
  { id: 'new',         label: 'New',        color: '#2563eb' },
  { id: 'in_progress', label: 'In progress', color: '#d97706' },
  { id: 'resolved',    label: 'Resolved',   color: '#16a34a' },
  { id: 'closed',      label: 'Closed',     color: '#6b7280' },
];

const CATEGORY_LABEL: Record<string, string> = {
  bug: 'Bug', billing: 'Billing', feature: 'Idea', other: 'Other',
};

function fmt(ts: string) {
  try { return new Date(ts).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return ''; }
}

export default function AdminSupportRequests() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.listSupportRequests({ status: filter || undefined, limit: 100 });
      setItems(r?.items || []);
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Could not load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const updateStatus = async (status: string) => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.updateSupportRequest(selected.request_id, { status, notes });
      showAlert('Done', 'Status updated');
      setSelected(null);
      load();
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Support requests' }} />

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}>
        {STATUSES.map((s) => (
          <TouchableOpacity
            key={s.id || 'all'}
            style={[styles.chip, filter === s.id && { backgroundColor: s.color, borderColor: s.color }]}
            onPress={() => setFilter(s.id)}
            data-testid={`filter-${s.id || 'all'}`}
          >
            <Text style={[styles.chipText, filter === s.id && { color: '#fff' }]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#2563eb" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.request_id}
          contentContainerStyle={items.length === 0 ? styles.emptyWrap : { paddingHorizontal: 12, paddingVertical: 8 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="mail-open-outline" size={48} color="#9ca3af" />
              <Text style={styles.emptyText}>No requests yet</Text>
            </View>
          }
          renderItem={({ item }) => {
            const st = STATUSES.find((s) => s.id === item.status) || STATUSES[0];
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => { setSelected(item); setNotes(item.admin_notes || ''); }}
                data-testid={`req-${item.request_id}`}
              >
                <View style={styles.cardHead}>
                  <View style={[styles.statusBadge, { backgroundColor: st.color + '20' }]}>
                    <Text style={[styles.statusBadgeText, { color: st.color }]}>{st.label}</Text>
                  </View>
                  <Text style={styles.catLabel}>{CATEGORY_LABEL[item.category] || item.category}</Text>
                  <Text style={styles.time}>{fmt(item.created_at)}</Text>
                </View>
                <Text style={styles.subject}>{item.subject || '(no subject)'}</Text>
                <Text style={styles.from}>{item.name} · {item.email}</Text>
                <Text style={styles.preview} numberOfLines={2}>{item.message}</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Detail modal */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selected?.subject || 'Request'}</Text>
              <TouchableOpacity onPress={() => setSelected(null)} data-testid="close-detail-btn">
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            {selected && (
              <ScrollView style={{ maxHeight: 500 }}>
                <Text style={styles.label}>From</Text>
                <Text style={styles.value}>{selected.name}</Text>
                <TouchableOpacity onPress={() => Linking.openURL(`mailto:${selected.email}`)} data-testid="reply-email-btn">
                  <Text style={[styles.value, { color: '#2563eb', textDecorationLine: 'underline' }]}>{selected.email}</Text>
                </TouchableOpacity>

                <Text style={styles.label}>Category</Text>
                <Text style={styles.value}>{CATEGORY_LABEL[selected.category] || selected.category}</Text>

                <Text style={styles.label}>Message</Text>
                <Text style={styles.msgFull}>{selected.message}</Text>

                <Text style={styles.label}>Internal notes</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="What you did, what you decided, who you're forwarding to..."
                  multiline
                  numberOfLines={4}
                  style={styles.notes}
                  data-testid="notes-input"
                />

                {selected.user_id && (
                  <Text style={styles.meta}>👤 User ID: {selected.user_id}</Text>
                )}
                {selected.ip && <Text style={styles.meta}>🌐 IP: {selected.ip}</Text>}
                <Text style={styles.meta}>🆔 {selected.request_id}</Text>
              </ScrollView>
            )}

            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.actBtn, { backgroundColor: '#2563eb' }]} onPress={() => updateStatus('in_progress')} disabled={saving} data-testid="mark-progress-btn">
                <Text style={styles.actBtnText}>Start</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actBtn, { backgroundColor: '#16a34a' }]} onPress={() => updateStatus('resolved')} disabled={saving} data-testid="mark-resolved-btn">
                <Text style={styles.actBtnText}>Resolved</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actBtn, { backgroundColor: '#6b7280' }]} onPress={() => updateStatus('closed')} disabled={saving} data-testid="mark-closed-btn">
                <Text style={styles.actBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  filterBar: { backgroundColor: '#fff', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', maxHeight: 50 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  chipText: { fontSize: 12, color: '#374151', fontWeight: '600' },

  card: { backgroundColor: '#fff', padding: 14, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  catLabel: { fontSize: 11, color: '#6b7280', fontWeight: '600' },
  time: { fontSize: 10, color: '#9ca3af', marginLeft: 'auto' },
  subject: { fontSize: 14, fontWeight: '700', color: '#111827' },
  from: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  preview: { fontSize: 12, color: '#374151', marginTop: 6, lineHeight: 17 },

  emptyWrap: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 14, color: '#6b7280', marginTop: 12 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#111827', flex: 1, marginRight: 12 },

  label: { fontSize: 11, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginTop: 12 },
  value: { fontSize: 14, color: '#111827', marginTop: 4 },
  msgFull: { fontSize: 13, color: '#374151', marginTop: 4, lineHeight: 19, backgroundColor: '#f9fafb', padding: 12, borderRadius: 8 },
  notes: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 10, marginTop: 4, fontSize: 13, minHeight: 80, textAlignVertical: 'top' },
  meta: { fontSize: 10, color: '#9ca3af', marginTop: 4 },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  actBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
