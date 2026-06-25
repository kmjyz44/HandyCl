import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function TermsOfUse() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Terms of Use</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} data-testid="terms-screen">
        <Text style={styles.meta}>Effective Date: February 15, 2026 · Last Updated: February 15, 2026</Text>

        <Text style={styles.h2}>1. Acceptance of Terms</Text>
        <Text style={styles.p}>
          By creating an account, accessing, or using HandyHub (the "Platform"), you agree to be bound by these Terms of Use ("Terms"), our Privacy Policy, and any additional policies referenced herein. If you do not agree, do not use the Platform.
        </Text>

        <Text style={styles.h2}>2. Eligibility</Text>
        <Text style={styles.p}>
          You must be at least 18 years old and a legal resident of the United States. By registering, you represent and warrant that you meet these requirements and that all information you provide is accurate, current, and complete.
        </Text>

        <Text style={styles.h2}>3. Description of Service</Text>
        <Text style={styles.p}>
          HandyHub is an online marketplace that connects individuals seeking home services ("Clients") with independent service providers ("Taskers" or "Providers"). HandyHub is not the employer of any Provider; Providers are independent contractors. HandyHub does not perform the services and is not responsible for the quality, safety, or legality of any service rendered.
        </Text>

        <Text style={styles.h2}>4. Account Registration & Security</Text>
        <Text style={styles.p}>
          You agree to (a) provide accurate registration information, (b) maintain the confidentiality of your password, and (c) accept responsibility for all activity under your account. Notify us immediately at <Text style={styles.link}>support@handyhub.com</Text> of any unauthorized use.
        </Text>

        <Text style={styles.h2}>5. Platform-Only Payment & Communication</Text>
        <Text style={styles.p}>
          <Text style={styles.bold}>You agree to conduct all payments and communications exclusively through the HandyHub platform.</Text> Off-platform payments (cash, wire transfer, peer-to-peer apps outside the Platform's integration, etc.) and off-platform communication (personal phone numbers, third-party messengers, email exchanged outside the in-app chat) are strictly prohibited. Violations may result in immediate account suspension or termination.
        </Text>
        <Text style={styles.p}>
          HandyHub does <Text style={styles.bold}>not guarantee the safety, quality, completion, or payment</Text> of any service that is arranged, communicated, or paid for outside the Platform. Our trust & safety, dispute resolution, refund, and insurance protections apply only to transactions completed through the Platform.
        </Text>

        <Text style={styles.h2}>6. Fees & Payments</Text>
        <Text style={styles.p}>
          Clients pay the agreed service price plus a Platform service fee (commission) that is added on top of the Provider's price. Providers receive their full set rate, less applicable Provider taxes. Tips are voluntary and 100% paid to the Provider. All payments are processed by our payment processors (Stripe, etc.). By using the Platform, you authorize HandyHub to charge your payment method.
        </Text>

        <Text style={styles.h2}>7. Cancellation & Refunds</Text>
        <Text style={styles.p}>
          Cancellations made more than 24 hours before the scheduled service incur no fee. Cancellations within 24 hours may be subject to a cancellation fee. Refunds for disputed services are evaluated by HandyHub's support team on a case-by-case basis.
        </Text>

        <Text style={styles.h2}>8. Prohibited Conduct</Text>
        <Text style={styles.p}>
          You agree not to: (a) violate any law or regulation; (b) impersonate another person; (c) post false, misleading, or fraudulent content; (d) harass, abuse, or threaten other users; (e) circumvent the Platform's fee or communication systems; (f) use the Platform for any illegal purpose; (g) attempt to gain unauthorized access to the Platform.
        </Text>

        <Text style={styles.h2}>9. Reviews & Content</Text>
        <Text style={styles.p}>
          You may post reviews and content; you grant HandyHub a worldwide, royalty-free, perpetual license to use, display, and distribute such content on the Platform. Reviews must be truthful and based on actual experience.
        </Text>

        <Text style={styles.h2}>10. Independent Contractor Status</Text>
        <Text style={styles.p}>
          Providers are independent contractors. Nothing in these Terms creates an employer-employee, partnership, agency, joint venture, or franchise relationship between HandyHub and any user. Providers are responsible for their own taxes (IRS Form 1099-NEC may be issued for U.S. Providers earning ≥ $600/year).
        </Text>

        <Text style={styles.h2}>11. Disclaimers & Limitation of Liability</Text>
        <Text style={styles.p}>
          THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED BY LAW, HANDYHUB IS NOT LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES. OUR TOTAL LIABILITY SHALL NOT EXCEED THE GREATER OF (A) AMOUNTS YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM, OR (B) $100 USD.
        </Text>

        <Text style={styles.h2}>12. Indemnification</Text>
        <Text style={styles.p}>
          You agree to indemnify and hold HandyHub harmless from any claims, damages, liabilities, and expenses (including attorneys' fees) arising from your use of the Platform, violation of these Terms, or violation of any third-party rights.
        </Text>

        <Text style={styles.h2}>13. Dispute Resolution & Binding Arbitration</Text>
        <Text style={styles.p}>
          <Text style={styles.bold}>PLEASE READ CAREFULLY.</Text> Any dispute arising out of or relating to these Terms shall be resolved by binding individual arbitration administered by the American Arbitration Association (AAA) under its Consumer Arbitration Rules, in accordance with the Federal Arbitration Act. You and HandyHub waive the right to a jury trial and to participate in class actions. You may opt out by emailing <Text style={styles.link}>legal@handyhub.com</Text> within 30 days of account creation.
        </Text>

        <Text style={styles.h2}>14. Governing Law</Text>
        <Text style={styles.p}>
          These Terms are governed by the laws of the State of Delaware, without regard to conflict-of-laws principles. Subject to Section 13, any litigation shall take place in the state or federal courts located in New Castle County, Delaware.
        </Text>

        <Text style={styles.h2}>15. DMCA Notice</Text>
        <Text style={styles.p}>
          If you believe content on the Platform infringes your copyright, submit a notice under 17 U.S.C. § 512 to <Text style={styles.link}>dmca@handyhub.com</Text>.
        </Text>

        <Text style={styles.h2}>16. Termination</Text>
        <Text style={styles.p}>
          We may suspend or terminate your account at any time for violations of these Terms. You may delete your account at any time from Settings.
        </Text>

        <Text style={styles.h2}>17. Changes</Text>
        <Text style={styles.p}>
          We may update these Terms. Material changes will be notified via email and an in-app banner. Continued use after the effective date constitutes acceptance.
        </Text>

        <Text style={styles.h2}>18. Contact</Text>
        <Text style={styles.p}>
          HandyHub Inc., 1209 Orange Street, Wilmington, DE 19801 · <Text style={styles.link}>support@handyhub.com</Text>
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
