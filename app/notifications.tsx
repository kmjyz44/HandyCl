import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { api } from '../utils/api';
import { registerWebPush, pushDiagnosticInfo } from '../utils/webPush';
import { showAlert } from '../utils/alert';

const ICON_BY_TYPE: Record<string, keyof typeof Ionicons.glyphMap> = {
  booking_accepted: 'checkmark-circle',
  booking_declined: 'close-circle',
  new_task_pending: 'alarm',
  task_on_the_way: 'car',
  task_started: 'hammer',
  payment_required: 'card',
  default: 'notifications',
};

const COLOR_BY_TYPE: Record<string, string> = {
  booking_accepted: '#10b981',
  booking_declined: '#ef4444',
  new_task_pending: '#f59e0b',
  task_on_the_way: '#3b82f6',
  task_started: '#8b5cf6',
  payment_required: '#ec4899',
  default: '#6b7280',
};

function fmt(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return ts;
  }
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pushStatus, setPushStatus] = useState<string>('');

  const load = useCallback(async () => {
    try {
      const data = await api.getNotifications(false, 100);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    pushDiagnosticInfo().then((info: any) => {
      if (info.platform === 'native') {
        setPushStatus('Native: in-app only');
        return;
      }
      if (!info.hasServiceWorker || !info.hasPushManager) {
        setPushStatus('Push не підтримується цим браузером');
        return;
      }
      if (info.permission === 'denied') {
        setPushStatus('Push заблоковано в налаштуваннях браузера');
        return;
      }
      if (info.permission !== 'granted') {
        setPushStatus('Push не активовано');
        return;
      }
      if (!info.hasSubscription) {
        setPushStatus('Не підписано на push');
        return;
      }
      setPushStatus('Push активний ✓');
    });
  }, []);

  const onMarkAll = async () => {
    try {
      await api.markAllNotificationsRead();
      load();
    } catch {}
  };

  const onPressItem = async (n: any) => {
    if (!n.is_read) {
      try { await api.markNotificationRead(n.notification_id); } catch {}
    }
    if (n.related_type === 'booking' && n.related_id) {
      router.push(`/task-detail?id=${n.related_id}` as any);
    } else if (n.related_type === 'task' && n.related_id) {
      router.push(`/task-detail?id=${n.related_id}` as any);
    }
  };

  const onEnablePush = async () => {
    const r = await registerWebPush();
    if (r.ok) {
      setPushStatus('Push активний ✓');
      showAlert('Готово', 'Push сповіщення увімкнено для цього браузера.');
    } else {
      showAlert('Не вдалося увімкнути', `Причина: ${r.reason || 'невідома'}`);
    }
  };

  const onTestPush = async () => {
    try {
      const r = await api.testPush();
      showAlert(
        'Тест відправлено',
        `Підписок: ${r.subscriptions}. Доставлено: ${r.sent}.\n${r.sent === 0 ? 'Якщо 0 — перевір що Push активний і дозволено в браузері.' : 'Push мав прийти миттєво.'}`
      );
    } catch (e: any) {
      showAlert('Помилка', e?.response?.data?.detail || e?.message || 'Не вдалося');
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Сповіщення',
          headerRight: () => (
            <TouchableOpacity onPress={onMarkAll} data-testid="mark-all-read-btn" style={{ paddingHorizontal: 12 }}>
              <Text style={{ color: '#2563eb', fontSize: 13, fontWeight: '600' }}>Прочитати все</Text>
            </TouchableOpacity>
          ),
        }}
      />

      {Platform.OS === 'web' && (
        <View style={styles.pushBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pushBannerTitle}>Push сповіщення</Text>
            <Text style={styles.pushBannerSub}>{pushStatus || 'Перевіряю...'}</Text>
          </View>
          <TouchableOpacity style={styles.pushBtn} onPress={onEnablePush} data-testid="enable-push-btn">
            <Text style={styles.pushBtnText}>Увімкнути</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.pushBtn, { backgroundColor: '#f3f4f6' }]} onPress={onTestPush} data-testid="test-push-btn">
            <Text style={[styles.pushBtnText, { color: '#374151' }]}>Тест</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#2563eb" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.notification_id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
          }
          contentContainerStyle={items.length === 0 ? styles.emptyWrap : { paddingBottom: 24 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={48} color="#9ca3af" />
              <Text style={styles.emptyText}>Сповіщень поки немає</Text>
              <Text style={styles.emptySub}>Як тільки виконавець прийме замовлення, ти отримаєш сповіщення тут (і у браузері).</Text>
            </View>
          }
          renderItem={({ item }) => {
            const t = item.notification_type || 'default';
            const iconName = ICON_BY_TYPE[t] || ICON_BY_TYPE.default;
            const tint = COLOR_BY_TYPE[t] || COLOR_BY_TYPE.default;
            return (
              <TouchableOpacity
                style={[styles.row, !item.is_read && styles.rowUnread]}
                onPress={() => onPressItem(item)}
                data-testid={`notif-${item.notification_id}`}
              >
                <View style={[styles.iconWrap, { backgroundColor: tint + '20' }]}>
                  <Ionicons name={iconName as any} size={22} color={tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, !item.is_read && { fontWeight: '700' }]}>{item.title}</Text>
                  <Text style={styles.msg} numberOfLines={3}>{item.message}</Text>
                  <Text style={styles.time}>{fmt(item.created_at)}</Text>
                </View>
                {!item.is_read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  pushBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16, paddingVertical: 12, gap: 8,
  },
  pushBannerTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  pushBannerSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  pushBtn: {
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#2563eb',
    borderRadius: 8,
  },
  pushBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: 16, gap: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  rowUnread: { backgroundColor: '#eff6ff' },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 14, color: '#111827' },
  msg: { fontSize: 13, color: '#4b5563', marginTop: 2, lineHeight: 18 },
  time: { fontSize: 11, color: '#9ca3af', marginTop: 6 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563eb',
    marginTop: 6,
  },

  emptyWrap: { flexGrow: 1, justifyContent: 'center', padding: 32 },
  empty: { alignItems: 'center' },
  emptyText: { marginTop: 12, fontSize: 16, color: '#374151', fontWeight: '600' },
  emptySub: { marginTop: 6, fontSize: 12, color: '#6b7280', textAlign: 'center', lineHeight: 18 },
});
