import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';

type Alert = {
  has_pending?: boolean;
  count?: number;
  oldest?: { task_id: string; title: string; elapsed_seconds: number } | null;
  search_paused?: boolean;
  paused_reason?: string | null;
};

function fmtElapsed(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m elapsed`;
  if (m > 0) return `${m}m ${s}s elapsed`;
  return `${s}s elapsed`;
}

export default function ProviderAlertBanner() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  const [data, setData] = useState<Alert | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [unpausing, setUnpausing] = useState(false);
  const baseRef = useRef<{ base: number; at: number } | null>(null);

  const fetch = useCallback(async () => {
    if (!token || !user || user.role !== 'provider') return;
    try {
      const r: Alert = await api.getProviderPendingAlert();
      setData(r);
      if (r?.oldest?.elapsed_seconds != null) {
        baseRef.current = { base: r.oldest.elapsed_seconds, at: Date.now() };
        setElapsed(r.oldest.elapsed_seconds);
      } else {
        baseRef.current = null;
      }
    } catch {}
  }, [token, user]);

  useEffect(() => {
    fetch();
    const poll = setInterval(fetch, 30000);
    return () => clearInterval(poll);
  }, [fetch]);

  // Tick the elapsed timer locally every second.
  useEffect(() => {
    const t = setInterval(() => {
      if (baseRef.current) {
        setElapsed(baseRef.current.base + Math.floor((Date.now() - baseRef.current.at) / 1000));
      }
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const reactivate = async () => {
    setUnpausing(true);
    try {
      await api.providerUnpause();
      await fetch();
    } catch {} finally {
      setUnpausing(false);
    }
  };

  if (!user || user.role !== 'provider' || !data) return null;

  // 1) Account paused → reactivate message
  if (data.search_paused) {
    return (
      <TouchableOpacity
        style={[styles.banner, { backgroundColor: '#fef2f2', borderColor: '#fca5a5' }]}
        onPress={reactivate}
        activeOpacity={0.85}
        disabled={unpausing}
        data-testid="provider-paused-banner"
      >
        <View style={[styles.iconWrap, { backgroundColor: '#dc2626' }]}>
          <Ionicons name="pause" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: '#dc2626' }]}>Your account is paused</Text>
          <Text style={styles.message}>
            {data.paused_reason === 'auto_unaccepted'
              ? "You didn't accept a task in time — you're hidden from search. Tap to reactivate."
              : "You're hidden from search. Tap to reactivate."}
          </Text>
        </View>
        {unpausing ? <ActivityIndicator color="#dc2626" /> : <Text style={styles.action}>Reactivate</Text>}
      </TouchableOpacity>
    );
  }

  // 2) Unaccepted task → count-up banner
  if (data.has_pending && data.oldest) {
    return (
      <TouchableOpacity
        style={[styles.banner, { backgroundColor: '#fffbeb', borderColor: '#fcd34d' }]}
        onPress={() => router.push(`/task-detail?id=${data.oldest!.task_id}` as any)}
        activeOpacity={0.85}
        data-testid="provider-pending-banner"
      >
        <View style={[styles.iconWrap, { backgroundColor: '#f59e0b' }]}>
          <Ionicons name="time" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: '#b45309' }]}>
            {data.count && data.count > 1 ? `${data.count} tasks awaiting your response` : 'You have an unaccepted task'}
          </Text>
          <Text style={styles.message} numberOfLines={1}>
            {data.oldest.title} · <Text style={styles.timer} data-testid="provider-pending-timer">{fmtElapsed(elapsed)}</Text>
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#b45309" />
      </TouchableOpacity>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 14, borderWidth: 1.5, gap: 12 },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '800' },
  message: { fontSize: 12, color: '#374151', marginTop: 2, lineHeight: 16 },
  timer: { fontWeight: '800', color: '#b45309' },
  action: { fontSize: 13, fontWeight: '800', color: '#dc2626' },
});
