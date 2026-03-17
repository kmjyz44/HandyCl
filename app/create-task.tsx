import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../utils/api';

const CATEGORIES = [
  { id: 'handyman_plumbing', name: 'Сантехніка', icon: 'water-outline' },
  { id: 'handyman_electrical', name: 'Електрика', icon: 'flash-outline' },
  { id: 'handyman_carpentry', name: 'Столярні роботи', icon: 'hammer-outline' },
  { id: 'handyman_painting', name: 'Фарбування', icon: 'color-palette-outline' },
  { id: 'handyman_assembly', name: 'Збирання меблів', icon: 'construct-outline' },
  { id: 'handyman_mounting', name: 'Монтаж', icon: 'build-outline' },
  { id: 'cleaning_regular', name: 'Прибирання', icon: 'sparkles-outline' },
  { id: 'cleaning_deep', name: 'Глибоке прибирання', icon: 'sparkles' },
  { id: 'moving_local', name: 'Переїзд', icon: 'car-outline' },
  { id: 'delivery', name: 'Доставка', icon: 'cube-outline' },
  { id: 'gardening', name: 'Садівництво', icon: 'leaf-outline' },
  { id: 'other', name: 'Інше', icon: 'ellipsis-horizontal-outline' },
];

export default function CreateTask() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Form data
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [allowOffers, setAllowOffers] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setPhotos([...photos, base64]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const validateStep = () => {
    switch (step) {
      case 1:
        if (!category) {
          Alert.alert('Помилка', 'Оберіть категорію');
          return false;
        }
        break;
      case 2:
        if (!title.trim()) {
          Alert.alert('Помилка', 'Введіть назву завдання');
          return false;
        }
        if (!description.trim()) {
          Alert.alert('Помилка', 'Опишіть завдання');
          return false;
        }
        break;
      case 3:
        if (!address.trim()) {
          Alert.alert('Помилка', 'Введіть адресу');
          return false;
        }
        if (!date) {
          Alert.alert('Помилка', 'Оберіть дату');
          return false;
        }
        if (!time) {
          Alert.alert('Помилка', 'Оберіть час');
          return false;
        }
        break;
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const submitTask = async () => {
    if (!validateStep()) return;

    setLoading(true);
    try {
      const taskData = {
        category,
        title: title.trim(),
        description: description.trim(),
        address: address.trim(),
        scheduled_date: date,
        scheduled_time: time,
        estimated_hours: estimatedHours ? parseFloat(estimatedHours) : undefined,
        photos: photos.length > 0 ? photos : undefined,
        allow_offers: allowOffers,
      };

      await api.createClientTask(taskData);
      Alert.alert('Успіх', 'Завдання створено!', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/bookings') }
      ]);
    } catch (error: any) {
      Alert.alert('Помилка', error.message || 'Не вдалося створити завдання');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Оберіть категорію</Text>
      <Text style={styles.stepSubtitle}>Що потрібно зробити?</Text>
      
      <View style={styles.categoriesGrid}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryCard,
              category === cat.id && styles.categoryCardActive,
            ]}
            onPress={() => setCategory(cat.id)}
          >
            <Ionicons
              name={cat.icon as any}
              size={32}
              color={category === cat.id ? '#fff' : '#2563eb'}
            />
            <Text
              style={[
                styles.categoryName,
                category === cat.id && styles.categoryNameActive,
              ]}
            >
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.stepContent}>
        <Text style={styles.stepTitle}>Опишіть завдання</Text>
        <Text style={styles.stepSubtitle}>Чим детальніше, тим краще</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Назва завдання</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Наприклад: Полагодити кран"
            maxLength={100}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Опис</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Опишіть детально що потрібно зробити..."
            multiline
            numberOfLines={5}
            maxLength={1000}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Фото (опціонально)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {photos.map((photo, index) => (
              <View key={index} style={styles.photoContainer}>
                <Image source={{ uri: photo }} style={styles.photo} />
                <TouchableOpacity
                  style={styles.removePhotoBtn}
                  onPress={() => removePhoto(index)}
                >
                  <Ionicons name="close-circle" size={24} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 5 && (
              <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImage}>
                <Ionicons name="camera-outline" size={32} color="#6b7280" />
                <Text style={styles.addPhotoText}>Додати</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderStep3 = () => (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.stepContent}>
        <Text style={styles.stepTitle}>Коли і де?</Text>
        <Text style={styles.stepSubtitle}>Вкажіть місце та час</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Адреса</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Вулиця, будинок, квартира"
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Дата</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="2026-02-20"
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Час</Text>
            <TextInput
              style={styles.input}
              value={time}
              onChangeText={setTime}
              placeholder="14:00"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Орієнтовна тривалість (години)</Text>
          <TextInput
            style={styles.input}
            value={estimatedHours}
            onChangeText={setEstimatedHours}
            placeholder="2"
            keyboardType="numeric"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderStep4 = () => (
    <ScrollView style={styles.stepContent}>
      <Text style={styles.stepTitle}>Як знайти виконавця?</Text>
      <Text style={styles.stepSubtitle}>Оберіть спосіб</Text>

      <TouchableOpacity
        style={[styles.optionCard, !allowOffers && styles.optionCardActive]}
        onPress={() => setAllowOffers(false)}
      >
        <View style={styles.optionIcon}>
          <Ionicons
            name="person-outline"
            size={32}
            color={!allowOffers ? '#fff' : '#2563eb'}
          />
        </View>
        <View style={styles.optionContent}>
          <Text style={[styles.optionTitle, !allowOffers && styles.optionTitleActive]}>
            Обрати виконавця
          </Text>
          <Text style={[styles.optionDesc, !allowOffers && styles.optionDescActive]}>
            Перегляньте профілі та оберіть самостійно
          </Text>
        </View>
        {!allowOffers && (
          <Ionicons name="checkmark-circle" size={24} color="#fff" />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.optionCard, allowOffers && styles.optionCardActive]}
        onPress={() => setAllowOffers(true)}
      >
        <View style={styles.optionIcon}>
          <Ionicons
            name="people-outline"
            size={32}
            color={allowOffers ? '#fff' : '#2563eb'}
          />
        </View>
        <View style={styles.optionContent}>
          <Text style={[styles.optionTitle, allowOffers && styles.optionTitleActive]}>
            Отримати пропозиції
          </Text>
          <Text style={[styles.optionDesc, allowOffers && styles.optionDescActive]}>
            Виконавці надішлють свої пропозиції з ціною
          </Text>
        </View>
        {allowOffers && (
          <Ionicons name="checkmark-circle" size={24} color="#fff" />
        )}
      </TouchableOpacity>

      {/* Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Підсумок</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Категорія:</Text>
          <Text style={styles.summaryValue}>
            {CATEGORIES.find(c => c.id === category)?.name}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Завдання:</Text>
          <Text style={styles.summaryValue}>{title}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Адреса:</Text>
          <Text style={styles.summaryValue}>{address}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Дата:</Text>
          <Text style={styles.summaryValue}>{date} о {time}</Text>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Нове завдання</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress */}
      <View style={styles.progressContainer}>
        {[1, 2, 3, 4].map((s) => (
          <View
            key={s}
            style={[
              styles.progressDot,
              s <= step && styles.progressDotActive,
            ]}
          />
        ))}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {step > 1 && (
          <TouchableOpacity style={styles.backButton} onPress={prevStep}>
            <Text style={styles.backButtonText}>Назад</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextButton, step === 1 && { flex: 1 }]}
          onPress={step === 4 ? submitTask : nextStep}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.nextButtonText}>
              {step === 4 ? 'Створити завдання' : 'Далі'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  progressDot: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
  },
  progressDotActive: {
    backgroundColor: '#2563eb',
  },
  content: {
    flex: 1,
  },
  stepContent: {
    padding: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  categoryCardActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  categoryName: {
    fontSize: 12,
    color: '#374151',
    marginTop: 8,
    textAlign: 'center',
  },
  categoryNameActive: {
    color: '#fff',
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  photoContainer: {
    marginRight: 12,
    position: 'relative',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  addPhotoBtn: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  optionCardActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  optionIcon: {
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  optionTitleActive: {
    color: '#fff',
  },
  optionDesc: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  optionDescActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  summaryCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginTop: 24,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    maxWidth: '60%',
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  backButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  nextButton: {
    flex: 2,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
