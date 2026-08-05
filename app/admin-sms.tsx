/**
 * Admin: SMS broadcast composer (via Infobip).
 *
 * Send an SMS to: any custom number(s), specific users, or a group
 * (all users / clients / providers). Sends via POST /admin/send-sms; recent
 * campaigns with delivery counts are shown below.
 */
import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';
import { showAlert } from '../utils/alert';

type RecipientType = 'custom' | 'users' | 'group';
type Group = 'all' | 'clients' | 'providers';
type UserRow = { user_id: string; name?: string; phone: string; role?: string };

const SMS_MAX = 480;

export default function AdminSmsPage() {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [type, setType] = useState<RecipientType>('group');
  const [group, setGroup] = useState<Group>('all');
  const [customPhones, setCustomPhones] = useState('');

  const [users, setUsers] = useState<UserRow[]>([]);
  const [counts, setCounts] = useState<{ all: number; clients: number; providers: number }>({ all: 0, clients: 0, providers: 0 });
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => { load(); }, []);
  const load = async () => {
    try {
      const [rec, camp] = await Promise.all([api.getSmsRecipients(), api.getSmsCampaigns()]);
      setUsers(rec.users || []);
      setCounts(rec.counts || { all: 0, clients: 0, providers: 0 });
      setCampaigns(camp || []);
    } catch (e) {
      showAlert('Error', 'Failed to load recipients.');
    } finally {
      setLoading(false);
    }
  };

  const refreshCampaigns = async () => {
    try { setCampaigns((await api.getSmsCampaigns()) || []); } catch {}
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => (u.name || '').toLowerCase().includes(q) || (u.phone || '').includes(q));
  }, [users, search]);

  const selectedCount = useMemo(() => Object.values(selected).filter(Boolean).length, [selected]);
  const toggleUser = (id: string) => setSelected((p) => ({ ...p, [id]: !p[id] }));
  const selectAllFiltered = () => {
    const next = { ...selected };
    filteredUsers.forEach((u) => { next[u.user_id] = true; });
    setSelected(next);
  };
  const clearSelection = () => setSelected({});

  const recipientSummary = () => {
    if (type === 'custom') {
      const n = customPhones.split(/[,\n;]+/).filter((p) => p.replace(/\D/g, '').length >= 8).length;
      return `${n} number${n === 1 ? '' : 's'}`;
    }
    if (type === 'users') return `${selectedCount} selected user${selectedCount === 1 ? '' : 's'}`;
    if (group === 'clients') return `${counts.clients} clients`;
    if (group === 'providers') return `${counts.providers} providers`;
    return `${counts.all} users (everyone with a phone)`;
  };

  const send = async () => {
    if (!body.trim()) { showAlert('Missing message', 'Please enter the SMS text.'); return; }
    const payload: any = { body: body.trim(), recipient_type: type };
    if (type === 'custom') {
      if (!customPhones.split(/[,\n;]+/).some((p) => p.replace(/\D/g, '').length >= 8)) {
        showAlert('No recipients', 'Enter at least one valid phone number.');
        return;
      }
      payload.custom_phones = customPhones;
    } else if (type === 'users') {
      const ids = Object.keys(selected).filter((k) => selected[k]);
      if (!ids.length) { showAlert('No recipients', 'Select at least one user.'); return; }
      payload.user_ids = ids;
    } else {
      payload.group = group;
    }

    setSending(true);
    try {
      const res = await api.adminSendSms(payload);
      showAlert('Sending', `Queued to ${res.recipients_count} recipient(s). Delivery updates appear below.`);
      setBody(''); setCustomPhones(''); clearSelection();
      await refreshCampaigns();
      setTimeout(refreshCampaigns, 4000);
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Failed to send SMS.');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#2563eb" /></View>;

  const TypeTab = ({ id, icon, label }: { id: RecipientType; icon: any; label: string }) => (
    <TouchableOpacity style={[s.tab, type === id && s.tabActive]} onPress={() => setType(id)} data-testid={`sms-type-${id}-btn`}>
      <Ionicons name={icon} size={16} color={type === id ? '#fff' : '#2563eb'} />
      <Text style={[s.tabText, type === id && s.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const GroupOption = ({ id, label, count }: { id: Group; label: string; count: number }) => (
    <TouchableOpacity style={[s.groupOpt, group === id && s.groupOptActive]} onPress={() => setGroup(id)} data-testid={`sms-group-${id}-btn`}>
      <View style={[s.radio, group === id && s.radioActive]}>{group === id && <View style={s.radioDot} />}</View>
      <Text style={[s.groupLabel, group === id && s.groupLabelActive]}>{label}</Text>
      <Text style={s.groupCount}>{count}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><Ionicons name="arrow-back" size={24} color="#111827" /></TouchableOpacity>
        <Text style={s.title}>SMS broadcast</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} data-testid="admin-sms-screen" keyboardShouldPersistTaps="handled">
        <Text style={s.label}>Message</Text>
        <TextInput
          style={[s.input, s.textarea]}
          value={body}
          onChangeText={(t) => setBody(t.slice(0, SMS_MAX))}
          placeholder="Write your SMS…"
          placeholderTextColor="#9ca3af"
          multiline
          textAlignVertical="top"
          data-testid="sms-body-input"
        />
        <Text style={s.counter}>{body.length}/{SMS_MAX} characters</Text>

        <Text style={[s.label, { marginTop: 14 }]}>Recipients</Text>
        <View style={s.tabs}>
          <TypeTab id="group" icon="people" label="Group" />
          <TypeTab id="users" icon="person" label="Specific users" />
          <TypeTab id="custom" icon="call" label="Custom" />
        </View>

        {type === 'group' && (
          <View style={s.section}>
            <GroupOption id="all" label="All users" count={counts.all} />
            <GroupOption id="clients" label="Clients only" count={counts.clients} />
            <GroupOption id="providers" label="Providers only" count={counts.providers} />
          </View>
        )}

        {type === 'custom' && (
          <View style={s.section}>
            <Text style={s.hint}>Enter one or more numbers (international format), separated by commas or new lines.</Text>
            <TextInput
              style={[s.input, s.textarea, { minHeight: 90 }]}
              value={customPhones}
              onChangeText={setCustomPhones}
              placeholder="+14155550123, 18335925136"
              placeholderTextColor="#9ca3af"
              multiline
              keyboardType="phone-pad"
              textAlignVertical="top"
              data-testid="sms-custom-input"
            />
          </View>
        )}

        {type === 'users' && (
          <View style={s.section}>
            <TextInput
              style={s.input}
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name or phone"
              placeholderTextColor="#9ca3af"
              data-testid="sms-user-search"
            />
            <View style={s.selectRow}>
              <TouchableOpacity onPress={selectAllFiltered} data-testid="sms-select-all-btn"><Text style={s.linkBtn}>Select all shown</Text></TouchableOpacity>
              <TouchableOpacity onPress={clearSelection} data-testid="sms-clear-btn"><Text style={[s.linkBtn, { color: '#ef4444' }]}>Clear ({selectedCount})</Text></TouchableOpacity>
            </View>
            <View style={s.userList}>
              {filteredUsers.length === 0 ? (
                <Text style={s.hint}>No users with a phone match "{search}".</Text>
              ) : filteredUsers.slice(0, 200).map((u) => (
                <TouchableOpacity key={u.user_id} style={s.userRow} onPress={() => toggleUser(u.user_id)} data-testid={`sms-user-${u.user_id}`}>
                  <View style={[s.checkbox, selected[u.user_id] && s.checkboxOn]}>{selected[u.user_id] && <Ionicons name="checkmark" size={14} color="#fff" />}</View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.userName}>{u.name || 'Unnamed'} <Text style={s.roleTag}>· {u.role}</Text></Text>
                    <Text style={s.userPhone}>{u.phone}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={s.summaryBox}>
          <Ionicons name="chatbox-ellipses" size={15} color="#2563eb" />
          <Text style={s.summaryText}>Will send to: <Text style={{ fontWeight: '800' }}>{recipientSummary()}</Text></Text>
        </View>

        <TouchableOpacity style={[s.sendBtn, sending && { opacity: 0.6 }]} onPress={send} disabled={sending} data-testid="sms-send-btn">
          {sending ? <ActivityIndicator color="#fff" /> : <><Ionicons name="paper-plane" size={18} color="#fff" /><Text style={s.sendText}>Send SMS</Text></>}
        </TouchableOpacity>

        <View style={s.historyHead}>
          <Text style={s.historyTitle}>Recent broadcasts</Text>
          <TouchableOpacity onPress={refreshCampaigns} data-testid="sms-refresh-history-btn"><Ionicons name="refresh" size={18} color="#6b7280" /></TouchableOpacity>
        </View>
        {campaigns.length === 0 ? (
          <Text style={s.hint}>No SMS broadcasts sent yet.</Text>
        ) : campaigns.map((c) => (
          <View key={c.campaign_id} style={s.campCard} data-testid={`sms-campaign-${c.campaign_id}`}>
            <View style={s.campTop}>
              <Text style={s.campSubject} numberOfLines={1}>{c.body_preview}</Text>
              <View style={[s.statusChip, c.status === 'completed' ? s.chipDone : s.chipSending]}>
                <Text style={s.statusText}>{c.status === 'completed' ? 'Sent' : 'Sending…'}</Text>
              </View>
            </View>
            <Text style={s.campMeta}>
              {c.recipients_count} recipients · {c.sent} delivered{c.failed ? ` · ${c.failed} failed` : ''}
              {c.created_at ? ` · ${new Date(c.created_at).toLocaleString()}` : ''}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  back: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', flex: 1 },
  content: { padding: 16, paddingBottom: 60 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827', backgroundColor: '#fff', marginBottom: 6 },
  textarea: { minHeight: 120 },
  counter: { fontSize: 11, color: '#9ca3af', textAlign: 'right', marginBottom: 4 },
  hint: { fontSize: 12, color: '#6b7280', marginBottom: 8 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: '#2563eb', borderRadius: 10, paddingVertical: 9 },
  tabActive: { backgroundColor: '#2563eb' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  tabTextActive: { color: '#fff' },
  section: { marginBottom: 6 },
  groupOpt: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 14, marginBottom: 8 },
  groupOptActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#9ca3af', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: '#2563eb' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2563eb' },
  groupLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#374151' },
  groupLabelActive: { color: '#1e40af' },
  groupCount: { fontSize: 13, fontWeight: '700', color: '#6b7280' },
  selectRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  linkBtn: { fontSize: 13, fontWeight: '700', color: '#2563eb' },
  userList: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, overflow: 'hidden' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#9ca3af', alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  userName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  roleTag: { fontSize: 12, fontWeight: '500', color: '#9ca3af' },
  userPhone: { fontSize: 12, color: '#6b7280' },
  summaryBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f0f9ff', borderRadius: 10, padding: 12, marginTop: 12, marginBottom: 12 },
  summaryText: { fontSize: 13, color: '#0c4a6e', flex: 1 },
  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 15 },
  sendText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  historyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 30, marginBottom: 10 },
  historyTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  campCard: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, marginBottom: 8 },
  campTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  campSubject: { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1 },
  statusChip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  chipDone: { backgroundColor: '#dcfce7' },
  chipSending: { backgroundColor: '#fef9c3' },
  statusText: { fontSize: 11, fontWeight: '700', color: '#166534' },
  campMeta: { fontSize: 12, color: '#6b7280', marginTop: 5 },
});
