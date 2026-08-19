import React, { useEffect, useState, useCallback } from 'react';
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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../utils/api';

interface Executor {
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  picture?: string;
  profile?: {
    bio?: string;
    skills: (string | { name: string; photos?: { uri: string; caption: string }[] })[];
    experience_years?: number;
    hourly_rate?: number;
    portfolio_photos: string[];
  };
  availability?: any[];
  average_rating: number;
  total_reviews: number;
  identity_verified?: boolean;
  pricing?: {
    hourly_rate: number;
    original_rate: number;
  };
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Executors() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
  const [executors, setExecutors] = useState<Executor[]>([]);
  const [favorites, setFavorites] = useState<Executor[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [minRating, setMinRating] = useState<number | null>(null);

  const loadFavorites = useCallback(async () => {
    try {
      const favs = await api.getFavoriteExecutors();
      const list: Executor[] = Array.isArray(favs) ? favs : [];
      setFavorites(list);
      setFavoriteIds(new Set(list.map((f: any) => f.user_id || f.id)));
    } catch {
      // ignore
    }
  }, []);

  const loadExecutors = useCallback(async () => {
    try {
      let params: any = {};
      if (selectedDay !== null) params.day_of_week = selectedDay;
      if (minRating !== null) params.min_rating = minRating;
      const response = await api.getAvailableExecutors(params);
      const list: Executor[] = response?.executors || response || [];
      setExecutors(Array.isArray(list) ? list : []);
    } catch {
      try {
        const data = await api.getAllExecutors();
        setExecutors(Array.isArray(data) ? data : []);
      } catch {
        if (Platform.OS !== 'web') {
          Alert.alert('Error', 'Could not load the list of pros');
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDay, minRating]);

  useEffect(() => {
    loadExecutors();
    loadFavorites();
  }, [loadExecutors, loadFavorites]);

  const onRefresh = () => {
    setRefreshing(true);
    loadExecutors();
    loadFavorites();
  };

  const toggleFavorite = async (executor: Executor) => {
    const id = executor.user_id;
    const isFav = favoriteIds.has(id);
    const newIds = new Set(favoriteIds);
    if (isFav) {
      newIds.delete(id);
      setFavoriteIds(newIds);
      setFavorites(prev => prev.filter(f => f.user_id !== id));
      await api.removeFavoriteExecutor(id);
    } else {
      newIds.add(id);
      setFavoriteIds(newIds);
      setFavorites(prev => [...prev, executor]);
      await api.addFavoriteExecutor(executor);
    }
  };

  const applySearch = (list: Executor[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(e =>
      e.name?.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q) ||
      e.profile?.skills?.some(s => s.toLowerCase().includes(q)) ||
      e.profile?.bio?.toLowerCase().includes(q)
    );
  };

  const displayList = applySearch(activeTab === 'favorites' ? favorites : executors);

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
        <Text style={styles.headerTitle}>Pros</Text>
        <Text style={styles.headerSubtitle}>Find the best specialist</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          onPress={() => setActiveTab('all')}
        >
          <Ionicons name="people-outline" size={16} color={activeTab === 'all' ? '#2563eb' : '#6b7280'} />
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'favorites' && styles.tabActive]}
          onPress={() => setActiveTab('favorites')}
        >
          <Ionicons name="heart" size={16} color={activeTab === 'favorites' ? '#ef4444' : '#6b7280'} />
          <Text style={[styles.tabText, activeTab === 'favorites' && styles.tabTextActive]}>
            {`Favorites${favorites.length > 0 ? ' (' + favorites.length + ')' : ''}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#6b7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or skill..."
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#6b7280" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filters - compact single row */}
      {activeTab === 'all' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={styles.filterRowContent}
        >
          {/* Day chips */}
          <TouchableOpacity
            style={[styles.chip, selectedDay === null && styles.chipActive]}
            onPress={() => setSelectedDay(null)}
          >
            <Text style={[styles.chipText, selectedDay === null && styles.chipTextActive]}>📅 All days</Text>
          </TouchableOpacity>
          {DAYS.map((day, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.chip, selectedDay === index && styles.chipActive]}
              onPress={() => setSelectedDay(selectedDay === index ? null : index)}
            >
              <Text style={[styles.chipText, selectedDay === index && styles.chipTextActive]}>{day}</Text>
            </TouchableOpacity>
          ))}
          {/* Divider */}
          <View style={styles.chipDivider} />
          {/* Rating chips */}
          <TouchableOpacity
            style={[styles.chip, minRating === null && styles.chipActive]}
            onPress={() => setMinRating(null)}
          >
            <Text style={[styles.chipText, minRating === null && styles.chipTextActive]}>⭐ Any</Text>
          </TouchableOpacity>
          {[3, 4, 4.5].map((rating) => (
            <TouchableOpacity
              key={rating}
              style={[styles.chip, minRating === rating && styles.chipActive]}
              onPress={() => setMinRating(minRating === rating ? null : rating)}
            >
              <Text style={[styles.chipText, minRating === rating && styles.chipTextActive]}>★ {rating}+</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* List */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {displayList.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name={activeTab === 'favorites' ? 'heart-outline' : 'people-outline'}
              size={64}
              color="#d1d5db"
            />
            <Text style={styles.emptyText}>
              {activeTab === 'favorites' ? 'No favorite pros' : 'No pros found'}
            </Text>
            <Text style={styles.emptySubtext}>
              {activeTab === 'favorites'
                ? 'Tap the heart on a pro card to add to favorites'
                : 'Try changing the filters'}
            </Text>
          </View>
        ) : (
          displayList.map((executor) => (
            <TouchableOpacity
              key={executor.user_id}
              style={styles.executorCard}
              onPress={() => router.push(`/executor/${executor.user_id}` as any)}
            >
              <View style={styles.cardHeader}>
                <TouchableOpacity
                  style={styles.avatarContainer}
                  onPress={() => router.push(`/executor/${executor.user_id}` as any)}
                  activeOpacity={0.8}
                >
                  {executor.picture ? (
                    <Image source={{ uri: executor.picture }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Ionicons name="person" size={32} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
                <View style={styles.executorInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.executorName}>{executor.name}</Text>
                    {executor.identity_verified && (
                      <View style={styles.verifiedBadge} data-testid={`verified-badge-${executor.user_id}`}>
                        <Ionicons name="shield-checkmark" size={12} color="#059669" />
                        <Text style={styles.verifiedBadgeText}>ID Verified</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.ratingContainer}>
                    {renderStars(executor.average_rating || 0)}
                    <Text style={styles.ratingText}>
                      {(executor.average_rating || 0).toFixed(1)} ({executor.total_reviews || 0} reviews)
                    </Text>
                  </View>
                  {executor.profile?.experience_years ? (
                    <Text style={styles.experience}>{executor.profile.experience_years} years of experience</Text>
                  ) : null}
                </View>
                <View style={styles.cardActions}>
                  {executor.pricing?.hourly_rate ? (
                    <View style={styles.priceContainer}>
                      <Text style={styles.priceLabel}>from</Text>
                      <Text style={styles.price}>${Math.round(executor.pricing.hourly_rate * 1.15)}</Text>
                      <Text style={styles.priceUnit}>/hr</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    style={styles.heartButton}
                    onPress={(e) => { e.stopPropagation?.(); toggleFavorite(executor); }}
                  >
                    <Ionicons
                      name={favoriteIds.has(executor.user_id) ? 'heart' : 'heart-outline'}
                      size={24}
                      color={favoriteIds.has(executor.user_id) ? '#ef4444' : '#9ca3af'}
                    />
                  </TouchableOpacity>
                </View>
              </View>
              {executor.profile?.bio ? (
                <Text style={styles.bio} numberOfLines={2}>{executor.profile.bio}</Text>
              ) : null}
              {executor.profile?.skills && executor.profile.skills.length > 0 ? (
                <View style={styles.skillsContainer}>
                  {executor.profile.skills.slice(0, 4).map((skill: any, index: number) => (
                    <View key={index} style={styles.skillBadge}>
                      <Text style={styles.skillText}>{typeof skill === 'string' ? skill : (skill?.name || '')}</Text>
                    </View>
                  ))}
                  {executor.profile.skills.length > 4 ? (
                    <View style={styles.skillBadge}>
                      <Text style={styles.skillText}>+{executor.profile.skills.length - 4}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              {executor.availability && executor.availability.length > 0 ? (
                <View style={styles.availabilityContainer}>
                  <Ionicons name="calendar-outline" size={14} color="#10b981" />
                  <Text style={styles.availabilityText}>
                    Available: {executor.availability.map((slot: any) => DAYS[slot.day_of_week]).join(', ')}
                  </Text>
                </View>
              ) : null}
              <View style={styles.cardFooter}>
                <TouchableOpacity
                  style={styles.viewProfileButton}
                  onPress={() => router.push(`/executor/${executor.user_id}` as any)}
                >
                  <Text style={styles.viewProfileText}>View profile</Text>
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
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#fff', padding: 24, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#111827' },
  headerSubtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  tabsRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingHorizontal: 16 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 6, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#2563eb' },
  tabText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  tabTextActive: { color: '#2563eb', fontWeight: '600' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 16, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  searchInput: { flex: 1, height: 48, fontSize: 16, color: '#111827', marginLeft: 12 },
  filterRow: { flexGrow: 0, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  filterRowContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  chipDivider: { width: 1, height: 20, backgroundColor: '#e5e7eb', marginHorizontal: 4 },
  content: { flex: 1, paddingTop: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 64 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#374151', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#6b7280', marginTop: 4, textAlign: 'center', paddingHorizontal: 32 },
  executorCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  avatarContainer: { marginRight: 12 },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholder: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' },
  executorInfo: { flex: 1 },
  executorName: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 },
  verifiedBadgeText: { fontSize: 11, color: '#059669', fontWeight: '700' },
  ratingContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  ratingText: { fontSize: 12, color: '#6b7280', marginLeft: 6 },
  experience: { fontSize: 12, color: '#6b7280' },
  cardActions: { alignItems: 'flex-end', gap: 8 },
  priceContainer: { alignItems: 'flex-end' },
  priceLabel: { fontSize: 10, color: '#6b7280' },
  price: { fontSize: 20, fontWeight: 'bold', color: '#10b981' },
  priceUnit: { fontSize: 12, color: '#6b7280' },
  heartButton: { padding: 4 },
  bio: { fontSize: 14, color: '#4b5563', marginTop: 12, lineHeight: 20 },
  skillsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 8 },
  workPhotosRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  workPhotoThumb: { flex: 1, height: 88, borderRadius: 10, backgroundColor: '#e5e7eb' },
  skillBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  skillText: { fontSize: 12, color: '#2563eb', fontWeight: '500' },
  availabilityContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 6 },
  availabilityText: { fontSize: 12, color: '#10b981' },
  cardFooter: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  viewProfileButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  viewProfileText: { fontSize: 14, fontWeight: '600', color: '#2563eb' },
});
