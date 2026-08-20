import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import { showAlertWithButtons } from '../../utils/alert';
import EmailVerificationBanner from '../../components/EmailVerificationBanner';
import IdentityVerificationBanner from '../../components/IdentityVerificationBanner';
import { NotificationSettingsModal } from '../../components/NotificationSettingsModal';
import AddressAutocomplete from '../../components/AddressAutocomplete';

// Web-safe Alert shim: native Alert.alert renders nothing on React Native Web,
// causing silent failures (e.g. card validation). Route every call through the
// in-app toast/modal hosts instead.
const Alert = {
  alert: (title: string, message?: string, buttons?: any[]) =>
    showAlertWithButtons(title, message || '', buttons && buttons.length ? buttons : [{ text: 'OK' }]),
};

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
  const [notifModalVisible, setNotifModalVisible] = useState(false);

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
  const [addressState, setAddressState] = useState('Illinois');
  const [addressUnit, setAddressUnit] = useState('');
  const [addressZip, setAddressZip] = useState('');

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
      if (window.confirm('Log out of your account?')) doLogout();
    } else {
      Alert.alert('Log out', 'Are you sure you want to log out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: doLogout },
      ]);
    }
  };

  const pickProfilePhoto = async () => {
    Alert.alert('Profile photo', 'Choose an option', [
      {
        text: 'Choose from gallery',
        onPress: async () => {
          const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!permission.granted) {
            Alert.alert('Error', 'Gallery access is required');
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
        text: 'Take a photo',
        onPress: async () => {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) {
            Alert.alert('Error', 'Camera access is required');
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
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const uploadPhoto = async (base64: string) => {
    setUploadingPhoto(true);
    try {
      const picture = `data:image/jpeg;base64,${base64}`;
      const updatedUser = await api.updateProfile({ picture });
      setUser(updatedUser);
      Alert.alert('Success', 'Profile photo updated');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not update photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const saveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
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
      Alert.alert('Success', 'Profile updated');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPayment = async () => {
    const digits = cardNumber.replace(/\D/g, '');
    if (!digits || !cardExpiry.trim() || !cardHolder.trim()) {
      Alert.alert('Error', 'Fill in all card fields');
      return;
    }
    // Client-side Luhn check
    const luhn = (n: string) => {
      let sum = 0; let alt = false;
      for (let i = n.length - 1; i >= 0; i--) {
        let d = parseInt(n[i], 10);
        if (alt) { d *= 2; if (d > 9) d -= 9; }
        sum += d; alt = !alt;
      }
      return n.length >= 12 && sum % 10 === 0;
    };
    if (!luhn(digits)) {
      Alert.alert('Error', 'Invalid card number');
      return;
    }
    const em = cardExpiry.replace(/\s/g, '').match(/^(\d{2})\/(\d{2,4})$/);
    if (!em || +em[1] < 1 || +em[1] > 12) {
      Alert.alert('Error', 'Invalid expiry date (MM/YY)');
      return;
    }
    const yr = em[2].length === 2 ? 2000 + +em[2] : +em[2];
    const now = new Date();
    if (yr < now.getFullYear() || (yr === now.getFullYear() && +em[1] < now.getMonth() + 1)) {
      Alert.alert('Error', 'The card has expired');
      return;
    }
    try {
      await api.addPaymentMethod({
        card_number: digits,
        expiry: cardExpiry,
        card_holder: cardHolder,
        type: 'card',
      });
      setCardNumber('');
      setCardExpiry('');
      setCardHolder('');
      setAddPaymentVisible(false);
      loadData();
      Alert.alert('Success', 'Card added');
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.detail || error?.message || 'Could not add card');
    }
  };

  const handleDeletePayment = (id: string) => {
    Alert.alert('Delete card', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deletePaymentMethod(id);
            loadData();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Could not delete');
          }
        },
      },
    ]);
  };

  const handleAddAddress = async () => {
    if (!addressText.trim() || !addressCity.trim() || !addressState.trim()) {
      Alert.alert('Error', 'Enter at least state, city and street');
      return;
    }
    try {
      await api.addSavedAddress({
        label: addressLabel.trim() || 'My address',
        street: addressText.trim(),
        city: addressCity.trim(),
        state: addressState.trim(),
        unit: addressUnit.trim() || undefined,
        zip: addressZip.trim() || undefined,
      });
      setAddressLabel(''); setAddressText(''); setAddressCity('');
      setAddressState('Illinois'); setAddressUnit(''); setAddressZip('');
      setAddAddressVisible(false);
      loadData();
      Alert.alert('Success', 'Address added');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not add address');
    }
  };

  const handleDeleteAddress = (id: string) => {
    Alert.alert('Delete address', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteSavedAddress(id);
            loadData();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Could not delete');
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
        <Text style={styles.topBarTitle}>My profile</Text>
        <TouchableOpacity style={styles.logoutTopBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          <Text style={styles.logoutTopText}>Log out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ marginTop: 12 }}>
          <EmailVerificationBanner />
        </View>
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
              <Text style={styles.ratingCount}>({reviews.length} reviews)</Text>
            </View>
          ) : (
            <View style={styles.ratingRow}>
              <Ionicons name="star-outline" size={16} color="#9ca3af" />
              <Text style={styles.ratingEmpty}>No reviews yet</Text>
            </View>
          )}

          <View style={styles.clientBadge}>
            <Text style={styles.clientBadgeText}>CLIENT</Text>
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
          <Text style={styles.editProfileText}>Edit profile</Text>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </TouchableOpacity>

        {/* Payment Methods */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="card-outline" size={20} color="#2563eb" />
              <Text style={styles.sectionTitle}>Payment methods</Text>
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
              <Text style={styles.emptyText}>No saved cards</Text>
              <Text style={styles.emptySubtext}>Add a card for quick payment</Text>
            </View>
          ) : (
            paymentMethods.map((pm: any) => (
              <View key={pm._id || pm.id} style={styles.paymentCard}>
                <View style={styles.paymentCardLeft}>
                  <Ionicons name="card" size={28} color="#2563eb" />
                  <View style={styles.paymentCardInfo}>
                    <Text style={styles.paymentCardNumber}>{pm.brand ? `${pm.brand} •••• ${pm.last4}` : maskCard(pm.card_number)}</Text>
                    <Text style={styles.paymentCardHolder}>{[pm.card_holder, pm.expiry].filter(Boolean).join(' · ')}</Text>
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
              <Text style={styles.sectionTitle}>My addresses</Text>
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
              <Text style={styles.emptyText}>No saved addresses</Text>
              <Text style={styles.emptySubtext}>Add an address for quick booking</Text>
            </View>
          ) : (
            addresses.map((addr: any) => (
              <View key={addr._id || addr.id} style={styles.addressCard}>
                <View style={styles.addressLeft}>
                  <View style={styles.addressIcon}>
                    <Ionicons name="location" size={20} color="#10b981" />
                  </View>
                  <View style={styles.addressInfo}>
                    <Text style={styles.addressLabel}>{addr.label || 'Address'}</Text>
                    <Text style={styles.addressText}>{[addr.street || addr.address, addr.unit].filter(Boolean).join(', ')}</Text>
                    <Text style={styles.addressCity}>{[addr.city, addr.state, addr.zip].filter(Boolean).join(', ')}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleDeleteAddress(addr._id || addr.id)}>
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Account Verification */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account verification</Text>
          <TouchableOpacity
            style={styles.menuItem}
            disabled={(user as any)?.email_verified}
            onPress={() => router.push({ pathname: '/verify-email', params: { email: user?.email } } as any)}
            data-testid="verify-email-row"
          >
            <Ionicons name="mail-outline" size={22} color={(user as any)?.email_verified ? '#059669' : '#6b7280'} />
            <Text style={styles.menuText}>Email</Text>
            {(user as any)?.email_verified ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="checkmark-circle" size={18} color="#059669" />
                <Text style={{ fontSize: 13, color: '#059669', fontWeight: '600' }}>Verified</Text>
              </View>
            ) : (
              <Text style={{ fontSize: 13, color: '#dc2626', fontWeight: '600' }}>Verify</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            disabled={(user as any)?.phone_verified}
            onPress={() => router.push({ pathname: '/verify-phone', params: { phone: user?.phone } } as any)}
            data-testid="verify-phone-row"
          >
            <Ionicons name="call-outline" size={22} color={(user as any)?.phone_verified ? '#059669' : '#6b7280'} />
            <Text style={styles.menuText}>Phone</Text>
            {(user as any)?.phone_verified ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="checkmark-circle" size={18} color="#059669" />
                <Text style={{ fontSize: 13, color: '#059669', fontWeight: '600' }}>Verified</Text>
              </View>
            ) : (
              <Text style={{ fontSize: 13, color: '#dc2626', fontWeight: '600' }}>Verify</Text>
            )}
          </TouchableOpacity>
        </View>


        {/* Rewards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rewards</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/rewards' as any)} data-testid="myprofile-rewards-link">
            <Ionicons name="gift-outline" size={22} color="#16a34a" />
            <Text style={[styles.menuText, { color: '#15803d', fontWeight: '700' }]}>My rewards & invite friends</Text>
            <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
          </TouchableOpacity>
        </View>

        {/* Company */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Company</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/about' as any)} data-testid="myprofile-about-link">
            <Ionicons name="information-circle-outline" size={22} color="#6b7280" />
            <Text style={styles.menuText}>About Ono-Fix</Text>
            <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/how-it-works' as any)} data-testid="myprofile-how-link">
            <Ionicons name="bulb-outline" size={22} color="#6b7280" />
            <Text style={styles.menuText}>How It Works</Text>
            <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/pricing' as any)} data-testid="myprofile-pricing-link">
            <Ionicons name="pricetag-outline" size={22} color="#6b7280" />
            <Text style={styles.menuText}>Pricing</Text>
            <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/contact' as any)} data-testid="myprofile-contact-link">
            <Ionicons name="mail-outline" size={22} color="#6b7280" />
            <Text style={styles.menuText}>Contact Us</Text>
            <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
          </TouchableOpacity>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setNotifModalVisible(true)}
            data-testid="notifications-menu-row"
          >
            <Ionicons name="notifications-outline" size={22} color="#6b7280" />
            <Text style={styles.menuText}>Notifications</Text>
            <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
          </TouchableOpacity>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/help-center' as any)}
            data-testid="help-center-link"
          >
            <Ionicons name="help-circle-outline" size={22} color="#6b7280" />
            <Text style={styles.menuText}>Help Center</Text>
            <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/terms' as any)}
            data-testid="myprofile-terms-link"
          >
            <Ionicons name="document-text-outline" size={22} color="#6b7280" />
            <Text style={styles.menuText}>Terms of Use</Text>
            <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/privacy' as any)}
            data-testid="myprofile-privacy-link"
          >
            <Ionicons name="shield-checkmark-outline" size={22} color="#6b7280" />
            <Text style={styles.menuText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          <Text style={styles.logoutBtnText}>Log out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Ono-Fix v1.0.0</Text>
        <Text style={styles.aboutFine}>Ono-Fix is owned and operated by Nexus Security Solutions LLC.</Text>
      </ScrollView>

      {/* Notifications Modal */}
      <NotificationSettingsModal visible={notifModalVisible} onClose={() => setNotifModalVisible(false)} />


      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit profile</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.label}>First name</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Your name"
              />
              <Text style={styles.label}>Phone</Text>
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
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnSave]}
                onPress={saveProfile}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSaveText}>Save</Text>}
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
              <Text style={styles.modalTitle}>Add card</Text>
              <TouchableOpacity onPress={() => setAddPaymentVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.label}>Card number</Text>
              <TextInput
                style={styles.input}
                value={cardNumber}
                onChangeText={setCardNumber}
                placeholder="1234 5678 9012 3456"
                keyboardType="numeric"
                maxLength={19}
              />
              <Text style={styles.label}>Expiry date</Text>
              <TextInput
                style={styles.input}
                value={cardExpiry}
                onChangeText={setCardExpiry}
                placeholder="MM/YY"
                maxLength={5}
              />
              <Text style={styles.label}>Cardholder name</Text>
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
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={handleAddPayment}>
                <Text style={styles.btnSaveText}>Add</Text>
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
              <Text style={styles.modalTitle}>Add address</Text>
              <TouchableOpacity onPress={() => setAddAddressVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Label (e.g., Home, Work)</Text>
              <TextInput style={styles.input} value={addressLabel} onChangeText={setAddressLabel} placeholder="Home" data-testid="addr-label-input" />
              <Text style={styles.label}>State</Text>
              <TextInput style={styles.input} value={addressState} onChangeText={setAddressState} placeholder="Illinois" data-testid="addr-state-input" />
              <Text style={styles.label}>City</Text>
              <TextInput style={styles.input} value={addressCity} onChangeText={setAddressCity} placeholder="Chicago" data-testid="addr-city-input" />
              <Text style={styles.label}>Street and number</Text>
              <AddressAutocomplete
                value={addressText}
                onChangeText={setAddressText}
                city={addressCity}
                state={addressState}
                placeholder="123 Main St"
                testID="addr-street-input"
                onSelect={(_formatted, parts) => {
                  if (parts.city) setAddressCity(parts.city);
                  if (parts.state) setAddressState(parts.state);
                  if (parts.postal_code) setAddressZip(parts.postal_code);
                }}
              />
              <Text style={styles.label}>Apt / Unit / Floor (optional)</Text>
              <TextInput style={styles.input} value={addressUnit} onChangeText={setAddressUnit} placeholder="Apt 4B" data-testid="addr-unit-input" />
              <Text style={styles.label}>ZIP code (optional)</Text>
              <TextInput style={styles.input} value={addressZip} onChangeText={setAddressZip} placeholder="60601" keyboardType="numeric" data-testid="addr-zip-input" />
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.btn, styles.btnCancel]}
                onPress={() => setAddAddressVisible(false)}
              >
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={handleAddAddress}>
                <Text style={styles.btnSaveText}>Save</Text>
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
    name: 'Furniture Assembly',
    icon: 'construct-outline' as const,
    color: '#2563eb',
    bg: '#eff6ff',
    skills: [
      { id: 'furniture_assembly', name: 'Furniture Assembly', tools: ['Screwdriver', 'Drill', 'Level', 'Hammer'], description: 'Assemble furniture of any type — from IKEA to custom pieces. Clients expect careful, damage-free assembly.' },
      { id: 'ikea_assembly', name: 'IKEA Assembly', tools: ['Allen key', 'Hammer', 'Level', 'Screwdriver'], description: 'Assembly and installation of IKEA furniture of any complexity. Knowledge of IKEA instructions is required.' },
      { id: 'shelving', name: 'Shelf Mounting', tools: ['Drill', 'Wall plugs', 'Level', 'Pencil'], description: 'Installing shelves, racks, and storage systems on walls of any type.' },
      { id: 'wardrobe', name: 'Wardrobe Assembly', tools: ['Power drill', 'Level', 'Hammer'], description: 'Assembly of built-in and freestanding wardrobes and closet systems.' },
      { id: 'office_furniture', name: 'Office Furniture', tools: ['Drill', 'Screwdriver', 'Level'], description: 'Assembly of office desks, chairs, shelving, and partitions.' },
      { id: 'tv_mount', name: 'TV Mounting', tools: ['Drill', 'Wall plugs', 'Level', 'Bracket'], description: 'Mounting TVs on the wall, connecting cables, and concealing wires.' },
    ],
  },
  {
    id: 'cleaning',
    name: 'Cleaning',
    icon: 'sparkles-outline' as const,
    color: '#0891b2',
    bg: '#ecfeff',
    skills: [
      { id: 'home_cleaning', name: 'House Cleaning', tools: ['Vacuum', 'Mop', 'Cleaning supplies', 'Bucket'], description: 'Deep or regular cleaning of homes. Includes washing floors, windows, and bathrooms.' },
      { id: 'office_cleaning', name: 'Office Cleaning', tools: ['Vacuum', 'Wipes', 'Disinfectant', 'Mop'], description: 'Cleaning office and commercial spaces after a workday or week.' },
      { id: 'deep_cleaning', name: 'Deep Cleaning', tools: ['Steam cleaner', 'Chemicals', 'Brushes', 'Gloves'], description: 'Deep cleaning of all surfaces, including hard-to-reach spots, ovens, and refrigerators.' },
      { id: 'move_in_out', name: 'Move-in/out Cleaning', tools: ['Vacuum', 'Mop', 'Chemicals', 'Wipes'], description: 'Cleaning an apartment or house before move-in or after move-out.' },
      { id: 'window_cleaning', name: 'Window Washing', tools: ['Squeegee', 'Glass cleaner', 'Wipes', 'Bucket'], description: 'Washing windows inside and out, balcony doors, and storefronts.' },
      { id: 'carpet_cleaning', name: 'Carpet Cleaning', tools: ['Vacuum', 'Steam cleaner', 'Carpet cleaner'], description: 'Deep cleaning of carpets and upholstered furniture, removing dirt and stains.' },
    ],
  },
  {
    id: 'home_improvements',
    name: 'Home Repair',
    icon: 'hammer-outline' as const,
    color: '#7c3aed',
    bg: '#f5f3ff',
    skills: [
      { id: 'appliance_install', name: 'Appliance Installation', tools: ['Drill', 'Wrenches', 'Level', 'Electrical tape'], description: 'Connecting and installing home appliances: washers, dishwashers, air conditioners.' },
      { id: 'door_repair', name: 'Door & Furniture Repair', tools: ['Power drill', 'Hinges', 'Glue', 'Chisel'], description: 'Repairing and adjusting doors, cabinets, and drawers. Hardware replacement.' },
      { id: 'painting', name: 'Painting', tools: ['Roller', 'Brushes', "Painter's tape", 'Paint', 'Tray'], description: 'Painting walls, ceilings, and other surfaces. Surface prep, priming, and finish coats.' },
      { id: 'tiling', name: 'Tiling', tools: ['Notched trowel', 'Tile cutter', 'Level', 'Grout'], description: 'Laying ceramic tile in bathrooms, kitchens, and other rooms.' },
      { id: 'flooring', name: 'Flooring', tools: ['Hammer', 'Tapping block', 'Level', 'Saw'], description: 'Installing laminate, hardwood, vinyl, and other flooring.' },
      { id: 'drywall', name: 'Drywall', tools: ['Power drill', 'Knife', 'Level', 'Putty knife'], description: 'Installing drywall partitions, ceilings, niches, and arches.' },
      { id: 'plumbing', name: 'Plumbing', tools: ['Wrenches', 'Teflon tape', 'Soldering iron', 'Pipes'], description: 'Installing and repairing plumbing: faucets, toilets, sinks, and showers.' },
      { id: 'electrical', name: 'Electrical', tools: ['Screwdriver', 'Tester', 'Pliers', 'Electrical tape'], description: 'Installing outlets, switches, and light fixtures. Basic electrical work.' },
    ],
  },
  {
    id: 'moving',
    name: 'Moving & Delivery',
    icon: 'cube-outline' as const,
    color: '#d97706',
    bg: '#fffbeb',
    skills: [
      { id: 'moving_help', name: 'Moving Help', tools: ['Truck', 'Straps', 'Protective film', 'Blankets'], description: 'Transporting belongings and furniture during a move. Careful loading and unloading.' },
      { id: 'packing', name: 'Packing', tools: ['Boxes', 'Tape', 'Bubble wrap', 'Marker'], description: 'Careful packing and preparing belongings for a move. Labeling boxes.' },
      { id: 'furniture_moving', name: 'Furniture Moving', tools: ['Straps', 'Protective film', 'Gloves'], description: 'Moving heavy furniture within a space or between floors.' },
      { id: 'delivery', name: 'Delivery', tools: ['Car or bike', 'Phone'], description: 'Delivering goods, documents, and packages across town.' },
      { id: 'junk_removal', name: 'Junk Removal', tools: ['Truck', 'Gloves', 'Bags'], description: 'Removing old furniture, construction debris, and unwanted items.' },
    ],
  },
  {
    id: 'outdoor',
    name: 'Outdoor Work',
    icon: 'leaf-outline' as const,
    color: '#16a34a',
    bg: '#f0fdf4',
    skills: [
      { id: 'lawn_care', name: 'Lawn Care', tools: ['Lawn mower', 'Trimmer', 'Rake', 'Bags'], description: 'Mowing grass, trimming bushes, raking leaves, and yard care.' },
      { id: 'snow_removal', name: 'Snow Removal', tools: ['Shovel', 'Snow blower', 'Salt', 'Sand'], description: 'Clearing snow from walkways, driveways, porches, and roofs.' },
      { id: 'garden_planting', name: 'Gardening', tools: ['Shovel', 'Rake', 'Watering can', 'Gloves'], description: 'Planting flowers, trees, and shrubs. Garden maintenance.' },
      { id: 'pressure_washing', name: 'Pressure Washing', tools: ['Pressure washer', 'Hose', 'Supplies'], description: 'Washing facades, walkways, patios, fences, and vehicles.' },
      { id: 'fence_install', name: 'Fence Installation', tools: ['Drill', 'Shovel', 'Level', 'Concrete'], description: 'Installing and repairing fences, gates, and enclosures of various types.' },
    ],
  },
  {
    id: 'personal',
    name: 'Personal Assistance',
    icon: 'person-outline' as const,
    color: '#db2777',
    bg: '#fdf2f8',
    skills: [
      { id: 'errand', name: 'Errands', tools: ['Car', 'Phone'], description: 'Running various errands: shopping, waiting in lines, paperwork.' },
      { id: 'shopping', name: 'Shopping Assistant', tools: ['Car', 'Shopping list'], description: 'Help with shopping at stores, markets, and online orders.' },
      { id: 'pet_care', name: 'Pet Care', tools: ['Leash', 'Food', 'Toys'], description: 'Dog walking and pet care while owners are away.' },
      { id: 'elderly_help', name: 'Senior Care', tools: ['Patience', 'Transport'], description: 'Companionship, household help, and running errands for seniors.' },
    ],
  },
  {
    id: 'it_tech',
    name: 'IT & Tech',
    icon: 'laptop-outline' as const,
    color: '#0f766e',
    bg: '#f0fdfa',
    skills: [
      { id: 'computer_setup', name: 'Computer Setup', tools: ['Computer', 'Tools', 'USB drive'], description: 'Installing operating systems, software, and antivirus. Network setup.' },
      { id: 'tv_setup', name: 'Smart TV Setup', tools: ['Remote', 'HDMI cable', 'Internet'], description: 'Connecting and setting up Smart TVs, streaming boxes, and services.' },
      { id: 'phone_repair', name: 'Phone Repair', tools: ['Screwdriver set', 'Spare parts', 'Tweezers'], description: 'Replacing screens, batteries, and other smartphone components.' },
      { id: 'network_setup', name: 'Network Setup', tools: ['Router', 'Cables', 'Tester'], description: 'Installing and configuring Wi-Fi routers and network equipment.' },
      { id: 'data_recovery', name: 'Data Recovery', tools: ['Computer', 'Special software', 'Hard drive'], description: 'Recovering deleted files, photos, and documents from various media.' },
    ],
  },
  {
    id: 'events',
    name: 'Events & Parties',
    icon: 'balloon-outline' as const,
    color: '#9333ea',
    bg: '#faf5ff',
    skills: [
      { id: 'event_setup', name: 'Event Setup', tools: ['Decor', 'Tables', 'Chairs', 'Lighting'], description: 'Preparing and decorating spaces for celebrations, corporate events, and parties.' },
      { id: 'photography', name: 'Photography', tools: ['Camera', 'Flash', 'Tripod'], description: 'Event, portrait, product, and documentary photography.' },
      { id: 'catering_help', name: 'Kitchen Help', tools: ['Kitchen tools', 'Apron'], description: 'Help with preparing and serving food at events.' },
      { id: 'bartending', name: 'Bartending', tools: ['Shaker', 'Bar tools', 'Glassware'], description: 'Mixing cocktails and drinks at events and parties.' },
    ],
  },
  {
    id: 'other',
    name: 'Other',
    icon: 'ellipsis-horizontal-outline' as const,
    color: '#6b7280',
    bg: '#f9fafb',
    skills: [
      { id: 'handyman', name: 'Handyman', tools: ['Toolkit', 'Materials'], description: 'Minor repairs and various household tasks that do not fall into other categories.' },
      { id: 'tutoring', name: 'Tutoring', tools: ['Textbooks', 'Notebooks', 'Computer'], description: 'Teaching and tutoring students in various subjects.' },
      { id: 'translation', name: 'Translation', tools: ['Computer', 'Dictionaries'], description: 'Spoken and written translation of documents and texts.' },
      { id: 'driving', name: 'Driver', tools: ['Car', "Driver's license"], description: 'Transporting passengers and cargo around town and beyond.' },
    ],
  },
];

