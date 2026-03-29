import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal, TextInput, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';

const ALL_STATUSES = [
  '', 'posted', 'offering', 'assigned', 'hold_placed', 'on_the_way',
  'started', 'completed_pending_payment', 'paid', 'declined', 'cancelled_by_client', 'cancelled_by_tasker',
];

const STATUS_LABELS: Record<string, string> = {
  '': 'Всі',
  posted: 'Очікує',
  offering: 'Пропозиції',
  assigned: 'Призначено',
  hold_placed: 'Підтверджено',
  on_the_way: 'В дорозі',
  started: 'Виконується',
  completed_pending_payment: 'Очікує оплати',
  paid: 'Оплачено',
  declined: 'Відхилено',
  cancelled_by_client: 'Скасовано клієнтом',
  cancelled_by_tasker: 'Скасовано виконавцем',
};

const STATUS_COLORS: Record<string, string> = {
  posted: '#3b82f6', offering: '#8b5cf6', assigned: '#f59e0b',
  hold_placed: '#10b981', on_the_way: '#06b6d4', started: '#f97316',
  completed_pending_payment: '#eab308', paid: '#22c55e',
  declined: '#dc2626', cancelled_by_client: '#ef4444', cancelled_by_tasker: '#ef4444',
};

const CATEGORIES: Record<string, string> = {
  '': 'Всі категорії',
  assembly: 'Збірка меблів',
  cleaning: 'Прибирання',
  repair: 'Ремонт',
  moving: 'Переїзд',
  outdoor: 'Двір',
  personal: 'Особисте',
  it_tech: 'IT/Техніка',
  events: 'Заходи',
  other: 'Інше',
};

