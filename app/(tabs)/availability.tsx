import React, { useEffect, useState, useRef } from 'react';
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
import { useAuthStore } from '../../store/authStore';

const DAYS = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота', 'Неділя'];
const DAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const DAY_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

// Time slots: 06:00 – 23:00 in 30-min steps
const HOURS: string[] = [];
for (let h = 6; h <= 23; h++) {
  HOURS.push(`${h.toString().padStart(2, '0')}:00`);
  if (h < 23) HOURS.push(`${h.toString().padStart(2, '0')}:30`);
}

function webAlert(title: string, msg: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${msg}`);
  } else {
    Alert.alert(title, msg);
  }
}

function webConfirm(msg: string): boolean {
  if (Platform.OS === 'web') {
    return window.confirm(msg);
  }
  return true; // on native, use Alert.alert with callback instead
}

interface AvailabilitySlot {
  slot_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location?: string;
  is_active: boolean;
}

interface ServiceArea {
  lat: number;
  lng: number;
  radius: number;
  label: string;
}

// ─── Map iframe (web only) ────────────────────────────────────────────────────
function MapIframe({ lat, lng, radius, onSave }: {
  lat: number; lng: number; radius: number;
  onSave: (lat: number, lng: number, radius: number) => void;
}) {
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type === 'save') onSave(data.lat, data.lng, data.radius);
      } catch {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onSave]);

  return (
    <iframe
      title="service-area-map"
      src={`/map.html?lat=${lat}&lng=${lng}&radius=${radius}`}
      style={{ width: '100%', height: '100%', border: 'none' } as any}
      allow="geolocation"
    />
  );
}

// ─── Time grid chip picker ────────────────────────────────────────────────────
function TimeGrid({ value, onChange, label, filterAfter }: {
  value: string; onChange: (v: string) => void; label: string; filterAfter?: string;
}) {
  const filtered = filterAfter ? HOURS.filter(h => h > filterAfter) : HOURS;
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.timeGrid}>
        {filtered.map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.timeChip, value === t && styles.timeChipActive]}
            onPress={() => onChange(t)}
          >
            <Text style={[styles.timeChipText, value === t && styles.timeChipTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Availability() {
  const { user } = useAuthStore();
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [editingSlot, setEditingSlot] = useState<AvailabilitySlot | null>(null);
  const [savingSlot, setSavingSlot] = useState(false);
  const [savingArea, setSavingArea] = useState(false);

  // Form state
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [isActive, setIsActive] = useState(true);

  // Service area state
  const [serviceArea, setServiceArea] = useState<ServiceArea>({
    lat: 50.45, lng: 30.52, radius: 10, label: 'Київ',
  });

  const loadAvailability = async () => {
    try {
      const response = await api.getMyAvailability();
      setSlots(response.slots || []);
    } catch (error: any) {
      console.error('Failed to load availability:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadAvailability(); }, []);

  const onRefresh = () => { setRefreshing(true); loadAvailability(); };

  const openModal = (slot?: AvailabilitySlot, presetDay?: number) => {
    if (slot) {
      setEditingSlot(slot);
      setDayOfWeek(slot.day_of_week);
      setStartTime(slot.start_time);
      setEndTime(slot.end_time);
      setIsActive(slot.is_active);
    } else {
      setEditingSlot(null);
      setDayOfWeek(presetDay ?? 0);
      setStartTime('09:00');
      setEndTime('18:00');
      setIsActive(true);
    }
    setModalVisible(true);
  };

  const hasOverlap = (day: number, start: string, end: string, excludeId?: string): boolean => {
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const ns = toMin(start), ne = toMin(end);
    return slots.some(s => {
      if (s.day_of_week !== day) return false;
      if (excludeId && s.slot_id === excludeId) return false;
      return ns < toMin(s.end_time) && ne > toMin(s.start_time);
    });
  };

  const handleSave = async () => {
    if (startTime >= endTime) {
      webAlert('Помилка', 'Час закінчення має бути більше часу початку');
      return;
    }
    if (hasOverlap(dayOfWeek, startTime, endTime, editingSlot?.slot_id)) {
      webAlert('Перетин часу', `На ${DAYS[dayOfWeek]} вже є слот, що перетинається з ${startTime}–${endTime}.`);
      return;
    }
    setSavingSlot(true);
    try {
      const slotData = { day_of_week: dayOfWeek, start_time: startTime, end_time: endTime, location: serviceArea.label, is_active: isActive };
      if (editingSlot) {
        await api.updateAvailabilitySlot(editingSlot.slot_id, slotData);
      } else {
        await api.createAvailabilitySlot(slotData);
      }
      setModalVisible(false);
      loadAvailability();
    } catch (error: any) {
      webAlert('Помилка', error.message || 'Не вдалося зберегти');
    } finally {
      setSavingSlot(false);
    }
  };

  const handleDelete = async (slotId: string) => {
    const doDelete = async () => {
      try {
        await api.deleteAvailabilitySlot(slotId);
        loadAvailability();
      } catch (error: any) {
        webAlert('Помилка', error.message || 'Не вдалося видалити');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Видалити цей часовий слот?')) doDelete();
    } else {
      Alert.alert('Видалити слот', 'Ви впевнені?', [
        { text: 'Скасувати', style: 'cancel' },
        { text: 'Видалити', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const toggleSlotActive = async (slot: AvailabilitySlot) => {
    try {
      await api.updateAvailabilitySlot(slot.slot_id, { is_active: !slot.is_active });
      loadAvailability();
    } catch {}
  };

  const handleMapSave = async (lat: number, lng: number, radius: number) => {
    setSavingArea(true);
    try {
      let label = `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=uk`);
        const data = await res.json();
        const addr = data.address;
        label = addr.city || addr.town || addr.village || addr.county || label;
      } catch {}
      setServiceArea({ lat, lng, radius, label });
      try { await api.updateExecutorProfile({ latitude: lat, longitude: lng, service_radius_km: radius }); } catch {}
      setMapModalVisible(false);
      webAlert('Збережено', `Зона роботи: ${label} · ${radius} км`);
    } finally {
      setSavingArea(false);
    }
  };

  const slotsByDay = DAYS.map((_, i) => slots.filter(s => s.day_of_week === i));

  // Convert time string to percentage of day (6:00=0% to 23:00=100%)
  const timeToPercent = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return ((h - 6) * 60 + m) / ((23 - 6) * 60) * 100;
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Мій графік</Text>
          <Text style={styles.headerSub}>Вкажіть коли ви доступні для роботи</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => openModal()}>
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.addButtonText}>Додати</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Service Area Card */}
        <TouchableOpacity style={styles.serviceAreaCard} onPress={() => setMapModalVisible(true)}>
          <View style={styles.serviceAreaLeft}>
            <View style={styles.serviceAreaIconWrap}>
              <Ionicons name="map" size={22} color="#2563eb" />
            </View>
            <View>
              <Text style={styles.serviceAreaTitle}>Зона роботи</Text>
              <Text style={styles.serviceAreaSub}>{serviceArea.label} · радіус {serviceArea.radius} км</Text>
            </View>
          </View>
          <View style={styles.editBadge}>
            <Text style={styles.editBadgeText}>Змінити</Text>
          </View>
        </TouchableOpacity>

        {/* Week summary bar */}
        <View style={styles.weekBar}>
          {DAYS_SHORT.map((d, i) => {
            const hasSlots = slotsByDay[i].length > 0;
            const activeSlots = slotsByDay[i].filter(s => s.is_active).length;
            return (
              <TouchableOpacity key={i} style={styles.weekBarDay} onPress={() => openModal(undefined, i)}>
                <View style={[styles.weekBarDot, { backgroundColor: hasSlots ? DAY_COLORS[i] : '#e5e7eb' }]}>
                  {hasSlots && <Text style={styles.weekBarCount}>{activeSlots}</Text>}
                </View>
                <Text style={[styles.weekBarLabel, hasSlots && { color: DAY_COLORS[i], fontWeight: '700' }]}>{d}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Day cards */}
        {DAYS.map((day, dayIndex) => {
          const daySlots = slotsByDay[dayIndex];
          const color = DAY_COLORS[dayIndex];
          return (
            <View key={dayIndex} style={styles.dayCard}>
              {/* Day header */}
              <View style={[styles.dayHeader, { borderLeftColor: color, borderLeftWidth: 4 }]}>
                <View style={styles.dayHeaderLeft}>
                  <View style={[styles.dayBadge, { backgroundColor: color + '18' }]}>
                    <Text style={[styles.dayBadgeText, { color }]}>{DAYS_SHORT[dayIndex]}</Text>
                  </View>
                  <View>
                    <Text style={styles.dayName}>{day}</Text>
                    <Text style={styles.daySlotCount}>
                      {daySlots.length === 0 ? 'Вихідний' : `${daySlots.length} слот${daySlots.length > 1 ? 'и' : ''}`}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={[styles.addDayBtn, { backgroundColor: color + '18' }]} onPress={() => openModal(undefined, dayIndex)}>
                  <Ionicons name="add" size={18} color={color} />
                </TouchableOpacity>
              </View>

              {/* Visual timeline */}
              {daySlots.length > 0 && (
                <View style={styles.timeline}>
                  <View style={styles.timelineTrack}>
                    {daySlots.map(slot => {
                      const left = timeToPercent(slot.start_time);
                      const width = timeToPercent(slot.end_time) - left;
                      return (
                        <View
                          key={slot.slot_id}
                          style={[
                            styles.timelineBlock,
                            { left: `${left}%` as any, width: `${Math.max(width, 3)}%` as any, backgroundColor: slot.is_active ? color : '#d1d5db' },
                          ]}
                        />
                      );
                    })}
                  </View>
                  <View style={styles.timelineLabels}>
                    <Text style={styles.timelineLabel}>06:00</Text>
                    <Text style={styles.timelineLabel}>12:00</Text>
                    <Text style={styles.timelineLabel}>18:00</Text>
                    <Text style={styles.timelineLabel}>23:00</Text>
                  </View>
                </View>
              )}

              {/* Slot chips */}
              {daySlots.length > 0 && (
                <View style={styles.slotChips}>
                  {daySlots.map(slot => (
                    <View key={slot.slot_id} style={[styles.slotChip, { borderColor: slot.is_active ? color : '#d1d5db' }]}>
                      <TouchableOpacity onPress={() => toggleSlotActive(slot)} style={styles.slotChipToggle}>
                        <View style={[styles.slotChipDot, { backgroundColor: slot.is_active ? color : '#d1d5db' }]} />
                      </TouchableOpacity>
                      <Text style={[styles.slotChipTime, { color: slot.is_active ? '#111827' : '#9ca3af' }]}>
                        {slot.start_time} – {slot.end_time}
                      </Text>
                      <TouchableOpacity style={styles.slotChipEdit} onPress={() => openModal(slot)}>
                        <Ionicons name="pencil-outline" size={14} color={color} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.slotChipDelete} onPress={() => handleDelete(slot.slot_id)}>
                        <Ionicons name="close" size={14} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {daySlots.length === 0 && (
                <TouchableOpacity style={styles.emptyDay} onPress={() => openModal(undefined, dayIndex)}>
                  <Ionicons name="add-circle-outline" size={20} color="#9ca3af" />
                  <Text style={styles.emptyDayText}>Натисніть щоб додати часовий слот</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Add/Edit Slot Modal ── */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingSlot ? 'Редагувати слот' : 'Додати часовий слот'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {/* Day selector */}
              <Text style={styles.label}>День тижня</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                {DAYS.map((d, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.dayChip, dayOfWeek === i && { backgroundColor: DAY_COLORS[i], borderColor: DAY_COLORS[i] }]}
                    onPress={() => setDayOfWeek(i)}
                  >
                    <Text style={[styles.dayChipText, dayOfWeek === i && styles.dayChipTextActive]}>{DAYS_SHORT[i]}</Text>
                    <Text style={[styles.dayChipFull, dayOfWeek === i && { color: '#fff' }]}>{d.slice(0, 3)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Time FROM grid */}
              <TimeGrid value={startTime} onChange={v => { setStartTime(v); if (endTime <= v) setEndTime(''); }} label="Час початку (з)" />

              {/* Time TO grid */}
              {startTime && (
                <TimeGrid value={endTime} onChange={setEndTime} label="Час закінчення (до)" filterAfter={startTime} />
              )}

              {/* Summary */}
              {startTime && endTime && (
                <View style={[styles.summaryBox, { borderColor: DAY_COLORS[dayOfWeek] + '60', backgroundColor: DAY_COLORS[dayOfWeek] + '0d' }]}>
                  <Ionicons name="time" size={18} color={DAY_COLORS[dayOfWeek]} />
                  <Text style={[styles.summaryText, { color: DAY_COLORS[dayOfWeek] }]}>
                    {DAYS[dayOfWeek]}: {startTime} – {endTime}
                  </Text>
                </View>
              )}

              {/* Active toggle */}
              <TouchableOpacity style={styles.checkboxRow} onPress={() => setIsActive(!isActive)}>
                <View style={[styles.toggle, isActive && styles.toggleActive]}>
                  <View style={[styles.toggleThumb, isActive && styles.toggleThumbActive]} />
                </View>
                <Text style={styles.checkboxLabel}>Слот активний (видимий клієнтам)</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, (!startTime || !endTime || savingSlot) && { opacity: 0.5 }]}
                onPress={handleSave}
                disabled={!startTime || !endTime || savingSlot}
              >
                {savingSlot ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>Зберегти</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Full-screen Map Modal ── */}
      <Modal visible={mapModalVisible} animationType="slide">
        <View style={{ flex: 1 }}>
          <View style={styles.mapCloseRow}>
            <TouchableOpacity style={styles.mapCloseBtn} onPress={() => setMapModalVisible(false)}>
              <Ionicons name="arrow-back" size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.mapCloseTitle}>Зона роботи</Text>
            {savingArea && <ActivityIndicator size="small" color="#2563eb" style={{ marginLeft: 8 }} />}
          </View>
          {Platform.OS === 'web' ? (
            <MapIframe lat={serviceArea.lat} lng={serviceArea.lng} radius={serviceArea.radius} onSave={handleMapSave} />
          ) : (
            <View style={styles.mapNativePlaceholder}>
              <Ionicons name="map" size={64} color="#2563eb" />
              <Text style={styles.mapNativeTitle}>Карта доступна у веб-версії</Text>
              <Text style={styles.mapNativeSub}>Відкрийте HandyHub у браузері для вибору зони роботи на карті</Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#111827' },
  headerSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  addButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 24,
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  content: { flex: 1 },

  serviceAreaCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', margin: 16, marginBottom: 8,
    borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  serviceAreaLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  serviceAreaIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center',
  },
  serviceAreaTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  serviceAreaSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  editBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  editBadgeText: { fontSize: 13, fontWeight: '600', color: '#2563eb' },

  weekBar: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8,
    borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  weekBarDay: { alignItems: 'center', gap: 6 },
  weekBarDot: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  weekBarCount: { fontSize: 13, fontWeight: '800', color: '#fff' },
  weekBarLabel: { fontSize: 12, color: '#9ca3af', fontWeight: '500' },

  dayCard: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10,
    borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  dayHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  dayHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayBadge: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  dayBadgeText: { fontSize: 15, fontWeight: '800' },
  dayName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  daySlotCount: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  addDayBtn: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  timeline: { paddingHorizontal: 16, paddingBottom: 8 },
  timelineTrack: {
    height: 10, backgroundColor: '#f3f4f6', borderRadius: 5,
    position: 'relative', overflow: 'hidden', marginBottom: 4,
  },
  timelineBlock: {
    position: 'absolute', top: 0, height: 10, borderRadius: 5,
  },
  timelineLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  timelineLabel: { fontSize: 10, color: '#9ca3af' },

  slotChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  slotChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: '#fafafa',
  },
  slotChipToggle: { padding: 2 },
  slotChipDot: { width: 8, height: 8, borderRadius: 4 },
  slotChipTime: { fontSize: 13, fontWeight: '600' },
  slotChipEdit: { padding: 2 },
  slotChipDelete: { padding: 2 },

  emptyDay: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 14, paddingHorizontal: 16,
  },
  emptyDayText: { fontSize: 14, color: '#9ca3af' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%' },
  modalHandle: { width: 40, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  form: { paddingHorizontal: 20, paddingTop: 16 },

  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },

  dayChip: {
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, backgroundColor: '#f3f4f6', marginRight: 8,
    borderWidth: 1.5, borderColor: '#e5e7eb',
  },
  dayChipText: { fontSize: 15, fontWeight: '700', color: '#374151' },
  dayChipFull: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  dayChipTextActive: { color: '#fff' },

  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  timeChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#f3f4f6', borderWidth: 1.5, borderColor: '#e5e7eb',
  },
  timeChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  timeChipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  timeChipTextActive: { color: '#fff' },

  summaryBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 12, borderWidth: 1.5, marginBottom: 16,
  },
  summaryText: { fontSize: 15, fontWeight: '700' },

  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#d1d5db', justifyContent: 'center', paddingHorizontal: 2 },
  toggleActive: { backgroundColor: '#2563eb' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  toggleThumbActive: { alignSelf: 'flex-end' },
  checkboxLabel: { fontSize: 15, color: '#374151', flex: 1 },

  modalFooter: {
    flexDirection: 'row', gap: 12, padding: 20,
    borderTopWidth: 1, borderTopColor: '#f3f4f6',
  },
  cancelButton: { flex: 1, padding: 16, borderRadius: 14, backgroundColor: '#f3f4f6', alignItems: 'center' },
  cancelButtonText: { fontSize: 16, fontWeight: '700', color: '#374151' },
  saveButton: { flex: 1, padding: 16, borderRadius: 14, backgroundColor: '#2563eb', alignItems: 'center' },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Map modal
  mapCloseRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', zIndex: 10,
  },
  mapCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  mapCloseTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  mapNativePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 32 },
  mapNativeTitle: { fontSize: 20, fontWeight: '700', color: '#111827', textAlign: 'center' },
  mapNativeSub: { fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22 },
});
