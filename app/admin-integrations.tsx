/**
 * Admin: Integration Keys & Feature Toggles
 *
 * Lets the admin paste in SendGrid / Stripe / Twilio / VAPID / Telegram
 * credentials and toggle each notification channel on/off. Stored on the
 * backend in db.integration_keys; secrets are returned masked.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Switch, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { api } from '../utils/api';
import { showAlert } from '../utils/alert';

type KeyDef = { id: string; label: string; placeholder: string; secret?: boolean };

const SECTIONS: { title: string; toggle?: string; toggleLabel?: string; keys: KeyDef[]; testSms?: boolean }[] = [
  {
    title: 'Resend (Email — default)',
    toggle: 'enable_email_notifications',
    toggleLabel: 'Enable email notifications',
    keys: [
      { id: 'email_provider', label: 'Email provider (resend / sendgrid)', placeholder: 'resend — default; sendgrid — fallback' },
      { id: 'resend_api_key', label: 'Resend API Key', placeholder: 're_xxxxxxxxxxxxxxxxxxxx', secret: true },
      { id: 'resend_from_email', label: 'From email (verified domain)', placeholder: 'onboarding@resend.dev or noreply@your-domain.com' },
    ],
  },
  {
    title: 'SendGrid (Email — fallback)',
    keys: [
      { id: 'sendgrid_api_key', label: 'API Key', placeholder: 'SG.xxxxxxxxxxxxxxxxxxxx', secret: true },
      { id: 'sendgrid_from_email', label: 'From email', placeholder: 'noreply@your-domain.com' },
    ],
  },
  {
    title: 'Stripe (Payments)',
    toggle: 'enable_stripe_payments',
    toggleLabel: 'Accept payments via Stripe',
    keys: [
      { id: 'stripe_secret_key', label: 'Secret Key', placeholder: 'sk_test_xxx or sk_live_xxx', secret: true },
      { id: 'stripe_publishable_key', label: 'Publishable Key', placeholder: 'pk_test_xxx or pk_live_xxx' },
      { id: 'stripe_webhook_secret', label: 'Webhook Signing Secret', placeholder: 'whsec_xxxxxxxxxxxx', secret: true },
      { id: 'stripe_currency', label: 'Currency (3-letter ISO)', placeholder: 'usd, eur — default usd' },
    ],
  },
  {
    title: 'Platform commission',
    keys: [
      { id: 'commission_paid_by', label: 'Who pays the commission (client / executor)', placeholder: 'client — added on top for the client; executor — deducted from the pro' },
    ],
  },
  {
    title: 'PayPal (manual split)',
    toggle: 'enable_paypal',
    toggleLabel: 'Accept payments via PayPal',
    keys: [
      { id: 'paypal_platform_email', label: 'Platform PayPal email', placeholder: 'admin@yourbrand.com' },
    ],
  },
  {
    title: 'Zelle',
    toggle: 'enable_zelle',
    toggleLabel: 'Accept payments via Zelle',
    keys: [
      { id: 'zelle_platform_handle', label: 'Platform Zelle email or phone', placeholder: 'admin@yourbrand.com or +1234567890' },
    ],
  },
  {
    title: 'Venmo',
    toggle: 'enable_venmo',
    toggleLabel: 'Accept payments via Venmo',
    keys: [
      { id: 'venmo_platform_handle', label: 'Platform Venmo username (without @)', placeholder: 'onofix-platform' },
    ],
  },
  {
    title: 'Card / bank transfer (manual)',
    toggle: 'enable_bank_transfer',
    toggleLabel: 'Accept direct transfers to a card/account',
    keys: [
      { id: 'bank_platform_details', label: 'Platform details (card/bank/routing)', placeholder: 'Bank of America 1234 5678 9012 (John Doe)' },
    ],
  },
  {
    title: 'Finix (USA — auto-split + Apple/Google Pay)',
    toggle: 'enable_finix',
    toggleLabel: 'Accept payments via Finix',
    keys: [
      { id: 'finix_environment', label: 'Environment (sandbox / live)', placeholder: 'sandbox — default' },
      { id: 'finix_api_username', label: 'API Username', placeholder: 'USxxxxxxxxxxxxxxxxx' },
      { id: 'finix_api_password', label: 'API Password', placeholder: 'secret API key password', secret: true },
      { id: 'finix_application_id', label: 'Application ID', placeholder: 'APxxxxxxxxxxxxxxxxx' },
      { id: 'finix_platform_merchant_id', label: 'Platform Merchant ID', placeholder: 'MUxxxxxxxxxxxxxxxxx' },
      { id: 'finix_platform_identity_id', label: 'Platform Identity ID', placeholder: 'IDxxxxxxxxxxxxxxxxx' },
    ],
  },
  {
    title: 'Help Center / Support',
    keys: [
      { id: 'support_email', label: 'Contact email', placeholder: 'support@yourbrand.com' },
      { id: 'support_phone', label: 'Support phone (optional)', placeholder: '+1 555 000 0000' },
    ],
  },
  {
    title: 'Twilio (SMS)',
    toggle: 'enable_sms_notifications',
    toggleLabel: 'Enable SMS notifications',
    testSms: true,
    keys: [
      { id: 'twilio_account_sid', label: 'Account SID', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
      { id: 'twilio_auth_token', label: 'Auth Token', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', secret: true },
      { id: 'twilio_from_phone', label: 'From phone', placeholder: '+12025551234' },
    ],
  },
  {
    title: 'Web Push (VAPID)',
    toggle: 'enable_push_notifications',
    toggleLabel: 'Enable browser push notifications',
    keys: [
      { id: 'vapid_public_key', label: 'Public Key', placeholder: 'BLxxxxxxxxxxxxxxxxxxxxxx' },
      { id: 'vapid_private_key', label: 'Private Key', placeholder: 'xxxxxxxxxxxxxxxxxxxxxx', secret: true },
      { id: 'vapid_subject_email', label: 'Subject email', placeholder: 'mailto:admin@your-domain.com' },
    ],
  },
  {
    title: 'Telegram (Bot)',
    toggle: 'enable_telegram_notifications',
    toggleLabel: 'Enable Telegram notifications',
    keys: [
      { id: 'telegram_bot_token', label: 'Bot Token', placeholder: '7234567890:AAxxxxxxxxxxxxx', secret: true },
    ],
  },
];

export default function AdminIntegrations() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, any>>({});
  const [testPhone, setTestPhone] = useState('');
  const [testingSms, setTestingSms] = useState(false);
  const [smsResult, setSmsResult] = useState<any>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const data = await api.adminGetIntegrationKeys();
      setValues(data || {});
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Could not load settings');
    } finally { setLoading(false); }
  };

  const setVal = (k: string, v: any) => setValues((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      // Don't re-send masked values (containing bullet •) — only fields the admin actually changed
      const patch: any = {};
      for (const [k, v] of Object.entries(values)) {
        if (typeof v === 'string' && v.includes('•')) continue;
        if (k.endsWith('_set')) continue;
        patch[k] = v;
      }
      await api.adminUpdateIntegrationKeys(patch);
      showAlert('Saved', 'Integration keys updated');
      load();
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Could not save');
    } finally { setSaving(false); }
  };

  const sendTestSms = async () => {
    if (!testPhone.trim()) { showAlert('Error', 'Enter a phone number in E.164 format, e.g. +14155551234'); return; }
    setTestingSms(true); setSmsResult(null);
    try {
      const res = await api.adminTestSms(testPhone.trim());
      setSmsResult(res);
    } catch (e: any) {
      setSmsResult({ ok: false, error: e?.response?.data?.detail || 'Request failed' });
    } finally { setTestingSms(false); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" /></View>;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color="#111827" /></TouchableOpacity>
        <Text style={s.title}>Integrations & keys</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {SECTIONS.map((sec) => (
          <View key={sec.title} style={s.card}>
            <Text style={s.sectionTitle}>{sec.title}</Text>
            {sec.toggle ? (
              <View style={s.toggleRow}>
                <Text style={s.toggleLabel}>{sec.toggleLabel}</Text>
                <Switch
                  value={!!values[sec.toggle]}
                  onValueChange={(v) => setVal(sec.toggle!, v)}
                  data-testid={`toggle-${sec.toggle}`}
                />
              </View>
            ) : null}
            {sec.keys.map((k) => {
              const isSetField = `${k.id}_set` in values;
              const isSet = !!values[`${k.id}_set`];
              const currentVal = values[k.id];
              const masked = typeof currentVal === 'string' && currentVal.includes('•');
              return (
                <View key={k.id} style={{ marginBottom: 12 }}>
                  <Text style={s.label}>
                    {k.label}
                    {isSetField && isSet ? <Text style={{ color: '#16a34a', fontSize: 12 }}>  ✓ saved</Text> : null}
                  </Text>
                  <TextInput
                    style={[s.input, masked && { color: '#9ca3af' }]}
                    placeholder={k.placeholder}
                    value={typeof currentVal === 'string' ? currentVal : ''}
                    onChangeText={(v) => setVal(k.id, v)}
                    secureTextEntry={!!k.secret && Platform.OS !== 'web' && !masked}
                    autoCapitalize="none"
                    autoCorrect={false}
                    data-testid={`input-${k.id}`}
                  />
                  {masked ? (
                    <TouchableOpacity onPress={() => setVal(k.id, '')} style={s.clearBtn}>
                      <Text style={s.clearBtnText}>Clear field and enter a new key</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
            {sec.testSms ? (
              <View style={s.testBox} data-testid="twilio-test-box">
                <Text style={s.label}>Send a test SMS</Text>
                <TextInput
                  style={s.input}
                  placeholder="+14155551234"
                  value={testPhone}
                  onChangeText={setTestPhone}
                  autoCapitalize="none"
                  autoCorrect={false}
                  data-testid="input-test-sms-phone"
                />
                <TouchableOpacity
                  style={[s.testBtn, testingSms && { opacity: 0.5 }]}
                  onPress={sendTestSms}
                  disabled={testingSms}
                  data-testid="send-test-sms-btn"
                >
                  {testingSms ? <ActivityIndicator color="#fff" /> : <Text style={s.testBtnText}>Send test SMS</Text>}
                </TouchableOpacity>
                {smsResult ? (
                  <View style={[s.resultBox, { backgroundColor: smsResult.ok ? '#ecfdf5' : '#fef2f2', borderColor: smsResult.ok ? '#a7f3d0' : '#fecaca' }]} data-testid="test-sms-result">
                    <Text style={{ fontSize: 13, fontWeight: '700', color: smsResult.ok ? '#047857' : '#b91c1c' }}>
                      {smsResult.ok ? '✓ Twilio accepted the message' : '✗ SMS failed'}
                    </Text>
                    {smsResult.message_status ? <Text style={s.resultLine}>Status: {smsResult.message_status}</Text> : null}
                    {smsResult.message_sid ? <Text style={s.resultLine}>SID: {smsResult.message_sid}</Text> : null}
                    {smsResult.twilio_error_code ? <Text style={s.resultLine}>Twilio code: {smsResult.twilio_error_code}</Text> : null}
                    {smsResult.twilio_error_message ? <Text style={s.resultLine}>{smsResult.twilio_error_message}</Text> : null}
                    {smsResult.error ? <Text style={s.resultLine}>{smsResult.error}</Text> : null}
                    {smsResult.ok ? <Text style={[s.resultLine, { marginTop: 6, fontStyle: 'italic' }]}>Note: "accepted"/"queued" means Twilio took it — final delivery still depends on toll-free / A2P verification.</Text> : null}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ))}
        <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.5 }]} onPress={save} disabled={saving} data-testid="save-integrations-btn">
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save all changes</Text>}
        </TouchableOpacity>
        <Text style={s.help}>
          🔒 Secret keys are stored only on the server. The UI shows only the last 4 characters. To replace a key — tap "Clear" and enter a new one.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f3f4f6', padding: 12, borderRadius: 8, marginBottom: 14 },
  toggleLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#374151', marginRight: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#fff' },
  clearBtn: { marginTop: 6 },
  clearBtnText: { color: '#dc2626', fontSize: 12, fontWeight: '600' },
  saveBtn: { backgroundColor: '#2563eb', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  testBox: { marginTop: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  testBtn: { backgroundColor: '#0ea5e9', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  testBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  resultBox: { marginTop: 12, padding: 12, borderRadius: 8, borderWidth: 1 },
  resultLine: { fontSize: 12, color: '#374151', marginTop: 3 },
  help: { fontSize: 12, color: '#6b7280', marginTop: 16, textAlign: 'center', lineHeight: 18 },
});
