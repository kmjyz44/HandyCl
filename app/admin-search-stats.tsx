/**
 * Admin: Service search analytics
 *
 * Shows what services people are searching for, from which cities/regions,
 * the daily trend and recent searches. Data comes from the `search_events`
 * collection populated whenever /executors/by-service is called.
 * Backend: GET /admin/search-analytics?days=N
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';
import { showAlert } from '../utils/alert';

type Row = { label: string; count: number };
const RANGES = [7, 30, 90];

export default function AdminSearchStatsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [data, setData] = useState<any>(null);

  useEffect(() => { load(days); }, [days]);
  const load = async (d: number) => {
    setLoading(true);
    try {
      setData(await api.getSearchAnalytics(d));
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  };

  const services: Row[] = (data?.top_services?.length ? data.top_services : data?.top_services_raw) || [];
  const cities: Row[] = data?.top_cities || [];
  const byDay: { date: string; count: number }[] = data?.by_day || [];
  const recent: any[] = data?.recent || [];
  const maxSvc = Math.max(1, ...services.map((r) => r.count));
  const maxCity = Math.max(1, ...cities.map((r) => r.count));
  const maxDay = Math.max(1, ...byDay.map((r) => r.count));

  const Bars = ({ rows, max, color, emptyText }: { rows: Row[]; max: number; color: string; emptyText: string }) => (
    <View style={{ marginTop: 6 }}>
      {rows.length === 0 ? (
        <Text style={s.empty}>{emptyText}</Text>
      ) : rows.map((r, i) => (
        <View key={i} style={s.barRow}>
          <Text style={s.barLabel} numberOfLines={1}>{String(r.label).replace(/_/g, ' ')}</Text>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${Math.round((r.count / max) * 100)}%`, backgroundColor: color }]} />
          </View>
          <Text style={s.barCount}>{r.count}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} data-testid="search-stats-back-btn">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={s.title}>Search insights</Text>
      </View>

      {/* Range selector */}
      <View style={s.ranges}>
        {RANGES.map((r) => (
          <TouchableOpacity
            key={r}
            style={[s.rangeBtn, days === r && s.rangeBtnActive]}
            onPress={() => setDays(r)}
            data-testid={`search-range-${r}`}
          >
            <Text style={[s.rangeText, days === r && s.rangeTextActive]}>{r}d</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#2563eb" />
      ) : (
        <ScrollView contentContainerStyle={s.content} data-testid="admin-search-stats-screen">
          <View style={s.totalCard} data-testid="search-total-card">
            <Text style={s.totalNum}>{data?.total_searches ?? 0}</Text>
            <Text style={s.totalLabel}>total searches · last {data?.range_days ?? days} days</Text>
          </View>

          <Text style={s.section}>Top services</Text>
          <View style={s.card}><Bars rows={services} max={maxSvc} color="#2563eb" emptyText="No searches yet." /></View>

          <Text style={s.section}>Top regions / cities</Text>
          <View style={s.card}><Bars rows={cities} max={maxCity} color="#10b981" emptyText="No location data yet." /></View>

          <Text style={s.section}>Daily trend</Text>
          <View style={s.card}>
            {byDay.length === 0 ? (
              <Text style={s.empty}>No searches yet.</Text>
            ) : (
              <View style={s.trendRow}>
                {byDay.slice(-30).map((d, i) => (
                  <View key={i} style={s.trendCol}>
                    <View style={[s.trendBar, { height: 8 + Math.round((d.count / maxDay) * 90) }]} />
                    <Text style={s.trendDay}>{d.date.slice(5)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <Text style={s.section}>Recent searches</Text>
          <View style={s.card}>
            {recent.length === 0 ? (
              <Text style={s.empty}>No searches yet.</Text>
            ) : recent.map((r, i) => (
              <View key={i} style={s.recentRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.recentSvc} numberOfLines={1}>
                    {(r.category_name || r.service_name || 'Any service').replace(/_/g, ' ')}
                    {r.city ? ` · ${r.city}` : ''}
                  </Text>
                  <Text style={s.recentMeta} numberOfLines={1}>
                    {(r.created_at || '').replace('T', ' ').slice(0, 16)}
                    {r.user_id ? ' · signed-in' : ' · guest'}
                    {r.source && r.source !== 'pros_search' ? ` · ${r.source}` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  back: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  ranges: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  rangeBtn: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff' },
  rangeBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  rangeText: { color: '#374151', fontWeight: '700', fontSize: 13 },
  rangeTextActive: { color: '#fff' },
  content: { padding: 16 },
  totalCard: { backgroundColor: '#111827', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 18 },
  totalNum: { color: '#fff', fontSize: 40, fontWeight: '900' },
  totalLabel: { color: '#9ca3af', fontSize: 13, marginTop: 4 },
  section: { fontSize: 14, fontWeight: '800', color: '#111827', marginBottom: 8, marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', padding: 14, marginBottom: 18 },
  empty: { color: '#9ca3af', fontSize: 13, textAlign: 'center', paddingVertical: 10 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  barLabel: { width: 120, fontSize: 12, color: '#374151', textTransform: 'capitalize' },
  barTrack: { flex: 1, height: 10, backgroundColor: '#f3f4f6', borderRadius: 999, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 999 },
  barCount: { width: 32, textAlign: 'right', fontSize: 12, fontWeight: '700', color: '#111827' },
  trendRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 120 },
  trendCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  trendBar: { width: '70%', backgroundColor: '#7c3aed', borderRadius: 4 },
  trendDay: { fontSize: 8, color: '#9ca3af', marginTop: 4 },
  recentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  recentSvc: { fontSize: 13, fontWeight: '700', color: '#111827', textTransform: 'capitalize' },
  recentMeta: { fontSize: 11, color: '#6b7280', marginTop: 2 },
});
