import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { api } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';

// ─── CLIENT PROFILE ───────────────────────────────────────────────────────────

function ClientProfile() {
  const router = useRouter();
  const { user, setUser, logout } = useAuthStore();
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Modals
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [addPaymentVisible, setAddPaymentVisible] = useState(false);
  const [addAddressVisible, setAddAddressVisible] = useState(false);

  // Edit form
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);

  // Payment form
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardHolder, setCardHolder] = useState('');

  // Address form
  const [addressLabel, setAddressLabel] = useState('');
  const [addressText, setAddressText] = useState('');
  const [addressCity, setAddressCity] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pmRes, addrRes] = await Promise.all([
        api.getPaymentMethods().catch(() => []),
        api.getSavedAddresses().catch(() => []),
      ]);
      setPaymentMethods(Array.isArray(pmRes) ? pmRes : []);
      setAddresses(Array.isArray(addrRes) ? addrRes : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Вийти з акаунту', 'Ви впевнені, що хочете вийти?', [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Вийти',
        style: 'destructive',
        onPress: async () => {
          try { await api.logout().catch(() => {}); } catch {}
          await logout();
          // For web platform, use window.location for reliable redirect
          if (Platform.OS === 'web') {
            window.location.href = '/login';
          } else {
            router.replace('/login');
          }
        },
      },
    ]);
  };

  const pickProfilePhoto = async () => {
    Alert.alert('Фото профілю', 'Оберіть опцію', [
      {
        text: 'Обрати з галереї',
        onPress: async () => {
          const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!permission.granted) {
            Alert.alert('Помилка', 'Потрібен доступ до галереї');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true,
          });
          if (!result.canceled && result.assets[0].base64) {
            await uploadPhoto(result.assets[0].base64);
          }
        },
      },
      {
        text: 'Зробити фото',
        onPress: async () => {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) {
            Alert.alert('Помилка', 'Потрібен доступ до камери');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true,
          });
          if (!result.canceled && result.assets[0].base64) {
            await uploadPhoto(result.assets[0].base64);
          }
        },
      },
      { text: 'Скасувати', style: 'cancel' },
    ]);
  };

  const uploadPhoto = async (base64: string) => {
    setUploadingPhoto(true);
    try {
      const picture = `data:image/jpeg;base64,${base64}`;
      const updatedUser = await api.updateProfile({ picture });
      setUser(updatedUser);
      Alert.alert('Успіх', 'Фото профілю оновлено');
    } catch (error: any) {
      Alert.alert('Помилка', error.message || 'Не вдалося оновити фото');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const saveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Помилка', "Ім'я не може бути порожнім");
      return;
    }
    setSaving(true);
    try {
      const updatedUser = await api.updateProfile({
        name: editName.trim(),
        phone: editPhone.trim() || undefined,
      });
      setUser(updatedUser);
      setEditModalVisible(false);
      Alert.alert('Успіх', 'Профіль оновлено');
    } catch (error: any) {
      Alert.alert('Помилка', error.message || 'Не вдалося оновити профіль');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPayment = async () => {
    if (!cardNumber.trim() || !cardExpiry.trim() || !cardHolder.trim()) {
      Alert.alert('Помилка', 'Заповніть всі поля картки');
      return;
    }
    try {
      await api.addPaymentMethod({
        card_number: cardNumber.replace(/\s/g, ''),
        expiry: cardExpiry,
        card_holder: cardHolder,
        type: 'card',
      });
      setCardNumber('');
      setCardExpiry('');
      setCardHolder('');
      setAddPaymentVisible(false);
      loadData();
      Alert.alert('Успіх', 'Картку додано');
    } catch (error: any) {
      Alert.alert('Помилка', error.message || 'Не вдалося додати картку');
    }
  };

  const handleDeletePayment = (id: string) => {
    Alert.alert('Видалити картку', 'Ви впевнені?', [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deletePaymentMethod(id);
            loadData();
          } catch (error: any) {
            Alert.alert('Помилка', error.message || 'Не вдалося видалити');
          }
        },
      },
    ]);
  };

  const handleAddAddress = async () => {
    if (!addressText.trim() || !addressCity.trim()) {
      Alert.alert('Помилка', 'Введіть адресу та місто');
      return;
    }
    try {
      await api.addSavedAddress({
        label: addressLabel.trim() || 'Моя адреса',
        address: addressText.trim(),
        city: addressCity.trim(),
      });
      setAddressLabel('');
      setAddressText('');
      setAddressCity('');
      setAddAddressVisible(false);
      loadData();
      Alert.alert('Успіх', 'Адресу додано');
    } catch (error: any) {
      Alert.alert('Помилка', error.message || 'Не вдалося додати адресу');
    }
  };

  const handleDeleteAddress = (id: string) => {
    Alert.alert('Видалити адресу', 'Ви впевнені?', [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteSavedAddress(id);
            loadData();
          } catch (error: any) {
            Alert.alert('Помилка', error.message || 'Не вдалося видалити');
          }
        },
      },
    ]);
  };

  const maskCard = (num: string) => {
    if (!num) return '•••• •••• •••• ••••';
    const clean = num.replace(/\s/g, '');
    const last4 = clean.slice(-4);
    return `•••• •••• •••• ${last4}`;
  };

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : null;

  return (
    <View style={styles.container}>
      {/* Header with logout */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Мій профіль</Text>
        <TouchableOpacity style={styles.logoutTopBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          <Text style={styles.logoutTopText}>Вийти</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickProfilePhoto} disabled={uploadingPhoto}>
            {uploadingPhoto ? (
              <View style={styles.avatar}>
                <ActivityIndicator color="#fff" size="large" />
              </View>
            ) : user?.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Ionicons name="person" size={44} color="#fff" />
              </View>
            )}
            <View style={styles.cameraBtn}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>

          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          {user?.phone ? <Text style={styles.userPhone}>{user.phone}</Text> : null}

          {/* Rating */}
          {avgRating ? (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={16} color="#f59e0b" />
              <Text style={styles.ratingText}>{avgRating}</Text>
              <Text style={styles.ratingCount}>({reviews.length} відгуків)</Text>
            </View>
          ) : (
            <View style={styles.ratingRow}>
              <Ionicons name="star-outline" size={16} color="#9ca3af" />
              <Text style={styles.ratingEmpty}>Ще немає відгуків</Text>
            </View>
          )}

          <View style={styles.clientBadge}>
            <Text style={styles.clientBadgeText}>КЛІЄНТ</Text>
          </View>
        </View>

        {/* Edit Profile */}
        <TouchableOpacity
          style={styles.editProfileBtn}
          onPress={() => {
            setEditName(user?.name || '');
            setEditPhone(user?.phone || '');
            setEditModalVisible(true);
          }}
        >
          <Ionicons name="create-outline" size={20} color="#2563eb" />
          <Text style={styles.editProfileText}>Редагувати профіль</Text>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </TouchableOpacity>

        {/* Payment Methods */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="card-outline" size={20} color="#2563eb" />
              <Text style={styles.sectionTitle}>Способи оплати</Text>
            </View>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setAddPaymentVisible(true)}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 12 }} />
          ) : paymentMethods.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="card-outline" size={32} color="#d1d5db" />
              <Text style={styles.emptyText}>Немає збережених карток</Text>
              <Text style={styles.emptySubtext}>Додайте картку для швидкої оплати</Text>
            </View>
          ) : (
            paymentMethods.map((pm: any) => (
              <View key={pm._id || pm.id} style={styles.paymentCard}>
                <View style={styles.paymentCardLeft}>
                  <Ionicons name="card" size={28} color="#2563eb" />
                  <View style={styles.paymentCardInfo}>
                    <Text style={styles.paymentCardNumber}>{maskCard(pm.card_number)}</Text>
                    <Text style={styles.paymentCardHolder}>{pm.card_holder || pm.expiry}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleDeletePayment(pm._id || pm.id)}>
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Saved Addresses */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="location-outline" size={20} color="#10b981" />
              <Text style={styles.sectionTitle}>Мої адреси</Text>
            </View>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: '#10b981' }]}
              onPress={() => setAddAddressVisible(true)}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 12 }} />
          ) : addresses.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="location-outline" size={32} color="#d1d5db" />
              <Text style={styles.emptyText}>Немає збережених адрес</Text>
              <Text style={styles.emptySubtext}>Додайте адресу для швидкого замовлення</Text>
            </View>
          ) : (
            addresses.map((addr: any) => (
              <View key={addr._id || addr.id} style={styles.addressCard}>
                <View style={styles.addressLeft}>
                  <View style={styles.addressIcon}>
                    <Ionicons name="location" size={20} color="#10b981" />
                  </View>
                  <View style={styles.addressInfo}>
                    <Text style={styles.addressLabel}>{addr.label || 'Адреса'}</Text>
                    <Text style={styles.addressText}>{addr.address}</Text>
                    <Text style={styles.addressCity}>{addr.city}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleDeleteAddress(addr._id || addr.id)}>
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Підтримка</Text>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Alert.alert('Допомога', 'Зверніться до support@handyhub.com')}
          >
            <Ionicons name="help-circle-outline" size={22} color="#6b7280" />
            <Text style={styles.menuText}>Центр допомоги</Text>
            <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Alert.alert('Інфо', 'Умови використання')}
          >
            <Ionicons name="document-text-outline" size={22} color="#6b7280" />
            <Text style={styles.menuText}>Умови використання</Text>
            <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          <Text style={styles.logoutBtnText}>Вийти з акаунту</Text>
        </TouchableOpacity>

        <Text style={styles.version}>HandyHub v1.0.0</Text>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Редагувати профіль</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.label}>Ім'я</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Ваше ім'я"
              />
              <Text style={styles.label}>Телефон</Text>
              <TextInput
                style={styles.input}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="+380991234567"
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.btn, styles.btnCancel]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.btnCancelText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnSave]}
                onPress={saveProfile}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSaveText}>Зберегти</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Payment Modal */}
      <Modal visible={addPaymentVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Додати картку</Text>
              <TouchableOpacity onPress={() => setAddPaymentVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.label}>Номер картки</Text>
              <TextInput
                style={styles.input}
                value={cardNumber}
                onChangeText={setCardNumber}
                placeholder="1234 5678 9012 3456"
                keyboardType="numeric"
                maxLength={19}
              />
              <Text style={styles.label}>Термін дії</Text>
              <TextInput
                style={styles.input}
                value={cardExpiry}
                onChangeText={setCardExpiry}
                placeholder="MM/YY"
                maxLength={5}
              />
              <Text style={styles.label}>Ім'я власника</Text>
              <TextInput
                style={styles.input}
                value={cardHolder}
                onChangeText={setCardHolder}
                placeholder="IVAN PETRENKO"
                autoCapitalize="characters"
              />
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.btn, styles.btnCancel]}
                onPress={() => setAddPaymentVisible(false)}
              >
                <Text style={styles.btnCancelText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={handleAddPayment}>
                <Text style={styles.btnSaveText}>Додати</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Address Modal */}
      <Modal visible={addAddressVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Додати адресу</Text>
              <TouchableOpacity onPress={() => setAddAddressVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.label}>Назва (наприклад: Дім, Робота)</Text>
              <TextInput
                style={styles.input}
                value={addressLabel}
                onChangeText={setAddressLabel}
                placeholder="Дім"
              />
              <Text style={styles.label}>Адреса</Text>
              <TextInput
                style={styles.input}
                value={addressText}
                onChangeText={setAddressText}
                placeholder="вул. Хрещатик, 1"
              />
              <Text style={styles.label}>Місто</Text>
              <TextInput
                style={styles.input}
                value={addressCity}
                onChangeText={setAddressCity}
                placeholder="Київ"
              />
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.btn, styles.btnCancel]}
                onPress={() => setAddAddressVisible(false)}
              >
                <Text style={styles.btnCancelText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={handleAddAddress}>
                <Text style={styles.btnSaveText}>Зберегти</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}


