import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';

const MONTHS_UA = ['Січень','Лютий','Березень','Квітень','Травень','Червень',
  'Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];

export default function Earnings() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [earnings, setEarnings] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null); // 'YYYY-MM' or null = all

  const loadData = async () => {
    try {
      const [earningsRes, historyRes] = await Promise.all([
        api.getEarnings(),
        api.getEarningsHistory(365),
      ]);
      setEarnings(earningsRes);
      setHistory(historyRes || []);
    } catch (error) {
      console.error('Error loading earnings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);
  const onRefresh = () => { setRefreshing(true); loadData(); };

  const fmt = (val: number | undefined | null) =>
    val && val > 0 ? `${Math.round(val)} ₴` : '0 ₴';

  const fmtDate = (iso?: string) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
      return d.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return '—'; }
  };

  const getMonthKey = (iso?: string) => {
    if (!iso) return null;
    try {
      const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    } catch { return null; }
  };

  const paidAll = history.filter(i => i.status === 'paid');
  const pendingAll = history.filter(i => i.status === 'completed_pending_payment');

  // Build list of months that have paid tasks
  const availableMonths = useMemo(() => {
    const keys = new Set<string>();
    paidAll.forEach(i => {
      const k = getMonthKey(i.completed_at || i.paid_at);
      if (k) keys.add(k);
    });
    return Array.from(keys).sort().reverse();
  }, [paidAll]);

  // Filtered items
  const paidItems = selectedMonth
    ? paidAll.filter(i => getMonthKey(i.completed_at || i.paid_at) === selectedMonth)
    : paidAll;
  const pendingItems = pendingAll;

  // Aggregates for current filter
  const totalEarned = paidItems.reduce((s, i) => s + (i.final_price || i.provider_payout || 0), 0);
  const totalTips = paidItems.reduce((s, i) => s + (i.tip_amount || 0), 0);
  const totalPending = pendingItems.reduce((s, i) => s + (i.final_price || 0), 0);
  const totalHours = paidItems.reduce((s, i) => s + (i.actual_hours || 0), 0);
  const totalJobs = paidItems.length;

  // Monthly stats for bar chart
  const monthlyStats = useMemo(() => {
    const map: Record<string, { earned: number; jobs: number; tips: number }> = {};
    paidAll.forEach(i => {
      const k = getMonthKey(i.completed_at || i.paid_at);
      if (!k) return;
      if (!map[k]) map[k] = { earned: 0, jobs: 0, tips: 0 };
      map[k].earned += i.final_price || i.provider_payout || 0;
      map[k].jobs += 1;
      map[k].tips += i.tip_amount || 0;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  }, [paidAll]);

  const maxEarned = Math.max(...monthlyStats.map(([, v]) => v.earned), 1);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Заробіток</Text>
        <Text style={styles.headerSub}>Ваші фінансові показники</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Main earned card */}
        <View style={styles.mainCard}>
          <View style={styles.mainCardTop}>
            <Ionicons name="wallet-outline" size={32} color="#fff" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.mainCardLabel}>
                {selectedMonth ? (() => {
                  const [y, m] = selectedMonth.split('-');
                  return `${MONTHS_UA[parseInt(m) - 1]} ${y}`;
                })() : 'Зароблено всього'}
              </Text>
              <Text style={styles.mainCardValue}>{fmt(totalEarned + totalTips)}</Text>
            </View>
          </View>
          <View style={styles.mainCardDivider} />
          <View style={styles.mainCardRow}>
            <View style={styles.mainCardStat}>
              <Ionicons name="gift-outline" size={18} color="rgba(255,255,255,0.8)" />
              <Text style={styles.mainCardStatVal}>{fmt(totalTips)}</Text>
              <Text style={styles.mainCardStatLbl}>Чайові</Text>
            </View>
            <View style={styles.mainCardStat}>
              <Ionicons name="briefcase-outline" size={18} color="rgba(255,255,255,0.8)" />
              <Text style={styles.mainCardStatVal}>{totalJobs}</Text>
              <Text style={styles.mainCardStatLbl}>Завдань</Text>
            </View>
            <View style={styles.mainCardStat}>
              <Ionicons name="hourglass-outline" size={18} color="rgba(255,255,255,0.8)" />
              <Text style={styles.mainCardStatVal}>{totalHours > 0 ? `${totalHours.toFixed(1)} год` : '0'}</Text>
              <Text style={styles.mainCardStatLbl}>Годин</Text>
            </View>
          </View>
        </View>

        {/* Pending payout card */}
        {totalPending > 0 && (
          <View style={styles.pendingCard}>
            <View style={styles.pendingLeft}>
              <Ionicons name="time-outline" size={28} color="#d97706" />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.pendingLabel}>Очікує виплати</Text>
                <Text style={styles.pendingSubLabel}>Завдання виконано, оплата в обробці</Text>
              </View>
            </View>
            <Text style={styles.pendingValue}>{fmt(totalPending)}</Text>
          </View>
        )}

        {/* Payout setup CTA */}
        <TouchableOpacity
          style={styles.payoutSetupCard}
          onPress={() => router.push('/payout-setup' as any)}
          data-testid="open-payout-setup-btn"
        >
          <View style={styles.payoutSetupLeft}>
            <View style={styles.payoutSetupIcon}>
              <Ionicons name="card-outline" size={24} color="#2563eb" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.payoutSetupTitle}>Куди отримувати кошти</Text>
              <Text style={styles.payoutSetupSub}>Додайте картку або банківський рахунок</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>

        {/* Breakdown */}
        <View style={styles.breakdownCard}>
          <Text style={styles.sectionTitle}>Деталі заробітку</Text>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Оплата за роботу</Text>
            <Text style={styles.breakdownValue}>{fmt(totalEarned)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Чайові від клієнтів</Text>
            <Text style={[styles.breakdownValue, { color: '#f59e0b' }]}>{fmt(totalTips)}</Text>
          </View>
          <View style={[styles.breakdownRow, { borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 8, paddingTop: 8 }]}>
            <Text style={[styles.breakdownLabel, { fontWeight: '700', color: '#111827' }]}>Загальна сума</Text>
            <Text style={[styles.breakdownValue, { color: '#10b981', fontWeight: '800' }]}>{fmt(totalEarned + totalTips)}</Text>
          </View>
        </View>

        {/* Monthly bar chart */}
        {monthlyStats.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.sectionTitle}>Статистика по місяцях</Text>
            <View style={styles.barChart}>
              {monthlyStats.map(([key, val]) => {
                const [y, m] = key.split('-');
                const barH = Math.max(4, Math.round((val.earned / maxEarned) * 80));
                const isSelected = selectedMonth === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={styles.barCol}
                    onPress={() => setSelectedMonth(isSelected ? null : key)}
                  >
                    <Text style={styles.barAmount}>{val.earned > 0 ? `${Math.round(val.earned / 1000)}к` : ''}</Text>
                    <View style={[styles.bar, { height: barH, backgroundColor: isSelected ? '#2563eb' : '#93c5fd' }]} />
                    <Text style={[styles.barLabel, isSelected && { color: '#2563eb', fontWeight: '700' }]}>
                      {MONTHS_UA[parseInt(m) - 1].slice(0, 3)}
                    </Text>
                    <Text style={styles.barJobs}>{val.jobs} зав</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {selectedMonth && (
              <TouchableOpacity style={styles.clearFilter} onPress={() => setSelectedMonth(null)}>
                <Ionicons name="close-circle" size={16} color="#6b7280" />
                <Text style={styles.clearFilterText}>Показати всі місяці</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Month filter pills */}
        {availableMonths.length > 1 && (
          <View style={styles.monthFilter}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
              <TouchableOpacity
                style={[styles.monthPill, !selectedMonth && styles.monthPillActive]}
                onPress={() => setSelectedMonth(null)}
              >
                <Text style={[styles.monthPillText, !selectedMonth && styles.monthPillTextActive]}>Всі</Text>
              </TouchableOpacity>
              {availableMonths.map(key => {
                const [y, m] = key.split('-');
                const label = `${MONTHS_UA[parseInt(m) - 1]} ${y}`;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.monthPill, selectedMonth === key && styles.monthPillActive]}
                    onPress={() => setSelectedMonth(selectedMonth === key ? null : key)}
                  >
                    <Text style={[styles.monthPillText, selectedMonth === key && styles.monthPillTextActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Історія {selectedMonth ? (() => {
              const [y, m] = selectedMonth.split('-');
              return `— ${MONTHS_UA[parseInt(m) - 1]} ${y}`;
            })() : 'виплат'}
          </Text>

          {/* Pending items first (only when no month filter) */}
          {!selectedMonth && pendingItems.length > 0 && (
            <>
              <Text style={styles.groupLabel}>⏳ Очікує оплати</Text>
              {pendingItems.map(item => (
                <TouchableOpacity
                  key={item.task_id}
                  style={styles.historyItem}
                  onPress={() => router.push(`/task-detail?id=${item.task_id}`)}
                >
                  <View style={[styles.historyIcon, { backgroundColor: '#fffbeb' }]}>
                    <Ionicons name="time-outline" size={22} color="#d97706" />
                  </View>
                  <View style={styles.historyContent}>
                    <Text style={styles.historyTitle}>{item.title}</Text>
                    <Text style={styles.historyDate}>{fmtDate(item.completed_at)}</Text>
                    {item.client?.name && <Text style={styles.historyClient}>{item.client.name}</Text>}
                  </View>
                  <View style={styles.historyAmount}>
                    <Text style={[styles.amountValue, { color: '#d97706' }]}>{fmt(item.final_price)}</Text>
                    <Text style={styles.pendingBadge}>очікує</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* Paid items */}
          {paidItems.length > 0 ? (
            <>
              {!selectedMonth && pendingItems.length > 0 && (
                <Text style={[styles.groupLabel, { marginTop: 12 }]}>✅ Оплачено</Text>
              )}
              {paidItems.map(item => (
                <TouchableOpacity
                  key={item.task_id}
                  style={styles.historyItem}
                  onPress={() => router.push(`/task-detail?id=${item.task_id}`)}
                >
                  <View style={[styles.historyIcon, { backgroundColor: '#f0fdf4' }]}>
                    <Ionicons name="checkmark-circle" size={22} color="#10b981" />
                  </View>
                  <View style={styles.historyContent}>
                    <Text style={styles.historyTitle}>{item.title}</Text>
                    <Text style={styles.historyDate}>{fmtDate(item.completed_at || item.paid_at)}</Text>
                    {item.client?.name && <Text style={styles.historyClient}>{item.client.name}</Text>}
                    {(item.actual_hours || 0) > 0 && (
                      <Text style={styles.historyHours}>{item.actual_hours} год × {item.hourly_rate || 0} ₴/год</Text>
                    )}
                  </View>
                  <View style={styles.historyAmount}>
                    <Text style={styles.amountValue}>{fmt(item.final_price || item.provider_payout)}</Text>
                    {(item.tip_amount || 0) > 0 && (
                      <Text style={styles.tipValue}>+{fmt(item.tip_amount)} чай</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>
                {selectedMonth ? 'Немає завдань за цей місяць' : 'Поки немає завершених завдань'}
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#fff', padding: 24, paddingTop: 60,
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#111827' },
  headerSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  content: { flex: 1 },

  mainCard: {
    margin: 16, borderRadius: 20, backgroundColor: '#2563eb',
    padding: 20, shadowColor: '#2563eb', shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  mainCardTop: { flexDirection: 'row', alignItems: 'center' },
  mainCardLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  mainCardValue: { fontSize: 34, fontWeight: '900', color: '#fff', marginTop: 2 },
  mainCardDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 16 },
  mainCardRow: { flexDirection: 'row', justifyContent: 'space-around' },
  mainCardStat: { alignItems: 'center', gap: 4 },
  mainCardStatVal: { fontSize: 16, fontWeight: '800', color: '#fff', marginTop: 4 },
  mainCardStatLbl: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },

  pendingCard: {
    marginHorizontal: 16, marginBottom: 12, borderRadius: 16,
    backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a',
    padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  pendingLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  pendingLabel: { fontSize: 15, fontWeight: '700', color: '#92400e' },
  pendingSubLabel: { fontSize: 11, color: '#b45309', marginTop: 2 },
  pendingValue: { fontSize: 22, fontWeight: '900', color: '#d97706' },

  breakdownCard: {
    marginHorizontal: 16, marginBottom: 12, borderRadius: 16,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', padding: 16,
  },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  breakdownLabel: { fontSize: 14, color: '#6b7280' },
  breakdownValue: { fontSize: 14, fontWeight: '700', color: '#111827' },

  chartCard: {
    marginHorizontal: 16, marginBottom: 12, borderRadius: 16,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', padding: 16,
  },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 110, marginTop: 8 },
  barCol: { alignItems: 'center', flex: 1 },
  bar: { width: 28, borderRadius: 6, marginBottom: 4 },
  barAmount: { fontSize: 9, color: '#6b7280', marginBottom: 2 },
  barLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  barJobs: { fontSize: 9, color: '#9ca3af' },
  clearFilter: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, alignSelf: 'center' },
  clearFilterText: { fontSize: 12, color: '#6b7280' },

  monthFilter: { marginBottom: 12 },
  monthPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb',
  },
  monthPillActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  monthPillText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  monthPillTextActive: { color: '#fff' },

  section: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12,
    borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', padding: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  groupLabel: { fontSize: 12, fontWeight: '700', color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

  historyItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  historyIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  historyContent: { flex: 1 },
  historyTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  historyDate: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  historyClient: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  historyHours: { fontSize: 11, color: '#2563eb', marginTop: 2, fontWeight: '600' },
  historyAmount: { alignItems: 'flex-end' },
  amountValue: { fontSize: 15, fontWeight: '800', color: '#10b981' },
  tipValue: { fontSize: 11, color: '#f59e0b', marginTop: 2, fontWeight: '600' },
  pendingBadge: { fontSize: 10, color: '#d97706', fontWeight: '700', marginTop: 2 },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: '#6b7280', marginTop: 12 },

  payoutSetupCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 14,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  payoutSetupLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  payoutSetupIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#eff6ff',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  payoutSetupTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  payoutSetupSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
});
