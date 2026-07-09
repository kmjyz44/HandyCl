import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';

type CoverageCat = { id: string; name: string; count: number };
type CoveragePoint = { label: string; lat: number; lng: number; count: number; level: 'green' | 'yellow' | 'red' };
type Coverage = {
  providers: any[];
  categories: CoverageCat[];
  coverage_points: CoveragePoint[];
  total_active: number;
  total_shown: number;
  states: string[];
};

const LEVEL_COLOR: Record<string, string> = { green: '#16a34a', yellow: '#f59e0b', red: '#dc2626' };

export default function AdminCoveragePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Coverage | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const iframeRef = useRef<any>(null);
  const mapReadyRef = useRef(false);
  const dataRef = useRef<Coverage | null>(null);

  const postToMap = () => {
    const d = dataRef.current;
    if (!d || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ type: 'coverage', providers: d.providers, coverage_points: d.coverage_points }),
      '*',
    );
  };

  const load = async (cat: string | null) => {
    setLoading(true);
    try {
      const d = await api.adminGetCoverage(cat || undefined);
      setData(d);
      dataRef.current = d;
      if (mapReadyRef.current) postToMap();
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(category); /* eslint-disable-next-line */ }, [category]);

  // The map iframe announces when it's ready to receive data
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (event: MessageEvent) => {
      try {
        const d = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (d && d.type === 'coverage-ready') { mapReadyRef.current = true; postToMap(); }
      } catch {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const cats = data?.categories || [];
  const points = data?.coverage_points || [];
  const uncovered = points.filter(p => p.count === 0);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} data-testid="coverage-back-btn">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={s.title}>Coverage Map</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} data-testid="admin-coverage-screen">
        <Text style={s.hint}>
          Each blue circle is a pro's work zone. City labels show how many active pros cover that market:
          <Text style={{ color: '#16a34a', fontWeight: '700' }}> green</Text> (3+),
          <Text style={{ color: '#f59e0b', fontWeight: '700' }}> yellow</Text> (1–2),
          <Text style={{ color: '#dc2626', fontWeight: '700' }}> red</Text> (0 — no pros yet).
        </Text>

        {/* Category filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }} contentContainerStyle={{ gap: 8 }}>
          <TouchableOpacity
            style={[s.chip, category === null && s.chipActive]}
            onPress={() => setCategory(null)}
            data-testid="coverage-cat-all"
          >
            <Text style={[s.chipText, category === null && s.chipTextActive]}>All ({data?.total_active ?? 0})</Text>
          </TouchableOpacity>
          {cats.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[s.chip, category === c.id && s.chipActive]}
              onPress={() => setCategory(c.id)}
              data-testid={`coverage-cat-${c.id}`}
            >
              <Text style={[s.chipText, category === c.id && s.chipTextActive]}>{c.name} ({c.count})</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Map */}
        {Platform.OS === 'web' ? (
          <View style={s.mapWrap}>
            {/* @ts-ignore web iframe */}
            <iframe
              ref={iframeRef}
              title="admin-coverage"
              src="/admin-coverage.html"
              onLoad={() => { mapReadyRef.current = true; postToMap(); }}
              style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12 } as any}
            />
            {loading && (
              <View style={s.mapLoading}><ActivityIndicator color="#2563eb" /></View>
            )}
          </View>
        ) : (
          <View style={s.mapFallback}>
            <Ionicons name="map-outline" size={30} color="#9ca3af" />
            <Text style={s.hint}>Open the web dashboard to view the coverage map.</Text>
          </View>
        )}

        {/* Uncovered markets alert */}
        {uncovered.length > 0 && (
          <View style={s.alertBox} data-testid="coverage-uncovered">
            <Ionicons name="warning" size={18} color="#b45309" />
            <Text style={s.alertText}>
              {uncovered.length} market{uncovered.length > 1 ? 's' : ''} with no pros{category ? ' in this category' : ''}: {uncovered.map(u => u.label).join(', ')}. Recruit pros here before advertising.
            </Text>
          </View>
        )}

        {/* Stats: by category */}
        <Text style={s.section}>Active pros by category{data?.states?.length ? ` · ${data.states.join(', ')}` : ''}</Text>
        <View style={s.card}>
          {cats.length === 0 ? (
            <Text style={s.empty}>No active pros with a configured work zone yet.</Text>
          ) : cats.map(c => (
            <View key={c.id} style={s.statRow} data-testid={`coverage-stat-${c.id}`}>
              <Text style={s.statLabel}>{c.name}</Text>
              <Text style={s.statVal}>{c.count}</Text>
            </View>
          ))}
        </View>

        {/* Stats: by city */}
        <Text style={s.section}>Coverage by city</Text>
        <View style={s.card}>
          {points.length === 0 ? (
            <Text style={s.empty}>No target cities configured. Add them in Service Area.</Text>
          ) : points.map(p => (
            <View key={p.label} style={s.statRow} data-testid={`coverage-city-${p.label}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[s.levelDot, { backgroundColor: LEVEL_COLOR[p.level] }]} />
                <Text style={s.statLabel}>{p.label}</Text>
              </View>
              <Text style={[s.statVal, { color: LEVEL_COLOR[p.level] }]}>
                {p.count} pro{p.count === 1 ? '' : 's'}{p.count === 0 ? ' ⚠️' : ''}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  back: { width: 40, height: 40, justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  content: { padding: 16 },
  hint: { fontSize: 13, color: '#6b7280', lineHeight: 19 },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff', justifyContent: 'center' },
  chipActive: { borderColor: '#2563eb', backgroundColor: '#2563eb' },
  chipText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  chipTextActive: { color: '#fff' },
  mapWrap: { width: '100%', height: 420, borderRadius: 12, overflow: 'hidden', backgroundColor: '#eef2f7', borderWidth: 1, borderColor: '#e5e7eb' },
  mapLoading: { position: 'absolute', top: 12, right: 12, backgroundColor: '#fff', borderRadius: 20, padding: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6 },
  mapFallback: { height: 200, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', gap: 8 },
  alertBox: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 12, padding: 12, marginTop: 14 },
  alertText: { flex: 1, fontSize: 13, color: '#92400e', lineHeight: 18 },
  section: { fontSize: 15, fontWeight: '800', color: '#111827', marginTop: 22, marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 14 },
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  statLabel: { fontSize: 14, color: '#374151', fontWeight: '600' },
  statVal: { fontSize: 15, fontWeight: '800', color: '#111827' },
  levelDot: { width: 12, height: 12, borderRadius: 6 },
  empty: { fontSize: 13, color: '#9ca3af', paddingVertical: 16, textAlign: 'center' },
});
