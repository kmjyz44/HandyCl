import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, ActivityIndicator, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { showAlert } from '../utils/alert';

export default function NotificationSettings() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({ email: true, sms: true, telegram: true });
  const [tgLinked, setTgLinked] = useState(false);
  const [tgBusy, setTgBusy] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(() => {
    let alive = true;
    (async () => {
      try {
        const [p, tg] = await Promise.all([
          api.getNotificationPrefs().catch(() => ({})),
          api.telegramLinkStatus().catch(() => ({ linked: false })),
        ]);
        if (!alive) return;
        setPrefs((prev) => ({ ...prev, ...(p || {}) }));
        setTgLinked(!!((tg as any)?.connected ?? (tg as any)?.linked));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useFocusEffect(load);

  const setChannel = async (ch: string, v: boolean) => {
    setPrefs((prev) => ({ ...prev, [ch]: v }));
    setSaving(ch);
    try {
      await api.updateNotificationPrefs({ [ch]: v });
    } catch (e: any) {
      setPrefs((prev) => ({ ...prev, [ch]: !v }));
      showAlert('Error', e?.response?.data?.detail || 'Could not save');
    } finally {
      setSaving(null);
    }
  };

  const connectTelegram = async () => {
    setTgBusy(true);
    try {
      const res = await api.telegramLinkStart();
      if (res?.deep_link) {
        if (Platform.OS === 'web') window.open(res.deep_link, '_blank');
        else Linking.openURL(res.deep_link);
        showAlert('Connect Telegram', 'Telegram will open — press START in the chat. Then come back and tap "Refresh".');
      } else {
        showAlert('Not available', 'Telegram bot is not configured yet. Please try again later.');
      }
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Could not start Telegram linking.');
    } finally {
      setTgBusy(false);
    }
  };

  const disconnectTelegram = async () => {
    setTgBusy(true);
    try {
      await api.telegramUnlink();
      setTgLinked(false);
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Could not disconnect');
    } finally {
      setTgBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} data-testid="notif-settings-back">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#2563eb" />
      ) : (
        <ScrollView contentContainerStyle={styles.content} data-testid="notification-settings-screen">
          <Text style={styles.intro}>Choose how you want to hear about new jobs, messages and updates.</Text>

          {/* Email */}
          <View style={styles.card}>
            <View style={styles.rowTop}>
              <View style={[styles.icon, { backgroundColor: '#eff6ff' }]}>
                <Ionicons name="mail-outline" size={22} color="#2563eb" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Email notifications</Text>
                <Text style={styles.sub}>{user?.email || 'Your account email'}</Text>
              </View>
              <Switch
                value={prefs.email !== false}
                onValueChange={(v) => setChannel('email', v)}
                disabled={saving === 'email'}
                data-testid="notif-toggle-email"
              />
            </View>
          </View>

          {/* Telegram */}
          <View style={styles.card}>
            <View style={styles.rowTop}>
              <View style={[styles.icon, { backgroundColor: '#e0f2fe' }]}>
                <Ionicons name="paper-plane-outline" size={22} color="#0284c7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Telegram</Text>
                <Text style={[styles.sub, tgLinked && { color: '#059669', fontWeight: '600' }]}>
                  {tgLinked ? 'Connected' : 'Not connected — instant job alerts'}
                </Text>
              </View>
              {tgLinked && (
                <Switch
                  value={prefs.telegram !== false}
                  onValueChange={(v) => setChannel('telegram', v)}
                  disabled={saving === 'telegram'}
                  data-testid="notif-toggle-telegram"
                />
              )}
            </View>
            {tgLinked ? (
              <TouchableOpacity style={styles.linkBtnGhost} onPress={disconnectTelegram} disabled={tgBusy} data-testid="telegram-disconnect">
                <Text style={styles.linkBtnGhostText}>{tgBusy ? 'Working…' : 'Disconnect Telegram'}</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity style={styles.linkBtn} onPress={connectTelegram} disabled={tgBusy} data-testid="telegram-connect">
                  <Ionicons name="paper-plane" size={16} color="#fff" />
                  <Text style={styles.linkBtnText}>{tgBusy ? 'Opening…' : 'Connect Telegram'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.refreshBtn} onPress={load} data-testid="telegram-refresh">
                  <Text style={styles.refreshText}>Refresh status</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* SMS */}
          <View style={styles.card}>
            <View style={styles.rowTop}>
              <View style={[styles.icon, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={22} color="#d97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>SMS notifications</Text>
                <Text style={styles.sub}>{user?.phone || 'Add a phone number in your profile'}</Text>
              </View>
              <Switch
                value={prefs.sms !== false}
                onValueChange={(v) => setChannel('sms', v)}
                disabled={saving === 'sms'}
                data-testid="notif-toggle-sms"
              />
            </View>
            <View style={styles.noteRow}>
              <Ionicons name="information-circle-outline" size={15} color="#b45309" />
              <Text style={styles.noteText}>SMS delivery is being finalised and will start working soon. You can turn it on now and it will activate automatically.</Text>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  back: { padding: 4, marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  content: { padding: 16 },
  intro: { fontSize: 14, color: '#4b5563', lineHeight: 20, marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: '#111827' },
  sub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0284c7', borderRadius: 12, paddingVertical: 12, marginTop: 14 },
  linkBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  linkBtnGhost: { alignItems: 'center', paddingVertical: 10, marginTop: 8 },
  linkBtnGhostText: { color: '#dc2626', fontWeight: '600', fontSize: 13 },
  refreshBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  refreshText: { color: '#0284c7', fontWeight: '600', fontSize: 13 },
  noteRow: { flexDirection: 'row', gap: 6, marginTop: 12, backgroundColor: '#fffbeb', borderRadius: 10, padding: 10 },
  noteText: { flex: 1, fontSize: 12, color: '#b45309', lineHeight: 17 },
});
