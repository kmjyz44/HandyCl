import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert, Platform, Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';

type Pending = {
  booking_id: string;
  transaction_id?: string;
  title?: string;
  category?: string;
  payment_status: string;
  payment_method?: string;
  total_price?: number;
  platform_take?: number;
  executor_take?: number;
  tip_amount?: number;
  commission_rate_snapshot?: number;
  manual_payment_submitted_at?: string;
  executor_confirmed: boolean;
  admin_confirmed: boolean;
  client?: { name?: string; email?: string; phone?: string };
  provider?: {
    name?: string; email?: string; phone?: string;
    paypal_email?: string; zelle_handle?: string; venmo_handle?: string;
  };
  created_at?: string;
};

type FilterTab = 'all' | 'awaiting_admin' | 'awaiting_executor' | 'disputed';

export default function AdminPaymentsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<Pending[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.adminListPendingPayments();
      setItems((data?.items as Pending[]) || []);
    } catch (e: any) {
      Alert.alert('Помилка', e?.response?.data?.detail || e?.message || 'Не вдалося завантажити');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user && user.role !== 'admin') {
      Alert.alert('Доступ заборонено', 'Тільки для адміністратора', [
        { text: 'OK', onPress: () => router.back() },
      ]);
      return;
    }
    load();
  }, [user, load, router]);

  const onApprove = async (item: Pending) => {
    if (!item.transaction_id) {
      Alert.alert('Помилка', 'Транзакція не знайдена');
      return;
    }
    setBusy(item.booking_id);
    try {
      const r = await api.adminVerifyPayment(item.transaction_id, 'approve');
      Alert.alert('Готово', r.payment_status === 'paid'
        ? 'Завдання повністю оплачено ✅'
        : 'Адмін підтвердив. Чекаємо на виконавця.'
      );
      await load();
    } catch (e: any) {
      Alert.alert('Помилка', e?.response?.data?.detail || 'Не вдалось');
    } finally {
      setBusy(null);
    }
  };

  const onReject = async (item: Pending) => {
    if (!item.transaction_id) {
      Alert.alert('Помилка', 'Транзакція не знайдена');
      return;
    }
    const confirmed = Platform.OS === 'web'
      ? typeof window !== 'undefined' && window.confirm('Відхилити платіж? Бронювання перейде у статус "Спір".')
      : await new Promise<boolean>(resolve => {
          Alert.alert('Відхилити платіж?', 'Бронювання перейде у спір.', [
            { text: 'Скасувати', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Так, відхилити', style: 'destructive', onPress: () => resolve(true) },
          ]);
        });
    if (!confirmed) return;
    setBusy(item.booking_id);
    try {
      await api.adminVerifyPayment(item.transaction_id, 'reject');
      Alert.alert('Відхилено', 'Спір відкрито. Зв\'яжіться з клієнтом.');
      await load();
    } catch (e: any) {
      Alert.alert('Помилка', e?.response?.data?.detail || 'Не вдалось');
    } finally {
      setBusy(null);
    }
  };

  const filtered = items.filter(it => {
    if (filter === 'all') return true;
    if (filter === 'disputed') return it.payment_status === 'disputed';
    if (filter === 'awaiting_admin') return !it.admin_confirmed && it.payment_status !== 'disputed';
    if (filter === 'awaiting_executor') return !it.executor_confirmed && it.payment_status !== 'disputed';
    return true;
  });

  const counts = {
    all: items.length,
    awaiting_admin: items.filter(i => !i.admin_confirmed && i.payment_status !== 'disputed').length,
    awaiting_executor: items.filter(i => !i.executor_confirmed && i.payment_status !== 'disputed').length,
    disputed: items.filter(i => i.payment_status === 'disputed').length,
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container} data-testid="admin-payments-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="back-btn">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Перевірка оплат</Text>
        <TouchableOpacity onPress={load} disabled={refreshing} style={styles.refreshBtn} data-testid="refresh-btn">
          <Ionicons name="refresh" size={22} color="#2563eb" />
        </TouchableOpacity>
      </View>

      <View style={{ maxHeight: 58 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {([
          { id: 'all', label: 'Всі', color: '#374151' },
          { id: 'awaiting_admin', label: 'Чекає на адміна', color: '#b45309' },
          { id: 'awaiting_executor', label: 'Чекає на виконавця', color: '#2563eb' },
          { id: 'disputed', label: 'Спір', color: '#dc2626' },
        ] as { id: FilterTab; label: string; color: string }[]).map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, filter === t.id && { backgroundColor: t.color }]}
            onPress={() => setFilter(t.id)}
            data-testid={`filter-${t.id}`}
          >
            <Text style={[styles.tabText, filter === t.id && { color: '#fff' }]}>
              {t.label} ({counts[t.id]})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
          />
        }
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>Немає платежів на перевірку</Text>
          </View>
        ) : (
          filtered.map(item => {
            const isDisputed = item.payment_status === 'disputed';
            const fullyConfirmed = item.executor_confirmed && item.admin_confirmed;
            return (
              <View
                key={item.booking_id}
                style={[styles.card, isDisputed && styles.cardDisputed]}
                data-testid={`payment-card-${item.booking_id}`}
              >
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.title || 'Завдання'}
                    </Text>
                    <Text style={styles.cardSub}>
                      {item.payment_method?.toUpperCase()} · {item.category}
                    </Text>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    isDisputed && { backgroundColor: '#fee2e2' },
                  ]}>
                    <Text style={[
                      styles.statusBadgeText,
                      isDisputed && { color: '#dc2626' },
                    ]}>
                      {isDisputed ? '⚠ Спір' : 'В очікуванні'}
                    </Text>
                  </View>
                </View>

                <View style={styles.amountRow}>
                  <View style={styles.amountBox}>
                    <Text style={styles.amountLabel}>Клієнт сплачує</Text>
                    <Text style={styles.amountValue}>
                      {(item.total_price || 0).toFixed(2)} ₴
                    </Text>
                  </View>
                  <View style={styles.amountBox}>
                    <Text style={styles.amountLabel}>Платформі</Text>
                    <Text style={[styles.amountValue, { color: '#059669' }]}>
                      {(item.platform_take || 0).toFixed(2)} ₴
                    </Text>
                  </View>
                  <View style={styles.amountBox}>
                    <Text style={styles.amountLabel}>Виконавцю</Text>
                    <Text style={styles.amountValue}>
                      {((item.executor_take || 0) + (item.tip_amount || 0)).toFixed(2)} ₴
                    </Text>
                    {!!item.tip_amount && item.tip_amount > 0 && (
                      <Text style={styles.tipBadge}>+{item.tip_amount.toFixed(0)} ₴ чайові</Text>
                    )}
                  </View>
                </View>

                <View style={styles.confirmRow}>
                  <View style={[styles.confirmPill, item.executor_confirmed && styles.confirmPillOK]}>
                    <Ionicons
                      name={item.executor_confirmed ? 'checkmark-circle' : 'time-outline'}
                      size={14}
                      color={item.executor_confirmed ? '#059669' : '#9ca3af'}
                    />
                    <Text style={[styles.confirmText, item.executor_confirmed && { color: '#059669' }]}>
                      Виконавець
                    </Text>
                  </View>
                  <View style={[styles.confirmPill, item.admin_confirmed && styles.confirmPillOK]}>
                    <Ionicons
                      name={item.admin_confirmed ? 'checkmark-circle' : 'time-outline'}
                      size={14}
                      color={item.admin_confirmed ? '#059669' : '#9ca3af'}
                    />
                    <Text style={[styles.confirmText, item.admin_confirmed && { color: '#059669' }]}>
                      Адмін
                    </Text>
                  </View>
                </View>

                <View style={styles.peopleBlock}>
                  <View style={styles.personRow}>
                    <Text style={styles.personLabel}>Клієнт:</Text>
                    <Text style={styles.personValue} numberOfLines={1}>
                      {item.client?.name || item.client?.email || '—'}
                    </Text>
                  </View>
                  {!!item.client?.email && (
                    <Text style={styles.personContact}>📧 {item.client.email}</Text>
                  )}
                  {!!item.client?.phone && (
                    <Text style={styles.personContact}>📞 {item.client.phone}</Text>
                  )}
                  <View style={[styles.personRow, { marginTop: 8 }]}>
                    <Text style={styles.personLabel}>Виконавець:</Text>
                    <Text style={styles.personValue} numberOfLines={1}>
                      {item.provider?.name || item.provider?.email || '—'}
                    </Text>
                  </View>
                  {!!item.provider?.email && (
                    <Text style={styles.personContact}>📧 {item.provider.email}</Text>
                  )}
                  {item.payment_method === 'paypal' && !!item.provider?.paypal_email && (
                    <Text style={styles.personContact}>PayPal: {item.provider.paypal_email}</Text>
                  )}
                  {item.payment_method === 'zelle' && !!item.provider?.zelle_handle && (
                    <Text style={styles.personContact}>Zelle: {item.provider.zelle_handle}</Text>
                  )}
                  {item.payment_method === 'venmo' && !!item.provider?.venmo_handle && (
                    <Text style={styles.personContact}>Venmo: {item.provider.venmo_handle}</Text>
                  )}
                </View>

                {!item.admin_confirmed && !isDisputed && (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.btn, styles.approveBtn]}
                      onPress={() => onApprove(item)}
                      disabled={busy === item.booking_id}
                      data-testid={`approve-${item.booking_id}`}
                    >
                      {busy === item.booking_id ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={18} color="#fff" />
                          <Text style={styles.btnText}>Підтвердити отримання</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btn, styles.rejectBtn]}
                      onPress={() => onReject(item)}
                      disabled={busy === item.booking_id}
                      data-testid={`reject-${item.booking_id}`}
                    >
                      <Ionicons name="close-circle" size={18} color="#dc2626" />
                      <Text style={[styles.btnText, { color: '#dc2626' }]}>Відхилити</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {item.admin_confirmed && !fullyConfirmed && (
                  <View style={styles.infoBox}>
                    <Text style={styles.infoText}>
                      ✅ Ви підтвердили. Чекаємо на виконавця.
                    </Text>
                  </View>
                )}

                {isDisputed && (
                  <View style={[styles.infoBox, { backgroundColor: '#fef2f2', borderColor: '#fca5a5' }]}>
                    <Text style={[styles.infoText, { color: '#dc2626' }]}>
                      ⚠ Спір — зв'яжіться з клієнтом та виконавцем для з'ясування.
                    </Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  backBtn: { padding: 4, marginRight: 8 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827', flex: 1 },
  refreshBtn: { padding: 4 },
  tabs: { padding: 12, gap: 8, alignItems: 'center' },
  tab: {
    paddingHorizontal: 14, height: 34, justifyContent: 'center', alignSelf: 'center',
    borderRadius: 17, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb',
  },
  tabText: { fontSize: 12, fontWeight: '700', color: '#374151' },

  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  cardDisputed: { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  statusBadge: {
    backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700', color: '#92400e' },

  amountRow: {
    flexDirection: 'row', gap: 8, marginBottom: 10,
    backgroundColor: '#f9fafb', borderRadius: 10, padding: 10,
  },
  amountBox: { flex: 1, alignItems: 'center' },
  amountLabel: { fontSize: 10, color: '#6b7280', textTransform: 'uppercase', fontWeight: '600' },
  amountValue: { fontSize: 14, fontWeight: '800', color: '#111827', marginTop: 2 },
  tipBadge: { fontSize: 10, color: '#f59e0b', fontWeight: '700', marginTop: 2 },

  confirmRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  confirmPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#f3f4f6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  confirmPillOK: { backgroundColor: '#d1fae5' },
  confirmText: { fontSize: 11, fontWeight: '700', color: '#6b7280' },

  peopleBlock: {
    backgroundColor: '#f9fafb', borderRadius: 10, padding: 10, marginBottom: 10,
  },
  personRow: { flexDirection: 'row', alignItems: 'center' },
  personLabel: { fontSize: 12, color: '#6b7280', fontWeight: '600', marginRight: 6 },
  personValue: { fontSize: 13, color: '#111827', fontWeight: '600', flex: 1 },
  personContact: { fontSize: 11, color: '#6b7280', marginTop: 2, marginLeft: 4 },

  actions: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 10, gap: 6,
  },
  approveBtn: { backgroundColor: '#10b981' },
  rejectBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#dc2626' },
  btnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  infoBox: {
    backgroundColor: '#eff6ff', borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: '#bfdbfe',
  },
  infoText: { fontSize: 12, color: '#1e3a8a', fontWeight: '600' },

  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  emptyText: { fontSize: 14, color: '#9ca3af', marginTop: 12 },
});
