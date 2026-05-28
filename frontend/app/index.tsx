import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';
import { Ionicons } from '@expo/vector-icons';

export default function Index() {
  const router = useRouter();
  const { token, isLoading, setUser } = useAuthStore();

  useEffect(() => {
    const checkAuth = async () => {
      if (isLoading) return;

      if (!token) {
        // No token — guest user, show landing page (do NOT redirect to login)
        return;
      }

      try {
        const user = await api.getMe();
        setUser(user);
        router.replace('/(tabs)');
      } catch (error) {
        console.error('Auth check failed:', error);
        router.replace('/login');
      }
    };

    checkAuth();
  }, [token, isLoading]);

  // If still loading initial auth state, show loading indicator
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.text}>Loading...</Text>
      </View>
    );
  }

  // If no token, show TaskRabbit-style landing page
  if (!token) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>HandyHub</Text>
          <Text style={styles.heroSubtitle}>Знайдіть майстра для будь-якої роботи</Text>
          <Text style={styles.heroDescription}>Від дрібного ремонту до серйозних проектів — ми знайдемо для вас найкращого виконавця</Text>
          
          <View style={styles.heroButtons}>
            <TouchableOpacity 
              style={styles.primaryBtn}
              onPress={() => router.push('/login')}
            >
              <Text style={styles.primaryBtnText}>Замовити послугу</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.secondaryBtn}
              onPress={() => router.push('/signup')}
            >
              <Text style={styles.secondaryBtnText}>Стати виконавцем</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Features Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Як це працює</Text>
          <View style={styles.featuresGrid}>
            {[
              { icon: 'search-outline', title: 'Знайдіть', desc: 'Виберіть послугу та опишіть завдання' },
              { icon: 'people-outline', title: 'Виберіть', desc: 'Переглядайте профілі та рейтинги' },
              { icon: 'checkmark-circle-outline', title: 'Забронюйте', desc: 'Підтвердіть час та ціну' },
              { icon: 'card-outline', title: 'Оплатіть', desc: 'Безпечна оплата онлайн' },
            ].map((item, idx) => (
              <View key={idx} style={styles.featureCard}>
                <View style={styles.featureIcon}>
                  <Ionicons name={item.icon as any} size={28} color="#2563eb" />
                </View>
                <Text style={styles.featureTitle}>{item.title}</Text>
                <Text style={styles.featureDesc}>{item.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Categories Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Популярні послуги</Text>
          <View style={styles.categoriesGrid}>
            {[
              { icon: 'cube-outline', name: 'Збірка меблів', color: '#2563eb', bg: '#eff6ff' },
              { icon: 'sparkles-outline', name: 'Прибирання', color: '#0891b2', bg: '#ecfeff' },
              { icon: 'hammer-outline', name: 'Ремонт', color: '#7c3aed', bg: '#f5f3ff' },
              { icon: 'car-outline', name: 'Переїзд', color: '#d97706', bg: '#fffbeb' },
              { icon: 'leaf-outline', name: 'Зовнішні роботи', color: '#16a34a', bg: '#f0fdf4' },
              { icon: 'person-outline', name: 'Особиста допомога', color: '#db2777', bg: '#fdf2f8' },
            ].map((cat, idx) => (
              <TouchableOpacity 
                key={idx} 
                style={[styles.categoryCard, { backgroundColor: cat.bg }]}
                onPress={() => router.push('/login')}
              >
                <View style={[styles.categoryIconBox, { backgroundColor: cat.color + '22' }]}>
                  <Ionicons name={cat.icon as any} size={24} color={cat.color} />
                </View>
                <Text style={[styles.categoryName, { color: cat.color }]}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* CTA Section */}
        <View style={styles.ctaSection}>
          <Text style={styles.ctaTitle}>Готові почати?</Text>
          <TouchableOpacity 
            style={styles.ctaButton}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.ctaButtonText}>Замовити послугу</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2024 HandyHub. Усі права захищені.</Text>
        </View>
      </ScrollView>
    );
  }

  // If token exists but user is loading, show loading indicator
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2563eb" />
      <Text style={styles.text}>Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
    backgroundColor: '#eff6ff',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: '#2563eb',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  heroDescription: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 24,
    marginBottom: 24,
  },
  heroButtons: {
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  secondaryBtnText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '700',
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  featureCard: {
    width: '48%',
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    width: '48%',
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  categoryIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  ctaSection: {
    marginHorizontal: 20,
    marginVertical: 32,
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: '#2563eb',
    borderRadius: 16,
    alignItems: 'center',
  },
  ctaTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  ctaButton: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ctaButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
});
