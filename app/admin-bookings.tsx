/**
 * Admin: Bookings / Tasks management
 *
 * One combined list of all tasks with a "filter by provider" and status filter.
 * Per task the admin can: open the shared chat, change status (full list),
 * block/unblock (locks chat for client+provider), or delete.
 * Backend: GET /admin/tasks, PATCH /admin/tasks/{id}/status,
 *          POST /admin/tasks/{id}/block, DELETE /admin/tasks/{id}
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
  Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';
import { showAlert, showConfirm } from '../utils/alert';

const STATUSES = [
  'draft', 'posted', 'offering', 'pending_acceptance', 'assigned', 'accepted',
  'hold_placed', 'on_the_way', 'started', 'in_progress',
  'completed_pending_payment', 'completed', 'paid',
  'declined', 'cancelled', 'cancelled_by_client', 'cancelled_by_tasker', 'dispute',
];
const STATUS_FILTERS = ['all', 'pending_acceptance', 'assigned', 'on_the_way', 'started', 'completed_pending_payment', 'paid', 'cancelled_by_client', 'dispute'];

const statusColor = (s: string): string => {
  if (!s) return '#6b7280';
  if (s.includes('paid') || s === 'completed') return '#059669';
  if (s.includes('cancel') || s === 'declined' || s === 'dispute') return '#dc2626';
  if (s.includes('pending') || s === 'offering' || s === 'posted') return '#d97706';
  if (s === 'on_the_way' || s === 'started' || s === 'in_progress') return '#2563eb';
  return '#6b7280';
};
const pretty = (s: string) => (s || '').replace(/_/g, ' ');

export default function AdminBookingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [providers, setProviders] = useState<any[]>([]);
  const [providerId, setProviderId] = useState<string>('');
  const [providerName, setProviderName] = useState<string>('');
  const [providerModal, setProviderModal] = useState(false);
  const [provSearch, setProvSearch] = useState('');
  const [statusModalTask, setStatusModalTask] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: 200 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (providerId) params.provider_id = providerId;
      const res = await api.adminGetTasks(params);
      setTasks(res?.tasks || []);
      setTotal(res?.total || 0);
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Failed to load tasks.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, providerId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getUsers('provider');
        const arr = Array.isArray(res) ? res : (res?.users || []);
        setProviders(arr);
      } catch {}
    })();
  }, []);

  const openChat = (t: any) => {
    router.push({ pathname: '/task-chat', params: { taskId: t.task_id, taskTitle: t.title || 'Task' } } as any);
  };

  const changeStatus = async (t: any, status: string) => {
    setStatusModalTask(null);
    try {
      await api.adminChangeTaskStatus(t.task_id, status);
      setTasks((prev) => prev.map((x) => (x.task_id === t.task_id ? { ...x, status } : x)));
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Failed to change status.');
    }
  };

  const toggleBlock = (t: any) => {
    const next = !t.admin_blocked;
    showConfirm(
      next ? 'Block task?' : 'Unblock task?',
      next ? 'The chat will be closed for the client and provider (you can still message).' : 'The chat will reopen for the client and provider.',
      async () => {
        try {
          await api.adminBlockTask(t.task_id, next);
          setTasks((prev) => prev.map((x) => (x.task_id === t.task_id ? { ...x, admin_blocked: next } : x)));
        } catch (e: any) {
          showAlert('Error', e?.response?.data?.detail || 'Failed to update.');
        }
      },
      next ? 'Block' : 'Unblock',
    );
  };

  const deleteTask = (t: any) => {
    showConfirm(
      'Delete task?',
      'This permanently removes the task. This cannot be undone.',
      async () => {
        try {
          await api.adminDeleteTask(t.task_id);
          setTasks((prev) => prev.filter((x) => x.task_id !== t.task_id));
          setTotal((n) => Math.max(0, n - 1));
        } catch (e: any) {
          showAlert('Error', e?.response?.data?.detail || 'Failed to delete.');
        }
      },
      'Delete',
    );
  };

  const filteredProviders = providers.filter((p) =>
    (p.name || p.email || '').toLowerCase().includes(provSearch.toLowerCase()));

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} data-testid="bookings-back-btn">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={s.title}>Bookings</Text>
        <TouchableOpacity onPress={load} style={s.refreshIcon} data-testid="bookings-refresh-btn">
          <Ionicons name="refresh" size={22} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {/* Provider filter */}
      <View style={s.filterBar}>
        <TouchableOpacity style={s.provFilter} onPress={() => setProviderModal(true)} data-testid="bookings-provider-filter">
          <Ionicons name="person-circle-outline" size={18} color="#2563eb" />
          <Text style={s.provFilterText} numberOfLines={1}>{providerId ? providerName : 'All providers'}</Text>
          <Ionicons name="chevron-down" size={16} color="#6b7280" />
        </TouchableOpacity>
        {providerId ? (
          <TouchableOpacity onPress={() => { setProviderId(''); setProviderName(''); }} data-testid="bookings-clear-provider">
            <Ionicons name="close-circle" size={20} color="#9ca3af" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Status filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.statusChips}>
        {STATUS_FILTERS.map((sf) => (
          <TouchableOpacity
            key={sf}
            style={[s.chip, statusFilter === sf && s.chipActive]}
            onPress={() => setStatusFilter(sf)}
            data-testid={`bookings-status-${sf}`}
          >
            <Text style={[s.chipText, statusFilter === sf && s.chipTextActive]}>{sf === 'all' ? 'All' : pretty(sf)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#2563eb" />
      ) : (
        <ScrollView contentContainerStyle={s.content} data-testid="admin-bookings-screen">
          <Text style={s.count}>{tasks.length} shown{total > tasks.length ? ` of ${total}` : ''}</Text>
          {tasks.length === 0 ? (
            <Text style={s.empty}>No tasks match this filter.</Text>
          ) : tasks.map((t) => (
            <View key={t.task_id} style={s.card} data-testid={`booking-card-${t.task_id}`}>
              <View style={s.cardTop}>
                <Text style={s.cardTitle} numberOfLines={1}>{t.title || t.category || 'Task'}</Text>
                <View style={[s.badge, { backgroundColor: statusColor(t.status) + '22' }]}>
                  <Text style={[s.badgeText, { color: statusColor(t.status) }]}>{pretty(t.status)}</Text>
                </View>
              </View>
              {t.admin_blocked ? (
                <View style={s.blockedTag}><Ionicons name="lock-closed" size={11} color="#dc2626" /><Text style={s.blockedTagText}>Blocked</Text></View>
              ) : null}
              <Text style={s.meta}>Client: {t.client?.name || '—'}</Text>
              <Text style={s.meta}>Provider: {t.provider?.name || '—'}</Text>
              <Text style={s.meta}>
                {(t.scheduled_date || t.date || '—')}{(t.scheduled_time || t.time) ? ` · ${t.scheduled_time || t.time}` : ''}
                {t.total_price ? ` · $${Math.round(t.total_price)}` : ''}
              </Text>

              <View style={s.actions}>
                <TouchableOpacity style={s.actBtn} onPress={() => openChat(t)} data-testid={`booking-chat-${t.task_id}`}>
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color="#2563eb" />
                  <Text style={s.actText}>Chat</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.actBtn} onPress={() => setStatusModalTask(t)} data-testid={`booking-status-${t.task_id}`}>
                  <Ionicons name="swap-horizontal" size={16} color="#2563eb" />
                  <Text style={s.actText}>Status</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.actBtn} onPress={() => toggleBlock(t)} data-testid={`booking-block-${t.task_id}`}>
                  <Ionicons name={t.admin_blocked ? 'lock-open-outline' : 'lock-closed-outline'} size={16} color="#d97706" />
                  <Text style={[s.actText, { color: '#d97706' }]}>{t.admin_blocked ? 'Unblock' : 'Block'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.actBtn} onPress={() => deleteTask(t)} data-testid={`booking-delete-${t.task_id}`}>
                  <Ionicons name="trash-outline" size={16} color="#dc2626" />
                  <Text style={[s.actText, { color: '#dc2626' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Provider picker modal */}
      <Modal visible={providerModal} transparent animationType="slide" onRequestClose={() => setProviderModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Filter by provider</Text>
              <TouchableOpacity onPress={() => setProviderModal(false)} data-testid="provider-modal-close"><Ionicons name="close" size={24} color="#111827" /></TouchableOpacity>
            </View>
            <TextInput
              style={s.search}
              placeholder="Search provider…"
              placeholderTextColor="#9ca3af"
              value={provSearch}
              onChangeText={setProvSearch}
              data-testid="provider-search-input"
            />
            <ScrollView style={{ maxHeight: 380 }}>
              <TouchableOpacity style={s.provRow} onPress={() => { setProviderId(''); setProviderName(''); setProviderModal(false); }}>
                <Text style={s.provRowText}>All providers</Text>
              </TouchableOpacity>
              {filteredProviders.map((p) => (
                <TouchableOpacity
                  key={p.user_id}
                  style={s.provRow}
                  onPress={() => { setProviderId(p.user_id); setProviderName(p.name || p.email); setProviderModal(false); }}
                  data-testid={`provider-option-${p.user_id}`}
                >
                  <Text style={s.provRowText}>{p.name || p.email}</Text>
                  {p.email ? <Text style={s.provRowSub}>{p.email}</Text> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Status change modal */}
      <Modal visible={!!statusModalTask} transparent animationType="slide" onRequestClose={() => setStatusModalTask(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Change status</Text>
              <TouchableOpacity onPress={() => setStatusModalTask(null)} data-testid="status-modal-close"><Ionicons name="close" size={24} color="#111827" /></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              {STATUSES.map((st) => (
                <TouchableOpacity
                  key={st}
                  style={[s.statusRow, statusModalTask?.status === st && s.statusRowActive]}
                  onPress={() => changeStatus(statusModalTask, st)}
                  data-testid={`status-option-${st}`}
                >
                  <View style={[s.statusDot, { backgroundColor: statusColor(st) }]} />
                  <Text style={s.statusRowText}>{pretty(st)}</Text>
                  {statusModalTask?.status === st ? <Ionicons name="checkmark" size={18} color="#2563eb" style={{ marginLeft: 'auto' }} /> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  back: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827', flex: 1 },
  refreshIcon: { padding: 4 },
  filterBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  provFilter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  provFilterText: { flex: 1, fontSize: 14, color: '#111827', fontWeight: '600' },
  statusChips: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff', marginRight: 8 },
  chipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  chipText: { fontSize: 12, color: '#374151', fontWeight: '600', textTransform: 'capitalize' },
  chipTextActive: { color: '#fff' },
  content: { paddingHorizontal: 16 },
  count: { fontSize: 12, color: '#6b7280', marginBottom: 10 },
  empty: { color: '#9ca3af', fontSize: 14, textAlign: 'center', paddingVertical: 40 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', padding: 14, marginBottom: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: '#111827', textTransform: 'capitalize' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  blockedTag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: '#fee2e2', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, marginBottom: 6 },
  blockedTagText: { fontSize: 11, color: '#dc2626', fontWeight: '700' },
  meta: { fontSize: 13, color: '#4b5563', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' },
  actBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#f3f4f6', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  actText: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  search: { backgroundColor: '#f3f4f6', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, fontSize: 14, marginBottom: 12, color: '#111827' },
  provRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  provRowText: { fontSize: 15, color: '#111827', fontWeight: '600' },
  provRowSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  statusRowActive: { backgroundColor: '#eff6ff' },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusRowText: { fontSize: 15, color: '#111827', textTransform: 'capitalize' },
});
