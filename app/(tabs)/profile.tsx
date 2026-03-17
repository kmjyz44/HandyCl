import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../utils/api';

export default function Profile() {
  const router = useRouter();
  const { user, setUser, logout } = useAuthStore();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  // Edit form state
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');

  const handleLogout = async () => {
    Alert.alert('Вийти', 'Ви впевнені, що хочете вийти?', [
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

  const pickProfilePhoto = async () => {
    Alert.alert('Фото профілю', 'Оберіть опцію', [
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
        text: 'Видалити фото',
        style: 'destructive',
        onPress: async () => {
          await uploadPhoto('');
        },
      },
      { text: 'Скасувати', style: 'cancel' },
    ]);
  };

  const uploadPhoto = async (base64: string) => {
    setUploadingPhoto(true);
    try {
      const picture = base64 ? `data:image/jpeg;base64,${base64}` : '';
      const updatedUser = await api.updateProfile({ picture });
      setUser(updatedUser);
      Alert.alert('Успіх', base64 ? 'Фото оновлено' : 'Фото видалено');
    } catch (error: any) {
      Alert.alert('Помилка', error.message || 'Не вдалося оновити фото');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const openEditModal = () => {
    setEditName(user?.name || '');
    setEditPhone(user?.phone || '');
    setEditModalVisible(true);
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

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'АДМІН';
      case 'provider': return 'ВИКОНАВЕЦЬ';
      case 'client': return 'КЛІЄНТ';
      default: return role?.toUpperCase();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.avatarContainer} 
          onPress={pickProfilePhoto}
          disabled={uploadingPhoto}
        >
          {uploadingPhoto ? (
            <View style={styles.avatar}>
              <ActivityIndicator color="#fff" size="large" />
            </View>
          ) : user?.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Ionicons name="person" size={40} color="#fff" />
            </View>
          )}
          <View style={styles.cameraButton}>
            <Ionicons name="camera" size={16} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        {user?.phone && (
          <Text style={styles.phone}>{user.phone}</Text>
        )}
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{getRoleLabel(user?.role || '')}</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Акаунт</Text>

          <TouchableOpacity style={styles.menuItem} onPress={openEditModal}>
            <Ionicons name="person-outline" size={24} color="#6b7280" />
            <Text style={styles.menuText}>Редагувати профіль</Text>
            <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Alert.alert('Інфо', 'Налаштування сповіщень скоро')}
          >
            <Ionicons name="notifications-outline" size={24} color="#6b7280" />
            <Text style={styles.menuText}>Сповіщення</Text>
            <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Alert.alert('Інфо', 'Telegram сповіщення скоро')}
          >
            <Ionicons name="paper-plane-outline" size={24} color="#6b7280" />
            <Text style={styles.menuText}>Telegram сповіщення</Text>
            <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Підтримка</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Alert.alert('Допомога', 'Зверніться до support@handyhub.com')}
          >
            <Ionicons name="help-circle-outline" size={24} color="#6b7280" />
            <Text style={styles.menuText}>Допомога</Text>
            <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Alert.alert('Інфо', 'Умови використання скоро')}
          >
            <Ionicons name="document-text-outline" size={24} color="#6b7280" />
            <Text style={styles.menuText}>Умови використання</Text>
            <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Alert.alert('Інфо', 'Політика конфіденційності скоро')}
          >
            <Ionicons name="shield-checkmark-outline" size={24} color="#6b7280" />
            <Text style={styles.menuText}>Політика конфіденційності</Text>
            <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#ef4444" />
          <Text style={styles.logoutText}>Вийти</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Версія 1.0.0</Text>
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
                style={[styles.button, styles.cancelButton]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={saveProfile}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Зберегти</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatarContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#2563eb',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  phone: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  roleBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 12,
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
    marginLeft: 16,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
  modalBody: {
    padding: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
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
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 24,
    paddingTop: 0,
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
