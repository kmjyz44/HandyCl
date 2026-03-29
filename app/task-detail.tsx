import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal, Image, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; icon: string }> = {
  draft:                     { label: 'Чернетка',            color: '#9ca3af', icon: 'document-outline' },
  posted:                    { label: 'Очікує виконавця',    color: '#3b82f6', icon: 'time-outline' },
  offering:                  { label: 'Приймає пропозиції',  color: '#8b5cf6', icon: 'chatbubbles-outline' },
  assigned:                  { label: 'Прийнято',            color: '#f59e0b', icon: 'checkmark-circle-outline' },
  on_the_way:                { label: 'Виконавець в дорозі', color: '#06b6d4', icon: 'car-outline' },
  started:                   { label: 'Виконується',         color: '#f97316', icon: 'construct-outline' },
  completed_pending_payment: { label: 'Завершено — очікує оплати', color: '#22c55e', icon: 'checkmark-done-circle-outline' },
  paid:                      { label: 'Оплачено',            color: '#10b981', icon: 'card-outline' },
  cancelled_by_client:       { label: 'Скасовано клієнтом',  color: '#ef4444', icon: 'close-circle-outline' },
  cancelled_by_tasker:       { label: 'Скасовано виконавцем',color: '#ef4444', icon: 'close-circle-outline' },
};

// ─── 4 progress steps ────────────────────────────────────────────────────────
const STEPS = [
  { key: 'assigned',                  label: 'Прийняв',     icon: 'checkmark-circle',      color: '#f59e0b', tsField: 'accepted_at' },
  { key: 'on_the_way',                label: 'Виїхав',      icon: 'car',                   color: '#06b6d4', tsField: 'on_the_way_at' },
  { key: 'started',                   label: 'Почав',       icon: 'construct',             color: '#f97316', tsField: 'started_at' },
  { key: 'completed_pending_payment', label: 'Закінчив',    icon: 'checkmark-done-circle', color: '#22c55e', tsField: 'completed_at' },
];

const STEP_ORDER = ['posted','offering','assigned','on_the_way','started','completed_pending_payment','paid'];

// ─── Executor action buttons ──────────────────────────────────────────────────
const EXEC_ACTIONS: Record<string, { action: string; label: string; color: string; icon: string }> = {
  posted:      { action: 'accept',     label: 'Прийняти завдання', color: '#2563eb', icon: 'checkmark-circle' },
  offering:    { action: 'accept',     label: 'Прийняти завдання', color: '#2563eb', icon: 'checkmark-circle' },
  assigned:    { action: 'on_the_way', label: 'Виїхав',            color: '#06b6d4', icon: 'car' },
  on_the_way:  { action: 'start',      label: 'Почати роботу',     color: '#f97316', icon: 'construct' },
  started:     { action: 'complete',   label: 'Закінчити роботу',  color: '#22c55e', icon: 'checkmark-done-circle' },
  hold_placed: { action: 'complete',   label: 'Закінчити роботу',  color: '#22c55e', icon: 'checkmark-done-circle' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    // Backend stores UTC without Z suffix — add it so JS parses as UTC, then displays in local time
    const normalized = /[Z+]/.test(iso) ? iso : iso + 'Z';
    const d = new Date(normalized);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}.${p(d.getMonth()+1)} о ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch { return '—'; }
}

function calcDuration(start?: string | null, end?: string | null): string {
  if (!start) return '—';
  try {
    const norm = (iso: string) => /[Z+]/.test(iso) ? iso : iso + 'Z';
    const s = new Date(norm(start)).getTime();
    const e = end ? new Date(norm(end)).getTime() : Date.now();
    const diff = e - s;
    if (diff <= 0) return '—';
    const h = Math.floor(diff / 3600000);
    const m = Math.round((diff % 3600000) / 60000);
    if (h === 0) return `${m} хв`;
    if (m === 0) return `${h} год`;
    return `${h} год ${m} хв`;
  } catch { return '—'; }
}

