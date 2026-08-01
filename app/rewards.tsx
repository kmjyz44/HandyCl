import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Share, Platform, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Head from 'expo-router/head';
import { api } from '../utils/api';
import { showAlert } from '../utils/alert';

const BRAND_ICONS: Record<number, string> = {
  25: 'card', 50: 'gift', 100: 'ribbon', 200: 'sparkles', 500: 'trophy',
};

export default function Rewards() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [balance, setBalance] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [txns, setTxns] = useState<any[]>([]);
  const [redeeming, setRedeeming] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [b, s, t] = await Promise.all([
        api.getLoyaltyBalance(),
        api.getReferralStats().catch(() => null),
        api.getLoyaltyTransactions().catch(() => ({ transactions: [] })),
      ]);
      setBalance(b);
      setStats(s);
      setTxns(t?.transactions || []);
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Could not load rewards');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onShare = async () => {
    const link = balance?.referral_link || '';
    const code = balance?.referral_code || '';
    const msg = `Get your home fixed on Ono-Fix! Use my code ${code} when you sign up: ${link}`;
    try {
      if (Platform.OS === 'web') {
        // @ts-ignore
        if (navigator?.share) { await navigator.share({ title: 'Ono-Fix', text: msg, url: link }); }
        else { await navigator.clipboard.writeText(link); showAlert('Copied', 'Referral link copied to clipboard'); }
      } else {
        await Share.share({ message: msg });
      }
    } catch { /* user cancelled */ }
  };

  const onCopy = async () => {
    const link = balance?.referral_link || '';
    try {
      if (Platform.OS === 'web') { await navigator.clipboard.writeText(link); }
      showAlert('Copied', 'Referral link copied to clipboard');
    } catch {}
  };

  const onRedeem = async (value: number) => {
    setRedeeming(value);
    try {
      await api.redeemGiftCard(value);
      showAlert('Success', `Your $${value} gift card is on its way!`);
      load();
    } catch (e: any) {
      showAlert('Rewards', e?.response?.data?.detail || 'Could not redeem right now');
    } finally {
      setRedeeming(null);
    }
  };

  if (loading) {
    return (
      <View style={s.center} data-testid="rewards-loading">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const points = balance?.balance_points ?? 0;
  const usd = balance?.balance_usd ?? 0;
  const next = balance?.next_tier;
  const pct = next ? Math.min(100, Math.round(((next.points_needed - next.points_to_go) / next.points_needed) * 100)) : 100;

  return (
    <View style={s.container}>
      <Head><title>Rewards — Ono-Fix</title></Head>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} data-testid="rewards-back-btn">
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Rewards</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {/* Hero balance card */}
        <View style={s.hero} data-testid="rewards-balance-card">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="star" size={18} color="#fbbf24" />
            <Text style={s.heroLabel}>Your reward balance</Text>
          </View>
          <Text style={s.heroPoints} data-testid="rewards-points">{points.toLocaleString()} <Text style={s.heroPointsUnit}>pts</Text></Text>
          <Text style={s.heroUsd}>≈ ${usd.toFixed(2)} in gift cards</Text>

          {next ? (
            <View style={{ marginTop: 18 }}>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${pct}%` }]} />
              </View>
              <Text style={s.heroHint} data-testid="rewards-next-tier">
                {next.points_to_go.toLocaleString()} more pts to a ${next.value} gift card
              </Text>
            </View>
          ) : (
            <Text style={[s.heroHint, { marginTop: 14 }]}>You can redeem the top $500 card 🎉</Text>
          )}
        </View>

        {/* Gift card tiers */}
        <Text style={s.sectionTitle}>Redeem a gift card</Text>
        <Text style={s.sectionSub}>Turn your points into a Visa / Amazon gift card. Points never expire.</Text>
        <View style={{ gap: 12, marginTop: 12 }}>
          {(balance?.tiers || []).map((t: any) => (
            <View key={t.value} style={s.tierRow} data-testid={`reward-tier-${t.value}`}>
              <View style={[s.tierIcon, t.can_redeem && { backgroundColor: '#ecfdf5' }]}>
                <Ionicons name={(BRAND_ICONS[t.value] || 'gift') as any} size={22} color={t.can_redeem ? '#10b981' : '#9ca3af'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.tierValue}>${t.value} gift card</Text>
                <Text style={s.tierPoints}>{t.points.toLocaleString()} points</Text>
              </View>
              <TouchableOpacity
                style={[s.redeemBtn, !t.can_redeem && s.redeemBtnDisabled]}
                disabled={!t.can_redeem || redeeming !== null}
                onPress={() => onRedeem(t.value)}
                data-testid={`redeem-${t.value}-btn`}
              >
                {redeeming === t.value
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={[s.redeemBtnText, !t.can_redeem && { color: '#9ca3af' }]}>{t.can_redeem ? 'Redeem' : 'Locked'}</Text>}
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Referral card */}
        <Text style={s.sectionTitle}>Invite friends, earn points</Text>
        <View style={s.refCard} data-testid="rewards-referral-card">
          <Text style={s.refText}>
            Share your code. When a friend signs up and completes $100 in orders, you earn{' '}
            <Text style={{ fontWeight: '800', color: '#2563eb' }}>500 points ($5)</Text>.
          </Text>
          <View style={s.codeBox}>
            <Text style={s.codeText} data-testid="rewards-referral-code">{balance?.referral_code}</Text>
            <TouchableOpacity onPress={onCopy} style={s.codeCopy} data-testid="rewards-copy-btn">
              <Ionicons name="copy-outline" size={18} color="#2563eb" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.shareBtn} onPress={onShare} data-testid="rewards-share-btn">
            <Ionicons name="share-social" size={18} color="#fff" />
            <Text style={s.shareBtnText}>Share invite link</Text>
          </TouchableOpacity>

          <View style={s.statsRow}>
            <View style={s.statBox}>
              <Text style={s.statNum}>{stats?.referred_count ?? 0}</Text>
              <Text style={s.statLabel}>Invited</Text>
            </View>
            <View style={s.statBox}>
              <Text style={s.statNum}>{stats?.active_count ?? 0}</Text>
              <Text style={s.statLabel}>Activated</Text>
            </View>
            <View style={s.statBox}>
              <Text style={[s.statNum, { color: '#10b981' }]}>${stats?.usd_earned ?? 0}</Text>
              <Text style={s.statLabel}>Earned</Text>
            </View>
          </View>
        </View>

        {/* History */}
        {txns.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Recent activity</Text>
            <View style={s.historyCard}>
              {txns.slice(0, 15).map((tx, i) => (
                <View key={tx.txn_id || i} style={[s.txnRow, i > 0 && s.txnDivider]} data-testid={`txn-row-${i}`}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={s.txnDesc} numberOfLines={2}>{tx.description}</Text>
                    <Text style={s.txnDate}>{tx.created_at ? new Date(tx.created_at).toLocaleDateString() : ''}</Text>
                  </View>
                  <Text style={[s.txnAmount, { color: tx.amount >= 0 ? '#10b981' : '#ef4444' }]}>
                    {tx.amount >= 0 ? '+' : ''}{tx.amount}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: Platform.OS === 'web' ? 16 : 52, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eef0f3',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },

  hero: { backgroundColor: '#0f172a', borderRadius: 20, padding: 22 },
  heroLabel: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
  heroPoints: { color: '#fff', fontSize: 40, fontWeight: '900', marginTop: 10, letterSpacing: -1 },
  heroPointsUnit: { fontSize: 18, fontWeight: '700', color: '#94a3b8' },
  heroUsd: { color: '#22d3ee', fontSize: 14, fontWeight: '700', marginTop: 2 },
  progressTrack: { height: 10, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  progressFill: { height: 10, borderRadius: 6, backgroundColor: '#22c55e' },
  heroHint: { color: '#e2e8f0', fontSize: 13, marginTop: 8, fontWeight: '600' },

  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#111827', marginTop: 26 },
  sectionSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  tierRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#eef0f3', gap: 12,
  },
  tierIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  tierValue: { fontSize: 15, fontWeight: '800', color: '#111827' },
  tierPoints: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  redeemBtn: { backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, minWidth: 84, alignItems: 'center' },
  redeemBtnDisabled: { backgroundColor: '#f3f4f6' },
  redeemBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  refCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginTop: 12, borderWidth: 1, borderColor: '#eef0f3' },
  refText: { fontSize: 14, color: '#374151', lineHeight: 20 },
  codeBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#eff6ff', borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe',
    borderStyle: 'dashed', paddingHorizontal: 16, paddingVertical: 14, marginTop: 14,
  },
  codeText: { fontSize: 22, fontWeight: '900', color: '#1d4ed8', letterSpacing: 2 },
  codeCopy: { padding: 6 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 13, marginTop: 12,
  },
  shareBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  statsRow: { flexDirection: 'row', marginTop: 18, gap: 10 },
  statBox: { flex: 1, backgroundColor: '#f9fafb', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '900', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  historyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 6, marginTop: 12, borderWidth: 1, borderColor: '#eef0f3' },
  txnRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12 },
  txnDivider: { borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  txnDesc: { fontSize: 14, color: '#374151', fontWeight: '600' },
  txnDate: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  txnAmount: { fontSize: 16, fontWeight: '800' },
});
