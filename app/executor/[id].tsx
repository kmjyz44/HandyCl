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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../utils/api';

const { width } = Dimensions.get('window');
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface ExecutorProfile {
  profile_id: string;
  user_id: string;
  bio?: string;
  skills: (string | { name: string; experience?: string; hourly_rate?: number; photos?: { uri: string; caption: string }[] })[];
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
    identity_verified?: boolean;
  };
  average_rating: number;
  total_reviews: number;
  latitude?: number;
  longitude?: number;
  service_radius_km?: number;
  service_cities?: string[];
  service_zones?: string[];
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
  const { id, preview } = useLocalSearchParams<{ id: string; preview?: string }>();
  const router = useRouter();
  const isPreview = preview === '1';
  const [profile, setProfile] = useState<ExecutorProfile | null>(null);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [pricing, setPricing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [expandedSkill, setExpandedSkill] = useState<number | null>(null);
  const [showAllReviews, setShowAllReviews] = useState(false);

  useEffect(() => {
    loadExecutorData();
  }, [id]);

  const loadExecutorData = async () => {
    try {
      const profileData = await api.getExecutorProfile(id);
      setProfile(profileData);
      // The profile payload already carries availability slots
      setAvailability(profileData?.availability || []);
    } catch (error: any) {
      setLoading(false);
      return; // render shows "Profile not found"
    }
    // Secondary data — never block the page if these fail
    try {
      const reviewsData = await api.getProviderReviews(id);
      setReviews(reviewsData.reviews || []);
    } catch {}
    try {
      const pricingData = await api.getExecutorPricing(id);
      setPricing(pricingData);
    } catch {}
    setLoading(false);
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

  const bookExecutor = () => {
    const name = profile?.user?.name || 'Pro';
    const rate = pricing?.final_rate || profile?.hourly_rate || '';
    const picture = profile?.user?.picture || '';
    const minHours = profile?.minimum_hours || 1;
    // Executor day_of_week is Monday-indexed (0=Mon..6=Sun); convert to JS getDay (0=Sun..6=Sat)
    const days = Array.from(new Set(
      (availability || []).filter(s => s.is_active).map(s => (s.day_of_week + 1) % 7)
    )).join(',');
    router.push(`/(tabs)?bookProvider=${encodeURIComponent(id)}&providerName=${encodeURIComponent(name)}&providerRate=${encodeURIComponent(String(rate))}&providerPicture=${encodeURIComponent(picture)}&providerDays=${encodeURIComponent(days)}&providerMinHours=${encodeURIComponent(String(minHours))}` as any);
  };

  const contactExecutor = () => {
    // Navigate to messages or create booking
    Alert.alert(
      'Contact the pro',
      'Choose an option:',
      [
        { text: 'Send a message', onPress: () => router.push(`/(tabs)/messages?userId=${id}`) },
        { text: 'Cancel', style: 'cancel' },
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
        <Text style={styles.errorText}>Profile not found</Text>
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
        <Text style={styles.headerTitle}>Pro profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {isPreview && (
          <View style={styles.previewBanner} data-testid="preview-banner">
            <Ionicons name="eye-outline" size={16} color="#1d4ed8" />
            <Text style={styles.previewBannerText}>Preview — this is how clients see your profile</Text>
          </View>
        )}
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
              <View style={styles.nameRowDetail}>
                <Text style={styles.name}>{profile.user?.name}</Text>
                {profile.user?.identity_verified && (
                  <View style={styles.verifiedBadgeDetail} data-testid="verified-badge-detail">
                    <Ionicons name="shield-checkmark" size={13} color="#059669" />
                    <Text style={styles.verifiedBadgeDetailText}>ID Verified</Text>
                  </View>
                )}
              </View>
              <View style={styles.ratingContainer}>
                {renderStars(profile.average_rating, 20)}
                <Text style={styles.ratingText}>
                  {profile.average_rating.toFixed(1)} ({profile.total_reviews} reviews)
                </Text>
              </View>
            </View>
          </View>

          {profile.bio ? (
            <>
              <Text style={styles.aboutLabel}>About</Text>
              <Text style={styles.bio}>{profile.bio}</Text>
            </>
          ) : null}

          {/* Stats */}
          <View style={styles.statsContainer}>
            {profile.experience_years && (
              <View style={styles.statItem}>
                <Ionicons name="briefcase-outline" size={24} color="#2563eb" />
                <Text style={styles.statValue}>{profile.experience_years}</Text>
                <Text style={styles.statLabel}>years of experience</Text>
              </View>
            )}
            <View style={styles.statItem}>
              <Ionicons name="star-outline" size={24} color="#f59e0b" />
              <Text style={styles.statValue}>{profile.total_reviews}</Text>
              <Text style={styles.statLabel}>reviews</Text>
            </View>
            {pricing?.final_rate && (
              <View style={styles.statItem}>
                <Ionicons name="cash-outline" size={24} color="#10b981" />
                <Text style={styles.statValue}>${pricing.final_rate}</Text>
                <Text style={styles.statLabel}>per hour</Text>
              </View>
            )}
          </View>
        </View>

        {/* Portfolio gallery — aggregated work photos across all services */}
        {profile.skills && profile.skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Services</Text>
            <Text style={styles.servicesHint}>Tap a service to see the pro's experience and photos of completed work.</Text>
            {profile.skills.map((raw, index) => {
              const skill: any = typeof raw === 'string' ? { name: raw } : (raw || {});
              const photos = (Array.isArray(skill.photos) ? skill.photos : []).filter((p: any) => p && p.uri);
              const isOpen = expandedSkill === index;
              return (
                <View key={index} style={styles.skillCard} data-testid={`executor-skill-${index}`}>
                  <TouchableOpacity
                    style={styles.skillCardHeader}
                    activeOpacity={0.7}
                    onPress={() => setExpandedSkill(isOpen ? null : index)}
                    data-testid={`executor-skill-toggle-${index}`}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                    <Text style={styles.skillCardTitle}>{skill.name}</Text>
                    {skill.hourly_rate ? <Text style={styles.skillCardRate}>${skill.hourly_rate}/hr</Text> : null}
                    <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#9ca3af" style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                  {isOpen ? (
                    <View style={styles.skillExpanded}>
                      {skill.experience ? (
                        <Text style={styles.skillCardExp}>{skill.experience}</Text>
                      ) : (
                        <Text style={styles.skillEmptyText}>No description added yet for this service.</Text>
                      )}
                      {photos.length > 0 ? (
                        <View style={styles.portfolioGrid}>
                          {photos.map((ph: any, i: number) => (
                            <TouchableOpacity
                              key={i}
                              style={styles.portfolioItem}
                              activeOpacity={0.9}
                              onPress={() => setSelectedImage(ph.uri)}
                              data-testid={`skill-${index}-photo-${i}`}
                            >
                              <Image source={{ uri: ph.uri }} style={styles.portfolioImg} resizeMode="cover" />
                              {ph.caption ? (
                                <View style={styles.portfolioCaptionWrap}>
                                  <Text style={styles.portfolioCaption} numberOfLines={2}>{ph.caption}</Text>
                                </View>
                              ) : null}
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.skillEmptyText}>No work photos yet.</Text>
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        {/* Languages */}
        {profile.languages && profile.languages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Languages</Text>
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
            <Text style={styles.sectionTitle}>Certifications</Text>
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
            <Text style={styles.sectionTitle}>Work schedule</Text>
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
                        <Text style={styles.notAvailable}>Day off</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Service Area Map */}
        {(profile.latitude && profile.longitude) || profile.service_radius_km || (profile.service_cities && profile.service_cities.length > 0) || (profile.service_zones && profile.service_zones.length > 0) ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service area</Text>
            {profile.service_radius_km ? (
              <Text style={styles.coverageSubtitle}>
                The pro works within a {profile.service_radius_km} mi radius
              </Text>
            ) : null}
            {profile.latitude && profile.longitude && profile.service_radius_km ? (
              Platform.OS === 'web' ? (
                <View style={styles.mapContainer}>
                  <iframe
                    title="coverage-map"
                    src={`/coverage-map.html?lat=${profile.latitude}&lng=${profile.longitude}&radius=${profile.service_radius_km}&name=${encodeURIComponent(profile.user?.name || '')}`}
                    style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12 } as any}
                  />
                </View>
              ) : (
                <View style={styles.mapPlaceholder}>
                  <Ionicons name="map-outline" size={40} color="#2563eb" />
                  <Text style={styles.mapPlaceholderText}>
                    Service area: {profile.service_radius_km} mi
                  </Text>
                </View>
              )
            ) : (
              <View style={styles.mapPlaceholder}>
                <Ionicons name="map-outline" size={40} color="#2563eb" />
                <Text style={styles.mapPlaceholderText}>Service area</Text>
                <Text style={styles.mapPlaceholderSub}>The pro hasn't provided coordinates</Text>
              </View>
            )}
            {((profile.service_cities && profile.service_cities.length > 0) || (profile.service_zones && profile.service_zones.length > 0)) && (
              <View style={styles.citiesRow}>
                {[...(profile.service_cities || []), ...(profile.service_zones || [])].map((city, i) => (
                  <View key={i} style={styles.cityChip}>
                    <Ionicons name="location-outline" size={12} color="#2563eb" />
                    <Text style={styles.cityChipText}>{city}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}

        {/* Reviews */}
        {reviews.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reviews</Text>
            {reviews.slice(0, showAllReviews ? reviews.length : 5).map((review) => (
              <View key={review.review_id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewRating}>
                    {renderStars(review.rating, 14)}
                  </View>
                  <Text style={styles.reviewDate}>
                    {new Date(review.created_at).toLocaleDateString('en-US')}
                  </Text>
                </View>
                {review.comment && (
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                )}
              </View>
            ))}
            {reviews.length > 5 && (
              <TouchableOpacity style={styles.moreReviewsButton} onPress={() => setShowAllReviews(v => !v)} data-testid="toggle-reviews-btn">
                <Text style={styles.moreReviewsText}>
                  {showAllReviews ? 'Show fewer reviews' : `Show all reviews (${reviews.length})`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Pricing Info */}
        {pricing && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pricing</Text>
            <View style={styles.pricingCard}>
              <View style={styles.pricingRow}>
                <Text style={styles.pricingLabel}>Base rate:</Text>
                <Text style={styles.pricingValue}>${pricing.base_rate}/hr</Text>
              </View>
              {pricing.commission_applied && (
                <View style={styles.pricingRow}>
                  <Text style={styles.pricingLabel}>Service fee:</Text>
                  <Text style={styles.pricingValue}>{pricing.commission_percentage}%</Text>
                </View>
              )}
              <View style={[styles.pricingRow, styles.totalRow]}>
                <Text style={styles.pricingLabel}>Final price:</Text>
                <Text style={styles.finalPrice}>${pricing.final_rate}/hr</Text>
              </View>
              <View style={styles.minChargeBox}>
                <Ionicons name="time-outline" size={16} color="#b45309" />
                <Text style={styles.minChargeText}>
                  Minimum charge: {(profile.minimum_hours || 1)} hour{(profile.minimum_hours || 1) > 1 ? 's' : ''}
                  {pricing.final_rate ? ` (≈ $${(pricing.final_rate * (profile.minimum_hours || 1)).toFixed(2)})` : ''}. Time beyond that is billed per minute.
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Book Button */}
      <View style={styles.footer}>
        {isPreview ? (
          <TouchableOpacity style={[styles.contactButton, { backgroundColor: '#111827' }]} onPress={() => router.back()} data-testid="preview-back-btn">
            <Ionicons name="arrow-back" size={20} color="#fff" />
            <Text style={styles.contactButtonText}>Back to my profile</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.contactButton} onPress={bookExecutor} data-testid="book-executor-btn">
            <Ionicons name="calendar-outline" size={20} color="#fff" />
            <Text style={styles.contactButtonText}>Book this pro</Text>
          </TouchableOpacity>
        )}
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
  previewBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe',
    borderRadius: 12, padding: 12, margin: 16, marginBottom: 0,
  },
  previewBannerText: { flex: 1, fontSize: 13, color: '#1d4ed8', fontWeight: '600' },
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
  nameRowDetail: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  verifiedBadgeDetail: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10, marginBottom: 8 },
  verifiedBadgeDetailText: { fontSize: 12, color: '#059669', fontWeight: '700' },
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
  skillCard: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#eef2f7' },
  skillCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  skillCardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' },
  skillCardRate: { fontSize: 13, fontWeight: '700', color: '#2563eb' },
  skillCardExp: { fontSize: 13, color: '#4b5563', marginTop: 8, lineHeight: 19 },
  aboutLabel: { fontSize: 12, fontWeight: '700', color: '#9ca3af', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 14 },
  servicesHint: { fontSize: 13, color: '#6b7280', marginBottom: 12, marginTop: -4 },
  skillExpanded: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#eef2f7' },
  skillEmptyText: { fontSize: 13, color: '#9ca3af', fontStyle: 'italic', marginTop: 8 },
  skillCardPhoto: { width: 140, height: 105, borderRadius: 8, backgroundColor: '#e5e7eb' },
  skillCardCaption: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  portfolioHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  portfolioGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  portfolioItem: { width: '48.5%', marginBottom: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: '#f3f4f6' },
  portfolioImg: { width: '100%', aspectRatio: 1, backgroundColor: '#e5e7eb' },
  portfolioCaptionWrap: { paddingHorizontal: 10, paddingVertical: 8 },
  portfolioCaption: { fontSize: 12, color: '#4b5563' },
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
  minChargeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  minChargeText: {
    flex: 1,
    fontSize: 12,
    color: '#92400e',
    lineHeight: 17,
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
  coverageSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  mapContainer: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
    marginBottom: 12,
  },
  mapPlaceholder: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  mapPlaceholderText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e40af',
  },
  mapPlaceholderSub: {
    fontSize: 13,
    color: '#3b82f6',
  },
  citiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  cityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  cityChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e40af',
  },
});
