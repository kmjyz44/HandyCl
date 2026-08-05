/**
 * Provider: "My ranking" dashboard.
 *
 * Shows, per active category: worked hours, bonus hours, review stars, the
 * provider's position in the client-facing list, and a progress bar with how
 * many hours are needed to reach 1st place. Bottom: a referral CTA — invite a
 * provider and both earn +5 ranking hours once the new pro's first task is paid.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';
import { showAlert } from '../utils/alert';

const Stars = ({ value }: { value: number }) => (
  <View style={{ flexDirection: 'row' }}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Ionicons
        key={i}
        name={value >= i ? 'star' : value >= i - 0.5 ? 'star-half' : 'star-outline'}
        size={13}
        color="#f59e0b"
      />
    ))}
  </View>
);

export default function MyRankingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => { load(); }, []);
  const load = async () => {
    try {
      setData(await api.getProviderRanking());
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Failed to load ranking.');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    const link = data?.referral_link || '';
    try {
      if (Platform.OS === 'web' && navigator?.clipboard) {
        await navigator.clipboard.writeText(link);
        showAlert('Copied', 'Referral link copied to clipboard.');
      } else {
        showAlert('Your referral link', link);
      }
    } catch {
      showAlert('Your referral link', link);
    }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#2563eb" /></View>;

  const cats = data?.categories || [];

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><Ionicons name="arrow-back" size={24} color="#111827" /></TouchableOpacity>
        <Text style={s.title}>My ranking</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} data-testid="my-ranking-screen">
        {data?.total_bonus_hours > 0 && (
          <View style={s.bonusBanner} data-testid="ranking-total-bonus">
            <Ionicons name="gift" size={18} color="#7c3aed" />
            <Text style={s.bonusBannerText}>You have <Text style={{ fontWeight: '800' }}>+{data.total_bonus_hours}</Text> bonus ranking hours</Text>
          </View>
        )}

        {cats.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="stats-chart-outline" size={40} color="#d1d5db" />
            <Text style={s.emptyText}>Add skills to your profile to appear in category rankings.</Text>
          </View>
        ) : cats.map((c: any) => {
          const pct = c.leader_score > 0 ? Math.min(100, Math.round((c.total_score / c.leader_score) * 100)) : (c.position === 1 ? 100 : 0);
          return (
            <View key={c.category_id} style={s.card} data-testid={`ranking-cat-${c.category_id}`}>
              <View style={s.cardTop}>
                <Text style={s.catName}>{c.category_name}</Text>
                <View style={[s.posBadge, c.position === 1 && s.posBadgeGold]}>
                  <Ionicons name="trophy" size={12} color={c.position === 1 ? '#fff' : '#2563eb'} />
                  <Text style={[s.posText, c.position === 1 && { color: '#fff' }]}>#{c.position} of {c.total_providers}</Text>
                </View>
              </View>

              <View style={s.statsRow}>
                <View style={s.stat}>
                  <Text style={s.statVal}>{c.worked_hours}h</Text>
                  <Text style={s.statLbl}>Worked</Text>
                </View>
                <View style={s.stat}>
                  <Text style={[s.statVal, { color: '#7c3aed' }]}>+{c.bonus_hours}h</Text>
                  <Text style={s.statLbl}>Bonus</Text>
                </View>
                <View style={s.stat}>
                  <Text style={[s.statVal, { color: '#2563eb' }]}>{c.total_score}</Text>
                  <Text style={s.statLbl}>Score</Text>
                </View>
                <View style={s.stat}>
                  <Stars value={c.average_rating} />
                  <Text style={s.statLbl}>{c.average_rating || 0} ({c.reviews_count})</Text>
                </View>
              </View>

              <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${pct}%` }]} />
              </View>
              {c.position === 1 ? (
                <Text style={s.toGoTop}>🏆 You're #1 in {c.category_name}!</Text>
              ) : (
                <Text style={s.toGo}>
                  <Text style={{ fontWeight: '800', color: '#111827' }}>{c.hours_to_first}h</Text> more to reach 1st place
                  {c.position > 2 ? <Text> · {c.hours_to_second}h to 2nd</Text> : null}
                </Text>
              )}
            </View>
          );
        })}

        {/* Referral CTA */}
        <View style={s.refCard} data-testid="ranking-referral-cta">
          <Ionicons name="people-circle" size={30} color="#2563eb" />
          <Text style={s.refTitle}>Invite a pro, earn bonus hours</Text>
          <Text style={s.refSub}>
            When a provider you invite completes their first paid task, you BOTH get
            <Text style={{ fontWeight: '800' }}> +{data?.referral_bonus_hours || 5} ranking hours</Text> in every category.
          </Text>
          <View style={s.refLinkBox}>
            <Text style={s.refLink} numberOfLines={1}>{data?.referral_link}</Text>
            <TouchableOpacity style={s.copyBtn} onPress={copyLink} data-testid="ranking-copy-link-btn">
              <Ionicons name="copy-outline" size={16} color="#fff" />
              <Text style={s.copyText}>Copy</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.refCode}>Your code: <Text style={{ fontWeight: '800' }}>{data?.referral_code}</Text></Text>
        </View>

        <Text style={s.rulesLink} onPress={() => router.push('/terms' as any)} data-testid="ranking-rules-link">
          How ranking works — see platform rules
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 52, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  back: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', flex: 1 },
  content: { padding: 16, paddingBottom: 50 },
  bonusBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f5f3ff', borderRadius: 12, padding: 12, marginBottom: 14 },
  bonusBannerText: { fontSize: 13, color: '#5b21b6' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { color: '#9ca3af', fontSize: 14, textAlign: 'center', paddingHorizontal: 30 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#eef2f7' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  catName: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1 },
  posBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#eff6ff', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
  posBadgeGold: { backgroundColor: '#f59e0b' },
  posText: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  stat: { alignItems: 'center', flex: 1 },
  statVal: { fontSize: 16, fontWeight: '800', color: '#111827' },
  statLbl: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  barTrack: { height: 8, backgroundColor: '#eef2f7', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: '#2563eb', borderRadius: 4 },
  toGo: { fontSize: 12, color: '#6b7280', marginTop: 8 },
  toGoTop: { fontSize: 13, fontWeight: '700', color: '#f59e0b', marginTop: 8 },
  refCard: { backgroundColor: '#fff', borderRadius: 14, padding: 18, marginTop: 8, borderWidth: 1, borderColor: '#dbeafe', alignItems: 'center' },
  refTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginTop: 8 },
  refSub: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginTop: 6, lineHeight: 19 },
  refLinkBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, width: '100%' },
  refLink: { flex: 1, fontSize: 12, color: '#374151', backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  copyText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  refCode: { fontSize: 12, color: '#6b7280', marginTop: 10 },
  rulesLink: { fontSize: 13, color: '#2563eb', fontWeight: '600', textAlign: 'center', marginTop: 18, textDecorationLine: 'underline' },
});
