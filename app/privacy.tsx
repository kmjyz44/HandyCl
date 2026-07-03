import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';

export default function PrivacyPolicy() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Head>
        <title>Privacy Policy — Ono-Fix</title>
        <meta name="description" content="Learn how Ono-Fix collects, uses, and protects your personal information across our AI-powered home services platform." />
        <link rel="canonical" href="https://ono-fix.com/privacy" />
        <meta name="robots" content="index, follow" />
      </Head>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Privacy Policy</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} data-testid="privacy-screen">
        <Text style={styles.meta}>Effective Date: February 15, 2026 · Last Updated: February 15, 2026</Text>

        <Text style={styles.p}>
          Nexus Security Solutions LLC, operator of Ono-Fix ("we", "us", "our"), respects your privacy. This Privacy Policy explains how we collect, use, share, and protect your personal information when you use the Ono-Fix Platform.
        </Text>

        <Text style={styles.h2}>1. Information We Collect</Text>
        <Text style={styles.p}>
          <Text style={styles.bold}>a) Information you provide:</Text> name, email, phone number, password, profile photo, payment details, ID for verification, location, reviews, in-app messages.{'\n'}
          <Text style={styles.bold}>b) Information collected automatically:</Text> device info, IP address, browser type, OS, app version, usage logs, approximate geolocation.{'\n'}
          <Text style={styles.bold}>c) From third parties:</Text> identity verification providers, payment processors (Finix and other supported payment providers), and background-check services (for Providers).
        </Text>

        <Text style={styles.h2}>2. How We Use Information</Text>
        <Text style={styles.p}>
          We use information to: (a) provide and improve the Platform; (b) verify your identity; (c) process payments; (d) match Clients with Providers in your area; (e) communicate with you about bookings, support requests, and platform updates; (f) prevent fraud; (g) comply with legal obligations.
        </Text>

        <Text style={styles.h2}>3. Sharing of Information</Text>
        <Text style={styles.p}>
          We share information with: (a) other users as needed to facilitate a booking (e.g., Provider sees Client's name & address after acceptance); (b) payment processors (Finix and other supported payment providers); (c) SMS/email service providers (Twilio and Resend); (d) law enforcement when legally required; (e) service providers acting on our behalf under confidentiality obligations. We do <Text style={styles.bold}>not</Text> sell your personal information to third parties.
        </Text>

        <Text style={styles.h2}>4. Communications & TCPA Consent</Text>
        <Text style={styles.p}>
          By providing your phone number, both Clients and Providers agree: <Text style={styles.bold}>"I agree to receive SMS verification messages from OnoFix. Message and data rates may apply. Reply STOP to opt out and HELP for help."</Text>{'\n\n'}
          SMS messages are sent only for account verification and service-related notifications requested by the user. We do not send promotional or marketing SMS without separate consent. Standard message and data rates apply. You may opt out at any time by replying STOP, or reply HELP for assistance. Email communications can be unsubscribed via the link in any email or by emailing <Text style={styles.link}>Nexus.ss.llc@gmail.com</Text>.
        </Text>

        <Text style={styles.h2}>5. Cookies & Analytics</Text>
        <Text style={styles.p}>
          We use cookies and similar technologies to keep you signed in, remember preferences, and measure usage. You can disable cookies in your browser, but the Platform may not function correctly.
        </Text>

        <Text style={styles.h2}>6. Your California Privacy Rights (CCPA/CPRA)</Text>
        <Text style={styles.p}>
          If you are a California resident, you have the right to: (a) know what personal information we collect about you; (b) request a copy or deletion of your data; (c) opt out of the "sale" or "sharing" of personal information (we do not sell); (d) limit the use of sensitive personal information; (e) be free from retaliation for exercising your rights. To exercise these rights, email <Text style={styles.link}>Nexus.ss.llc@gmail.com</Text>.
        </Text>

        <Text style={styles.h2}>7. Your Rights in Other U.S. States</Text>
        <Text style={styles.p}>
          Residents of Virginia, Colorado, Connecticut, Utah, and similar states with comprehensive privacy laws have analogous rights of access, correction, deletion, and portability. Contact us to exercise them.
        </Text>

        <Text style={styles.h2}>8. Data Retention</Text>
        <Text style={styles.p}>
          We retain personal information as long as your account is active and as needed to provide the Platform, comply with legal obligations, resolve disputes, and enforce our agreements. After account deletion, residual data may be retained in encrypted backups for up to 90 days.
        </Text>

        <Text style={styles.h2}>9. Security</Text>
        <Text style={styles.p}>
          We implement industry-standard administrative, technical, and physical safeguards. However, no system is 100% secure; we cannot guarantee absolute security.
        </Text>

        <Text style={styles.h2}>10. Children</Text>
        <Text style={styles.p}>
          The Platform is not directed to children under 18. We do not knowingly collect data from children under 13 (COPPA). If we learn we have collected data from a child under 13, we will delete it.
        </Text>

        <Text style={styles.h2}>11. International Users</Text>
        <Text style={styles.p}>
          The Platform is hosted in the United States. If you access from outside the U.S., your information will be transferred to and processed in the U.S.
        </Text>

        <Text style={styles.h2}>12. Changes</Text>
        <Text style={styles.p}>
          We may update this Privacy Policy. Material changes will be notified via email and an in-app banner.
        </Text>

        <Text style={styles.h2}>13. Contact</Text>
        <Text style={styles.p}>
          OnoFix is operated by{'\n\n'}
          <Text style={styles.bold}>Nexus Security Solutions LLC</Text>{'\n\n'}
          9701 Dee Rd{'\n'}
          Niles, IL 60714{'\n\n'}
          Email:{'\n'}
          <Text style={styles.link}>Nexus.ss.llc@gmail.com</Text>{'\n'}
          <Text style={styles.link}>finscan@finscan.store</Text>{'\n\n'}
          Website:{'\n'}
          <Text style={styles.link}>https://ono-fix.com</Text>
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  back: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  content: { padding: 20 },
  meta: { fontSize: 12, color: '#6b7280', marginBottom: 16 },
  h2: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 16, marginBottom: 8 },
  p: { fontSize: 14, color: '#374151', lineHeight: 22, marginBottom: 4 },
  bold: { fontWeight: '700', color: '#111827' },
  link: { color: '#2563eb', textDecorationLine: 'underline' },
});
