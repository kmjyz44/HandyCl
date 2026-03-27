import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useBookingStore } from '../../store/bookingStore';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../utils/api';

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  in_progress: '#8b5cf6',
  completed: '#10b981',
  cancelled: '#ef4444',
  draft: '#9ca3af',
  posted: '#3b82f6',
  offering: '#8b5cf6',
  assigned: '#f59e0b',
  hold_placed: '#10b981',
  on_the_way: '#06b6d4',
  started: '#f97316',
  completed_pending_payment: '#eab308',
  paid: '#22c55e',
  cancelled_by_client: '#ef4444',
  cancelled_by_tasker: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Очікує',
  confirmed: 'Підтверджено',
  in_progress: 'Виконується',
  completed: 'Завершено',
  cancelled: 'Скасовано',
  draft: 'Чернетка',
  posted: 'Очікує виконавця',
  offering: 'Приймає пропозиції',
  assigned: 'Виконавець призначений',
  hold_placed: 'Оплата підтверджена',
  on_the_way: 'Виконавець в дорозі',
  started: 'Виконується',
  completed_pending_payment: 'Очікує оплати',
  paid: 'Завершено',
  cancelled_by_client: 'Скасовано вами',
  cancelled_by_tasker: 'Скасовано виконавцем',
};

export default function Bookings() {
  const router = useRouter();
  const { bookings, setBookings } = useBookingStore();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadBookings = async () => {
    try {
      const data = await api.getBookings();
      setBookings(data);
    } catch (error: any) {
      Alert.alert('Помилка', error.message || 'Не вдалося завантажити бронювання');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadBookings();
  };

  const getStatusColor = (status: string) => STATUS_COLORS[status] || '#6b7280';
  const getStatusLabel = (status: string) => STATUS_LABELS[status] || status;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Мої бронювання</Text>
        <Text style={styles.headerSubtitle}>
          {user?.role === 'provider' ? 'Ваші призначені завдання' : 'Ваші замовлення послуг'}
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {bookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>Немає бронювань</Text>
            {user?.role === 'client' && (
              <TouchableOpacity
                style={styles.browseButton}
                onPress={() => router.push('/(tabs)')}
              >
                <Text style={styles.browseButtonText}>Знайти виконавця</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          bookings.map((booking) => {
            const statusColor = getStatusColor(booking.status);
            const statusLabel = getStatusLabel(booking.status);
            const price = booking.total_price || booking.estimated_price || 0;
            const title = booking.title || booking.service?.name || 'Послуга';

            return (
              <TouchableOpacity
                key={booking.booking_id}
                style={styles.bookingCard}
                onPress={() => router.push({
                  pathname: '/(tabs)/booking-detail',
                  params: { booking_id: booking.booking_id }
                })}
                activeOpacity={0.85}
              >
                {/* Status strip */}
                <View style={[styles.statusStrip, { backgroundColor: statusColor }]} />

                <View style={styles.cardInner}>
                  {/* Header */}
                  <View style={styles.bookingHeader}>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                      <Text style={[styles.statusText, { color: statusColor }]}>
                        {statusLabel}
                      </Text>
                    </View>
                    <Text style={styles.bookingId}>#{booking.booking_id.slice(-6)}</Text>
                  </View>

                  {/* Title */}
                  <Text style={styles.bookingTitle} numberOfLines={1}>{title}</Text>

                  {/* Info rows */}
                  <View style={styles.bookingInfo}>
                    {(!!booking.date || !!booking.time) && (
                      <View style={styles.infoRow}>
                        <Ionicons name="calendar-outline" size={15} color="#6b7280" />
                        <Text style={styles.infoText}>
                          {booking.date || ''}{booking.date && booking.time ? ' о ' : ''}{booking.time || ''}
                        </Text>
                      </View>
                    )}
                    {!!booking.address && (
                      <View style={styles.infoRow}>
                        <Ionicons name="location-outline" size={15} color="#6b7280" />
                        <Text style={styles.infoText} numberOfLines={1}>{booking.address}</Text>
                      </View>
                    )}
                    {price > 0 && (
                      <View style={styles.infoRow}>
                        <Ionicons name="cash-outline" size={15} color="#10b981" />
                        <Text style={[styles.infoText, { color: '#10b981', fontWeight: '600' }]}>
                          {price} грн
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  bookingCard: {
    backgroundColor: '#fff',
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  statusStrip: {
    width: 5,
  },
  cardInner: {
    flex: 1,
    padding: 14,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  bookingId: {
    fontSize: 11,
    color: '#9ca3af',
    fontFamily: 'monospace',
  },
  bookingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  bookingInfo: {
    gap: 5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  browseButton: {
    marginTop: 24,
    backgroundColor: '#2563eb',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  browseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
