import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';

type Consent = {
  user_id: string;
  user_name: string;
  user_email: string;
  phone: string;
  consent: boolean;
  consent_version: string;
  consent_text: string;
  ip_address?: string;
  user_agent?: string;
  source?: string;
  created_at?: string;
};

function fmtDate(iso?: string) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return String(iso); }
}

export default function AdminSmsConsents() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Consent[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = async (search?: string) => {
    setLoading(true);
    try {
      const d = await api.adminGetSmsConsents(search);
      setItems(d.consents || []);
      setTotal(d.total || 0);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} data-testid="sms-consents-back-btn">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={s.title}>SMS Opt-in Log</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.searchRow}>
        <Ionicons name="search" size={18} color="#9ca3af" />
        <TextInput
          style={s.searchInput}
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => load(q)}
          placeholder="Search by phone, name or email"
          placeholderTextColor="#9ca3af"
          data-testid="sms-consents-search"
          returnKeyType="search"
        />
        {q.length > 0 && (
          <TouchableOpacity onPress={() => { setQ(''); load(); }} data-testid="sms-consents-clear">
            <Ionicons name="close-circle" size={18} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={s.content} data-testid="admin-sms-consents-screen">
        <Text style={s.count}>{items.length} shown · {total} total opt-ins</Text>

        {loading ? (
          <ActivityIndicator color="#2563eb" style={{ marginTop: 40 }} />
        ) : items.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="document-text-outline" size={30} color="#9ca3af" />
            <Text style={s.emptyText}>No opt-in records{q ? ' match your search' : ' yet'}.</Text>
          </View>
        ) : (
          items.map((c, i) => (
            <TouchableOpacity
              key={i}
              style={s.card}
              activeOpacity={0.8}
              onPress={() => setExpanded(expanded === i ? null : i)}
              data-testid={`sms-consent-${i}`}
            >
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.phone}>{c.phone}</Text>
                  <Text style={s.sub}>{c.user_name} · {c.user_email}</Text>
                </View>
                <View style={s.badge}>
                  <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                  <Text style={s.badgeText}>Opted in</Text>
                </View>
              </View>

              <View style={s.metaRow}>
                <Ionicons name="time-outline" size={13} color="#6b7280" />
                <Text style={s.meta}>{fmtDate(c.created_at)}</Text>
                {!!c.ip_address && <><Ionicons name="globe-outline" size={13} color="#6b7280" style={{ marginLeft: 10 }} /><Text style={s.meta}>{c.ip_address}</Text></>}
                {!!c.consent_version && <Text style={[s.meta, { marginLeft: 10 }]}>v{c.consent_version}</Text>}
              </View>

              {expanded === i && (
                <View style={s.detail}>
                  <Text style={s.detailLabel}>Consent text</Text>
                  <Text style={s.detailText}>{c.consent_text}</Text>
                  {!!c.user_agent && (
                    <>
                      <Text style={[s.detailLabel, { marginTop: 8 }]}>User agent</Text>
                      <Text style={s.detailText}>{c.user_agent}</Text>
                    </>
                  )}
                  <Text style={[s.detailLabel, { marginTop: 8 }]}>Source</Text>
                  <Text style={s.detailText}>{c.source || '—'}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
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
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, paddingHorizontal: 14, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  content: { padding: 16 },
  count: { fontSize: 12, color: '#6b7280', marginBottom: 12, fontWeight: '600' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50, gap: 10 },
  emptyText: { fontSize: 14, color: '#9ca3af' },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  phone: { fontSize: 15, fontWeight: '800', color: '#111827' },
  sub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#dcfce7', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#16a34a' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, flexWrap: 'wrap' },
  meta: { fontSize: 12, color: '#6b7280' },
  detail: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  detailLabel: { fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' },
  detailText: { fontSize: 13, color: '#374151', lineHeight: 18, marginTop: 3 },
});
