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

export default function BookingDetail() {
  const params = useLocalSearchParams();
  const bookingId = params.booking_id as string;
  const router = useRouter();
  const [booking, setBooking] = useState<any>(null);
  const [service, setService] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookingDetails();
  }, [bookingId]);

  const loadBookingDetails = async () => {
    try {
      const bookingData = await api.getBooking(bookingId);
      setBooking(bookingData);

      // Load service details
      const serviceData = await api.getService(bookingData.service_id);
      setService(serviceData);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load booking');
      router.back();
    } finally {
      setLoading(false);
    }
  };

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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Status Banner */}
        <View
          style={[
            styles.statusBanner,
            { backgroundColor: STATUS_COLORS[booking.status] },
          ]}
        >
          <Text style={styles.statusBannerText}>
            Status: {STATUS_LABELS[booking.status]}
          </Text>
        </View>

        {/* Service Info */}
        {service && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service</Text>
            <View style={styles.serviceCard}>
              {service.image && (
                <Image source={{ uri: service.image }} style={styles.serviceImage} resizeMode="cover" />
              )}
              <Text style={styles.serviceName}>{service.name}</Text>
              <Text style={styles.serviceCategory}>{service.category.replace('_', ' ')}</Text>
            </View>
          </View>
        )}

        {/* Booking Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Booking Information</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="calendar" size={20} color="#6b7280" />
              <Text style={styles.infoLabel}>Date & Time:</Text>
              <Text style={styles.infoValue}>{booking.date} at {booking.time}</Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="location" size={20} color="#6b7280" />
              <Text style={styles.infoLabel}>Address:</Text>
              <Text style={styles.infoValue}>{booking.address}</Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="cash" size={20} color="#6b7280" />
              <Text style={styles.infoLabel}>Total:</Text>
              <Text style={styles.infoValue}>${booking.total_price.toFixed(2)}</Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="card" size={20} color="#6b7280" />
              <Text style={styles.infoLabel}>Payment:</Text>
              <Text style={[styles.infoValue, { 
                color: booking.payment_status === 'paid' ? '#10b981' : '#f59e0b' 
              }]}>
                {booking.payment_status.toUpperCase()}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="pricetag" size={20} color="#6b7280" />
              <Text style={styles.infoLabel}>Booking ID:</Text>
              <Text style={[styles.infoValue, styles.monospace]}>
                {booking.booking_id}
              </Text>
            </View>
          </View>
        </View>

        {/* Problem Description */}
        {booking.problem_description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Problem Description</Text>
            <View style={styles.infoCard}>
              <Text style={styles.problemText}>{booking.problem_description}</Text>
            </View>
          </View>
        )}

        {/* Problem Photos */}
        {booking.problem_photos && booking.problem_photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Problem Photos ({booking.problem_photos.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.photosContainer}>
                {booking.problem_photos.map((photo: string, index: number) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => Alert.alert('Photo', 'Full screen view coming soon')}
                  >
                    <Image source={{ uri: photo }} style={styles.problemPhoto} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Additional Notes */}
        {booking.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Notes</Text>
            <View style={styles.infoCard}>
              <Text style={styles.notesText}>{booking.notes}</Text>
            </View>
          </View>
        )}

        {/* Provider Info */}
        {booking.provider_id && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assigned Provider</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoValue}>Provider ID: {booking.provider_id}</Text>
            </View>
          </View>
        )}

        {/* Actions */}
        {booking.status === 'pending' && booking.payment_status !== 'paid' && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.payButton}
              onPress={() => Alert.alert('Payment', 'Payment integration coming soon')}
            >
              <Ionicons name="card" size={20} color="#fff" />
              <Text style={styles.payButtonText}>Pay Now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => Alert.alert('Cancel', 'Cancel booking feature coming soon')}
            >
              <Ionicons name="close-circle" size={20} color="#ef4444" />
              <Text style={styles.cancelButtonText}>Cancel Booking</Text>
            </TouchableOpacity>
          </View>
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
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  content: {
    flex: 1,
  },
  statusBanner: {
    padding: 16,
    alignItems: 'center',
  },
  statusBannerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  serviceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  serviceImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 12,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  serviceCategory: {
    fontSize: 14,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
    width: 100,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  monospace: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
  },
  problemText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  notesText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  photosContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 16,
  },
  problemPhoto: {
    width: 200,
    height: 200,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  actions: {
    padding: 16,
    gap: 12,
    marginTop: 16,
  },
  payButton: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
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
  cancelButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
});
