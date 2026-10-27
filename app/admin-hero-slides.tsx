import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, Switch, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api, BACKEND_BASE_URL } from '../utils/api';
import { showAlert, showConfirm } from '../utils/alert';
import { compressBase64Image } from '../utils/imageCompress';

type Slide = {
  slide_id?: string; tag: string; title: string; accent: string; active: boolean;
  start_date: string | null; end_date: string | null; order: number; image_url?: string;
};

const EMPTY: Slide = { tag: '', title: '', accent: '', active: true, start_date: null, end_date: null, order: 0 };
const today = () => new Date().toISOString().slice(0, 10);

const statusOf = (sl: Slide) => {
  const t = today();
  if (!sl.active) return { label: 'Off', color: '#6b7280', bg: '#f3f4f6' };
  if (sl.start_date && sl.start_date > t) return { label: `Starts ${sl.start_date}`, color: '#b45309', bg: '#fef3c7' };
  if (sl.end_date && sl.end_date < t) return { label: 'Ended', color: '#6b7280', bg: '#f3f4f6' };
  return { label: 'Live now', color: '#15803d', bg: '#dcfce7' };
};

const errMsg = (e: any) => e?.response?.data?.detail || e?.message || 'Something went wrong';

function SlideRow({ sl, onEdit, onToggle, onDelete }: { sl: Slide; onEdit: () => void; onToggle: (v: boolean) => void; onDelete: () => void }) {
  const st = statusOf(sl);
  const dates = sl.start_date || sl.end_date ? `${sl.start_date || '…'} → ${sl.end_date || '…'}` : 'Always (no dates)';
  return (
    <View style={s.row} data-testid={`hero-slide-row-${sl.slide_id}`}>
      <Image source={{ uri: `${BACKEND_BASE_URL}${sl.image_url}` }} style={s.thumb} />
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={1}>{sl.title}</Text>
        <Text style={s.rowSub} numberOfLines={1}>{sl.accent}</Text>
        <View style={s.rowMeta}>
          <View style={[s.badge, { backgroundColor: st.bg }]}><Text style={[s.badgeText, { color: st.color }]}>{st.label}</Text></View>
          <Text style={s.rowDates}>{dates}</Text>
        </View>
      </View>
      <View style={s.rowActions}>
        <Switch value={sl.active} onValueChange={onToggle} data-testid={`hero-slide-toggle-${sl.slide_id}`} />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity onPress={onEdit} style={s.iconBtn} data-testid={`hero-slide-edit-${sl.slide_id}`}><Ionicons name="create-outline" size={18} color="#2563eb" /></TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={s.iconBtn} data-testid={`hero-slide-delete-${sl.slide_id}`}><Ionicons name="trash-outline" size={18} color="#dc2626" /></TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function Field({ label, value, onChange, placeholder, tid, max }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; tid: string; max?: number }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput style={s.input} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#9ca3af" maxLength={max} data-testid={tid} />
    </View>
  );
}

