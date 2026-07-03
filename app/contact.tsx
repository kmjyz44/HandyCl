import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { SiteFooter } from '../components/SiteFooter';
import { COMPANY } from '../constants/company';

export default function ContactPage() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Head>
        <title>Contact Us — Ono-Fix</title>
        <meta name="description" content="Get in touch with Ono-Fix, operated by Nexus Security Solutions LLC. Email, phone and mailing address for support and business inquiries." />
        <link rel="canonical" href="https://ono-fix.com/contact" />
        <meta name="robots" content="index, follow" />
      </Head>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Contact Us</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} data-testid="contact-screen">
        <Text style={styles.intro}>
          We're here to help. Reach out with any questions about bookings, payments, or becoming a pro.
        </Text>

        <View style={styles.card}>
          <Row icon="business" label="Company" value={COMPANY.legalName} />
          <Row icon="person" label="Owner" value={COMPANY.owner} />
          <Row icon="location" label="Address" value={COMPANY.address} />
          {COMPANY.emails.map((e) => (
            <TouchableOpacity key={e} style={styles.row} onPress={() => Linking.openURL(`mailto:${e}`)} data-testid={`contact-email-${e}`}>
              <View style={styles.rowIcon}><Ionicons name="mail" size={16} color="#2563eb" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Email</Text>
                <Text style={styles.rowLink}>{e}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.helpBtn} onPress={() => router.push('/help-center' as any)} data-testid="contact-open-help">
          <Ionicons name="chatbubbles-outline" size={18} color="#fff" />
          <Text style={styles.helpBtnText}>Send us a message (Help Center)</Text>
        </TouchableOpacity>

        <SiteFooter />
      </ScrollView>
    </View>
  );
}

const Row = ({ icon, label, value }: { icon: any; label: string; value: string }) => (
  <View style={styles.row}>
    <View style={styles.rowIcon}><Ionicons name={icon} size={16} color="#2563eb" /></View>
    <View style={{ flex: 1 }}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  back: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  content: { paddingBottom: 0 },
  intro: { fontSize: 14, color: '#4b5563', lineHeight: 22, padding: 20 },
  card: { marginHorizontal: 20, padding: 8, backgroundColor: '#f9fafb', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase' },
  rowValue: { fontSize: 14, color: '#111827', fontWeight: '600', marginTop: 2 },
  rowLink: { fontSize: 14, color: '#2563eb', fontWeight: '600', marginTop: 2 },
  helpBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 20, marginTop: 24, backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 12 },
  helpBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
