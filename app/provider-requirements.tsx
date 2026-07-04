import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { SiteFooter } from '../components/SiteFooter';

const Req = ({ text }: { text: string }) => (
  <View style={styles.req}>
    <Ionicons name="checkmark-circle" size={18} color="#10b981" />
    <Text style={styles.reqText}>{text}</Text>
  </View>
);

export default function ProviderRequirementsPage() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Head>
        <title>Provider Requirements — Ono-Fix</title>
        <meta name="description" content="What you need to become an Ono-Fix professional: identity verification, skills, service area, payout setup and quality standards." />
        <link rel="canonical" href="https://ono-fix.com/provider-requirements" />
        <meta name="robots" content="index, follow" />
      </Head>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={24} color="#111827" /></TouchableOpacity>
        <Text style={styles.title}>Provider Requirements</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} data-testid="provider-requirements-screen">
        <Text style={styles.h1}>Become an Ono-Fix pro</Text>
        <Text style={styles.p}>To keep our marketplace safe and high-quality, every professional must meet these requirements:</Text>

        <Text style={styles.section}>To get started</Text>
        <Req text="Be at least 18 years old and legally eligible to work in the U.S." />
        <Req text="Verify your identity and phone number." />
        <Req text="Create a complete profile with your skills, experience and work photos." />
        <Req text="Set your hourly rate, minimum charge and service area." />
        <Req text="Set up a payout method to receive payments." />

        <Text style={styles.section}>Quality standards</Text>
        <Req text="Discuss and confirm task details with the client in the app chat before starting." />
        <Req text="Arrive on time and communicate promptly." />
        <Req text="Perform work professionally and safely, using appropriate tools." />
        <Req text="Keep all bookings, chat and payments on the Ono-Fix platform." />
        <Req text="Maintain a good rating — repeated low ratings or policy violations may lead to removal." />

        <Text style={styles.section}>Recommended</Text>
        <Req text="Relevant licenses/insurance for regulated trades (e.g., electrical, plumbing)." />
        <Req text="Before/after photos of completed work to build trust." />

        <TouchableOpacity style={styles.cta} onPress={() => router.push('/register' as any)} data-testid="pr-become-pro">
          <Text style={styles.ctaText}>Become a pro</Text>
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
  p: { fontSize: 14, color: '#4b5563', lineHeight: 22, paddingHorizontal: 20, marginTop: 8 },
  section: { fontSize: 15, fontWeight: '700', color: '#111827', paddingHorizontal: 20, marginTop: 24, marginBottom: 4 },
  req: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 20, marginTop: 10 },
  reqText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },
  cta: { marginHorizontal: 20, marginTop: 28, backgroundColor: '#2563eb', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
