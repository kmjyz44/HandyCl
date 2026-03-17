import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../utils/api';

const { width } = Dimensions.get('window');
const DAYS = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота', 'Неділя'];
const DAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

interface ExecutorProfile {
  profile_id: string;
  user_id: string;
  bio?: string;
  skills: string[];
  experience_years?: number;
  hourly_rate?: number;
  portfolio_photos: string[];
  certifications: string[];
  languages: string[];
  availability?: string;
  user?: {
    name: string;
    email: string;
    phone?: string;
    picture?: string;
  };
  average_rating: number;
  total_reviews: number;
}

interface AvailabilitySlot {
  slot_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location?: string;
  is_active: boolean;
}

interface Review {
  review_id: string;
  rating: number;
  comment?: string;
  created_at: string;
}

export default function ExecutorProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<ExecutorProfile | null>(null);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [pricing, setPricing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    loadExecutorData();
  }, [id]);

  const loadExecutorData = async () => {
    try {
      // Load profile
      const profileData = await api.getExecutorProfile(id);
      setProfile(profileData);

      // Load availability
      const availabilityData = await api.getExecutorAvailability(id);
      setAvailability(availabilityData.slots || []);

      // Load reviews
      const reviewsData = await api.getProviderReviews(id);
      setReviews(reviewsData.reviews || []);

      // Load pricing
      try {
        const pricingData = await api.getExecutorPricing(id);
        setPricing(pricingData);
      } catch (e) {
        // Pricing might not be set
      }
    } catch (error: any) {
      Alert.alert('Помилка', 'Не вдалося завантажити профіль виконавця');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number, size: number = 16) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : i - 0.5 <= rating ? 'star-half' : 'star-outline'}
          size={size}
          color="#f59e0b"
        />
      );
    }
    return stars;
  };

  const contactExecutor = () => {
    // Navigate to messages or create booking
    Alert.alert(
      'Зв\'язатися з виконавцем',
      'Оберіть опцію:',
      [
        { text: 'Написати повідомлення', onPress: () => router.push(`/(tabs)/messages?userId=${id}`) },
        { text: 'Скасувати', style: 'cancel' },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={64} color="#d1d5db" />
        <Text style={styles.errorText}>Профіль не знайдено</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Профіль виконавця</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            {profile.user?.picture ? (
              <Image source={{ uri: profile.user.picture }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={48} color="#fff" />
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{profile.user?.name}</Text>
              <View style={styles.ratingContainer}>
                {renderStars(profile.average_rating, 20)}
                <Text style={styles.ratingText}>
                  {profile.average_rating.toFixed(1)} ({profile.total_reviews} відгуків)
                </Text>
              </View>
            </View>
          </View>

          {profile.bio && (
            <Text style={styles.bio}>{profile.bio}</Text>
          )}

          {/* Stats */}
          <View style={styles.statsContainer}>
            {profile.experience_years && (
              <View style={styles.statItem}>
                <Ionicons name="briefcase-outline" size={24} color="#2563eb" />
                <Text style={styles.statValue}>{profile.experience_years}</Text>
                <Text style={styles.statLabel}>років досвіду</Text>
              </View>
            )}
            <View style={styles.statItem}>
              <Ionicons name="star-outline" size={24} color="#f59e0b" />
              <Text style={styles.statValue}>{profile.total_reviews}</Text>
              <Text style={styles.statLabel}>відгуків</Text>
            </View>
            {pricing?.final_rate && (
              <View style={styles.statItem}>
                <Ionicons name="cash-outline" size={24} color="#10b981" />
                <Text style={styles.statValue}>${pricing.final_rate}</Text>
                <Text style={styles.statLabel}>за годину</Text>
              </View>
            )}
          </View>
        </View>

        {/* Skills */}
        {profile.skills && profile.skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Навички</Text>
            <View style={styles.skillsContainer}>
              {profile.skills.map((skill, index) => (
                <View key={index} style={styles.skillBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                  <Text style={styles.skillText}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Languages */}
        {profile.languages && profile.languages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Мови</Text>
            <View style={styles.languagesContainer}>
              {profile.languages.map((lang, index) => (
                <View key={index} style={styles.languageBadge}>
                  <Ionicons name="globe-outline" size={16} color="#6366f1" />
                  <Text style={styles.languageText}>{lang}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Certifications */}
        {profile.certifications && profile.certifications.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Сертифікати</Text>
            {profile.certifications.map((cert, index) => (
              <View key={index} style={styles.certItem}>
                <Ionicons name="ribbon-outline" size={20} color="#2563eb" />
                <Text style={styles.certText}>{cert}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Availability Calendar */}
        {availability.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Графік роботи</Text>
            <View style={styles.calendarContainer}>
              {DAYS.map((day, index) => {
                const daySlots = availability.filter(
                  slot => slot.day_of_week === index && slot.is_active
                );
                return (
                  <View key={index} style={styles.dayRow}>
                    <Text style={styles.dayName}>{DAYS_SHORT[index]}</Text>
                    <View style={styles.timeSlots}>
                      {daySlots.length > 0 ? (
                        daySlots.map((slot, slotIndex) => (
                          <View key={slotIndex} style={styles.timeSlot}>
                            <Text style={styles.timeText}>
                              {slot.start_time} - {slot.end_time}
                            </Text>
                            {slot.location && (
                              <Text style={styles.locationText}>{slot.location}</Text>
                            )}
                          </View>
                        ))
                      ) : (
                        <Text style={styles.notAvailable}>Вихідний</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Portfolio */}
        {profile.portfolio_photos && profile.portfolio_photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Портфоліо</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.portfolioScroll}>
              {profile.portfolio_photos.map((photo, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => setSelectedImage(photo)}
                >
                  <Image source={{ uri: photo }} style={styles.portfolioImage} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Відгуки</Text>
            {reviews.slice(0, 5).map((review) => (
              <View key={review.review_id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewRating}>
                    {renderStars(review.rating, 14)}
                  </View>
                  <Text style={styles.reviewDate}>
                    {new Date(review.created_at).toLocaleDateString('uk-UA')}
                  </Text>
                </View>
                {review.comment && (
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                )}
              </View>
            ))}
            {reviews.length > 5 && (
              <TouchableOpacity style={styles.moreReviewsButton}>
                <Text style={styles.moreReviewsText}>
                  Показати всі відгуки ({reviews.length})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Pricing Info */}
        {pricing && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ціни</Text>
            <View style={styles.pricingCard}>
              <View style={styles.pricingRow}>
                <Text style={styles.pricingLabel}>Базова ставка:</Text>
                <Text style={styles.pricingValue}>${pricing.base_rate}/год</Text>
              </View>
              {pricing.commission_applied && (
                <View style={styles.pricingRow}>
                  <Text style={styles.pricingLabel}>Комісія сервісу:</Text>
                  <Text style={styles.pricingValue}>{pricing.commission_percentage}%</Text>
                </View>
              )}
              <View style={[styles.pricingRow, styles.totalRow]}>
                <Text style={styles.pricingLabel}>Фінальна ціна:</Text>
                <Text style={styles.finalPrice}>${pricing.final_rate}/год</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Contact Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.contactButton} onPress={contactExecutor}>
          <Ionicons name="chatbubble-outline" size={20} color="#fff" />
          <Text style={styles.contactButtonText}>Зв'язатися</Text>
        </TouchableOpacity>
      </View>

      {/* Image Modal */}
      <Modal visible={!!selectedImage} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setSelectedImage(null)}
          >
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
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
  errorText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  content: {
    flex: 1,
  },
  profileCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
  },
  bio: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 22,
    marginTop: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  skillText: {
    fontSize: 14,
    color: '#166534',
  },
  languagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  languageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  languageText: {
    fontSize: 14,
    color: '#4338ca',
  },
  certItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  certText: {
    fontSize: 14,
    color: '#374151',
  },
  calendarContainer: {
    gap: 4,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dayName: {
    width: 40,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  timeSlots: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeSlot: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  timeText: {
    fontSize: 13,
    color: '#065f46',
    fontWeight: '500',
  },
  locationText: {
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
  },
  notAvailable: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  portfolioScroll: {
    marginHorizontal: -4,
  },
  portfolioImage: {
    width: 160,
    height: 120,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  reviewCard: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewRating: {
    flexDirection: 'row',
  },
  reviewDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  reviewComment: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  moreReviewsButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  moreReviewsText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
  },
  pricingCard: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  pricingLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  pricingValue: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 8,
    paddingTop: 16,
  },
  finalPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  contactButton: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  contactButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1,
  },
  fullImage: {
    width: width - 32,
    height: width - 32,
    borderRadius: 8,
  },
});
