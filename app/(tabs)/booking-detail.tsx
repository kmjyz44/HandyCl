import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../utils/api';

const STATUS_COLORS: Record<string, string> = {
  draft:                     '#9ca3af',
  pending:                   '#f59e0b',
  posted:                    '#3b82f6',
  offering:                  '#8b5cf6',
  confirmed:                 '#3b82f6',
  assigned:                  '#f59e0b',
  hold_placed:               '#f59e0b',
  on_the_way:                '#06b6d4',
  in_progress:               '#f97316',
  started:                   '#f97316',
  completed_pending_payment: '#22c55e',
  paid:                      '#10b981',
  completed:                 '#10b981',
  cancelled:                 '#ef4444',
  cancelled_by_client:       '#ef4444',
  cancelled_by_tasker:       '#ef4444',
  dispute:                   '#dc2626',
};

const STATUS_LABELS: Record<string, string> = {
  draft:                     'Чернетка',
  pending:                   'Очікує',
  posted:                    'Очікує виконавця',
  offering:                  'Приймає пропозиції',
  confirmed:                 'Підтверджено',
  assigned:                  'Прийнято виконавцем',
  hold_placed:               'Виконавець призначено',
  on_the_way:                'Виконавець в дорозі',
  in_progress:               'Виконується',
  started:                   'Виконується',
  completed_pending_payment: 'Завершено — очікує оплати',
  paid:                      'Оплачено',
  completed:                 'Виконано',
  cancelled:                 'Скасовано',
  cancelled_by_client:       'Скасовано клієнтом',
  cancelled_by_tasker:       'Скасовано виконавцем',
  dispute:                   'Спір',
};

const PAYMENT_LABELS: Record<string, string> = {
  unpaid: 'Не оплачено',
  paid: 'Оплачено',
  refunded: 'Повернено',
  pending: 'Очікує',
};

