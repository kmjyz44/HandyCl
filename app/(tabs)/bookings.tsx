import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useBookingStore } from '../../store/bookingStore';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../utils/api';

const STATUS_COLORS: Record<string, string> = {
  pending:                   '#f59e0b',
  confirmed:                 '#3b82f6',
  in_progress:               '#8b5cf6',
  completed:                 '#10b981',
  cancelled:                 '#ef4444',
  draft:                     '#9ca3af',
  posted:                    '#3b82f6',
  offering:                  '#8b5cf6',
  assigned:                  '#f59e0b',
  hold_placed:               '#10b981',
  on_the_way:                '#06b6d4',
  started:                   '#f97316',
  completed_pending_payment: '#eab308',
  paid:                      '#22c55e',
  cancelled_by_client:       '#ef4444',
  cancelled_by_tasker:       '#ef4444',
  declined:                  '#dc2626',
};

const STATUS_LABELS: Record<string, string> = {
  pending:                   'Очікує',
  confirmed:                 'Підтверджено',
  in_progress:               'Виконується',
  completed:                 'Завершено',
  cancelled:                 'Скасовано',
  draft:                     'Чернетка',
  posted:                    'Очікує виконавця',
  offering:                  'Приймає пропозиції',
  assigned:                  'Виконавець призначений',
  hold_placed:               'Оплата підтверджена',
  on_the_way:                'Виконавець в дорозі',
  started:                   'Виконується',
  completed_pending_payment: 'Очікує оплати',
  paid:                      'Оплачено ✓',
  cancelled_by_client:       'Скасовано вами',
  cancelled_by_tasker:       'Скасовано виконавцем',
  declined:                  'Відхилено виконавцем',
};

const COMPLETED_STATUSES = ['completed_pending_payment', 'paid', 'completed'];

