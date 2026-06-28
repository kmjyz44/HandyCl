import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';

const MONTHS = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру'];

const METHOD_LABEL: Record<string, string> = {
  finix: 'Finix', stripe: 'Stripe', manual: 'Вручну', zelle: 'Zelle', venmo: 'Venmo', paypal: 'PayPal',
};

export default function AdminPaymentStats() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [year, setYear] = useState<number | undefined>(undefined);
  const [month, setMonth] = useState<number | undefined>(undefined);
  const [sort, setSort] = useState('date_desc');

  const load = useCallback(async () => {
    try {
      const r = await api.getPaymentStats({ year, month, sort });
      setData(r);
    } catch (e) {
      setData({ payments: [], total_amount: 0, total_commission: 0, total_count: 0, by_month: [], available_years: [] });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [year, month, sort]);

  useEffect(() => { load(); }, [load]);

  const fmt = (n: number, cur = 'USD') => `${cur === 'UAH' ? '₴' : '$'}${Number(n || 0).toFixed(2)}`;
  const fmtDate = (iso: string) => {
    try { const d = new Date(iso); return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`; }
    catch { return iso; }
  };

  return (
    <View style={styles.container} data-testid="admin-payment-stats-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="stats-back-btn">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Статистика платежів</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Filters */}
      <View style={{ maxHeight: 50 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <TouchableOpacity
            style={[styles.chip, !year && styles.chipActive]}
            onPress={() => { setYear(undefined); setMonth(undefined); }}
            data-testid="filter-year-all"
          >
            <Text style={[styles.chipText, !year && styles.chipTextActive]}>Усі роки</Text>
          </TouchableOpacity>
          {(data?.available_years || []).map((y: number) => (
            <TouchableOpacity key={y} style={[styles.chip, year === y && styles.chipActive]} onPress={() => setYear(y)} data-testid={`filter-year-${y}`}>
              <Text style={[styles.chipText, year === y && styles.chipTextActive]}>{y}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.sep} />
          <TouchableOpacity style={[styles.chip, !month && styles.chipActive]} onPress={() => setMonth(undefined)} data-testid="filter-month-all">
            <Text style={[styles.chipText, !month && styles.chipTextActive]}>Усі міс.</Text>
          </TouchableOpacity>
          {MONTHS.map((m, i) => (
            <TouchableOpacity key={m} style={[styles.chip, month === i + 1 && styles.chipActive]} onPress={() => setMonth(i + 1)} data-testid={`filter-month-${i + 1}`}>
              <Text style={[styles.chipText, month === i + 1 && styles.chipTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#7c3aed" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Summary */}
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { backgroundColor: '#ecfdf5' }]} data-testid="stat-total">
                <Text style={styles.summaryVal}>{fmt(data?.total_amount)}</Text>
                <Text style={styles.summaryLabel}>Загальна сума</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: '#eff6ff' }]} data-testid="stat-commission">
                <Text style={styles.summaryVal}>{fmt(data?.total_commission)}</Text>
                <Text style={styles.summaryLabel}>Комісія платформи</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: '#fef3c7' }]} data-testid="stat-count">
                <Text style={styles.summaryVal}>{data?.total_count || 0}</Text>
                <Text style={styles.summaryLabel}>Платежів</Text>
              </View>
            </View>

            {/* Sort */}
            <View style={styles.sortRow}>
              <Text style={styles.sortLabel}>Сортувати:</Text>
              {[
                { id: 'date_desc', label: 'Нові' },
                { id: 'date_asc', label: 'Старі' },
                { id: 'amount_desc', label: 'Сума ↓' },
                { id: 'amount_asc', label: 'Сума ↑' },
              ].map((o) => (
                <TouchableOpacity key={o.id} style={[styles.sortChip, sort === o.id && styles.sortChipActive]} onPress={() => setSort(o.id)} data-testid={`sort-${o.id}`}>
                  <Text style={[styles.sortChipText, sort === o.id && { color: '#fff' }]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Monthly breakdown */}
            {(data?.by_month || []).length > 0 && (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>По місяцях</Text>
                {data.by_month.map((m: any) => (
                  <View key={`${m.year}-${m.month}`} style={styles.monthRow} data-testid={`month-${m.year}-${m.month}`}>
                    <Text style={styles.monthName}>{MONTHS[m.month - 1]} {m.year}</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.monthTotal}>{fmt(m.total)}</Text>
                      <Text style={styles.monthSub}>комісія {fmt(m.commission)} · {m.count} пл.</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Payments list */}
            <View style={styles.block}>
              <Text style={styles.blockTitle}>Платежі ({data?.payments?.length || 0})</Text>
              {(data?.payments || []).length === 0 ? (
                <Text style={styles.empty}>Платежів за обраний період немає</Text>
              ) : (
                data.payments.map((p: any) => (
                  <View key={p.transaction_id} style={styles.payRow} data-testid={`payment-${p.transaction_id}`}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.payTask} numberOfLines={1}>{p.task_title}</Text>
                      <Text style={styles.paySub} numberOfLines={1}>{p.client_name} → {p.executor_name}</Text>
                      <Text style={styles.payMeta}>{fmtDate(p.date)} · {METHOD_LABEL[p.method] || p.method}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.payAmount}>{fmt(p.amount, p.currency)}</Text>
                      <Text style={styles.payCommission}>комісія {fmt(p.commission, p.currency)}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 50, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  filters: { padding: 12, gap: 8, alignItems: 'center' },
  chip: { paddingHorizontal: 14, height: 34, justifyContent: 'center', alignSelf: 'center', borderRadius: 17, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  chipActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  chipText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  sep: { width: 1, height: 24, backgroundColor: '#e5e7eb', alignSelf: 'center', marginHorizontal: 4 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryCard: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center' },
  summaryVal: { fontSize: 18, fontWeight: '800', color: '#111827' },
  summaryLabel: { fontSize: 11, color: '#6b7280', marginTop: 4, textAlign: 'center' },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16, flexWrap: 'wrap' },
  sortLabel: { fontSize: 13, color: '#6b7280' },
  sortChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  sortChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  sortChipText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  block: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#f3f4f6' },
  blockTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  monthName: { fontSize: 14, fontWeight: '600', color: '#374151' },
  monthTotal: { fontSize: 15, fontWeight: '700', color: '#059669' },
  monthSub: { fontSize: 11, color: '#9ca3af' },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  payTask: { fontSize: 14, fontWeight: '600', color: '#111827' },
  paySub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  payMeta: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  payAmount: { fontSize: 15, fontWeight: '700', color: '#111827' },
  payCommission: { fontSize: 11, color: '#2563eb', marginTop: 2 },
  empty: { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 20 },
});
