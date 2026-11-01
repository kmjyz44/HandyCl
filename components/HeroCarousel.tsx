import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, BACKEND_BASE_URL } from '../utils/api';

type Slide = { key: string; img: any; tag: string; title: string; accent: string };
type Handlers = { onIdentify: () => void; onRewards: () => void };

const DEFAULT_SLIDES: Slide[] = [
  { key: 'electrical', img: require('../assets/images/hero/electrical.jpg'), tag: 'Electrical', title: 'Home problem?', accent: 'Start with a photo.' },
  { key: 'plumbing', img: require('../assets/images/hero/plumbing.jpg'), tag: 'Plumbing', title: 'Leaky sink?', accent: 'A pro is one photo away.' },
  { key: 'furniture', img: require('../assets/images/hero/furniture.jpg'), tag: 'Furniture Assembly', title: 'Furniture to assemble?', accent: 'Matched in minutes.' },
  { key: 'wallrepair', img: require('../assets/images/hero/wallrepair.jpg'), tag: 'Home Repairs', title: 'Holes or cracks?', accent: 'Fixed like new.' },
];
const INTERVAL = 5000;
const SUB = 'Find the right service and connect with a pro — easily.';

const Gradient = ({ css, fallback }: { css: string; fallback: string }) =>
  Platform.OS === 'web'
    ? React.createElement('div', { style: { position: 'absolute', inset: 0, backgroundImage: css, pointerEvents: 'none' } })
    : <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: fallback }]} />;

export const HeroCarousel = (props: Handlers) => {
  const [slides, setSlides] = useState<Slide[]>(DEFAULT_SLIDES);
  useEffect(() => {
    api.getHeroSlides()
      .then((d) => {
        const list = (d?.slides || []).map((x: any) => ({
          key: x.slide_id, img: { uri: `${BACKEND_BASE_URL}${x.image_url}` },
          tag: x.tag, title: x.title, accent: x.accent,
        }));
        if (list.length) setSlides(list);
      })
      .catch(() => {});
  }, []);
  return <HeroSlides key={slides.map((x) => x.key).join('|')} slides={slides} {...props} />;
};

const RewardsPill = ({ onPress, compact }: { onPress: () => void; compact?: boolean }) => (
  <TouchableOpacity style={[s.reward, compact && s.rewardCompact]} onPress={onPress} activeOpacity={0.85} data-testid="hero-rewards-btn">
    <Gradient css="linear-gradient(90deg, #fbbf24 0%, #f97316 100%)" fallback="#f59e0b" />
    <Ionicons name="gift" size={compact ? 20 : 30} color="#dc2626" />
    <View style={{ flex: 1 }}>
      <Text style={[s.rewardTitle, compact && s.rewardTitleSm]}>Get rewarded!</Text>
      <Text style={[s.rewardSub, compact && s.rewardSubSm]} numberOfLines={compact ? 1 : 2}>Earn up to $100 for your first service.</Text>
    </View>
    <Ionicons name="chevron-forward" size={compact ? 16 : 20} color="#1f2937" />
  </TouchableOpacity>
);

const Cta = ({ onPress, compact }: { onPress: () => void; compact?: boolean }) => (
  <TouchableOpacity style={[s.cta, compact && s.ctaCompact]} onPress={onPress} activeOpacity={0.85} data-testid="hero-identify-btn">
    <Ionicons name="camera" size={compact ? 18 : 22} color="#fff" />
    <Text style={[s.ctaText, compact && s.ctaTextSm]}>Identify my problem</Text>
  </TouchableOpacity>
);

