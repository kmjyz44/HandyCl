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

  const handleLogout = async () => {
    const doLogout = async () => {
      try { await api.logout().catch(() => {}); } catch {}
      await logout();
      if (Platform.OS === 'web') { window.location.href = '/login'; }
      else { router.replace('/login'); }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Вийти з акаунту?')) doLogout();
    } else {
      Alert.alert('Вийти з акаунту', 'Ви впевнені, що хочете вийти?', [
        { text: 'Скасувати', style: 'cancel' },
        { text: 'Вийти', style: 'destructive', onPress: doLogout },
      ]);
    }
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

const SKILL_CATEGORIES = [
  {
    id: 'assembly',
    name: 'Збірка меблів',
    icon: 'construct-outline' as const,
    color: '#2563eb',
    bg: '#eff6ff',
    skills: [
      { id: 'furniture_assembly', name: 'Збірка меблів', tools: ['Викрутка', 'Дриль', 'Рівень', 'Молоток'], description: 'Збирайте меблі будь-якого типу — від IKEA до замовних виробів. Клієнти очікують акуратного монтажу без пошкоджень.' },
      { id: 'ikea_assembly', name: 'Збірка IKEA', tools: ['Шестигранник', 'Молоток', 'Рівень', 'Викрутка'], description: 'Збірка та монтаж меблів IKEA будь-якої складності. Знання інструкцій IKEA обов\'язкове.' },
      { id: 'shelving', name: 'Монтаж полиць', tools: ['Дриль', 'Дюбелі', 'Рівень', 'Олівець'], description: 'Встановлення полиць, стелажів та систем зберігання на стінах будь-якого типу.' },
      { id: 'wardrobe', name: 'Збірка шаф', tools: ['Шуруповерт', 'Рівень', 'Молоток'], description: 'Збірка вбудованих та окремостоячих шаф, гардеробних систем.' },
      { id: 'office_furniture', name: 'Офісні меблі', tools: ['Дриль', 'Викрутка', 'Рівень'], description: 'Збірка офісних столів, крісел, стелажів та перегородок.' },
      { id: 'tv_mount', name: 'Монтаж телевізора', tools: ['Дриль', 'Дюбелі', 'Рівень', 'Кронштейн'], description: 'Встановлення телевізорів на стіну, підключення кабелів, приховування проводів.' },
    ],
  },
  {
    id: 'cleaning',
    name: 'Прибирання',
    icon: 'sparkles-outline' as const,
    color: '#0891b2',
    bg: '#ecfeff',
    skills: [
      { id: 'home_cleaning', name: 'Прибирання будинку', tools: ['Пилосос', 'Швабра', 'Засоби для чищення', 'Відро'], description: 'Генеральне або регулярне прибирання житлових приміщень. Включає миття підлог, вікон, санвузлів.' },
      { id: 'office_cleaning', name: 'Прибирання офісу', tools: ['Пилосос', 'Серветки', 'Дезінфектор', 'Швабра'], description: 'Прибирання офісних та комерційних приміщень після робочого дня або тижня.' },
      { id: 'deep_cleaning', name: 'Генеральне прибирання', tools: ['Парогенератор', 'Хімічні засоби', 'Щітки', 'Рукавички'], description: 'Глибоке очищення всіх поверхонь, включно з важкодоступними місцями, духовками, холодильниками.' },
      { id: 'move_in_out', name: 'Прибирання при переїзді', tools: ['Пилосос', 'Швабра', 'Хімія', 'Серветки'], description: 'Прибирання квартири або будинку перед заїздом або після виїзду.' },
      { id: 'window_cleaning', name: 'Миття вікон', tools: ['Скребок', 'Засіб для скла', 'Серветки', 'Відро'], description: 'Миття вікон зсередини та зовні, балконних дверей та вітрин.' },
      { id: 'carpet_cleaning', name: 'Чищення килимів', tools: ['Пилосос', 'Парочистач', 'Засоби для килимів'], description: 'Глибоке чищення килимів та м\'яких меблів від бруду та плям.' },
    ],
  },
  {
    id: 'home_improvements',
    name: 'Ремонт будинку',
    icon: 'hammer-outline' as const,
    color: '#7c3aed',
    bg: '#f5f3ff',
    skills: [
      { id: 'appliance_install', name: 'Встановлення техніки', tools: ['Дриль', 'Ключі', 'Рівень', 'Ізолента'], description: 'Підключення та встановлення побутової техніки: пральних машин, посудомийок, кондиціонерів.' },
      { id: 'door_repair', name: 'Ремонт дверей та меблів', tools: ['Шуруповерт', 'Петлі', 'Клей', 'Стамеска'], description: 'Ремонт та регулювання дверей, шаф, ящиків. Заміна фурнітури.' },
      { id: 'painting', name: 'Фарбування', tools: ['Валик', 'Пензлі', 'Малярна стрічка', 'Фарба', 'Лоток'], description: 'Фарбування стін, стель та інших поверхонь. Підготовка поверхні, ґрунтування, фінішне покриття.' },
      { id: 'tiling', name: 'Укладання плитки', tools: ['Зубчастий шпатель', 'Плиткоріз', 'Рівень', 'Затирка'], description: 'Укладання керамічної плитки у ванних кімнатах, кухнях та інших приміщеннях.' },
      { id: 'flooring', name: 'Укладання підлоги', tools: ['Молоток', 'Підбивання', 'Рівень', 'Пилка'], description: 'Укладання ламінату, паркету, лінолеуму та інших покриттів.' },
      { id: 'drywall', name: 'Гіпсокартон', tools: ['Шуруповерт', 'Ніж', 'Рівень', 'Шпатель'], description: 'Монтаж гіпсокартонних перегородок, стель, ніш та арок.' },
      { id: 'plumbing', name: 'Сантехніка', tools: ['Ключі', 'Фум-стрічка', 'Паяльник', 'Труби'], description: 'Встановлення та ремонт сантехніки: кранів, унітазів, раковин, душових кабін.' },
      { id: 'electrical', name: 'Електрика', tools: ['Викрутка', 'Тестер', 'Плоскогубці', 'Ізолента'], description: 'Встановлення розеток, вимикачів, світильників. Базові електромонтажні роботи.' },
    ],
  },
  {
    id: 'moving',
    name: 'Переїзд та доставка',
    icon: 'cube-outline' as const,
    color: '#d97706',
    bg: '#fffbeb',
    skills: [
      { id: 'moving_help', name: 'Допомога з переїздом', tools: ['Вантажний автомобіль', 'Ремені', 'Захисна плівка', 'Ковдри'], description: 'Перевезення речей та меблів при переїзді. Акуратне завантаження та розвантаження.' },
      { id: 'packing', name: 'Пакування речей', tools: ['Коробки', 'Скотч', 'Бульбашкова плівка', 'Маркер'], description: 'Акуратне пакування та підготовка речей до переїзду. Маркування коробок.' },
      { id: 'furniture_moving', name: 'Перенесення меблів', tools: ['Ремені', 'Захисна плівка', 'Рукавички'], description: 'Переміщення важких меблів всередині приміщення або між поверхами.' },
      { id: 'delivery', name: 'Доставка', tools: ['Автомобіль або велосипед', 'Телефон'], description: 'Доставка товарів, документів та посилок по місту.' },
      { id: 'junk_removal', name: 'Вивіз сміття', tools: ['Вантажний автомобіль', 'Рукавички', 'Мішки'], description: 'Вивіз старих меблів, будівельного сміття та непотрібних речей.' },
    ],
  },
  {
    id: 'outdoor',
    name: 'Зовнішні роботи',
    icon: 'leaf-outline' as const,
    color: '#16a34a',
    bg: '#f0fdf4',
    skills: [
      { id: 'lawn_care', name: 'Догляд за газоном', tools: ['Газонокосарка', 'Тример', 'Граблі', 'Мішки'], description: 'Кошення трави, обрізка кущів, прибирання листя та догляд за садом.' },
      { id: 'snow_removal', name: 'Прибирання снігу', tools: ['Лопата', 'Сніговидувач', 'Сіль', 'Пісок'], description: 'Прибирання снігу з доріжок, парковок, ганків та дахів.' },
      { id: 'garden_planting', name: 'Садівництво', tools: ['Лопата', 'Граблі', 'Поливалка', 'Рукавички'], description: 'Посадка рослин, квітів, дерев та кущів. Догляд за городом.' },
      { id: 'pressure_washing', name: 'Миття під тиском', tools: ['Мийка високого тиску', 'Шланг', 'Засоби'], description: 'Миття фасадів, доріжок, терас, парканів та автомобілів.' },
      { id: 'fence_install', name: 'Встановлення огорожі', tools: ['Дриль', 'Лопата', 'Рівень', 'Бетон'], description: 'Встановлення та ремонт парканів, воріт та огорож різних типів.' },
    ],
  },
  {
    id: 'personal',
    name: 'Особиста допомога',
    icon: 'person-outline' as const,
    color: '#db2777',
    bg: '#fdf2f8',
    skills: [
      { id: 'errand', name: 'Доручення', tools: ['Автомобіль', 'Телефон'], description: 'Виконання різноманітних доручень: покупки, черги, оформлення документів.' },
      { id: 'shopping', name: 'Шопінг-асистент', tools: ['Автомобіль', 'Список покупок'], description: 'Допомога з покупками в магазинах, ринках та онлайн-замовленнями.' },
      { id: 'pet_care', name: 'Догляд за тваринами', tools: ['Повідець', 'Корм', 'Іграшки'], description: 'Вигул собак, догляд за домашніми тваринами під час відсутності господарів.' },
      { id: 'elderly_help', name: 'Допомога літнім людям', tools: ['Терпіння', 'Транспорт'], description: 'Супровід, допомога по господарству та виконання доручень для літніх людей.' },
    ],
  },
  {
    id: 'it_tech',
    name: 'IT та техніка',
    icon: 'laptop-outline' as const,
    color: '#0f766e',
    bg: '#f0fdfa',
    skills: [
      { id: 'computer_setup', name: 'Налаштування комп\'ютера', tools: ['Комп\'ютер', 'Інструменти', 'USB-носій'], description: 'Встановлення операційної системи, програм, антивірусу. Налаштування мережі.' },
      { id: 'tv_setup', name: 'Налаштування Smart TV', tools: ['Пульт', 'HDMI-кабель', 'Інтернет'], description: 'Підключення та налаштування Smart TV, приставок, стрімінгових сервісів.' },
      { id: 'phone_repair', name: 'Ремонт телефонів', tools: ['Набір викруток', 'Запчастини', 'Пінцет'], description: 'Заміна екранів, батарей та інших компонентів смартфонів.' },
      { id: 'network_setup', name: 'Налаштування мережі', tools: ['Роутер', 'Кабелі', 'Тестер'], description: 'Встановлення та налаштування Wi-Fi роутерів, мережевого обладнання.' },
      { id: 'data_recovery', name: 'Відновлення даних', tools: ['Комп\'ютер', 'Спеціальне ПЗ', 'Жорсткий диск'], description: 'Відновлення видалених файлів, фото та документів з різних носіїв.' },
    ],
  },
  {
    id: 'events',
    name: 'Заходи та свята',
    icon: 'balloon-outline' as const,
    color: '#9333ea',
    bg: '#faf5ff',
    skills: [
      { id: 'event_setup', name: 'Організація заходів', tools: ['Декор', 'Столи', 'Стільці', 'Освітлення'], description: 'Підготовка та оформлення приміщень для свят, корпоративів та вечірок.' },
      { id: 'photography', name: 'Фотографія', tools: ['Фотоапарат', 'Спалах', 'Штатив'], description: 'Фотозйомка заходів, портретів, предметна та репортажна фотографія.' },
      { id: 'catering_help', name: 'Допомога на кухні', tools: ['Кухонний інвентар', 'Фартух'], description: 'Допомога з приготуванням та подачею їжі на заходах.' },
      { id: 'bartending', name: 'Бармен', tools: ['Шейкер', 'Барний інвентар', 'Посуд'], description: 'Приготування коктейлів та напоїв на заходах та вечірках.' },
    ],
  },
  {
    id: 'other',
    name: 'Інше',
    icon: 'ellipsis-horizontal-outline' as const,
    color: '#6b7280',
    bg: '#f9fafb',
    skills: [
      { id: 'handyman', name: 'Майстер на всі руки', tools: ['Набір інструментів', 'Матеріали'], description: 'Дрібний ремонт та різноманітні роботи по будинку, які не входять в інші категорії.' },
      { id: 'tutoring', name: 'Репетиторство', tools: ['Підручники', 'Зошити', 'Комп\'ютер'], description: 'Навчання та підготовка учнів з різних предметів.' },
      { id: 'translation', name: 'Переклад', tools: ['Комп\'ютер', 'Словники'], description: 'Усний та письмовий переклад документів та текстів.' },
      { id: 'driving', name: 'Водій', tools: ['Автомобіль', 'Права'], description: 'Перевезення пасажирів та вантажів по місту та за його межами.' },
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
  const [saving, setSaving] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<'performance' | 'skills' | 'service'>('performance');

  // Provider skills
  const [providerSkills, setProviderSkills] = useState<ProviderSkill[]>([]);

  // Stats
  const [stats, setStats] = useState({
    monthEarnings: 0, taskCount: 0, rating: 0, reviewCount: 0,
    avgPosition: '-', shownPercent: 0, activatedSkillsCount: 0,
    eliteProgress: 0, eliteMilestones: 0, eliteTotalMilestones: 4,
    eliteMonth: 'Квітень 2026', liveChallenges: 0, wins: 0,
  });

  // Bio/experience
  const [bio, setBio] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [bioModalVisible, setBioModalVisible] = useState(false);
  const [accountDetailsVisible, setAccountDetailsVisible] = useState(false);
  const [editingAccountDetails, setEditingAccountDetails] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [accountPhone, setAccountPhone] = useState('');
  const [accountAddress, setAccountAddress] = useState('');

  // Portfolio photos (local URIs)
  const [portfolioPhotos, setPortfolioPhotos] = useState<string[]>([]);

  // Add Skills modal
  const [addSkillsVisible, setAddSkillsVisible] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [selectedSkillDetail, setSelectedSkillDetail] = useState<{ categoryId: string; skill: typeof SKILL_CATEGORIES[0]['skills'][0] } | null>(null);
  const [newSkillRate, setNewSkillRate] = useState('');

  // Service detail modal
  const [serviceDetailVisible, setServiceDetailVisible] = useState(false);
  const [selectedProviderSkill, setSelectedProviderSkill] = useState<ProviderSkill | null>(null);
  const [editingRate, setEditingRate] = useState('');

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const data = await api.getMyExecutorProfile();
      setProfile(data);
      setBio(data.bio || '');
      setExperienceYears(data.experience_years?.toString() || '');
      const storedSkills: ProviderSkill[] = (data.skills || []).map((s: any, i: number) => {
        if (typeof s === 'string') {
          return { id: `skill_${i}`, category_id: 'other', name: s, hourly_rate: data.hourly_rate || 25, status: 'active' as const };
        }
        return s;
      });
      setProviderSkills(storedSkills);
      setPortfolioPhotos(data.portfolio_photos || []);
      setStats(prev => ({
        ...prev,
        rating: data.rating || 0,
        reviewCount: data.review_count || 0,
        activatedSkillsCount: storedSkills.filter((s: ProviderSkill) => s.status === 'active').length,
      }));
    } catch {
      setProfile({ user_id: user?.user_id || '', skills: [], portfolio_photos: [], certifications: [], languages: [] });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const doLogout = async () => {
      try { await api.logout().catch(() => {}); } catch {}
      await logout();
      if (Platform.OS === 'web') { window.location.href = '/login'; }
      else { router.replace('/login'); }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Вийти з акаунту?')) doLogout();
    } else {
      Alert.alert('Вийти з акаунту', 'Ви впевнені?', [
        { text: 'Скасувати', style: 'cancel' },
        { text: 'Вийти', style: 'destructive', onPress: doLogout },
      ]);
    }
  };
  const pickProfilePhoto = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e: any) => {
        const file: File = e.target.files[0];
        if (!file) return;
        setUploadingPhoto(true);
        try {
          const reader = new FileReader();
          reader.onload = async (ev: any) => {
            try {
              const updatedUser = await api.updateProfile({ picture: ev.target.result });
              setUser(updatedUser);
              Alert.alert('Успіх', 'Фото профілю оновлено');
            } catch (err: any) {
              Alert.alert('Помилка', err.message || 'Не вдалося оновити фото');
            } finally { setUploadingPhoto(false); }
          };
          reader.readAsDataURL(file);
        } catch { setUploadingPhoto(false); }
      };
      input.click();
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Помилка', 'Потрібен доступ до галереї'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setUploadingPhoto(true);
      try {
        const picture = `data:image/jpeg;base64,${result.assets[0].base64}`;
        const updatedUser = await api.updateProfile({ picture });
        setUser(updatedUser);
        Alert.alert('Успіх', 'Фото профілю оновлено');
      } catch (e: any) { Alert.alert('Помилка', e.message || 'Не вдалося оновити фото'); }
      finally { setUploadingPhoto(false); }
    }
  };

  const pickPortfolioPhoto = async () => {
    if (Platform.OS === 'web') {
      // On web, trigger a hidden file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = (e: any) => {
        const files: File[] = Array.from(e.target.files || []);
        files.forEach((file: File) => {
          const reader = new FileReader();
          reader.onload = (ev: any) => {
            setPortfolioPhotos(prev => [...prev, ev.target.result as string]);
          };
          reader.readAsDataURL(file);
        });
        if (files.length > 0) Alert.alert('Успіх', `Додано ${files.length} фото`);
      };
      input.click();
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Помилка', 'Потрібен доступ до галереї'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.7,
    });
    if (!result.canceled) {
      const newPhotos = [...portfolioPhotos, result.assets[0].uri];
      setPortfolioPhotos(newPhotos);
      Alert.alert('Успіх', 'Фото додано до портфоліо');
    }
  };

  const saveProfile = async (updates: any) => {
    setSaving(true);
    try {
      if (profile?.profile_id) { await api.updateExecutorProfile(updates); }
      else { await api.createExecutorProfile(updates); }
      await loadProfile();
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

  const skillsByCategory = SKILL_CATEGORIES.map(cat => ({
    ...cat,
    mySkills: providerSkills.filter(s => s.category_id === cat.id),
  })).filter(cat => cat.mySkills.length > 0);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  const renderStars = (rating: number) => [1, 2, 3, 4, 5].map(i => (
    <Ionicons key={i} name={i <= Math.round(rating) ? 'star' : 'star-outline'} size={20} color="#f59e0b" />
  ));

  // ── Performance Tab ──
  const renderPerformance = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      <View style={pStyles.statSection}>
        <Text style={pStyles.statSectionTitle}>Заробіток</Text>
        <TouchableOpacity style={pStyles.statRow}>
          <View style={{ flex: 1 }}>
            <Text style={pStyles.statLabel}>Сума за місяць</Text>
            <Text style={pStyles.statValueGreen}>{stats.monthEarnings > 0 ? `₴${stats.monthEarnings.toFixed(2)}` : '₴0.00'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </TouchableOpacity>
        <View style={pStyles.divider} />
        <View style={pStyles.statRow}>
          <Text style={pStyles.statLabel}>Кількість завдань</Text>
          <Text style={pStyles.statValueGreen}>{stats.taskCount}</Text>
        </View>
      </View>

      <View style={pStyles.statSection}>
        <Text style={pStyles.statSectionTitle}>Відгуки</Text>
        <TouchableOpacity style={pStyles.statRow}>
          <View style={{ flex: 1 }}>
            <Text style={pStyles.statValueLarge}>{stats.rating > 0 ? `${stats.rating.toFixed(1)} / 5` : 'Немає відгуків'}</Text>
            {stats.reviewCount > 0 && <Text style={pStyles.statSubLabel}>({stats.reviewCount} відгуків)</Text>}
          </View>
          {stats.rating > 0 && <View style={{ flexDirection: 'row', gap: 2, marginRight: 8 }}>{renderStars(stats.rating)}</View>}
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </TouchableOpacity>
      </View>

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

      <View style={pStyles.statSection}>
        <Text style={pStyles.statSectionTitle}>Навички та ставки</Text>
        <TouchableOpacity style={pStyles.statRow} onPress={() => setActiveTab('skills')}>
          <View style={{ flex: 1 }}>
            <Text style={pStyles.statLabel}>Активних навичок: <Text style={pStyles.statValueGreen}>{stats.activatedSkillsCount}</Text></Text>
            {stats.activatedSkillsCount === 0 && <Text style={pStyles.statSubLabel}>Додайте навички, щоб отримувати замовлення</Text>}
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      <View style={pStyles.statSection}>
        <Text style={pStyles.statSectionTitle}>Elite статус</Text>
        <Text style={pStyles.statDescription}>Станьте Elite та заробляйте до 3x більше!</Text>
        <TouchableOpacity style={pStyles.eliteCard}>
          <View style={{ flex: 1 }}>
            <Text style={pStyles.eliteLabel}>Прогрес Elite</Text>
            <Text style={pStyles.eliteMonth}>{stats.eliteMonth}</Text>
            <View style={pStyles.progressBar}>
              <View style={[pStyles.progressFill, { width: `${(stats.eliteMilestones / stats.eliteTotalMilestones) * 100}%` as any }]} />
            </View>
            <Text style={pStyles.eliteSubtext}>{stats.eliteMilestones} / {stats.eliteTotalMilestones} досягнень виконано</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#6b7280" />
        </TouchableOpacity>
      </View>

      <View style={pStyles.statSection}>
        <Text style={pStyles.statSectionTitle}>Виклики</Text>
        <TouchableOpacity style={pStyles.statRow}>
          <Text style={pStyles.statLabel}>Активні виклики</Text>
          <Text style={[pStyles.statValueGreen, { marginRight: 8 }]}>{stats.liveChallenges}</Text>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </TouchableOpacity>
        <View style={pStyles.divider} />
        <View style={pStyles.statRow}>
          <Text style={pStyles.statLabel}>Перемоги</Text>
          <Text style={pStyles.statValueGreen}>{stats.wins}</Text>
        </View>
      </View>

    </ScrollView>
  );

  // ── Skills Tab ──
  const renderSkills = () => (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {skillsByCategory.length === 0 ? (
          <View style={pStyles.emptySkills}>
            <Ionicons name="construct-outline" size={56} color="#d1d5db" />
            <Text style={pStyles.emptySkillsTitle}>Навичок ще немає</Text>
            <Text style={pStyles.emptySkillsText}>Додайте навички, щоб почати отримувати замовлення від клієнтів</Text>
            <TouchableOpacity style={[pStyles.agreeBtn, { marginTop: 24, paddingHorizontal: 32 }]} onPress={() => setAddSkillsVisible(true)}>
              <Text style={pStyles.agreeBtnText}>+ Додати навички</Text>
            </TouchableOpacity>
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
      </ScrollView>

      {/* Add Skills FAB */}
      <TouchableOpacity style={pStyles.addSkillsFab} onPress={() => setAddSkillsVisible(true)}>
        <Ionicons name="add-circle-outline" size={22} color="#2563eb" />
        <Text style={pStyles.addSkillsFabText}>Додати навички</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Service Tab (TaskRabbit-style account menu) ──
  const renderService = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

      {/* ACCOUNT INFORMATION */}
      <Text style={pStyles.menuSectionLabel}>ІНФОРМАЦІЯ ПРО АКАУНТ</Text>

      <TouchableOpacity style={pStyles.menuRow} onPress={() => { setAccountName(user?.full_name || user?.username || ''); setAccountPhone(profile?.phone || ''); setAccountAddress(profile?.address || ''); setEditingAccountDetails(false); setAccountDetailsVisible(true); }}>
        <Ionicons name="person-outline" size={22} color="#374151" style={pStyles.menuRowIcon} />
        <View style={{ flex: 1 }}>
          <Text style={pStyles.menuRowText}>Деталі акаунту</Text>
          <Text style={pStyles.menuRowSub}>{user?.full_name || user?.username || user?.email || ''}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      </TouchableOpacity>
      <View style={pStyles.menuDivider} />

      <TouchableOpacity style={pStyles.menuRow} onPress={() => setServiceDetailVisible(true)}>
        <Ionicons name="briefcase-outline" size={22} color="#374151" style={pStyles.menuRowIcon} />
        <Text style={[pStyles.menuRowText, { flex: 1 }]}>Профіль виконавця</Text>
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      </TouchableOpacity>
      <View style={pStyles.menuDivider} />

      <TouchableOpacity style={pStyles.menuRow} onPress={pickPortfolioPhoto}>
        <Ionicons name="images-outline" size={22} color="#374151" style={pStyles.menuRowIcon} />
        <View style={{ flex: 1 }}>
          <Text style={pStyles.menuRowText}>Фото робіт</Text>
          <Text style={pStyles.menuRowSub}>{portfolioPhotos.length > 0 ? `${portfolioPhotos.length} фото` : 'Додайте фото ваших робіт'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      </TouchableOpacity>
      {portfolioPhotos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          {portfolioPhotos.map((photo, i) => (
            <TouchableOpacity key={i} onLongPress={() => {
              Alert.alert('Видалити фото?', '', [
                { text: 'Скасувати', style: 'cancel' },
                { text: 'Видалити', style: 'destructive', onPress: () => setPortfolioPhotos(portfolioPhotos.filter((_, idx) => idx !== i)) },
              ]);
            }}>
              <Image source={{ uri: photo }} style={pStyles.portfolioThumb} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      <View style={pStyles.menuDivider} />

      <TouchableOpacity style={pStyles.menuRow} onPress={() => Alert.alert('Погодинна ставка', `Поточна ставка: ${profile?.hourly_rate || 25} ₴/год`)}>
        <Ionicons name="cash-outline" size={22} color="#374151" style={pStyles.menuRowIcon} />
        <View style={{ flex: 1 }}>
          <Text style={pStyles.menuRowText}>Оплата та виплати</Text>
          <Text style={pStyles.menuRowSub}>Погодинна ставка: {profile?.hourly_rate || 25} ₴</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      </TouchableOpacity>
      <View style={pStyles.menuDivider} />

      {/* INVITE */}
      <TouchableOpacity style={[pStyles.menuRow, { backgroundColor: '#f0fdf4' }]} onPress={() => Alert.alert('Запросити друзів', 'Функція запрошень буде доступна в наступній версії')}>
        <Ionicons name="gift-outline" size={22} color="#16a34a" style={pStyles.menuRowIcon} />
        <Text style={[pStyles.menuRowText, { flex: 1, color: '#15803d' }]}>Запросити друзів, отримати бонус</Text>
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      </TouchableOpacity>
      <View style={pStyles.menuDivider} />

      <TouchableOpacity style={pStyles.menuRow} onPress={() => Alert.alert('Підтримка', 'Зверніться на support@handyhub.com')}>
        <Ionicons name="help-circle-outline" size={22} color="#374151" style={pStyles.menuRowIcon} />
        <Text style={[pStyles.menuRowText, { flex: 1 }]}>Підтримка</Text>
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      </TouchableOpacity>
      <View style={pStyles.menuDivider} />

      {/* SETTINGS */}
      <Text style={pStyles.menuSectionLabel}>НАЛАШТУВАННЯ</Text>

      <TouchableOpacity style={pStyles.menuRow} onPress={() => Alert.alert('Безпека акаунту', 'Зміна паролю та налаштування безпеки будуть доступні в наступній версії')}>
        <Ionicons name="shield-checkmark-outline" size={22} color="#374151" style={pStyles.menuRowIcon} />
        <Text style={[pStyles.menuRowText, { flex: 1 }]}>Безпека акаунту</Text>
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      </TouchableOpacity>
      <View style={pStyles.menuDivider} />

      <TouchableOpacity style={pStyles.menuRow} onPress={() => Alert.alert('Про HandyHub', 'HandyHub v1.0.0\n\nПлатформа для пошуку виконавців поблизу')}>
        <Ionicons name="information-circle-outline" size={22} color="#374151" style={pStyles.menuRowIcon} />
        <Text style={[pStyles.menuRowText, { flex: 1 }]}>Про додаток</Text>
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      </TouchableOpacity>
      <View style={pStyles.menuDivider} />

      <TouchableOpacity style={pStyles.menuRow} onPress={() => Alert.alert('Призупинити акаунт', 'Ця функція буде доступна в наступній версії')}>
        <Ionicons name="pause-circle-outline" size={22} color="#374151" style={pStyles.menuRowIcon} />
        <Text style={[pStyles.menuRowText, { flex: 1 }]}>Призупинити акаунт</Text>
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      </TouchableOpacity>
      <View style={pStyles.menuDivider} />

      <TouchableOpacity style={pStyles.menuRow} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={22} color="#374151" style={pStyles.menuRowIcon} />
        <Text style={[pStyles.menuRowText, { flex: 1 }]}>Вийти</Text>
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      </TouchableOpacity>
      <View style={pStyles.menuDivider} />

      {/* DELETE ACCOUNT */}
      <TouchableOpacity style={[pStyles.menuRow, { marginTop: 8 }]} onPress={() => Alert.alert('Видалити акаунт', 'Ця дія незворотня. Ви впевнені?', [
        { text: 'Скасувати', style: 'cancel' },
        { text: 'Видалити', style: 'destructive', onPress: handleLogout },
      ])}>
        <Text style={[pStyles.menuRowText, { flex: 1, color: '#ef4444', fontWeight: '600' }]}>Видалити акаунт</Text>
      </TouchableOpacity>

      <Text style={pStyles.versionText}>HandyHub v1.0.0</Text>
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

      {/* Avatar bar */}
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
          <TouchableOpacity key={tab} style={[pStyles.tab, activeTab === tab && pStyles.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[pStyles.tabText, activeTab === tab && pStyles.tabTextActive]}>
              {tab === 'performance' ? 'Статистика' : tab === 'skills' ? 'Навички' : 'Профіль'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
            <TouchableOpacity onPress={() => { setAddSkillsVisible(false); setExpandedCategory(null); }}>
              <Ionicons name="close" size={26} color="#111827" />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {SKILL_CATEGORIES.map(cat => (
              <View key={cat.id}>
                <TouchableOpacity style={pStyles.categoryRow} onPress={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}>
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
                          {alreadyAdded
                            ? <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                            : <Ionicons name="add-circle-outline" size={20} color="#2563eb" />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                <View style={pStyles.categorySeparator} />
              </View>
            ))}
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
                <Text style={[pStyles.modalTopTitle, { flex: 1, textAlign: 'center' }]}>{skill.name}</Text>
                <View style={{ width: 24 }} />
              </View>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
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
              <View style={{ padding: 20, paddingBottom: 32, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
                <TouchableOpacity
                  style={pStyles.agreeBtn}
                  onPress={() => {
                    const rate = parseFloat(newSkillRate);
                    if (isNaN(rate) || rate <= 0) { Alert.alert('Помилка', 'Введіть коректну ставку'); return; }
                    addSkill(selectedSkillDetail.categoryId, skill, rate);
                    setSelectedSkillDetail(null);
                    setAddSkillsVisible(false);
                    setExpandedCategory(null);
                    Alert.alert('Успіх', `Навичку "${skill.name}" додано!`);
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
                <Text style={[pStyles.modalTopTitle, { flex: 1, textAlign: 'center' }]}>{selectedProviderSkill.name}</Text>
                <TouchableOpacity onPress={() => {
                  Alert.alert('Видалити навичку', `Видалити "${selectedProviderSkill.name}"?`, [
                    { text: 'Скасувати', style: 'cancel' },
                    { text: 'Видалити', style: 'destructive', onPress: () => { removeSkill(selectedProviderSkill.id); setServiceDetailVisible(false); } },
                  ]);
                }}>
                  <Ionicons name="ellipsis-horizontal" size={24} color="#111827" />
                </TouchableOpacity>
              </View>

              <View style={pStyles.serviceDetailTabs}>
                <View style={[pStyles.serviceDetailTab, pStyles.serviceDetailTabActive]}>
                  <Text style={pStyles.serviceDetailTabTextActive}>Загальне</Text>
                </View>
                <View style={pStyles.serviceDetailTab}>
                  <Text style={pStyles.serviceDetailTabText}>Партнери</Text>
                </View>
              </View>

              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                <Text style={pStyles.serviceSectionLabel}>СТРУКТУРА ЗАРОБІТКУ</Text>
                <TouchableOpacity style={[pStyles.earningCard, { marginTop: 8, backgroundColor: '#eff6ff' }]}>
                  <View style={[pStyles.earningCardIcon, { backgroundColor: '#dbeafe' }]}>
                    <Ionicons name="person-add-outline" size={28} color="#2563eb" />
                  </View>
                  <Text style={[pStyles.earningCardTitle, { color: '#1e40af' }]}>Самостійна погодинна ставка</Text>
                  <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                </TouchableOpacity>

                <Text style={[pStyles.serviceSectionLabel, { marginTop: 20 }]}>ПОГОДИННА СТАВКА</Text>
                <View style={pStyles.rateEditRow}>
                  <TextInput
                    style={[pStyles.rateInput, { flex: 1, marginBottom: 0 }]}
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
                      } else {
                        Alert.alert('Помилка', 'Введіть коректну ставку');
                      }
                    }}
                  >
                    <Text style={pStyles.rateSaveBtnText}>Зберегти</Text>
                  </TouchableOpacity>
                </View>

                <Text style={[pStyles.serviceSectionLabel, { marginTop: 20 }]}>ФОТО РОБІТ</Text>
                {portfolioPhotos.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    {portfolioPhotos.slice(0, 5).map((photo, i) => (
                      <Image key={i} source={{ uri: photo }} style={pStyles.portfolioPhoto} />
                    ))}
                  </ScrollView>
                ) : null}
                <TouchableOpacity style={[pStyles.addPhotoBtn, { marginTop: 8 }]} onPress={pickPortfolioPhoto}>
                  <Ionicons name="camera-outline" size={20} color="#6b7280" />
                  <Text style={pStyles.addPhotoBtnText}>Додати фото</Text>
                </TouchableOpacity>

                <Text style={[pStyles.serviceSectionLabel, { marginTop: 20 }]}>ІНША ІНФОРМАЦІЯ</Text>
                <TouchableOpacity style={pStyles.infoRow} onPress={() => { setServiceDetailVisible(false); setTimeout(() => setBioModalVisible(true), 300); }}>
                  <Ionicons name="document-text-outline" size={22} color="#374151" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={pStyles.infoRowText}>Опис досвіду</Text>
                    {bio ? <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }} numberOfLines={1}>{bio}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                </TouchableOpacity>
              </ScrollView>
            </View>
          );
        })()}
      </Modal>

      {/* ── Account Details Modal (TaskRabbit style) ── */}
      <Modal visible={accountDetailsVisible} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
            <TouchableOpacity onPress={() => setAccountDetailsVisible(false)}>
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Деталі акаунту</Text>
            <TouchableOpacity onPress={() => setEditingAccountDetails(!editingAccountDetails)}>
              <Text style={{ fontSize: 16, color: '#2563eb', fontWeight: '600' }}>{editingAccountDetails ? 'Скасувати' : 'Редагувати'}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Avatar + name row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', flex: 1 }}>{user?.full_name || user?.username || 'Виконавець'}</Text>
              <TouchableOpacity onPress={pickProfilePhoto} style={{ position: 'relative' }}>
                {uploadingPhoto ? (
                  <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator color="#2563eb" />
                  </View>
                ) : user?.picture ? (
                  <Image source={{ uri: user.picture }} style={{ width: 60, height: 60, borderRadius: 30 }} />
                ) : (
                  <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="person" size={30} color="#fff" />
                  </View>
                )}
                <View style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}>
                  <Ionicons name="camera" size={11} color="#fff" />
                </View>
              </TouchableOpacity>
            </View>
            {/* Fields */}
            {([
              { label: 'Ім\'я', value: accountName, setter: setAccountName, key: 'name', editable: true },
              { label: 'Email', value: user?.email || '', setter: null, key: 'email', editable: false },
              { label: 'Мобільний телефон', value: accountPhone, setter: setAccountPhone, key: 'phone', editable: true },
              { label: 'Адреса', value: accountAddress, setter: setAccountAddress, key: 'address', editable: true },
            ] as { label: string; value: string; setter: ((v: string) => void) | null; key: string; editable: boolean }[]).map((field) => (
              <View key={field.key}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827', width: 140 }}>{field.label}</Text>
                  {editingAccountDetails && field.editable && field.setter ? (
                    <TextInput
                      style={{ flex: 1, fontSize: 15, color: '#374151', borderBottomWidth: 1, borderBottomColor: '#2563eb', paddingVertical: 2 }}
                      value={field.value}
                      onChangeText={field.setter}
                      placeholder={field.label}
                    />
                  ) : (
                    <Text style={{ flex: 1, fontSize: 15, color: '#374151', textAlign: 'right' }}>{field.value || '—'}</Text>
                  )}
                </View>
                <View style={{ height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 20 }} />
              </View>
            ))}
            {/* Info banner */}
            <View style={{ margin: 16, padding: 16, backgroundColor: '#fffbeb', borderRadius: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Ionicons name="information-circle-outline" size={22} color="#d97706" />
              <Text style={{ flex: 1, fontSize: 13, color: '#92400e' }}>Переїхали в нове місто? Зверніться до підтримки щоб оновити локацію.</Text>
            </View>
            {editingAccountDetails && (
              <TouchableOpacity
                style={{ margin: 16, padding: 16, backgroundColor: '#2563eb', borderRadius: 14, alignItems: 'center' }}
                onPress={async () => {
                  setSaving(true);
                  try {
                    await api.updateProfile({ full_name: accountName, phone: accountPhone, address: accountAddress });
                    Alert.alert('Збережено', 'Деталі акаунту оновлено');
                    setEditingAccountDetails(false);
                    setAccountDetailsVisible(false);
                  } catch (e: any) {
                    Alert.alert('Помилка', e.message || 'Не вдалося зберегти');
                  } finally { setSaving(false); }
                }}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Зберегти зміни</Text>}
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Bio Modal ── */}
      <Modal visible={bioModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Опис досвіду</Text>
              <TouchableOpacity onPress={() => setBioModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.label}>Про мене</Text>
              <TextInput
                style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
                value={bio}
                onChangeText={setBio}
                placeholder="Розкажіть про свій досвід, спеціалізацію та підхід до роботи..."
                multiline
              />
              <Text style={styles.label}>Роки досвіду</Text>
              <TextInput
                style={styles.input}
                value={experienceYears}
                onChangeText={setExperienceYears}
                placeholder="5"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => setBioModalVisible(false)}>
                <Text style={styles.btnCancelText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnSave]}
                onPress={() => {
                  saveProfile({ bio, experience_years: experienceYears ? parseInt(experienceYears) : undefined });
                  setBioModalVisible(false);
                  Alert.alert('Збережено', 'Опис досвіду оновлено');
                }}
              >
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
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
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
  avatarBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' },
  avatarImg: { width: 72, height: 72, borderRadius: 36 },
  cameraBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#2563eb', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  avatarName: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  avatarEmail: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  badge: { backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, marginTop: 4, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#2563eb' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  tabText: { fontSize: 14, fontWeight: '500', color: '#6b7280' },
  tabTextActive: { color: '#2563eb', fontWeight: '700' },
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
  progressFill: { height: '100%' as any, backgroundColor: '#2563eb', borderRadius: 4 },
  eliteSubtext: { fontSize: 12, color: '#374151' },
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
  modalTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 56, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', backgroundColor: '#fff' },
  modalTopTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', padding: 18, backgroundColor: '#fff' },
  categoryRowText: { flex: 1, fontSize: 16, fontWeight: '500', color: '#111827' },
  categoryExpanded: { backgroundColor: '#f9fafb', paddingHorizontal: 16 },
  subSkillRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  subSkillText: { flex: 1, fontSize: 15, color: '#374151' },
  categorySeparator: { height: 1, backgroundColor: '#e5e7eb' },
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
  serviceSection: { backgroundColor: '#fff', marginTop: 8, padding: 20 },
  serviceSectionLabel: { fontSize: 11, fontWeight: '700', color: '#9ca3af', letterSpacing: 1, marginBottom: 4 },
  earningCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f4ff', borderRadius: 12, padding: 16, marginTop: 8, gap: 14 },
  earningCardIcon: { width: 60, height: 60, borderRadius: 12, backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center' },
  earningCardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1e40af' },
  addPhotoBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f9fafb', borderRadius: 10, padding: 16, marginTop: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: '#d1d5db' },
  addPhotoBtnText: { fontSize: 14, color: '#6b7280' },
  portfolioPhoto: { width: 100, height: 100, borderRadius: 8, marginRight: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  infoRowText: { flex: 1, fontSize: 15, color: '#111827' },
  serviceDetailTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', backgroundColor: '#fff' },
  serviceDetailTab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  serviceDetailTabActive: { borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  serviceDetailTabText: { fontSize: 14, color: '#6b7280' },
  serviceDetailTabTextActive: { fontSize: 14, fontWeight: '700', color: '#2563eb' },
  rateEditRow: { flexDirection: 'row', gap: 12, marginTop: 8, alignItems: 'center' },
  rateSaveBtn: { backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 14, justifyContent: 'center' },
  rateSaveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  // Menu styles (Services tab)
  menuSectionLabel: { fontSize: 11, fontWeight: '700', color: '#9ca3af', letterSpacing: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, backgroundColor: '#f9fafb' },
  menuRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 16 },
  menuRowIcon: { marginRight: 14 },
  menuRowText: { fontSize: 16, color: '#111827', fontWeight: '500' },
  menuRowSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  menuDivider: { height: 1, backgroundColor: '#f3f4f6', marginLeft: 56 },
  portfolioThumb: { width: 80, height: 80, borderRadius: 8, marginRight: 8, marginTop: 4 },
  versionText: { textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 24, marginBottom: 8 },
});
