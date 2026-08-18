import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';

const EFFECTIVE_DATE = 'June 1, 2026';
const VERSION = '1.0';

type Para = string | { bullets: string[] };
type Section = { title: string; body: Para[] };

const SECTIONS: Section[] = [
  { title: '1. Purpose of the Agreement', body: [
    'Ono-Fix operates a technology marketplace that facilitates connections between customers seeking home and property services and independent service providers offering such services.',
    'The Service Provider wishes to use the Ono-Fix Platform to receive, review, accept, and perform service opportunities from customers.',
    'This Agreement establishes the terms governing the relationship between Ono-Fix and the Service Provider. This Agreement does not constitute an employment agreement.',
  ]},
  { title: '2. Independent Service Provider', body: [
    'To the extent permitted by applicable law, the Service Provider operates an independently established business and provides services as an independent contractor. The Service Provider is not an employee, agent, partner, joint venturer, franchisee, or legal representative of Ono-Fix.',
    'Nothing in this Agreement authorizes the Service Provider to:',
    { bullets: ['enter into contracts on behalf of Ono-Fix;', 'incur obligations on behalf of Ono-Fix;', 'represent that the Service Provider is an employee of Ono-Fix;', 'make warranties or promises on behalf of Ono-Fix;', 'bind Ono-Fix to any obligation.'] },
    'The Service Provider determines the manner and means of performing accepted services, subject to the agreed result, customer requirements, applicable law, safety requirements, and the applicable Job Service Agreement. Actual worker classification is determined under applicable law.',
  ]},
  { title: "3. Service Provider's Independent Business", body: [
    'The Service Provider represents that the Service Provider:',
    { bullets: ['operates or intends to operate an independently established business;', 'is free to provide services to other customers and platforms;', 'may accept or decline service opportunities offered through Ono-Fix;', 'controls the manner and means of performing accepted work, subject to applicable law and the agreed scope and result;', 'supplies the ordinary tools and equipment necessary to perform the services;', 'bears ordinary business expenses associated with operating the business;', 'is responsible for applicable federal, state, and local taxes;', 'may advertise or provide services to the general public independently of Ono-Fix;', 'is responsible for maintaining any business registrations, licenses, permits, certifications, and insurance required for the services offered.'] },
    'Nothing in this Agreement requires the Service Provider to accept a minimum number of jobs or work a minimum schedule.',
  ]},
  { title: '4. No Guarantee of Work', body: [
    'Ono-Fix does not guarantee that the Service Provider will receive any particular number of jobs, customers, revenue, hours, or earnings. The Platform is a marketplace and the number and frequency of service opportunities may vary.',
    'Ono-Fix may determine which service opportunities are displayed or offered based on factors including customer preferences, location, availability, service category, customer requirements, provider profile, Platform policies, safety considerations, licensing requirements, and quality and performance information.',
  ]},
  { title: '5. Acceptance of Jobs', body: [
    'The Service Provider is free to accept or decline service requests, except where otherwise required by applicable law or a separately accepted obligation.',
    'Once the Service Provider accepts a Job, the Service Provider agrees to perform the accepted services in accordance with the applicable Job Service Agreement, approved Change Orders, applicable Platform policies, and applicable laws, regulations, codes, and licensing requirements. After accepting a Job, the Service Provider may not intentionally abandon the Job or fail to appear without reasonable cause.',
  ]},
  { title: '6. Customer (Job) Agreement', body: [
    'Each accepted Job will be documented through an electronic Job Service Agreement between the Customer and the Service Provider, which may identify the customer, service provider, service address, scope of work, labor rate, minimum charge, materials, travel/service fees, payment authorization, estimated duration, applicable terms, Change Orders, and final charges.',
    'The Job Service Agreement is incorporated into this Agreement with respect to each applicable Job.',
  ]},
  { title: "7. Service Provider's Rates", body: [
    'The Service Provider shall establish the labor rates and applicable service charges displayed through the Platform, subject to applicable Platform requirements and customer disclosure requirements, and must accurately disclose:',
    { bullets: ['hourly rates;', 'minimum charges;', 'travel/service fees;', 'material charges;', 'fixed prices, where applicable;', 'other charges that may reasonably be imposed on a customer.'] },
    'The Service Provider may not knowingly charge a customer an amount different from the amount authorized through Ono-Fix.',
  ]},
  { title: '8. Hourly Services', body: [
    'For hourly services, the Service Provider shall accurately record actual time spent performing authorized services and shall not:',
    { bullets: ['knowingly inflate hours;', 'bill for time not worked;', 'bill two customers for the same time;', 'knowingly bill unauthorized work;', 'manipulate time records;', 'submit false or misleading invoices.'] },
    'Estimated duration is not a guaranteed completion time.',
  ]},
  { title: '9. Additional Work', body: [
    'If additional work becomes necessary, the Service Provider shall, whenever reasonably practicable, document the additional work, explain why it is necessary, provide the applicable additional rate or price, submit a Change Order through Ono-Fix, and obtain customer authorization before performing additional billable work.',
    'Emergency or immediately necessary work to prevent material property damage or address an immediate safety issue may be treated according to the applicable Job Agreement and applicable law. The Service Provider may not intentionally perform unauthorized additional work to increase the customer invoice.',
  ]},
  { title: '10. Payment Processing', body: [
    'All payments for services obtained through Ono-Fix must be processed through the payment methods and payment processors designated or supported by Ono-Fix.',
    'The Service Provider authorizes Ono-Fix and its designated payment processor to:',
    { bullets: ['receive customer payments;', 'process payment authorizations;', 'capture payments;', 'issue refunds where authorized;', 'process chargebacks and disputes;', 'deduct applicable Platform fees;', 'deduct applicable payment-processing fees where disclosed;', 'calculate provider payouts;', 'remit amounts due to the Service Provider.'] },
    'Ono-Fix may change its payment processor or infrastructure from time to time.',
  ]},
  { title: '11. Platform Fees', body: [
    'For each Job, the Service Provider agrees to pay the Platform fee disclosed to the Service Provider before or at the time the Job is accepted.',
    'Platform Fee: a commission calculated as a percentage of the Job total (currently 15%), disclosed before or at the time each Job is accepted.',
    'Ono-Fix may change its fee structure prospectively upon reasonable notice, subject to applicable law.',
  ]},
  { title: '12. Provider Payouts', body: [
    'After successful collection of customer funds, applicable Platform fees, payment-processing charges, refunds, reserves, chargebacks, and other authorized adjustments may be deducted before payout. The remaining amount will be made available according to the payout schedule established by Ono-Fix and/or its payment processor.',
    'Unless Ono-Fix expressly agrees otherwise in a separate written payment-protection program, Ono-Fix does not guarantee collection of every customer invoice, and may delay or hold a payout where reasonably necessary to investigate suspected fraud, duplicate transactions, disputes, chargebacks, payment reversals, unauthorized transactions, or regulatory/processor requirements.',
  ]},
  { title: '13. Customer Non-Payment', body: [
    'If a customer fails to pay an amount properly due, Ono-Fix may, where legally permitted, retry the payment, request another payment method, pursue collection, restrict the customer account, suspend future bookings, provide evidence to a payment processor, respond to a chargeback, or pursue other lawful remedies.',
    'The Service Provider agrees to reasonably cooperate and provide, when requested, photographs, invoices, time records, communications, receipts, Change Orders, proof of completion, and other relevant documentation.',
  ]},
  { title: '14. No Off-Platform Payments', body: [
    'The Service Provider shall not intentionally circumvent Ono-Fix by accepting direct payment from a customer for a Job originally introduced or booked through Ono-Fix, including cash, Venmo, Zelle, Cash App, personal checks, direct bank transfers, cryptocurrency, external payment links, or other arrangements intended to avoid Platform fees or payment processing.',
    'Nothing in this provision prohibits conduct that cannot lawfully be restricted.',
  ]},
  { title: '15. Customer Non-Circumvention', body: [
    'If a customer introduced through Ono-Fix requests future services directly outside the Platform, the Service Provider shall direct the customer to book those services through Ono-Fix during the restricted period of 12 months.',
    'This provision is intended to protect Ono-Fix\'s legitimate business interests and shall be enforced only to the extent permitted by applicable law.',
  ]},
  { title: '16. Customer Information', body: [
    'Customer information provided through Ono-Fix is confidential business information and may be used solely to communicate regarding an accepted Job, travel to the service location, perform the requested services, document the Job, and comply with legal requirements.',
    'The Service Provider shall not sell customer information, share it for unrelated purposes, use it for unrelated marketing, add customers to unrelated mailing lists, retain customer payment information, or disclose it to unauthorized persons.',
  ]},
  { title: '17. Professional Performance', body: [
    'The Service Provider agrees to perform accepted services professionally, competently, safely, with reasonable care, in accordance with the agreed scope, and in accordance with applicable laws and codes.',
    'The Service Provider is responsible for its own workmanship and for damage caused by the Service Provider\'s negligence, willful misconduct, or other legally actionable conduct.',
  ]},
  { title: '18. Licenses and Permits', body: [
    'The Service Provider represents that it possesses and will maintain all licenses, permits, registrations, certifications, and qualifications required for the services offered, shall not accept or perform work requiring a license it does not possess, shall obtain required permits unless assigned elsewhere by the applicable Job Agreement, and must promptly notify Ono-Fix if a required license, registration, certification, or permit expires, is suspended, or is revoked.',
  ]},
  { title: '19. Insurance', body: [
    'The Service Provider shall maintain insurance required by applicable law and appropriate for the services performed. Ono-Fix may require evidence of insurance before allowing certain categories of work, and may request current certificates of insurance. Failure to maintain required insurance may result in suspension of the provider account.',
  ]},
  { title: '20. Safety', body: [
    'The Service Provider shall comply with applicable safety laws, regulations, codes, and reasonable Platform safety requirements, and shall not knowingly perform work that is illegal, unsafe, outside the provider\'s qualifications or licensing authority, or reasonably likely to cause serious property damage or injury.',
  ]},
  { title: '21. Property Damage', body: [
    'The Service Provider shall exercise reasonable care to protect customer property and shall promptly notify the customer and Ono-Fix of any material property damage caused or reasonably believed to have been caused during a Job.',
    'The Service Provider remains responsible for legally attributable damage caused by its negligence, willful misconduct, or other legally actionable conduct.',
  ]},
  { title: '22. Photographs and Job Documentation', body: [
    'The Service Provider may be required to document Jobs using photographs, videos, timestamps, check-in/check-out records, and other information, which may be used for billing, quality control, dispute resolution, payment disputes, chargebacks, insurance claims, customer support, compliance, and fraud prevention.',
    'The Service Provider shall not photograph or record areas unrelated to the Job when doing so would unnecessarily compromise customer privacy.',
  ]},
  { title: '23. Completion of Job', body: [
    'Upon completion, the Service Provider shall accurately record actual time, identify materials used, identify approved additional work, upload required documentation, submit the final invoice through Ono-Fix, and mark the Job complete.',
    'The Service Provider shall not mark a Job complete when material contracted work remains unfinished, except where the customer has agreed to partial completion or another arrangement documented through Ono-Fix.',
  ]},
  { title: '24. Warranties', body: [
    'Any warranty provided by the Service Provider must be accurately disclosed to the customer. Unless expressly stated in writing, Ono-Fix does not provide a workmanship warranty for services performed by an independent Service Provider. The Service Provider remains responsible for warranties it expressly provides. Nothing limits any consumer right that cannot lawfully be excluded.',
  ]},
  { title: '25. Customer Complaints', body: [
    'If Ono-Fix receives a customer complaint regarding a Job, the Service Provider agrees to cooperate reasonably with the investigation and may be asked to provide an explanation, photographs, receipts, time records, communications, licenses, insurance information, or other relevant evidence.',
    'Ono-Fix may temporarily restrict a provider account when reasonably necessary to protect customers, providers, the Platform, payment systems, or the public.',
  ]},
  { title: '26. Platform Investigations', body: [
    'Ono-Fix may investigate suspected fraud, false billing, customer abuse, provider misconduct, unauthorized or off-platform payments, account sharing, identity misrepresentation, licensing or safety violations, manipulation of Platform records, and abuse of promotions or rewards. The Service Provider agrees to cooperate reasonably.',
  ]},
  { title: '27. Suspension', body: [
    'Ono-Fix may temporarily suspend provider access where reasonably necessary to investigate or prevent fraud, safety concerns, serious customer complaints, payment disputes, chargebacks, licensing or insurance issues, violation of this Agreement or law, misuse of customer information, or off-platform payment activity. Where practicable, Ono-Fix will provide notice of the reason for suspension.',
  ]},
  { title: '28. Termination', body: [
    'Either party may terminate this Agreement upon written notice, subject to obligations that survive termination.',
    'Ono-Fix may terminate immediately where permitted by law if the Service Provider commits fraud, intentionally falsifies records, materially abuses customers, intentionally circumvents payment systems, performs serious unsafe work, loses a required license, materially violates this Agreement, materially misuses customer data, or engages in unlawful conduct. Termination does not eliminate payment obligations or other rights accrued before termination.',
  ]},
  { title: '29. Indemnification', body: [
    'To the maximum extent permitted by applicable law, the Service Provider agrees to defend, indemnify, and hold harmless Nexus Security Solutions LLC, Ono-Fix, and their respective owners, officers, employees, agents, and affiliates from third-party claims, damages, liabilities, losses, penalties, costs, and reasonable attorneys\' fees arising out of or relating to:',
    { bullets: ["the Service Provider's negligence or willful misconduct;", "the Service Provider's breach of this Agreement;", "the Service Provider's violation of applicable law;", 'the failure to maintain required licenses or permits;', 'the failure to maintain required insurance;', 'bodily injury or property damage caused by the Service Provider;', 'the unauthorized use or disclosure of customer information;', "the Service Provider's employment or engagement of its own personnel;", "claims arising from the Service Provider's performance of services."] },
    'This provision shall not require indemnification for a party\'s own conduct to the extent prohibited by applicable law.',
  ]},
  { title: '30. Ono-Fix\'s Role & Division of Responsibility', body: [
    'Ono-Fix is a marketplace and technology and payment facilitation platform, while the Service Provider is independently responsible for the performance of services.',
    'Ono-Fix is responsible for: the Platform; its own payment infrastructure; its own actions; and its own employees or contractors, where applicable.',
    'The Service Provider is responsible for: its own work and workmanship; licenses; permits; insurance; damage it causes; its own workers; taxes; safety; and the accuracy of its invoices.',
    'Except where expressly agreed otherwise in writing, Ono-Fix does not perform the physical services, supervise the means or methods, control the tools, employ the Service Provider, or guarantee workmanship, a particular result, a particular number of Jobs, customer satisfaction, or collection of every customer payment. Nothing excludes liability that cannot legally be excluded.',
  ]},
  { title: '31. Limitation of Liability', body: [
    'To the maximum extent permitted by applicable law, Ono-Fix shall not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages arising from the Service Provider\'s independent performance of services.',
    'To the maximum extent permitted by applicable law, Ono-Fix\'s aggregate liability arising from this Agreement shall not exceed the Platform fees actually paid by the Service Provider to Ono-Fix during the six (6) months preceding the event giving rise to the claim. Any limitation applies only to the extent permitted by law.',
  ]},
  { title: '32. No Employment Benefits', body: [
    'The Service Provider is not entitled to salary, overtime, employee benefits, paid vacation, unemployment benefits, workers\' compensation from Ono-Fix except as required by law, retirement benefits, or health insurance through Ono-Fix. Nothing waives rights that cannot lawfully be waived.',
  ]},
  { title: '33. Taxes', body: [
    'The Service Provider is responsible for all applicable federal, state, and local taxes arising from amounts paid to it. Ono-Fix may issue applicable tax reporting forms as required by law. The Service Provider is responsible for maintaining appropriate tax records.',
  ]},
  { title: '34. Records and Audit', body: [
    'The Service Provider shall maintain accurate records relating to Jobs performed through Ono-Fix. Ono-Fix may request reasonable documentation necessary to resolve disputes, respond to chargebacks, comply with payment processor requirements, investigate fraud, verify licensing, and comply with applicable law.',
  ]},
  { title: '35. Electronic Communications', body: [
    'The Service Provider agrees to receive electronically job requests, agreements, invoices, payment notifications, policy updates, compliance notices, suspension notices, and termination notices. Electronic communications sent to the provider\'s registered email address or Platform account may constitute written notice where permitted by law.',
  ]},
  { title: '36. Electronic Signature', body: [
    'The Service Provider agrees that electronic acceptance of this Agreement constitutes an electronic signature to the extent permitted by applicable law.',
    'Ono-Fix may retain provider name, account ID, date and time, IP address, device information where lawfully collected, Agreement version, electronic acceptance, document hash, and other legally relevant metadata. The electronic version stored by Ono-Fix shall constitute the authoritative version of the Agreement for Platform records, subject to applicable law.',
  ]},
  { title: '37. Confidentiality', body: [
    'The Service Provider shall keep confidential non-public information concerning Ono-Fix, including non-public pricing, business strategies, customer information, Platform technology, proprietary processes, internal communications, and non-public financial information. This obligation survives termination to the extent permitted by law.',
  ]},
  { title: '38. Intellectual Property', body: [
    'All rights in the Ono-Fix name, logo, software, Platform, designs, trademarks, content, and proprietary technology remain the property of Ono-Fix or its licensors. The Service Provider receives only a limited, revocable right to use the Platform for authorized business purposes and may not copy, reverse engineer, modify, sell, sublicense, or commercially exploit the Platform except as expressly permitted.',
  ]},
  { title: '39. Provider Representations', body: [
    'The Service Provider represents that all information provided to Ono-Fix is accurate; identity, business, licensing, and insurance information is truthful; the Service Provider has authority to enter into this Agreement; the Service Provider will comply with applicable law; and the Service Provider will not knowingly submit false billing information.',
  ]},
  { title: '40. Platform Policies', body: [
    'The Service Provider agrees to comply with reasonable Platform policies published or communicated by Ono-Fix concerning safety, payments, customer communications, privacy, prohibited conduct, quality, fraud prevention, and account security. Material changes to contractual terms will be provided with appropriate notice where required by law.',
  ]},
  { title: '41. Dispute Resolution', body: [
    'The parties agree to attempt in good faith to resolve disputes through written notice and direct communication before commencing litigation.',
  ]},
  { title: '42. Governing Law', body: [
    'This Agreement shall be governed by the law applicable to the relationship and transaction, without regard to conflict-of-law principles, subject to any mandatory law applicable to the Service Provider or services performed. Nothing in this Agreement is intended to waive mandatory statutory rights.',
  ]},
  { title: '43. Severability', body: [
    'If any provision of this Agreement is determined to be invalid or unenforceable, the remaining provisions shall remain effective to the maximum extent permitted by law. Where legally permitted, an invalid provision shall be modified to the minimum extent necessary to make it enforceable while preserving its intended purpose.',
  ]},
  { title: '44. No Waiver', body: [
    'Failure by Ono-Fix to enforce any provision immediately shall not constitute a waiver of the right to enforce that provision later.',
  ]},
  { title: '45. Assignment', body: [
    'The Service Provider may not assign this Agreement or transfer its rights or obligations without Ono-Fix\'s written consent, except where otherwise required by law. Ono-Fix may assign this Agreement to an affiliate, successor, purchaser, or entity acquiring substantially all of the relevant business or assets, subject to applicable law.',
  ]},
  { title: '46. Entire Agreement', body: [
    'This Agreement, the applicable Platform Terms, applicable provider policies, and accepted Job Agreements constitute the agreement between the parties concerning the subject matter addressed herein. Job-specific terms control over general terms only with respect to the specific Job.',
  ]},
  { title: '47. Survival', body: [
    'The following provisions survive termination: payment obligations; confidentiality; customer information; intellectual property; indemnification; dispute resolution; limitation of liability; records; and provisions that by their nature should survive termination.',
  ]},
  { title: '48. Acknowledgment', body: [
    'The Service Provider acknowledges that before accepting Jobs through Ono-Fix, it has had the opportunity to review this Agreement, ask questions, obtain independent legal advice, and provide accurate business, licensing, and insurance information.',
    'The Service Provider understands that it is responsible for determining whether operating as an independent contractor is appropriate for its business and circumstances.',
  ]},
  { title: '49. Electronic Acceptance', body: [
    'By checking the acceptance boxes and creating a provider account, the Service Provider confirms:',
    { bullets: ['I have read, understand, and agree to the Ono-Fix Service Provider Agreement.', 'I understand that I am responsible for complying with all applicable licensing, insurance, tax, safety, and legal requirements applicable to my business and services.', 'I understand that I am not an employee of Ono-Fix unless applicable law determines otherwise.'] },
    'Ono-Fix records the electronic acceptance with date and time, IP address, Agreement version, and document hash.',
  ]},
];

