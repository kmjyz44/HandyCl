import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../utils/api';
import { ONBOARDING_STEPS } from '../utils/onboardingSteps';

// Compact "Get set up" checklist shown on the provider home until every step is done.
export default function ProviderOnboardingCard() {
  const router = useRouter();
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [completed, setCompleted] = useState(0);
  const [total, setTotal] = useState(ONBOARDING_STEPS.length);
  const [complete, setComplete] = useState<boolean | null>(null);

  const fetchStatus = useCallback(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.getOnboardingStatus();
        if (!alive) return;
        const map: Record<string, boolean> = {};
        (r.steps || []).forEach((s: any) => { map[s.key] = !!s.done; });
        setStatus(map);
        setCompleted(r.completed || 0);
        setTotal(r.total || ONBOARDING_STEPS.length);
        setComplete(!!r.complete);
      } catch {
        setComplete(true); // fail closed = hide the card
      }
    })();
    return () => { alive = false; };
  }, []);

  useFocusEffect(fetchStatus);

  if (complete === null || complete === true) return null;

  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const nextStep = ONBOARDING_STEPS.find(s => !status[s.key]);

  return (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.9}
      onPress={() => router.push('/provider-onboarding' as any)}
      data-testid="provider-onboarding-card"
    >
      <View style={s.head}>
        <View style={s.rocket}><Ionicons name="rocket-outline" size={18} color="#2563eb" /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Finish setting up your account</Text>
          <Text style={s.sub}>{completed} of {total} done · tap to see all steps</Text>
        </View>
        <View style={s.pctBadge}><Text style={s.pctText}>{pct}%</Text></View>
      </View>

      <View style={s.track}><View style={[s.fill, { width: `${pct}%` }]} /></View>

      {nextStep && (
        <TouchableOpacity
          style={s.cta}
          onPress={() => router.push(nextStep.route as any)}
          data-testid="onboarding-card-continue"
        >
          <Ionicons name={nextStep.icon as any} size={16} color="#fff" />
          <Text style={s.ctaText}>Next: {nextStep.title}</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  rocket: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800', color: '#111827' },
  sub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  pctBadge: { backgroundColor: '#eff6ff', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 },
  pctText: { color: '#2563eb', fontWeight: '800', fontSize: 13 },
  track: { height: 6, backgroundColor: '#f3f4f6', borderRadius: 999, overflow: 'hidden', marginBottom: 12 },
  fill: { height: 6, backgroundColor: '#2563eb', borderRadius: 999 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 11 },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