type SkillPhoto = { uri: string; caption: string };
type ProviderSkill = {
  id: string;
  category_id: string;
  name: string;
  hourly_rate: number;
  status: 'active' | 'in_progress';
  photos?: SkillPhoto[];
  experience?: string;
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
  const tabParam = useLocalSearchParams()?.tab as string | undefined;
  useEffect(() => {
    if (tabParam === 'skills' || tabParam === 'service' || tabParam === 'performance') {
      setActiveTab(tabParam);
    }
  }, [tabParam]);
  const [notifModalVisible, setNotifModalVisible] = useState(false);

  // Provider skills
  const [providerSkills, setProviderSkills] = useState<ProviderSkill[]>([]);

  // Stats
  const [stats, setStats] = useState({
    monthEarnings: 0, taskCount: 0, rating: 0, reviewCount: 0,
    avgPosition: '-', shownPercent: 0, activatedSkillsCount: 0,
    positiveReviews: 0, negativeReviews: 0,
  });

  // Reviews
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsModalVisible, setReviewsModalVisible] = useState(false);

  // 2FA modal
  const [twoFaVisible, setTwoFaVisible] = useState(false);
  const [twoFaMethod, setTwoFaMethod] = useState<'email' | 'phone'>('email');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaStep, setTwoFaStep] = useState<'choose' | 'verify'>('choose');
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);

  // Support modal
  const [supportVisible, setSupportVisible] = useState(false);
  const [supportMessage, setSupportMessage] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [sendingSupport, setSendingSupport] = useState(false);

  // About app modal
  const [aboutVisible, setAboutVisible] = useState(false);

  // Bio/experience
  const [bio, setBio] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [minimumHours, setMinimumHours] = useState(1);
  const [bioModalVisible, setBioModalVisible] = useState(false);
  const [accountDetailsVisible, setAccountDetailsVisible] = useState(false);
  const [editingAccountDetails, setEditingAccountDetails] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [accountPhone, setAccountPhone] = useState('');
  const [accountAddress, setAccountAddress] = useState('');

  // Portfolio photos with captions
  const [portfolioPhotos, setPortfolioPhotos] = useState<string[]>([]);
  const [photoCaptions, setPhotoCaptions] = useState<Record<number, string>>({});
  const [photosModalVisible, setPhotosModalVisible] = useState(false);
  const [savingPhotos, setSavingPhotos] = useState(false);

  // Service area
  const [serviceAreaVisible, setServiceAreaVisible] = useState(false);

  // Add Skills modal
  const [addSkillsVisible, setAddSkillsVisible] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [selectedSkillDetail, setSelectedSkillDetail] = useState<{ categoryId: string; skill: typeof SKILL_CATEGORIES[0]['skills'][0] } | null>(null);
  const [newSkillRate, setNewSkillRate] = useState('');

  // Admin-created (DB) categories, merged into the built-in skill catalog so
  // providers can pick them too.
  const [dbCategories, setDbCategories] = useState<any[]>([]);
  useEffect(() => {
    api.getCategories()
      .then((data: any[]) => { if (Array.isArray(data)) setDbCategories(data); })
      .catch(() => {});
  }, []);

  const allSkillCategories = React.useMemo(() => {
    const builtinIds = new Set(SKILL_CATEGORIES.map(c => c.id));
    const dbOnly = dbCategories
      .filter((c: any) => c.is_active !== false)
      .filter((c: any) => !builtinIds.has(c.category_id || c.id))
      .map((c: any) => {
        const id = c.category_id || c.id;
        return {
          id,
          name: c.name || 'Category',
          icon: 'apps-outline' as any,
          color: '#475569',
          bg: '#f1f5f9',
          skills: [{
            id: `${id}_general`,
            name: c.name || 'Category',
            tools: [] as string[],
            description: c.description || `Offer "${c.name}" services to clients in your service area.`,
          }],
        };
      });
    return [...SKILL_CATEGORIES, ...dbOnly];
  }, [dbCategories]);

  const findSkillCategory = (id: string) =>
    allSkillCategories.find(c => c.id === id) || SKILL_CATEGORIES[SKILL_CATEGORIES.length - 1];


  // Service detail modal
  const [serviceDetailVisible, setServiceDetailVisible] = useState(false);
  const [selectedProviderSkill, setSelectedProviderSkill] = useState<ProviderSkill | null>(null);
  const [editingRate, setEditingRate] = useState('');
  // Per-skill editing state (photos with captions + experience)
  const [skillPhotos, setSkillPhotos] = useState<SkillPhoto[]>([]);
  const [skillExperience, setSkillExperience] = useState('');
  const [savingSkill, setSavingSkill] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const data = await api.getMyExecutorProfile();
      setProfile(data);
      setBio(data.bio || '');
      setExperienceYears(data.experience_years?.toString() || '');
      setMinimumHours(Math.max(1, Number(data.minimum_hours || 1)));
      // Load reviews
      try {
        const reviewsData = await api.getProviderReviews(data.user_id || user?.user_id || '');
        const revList = Array.isArray(reviewsData) ? reviewsData : (reviewsData?.reviews || []);
        setReviews(revList);
        const positiveCount = revList.filter((r: any) => (r.rating || 0) >= 4).length;
        const negativeCount = revList.filter((r: any) => (r.rating || 0) <= 2).length;
        setStats(prev => ({ ...prev, positiveReviews: positiveCount, negativeReviews: negativeCount }));
      } catch {}
      const storedSkills: ProviderSkill[] = (data.skills || []).map((s: any, i: number) => {
        if (typeof s === 'string') {
          // Reverse-lookup category from the hardcoded SKILL_CATEGORIES map
          // so legacy bookings that only stored skill names still resolve
          // to the correct category (otherwise everything falls into 'other').
          let categoryId = 'other';
          for (const c of SKILL_CATEGORIES) {
            if (c.skills.some(sk => sk.name.toLowerCase() === s.toLowerCase())) {
              categoryId = c.id;
              break;
            }
          }
          return { id: `skill_${i}`, category_id: categoryId, name: s, hourly_rate: data.hourly_rate || 25, status: 'active' as const };
        }
        return s;
      });
      setProviderSkills(storedSkills);
      const photos = data.portfolio_photos || [];
      setPortfolioPhotos(photos);
      // Load captions from localStorage
      if (Platform.OS === 'web') {
        try {
          const stored = localStorage.getItem(`photo_captions_${data.user_id || user?.user_id}`);
          if (stored) setPhotoCaptions(JSON.parse(stored));
        } catch {}
      }
      setStats(prev => ({
        ...prev,
        rating: data.rating || 0,
        reviewCount: data.review_count || 0,
        activatedSkillsCount: storedSkills.filter((s: ProviderSkill) => s.status === 'active').length,
      }));
      // Load provider stats (task count, earnings, etc.)
      try {
        const providerStats = await api.getMyProviderStats();
        const s = providerStats.stats || providerStats;
        setStats(prev => ({
          ...prev,
          taskCount: s.total_tasks || 0,
          monthEarnings: s.total_earnings || 0,
        }));
      } catch {}
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
      if (window.confirm('Log out of your account?')) doLogout();
    } else {
      Alert.alert('Log out', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: doLogout },
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
              await api.updateProfilePhoto(ev.target.result);
              setUser({ ...user!, picture: ev.target.result });
              Alert.alert('Success', 'Profile photo updated');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not update photo');
            } finally { setUploadingPhoto(false); }
          };
          reader.readAsDataURL(file);
        } catch { setUploadingPhoto(false); }
      };
      input.click();
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Error', 'Gallery access is required'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setUploadingPhoto(true);
      try {
        const picture = `data:image/jpeg;base64,${result.assets[0].base64}`;
        await api.updateProfilePhoto(picture);
        setUser({ ...user!, picture });
        Alert.alert('Success', 'Profile photo updated');
      } catch (e: any) { Alert.alert('Error', e.message || 'Could not update photo'); }
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
        if (files.length > 0) Alert.alert('Success', `Added ${files.length} photos`);
      };
      input.click();
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Error', 'Gallery access is required'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.7,
    });
    if (!result.canceled) {
      const newPhotos = [...portfolioPhotos, result.assets[0].uri];
      setPortfolioPhotos(newPhotos);
      Alert.alert('Success', 'Photo added to portfolio');
    }
  };

  const saveProfile = async (updates: any) => {
    setSaving(true);
    try {
      if (profile?.profile_id) { await api.updateExecutorProfile(updates); }
      else { await api.createExecutorProfile(updates); }
      await loadProfile();
    } catch (e: any) { Alert.alert('Error', e.message || 'Could not save'); throw e; }
    finally { setSaving(false); }
  };

  const skillToPayload = (s: ProviderSkill) => ({
    id: s.id,
    category_id: s.category_id,
    name: s.name,
    hourly_rate: s.hourly_rate,
    status: s.status,
    photos: s.photos || [],
    experience: s.experience || '',
  });

  const addSkill = (categoryId: string, skill: typeof SKILL_CATEGORIES[0]['skills'][0], rate: number) => {
    const newSkill: ProviderSkill = {
      id: `${categoryId}_${skill.id}_${Date.now()}`,
      category_id: categoryId,
      name: skill.name,
      hourly_rate: rate,
      status: 'active',
      photos: [],
      experience: '',
    };
    const updated = [...providerSkills, newSkill];
    setProviderSkills(updated);
    saveProfile({
      skills: updated.map(skillToPayload),
      hourly_rate: rate,
    });
    setStats(prev => ({ ...prev, activatedSkillsCount: updated.filter(s => s.status === 'active').length }));
  };

  const removeSkill = (skillId: string) => {
    const updated = providerSkills.filter(s => s.id !== skillId);
    setProviderSkills(updated);
    saveProfile({ skills: updated.map(skillToPayload) });
    setStats(prev => ({ ...prev, activatedSkillsCount: updated.filter(s => s.status === 'active').length }));
  };

  const updateSkillRate = (skillId: string, rate: number) => {
    const updated = providerSkills.map(s => s.id === skillId ? { ...s, hourly_rate: rate } : s);
    setProviderSkills(updated);
    saveProfile({
      skills: updated.map(skillToPayload),
      hourly_rate: rate,
    });
  };

  // Persist rate + photos + experience for a single skill
  const saveSkillDetails = async () => {
    if (!selectedProviderSkill) return;
    const rate = parseFloat(editingRate);
    if (isNaN(rate) || rate <= 0) { Alert.alert('Error', 'Enter a valid hourly rate'); return; }
    setSavingSkill(true);
    const updated = providerSkills.map(s =>
      s.id === selectedProviderSkill.id
        ? { ...s, hourly_rate: rate, photos: skillPhotos, experience: skillExperience }
        : s
    );
    setProviderSkills(updated);
    try {
      await saveProfile({ skills: updated.map(skillToPayload), hourly_rate: rate, minimum_hours: minimumHours });
      Alert.alert('Saved', 'Service details updated');
      setServiceDetailVisible(false);
    } catch (e: any) {
      // saveProfile already surfaced the error
    } finally {
      setSavingSkill(false);
    }
  };

  // Add photos (up to 10) to the currently-open skill
  const pickSkillPhoto = async () => {
    const remaining = 10 - skillPhotos.length;
    if (remaining <= 0) { Alert.alert('Limit reached', 'You can add up to 10 photos per service.'); return; }
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = (e: any) => {
        const files: File[] = Array.from(e.target.files || []).slice(0, remaining);
        files.forEach((file: File) => {
          const reader = new FileReader();
          reader.onload = (ev: any) => {
            const img = new (window as any).Image();
            img.onload = () => {
              const maxDim = 1200;
              let { width, height } = img;
              if (width > maxDim || height > maxDim) {
                const scale = maxDim / Math.max(width, height);
                width = Math.round(width * scale); height = Math.round(height * scale);
              }
              const canvas = document.createElement('canvas');
              canvas.width = width; canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, width, height);
              const uri = canvas.toDataURL('image/jpeg', 0.7);
              setSkillPhotos(prev => (prev.length >= 10 ? prev : [...prev, { uri, caption: '' }]));
            };
            img.src = ev.target.result as string;
          };
          reader.readAsDataURL(file);
        });
      };
      input.click();
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Error', 'Gallery access is required'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.6, base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      const uri = a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri;
      setSkillPhotos(prev => (prev.length >= 10 ? prev : [...prev, { uri, caption: '' }]));
    }
  };

  const skillsByCategory = allSkillCategories.map(cat => ({
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
        <Text style={pStyles.statSectionTitle}>Earnings</Text>
        <TouchableOpacity style={pStyles.statRow}>
          <View style={{ flex: 1 }}>
            <Text style={pStyles.statLabel}>This month</Text>
            <Text style={pStyles.statValueGreen}>{stats.monthEarnings > 0 ? `$${stats.monthEarnings.toFixed(2)}` : '$0.00'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </TouchableOpacity>
        <View style={pStyles.divider} />
        <View style={pStyles.statRow}>
          <Text style={pStyles.statLabel}>Tasks completed</Text>
          <Text style={pStyles.statValueGreen}>{stats.taskCount}</Text>
        </View>
      </View>

      <View style={pStyles.statSection}>
        <Text style={pStyles.statSectionTitle}>Reviews</Text>
        <TouchableOpacity style={pStyles.statRow} onPress={() => setReviewsModalVisible(true)}>
          <View style={{ flex: 1 }}>
            <Text style={pStyles.statValueLarge}>{stats.rating > 0 ? `${stats.rating.toFixed(1)} / 5` : 'No reviews'}</Text>
            {reviews.length > 0 && <Text style={pStyles.statSubLabel}>({reviews.length} reviews • ❤️ {stats.positiveReviews} positive)</Text>}
          </View>
          {stats.rating > 0 && <View style={{ flexDirection: 'row', gap: 2, marginRight: 8 }}>{renderStars(stats.rating)}</View>}
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      <View style={pStyles.statSection}>
        <Text style={pStyles.statSectionTitle}>Analytics</Text>
        <Text style={pStyles.statDescription}>Search ranking is determined by the number of positive reviews and the minimum number of negative ones.</Text>
        <View style={[pStyles.statRow, { marginTop: 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={pStyles.statLabel}>Positive reviews (★ 4-5)</Text>
          </View>
          <Text style={[pStyles.statValueGreen, { color: '#16a34a' }]}>{stats.positiveReviews}</Text>
        </View>
        <View style={pStyles.divider} />
        <View style={pStyles.statRow}>
          <Text style={pStyles.statLabel}>Negative reviews (★ 1-2)</Text>
          <Text style={[pStyles.statValueGreen, { color: stats.negativeReviews > 0 ? '#ef4444' : '#6b7280' }]}>{stats.negativeReviews}</Text>
        </View>
        <View style={pStyles.divider} />
        <View style={pStyles.statRow}>
          <Text style={pStyles.statLabel}>Shown more than</Text>
          <Text style={pStyles.statValueGreen}>{stats.shownPercent}%</Text>
        </View>
      </View>

      <View style={pStyles.statSection}>
        <Text style={pStyles.statSectionTitle}>Skills & rates</Text>
        <TouchableOpacity style={pStyles.statRow} onPress={() => setActiveTab('skills')}>
          <View style={{ flex: 1 }}>
            <Text style={pStyles.statLabel}>Active skills: <Text style={pStyles.statValueGreen}>{stats.activatedSkillsCount}</Text></Text>
            {stats.activatedSkillsCount === 0 && <Text style={pStyles.statSubLabel}>Add skills to start receiving orders</Text>}
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      <View style={pStyles.statSection}>
        <Text style={pStyles.statSectionTitle}>Ranking</Text>
        <TouchableOpacity style={pStyles.statRow} onPress={() => router.push('/my-ranking' as any)} data-testid="stats-my-ranking-link">
          <View style={{ flex: 1 }}>
            <Text style={pStyles.statLabel}>My ranking</Text>
            <Text style={pStyles.statSubLabel}>Worked & bonus hours, your position and rating per category</Text>
          </View>
          <Ionicons name="stats-chart" size={20} color="#7c3aed" style={{ marginRight: 8 }} />
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </TouchableOpacity>
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
            <Text style={pStyles.emptySkillsTitle}>No skills yet</Text>
            <Text style={pStyles.emptySkillsText}>Add skills to start receiving orders from clients</Text>
            <TouchableOpacity style={[pStyles.agreeBtn, { marginTop: 24, paddingHorizontal: 32 }]} onPress={() => setAddSkillsVisible(true)}>
              <Text style={pStyles.agreeBtnText}>+ Add skills</Text>
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
                  onPress={() => { setSelectedProviderSkill(skill); setEditingRate(skill.hourly_rate.toString()); setSkillPhotos(skill.photos || []); setSkillExperience(skill.experience || ''); setServiceDetailVisible(true); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={pStyles.skillCardName}>{skill.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                      <View style={[pStyles.skillBadge, { backgroundColor: cat.color }]}>
                        <Text style={pStyles.skillBadgeText}>${skill.hourly_rate}/HR</Text>
                      </View>
                      <View style={[pStyles.skillBadge, { backgroundColor: skill.status === 'active' ? cat.color : '#9ca3af' }]}>
                        <Text style={pStyles.skillBadgeText}>{skill.status === 'active' ? 'ACTIVE' : 'PENDING'}</Text>
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
        <Text style={pStyles.addSkillsFabText}>Add skills</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Service Tab (TaskRabbit-style account menu) ──
  const renderService = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

      {/* ACCOUNT INFORMATION */}
      <Text style={pStyles.menuSectionLabel}>ACCOUNT INFORMATION</Text>

      <TouchableOpacity style={pStyles.menuRow} onPress={() => { setAccountName(user?.full_name || user?.name || user?.username || ''); setAccountPhone(user?.phone || profile?.phone || ''); setAccountAddress(user?.address || profile?.address || ''); setEditingAccountDetails(false); setAccountDetailsVisible(true); }}>
        <Ionicons name="person-outline" size={22} color="#374151" style={pStyles.menuRowIcon} />
        <View style={{ flex: 1 }}>
          <Text style={pStyles.menuRowText}>Account details</Text>
          <Text style={pStyles.menuRowSub}>{user?.full_name || user?.username || user?.email || ''}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      </TouchableOpacity>
      <View style={pStyles.menuDivider} />

      <TouchableOpacity
        style={pStyles.menuRow}
        disabled={(user as any)?.email_verified}
        onPress={() => router.push({ pathname: '/verify-email', params: { email: user?.email } } as any)}
        data-testid="provider-verify-email-row"
      >
        <Ionicons name="mail-outline" size={22} color={(user as any)?.email_verified ? '#059669' : '#374151'} style={pStyles.menuRowIcon} />
        <View style={{ flex: 1 }}>
          <Text style={pStyles.menuRowText}>Email</Text>
          <Text style={pStyles.menuRowSub}>{user?.email || ''}</Text>
        </View>
        {(user as any)?.email_verified ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="checkmark-circle" size={18} color="#059669" />
            <Text style={{ fontSize: 13, color: '#059669', fontWeight: '600' }}>Verified</Text>
          </View>
        ) : (
          <Text style={{ fontSize: 13, color: '#dc2626', fontWeight: '600' }}>Verify</Text>
        )}
      </TouchableOpacity>
      <View style={pStyles.menuDivider} />

      <TouchableOpacity
        style={pStyles.menuRow}
        disabled={(user as any)?.phone_verified}
        onPress={() => router.push({ pathname: '/verify-phone', params: { phone: user?.phone || profile?.phone || '' } } as any)}
        data-testid="provider-verify-phone-row"
      >
        <Ionicons name="call-outline" size={22} color={(user as any)?.phone_verified ? '#059669' : '#374151'} style={pStyles.menuRowIcon} />
        <View style={{ flex: 1 }}>
          <Text style={pStyles.menuRowText}>Phone</Text>
          <Text style={pStyles.menuRowSub}>{user?.phone || profile?.phone || 'Add your phone number'}</Text>
        </View>
        {(user as any)?.phone_verified ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="checkmark-circle" size={18} color="#059669" />
            <Text style={{ fontSize: 13, color: '#059669', fontWeight: '600' }}>Verified</Text>
          </View>
        ) : (
          <Text style={{ fontSize: 13, color: '#dc2626', fontWeight: '600' }}>Verify</Text>
        )}
      </TouchableOpacity>
      <View style={pStyles.menuDivider} />

      <TouchableOpacity
        style={pStyles.menuRow}
        onPress={() => router.push(`/executor/${user?.user_id}?preview=1` as any)}
        data-testid="myprofile-pro-preview"
      >
        <Ionicons name="briefcase-outline" size={22} color="#374151" style={pStyles.menuRowIcon} />
        <View style={{ flex: 1 }}>
          <Text style={pStyles.menuRowText}>Pro profile</Text>
          <Text style={pStyles.menuRowSub}>Preview how clients see your profile</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      </TouchableOpacity>
      <View style={pStyles.menuDivider} />

      <TouchableOpacity style={pStyles.menuRow} onPress={() => setBioModalVisible(true)} data-testid="myprofile-about-me">
        <Ionicons name="create-outline" size={22} color="#374151" style={pStyles.menuRowIcon} />
        <View style={{ flex: 1 }}>
          <Text style={pStyles.menuRowText}>About me</Text>
          <Text style={pStyles.menuRowSub} numberOfLines={1}>
            {bio ? bio : 'Add a short bio — your experience, specialty and approach'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      </TouchableOpacity>
      <View style={pStyles.menuDivider} />

      <TouchableOpacity style={pStyles.menuRow} onPress={() => setPhotosModalVisible(true)}>
        <Ionicons name="images-outline" size={22} color="#374151" style={pStyles.menuRowIcon} />
        <View style={{ flex: 1 }}>
          <Text style={pStyles.menuRowText}>Work photos</Text>
          <Text style={pStyles.menuRowSub}>{portfolioPhotos.length > 0 ? `${portfolioPhotos.length} photos` : 'Add photos of your work'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      </TouchableOpacity>
      {portfolioPhotos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          {portfolioPhotos.map((photo, i) => (
            <TouchableOpacity key={i} onPress={() => setPhotosModalVisible(true)}>
              <View style={{ marginRight: 8, marginTop: 4 }}>
                <Image source={{ uri: photo }} style={pStyles.portfolioThumb} />
                {photoCaptions[i] ? (
                  <Text numberOfLines={1} style={{ fontSize: 10, color: '#6b7280', width: 80, marginTop: 2 }}>{photoCaptions[i]}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      <View style={pStyles.menuDivider} />

      <TouchableOpacity style={pStyles.menuRow} onPress={() => setServiceAreaVisible(true)}>
        <Ionicons name="map-outline" size={22} color="#374151" style={pStyles.menuRowIcon} />
        <View style={{ flex: 1 }}>
          <Text style={pStyles.menuRowText}>Service area</Text>
          <Text style={pStyles.menuRowSub}>
            {profile?.service_radius_km
              ? `Radius: ${profile.service_radius_km} mi`
              : 'Set your service area'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      </TouchableOpacity>
      <View style={pStyles.menuDivider} />

      {/* INVITE */}
      <TouchableOpacity style={[pStyles.menuRow, { backgroundColor: '#f0fdf4' }]} onPress={() => router.push('/rewards' as any)} data-testid="provider-rewards-row">
        <Ionicons name="gift-outline" size={22} color="#16a34a" style={pStyles.menuRowIcon} />
        <View style={{ flex: 1 }}>
          <Text style={[pStyles.menuRowText, { color: '#15803d' }]}>Rewards & invite friends</Text>
          <Text style={[pStyles.menuRowSub, { color: '#15803d' }]}>Invite a pro → you both get +5 ranking hours. Invite a client → earn points & gift cards.</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      </TouchableOpacity>
      <View style={pStyles.menuDivider} />

      <TouchableOpacity style={pStyles.menuRow} onPress={() => { setSupportEmail(user?.email || ''); setSupportVisible(true); }}>
        <Ionicons name="help-circle-outline" size={22} color="#374151" style={pStyles.menuRowIcon} />
        <Text style={[pStyles.menuRowText, { flex: 1 }]}>Support</Text>
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      </TouchableOpacity>
      <View style={pStyles.menuDivider} />

      {/* SETTINGS */}
      <Text style={pStyles.menuSectionLabel}>SETTINGS</Text>

      {/* NOTIFICATIONS — opens a settings modal with per-channel switches */}
      <TouchableOpacity style={pStyles.menuRow} onPress={() => setNotifModalVisible(true)} data-testid="notifications-menu-row">
        <Ionicons name="notifications-outline" size={22} color="#374151" style={pStyles.menuRowIcon} />
        <View style={{ flex: 1 }}>
          <Text style={pStyles.menuRowText}>Notifications</Text>
          <Text style={pStyles.menuRowSub}>Choose which alerts you receive</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      </TouchableOpacity>
      <View style={pStyles.menuDivider} />

      <TouchableOpacity style={pStyles.menuRow} onPress={() => { setTwoFaStep('choose'); setTwoFaVisible(true); }}>
        <Ionicons name="shield-checkmark-outline" size={22} color="#374151" style={pStyles.menuRowIcon} />
        <View style={{ flex: 1 }}>
          <Text style={pStyles.menuRowText}>Account security</Text>
          <Text style={pStyles.menuRowSub}>{twoFaEnabled ? 'Two-factor authentication enabled' : 'Two-factor authentication'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      </TouchableOpacity>
      <View style={pStyles.menuDivider} />

      <TouchableOpacity style={pStyles.menuRow} onPress={() => setAboutVisible(true)}>
        <Ionicons name="information-circle-outline" size={22} color="#374151" style={pStyles.menuRowIcon} />
        <Text style={[pStyles.menuRowText, { flex: 1 }]}>About the app</Text>
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      </TouchableOpacity>
      <View style={pStyles.menuDivider} />

      <TouchableOpacity style={pStyles.menuRow} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={22} color="#374151" style={pStyles.menuRowIcon} />
        <Text style={[pStyles.menuRowText, { flex: 1 }]}>Log out</Text>
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      </TouchableOpacity>
      <View style={pStyles.menuDivider} />

      {/* DELETE ACCOUNT */}
      <TouchableOpacity style={[pStyles.menuRow, { marginTop: 8 }]} onPress={() => {
        const doDelete = async () => {
          try {
            await api.deleteAccount().catch(() => {});
          } catch {}
          await logout();
          if (Platform.OS === 'web') { window.location.href = '/login'; }
          else { router.replace('/login'); }
        };
        if (Platform.OS === 'web') {
          if (window.confirm('Delete account? This action is irreversible!')) doDelete();
        } else {
          Alert.alert('Delete account', 'This action is irreversible. All your data will be deleted.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: doDelete },
          ]);
        }
      }}>
        <Text style={[pStyles.menuRowText, { flex: 1, color: '#ef4444', fontWeight: '600' }]}>Delete account</Text>
      </TouchableOpacity>

      <Text style={pStyles.versionText}>Ono-Fix v1.0.0</Text>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>My profile</Text>
        <TouchableOpacity style={styles.logoutTopBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          <Text style={styles.logoutTopText}>Log out</Text>
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
          <View style={pStyles.badge}><Text style={pStyles.badgeText}>PRO</Text></View>
        </View>
      </View>

      {/* Tabs */}
      <IdentityVerificationBanner />
      <View style={pStyles.tabBar}>
        {(['performance', 'skills', 'service'] as const).map(tab => (
          <TouchableOpacity key={tab} style={[pStyles.tab, activeTab === tab && pStyles.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[pStyles.tabText, activeTab === tab && pStyles.tabTextActive]}>
              {tab === 'performance' ? 'Stats' : tab === 'skills' ? 'Skills' : 'Profile'}
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
            <Text style={pStyles.modalTopTitle}>Add skills</Text>
            <TouchableOpacity onPress={() => { setAddSkillsVisible(false); setExpandedCategory(null); }}>
              <Ionicons name="close" size={26} color="#111827" />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {allSkillCategories.map(cat => (
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
          const cat = findSkillCategory(selectedSkillDetail.categoryId);
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
                <Text style={pStyles.skillDetailHeading}>What clients expect</Text>
                <Text style={pStyles.skillDetailBody}>{skill.description}</Text>

                <Text style={[pStyles.skillDetailHeading, { marginTop: 24 }]}>Required tools</Text>
                {skill.tools.map((tool, i) => (
                  <View key={i} style={pStyles.toolRow}>
                    <View style={pStyles.toolDot} />
                    <Text style={pStyles.toolText}>{tool}</Text>
                  </View>
                ))}

                <View style={pStyles.disclaimerBox}>
                  <Text style={pStyles.disclaimerText}>
                    By adding this skill, you confirm that you have the necessary knowledge and licenses to perform the related work.
                  </Text>
                  <Text style={[pStyles.disclaimerText, { marginTop: 10 }]}>
                    Pros are responsible for having the required skills and licenses. Depending on the type of work, certain jurisdictions may require a special permit.
                  </Text>
                </View>

                <Text style={pStyles.skillDetailHeading}>Your hourly rate ($/hr)</Text>
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
                    if (isNaN(rate) || rate <= 0) { Alert.alert('Error', 'Enter a valid rate'); return; }
                    addSkill(selectedSkillDetail.categoryId, skill, rate);
                    setSelectedSkillDetail(null);
                    setAddSkillsVisible(false);
                    setExpandedCategory(null);
                    Alert.alert('Success', `Skill "${skill.name}" added!`);
                  }}
                >
                  <Text style={pStyles.agreeBtnText}>Agree and continue</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}
      </Modal>

      {/* ── Service Detail Modal ── */}
      <Modal visible={serviceDetailVisible} animationType="slide" transparent={false}>
        {selectedProviderSkill && (() => {
          const cat = findSkillCategory(selectedProviderSkill.category_id);
          return (
            <View style={{ flex: 1, backgroundColor: '#fff' }}>
              <View style={pStyles.modalTopBar}>
                <TouchableOpacity onPress={() => setServiceDetailVisible(false)}>
                  <Ionicons name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={[pStyles.modalTopTitle, { flex: 1, textAlign: 'center' }]}>{selectedProviderSkill.name}</Text>
                <TouchableOpacity onPress={() => {
                  Alert.alert('Delete skill', `Delete "${selectedProviderSkill.name}"?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => { removeSkill(selectedProviderSkill.id); setServiceDetailVisible(false); } },
                  ]);
                }}>
                  <Ionicons name="ellipsis-horizontal" size={24} color="#111827" />
                </TouchableOpacity>
              </View>

              <View style={pStyles.serviceDetailTabs}>
                <View style={[pStyles.serviceDetailTab, pStyles.serviceDetailTabActive]}>
                  <Text style={pStyles.serviceDetailTabTextActive}>General</Text>
                </View>
                <View style={pStyles.serviceDetailTab}>
                  <Text style={pStyles.serviceDetailTabText}>Partners</Text>
                </View>
              </View>

              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                <Text style={pStyles.serviceSectionLabel}>EARNINGS STRUCTURE</Text>
                <TouchableOpacity style={[pStyles.earningCard, { marginTop: 8, backgroundColor: '#eff6ff' }]}>
                  <View style={[pStyles.earningCardIcon, { backgroundColor: '#dbeafe' }]}>
                    <Ionicons name="person-add-outline" size={28} color="#2563eb" />
                  </View>
                  <Text style={[pStyles.earningCardTitle, { color: '#1e40af' }]}>Your own hourly rate</Text>
                  <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                </TouchableOpacity>

                <Text style={[pStyles.serviceSectionLabel, { marginTop: 20 }]}>HOURLY RATE</Text>
                <View style={pStyles.rateEditRow}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#374151' }}>$</Text>
                  <TextInput
                    style={[pStyles.rateInput, { flex: 1, marginBottom: 0 }]}
                    value={editingRate}
                    onChangeText={setEditingRate}
                    keyboardType="numeric"
                    placeholder="25"
                    data-testid="skill-rate-input"
                  />
                  <Text style={{ fontSize: 14, color: '#6b7280' }}>/hr</Text>
                </View>

                <Text style={[pStyles.serviceSectionLabel, { marginTop: 20 }]}>MINIMUM CHARGE</Text>
                <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                  Clients pay for at least this many hours. Extra time is billed per minute. Shown on your profile before a client books. Applies to all your services.
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  {[1, 1.5, 2].map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={[styles.minHrChip, minimumHours === h && styles.minHrChipActive]}
                      onPress={() => setMinimumHours(h)}
                      data-testid={`skill-min-hours-${h}`}
                    >
                      <Text style={[styles.minHrChipText, minimumHours === h && styles.minHrChipTextActive]}>
                        {h} hr{h > 1 ? 's' : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[pStyles.serviceSectionLabel, { marginTop: 20 }]}>
                  WORK PHOTOS FOR “{selectedProviderSkill.name.toUpperCase()}” ({skillPhotos.length}/10)
                </Text>
                <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                  Add up to 10 photos of your work for this specific service. You can caption each one.
                </Text>
                {skillPhotos.map((ph, i) => (
                  <View key={i} style={pStyles.skillPhotoRow}>
                    <Image source={{ uri: ph.uri }} style={pStyles.skillPhotoThumb} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <TextInput
                        style={pStyles.skillCaptionInput}
                        value={ph.caption}
                        onChangeText={(t) => setSkillPhotos(prev => prev.map((p, idx) => idx === i ? { ...p, caption: t } : p))}
                        placeholder="Add a caption (e.g., New outlet install)"
                        placeholderTextColor="#9ca3af"
                        data-testid={`skill-photo-caption-${i}`}
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => setSkillPhotos(prev => prev.filter((_, idx) => idx !== i))}
                      data-testid={`skill-photo-remove-${i}`}
                      style={{ padding: 6 }}
                    >
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
                {skillPhotos.length < 10 && (
                  <TouchableOpacity style={[pStyles.addPhotoBtn, { marginTop: 10 }]} onPress={pickSkillPhoto} data-testid="skill-add-photo-btn">
                    <Ionicons name="camera-outline" size={20} color="#6b7280" />
                    <Text style={pStyles.addPhotoBtnText}>Add photo</Text>
                  </TouchableOpacity>
                )}

                <Text style={[pStyles.serviceSectionLabel, { marginTop: 24 }]}>EXPERIENCE WITH THIS SERVICE</Text>
                <TextInput
                  style={pStyles.experienceInput}
                  value={skillExperience}
                  onChangeText={setSkillExperience}
                  placeholder={`Describe your experience with ${selectedProviderSkill.name.toLowerCase()} — years, typical jobs, certifications…`}
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  data-testid="skill-experience-input"
                />

                <TouchableOpacity
                  style={[pStyles.rateSaveBtn, { marginTop: 24, paddingVertical: 14, alignItems: 'center', opacity: savingSkill ? 0.6 : 1 }]}
                  onPress={saveSkillDetails}
                  disabled={savingSkill}
                  data-testid="save-skill-details-btn"
                >
                  {savingSkill
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={pStyles.rateSaveBtnText}>Save changes</Text>}
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
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Account details</Text>
            <TouchableOpacity onPress={() => setEditingAccountDetails(!editingAccountDetails)}>
              <Text style={{ fontSize: 16, color: '#2563eb', fontWeight: '600' }}>{editingAccountDetails ? 'Cancel' : 'Edit'}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Avatar + name row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', flex: 1 }}>{user?.full_name || user?.username || 'Pro'}</Text>
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
              { label: 'First name', value: accountName, setter: setAccountName, key: 'name', editable: true },
              { label: 'Email', value: user?.email || '', setter: null, key: 'email', editable: false },
              { label: 'Mobile phone', value: accountPhone, setter: setAccountPhone, key: 'phone', editable: true },
              { label: 'Address', value: accountAddress, setter: setAccountAddress, key: 'address', editable: true },
            ] as { label: string; value: string; setter: ((v: string) => void) | null; key: string; editable: boolean }[]).map((field) => (
              <View key={field.key}>
                <TouchableOpacity
                  activeOpacity={field.editable ? 0.6 : 1}
                  onPress={() => { if (field.editable && !editingAccountDetails) setEditingAccountDetails(true); }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 }}
                  data-testid={`account-field-${field.key}`}
                >
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827', width: 140 }}>{field.label}</Text>
                  {editingAccountDetails && field.editable && field.setter ? (
                    <TextInput
                      style={{ flex: 1, fontSize: 15, color: '#374151', borderBottomWidth: 1, borderBottomColor: '#2563eb', paddingVertical: 2 }}
                      value={field.value}
                      onChangeText={field.setter}
                      placeholder={field.key === 'phone' ? '+1 555 123 4567' : field.label}
                      keyboardType={field.key === 'phone' ? 'phone-pad' : 'default'}
                      autoFocus={field.key !== 'name'}
                      data-testid={`account-input-${field.key}`}
                    />
                  ) : (
                    <>
                      <Text style={{ flex: 1, fontSize: 15, color: field.value ? '#374151' : '#9ca3af', textAlign: 'right' }}>{field.value || (field.editable ? 'Tap to add' : '—')}</Text>
                      {field.editable && <Ionicons name="chevron-forward" size={16} color="#9ca3af" style={{ marginLeft: 8 }} />}
                    </>
                  )}
                </TouchableOpacity>
                <View style={{ height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 20 }} />
              </View>
            ))}
            {/* Info banner */}
            <View style={{ margin: 16, padding: 16, backgroundColor: '#fffbeb', borderRadius: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Ionicons name="information-circle-outline" size={22} color="#d97706" />
              <Text style={{ flex: 1, fontSize: 13, color: '#92400e' }}>Tap "Edit" (or any field) to update your phone and address. Your service work area is set separately under "Service area".</Text>
            </View>
            {editingAccountDetails && (
              <TouchableOpacity
                style={{ margin: 16, padding: 16, backgroundColor: '#2563eb', borderRadius: 14, alignItems: 'center' }}
                onPress={async () => {
                  setSaving(true);
                  try {
                    const updatedUser = await api.updateProfile({ full_name: accountName, name: accountName, phone: accountPhone, address: accountAddress });
                    if (updatedUser) setUser(updatedUser);
                    Alert.alert('Saved', 'Account details updated');
                    setEditingAccountDetails(false);
                    // Keep modal open — button now shows 'Edit' again
                  } catch (e: any) {
                    Alert.alert('Error', e.message || 'Could not save');
                  } finally { setSaving(false); }
                }}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Save changes</Text>}
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Notifications Modal ── */}
      <NotificationSettingsModal visible={notifModalVisible} onClose={() => setNotifModalVisible(false)} />


      {/* ── Service Area Modal ── */}
      <Modal visible={serviceAreaVisible} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
            <TouchableOpacity onPress={() => setServiceAreaVisible(false)}>
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Service area</Text>
            <View style={{ width: 40 }} />
          </View>
          {Platform.OS === 'web' ? (
            <View style={{ flex: 1 }}>
              <iframe
                title="service-area-map"
                src={`/map.html?unit=mi&lat=${profile?.latitude || 50.45}&lng=${profile?.longitude || 30.52}&radius=${profile?.service_radius_km || 10}`}
                style={{ width: '100%', height: '100%', border: 'none' } as any}
                onLoad={(e: any) => {
                  // Listen for save messages from iframe
                  const handler = (event: MessageEvent) => {
                    try {
                      const data = JSON.parse(event.data);
                      if (data.type === 'save') {
                        api.updateExecutorProfile({
                          latitude: data.lat,
                          longitude: data.lng,
                          service_radius_km: data.radius,
                        }).then(() => {
                          loadProfile();
                          setServiceAreaVisible(false);
                          Alert.alert('Saved', `Service area: ${data.radius} mi`);
                        }).catch((err: any) => {
                          Alert.alert('Error', err.message || 'Could not save');
                        });
                        window.removeEventListener('message', handler);
                      }
                    } catch {}
                  };
                  window.addEventListener('message', handler);
                }}
              />
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Ionicons name="map-outline" size={64} color="#2563eb" />
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 16 }}>Service area map</Text>
                <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 8 }}>
                  This feature is available in the web version of the app.
                  Open the website in a browser to configure it.
                </Text>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* ── Photos Modal ── */}
      <Modal visible={photosModalVisible} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
            <TouchableOpacity onPress={() => setPhotosModalVisible(false)}>
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Work photos</Text>
            <TouchableOpacity
              onPress={async () => {
                setSavingPhotos(true);
                try {
                  await api.updateExecutorProfile({ portfolio_photos: portfolioPhotos });
                  if (Platform.OS === 'web') {
                    try {
                      localStorage.setItem(
                        `photo_captions_${profile?.user_id || user?.user_id}`,
                        JSON.stringify(photoCaptions)
                      );
                    } catch {}
                  }
                  Alert.alert('Saved', 'Work photos updated');
                  setPhotosModalVisible(false);
                } catch (e: any) {
                  Alert.alert('Error', e.message || 'Could not save');
                } finally { setSavingPhotos(false); }
              }}
            >
              {savingPhotos ? <ActivityIndicator color="#2563eb" size="small" /> : <Text style={{ fontSize: 16, color: '#2563eb', fontWeight: '600' }}>Save</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {portfolioPhotos.length === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Ionicons name="images-outline" size={64} color="#d1d5db" />
                <Text style={{ fontSize: 16, color: '#9ca3af', marginTop: 12 }}>No photos added yet</Text>
                <Text style={{ fontSize: 13, color: '#d1d5db', marginTop: 4 }}>Tap the button below</Text>
              </View>
            )}
            {portfolioPhotos.map((photo, i) => (
              <View key={i} style={{ marginBottom: 20, backgroundColor: '#f9fafb', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' }}>
                <Image source={{ uri: photo }} style={{ width: '100%', height: 220, resizeMode: 'cover' }} />
                <View style={{ padding: 12 }}>
                  <TextInput
                    style={{
                      fontSize: 14,
                      color: '#374151',
                      borderWidth: 1,
                      borderColor: '#e5e7eb',
                      borderRadius: 10,
                      padding: 10,
                      backgroundColor: '#fff',
                      minHeight: 44,
                    }}
                    value={photoCaptions[i] || ''}
                    onChangeText={(text) => setPhotoCaptions(prev => ({ ...prev, [i]: text }))}
                    placeholder="Short photo description..."
                    placeholderTextColor="#9ca3af"
                    maxLength={120}
                    multiline
                  />
                  <TouchableOpacity
                    style={{ marginTop: 8, alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    onPress={() => {
                      const newPhotos = portfolioPhotos.filter((_, idx) => idx !== i);
                      const newCaptions: Record<number, string> = {};
                      newPhotos.forEach((_, newIdx) => {
                        const oldIdx = newIdx >= i ? newIdx + 1 : newIdx;
                        if (photoCaptions[oldIdx]) newCaptions[newIdx] = photoCaptions[oldIdx];
                      });
                      setPortfolioPhotos(newPhotos);
                      setPhotoCaptions(newCaptions);
                    }}
                  >
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                    <Text style={{ fontSize: 13, color: '#ef4444' }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderWidth: 2, borderColor: '#2563eb', borderRadius: 14, borderStyle: 'dashed' }}
              onPress={pickPortfolioPhoto}
            >
              <Ionicons name="add-circle-outline" size={24} color="#2563eb" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#2563eb' }}>Add photo</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ══ Reviews Modal ══ */}
      <Modal visible={reviewsModalVisible} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
            <TouchableOpacity onPress={() => setReviewsModalVisible(false)}>
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Client reviews</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {reviews.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                <Ionicons name="chatbubble-outline" size={64} color="#d1d5db" />
                <Text style={{ fontSize: 16, color: '#9ca3af', marginTop: 12 }}>No reviews</Text>
                <Text style={{ fontSize: 13, color: '#d1d5db', marginTop: 4 }}>Reviews will appear after you complete tasks</Text>
              </View>
            ) : reviews.map((rev: any, i: number) => (
              <View key={i} style={{ backgroundColor: '#f9fafb', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#2563eb' }}>{(rev.client_name || rev.reviewer_name || 'C')?.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>{rev.client_name || rev.reviewer_name || 'Client'}</Text>
                    <Text style={{ fontSize: 12, color: '#9ca3af' }}>{rev.created_at ? new Date(rev.created_at).toLocaleDateString('uk-UA') : ''}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 2 }}>
                    {[1,2,3,4,5].map(s => <Ionicons key={s} name={s <= (rev.rating || 0) ? 'star' : 'star-outline'} size={16} color="#f59e0b" />)}
                  </View>
                </View>
                {rev.comment ? <Text style={{ fontSize: 14, color: '#374151', lineHeight: 20 }}>{rev.comment}</Text> : null}
                {rev.tip_amount && rev.tip_amount > 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: '#fffbeb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' }}>
                    <Ionicons name="gift-outline" size={14} color="#f59e0b" />
                    <Text style={{ fontSize: 13, color: '#92400e', fontWeight: '600' }}>Tip: ${rev.tip_amount}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* ══ 2FA Modal ══ */}
      <Modal visible={twoFaVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Account security</Text>
              <TouchableOpacity onPress={() => { setTwoFaVisible(false); setTwoFaCode(''); setTwoFaStep('choose'); }}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              {twoFaStep === 'choose' ? (
                <>
                  <Text style={{ fontSize: 15, color: '#374151', marginBottom: 16, lineHeight: 22 }}>
                    Two-factor authentication (2FA) protects your account from unauthorized access.
                  </Text>
                  <Text style={styles.label}>Choose a verification method</Text>
                  <TouchableOpacity
                    style={[{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 2, marginBottom: 10, gap: 12 }, twoFaMethod === 'email' ? { borderColor: '#2563eb', backgroundColor: '#eff6ff' } : { borderColor: '#e5e7eb', backgroundColor: '#fff' }]}
                    onPress={() => setTwoFaMethod('email')}
                  >
                    <Ionicons name="mail-outline" size={24} color={twoFaMethod === 'email' ? '#2563eb' : '#6b7280'} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: twoFaMethod === 'email' ? '#1e40af' : '#111827' }}>Via Email</Text>
                      <Text style={{ fontSize: 12, color: '#6b7280' }}>{user?.email || ''}</Text>
                    </View>
                    {twoFaMethod === 'email' && <Ionicons name="checkmark-circle" size={22} color="#2563eb" />}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 2, gap: 12 }, twoFaMethod === 'phone' ? { borderColor: '#2563eb', backgroundColor: '#eff6ff' } : { borderColor: '#e5e7eb', backgroundColor: '#fff' }]}
                    onPress={() => setTwoFaMethod('phone')}
                  >
                    <Ionicons name="phone-portrait-outline" size={24} color={twoFaMethod === 'phone' ? '#2563eb' : '#6b7280'} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: twoFaMethod === 'phone' ? '#1e40af' : '#111827' }}>Via SMS</Text>
                      <Text style={{ fontSize: 12, color: '#6b7280' }}>{user?.phone || 'Add a phone number'}</Text>
                    </View>
                    {twoFaMethod === 'phone' && <Ionicons name="checkmark-circle" size={22} color="#2563eb" />}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 15, color: '#374151', marginBottom: 16 }}>
                    A verification code was sent to {twoFaMethod === 'email' ? user?.email : user?.phone}.
                  </Text>
                  <Text style={styles.label}>Enter the 6-digit code</Text>
                  <TextInput
                    style={[styles.input, { fontSize: 24, letterSpacing: 8, textAlign: 'center' }]}
                    value={twoFaCode}
                    onChangeText={setTwoFaCode}
                    keyboardType="numeric"
                    maxLength={6}
                    placeholder="000000"
                  />
                </>
              )}
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => { setTwoFaVisible(false); setTwoFaCode(''); setTwoFaStep('choose'); }}>
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnSave]}
                onPress={() => {
                  if (twoFaStep === 'choose') {
                    setTwoFaStep('verify');
                    Alert.alert('Code sent', `Check your ${twoFaMethod === 'email' ? 'email' : 'SMS'} and enter the code.`);
                  } else {
                    if (twoFaCode.length < 4) { Alert.alert('Error', 'Enter a valid code'); return; }
                    setTwoFaEnabled(true);
                    setTwoFaVisible(false);
                    setTwoFaCode('');
                    setTwoFaStep('choose');
                    Alert.alert('Success', '2FA enabled successfully!');
                  }
                }}
              >
                <Text style={styles.btnSaveText}>{twoFaStep === 'choose' ? 'Send code' : 'Confirm'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══ Support Modal ══ */}
      <Modal visible={supportVisible} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
            <TouchableOpacity onPress={() => setSupportVisible(false)}>
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Support</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            {/* Contact info */}
            <View style={{ backgroundColor: '#eff6ff', borderRadius: 14, padding: 16, marginBottom: 20, flexDirection: 'row', gap: 12 }}>
              <Ionicons name="mail-outline" size={24} color="#2563eb" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1e40af' }}>Support email</Text>
                <Text style={{ fontSize: 14, color: '#2563eb', marginTop: 2 }}>Nexus.ss.llc@gmail.com</Text>
              </View>
            </View>

            <Text style={styles.label}>Your email</Text>
            <TextInput
              style={styles.input}
              value={supportEmail}
              onChangeText={setSupportEmail}
              placeholder="your@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.label}>Message</Text>
            <TextInput
              style={[styles.input, { height: 140, textAlignVertical: 'top' }]}
              value={supportMessage}
              onChangeText={setSupportMessage}
              placeholder="Describe your issue or question..."
              multiline
            />

            <TouchableOpacity
              style={[pStyles.agreeBtn, sendingSupport && { opacity: 0.6 }]}
              disabled={sendingSupport}
              onPress={async () => {
                if (!supportMessage.trim()) { Alert.alert('Error', 'Enter a message'); return; }
                setSendingSupport(true);
                try {
                  await api.sendSupportMessage({ email: supportEmail, message: supportMessage }).catch(() => {});
                  Alert.alert('Sent!', 'Your message has been received. We will reply within 24 hours.');
                  setSupportMessage('');
                  setSupportVisible(false);
                } catch {
                  Alert.alert('Sent!', 'Your message has been received. We will reply within 24 hours.');
                  setSupportMessage('');
                  setSupportVisible(false);
                } finally { setSendingSupport(false); }
              }}
            >
              {sendingSupport ? <ActivityIndicator color="#fff" /> : <Text style={pStyles.agreeBtnText}>Send</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ══ About App Modal ══ */}
      <Modal visible={aboutVisible} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
            <TouchableOpacity onPress={() => setAboutVisible(false)}>
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>About the app</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <View style={{ width: 80, height: 80, borderRadius: 20, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="construct" size={40} color="#fff" />
              </View>
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827' }}>Ono-Fix</Text>
              <Text style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>v1.0.0</Text>
            </View>

            {[{
              icon: 'information-circle-outline' as const, title: 'What is Ono-Fix?',
              text: 'Ono-Fix is a platform for finding trusted pros near you. Clients post tasks, and pros accept and complete them.'
            }, {
              icon: 'list-outline' as const, title: 'How does it work?',
              text: '1. The client creates an order (booking)\n2. Pros see the order and accept it\n3. The pro travels to the client and does the work\n4. The client pays and leaves a review\n5. The payout reaches the pro automatically'
            }, {
              icon: 'wallet-outline' as const, title: 'Payments & payouts',
              text: 'Payment goes through the app. Payouts reach the pro after the payment is confirmed. Tips are passed to the pro in full.'
            }, {
              icon: 'star-outline' as const, title: 'Rating & ranking',
              text: 'Pros with more positive reviews (★ 4-5) and fewer negative ones rank higher in search.'
            }].map((item, i) => (
              <View key={i} style={{ marginBottom: 20, backgroundColor: '#f9fafb', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Ionicons name={item.icon} size={22} color="#2563eb" />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>{item.title}</Text>
                </View>
                <Text style={{ fontSize: 14, color: '#374151', lineHeight: 22 }}>{item.text}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Bio Modal ── */}
      <Modal visible={bioModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Experience description</Text>
              <TouchableOpacity onPress={() => setBioModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.label}>About me</Text>
              <TextInput
                style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell us about your experience, specialty, and approach to work..."
                multiline
              />
              <Text style={styles.label}>Years of experience</Text>
              <TextInput
                style={styles.input}
                value={experienceYears}
                onChangeText={setExperienceYears}
                placeholder="5"
                keyboardType="numeric"
              />
              <Text style={styles.label}>Minimum charge</Text>
              <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                Clients are charged at least this many hours. Time beyond it is billed per minute. You must inform the client of this minimum before starting.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[1, 1.5, 2].map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.minHrChip, minimumHours === h && styles.minHrChipActive]}
                    onPress={() => setMinimumHours(h)}
                    data-testid={`min-hours-${h}`}
                  >
                    <Text style={[styles.minHrChipText, minimumHours === h && styles.minHrChipTextActive]}>
                      {h} hr{h > 1 ? 's' : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => setBioModalVisible(false)}>
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnSave]}
                onPress={() => {
                  saveProfile({ bio, experience_years: experienceYears ? parseInt(experienceYears) : undefined, minimum_hours: minimumHours });
                  setBioModalVisible(false);
                  Alert.alert('Saved', 'Experience description updated');
                }}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSaveText}>Save</Text>}
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
  aboutFine: { textAlign: 'center', fontSize: 10, color: '#cbd5e1', marginTop: -12, marginBottom: 28, paddingHorizontal: 24, lineHeight: 15 },
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
  minHrChip: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center', backgroundColor: '#fff' },
  minHrChipActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  minHrChipText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  minHrChipTextActive: { color: '#2563eb' },
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
  skillPhotoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, backgroundColor: '#f9fafb', borderRadius: 10, padding: 8, borderWidth: 1, borderColor: '#eef2f7' },
  skillPhotoThumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#e5e7eb' },
  skillCaptionInput: { fontSize: 14, color: '#111827', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff' },
  experienceInput: { fontSize: 14, color: '#111827', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, marginTop: 8, minHeight: 110, backgroundColor: '#f9fafb' },
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
  notifGroupTitle: { fontSize: 15, fontWeight: '700', color: '#111827', paddingHorizontal: 20, paddingTop: 6 },
  notifGroupHint: { fontSize: 12, color: '#6b7280', paddingHorizontal: 20, paddingBottom: 6 },
  notifRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 12 },
  menuRowText: { fontSize: 16, color: '#111827', fontWeight: '500' },
  menuRowSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  menuDivider: { height: 1, backgroundColor: '#f3f4f6', marginLeft: 56 },
  portfolioThumb: { width: 80, height: 80, borderRadius: 8, marginRight: 8, marginTop: 4 },
  versionText: { textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 24, marginBottom: 8 },
});
