/**
 * Admin: Welcome email templates
 *
 * Two automatic welcome emails (client + provider) sent on registration.
 * Admin can edit the subject/body of each, turn the whole feature on/off,
 * and send a test copy to their own inbox.
 * Backend: GET/PUT /admin/welcome-emails, POST /admin/welcome-emails/test
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';
import { showAlert } from '../utils/alert';

type Tab = 'client' | 'provider';

export default function AdminWelcomeEmailsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<Tab | null>(null);
  const [tab, setTab] = useState<Tab>('client');

  const [enabled, setEnabled] = useState(true);
  const [clientSubject, setClientSubject] = useState('');
  const [clientBody, setClientBody] = useState('');
  const [providerSubject, setProviderSubject] = useState('');
  const [providerBody, setProviderBody] = useState('');

  useEffect(() => { load(); }, []);
  const load = async () => {
    try {
      const d = await api.getWelcomeEmails();
      setEnabled(d.enabled !== false);
      setClientSubject(d.client_subject || '');
      setClientBody(d.client_body || '');
      setProviderSubject(d.provider_subject || '');
      setProviderBody(d.provider_body || '');
    } catch {
      showAlert('Error', 'Failed to load welcome email settings.');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.updateWelcomeEmails({
        enabled,
        client_subject: clientSubject,
        client_body: clientBody,
        provider_subject: providerSubject,
        provider_body: providerBody,
      });
      showAlert('Saved', 'Welcome emails updated.');
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (v: boolean) => {
    setEnabled(v);
    try {
      await api.updateWelcomeEmails({ enabled: v });
    } catch (e: any) {
      setEnabled(!v);
      showAlert('Error', e?.response?.data?.detail || 'Could not update.');
    }
  };

  const sendTest = async (role: Tab) => {
    setTesting(role);
    try {
      const res = await api.testWelcomeEmail(role);
      showAlert('Test sent', `A ${role} welcome email was sent to ${res.sent_to}.`);
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Failed to send test.');
    } finally {
      setTesting(null);
    }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#2563eb" /></View>;

  const subject = tab === 'client' ? clientSubject : providerSubject;
  const body = tab === 'client' ? clientBody : providerBody;
  const setSubject = tab === 'client' ? setClientSubject : setProviderSubject;
  const setBody = tab === 'client' ? setClientBody : setProviderBody;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} data-testid="welcome-back-btn">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={s.title}>Welcome emails</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} data-testid="admin-welcome-screen" keyboardShouldPersistTaps="handled">
        {/* Master toggle */}
        <View style={s.toggleCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleTitle}>Send welcome emails automatically</Text>
            <Text style={s.toggleSub}>Sent to each new user at registration, based on their role.</Text>
          </View>
          <Switch value={enabled} onValueChange={toggleEnabled} data-testid="welcome-enabled-toggle" />
        </View>

        {/* Role tabs */}
        <View style={s.tabs}>
          {(['client', 'provider'] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[s.tab, tab === t && s.tabActive]}
              onPress={() => setTab(t)}
              data-testid={`welcome-tab-${t}`}
            >
              <Ionicons name={t === 'client' ? 'person-outline' : 'briefcase-outline'} size={16} color={tab === t ? '#fff' : '#2563eb'} />
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t === 'client' ? 'Client' : 'Provider'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.hint}>Tip: use {'{name}'} to insert the user's name.</Text>

        <Text style={s.label}>Subject</Text>
        <TextInput
          style={s.input}
          value={subject}
          onChangeText={setSubject}
          placeholder="Email subject"
          placeholderTextColor="#9ca3af"
          data-testid={`welcome-${tab}-subject-input`}
        />

        <Text style={s.label}>Message</Text>
        <TextInput
          style={[s.input, s.textarea]}
          value={body}
          onChangeText={setBody}
          placeholder="Write the welcome message… (plain text)"
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={14}
          textAlignVertical="top"
          data-testid={`welcome-${tab}-body-input`}
        />

        <TouchableOpacity
          style={s.testBtn}
          onPress={() => sendTest(tab)}
          disabled={testing !== null}
          data-testid={`welcome-test-${tab}-btn`}
        >
          {testing === tab
            ? <ActivityIndicator color="#2563eb" size="small" />
            : <><Ionicons name="paper-plane-outline" size={16} color="#2563eb" /><Text style={s.testBtnText}>Send test to me</Text></>}
        </TouchableOpacity>

        <TouchableOpacity style={s.saveBtn} onPress={save} disabled={saving} data-testid="welcome-save-btn">
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save changes</Text>}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  back: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  content: { padding: 16 },
  toggleCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', padding: 16, marginBottom: 16 },
  toggleTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  toggleSub: { fontSize: 12, color: '#6b7280', marginTop: 3, lineHeight: 17 },
  tabs: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: '#2563eb', backgroundColor: '#fff' },
  tabActive: { backgroundColor: '#2563eb' },
  tabText: { color: '#2563eb', fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: '#fff' },
  hint: { fontSize: 12, color: '#6b7280', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, fontSize: 14, color: '#111827', marginBottom: 16 },
  textarea: { minHeight: 260 },
  testBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#2563eb', borderRadius: 12, paddingVertical: 12, marginBottom: 12 },
  testBtnText: { color: '#2563eb', fontWeight: '700', fontSize: 14 },
  saveBtn: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
