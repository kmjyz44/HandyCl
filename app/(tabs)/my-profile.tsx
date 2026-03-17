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
import { api } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';

interface ExecutorProfile {
  profile_id?: string;
  user_id: string;
  bio?: string;
  skills: string[];
  experience_years?: number;
  hourly_rate?: number;
  portfolio_photos: string[];
  certifications: string[];
  languages: string[];
}

export default function MyProfile() {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<ExecutorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalType, setModalType] = useState<'bio' | 'skills' | 'rate' | 'cert' | 'lang' | null>(null);
  
  // Form states
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [certifications, setCertifications] = useState<string[]>([]);
  const [newCert, setNewCert] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [newLanguage, setNewLanguage] = useState('');
  const [portfolioPhotos, setPortfolioPhotos] = useState<string[]>([]);

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
      setPortfolioPhotos(data.portfolio_photos || []);
    } catch (error: any) {
      // Profile doesn't exist yet
      setProfile({
        user_id: user?.user_id || '',
        skills: [],
        portfolio_photos: [],
        certifications: [],
        languages: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async (updates: Partial<ExecutorProfile>) => {
    setSaving(true);
    try {
      if (profile?.profile_id) {
        await api.updateExecutorProfile(updates);
      } else {
        await api.createExecutorProfile(updates);
      }
      loadProfile();
      Alert.alert('Успіх', 'Профіль оновлено');
    } catch (error: any) {
      Alert.alert('Помилка', error.message || 'Не вдалося зберегти');
    } finally {
      setSaving(false);
    }
  };

  const addPortfolioPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Помилка', 'Потрібен доступ до галереї');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        const newPhotos = [...portfolioPhotos, base64Image];
        setPortfolioPhotos(newPhotos);
        saveProfile({ portfolio_photos: newPhotos });
      }
    } catch (error) {
      Alert.alert('Помилка', 'Не вдалося додати фото');
    }
  };

  const removePortfolioPhoto = (index: number) => {
    Alert.alert('Видалити фото', 'Ви впевнені?', [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Видалити',
        style: 'destructive',
        onPress: () => {
          const newPhotos = portfolioPhotos.filter((_, i) => i !== index);
          setPortfolioPhotos(newPhotos);
          saveProfile({ portfolio_photos: newPhotos });
        },
      },
    ]);
  };

  const addSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      const newSkills = [...skills, newSkill.trim()];
      setSkills(newSkills);
      setNewSkill('');
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter(s => s !== skill));
  };

  const saveSkills = () => {
    saveProfile({ skills });
    setModalType(null);
  };

  const addCertification = () => {
    if (newCert.trim() && !certifications.includes(newCert.trim())) {
      const newCerts = [...certifications, newCert.trim()];
      setCertifications(newCerts);
      setNewCert('');
    }
  };

  const removeCertification = (cert: string) => {
    setCertifications(certifications.filter(c => c !== cert));
  };

  const saveCertifications = () => {
    saveProfile({ certifications });
    setModalType(null);
  };

  const addLanguage = () => {
    if (newLanguage.trim() && !languages.includes(newLanguage.trim())) {
      const newLangs = [...languages, newLanguage.trim()];
      setLanguages(newLangs);
      setNewLanguage('');
    }
  };

  const removeLanguage = (lang: string) => {
    setLanguages(languages.filter(l => l !== lang));
  };

  const saveLanguages = () => {
    saveProfile({ languages });
    setModalType(null);
  };

  const saveBio = () => {
    saveProfile({ bio, experience_years: experienceYears ? parseInt(experienceYears) : undefined });
    setModalType(null);
  };

  const saveRate = () => {
    const rate = parseFloat(hourlyRate);
    if (isNaN(rate) || rate <= 0) {
      Alert.alert('Помилка', 'Введіть коректну ставку');
      return;
    }
    saveProfile({ hourly_rate: rate });
    setModalType(null);
  };

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
        <Text style={styles.headerTitle}>Мій профіль</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Bio Section */}
        <TouchableOpacity style={styles.section} onPress={() => setModalType('bio')}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-outline" size={24} color="#2563eb" />
            <Text style={styles.sectionTitle}>Про мене</Text>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </View>
          {bio ? (
            <Text style={styles.bioText} numberOfLines={3}>{bio}</Text>
          ) : (
            <Text style={styles.placeholderText}>Додайте опис про себе...</Text>
          )}
          {experienceYears && (
            <View style={styles.experienceRow}>
              <Ionicons name="briefcase-outline" size={16} color="#6b7280" />
              <Text style={styles.experienceText}>{experienceYears} років досвіду</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Hourly Rate Section */}
        <TouchableOpacity style={styles.section} onPress={() => setModalType('rate')}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cash-outline" size={24} color="#10b981" />
            <Text style={styles.sectionTitle}>Погодинна ставка</Text>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </View>
          {hourlyRate ? (
            <Text style={styles.rateText}>${hourlyRate}/год</Text>
          ) : (
            <Text style={styles.placeholderText}>Встановіть вашу ставку...</Text>
          )}
        </TouchableOpacity>

        {/* Skills Section */}
        <TouchableOpacity style={styles.section} onPress={() => setModalType('skills')}>
          <View style={styles.sectionHeader}>
            <Ionicons name="construct-outline" size={24} color="#f59e0b" />
            <Text style={styles.sectionTitle}>Навички</Text>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </View>
          {skills.length > 0 ? (
            <View style={styles.tagsContainer}>
              {skills.map((skill, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{skill}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.placeholderText}>Додайте ваші навички...</Text>
          )}
        </TouchableOpacity>

        {/* Languages Section */}
        <TouchableOpacity style={styles.section} onPress={() => setModalType('lang')}>
          <View style={styles.sectionHeader}>
            <Ionicons name="globe-outline" size={24} color="#6366f1" />
            <Text style={styles.sectionTitle}>Мови</Text>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </View>
          {languages.length > 0 ? (
            <View style={styles.tagsContainer}>
              {languages.map((lang, index) => (
                <View key={index} style={[styles.tag, styles.langTag]}>
                  <Text style={[styles.tagText, styles.langTagText]}>{lang}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.placeholderText}>Додайте мови...</Text>
          )}
        </TouchableOpacity>

        {/* Certifications Section */}
        <TouchableOpacity style={styles.section} onPress={() => setModalType('cert')}>
          <View style={styles.sectionHeader}>
            <Ionicons name="ribbon-outline" size={24} color="#ec4899" />
            <Text style={styles.sectionTitle}>Сертифікати</Text>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </View>
          {certifications.length > 0 ? (
            <View style={styles.certList}>
              {certifications.map((cert, index) => (
                <View key={index} style={styles.certItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                  <Text style={styles.certText}>{cert}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.placeholderText}>Додайте сертифікати...</Text>
          )}
        </TouchableOpacity>

        {/* Portfolio Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="images-outline" size={24} color="#8b5cf6" />
            <Text style={styles.sectionTitle}>Портфоліо</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.portfolioScroll}>
            {portfolioPhotos.map((photo, index) => (
              <TouchableOpacity
                key={index}
                onLongPress={() => removePortfolioPhoto(index)}
                style={styles.portfolioItem}
              >
                <Image source={{ uri: photo }} style={styles.portfolioImage} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.addPhotoButton} onPress={addPortfolioPhoto}>
              <Ionicons name="add" size={32} color="#6b7280" />
              <Text style={styles.addPhotoText}>Додати</Text>
            </TouchableOpacity>
          </ScrollView>
          {portfolioPhotos.length > 0 && (
            <Text style={styles.hintText}>Утримуйте фото, щоб видалити</Text>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Bio Modal */}
      <Modal visible={modalType === 'bio'} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Про мене</Text>
              <TouchableOpacity onPress={() => setModalType(null)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.label}>Опис</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={bio}
                onChangeText={setBio}
                placeholder="Розкажіть про себе..."
                multiline
                numberOfLines={6}
              />
              <Text style={styles.label}>Років досвіду</Text>
              <TextInput
                style={styles.input}
                value={experienceYears}
                onChangeText={setExperienceYears}
                placeholder="5"
                keyboardType="number-pad"
              />
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.saveButton} onPress={saveBio} disabled={saving}>
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

      {/* Rate Modal */}
      <Modal visible={modalType === 'rate'} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Погодинна ставка</Text>
              <TouchableOpacity onPress={() => setModalType(null)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.label}>Ваша ставка ($ за годину)</Text>
              <TextInput
                style={styles.input}
                value={hourlyRate}
                onChangeText={setHourlyRate}
                placeholder="25.00"
                keyboardType="decimal-pad"
              />
              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={20} color="#2563eb" />
                <Text style={styles.infoBoxText}>
                  Ця ставка буде показана клієнтам. Адмін може додати комісію сервісу.
                </Text>
              </View>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.saveButton} onPress={saveRate} disabled={saving}>
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

      {/* Skills Modal */}
      <Modal visible={modalType === 'skills'} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Навички</Text>
              <TouchableOpacity onPress={() => setModalType(null)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={newSkill}
                  onChangeText={setNewSkill}
                  placeholder="Нова навичка..."
                  onSubmitEditing={addSkill}
                />
                <TouchableOpacity style={styles.addItemButton} onPress={addSkill}>
                  <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.tagsContainerModal}>
                {skills.map((skill, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.tagRemovable}
                    onPress={() => removeSkill(skill)}
                  >
                    <Text style={styles.tagText}>{skill}</Text>
                    <Ionicons name="close-circle" size={18} color="#ef4444" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.saveButton} onPress={saveSkills} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Зберегти</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Languages Modal */}
      <Modal visible={modalType === 'lang'} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Мови</Text>
              <TouchableOpacity onPress={() => setModalType(null)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={newLanguage}
                  onChangeText={setNewLanguage}
                  placeholder="Нова мова..."
                  onSubmitEditing={addLanguage}
                />
                <TouchableOpacity style={styles.addItemButton} onPress={addLanguage}>
                  <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.tagsContainerModal}>
                {languages.map((lang, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.tagRemovable, styles.langTag]}
                    onPress={() => removeLanguage(lang)}
                  >
                    <Text style={[styles.tagText, styles.langTagText]}>{lang}</Text>
                    <Ionicons name="close-circle" size={18} color="#4338ca" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.saveButton} onPress={saveLanguages} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Зберегти</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Certifications Modal */}
      <Modal visible={modalType === 'cert'} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Сертифікати</Text>
              <TouchableOpacity onPress={() => setModalType(null)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={newCert}
                  onChangeText={setNewCert}
                  placeholder="Новий сертифікат..."
                  onSubmitEditing={addCertification}
                />
                <TouchableOpacity style={styles.addItemButton} onPress={addCertification}>
                  <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.certListModal}>
                {certifications.map((cert, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.certItemRemovable}
                    onPress={() => removeCertification(cert)}
                  >
                    <Ionicons name="ribbon" size={18} color="#ec4899" />
                    <Text style={styles.certText}>{cert}</Text>
                    <Ionicons name="close-circle" size={18} color="#ef4444" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.saveButton} onPress={saveCertifications} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Зберегти</Text>
                )}
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
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  bioText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 22,
  },
  placeholderText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  experienceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  experienceText: {
    fontSize: 13,
    color: '#6b7280',
  },
  rateText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10b981',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 13,
    color: '#92400e',
    fontWeight: '500',
  },
  langTag: {
    backgroundColor: '#eef2ff',
  },
  langTagText: {
    color: '#4338ca',
  },
  certList: {
    gap: 8,
  },
  certItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  certText: {
    fontSize: 14,
    color: '#374151',
  },
  portfolioScroll: {
    marginHorizontal: -4,
  },
  portfolioItem: {
    marginHorizontal: 4,
  },
  portfolioImage: {
    width: 120,
    height: 90,
    borderRadius: 8,
  },
  addPhotoButton: {
    width: 120,
    height: 90,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  addPhotoText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  hintText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 12,
    textAlign: 'center',
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
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  addItemButton: {
    backgroundColor: '#2563eb',
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagsContainerModal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagRemovable: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  certListModal: {
    gap: 8,
  },
  certItemRemovable: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdf2f8',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    alignItems: 'flex-start',
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 18,
  },
  modalFooter: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  saveButton: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