export default function BookingDetail() {
  const params = useLocalSearchParams();
  const bookingId = params.booking_id as string;
  const router = useRouter();
  const [booking, setBooking] = useState<any>(null);
  const [service, setService] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (bookingId) {
      loadBookingDetails();
    } else {
      setError('Не вказано ID бронювання');
      setLoading(false);
    }
  }, [bookingId]);

  const loadBookingDetails = async () => {
    try {
      setError(null);
      const bookingData = await api.getBooking(bookingId);
      setBooking(bookingData);
      // Load service details (non-critical)
      if (bookingData?.service_id) {
        try {
          const serviceData = await api.getService(bookingData.service_id);
          setService(serviceData);
        } catch {
          // service info is optional
        }
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Не вдалося завантажити бронювання';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Завантаження...</Text>
      </View>
    );
  }

  if (error || !booking) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Деталі бронювання</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text style={styles.errorText}>{error || 'Бронювання не знайдено'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadBookingDetails}>
            <Text style={styles.retryButtonText}>Спробувати знову</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>Назад до списку</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[booking.status] || '#6b7280';
  const statusLabel = STATUS_LABELS[booking.status] || booking.status;
  const paymentLabel = PAYMENT_LABELS[booking.payment_status] || booking.payment_status || 'Невідомо';
  const photos = booking.problem_photos || booking.photos || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Деталі бронювання</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: statusColor }]}>
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.statusBannerText}>Статус: {statusLabel}</Text>
        </View>

        {/* Service Info */}
        {service && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Послуга</Text>
            <View style={styles.serviceCard}>
              {service.image && (
                <Image source={{ uri: service.image }} style={styles.serviceImage} resizeMode="cover" />
              )}
              <Text style={styles.serviceName}>{service.name}</Text>
              {service.category && (
                <Text style={styles.serviceCategory}>{service.category.replace(/_/g, ' ')}</Text>
              )}
            </View>
          </View>
        )}

        {/* Booking Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Інформація про бронювання</Text>
          <View style={styles.infoCard}>
            {booking.date && (
              <View style={styles.infoRow}>
                <Ionicons name="calendar" size={20} color="#6b7280" />
                <Text style={styles.infoLabel}>Дата і час:</Text>
                <Text style={styles.infoValue}>
                  {booking.date}{booking.time ? ` о ${booking.time}` : ''}
                </Text>
              </View>
            )}

            {booking.address && (
              <View style={styles.infoRow}>
                <Ionicons name="location" size={20} color="#6b7280" />
                <Text style={styles.infoLabel}>Адреса:</Text>
                <Text style={styles.infoValue}>{booking.address}</Text>
              </View>
            )}

            {(booking.total_price !== undefined && booking.total_price !== null) && (
              <View style={styles.infoRow}>
                <Ionicons name="cash" size={20} color="#6b7280" />
                <Text style={styles.infoLabel}>Сума:</Text>
                <Text style={styles.infoValue}>{Math.round(Number(booking.total_price) * 1.15)} грн</Text>
              </View>
            )}

            <View style={styles.infoRow}>
              <Ionicons name="card" size={20} color="#6b7280" />
              <Text style={styles.infoLabel}>Оплата:</Text>
              <Text style={[
                styles.infoValue,
                { color: booking.payment_status === 'paid' ? '#10b981' : '#f59e0b' }
              ]}>
                {paymentLabel}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="pricetag" size={20} color="#6b7280" />
              <Text style={styles.infoLabel}>ID:</Text>
              <Text style={[styles.infoValue, styles.monospace]}>
                #{(booking.booking_id || '').slice(-8)}
              </Text>
            </View>
          </View>
        </View>

        {/* Problem Description */}
        {booking.problem_description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Опис проблеми</Text>
            <View style={styles.infoCard}>
              <Text style={styles.problemText}>{booking.problem_description}</Text>
            </View>
          </View>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Фото ({photos.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.photosContainer}>
                {photos.map((photo: string, index: number) => (
                  <Image
                    key={index}
                    source={{ uri: photo.startsWith('data:') ? photo : photo }}
                    style={styles.problemPhoto}
                    resizeMode="cover"
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Notes */}
        {booking.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Додаткові нотатки</Text>
            <View style={styles.infoCard}>
              <Text style={styles.notesText}>{booking.notes}</Text>
            </View>
          </View>
        )}

        {/* Provider Info */}
        {booking.provider_id && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Виконавець</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Ionicons name="person" size={20} color="#6b7280" />
                <Text style={styles.infoLabel}>ID:</Text>
                <Text style={[styles.infoValue, styles.monospace]}>{booking.provider_id.slice(-8)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* View Task Detail button — shown when task is in progress or completed */}
        {['assigned','on_the_way','started','completed_pending_payment','paid','completed'].includes(booking.status) && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.payButton, { backgroundColor: '#2563eb' }]}
              onPress={() => router.push({ pathname: '/task-detail', params: { id: booking.booking_id } })}
            >
              <Ionicons name="eye" size={20} color="#fff" />
              <Text style={styles.payButtonText}>Деталі завдання</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Pay button — shown when completed pending payment */}
        {booking.status === 'completed_pending_payment' && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.payButton, { backgroundColor: '#22c55e' }]}
              onPress={() => router.push({ pathname: '/task-detail', params: { id: booking.booking_id } })}
            >
              <Ionicons name="card" size={20} color="#fff" />
              <Text style={styles.payButtonText}>Оплатити завдання</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Actions */}
        {(booking.status === 'pending' || booking.status === 'posted') && (
          <View style={styles.actions}>
            {booking.payment_status !== 'paid' && (
              <TouchableOpacity style={styles.payButton}>
                <Ionicons name="card" size={20} color="#fff" />
                <Text style={styles.payButtonText}>Оплатити</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                if (Platform.OS === 'web') {
                  if (window.confirm('Скасувати бронювання?')) {
                    // TODO: cancel booking API call
                  }
                } else {
                  Alert.alert('Скасування', 'Скасувати бронювання?', [
                    { text: 'Ні', style: 'cancel' },
                    { text: 'Так', style: 'destructive' },
                  ]);
                }
              }}
            >
              <Ionicons name="close-circle" size={20} color="#ef4444" />
              <Text style={styles.cancelButtonText}>Скасувати</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#6b7280' },
  errorText: { fontSize: 16, color: '#ef4444', textAlign: 'center', marginTop: 16, marginBottom: 24 },
  retryButton: { backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginBottom: 12 },
  retryButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  backLink: { paddingVertical: 8 },
  backLinkText: { color: '#2563eb', fontSize: 14 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  content: { flex: 1 },
  statusBanner: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statusBannerText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  section: { marginTop: 16, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 12 },
  serviceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  serviceImage: { width: '100%', height: 120, borderRadius: 8, marginBottom: 12 },
  serviceName: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 4 },
  serviceCategory: { fontSize: 14, color: '#6b7280', textTransform: 'capitalize' },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  infoLabel: { fontSize: 14, color: '#6b7280', width: 100 },
  infoValue: { flex: 1, fontSize: 14, color: '#111827', fontWeight: '500' },
  monospace: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
  },
  problemText: { fontSize: 15, color: '#374151', lineHeight: 22 },
  notesText: { fontSize: 14, color: '#6b7280', fontStyle: 'italic' },
  photosContainer: { flexDirection: 'row', gap: 12, paddingRight: 16 },
  problemPhoto: { width: 200, height: 200, borderRadius: 12, backgroundColor: '#f3f4f6' },
  actions: { padding: 16, gap: 12, marginTop: 16 },
  payButton: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  payButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelButton: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  cancelButtonText: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
});
