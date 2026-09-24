/**
 * Provider Guide — step-by-step "how to work on Ono-Fix" for pros.
 * Linked from My Profile (providers) and the Help Center.
 * Uses exact in-app button labels so it stays actionable.
 */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const IMG = {
  start: 'https://static.prod-images.emergentagent.com/jobs/e9a218b6-fc51-4ccc-9444-4752078afc64/images/82e59a66c8e3accc1b185c0852ea4efb85b4d1f75ecb4c1e719bc46ad1ca0eae.jpeg',
  payout: 'https://static.prod-images.emergentagent.com/jobs/e9a218b6-fc51-4ccc-9444-4752078afc64/images/f44ff46d9d31ba462ba44ebff5331ac6d1197bc596e14ee4e15e00e59d4618f6.jpeg',
  accept: 'https://static.prod-images.emergentagent.com/jobs/e9a218b6-fc51-4ccc-9444-4752078afc64/images/3a9d096d6864b14095cc19e0c4098a83beb4e6f909d0784defda3ef6039fb47b.jpeg',
  status: 'https://static.prod-images.emergentagent.com/jobs/e9a218b6-fc51-4ccc-9444-4752078afc64/images/6e7695e28e617cf31d73a36329100423fe00d1b4b0e05b8672c4d40f0cde352c.jpeg',
  invoice: 'https://static.prod-images.emergentagent.com/jobs/e9a218b6-fc51-4ccc-9444-4752078afc64/images/ce03e3a5460f941bbfff953c00123840cc15c64b319607cccb4b52fb2adbea7a.jpeg',
  paid: 'https://static.prod-images.emergentagent.com/jobs/e9a218b6-fc51-4ccc-9444-4752078afc64/images/2852833e805c84b3d0782f1209c5c46962cdb93a4a201772fd8d5a6974305454.jpeg',
};

type Btn = { label: string; color: string };
type Section = {
  n: number; icon: keyof typeof Ionicons.glyphMap; color: string;
  title: string; img: string; steps: string[]; buttons?: Btn[];
};

const SECTIONS: Section[] = [
  {
    n: 1, icon: 'rocket', color: '#2563eb', title: 'Get set up first', img: IMG.start,
    steps: [
      'Open the Profile tab and finish the onboarding checklist.',
      'Complete each step: profile & photo, work area, your skills & rates, availability, payout, and identity verification.',
      'Once every step is green, clients can find and book you.',
    ],
  },
  {
    n: 2, icon: 'cash', color: '#059669', title: 'Add your payout details', img: IMG.payout,
    steps: [
      'Go to Profile → "Set up how you get paid".',
      'Enter your Zelle and/or Venmo handle.',
      'Add your full name or company name — Zelle/Venmo often need the recipient name.',
      'Clients pay you directly to these details after each job.',
    ],
  },
  {
    n: 3, icon: 'notifications', color: '#7c3aed', title: 'Accept a new order', img: IMG.accept,
    steps: [
      'New jobs appear in the Tasks tab (and you get a Telegram/email alert).',
      'Open the order to see the service, address, date and price.',
      'Tap "Accept task" to take the job, or "Decline task" and pick a reason if you can’t.',
      'Use the in-app chat to confirm details with the client — keep everything inside the app.',
    ],
    buttons: [{ label: 'Accept task', color: '#2563eb' }, { label: 'Decline task', color: '#dc2626' }],
  },
  {
    n: 4, icon: 'navigate', color: '#06b6d4', title: 'Update your status as you work', img: IMG.status,
    steps: [
      'When you leave for the job, tap "I\'m on the way".',
      'When you arrive and begin, tap "Start work".',
      'When the job is done, tap "Finish work".',
      'Each update keeps the client informed automatically.',
    ],
    buttons: [
      { label: "I'm on the way", color: '#06b6d4' },
      { label: 'Start work', color: '#f97316' },
      { label: 'Finish work', color: '#22c55e' },
    ],
  },
  {
    n: 5, icon: 'document-text', color: '#f59e0b', title: 'Create & send the invoice', img: IMG.invoice,
    steps: [
      'Tapping "Finish work" opens the invoice.',
      'Enter the hours worked and add any extra line items (materials, parts).',
      'Check the total, then tap "Send invoice" to the client.',
      'Not fully finished? You can charge for work done now and create a follow-up job to complete later.',
    ],
    buttons: [{ label: 'Send invoice', color: '#22c55e' }],
  },
  {
    n: 6, icon: 'happy', color: '#16a34a', title: 'Get paid', img: IMG.paid,
    steps: [
      'The client pays your invoice via Zelle or Venmo to the details you set up.',
      'Confirm the payment when it arrives.',
      'The job is complete — great work! Higher ratings and completed jobs boost your ranking.',
    ],
  },
];