const HeroSlides = ({ slides: SLIDES, onIdentify, onRewards }: Handlers & { slides: Slide[] }) => {
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const imgH = wide ? Math.min(Math.max(width * 0.42, 440), 600) : Math.round(Math.min(width * 0.62, 280));
  const [idx, setIdx] = useState(0);
  const anims = useRef(SLIDES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const many = SLIDES.length > 1;

  const start = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    if (SLIDES.length > 1) timer.current = setInterval(() => setIdx((p) => (p + 1) % SLIDES.length), INTERVAL);
  }, [SLIDES.length]);

  useEffect(() => { start(); return () => { if (timer.current) clearInterval(timer.current); }; }, [start]);

  useEffect(() => {
    Animated.parallel(anims.map((a, i) => Animated.timing(a, { toValue: i === idx ? 1 : 0, duration: 700, useNativeDriver: Platform.OS !== 'web' }))).start();
  }, [idx, anims]);

  const go = (d: number) => { setIdx((p) => (p + d + SLIDES.length) % SLIDES.length); start(); };
  const slide = SLIDES[idx];

  const images = SLIDES.map((sl, i) => (
    <Animated.View key={sl.key} style={[wide ? s.imgWide : StyleSheet.absoluteFill, { opacity: anims[i], transform: [{ scale: anims[i].interpolate({ inputRange: [0, 1], outputRange: [1.06, 1] }) }] }]}>
      <Image source={sl.img} style={s.img} resizeMode="cover" accessibilityLabel={`Ono-Fix pro: ${sl.tag || sl.title}`} />
    </Animated.View>
  ));

  const dots = many && (
    <View style={s.dots}>
      {SLIDES.map((sl, i) => (
        <TouchableOpacity key={sl.key} onPress={() => { setIdx(i); start(); }} style={[s.dot, wide && s.dotWide, i === idx && s.dotActive]} data-testid={`hero-dot-${i}`} accessibilityLabel={`Slide ${i + 1}`} />
      ))}
    </View>
  );
  const counter = many && <View style={s.counter} data-testid="hero-counter"><Text style={s.counterText}>{idx + 1}/{SLIDES.length}</Text></View>;

  if (!wide) {
    return (
      <View style={s.mWrap} data-testid="hero-carousel">
        <View style={{ height: imgH, overflow: 'hidden' }}>
          {images}
          <Gradient css="linear-gradient(180deg, rgba(15,23,42,0) 30%, rgba(15,23,42,0.82) 100%)" fallback="rgba(15,23,42,0.35)" />
          {counter}
          <View style={s.mText}>
            <Text style={s.mTitle} data-testid="hero-slide-title">{slide.title}</Text>
            {!!slide.accent && <Text style={s.mAccent}>{slide.accent}</Text>}
          </View>
          {dots}
        </View>
        <View style={s.mBody}>
          <Text style={s.mSub}>{SUB}</Text>
          <RewardsPill onPress={onRewards} compact />
          <Cta onPress={onIdentify} compact />
          <Text style={s.note}>Free to get started · No phone call needed</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.wrap, { height: imgH }]} data-testid="hero-carousel">
      {images}
      <Gradient css="linear-gradient(90deg, #ffffff 0%, #ffffff 37%, rgba(255,255,255,0.85) 44%, rgba(255,255,255,0) 62%)" fallback="rgba(255,255,255,0.6)" />
      {counter}
      <View style={s.content}>
        <Text style={s.title} data-testid="hero-slide-title">{slide.title}</Text>
        {!!slide.accent && <Text style={s.accent}>{slide.accent}</Text>}
        <Text style={s.sub}>{SUB}</Text>
        <RewardsPill onPress={onRewards} />
        <Cta onPress={onIdentify} />
        <Text style={[s.note, { textAlign: 'center' }]}>Free to get started · No phone call needed</Text>
      </View>
      {many && (
        <>
          <TouchableOpacity style={[s.arrow, { left: 16 }]} onPress={() => go(-1)} data-testid="hero-prev-btn" accessibilityLabel="Previous slide">
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={[s.arrow, { right: 16 }]} onPress={() => go(1)} data-testid="hero-next-btn" accessibilityLabel="Next slide">
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </TouchableOpacity>
        </>
      )}
      {dots}
    </View>
  );
};

const STEPS = [
  { icon: 'camera', color: '#2563eb', bg: '#dbeafe', title: '1. Add a photo', sub: 'Show us the problem' },
  { icon: 'document-text', color: '#7c3aed', bg: '#ede9fe', title: '2. Get service options', sub: 'AI finds the right service' },
  { icon: 'people', color: '#16a34a', bg: '#dcfce7', title: '3. Choose a pro', sub: 'Connect with a qualified professional' },
] as const;

