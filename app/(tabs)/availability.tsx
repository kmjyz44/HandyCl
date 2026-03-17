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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { api } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';

const DAYS = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота', 'Неділя'];
const DAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

interface AvailabilitySlot {
  slot_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location?: string;
  is_active: boolean;
}

export default function Availability() {
  const { user } = useAuthStore();
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSlot, setEditingSlot] = useState<AvailabilitySlot | null>(null);
  
  // Form state
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [location, setLocation] = useState('');
  const [isActive, setIsActive] = useState(true);

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

  const openModal = (slot?: AvailabilitySlot) => {
    if (slot) {
      setEditingSlot(slot);
      setDayOfWeek(slot.day_of_week);
      setStartTime(slot.start_time);
      setEndTime(slot.end_time);
      setLocation(slot.location || '');
      setIsActive(slot.is_active);
    } else {
      resetForm();
    }
    setModalVisible(true);
  };

  const resetForm = () => {
    setEditingSlot(null);
    setDayOfWeek(0);
    setStartTime('09:00');
    setEndTime('18:00');
    setLocation('');
    setIsActive(true);
  };

  const handleSave = async () => {
    // Validate time
    if (startTime >= endTime) {
      Alert.alert('Помилка', 'Час закінчення має бути більше часу початку');
      return;
    }

    try {
      const slotData = {
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        location: location || undefined,
        is_active: isActive,
      };

      if (editingSlot) {
        await api.updateAvailabilitySlot(editingSlot.slot_id, slotData);
      } else {
        await api.createAvailabilitySlot(slotData);
      }

      setModalVisible(false);
      loadAvailability();
      Alert.alert('Успіх', `Слот ${editingSlot ? 'оновлено' : 'створено'}`);
    } catch (error: any) {
      Alert.alert('Помилка', error.message || 'Не вдалося зберегти');
    }
  };

  const handleDelete = async (slotId: string) => {
    Alert.alert('Видалити слот', 'Ви впевнені, що хочете видалити цей слот?', [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteAvailabilitySlot(slotId);
            loadAvailability();
            Alert.alert('Успіх', 'Слот видалено');
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

  // Generate time options
  const generateTimeOptions = () => {
    const options = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        options.push(time);
      }
    }
    return options;
  };

  const timeOptions = generateTimeOptions();

  // Group slots by day
  const slotsByDay = DAYS.map((_, index) => 
    slots.filter(slot => slot.day_of_week === index)
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
            Встановіть ваш графік роботи, щоб клієнти знали, коли ви доступні
          </Text>
        </View>

        {/* Calendar View */}
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
                  onPress={() => {
                    setDayOfWeek(dayIndex);
                    openModal();
                  }}
                >
                  <Ionicons name="add-circle-outline" size={24} color="#2563eb" />
                </TouchableOpacity>
              </View>

              {daySlots.length > 0 ? (
                <View style={styles.slotsContainer}>
                  {daySlots.map((slot) => (
                    <View
                      key={slot.slot_id}
                      style={[
                        styles.slotItem,
                        !slot.is_active && styles.slotInactive,
                      ]}
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
                            <Ionicons name="location-outline" size={16} color="#6b7280" />
                            <Text style={styles.slotLocation}>{slot.location}</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.slotActions}>
                        <TouchableOpacity
                          style={styles.editSlotButton}
                          onPress={() => openModal(slot)}
                        >
                          <Ionicons name="pencil" size={18} color="#2563eb" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteSlotButton}
                          onPress={() => handleDelete(slot.slot_id)}
                        >
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

      {/* Add/Edit Modal */}
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

            <ScrollView style={styles.form}>
              <Text style={styles.label}>День тижня</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={dayOfWeek}
                  onValueChange={setDayOfWeek}
                  style={styles.picker}
                >
                  {DAYS.map((day, index) => (
                    <Picker.Item key={index} label={day} value={index} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.label}>Час початку</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={startTime}
                  onValueChange={setStartTime}
                  style={styles.picker}
                >
                  {timeOptions.map((time) => (
                    <Picker.Item key={time} label={time} value={time} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.label}>Час закінчення</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={endTime}
                  onValueChange={setEndTime}
                  style={styles.picker}
                >
                  {timeOptions.map((time) => (
                    <Picker.Item key={time} label={time} value={time} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.label}>Локація (опціонально)</Text>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="Наприклад: Київ, Центр"
              />

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setIsActive(!isActive)}
              >
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
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleSave}
              >
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
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  addButton: {
    backgroundColor: '#2563eb',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  dayCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  dayInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  dayShort: {
    fontSize: 14,
    color: '#6b7280',
  },
  addDayButton: {
    padding: 4,
  },
  slotsContainer: {
    padding: 12,
    gap: 8,
  },
  slotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  slotInactive: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  slotToggle: {
    marginRight: 12,
  },
  slotInfo: {
    flex: 1,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  slotTime: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  slotLocation: {
    fontSize: 13,
    color: '#6b7280',
  },
  slotActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editSlotButton: {
    padding: 8,
  },
  deleteSlotButton: {
    padding: 8,
  },
  noSlots: {
    padding: 16,
    alignItems: 'center',
  },
  noSlotsText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  form: {
    padding: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: '#f9fafb',
  },
  picker: {
    height: 50,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#f9fafb',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#374151',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  saveButton: {
    backgroundColor: '#2563eb',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
