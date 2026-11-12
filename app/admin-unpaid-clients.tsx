import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';
import { showAlert, showConfirm } from '../utils/alert';

type Item = { kind: 'booking' | 'task'; id: string; task_id?: string; title: string; amount?: number; completed_at?: string; overdue: boolean; provider_name?: string };
type Client = { client_id: string; name?: string; email?: string; phone?: string; blocked: boolean; unblocked_at?: string; total_due: number; items: Item[] };
type Settled = { kind: string; id: string; title: string; amount?: number; paid_by_admin_at?: string; note?: string; client_name?: string; client_email?: string; provider_name?: string };

const money = (v?: number) => `$${Number(v || 0).toFixed(2)}`;
const when = (v?: string) => (v ? new Date(v).toLocaleString() : '—');
const errMsg = (e: any) => e?.response?.data?.detail || e?.message || 'Something went wrong';

function ItemRow({ it, onPaid, onOpen }: { it: Item; onPaid: () => void; onOpen: () => void }) {
  return (
    <View style={s.item} data-testid={`unpaid-item-${it.id}`}>
      <TouchableOpacity style={{ flex: 1 }} onPress={onOpen}>
        <Text style={s.itemTitle} numberOfLines={1}>{it.title}</Text>
        <Text style={s.itemMeta}>{money(it.amount)} · finished {when(it.completed_at)}{it.provider_name ? ` · ${it.provider_name}` : ''}</Text>
        {it.overdue && <Text style={s.overdue}>Unpaid more than 24h</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={s.paidBtn} onPress={onPaid} data-testid={`mark-paid-${it.id}`}>
        <Ionicons name="checkmark-done" size={16} color="#fff" />
        <Text style={s.paidBtnText}>Mark paid</Text>
      </TouchableOpacity>
    </View>
  );
}

function ClientCard({ c, onUnblock, onPaid, onOpen }: { c: Client; onUnblock: () => void; onPaid: (it: Item) => void; onOpen: (it: Item) => void }) {
  const status = c.blocked
    ? { t: 'Blocked', bg: '#fee2e2', fg: '#b91c1c' }
    : c.unblocked_at ? { t: 'Unblocked by admin', bg: '#dcfce7', fg: '#15803d' } : { t: 'Not blocked yet', bg: '#fef3c7', fg: '#b45309' };
  return (
    <View style={s.card} data-testid={`unpaid-client-${c.client_id}`}>
      <View style={s.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{c.name || 'Client'}</Text>
          <Text style={s.contact}>{[c.email, c.phone].filter(Boolean).join(' · ')}</Text>
        </View>
        <View style={[s.badge, { backgroundColor: status.bg }]}><Text style={[s.badgeText, { color: status.fg }]}>{status.t}</Text></View>
      </View>
      <Text style={s.due}>Due: <Text style={{ fontWeight: '800' }}>{money(c.total_due)}</Text> · {c.items.length} service{c.items.length > 1 ? 's' : ''}</Text>
      {c.items.map((it) => <ItemRow key={it.id} it={it} onPaid={() => onPaid(it)} onOpen={() => onOpen(it)} />)}
      {c.blocked && (
        <TouchableOpacity style={s.unblockBtn} onPress={onUnblock} data-testid={`unblock-${c.client_id}`}>
          <Ionicons name="lock-open-outline" size={16} color="#2563eb" />
          <Text style={s.unblockText}>Unblock client (keep services unpaid)</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function SettledRow({ r }: { r: Settled }) {
  return (
    <View style={s.card} data-testid={`settled-${r.id}`}>
      <Text style={s.itemTitle}>{r.title}</Text>
      <Text style={s.itemMeta}>{money(r.amount)} · {r.client_name || r.client_email || 'Client'}{r.provider_name ? ` → ${r.provider_name}` : ''}</Text>
      <Text style={s.itemMeta}>Marked paid by admin: {when(r.paid_by_admin_at)}</Text>
      {!!r.note && <Text style={s.note}>Note: {r.note}</Text>}
    </View>
  );
}

export default function AdminUnpaidClientsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'unpaid' | 'settled'>('unpaid');
  const [clients, setClients] = useState<Client[]>([]);
  const [settled, setSettled] = useState<Settled[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [u, p] = await Promise.all([api.adminGetUnpaidClients(), api.adminGetPaidByAdmin()]);
      setClients(u.clients || []);
      setSettled(p.items || []);
    } catch (e) {
      showAlert('Error', errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const markPaid = (it: Item) => showConfirm(
    'Mark as paid?',
    `"${it.title}" will be marked as paid by admin. The client's payment reminder disappears and they can order again.`,
    async () => {
      try { await api.adminMarkPaid(it.kind, it.id); load(); } catch (e) { showAlert('Error', errMsg(e)); }
    }, 'Mark paid', 'Cancel');

  const unblock = (c: Client) => showConfirm(
    'Unblock client?',
    `${c.name || 'This client'} can order again. Their current services stay unpaid and the payment reminder stays visible.`,
    async () => {
      try { await api.adminPaymentUnblock(c.client_id); load(); } catch (e) { showAlert('Error', errMsg(e)); }
    }, 'Unblock', 'Cancel');

  const open = (it: Item) => it.task_id && router.push(`/task-detail?id=${it.task_id}` as any);
  const blockedCount = clients.filter((c) => c.blocked).length;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 12 }} data-testid="unpaid-back-btn">
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={s.title}>Unpaid clients</Text>
      </View>
      <View style={s.tabs}>
        {([['unpaid', `Unpaid (${clients.length})`], ['settled', `Paid by admin (${settled.length})`]] as const).map(([k, label]) => (
          <TouchableOpacity key={k} style={[s.tab, tab === k && s.tabOn]} onPress={() => setTab(k)} data-testid={`unpaid-tab-${k}`}>
            <Text style={[s.tabText, tab === k && s.tabTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? <View style={s.center}><ActivityIndicator color="#2563eb" /></View> : (
        <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
          {tab === 'unpaid' ? (
            <>
              <View style={s.info}>
                <Ionicons name="information-circle" size={18} color="#2563eb" />
                <Text style={s.infoText}>
                  {blockedCount} blocked. A client is blocked from new orders when a finished service stays unpaid for more than 24 hours.
                </Text>
              </View>
              {clients.length === 0 && <Text style={s.empty}>No unpaid services.</Text>}
              {clients.map((c) => <ClientCard key={c.client_id} c={c} onUnblock={() => unblock(c)} onPaid={markPaid} onOpen={open} />)}
            </>
          ) : (
            <>
              {settled.length === 0 && <Text style={s.empty}>Nothing marked as paid by admin yet.</Text>}
              {settled.map((r) => <SettledRow key={r.id} r={r} />)}
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  tabs: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#fff' },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#f3f4f6' },
  tabOn: { backgroundColor: '#2563eb' },
  tabText: { color: '#374151', fontWeight: '700', fontSize: 13 },
  tabTextOn: { color: '#fff' },
  content: { padding: 16, maxWidth: 820, width: '100%', alignSelf: 'center' },
  info: { flexDirection: 'row', gap: 8, backgroundColor: '#eff6ff', borderRadius: 12, padding: 12, marginBottom: 14 },
  infoText: { flex: 1, color: '#1e3a8a', fontSize: 13, lineHeight: 19 },
  empty: { color: '#6b7280', textAlign: 'center', marginTop: 20 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', padding: 14, marginBottom: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  name: { fontSize: 16, fontWeight: '800', color: '#111827' },
  contact: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  due: { fontSize: 13, color: '#374151', marginTop: 8, marginBottom: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  itemTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  itemMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  overdue: { fontSize: 11, color: '#b91c1c', fontWeight: '700', marginTop: 2 },
  note: { fontSize: 12, color: '#374151', marginTop: 4, fontStyle: 'italic' },
  paidBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#16a34a', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10 },
  paidBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  unblockBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff' },
  unblockText: { color: '#2563eb', fontWeight: '700', fontSize: 13 },
});
