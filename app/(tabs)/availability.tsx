import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../utils/api';

// ─── Constants ────────────────────────────────────────────────────────────────
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ACCENT = '#2563eb';

// Hours 06:00 – 23:00 in 30-min steps
const HOURS: string[] = [];
for (let h = 6; h <= 23; h++) {
  HOURS.push(`${String(h).padStart(2, '0')}:00`);
  if (h < 23) HOURS.push(`${String(h).padStart(2, '0')}:30`);
}

// Pixel height per hour in the weekly grid
const HOUR_HEIGHT = 56;
const GRID_START = 6; // 06:00

function timeToY(t: string) {
  const [h, m] = t.split(':').map(Number);
  return (h - GRID_START + m / 60) * HOUR_HEIGHT;
}

// Display a 24h "HH:MM" time as US 12-hour with AM/PM (internal storage stays 24h).
function to12h(t?: string) {
  if (!t) return '';
  const [hStr, m] = t.split(':');
  let h = Number(hStr);
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${period}`;
}

function webConfirm(msg: string): boolean {
  if (Platform.OS === 'web') return window.confirm(msg);
  return true;
}
function webAlert(title: string, msg: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n${msg}`);
  else Alert.alert(title, msg);
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Slot {
  slot_id: string;
  day_of_week: number; // 0=Mon … 6=Sun
  start_time: string;
  end_time: string;
  is_active: boolean;
}

