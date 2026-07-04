import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { SiteFooter } from '../components/SiteFooter';

export default function RefundPolicyPage() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Head>
        <title>Refund & Cancellation Policy — Ono-Fix</title>
        <meta name="description" content="Ono-Fix refund and cancellation policy: free cancellation before the provider confirms, 24-hour rule after confirmation, and how refunds are handled." />
        <link rel="canonical" href="https://ono-fix.com/refund-policy" />
        <meta name="robots" content="index, follow" />
      </Head>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={24} color="#111827" /></TouchableOpacity>
        <Text style={styles.title}>Refund & Cancellation</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} data-testid="refund-policy-screen">
        <Text style={styles.h1}>Refund & Cancellation Policy</Text>

        <Text style={styles.h2}>Before the provider confirms</Text>
        <Text style={styles.p}>
          After you place a booking, you and the provider discuss the details in the in-app chat. Until the provider confirms the job, <Text style={styles.bold}>either party can cancel it free of charge</Text> — no fee, no penalty.
        </Text>

        <Text style={styles.h2}>After the provider confirms</Text>
        <Text style={styles.p}>
          • Cancel more than 24 hours before the scheduled time: no fee.{'\n'}
          • Cancel within 24 hours of the scheduled time: a cancellation fee may apply to cover the provider's reserved time.{'\n'}
          • No-shows may be charged in full.
        </Text>

        <Text style={styles.h2}>Refunds</Text>
        <Text style={styles.p}>
          If a completed service was not as agreed, open a dispute through the app or contact support within 7 days. Our support team reviews each case individually (chat history, photos, and job details) and may issue a full or partial refund. Approved refunds are returned to your original payment method, typically within 5–10 business days.
        </Text>

        <Text style={styles.h2}>Tips & platform fees</Text>
        <Text style={styles.p}>
          Tips are voluntary and non-refundable once a job is completed. The platform service fee may be refunded together with an approved refund.
        </Text>

        <TouchableOpacity style={styles.link} onPress={() => router.push('/help-center' as any)} data-testid="refund-contact">
          <Ionicons name="chatbubbles-outline" size={18} color="#2563eb" />
          <Text style={styles.linkText}>Contact support about a refund</Text>
        </TouchableOpacity>
        <SiteFooter />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  back: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  content: { paddingBottom: 0 },
  h1: { fontSize: 24, fontWeight: '800', color: '#111827', paddingHorizontal: 20, paddingTop: 24 },
  h2: { fontSize: 16, fontWeight: '700', color: '#111827', paddingHorizontal: 20, marginTop: 22, marginBottom: 4 },
  p: { fontSize: 14, color: '#4b5563', lineHeight: 22, paddingHorizontal: 20, marginTop: 6 },
  bold: { fontWeight: '700', color: '#111827' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginTop: 24 },
  linkText: { color: '#2563eb', fontSize: 14, fontWeight: '700' },
});
