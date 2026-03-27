import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';

// ─── 4 steps of a task ───────────────────────────────────────────────────────
const STEPS = [
  { key: 'assigned',   label: 'Прийняв',       icon: 'checkmark-circle',  color: '#f59e0b' },
  { key: 'on_the_way', label: 'Виїхав',         icon: 'car',               color: '#06b6d4' },
  { key: 'started',    label: 'Почав роботу',   icon: 'construct',         color: '#f97316' },
  { key: 'completed_pending_payment', label: 'Закінчив', icon: 'checkmark-done-circle', color: '#22c55e' },
];

// Step order for progress calculation
const STEP_ORDER = ['posted', 'offering', 'assigned', 'on_the_way', 'started', 'completed_pending_payment', 'paid'];

// Timestamp field for each step
const STEP_TIMESTAMPS: Record<string, string> = {
  assigned:                  'accepted_at',
  on_the_way:                'on_the_way_at',
  started:                   'started_at',
  completed_pending_payment: 'completed_at',
};

// Status banner config
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  draft:                     { label: 'Чернетка',               color: '#9ca3af', icon: 'document-outline' },
  posted:                    { label: 'Очікує виконавця',       color: '#3b82f6', icon: 'time-outline' },
  offering:                  { label: 'Приймає пропозиції',     color: '#8b5cf6', icon: 'chatbubbles-outline' },
  assigned:                  { label: 'Прийнято виконавцем',    color: '#f59e0b', icon: 'checkmark-circle-outline' },
  on_the_way:                { label: 'Виконавець в дорозі',    color: '#06b6d4', icon: 'car-outline' },
  started:                   { label: 'Виконується',            color: '#f97316', icon: 'construct-outline' },
  completed_pending_payment: { label: 'Роботу завершено',       color: '#22c55e', icon: 'checkmark-done-circle-outline' },
  paid:                      { label: 'Оплачено',               color: '#10b981', icon: 'card-outline' },
  cancelled_by_client:       { label: 'Скасовано клієнтом',     color: '#ef4444', icon: 'close-circle-outline' },
  cancelled_by_tasker:       { label: 'Скасовано виконавцем',   color: '#ef4444', icon: 'close-circle-outline' },
};

// Executor action buttons per status
const EXECUTOR_ACTIONS: Record<string, { action: string; label: string; color: string; icon: string }> = {
  posted:      { action: 'accept',     label: 'Прийняти завдання', color: '#2563eb', icon: 'checkmark-circle' },
  offering:    { action: 'accept',     label: 'Прийняти завдання', color: '#2563eb', icon: 'checkmark-circle' },
  assigned:    { action: 'on_the_way', label: 'Виїхав',            color: '#06b6d4', icon: 'car' },
  on_the_way:  { action: 'start',      label: 'Почати роботу',     color: '#f97316', icon: 'construct' },
  started:     { action: 'complete',   label: 'Закінчити роботу',  color: '#22c55e', icon: 'checkmark-done-circle' },
};

// Format ISO timestamp to readable Ukrainian format
function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} о ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '—';
  }
}

