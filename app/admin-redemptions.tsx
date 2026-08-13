/**
 * Admin: Gift-card redemption requests (manual fulfillment).
 *
 * When Giftbit is disabled, client redemptions land here. The admin buys the
 * gift card externally, enters its code, and Ono-Fix emails + texts it to the
 * client. Admin can also reject a request (points are refunded).
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';
import { showAlert } from '../utils/alert';

const TABS = [
  { id: 'requested', label: 'Requests' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'all', label: 'All' },
];

export default function AdminRedemptionsPage() {
  const router = useRouter();
  const [tab, setTab] = useState('requested');
  const [data, setData] = useState<any>({ redemptions: [], counts: {} });
  const [loading, setLoading] = useState(true);

  const [fulfillCard, setFulfillCard] = useState<any>(null);
  const [code, setCode] = useState('');
  const [brand, setBrand] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [tab]);
  const load = async () => {
    setLoading(true);
    try {
      setData(await api.adminListRedemptions(tab === 'all' ? undefined : tab));
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Failed to load redemptions');
    } finally {
      setLoading(false);
    }
  };

  const openFulfill = (card: any) => {
    setFulfillCard(card); setCode(''); setBrand(''); setNote('');
  };

  const submitFulfill = async () => {
    if (!code.trim()) { showAlert('Missing code', 'Enter the gift-card code.'); return; }
    setSaving(true);
    try {
      const res = await api.adminFulfillRedemption(fulfillCard.card_id, { code: code.trim(), brand: brand.trim(), note: note.trim() });
      showAlert('Sent 🎁', `Code delivered${res.email_sent ? ' · email ✓' : ''}${res.sms_sent ? ' · SMS ✓' : ''}`);
      setFulfillCard(null);
      await load();
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Failed to fulfill');
    } finally {
      setSaving(false);
    }
  };

  const reject = (card: any) => {
    const doReject = async (reason: string) => {
      try {
        await api.adminRejectRedemption(card.card_id, reason);
        showAlert('Refunded', `${card.points_cost} points returned to the client.`);
        await load();
      } catch (e: any) {
        showAlert('Error', e?.response?.data?.detail || 'Failed to reject');
      }
    };
    if (typeof window !== 'undefined' && window.confirm) {
      if (window.confirm(`Reject $${card.value} request and refund ${card.points_cost} points?`)) doReject('Request could not be fulfilled');
    } else {
      doReject('Request could not be fulfilled');
    }
  };

  const StatusChip = ({ status }: { status: string }) => {
    const map: any = {
      requested: { bg: '#fef9c3', fg: '#854d0e', label: 'Requested' },
      delivered: { bg: '#dcfce7', fg: '#166534', label: 'Delivered' },
      rejected: { bg: '#fee2e2', fg: '#991b1b', label: 'Rejected' },
      pending: { bg: '#e0e7ff', fg: '#3730a3', label: 'Pending' },
      failed: { bg: '#fee2e2', fg: '#991b1b', label: 'Failed' },
    };
    const c = map[status] || { bg: '#f3f4f6', fg: '#374151', label: status };
    return <View style={[s.chip, { backgroundColor: c.bg }]}><Text style={[s.chipText, { color: c.fg }]}>{c.label}</Text></View>;
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><Ionicons name="arrow-back" size={24} color="#111827" /></TouchableOpacity>
        <Text style={s.title}>Rewards requests</Text>
      </View>

      <View style={s.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.id} style={[s.tab, tab === t.id && s.tabActive]} onPress={() => setTab(t.id)} data-testid={`redemptions-tab-${t.id}`}>
            <Text style={[s.tabText, tab === t.id && s.tabTextActive]}>
              {t.label}{t.id === 'requested' && data.counts?.requested ? ` (${data.counts.requested})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#2563eb" /></View>
      ) : (
        <ScrollView contentContainerStyle={s.content} data-testid="admin-redemptions-screen">
          {(data.redemptions || []).length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="gift-outline" size={40} color="#d1d5db" />
              <Text style={s.emptyText}>No {tab === 'all' ? '' : tab} redemptions.</Text>
            </View>
          ) : (data.redemptions || []).map((c: any) => (
            <View key={c.card_id} style={s.card} data-testid={`redemption-${c.card_id}`}>
              <View style={s.cardTop}>
                <Text style={s.value}>${c.value} gift card</Text>
                <StatusChip status={c.status} />
              </View>
              <Text style={s.meta}>{c.client_name || 'Client'} · {c.client_email}</Text>
              {c.client_phone ? <Text style={s.meta}>📱 {c.client_phone}</Text> : null}
              <Text style={s.metaSm}>{c.points_cost} points · {c.created_at ? new Date(c.created_at).toLocaleString() : ''}</Text>
              {c.status === 'delivered' && c.code ? (
                <Text style={s.codeLine}>Code: <Text style={{ fontWeight: '800' }}>{c.code}</Text>{c.brand ? ` (${c.brand})` : ''}</Text>
              ) : null}
              {c.status === 'rejected' && c.reject_reason ? <Text style={s.metaSm}>Reason: {c.reject_reason}</Text> : null}

              {c.status === 'requested' && (
                <View style={s.actions}>
                  <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={() => openFulfill(c)} data-testid={`fulfill-${c.card_id}`}>
                    <Ionicons name="pricetag" size={15} color="#fff" />
                    <Text style={s.btnPrimaryText}>Enter code & send</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={() => reject(c)} data-testid={`reject-${c.card_id}`}>
                    <Text style={s.btnGhostText}>Reject & refund</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Fulfill modal */}
      <Modal visible={!!fulfillCard} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Send ${fulfillCard?.value} gift card</Text>
              <TouchableOpacity onPress={() => setFulfillCard(null)} data-testid="fulfill-close"><Ionicons name="close" size={24} color="#6b7280" /></TouchableOpacity>
            </View>
            <Text style={s.modalSub}>To {fulfillCard?.client_email}{fulfillCard?.client_phone ? ` · ${fulfillCard.client_phone}` : ''}</Text>

            <Text style={s.label}>Gift-card code *</Text>
            <TextInput style={s.input} value={code} onChangeText={setCode} placeholder="e.g. AMZN-XXXX-XXXX" autoCapitalize="characters" data-testid="fulfill-code-input" />
            <Text style={s.label}>Brand (optional)</Text>
            <TextInput style={s.input} value={brand} onChangeText={setBrand} placeholder="e.g. Amazon" data-testid="fulfill-brand-input" />
            <Text style={s.label}>Note to client (optional)</Text>
            <TextInput style={s.input} value={note} onChangeText={setNote} placeholder="e.g. Redeem at amazon.com/gc" data-testid="fulfill-note-input" />

            <TouchableOpacity style={[s.btn, s.btnPrimary, { marginTop: 14 }, saving && { opacity: 0.6 }]} onPress={submitFulfill} disabled={saving} data-testid="fulfill-submit">
              {saving ? <ActivityIndicator color="#fff" /> : <><Ionicons name="paper-plane" size={16} color="#fff" /><Text style={s.btnPrimaryText}>Send code (email + SMS)</Text></>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 52, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  back: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', flex: 1 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 12, paddingBottom: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#f3f4f6' },
  tabActive: { backgroundColor: '#2563eb' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  tabTextActive: { color: '#fff' },
  content: { padding: 16, paddingBottom: 50 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { color: '#9ca3af', fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#eef2f7' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  value: { fontSize: 16, fontWeight: '800', color: '#111827' },
  meta: { fontSize: 13, color: '#374151', marginTop: 2 },
  metaSm: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  codeLine: { fontSize: 13, color: '#166534', marginTop: 8, backgroundColor: '#f0fdf4', padding: 8, borderRadius: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, flex: 1 },
  btnPrimary: { backgroundColor: '#2563eb' },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnGhost: { borderWidth: 1, borderColor: '#ef4444' },
  btnGhostText: { color: '#ef4444', fontSize: 14, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  modalSub: { fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: '#111827' },
});