const TIPS = [
  'Reply to messages quickly — fast pros get more jobs.',
  'Keep all chat and payments inside the app for your protection.',
  'Confirm the work honestly each day — it protects both you and the client.',
  'Keep your availability up to date so you only get jobs you can take.',
];

export default function ProviderGuidePage() {
  const router = useRouter();
  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} data-testid="guide-back-btn">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={s.title}>Provider guide</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} data-testid="provider-guide-screen">
        <Text style={s.intro}>Everything you need to start earning on Ono-Fix — from setup to getting paid.</Text>

        {SECTIONS.map((sec) => (
          <View key={sec.n} style={s.card} data-testid={`guide-section-${sec.n}`}>
            <Image source={{ uri: sec.img }} style={s.cardImg} resizeMode="cover" />
            <View style={s.cardBody}>
              <View style={s.cardHead}>
                <View style={[s.numBadge, { backgroundColor: sec.color }]}>
                  <Text style={s.numText}>{sec.n}</Text>
                </View>
                <Ionicons name={sec.icon} size={18} color={sec.color} />
                <Text style={s.cardTitle}>{sec.title}</Text>
              </View>
              {sec.steps.map((st, i) => (
                <View key={i} style={s.stepRow}>
                  <Ionicons name="checkmark-circle" size={16} color={sec.color} style={{ marginTop: 2 }} />
                  <Text style={s.stepText}>{st}</Text>
                </View>
              ))}
              {sec.buttons ? (
                <View style={s.btnRow}>
                  {sec.buttons.map((b) => (
                    <View key={b.label} style={[s.demoBtn, { backgroundColor: b.color }]}>
                      <Text style={s.demoBtnText}>{b.label}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        ))}

        <View style={s.tipsCard}>
          <View style={s.cardHead}>
            <Ionicons name="bulb" size={18} color="#d97706" />
            <Text style={s.cardTitle}>Tips to succeed</Text>
          </View>
          {TIPS.map((t, i) => (
            <View key={i} style={s.stepRow}>
              <Ionicons name="star" size={14} color="#d97706" style={{ marginTop: 3 }} />
              <Text style={s.stepText}>{t}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={s.supportBtn} onPress={() => router.push('/support-chat' as any)} data-testid="guide-support-btn">
          <Ionicons name="chatbubbles-outline" size={18} color="#fff" />
          <Text style={s.supportBtnText}>Still need help? Contact support</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  back: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  content: { padding: 16 },
  intro: { fontSize: 14, color: '#4b5563', lineHeight: 20, marginBottom: 18 },
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 16, overflow: 'hidden' },
  cardImg: { width: '100%', height: 150, backgroundColor: '#eef2ff' },
  cardBody: { padding: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  numBadge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  numText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: '#111827' },
  stepRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'flex-start' },
  stepText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  demoBtn: { borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  demoBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  tipsCard: { backgroundColor: '#fffbeb', borderRadius: 16, borderWidth: 1, borderColor: '#fde68a', padding: 16, marginBottom: 20 },
  supportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#111827', borderRadius: 12, paddingVertical: 14 },
  supportBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
