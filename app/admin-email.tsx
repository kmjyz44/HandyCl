/**
 * Admin: Email broadcast composer
 *
 * Lets the admin send an email to:
 *  - any custom address (comma / newline separated),
 *  - specific users selected from the system, or
 *  - a group (all users / clients / providers).
 *
 * Sends via the backend Resend/SendGrid pipeline (POST /admin/send-email).
 * Recent campaigns and their delivery counts are shown below.
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
type UserRow = { user_id: string; name?: string; email: string; role?: string };

export default function AdminEmailPage() {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<RecipientType>('group');
  const [group, setGroup] = useState<Group>('all');
  const [customEmails, setCustomEmails] = useState('');

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
      const [rec, camp] = await Promise.all([api.getEmailRecipients(), api.getEmailCampaigns()]);
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
    try { setCampaigns((await api.getEmailCampaigns()) || []); } catch {}
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
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
      const n = customEmails.split(/[,\n;\s]+/).filter((e) => e.includes('@')).length;
      return `${n} address${n === 1 ? '' : 'es'}`;
    }
    if (type === 'users') return `${selectedCount} selected user${selectedCount === 1 ? '' : 's'}`;
    if (group === 'clients') return `${counts.clients} clients`;
    if (group === 'providers') return `${counts.providers} providers`;
    return `${counts.all} users (everyone)`;
  };

  const send = async () => {
    if (!subject.trim() || !body.trim()) {
      showAlert('Missing info', 'Please enter a subject and a message.');
      return;
    }
    const payload: any = { subject: subject.trim(), body: body.trim(), recipient_type: type };
    if (type === 'custom') {
      if (!customEmails.split(/[,\n;\s]+/).some((e) => e.includes('@'))) {
        showAlert('No recipients', 'Enter at least one valid email address.');
        return;
      }
      payload.custom_emails = customEmails;
    } else if (type === 'users') {
      const ids = Object.keys(selected).filter((k) => selected[k]);
      if (!ids.length) { showAlert('No recipients', 'Select at least one user.'); return; }
      payload.user_ids = ids;
    } else {
      payload.group = group;
    }

    setSending(true);
    try {
      const res = await api.adminSendEmail(payload);
      showAlert('Sending', `Queued to ${res.recipients_count} recipient(s). Delivery updates appear below.`);
      setSubject(''); setBody(''); setCustomEmails(''); clearSelection();
      await refreshCampaigns();
      setTimeout(refreshCampaigns, 4000);
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Failed to send email.');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#2563eb" /></View>;

  const TypeTab = ({ id, icon, label }: { id: RecipientType; icon: any; label: string }) => (
    <TouchableOpacity
      style={[s.tab, type === id && s.tabActive]}
      onPress={() => setType(id)}
      data-testid={`email-type-${id}-btn`}
    >
      <Ionicons name={icon} size={16} color={type === id ? '#fff' : '#2563eb'} />
      <Text style={[s.tabText, type === id && s.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const GroupOption = ({ id, label, count }: { id: Group; label: string; count: number }) => (
    <TouchableOpacity
      style={[s.groupOpt, group === id && s.groupOptActive]}
      onPress={() => setGroup(id)}
      data-testid={`email-group-${id}-btn`}
    >
      <View style={[s.radio, group === id && s.radioActive]}>
        {group === id && <View style={s.radioDot} />}
      </View>
      <Text style={[s.groupLabel, group === id && s.groupLabelActive]}>{label}</Text>
      <Text style={s.groupCount}>{count}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><Ionicons name="arrow-back" size={24} color="#111827" /></TouchableOpacity>
        <Text style={s.title}>Email broadcast</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} data-testid="admin-email-screen" keyboardShouldPersistTaps="handled">
        {/* Compose */}
        <Text style={s.label}>Subject</Text>
        <TextInput
          style={s.input}
          value={subject}
          onChangeText={setSubject}
          placeholder="Email subject"
          placeholderTextColor="#9ca3af"
          data-testid="email-subject-input"
        />

        <Text style={s.label}>Message</Text>
        <TextInput
          style={[s.input, s.textarea]}
          value={body}
          onChangeText={setBody}
          placeholder="Write your message… (plain text)"
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={8}
          textAlignVertical="top"
          data-testid="email-body-input"
        />

        {/* Recipients */}
        <Text style={[s.label, { marginTop: 18 }]}>Recipients</Text>
        <View style={s.tabs}>
          <TypeTab id="group" icon="people" label="Group" />
          <TypeTab id="users" icon="person" label="Specific users" />
          <TypeTab id="custom" icon="at" label="Custom" />
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
            <Text style={s.hint}>Enter one or more addresses, separated by commas or new lines.</Text>
            <TextInput
              style={[s.input, s.textarea, { minHeight: 90 }]}
              value={customEmails}
              onChangeText={setCustomEmails}
              placeholder="name@example.com, another@example.com"
              placeholderTextColor="#9ca3af"
              multiline
              autoCapitalize="none"
              keyboardType="email-address"
              textAlignVertical="top"
              data-testid="email-custom-input"
            />
          </View>
        )}

        {type === 'users' && (
          <View style={s.section}>
            <TextInput
              style={s.input}
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name or email"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              data-testid="email-user-search"
            />
            <View style={s.selectRow}>
              <TouchableOpacity onPress={selectAllFiltered} data-testid="email-select-all-btn"><Text style={s.linkBtn}>Select all shown</Text></TouchableOpacity>
              <TouchableOpacity onPress={clearSelection} data-testid="email-clear-btn"><Text style={[s.linkBtn, { color: '#ef4444' }]}>Clear ({selectedCount})</Text></TouchableOpacity>
            </View>
            <View style={s.userList}>
              {filteredUsers.length === 0 ? (
                <Text style={s.hint}>No users match "{search}".</Text>
              ) : filteredUsers.slice(0, 200).map((u) => (
                <TouchableOpacity key={u.user_id} style={s.userRow} onPress={() => toggleUser(u.user_id)} data-testid={`email-user-${u.user_id}`}>
                  <View style={[s.checkbox, selected[u.user_id] && s.checkboxOn]}>
                    {selected[u.user_id] && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.userName}>{u.name || 'Unnamed'} <Text style={s.roleTag}>· {u.role}</Text></Text>
                    <Text style={s.userEmail}>{u.email}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {filteredUsers.length > 200 && <Text style={s.hint}>Showing first 200 — refine your search.</Text>}
            </View>
          </View>
        )}

        <View style={s.summaryBox}>
          <Ionicons name="send" size={15} color="#2563eb" />
          <Text style={s.summaryText}>Will send to: <Text style={{ fontWeight: '800' }}>{recipientSummary()}</Text></Text>
        </View>

        <TouchableOpacity
          style={[s.sendBtn, sending && { opacity: 0.6 }]}
          onPress={send}
          disabled={sending}
          data-testid="email-send-btn"
        >
          {sending ? <ActivityIndicator color="#fff" /> : <><Ionicons name="paper-plane" size={18} color="#fff" /><Text style={s.sendText}>Send email</Text></>}
        </TouchableOpacity>

        {/* History */}
        <View style={s.historyHead}>
          <Text style={s.historyTitle}>Recent broadcasts</Text>
          <TouchableOpacity onPress={refreshCampaigns} data-testid="email-refresh-history-btn"><Ionicons name="refresh" size={18} color="#6b7280" /></TouchableOpacity>
        </View>
        {campaigns.length === 0 ? (
          <Text style={s.hint}>No broadcasts sent yet.</Text>
        ) : campaigns.map((c) => (
          <View key={c.campaign_id} style={s.campCard} data-testid={`email-campaign-${c.campaign_id}`}>
            <View style={s.campTop}>
              <Text style={s.campSubject} numberOfLines={1}>{c.subject}</Text>
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
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827', backgroundColor: '#fff', marginBottom: 12 },
  textarea: { minHeight: 140 },
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
  userEmail: { fontSize: 12, color: '#6b7280' },
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