// ─── PROVIDER PROFILE (TaskRabbit style) ──────────────────────────────────────

// Skill categories with subcategories (Ukrainian)
const SKILL_CATEGORIES = [
  {
    id: 'assembly',
    name: 'Збірка меблів',
    icon: 'construct-outline' as const,
    color: '#2563eb',
    bg: '#eff6ff',
    skills: [
      { id: 'furniture_assembly', name: 'Збірка меблів', tools: ['Викрутка', 'Дриль', 'Рівень', 'Молоток'], description: 'Збирайте меблі будь-якого типу — від IKEA до замовних виробів.' },
      { id: 'ikea_assembly', name: 'Збірка IKEA', tools: ['Шестигранник', 'Молоток', 'Рівень'], description: 'Збірка та монтаж меблів IKEA будь-якої складності.' },
      { id: 'shelving', name: 'Монтаж полиць', tools: ['Дриль', 'Дюбелі', 'Рівень'], description: 'Встановлення полиць, стелажів та систем зберігання.' },
    ],
  },
  {
    id: 'cleaning',
    name: 'Прибирання',
    icon: 'sparkles-outline' as const,
    color: '#0891b2',
    bg: '#ecfeff',
    skills: [
      { id: 'home_cleaning', name: 'Прибирання будинку', tools: ['Пилосос', 'Швабра', 'Засоби для чищення'], description: 'Генеральне або регулярне прибирання житлових приміщень.' },
      { id: 'office_cleaning', name: 'Прибирання офісу', tools: ['Пилосос', 'Серветки', 'Дезінфектор'], description: 'Прибирання офісних та комерційних приміщень.' },
      { id: 'deep_cleaning', name: 'Генеральне прибирання', tools: ['Парогенератор', 'Хімічні засоби', 'Щітки'], description: 'Глибоке очищення всіх поверхонь, включно з важкодоступними місцями.' },
    ],
  },
  {
    id: 'home_improvements',
    name: 'Ремонт будинку',
    icon: 'hammer-outline' as const,
    color: '#7c3aed',
    bg: '#f5f3ff',
    skills: [
      { id: 'appliance_install', name: 'Встановлення техніки', tools: ['Дриль', 'Ключі', 'Рівень'], description: 'Підключення та встановлення побутової техніки.' },
      { id: 'door_repair', name: 'Ремонт дверей та меблів', tools: ['Шуруповерт', 'Петлі', 'Клей'], description: 'Ремонт та регулювання дверей, шаф, ящиків.' },
      { id: 'painting', name: 'Фарбування', tools: ['Валик', 'Пензлі', 'Малярна стрічка', 'Фарба'], description: 'Фарбування стін, стель та інших поверхонь.' },
    ],
  },
  {
    id: 'moving',
    name: 'Переїзд',
    icon: 'cube-outline' as const,
    color: '#d97706',
    bg: '#fffbeb',
    skills: [
      { id: 'moving_help', name: 'Допомога з переїздом', tools: ['Вантажний автомобіль', 'Ремені', 'Захисна плівка'], description: 'Перевезення речей та меблів при переїзді.' },
      { id: 'packing', name: 'Пакування речей', tools: ['Коробки', 'Скотч', 'Бульбашкова плівка'], description: 'Акуратне пакування та підготовка речей до переїзду.' },
    ],
  },
  {
    id: 'outdoor',
    name: 'Зовнішні роботи',
    icon: 'leaf-outline' as const,
    color: '#16a34a',
    bg: '#f0fdf4',
    skills: [
      { id: 'lawn_care', name: 'Догляд за газоном', tools: ['Газонокосарка', 'Тример', 'Граблі'], description: 'Кошення трави, обрізка кущів та догляд за садом.' },
      { id: 'snow_removal', name: 'Прибирання снігу', tools: ['Лопата', 'Сніговидувач', 'Сіль'], description: 'Прибирання снігу з доріжок, парковок та дахів.' },
    ],
  },
  {
    id: 'personal',
    name: 'Особиста допомога',
    icon: 'person-outline' as const,
    color: '#db2777',
    bg: '#fdf2f8',
    skills: [
      { id: 'errand', name: 'Доручення', tools: ['Автомобіль', 'Телефон'], description: 'Виконання різноманітних доручень та покупок.' },
      { id: 'delivery', name: 'Доставка', tools: ['Автомобіль або велосипед'], description: 'Доставка товарів, документів та посилок.' },
    ],
  },
  {
    id: 'other',
    name: 'Інше',
    icon: 'ellipsis-horizontal-outline' as const,
    color: '#6b7280',
    bg: '#f9fafb',
    skills: [
      { id: 'handyman', name: 'Майстер на всі руки', tools: ['Набір інструментів'], description: 'Дрібний ремонт та різноманітні роботи по будинку.' },
      { id: 'it_help', name: 'IT допомога', tools: ['Комп\'ютер', 'Інструменти'], description: 'Налаштування техніки, встановлення програм, усунення неполадок.' },
    ],
  },
];