// ─── TimePicker ───────────────────────────────────────────────────────────────
function TimePicker({ label, value, onChange, filterAfter }: {
  label: string; value: string; onChange: (v: string) => void; filterAfter?: string;
}) {
  const [open, setOpen] = useState(false);
  const options = filterAfter ? HOURS.filter(h => h > filterAfter) : HOURS;
  return (
    <View style={tp.wrap}>
      <Text style={tp.label}>{label}</Text>
      <TouchableOpacity style={tp.btn} onPress={() => setOpen(true)}>
        <Text style={[tp.btnText, !value && tp.placeholder]}>{value ? to12h(value) : 'Select'}</Text>
        <Ionicons name="chevron-down" size={16} color="#6b7280" />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={tp.overlay} onPress={() => setOpen(false)} activeOpacity={1}>
          <View style={tp.sheet}>
            <Text style={tp.sheetTitle}>{label}</Text>
            <ScrollView style={tp.list} nestedScrollEnabled>
              {options.map(t => (
                <TouchableOpacity key={t} style={[tp.option, value === t && tp.optionActive]}
                  onPress={() => { onChange(t); setOpen(false); }}>
                  <Text style={[tp.optionText, value === t && tp.optionTextActive]}>{to12h(t)}</Text>
                  {value === t && <Ionicons name="checkmark" size={18} color={ACCENT} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
const tp = StyleSheet.create({
  wrap: { flex: 1 },
  label: { fontSize: 12, fontWeight: '700', color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f3f4f6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14 },
  btnText: { fontSize: 20, fontWeight: '700', color: '#111827' },
  placeholder: { color: '#9ca3af', fontWeight: '400', fontSize: 16 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: 400, paddingTop: 16 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 8 },
  list: { paddingHorizontal: 16 },
  option: { paddingVertical: 14, paddingHorizontal: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  optionActive: { backgroundColor: '#eff6ff', borderRadius: 8 },
  optionText: { fontSize: 16, color: '#374151' },
  optionTextActive: { color: ACCENT, fontWeight: '700' },
});

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Availability() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Selected day in weekly view
  const today = new Date();
  const todayDow = (today.getDay() + 6) % 7; // 0=Mon
  const [selectedDay, setSelectedDay] = useState(todayDow);

  // Add/Edit modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);
  const [formDay, setFormDay] = useState(todayDow);
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [confirmDeleteSlot, setConfirmDeleteSlot] = useState<Slot | null>(null);

  // Service area
  const [mapVisible, setMapVisible] = useState(false);
  const [areaLabel, setAreaLabel] = useState('Not set');
  const [areaRadius, setAreaRadius] = useState(10);
  const [areaLat, setAreaLat] = useState(50.45);
  const [areaLng, setAreaLng] = useState(30.52);

  const load = useCallback(async () => {
    try {
      const res = await api.getMyAvailability();
      setSlots(res.slots || []);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Listen for map postMessage
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = async (e: MessageEvent) => {
      try {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (d?.type !== 'save') return;
        let label = `${d.lat.toFixed(3)}, ${d.lng.toFixed(3)}`;
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${d.lat}&lon=${d.lng}&format=json&accept-language=uk`);
          const j = await r.json();
          const a = j.address;
          label = a.city || a.town || a.village || a.county || label;
        } catch {}
        setAreaLabel(label);
        setAreaRadius(d.radius);
        setAreaLat(d.lat);
        setAreaLng(d.lng);
        try { await api.updateExecutorProfile({ latitude: d.lat, longitude: d.lng, service_radius_km: d.radius }); } catch {}
        setMapVisible(false);
      } catch {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const openAdd = (day?: number) => {
    setEditingSlot(null);
    setFormDay(day ?? selectedDay);
    setFormStart('');
    setFormEnd('');
    setModalVisible(true);
  };

  const openEdit = (slot: Slot) => {
    setEditingSlot(slot);
    setFormDay(slot.day_of_week);
    setFormStart(slot.start_time);
    setFormEnd(slot.end_time);
    setModalVisible(true);
  };

  const hasOverlap = (day: number, start: string, end: string, excludeId?: string) => {
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    return slots.some(s => {
      if (s.day_of_week !== day) return false;
      if (excludeId && s.slot_id === excludeId) return false;
      return toMin(start) < toMin(s.end_time) && toMin(end) > toMin(s.start_time);
    });
  };

  const handleSave = async () => {
    if (!formStart || !formEnd) { webAlert('Error', 'Specify start and end times'); return; }
    if (formStart >= formEnd) { webAlert('Error', 'End time must be later than start time'); return; }
    if (hasOverlap(formDay, formStart, formEnd, editingSlot?.slot_id)) {
      webAlert('Time overlap', `${DAYS_FULL[formDay]} already has a slot overlapping ${formStart}–${formEnd}.`);
      return;
    }
    setSaving(true);
    try {
      const data = { day_of_week: formDay, start_time: formStart, end_time: formEnd, is_active: true };
      if (editingSlot) await api.updateAvailabilitySlot(editingSlot.slot_id, data);
      else await api.createAvailabilitySlot(data);
      setModalVisible(false);
      load();
    } catch (err: any) { webAlert('Error', err.message || 'Could not save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (slot: Slot) => {
    if (Platform.OS === 'web') {
      setConfirmDeleteSlot(slot);
    } else {
      Alert.alert('Delete', `${DAYS_FULL[slot.day_of_week]} ${slot.start_time}–${slot.end_time}`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try { await api.deleteAvailabilitySlot(slot.slot_id); load(); }
          catch (err: any) { webAlert('Error', err.message || 'Could not delete'); }
        }},
      ]);
    }
  };

  const confirmDeleteExecute = async () => {
    if (!confirmDeleteSlot) return;
    try { await api.deleteAvailabilitySlot(confirmDeleteSlot.slot_id); load(); }
    catch (err: any) { webAlert('Error', err.message || 'Could not delete'); }
    finally { setConfirmDeleteSlot(null); }
  };

  // Build 7-day header dates
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    const diff = i - todayDow;
    d.setDate(today.getDate() + diff);
    return d;
  });

  const daySlots = slots.filter(s => s.day_of_week === selectedDay).sort((a, b) => a.start_time.localeCompare(b.start_time));

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color={ACCENT} /></View>;

  return (
    <View style={s.root}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>My schedule</Text>
        <TouchableOpacity style={s.addFab} onPress={() => openAdd()}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Service area banner ── */}
      <TouchableOpacity style={s.areaBanner} onPress={() => setMapVisible(true)}>
        <Ionicons name="location" size={18} color={ACCENT} />
        <Text style={s.areaText}>{areaLabel} · {areaRadius} mi</Text>
        <Text style={s.areaEdit}>Edit</Text>
      </TouchableOpacity>

      {/* ── Week strip ── */}
      <View style={s.weekStrip}>
        {weekDates.map((d, i) => {
          const hasSl = slots.some(sl => sl.day_of_week === i);
          const isToday = i === todayDow;
          const isSel = i === selectedDay;
          return (
            <TouchableOpacity key={i} style={[s.dayCell, isSel && s.dayCellSel]} onPress={() => setSelectedDay(i)}>
              <Text style={[s.dayCellDow, isSel && s.dayCellTextSel]}>{DAYS_SHORT[i]}</Text>
              <Text style={[s.dayCellNum, isSel && s.dayCellTextSel, isToday && !isSel && s.todayNum]}>{d.getDate()}</Text>
              {hasSl && <View style={[s.dotIndicator, isSel && s.dotIndicatorSel]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Day label ── */}
      <View style={s.dayLabelRow}>
        <Text style={s.dayLabel}>{DAYS_FULL[selectedDay]}</Text>
        <TouchableOpacity style={s.addDayBtn} onPress={() => openAdd(selectedDay)}>
          <Ionicons name="add" size={16} color={ACCENT} />
          <Text style={s.addDayBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* ── Time grid ── */}
      <ScrollView
        style={s.gridScroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={s.grid}>
          {/* Hour lines */}
          {Array.from({ length: 18 }, (_, i) => i + 6).map(h => (
            <View key={h} style={[s.hourRow, { top: (h - GRID_START) * HOUR_HEIGHT }]}>
              <Text style={s.hourLabel}>{to12h(`${String(h).padStart(2, '0')}:00`)}</Text>
              <View style={s.hourLine} />
            </View>
          ))}

          {/* Slot blocks */}
          {daySlots.map(slot => {
            const top = timeToY(slot.start_time);
            const height = timeToY(slot.end_time) - top;
            return (
              <View key={slot.slot_id} style={[s.slotBlock, { top, height, opacity: slot.is_active ? 1 : 0.45 }]}>
                <View style={s.slotInner}>
                  <Text style={s.slotTitle}>Available</Text>
                  <Text style={s.slotTime}>{to12h(slot.start_time)} – {to12h(slot.end_time)}</Text>
                </View>
                <View style={s.slotActions}>
                  <TouchableOpacity
                    style={[s.slotActionBtn, Platform.OS === 'web' && { cursor: 'pointer' } as any]}
                    onPress={() => openEdit(slot)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="pencil" size={16} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.slotActionBtn, s.slotDeleteBtn, Platform.OS === 'web' && { cursor: 'pointer' } as any]}
                    onPress={() => handleDelete(slot)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {/* Empty state */}
          {daySlots.length === 0 && (
            <TouchableOpacity style={s.emptyBlock} onPress={() => openAdd(selectedDay)}>
              <Ionicons name="add-circle-outline" size={32} color="#d1d5db" />
              <Text style={s.emptyText}>Tap to add availability</Text>
            </TouchableOpacity>
          )}

          {/* Spacer */}
          <View style={{ height: (23 - GRID_START + 1) * HOUR_HEIGHT }} />
        </View>
      </ScrollView>

      {/* ── Add/Edit Modal ── */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={m.overlay}>
          <View style={m.sheet}>
            <View style={m.handle} />
            <View style={m.header}>
              <Text style={m.title}>{editingSlot ? 'Edit' : 'Add availability'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={m.closeBtn}>
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Day selector */}
            <Text style={m.sectionLabel}>DAY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={m.dayScroll}>
              {DAYS_SHORT.map((d, i) => (
                <TouchableOpacity key={i} style={[m.dayChip, formDay === i && m.dayChipActive]} onPress={() => setFormDay(i)}>
                  <Text style={[m.dayChipText, formDay === i && m.dayChipTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Time pickers */}
            <Text style={m.sectionLabel}>TIME</Text>
            <View style={m.timeRow}>
              <TimePicker label="From" value={formStart} onChange={v => { setFormStart(v); if (formEnd && formEnd <= v) setFormEnd(''); }} />
              <View style={m.timeSep}><Text style={m.timeSepText}>to</Text></View>
              <TimePicker label="To" value={formEnd} onChange={setFormEnd} filterAfter={formStart || undefined} />
            </View>

            {/* Summary */}
            {formStart && formEnd && (
              <View style={m.summary}>
                <Ionicons name="time-outline" size={18} color={ACCENT} />
                <Text style={m.summaryText}>{DAYS_FULL[formDay]}: {to12h(formStart)} – {to12h(formEnd)}</Text>
              </View>
            )}

            {/* Buttons */}
            <View style={m.footer}>
              <TouchableOpacity style={m.discardBtn} onPress={() => setModalVisible(false)}>
                <Text style={m.discardText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[m.saveBtn, (!formStart || !formEnd || saving) && m.saveBtnDisabled]}
                onPress={handleSave}
                disabled={!formStart || !formEnd || saving}
              >
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={m.saveText}>{editingSlot ? 'Save' : 'Add'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Confirm Delete Modal ── */}
      <Modal visible={!!confirmDeleteSlot} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 }}>Delete slot?</Text>
            <Text style={{ fontSize: 15, color: '#6b7280', marginBottom: 24 }}>
              {confirmDeleteSlot ? `${DAYS_FULL[confirmDeleteSlot.day_of_week]}: ${to12h(confirmDeleteSlot.start_time)} – ${to12h(confirmDeleteSlot.end_time)}` : ''}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center' }}
                onPress={() => setConfirmDeleteSlot(null)}
              >
                <Text style={{ fontSize: 15, color: '#374151', fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#ef4444', alignItems: 'center' }}
                onPress={confirmDeleteExecute}
              >
                <Text style={{ fontSize: 15, color: '#fff', fontWeight: '700' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Map Modal ── */}
      <Modal visible={mapVisible} animationType="slide">
        <View style={{ flex: 1 }}>
          <View style={s.mapHeader}>
            <TouchableOpacity onPress={() => setMapVisible(false)} style={s.mapBack}>
              <Ionicons name="arrow-back" size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={s.mapHeaderTitle}>Service area</Text>
          </View>
          {Platform.OS === 'web' ? (
            <iframe title="map" src={`/map.html?lat=${areaLat}&lng=${areaLng}&radius=${areaRadius}`}
              style={{ width: '100%', height: '100%', border: 'none' } as any} allow="geolocation" />
          ) : (
            <View style={s.mapNative}>
              <Ionicons name="map" size={64} color={ACCENT} />
              <Text style={s.mapNativeTitle}>The map is available in the web version</Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, backgroundColor: '#fff' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#111827' },
  addFab: { width: 40, height: 40, borderRadius: 20, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },

  areaBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, backgroundColor: '#eff6ff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  areaText: { flex: 1, fontSize: 14, color: '#1e40af', fontWeight: '600' },
  areaEdit: { fontSize: 13, color: ACCENT, fontWeight: '700' },

  weekStrip: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 8, paddingTop: 4 },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 12, marginHorizontal: 2 },
  dayCellSel: { backgroundColor: ACCENT },
  dayCellDow: { fontSize: 11, fontWeight: '600', color: '#9ca3af', marginBottom: 2 },
  dayCellNum: { fontSize: 17, fontWeight: '700', color: '#111827' },
  dayCellTextSel: { color: '#fff' },
  todayNum: { color: ACCENT },
  dotIndicator: { width: 5, height: 5, borderRadius: 3, backgroundColor: ACCENT, marginTop: 3 },
  dotIndicatorSel: { backgroundColor: '#fff' },

  dayLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  dayLabel: { fontSize: 17, fontWeight: '700', color: '#111827' },
  addDayBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: ACCENT },
  addDayBtnText: { fontSize: 13, fontWeight: '700', color: ACCENT },

  gridScroll: { flex: 1 },
  grid: { position: 'relative', marginLeft: 56, marginRight: 16, zIndex: 1 },
  hourRow: { position: 'absolute', left: -70, right: 0, flexDirection: 'row', alignItems: 'center', height: HOUR_HEIGHT },
  hourLabel: { width: 62, fontSize: 10, color: '#9ca3af', textAlign: 'right', paddingRight: 8 },
  hourLine: { flex: 1, height: 1, backgroundColor: '#f3f4f6' },

  slotBlock: {
    position: 'absolute', left: 0, right: 0,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    // overflow: 'hidden' removed — it blocks pointer-events on web for child buttons
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 8,
    zIndex: 10,
  },
  slotInner: { flex: 1 },
  slotTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  slotTime: { fontSize: 12, color: '#bfdbfe', marginTop: 2 },
  slotActions: { flexDirection: 'column', gap: 6, justifyContent: 'center', zIndex: 20 },
  slotActionBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', zIndex: 20 },
  slotDeleteBtn: { backgroundColor: 'rgba(239,68,68,0.7)' },

  emptyBlock: { position: 'absolute', left: 0, right: 0, top: 2 * HOUR_HEIGHT, alignItems: 'center', gap: 8, paddingVertical: 32 },
  emptyText: { fontSize: 14, color: '#9ca3af' },

  mapHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  mapBack: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  mapHeaderTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  mapNative: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  mapNativeTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
});

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 32 },
  handle: { width: 40, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },

  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#9ca3af', letterSpacing: 0.8, marginHorizontal: 24, marginBottom: 10, marginTop: 4 },

  dayScroll: { paddingLeft: 20, marginBottom: 20 },
  dayChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, backgroundColor: '#f3f4f6', marginRight: 8, borderWidth: 1.5, borderColor: '#e5e7eb' },
  dayChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  dayChipText: { fontSize: 15, fontWeight: '700', color: '#374151' },
  dayChipTextActive: { color: '#fff' },

  timeRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 24, gap: 8, marginBottom: 16 },
  timeSep: { paddingBottom: 14, paddingHorizontal: 4 },
  timeSepText: { fontSize: 16, color: '#6b7280', fontWeight: '500' },

  summary: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 24, backgroundColor: '#eff6ff', borderRadius: 12, padding: 14, marginBottom: 16 },
  summaryText: { fontSize: 15, fontWeight: '700', color: ACCENT },

  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: 24, marginTop: 8 },
  discardBtn: { flex: 1, padding: 16, borderRadius: 14, backgroundColor: '#f3f4f6', alignItems: 'center' },
  discardText: { fontSize: 16, fontWeight: '700', color: '#374151' },
  saveBtn: { flex: 1, padding: 16, borderRadius: 14, backgroundColor: ACCENT, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.5 },
  saveText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