// ─── Payment methods by country ───────────────────────────────────────────────
const UA_METHODS = [
  { id: 'monobank',    label: 'Monobank',    icon: 'card', color: '#1a1a2e' },
  { id: 'privatbank',  label: 'ПриватБанк',  icon: 'card', color: '#007bff' },
  { id: 'cash',        label: 'Готівка',     icon: 'cash', color: '#22c55e' },
  { id: 'other_ua',    label: 'Інший банк',  icon: 'wallet', color: '#6b7280' },
];
const US_METHODS = [
  { id: 'card',   label: 'Credit/Debit Card', icon: 'card',   color: '#2563eb' },
  { id: 'zelle',  label: 'Zelle',             icon: 'flash',  color: '#6d28d9' },
  { id: 'venmo',  label: 'Venmo',             icon: 'logo-venmo', color: '#008cff' },
  { id: 'cash',   label: 'Cash',              icon: 'cash',   color: '#22c55e' },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();

  const [task, setTask] = useState<any>(null);
  const [taskId, setTaskId] = useState<string>(id); // may update after accept
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Invoice modal
  const [showInvoice, setShowInvoice] = useState(false);
  const [hours, setHours] = useState('');
  const [materials, setMaterials] = useState('');
  const [closingMsg, setClosingMsg] = useState('Дякую за довіру! Якщо вам сподобалась робота — залиште відгук.');
  const [ongoingJob, setOngoingJob] = useState(false);

  // Payment modal
  const [showPayment, setShowPayment] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('');

  // Review modal (shown after payment)
  const [showReview, setShowReview] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewTip, setReviewTip] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Decline modal
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [decliningLoading, setDecliningLoading] = useState(false);

  useEffect(() => { loadTask(); }, [taskId]);

  const loadTask = async () => {
    try {
      const data = await api.getTask(taskId);
      setTask(data);
      // If task was loaded by booking_id but has a real task_id, update
      if (data.task_id && data.task_id !== taskId) {
        setTaskId(data.task_id);
      }
    } catch (e: any) {
      Alert.alert('Помилка', 'Не вдалося завантажити завдання');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string) => {
    if (action === 'complete') { setShowInvoice(true); return; }
    setActionLoading(true);
    try {
      let res: any;
      switch (action) {
        case 'accept':
          res = await api.acceptTask(taskId);
          // Use the new task_id returned from backend
          if (res?.new_task_id || res?.task_id) {
            const newId = res.new_task_id || res.task_id;
            setTaskId(newId);
          }
          Alert.alert('Успіх', 'Ви прийняли завдання!');
          break;
        case 'on_the_way':
          res = await api.onTheWayTask(taskId);
          if (res?.task_id) setTaskId(res.task_id);
          Alert.alert('Успіх', 'Статус: Виїхав');
          break;
        case 'start':
          res = await api.startTask(taskId);
          if (res?.task_id) setTaskId(res.task_id);
          Alert.alert('Успіх', 'Роботу розпочато!');
          break;
      }
      await loadTask();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e.message || 'Помилка';
      Alert.alert('Помилка', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const submitInvoice = async () => {
    setActionLoading(true);
    try {
      const res = await api.completeTask(taskId, {
        actual_hours: hours ? parseFloat(hours) : undefined,
        materials_cost: materials ? parseFloat(materials) : undefined,
        provider_notes: closingMsg || undefined,
      });
      const hrs = res?.actual_hours ?? hours ?? '—';
      setShowInvoice(false);
      if (Platform.OS === 'web') {
        window.alert(`✅ Завдання завершено!\nВідпрацьовано: ${hrs} год\nКлієнт отримає сповіщення про оплату.`);
        router.replace('/(tabs)/bookings');
      } else {
        Alert.alert(
          'Завдання завершено!',
          `Відпрацьовано: ${hrs} год\nКлієнт отримає сповіщення про оплату.`,
          [{ text: 'ОК', onPress: () => router.replace('/(tabs)/bookings') }]
        );
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e.message || 'Помилка';
      Alert.alert('Помилка', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const submitPayment = async () => {
    if (!selectedMethod) { Alert.alert('Оберіть спосіб оплати'); return; }
    setActionLoading(true);
    try {
      await api.payTask(taskId, { payment_method: selectedMethod });
      setShowPayment(false);
      await loadTask();
      // Show review modal after successful payment
      setShowReview(true);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e.message || 'Помилка';
      Alert.alert('Помилка', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const submitReview = async () => {
    if (reviewRating < 1 || reviewRating > 5) { Alert.alert('Оберіть оцінку від 1 до 5'); return; }
    setReviewSubmitting(true);
    try {
      // Use booking_id if available, otherwise task_id
      const bookingId = task.booking_id || task.booking?.booking_id || taskId;
      await api.createReview({
        booking_id: bookingId,
        rating: reviewRating,
        comment: reviewComment || undefined,
        tip_amount: reviewTip ? parseFloat(reviewTip) : undefined,
      });
      setShowReview(false);
      if (Platform.OS === 'web') {
        window.alert('Дякуємо за відгук! Ваша оцінка допоможе іншим клієнтам.');
      } else {
        Alert.alert('Дякуємо!', 'Ваш відгук збережено.', [{ text: 'ОК' }]);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e.message || 'Помилка';
      // If already reviewed, just close
      if (msg.includes('already reviewed') || msg.includes('вже')) {
        setShowReview(false);
      } else {
        Alert.alert('Помилка', msg);
      }
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!declineReason.trim()) {
      Alert.alert('Вкажіть причину', 'Будь ласка, вкажіть коротку причину відмови.');
      return;
    }
    setDecliningLoading(true);
    try {
      await api.declineTask(taskId, declineReason.trim());
      // Close modal immediately
      setShowDecline(false);
      setDeclineReason('');
      if (Platform.OS === 'web') {
        window.alert('Завдання відхилено. Клієнт отримає сповіщення.');
        router.replace('/(tabs)/tasks');
      } else {
        Alert.alert('Відхилено', 'Завдання відхилено. Клієнт отримає сповіщення.', [
          { text: 'ОК', onPress: () => router.replace('/(tabs)/tasks') },
        ]);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e.message || 'Помилка';
      if (Platform.OS === 'web') window.alert('Помилка: ' + msg);
      else Alert.alert('Помилка', msg);
    } finally {
      setDecliningLoading(false);
    }
  };

  if (loading) {
    return <View style={s.centered}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }
  if (!task) return null;

  const status = task.status || 'posted';
  const cfg = STATUS_CFG[status] || { label: status, color: '#6b7280', icon: 'help-circle-outline' };
  const isProvider = user?.role === 'provider';
  const isClient = user?.role === 'client';
  const isMyTask = task.provider_id === user?.user_id;
  const isOpenTask = !task.provider_id && (status === 'posted' || status === 'offering');
  const execAction = isProvider ? (isOpenTask ? EXEC_ACTIONS['posted'] : isMyTask ? EXEC_ACTIONS[status] : null) : null;
  const showPayBtn = isClient && status === 'completed_pending_payment' && task.client_id === user?.user_id;

  const price = task.estimated_price || task.total_price;
  const hourlyRate = task.hourly_rate || 25;
  // Auto-calculate hours from started_at if not manually entered
  const autoHours = (() => {
    if (!task.started_at) return 0;
    try {
      const start = new Date(task.started_at.endsWith('Z') ? task.started_at : task.started_at + 'Z');
      const diff = (Date.now() - start.getTime()) / 3600000;
      return Math.max(0, Math.round(diff * 100) / 100);
    } catch { return 0; }
  })();
  const parsedHours = parseFloat(hours) || autoHours;
  const laborCost = Math.round(parsedHours * hourlyRate * 100) / 100;
  const matCost = parseFloat(materials) || 0;
  const totalEarnings = laborCost + matCost;
  const platformFee = Math.round(totalEarnings * 0.15 * 100) / 100;
  const providerEarnings = Math.round((totalEarnings - platformFee) * 100) / 100;

  const clientName = task.client?.name || 'Клієнт';
  const clientPhoto = task.client?.picture || task.client?.photo_url;
  const taskPhotos = [...(task.photos || []), ...(task.problem_photos || [])];
  const stepIdx = STEP_ORDER.indexOf(status);
  const isUA = (task.country || user?.country || 'UA').toUpperCase().includes('UA');
  const payMethods = isUA ? UA_METHODS : US_METHODS;

  return (
    <View style={s.container}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Деталі завдання</Text>
        <TouchableOpacity
          style={s.chatBtn}
          onPress={() => router.push({ pathname: '/task-chat', params: { taskId, taskTitle: task.title } })}
        >
          <Ionicons name="chatbubble-ellipses" size={22} color="#2563eb" />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
        {/* ── Status Banner ── */}
        <View style={[s.statusBar, { backgroundColor: cfg.color }]}>
          <Ionicons name={cfg.icon as any} size={20} color="#fff" />
          <Text style={s.statusText}>{cfg.label}</Text>
        </View>

        {/* ── Title ── */}
        <View style={s.section}>
          <Text style={s.title}>{task.title || 'Без назви'}</Text>
          {!!task.description && <Text style={s.desc}>{task.description}</Text>}
        </View>

        {/* ── 4-Step Progress Bar ── */}
        {stepIdx >= STEP_ORDER.indexOf('assigned') && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Прогрес завдання</Text>
            <View style={s.stepsRow}>
              {STEPS.map((step, idx) => {
                const reached = stepIdx >= STEP_ORDER.indexOf(step.key);
                const isLast = idx === STEPS.length - 1;
                return (
                  <React.Fragment key={step.key}>
                    <View style={s.stepItem}>
                      <View style={[s.stepCircle, reached ? { backgroundColor: step.color } : s.stepCircleOff]}>
                        <Ionicons name={step.icon as any} size={18} color={reached ? '#fff' : '#9ca3af'} />
                      </View>
                      <Text style={[s.stepLabel, reached && { color: step.color, fontWeight: '700' }]}>
                        {step.label}
                      </Text>
                    </View>
                    {!isLast && (
                      <View style={[
                        s.stepLine,
                        stepIdx >= STEP_ORDER.indexOf(STEPS[idx+1].key) && { backgroundColor: STEPS[idx+1].color }
                      ]} />
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Timeline / Chronology ── */}
        {(task.accepted_at || task.on_the_way_at || task.started_at || task.completed_at) && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Хронологія</Text>
            <View style={s.timeline}>
              {STEPS.map((step, idx) => {
                const ts = task[step.tsField];
                const reached = stepIdx >= STEP_ORDER.indexOf(step.key);
                if (!reached && !ts) return null;
                const isLast = idx === STEPS.length - 1;
                return (
                  <View key={step.key} style={s.tlRow}>
                    {/* Left: dot + vertical line */}
                    <View style={s.tlLeft}>
                      <View style={[s.tlDot, { backgroundColor: reached ? step.color : '#e5e7eb' }]}>
                        <Ionicons name={step.icon as any} size={14} color={reached ? '#fff' : '#9ca3af'} />
                      </View>
                      {!isLast && <View style={[s.tlLine, reached && { backgroundColor: step.color }]} />}
                    </View>
                    {/* Right: label + time */}
                    <View style={s.tlRight}>
                      <Text style={[s.tlLabel, reached && { color: '#111827', fontWeight: '600' }]}>
                        {step.label}
                      </Text>
                      <Text style={[s.tlTime, { color: reached ? step.color : '#9ca3af' }]}>
                        {fmtTime(ts)}
                      </Text>
                    </View>
                  </View>
                );
              })}

              {/* Duration summary */}
              {(task.on_the_way_at || task.started_at) && (
                <View style={s.durBox}>
                  {task.on_the_way_at && (
                    <View style={s.durRow}>
                      <Ionicons name="car-outline" size={16} color="#06b6d4" />
                      <Text style={s.durLabel}>Час в дорозі</Text>
                      <Text style={[s.durVal, { color: '#06b6d4' }]}>
                        {calcDuration(task.on_the_way_at, task.started_at)}
                      </Text>
                    </View>
                  )}
                  {task.started_at && (
                    <View style={s.durRow}>
                      <Ionicons name="construct-outline" size={16} color="#f97316" />
                      <Text style={s.durLabel}>Час роботи</Text>
                      <Text style={[s.durVal, { color: '#f97316' }]}>
                        {calcDuration(task.started_at, task.completed_at)}
                        {!task.completed_at ? ' (зараз)' : ''}
                      </Text>
                    </View>
                  )}
                  {task.actual_hours != null && (
                    <View style={s.durRow}>
                      <Ionicons name="hourglass-outline" size={16} color="#2563eb" />
                      <Text style={s.durLabel}>Відпрацьовано</Text>
                      <Text style={[s.durVal, { color: '#2563eb' }]}>{task.actual_hours} год</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Details ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Деталі</Text>
          {!!task.address && (
            <View style={s.detailRow}>
              <Ionicons name="location-outline" size={20} color="#6b7280" />
              <View style={s.detailContent}>
                <Text style={s.detailLabel}>Адреса</Text>
                <Text style={s.detailVal}>{task.address}</Text>
              </View>
            </View>
          )}
          {(task.scheduled_date || task.date || task.scheduled_time || task.time) && (
            <View style={s.detailRow}>
              <Ionicons name="calendar-outline" size={20} color="#6b7280" />
              <View style={s.detailContent}>
                <Text style={s.detailLabel}>Дата та час</Text>
                <Text style={s.detailVal}>
                  {task.scheduled_date || task.date || ''}
                  {(task.scheduled_date || task.date) && (task.scheduled_time || task.time) ? ' о ' : ''}
                  {task.scheduled_time || task.time || ''}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Pricing ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Вартість</Text>
          <View style={s.priceCard}>
            {/* Estimated price (before work) */}
            {!task.final_price && price != null && price > 0 && (
              <View style={s.priceRow}>
                <Text style={s.priceLabel}>Орієнтовна ціна</Text>
                <Text style={s.priceGreen}>{price} грн</Text>
              </View>
            )}
            {/* After completion — show full breakdown */}
            {!!task.final_price && (
              <>
                {!!task.actual_hours && (
                  <View style={s.priceRow}>
                    <Text style={s.priceLabel}>Відпрацьовано</Text>
                    <Text style={s.priceLabel}>{task.actual_hours} год × {task.hourly_rate || 0} грн/год</Text>
                  </View>
                )}
                {!!task.labor_cost && (
                  <View style={s.priceRow}>
                    <Text style={s.priceLabel}>Вартість роботи</Text>
                    <Text style={s.priceLabel}>{task.labor_cost} грн</Text>
                  </View>
                )}
                {!!task.materials_cost && task.materials_cost > 0 && (
                  <View style={s.priceRow}>
                    <Text style={s.priceLabel}>Матеріали</Text>
                    <Text style={s.priceLabel}>{task.materials_cost} грн</Text>
                  </View>
                )}
                <View style={[s.priceRow, { borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 8, paddingTop: 8 }]}>
                  <Text style={[s.priceLabel, { fontWeight: '700', fontSize: 15 }]}>Загальна сума</Text>
                  <Text style={[s.priceGreen, { fontSize: 22, fontWeight: '800' }]}>{task.final_price} грн</Text>
                </View>
                {/* Provider sees their payout */}
                {isProvider && isMyTask && !!task.provider_payout && (
                  <View style={[s.priceRow, { backgroundColor: '#f0fdf4', borderRadius: 8, padding: 8, marginTop: 8 }]}>
                    <Text style={[s.priceLabel, { color: '#16a34a' }]}>Ваш заробіток (85%)</Text>
                    <Text style={[s.priceGreen, { color: '#16a34a', fontSize: 18, fontWeight: '700' }]}>{task.provider_payout} грн</Text>
                  </View>
                )}
              </>
            )}
            {!task.final_price && !price && (
              <Text style={s.noPrice}>Ціна буде розрахована після завершення</Text>
            )}
          </View>
        </View>

        {/* ── Client ── */}
        {task.client && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Клієнт</Text>
            <View style={s.clientCard}>
              {clientPhoto
                ? <Image source={{ uri: clientPhoto }} style={s.avatar} />
                : (
                  <View style={s.avatarPlaceholder}>
                    <Text style={s.avatarInitial}>{clientName.charAt(0).toUpperCase()}</Text>
                  </View>
                )
              }
              <View style={{ flex: 1 }}>
                <Text style={s.clientName}>{clientName}</Text>
                {task.client.phone && <Text style={s.clientPhone}>{task.client.phone}</Text>}
              </View>
            </View>
          </View>
        )}

        {/* ── Photos ── */}
        {taskPhotos.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Фото завдання</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {taskPhotos.map((p: string, i: number) => (
                <Image
                  key={i}
                  source={{ uri: p.startsWith('http') ? p : `data:image/jpeg;base64,${p}` }}
                  style={s.photo}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Provider notes ── */}
        {!!task.provider_notes && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Коментар виконавця</Text>
            <View style={s.notesCard}>
              <Text style={s.notesText}>{task.provider_notes}</Text>
            </View>
          </View>
        )}

        <View style={{ height: 160 }} />
      </ScrollView>

      {/* ── Footer buttons ── */}
      <View style={s.footer}>
        {/* Chat button */}
        <TouchableOpacity
          style={s.chatFooterBtn}
          onPress={() => router.push(`/chat?taskId=${taskId}&otherUserId=${isProvider ? task.client?.user_id : task.provider?.user_id}`)}
        >
          <Ionicons name="chatbubble-ellipses" size={20} color="#2563eb" />
          <Text style={s.chatFooterText}>Чат</Text>
        </TouchableOpacity>

        {/* Executor action + decline stacked vertically */}
        {(execAction || (isProvider && ['posted','offering','assigned','hold_placed'].includes(status))) && (
          <View style={{ flex: 1, gap: 8 }}>
            {execAction && (
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: execAction.color }, actionLoading && s.btnDisabled]}
                onPress={() => handleAction(execAction.action)}
                disabled={actionLoading}
              >
                {actionLoading
                  ? <ActivityIndicator color="#fff" />
                  : <>
                      <Ionicons name={execAction.icon as any} size={22} color="#fff" />
                      <Text style={s.actionBtnText}>{execAction.label}</Text>
                    </>
                }
              </TouchableOpacity>
            )}
            {isProvider && ['posted','offering','assigned','hold_placed'].includes(status) && (
              <TouchableOpacity
                style={s.declineBtnFull}
                onPress={() => setShowDecline(true)}
              >
                <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
                <Text style={s.declineBtnText}>Відхилити завдання</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Client payment button */}
        {showPayBtn && (
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: '#10b981', flex: 1 }]}
            onPress={() => setShowPayment(true)}
          >
            <Ionicons name="card" size={22} color="#fff" />
            <Text style={s.actionBtnText}>Оплатити завдання</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ═══════════════════════════════════════════════════════════════
          INVOICE MODAL (TaskRabbit-style)
      ═══════════════════════════════════════════════════════════════ */}
      <Modal visible={showInvoice} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Закрити завдання</Text>
              <TouchableOpacity onPress={() => setShowInvoice(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={s.modalBody}>
              {/* Client */}
              <View style={s.invoiceRow}>
                <Text style={s.invoiceLabel}>Клієнт</Text>
                <Text style={s.invoiceVal}>{clientName}</Text>
              </View>

              {/* Hours */}
              <View style={s.invoiceRow}>
                <Text style={s.invoiceLabel}>Відпрацьовано годин</Text>
                <View style={s.invoiceInput}>
                  <TextInput
                    style={s.invoiceInputText}
                    value={hours}
                    onChangeText={setHours}
                    keyboardType="numeric"
                    placeholder={task.started_at ? 'авто' : '0'}
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>
              {task.started_at && !hours && (
                <Text style={s.autoHint}>
                  Авто: {calcDuration(task.started_at, undefined)}
                </Text>
              )}

              {/* Materials */}
              <View style={s.invoiceRow}>
                <Text style={s.invoiceLabel}>Витрати на матеріали</Text>
                <View style={s.invoiceInput}>
                  <TextInput
                    style={s.invoiceInputText}
                    value={materials}
                    onChangeText={setMaterials}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>

              {/* Earnings preview — always visible */}
              <View style={s.earningsCard}>
                <Text style={s.earningsTitle}>Розрахунок заробітку</Text>
                <View style={s.earningsRow}>
                  <Text style={s.earningsLabel}>Погодинна ставка</Text>
                  <Text style={s.earningsVal}>{hourlyRate} грн/год</Text>
                </View>
                <View style={s.earningsRow}>
                  <Text style={s.earningsLabel}>Праця ({parsedHours.toFixed(2)} год)</Text>
                  <Text style={s.earningsVal}>{laborCost} грн</Text>
                </View>
                {matCost > 0 && (
                  <View style={s.earningsRow}>
                    <Text style={s.earningsLabel}>Матеріали</Text>
                    <Text style={s.earningsVal}>{matCost} грн</Text>
                  </View>
                )}
                <View style={[s.earningsRow, s.earningsDivider]}>
                  <Text style={s.earningsLabel}>Комісія платформи (15%)</Text>
                  <Text style={[s.earningsVal, { color: '#ef4444' }]}>−{platformFee} грн</Text>
                </View>
                {/* Big highlighted payout */}
                <View style={s.earningsPayoutBox}>
                  <Text style={s.earningsPayoutLabel}>Ваш заробіток</Text>
                  <Text style={s.earningsPayoutValue}>{providerEarnings} грн</Text>
                </View>
              </View>

              {/* Closing message */}
              <Text style={s.inputLabel}>Повідомлення клієнту</Text>
              <TextInput
                style={[s.input, s.textArea]}
                value={closingMsg}
                onChangeText={setClosingMsg}
                multiline
                placeholder="Повідомлення після закриття завдання..."
              />

              {/* Ongoing job toggle */}
              <View style={s.toggleRow}>
                <Text style={s.toggleLabel}>Постійна робота</Text>
                <Switch value={ongoingJob} onValueChange={setOngoingJob} trackColor={{ true: '#22c55e' }} />
              </View>
            </ScrollView>

            <View style={s.modalFooter}>
              <TouchableOpacity style={[s.modalBtn, s.cancelBtn]} onPress={() => setShowInvoice(false)}>
                <Text style={s.cancelBtnText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, s.submitBtn, actionLoading && s.btnDisabled]}
                onPress={submitInvoice}
                disabled={actionLoading}
              >
                {actionLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.submitBtnText}>Надіслати рахунок</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════
          PAYMENT MODAL (Client)
      ═══════════════════════════════════════════════════════════════ */}
      <Modal visible={showPayment} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Оплата завдання</Text>
              <TouchableOpacity onPress={() => setShowPayment(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={s.modalBody}>
              {/* Summary */}
              {(() => {
                // Calculate total for client: labor + materials + 15% platform fee
                const fp = task.final_price;
                const ah = task.actual_hours;
                const hr = task.hourly_rate || hourlyRate;
                const mc = task.materials_cost || 0;
                const laborBase = fp ? fp : (ah && hr ? Math.round(ah * hr * 100) / 100 : (price || 0));
                const totalBase = fp || (laborBase + mc);
                const platformFeeAmt = Math.round(totalBase * 0.15 * 100) / 100;
                const clientTotal = Math.round((totalBase + platformFeeAmt) * 100) / 100;
                const providerPayout = Math.round(totalBase * 0.85 * 100) / 100;
                return (
                  <>
                    <View style={s.paymentSummary}>
                      <View style={s.payRow}>
                        <Text style={s.payLabel}>Виконавець</Text>
                        <Text style={s.payVal}>{task.provider?.name || 'Виконавець'}</Text>
                      </View>
                      {ah != null && (
                        <View style={s.payRow}>
                          <Text style={s.payLabel}>Відпрацьовано</Text>
                          <Text style={[s.payVal, { color: '#2563eb' }]}>{ah} год × {hr} грн/год = {Math.round(ah * hr)} грн</Text>
                        </View>
                      )}
                      {mc > 0 && (
                        <View style={s.payRow}>
                          <Text style={s.payLabel}>Матеріали</Text>
                          <Text style={s.payVal}>{mc} грн</Text>
                        </View>
                      )}
                      <View style={s.payRow}>
                        <Text style={s.payLabel}>Комісія сервісу (15%)</Text>
                        <Text style={[s.payVal, { color: '#ef4444' }]}>+{platformFeeAmt} грн</Text>
                      </View>
                      <View style={[s.payRow, s.payTotal]}>
                        <Text style={s.payTotalLabel}>Сума до оплати</Text>
                        <Text style={[s.payTotalVal, { color: '#10b981', fontSize: 22 }]}>{clientTotal > 0 ? clientTotal : '—'} грн</Text>
                      </View>
                    </View>

                    {/* Split info */}
                    <View style={s.splitCard}>
                      <Text style={s.splitTitle}>Розподіл оплати</Text>
                      <View style={s.splitRow}>
                        <Ionicons name="person-outline" size={16} color="#22c55e" />
                        <Text style={s.splitLabel}>Виконавцю</Text>
                        <Text style={[s.splitVal, { color: '#22c55e' }]}>{providerPayout} грн</Text>
                      </View>
                      <View style={s.splitRow}>
                        <Ionicons name="business-outline" size={16} color="#6b7280" />
                        <Text style={s.splitLabel}>Комісія платформи (15%)</Text>
                        <Text style={s.splitVal}>{platformFeeAmt} грн</Text>
                      </View>
                    </View>
                  </>
                );
              })()}

              {/* Payment methods */}
              <Text style={[s.inputLabel, { marginTop: 16 }]}>Спосіб оплати</Text>
              {payMethods.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[s.methodCard, selectedMethod === m.id && { borderColor: m.color, borderWidth: 2 }]}
                  onPress={() => setSelectedMethod(m.id)}
                >
                  <View style={[s.methodIcon, { backgroundColor: m.color + '22' }]}>
                    <Ionicons name={m.icon as any} size={22} color={m.color} />
                  </View>
                  <Text style={s.methodLabel}>{m.label}</Text>
                  {selectedMethod === m.id && (
                    <Ionicons name="checkmark-circle" size={22} color={m.color} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={s.modalFooter}>
              <TouchableOpacity style={[s.modalBtn, s.cancelBtn]} onPress={() => setShowPayment(false)}>
                <Text style={s.cancelBtnText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, s.submitBtn, { backgroundColor: '#10b981' }, actionLoading && s.btnDisabled]}
                onPress={submitPayment}
                disabled={actionLoading}
              >
                {actionLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.submitBtnText}>Підтвердити оплату</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════
          REVIEW MODAL (after payment)
      ═══════════════════════════════════════════════════════════════ */}
      <Modal visible={showReview} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Відгук про виконавця</Text>
              <TouchableOpacity onPress={() => setShowReview(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={s.modalBody}>
              {/* Provider info */}
              <View style={s.reviewProviderRow}>
                {task.provider?.picture || task.provider?.photo_url ? (
                  <Image source={{ uri: task.provider.picture || task.provider.photo_url }} style={s.reviewAvatar} />
                ) : (
                  <View style={[s.reviewAvatar, s.reviewAvatarPlaceholder]}>
                    <Text style={s.reviewAvatarInitial}>
                      {(task.provider?.name || 'В')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.reviewProviderName}>{task.provider?.name || 'Виконавець'}</Text>
                  <Text style={s.reviewProviderSub}>{task.title || 'Завдання'}</Text>
                </View>
              </View>

              {/* Star rating */}
              <Text style={[s.inputLabel, { marginTop: 20, marginBottom: 12 }]}>Оцінка виконавця</Text>
              <View style={s.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setReviewRating(star)} style={s.starBtn}>
                    <Ionicons
                      name={star <= reviewRating ? 'star' : 'star-outline'}
                      size={36}
                      color={star <= reviewRating ? '#f59e0b' : '#d1d5db'}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.ratingLabel}>
                {reviewRating === 1 ? 'Погано' : reviewRating === 2 ? 'Нижче середнього' : reviewRating === 3 ? 'Нормально' : reviewRating === 4 ? 'Добре' : 'Відмінно'}
              </Text>

              {/* Comment */}
              <Text style={[s.inputLabel, { marginTop: 20 }]}>Коментар (необов’язково)</Text>
              <TextInput
                style={[s.input, s.textArea]}
                value={reviewComment}
                onChangeText={setReviewComment}
                multiline
                placeholder="Напишіть ваш відгук..."
                placeholderTextColor="#9ca3af"
              />

              {/* Tip */}
              <View style={s.tipCard}>
                <View style={s.tipHeader}>
                  <Ionicons name="gift-outline" size={20} color="#f59e0b" />
                  <Text style={s.tipTitle}>Чайові (необов’язково)</Text>
                </View>
                <Text style={s.tipHint}>Покажіть вдячність за чудову роботу — 100% виконавцю</Text>
                {/* Quick tip buttons */}
                <View style={s.tipBtns}>
                  {['50', '100', '200', '500'].map((amt) => (
                    <TouchableOpacity
                      key={amt}
                      style={[s.tipAmtBtn, reviewTip === amt && s.tipAmtBtnActive]}
                      onPress={() => setReviewTip(reviewTip === amt ? '' : amt)}
                    >
                      <Text style={[s.tipAmtText, reviewTip === amt && s.tipAmtTextActive]}>
                        +{amt} грн
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={[s.input, { marginBottom: 0, marginTop: 8 }]}
                  value={reviewTip}
                  onChangeText={setReviewTip}
                  keyboardType="numeric"
                  placeholder="Або введіть свою суму..."
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </ScrollView>

            <View style={s.modalFooter}>
              <TouchableOpacity
                style={[s.modalBtn, s.cancelBtn]}
                onPress={() => setShowReview(false)}
              >
                <Text style={s.cancelBtnText}>Пропустити</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, s.submitBtn, { backgroundColor: '#f59e0b' }, reviewSubmitting && s.btnDisabled]}
                onPress={submitReview}
                disabled={reviewSubmitting}
              >
                {reviewSubmitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.submitBtnText}>Надіслати відгук</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════
          DECLINE MODAL
      ═══════════════════════════════════════════════════════════════ */}
      <Modal visible={showDecline} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={[s.modalBox, { maxHeight: 380 }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Відхилити завдання</Text>
              <TouchableOpacity onPress={() => { setShowDecline(false); setDeclineReason(''); }}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={s.modalBody}>
              <Text style={[s.inputLabel, { marginBottom: 8 }]}>Причина відмови *</Text>
              <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                Клієнт отримає сповіщення з причиною відмови.
              </Text>
              {/* Quick reason chips */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {['Зайнятий', 'Не моя спеціалізація', 'Незручна адреса', 'Інша причина'].map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[s.tipAmtBtn, declineReason === r && s.tipAmtBtnActive, { borderColor: '#ef4444' }]}
                    onPress={() => setDeclineReason(declineReason === r ? '' : r)}
                  >
                    <Text style={[s.tipAmtText, declineReason === r && { color: '#fff' }]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[s.input, s.textArea, { minHeight: 80 }]}
                value={declineReason}
                onChangeText={setDeclineReason}
                multiline
                placeholder="Або напишіть свою причину..."
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={s.modalFooter}>
              <TouchableOpacity
                style={[s.modalBtn, s.cancelBtn]}
                onPress={() => { setShowDecline(false); setDeclineReason(''); }}
              >
                <Text style={s.cancelBtnText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: '#ef4444', flex: 1 }, decliningLoading && s.btnDisabled]}
                onPress={handleDecline}
                disabled={decliningLoading}
              >
                {decliningLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.submitBtnText}>Відхилити</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, paddingTop: 60, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  backBtn:     { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  chatBtn:     { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

  content: { flex: 1 },

  statusBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 14, gap: 8,
  },
  statusText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  section:      { backgroundColor: '#fff', padding: 20, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 16 },
  title:        { fontSize: 22, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  desc:         { fontSize: 15, color: '#4b5563', lineHeight: 22 },

  // ── Steps ──
  stepsRow:       { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  stepItem:       { alignItems: 'center', flex: 1 },
  stepCircle:     { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  stepCircleOff:  { backgroundColor: '#e5e7eb' },
  stepLabel:      { fontSize: 10, color: '#9ca3af', textAlign: 'center', lineHeight: 13 },
  stepLine:       { flex: 1, height: 3, backgroundColor: '#e5e7eb', marginTop: 18, marginHorizontal: -4 },

  // ── Timeline ──
  timeline: { gap: 0 },
  tlRow:    { flexDirection: 'row', alignItems: 'flex-start', minHeight: 56 },
  tlLeft:   { width: 36, alignItems: 'center' },
  tlDot:    { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  tlLine:   { width: 2, flex: 1, backgroundColor: '#e5e7eb', marginTop: 2, marginBottom: 2 },
  tlRight:  { flex: 1, paddingLeft: 12, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tlLabel:  { fontSize: 14, color: '#6b7280' },
  tlTime:   { fontSize: 13, fontWeight: '600' },

  durBox: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb', gap: 10 },
  durRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  durLabel: { fontSize: 13, color: '#6b7280', flex: 1 },
  durVal: { fontSize: 14, fontWeight: '700', color: '#111827' },

  // ── Details ──
  detailRow:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 12 },
  detailContent: { flex: 1 },
  detailLabel:   { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  detailVal:     { fontSize: 15, color: '#111827' },

  // ── Pricing ──
  priceCard:  { backgroundColor: '#f9fafb', padding: 16, borderRadius: 12 },
  priceRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  priceLabel: { fontSize: 14, color: '#6b7280' },
  priceGreen: { fontSize: 18, fontWeight: '700', color: '#10b981' },
  noPrice:    { fontSize: 14, color: '#9ca3af', fontStyle: 'italic' },

  // ── Client ──
  clientCard:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:            { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e5e7eb' },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center' },
  avatarInitial:     { fontSize: 20, fontWeight: '700', color: '#2563eb' },
  clientName:        { fontSize: 16, fontWeight: '600', color: '#111827' },
  clientPhone:       { fontSize: 14, color: '#6b7280', marginTop: 2 },

  // ── Photos ──
  photo: { width: 120, height: 120, borderRadius: 12, marginRight: 12 },

  // ── Notes ──
  notesCard: { backgroundColor: '#f0fdf4', padding: 14, borderRadius: 12 },
  notesText: { fontSize: 14, color: '#166534', lineHeight: 20 },

  // ── Footer ──
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 10, alignItems: 'flex-end',
    padding: 16, paddingBottom: 36, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#e5e7eb',
  },
  chatFooterBtn: {
    width: 56, height: 56, borderRadius: 14, backgroundColor: '#eff6ff',
    justifyContent: 'center', alignItems: 'center', gap: 2,
  },
  chatFooterText: { fontSize: 10, color: '#2563eb', fontWeight: '600' },
  actionBtn:     { flexDirection: 'row', padding: 16, borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 8 },
  btnDisabled:   { opacity: 0.6 },
  actionBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // ── Modal shared ──
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:    { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  modalTitle:  { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  modalBody:   { padding: 20 },
  modalFooter: { flexDirection: 'row', gap: 12, padding: 20, paddingTop: 0 },
  modalBtn:    { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  cancelBtn:   { backgroundColor: '#f3f4f6' },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  submitBtn:   { backgroundColor: '#22c55e' },
  submitBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  // ── Invoice ──
  invoiceRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  invoiceLabel: { fontSize: 15, color: '#374151' },
  invoiceVal:   { fontSize: 15, fontWeight: '600', color: '#111827' },
  invoiceInput: { backgroundColor: '#f9fafb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, minWidth: 80, alignItems: 'flex-end' },
  invoiceInputText: { fontSize: 15, fontWeight: '600', color: '#111827', textAlign: 'right' },
  autoHint: { fontSize: 12, color: '#9ca3af', textAlign: 'right', marginTop: -8, marginBottom: 8 },

  earningsCard: { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 16, marginTop: 16 },
  earningsTitle: { fontSize: 14, fontWeight: '700', color: '#166534', marginBottom: 12 },
  earningsRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  earningsDivider: { borderTopWidth: 1, borderTopColor: '#bbf7d0', marginTop: 6, paddingTop: 10 },
  earningsLabel: { fontSize: 14, color: '#374151' },
  earningsVal:   { fontSize: 14, fontWeight: '600', color: '#111827' },
  earningsPayoutBox: {
    marginTop: 14, backgroundColor: '#22c55e', borderRadius: 12, padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  earningsPayoutLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },
  earningsPayoutValue: { fontSize: 28, fontWeight: '900', color: '#fff' },

  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input:      { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 16 },
  textArea:   { height: 100, textAlignVertical: 'top' },

  toggleRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  toggleLabel: { fontSize: 15, color: '#374151' },

  // ── Payment ──
  paymentSummary: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 16, marginBottom: 16 },
  payRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  payLabel:   { fontSize: 14, color: '#6b7280' },
  payVal:     { fontSize: 14, fontWeight: '600', color: '#111827' },
  payTotal:   { borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 8, paddingTop: 12 },
  payTotalLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },
  payTotalVal:   { fontSize: 20, fontWeight: '700', color: '#10b981' },

  splitCard:  { backgroundColor: '#eff6ff', borderRadius: 12, padding: 16, marginBottom: 8 },
  splitTitle: { fontSize: 14, fontWeight: '700', color: '#1e40af', marginBottom: 10 },
  splitRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  splitLabel: { flex: 1, fontSize: 13, color: '#374151' },
  splitVal:   { fontSize: 14, fontWeight: '600', color: '#374151' },

  methodCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: '#f9fafb', marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  methodIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  methodLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },

  // ── Review ──
  reviewProviderRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  reviewAvatar: { width: 56, height: 56, borderRadius: 28 },
  reviewAvatarPlaceholder: { backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center' },
  reviewAvatarInitial: { fontSize: 22, fontWeight: '700', color: '#2563eb' },
  reviewProviderName: { fontSize: 17, fontWeight: '700', color: '#111827' },
  reviewProviderSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 },
  starBtn: { padding: 4 },
  ratingLabel: { textAlign: 'center', fontSize: 15, fontWeight: '600', color: '#f59e0b', marginBottom: 8 },

  // ── Tip ──
  tipCard: { backgroundColor: '#fffbeb', borderRadius: 12, padding: 16, marginTop: 8, borderWidth: 1, borderColor: '#fde68a' },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  tipTitle: { fontSize: 15, fontWeight: '700', color: '#92400e' },
  tipHint: { fontSize: 12, color: '#78350f', marginBottom: 12 },
  tipBtns: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  tipAmtBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#fde68a', alignItems: 'center' },
  tipAmtBtnActive: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  tipAmtText: { fontSize: 13, fontWeight: '600', color: '#92400e' },
  tipAmtTextActive: { color: '#fff' },

  // ── Decline ──
  declineBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1.5, borderColor: '#ef4444',
    backgroundColor: '#fff5f5',
  },
  declineBtnFull: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#ef4444', backgroundColor: '#fff5f5',
  },
  declineBtnText: { fontSize: 14, fontWeight: '700', color: '#ef4444' },
});
