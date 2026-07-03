import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { SiteFooter } from '../components/SiteFooter';

export default function PricingPage() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Head>
        <title>Pricing — Ono-Fix</title>
        <meta name="description" content="Transparent Ono-Fix pricing: pay your pro's hourly rate with a clear minimum charge, per-minute billing after the minimum, and no hidden fees." />
        <link rel="canonical" href="https://ono-fix.com/pricing" />
        <meta name="robots" content="index, follow" />
      </Head>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Pricing</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} data-testid="pricing-screen">
        <Text style={styles.h1}>Simple, transparent pricing</Text>
        <Text style={styles.p}>
          You pay your professional's hourly rate plus a small platform service fee. No subscriptions,
          no hidden charges — you see the price before you book.
        </Text>

        <Card icon="time" title="Minimum 1 hour">
          Every job is billed for a minimum of 1 hour. Some pros set a higher minimum (1.5 or 2 hours),
          which is always shown on their profile before you confirm.
        </Card>
        <Card icon="timer-outline" title="Per-minute after the minimum">
          Once the minimum is reached, additional time is billed per minute at the pro's hourly rate —
          you only pay for the time actually worked.
        </Card>
        <Card icon="cube-outline" title="Materials & extras">
          Any materials the pro buys for your job are added transparently to the final invoice.
        </Card>
        <Card icon="card-outline" title="Platform service fee">
          A service fee (commission) is added on top of the pro's price. Your pro always receives their
          full set rate.
        </Card>
        <Card icon="heart-outline" title="Tips are optional">
          Tips are 100% optional and go entirely to your professional.
        </Card>

        <View style={styles.example}>
          <Text style={styles.exampleTitle}>Example</Text>
          <Text style={styles.exampleText}>
            A pro charges $25/hr with a 1-hour minimum. If the job takes 40 minutes, you're billed for
            the full hour ($25). If it takes 1 hr 30 min, you pay $37.50 (1.5 hrs, billed per minute
            after the first hour), plus any materials and the platform service fee.
          </Text>
        </View>

        <TouchableOpacity style={styles.cta} onPress={() => router.push('/(tabs)' as any)} data-testid="pricing-cta">
          <Text style={styles.ctaText}>Book a pro now</Text>
        </TouchableOpacity>

        <SiteFooter />
      </ScrollView>
    </View>
  );
}

const Card = ({ icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
  <View style={styles.card}>
    <View style={styles.cardHead}>
      <View style={styles.cardIcon}><Ionicons name={icon} size={18} color="#2563eb" /></View>
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
    <Text style={styles.cardBody}>{children}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  back: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  content: { paddingBottom: 0 },
  h1: { fontSize: 24, fontWeight: '800', color: '#111827', paddingHorizontal: 20, paddingTop: 24 },
  p: { fontSize: 14, color: '#4b5563', lineHeight: 22, paddingHorizontal: 20, marginTop: 8, marginBottom: 8 },
  card: { marginHorizontal: 20, marginTop: 12, padding: 16, backgroundColor: '#f9fafb', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardBody: { fontSize: 13, color: '#4b5563', lineHeight: 20, marginTop: 10 },
  example: { margin: 20, padding: 16, backgroundColor: '#eff6ff', borderRadius: 14, borderWidth: 1, borderColor: '#bfdbfe' },
  exampleTitle: { fontSize: 13, fontWeight: '800', color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: 0.5 },
  exampleText: { fontSize: 13, color: '#1e40af', lineHeight: 20, marginTop: 8 },
  cta: { marginHorizontal: 20, backgroundColor: '#2563eb', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