function SlideForm({ initial, onDone, onCancel }: { initial: Slide; onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState<Slide>(initial);
  const [img, setImg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Slide, v: any) => setF((p) => ({ ...p, [k]: v }));
  const preview = img || (f.image_url ? `${BACKEND_BASE_URL}${f.image_url}` : null);

  const pick = async () => {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85, base64: true });
      if (r.canceled || !r.assets?.[0]) return;
      const a = r.assets[0];
      const raw = a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri;
      setImg(await compressBase64Image(raw, 1600, 0.82));
    } catch (e: any) {
      showAlert('Error', e?.message || 'Could not select a photo');
    }
  };

  const save = async () => {
    if (!f.title.trim()) return showAlert('Missing title', 'Please add a title for the slide.');
    if (!f.slide_id && !img) return showAlert('Missing photo', 'Please add a photo for the slide.');
    const re = /^\d{4}-\d{2}-\d{2}$/;
    for (const d of [f.start_date, f.end_date]) if (d && !re.test(d)) return showAlert('Wrong date', 'Use the format YYYY-MM-DD, e.g. 2026-11-01.');
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        tag: f.tag, title: f.title, accent: f.accent, active: f.active, order: Number(f.order) || 0,
        start_date: f.start_date || null, end_date: f.end_date || null,
      };
      if (img) payload.image_base64 = img;
      if (f.slide_id) await api.adminUpdateHeroSlide(f.slide_id, payload);
      else await api.adminCreateHeroSlide(payload);
      showAlert('Saved', 'Slide saved.');
      onDone();
    } catch (e) {
      showAlert('Error', errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.card} data-testid="hero-slide-form">
      <Text style={s.cardTitle}>{f.slide_id ? 'Edit slide' : 'New slide'}</Text>
      <TouchableOpacity style={s.photoBox} onPress={pick} data-testid="hero-slide-pick-photo">
        {preview ? <Image source={{ uri: preview }} style={s.photo} resizeMode="cover" /> : (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Ionicons name="image-outline" size={32} color="#2563eb" />
            <Text style={s.photoText}>Upload photo</Text>
            <Text style={s.photoHint}>Wide photo works best · pro on the right side</Text>
          </View>
        )}
      </TouchableOpacity>
      {preview && <Text style={s.photoChange} onPress={pick}>Change photo</Text>}

      <Field label="Label (small tag)" value={f.tag} onChange={(v) => set('tag', v)} placeholder="Heating" tid="hero-slide-tag-input" max={40} />
      <Field label="Title" value={f.title} onChange={(v) => set('title', v)} placeholder="Furnace not heating?" tid="hero-slide-title-input" max={80} />
      <Field label="Blue line" value={f.accent} onChange={(v) => set('accent', v)} placeholder="Get warm again today." tid="hero-slide-accent-input" max={80} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field label="Show from (YYYY-MM-DD)" value={f.start_date || ''} onChange={(v) => set('start_date', v.trim() || null)} placeholder="2026-11-01" tid="hero-slide-start-input" max={10} />
        <Field label="Show until (YYYY-MM-DD)" value={f.end_date || ''} onChange={(v) => set('end_date', v.trim() || null)} placeholder="2027-02-28" tid="hero-slide-end-input" max={10} />
      </View>
      <Text style={s.hint}>Leave dates empty to show the slide all the time while it is on.</Text>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
        <Field label="Order (lower = first)" value={String(f.order ?? 0)} onChange={(v) => set('order', v.replace(/[^0-9]/g, ''))} tid="hero-slide-order-input" max={3} />
        <View style={s.activeBox}>
          <Text style={s.label}>On</Text>
          <Switch value={f.active} onValueChange={(v) => set('active', v)} data-testid="hero-slide-active-switch" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
        <TouchableOpacity style={s.cancelBtn} onPress={onCancel} data-testid="hero-slide-cancel-btn"><Text style={s.cancelText}>Cancel</Text></TouchableOpacity>
        <TouchableOpacity style={s.saveBtn} onPress={save} disabled={saving} data-testid="hero-slide-save-btn">
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Save slide</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function AdminHeroSlidesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [editing, setEditing] = useState<Slide | null>(null);

  const load = async () => {
    try {
      const d = await api.adminGetHeroSlides();
      setSlides(d.slides || []);
    } catch (e) {
      showAlert('Error', errMsg(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const toggle = async (sl: Slide, v: boolean) => {
    setSlides((p) => p.map((x) => (x.slide_id === sl.slide_id ? { ...x, active: v } : x)));
    try { await api.adminUpdateHeroSlide(sl.slide_id!, { active: v }); } catch (e) { showAlert('Error', errMsg(e)); load(); }
  };
  const remove = (sl: Slide) => showConfirm('Delete slide?', `"${sl.title}" will be removed from the homepage.`, async () => {
    try { await api.adminDeleteHeroSlide(sl.slide_id!); load(); } catch (e) { showAlert('Error', errMsg(e)); }
  }, 'Delete', 'Cancel');

  const liveCount = slides.filter((x) => statusOf(x).label === 'Live now').length;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} data-testid="hero-slides-back-btn">
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={s.title}>Homepage slides</Text>
      </View>
      {loading ? <View style={s.center}><ActivityIndicator color="#2563eb" /></View> : (
        <ScrollView contentContainerStyle={s.content}>
          <View style={s.info} data-testid="hero-slides-info">
            <Ionicons name="information-circle" size={18} color="#2563eb" />
            <Text style={s.infoText}>
              {liveCount > 0
                ? `${liveCount} slide${liveCount > 1 ? 's are' : ' is'} live on the homepage right now.`
                : 'No slides are live right now — guests see the 4 default slides.'}
              {' '}Use dates for seasons (e.g. heating Nov–Feb, AC Jun–Aug) or switch slides on/off by hand.
            </Text>
          </View>

          {editing ? (
            <SlideForm initial={editing} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />
          ) : (
            <TouchableOpacity style={s.addBtn} onPress={() => setEditing({ ...EMPTY })} data-testid="hero-slide-add-btn">
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={s.addText}>Add slide</Text>
            </TouchableOpacity>
          )}

          {slides.length === 0 && !editing && <Text style={s.empty}>No custom slides yet.</Text>}
          {slides.map((sl) => (
            <SlideRow key={sl.slide_id} sl={sl} onEdit={() => setEditing(sl)} onToggle={(v) => toggle(sl, v)} onDelete={() => remove(sl)} />
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  back: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  content: { padding: 16, maxWidth: 820, width: '100%', alignSelf: 'center' },
  info: { flexDirection: 'row', gap: 8, backgroundColor: '#eff6ff', borderRadius: 12, padding: 12, marginBottom: 14 },
  infoText: { flex: 1, color: '#1e3a8a', fontSize: 13, lineHeight: 19 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 13, marginBottom: 14 },
  addText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  empty: { color: '#6b7280', textAlign: 'center', marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', padding: 10, marginBottom: 10 },
  thumb: { width: 96, height: 64, borderRadius: 10, backgroundColor: '#e5e7eb' },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  rowSub: { fontSize: 13, color: '#2563eb', marginTop: 1 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  rowDates: { fontSize: 11, color: '#6b7280' },
  rowActions: { alignItems: 'flex-end', gap: 6 },
  iconBtn: { padding: 6, borderRadius: 8, backgroundColor: '#f3f4f6' },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 12 },
  photoBox: { height: 180, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#93c5fd', backgroundColor: '#f8fbff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 6 },
  photo: { width: '100%', height: '100%' },
  photoText: { color: '#2563eb', fontWeight: '700' },
  photoHint: { color: '#6b7280', fontSize: 12 },
  photoChange: { color: '#2563eb', fontWeight: '700', fontSize: 13, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 12, fontSize: 14, color: '#111827', marginBottom: 12 },
  hint: { fontSize: 12, color: '#6b7280', marginTop: -6, marginBottom: 12 },
  activeBox: { alignItems: 'center', paddingBottom: 16, paddingHorizontal: 8 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  cancelText: { color: '#374151', fontWeight: '700' },
  saveBtn: { flex: 2, backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
