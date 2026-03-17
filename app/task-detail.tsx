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

const STATUS_CONFIG: Record<string, { label: string; color: string; next?: string; nextLabel?: string }> = {
  posted: { label: 'Нове', color: '#3b82f6' },
  offering: { label: 'Приймає пропозиції', color: '#8b5cf6' },
  assigned: { label: 'Призначено вам', color: '#f59e0b', next: 'accept', nextLabel: 'Прийняти завдання' },
  hold_placed: { label: 'Оплата підтверджена', color: '#10b981', next: 'on_the_way', nextLabel: 'Виїхав' },
  on_the_way: { label: 'В дорозі', color: '#06b6d4', next: 'start', nextLabel: 'Почати роботу' },
  started: { label: 'В роботі', color: '#f97316', next: 'complete', nextLabel: 'Завершити' },
  completed_pending_payment: { label: 'Очікує оплати', color: '#eab308' },
  paid: { label: 'Оплачено', color: '#22c55e' },
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
          Alert.alert('Успіх', 'Завдання прийнято!');
          break;
        case 'on_the_way':
          await api.onTheWayTask(id);
          Alert.alert('Успіх', 'Статус оновлено: В дорозі');
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
      loadTask();
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
      Alert.alert('Завдання завершено!', 
        `Фінальна ціна: $${result.final_price}\nВаш заробіток: $${result.tasker_payout}`
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

  const statusConfig = STATUS_CONFIG[task.status] || { label: task.status, color: '#6b7280' };
  const isMyTask = task.provider_id === user?.user_id;
  const canSendOffer = task.allow_offers && !task.my_offer && user?.role === 'provider';

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
        {/* Status */}
        <View style={[styles.statusBar, { backgroundColor: statusConfig.color }]}>
          <Ionicons name="information-circle" size={20} color="#fff" />
          <Text style={styles.statusText}>{statusConfig.label}</Text>
        </View>

        {/* Main Info */}
        <View style={styles.section}>
          <Text style={styles.title}>{task.title}</Text>
          <Text style={styles.description}>{task.description}</Text>
        </View>

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Деталі</Text>
          
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={20} color="#6b7280" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Адреса</Text>
              <Text style={styles.detailValue}>{task.address}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={20} color="#6b7280" />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Дата та час</Text>
              <Text style={styles.detailValue}>
                {task.scheduled_date} о {task.scheduled_time}
              </Text>
            </View>
          </View>

          {task.estimated_hours && (
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
            {task.estimated_price && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Орієнтовна ціна</Text>
                <Text style={styles.priceValue}>${task.estimated_price}</Text>
              </View>
            )}
            {task.final_price && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Фінальна ціна</Text>
                <Text style={[styles.priceValue, styles.finalPrice]}>${task.final_price}</Text>
              </View>
            )}
            {task.platform_fee && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Комісія платформи</Text>
                <Text style={styles.feeValue}>-${task.platform_fee.toFixed(2)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Client Info */}
        {task.client && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Клієнт</Text>
            <View style={styles.clientCard}>
              <View style={styles.clientAvatar}>
                <Ionicons name="person" size={24} color="#fff" />
              </View>
              <View style={styles.clientInfo}>
                <Text style={styles.clientName}>{task.client.name}</Text>
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

        {/* Photos */}
        {task.photos && task.photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Фото</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {task.photos.map((photo: string, index: number) => (
                <Image key={index} source={{ uri: photo }} style={styles.photo} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Completion Info */}
        {task.actual_hours && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Результат роботи</Text>
            <View style={styles.completionCard}>
              <View style={styles.completionRow}>
                <Text style={styles.completionLabel}>Відпрацьовано годин</Text>
                <Text style={styles.completionValue}>{task.actual_hours}</Text>
              </View>
              {task.materials_cost && (
                <View style={styles.completionRow}>
                  <Text style={styles.completionLabel}>Витрати на матеріали</Text>
                  <Text style={styles.completionValue}>${task.materials_cost}</Text>
                </View>
              )}
              {task.provider_notes && (
                <View style={styles.notesRow}>
                  <Text style={styles.completionLabel}>Коментар виконавця</Text>
                  <Text style={styles.notesText}>{task.provider_notes}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.footer}>
        {canSendOffer && (
          <TouchableOpacity
            style={styles.offerButton}
            onPress={() => setShowOfferModal(true)}
          >
            <Ionicons name="paper-plane" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Надіслати пропозицію</Text>
          </TouchableOpacity>
        )}

        {isMyTask && statusConfig.next && (
          <TouchableOpacity
            style={[styles.actionButton, actionLoading && styles.buttonDisabled]}
            onPress={() => handleAction(statusConfig.next!)}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons 
                  name={statusConfig.next === 'complete' ? 'checkmark-circle' : 'arrow-forward-circle'} 
                  size={20} 
                  color="#fff" 
                />
                <Text style={styles.actionButtonText}>{statusConfig.nextLabel}</Text>
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
              <Text style={styles.inputLabel}>Ціна ($) *</Text>
              <TextInput
                style={styles.input}
                value={offerPrice}
                onChangeText={setOfferPrice}
                keyboardType="numeric"
                placeholder="50"
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
              <Text style={styles.inputLabel}>Витрати на матеріали ($)</Text>
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
    padding: 12, gap: 8,
  },
  statusText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  section: { backgroundColor: '#fff', padding: 20, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  description: { fontSize: 15, color: '#4b5563', lineHeight: 22 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 12 },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  detailValue: { fontSize: 15, color: '#111827' },
  priceCard: { backgroundColor: '#f9fafb', padding: 16, borderRadius: 12 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  priceLabel: { fontSize: 14, color: '#6b7280' },
  priceValue: { fontSize: 16, fontWeight: '600', color: '#111827' },
  finalPrice: { color: '#10b981', fontSize: 20 },
  feeValue: { fontSize: 14, color: '#ef4444' },
  clientCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clientAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#2563eb',
    justifyContent: 'center', alignItems: 'center',
  },
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
    flexDirection: 'row', backgroundColor: '#2563eb', padding: 16,
    borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  offerButton: {
    flexDirection: 'row', backgroundColor: '#8b5cf6', padding: 16,
    borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  actionButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
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
