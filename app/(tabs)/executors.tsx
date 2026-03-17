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
  Image,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';

interface Executor {
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  picture?: string;
  profile?: {
    bio?: string;
    skills: string[];
    experience_years?: number;
    hourly_rate?: number;
    portfolio_photos: string[];
  };
  availability?: any[];
  average_rating: number;
  total_reviews: number;
  pricing?: {
    hourly_rate: number;
    original_rate: number;
  };
}

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

export default function Executors() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [executors, setExecutors] = useState<Executor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [minRating, setMinRating] = useState<number | null>(null);

  const loadExecutors = async () => {
    try {
      let params: any = {};
      if (selectedDay !== null) {
        params.day_of_week = selectedDay;
      }
      if (minRating !== null) {
        params.min_rating = minRating;
      }
      
      const response = await api.getAvailableExecutors(params);
      setExecutors(response.executors || []);
    } catch (error: any) {
      console.error('Failed to load executors:', error);
      // Fallback to regular executors list
      try {
        const data = await api.getAllExecutors();
        setExecutors(data || []);
      } catch (e) {
        Alert.alert('Помилка', 'Не вдалося завантажити список виконавців');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadExecutors();
  }, [selectedDay, minRating]);

  const onRefresh = () => {
    setRefreshing(true);
    loadExecutors();
  };

  const filteredExecutors = executors.filter(executor => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      executor.name?.toLowerCase().includes(query) ||
      executor.profile?.skills?.some(skill => skill.toLowerCase().includes(query)) ||
      executor.profile?.bio?.toLowerCase().includes(query)
    );
  });

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : i - 0.5 <= rating ? 'star-half' : 'star-outline'}
          size={16}
          color="#f59e0b"
        />
      );
    }
    return stars;
  };

  const viewExecutorProfile = (executorId: string) => {
    router.push(`/executor/${executorId}`);
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
        <Text style={styles.headerTitle}>Виконавці</Text>
        <Text style={styles.headerSubtitle}>Знайдіть найкращого спеціаліста</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#6b7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Пошук за ім'ям або навичками..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#9ca3af"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#6b7280" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Day Filter */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Доступність по днях:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysScroll}>
          <TouchableOpacity
            style={[styles.dayChip, selectedDay === null && styles.dayChipActive]}
            onPress={() => setSelectedDay(null)}
          >
            <Text style={[styles.dayChipText, selectedDay === null && styles.dayChipTextActive]}>
              Всі
            </Text>
          </TouchableOpacity>
          {DAYS.map((day, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.dayChip, selectedDay === index && styles.dayChipActive]}
              onPress={() => setSelectedDay(index)}
            >
              <Text style={[styles.dayChipText, selectedDay === index && styles.dayChipTextActive]}>
                {day}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Rating Filter */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Мінімальний рейтинг:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ratingScroll}>
          <TouchableOpacity
            style={[styles.ratingChip, minRating === null && styles.ratingChipActive]}
            onPress={() => setMinRating(null)}
          >
            <Text style={[styles.ratingChipText, minRating === null && styles.ratingChipTextActive]}>
              Всі
            </Text>
          </TouchableOpacity>
          {[3, 4, 4.5].map((rating) => (
            <TouchableOpacity
              key={rating}
              style={[styles.ratingChip, minRating === rating && styles.ratingChipActive]}
              onPress={() => setMinRating(rating)}
            >
              <Ionicons
                name="star"
                size={14}
                color={minRating === rating ? '#fff' : '#f59e0b'}
              />
              <Text style={[styles.ratingChipText, minRating === rating && styles.ratingChipTextActive]}>
                {rating}+
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filteredExecutors.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>Виконавців не знайдено</Text>
            <Text style={styles.emptySubtext}>Спробуйте змінити фільтри</Text>
          </View>
        ) : (
          filteredExecutors.map((executor) => (
            <TouchableOpacity
              key={executor.user_id}
              style={styles.executorCard}
              onPress={() => viewExecutorProfile(executor.user_id)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.avatarContainer}>
                  {executor.picture ? (
                    <Image source={{ uri: executor.picture }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Ionicons name="person" size={32} color="#fff" />
                    </View>
                  )}
                </View>
                <View style={styles.executorInfo}>
                  <Text style={styles.executorName}>{executor.name}</Text>
                  <View style={styles.ratingContainer}>
                    {renderStars(executor.average_rating)}
                    <Text style={styles.ratingText}>
                      {executor.average_rating.toFixed(1)} ({executor.total_reviews} відгуків)
                    </Text>
                  </View>
                  {executor.profile?.experience_years && (
                    <Text style={styles.experience}>
                      {executor.profile.experience_years} років досвіду
                    </Text>
                  )}
                </View>
                {executor.pricing?.hourly_rate && (
                  <View style={styles.priceContainer}>
                    <Text style={styles.priceLabel}>від</Text>
                    <Text style={styles.price}>${executor.pricing.hourly_rate}</Text>
                    <Text style={styles.priceUnit}>/год</Text>
                  </View>
                )}
              </View>

              {executor.profile?.bio && (
                <Text style={styles.bio} numberOfLines={2}>
                  {executor.profile.bio}
                </Text>
              )}

              {executor.profile?.skills && executor.profile.skills.length > 0 && (
                <View style={styles.skillsContainer}>
                  {executor.profile.skills.slice(0, 4).map((skill, index) => (
                    <View key={index} style={styles.skillBadge}>
                      <Text style={styles.skillText}>{skill}</Text>
                    </View>
                  ))}
                  {executor.profile.skills.length > 4 && (
                    <View style={styles.skillBadge}>
                      <Text style={styles.skillText}>+{executor.profile.skills.length - 4}</Text>
                    </View>
                  )}
                </View>
              )}

              {executor.availability && executor.availability.length > 0 && (
                <View style={styles.availabilityContainer}>
                  <Ionicons name="calendar-outline" size={14} color="#10b981" />
                  <Text style={styles.availabilityText}>
                    Доступний: {executor.availability.map(slot => DAYS[slot.day_of_week]).join(', ')}
                  </Text>
                </View>
              )}

              <View style={styles.cardFooter}>
                <TouchableOpacity
                  style={styles.viewProfileButton}
                  onPress={() => viewExecutorProfile(executor.user_id)}
                >
                  <Text style={styles.viewProfileText}>Переглянути профіль</Text>
                  <Ionicons name="chevron-forward" size={18} color="#2563eb" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#111827',
    marginLeft: 12,
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  daysScroll: {
    flexGrow: 0,
  },
  ratingScroll: {
    flexGrow: 0,
  },
  dayChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
  },
  dayChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  dayChipText: {
    fontSize: 14,
    color: '#374151',
  },
  dayChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
    gap: 4,
  },
  ratingChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  ratingChipText: {
    fontSize: 14,
    color: '#374151',
  },
  ratingChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingTop: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  executorCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  executorInfo: {
    flex: 1,
  },
  executorName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 6,
  },
  experience: {
    fontSize: 12,
    color: '#6b7280',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 10,
    color: '#6b7280',
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10b981',
  },
  priceUnit: {
    fontSize: 12,
    color: '#6b7280',
  },
  bio: {
    fontSize: 14,
    color: '#4b5563',
    marginTop: 12,
    lineHeight: 20,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  skillBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  skillText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '500',
  },
  availabilityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  availabilityText: {
    fontSize: 12,
    color: '#10b981',
  },
  cardFooter: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  viewProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewProfileText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
});
