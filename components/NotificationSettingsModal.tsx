import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity, Switch,
  StyleSheet, Platform, Linking, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../utils/api';
import { showAlert } from '../utils/alert';

const ROWS = [
  { key: 'push', label: 'Push notifications', icon: 'notifications-outline' },
  { key: 'email', label: 'Email', icon: 'mail-outline' },
  { key: 'telegram', label: 'Telegram', icon: 'paper-plane-outline' },
  { key: 'sms', label: 'SMS', icon: 'chatbubble-outline' },
] as const;

export const NotificationSettingsModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({ email: true, sms: true, push: true, telegram: true });
  const [tgConnected, setTgConnected] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadStatus = async () => {
    try { const p = await api.getNotificationPrefs(); if (p) setPrefs(p); } catch {}
    try { const s = await api.telegramLinkStatus(); setTgConnected(!!s?.connected); } catch {}
  };

  useEffect(() => { if (visible) loadStatus(); }, [visible]);

  const toggle = async (ch: string, v: boolean) => {
    setPrefs((s) => ({ ...s, [ch]: v }));
    try { const u = await api.updateNotificationPrefs({ [ch]: v }); if (u) setPrefs(u); }
    catch { setPrefs((s) => ({ ...s, [ch]: !v })); }
  };

  const connectTelegram = async () => {
    setBusy(true);
    try {
      const res = await api.telegramLinkStart();
      if (res?.deep_link) {
        if (Platform.OS === 'web') window.open(res.deep_link, '_blank');
        else Linking.openURL(res.deep_link);
        showAlert('Connect Telegram', 'Telegram will open — tap START in the bot, then come back and tap "Refresh".');
      }
    } catch (e: any) {
      showAlert('Telegram unavailable', e?.response?.data?.detail || 'Telegram notifications are not set up yet.');
    } finally { setBusy(false); }
  };

  const unlinkTelegram = async () => {
    try { await api.telegramUnlink(); setTgConnected(false); } catch {}
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} data-testid="notif-modal-close">
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={s.title}>Notifications</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 10 }}>
          <Text style={s.hint}>Turn off any channel you don't want to receive.</Text>
          {ROWS.map((row) => (
            <View key={row.key} style={s.row} data-testid={`notif-row-${row.key}`}>
              <Ionicons name={row.icon as any} size={20} color="#374151" style={{ marginRight: 14 }} />
              <Text style={s.rowLabel}>{row.label}</Text>
              <Switch
                value={prefs[row.key] !== false}
                onValueChange={(v) => toggle(row.key, v)}
                trackColor={{ true: '#2563eb', false: '#d1d5db' }}
                data-testid={`notif-toggle-${row.key}`}
              />
            </View>
          ))}

          {/* Telegram connection */}
          <View style={s.tgCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="paper-plane" size={18} color="#0088cc" style={{ marginRight: 8 }} />
              <Text style={s.tgTitle}>Telegram connection</Text>
            </View>
            <Text style={s.tgStatus} data-testid="tg-connection-status">
              {tgConnected ? '✅ Connected — you will receive alerts in Telegram.' : 'Not connected. Link your Telegram to receive alerts there.'}
            </Text>
            <TouchableOpacity
              style={[s.tgBtn, busy && { opacity: 0.5 }]}
              onPress={connectTelegram}
              disabled={busy}
              data-testid="tg-connect-btn"
            >
              {busy ? <ActivityIndicator color="#fff" /> : (
                <Text style={s.tgBtnText}>{tgConnected ? 'Reconnect Telegram' : 'Connect Telegram'}</Text>
              )}
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
              <TouchableOpacity onPress={loadStatus} data-testid="tg-refresh-btn">
                <Text style={s.tgLink}>Refresh status</Text>
              </TouchableOpacity>
              {tgConnected ? (
                <TouchableOpacity onPress={unlinkTelegram} data-testid="tg-unlink-btn">
                  <Text style={[s.tgLink, { color: '#dc2626' }]}>Disconnect</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  hint: { fontSize: 12, color: '#6b7280', paddingHorizontal: 20, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  rowLabel: { flex: 1, fontSize: 15, color: '#111827' },
  tgCard: { margin: 16, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  tgTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  tgStatus: { fontSize: 13, color: '#4b5563', marginBottom: 12, lineHeight: 18 },
  tgBtn: { backgroundColor: '#0088cc', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  tgBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  tgLink: { color: '#2563eb', fontWeight: '600', fontSize: 13 },
});
