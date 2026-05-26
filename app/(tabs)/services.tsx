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
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { useServiceStore } from '../../store/serviceStore';
import { api } from '../../utils/api';

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
  const [catIcon, setCatIcon] = useState('');
  const [catImageBase64, setCatImageBase64] = useState('');

  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photos to upload images');
      }
    })();
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [servicesData, categoriesData] = await Promise.all([
        api.getServices(),
        api.getCategories()
      ]);
      setServices(servicesData);
      setCategories(categoriesData);
      if (categoriesData.length > 0 && !serviceCategory) {
        setServiceCategory(categoriesData[0].category_id || categoriesData[0].id);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load data');
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
      Alert.alert('Error', 'Please fill in all fields');
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
      Alert.alert('Success', `Service ${editingService ? 'updated' : 'created'} successfully`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save service');
    }
  };

  const handleDeleteService = async (id: string) => {
    Alert.alert('Delete Service', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.deleteService(id);
          loadData();
        } catch (error: any) {
          Alert.alert('Error', error.message);
        }
      }}
    ]);
  };

  // Category Handlers
  const openCategoryModal = (category?: any) => {
    if (category) {
      setEditingCategory(category);
      setCatName(category.name);
      setCatDescription(category.description || '');
      setCatCommission((category.commission_rate || 0).toString());
      setCatIcon(category.icon || '');
      setCatImageBase64(category.image || '');
    } else {
      setEditingCategory(null);
      setCatName('');
      setCatDescription('');
      setCatCommission('15');
      setCatIcon('');
      setCatImageBase64('');
    }
    setCategoryModalVisible(true);
  };

  const handleSaveCategory = async () => {
    if (!catName) {
      Alert.alert('Error', 'Category name is required');
      return;
    }

    try {
      const data = {
        name: catName,
        description: catDescription,
        commission_rate: parseFloat(catCommission),
        icon: catIcon,
        image: catImageBase64 || undefined,
      };

      if (editingCategory) {
        await api.updateCategory(editingCategory.category_id || editingCategory.id, data);
      } else {
        await api.createCategory(data);
      }

      setCategoryModalVisible(false);
      loadData();
      Alert.alert('Success', `Category ${editingCategory ? 'updated' : 'created'} successfully`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save category');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    Alert.alert('Delete Category', 'Are you sure? This might affect services in this category.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.deleteCategory(id);
          loadData();
        } catch (error: any) {
          Alert.alert('Error', error.message);
        }
      }}
    ]);
  };

  const pickImage = async (type: 'service' | 'category') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      if (type === 'service') setServiceImageBase64(base64);
      else setCatImageBase64(base64);
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
        <Text style={styles.headerTitle}>Admin Panel</Text>
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={() => activeTab === 'services' ? openServiceModal() : openCategoryModal()}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
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
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{cat.name}</Text>
                <Text style={styles.commissionText}>{cat.commission_rate || 0}% Fee</Text>
              </View>
              <Text style={styles.cardSub}>{cat.description || 'No description'}</Text>
              <View style={styles.cardActions}>
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
            <TextInput style={styles.input} value={catName} onChangeText={setCatName} />

            <Text style={styles.label}>Commission Rate (%)</Text>
            <TextInput style={styles.input} value={catCommission} onChangeText={setCatCommission} keyboardType="numeric" />

            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, { height: 80 }]} value={catDescription} onChangeText={setCatDescription} multiline />

            <Text style={styles.label}>Category Image</Text>
            <TouchableOpacity style={styles.imagePicker} onPress={() => pickImage('category')}>
              {catImageBase64 ? (
                <Image source={{ uri: catImageBase64 }} style={styles.previewImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="camera" size={32} color="#9ca3af" />
                  <Text style={styles.placeholderText}>Upload Category Image</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveCategory}>
              <Text style={styles.saveBtnText}>Save Category</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: '#fff' },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  addButton: { backgroundColor: '#2563eb', padding: 10, borderRadius: 25 },
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
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 16 },
  pickerContainer: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, marginBottom: 20, overflow: 'hidden' },
  saveBtn: { backgroundColor: '#2563eb', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  imagePicker: {
    height: 150,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#f9fafb',
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 8,
    color: '#9ca3af',
    fontSize: 14,
  },
});
