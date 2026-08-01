import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';

export default function RewardsBanner() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    if (!user || user.role === 'provider') return;
    api.getLoyaltyBalance()
      .then((d) => { if (alive) setData(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [user?.user_id]);

  if (!user || user.role === 'provider' || !data) return null;

  const points = data.balance_points ?? 0;
  const next = data.next_tier;
  const pct = next ? Math.min(100, Math.round(((next.points_needed - next.points_to_go) / next.points_needed) * 100)) : 100;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={s.card}
      onPress={() => router.push('/rewards')}
      data-testid="home-rewards-banner"
    >
      <View style={s.iconWrap}>
        <Ionicons name="gift" size={22} color="#fbbf24" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>
          🎁 {points.toLocaleString()} points{data.balance_usd ? ` · $${data.balance_usd.toFixed(2)}` : ''}
        </Text>
        <Text style={s.sub} numberOfLines={1}>
          {next ? `${next.points_to_go.toLocaleString()} pts to a $${next.value} gift card` : 'Redeem your $500 gift card!'}
        </Text>
        <View style={s.track}><View style={[s.fill, { width: `${pct}%` }]} /></View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0f172a', borderRadius: 16, padding: 14, marginBottom: 14,
  },
  iconWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(251,191,36,0.15)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 15, fontWeight: '800' },
  sub: { color: '#cbd5e1', fontSize: 12, fontWeight: '600', marginTop: 2 },
  track: { height: 6, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden', marginTop: 8 },
  fill: { height: 6, borderRadius: 4, backgroundColor: '#22c55e' },
});
