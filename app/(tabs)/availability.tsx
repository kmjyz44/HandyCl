import React, { useEffect, useState } from 'react';
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
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';

const DAYS = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота', 'Неділя'];
const DAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

const HOURS = Array.from({ length: 24 }, (_, h) => [
  `${h.toString().padStart(2, '0')}:00`,
  `${h.toString().padStart(2, '0')}:30`,
]).flat();

// Ukrainian cities for location picker
const CITIES = [
  'Київ', 'Харків', 'Одеса', 'Дніпро', 'Запоріжжя', 'Львів',
  'Кривий Ріг', 'Миколаїв', 'Маріуполь', 'Луганськ', 'Вінниця',
  'Херсон', 'Полтава', 'Чернігів', 'Черкаси', 'Суми', 'Житомир',
  'Хмельницький', 'Рівне', 'Івано-Франківськ', 'Тернопіль', 'Луцьк',
  'Ужгород', 'Чернівці', 'Кропивницький',
];

const RADIUSES = [5, 10, 15, 20, 30, 50];

interface AvailabilitySlot {
  slot_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location?: string;
  is_active: boolean;
}

interface ServiceArea {
  city: string;
  radius: number;
}

// Simple time picker component (web-friendly, no native Picker)
function TimePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.timePickerBtn} onPress={() => setOpen(!open)}>
        <Ionicons name="time-outline" size={18} color="#2563eb" />
        <Text style={styles.timePickerBtnText}>{value}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#6b7280" />
      </TouchableOpacity>
      {open && (
        <View style={styles.timeDropdown}>
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            {HOURS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.timeOption, t === value && styles.timeOptionSelected]}
                onPress={() => { onChange(t); setOpen(false); }}
              >
                <Text style={[styles.timeOptionText, t === value && styles.timeOptionTextSelected]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default function Availability() {
  const { user } = useAuthStore();
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [editingSlot, setEditingSlot] = useState<AvailabilitySlot | null>(null);

  // Form state
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [isActive, setIsActive] = useState(true);

  // Service area state
  const [serviceArea, setServiceArea] = useState<ServiceArea>({ city: 'Київ', radius: 10 });
  const [tempCity, setTempCity] = useState('Київ');
  const [tempRadius, setTempRadius] = useState(10);
  const [citySearch, setCitySearch] = useState('');

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

  useEffect(() => {
    loadAvailability();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadAvailability();
  };

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

  // Check for overlapping or duplicate slots
  const hasOverlap = (day: number, start: string, end: string, excludeId?: string): boolean => {
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const newStart = toMin(start);
    const newEnd = toMin(end);
    return slots.some((s) => {
      if (s.day_of_week !== day) return false;
      if (excludeId && s.slot_id === excludeId) return false;
      const sStart = toMin(s.start_time);
      const sEnd = toMin(s.end_time);
      // Overlap if intervals intersect
      return newStart < sEnd && newEnd > sStart;
    });
  };

  const handleSave = async () => {
    if (startTime >= endTime) {
      Alert.alert('Помилка', 'Час закінчення має бути більше часу початку');
      return;
    }

    // Check for duplicate / overlapping slot
    if (hasOverlap(dayOfWeek, startTime, endTime, editingSlot?.slot_id)) {
      Alert.alert(
        'Перетин часу',
        `На ${DAYS[dayOfWeek]} вже є слот, що перетинається з ${startTime}–${endTime}. Виберіть інший час або видаліть існуючий слот.`
      );
      return;
    }

    try {
      const slotData = {
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        location: serviceArea.city,
        is_active: isActive,
      };

      if (editingSlot) {
        await api.updateAvailabilitySlot(editingSlot.slot_id, slotData);
      } else {
        await api.createAvailabilitySlot(slotData);
      }

      setModalVisible(false);
      loadAvailability();
    } catch (error: any) {
      Alert.alert('Помилка', error.message || 'Не вдалося зберегти');
    }
  };

  const handleDelete = async (slotId: string) => {
    Alert.alert('Видалити слот', 'Ви впевнені?', [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteAvailabilitySlot(slotId);
            loadAvailability();
          } catch (error: any) {
            Alert.alert('Помилка', error.message || 'Не вдалося видалити');
          }
        },
      },
    ]);
  };

  const toggleSlotActive = async (slot: AvailabilitySlot) => {
    try {
      await api.updateAvailabilitySlot(slot.slot_id, { is_active: !slot.is_active });
      loadAvailability();
    } catch (error: any) {
      Alert.alert('Помилка', error.message || 'Не вдалося оновити');
    }
  };

  const slotsByDay = DAYS.map((_, i) => slots.filter((s) => s.day_of_week === i));

  const openLocationModal = () => {
    setTempCity(serviceArea.city);
    setTempRadius(serviceArea.radius);
    setCitySearch('');
    setLocationModalVisible(true);
  };

  const saveLocation = () => {
    setServiceArea({ city: tempCity, radius: tempRadius });
    setLocationModalVisible(false);
  };

  const filteredCities = CITIES.filter((c) =>
    c.toLowerCase().includes(citySearch.toLowerCase())
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Мій графік</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => openModal()}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={24} color="#2563eb" />
          <Text style={styles.infoText}>
            Встановіть графік роботи, щоб клієнти знали, коли ви доступні
          </Text>
        </View>

        {/* Service Area Card */}
        <TouchableOpacity style={styles.serviceAreaCard} onPress={openLocationModal}>
          <View style={styles.serviceAreaLeft}>
            <View style={styles.serviceAreaIconWrap}>
              <Ionicons name="map-outline" size={26} color="#2563eb" />
            </View>
            <View>
              <Text style={styles.serviceAreaTitle}>Зона роботи</Text>
              <Text style={styles.serviceAreaSub}>
                {serviceArea.city} · радіус {serviceArea.radius} км
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>

        {/* Calendar */}
        {DAYS.map((day, dayIndex) => {
          const daySlots = slotsByDay[dayIndex];
          return (
            <View key={dayIndex} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <View style={styles.dayInfo}>
                  <Text style={styles.dayName}>{day}</Text>
                  <Text style={styles.dayShort}>{DAYS_SHORT[dayIndex]}</Text>
                </View>
                <TouchableOpacity
                  style={styles.addDayButton}
                  onPress={() => openModal(undefined, dayIndex)}
                >
                  <Ionicons name="add-circle-outline" size={24} color="#2563eb" />
                </TouchableOpacity>
              </View>

              {daySlots.length > 0 ? (
                <View style={styles.slotsContainer}>
                  {daySlots.map((slot) => (
                    <View
                      key={slot.slot_id}
                      style={[styles.slotItem, !slot.is_active && styles.slotInactive]}
                    >
                      <TouchableOpacity
                        style={styles.slotToggle}
                        onPress={() => toggleSlotActive(slot)}
                      >
                        <Ionicons
                          name={slot.is_active ? 'checkmark-circle' : 'ellipse-outline'}
                          size={24}
                          color={slot.is_active ? '#10b981' : '#d1d5db'}
                        />
                      </TouchableOpacity>

                      <View style={styles.slotInfo}>
                        <View style={styles.timeRow}>
                          <Ionicons name="time-outline" size={16} color="#6b7280" />
                          <Text style={styles.slotTime}>
                            {slot.start_time} - {slot.end_time}
                          </Text>
                        </View>
                        {slot.location && (
                          <View style={styles.locationRow}>
                            <Ionicons name="location-outline" size={14} color="#6b7280" />
                            <Text style={styles.slotLocation}>{slot.location}</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.slotActions}>
                        <TouchableOpacity style={styles.editSlotButton} onPress={() => openModal(slot)}>
                          <Ionicons name="pencil" size={18} color="#2563eb" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteSlotButton} onPress={() => handleDelete(slot.slot_id)}>
                          <Ionicons name="trash" size={18} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.noSlots}>
                  <Text style={styles.noSlotsText}>Вихідний</Text>
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add/Edit Slot Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingSlot ? 'Редагувати слот' : 'Додати слот'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form} nestedScrollEnabled>
              {/* Day selector */}
              <Text style={styles.label}>День тижня</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {DAYS.map((d, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.dayChip, dayOfWeek === i && styles.dayChipActive]}
                    onPress={() => setDayOfWeek(i)}
                  >
                    <Text style={[styles.dayChipText, dayOfWeek === i && styles.dayChipTextActive]}>
                      {DAYS_SHORT[i]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TimePicker value={startTime} onChange={setStartTime} label="Час початку" />
              <TimePicker value={endTime} onChange={setEndTime} label="Час закінчення" />

              {/* Active toggle */}
              <TouchableOpacity style={styles.checkboxRow} onPress={() => setIsActive(!isActive)}>
                <Ionicons
                  name={isActive ? 'checkbox' : 'square-outline'}
                  size={24}
                  color="#2563eb"
                />
                <Text style={styles.checkboxLabel}>Активний слот</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Зберегти</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Location / Service Area Modal */}
      <Modal visible={locationModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Зона роботи</Text>
              <TouchableOpacity onPress={() => setLocationModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form} nestedScrollEnabled>
              {/* Map placeholder with Leaflet iframe */}
              <View style={styles.mapContainer}>
                {Platform.OS === 'web' ? (
                  <iframe
                    title="map"
                    style={{ width: '100%', height: 220, border: 'none', borderRadius: 12 } as any}
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=22.0,44.0,40.0,52.5&layer=mapnik&marker=${
                      tempCity === 'Київ' ? '50.45,30.52' :
                      tempCity === 'Харків' ? '49.99,36.23' :
                      tempCity === 'Одеса' ? '46.48,30.72' :
                      tempCity === 'Дніпро' ? '48.46,35.04' :
                      tempCity === 'Львів' ? '49.84,24.03' :
                      '50.45,30.52'
                    }`}
                  />
                ) : (
                  <View style={styles.mapPlaceholder}>
                    <Ionicons name="map" size={48} color="#2563eb" />
                    <Text style={styles.mapPlaceholderText}>Карта доступна у веб-версії</Text>
                  </View>
                )}
              </View>

              {/* City search */}
              <Text style={styles.label}>Місто</Text>
              <View style={styles.searchRow}>
                <Ionicons name="search-outline" size={18} color="#9ca3af" style={{ marginRight: 8 }} />
                <TextInput
                  style={{ flex: 1, fontSize: 16 }}
                  value={citySearch}
                  onChangeText={setCitySearch}
                  placeholder="Пошук міста..."
                />
              </View>
              <View style={styles.cityList}>
                {filteredCities.map((city) => (
                  <TouchableOpacity
                    key={city}
                    style={[styles.cityItem, tempCity === city && styles.cityItemSelected]}
                    onPress={() => { setTempCity(city); setCitySearch(''); }}
                  >
                    <Ionicons
                      name={tempCity === city ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={tempCity === city ? '#2563eb' : '#9ca3af'}
                    />
                    <Text style={[styles.cityItemText, tempCity === city && styles.cityItemTextSelected]}>
                      {city}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Radius */}
              <Text style={[styles.label, { marginTop: 16 }]}>Радіус роботи</Text>
              <View style={styles.radiusRow}>
                {RADIUSES.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.radiusChip, tempRadius === r && styles.radiusChipActive]}
                    onPress={() => setTempRadius(r)}
                  >
                    <Text style={[styles.radiusChipText, tempRadius === r && styles.radiusChipTextActive]}>
                      {r} км
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.selectedAreaCard}>
                <Ionicons name="location" size={20} color="#2563eb" />
                <Text style={styles.selectedAreaText}>
                  {tempCity} · радіус {tempRadius} км
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setLocationModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={saveLocation}>
                <Text style={styles.saveButtonText}>Зберегти</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', padding: 24, paddingTop: 60,
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#111827' },
  addButton: {
    backgroundColor: '#2563eb', width: 48, height: 48,
    borderRadius: 24, justifyContent: 'center', alignItems: 'center',
  },
  content: { flex: 1 },
  infoCard: {
    flexDirection: 'row', backgroundColor: '#eff6ff',
    margin: 16, padding: 16, borderRadius: 12, alignItems: 'center', gap: 12,
  },
  infoText: { flex: 1, fontSize: 14, color: '#1e40af', lineHeight: 20 },

  // Service area card
  serviceAreaCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12,
    borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e5e7eb',
  },
  serviceAreaLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  serviceAreaIconWrap: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center',
  },
  serviceAreaTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  serviceAreaSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  // Day cards
  dayCard: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12,
    borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: '#f9fafb',
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  dayInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  dayShort: { fontSize: 14, color: '#6b7280' },
  addDayButton: { padding: 4 },
  slotsContainer: { padding: 12, gap: 8 },
  slotItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f0fdf4', padding: 12, borderRadius: 10,
    borderWidth: 1, borderColor: '#bbf7d0',
  },
  slotInactive: { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' },
  slotToggle: { marginRight: 12 },
  slotInfo: { flex: 1 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  slotTime: { fontSize: 15, fontWeight: '600', color: '#111827' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  slotLocation: { fontSize: 13, color: '#6b7280' },
  slotActions: { flexDirection: 'row', gap: 8 },
  editSlotButton: { padding: 8 },
  deleteSlotButton: { padding: 8 },
  noSlots: { padding: 16, alignItems: 'center' },
  noSlotsText: { fontSize: 14, color: '#9ca3af', fontStyle: 'italic' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 24, borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  form: { padding: 24 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },

  // Day chips
  dayChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#f3f4f6', marginRight: 8, borderWidth: 1, borderColor: '#e5e7eb',
  },
  dayChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  dayChipText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  dayChipTextActive: { color: '#fff' },

  // Time picker
  timePickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10,
    padding: 14, backgroundColor: '#f9fafb',
  },
  timePickerBtnText: { flex: 1, fontSize: 16, fontWeight: '600', color: '#111827' },
  timeDropdown: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10,
    backgroundColor: '#fff', marginTop: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 4,
  },
  timeOption: { paddingHorizontal: 16, paddingVertical: 12 },
  timeOptionSelected: { backgroundColor: '#eff6ff' },
  timeOptionText: { fontSize: 15, color: '#374151' },
  timeOptionTextSelected: { color: '#2563eb', fontWeight: '700' },

  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  checkboxLabel: { fontSize: 16, color: '#374151' },
  modalFooter: {
    flexDirection: 'row', gap: 12, padding: 24, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: '#e5e7eb',
  },
  button: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f3f4f6' },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  saveButton: { backgroundColor: '#2563eb' },
  saveButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  // Location modal
  mapContainer: { borderRadius: 12, overflow: 'hidden', marginBottom: 16, height: 220, backgroundColor: '#e5e7eb' },
  mapPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  mapPlaceholderText: { fontSize: 14, color: '#6b7280' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#f9fafb', marginBottom: 8,
  },
  cityList: { maxHeight: 200 },
  cityItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  cityItemSelected: { backgroundColor: '#eff6ff' },
  cityItemText: { fontSize: 15, color: '#374151' },
  cityItemTextSelected: { color: '#2563eb', fontWeight: '600' },
  radiusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  radiusChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb',
  },
  radiusChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  radiusChipText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  radiusChipTextActive: { color: '#fff' },
  selectedAreaCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#eff6ff', borderRadius: 10, padding: 14,
  },
  selectedAreaText: { fontSize: 15, fontWeight: '600', color: '#1e40af' },
});
