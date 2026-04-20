import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../utils/api';

export default function Profile() {
  const router = useRouter();
  const { user, logout, setUser } = useAuthStore();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Client specific state
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [savedAddresses, setSavedAddresses] = useState([]);
  // Provider specific state
  const [providerStats, setProviderStats] = useState<any>(null);

  useEffect(() => {
    if (user?.role === 'client') {
      loadClientData();
    } else if (user?.role === 'provider') {
      loadProviderStats();
    }
  }, [user]);

  const loadClientData = async () => {
    try {
      const [pmRes, addrRes] = await Promise.all([
        api.getPaymentMethods().catch(() => ({ data: [] })),
        api.getSavedAddresses().catch(() => ({ data: [] }))
      ]);
      setPaymentMethods(pmRes.data || []);
      setSavedAddresses(addrRes.data || []);
    } catch (error) {
      console.error('Error loading client data:', error);
    }
  };

  const loadProviderStats = async () => {
    try {
      const stats = await api.getMyProviderStats();
      setProviderStats(stats);
    } catch (error) {
      console.error('Error loading provider stats:', error);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Вихід', 'Ви впевнені, що хочете вийти?', [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Вийти',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.logout();
            await logout();
            router.replace('/login');
          } catch (error: any) {
            Alert.alert('Помилка', error.message || 'Не вдалося вийти');
          }
        },
      },
    ]);
  };

  const handlePhotoUpload = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Помилка', 'Потрібен дозвіл на доступ до галереї');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];

      // Validate file size (base64 string length * 0.75 ≈ file size in bytes)
      if (asset.base64 && asset.base64.length * 0.75 > 5 * 1024 * 1024) {
        Alert.alert('Помилка', 'Фото занадто велике. Максимум 5 МБ.');
        return;
      }

      setUploading(true);

      const base64Image = asset.base64
        ? `data:image/jpeg;base64,${asset.base64}`
        : asset.uri;

      await api.updateProfilePhoto(base64Image);

      // Update local user state with new photo
      setUser({ ...user!, picture: base64Image });
      Alert.alert('Успіх', 'Фото профілю оновлено!');
    } catch (error: any) {
      console.error('Photo upload error:', error);
      Alert.alert('Помилка', error.message || 'Не вдалося завантажити фото');
    } finally {
      setUploading(false);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={40} color="#fff" />
          )}
          <TouchableOpacity style={styles.cameraBadge} onPress={handlePhotoUpload} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator size={14} color="#fff" />
            ) : (
              <Ionicons name="camera" size={14} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.name}>{user?.name}</Text>
      <View style={styles.ratingContainer}>
        <Ionicons name="star" size={16} color="#fbbf24" />
        <Text style={styles.ratingText}>{user?.rating || '5.0'}</Text>
        <Text style={styles.reviewsText}>({user?.reviews_count || 0} відгуків)</Text>
      </View>
      <Text style={styles.email}>{user?.email}</Text>
      <View style={styles.roleBadge}>
        <Text style={styles.roleText}>{user?.role === 'client' ? 'КЛІЄНТ' : 'ВИКОНАВЕЦЬ'}</Text>
      </View>
    </View>
  );

  const renderClientProfile = () => (
    <ScrollView style={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Акаунт</Text>

        <TouchableOpacity style={styles.menuItem} onPress={() => setActiveSection(activeSection === 'payments' ? null : 'payments')}>
          <Ionicons name="card-outline" size={24} color="#10b981" />
          <Text style={styles.menuText}>Способи оплати</Text>
          <Ionicons name={activeSection === 'payments' ? "chevron-down" : "chevron-forward"} size={20} color="#d1d5db" />
        </TouchableOpacity>

        {activeSection === 'payments' && (
          <View style={styles.subSection}>
            {paymentMethods.length === 0 ? (
              <Text style={styles.emptyText}>Немає збережених карток</Text>
            ) : (
              paymentMethods.map((pm: any) => (
                <View key={pm.id} style={styles.dataItem}>
                  <Ionicons name="card" size={20} color="#6b7280" />
                  <Text style={styles.dataText}>{pm.type} •••• {pm.last4}</Text>
                </View>
              ))
            )}
            <TouchableOpacity style={styles.addButton}>
              <Text style={styles.addButtonText}>+ Додати картку</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.menuItem} onPress={() => setActiveSection(activeSection === 'addresses' ? null : 'addresses')}>
          <Ionicons name="location-outline" size={24} color="#10b981" />
          <Text style={styles.menuText}>Мої адреси</Text>
          <Ionicons name={activeSection === 'addresses' ? "chevron-down" : "chevron-forward"} size={20} color="#d1d5db" />
        </TouchableOpacity>

        {activeSection === 'addresses' && (
          <View style={styles.subSection}>
            {savedAddresses.length === 0 && !user?.address ? (
              <Text style={styles.emptyText}>Немає збережених адрес</Text>
            ) : (
              <>
                {user?.address && (
                  <View style={styles.dataItem}>
                    <Ionicons name="home" size={20} color="#6b7280" />
                    <Text style={styles.dataText}>{user.address}</Text>
                  </View>
                )}
                {savedAddresses.map((addr: any) => (
                  <View key={addr.id} style={styles.dataItem}>
                    <Ionicons name="map" size={20} color="#6b7280" />
                    <Text style={styles.dataText}>{addr.street}, {addr.city}</Text>
                  </View>
                ))}
              </>
            )}
            <TouchableOpacity style={styles.addButton}>
              <Text style={styles.addButtonText}>+ Додати адресу</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Запросити друзів', 'Ваш код: FRIEND20')}>
          <Ionicons name="gift-outline" size={24} color="#10b981" />
          <Text style={styles.menuText}>Запросити друзів (отримайте $20)</Text>
          <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Підтримка</Text>
        <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Підтримка', 'Email: support@handyhub.com')}>
          <Ionicons name="help-circle-outline" size={24} color="#6b7280" />
          <Text style={styles.menuText}>Допомога та підтримка</Text>
          <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={24} color="#ef4444" />
        <Text style={styles.logoutText}>Вийти з акаунту</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Версія 1.0.0</Text>
    </ScrollView>
  );

  const renderProviderProfile = () => (
    <ScrollView style={styles.content}>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{providerStats?.stats?.total_tasks ?? 0}</Text>
          <Text style={styles.statLabel}>Завдань</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{providerStats?.stats?.total_completed_tasks ?? 0}</Text>
          <Text style={styles.statLabel}>Виконано</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{user?.rating || '5.0'}</Text>
          <Text style={styles.statLabel}>Рейтинг</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Профіль виконавця</Text>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="person-outline" size={24} color="#2563eb" />
          <Text style={styles.menuText}>Про мене</Text>
          <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="cash-outline" size={24} color="#2563eb" />
          <Text style={styles.menuText}>Погодинна ставка</Text>
          <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="construct-outline" size={24} color="#2563eb" />
          <Text style={styles.menuText}>Навички</Text>
          <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="globe-outline" size={24} color="#2563eb" />
          <Text style={styles.menuText}>Мови</Text>
          <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={24} color="#ef4444" />
        <Text style={styles.logoutText}>Вийти з акаунту</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Версія 1.0.0</Text>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      {user?.role === 'provider' ? renderProviderProfile() : renderClientProfile()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#fff',
    alignItems: 'center',
    padding: 24,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#10b981',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
  },
  reviewsText: {
    fontSize: 14,
    color: '#6b7280',
  },
  email: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  roleBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#10b981',
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 20,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    marginLeft: 12,
  },
  subSection: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: -4,
  },
  dataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dataText: {
    fontSize: 14,
    color: '#374151',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 10,
  },
  addButton: {
    marginTop: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#10b981',
    fontWeight: '600',
    fontSize: 14,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9ca3af',
    marginVertical: 24,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    paddingVertical: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
});
