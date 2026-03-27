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

// Status config for BOTH executor and client views
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  draft:                     { label: 'Чернетка',               color: '#9ca3af', icon: 'document-outline' },
  posted:                    { label: 'Очікує виконавця',       color: '#3b82f6', icon: 'time-outline' },
  offering:                  { label: 'Приймає пропозиції',     color: '#8b5cf6', icon: 'chatbubbles-outline' },
  assigned:                  { label: 'Виконавець призначений', color: '#f59e0b', icon: 'person-outline' },
  hold_placed:               { label: 'Оплата підтверджена',    color: '#10b981', icon: 'card-outline' },
  on_the_way:                { label: 'Виконавець в дорозі',    color: '#06b6d4', icon: 'car-outline' },
  started:                   { label: 'Виконується',            color: '#f97316', icon: 'construct-outline' },
  completed_pending_payment: { label: 'Очікує оплати',          color: '#eab308', icon: 'hourglass-outline' },
  paid:                      { label: 'Завершено',              color: '#22c55e', icon: 'checkmark-circle-outline' },
  cancelled_by_client:       { label: 'Скасовано клієнтом',     color: '#ef4444', icon: 'close-circle-outline' },
  cancelled_by_tasker:       { label: 'Скасовано виконавцем',   color: '#ef4444', icon: 'close-circle-outline' },
};

