import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { SiteFooter } from '../components/SiteFooter';

const Item = ({ icon, title, body }: { icon: any; title: string; body: string }) => (
  <View style={styles.item}>
    <View style={styles.itemIcon}><Ionicons name={icon} size={18} color="#2563eb" /></View>
    <View style={{ flex: 1 }}>
      <Text style={styles.itemTitle}>{title}</Text>
      <Text style={styles.itemBody}>{body}</Text>
    </View>
  </View>
);

export default function SafetyPage() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Head>
        <title>Safety & Trust — Ono-Fix</title>
        <meta name="description" content="How Ono-Fix keeps clients and professionals safe: vetted pros, secure in-app payments, in-app chat, ratings and dedicated support." />
        <link rel="canonical" href="https://ono-fix.com/safety" />
        <meta name="robots" content="index, follow" />
      </Head>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={24} color="#111827" /></TouchableOpacity>
        <Text style={styles.title}>Safety & Trust</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} data-testid="safety-screen">
        <Text style={styles.h1}>Your safety comes first</Text>
        <Text style={styles.p}>We built Ono-Fix so both clients and professionals can transact with confidence.</Text>
        <Item icon="shield-checkmark" title="Vetted professionals" body="Providers complete identity verification and profile review before they can accept jobs." />
        <Item icon="lock-closed" title="Secure in-app payments" body="All payments are processed securely through our payment provider. We never store your full card details." />
        <Item icon="chatbubbles" title="In-app chat" body="Discuss every task in the app before it starts. Keep communication and records on-platform for your protection." />
        <Item icon="star" title="Ratings & reviews" body="Every job can be rated. Real reviews help you choose the right pro and keep quality high." />
        <Item icon="alert-circle" title="Report & support" body="Something not right? Our support team reviews reports and disputes and can step in when needed." />
        <Item icon="card" title="On-platform only" body="For your safety, keep bookings, chat and payments on Ono-Fix. Off-platform deals aren't covered by our protections." />
        <View style={styles.tip}>
          <Text style={styles.tipText}>Safety tips: confirm the scope in chat, be present during the visit when possible, and never share payment details outside the app.</Text>
        </View>
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
  p: { fontSize: 14, color: '#4b5563', lineHeight: 22, paddingHorizontal: 20, marginTop: 8, marginBottom: 8 },
  item: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 16 },
  itemIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  itemBody: { fontSize: 13, color: '#4b5563', lineHeight: 20, marginTop: 3 },
  tip: { margin: 20, padding: 16, backgroundColor: '#ecfdf5', borderRadius: 14, borderWidth: 1, borderColor: '#a7f3d0' },
  tipText: { fontSize: 13, color: '#047857', lineHeight: 20 },
});