export default function Dashboard() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<any>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterProvider, setFilterProvider] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Edit modal
  const [editTask, setEditTask] = useState<any>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editHours, setEditHours] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const params: any = {};
      if (filterStatus) params.status = filterStatus;
      if (filterCategory) params.category = filterCategory;
      if (filterProvider.trim()) params.provider_id = filterProvider.trim();
      if (filterClient.trim()) params.client_id = filterClient.trim();
      const [tasksRes, dashRes] = await Promise.all([
        api.adminGetTasks({ ...params, limit: 100 }),
        api.getAdminDashboard().catch(() => null),
      ]);
      setTasks(tasksRes.tasks || []);
      setTotal(tasksRes.total || 0);
      setStats(dashRes);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e.message || 'Помилка';
      if (Platform.OS === 'web') window.alert('Помилка: ' + msg);
      else Alert.alert('Помилка', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterStatus, filterCategory, filterProvider, filterClient]);

  useEffect(() => { loadData(); }, [loadData]);
  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleDelete = (task: any) => {
    const confirm = () => {
      api.adminDeleteTask(task.task_id).then(() => {
        setTasks(prev => prev.filter(t => t.task_id !== task.task_id));
        setTotal(prev => prev - 1);
      }).catch(e => {
        const msg = e?.response?.data?.detail || e.message || 'Помилка';
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Помилка', msg);
      });
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Видалити завдання "${task.title}"?`)) confirm();
    } else {
      Alert.alert('Видалити?', `Видалити завдання "${task.title}"?`, [
        { text: 'Скасувати', style: 'cancel' },
        { text: 'Видалити', style: 'destructive', onPress: confirm },
      ]);
    }
  };

  const openEdit = (task: any) => {
    setEditTask(task);
    setEditStatus(task.status || '');
    setEditHours(task.actual_hours != null ? String(task.actual_hours) : '');
    setEditPrice(task.final_price != null ? String(task.final_price) : '');
  };

  const submitEdit = async () => {
    if (!editTask) return;
    setEditLoading(true);
    try {
      const hrs = parseFloat(editHours) || undefined;
      const price = parseFloat(editPrice) || undefined;
      if (editStatus !== editTask.status || hrs != null || price != null) {
        await api.adminChangeTaskStatus(editTask.task_id, editStatus, hrs, price);
      }
      setTasks(prev => prev.map(t => t.task_id === editTask.task_id
        ? { ...t, status: editStatus, actual_hours: hrs ?? t.actual_hours, final_price: price ?? t.final_price }
        : t
      ));
      setEditTask(null);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e.message || 'Помилка';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Помилка', msg);
    } finally {
      setEditLoading(false);
    }
  };

  if (loading) {
    return <View style={s.centered}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Адмін-панель</Text>
          <Text style={s.headerSub}>Всього завдань: {total}</Text>
        </View>
        <TouchableOpacity style={s.filterBtn} onPress={() => setShowFilters(!showFilters)}>
          <Ionicons name="filter" size={20} color="#2563eb" />
          <Text style={s.filterBtnText}>Фільтри</Text>
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      {stats && (
        <View style={s.statsRow}>
          <View style={s.statChip}>
            <Text style={s.statNum}>{stats.total_users || 0}</Text>
            <Text style={s.statLbl}>Користувачів</Text>
          </View>
          <View style={s.statChip}>
            <Text style={s.statNum}>{stats.total_bookings || 0}</Text>
            <Text style={s.statLbl}>Замовлень</Text>
          </View>
          <View style={s.statChip}>
            <Text style={s.statNum}>{tasks.filter(t => t.status === 'started').length}</Text>
            <Text style={s.statLbl}>В роботі</Text>
          </View>
          <View style={s.statChip}>
            <Text style={s.statNum}>{tasks.filter(t => t.status === 'completed_pending_payment').length}</Text>
            <Text style={s.statLbl}>Очік. оплати</Text>
          </View>
        </View>
      )}

      {/* Filters panel */}
      {showFilters && (
        <View style={s.filtersPanel}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.statusPills}>
            {ALL_STATUSES.map(st => (
              <TouchableOpacity
                key={st}
                style={[s.pill, filterStatus === st && s.pillActive]}
                onPress={() => setFilterStatus(st)}
              >
                <Text style={[s.pillText, filterStatus === st && s.pillTextActive]}>
                  {STATUS_LABELS[st] || st}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.statusPills}>
            {Object.entries(CATEGORIES).map(([k, v]) => (
              <TouchableOpacity
                key={k}
                style={[s.pill, filterCategory === k && s.pillActive]}
                onPress={() => setFilterCategory(k)}
              >
                <Text style={[s.pillText, filterCategory === k && s.pillTextActive]}>{v}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={s.filterRow}>
            <TextInput
              style={s.filterInput}
              placeholder="ID виконавця..."
              value={filterProvider}
              onChangeText={setFilterProvider}
              placeholderTextColor="#9ca3af"
            />
            <TextInput
              style={s.filterInput}
              placeholder="ID клієнта..."
              value={filterClient}
              onChangeText={setFilterClient}
              placeholderTextColor="#9ca3af"
            />
          </View>
          <TouchableOpacity style={s.applyBtn} onPress={() => { setShowFilters(false); loadData(); }}>
            <Text style={s.applyBtnText}>Застосувати фільтри</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Task list */}
      <ScrollView
        style={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {tasks.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="clipboard-outline" size={48} color="#d1d5db" />
            <Text style={s.emptyText}>Завдань не знайдено</Text>
          </View>
        ) : tasks.map(task => {
          const statusColor = STATUS_COLORS[task.status] || '#6b7280';
          const statusLabel = STATUS_LABELS[task.status] || task.status;
          const hrs = task.actual_hours;
          const rate = task.hourly_rate || 0;
          const calcPrice = task.final_price || (hrs && rate ? Math.round(hrs * rate) : null);
          return (
            <View key={task.task_id} style={s.taskCard}>
              <View style={[s.statusStrip, { backgroundColor: statusColor }]} />
              <View style={s.cardBody}>
                {/* Title + status */}
                <View style={s.cardTop}>
                  <Text style={s.taskTitle} numberOfLines={1}>{task.title || 'Без назви'}</Text>
                  <View style={[s.badge, { backgroundColor: statusColor + '22' }]}>
                    <Text style={[s.badgeText, { color: statusColor }]}>{statusLabel}</Text>
                  </View>
                </View>

                {/* Meta */}
                <View style={s.metaRow}>
                  <Ionicons name="person-outline" size={13} color="#6b7280" />
                  <Text style={s.metaText}>
                    Клієнт: {task.client?.name || task.client_id?.slice(-6) || '—'}
                  </Text>
                </View>
                <View style={s.metaRow}>
                  <Ionicons name="construct-outline" size={13} color="#6b7280" />
                  <Text style={s.metaText}>
                    Виконавець: {task.provider?.name || (task.provider_id ? task.provider_id.slice(-6) : '—')}
                  </Text>
                </View>
                {calcPrice && (
                  <View style={s.metaRow}>
                    <Ionicons name="cash-outline" size={13} color="#10b981" />
                    <Text style={[s.metaText, { color: '#10b981' }]}>
                      {hrs ? `${hrs} год × ${rate} грн = ` : ''}{calcPrice} грн
                    </Text>
                  </View>
                )}
                <View style={s.metaRow}>
                  <Ionicons name="calendar-outline" size={13} color="#6b7280" />
                  <Text style={s.metaText}>
                    {task.due_date || task.scheduled_date || task.created_at?.slice(0, 10) || '—'}
                  </Text>
                </View>

                {/* Actions */}
                <View style={s.actions}>
                  <TouchableOpacity
                    style={s.actionBtn}
                    onPress={() => router.push(`/task-detail?id=${task.task_id}`)}
                  >
                    <Ionicons name="eye-outline" size={16} color="#2563eb" />
                    <Text style={[s.actionText, { color: '#2563eb' }]}>Деталі</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.actionBtn}
                    onPress={() => router.push(`/task-chat?task_id=${task.task_id}`)}
                  >
                    <Ionicons name="chatbubble-outline" size={16} color="#8b5cf6" />
                    <Text style={[s.actionText, { color: '#8b5cf6' }]}>Чат</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.actionBtn}
                    onPress={() => openEdit(task)}
                  >
                    <Ionicons name="create-outline" size={16} color="#f59e0b" />
                    <Text style={[s.actionText, { color: '#f59e0b' }]}>Змінити</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.actionBtn}
                    onPress={() => handleDelete(task)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                    <Text style={[s.actionText, { color: '#ef4444' }]}>Видалити</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit modal */}
      <Modal visible={!!editTask} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Редагувати завдання</Text>
              <TouchableOpacity onPress={() => setEditTask(null)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody}>
              <Text style={s.label}>Статус</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {ALL_STATUSES.filter(s => s !== '').map(st => (
                  <TouchableOpacity
                    key={st}
                    style={[s2.pill, editStatus === st && s2.pillActive]}
                    onPress={() => setEditStatus(st)}
                  >
                    <Text style={[s2.pillText, editStatus === st && s2.pillTextActive]}>
                      {STATUS_LABELS[st]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={s.label}>Години (actual_hours)</Text>
              <TextInput
                style={s.input}
                value={editHours}
                onChangeText={setEditHours}
                keyboardType="decimal-pad"
                placeholder="напр. 2.5"
                placeholderTextColor="#9ca3af"
              />
              <Text style={s.label}>Сума до оплати (final_price)</Text>
              <TextInput
                style={s.input}
                value={editPrice}
                onChangeText={setEditPrice}
                keyboardType="decimal-pad"
                placeholder="напр. 250"
                placeholderTextColor="#9ca3af"
              />
            </ScrollView>
            <View style={s.modalFooter}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setEditTask(null)}>
                <Text style={s.cancelText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.saveBtn, editLoading && { opacity: 0.6 }]}
                onPress={submitEdit}
                disabled={editLoading}
              >
                {editLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.saveText}>Зберегти</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Pill styles used inside modal (need separate object to avoid name conflict)
const s2 = StyleSheet.create({
  pill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: '#d1d5db', marginRight: 8, backgroundColor: '#fff',
  },
  pillActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  pillText: { fontSize: 12, color: '#374151' },
  pillTextActive: { color: '#fff', fontWeight: '600' },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', padding: 20, paddingTop: 60,
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  headerSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#eff6ff', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: '#bfdbfe',
  },
  filterBtnText: { color: '#2563eb', fontWeight: '600', fontSize: 14 },

  statsRow: {
    flexDirection: 'row', backgroundColor: '#fff',
    paddingHorizontal: 16, paddingVertical: 12, gap: 8,
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  statChip: {
    flex: 1, alignItems: 'center', backgroundColor: '#f9fafb',
    borderRadius: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#e5e7eb',
  },
  statNum: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  statLbl: { fontSize: 10, color: '#6b7280', marginTop: 2, textAlign: 'center' },

  filtersPanel: {
    backgroundColor: '#fff', padding: 16,
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  statusPills: { marginBottom: 8 },
  pill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: '#d1d5db', marginRight: 8, backgroundColor: '#fff',
  },
  pillActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  pillText: { fontSize: 12, color: '#374151' },
  pillTextActive: { color: '#fff', fontWeight: '600' },
  filterRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  filterInput: {
    flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#111827',
    backgroundColor: '#f9fafb',
  },
  applyBtn: {
    backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 10,
    alignItems: 'center', marginTop: 10,
  },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  list: { flex: 1 },
  emptyBox: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { color: '#9ca3af', fontSize: 16 },

  taskCard: {
    flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 12,
    marginTop: 10, borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  statusStrip: { width: 5 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  taskTitle: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  metaText: { fontSize: 12, color: '#6b7280' },
  actions: { flexDirection: 'row', gap: 4, marginTop: 10, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  actionText: { fontSize: 12, fontWeight: '600' },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalBody: { padding: 20 },
  modalFooter: {
    flexDirection: 'row', gap: 12, padding: 20,
    borderTopWidth: 1, borderTopColor: '#e5e7eb',
  },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#111827',
    backgroundColor: '#f9fafb', marginBottom: 14,
  },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  cancelText: { color: '#374151', fontWeight: '600' },
  saveBtn: {
    flex: 1, backgroundColor: '#2563eb', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '700' },
});
