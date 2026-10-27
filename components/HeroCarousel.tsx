import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, BACKEND_BASE_URL } from '../utils/api';

type Slide = { key: string; img: any; tag: string; title: string; accent: string };

const DEFAULT_SLIDES: Slide[] = [
  { key: 'electrical', img: require('../assets/images/hero/electrical.jpg'), tag: 'Electrical', title: 'Light not working?', accent: 'Snap it. Get it fixed.' },
  { key: 'plumbing', img: require('../assets/images/hero/plumbing.jpg'), tag: 'Plumbing', title: 'Leaky sink?', accent: 'A pro is one photo away.' },
  { key: 'furniture', img: require('../assets/images/hero/furniture.jpg'), tag: 'Furniture Assembly', title: 'Furniture to assemble?', accent: 'Matched in minutes.' },
  { key: 'wallrepair', img: require('../assets/images/hero/wallrepair.jpg'), tag: 'Home Repairs', title: 'Holes or cracks?', accent: 'Fixed like new.' },
];
const INTERVAL = 5000;

const Fade = ({ wide }: { wide: boolean }) => {
  const bg = wide
    ? 'linear-gradient(90deg, #ffffff 0%, #ffffff 36%, rgba(255,255,255,0.75) 46%, rgba(255,255,255,0) 62%)'
    : 'linear-gradient(0deg, rgba(15,23,42,0.88) 0%, rgba(15,23,42,0.55) 55%, rgba(15,23,42,0.1) 100%)';
  if (Platform.OS === 'web') return React.createElement('div', { style: { position: 'absolute', inset: 0, backgroundImage: bg } });
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: wide ? 'rgba(255,255,255,0.6)' : 'rgba(15,23,42,0.55)' }]} />;
};

export const HeroCarousel = ({ onIdentify }: { onIdentify: () => void }) => {
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
  return <HeroSlides key={slides.map((x) => x.key).join('|')} slides={slides} onIdentify={onIdentify} />;
};

const HeroSlides = ({ slides: SLIDES, onIdentify }: { slides: Slide[]; onIdentify: () => void }) => {
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const height = wide ? Math.min(Math.max(width * 0.34, 400), 520) : 440;
  const [idx, setIdx] = useState(0);
  const anims = useRef(SLIDES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    if (SLIDES.length > 1) timer.current = setInterval(() => setIdx((p) => (p + 1) % SLIDES.length), INTERVAL);
  }, []);

  useEffect(() => { start(); return () => { if (timer.current) clearInterval(timer.current); }; }, [start]);

  useEffect(() => {
    Animated.parallel(anims.map((a, i) => Animated.timing(a, { toValue: i === idx ? 1 : 0, duration: 700, useNativeDriver: Platform.OS !== 'web' }))).start();
  }, [idx, anims]);

  const go = (d: number) => { setIdx((p) => (p + d + SLIDES.length) % SLIDES.length); start(); };
  const slide = SLIDES[idx];
  const dark = !wide;

  return (
    <View style={[s.wrap, { height }]} data-testid="hero-carousel">
      {SLIDES.map((sl, i) => (
        <Animated.View key={sl.key} style={[wide ? s.imgWide : s.imgNarrow, { opacity: anims[i], transform: [{ scale: anims[i].interpolate({ inputRange: [0, 1], outputRange: [1.06, 1] }) }] }]}>
          <Image source={sl.img} style={s.img} resizeMode="cover" accessibilityLabel={`Ono-Fix pro: ${sl.tag}`} />
        </Animated.View>
      ))}
      <Fade wide={wide} />

      {SLIDES.length > 1 && <View style={s.counter} data-testid="hero-counter"><Text style={s.counterText}>{idx + 1}/{SLIDES.length}</Text></View>}

      <View style={[s.content, wide ? s.contentWide : s.contentNarrow]}>
        {!!slide.tag && (
          <View style={[s.tag, dark && s.tagDark]}>
            <Ionicons name="sparkles" size={12} color={dark ? '#fff' : '#2563eb'} />
            <Text numberOfLines={1} style={[s.tagText, dark && { color: '#fff' }]} data-testid="hero-slide-tag">{slide.tag}</Text>
          </View>
        )}
        <Text style={[s.title, !wide && s.titleSm, dark && { color: '#fff' }]} data-testid="hero-slide-title">{slide.title}</Text>
        <Text style={[s.accent, !wide && s.titleSm, dark && { color: '#93c5fd' }]}>{slide.accent}</Text>
        <Text style={[s.sub, dark && { color: 'rgba(255,255,255,0.88)' }]}>Take a photo — AI finds the right service and connects you with a local pro.</Text>
        <TouchableOpacity style={s.cta} onPress={onIdentify} activeOpacity={0.85} data-testid="hero-identify-btn">
          <Ionicons name="camera" size={20} color="#fff" />
          <Text style={s.ctaText}>Identify my problem</Text>
        </TouchableOpacity>
        <Text style={[s.note, dark && { color: 'rgba(255,255,255,0.75)' }]}>Free to get started · No phone call needed</Text>
      </View>

      {wide && SLIDES.length > 1 && (
        <>
          <TouchableOpacity style={[s.arrow, { left: 12 }]} onPress={() => go(-1)} data-testid="hero-prev-btn" accessibilityLabel="Previous slide">
            <Ionicons name="chevron-back" size={22} color="#0f172a" />
          </TouchableOpacity>
          <TouchableOpacity style={[s.arrow, { right: 12 }]} onPress={() => go(1)} data-testid="hero-next-btn" accessibilityLabel="Next slide">
            <Ionicons name="chevron-forward" size={22} color="#0f172a" />
          </TouchableOpacity>
        </>
      )}

      {SLIDES.length > 1 && (
        <View style={s.dots}>
          {SLIDES.map((sl, i) => (
            <TouchableOpacity key={sl.key} onPress={() => { setIdx(i); start(); }} style={[s.dot, wide && s.dotWide, i === idx && s.dotActive]} data-testid={`hero-dot-${i}`} accessibilityLabel={`Slide ${i + 1}`} />
          ))}
        </View>
      )}
    </View>
  );
};