export default function ProviderAgreement() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Head>
        <title>Service Provider Agreement — Ono-Fix</title>
        <meta name="description" content="Ono-Fix Service Provider Agreement — the independent-contractor agreement governing service providers on the Ono-Fix home services platform, operated by Nexus Security Solutions LLC." />
        <link rel="canonical" href="https://ono-fix.com/provider-agreement" />
        <meta name="robots" content="index, follow" />
      </Head>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} data-testid="provider-agreement-back">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Service Provider Agreement</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} data-testid="provider-agreement-screen">
        <Text style={styles.docTitle}>Ono-Fix Service Provider Agreement</Text>
        <Text style={styles.meta}>Version {VERSION} · Effective Date: {EFFECTIVE_DATE}</Text>

        <Text style={styles.p}>
          This Service Provider Agreement ("Agreement") is entered into between <Text style={styles.bold}>Nexus Security Solutions LLC</Text>, doing business as Ono-Fix ("Ono-Fix" or "Platform"), and the Service Provider identified by the account under which this Agreement is electronically accepted (collectively, the "Parties").
        </Text>
        <Text style={styles.p}>
          This Agreement establishes the terms governing the relationship between Ono-Fix and the Service Provider. <Text style={styles.bold}>This Agreement does not constitute an employment agreement.</Text>
        </Text>

        {SECTIONS.map((sec) => (
          <View key={sec.title}>
            <Text style={styles.h2}>{sec.title}</Text>
            {sec.body.map((para, i) =>
              typeof para === 'string' ? (
                <Text key={i} style={styles.p}>{para}</Text>
              ) : (
                <View key={i} style={styles.bullets}>
                  {para.bullets.map((b, j) => (
                    <View key={j} style={styles.bulletRow}>
                      <Text style={styles.bulletDot}>•</Text>
                      <Text style={styles.bulletText}>{b}</Text>
                    </View>
                  ))}
                </View>
              )
            )}
          </View>
        ))}

        <View style={styles.footerBox}>
          <Text style={styles.bold}>ONO-FIX</Text>
          <Text style={styles.footerText}>Operated by Nexus Security Solutions LLC</Text>
          <Text style={styles.footerText}>9701 Dee Rd, Niles, IL 60714</Text>
          <Text style={styles.footerText}>Contact: <Text style={styles.link}>Nexus.ss.llc@gmail.com</Text></Text>
          <Text style={styles.footerText}>Agreement Version: {VERSION} · Effective Date: {EFFECTIVE_DATE}</Text>
        </View>

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
  docTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 6 },
  meta: { fontSize: 12, color: '#6b7280', marginBottom: 16 },
  h2: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 18, marginBottom: 8 },
  p: { fontSize: 14, color: '#374151', lineHeight: 22, marginBottom: 8 },
  bold: { fontWeight: '700', color: '#111827' },
  link: { color: '#2563eb', textDecorationLine: 'underline' },
  bullets: { marginBottom: 8, paddingLeft: 4 },
  bulletRow: { flexDirection: 'row', marginBottom: 4 },
  bulletDot: { fontSize: 14, color: '#6b7280', width: 16, lineHeight: 22 },
  bulletText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 22 },
  footerBox: { marginTop: 28, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb', gap: 3 },
  footerText: { fontSize: 13, color: '#6b7280' },
});
