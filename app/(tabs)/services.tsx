import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { useServiceStore } from '../../store/serviceStore';
import { api } from '../../utils/api';
import PaymentReminderBanner from '../../components/PaymentReminderBanner';
import { showAlert, showConfirm } from '../../utils/alert';
import { compressBase64Image } from '../../utils/imageCompress';

export default function Services() {
  const { services, setServices } = useServiceStore();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'services' | 'categories'>('services');
  
  // Service Modal state
  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [serviceName, setServiceName] = useState('');
  const [serviceCategory, setServiceCategory] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [serviceDuration, setServiceDuration] = useState('');
  const [serviceAvailable, setServiceAvailable] = useState(true);
  const [serviceImageBase64, setServiceImageBase64] = useState('');

  // Category Modal state
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [catName, setCatName] = useState('');
  const [catDescription, setCatDescription] = useState('');
  const [catCommission, setCatCommission] = useState('');
  const [catRecommendedPrice, setCatRecommendedPrice] = useState('');
  const [catIcon, setCatIcon] = useState('');
  const [catImageBase64, setCatImageBase64] = useState('');
  const [catSaving, setCatSaving] = useState(false);
  const [catFormError, setCatFormError] = useState<string | null>(null);
  const [catFormSuccess, setCatFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          showAlert('Permission needed', 'Please allow access to your photos to upload images');
        }
      }
    })();
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [servicesData, categoriesData] = await Promise.all([
        api.getServices(),
        api.adminGetCategories().catch(() => api.getCategories())
      ]);
      setServices(servicesData);
      setCategories(categoriesData);
      if (categoriesData.length > 0 && !serviceCategory) {
        setServiceCategory(categoriesData[0].category_id || categoriesData[0].id);
      }
    } catch (error: any) {
      showAlert('Error', error?.response?.data?.detail || error.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Service Handlers
  const openServiceModal = (service?: any) => {
    if (service) {
      setEditingService(service);
      setServiceName(service.name);
      setServiceCategory(service.category);
      setServiceDescription(service.description);
      setServicePrice(service.price.toString());
      setServiceDuration(service.duration.toString());
      setServiceAvailable(service.available);
      setServiceImageBase64(service.image || '');
    } else {
      setEditingService(null);
      setServiceName('');
      setServiceCategory(categories[0]?.category_id || categories[0]?.id || '');
      setServiceDescription('');
      setServicePrice('');
      setServiceDuration('');
      setServiceAvailable(true);
      setServiceImageBase64('');
    }
    setServiceModalVisible(true);
  };

  const handleSaveService = async () => {
    if (!serviceName || !serviceDescription || !servicePrice || !serviceDuration) {
      showAlert('Error', 'Please fill in all fields');
      return;
    }

    try {
      const data = {
        name: serviceName,
        category: serviceCategory,
        description: serviceDescription,
        price: parseFloat(servicePrice),
        duration: parseInt(serviceDuration),
        available: serviceAvailable,
        image: serviceImageBase64 || undefined,
      };

      if (editingService) {
        await api.updateService(editingService.service_id, data);
      } else {
        await api.createService(data);
      }

      setServiceModalVisible(false);
      loadData();
      showAlert('Success', `Service ${editingService ? 'updated' : 'created'} successfully`);
    } catch (error: any) {
      showAlert('Error', error?.response?.data?.detail || error.message || 'Failed to save service');
    }
  };

  const handleDeleteService = async (id: string) => {
    showConfirm('Delete Service', 'Are you sure?', async () => {
      try {
        await api.deleteService(id);
        loadData();
      } catch (error: any) {
        showAlert('Error', error?.response?.data?.detail || error.message || 'Failed to delete');
      }
    }, 'Delete', 'Cancel');
  };

  // Category Handlers
  const openCategoryModal = async (category?: any) => {
    setCatFormError(null);
    setCatFormSuccess(null);
    if (category) {
      const id = category.category_id || category.id;
      // List response excludes the heavy base64 image — fetch full doc on edit.
      let full = category;
      if (id && category.has_image && !category.image) {
        try {
          full = await api.adminGetCategoryOne(id);
        } catch {
          full = category; // best-effort
        }
      }
      setEditingCategory(full);
      setCatName(full.name);
      setCatDescription(full.description || '');
      setCatCommission((full.commission_rate ?? 0).toString());
      setCatRecommendedPrice(
        full.recommended_price !== null && full.recommended_price !== undefined
          ? full.recommended_price.toString()
          : ''
      );
      setCatIcon(full.icon || '');
      setCatImageBase64(full.image || '');
    } else {
      setEditingCategory(null);
      setCatName('');
      setCatDescription('');
      setCatCommission('15');
      setCatRecommendedPrice('');
      setCatIcon('');
      setCatImageBase64('');
    }
    setCategoryModalVisible(true);
  };

  const handleSaveCategory = async () => {
    setCatFormError(null);
    setCatFormSuccess(null);

    if (!catName || !catName.trim()) {
      setCatFormError('Category name is required');
      return;
    }

    const commissionVal = parseFloat(catCommission);
    if (isNaN(commissionVal) || commissionVal < 0 || commissionVal > 100) {
      setCatFormError('Commission must be a number from 0 to 100');
      return;
    }

    const recommendedRaw = catRecommendedPrice.trim();
    let recommendedVal: number | null = null;
    if (recommendedRaw !== '') {
      recommendedVal = parseFloat(recommendedRaw);
      if (isNaN(recommendedVal) || recommendedVal < 0) {
        setCatFormError('Recommended price must be a number ≥ 0');
        return;
      }
    }

    setCatSaving(true);
    try {
      const data: any = {
        name: catName.trim(),
        description: catDescription,
        commission_rate: commissionVal,
        recommended_price: recommendedVal,
        icon: catIcon,
        // Explicit null so the backend clears the image when the admin
        // removed it; empty string would otherwise be coerced and ignored.
        image: catImageBase64 ? catImageBase64 : null,
      };

      if (editingCategory) {
        await api.updateCategory(editingCategory.category_id || editingCategory.id, data);
      } else {
        await api.createCategory(data);
      }

      setCatFormSuccess(editingCategory ? 'Category saved' : 'Category created');
      await loadData();
      // Close after short delay so user sees success message
      setTimeout(() => {
        setCategoryModalVisible(false);
        setCatFormSuccess(null);
      }, 700);
    } catch (error: any) {
      const detail = error?.response?.data?.detail || error?.message || 'Could not save the category';
      setCatFormError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    showConfirm(
      'Delete Category',
      'Are you sure? This might affect services in this category.',
      async () => {
        try {
          await api.deleteCategory(id);
          loadData();
        } catch (error: any) {
          showAlert('Error', error?.response?.data?.detail || error.message || 'Failed to delete');
        }
      },
      'Delete',
      'Cancel'
    );
  };

  const handleToggleCategoryActive = async (cat: any) => {
    const id = cat.category_id || cat.id;
    const nextActive = cat.is_active === false ? true : false;
    try {
      await api.updateCategory(id, { is_active: nextActive });
      loadData();
    } catch (error: any) {
      showAlert('Error', error?.response?.data?.detail || error.message || 'Failed to toggle');
    }
  };

  const pickImage = async (type: 'service' | 'category') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: Platform.OS !== 'web',
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const raw = `data:image/jpeg;base64,${result.assets[0].base64}`;
      // Aggressively compress on web — phone cameras produce 5–10 MB photos
      // which trip the 30 s axios timeout when sent as base64. 1024 px / 0.8
      // JPEG ≈ 150–300 KB.
      const compressed = await compressBase64Image(raw, 1024, 0.8);
      if (type === 'service') setServiceImageBase64(compressed);
      else setCatImageBase64(compressed);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.headerTitle}>Admin Panel</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => activeTab === 'services' ? openServiceModal() : openCategoryModal()}
            data-testid="admin-add-btn"
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navRow}>
          {[
            { icon: 'cash', color: '#10b981', label: 'Payments', route: '/admin-payments', tid: 'open-admin-payments-btn' },
            { icon: 'stats-chart', color: '#7c3aed', label: 'Stats', route: '/admin-payment-stats', tid: 'open-admin-payment-stats-btn' },
            { icon: 'mail-unread', color: '#0ea5e9', label: 'Support', route: '/admin-support-requests', tid: 'open-admin-support-btn' },
            { icon: 'key', color: '#6b7280', label: 'Integrations', route: '/admin-integrations', tid: 'open-admin-integrations-btn' },
            { icon: 'location', color: '#f59e0b', label: 'Service Area', route: '/admin-service-area', tid: 'open-admin-service-area-btn' },
            { icon: 'map', color: '#0891b2', label: 'Coverage', route: '/admin-coverage', tid: 'open-admin-coverage-btn' },
            { icon: 'people', color: '#ec4899', label: 'Waitlist', route: '/admin-waitlist', tid: 'open-admin-waitlist-btn' },
          ].map((b) => (
            <TouchableOpacity key={b.route} style={styles.navItem} onPress={() => router.push(b.route as any)} data-testid={b.tid}>
              <View style={[styles.navIcon, { backgroundColor: b.color }]}>
                <Ionicons name={b.icon as any} size={20} color="#fff" />
              </View>
              <Text style={styles.navLabel}>{b.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'services' && styles.activeTab]} 
          onPress={() => setActiveTab('services')}
        >
          <Text style={[styles.tabText, activeTab === 'services' && styles.activeTabText]}>Services</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'categories' && styles.activeTab]} 
          onPress={() => setActiveTab('categories')}
        >
          <Text style={[styles.tabText, activeTab === 'categories' && styles.activeTabText]}>Categories</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <PaymentReminderBanner />
        {activeTab === 'services' ? (
          services.map((service) => (
            <View key={service.service_id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{service.name}</Text>
                <Text style={styles.priceText}>${service.price}</Text>
              </View>
              <Text style={styles.cardSub}>{service.category}</Text>
              <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => openServiceModal(service)} style={styles.actionBtn}>
                  <Ionicons name="pencil" size={20} color="#2563eb" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteService(service.service_id)} style={styles.actionBtn}>
                  <Ionicons name="trash" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          categories.map((cat) => (
            <View key={cat.category_id || cat.id} style={styles.card}>
              {cat.image ? (
                <Image source={{ uri: cat.image }} style={styles.cardCover} />
              ) : null}
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{cat.name}</Text>
                <Text style={styles.commissionText}>{cat.commission_rate ?? 0}% Fee</Text>
              </View>
              {cat.recommended_price !== null && cat.recommended_price !== undefined ? (
                <Text style={styles.recommendedPriceText}>
                  Recommended: ${cat.recommended_price}
                </Text>
              ) : null}
              <Text style={styles.cardSub}>{cat.description || 'No description'}</Text>
              {cat.is_active === false ? (
                <Text style={styles.inactiveBadge}>Inactive</Text>
              ) : null}
              <View style={styles.cardActions}>
                <TouchableOpacity
                  onPress={() => handleToggleCategoryActive(cat)}
                  style={[styles.actionBtn, { flexDirection: 'row', gap: 4, paddingHorizontal: 8 }]}
                  data-testid={`cat-toggle-${cat.category_id || cat.id}`}
                >
                  <Ionicons
                    name={cat.is_active === false ? 'play-circle' : 'pause-circle'}
                    size={20}
                    color={cat.is_active === false ? '#16a34a' : '#d97706'}
                  />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: cat.is_active === false ? '#16a34a' : '#d97706' }}>
                    {cat.is_active === false ? 'Activate' : 'Deactivate'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openCategoryModal(cat)} style={styles.actionBtn}>
                  <Ionicons name="pencil" size={20} color="#2563eb" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteCategory(cat.category_id || cat.id)} style={styles.actionBtn}>
                  <Ionicons name="trash" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Service Modal */}
      <Modal visible={serviceModalVisible} animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingService ? 'Edit Service' : 'New Service'}</Text>
            <TouchableOpacity onPress={() => setServiceModalVisible(false)}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.form}>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={serviceName} onChangeText={setServiceName} />
            
            <Text style={styles.label}>Category</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={serviceCategory} onValueChange={setServiceCategory}>
                {categories.map(c => (
                  <Picker.Item key={c.category_id || c.id} label={c.name} value={c.category_id || c.id} />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>Price ($)</Text>
            <TextInput style={styles.input} value={servicePrice} onChangeText={setServicePrice} keyboardType="numeric" />

            <Text style={styles.label}>Duration (min)</Text>
            <TextInput style={styles.input} value={serviceDuration} onChangeText={setServiceDuration} keyboardType="numeric" />

            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, { height: 80 }]} value={serviceDescription} onChangeText={setServiceDescription} multiline />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveService}>
              <Text style={styles.saveBtnText}>Save Service</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Category Modal */}
      <Modal visible={categoryModalVisible} animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingCategory ? 'Edit Category' : 'New Category'}</Text>
            <TouchableOpacity onPress={() => setCategoryModalVisible(false)}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.form}>
            <Text style={styles.label}>Category Name</Text>
            <TextInput
              style={styles.input}
              value={catName}
              onChangeText={setCatName}
              placeholder="e.g. Cleaning"
            />

            <Text style={styles.label}>Platform Commission (%)</Text>
            <TextInput
              style={styles.input}
              value={catCommission}
              onChangeText={setCatCommission}
              keyboardType="numeric"
              placeholder="e.g. 15"
            />
            <Text style={styles.helperText}>
              Percent platform takes from each completed job in this category.
            </Text>

            <Text style={styles.label}>Recommended Price for Executor ($)</Text>
            <TextInput
              style={styles.input}
              value={catRecommendedPrice}
              onChangeText={setCatRecommendedPrice}
              keyboardType="numeric"
              placeholder="Optional — e.g. 50"
            />
            <Text style={styles.helperText}>
              Suggested base price shown to executors when they price a job in this category.
            </Text>

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              value={catDescription}
              onChangeText={setCatDescription}
              multiline
              placeholder="Short description"
            />

            <Text style={styles.label}>Category Cover Image</Text>
            <TouchableOpacity style={styles.imagePicker} onPress={() => pickImage('category')}>
              {catImageBase64 ? (
                <Image source={{ uri: catImageBase64 }} style={styles.previewImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="camera" size={32} color="#9ca3af" />
                  <Text style={styles.placeholderText}>Upload Cover Image</Text>
                </View>
              )}
            </TouchableOpacity>
            {catImageBase64 ? (
              <TouchableOpacity
                style={styles.removeImageBtn}
                onPress={() => setCatImageBase64('')}
                data-testid="remove-cat-image-btn"
              >
                <Ionicons name="trash-outline" size={16} color="#b91c1c" />
                <Text style={styles.removeImageBtnText}>Remove image</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.saveBtn, catSaving && { opacity: 0.6 }]}
              onPress={handleSaveCategory}
              disabled={catSaving}
              data-testid="save-category-btn"
            >
              <Text style={styles.saveBtnText}>
                {catSaving ? 'Saving…' : 'Save Category'}
              </Text>
            </TouchableOpacity>

            {catFormError ? (
              <View style={styles.inlineError} data-testid="cat-form-error">
                <Ionicons name="alert-circle" size={18} color="#b91c1c" />
                <Text style={styles.inlineErrorText}>{catFormError}</Text>
              </View>
            ) : null}
            {catFormSuccess ? (
              <View style={styles.inlineSuccess} data-testid="cat-form-success">
                <Ionicons name="checkmark-circle" size={18} color="#15803d" />
                <Text style={styles.inlineSuccessText}>{catFormSuccess}</Text>
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, paddingTop: 60, backgroundColor: '#fff' },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  addButton: { backgroundColor: '#2563eb', padding: 10, borderRadius: 25 },
  navRow: { flexDirection: 'row', gap: 18, paddingTop: 16, paddingRight: 20 },
  navItem: { alignItems: 'center', width: 64 },
  navIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 11, color: '#4b5563', marginTop: 5, textAlign: 'center' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tab: { flex: 1, padding: 15, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  tabText: { color: '#6b7280', fontWeight: '600' },
  activeTabText: { color: '#2563eb' },
  content: { padding: 15 },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  cardTitle: { fontSize: 18, fontWeight: 'bold' },
  cardSub: { color: '#6b7280', marginBottom: 10 },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  actionBtn: { marginLeft: 20 },
  priceText: { color: '#059669', fontWeight: 'bold' },
  commissionText: { color: '#d97706', fontWeight: 'bold' },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  form: { padding: 20 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 5, color: '#374151' },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 8, fontSize: 16 },
  helperText: { fontSize: 12, color: '#6b7280', marginBottom: 16, marginTop: -4 },
  pickerContainer: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, marginBottom: 20, overflow: 'hidden' },
  saveBtn: { backgroundColor: '#2563eb', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10, marginBottom: 40 },
  saveBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  cardCover: { width: '100%', height: 140, borderRadius: 8, marginBottom: 10, backgroundColor: '#e5e7eb' },
  recommendedPriceText: { color: '#2563eb', fontWeight: '600', marginBottom: 4 },
  inactiveBadge: { alignSelf: 'flex-start', backgroundColor: '#fee2e2', color: '#b91c1c', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontSize: 12, fontWeight: '600', marginBottom: 6, overflow: 'hidden' },
  imagePicker: { borderWidth: 1, borderColor: '#d1d5db', borderStyle: 'dashed', borderRadius: 8, marginBottom: 20, overflow: 'hidden', minHeight: 120 },
  imagePlaceholder: { padding: 30, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: '#9ca3af', marginTop: 8, fontSize: 14 },
  previewImage: { width: '100%', height: 180, resizeMode: 'cover' },
  removeImageBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: '#fee2e2', marginTop: -10, marginBottom: 16 },
  removeImageBtnText: { color: '#b91c1c', fontWeight: '600', fontSize: 13 },
  inlineError: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fee2e2', borderColor: '#fecaca', borderWidth: 1, padding: 10, borderRadius: 8, marginTop: 12, gap: 8 },
  inlineErrorText: { color: '#b91c1c', flex: 1, fontSize: 14, fontWeight: '500' },
  inlineSuccess: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#dcfce7', borderColor: '#bbf7d0', borderWidth: 1, padding: 10, borderRadius: 8, marginTop: 12, gap: 8 },
  inlineSuccessText: { color: '#15803d', flex: 1, fontSize: 14, fontWeight: '500' },
});
