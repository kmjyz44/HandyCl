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

const SECTIONS: { title: string; toggle?: string; toggleLabel?: string; keys: KeyDef[] }[] = [
  {
    title: 'Resend (Email — за замовчуванням)',
    toggle: 'enable_email_notifications',
    toggleLabel: 'Увімкнути email-сповіщення',
    keys: [
      { id: 'email_provider', label: 'Провайдер email (resend / sendgrid)', placeholder: 'resend — за замовчуванням; sendgrid — резервний' },
      { id: 'resend_api_key', label: 'Resend API Key', placeholder: 're_xxxxxxxxxxxxxxxxxxxx', secret: true },
      { id: 'resend_from_email', label: 'From email (підтверджений домен)', placeholder: 'onboarding@resend.dev або noreply@your-domain.com' },
    ],
  },
  {
    title: 'SendGrid (Email — резервний)',
    keys: [
      { id: 'sendgrid_api_key', label: 'API Key', placeholder: 'SG.xxxxxxxxxxxxxxxxxxxx', secret: true },
      { id: 'sendgrid_from_email', label: 'From email', placeholder: 'noreply@your-domain.com' },
    ],
  },
  {
    title: 'Stripe (Платежі)',
    toggle: 'enable_stripe_payments',
    toggleLabel: 'Приймати платежі через Stripe',
    keys: [
      { id: 'stripe_secret_key', label: 'Secret Key', placeholder: 'sk_test_xxx або sk_live_xxx', secret: true },
      { id: 'stripe_publishable_key', label: 'Publishable Key', placeholder: 'pk_test_xxx або pk_live_xxx' },
      { id: 'stripe_webhook_secret', label: 'Webhook Signing Secret', placeholder: 'whsec_xxxxxxxxxxxx', secret: true },
      { id: 'stripe_currency', label: 'Валюта (3 літери ISO)', placeholder: 'usd, uah, eur — за замовчуванням usd' },
    ],
  },
  {
    title: 'Комісія платформи',
    keys: [
      { id: 'commission_paid_by', label: 'Хто оплачує комісію (client / executor)', placeholder: 'client — додається клієнту зверху; executor — віднімається з виконавця' },
    ],
  },
  {
    title: 'PayPal (manual split)',
    toggle: 'enable_paypal',
    toggleLabel: 'Приймати оплату через PayPal',
    keys: [
      { id: 'paypal_platform_email', label: 'PayPal email платформи', placeholder: 'admin@yourbrand.com' },
    ],
  },
  {
    title: 'Zelle',
    toggle: 'enable_zelle',
    toggleLabel: 'Приймати оплату через Zelle',
    keys: [
      { id: 'zelle_platform_handle', label: 'Zelle email або телефон платформи', placeholder: 'admin@yourbrand.com або +1234567890' },
    ],
  },
  {
    title: 'Venmo',
    toggle: 'enable_venmo',
    toggleLabel: 'Приймати оплату через Venmo',
    keys: [
      { id: 'venmo_platform_handle', label: 'Venmo username платформи (без @)', placeholder: 'handyhub-platform' },
    ],
  },
  {
    title: 'Переказ на картку / банк (manual)',
    toggle: 'enable_bank_transfer',
    toggleLabel: 'Приймати прямі перекази на картку/рахунок',
    keys: [
      { id: 'bank_platform_details', label: 'Реквізити платформи (картка/банк/IBAN)', placeholder: 'PrivatBank 4149 0000 0000 0000 (Іван Петренко)' },
    ],
  },
  {
    title: 'Finix (США — авто-split + Apple/Google Pay)',
    toggle: 'enable_finix',
    toggleLabel: 'Приймати оплату через Finix',
    keys: [
      { id: 'finix_environment', label: 'Середовище (sandbox / live)', placeholder: 'sandbox — за замовчуванням' },
      { id: 'finix_api_username', label: 'API Username', placeholder: 'USxxxxxxxxxxxxxxxxx' },
      { id: 'finix_api_password', label: 'API Password', placeholder: 'секретний пароль API-ключа', secret: true },
      { id: 'finix_application_id', label: 'Application ID', placeholder: 'APxxxxxxxxxxxxxxxxx' },
      { id: 'finix_platform_merchant_id', label: 'Platform Merchant ID', placeholder: 'MUxxxxxxxxxxxxxxxxx' },
    ],
  },
  {
    title: 'Центр допомоги / Підтримка',
    keys: [
      { id: 'support_email', label: 'Email для зворотного зв\'язку', placeholder: 'support@yourbrand.com' },
      { id: 'support_phone', label: 'Телефон підтримки (опціонально)', placeholder: '+38 050 000 0000' },
    ],
  },
  {
    title: 'Twilio (SMS)',
    toggle: 'enable_sms_notifications',
    toggleLabel: 'Увімкнути SMS-сповіщення',
    keys: [
      { id: 'twilio_account_sid', label: 'Account SID', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
      { id: 'twilio_auth_token', label: 'Auth Token', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', secret: true },
      { id: 'twilio_from_phone', label: 'From phone', placeholder: '+12025551234' },
    ],
  },
  {
    title: 'Web Push (VAPID)',
    toggle: 'enable_push_notifications',
    toggleLabel: 'Увімкнути браузерні Push-сповіщення',
    keys: [
      { id: 'vapid_public_key', label: 'Public Key', placeholder: 'BLxxxxxxxxxxxxxxxxxxxxxx' },
      { id: 'vapid_private_key', label: 'Private Key', placeholder: 'xxxxxxxxxxxxxxxxxxxxxx', secret: true },
      { id: 'vapid_subject_email', label: 'Subject email', placeholder: 'mailto:admin@your-domain.com' },
    ],
  },
  {
    title: 'Telegram (Бот)',
    toggle: 'enable_telegram_notifications',
    toggleLabel: 'Увімкнути Telegram-сповіщення',
    keys: [
      { id: 'telegram_bot_token', label: 'Bot Token', placeholder: '7234567890:AAxxxxxxxxxxxxx', secret: true },
    ],
  },
];

export default function AdminIntegrations() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, any>>({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const data = await api.adminGetIntegrationKeys();
      setValues(data || {});
    } catch (e: any) {
      showAlert('Помилка', e?.response?.data?.detail || 'Не вдалося завантажити налаштування');
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
      showAlert('Збережено', 'Інтеграційні ключі оновлені');
      load();
    } catch (e: any) {
      showAlert('Помилка', e?.response?.data?.detail || 'Не вдалося зберегти');
    } finally { setSaving(false); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" /></View>;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color="#111827" /></TouchableOpacity>
        <Text style={s.title}>Інтеграції та ключі</Text>
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
                    {isSetField && isSet ? <Text style={{ color: '#16a34a', fontSize: 12 }}>  ✓ збережено</Text> : null}
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
                      <Text style={s.clearBtnText}>Очистити поле і ввести новий ключ</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
        <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.5 }]} onPress={save} disabled={saving} data-testid="save-integrations-btn">
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Зберегти всі зміни</Text>}
        </TouchableOpacity>
        <Text style={s.help}>
          🔒 Секретні ключі зберігаються тільки на сервері. У відповіді UI показує лише останні 4 символи. Щоб замінити ключ — натисніть «Очистити» і введіть новий.
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
  help: { fontSize: 12, color: '#6b7280', marginTop: 16, textAlign: 'center', lineHeight: 18 },
});
