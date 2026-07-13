import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { SiteFooter } from '../components/SiteFooter';
import { HOW_IMAGES, HOW_VIDEOS } from '../constants/company';

type Step = { title: string; body: string; img: string };

const CLIENT_STEPS: Step[] = [
  { title: 'Snap a photo of the problem', body: 'Open Ono-Fix and take a photo of whatever needs fixing — a leaky faucet, a broken outlet, furniture to assemble. No long forms.', img: HOW_IMAGES.clientPhoto },
  { title: 'AI identifies the job & matches a pro', body: 'Our AI analyzes your photo, detects the service you need, and estimates the time and cost, then matches you with trusted local professionals.', img: HOW_IMAGES.clientMatch },
  { title: 'Choose your pro & book a time', body: 'Compare pros by rating, price and minimum charge. Pick one, select a time that works, and confirm your address.', img: HOW_IMAGES.clientBook },
  { title: 'Pro arrives, works & you pay securely', body: 'Your pro completes the job. You pay in-app — a 1-hour minimum, then per-minute after that. Simple and transparent.', img: HOW_IMAGES.clientPay },
];

const PRO_STEPS: Step[] = [
  { title: 'Create your professional profile', body: 'Sign up as a pro, add your skills, experience and work photos so clients can see what you do best.', img: HOW_IMAGES.proProfile },
  { title: 'Set your rate, minimum & service area', body: 'Choose your hourly rate, your minimum charge (1, 1.5 or 2 hours) and the cities/ZIP codes you serve.', img: HOW_IMAGES.proRate },
  { title: 'Receive job requests & accept', body: 'Get notified about new jobs that match your skills and area. Review the details and accept the ones you want.', img: HOW_IMAGES.proJobs },
  { title: 'Do the work & get paid', body: 'Complete the job, mark it done, and receive your full rate directly to your payout account.', img: HOW_IMAGES.proPaid },
];

export default function HowItWorksPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'client' | 'pro'>('client');
  const { width } = useWindowDimensions();
  const steps = tab === 'client' ? CLIENT_STEPS : PRO_STEPS;
  const video = tab === 'client' ? HOW_VIDEOS.client : HOW_VIDEOS.provider;
  const imgSize = Math.min(width - 40, 420);

  return (
    <View style={styles.container}>
      <Head>
        <title>How It Works — Ono-Fix for Clients & Pros</title>
        <meta name="description" content="See how Ono-Fix works, step by step — for clients booking a home service, and for professionals earning on the platform." />
        <link rel="canonical" href="https://ono-fix.com/how-it-works" />
        <meta name="robots" content="index, follow" />
      </Head>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>How It Works</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} data-testid="how-it-works-screen">
        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'client' && styles.tabActive]}
            onPress={() => setTab('client')}
            data-testid="how-tab-client"
          >
            <Ionicons name="home-outline" size={16} color={tab === 'client' ? '#fff' : '#374151'} />
            <Text style={[styles.tabText, tab === 'client' && styles.tabTextActive]}>For Clients</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'pro' && styles.tabActive]}
            onPress={() => setTab('pro')}
            data-testid="how-tab-pro"
          >
            <Ionicons name="construct-outline" size={16} color={tab === 'pro' ? '#fff' : '#374151'} />
            <Text style={[styles.tabText, tab === 'pro' && styles.tabTextActive]}>For Pros</Text>
          </TouchableOpacity>
        </View>

        {/* Optional video slot */}
        {video ? (
          <View style={styles.videoWrap}>
            {/* @ts-ignore web-only iframe */}
            <iframe src={video} title="Ono-Fix — How it works" style={{ width: '100%', height: 220, border: 0, borderRadius: 12 }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
          </View>
        ) : (
          <View style={styles.videoPlaceholder} data-testid="how-video-placeholder">
            <Ionicons name="play-circle-outline" size={30} color="#2563eb" />
            <Text style={styles.videoPlaceholderText}>Walkthrough video coming soon</Text>
          </View>
        )}

        {/* Steps */}
        {steps.map((st, i) => (
          <View key={i} style={styles.step} data-testid={`how-step-${tab}-${i}`}>
            <Image source={{ uri: st.img }} style={[styles.stepImg, { width: imgSize, height: imgSize * 0.62 }]} resizeMode="cover" />
            <View style={styles.stepBody}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{st.title}</Text>
                <Text style={styles.stepText}>{st.body}</Text>
              </View>
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={styles.cta}
          onPress={() => router.push((tab === 'client' ? '/(tabs)' : '/register') as any)}
          data-testid="how-cta"
        >
          <Text style={styles.ctaText}>{tab === 'client' ? 'Book a pro now' : 'Become a pro'}</Text>
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
  tabs: { flexDirection: 'row', gap: 8, padding: 20, paddingBottom: 8 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff' },
  tabActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  tabText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  tabTextActive: { color: '#fff' },
  videoWrap: { marginHorizontal: 20, marginTop: 8, marginBottom: 4 },
  videoPlaceholder: { marginHorizontal: 20, marginTop: 8, marginBottom: 4, height: 120, borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', gap: 6 },
  videoPlaceholderText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
  step: { marginTop: 20, alignItems: 'center' },
  stepImg: { borderRadius: 16, backgroundColor: '#f1f5f9' },
  stepBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, marginTop: 12, width: '100%' },
  stepNum: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  stepTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  stepText: { fontSize: 14, color: '#4b5563', lineHeight: 21, marginTop: 4 },
  cta: { marginHorizontal: 20, marginTop: 28, backgroundColor: '#2563eb', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
