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
      Alert.alert('Оплату підтверджено!', 'Завдання переміщено до оплачених.');
      setShowPayment(false);
      await loadTask();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e.message || 'Помилка';
      Alert.alert('Помилка', msg);
    } finally {
      setActionLoading(false);
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
  const parsedHours = parseFloat(hours) || 0;
  const laborCost = parsedHours * hourlyRate;
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
            {price != null && price > 0 ? (
              <View style={s.priceRow}>
                <Text style={s.priceLabel}>Орієнтовна ціна</Text>
                <Text style={s.priceGreen}>{price} грн</Text>
              </View>
            ) : (
              <Text style={s.noPrice}>Ціна не вказана</Text>
            )}
            {!!task.final_price && (
              <View style={s.priceRow}>
                <Text style={s.priceLabel}>Фінальна ціна</Text>
                <Text style={[s.priceGreen, { fontSize: 22 }]}>{task.final_price} грн</Text>
              </View>
            )}
            {!!task.materials_cost && (
              <View style={s.priceRow}>
                <Text style={s.priceLabel}>Матеріали</Text>
                <Text style={s.priceLabel}>{task.materials_cost} грн</Text>
              </View>
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
        {/* Chat button always visible */}
        <TouchableOpacity
          style={s.chatFooterBtn}
          onPress={() => router.push({ pathname: '/task-chat', params: { taskId, taskTitle: task.title } })}
        >
          <Ionicons name="chatbubble-ellipses" size={20} color="#2563eb" />
          <Text style={s.chatFooterText}>Чат</Text>
        </TouchableOpacity>

        {/* Executor action */}
        {execAction && (
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: execAction.color, flex: 1 }, actionLoading && s.btnDisabled]}
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

              {/* Earnings preview */}
              {parsedHours > 0 && (
                <View style={s.earningsCard}>
                  <Text style={s.earningsTitle}>Розрахунок заробітку</Text>
                  <View style={s.earningsRow}>
                    <Text style={s.earningsLabel}>Погодинна ставка</Text>
                    <Text style={s.earningsVal}>{hourlyRate} грн/год</Text>
                  </View>
                  <View style={s.earningsRow}>
                    <Text style={s.earningsLabel}>Праця ({parsedHours} год)</Text>
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
                  <View style={s.earningsRow}>
                    <Text style={[s.earningsLabel, { fontWeight: '700', color: '#111827' }]}>Ваш заробіток</Text>
                    <Text style={[s.earningsVal, { color: '#22c55e', fontSize: 18, fontWeight: '700' }]}>
                      {providerEarnings} грн
                    </Text>
                  </View>
                </View>
              )}

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
              <View style={s.paymentSummary}>
                <View style={s.payRow}>
                  <Text style={s.payLabel}>Виконавець</Text>
                  <Text style={s.payVal}>{task.provider?.name || 'Виконавець'}</Text>
                </View>
                {task.actual_hours != null && (
                  <View style={s.payRow}>
                    <Text style={s.payLabel}>Відпрацьовано</Text>
                    <Text style={[s.payVal, { color: '#2563eb' }]}>{task.actual_hours} год</Text>
                  </View>
                )}
                {task.materials_cost != null && task.materials_cost > 0 && (
                  <View style={s.payRow}>
                    <Text style={s.payLabel}>Матеріали</Text>
                    <Text style={s.payVal}>{task.materials_cost} грн</Text>
                  </View>
                )}
                <View style={[s.payRow, s.payTotal]}>
                  <Text style={s.payTotalLabel}>До оплати</Text>
                  <Text style={s.payTotalVal}>{task.final_price || price || '—'} грн</Text>
                </View>
              </View>

              {/* Split info */}
              <View style={s.splitCard}>
                <Text style={s.splitTitle}>Розподіл оплати</Text>
                <View style={s.splitRow}>
                  <Ionicons name="person-outline" size={16} color="#22c55e" />
                  <Text style={s.splitLabel}>Виконавцю</Text>
                  <Text style={[s.splitVal, { color: '#22c55e' }]}>
                    {task.final_price ? Math.round(task.final_price * 0.85) : '—'} грн
                  </Text>
                </View>
                <View style={s.splitRow}>
                  <Ionicons name="business-outline" size={16} color="#6b7280" />
                  <Text style={s.splitLabel}>Комісія платформи (15%)</Text>
                  <Text style={s.splitVal}>
                    {task.final_price ? Math.round(task.final_price * 0.15) : '—'} грн
                  </Text>
                </View>
              </View>

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
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
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
    flexDirection: 'row', gap: 10,
    padding: 16, paddingBottom: 32, backgroundColor: '#fff',
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
});
