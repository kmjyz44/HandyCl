import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { showAlert } from '../utils/alert';

const CATEGORIES = [
  { id: 'bug',     label: 'Bug / Error',     icon: 'bug' as const },
  { id: 'billing', label: 'Billing',         icon: 'card' as const },
  { id: 'feature', label: 'Idea / Improvement', icon: 'bulb' as const },
  { id: 'other',   label: 'Other',           icon: 'help-circle' as const },
];

export default function HelpCenter() {
  const { user } = useAuthStore();
  const [faq, setFaq] = useState<any[]>([]);
  const [supportInfo, setSupportInfo] = useState<{ support_email?: string; support_phone?: string }>({});
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // form state
  const [name, setName] = useState<string>((user as any)?.full_name || (user as any)?.username || '');
  const [email, setEmail] = useState<string>((user as any)?.email || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('other');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [faqResp, infoResp] = await Promise.all([api.getFaq(), api.getSupportInfo()]);
        setFaq(faqResp?.categories || []);
        setSupportInfo(infoResp || {});
      } catch {
        setFaq([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const submit = async () => {
    if (name.trim().length < 2) { showAlert('Error', 'Enter your name'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { showAlert('Error', 'Invalid email'); return; }
    if (message.trim().length < 10) { showAlert('Error', 'Describe the issue — at least 10 characters'); return; }
    setSending(true);
    try {
      await api.submitSupportRequest({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim() || 'Form request',
        message: message.trim(),
        category,
      });
      setSent(true);
      setMessage('');
      setSubject('');
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Could not send');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#f9fafb' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Help Center' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Header */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="help-buoy" size={28} color="#fff" />
          </View>
          <Text style={styles.h1}>How can we help?</Text>
          <Text style={styles.heroSub}>Find an answer in the FAQ, or message us directly — we'll reply within 24 hours.</Text>

          <View style={styles.heroLinks}>
            <TouchableOpacity
              style={styles.heroLinkPrimary}
              onPress={() => {
                // open dedicated support chat
                // (router.push imported via expo-router below)
                require('expo-router').router.push('/support-chat');
              }}
              data-testid="open-support-chat-btn"
            >
              <Ionicons name="chatbubbles" size={16} color="#fff" />
              <Text style={styles.heroLinkPrimaryText}>Message the admin in chat</Text>
            </TouchableOpacity>
            {supportInfo.support_email && (
              <TouchableOpacity
                style={styles.heroLink}
                onPress={() => Linking.openURL(`mailto:${supportInfo.support_email}`)}
                data-testid="support-email-link"
              >
                <Ionicons name="mail" size={16} color="#2563eb" />
                <Text style={styles.heroLinkText}>{supportInfo.support_email}</Text>
              </TouchableOpacity>
            )}
            {supportInfo.support_phone && (
              <TouchableOpacity
                style={styles.heroLink}
                onPress={() => Linking.openURL(`tel:${supportInfo.support_phone}`)}
                data-testid="support-phone-link"
              >
                <Ionicons name="call" size={16} color="#2563eb" />
                <Text style={styles.heroLinkText}>{supportInfo.support_phone}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* FAQ */}
        <Text style={styles.sectionH}>Frequently asked questions</Text>
        {loading ? (
          <ActivityIndicator color="#2563eb" />
        ) : (
          faq.map((cat: any) => (
            <View key={cat.category} style={styles.faqCat}>
              <Text style={styles.catTitle}>{cat.category}</Text>
              {(cat.items || []).map((it: any, idx: number) => {
                const key = `${cat.category}-${idx}`;
                const open = openItem === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={styles.faqItem}
                    onPress={() => setOpenItem(open ? null : key)}
                    activeOpacity={0.8}
                    data-testid={`faq-${key}`}
                  >
                    <View style={styles.faqQRow}>
                      <Text style={styles.faqQ}>{it.q}</Text>
                      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#6b7280" />
                    </View>
                    {open && <Text style={styles.faqA}>{it.a}</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}

        {/* Contact form */}
        <Text style={styles.sectionH}>Didn't find an answer? Write to us</Text>
        <View style={styles.formCard}>
          {sent ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={56} color="#16a34a" />
              <Text style={styles.successTitle}>Thank you!</Text>
              <Text style={styles.successText}>Your message was sent. We'll reply soon to {email}.</Text>
              <TouchableOpacity style={styles.successBtn} onPress={() => setSent(false)} data-testid="send-another-btn">
                <Text style={styles.successBtnText}>Send another</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.formLabel}>Category</Text>
              <View style={styles.catRow}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.catChip, category === c.id && styles.catChipActive]}
                    onPress={() => setCategory(c.id)}
                    data-testid={`category-${c.id}`}
                  >
                    <Ionicons name={c.icon} size={14} color={category === c.id ? '#fff' : '#374151'} />
                    <Text style={[styles.catChipText, category === c.id && styles.catChipTextActive]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Name</Text>
              <TextInput value={name} onChangeText={setName} placeholder="What should we call you" style={styles.input} data-testid="support-name-input" />

              <Text style={styles.formLabel}>Reply email</Text>
              <TextInput value={email} onChangeText={setEmail} placeholder="your@email.com" autoCapitalize="none" keyboardType="email-address" style={styles.input} data-testid="support-email-input" />

              <Text style={styles.formLabel}>Subject (optional)</Text>
              <TextInput value={subject} onChangeText={setSubject} placeholder="Briefly, what's it about" style={styles.input} data-testid="support-subject-input" />

              <Text style={styles.formLabel}>Message</Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Describe in detail what happened, what you expected, and what happened instead..."
                style={[styles.input, styles.textarea]}
                multiline
                numberOfLines={6}
                data-testid="support-message-input"
              />

              <TouchableOpacity
                style={[styles.submitBtn, sending && { opacity: 0.5 }]}
                onPress={submit}
                disabled={sending}
                data-testid="support-submit-btn"
              >
                {sending ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="send" size={16} color="#fff" />
                    <Text style={styles.submitBtnText}>Send</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e5e7eb' },
  heroIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  h1: { fontSize: 22, fontWeight: '800', color: '#111827' },
  heroSub: { fontSize: 13, color: '#6b7280', marginTop: 6, lineHeight: 18 },
  heroLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  heroLink: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#eff6ff', borderRadius: 8,
  },
  heroLinkText: { color: '#2563eb', fontSize: 12, fontWeight: '700' },
  heroLinkPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#2563eb', borderRadius: 8,
  },
  heroLinkPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  sectionH: { fontSize: 15, fontWeight: '800', color: '#111827', marginTop: 8, marginBottom: 12 },

  faqCat: { marginBottom: 16 },
  catTitle: { fontSize: 13, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  faqItem: {
    backgroundColor: '#fff', padding: 14, borderRadius: 10, marginBottom: 6,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  faqQRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faqQ: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827', paddingRight: 8 },
  faqA: { fontSize: 13, color: '#4b5563', lineHeight: 19, marginTop: 8 },

  formCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  formLabel: { fontSize: 12, fontWeight: '700', color: '#374151', marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#fff' },
  textarea: { minHeight: 120, textAlignVertical: 'top' },

  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: '#f3f4f6' },
  catChipActive: { backgroundColor: '#2563eb' },
  catChipText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  catChipTextActive: { color: '#fff' },

  submitBtn: {
    marginTop: 16, backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  successBox: { alignItems: 'center', paddingVertical: 20 },
  successTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginTop: 8 },
  successText: { fontSize: 13, color: '#6b7280', marginTop: 6, textAlign: 'center', lineHeight: 18 },
  successBtn: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#f3f4f6', borderRadius: 10 },
  successBtnText: { fontSize: 13, fontWeight: '700', color: '#374151' },
});