// Calculate duration between two ISO strings in hours/minutes
function calcDuration(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return '—';
  try {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    if (diff <= 0) return '—';
    const totalMin = Math.round(diff / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `${m} хв`;
    if (m === 0) return `${h} год`;
    return `${h} год ${m} хв`;
  } catch {
    return '—';
  }
}

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Complete modal
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [actualHours, setActualHours] = useState('');
  const [materialsCost, setMaterialsCost] = useState('');
  const [providerNotes, setProviderNotes] = useState('');

  useEffect(() => {
    loadTask();
  }, [id]);

  const loadTask = async () => {
    try {
      const data = await api.getTask(id);
      setTask(data);
    } catch (error: any) {
      Alert.alert('Помилка', 'Не вдалося завантажити завдання');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string) => {
    if (action === 'complete') {
      setShowCompleteModal(true);
      return;
    }
    setActionLoading(true);
    try {
      switch (action) {
        case 'accept':
          await api.acceptTask(id);
          Alert.alert('Успіх', 'Ви прийняли завдання!');
          break;
        case 'on_the_way':
          await api.onTheWayTask(id);
          Alert.alert('Успіх', 'Статус: Виїхав');
          break;
        case 'start':
          await api.startTask(id);
          Alert.alert('Успіх', 'Роботу розпочато!');
          break;
      }
      await loadTask();
    } catch (error: any) {
      Alert.alert('Помилка', error.message || 'Не вдалося виконати дію');
    } finally {
      setActionLoading(false);
    }
  };

  const submitComplete = async () => {
    setActionLoading(true);
    try {
      const result = await api.completeTask(id, {
        actual_hours: actualHours ? parseFloat(actualHours) : undefined,
        materials_cost: materialsCost ? parseFloat(materialsCost) : undefined,
        provider_notes: providerNotes || undefined,
      });
      const hrs = result.actual_hours ?? actualHours;
      Alert.alert('Завдання завершено!', `Відпрацьовано: ${hrs} год`);
      setShowCompleteModal(false);
      loadTask();
    } catch (error: any) {
      Alert.alert('Помилка', error.message || 'Не вдалося завершити завдання');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!task) return null;

  const statusCfg = STATUS_CONFIG[task.status] || { label: task.status, color: '#6b7280', icon: 'help-circle-outline' };
  const isProvider = user?.role === 'provider';
  const isMyTask = task.provider_id === user?.user_id;
  const isOpenTask = !task.provider_id && (task.status === 'posted' || task.status === 'offering');

  // Executor action button
  const executorAction = isProvider
    ? isOpenTask
      ? EXECUTOR_ACTIONS['posted']
      : isMyTask
        ? EXECUTOR_ACTIONS[task.status]
        : null
    : null;

  const clientName = task.client?.name || 'Клієнт';
  const clientPhoto = task.client?.picture || task.client?.photo_url;
  const price = task.estimated_price || task.total_price;
  const taskPhotos = [...(task.photos || []), ...(task.problem_photos || [])];

  // Progress step index
  const currentStepIdx = STEP_ORDER.indexOf(task.status);

  // Timeline entries
  const timelineEntries = STEPS.map((step) => {
    const tsField = STEP_TIMESTAMPS[step.key];
    const ts = task[tsField];
    const reached = currentStepIdx >= STEP_ORDER.indexOf(step.key);
    return { ...step, ts, reached };
  });

  // Work duration
  const workDuration = calcDuration(task.started_at, task.completed_at);
  const totalDuration = calcDuration(task.accepted_at, task.completed_at);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Деталі завдання</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Banner */}
        <View style={[styles.statusBar, { backgroundColor: statusCfg.color }]}>
          <Ionicons name={statusCfg.icon as any} size={20} color="#fff" />
          <Text style={styles.statusText}>{statusCfg.label}</Text>
        </View>

        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.title}>{task.title || 'Без назви'}</Text>
          {!!task.description && (
            <Text style={styles.description}>{task.description}</Text>
          )}
        </View>

        {/* ── 4-Step Progress Bar ─────────────────────────────────────── */}
        {(task.status !== 'posted' && task.status !== 'offering' && task.status !== 'draft') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Прогрес завдання</Text>
            <View style={styles.stepsRow}>
              {STEPS.map((step, idx) => {
                const reached = currentStepIdx >= STEP_ORDER.indexOf(step.key);
                const isLast = idx === STEPS.length - 1;
                return (
                  <React.Fragment key={step.key}>
                    <View style={styles.stepItem}>
                      <View style={[
                        styles.stepCircle,
                        reached ? { backgroundColor: step.color } : styles.stepCircleInactive
                      ]}>
                        <Ionicons
                          name={step.icon as any}
                          size={18}
                          color={reached ? '#fff' : '#9ca3af'}
                        />
                      </View>
                      <Text style={[styles.stepLabel, reached && { color: step.color, fontWeight: '700' }]}>
                        {step.label}
                      </Text>
                    </View>
                    {!isLast && (
                      <View style={[
                        styles.stepLine,
                        currentStepIdx >= STEP_ORDER.indexOf(STEPS[idx + 1].key) && { backgroundColor: STEPS[idx + 1].color }
                      ]} />
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Timeline / Statistics ───────────────────────────────────── */}
        {(task.accepted_at || task.on_the_way_at || task.started_at || task.completed_at) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Статистика часу</Text>
            <View style={styles.timelineCard}>
              {timelineEntries.map((entry) => (
                entry.ts || entry.reached ? (
                  <View key={entry.key} style={styles.timelineRow}>
                    <View style={[styles.timelineDot, { backgroundColor: entry.reached ? entry.color : '#e5e7eb' }]}>
                      <Ionicons name={entry.icon as any} size={14} color={entry.reached ? '#fff' : '#9ca3af'} />
                    </View>
                    <View style={styles.timelineContent}>
                      <Text style={[styles.timelineLabel, entry.reached && { color: '#111827', fontWeight: '600' }]}>
                        {entry.label}
                      </Text>
                      <Text style={[styles.timelineTime, entry.reached && { color: entry.color }]}>
                        {formatTime(entry.ts)}
                      </Text>
                    </View>
                  </View>
                ) : null
              ))}

              {/* Duration summary */}
              {task.started_at && (
                <View style={styles.durationBox}>
                  <View style={styles.durationItem}>
                    <Ionicons name="timer-outline" size={16} color="#6b7280" />
                    <Text style={styles.durationLabel}>Тривалість роботи</Text>
                    <Text style={styles.durationValue}>
                      {task.completed_at ? workDuration : calcDuration(task.started_at, new Date().toISOString()) + ' (зараз)'}
                    </Text>
                  </View>
                  {task.actual_hours != null && (
                    <View style={styles.durationItem}>
                      <Ionicons name="hourglass-outline" size={16} color="#6b7280" />
                      <Text style={styles.durationLabel}>Відпрацьовано годин</Text>
                      <Text style={[styles.durationValue, { color: '#2563eb' }]}>
                        {task.actual_hours} год
                      </Text>
                    </View>
                  )}
                  {task.accepted_at && task.completed_at && (
                    <View style={styles.durationItem}>
                      <Ionicons name="time-outline" size={16} color="#6b7280" />
                      <Text style={styles.durationLabel}>Загальний час</Text>
                      <Text style={styles.durationValue}>{totalDuration}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Деталі</Text>
          {!!task.address && (
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={20} color="#6b7280" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Адреса</Text>
                <Text style={styles.detailValue}>{task.address}</Text>
              </View>
            </View>
          )}
          {(!!task.scheduled_date || !!task.scheduled_time || !!task.date || !!task.time) && (
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={20} color="#6b7280" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Дата та час</Text>
                <Text style={styles.detailValue}>
                  {task.scheduled_date || task.date || ''}{(task.scheduled_date || task.date) && (task.scheduled_time || task.time) ? ' о ' : ''}{task.scheduled_time || task.time || ''}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Pricing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Вартість</Text>
          <View style={styles.priceCard}>
            {price != null && price > 0 ? (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Орієнтовна ціна</Text>
                <Text style={styles.priceValueGreen}>{price} грн</Text>
              </View>
            ) : (
              <Text style={styles.noPrice}>Ціна не вказана</Text>
            )}
            {!!task.final_price && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Фінальна ціна</Text>
                <Text style={[styles.priceValueGreen, { fontSize: 20 }]}>{task.final_price} грн</Text>
              </View>
            )}
            {!!task.materials_cost && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Матеріали</Text>
                <Text style={styles.priceLabel}>{task.materials_cost} грн</Text>
              </View>
            )}
          </View>
        </View>

        {/* Client Info */}
        {task.client && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Клієнт</Text>
            <View style={styles.clientCard}>
              {clientPhoto ? (
                <Image source={{ uri: clientPhoto }} style={styles.clientAvatar} />
              ) : (
                <View style={styles.clientAvatarPlaceholder}>
                  <Text style={styles.clientAvatarInitial}>
                    {clientName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.clientInfo}>
                <Text style={styles.clientName}>{clientName}</Text>
                {task.client.phone && (
                  <Text style={styles.clientPhone}>{task.client.phone}</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Task Photos */}
        {taskPhotos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Фото завдання</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {taskPhotos.map((photo: string, index: number) => (
                <Image
                  key={index}
                  source={{ uri: photo.startsWith('http') ? photo : `data:image/jpeg;base64,${photo}` }}
                  style={styles.photo}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Provider notes after completion */}
        {!!task.provider_notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Коментар виконавця</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{task.provider_notes}</Text>
            </View>
          </View>
        )}

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Action Button Footer */}
      {executorAction && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: executorAction.color }, actionLoading && styles.buttonDisabled]}
            onPress={() => handleAction(executorAction.action)}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name={executorAction.icon as any} size={22} color="#fff" />
                <Text style={styles.actionButtonText}>{executorAction.label}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Complete Modal */}
      <Modal visible={showCompleteModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Завершити завдання</Text>
              <TouchableOpacity onPress={() => setShowCompleteModal(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Відпрацьовано годин</Text>
              <TextInput
                style={styles.input}
                value={actualHours}
                onChangeText={setActualHours}
                keyboardType="numeric"
                placeholder="Залиште порожнім — розрахується автоматично"
              />
              <Text style={styles.inputHint}>
                Якщо не вказати — система порахує від часу початку роботи
              </Text>
              <Text style={styles.inputLabel}>Витрати на матеріали (грн)</Text>
              <TextInput
                style={styles.input}
                value={materialsCost}
                onChangeText={setMaterialsCost}
                keyboardType="numeric"
                placeholder="0"
              />
              <Text style={styles.inputLabel}>Коментар до роботи</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={providerNotes}
                onChangeText={setProviderNotes}
                multiline
                placeholder="Опишіть виконану роботу..."
              />
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowCompleteModal(false)}
              >
                <Text style={styles.cancelButtonText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={submitComplete}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Завершити</Text>
                )}
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, paddingTop: 60, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },

  content: { flex: 1 },

  statusBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 14, gap: 8,
  },
  statusText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  section: { backgroundColor: '#fff', padding: 20, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  description: { fontSize: 15, color: '#4b5563', lineHeight: 22 },

  // ── Progress steps ──────────────────────────────────────────────────────────
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  stepItem: { alignItems: 'center', flex: 1 },
  stepCircle: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 6,
  },
  stepCircleInactive: { backgroundColor: '#e5e7eb' },
  stepLabel: { fontSize: 10, color: '#9ca3af', textAlign: 'center', lineHeight: 13 },
  stepLine: {
    flex: 1, height: 3, backgroundColor: '#e5e7eb',
    marginTop: 18, marginHorizontal: -4,
  },

  // ── Timeline ────────────────────────────────────────────────────────────────
  timelineCard: {
    backgroundColor: '#f9fafb', borderRadius: 12, padding: 16,
  },
  timelineRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12,
  },
  timelineDot: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  timelineContent: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timelineLabel: { fontSize: 14, color: '#6b7280' },
  timelineTime: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },

  durationBox: {
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#e5e7eb',
    gap: 10,
  },
  durationItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  durationLabel: { fontSize: 13, color: '#6b7280', flex: 1 },
  durationValue: { fontSize: 14, fontWeight: '700', color: '#111827' },

  // ── Details ─────────────────────────────────────────────────────────────────
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 12 },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  detailValue: { fontSize: 15, color: '#111827' },

  // ── Pricing ─────────────────────────────────────────────────────────────────
  priceCard: { backgroundColor: '#f9fafb', padding: 16, borderRadius: 12 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  priceLabel: { fontSize: 14, color: '#6b7280' },
  priceValueGreen: { fontSize: 18, fontWeight: '700', color: '#10b981' },
  noPrice: { fontSize: 14, color: '#9ca3af', fontStyle: 'italic' },

  // ── Client ──────────────────────────────────────────────────────────────────
  clientCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clientAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e5e7eb' },
  clientAvatarPlaceholder: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#dbeafe',
    justifyContent: 'center', alignItems: 'center',
  },
  clientAvatarInitial: { fontSize: 20, fontWeight: '700', color: '#2563eb' },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  clientPhone: { fontSize: 14, color: '#6b7280', marginTop: 2 },

  // ── Photos ──────────────────────────────────────────────────────────────────
  photo: { width: 120, height: 120, borderRadius: 12, marginRight: 12 },

  // ── Notes ───────────────────────────────────────────────────────────────────
  notesCard: { backgroundColor: '#f0fdf4', padding: 14, borderRadius: 12 },
  notesText: { fontSize: 14, color: '#166534', lineHeight: 20 },

  // ── Footer button ───────────────────────────────────────────────────────────
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, paddingBottom: 32, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#e5e7eb',
  },
  actionButton: {
    flexDirection: 'row', padding: 16,
    borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  actionButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // ── Modal ───────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  modalBody: { padding: 20 },
  modalFooter: { flexDirection: 'row', gap: 12, padding: 20, paddingTop: 0 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  inputHint: { fontSize: 12, color: '#9ca3af', marginTop: -10, marginBottom: 16 },
  input: {
    backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db',
    borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 16,
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  modalButton: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f3f4f6' },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  submitButton: { backgroundColor: '#22c55e' },
  submitButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