type ProviderSkill = {
  id: string;
  category_id: string;
  name: string;
  hourly_rate: number;
  status: 'active' | 'in_progress';
};

function ProviderProfile() {
  const router = useRouter();
  const { user, setUser, logout } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Tabs: 'performance' | 'skills' | 'service'
  const [activeTab, setActiveTab] = useState<'performance' | 'skills' | 'service'>('performance');

  // Provider skills (stored locally + synced with backend)
  const [providerSkills, setProviderSkills] = useState<ProviderSkill[]>([]);

  // Stats
  const [stats, setStats] = useState({
    monthEarnings: 0,
    taskCount: 0,
    rating: 0,
    reviewCount: 0,
    avgPosition: '-',
    shownPercent: 0,
    activatedSkillsCount: 0,
    eliteProgress: 0,
    eliteMilestones: 0,
    eliteTotalMilestones: 4,
    eliteMonth: 'Квітень 2026',
    liveChallenges: 0,
    wins: 0,
  });

  // Add Skills modal
  const [addSkillsVisible, setAddSkillsVisible] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [selectedSkillDetail, setSelectedSkillDetail] = useState<{ categoryId: string; skill: typeof SKILL_CATEGORIES[0]['skills'][0] } | null>(null);
  const [newSkillRate, setNewSkillRate] = useState('');

  // Service detail modal
  const [serviceDetailVisible, setServiceDetailVisible] = useState(false);
  const [selectedProviderSkill, setSelectedProviderSkill] = useState<ProviderSkill | null>(null);
  const [editingRate, setEditingRate] = useState('');

  // Bio modal
  const [bioModalVisible, setBioModalVisible] = useState(false);
  const [bio, setBio] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const data = await api.getMyExecutorProfile();
      setProfile(data);
      setBio(data.bio || '');
      setExperienceYears(data.experience_years?.toString() || '');
      // Convert stored skills array to ProviderSkill objects
      const storedSkills: ProviderSkill[] = (data.skills || []).map((s: any, i: number) => {
        if (typeof s === 'string') {
          return { id: `skill_${i}`, category_id: 'other', name: s, hourly_rate: data.hourly_rate || 25, status: 'active' as const };
        }
        return s;
      });
      setProviderSkills(storedSkills);
      // Mock stats from profile data
      setStats(prev => ({
        ...prev,
        rating: data.rating || 0,
        reviewCount: data.review_count || 0,
        activatedSkillsCount: storedSkills.filter(s => s.status === 'active').length,
      }));
    } catch {
      setProfile({ user_id: user?.user_id || '', skills: [], portfolio_photos: [], certifications: [], languages: [] });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Вийти з акаунту', 'Ви впевнені, що хочете вийти?', [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Вийти',
        style: 'destructive',
        onPress: async () => {
          try { await api.logout().catch(() => {}); } catch {}
          await logout();
          if (Platform.OS === 'web') {
            window.location.href = '/login';
          } else {
            router.replace('/login');
          }
        },
      },
    ]);
  };

  const pickProfilePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Помилка', 'Потрібен доступ до галереї'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setUploadingPhoto(true);
      try {
        const picture = `data:image/jpeg;base64,${result.assets[0].base64}`;
        const updatedUser = await api.updateProfile({ picture });
        setUser(updatedUser);
      } catch (e: any) { Alert.alert('Помилка', e.message || 'Не вдалося оновити фото'); }
      finally { setUploadingPhoto(false); }
    }
  };

  const saveProfile = async (updates: any) => {
    setSaving(true);
    try {
      if (profile?.profile_id) { await api.updateExecutorProfile(updates); }
      else { await api.createExecutorProfile(updates); }
      loadProfile();
    } catch (e: any) { Alert.alert('Помилка', e.message || 'Не вдалося зберегти'); }
    finally { setSaving(false); }
  };

  const addSkill = (categoryId: string, skill: typeof SKILL_CATEGORIES[0]['skills'][0], rate: number) => {
    const newSkill: ProviderSkill = {
      id: `${categoryId}_${skill.id}_${Date.now()}`,
      category_id: categoryId,
      name: skill.name,
      hourly_rate: rate,
      status: 'active',
    };
    const updated = [...providerSkills, newSkill];
    setProviderSkills(updated);
    // Save to backend as simple array
    saveProfile({ skills: updated.map(s => s.name), hourly_rate: rate });
    setStats(prev => ({ ...prev, activatedSkillsCount: updated.filter(s => s.status === 'active').length }));
  };

  const removeSkill = (skillId: string) => {
    const updated = providerSkills.filter(s => s.id !== skillId);
    setProviderSkills(updated);
    saveProfile({ skills: updated.map(s => s.name) });
    setStats(prev => ({ ...prev, activatedSkillsCount: updated.filter(s => s.status === 'active').length }));
  };

  const updateSkillRate = (skillId: string, rate: number) => {
    const updated = providerSkills.map(s => s.id === skillId ? { ...s, hourly_rate: rate } : s);
    setProviderSkills(updated);
    saveProfile({ skills: updated.map(s => s.name), hourly_rate: rate });
  };

  // Group skills by category
  const skillsByCategory = SKILL_CATEGORIES.map(cat => ({
    ...cat,
    mySkills: providerSkills.filter(s => s.category_id === cat.id),
  })).filter(cat => cat.mySkills.length > 0);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  const renderStars = (rating: number) => {
    return [1, 2, 3, 4, 5].map(i => (
      <Ionicons key={i} name={i <= Math.round(rating) ? 'star' : 'star-outline'} size={20} color="#f59e0b" />
    ));
  };

  // ── Performance Tab ──
  const renderPerformance = () => (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      {/* Earnings */}
      <View style={pStyles.statSection}>
        <Text style={pStyles.statSectionTitle}>Заробіток</Text>
        <TouchableOpacity style={pStyles.statRow}>
          <View style={{ flex: 1 }}>
            <Text style={pStyles.statLabel}>Сума за місяць</Text>
            <Text style={pStyles.statValueGreen}>
              {stats.monthEarnings > 0 ? `₴${stats.monthEarnings.toFixed(2)}` : '₴0.00'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </TouchableOpacity>
        <View style={pStyles.divider} />
        <View style={pStyles.statRow}>
          <Text style={pStyles.statLabel}>Кількість завдань</Text>
          <Text style={pStyles.statValueGreen}>{stats.taskCount}</Text>
        </View>
      </View>

      {/* Reviews */}
      <View style={pStyles.statSection}>
        <Text style={pStyles.statSectionTitle}>Відгуки</Text>
        <TouchableOpacity style={pStyles.statRow}>
          <View style={{ flex: 1 }}>
            <Text style={pStyles.statValueLarge}>
              {stats.rating > 0 ? `${stats.rating.toFixed(1)} / 5` : 'Немає відгуків'}
            </Text>
            {stats.reviewCount > 0 && (
              <Text style={pStyles.statSubLabel}>({stats.reviewCount} відгуків)</Text>
            )}
          </View>
          {stats.rating > 0 && (
            <View style={{ flexDirection: 'row', gap: 2, marginRight: 8 }}>
              {renderStars(stats.rating)}
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {/* Analytics */}
      <View style={pStyles.statSection}>
        <Text style={pStyles.statSectionTitle}>Аналітика</Text>
        <Text style={pStyles.statDescription}>Показники вашої роботи та позиція серед виконавців.</Text>
        <TouchableOpacity style={[pStyles.statRow, { marginTop: 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={pStyles.statLabel}>Середня позиція в пошуку</Text>
            <Text style={pStyles.statValueGreen}>{stats.avgPosition}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </TouchableOpacity>
        <View style={pStyles.divider} />
        <View style={pStyles.statRow}>
          <Text style={pStyles.statLabel}>Показано більше ніж</Text>
          <Text style={pStyles.statValueGreen}>{stats.shownPercent}%</Text>
        </View>
      </View>

      {/* Skills & Rates */}
      <View style={pStyles.statSection}>
        <Text style={pStyles.statSectionTitle}>Навички та ставки</Text>
        <TouchableOpacity style={pStyles.statRow} onPress={() => setActiveTab('skills')}>
          <View style={{ flex: 1 }}>
            <Text style={pStyles.statLabel}>Активних навичок: <Text style={pStyles.statValueGreen}>{stats.activatedSkillsCount}</Text></Text>
            {stats.activatedSkillsCount === 0 && (
              <Text style={pStyles.statSubLabel}>Додайте навички, щоб отримувати замовлення</Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {/* Elite Status */}
      <View style={pStyles.statSection}>
        <Text style={pStyles.statSectionTitle}>Elite статус</Text>
        <Text style={pStyles.statDescription}>Станьте Elite та заробляйте до 3x більше!</Text>
        <TouchableOpacity style={pStyles.eliteCard}>
          <View style={{ flex: 1 }}>
            <Text style={pStyles.eliteLabel}>Прогрес Elite</Text>
            <Text style={pStyles.eliteMonth}>{stats.eliteMonth}</Text>
            <View style={pStyles.progressBar}>
              <View style={[pStyles.progressFill, { width: `${(stats.eliteMilestones / stats.eliteTotalMilestones) * 100}%` }]} />
            </View>
            <Text style={pStyles.eliteSubtext}>{stats.eliteMilestones} / {stats.eliteTotalMilestones} досягнень виконано</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#6b7280" />
        </TouchableOpacity>
      </View>

      {/* Challenges */}
      <View style={pStyles.statSection}>
        <Text style={pStyles.statSectionTitle}>Виклики</Text>
        <TouchableOpacity style={pStyles.statRow}>
          <Text style={pStyles.statLabel}>Активні виклики</Text>
          <Text style={pStyles.statValueGreen}>{stats.liveChallenges}</Text>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
        <View style={pStyles.divider} />
        <View style={pStyles.statRow}>
          <Text style={pStyles.statLabel}>Перемоги</Text>
          <Text style={pStyles.statValueGreen}>{stats.wins}</Text>
        </View>
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );

  // ── Skills Tab ──
  const renderSkills = () => (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {skillsByCategory.length === 0 ? (
          <View style={pStyles.emptySkills}>
            <Ionicons name="construct-outline" size={56} color="#d1d5db" />
            <Text style={pStyles.emptySkillsTitle}>Навичок ще немає</Text>
            <Text style={pStyles.emptySkillsText}>Додайте навички, щоб почати отримувати замовлення від клієнтів</Text>
          </View>
        ) : (
          skillsByCategory.map(cat => (
            <View key={cat.id} style={[pStyles.skillCategoryBlock, { backgroundColor: cat.bg }]}>
              <View style={pStyles.skillCategoryHeader}>
                <Ionicons name={cat.icon} size={24} color={cat.color} />
                <Text style={[pStyles.skillCategoryName, { color: cat.color }]}>{cat.name}</Text>
              </View>
              {cat.mySkills.map(skill => (
                <TouchableOpacity
                  key={skill.id}
                  style={[pStyles.skillCard, { borderColor: cat.color + '40' }]}
                  onPress={() => { setSelectedProviderSkill(skill); setEditingRate(skill.hourly_rate.toString()); setServiceDetailVisible(true); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={pStyles.skillCardName}>{skill.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                      <View style={[pStyles.skillBadge, { backgroundColor: cat.color }]}>
                        <Text style={pStyles.skillBadgeText}>₴{skill.hourly_rate}/ГОД</Text>
                      </View>
                      <View style={[pStyles.skillBadge, { backgroundColor: skill.status === 'active' ? cat.color : '#9ca3af' }]}>
                        <Text style={pStyles.skillBadgeText}>{skill.status === 'active' ? 'АКТИВНА' : 'В ПРОЦЕСІ'}</Text>
                      </View>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Add Skills FAB */}
      <TouchableOpacity style={pStyles.addSkillsFab} onPress={() => setAddSkillsVisible(true)}>
        <Ionicons name="add-circle-outline" size={22} color="#2563eb" />
        <Text style={pStyles.addSkillsFabText}>Додати навички</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Service Tab ──
  const renderService = () => (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      {/* Earning Structure */}
      <View style={pStyles.serviceSection}>
        <Text style={pStyles.serviceSectionLabel}>СТРУКТУРА ЗАРОБІТКУ</Text>
        <TouchableOpacity style={pStyles.earningCard}>
          <View style={pStyles.earningCardIcon}>
            <Ionicons name="person-add-outline" size={32} color="#2563eb" />
            <Ionicons name="sparkles" size={14} color="#f59e0b" style={{ position: 'absolute', top: -2, right: -2 }} />
          </View>
          <Text style={pStyles.earningCardTitle}>Самостійна погодинна ставка</Text>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {/* Business Photos */}
      <View style={pStyles.serviceSection}>
        <Text style={pStyles.serviceSectionLabel}>ФОТО РОБІТ</Text>
        {(profile?.portfolio_photos || []).length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            {(profile.portfolio_photos || []).slice(0, 5).map((photo: string, i: number) => (
              <Image key={i} source={{ uri: photo }} style={pStyles.portfolioPhoto} />
            ))}
            {(profile?.portfolio_photos || []).length > 5 && (
              <View style={[pStyles.portfolioPhoto, { backgroundColor: '#374151', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>+{(profile.portfolio_photos || []).length - 5}</Text>
              </View>
            )}
          </ScrollView>
        ) : (
          <TouchableOpacity style={pStyles.addPhotoBtn}>
            <Ionicons name="camera-outline" size={24} color="#6b7280" />
            <Text style={pStyles.addPhotoBtnText}>Додати фото робіт</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Other Information */}
      <View style={pStyles.serviceSection}>
        <Text style={pStyles.serviceSectionLabel}>ІНША ІНФОРМАЦІЯ</Text>
        <TouchableOpacity style={pStyles.infoRow} onPress={() => setBioModalVisible(true)}>
          <Ionicons name="document-text-outline" size={22} color="#374151" />
          <Text style={pStyles.infoRowText}>Опис досвіду</Text>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Мій профіль</Text>
        <TouchableOpacity style={styles.logoutTopBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          <Text style={styles.logoutTopText}>Вийти</Text>
        </TouchableOpacity>
      </View>

      {/* Avatar section */}
      <View style={pStyles.avatarBar}>
        <TouchableOpacity onPress={pickProfilePhoto} disabled={uploadingPhoto} style={{ position: 'relative' }}>
          {uploadingPhoto ? (
            <View style={pStyles.avatar}><ActivityIndicator color="#fff" size="large" /></View>
          ) : user?.picture ? (
            <Image source={{ uri: user.picture }} style={pStyles.avatarImg} />
          ) : (
            <View style={pStyles.avatar}><Ionicons name="person" size={36} color="#fff" /></View>
          )}
          <View style={pStyles.cameraBtn}><Ionicons name="camera" size={14} color="#fff" /></View>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={pStyles.avatarName}>{user?.name}</Text>
          <Text style={pStyles.avatarEmail}>{user?.email}</Text>
          <View style={pStyles.badge}><Text style={pStyles.badgeText}>ВИКОНАВЕЦЬ</Text></View>
        </View>
      </View>

      {/* Tabs */}
      <View style={pStyles.tabBar}>
        {(['performance', 'skills', 'service'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[pStyles.tab, activeTab === tab && pStyles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[pStyles.tabText, activeTab === tab && pStyles.tabTextActive]}>
              {tab === 'performance' ? 'Статистика' : tab === 'skills' ? 'Навички' : 'Послуги'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'performance' && renderPerformance()}
        {activeTab === 'skills' && renderSkills()}
        {activeTab === 'service' && renderService()}
      </View>

      {/* ── Add Skills Modal ── */}
      <Modal visible={addSkillsVisible} animationType="slide" transparent={false}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={pStyles.modalTopBar}>
            <Text style={pStyles.modalTopTitle}>Додати навички</Text>
            <TouchableOpacity onPress={() => { setAddSkillsVisible(false); setExpandedCategory(null); setSelectedSkillDetail(null); }}>
              <Ionicons name="close" size={26} color="#111827" />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {SKILL_CATEGORIES.map(cat => (
              <View key={cat.id}>
                <TouchableOpacity
                  style={pStyles.categoryRow}
                  onPress={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}
                >
                  <Ionicons name={cat.icon} size={22} color="#374151" style={{ marginRight: 12 }} />
                  <Text style={pStyles.categoryRowText}>{cat.name}</Text>
                  <Ionicons name={expandedCategory === cat.id ? 'chevron-up' : 'chevron-down'} size={20} color="#9ca3af" />
                </TouchableOpacity>
                {expandedCategory === cat.id && (
                  <View style={pStyles.categoryExpanded}>
                    {cat.skills.map(skill => {
                      const alreadyAdded = providerSkills.some(s => s.name === skill.name);
                      return (
                        <TouchableOpacity
                          key={skill.id}
                          style={[pStyles.subSkillRow, alreadyAdded && { opacity: 0.5 }]}
                          onPress={() => {
                            if (!alreadyAdded) {
                              setSelectedSkillDetail({ categoryId: cat.id, skill });
                              setNewSkillRate('25');
                            }
                          }}
                          disabled={alreadyAdded}
                        >
                          <Text style={pStyles.subSkillText}>{skill.name}</Text>
                          {alreadyAdded ? (
                            <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                          ) : (
                            <Ionicons name="add-circle-outline" size={20} color="#2563eb" />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                <View style={pStyles.categorySeparator} />
              </View>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* ── Skill Detail Modal ── */}
      <Modal visible={!!selectedSkillDetail} animationType="slide" transparent={false}>
        {selectedSkillDetail && (() => {
          const cat = SKILL_CATEGORIES.find(c => c.id === selectedSkillDetail.categoryId)!;
          const skill = selectedSkillDetail.skill;
          return (
            <View style={{ flex: 1, backgroundColor: '#fff' }}>
              <View style={pStyles.modalTopBar}>
                <TouchableOpacity onPress={() => setSelectedSkillDetail(null)}>
                  <Ionicons name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={pStyles.modalTopTitle}>{skill.name}</Text>
                <View style={{ width: 24 }} />
              </View>
              <ScrollView style={{ flex: 1, padding: 20 }}>
                <Text style={pStyles.skillDetailHeading}>Що очікують клієнти</Text>
                <Text style={pStyles.skillDetailBody}>{skill.description}</Text>

                <Text style={[pStyles.skillDetailHeading, { marginTop: 24 }]}>Необхідні інструменти</Text>
                {skill.tools.map((tool, i) => (
                  <View key={i} style={pStyles.toolRow}>
                    <View style={pStyles.toolDot} />
                    <Text style={pStyles.toolText}>{tool}</Text>
                  </View>
                ))}

                <View style={pStyles.disclaimerBox}>
                  <Text style={pStyles.disclaimerText}>
                    Додаючи цю навичку, ви підтверджуєте, що маєте необхідні знання та ліцензії для виконання відповідних робіт.
                  </Text>
                  <Text style={[pStyles.disclaimerText, { marginTop: 10 }]}>
                    Виконавці несуть відповідальність за наявність необхідних навичок та ліцензій. Залежно від виду робіт, певні юрисдикції можуть вимагати спеціального дозволу.
                  </Text>
                </View>

                <Text style={pStyles.skillDetailHeading}>Ваша погодинна ставка (₴/год)</Text>
                <TextInput
                  style={pStyles.rateInput}
                  value={newSkillRate}
                  onChangeText={setNewSkillRate}
                  keyboardType="numeric"
                  placeholder="25"
                />
              </ScrollView>
              <View style={{ padding: 20, paddingBottom: 32 }}>
                <TouchableOpacity
                  style={pStyles.agreeBtn}
                  onPress={() => {
                    const rate = parseFloat(newSkillRate);
                    if (isNaN(rate) || rate <= 0) { Alert.alert('Помилка', 'Введіть коректну ставку'); return; }
                    addSkill(selectedSkillDetail.categoryId, skill, rate);
                    setSelectedSkillDetail(null);
                    setAddSkillsVisible(false);
                    setExpandedCategory(null);
                  }}
                >
                  <Text style={pStyles.agreeBtnText}>Погодитись та продовжити</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}
      </Modal>

      {/* ── Service Detail Modal ── */}
      <Modal visible={serviceDetailVisible} animationType="slide" transparent={false}>
        {selectedProviderSkill && (() => {
          const cat = SKILL_CATEGORIES.find(c => c.id === selectedProviderSkill.category_id) || SKILL_CATEGORIES[SKILL_CATEGORIES.length - 1];
          return (
            <View style={{ flex: 1, backgroundColor: '#fff' }}>
              <View style={pStyles.modalTopBar}>
                <TouchableOpacity onPress={() => setServiceDetailVisible(false)}>
                  <Ionicons name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={pStyles.modalTopTitle}>{selectedProviderSkill.name}</Text>
                <TouchableOpacity onPress={() => {
                  Alert.alert('Видалити навичку', `Видалити "${selectedProviderSkill.name}"?`, [
                    { text: 'Скасувати', style: 'cancel' },
                    { text: 'Видалити', style: 'destructive', onPress: () => { removeSkill(selectedProviderSkill.id); setServiceDetailVisible(false); } },
                  ]);
                }}>
                  <Ionicons name="ellipsis-horizontal" size={24} color="#111827" />
                </TouchableOpacity>
              </View>

              {/* Tabs: General / Partners */}
              <View style={pStyles.serviceDetailTabs}>
                <View style={[pStyles.serviceDetailTab, pStyles.serviceDetailTabActive]}>
                  <Text style={pStyles.serviceDetailTabTextActive}>Загальне</Text>
                </View>
                <View style={pStyles.serviceDetailTab}>
                  <Text style={pStyles.serviceDetailTabText}>Партнери</Text>
                </View>
              </View>

              <ScrollView style={{ flex: 1, padding: 20 }}>
                {/* Earning Structure */}
                <Text style={pStyles.serviceSectionLabel}>СТРУКТУРА ЗАРОБІТКУ</Text>
                <TouchableOpacity style={[pStyles.earningCard, { marginTop: 8, backgroundColor: '#eff6ff' }]}>
                  <View style={[pStyles.earningCardIcon, { backgroundColor: '#dbeafe' }]}>
                    <Ionicons name="person-add-outline" size={28} color="#2563eb" />
                  </View>
                  <Text style={[pStyles.earningCardTitle, { color: '#1e40af' }]}>Самостійна погодинна ставка</Text>
                  <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                </TouchableOpacity>

                {/* Rate edit */}
                <Text style={[pStyles.serviceSectionLabel, { marginTop: 20 }]}>ПОГОДИННА СТАВКА</Text>
                <View style={pStyles.rateEditRow}>
                  <TextInput
                    style={pStyles.rateInput}
                    value={editingRate}
                    onChangeText={setEditingRate}
                    keyboardType="numeric"
                    placeholder="25"
                  />
                  <TouchableOpacity
                    style={pStyles.rateSaveBtn}
                    onPress={() => {
                      const rate = parseFloat(editingRate);
                      if (!isNaN(rate) && rate > 0) {
                        updateSkillRate(selectedProviderSkill.id, rate);
                        Alert.alert('Збережено', 'Ставку оновлено');
                        setServiceDetailVisible(false);
                      }
                    }}
                  >
                    <Text style={pStyles.rateSaveBtnText}>Зберегти</Text>
                  </TouchableOpacity>
                </View>

                {/* Business Photos placeholder */}
                <Text style={[pStyles.serviceSectionLabel, { marginTop: 20 }]}>ФОТО РОБІТ</Text>
                <TouchableOpacity style={pStyles.addPhotoBtn}>
                  <Ionicons name="camera-outline" size={24} color="#6b7280" />
                  <Text style={pStyles.addPhotoBtnText}>Додати фото</Text>
                </TouchableOpacity>

                {/* Other info */}
                <Text style={[pStyles.serviceSectionLabel, { marginTop: 20 }]}>ІНША ІНФОРМАЦІЯ</Text>
                <TouchableOpacity style={pStyles.infoRow}>
                  <Ionicons name="document-text-outline" size={22} color="#374151" />
                  <Text style={pStyles.infoRowText}>Опис досвіду</Text>
                  <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                </TouchableOpacity>
              </ScrollView>
            </View>
          );
        })()}
      </Modal>

      {/* ── Bio Modal ── */}
      <Modal visible={bioModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Опис досвіду</Text>
              <TouchableOpacity onPress={() => setBioModalVisible(false)}><Ionicons name="close" size={24} color="#6b7280" /></TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.label}>Про мене</Text>
              <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top' }]} value={bio} onChangeText={setBio} placeholder="Розкажіть про свій досвід..." multiline />
              <Text style={styles.label}>Роки досвіду</Text>
              <TextInput style={styles.input} value={experienceYears} onChangeText={setExperienceYears} placeholder="5" keyboardType="numeric" />
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => setBioModalVisible(false)}><Text style={styles.btnCancelText}>Скасувати</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={() => { saveProfile({ bio, experience_years: experienceYears ? parseInt(experienceYears) : undefined }); setBioModalVisible(false); }}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSaveText}>Зберегти</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────

export default function MyProfile() {
  const { user } = useAuthStore();
  if (user?.role === 'provider') return <ProviderProfile />;
  return <ClientProfile />;
}

// ─── SHARED STYLES ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  topBarTitle: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  logoutTopBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fef2f2', borderRadius: 20 },
  logoutTopText: { fontSize: 14, fontWeight: '600', color: '#ef4444' },

  content: { flex: 1 },

  avatarSection: { alignItems: 'center', paddingVertical: 28, backgroundColor: '#fff', marginBottom: 8 },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#16a34a', justifyContent: 'center', alignItems: 'center' },
  avatarImage: { width: 100, height: 100, borderRadius: 50 },
  cameraBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#2563eb', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#fff' },
  userName: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginTop: 12, marginBottom: 4 },
  userEmail: { fontSize: 14, color: '#6b7280', marginBottom: 4 },
  userPhone: { fontSize: 14, color: '#6b7280', marginBottom: 8 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  ratingText: { fontSize: 16, fontWeight: '700', color: '#111827' },
  ratingCount: { fontSize: 13, color: '#6b7280' },
  ratingEmpty: { fontSize: 13, color: '#9ca3af' },
  clientBadge: { backgroundColor: '#f0fdf4', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 12 },
  clientBadgeText: { fontSize: 12, fontWeight: '700', color: '#16a34a' },

  editProfileBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, marginBottom: 4, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  editProfileText: { flex: 1, fontSize: 16, fontWeight: '500', color: '#2563eb', marginLeft: 12 },

  section: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  addBtn: { backgroundColor: '#2563eb', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },

  emptyCard: { alignItems: 'center', paddingVertical: 20 },
  emptyText: { fontSize: 15, fontWeight: '500', color: '#6b7280', marginTop: 8 },
  emptySubtext: { fontSize: 13, color: '#9ca3af', marginTop: 4, textAlign: 'center' },

  paymentCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, marginTop: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  paymentCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  paymentCardInfo: {},
  paymentCardNumber: { fontSize: 15, fontWeight: '600', color: '#111827', letterSpacing: 1 },
  paymentCardHolder: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  addressCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, marginTop: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  addressLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1 },
  addressIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0fdf4', justifyContent: 'center', alignItems: 'center' },
  addressInfo: { flex: 1 },
  addressLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  addressText: { fontSize: 13, color: '#374151', marginTop: 2 },
  addressCity: { fontSize: 12, color: '#6b7280', marginTop: 1 },

  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 10, marginTop: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  menuText: { flex: 1, fontSize: 15, color: '#111827', marginLeft: 12 },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 20, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#fecaca', gap: 10 },
  logoutBtnText: { fontSize: 16, fontWeight: '600', color: '#ef4444' },

  version: { textAlign: 'center', fontSize: 12, color: '#9ca3af', marginVertical: 24 },

  bioText: { fontSize: 14, color: '#374151', lineHeight: 20, marginTop: 4 },
  placeholderText: { fontSize: 14, color: '#9ca3af', fontStyle: 'italic', marginTop: 4 },
  rateText: { fontSize: 20, fontWeight: '700', color: '#10b981', marginTop: 4 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  tag: { backgroundColor: '#f3f4f6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, flexDirection: 'row', alignItems: 'center' },
  tagText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  certItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  certText: { fontSize: 14, color: '#374151' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  modalBody: { padding: 24 },
  modalFooter: { flexDirection: 'row', gap: 12, padding: 24, paddingTop: 0 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16, backgroundColor: '#f9fafb' },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addInlineBtn: { backgroundColor: '#2563eb', width: 48, height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  btn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  btnCancel: { backgroundColor: '#f3f4f6' },
  btnCancelText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  btnSave: { backgroundColor: '#2563eb' },
  btnSaveText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});

// ─── PROVIDER-SPECIFIC STYLES ─────────────────────────────────────────────────

const pStyles = StyleSheet.create({
  // Avatar bar
  avatarBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' },
  avatarImg: { width: 72, height: 72, borderRadius: 36 },
  cameraBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#2563eb', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  avatarName: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  avatarEmail: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  badge: { backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, marginTop: 4, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#2563eb' },

  // Tab bar
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  tabText: { fontSize: 14, fontWeight: '500', color: '#6b7280' },
  tabTextActive: { color: '#2563eb', fontWeight: '700' },

  // Performance stats
  statSection: { backgroundColor: '#fff', marginTop: 8, paddingHorizontal: 20, paddingVertical: 16 },
  statSectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  statDescription: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  statRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  statLabel: { fontSize: 14, color: '#374151', flex: 1 },
  statValueGreen: { fontSize: 16, fontWeight: '700', color: '#2563eb' },
  statValueLarge: { fontSize: 22, fontWeight: '800', color: '#111827' },
  statSubLabel: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 4 },

  eliteCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f5e9', borderRadius: 12, padding: 16, marginTop: 8 },
  eliteLabel: { fontSize: 12, color: '#374151', marginBottom: 4 },
  eliteMonth: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  progressBar: { height: 8, backgroundColor: '#c8e6c9', borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', backgroundColor: '#2563eb', borderRadius: 4 },
  eliteSubtext: { fontSize: 12, color: '#374151' },

  // Skills tab
  emptySkills: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptySkillsTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 16 },
  emptySkillsText: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginTop: 8, lineHeight: 20 },

  skillCategoryBlock: { margin: 12, marginBottom: 0, borderRadius: 12, padding: 16 },
  skillCategoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  skillCategoryName: { fontSize: 16, fontWeight: '700' },
  skillCard: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  skillCardName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  skillBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  skillBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  addSkillsFab: { position: 'absolute', bottom: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, borderWidth: 1.5, borderColor: '#2563eb', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 },
  addSkillsFabText: { fontSize: 15, fontWeight: '700', color: '#2563eb' },

  // Add skills modal
  modalTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 56, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  modalTopTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', padding: 18, backgroundColor: '#fff' },
  categoryRowText: { flex: 1, fontSize: 16, fontWeight: '500', color: '#111827' },
  categoryExpanded: { backgroundColor: '#f9fafb', paddingHorizontal: 16 },
  subSkillRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  subSkillText: { flex: 1, fontSize: 15, color: '#374151' },
  categorySeparator: { height: 1, backgroundColor: '#e5e7eb' },

  // Skill detail
  skillDetailHeading: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 },
  skillDetailBody: { fontSize: 14, color: '#374151', lineHeight: 22 },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  toolDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#374151' },
  toolText: { fontSize: 14, color: '#374151' },
  disclaimerBox: { backgroundColor: '#fefce8', borderRadius: 10, padding: 16, marginTop: 20, marginBottom: 20 },
  disclaimerText: { fontSize: 13, color: '#713f12', lineHeight: 20 },
  rateInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 14, fontSize: 18, fontWeight: '600', backgroundColor: '#f9fafb', marginTop: 8 },
  agreeBtn: { backgroundColor: '#2563eb', borderRadius: 14, padding: 18, alignItems: 'center' },
  agreeBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Service tab
  serviceSection: { backgroundColor: '#fff', marginTop: 8, padding: 20 },
  serviceSectionLabel: { fontSize: 11, fontWeight: '700', color: '#9ca3af', letterSpacing: 1, marginBottom: 4 },
  earningCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f4ff', borderRadius: 12, padding: 16, marginTop: 8, gap: 14 },
  earningCardIcon: { width: 60, height: 60, borderRadius: 12, backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center' },
  earningCardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1e40af' },
  addPhotoBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f9fafb', borderRadius: 10, padding: 16, marginTop: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: '#d1d5db' },
  addPhotoBtnText: { fontSize: 14, color: '#6b7280' },
  portfolioPhoto: { width: 100, height: 100, borderRadius: 8, marginRight: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  infoRowText: { flex: 1, fontSize: 15, color: '#111827' },

  // Service detail
  serviceDetailTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', backgroundColor: '#fff' },
  serviceDetailTab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  serviceDetailTabActive: { borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  serviceDetailTabText: { fontSize: 14, color: '#6b7280' },
  serviceDetailTabTextActive: { fontSize: 14, fontWeight: '700', color: '#2563eb' },
  rateEditRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  rateSaveBtn: { backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 20, justifyContent: 'center' },
  rateSaveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