// What action button to show for executor depending on current status
const EXECUTOR_ACTIONS: Record<string, { action: string; label: string; color: string }> = {
  posted:      { action: 'accept',     label: 'Прийняти завдання', color: '#2563eb' },
  offering:    { action: 'accept',     label: 'Прийняти завдання', color: '#2563eb' },
  assigned:    { action: 'on_the_way', label: 'Виїхав',            color: '#06b6d4' },
  hold_placed: { action: 'on_the_way', label: 'Виїхав',            color: '#06b6d4' },
  on_the_way:  { action: 'start',      label: 'Почати роботу',     color: '#f97316' },
  started:     { action: 'complete',   label: 'Завершити роботу',  color: '#10b981' },
};

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Offer modal
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerMessage, setOfferMessage] = useState('');

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
    setActionLoading(true);
    try {
      switch (action) {
        case 'accept':
          await api.acceptTask(id);
          Alert.alert('Успіх', 'Ви прийняли завдання!');
          break;
        case 'on_the_way':
          await api.onTheWayTask(id);
          Alert.alert('Успіх', 'Статус: В дорозі');
          break;
        case 'start':
          await api.startTask(id);
          Alert.alert('Успіх', 'Роботу розпочато!');
          break;
        case 'complete':
          setShowCompleteModal(true);
          setActionLoading(false);
          return;
      }
      await loadTask();
    } catch (error: any) {
      Alert.alert('Помилка', error.message || 'Не вдалося виконати дію');
    } finally {
      setActionLoading(false);
    }
  };

  const submitOffer = async () => {
    if (!offerPrice) {
      Alert.alert('Помилка', 'Вкажіть ціну');
      return;
    }
    setActionLoading(true);
    try {
      await api.createOffer({
        booking_id: task.task_id,
        proposed_price: parseFloat(offerPrice),
        message: offerMessage || undefined,
      });
      Alert.alert('Успіх', 'Пропозицію надіслано!');
      setShowOfferModal(false);
      setOfferPrice('');
      setOfferMessage('');
      loadTask();
    } catch (error: any) {
      Alert.alert('Помилка', error.message || 'Не вдалося надіслати пропозицію');
    } finally {
      setActionLoading(false);
    }
  };

  const submitComplete = async () => {
    if (!actualHours) {
      Alert.alert('Помилка', 'Вкажіть кількість годин');
      return;
    }
    setActionLoading(true);
    try {
      const result = await api.completeTask(id, {
        actual_hours: parseFloat(actualHours),
        materials_cost: materialsCost ? parseFloat(materialsCost) : undefined,
        provider_notes: providerNotes || undefined,
      });
      Alert.alert(
        'Завдання завершено!',
        `Фінальна ціна: ${result.final_price} грн\nВаш заробіток: ${result.tasker_payout} грн`
      );
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

  // What action button to show for executor
  const executorAction = isProvider
    ? isOpenTask
      ? EXECUTOR_ACTIONS['posted']         // open booking — show Accept
      : isMyTask
        ? EXECUTOR_ACTIONS[task.status]    // my task — show next step
        : null
    : null;

  // Offer button: only for open tasks where offers are allowed and executor hasn't sent one
  const canSendOffer = isProvider && task.allow_offers && !task.my_offer && isOpenTask;

  const clientName = task.client?.name || 'Клієнт';
  const clientPhoto = task.client?.photo_url;
  const price = task.estimated_price || task.total_price;
  const taskPhotos = [...(task.photos || []), ...(task.problem_photos || [])];

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

      <ScrollView style={styles.content}>
        {/* Status Banner */}
        <View style={[styles.statusBar, { backgroundColor: statusCfg.color }]}>
          <Ionicons name={statusCfg.icon as any} size={20} color="#fff" />
          <Text style={styles.statusText}>{statusCfg.label}</Text>
        </View>

        {/* Title + description */}
        <View style={styles.section}>
          <Text style={styles.title}>{task.title || 'Без назви'}</Text>
          {!!task.description && (
            <Text style={styles.description}>{task.description}</Text>
          )}
        </View>

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

          {!!task.estimated_hours && (
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={20} color="#6b7280" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Орієнтовна тривалість</Text>
                <Text style={styles.detailValue}>{task.estimated_hours} год</Text>
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
            {!!task.platform_fee && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Комісія платформи</Text>
                <Text style={styles.feeValue}>-{task.platform_fee.toFixed(2)} грн</Text>
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
              {task.client.phone && (
                <TouchableOpacity style={styles.callBtn}>
                  <Ionicons name="call" size={20} color="#2563eb" />
                </TouchableOpacity>
              )}
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

        {/* Completion Info */}
        {!!task.actual_hours && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Результат роботи</Text>
            <View style={styles.completionCard}>
              <View style={styles.completionRow}>
                <Text style={styles.completionLabel}>Відпрацьовано годин</Text>
                <Text style={styles.completionValue}>{task.actual_hours}</Text>
              </View>
              {!!task.materials_cost && (
                <View style={styles.completionRow}>
                  <Text style={styles.completionLabel}>Витрати на матеріали</Text>
                  <Text style={styles.completionValue}>{task.materials_cost} грн</Text>
                </View>
              )}
              {!!task.provider_notes && (
                <View style={styles.notesRow}>
                  <Text style={styles.completionLabel}>Коментар виконавця</Text>
                  <Text style={styles.notesText}>{task.provider_notes}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Action Buttons Footer */}
      <View style={styles.footer}>
        {/* Send offer button */}
        {canSendOffer && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#8b5cf6', marginBottom: 8 }]}
            onPress={() => setShowOfferModal(true)}
          >
            <Ionicons name="paper-plane" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Надіслати пропозицію</Text>
          </TouchableOpacity>
        )}

        {/* Main executor action button */}
        {executorAction && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: executorAction.color }, actionLoading && styles.buttonDisabled]}
            onPress={() => handleAction(executorAction.action)}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons
                  name={
                    executorAction.action === 'accept' ? 'checkmark-circle' :
                    executorAction.action === 'complete' ? 'checkmark-done-circle' :
                    'arrow-forward-circle'
                  }
                  size={22}
                  color="#fff"
                />
                <Text style={styles.actionButtonText}>{executorAction.label}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Offer Modal */}
      <Modal visible={showOfferModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ваша пропозиція</Text>
              <TouchableOpacity onPress={() => setShowOfferModal(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Ціна (грн) *</Text>
              <TextInput
                style={styles.input}
                value={offerPrice}
                onChangeText={setOfferPrice}
                keyboardType="numeric"
                placeholder="500"
              />
              <Text style={styles.inputLabel}>Повідомлення (опціонально)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={offerMessage}
                onChangeText={setOfferMessage}
                multiline
                placeholder="Опишіть чому ви найкращий вибір..."
              />
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowOfferModal(false)}
              >
                <Text style={styles.cancelButtonText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={submitOffer}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Надіслати</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Відпрацьовано годин *</Text>
              <TextInput
                style={styles.input}
                value={actualHours}
                onChangeText={setActualHours}
                keyboardType="numeric"
                placeholder="2.5"
              />
              <Text style={styles.inputLabel}>Витрати на матеріали (грн)</Text>
              <TextInput
                style={styles.input}
                value={materialsCost}
                onChangeText={setMaterialsCost}
                keyboardType="numeric"
                placeholder="0"
              />
              <Text style={styles.inputLabel}>Коментар</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={providerNotes}
                onChangeText={setProviderNotes}
                multiline
                placeholder="Опишіть виконану роботу..."
              />
            </View>
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
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 12 },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  detailValue: { fontSize: 15, color: '#111827' },
  priceCard: { backgroundColor: '#f9fafb', padding: 16, borderRadius: 12 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  priceLabel: { fontSize: 14, color: '#6b7280' },
  priceValueGreen: { fontSize: 18, fontWeight: '700', color: '#10b981' },
  noPrice: { fontSize: 14, color: '#9ca3af', fontStyle: 'italic' },
  feeValue: { fontSize: 14, color: '#ef4444' },
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
  callBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#eff6ff',
    justifyContent: 'center', alignItems: 'center',
  },
  photo: { width: 120, height: 120, borderRadius: 12, marginRight: 12 },
  completionCard: { backgroundColor: '#f0fdf4', padding: 16, borderRadius: 12 },
  completionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  completionLabel: { fontSize: 14, color: '#166534' },
  completionValue: { fontSize: 16, fontWeight: '600', color: '#166534' },
  notesRow: { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#bbf7d0', marginTop: 8 },
  notesText: { fontSize: 14, color: '#166534', marginTop: 8, lineHeight: 20 },
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
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  modalBody: { padding: 20 },
  modalFooter: { flexDirection: 'row', gap: 12, padding: 20, paddingTop: 0 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: {
    backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db',
    borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 16,
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  modalButton: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f3f4f6' },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  submitButton: { backgroundColor: '#2563eb' },
  submitButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
