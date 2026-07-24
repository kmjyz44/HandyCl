import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';

export default function TermsOfUse() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Head>
        <title>Terms of Use — Ono-Fix</title>
        <meta name="description" content="Read the Ono-Fix Terms of Use governing your access to and use of our AI-powered home services marketplace." />
        <link rel="canonical" href="https://ono-fix.com/terms" />
        <meta name="robots" content="index, follow" />
      </Head>
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
          By creating an account, accessing, or using Ono-Fix (the "Platform"), you agree to be bound by these Terms of Use ("Terms"), our Privacy Policy, and any additional policies referenced herein. If you do not agree, do not use the Platform.
        </Text>

        <Text style={styles.h2}>2. Eligibility</Text>
        <Text style={styles.p}>
          You must be at least 18 years old and a legal resident of the United States. By registering, you represent and warrant that you meet these requirements and that all information you provide is accurate, current, and complete.
        </Text>

        <Text style={styles.h2}>3. Description of Service</Text>
        <Text style={styles.p}>
          Ono-Fix is an online marketplace that connects individuals seeking home services ("Clients") with independent service providers ("Taskers" or "Providers"). Ono-Fix is not the employer of any Provider; Providers are independent contractors. Ono-Fix does not perform the services and is not responsible for the quality, safety, or legality of any service rendered.
        </Text>

        <Text style={styles.h2}>4. Account Registration & Security</Text>
        <Text style={styles.p}>
          You agree to (a) provide accurate registration information, (b) maintain the confidentiality of your password, and (c) accept responsibility for all activity under your account. Notify us immediately at <Text style={styles.link}>Nexus.ss.llc@gmail.com</Text> of any unauthorized use.
        </Text>

        <Text style={styles.h2}>5. Platform-Only Payment & Communication</Text>
        <Text style={styles.p}>
          <Text style={styles.bold}>You agree to conduct all payments and communications exclusively through the Ono-Fix platform.</Text> Off-platform payments (cash, wire transfer, peer-to-peer apps outside the Platform's integration, etc.) and off-platform communication (personal phone numbers, third-party messengers, email exchanged outside the in-app chat) are strictly prohibited. Violations may result in immediate account suspension or termination.
        </Text>
        <Text style={styles.p}>
          <Text style={styles.bold}>No phone contact outside the Platform.</Text> Clients and Providers may not share or request personal phone numbers, nor arrange phone calls, video calls, or messaging through any channel other than the in-app chat. All Client–Provider communication must remain inside the Platform so it can be recorded and used for safety and dispute-resolution purposes. Requesting to "take it off the app" is itself a violation of these Terms.
        </Text>
        <Text style={styles.p}>
          Ono-Fix does <Text style={styles.bold}>not guarantee the safety, quality, completion, or payment</Text> of any service that is arranged, communicated, or paid for outside the Platform. Our trust & safety, dispute resolution, refund, and insurance protections apply only to transactions completed through the Platform.
        </Text>

        <Text style={styles.h2}>6. SMS Communications</Text>
        <Text style={styles.p}>
          By providing your phone number and checking the consent box during registration, you agree to receive SMS messages from OnoFix for account verification and service-related notifications. Message frequency varies. Message and data rates may apply. Reply STOP to opt out. Reply HELP for assistance. OnoFix does not send marketing SMS without separate consent.
        </Text>

        <Text style={styles.h2}>7. Fees & Payments</Text>
        <Text style={styles.p}>
          Clients pay the agreed service price plus a Platform service fee (commission) that is added on top of the Provider's price. Providers receive their full set rate, less applicable Provider taxes. Tips are voluntary and 100% paid to the Provider. All payments are processed by our payment processors (Finix and other supported payment providers). By using the Platform, you authorize Ono-Fix to charge your payment method.
        </Text>
        <Text style={styles.p}>
          <Text style={styles.bold}>Minimum charge:</Text> Every job is billed for a minimum of one (1) hour of labor. A Provider may set a higher personal minimum (e.g., 1.5 or 2 hours), which is displayed on the Provider's profile before the Client confirms a booking. Work performed beyond the minimum is billed per minute at the Provider's hourly rate. Providers are <Text style={styles.bold}>required to clearly inform the Client of their minimum charge before starting any work</Text>. By confirming a booking, the Client acknowledges and agrees to the displayed minimum charge.
        </Text>

        <Text style={styles.h2}>8. Cancellation, Refunds & Dispute Evidence</Text>
        <Text style={styles.p}>
          After a booking is placed, the Client and Provider should use the in-app chat to discuss the task details (scope, timing, access, materials). <Text style={styles.bold}>Until the Provider confirms the job, either the Client or the Provider may cancel it free of charge</Text> — for example if the details cannot be agreed upon in chat.
        </Text>
        <Text style={styles.p}>
          Once the Provider has confirmed the job, cancellations made more than 24 hours before the scheduled service incur no fee. Cancellations within 24 hours may be subject to a cancellation fee. Refunds for disputed services are evaluated by Ono-Fix's support team on a case-by-case basis. See our Refund & Cancellation Policy for full details.
        </Text>
        <Text style={styles.p}>
          <Text style={styles.bold}>Before-and-After Photos (mandatory dispute evidence).</Text> For every job, the Provider is <Text style={styles.bold}>required</Text> to take clear photographs of the work area <Text style={styles.bold}>before starting</Text> and <Text style={styles.bold}>after completing</Text> the work, and to upload them to the Platform. These photos are the primary evidence used to resolve disputes. <Text style={styles.bold}>If the Provider fails to provide adequate before-and-after photos, any dispute regarding the scope, quality, or completion of the work will be resolved in favor of the Client</Text> (which may include a full or partial refund to the Client).
        </Text>

        <Text style={styles.h2}>9. Prohibited Conduct</Text>
        <Text style={styles.p}>
          You agree not to: (a) violate any law or regulation; (b) impersonate another person; (c) post false, misleading, or fraudulent content; (d) harass, abuse, or threaten other users; (e) circumvent the Platform's fee or communication systems; (f) use the Platform for any illegal purpose; (g) attempt to gain unauthorized access to the Platform.
        </Text>

        <Text style={styles.h2}>10. Reviews, Ratings & Provider Ranking</Text>
        <Text style={styles.p}>
          You may post reviews and content; you grant Ono-Fix a worldwide, royalty-free, perpetual license to use, display, and distribute such content on the Platform. Reviews must be truthful and based on actual experience.
        </Text>
        <Text style={styles.p}>
          <Text style={styles.bold}>How ranking is calculated.</Text> A Provider's position in the search results is determined by an <Text style={styles.bold}>experience-based score calculated separately for each service category</Text>. The score equals the total number of hours the Provider has <Text style={styles.bold}>actually worked in that category</Text> (from completed and paid jobs) plus an adjustment based on client reviews in that category:
        </Text>
        <Text style={styles.p}>
          • 5 stars: <Text style={styles.bold}>+5 hours</Text>{'\n'}
          • 4 stars: <Text style={styles.bold}>+3 hours</Text>{'\n'}
          • 3 stars: <Text style={styles.bold}>+1 hour</Text>{'\n'}
          • 2 stars: <Text style={styles.bold}>−1 hour</Text>{'\n'}
          • 1 star: <Text style={styles.bold}>−2 hours</Text>{'\n'}
          • A negative written review (1–2 stars with written feedback): an additional <Text style={styles.bold}>−5 hours</Text>
        </Text>
        <Text style={styles.p}>
          For example, an electrician with 100 worked hours ranks above one with 80 hours in the Electrical category. Scores may be negative. <Text style={styles.bold}>New Providers are featured at the top of the list for their first three (3) days</Text> after registration — even before they have any hours or reviews — so they have a fair chance to earn their first ratings. Ratings and rankings are informational, are updated automatically, may change at any time, and do not guarantee any Provider a booking.
        </Text>

        <Text style={styles.h2}>11. Independent Contractor Status</Text>
        <Text style={styles.p}>
          Providers are independent contractors. Nothing in these Terms creates an employer-employee, partnership, agency, joint venture, or franchise relationship between Ono-Fix and any user. Providers are responsible for their own taxes (IRS Form 1099-NEC may be issued for U.S. Providers earning ≥ $600/year).
        </Text>

        <Text style={styles.h2}>12. Disclaimers & Limitation of Liability</Text>
        <Text style={styles.p}>
          THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED BY LAW, ONO-FIX IS NOT LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES. OUR TOTAL LIABILITY SHALL NOT EXCEED THE GREATER OF (A) AMOUNTS YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM, OR (B) $100 USD.
        </Text>

        <Text style={styles.h2}>13. Indemnification</Text>
        <Text style={styles.p}>
          You agree to indemnify and hold Ono-Fix harmless from any claims, damages, liabilities, and expenses (including attorneys' fees) arising from your use of the Platform, violation of these Terms, or violation of any third-party rights.
        </Text>

        <Text style={styles.h2}>14. Dispute Resolution & Binding Arbitration</Text>
        <Text style={styles.p}>
          <Text style={styles.bold}>PLEASE READ CAREFULLY.</Text> Any dispute arising out of or relating to these Terms shall be resolved by binding individual arbitration administered by the American Arbitration Association (AAA) under its Consumer Arbitration Rules, in accordance with the Federal Arbitration Act. You and Ono-Fix waive the right to a jury trial and to participate in class actions. You may opt out by emailing <Text style={styles.link}>Nexus.ss.llc@gmail.com</Text> within 30 days of account creation.
        </Text>

        <Text style={styles.h2}>15. Governing Law</Text>
        <Text style={styles.p}>
          These Terms are governed by the laws of the State of Illinois, without regard to conflict-of-laws principles. Subject to Section 13, any litigation shall take place in the state or federal courts located in Cook County, Illinois.
        </Text>

        <Text style={styles.h2}>16. DMCA Notice</Text>
        <Text style={styles.p}>
          If you believe content on the Platform infringes your copyright, submit a notice under 17 U.S.C. § 512 to <Text style={styles.link}>Nexus.ss.llc@gmail.com</Text>.
        </Text>

        <Text style={styles.h2}>17. Termination</Text>
        <Text style={styles.p}>
          We may suspend or terminate your account at any time for violations of these Terms. You may delete your account at any time from Settings.
        </Text>

        <Text style={styles.h2}>18. Changes</Text>
        <Text style={styles.p}>
          We may update these Terms. Material changes will be notified via email and an in-app banner. Continued use after the effective date constitutes acceptance.
        </Text>

        <Text style={styles.h2}>19. Contact</Text>
        <Text style={styles.p}>
          Ono-Fix is a service operated by Nexus Security Solutions LLC, 9701 Dee Rd, Niles, IL 60714 · <Text style={styles.link}>Nexus.ss.llc@gmail.com</Text>
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
