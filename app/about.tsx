import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { SiteFooter } from '../components/SiteFooter';
import { COMPANY } from '../constants/company';

export default function AboutPage() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Head>
        <title>About Ono-Fix — AI-Powered Home Services</title>
        <meta name="description" content="Ono-Fix is a photo-first home services marketplace, owned and operated by Nexus Security Solutions LLC. Snap a photo, get matched with a trusted local pro." />
        <link rel="canonical" href="https://ono-fix.com/about" />
        <meta name="robots" content="index, follow" />
      </Head>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>About Ono-Fix</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} data-testid="about-screen">
        <Text style={styles.h1}>One Photo. One Solution.</Text>
        <Text style={styles.p}>
          Ono-Fix is a modern, photo-first home services marketplace. Instead of guessing which pro
          you need, you simply snap a photo of the problem — our AI identifies the issue, estimates
          the work, and instantly matches you with a trusted local professional.
        </Text>

        <Text style={styles.h2}>Our mission</Text>
        <Text style={styles.p}>
          We make fixing your home effortless. From plumbing and electrical to furniture assembly and
          cleaning, Ono-Fix connects homeowners with vetted independent pros — with transparent
          pricing, secure payments, and no back-and-forth.
        </Text>

        <Text style={styles.h2}>Why Ono-Fix</Text>
        <View style={styles.bullets}>
          <Bullet icon="camera" text="Photo-first booking — no long forms, just a picture." />
          <Bullet icon="sparkles" text="AI understands the job and matches the right pro." />
          <Bullet icon="shield-checkmark" text="Vetted professionals and secure, in-app payments." />
          <Bullet icon="pricetag" text="Transparent pricing with a clear minimum charge." />
        </View>

        <View style={styles.companyCard}>
          <Text style={styles.companyTitle}>Who operates Ono-Fix</Text>
          <Text style={styles.p}>
            {COMPANY.brand} is owned and operated by <Text style={styles.bold}>{COMPANY.legalName}</Text>.
          </Text>
          <Text style={styles.smsNote}>
            SMS messages are used only for account verification and service-related notifications requested by users. Ono-Fix does not send marketing SMS without separate consent.
          </Text>
          <TouchableOpacity style={styles.link} onPress={() => router.push('/contact' as any)} data-testid="about-contact-link">
            <Ionicons name="mail-outline" size={16} color="#2563eb" />
            <Text style={styles.linkText}>Contact us</Text>
          </TouchableOpacity>
        </View>

        <SiteFooter />
      </ScrollView>
    </View>
  );
}

const Bullet = ({ icon, text }: { icon: any; text: string }) => (
  <View style={styles.bulletRow}>
    <View style={styles.bulletIcon}><Ionicons name={icon} size={16} color="#2563eb" /></View>
    <Text style={styles.bulletText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  back: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  content: { paddingBottom: 0 },
  h1: { fontSize: 26, fontWeight: '800', color: '#111827', paddingHorizontal: 20, paddingTop: 24 },
  h2: { fontSize: 17, fontWeight: '700', color: '#111827', paddingHorizontal: 20, marginTop: 22, marginBottom: 8 },
  p: { fontSize: 14, color: '#4b5563', lineHeight: 22, paddingHorizontal: 20, marginTop: 8 },
  bold: { fontWeight: '700', color: '#111827' },
  bullets: { paddingHorizontal: 20, marginTop: 8 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12 },
  bulletIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  bulletText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },
  companyCard: { margin: 20, marginTop: 28, padding: 16, backgroundColor: '#f9fafb', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb' },
  companyTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  linkText: { color: '#2563eb', fontSize: 14, fontWeight: '700' },
  smsNote: { fontSize: 12, color: '#6b7280', lineHeight: 18, marginTop: 10 },
});