const BENEFITS = [
  { icon: 'gift-outline', title: 'Earn rewards', sub: 'Up to $100' },
  { icon: 'flash-outline', title: 'Save time', sub: 'No guesswork' },
  { icon: 'shield-checkmark-outline', title: 'The right pro', sub: 'For your exact need' },
  { icon: 'call-outline', title: 'No phone call', sub: 'Needed to start' },
] as const;

export const HeroBenefits = () => (
  <View style={s.benefits} data-testid="hero-benefits">
    {BENEFITS.map((b) => (
      <View key={b.title} style={s.benefit}>
        <View style={s.benefitIcon}><Ionicons name={b.icon} size={18} color="#2563eb" /></View>
        <View style={{ flexShrink: 1 }}>
          <Text style={s.benefitTitle}>{b.title}</Text>
          <Text style={s.benefitSub}>{b.sub}</Text>
        </View>
      </View>
    ))}
  </View>
);

const s = StyleSheet.create({
  wrap: { borderRadius: 22, overflow: 'hidden', backgroundColor: '#fff', marginBottom: 14, borderWidth: 1, borderColor: '#eef2f7' },
  img: { width: '100%', height: '100%' },
  imgNarrow: { position: 'absolute', top: 0, bottom: 0, right: 0, width: '165%' },
  imgWide: { position: 'absolute', top: 0, bottom: 0, right: 0, width: '66%' },
  counter: { position: 'absolute', top: 14, left: 14, backgroundColor: 'rgba(15,23,42,0.55)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  counterText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  content: { position: 'absolute' },
  contentWide: { left: 64, top: 0, bottom: 0, width: '40%', maxWidth: 520, justifyContent: 'center' },
  contentNarrow: { left: 20, right: 20, bottom: 40 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, marginBottom: 12 },
  tagDark: { backgroundColor: 'rgba(255,255,255,0.18)' },
  tagText: { color: '#2563eb', fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  title: { color: '#0f172a', fontSize: 40, fontWeight: '800', lineHeight: 46, letterSpacing: -0.8 },
  titleSm: { fontSize: 28, lineHeight: 33 },
  accent: { color: '#2563eb', fontSize: 40, fontWeight: '800', lineHeight: 46, letterSpacing: -0.8, marginBottom: 12 },
  sub: { color: '#334155', fontSize: 15, lineHeight: 22, marginBottom: 18, maxWidth: 420 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#2563eb', paddingVertical: 15, paddingHorizontal: 26, borderRadius: 14, alignSelf: 'flex-start', shadowColor: '#2563eb', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  note: { color: '#64748b', fontSize: 12, marginTop: 10 },
  arrow: { position: 'absolute', top: '50%', marginTop: -20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },
  dots: { position: 'absolute', bottom: 14, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.6)' },
  dotWide: { backgroundColor: 'rgba(15,23,42,0.22)' },
  dotActive: { width: 24, backgroundColor: '#2563eb' },
  benefits: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', paddingVertical: 12, paddingHorizontal: 8, marginBottom: 18 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 10, flexGrow: 1, flexBasis: 170, paddingHorizontal: 8, paddingVertical: 6 },
  benefitIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  benefitTitle: { color: '#0f172a', fontSize: 13, fontWeight: '700' },
  benefitSub: { color: '#64748b', fontSize: 12 },
});
