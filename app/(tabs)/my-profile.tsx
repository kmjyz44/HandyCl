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
          try {
            await api.logout().catch(() => {});
            await logout();
            router.replace('/login');
          } catch {
            await logout();
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

// ─── PROVIDER PROFILE ─────────────────────────────────────────────────────────

function ProviderProfile() {
  const router = useRouter();
  const { user, setUser, logout } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [modalType, setModalType] = useState<'bio' | 'skills' | 'rate' | 'cert' | 'lang' | null>(null);

  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [certifications, setCertifications] = useState<string[]>([]);
  const [newCert, setNewCert] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [newLanguage, setNewLanguage] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await api.getMyExecutorProfile();
      setProfile(data);
      setBio(data.bio || '');
      setSkills(data.skills || []);
      setExperienceYears(data.experience_years?.toString() || '');
      setHourlyRate(data.hourly_rate?.toString() || '');
      setCertifications(data.certifications || []);
      setLanguages(data.languages || []);
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
          router.replace('/login');
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
      Alert.alert('Успіх', 'Профіль оновлено');
    } catch (e: any) { Alert.alert('Помилка', e.message || 'Не вдалося зберегти'); }
    finally { setSaving(false); }
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

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
              <View style={[styles.avatar, { backgroundColor: '#2563eb' }]}>
                <ActivityIndicator color="#fff" size="large" />
              </View>
            ) : user?.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: '#2563eb' }]}>
                <Ionicons name="person" size={44} color="#fff" />
              </View>
            )}
            <View style={styles.cameraBtn}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={[styles.clientBadge, { backgroundColor: '#eff6ff' }]}>
            <Text style={[styles.clientBadgeText, { color: '#2563eb' }]}>ВИКОНАВЕЦЬ</Text>
          </View>
        </View>

        {/* Bio */}
        <TouchableOpacity style={styles.section} onPress={() => setModalType('bio')}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="person-outline" size={20} color="#2563eb" />
              <Text style={styles.sectionTitle}>Про мене</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </View>
          {bio ? (
            <Text style={styles.bioText} numberOfLines={3}>{bio}</Text>
          ) : (
            <Text style={styles.placeholderText}>Додайте опис про себе...</Text>
          )}
        </TouchableOpacity>

        {/* Hourly Rate */}
        <TouchableOpacity style={styles.section} onPress={() => setModalType('rate')}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="cash-outline" size={20} color="#10b981" />
              <Text style={styles.sectionTitle}>Погодинна ставка</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </View>
          {hourlyRate ? (
            <Text style={styles.rateText}>${hourlyRate}/год</Text>
          ) : (
            <Text style={styles.placeholderText}>Встановіть вашу ставку...</Text>
          )}
        </TouchableOpacity>

        {/* Skills */}
        <TouchableOpacity style={styles.section} onPress={() => setModalType('skills')}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="construct-outline" size={20} color="#f59e0b" />
              <Text style={styles.sectionTitle}>Навички</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </View>
          {skills.length > 0 ? (
            <View style={styles.tagsContainer}>
              {skills.map((skill, i) => (
                <View key={i} style={styles.tag}><Text style={styles.tagText}>{skill}</Text></View>
              ))}
            </View>
          ) : (
            <Text style={styles.placeholderText}>Додайте ваші навички...</Text>
          )}
        </TouchableOpacity>

        {/* Languages */}
        <TouchableOpacity style={styles.section} onPress={() => setModalType('lang')}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="globe-outline" size={20} color="#6366f1" />
              <Text style={styles.sectionTitle}>Мови</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </View>
          {languages.length > 0 ? (
            <View style={styles.tagsContainer}>
              {languages.map((lang, i) => (
                <View key={i} style={[styles.tag, { backgroundColor: '#ede9fe' }]}>
                  <Text style={[styles.tagText, { color: '#6366f1' }]}>{lang}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.placeholderText}>Додайте мови...</Text>
          )}
        </TouchableOpacity>

        {/* Certifications */}
        <TouchableOpacity style={styles.section} onPress={() => setModalType('cert')}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="ribbon-outline" size={20} color="#ec4899" />
              <Text style={styles.sectionTitle}>Сертифікати</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </View>
          {certifications.length > 0 ? (
            certifications.map((cert, i) => (
              <View key={i} style={styles.certItem}>
                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                <Text style={styles.certText}>{cert}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.placeholderText}>Додайте сертифікати...</Text>
          )}
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          <Text style={styles.logoutBtnText}>Вийти з акаунту</Text>
        </TouchableOpacity>

        <Text style={styles.version}>HandyHub v1.0.0</Text>
      </ScrollView>

      {/* Bio Modal */}
      <Modal visible={modalType === 'bio'} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Про мене</Text>
              <TouchableOpacity onPress={() => setModalType(null)}><Ionicons name="close" size={24} color="#6b7280" /></TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.label}>Опис</Text>
              <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top' }]} value={bio} onChangeText={setBio} placeholder="Розкажіть про себе..." multiline />
              <Text style={styles.label}>Роки досвіду</Text>
              <TextInput style={styles.input} value={experienceYears} onChangeText={setExperienceYears} placeholder="5" keyboardType="numeric" />
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => setModalType(null)}><Text style={styles.btnCancelText}>Скасувати</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={() => { saveProfile({ bio, experience_years: experienceYears ? parseInt(experienceYears) : undefined }); setModalType(null); }}>
                <Text style={styles.btnSaveText}>Зберегти</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Rate Modal */}
      <Modal visible={modalType === 'rate'} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Погодинна ставка</Text>
              <TouchableOpacity onPress={() => setModalType(null)}><Ionicons name="close" size={24} color="#6b7280" /></TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.label}>Ставка ($/год)</Text>
              <TextInput style={styles.input} value={hourlyRate} onChangeText={setHourlyRate} placeholder="25" keyboardType="numeric" />
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => setModalType(null)}><Text style={styles.btnCancelText}>Скасувати</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={() => {
                const rate = parseFloat(hourlyRate);
                if (isNaN(rate) || rate <= 0) { Alert.alert('Помилка', 'Введіть коректну ставку'); return; }
                saveProfile({ hourly_rate: rate }); setModalType(null);
              }}>
                <Text style={styles.btnSaveText}>Зберегти</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Skills Modal */}
      <Modal visible={modalType === 'skills'} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Навички</Text>
              <TouchableOpacity onPress={() => setModalType(null)}><Ionicons name="close" size={24} color="#6b7280" /></TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.inputRow}>
                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={newSkill} onChangeText={setNewSkill} placeholder="Нова навичка" />
                <TouchableOpacity style={styles.addInlineBtn} onPress={() => { if (newSkill.trim() && !skills.includes(newSkill.trim())) { setSkills([...skills, newSkill.trim()]); setNewSkill(''); } }}>
                  <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={[styles.tagsContainer, { marginTop: 12 }]}>
                {skills.map((skill, i) => (
                  <TouchableOpacity key={i} style={[styles.tag, { flexDirection: 'row', gap: 4 }]} onPress={() => setSkills(skills.filter(s => s !== skill))}>
                    <Text style={styles.tagText}>{skill}</Text>
                    <Ionicons name="close" size={14} color="#374151" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => setModalType(null)}><Text style={styles.btnCancelText}>Скасувати</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={() => { saveProfile({ skills }); setModalType(null); }}>
                <Text style={styles.btnSaveText}>Зберегти</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Languages Modal */}
      <Modal visible={modalType === 'lang'} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Мови</Text>
              <TouchableOpacity onPress={() => setModalType(null)}><Ionicons name="close" size={24} color="#6b7280" /></TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.inputRow}>
                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={newLanguage} onChangeText={setNewLanguage} placeholder="Нова мова" />
                <TouchableOpacity style={styles.addInlineBtn} onPress={() => { if (newLanguage.trim() && !languages.includes(newLanguage.trim())) { setLanguages([...languages, newLanguage.trim()]); setNewLanguage(''); } }}>
                  <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={[styles.tagsContainer, { marginTop: 12 }]}>
                {languages.map((lang, i) => (
                  <TouchableOpacity key={i} style={[styles.tag, { backgroundColor: '#ede9fe', flexDirection: 'row', gap: 4 }]} onPress={() => setLanguages(languages.filter(l => l !== lang))}>
                    <Text style={[styles.tagText, { color: '#6366f1' }]}>{lang}</Text>
                    <Ionicons name="close" size={14} color="#6366f1" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => setModalType(null)}><Text style={styles.btnCancelText}>Скасувати</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={() => { saveProfile({ languages }); setModalType(null); }}>
                <Text style={styles.btnSaveText}>Зберегти</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Certifications Modal */}
      <Modal visible={modalType === 'cert'} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Сертифікати</Text>
              <TouchableOpacity onPress={() => setModalType(null)}><Ionicons name="close" size={24} color="#6b7280" /></TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.inputRow}>
                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={newCert} onChangeText={setNewCert} placeholder="Назва сертифікату" />
                <TouchableOpacity style={styles.addInlineBtn} onPress={() => { if (newCert.trim() && !certifications.includes(newCert.trim())) { setCertifications([...certifications, newCert.trim()]); setNewCert(''); } }}>
                  <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={{ marginTop: 12 }}>
                {certifications.map((cert, i) => (
                  <TouchableOpacity key={i} style={styles.certItem} onPress={() => setCertifications(certifications.filter(c => c !== cert))}>
                    <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                    <Text style={[styles.certText, { flex: 1 }]}>{cert}</Text>
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => setModalType(null)}><Text style={styles.btnCancelText}>Скасувати</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={() => { saveProfile({ certifications }); setModalType(null); }}>
                <Text style={styles.btnSaveText}>Зберегти</Text>
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

// ─── STYLES ───────────────────────────────────────────────────────────────────

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

  // Provider specific
  bioText: { fontSize: 14, color: '#374151', lineHeight: 20, marginTop: 4 },
  placeholderText: { fontSize: 14, color: '#9ca3af', fontStyle: 'italic', marginTop: 4 },
  rateText: { fontSize: 20, fontWeight: '700', color: '#10b981', marginTop: 4 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  tag: { backgroundColor: '#f3f4f6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, flexDirection: 'row', alignItems: 'center' },
  tagText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  certItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  certText: { fontSize: 14, color: '#374151' },

  // Modals
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
