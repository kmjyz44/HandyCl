import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { ONBOARDING_STEPS } from '../utils/onboardingSteps';

export default function ProviderOnboarding() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [completed, setCompleted] = useState(0);
  const [total, setTotal] = useState(ONBOARDING_STEPS.length);
  const [loading, setLoading] = useState(true);

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
      } catch {
        // ignore
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useFocusEffect(fetchStatus);

  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const allDone = completed >= total;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} data-testid="provider-onboarding-screen">
        <View style={styles.hero}>
          <View style={styles.logo}><Ionicons name="rocket-outline" size={30} color="#2563eb" /></View>
          <Text style={styles.h1}>Welcome, {user?.name?.split(' ')[0] || 'Pro'}!</Text>
          <Text style={styles.lead}>
            Let's get your account ready. Finish these steps so clients can find you and you can start accepting jobs.
          </Text>
        </View>

        <View style={styles.progressWrap}>
          <View style={styles.progressTop}>
            <Text style={styles.progressLabel}>Your setup</Text>
            <Text style={styles.progressCount}>{completed}/{total}</Text>
          </View>
          <View style={styles.track}><View style={[styles.fill, { width: `${pct}%` }]} /></View>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 30 }} size="large" color="#2563eb" />
        ) : (
          ONBOARDING_STEPS.map((st, i) => {
            const done = !!status[st.key];
            return (
              <TouchableOpacity
                key={st.key}
                style={[styles.step, done && styles.stepDone]}
                onPress={() => router.push(st.route as any)}
                activeOpacity={0.7}
                data-testid={`onboarding-step-${st.key}`}
              >
                <View style={[styles.stepIcon, { backgroundColor: done ? '#ecfdf5' : st.color + '18' }]}>
                  {done
                    ? <Ionicons name="checkmark" size={22} color="#059669" />
                    : <Ionicons name={st.icon as any} size={22} color={st.color} />}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.stepTitleRow}>
                    <Text style={styles.stepNum}>{i + 1}.</Text>
                    <Text style={styles.stepTitle}>{st.title}</Text>
                    {done && <View style={styles.doneChip}><Text style={styles.doneChipText}>Done</Text></View>}
                  </View>
                  <Text style={styles.stepDesc}>{st.desc}</Text>
                  {st.note && <Text style={styles.stepNote}>ⓘ {st.note}</Text>}
                  {!done && (
                    <View style={styles.stepCta}>
                      <Text style={[styles.stepCtaText, { color: st.color }]}>Set up now</Text>
                      <Ionicons name="arrow-forward" size={14} color={st.color} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <TouchableOpacity
          style={[styles.finishBtn, allDone && styles.finishBtnDone]}
          onPress={() => router.replace('/(tabs)' as any)}
          data-testid="onboarding-go-dashboard"
        >
          <Text style={styles.finishText}>{allDone ? "You're all set — go to dashboard" : 'Go to dashboard'}</Text>
        </TouchableOpacity>
        {!allDone && (
          <Text style={styles.skipNote}>You can finish the remaining steps anytime from your home screen.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 20, paddingTop: 56, paddingBottom: 60 },
  hero: { alignItems: 'center', marginBottom: 20 },
  logo: { width: 64, height: 64, borderRadius: 18, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  h1: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8, textAlign: 'center' },
  lead: { fontSize: 14, color: '#4b5563', lineHeight: 21, textAlign: 'center' },
  progressWrap: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  progressCount: { fontSize: 14, fontWeight: '800', color: '#2563eb' },
  track: { height: 8, backgroundColor: '#f3f4f6', borderRadius: 999, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: '#2563eb', borderRadius: 999 },
  step: { flexDirection: 'row', gap: 14, backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  stepDone: { opacity: 0.72, borderColor: '#a7f3d0', backgroundColor: '#f7fefb' },
  stepIcon: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' },
  stepNum: { fontSize: 15, fontWeight: '800', color: '#6b7280' },
  stepTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  doneChip: { backgroundColor: '#ecfdf5', borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 },
  doneChipText: { fontSize: 11, fontWeight: '700', color: '#059669' },
  stepDesc: { fontSize: 13, color: '#6b7280', lineHeight: 19 },
  stepNote: { fontSize: 12, color: '#b45309', marginTop: 4 },
  stepCta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  stepCtaText: { fontSize: 14, fontWeight: '700' },
  finishBtn: { backgroundColor: '#111827', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  finishBtnDone: { backgroundColor: '#059669' },
  finishText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  skipNote: { fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 12 },
});