export default function Bookings() {
  const router = useRouter();
  const { bookings, setBookings } = useBookingStore();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  const CACHE_KEY = `bookings_cache_${user?.user_id || 'guest'}`;

  const loadBookings = async (background = false) => {
    try {
      // Race: API vs 8-second timeout
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 8000)
      );
      const data = await Promise.race([api.getBookings(), timeoutPromise]);
      setBookings(data);
      // Cache to localStorage for instant next load
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
    } catch {
      // Silently fail — show cached data or empty state
    } finally {
      if (!background) {
        setLoading(false);
        setRefreshing(false);
      } else {
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    // 1. Load from localStorage cache INSTANTLY
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setBookings(parsed);
          setLoading(false);
          // Refresh from server in background silently
          loadBookings(true);
          return;
        }
      }
    } catch {}
    // 2. No cache — load from server normally
    loadBookings(false);
  }, []);
  const onRefresh = () => { setRefreshing(true); loadBookings(); };

  const activeBookings = bookings.filter(b => !COMPLETED_STATUSES.includes(b.status));
  const completedBookings = bookings.filter(b => COMPLETED_STATUSES.includes(b.status));
  const displayList = activeTab === 'active' ? activeBookings : completedBookings;

  // Overdue payment reminder: tasks with status 'completed_pending_payment' older than 1 day
  const now = Date.now();
  const overduePayments = user?.role === 'client'
    ? bookings.filter(b => {
        if (b.status !== 'completed_pending_payment') return false;
        const completedAt = b.completed_at || b.updated_at || b.created_at;
        if (!completedAt) return false;
        const msAgo = now - new Date(completedAt).getTime();
        return msAgo > 24 * 60 * 60 * 1000; // more than 1 day
      })
    : [];

  // Show skeleton cards instead of blank white screen while loading
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Мої замовлення</Text>
          <Text style={styles.headerSubtitle}>Завантаження...</Text>
        </View>
        <View style={{ flex: 1, padding: 16 }}>
          {[1, 2, 3].map(i => (
            <View key={i} style={[styles.bookingCard, { padding: 16, marginBottom: 12 }]}>
              <View style={{ height: 14, width: '40%', backgroundColor: '#e5e7eb', borderRadius: 7, marginBottom: 10 }} />
              <View style={{ height: 18, width: '70%', backgroundColor: '#f3f4f6', borderRadius: 7, marginBottom: 8 }} />
              <View style={{ height: 12, width: '55%', backgroundColor: '#f3f4f6', borderRadius: 6 }} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  const renderCard = (booking: any) => {
    // Guard: skip invalid bookings that could crash the render
    if (!booking || !booking.booking_id) return null;

    const statusColor = STATUS_COLORS[booking.status] || '#6b7280';
    const statusLabel = STATUS_LABELS[booking.status] || booking.status || 'Невідомо';
    // Client sees price including 15% platform commission
    const rawPrice = booking.total_price || booking.estimated_price || 0;
    const price = rawPrice > 0 ? Math.round(rawPrice * 1.15 * 100) / 100 : 0;
    const title = booking.title || booking.service?.name || 'Послуга';
    const isCompleted = COMPLETED_STATUSES.includes(booking.status);
    const bookingIdStr = String(booking.booking_id || '');

    const handlePress = () => {
      // Use linked task_id if task exists, else use booking_id (task-detail resolves both)
      const taskId = booking.task?.task_id || booking.task_id || booking.booking_id;
      const hasTask = !!(booking.task?.task_id || booking.task_id);
      if (hasTask || ['assigned','on_the_way','started','completed_pending_payment','paid','completed'].includes(booking.status)) {
        router.push(`/task-detail?id=${taskId}`);
      } else {
        router.push({ pathname: '/(tabs)/booking-detail', params: { booking_id: booking.booking_id } });
      }
    };

    return (
      <TouchableOpacity
        key={booking.booking_id}
        style={styles.bookingCard}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        <View style={[styles.statusStrip, { backgroundColor: statusColor }]} />
        <View style={styles.cardInner}>
          <View style={styles.bookingHeader}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
            <Text style={styles.bookingId}>#{bookingIdStr.slice(-6)}</Text>
          </View>

          <Text style={styles.bookingTitle} numberOfLines={1}>{title}</Text>

          <View style={styles.bookingInfo}>
            {!!(booking.scheduled_date || booking.date) && (
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={15} color="#6b7280" />
                <Text style={styles.infoText}>
                  {booking.scheduled_date || booking.date}
                  {(booking.scheduled_time || booking.time) ? ` о ${booking.scheduled_time || booking.time}` : ''}
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
                <Text style={[styles.infoText, { color: '#10b981', fontWeight: '600' }]}>{price} грн</Text>
              </View>
            )}
            {isCompleted && booking.actual_hours != null && (
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={15} color="#2563eb" />
                <Text style={[styles.infoText, { color: '#2563eb' }]}>Відпрацьовано: {booking.actual_hours} год</Text>
              </View>
            )}
          </View>

          {/* Status progress tracker for active tasks */}
          {['assigned','hold_placed','on_the_way','started'].includes(booking.status) && (
            <View style={styles.progressTracker}>
              {[
                { key: 'assigned',   icon: 'person-add-outline',   label: 'Прийнято' },
                { key: 'on_the_way', icon: 'car-outline',           label: 'В дорозі' },
                { key: 'started',    icon: 'construct-outline',     label: 'В роботі' },
              ].map((step, idx, arr) => {
                const ORDER = ['assigned','hold_placed','on_the_way','started'];
                const curIdx = ORDER.indexOf(booking.status);
                const stepIdx = ORDER.indexOf(step.key);
                const done = stepIdx <= curIdx;
                const active = step.key === booking.status || (step.key === 'assigned' && booking.status === 'hold_placed');
                return (
                  <React.Fragment key={step.key}>
                    <View style={styles.progressStep}>
                      <View style={[styles.progressDot, done && styles.progressDotDone, active && styles.progressDotActive]}>
                        <Ionicons name={step.icon as any} size={13} color={done ? '#fff' : '#9ca3af'} />
                      </View>
                      <Text style={[styles.progressLabel, done && styles.progressLabelDone]}>{step.label}</Text>
                    </View>
                    {idx < arr.length - 1 && (
                      <View style={[styles.progressLine, stepIdx < curIdx && styles.progressLineDone]} />
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          )}

          {booking.status === 'completed_pending_payment' && user?.role === 'client' && (
            <View style={styles.payPrompt}>
              <Ionicons name="card-outline" size={15} color="#92400e" />
              <Text style={styles.payPromptText}>Натисніть щоб оплатити</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Мої замовлення</Text>
        <Text style={styles.headerSubtitle}>
          {user?.role === 'provider' ? 'Ваші призначені завдання' : 'Ваші замовлення послуг'}
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.tabActive]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
            Активні ({activeBookings.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.tabActiveCompleted]}
          onPress={() => setActiveTab('completed')}
        >
          <Ionicons
            name="checkmark-done-circle"
            size={15}
            color={activeTab === 'completed' ? '#22c55e' : '#9ca3af'}
            style={{ marginRight: 5 }}
          />
          <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextCompleted]}>
            Виконані ({completedBookings.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Overdue payment reminder banner */}
      {overduePayments.length > 0 && (
        <View style={styles.overduePayBanner}>
          <Ionicons name="alert-circle" size={22} color="#b45309" />
          <View style={{ flex: 1 }}>
            <Text style={styles.overduePayTitle}>
              {overduePayments.length === 1
                ? 'Є несплачене завдання!'
                : `${overduePayments.length} несплачених завдань!`}
            </Text>
            <Text style={styles.overduePayText}>
              Будь ласка, оплатіть виконані завдання. Виконавець чекає на оплату більше доби.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setActiveTab('completed')}
            style={styles.overduePayBtn}
          >
            <Text style={styles.overduePayBtnText}>Переглянути</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {displayList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name={activeTab === 'active' ? 'calendar-outline' : 'checkmark-done-circle-outline'}
              size={64}
              color="#d1d5db"
            />
            <Text style={styles.emptyText}>
              {activeTab === 'active' ? 'Немає активних замовлень' : 'Немає виконаних завдань'}
            </Text>
            {activeTab === 'active' && user?.role === 'client' && (
              <TouchableOpacity style={styles.browseButton} onPress={() => router.push('/(tabs)')}>
                <Text style={styles.browseButtonText}>Знайти виконавця</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          displayList.map(renderCard)
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#111827' },
  headerSubtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#2563eb' },
  tabActiveCompleted: { borderBottomColor: '#22c55e' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#9ca3af' },
  tabTextActive: { color: '#2563eb' },
  tabTextCompleted: { color: '#22c55e' },
  content: { flex: 1, padding: 16 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  emptyText: { marginTop: 16, fontSize: 16, color: '#6b7280' },
  browseButton: {
    marginTop: 24,
    backgroundColor: '#2563eb',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  browseButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  overduePayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fef3c7',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    margin: 12,
    marginBottom: 0,
    padding: 14,
    borderRadius: 12,
  },
  overduePayTitle: { fontSize: 14, fontWeight: '700', color: '#92400e', marginBottom: 2 },
  overduePayText: { fontSize: 12, color: '#78350f', lineHeight: 17 },
  overduePayBtn: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  overduePayBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
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
  statusStrip: { width: 5 },
  cardInner: { flex: 1, padding: 14 },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: '700' },
  bookingId: { fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' },
  bookingTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 },
  bookingInfo: { gap: 5 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 13, color: '#6b7280', flex: 1 },
  payPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: '#fef9c3',
    padding: 8,
    borderRadius: 8,
  },
  payPromptText: { fontSize: 13, color: '#92400e', fontWeight: '600' },
  progressTracker: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  progressStep: { alignItems: 'center', gap: 4 },
  progressDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#e5e7eb',
    alignItems: 'center', justifyContent: 'center',
  },
  progressDotDone: { backgroundColor: '#2563eb' },
  progressDotActive: { backgroundColor: '#2563eb', shadowColor: '#2563eb', shadowOpacity: 0.4, shadowRadius: 6, elevation: 4 },
  progressLabel: { fontSize: 10, color: '#9ca3af', fontWeight: '500', textAlign: 'center' },
  progressLabelDone: { color: '#2563eb', fontWeight: '700' },
  progressLine: { flex: 1, height: 2, backgroundColor: '#e5e7eb', marginBottom: 14, marginHorizontal: 4 },
  progressLineDone: { backgroundColor: '#2563eb' },
});