export const HowItWorksSteps = ({ onGallery, onInstall }: { onGallery: () => void; onInstall?: () => void }) => {
  const wide = useWindowDimensions().width >= 760;
  return (
  <View style={[s.steps, wide ? s.stepsWide : s.stepsNarrow]} data-testid="how-it-works-steps">
    <View style={s.stepsRow}>
      {STEPS.map((st, i) => (
        <React.Fragment key={st.title}>
          <View style={s.step}>
            <View style={[s.stepIcon, { backgroundColor: st.bg }]}><Ionicons name={st.icon} size={24} color={st.color} /></View>
            <Text style={s.stepTitle}>{st.title}</Text>
            <Text style={s.stepSub}>{st.sub}</Text>
          </View>
          {i < STEPS.length - 1 && <Ionicons name="chevron-forward" size={18} color="#94a3b8" style={{ marginTop: 18 }} />}
        </React.Fragment>
      ))}
    </View>
    <View style={s.stepsLinks}>
      <TouchableOpacity style={s.link} onPress={onGallery} data-testid="ai-gallery-btn">
        <Ionicons name="images-outline" size={16} color="#2563eb" />
        <Text style={s.linkText}>Upload from gallery</Text>
      </TouchableOpacity>
      {onInstall && (
        <TouchableOpacity style={s.link} onPress={onInstall} data-testid="install-app-btn">
          <Ionicons name="download-outline" size={16} color="#2563eb" />
          <Text style={s.linkText}>Install app</Text>
        </TouchableOpacity>
      )}
    </View>
  </View>
  );
};

const s = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#fff' },
  img: { width: '100%', height: '100%' },
  imgWide: { position: 'absolute', top: 0, bottom: 0, right: 0, width: '64%' },
  counter: { position: 'absolute', top: 14, left: 14, backgroundColor: 'rgba(15,23,42,0.45)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  counterText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  content: { position: 'absolute', left: 88, top: 0, bottom: 28, width: '40%', maxWidth: 520, justifyContent: 'center' },
  title: { color: '#0f172a', fontSize: 50, fontWeight: '800', lineHeight: 56, letterSpacing: -1.2 },
  accent: { color: '#2563eb', fontSize: 50, fontWeight: '800', lineHeight: 56, letterSpacing: -1.2 },
  sub: { color: '#334155', fontSize: 19, lineHeight: 27, marginTop: 12, marginBottom: 18, maxWidth: 380 },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 18, overflow: 'hidden', marginBottom: 14, shadowColor: '#f97316', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  rewardCompact: { paddingVertical: 8, paddingHorizontal: 12, gap: 10, borderRadius: 12, marginBottom: 10, alignSelf: 'center', width: '88%', maxWidth: 360 },
  rewardTitleSm: { fontSize: 14 },
  rewardSubSm: { fontSize: 11, lineHeight: 15 },
  rewardTitle: { color: '#111827', fontSize: 18, fontWeight: '800' },
  rewardSub: { color: '#1f2937', fontSize: 13, lineHeight: 18 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: 'rgba(37,99,235,0.85)', paddingVertical: 17, paddingHorizontal: 26, borderRadius: 16, shadowColor: '#2563eb', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  ctaText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  ctaCompact: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 12, gap: 8, alignSelf: 'center', width: '88%', maxWidth: 360, shadowOpacity: 0.2, shadowRadius: 8 },
  ctaTextSm: { fontSize: 15 },
  note: { color: '#64748b', fontSize: 13, marginTop: 10, textAlign: 'center' },
  arrow: { position: 'absolute', top: '50%', marginTop: -24, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(15,23,42,0.35)', alignItems: 'center', justifyContent: 'center' },
  dots: { position: 'absolute', bottom: 14, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.6)' },
  dotWide: { backgroundColor: 'rgba(15,23,42,0.2)' },
  dotActive: { width: 22, backgroundColor: '#2563eb' },
  mWrap: { backgroundColor: '#fff' },
  mText: { position: 'absolute', left: 18, right: 18, bottom: 30 },
  mTitle: { color: '#fff', fontSize: 28, fontWeight: '800', lineHeight: 33, letterSpacing: -0.6 },
  mAccent: { color: '#93c5fd', fontSize: 28, fontWeight: '800', lineHeight: 33, letterSpacing: -0.6 },
  mBody: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  mSub: { color: '#334155', fontSize: 14, lineHeight: 20, marginBottom: 10, textAlign: 'center' },
  steps: { backgroundColor: '#fff', borderRadius: 24, paddingTop: 20, paddingBottom: 12, paddingHorizontal: 10, marginBottom: 14, shadowColor: '#1e3a8a', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: -2 } },
  stepsWide: { marginTop: -24, paddingTop: 24 },
  stepsNarrow: { marginHorizontal: 16, marginTop: 6, borderWidth: 1, borderColor: '#eef2f7' },
  stepsRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-around' },
  step: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  stepIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  stepTitle: { color: '#0f172a', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  stepSub: { color: '#64748b', fontSize: 12, lineHeight: 16, textAlign: 'center', marginTop: 2 },
  stepsLinks: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  linkText: { color: '#2563eb', fontSize: 13, fontWeight: '700' },
});
