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
import { format } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  in_progress: '#8b5cf6',
  completed: '#10b981',
  cancelled: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function Bookings() {
  const router = useRouter();
  const { bookings, setBookings } = useBookingStore();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadBookings = async () => {
    try {
      console.log('=== Loading Bookings ===');
      console.log('User role:', user?.role);
      const data = await api.getBookings();
      console.log('Bookings received:', data.length, 'bookings');
      console.log('Bookings data:', JSON.stringify(data, null, 2));
      setBookings(data);
      console.log('Bookings set in store');
    } catch (error: any) {
      console.error('Failed to load bookings:', error);
      Alert.alert('Error', error.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    console.log('Bookings component mounted');
    loadBookings();
  }, []);

  const onRefresh = () => {
    console.log('Refreshing bookings...');
    setRefreshing(true);
    loadBookings();
  };

  console.log('Rendering bookings screen, bookings count:', bookings.length);

  if (loading) {
    console.log('Showing loading state');
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Bookings</Text>
        <Text style={styles.headerSubtitle}>
          {user?.role === 'provider' ? 'Your assigned bookings' : 'Your service bookings'}
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {bookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No bookings yet</Text>
            {user?.role === 'client' && (
              <TouchableOpacity
                style={styles.browseButton}
                onPress={() => router.push('/(tabs)')}
              >
                <Text style={styles.browseButtonText}>Browse Services</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          bookings.map((booking) => (
            <TouchableOpacity
              key={booking.booking_id}
              style={styles.bookingCard}
              onPress={() => router.push({
                pathname: '/(tabs)/booking-detail',
                params: { booking_id: booking.booking_id }
              })}
            >
              <View style={styles.bookingHeader}>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: STATUS_COLORS[booking.status] + '20' },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: STATUS_COLORS[booking.status] },
                    ]}
                  >
                    {STATUS_LABELS[booking.status]}
                  </Text>
                </View>
                <Text style={styles.bookingId}>#{booking.booking_id.slice(-8)}</Text>
              </View>

              <View style={styles.bookingInfo}>
                <View style={styles.infoRow}>
                  <Ionicons name="calendar" size={16} color="#6b7280" />
                  <Text style={styles.infoText}>
                    {booking.date} at {booking.time}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="location" size={16} color="#6b7280" />
                  <Text style={styles.infoText} numberOfLines={1}>
                    {booking.address}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="cash" size={16} color="#6b7280" />
                  <Text style={styles.infoText}>${booking.total_price.toFixed(2)}</Text>
                </View>
              </View>

              <View style={styles.paymentStatus}>
                <Ionicons
                  name={
                    booking.payment_status === 'paid'
                      ? 'checkmark-circle'
                      : 'time-outline'
                  }
                  size={16}
                  color={booking.payment_status === 'paid' ? '#10b981' : '#f59e0b'}
                />
                <Text
                  style={[
                    styles.paymentText,
                    {
                      color: booking.payment_status === 'paid' ? '#10b981' : '#f59e0b',
                    },
                  ]}
                >
                  Payment: {booking.payment_status}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
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
  },
  bookingCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bookingId: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'monospace',
  },
  bookingInfo: {
    gap: 8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  paymentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  paymentText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
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
