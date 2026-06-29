import React, { useEffect, useState, useCallback, useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Image, ActivityIndicator, Alert, Platform, Modal, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useBookingStore } from '../../store/bookingStore';
import { api } from '../../utils/api';
import PaymentReminderBanner from '../../components/PaymentReminderBanner';
import EmailVerificationBanner from '../../components/EmailVerificationBanner';
import AddressAutocomplete from '../../components/AddressAutocomplete';

// ─── SKILL CATEGORIES (same as provider profile) ─────────────────────────────

// High-quality direct Unsplash photo URLs (the legacy source.unsplash.com
// proxy was deprecated by Unsplash in 2024 — it now returns 503, which is
// why the home grid showed blank grey cards). These IDs are publicly hosted
// images that 200 from the images.unsplash.com CDN.
const FALLBACK_COVERS: Record<string, string> = {
  assembly:          'https://images.unsplash.com/photo-1503602642458-232111445657?w=800&q=80&auto=format&fit=crop',
  cleaning:          'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&q=80&auto=format&fit=crop',
  home_improvements: 'https://images.unsplash.com/photo-1572021335469-31706a17aaef?w=800&q=80&auto=format&fit=crop',
  moving:            'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80&auto=format&fit=crop',
  outdoor:           'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80&auto=format&fit=crop',
  personal:          'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800&q=80&auto=format&fit=crop',
  it_tech:           'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80&auto=format&fit=crop',
  events:            'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800&q=80&auto=format&fit=crop',
  other:             'https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=800&q=80&auto=format&fit=crop',
};

const SKILL_CATEGORIES = [
  {
    id: 'assembly', name: 'Furniture Assembly', icon: 'cube-outline' as const,
    color: '#2563eb', bg: '#eff6ff',
    skills: ['IKEA furniture assembly', 'Office furniture assembly', 'Bed assembly', 'Wardrobe assembly', 'Shelf mounting', 'TV mounting'],
  },
  {
    id: 'cleaning', name: 'Cleaning', icon: 'sparkles-outline' as const,
    color: '#0891b2', bg: '#ecfeff',
    skills: ['House cleaning', 'Deep cleaning', 'Office cleaning', 'Move-out cleaning', 'Window washing', 'Carpet cleaning'],
  },
  {
    id: 'home_improvements', name: 'Home Improvements', icon: 'hammer-outline' as const,
    color: '#7c3aed', bg: '#f5f3ff',
    skills: ['Appliance installation', 'Door & furniture repair', 'Painting', 'Tiling', 'Flooring', 'Drywall', 'Plumbing', 'Electrical'],
  },
  {
    id: 'moving', name: 'Moving & Delivery', icon: 'car-outline' as const,
    color: '#d97706', bg: '#fffbeb',
    skills: ['Moving help', 'Packing', 'Furniture moving', 'Delivery', 'Junk removal'],
  },
  {
    id: 'outdoor', name: 'Outdoor Work', icon: 'leaf-outline' as const,
    color: '#16a34a', bg: '#f0fdf4',
    skills: ['Lawn care', 'Snow removal', 'Gardening', 'Pressure washing', 'Fence installation'],
  },
  {
    id: 'personal', name: 'Personal Assistance', icon: 'person-outline' as const,
    color: '#db2777', bg: '#fdf2f8',
    skills: ['Errands', 'Shopping assistant', 'Pet care', 'Senior care'],
  },
  {
    id: 'it_tech', name: 'IT & Tech', icon: 'laptop-outline' as const,
    color: '#0f766e', bg: '#f0fdfa',
    skills: ['Computer setup', 'Smart TV setup', 'Phone repair', 'Network setup', 'Data recovery'],
  },
  {
    id: 'events', name: 'Events & Parties', icon: 'balloon-outline' as const,
    color: '#9333ea', bg: '#faf5ff',
    skills: ['Event setup', 'Photography', 'Kitchen help', 'Bartending'],
  },
  {
    id: 'other', name: 'Other', icon: 'ellipsis-horizontal-outline' as const,
    color: '#6b7280', bg: '#f9fafb',
    skills: ['Handyman', 'Tutoring', 'Translation', 'Driver'],
  },
];

// ─── BOOKING FLOW STEPS ───────────────────────────────────────────────────────
type BookingStep = 'home' | 'skills' | 'details' | 'address' | 'datetime' | 'taskers' | 'tasker_profile' | 'confirm' | 'success' | 'photo_result';

interface BookingState {
  categoryId: string;
  categoryName: string;
  skillName: string;
  taskDescription: string;
  address: string;
  city: string;
  dates: string[];      // multiple selected dates
  date: string;         // primary date (first selected)
  timeFrom: string;     // start time
  timeTo: string;       // end time
  time: string;         // primary time (timeFrom)
  selectedTasker: any | null;
  photos: string[]; // base64 photos from client
  lat?: number;       // client latitude (for executor location filter)
  lng?: number;       // client longitude
}

const TIMES = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

function getDates() {
  const dates: { label: string; dayName: string; value: string }[] = [];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push({
      label: `${d.getDate()} ${months[d.getMonth()]}`,
      dayName: days[d.getDay()],
      value: d.toISOString().split('T')[0],
    });
  }
  return dates;
}

// ─── PROVIDER DASHBOARD ─────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  posted:                    { label: 'New',              color: '#2563eb', bg: '#eff6ff' },
  offering:                  { label: 'Offers',           color: '#7c3aed', bg: '#f5f3ff' },
  assigned:                  { label: 'Assigned',         color: '#d97706', bg: '#fffbeb' },
  hold_placed:               { label: 'Payment confirmed',color: '#059669', bg: '#ecfdf5' },
  on_the_way:                { label: 'On the way',       color: '#0891b2', bg: '#ecfeff' },
  started:                   { label: 'In progress',      color: '#ea580c', bg: '#fff7ed' },
  completed_pending_payment: { label: 'Awaiting payment', color: '#ca8a04', bg: '#fefce8' },
  paid:                      { label: 'Paid',             color: '#16a34a', bg: '#f0fdf4' },
  cancelled:                 { label: 'Cancelled',        color: '#dc2626', bg: '#fef2f2' },
};

function ProviderDashboard() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [tasks, setTasks] = useState<any[]>([]);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'available' | 'my'>('available');
  const [statFilter, setStatFilter] = useState<'available' | 'my' | 'done' | null>(null);
  // Sub-filter for 'My tasks' tab — group by stage
  const [myFilter, setMyFilter] = useState<'all' | 'assigned' | 'in_progress' | 'pending_pay' | 'paid'>('all');

  const load = async () => {
    try {
      const [avail, mine] = await Promise.all([api.getAvailableTasks(), api.getTasks()]);
      setTasks(Array.isArray(avail) ? avail : []);
      setMyTasks(Array.isArray(mine) ? mine : []);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  const matchesMyFilter = (task: any): boolean => {
    if (myFilter === 'all') return true;
    if (myFilter === 'assigned') return task.status === 'assigned' || task.status === 'accepted';
    if (myFilter === 'in_progress') return ['on_the_way', 'started', 'in_progress'].includes(task.status);
    if (myFilter === 'pending_pay') return task.status === 'completed_pending_payment';
    if (myFilter === 'paid') return task.status === 'paid' || task.status === 'completed';
    return true;
  };
  const myFiltered = myTasks.filter(matchesMyFilter);
  const displayed = activeTab === 'available' ? tasks : myFiltered;

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header */}
      <View style={{ paddingTop: 56, paddingHorizontal: 20, paddingBottom: 12, backgroundColor: '#fff' }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: '#111827' }}>
          Hi, {user?.name?.split(' ')[0] || 'Pro'} 👋
        </Text>
        <Text style={{ fontSize: 14, color: '#6b7280', marginTop: 2 }}>Your tasks for today</Text>
      </View>

      <PaymentReminderBanner />
      <EmailVerificationBanner />

      {/* Stats row — clickable tiles */}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 12 }}>
        {[
          { label: 'New', count: tasks.length, color: '#2563eb', bg: '#eff6ff', tab: 'available' },
          { label: 'Mine', count: myTasks.filter(t => ['assigned','on_the_way','started'].includes(t.status)).length, color: '#059669', bg: '#ecfdf5', tab: 'my' },
          { label: 'Done', count: myTasks.filter(t => ['paid','completed_pending_payment','completed'].includes(t.status)).length, color: '#7c3aed', bg: '#f5f3ff', tab: 'done' },
        ].map(stat => {
          const isActive = statFilter === stat.tab;
          return (
            <TouchableOpacity
              key={stat.label}
              style={[
                { flex: 1, backgroundColor: stat.bg, borderRadius: 14, padding: 14, alignItems: 'center' },
                isActive && { borderWidth: 2, borderColor: stat.color },
              ]}
              onPress={() => {
                setStatFilter(stat.tab as any);
                router.push({ pathname: '/(tabs)/tasks', params: { tab: stat.tab } });
              }}
            >
              <Text style={{ fontSize: 26, fontWeight: '800', color: stat.color }}>{stat.count}</Text>
              <Text style={{ fontSize: 12, color: stat.color, fontWeight: '600', marginTop: 2 }}>{stat.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', marginHorizontal: 16, backgroundColor: '#f3f4f6', borderRadius: 12, padding: 4, marginBottom: 12 }}>
        {(['available', 'my'] as const).map(tab => (
          <TouchableOpacity key={tab} style={[{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' }, activeTab === tab && { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }]}
            onPress={() => setActiveTab(tab)}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: activeTab === tab ? '#111827' : '#6b7280' }}>
              {tab === 'available' ? '🔍 Available' : '📋 My tasks'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sub-filter chips — visible only on "My tasks" tab */}
      {activeTab === 'my' && (
        <View style={{ maxHeight: 44, marginBottom: 10 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}
        >
          {([
            { id: 'all', label: 'All', icon: 'layers-outline', color: '#374151' },
            { id: 'assigned', label: 'Assigned', icon: 'briefcase-outline', color: '#f59e0b' },
            { id: 'in_progress', label: 'In progress', icon: 'time-outline', color: '#2563eb' },
            { id: 'pending_pay', label: 'Awaiting payment', icon: 'card-outline', color: '#dc2626' },
            { id: 'paid', label: 'Paid', icon: 'checkmark-circle-outline', color: '#059669' },
          ] as { id: typeof myFilter; label: string; icon: any; color: string }[]).map(chip => {
            const count = chip.id === 'all'
              ? myTasks.length
              : myTasks.filter(t => {
                  if (chip.id === 'assigned') return ['assigned','accepted'].includes(t.status);
                  if (chip.id === 'in_progress') return ['on_the_way','started','in_progress'].includes(t.status);
                  if (chip.id === 'pending_pay') return t.status === 'completed_pending_payment';
                  if (chip.id === 'paid') return ['paid','completed'].includes(t.status);
                  return false;
                }).length;
            const active = myFilter === chip.id;
            return (
              <TouchableOpacity
                key={chip.id}
                style={[
                  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34,
                    borderRadius: 17, backgroundColor: active ? chip.color : '#fff', alignSelf: 'center',
                    borderWidth: 1, borderColor: active ? chip.color : '#e5e7eb' },
                ]}
                onPress={() => setMyFilter(chip.id)}
                data-testid={`provider-filter-${chip.id}`}
              >
                <Ionicons name={chip.icon} size={14} color={active ? '#fff' : chip.color} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : chip.color }}>
                  {chip.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        </View>
      )}

      {/* Task list */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {displayed.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
              <Ionicons name="clipboard-outline" size={56} color="#d1d5db" />
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#9ca3af' }}>No tasks</Text>
              <Text style={{ fontSize: 14, color: '#9ca3af', textAlign: 'center' }}>
                {activeTab === 'available'
                  ? 'No new tasks in your area yet'
                  : myFilter !== 'all'
                  ? 'No tasks in this category. Try another filter.'
                  : 'You haven\'t accepted any tasks yet'}
              </Text>
            </View>
          ) : displayed.map(task => {
            const st = STATUS_LABELS[task.status] || { label: task.status, color: '#6b7280', bg: '#f3f4f6' };
            return (
              <TouchableOpacity key={task.task_id} style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
                onPress={() => router.push({ pathname: '/task-detail', params: { id: task.task_id } })}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', flex: 1, marginRight: 8 }} numberOfLines={2}>{task.title}</Text>
                  <View style={{ backgroundColor: st.bg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: st.color }}>{st.label}</Text>
                  </View>
                </View>
                {task.description ? <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }} numberOfLines={2}>{task.description}</Text> : null}
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  {task.address ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="location-outline" size={13} color="#9ca3af" /><Text style={{ fontSize: 12, color: '#9ca3af' }}>{task.address}</Text></View> : null}
                  {task.scheduled_date ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="calendar-outline" size={13} color="#9ca3af" /><Text style={{ fontSize: 12, color: '#9ca3af' }}>{task.scheduled_date}</Text></View> : null}
                  {task.estimated_price ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="cash-outline" size={13} color="#9ca3af" /><Text style={{ fontSize: 12, color: '#9ca3af' }}>${task.estimated_price}/hr</Text></View> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURN (Rules of Hooks)
  const { addBooking } = useBookingStore();
  const [step, setStep] = useState<BookingStep>('home');
  const [booking, setBooking] = useState<BookingState>({
    categoryId: '', categoryName: '', skillName: '', taskDescription: '',
    address: '', city: '', dates: [], date: '', timeFrom: '', timeTo: '', time: '', selectedTasker: null,
    photos: [],
  });
  const [taskers, setTaskers] = useState<any[]>([]);
  const [loadingTaskers, setLoadingTaskers] = useState(false);
  const [booking_submitting, setBookingSubmitting] = useState(false);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [photoResult, setPhotoResult] = useState<any>(null);
  const submittingRef = useRef(false); // synchronous guard against rapid double-taps
  const [searchQuery, setSearchQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [userCountry, setUserCountry] = useState<string>('US'); // default US
  const [quickCities, setQuickCities] = useState<string[]>(['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia']);
  const [calDayIdx, setCalDayIdx] = useState(0); // for datetime step — must be here (Rules of Hooks)
  const [anyDayTime, setAnyDayTime] = useState(false); // "any day and time" checkbox
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  React.useEffect(() => {
    if (!user) return;
    let alive = true;
    const fetch = async () => {
      try {
        const r = await api.getUnreadNotificationCount();
        if (alive) setUnreadNotifs(r?.unread_count || 0);
      } catch {}
    };
    fetch();
    const id = setInterval(fetch, 15000);
    return () => { alive = false; clearInterval(id); };
  }, [user]);
  const dates = getDates();

  // Resume an in-progress booking after the guest registered/logged in
  const [resumingBooking, setResumingBooking] = useState(false);
  React.useEffect(() => {
    if (!user) return;
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('pending_booking_draft') : null;
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft && draft.selectedTasker) {
        setBooking(draft);
        setStep('confirm');
        setResumingBooking(true);
        window.localStorage.removeItem('pending_booking_draft');
      }
    } catch { /* ignore */ }
  }, [user?.user_id]);

  // After resume, auto-submit the booking so the registered user immediately
  // gets the order in their list — they don't need to click confirm twice.
  React.useEffect(() => {
    if (!resumingBooking) return;
    if (!user) return;
    if (!booking.selectedTasker) return;
    const t = setTimeout(() => {
      setResumingBooking(false);
      submitBooking();
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumingBooking, user?.user_id, booking.selectedTasker]);

  // Detect user country via IP on mount
  React.useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(data => {
        const country = data.country_code || 'US';
        const city = data.city || '';
        setUserCountry(country);
        const CITIES_BY_COUNTRY: Record<string, string[]> = {
          UA: ['Kyiv', 'Kharkiv', 'Odesa', 'Dnipro', 'Lviv', 'Zaporizhzhia'],
          US: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia'],
          PL: ['Warszawa', 'Kraków', 'Wrocław', 'Poznań', 'Gdańsk', 'Łódź'],
          DE: ['Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt', 'Stuttgart'],
          GB: ['London', 'Birmingham', 'Manchester', 'Leeds', 'Glasgow', 'Liverpool'],
          FR: ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes'],
          ES: ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Zaragoza', 'Málaga'],
          IT: ['Roma', 'Milano', 'Napoli', 'Torino', 'Palermo', 'Genova'],
          CZ: ['Praha', 'Brno', 'Ostrava', 'Plzeň', 'Liberec', 'Olomouc'],
          CA: ['Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Edmonton', 'Ottawa'],
          AU: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Canberra'],
        };
        const cities = CITIES_BY_COUNTRY[country] || CITIES_BY_COUNTRY['UA'];
        // Put detected city first if available and not already in list
        if (city && !cities.includes(city)) {
          setQuickCities([city, ...cities.slice(0, 5)]);
        } else if (city && cities.includes(city)) {
          setQuickCities([city, ...cities.filter(c => c !== city).slice(0, 5)]);
        } else {
          setQuickCities(cities);
        }
      })
      .catch(() => {}); // silently fail, keep defaults
  }, []);

  // Load DB categories so admin-uploaded cover images and overrides show up
  // on the home grid. Falls back gracefully to the hardcoded SKILL_CATEGORIES
  // when the request fails or returns the enum-style list.
  const [dbCategories, setDbCategories] = useState<any[]>([]);
  React.useEffect(() => {
    api.getCategories()
      .then((data: any[]) => {
        if (Array.isArray(data)) setDbCategories(data);
      })
      .catch(() => { /* keep defaults */ });
  }, []);

  // Build a map: category_id -> { image, name override, recommended_price }
  const dbCatById: Record<string, any> = React.useMemo(() => {
    const m: Record<string, any> = {};
    for (const c of dbCategories) {
      const key = c.category_id || c.id;
      if (key) m[key] = c;
    }
    return m;
  }, [dbCategories]);

  // Providers see their own tasks dashboard, not the client booking flow
  // (placed AFTER all hooks to comply with Rules of Hooks)
  if (user?.role === 'provider') {
    return <ProviderDashboard />;
  }

  // ── Helpers ──
  const goBack = () => {
    const prev: Record<BookingStep, BookingStep> = {
      home: 'home', skills: 'home', details: 'skills', address: 'details',
      datetime: 'address', taskers: 'datetime', tasker_profile: 'taskers', confirm: 'tasker_profile',
    };
    setStep(prev[step]);
  };

  const selectCategory = (cat: typeof SKILL_CATEGORIES[0]) => {
    setBooking(b => ({ ...b, categoryId: cat.id, categoryName: cat.name, skillName: '' }));
    // Admin-created categories don't have predefined sub-skills — skip the
    // skills step and go straight to "describe your task".
    if (!cat.skills || cat.skills.length === 0) {
      setStep('details');
    } else {
      setStep('skills');
    }
  };

  const selectSkill = (skill: string) => {
    setBooking(b => ({ ...b, skillName: skill }));
    setStep('details');
  };

  useEffect(() => {
    if (step === 'photo_result' && photoResult && booking.city) {
      loadTaskers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoResult, step]);

  const runPhotoAnalysis = async (base64: string) => {
    setAnalyzingPhoto(true);
    setPhotoResult(null);
    setStep('photo_result');
    try {
      const data = await api.analyzeTaskPhoto({ image_base64: base64, city: booking.city || undefined });
      const det = data.detection || {};
      setPhotoResult(data);
      setBooking(b => ({
        ...b,
        categoryId: det.category_id || b.categoryId,
        categoryName: det.category_name || b.categoryName,
        skillName: det.skill || b.skillName,
        taskDescription: det.summary || b.taskDescription,
        photos: [base64, ...b.photos].slice(0, 5),
      }));
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Could not analyze the photo. Please try again.');
      setStep('home');
    } finally {
      setAnalyzingPhoto(false);
    }
  };

  const fileToCompressedBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read failed'));
      reader.onload = () => {
        const img = new (window as any).Image();
        img.onload = () => {
          try {
            const maxDim = 1280;
            let w = img.width;
            let h = img.height;
            if (w > h && w > maxDim) { h = Math.round((h * maxDim) / w); w = maxDim; }
            else if (h >= w && h > maxDim) { w = Math.round((w * maxDim) / h); h = maxDim; }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject(new Error('no ctx')); return; }
            ctx.drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            resolve(dataUrl.includes(',') ? dataUrl.split(',')[1] : '');
          } catch (err) { reject(err as Error); }
        };
        img.onerror = () => reject(new Error('image decode failed'));
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });

  const pickPhotoWebForAnalysis = (useCamera: boolean) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (useCamera) input.setAttribute('capture', 'environment');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.onchange = async (e: any) => {
      const file = e?.target?.files?.[0];
      try { if (input.parentNode) input.parentNode.removeChild(input); } catch {}
      if (!file) return;
      try {
        const b64 = await fileToCompressedBase64(file);
        if (b64) runPhotoAnalysis(b64);
        else Alert.alert('Error', 'Could not read the image. Please try another photo.');
      } catch {
        Alert.alert('Error', 'Could not process the image. Please try another photo.');
      }
    };
    document.body.appendChild(input);
    input.click();
  };

  const pickPhotoForAnalysis = (useCamera = false) => {
    if (Platform.OS === 'web') {
      pickPhotoWebForAnalysis(useCamera);
      return;
    }
    Alert.alert('Identify by photo', 'Choose a source', [
      {
        text: 'Camera',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) { Alert.alert('Error', 'Camera access is required'); return; }
          const r = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.6, base64: true });
          if (!r.canceled && r.assets[0].base64) runPhotoAnalysis(r.assets[0].base64);
        },
      },
      {
        text: 'Gallery',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) { Alert.alert('Error', 'Gallery access is required'); return; }
          const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6, base64: true });
          if (!r.canceled && r.assets[0].base64) runPhotoAnalysis(r.assets[0].base64);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const loadTaskers = async () => {
    setLoadingTaskers(true);
    try {
      const primaryDate = booking.dates.length > 0 ? booking.dates[0] : booking.date;

      // If we have a city but no coordinates, geocode the city first
      let clientLat = booking.lat;
      let clientLng = booking.lng;
      if (booking.city && (clientLat == null || clientLng == null)) {
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(booking.city)}&limit=1&accept-language=en`,
            { headers: { 'User-Agent': 'HandyHub/1.0' } }
          );
          const geoData = await geoRes.json();
          if (geoData && geoData[0]) {
            clientLat = parseFloat(geoData[0].lat);
            clientLng = parseFloat(geoData[0].lon);
            // Save geocoded coords to booking state for reuse
            setBooking(b => ({ ...b, lat: clientLat!, lng: clientLng! }));
          }
        } catch { /* ignore geocoding errors */ }
      }

      const data = await api.getExecutorsBySkill({
        skill: booking.skillName,
        category: booking.categoryId,
        city: booking.city,
        lat: clientLat ?? undefined,
        lng: clientLng ?? undefined,
        date: primaryDate || undefined,
        timeFrom: booking.timeFrom || undefined,
      });
      setTaskers(Array.isArray(data) ? data : []);
    } catch {
      // On error show empty list (do NOT fallback to all executors — would show wrong city)
      setTaskers([]);
    } finally {
      setLoadingTaskers(false);
    }
  };

  const detectLocation = async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      Alert.alert('Location', 'Geolocation is not supported in this browser');
      return;
    }
    setLoadingGeo(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=en`,
            { headers: { 'User-Agent': 'HandyHub/1.0' } }
          );
          const data = await res.json();
          const addr = data.address || {};
          const city = addr.city || addr.town || addr.village || addr.county || '';
          const street = addr.road || addr.pedestrian || '';
          const houseNumber = addr.house_number || '';
          const streetAddr = street ? `${street}${houseNumber ? ', ' + houseNumber : ''}` : '';
          setBooking(b => ({ ...b, city, address: streetAddr, lat: latitude, lng: longitude }));
        } catch {
          Alert.alert('Error', 'Could not determine the address');
        } finally {
          setLoadingGeo(false);
        }
      },
      () => {
        setLoadingGeo(false);
        Alert.alert('Location', 'Could not access your location. Please enter the address manually.');
      },
      { timeout: 10000 }
    );
  };

  const searchAddress = async (query: string) => {
    if (query.length < 3) { setAddressSuggestions([]); return; }
    try {
      // No countrycodes restriction — support any country (US, UA, etc.)
      // addressdetails=1 returns structured address (city, town, county) for better city extraction
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&accept-language=en&addressdetails=1`,
        { headers: { 'User-Agent': 'HandyHub/1.0' } }
      );
      const data = await res.json();
      setAddressSuggestions(data);
    } catch {
      setAddressSuggestions([]);
    }
  };

  const submitBooking = async () => {
    // Double-tap guard: ref is synchronous, state controls UI
    if (!booking.selectedTasker || submittingRef.current) return;

    // Gate: an unauthenticated guest cannot publish a task — the executor
    // would have no way to contact them and the order would never appear
    // in anyone's list. Send them to /register with a return-to flag so
    // they come back to this confirm step after sign-up and we publish then.
    if (!user) {
      try {
        // Persist the full booking — auto-submit will need every field
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('pending_booking_draft', JSON.stringify(booking));
        }
      } catch { /* ignore */ }
      router.push('/register?next=/(tabs)&resume=booking');
      return;
    }

    submittingRef.current = true;
    setBookingSubmitting(true);

    const tasker = booking.selectedTasker;
    const rate = tasker.profile?.hourly_rate || tasker.hourly_rate || 0;
    const primaryDate = booking.dates.length > 0 ? booking.dates[0] : booking.date;

    // Build notes with date/time info
    let notes = '';
    if ((booking as any)._anyDayTime) {
      notes = 'Any day and time works';
    } else if (booking.dates.length > 1) {
      notes = `Preferred dates: ${booking.dates.join(', ')}. Time: ${booking.timeFrom}${booking.timeTo ? '–' + booking.timeTo : ''}`;
    } else if (booking.timeTo) {
      notes = `Time: ${booking.timeFrom}–${booking.timeTo}`;
    }

    // OPTIMISTIC UI: add to local store immediately and navigate to success
    const localBookingId = `local_${Date.now()}`;
    addBooking({
      booking_id: localBookingId,
      client_id: user?.user_id || '',
      provider_id: tasker.user_id || tasker.provider_id,
      service_id: '',
      date: primaryDate,
      time: booking.timeFrom || booking.time,
      address: `${booking.address}, ${booking.city}`,
      status: 'pending',
      total_price: rate,
      payment_status: 'pending',
    });
    submittingRef.current = false;
    setBookingSubmitting(false);
    setStep('success');

    // Send request to server in background (fire-and-forget)
    api.createBooking({
      title: booking.skillName,
      description: booking.taskDescription || booking.skillName,
      problem_photos: booking.photos.length > 0 ? booking.photos : undefined,
      provider_id: tasker.user_id || tasker.provider_id,
      provider_hourly_rate: rate,
      category: booking.categoryId,
      address: booking.address,
      city: booking.city,
      date: primaryDate,
      time: booking.timeFrom || booking.time,
      notes: notes || undefined,
      total_price: rate,
    }).catch((e: any) => {
      // Background error — booking was already shown as confirmed locally
      console.warn('[submitBooking] background error:', e?.message);
    });
  };

  // Merged list: hardcoded SKILL_CATEGORIES + admin-created DB-only ones.
  // Admin-created categories don't have predefined skills; we surface them
  // with a fallback icon and empty skills so the client can still book them.
  const mergedCategories = React.useMemo(() => {
    const builtinIds = new Set(SKILL_CATEGORIES.map(c => c.id));
    const dbOnly = dbCategories
      .filter((c: any) => c.is_active !== false)
      .filter((c: any) => !builtinIds.has(c.category_id || c.id))
      .map((c: any) => ({
        id: c.category_id || c.id,
        name: c.name || 'Category',
        icon: 'apps-outline' as const,
        color: '#475569',
        bg: '#f1f5f9',
        skills: [], // admin-created categories use generic "Describe your task" flow
      }));
    return [...SKILL_CATEGORIES, ...dbOnly];
  }, [dbCategories]);

  const filteredCategories = mergedCategories.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.skills.some((s: string) => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // ── RENDER STEPS ──────────────────────────────────────────────────────────

  // STEP: HOME — category grid (landing for guests, dashboard-like for authed clients)
  if (step === 'home') {
    const isGuest = !user;
    return (
      <View style={s.container}>
        {/* Header — landing hero for guests, personalised greeting for clients */}
        {isGuest ? (
          <View style={s.heroHeader}>
            <View style={s.heroTopRow}>
              <View style={s.heroBrand}>
                <View style={s.heroLogo}>
                  <Ionicons name="construct" size={20} color="#fff" />
                </View>
                <Text style={s.heroBrandText}>HandyHub</Text>
              </View>
              <View style={s.heroAuthBtns}>
                <TouchableOpacity onPress={() => router.push('/login')} style={s.heroLoginBtn}>
                  <Text style={s.heroLoginBtnText}>Log in</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/register')} style={s.heroSignupBtn}>
                  <Text style={s.heroSignupBtnText}>Sign up</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={s.heroTitle}>Find a trusted pro near you</Text>
            <Text style={s.heroSubtitle}>Book services in a few clicks. Registration is optional.</Text>
          </View>
        ) : (
          <View style={s.header}>
            <View>
              <Text style={s.greeting}>Hi, {user?.full_name?.split(' ')[0] || user?.username || 'Client'} 👋</Text>
              <Text style={s.headerSub}>What do you need done today?</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/community' as any)}
                data-testid="open-blog-btn"
              >
                <Ionicons name="newspaper-outline" size={26} color="#111827" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/notifications' as any)}
                data-testid="open-notifications-btn"
                style={{ position: 'relative' }}
              >
                <Ionicons name="notifications-outline" size={26} color="#111827" />
                {unreadNotifs > 0 && (
                  <View style={{
                    position: 'absolute', top: -2, right: -4,
                    backgroundColor: '#ef4444', borderRadius: 10,
                    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
                    paddingHorizontal: 4,
                  }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                      {unreadNotifs > 99 ? '99+' : unreadNotifs}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/(tabs)/my-profile')}>
                {user?.picture ? (
                  <Image source={{ uri: user.picture }} style={s.headerAvatar} />
                ) : (
                  <View style={[s.headerAvatar, { backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="person" size={20} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Search */}
        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={20} color="#9ca3af" />
          <TextInput
            style={s.searchInput}
            placeholder={isGuest ? 'What do you need done? (e.g., furniture assembly)' : 'Search for a service...'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9ca3af"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={s.searchCamBtn}
            onPress={() => pickPhotoForAnalysis(true)}
            data-testid="search-photo-btn"
            accessibilityLabel="Take a photo to identify a service"
          >
            <Ionicons name="camera" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={s.photoCta}
          onPress={() => pickPhotoForAnalysis(false)}
          data-testid="identify-by-photo-btn"
        >
          <Ionicons name="sparkles" size={16} color="#2563eb" />
          <Text style={s.photoCtaText}>Identify by photo</Text>
          <View style={s.photoCtaBadge}><Text style={s.photoCtaBadgeText}>AI</Text></View>
        </TouchableOpacity>

        {/* Category grid */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          <PaymentReminderBanner />
          <EmailVerificationBanner />
          <Text style={s.sectionTitle}>Choose a category</Text>
          <View style={s.grid}>
            {filteredCategories.map(cat => {
              const dbCat = dbCatById[cat.id];
              const coverImage = dbCat?.image || FALLBACK_COVERS[cat.id];
              const displayName = dbCat?.name || cat.name;
              if (coverImage) {
                // Premium card: real photo with gradient overlay + label
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={s.catCardPhoto}
                    onPress={() => selectCategory(cat)}
                    activeOpacity={0.85}
                  >
                    <Image source={{ uri: coverImage }} style={s.catCardPhotoImg} />
                    <View style={s.catCardPhotoOverlay} />
                    <View style={s.catCardPhotoBadge}>
                      <Ionicons name={cat.icon} size={16} color={cat.color} />
                    </View>
                    <View style={s.catCardPhotoTextWrap}>
                      <Text style={s.catCardPhotoName} numberOfLines={2}>{displayName}</Text>
                      <Text style={s.catCardPhotoCount}>{cat.skills.length} services</Text>
                    </View>
                  </TouchableOpacity>
                );
              }
              // Fallback: clean icon card
              return (
                <TouchableOpacity key={cat.id} style={[s.catCard, { backgroundColor: cat.bg }]} onPress={() => selectCategory(cat)}>
                  <View style={[s.catIcon, { backgroundColor: cat.color + '22' }]}>
                    <Ionicons name={cat.icon} size={28} color={cat.color} />
                  </View>
                  <Text style={[s.catName, { color: cat.color }]}>{displayName}</Text>
                  <Text style={s.catCount}>{cat.skills.length} services</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Popular tasks */}
          <Text style={[s.sectionTitle, { marginTop: 24 }]}>Popular tasks</Text>
          {[
            { skill: 'IKEA furniture assembly', cat: SKILL_CATEGORIES[0], emoji: '🪑' },
            { skill: 'Regular cleaning', cat: SKILL_CATEGORIES[1], emoji: '🧹' },
            { skill: 'Minor repairs', cat: SKILL_CATEGORIES[2], emoji: '🔧' },
            { skill: 'Moving help', cat: SKILL_CATEGORIES[3], emoji: '📦' },
          ].map(item => (
            <TouchableOpacity key={item.skill} style={s.popularRow} onPress={() => {
              setBooking(b => ({ ...b, categoryId: item.cat.id, categoryName: item.cat.name, skillName: item.skill }));
              setStep('details');
            }}>
              <Text style={s.popularEmoji}>{item.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.popularName}>{item.skill}</Text>
                <Text style={s.popularCat}>{item.cat.name}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            </TouchableOpacity>
          ))}

          {/* How it works — landing only */}
          {isGuest ? (
            <View style={s.howItWorks}>
              <Text style={[s.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>How it works</Text>
              <View style={s.stepRow}>
                <View style={[s.stepCircle, { backgroundColor: '#eff6ff' }]}>
                  <Text style={[s.stepNum, { color: '#2563eb' }]}>1</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.stepTitleSm}>Describe the task</Text>
                  <Text style={s.stepDesc}>Choose a category and briefly describe what needs to be done.</Text>
                </View>
              </View>
              <View style={s.stepRow}>
                <View style={[s.stepCircle, { backgroundColor: '#f0fdf4' }]}>
                  <Text style={[s.stepNum, { color: '#16a34a' }]}>2</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.stepTitleSm}>Choose a pro</Text>
                  <Text style={s.stepDesc}>Browse profiles, ratings, and prices — choose the best one.</Text>
                </View>
              </View>
              <View style={s.stepRow}>
                <View style={[s.stepCircle, { backgroundColor: '#fef3c7' }]}>
                  <Text style={[s.stepNum, { color: '#d97706' }]}>3</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.stepTitleSm}>Book without registration</Text>
                  <Text style={s.stepDesc}>Confirm the booking — an invoice is created automatically.</Text>
                </View>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  // STEP: SKILLS — list of skills in category
  if (step === 'photo_result') {
    const det = photoResult?.detection || {};
    const est = photoResult?.estimate || {};
    const img = booking.photos[0];
    return (
      <View style={s.container}>
        <View style={s.stepHeader}>
          <TouchableOpacity onPress={() => setStep('home')} style={s.backBtn} data-testid="photo-result-back">
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={s.stepTitle}>AI suggestion</Text>
          <View style={{ width: 40 }} />
        </View>

        {analyzingPhoto || !photoResult ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={{ marginTop: 12, color: '#6b7280' }}>Analyzing your photo…</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
            {img ? (
              <Image source={{ uri: `data:image/jpeg;base64,${img}` }} style={s.photoResultImg} />
            ) : null}

            <View style={s.detectCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={s.detectSkill} data-testid="detected-skill">{det.skill}</Text>
                <View style={s.confBadge}>
                  <Text style={s.confBadgeText}>{Math.round((det.confidence || 0) * 100)}% match</Text>
                </View>
              </View>
              <Text style={s.detectCat}>{det.category_name}</Text>
              {det.summary ? <Text style={s.detectSummary}>{det.summary}</Text> : null}
            </View>

            <View style={s.estRow}>
              <View style={s.estTile}>
                <Ionicons name="time-outline" size={20} color="#2563eb" />
                <Text style={s.estLabel}>Estimated time</Text>
                <Text style={s.estValue} data-testid="estimate-time">{est.hours_label}</Text>
              </View>
              <View style={s.estTile}>
                <Ionicons name="cash-outline" size={20} color="#16a34a" />
                <Text style={s.estLabel}>Estimated price</Text>
                <Text style={s.estValue} data-testid="estimate-price">${est.price_min}–${est.price_max}</Text>
              </View>
            </View>
            <Text style={s.estNote}>Final price depends on the pro's rate and actual hours worked.</Text>

            <Text style={s.sectionTitle}>Available pros</Text>
            {loadingTaskers ? (
              <ActivityIndicator color="#2563eb" style={{ marginVertical: 16 }} />
            ) : taskers.length > 0 ? (
              taskers.slice(0, 3).map((tasker, idx) => {
                const profile = tasker.profile || {};
                const rate = tasker.final_hourly_rate
                  ? Math.round(tasker.final_hourly_rate)
                  : Math.round((profile.hourly_rate || tasker.hourly_rate || 25) * 1.15);
                const rating = tasker.average_rating || tasker.rating || 0;
                const displayName = tasker.name || tasker.full_name || tasker.username || 'Pro';
                return (
                  <TouchableOpacity
                    key={tasker.user_id || idx}
                    style={s.proMini}
                    data-testid={`photo-pro-${idx}`}
                    onPress={() => { setBooking(b => ({ ...b, selectedTasker: tasker })); setStep('tasker_profile'); }}
                  >
                    <View style={[s.taskerAvatar, { backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', width: 44, height: 44 }]}>
                      <Text style={{ color: '#fff', fontWeight: '700' }}>{displayName[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={s.taskerName}>{displayName}</Text>
                      <Text style={{ color: '#6b7280', fontSize: 12 }}>{rating > 0 ? `★ ${rating.toFixed(1)}` : 'New'} · ${rate}/hr</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={s.proEmpty}>
                <Ionicons name="location-outline" size={22} color="#9ca3af" />
                <Text style={s.proEmptyText}>Set your address in the next step to see available pros near you.</Text>
              </View>
            )}
          </ScrollView>
        )}

        {!analyzingPhoto && photoResult && (
          <View style={s.bottomBar}>
            <TouchableOpacity style={s.nextBtn} onPress={() => setStep('address')} data-testid="photo-book-btn">
              <Text style={s.nextBtnText}>Book this service</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.secondaryBtn} onPress={() => setStep('skills')} data-testid="photo-choose-manual">
              <Text style={s.secondaryBtnText}>Choose manually</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  if (step === 'skills') {
    const cat = SKILL_CATEGORIES.find(c => c.id === booking.categoryId)!;
    return (
      <View style={s.container}>
        <View style={s.stepHeader}>
          <TouchableOpacity onPress={goBack} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={s.stepTitle}>{cat.name}</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <Text style={s.stepSubtitle}>What service do you need?</Text>
          {cat.skills.map(skill => (
            <TouchableOpacity key={skill} style={s.skillRow} onPress={() => selectSkill(skill)}>
              <View style={[s.skillDot, { backgroundColor: cat.color }]} />
              <Text style={s.skillRowText}>{skill}</Text>
              <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  // STEP: DETAILS — task description
  if (step === 'details') {
    return (
      <View style={s.container}>
        <View style={s.stepHeader}>
          <TouchableOpacity onPress={goBack} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={s.stepTitle}>Task details</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
          <View style={s.selectedSkillBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#2563eb" />
            <Text style={s.selectedSkillText}>{booking.skillName}</Text>
          </View>
          <Text style={s.fieldLabel}>Describe the task</Text>
          <TextInput
            style={[s.textArea]}
            placeholder="E.g., Need to assemble an IKEA FRIHETEN sofa, all parts and instructions are available..."
            value={booking.taskDescription}
            onChangeText={v => setBooking(b => ({ ...b, taskDescription: v }))}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            placeholderTextColor="#9ca3af"
          />
          <Text style={s.hint}>The more detailed the description, the more accurately the pro can estimate the task</Text>

          {/* Photo upload section */}
          <Text style={[s.fieldLabel, { marginTop: 20 }]}>Problem photos (optional)</Text>
          <Text style={[s.hint, { marginBottom: 12 }]}>Add up to 5 photos so the pro understands the task better</Text>
          <View style={s.photosRow}>
            {booking.photos.map((photo, idx) => (
              <View key={idx} style={s.photoThumbWrap}>
                <Image source={{ uri: `data:image/jpeg;base64,${photo}` }} style={s.photoThumb} />
                <TouchableOpacity
                  style={s.photoRemoveBtn}
                  onPress={() => setBooking(b => ({ ...b, photos: b.photos.filter((_, i) => i !== idx) }))}
                >
                  <Ionicons name="close-circle" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
            {booking.photos.length < 5 && (
              Platform.OS === 'web' ? (
                <View style={s.photoAddBtn}>
                  {/* Hidden file input for web */}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    capture={undefined}
                    style={{
                      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                      opacity: 0, cursor: 'pointer', zIndex: 10,
                    }}
                    onChange={async (e: any) => {
                      const files: File[] = Array.from(e.target.files || []);
                      const remaining = 5 - booking.photos.length;
                      const toProcess = files.slice(0, remaining);
                      const base64s: string[] = [];
                      for (const file of toProcess) {
                        await new Promise<void>((resolve) => {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const result = ev.target?.result as string;
                            // result is data:image/...;base64,XXXX — strip prefix
                            const b64 = result.split(',')[1];
                            if (b64) base64s.push(b64);
                            resolve();
                          };
                          reader.readAsDataURL(file);
                        });
                      }
                      if (base64s.length > 0) {
                        setBooking(b => ({ ...b, photos: [...b.photos, ...base64s].slice(0, 5) }));
                      }
                      e.target.value = '';
                    }}
                  />
                  <Ionicons name="camera-outline" size={28} color="#2563eb" />
                  <Text style={s.photoAddText}>Add{booking.photos.length > 0 ? ' more' : ''}</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={s.photoAddBtn}
                  onPress={() => {
                    Alert.alert('Add photo', 'Choose a source', [
                      {
                        text: 'Camera',
                        onPress: async () => {
                          const perm = await ImagePicker.requestCameraPermissionsAsync();
                          if (!perm.granted) { Alert.alert('Error', 'Camera access is required'); return; }
                          const result = await ImagePicker.launchCameraAsync({
                            mediaTypes: ImagePicker.MediaTypeOptions.Images,
                            allowsEditing: true, quality: 0.6, base64: true,
                          });
                          if (!result.canceled && result.assets[0].base64) {
                            setBooking(b => ({ ...b, photos: [...b.photos, result.assets[0].base64!] }));
                          }
                        },
                      },
                      {
                        text: 'Gallery',
                        onPress: async () => {
                          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                          if (!perm.granted) { Alert.alert('Error', 'Gallery access is required'); return; }
                          const result = await ImagePicker.launchImageLibraryAsync({
                            mediaTypes: ImagePicker.MediaTypeOptions.Images,
                            allowsMultipleSelection: true, selectionLimit: 5 - booking.photos.length,
                            quality: 0.6, base64: true,
                          });
                          if (!result.canceled) {
                            const newPhotos = result.assets.filter(a => a.base64).map(a => a.base64!);
                            setBooking(b => ({ ...b, photos: [...b.photos, ...newPhotos].slice(0, 5) }));
                          }
                        },
                      },
                      { text: 'Cancel', style: 'cancel' },
                    ]);
                  }}
                >
                  <Ionicons name="camera-outline" size={28} color="#2563eb" />
                  <Text style={s.photoAddText}>Add{booking.photos.length > 0 ? ' more' : ''}</Text>
                </TouchableOpacity>
              )
            )}
          </View>
        </ScrollView>
        <View style={s.bottomBar}>
          <TouchableOpacity
            style={[s.nextBtn, !booking.taskDescription.trim() && s.nextBtnDisabled]}
            disabled={!booking.taskDescription.trim()}
            onPress={() => setStep('address')}
          >
            <Text style={s.nextBtnText}>Next — Address</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // STEP: ADDRESS
  if (step === 'address') {
    return (
      <View style={s.container}>
        <View style={s.stepHeader}>
          <TouchableOpacity onPress={goBack} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={s.stepTitle}>Address</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          <Text style={s.stepSubtitle}>Where does the task need to be done?</Text>

          {/* Geolocation button */}
          <TouchableOpacity
            style={[s.geoBtn, loadingGeo && { opacity: 0.6 }]}
            onPress={detectLocation}
            disabled={loadingGeo}
          >
            {loadingGeo
              ? <ActivityIndicator size="small" color="#2563eb" />
              : <Ionicons name="locate-outline" size={20} color="#2563eb" />
            }
            <Text style={s.geoBtnText}>
              {loadingGeo ? 'Detecting your location...' : 'Detect my location'}
            </Text>
          </TouchableOpacity>

          <Text style={s.fieldLabel}>City</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <View style={[s.chipsRow, { flexWrap: 'nowrap' }]}>
              {quickCities.map(city => (
                <TouchableOpacity key={city} style={[s.chip, booking.city === city && s.chipActive]} onPress={() => setBooking(b => ({ ...b, city }))}>
                  <Text style={[s.chipText, booking.city === city && s.chipTextActive]}>{city}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <TextInput
            style={[s.input, { marginTop: 8 }]}
            placeholder="or type a city..."
            value={booking.city}
            onChangeText={v => setBooking(b => ({ ...b, city: v }))}
            placeholderTextColor="#9ca3af"
          />

          <Text style={s.fieldLabel}>Street and number</Text>
          <AddressAutocomplete
            value={booking.address}
            placeholder="123 Main St"
            testID="booking-address-input"
            onChangeText={v => setBooking(b => ({ ...b, address: v }))}
            onSelect={(formatted, parts) => {
              setBooking(b => ({
                ...b,
                address: parts.line1 || formatted,
                city: parts.city || b.city,
                lat: parts.lat ?? b.lat,
                lng: parts.lon ?? b.lng,
              }));
            }}
          />
        </ScrollView>
        <View style={s.bottomBar}>
          <TouchableOpacity
            style={[s.nextBtn, (!booking.address.trim() || !booking.city.trim()) && s.nextBtnDisabled]}
            disabled={!booking.address.trim() || !booking.city.trim()}
            onPress={() => { setAddressSuggestions([]); setStep('datetime'); }}
          >
            <Text style={s.nextBtnText}>Next — Date & time</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // STEP: DATE & TIME
  if (step === 'datetime') {
    // Provider-style calendar: week strip + time grid
    const HOUR_HEIGHT = 56;
    const GRID_START = 7; // 07:00
    const GRID_END = 22;  // 22:00
    const GRID_HOURS = Array.from({ length: GRID_END - GRID_START + 1 }, (_, i) => i + GRID_START);
    const CAL_TIMES = Array.from({ length: (GRID_END - GRID_START) * 2 }, (_, i) => {
      const h = GRID_START + Math.floor(i / 2);
      const m = i % 2 === 0 ? '00' : '30';
      return `${String(h).padStart(2, '0')}:${m}`;
    });

    // Selected day index (0=today) — state is declared at top of component (Rules of Hooks)
    const selectedDateObj = dates[calDayIdx];
    const selectedDateVal = selectedDateObj?.value || '';
    const isDateSelected = booking.dates.includes(selectedDateVal);

    const toggleCalDate = (val: string) => {
      setBooking(b => {
        const already = b.dates.includes(val);
        const newDates = already ? b.dates.filter(d => d !== val) : [...b.dates, val];
        return { ...b, dates: newDates, date: newDates[0] || '' };
      });
    };

    const selectTimeFrom = (t: string) => {
      // If no date selected yet, auto-select current day
      if (!isDateSelected) toggleCalDate(selectedDateVal);
      setBooking(b => ({ ...b, timeFrom: t, time: t }));
    };

    const selectTimeTo = (t: string) => {
      setBooking(b => ({ ...b, timeTo: t }));
    };

    const canProceed = anyDayTime || (booking.dates.length > 0 && !!booking.timeFrom);

    return (
      <View style={s.container}>
        {/* Header */}
        <View style={s.stepHeader}>
          <TouchableOpacity onPress={goBack} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={s.stepTitle}>Date & time</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Week strip */}
        <View style={{
          flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 8,
          backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6'
        }}>
          {dates.slice(0, 7).map((d, i) => {
            const isSel = i === calDayIdx;
            const hasTime = booking.dates.includes(d.value);
            return (
              <TouchableOpacity
                key={d.value}
                onPress={() => setCalDayIdx(i)}
                style={[{
                  flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12,
                  backgroundColor: isSel ? '#2563eb' : 'transparent',
                  marginHorizontal: 2,
                }]}
              >
                <Text style={{ fontSize: 11, color: isSel ? '#fff' : '#6b7280', fontWeight: '500', marginBottom: 2 }}>
                  {d.dayName}
                </Text>
                <Text style={{
                  fontSize: 16, fontWeight: '700',
                  color: isSel ? '#fff' : (i === 0 ? '#2563eb' : '#111827')
                }}>
                  {d.label.split(' ')[0]}
                </Text>
                {hasTime && (
                  <View style={{
                    width: 6, height: 6, borderRadius: 3,
                    backgroundColor: isSel ? '#fff' : '#2563eb',
                    marginTop: 3
                  }} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Day label + date toggle */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff' }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>
            {selectedDateObj?.dayName} {selectedDateObj?.label}
          </Text>
          <TouchableOpacity
            onPress={() => toggleCalDate(selectedDateVal)}
            style={[{
              paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
              borderWidth: 1.5,
              borderColor: isDateSelected ? '#2563eb' : '#d1d5db',
              backgroundColor: isDateSelected ? '#eff6ff' : '#fff',
              flexDirection: 'row', alignItems: 'center', gap: 4
            }]}
          >
            {isDateSelected && <Ionicons name="checkmark" size={14} color="#2563eb" />}
            <Text style={{ fontSize: 13, fontWeight: '600', color: isDateSelected ? '#2563eb' : '#6b7280' }}>
              {isDateSelected ? 'Selected' : 'Select a day'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Time range selector: from / to */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
          {/* Two-column header */}
          <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, gap: 8 }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151' }}>From (start)</Text>
              {booking.timeFrom ? (
                <View style={{ backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, marginTop: 4 }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{booking.timeFrom}</Text>
                </View>
              ) : (
                <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>not selected</Text>
              )}
            </View>
            <View style={{ width: 1, backgroundColor: '#e5e7eb' }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151' }}>To (end)</Text>
              {booking.timeTo ? (
                <View style={{ backgroundColor: '#059669', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, marginTop: 4 }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{booking.timeTo}</Text>
                </View>
              ) : (
                <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>not selected</Text>
              )}
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: '#e5e7eb', marginHorizontal: 16, marginBottom: 8 }} />

          {/* Two-column time slots */}
          <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 8 }}>
            {/* FROM column */}
            <View style={{ flex: 1 }}>
              {CAL_TIMES.map((t) => {
                const isFrom = booking.timeFrom === t;
                return (
                  <TouchableOpacity
                    key={`from-${t}`}
                    onPress={() => selectTimeFrom(t)}
                    style={[{
                      paddingVertical: 10, paddingHorizontal: 8, marginBottom: 4,
                      borderRadius: 10, alignItems: 'center',
                      backgroundColor: isFrom ? '#2563eb' : '#f3f4f6',
                      borderWidth: isFrom ? 0 : 1,
                      borderColor: '#e5e7eb',
                    }]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: isFrom ? '700' : '500', color: isFrom ? '#fff' : '#374151' }}>{t}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {/* TO column */}
            <View style={{ flex: 1 }}>
              {CAL_TIMES.filter(t => !booking.timeFrom || t > booking.timeFrom).map((t) => {
                const isTo = booking.timeTo === t;
                return (
                  <TouchableOpacity
                    key={`to-${t}`}
                    onPress={() => selectTimeTo(t)}
                    style={[{
                      paddingVertical: 10, paddingHorizontal: 8, marginBottom: 4,
                      borderRadius: 10, alignItems: 'center',
                      backgroundColor: isTo ? '#059669' : '#f3f4f6',
                      borderWidth: isTo ? 0 : 1,
                      borderColor: '#e5e7eb',
                    }]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: isTo ? '700' : '500', color: isTo ? '#fff' : '#374151' }}>{t}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* DUMMY PLACEHOLDER to keep old grid code from rendering — replaced above */}
          <View style={{ display: 'none' }}>
          <View style={{ position: 'relative', marginLeft: 48, marginRight: 16 }}>
            {/* Hour lines */}
            {GRID_HOURS.map(h => (
              <View key={h} style={{ position: 'absolute', left: -48, right: 0, top: (h - GRID_START) * HOUR_HEIGHT, height: HOUR_HEIGHT, flexDirection: 'row', alignItems: 'flex-start' }}>
                <Text style={{ width: 42, fontSize: 11, color: '#9ca3af', textAlign: 'right', paddingRight: 8, paddingTop: 2 }}>
                  {String(h).padStart(2, '0')}:00
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: '#f3f4f6', marginTop: 8 }} />
              </View>
            ))}

            {/* Tappable time slots */}
            <View style={{ height: (GRID_END - GRID_START) * HOUR_HEIGHT }}>
              {CAL_TIMES.map((t, idx) => {
                const topPos = idx * (HOUR_HEIGHT / 2);
                const isSelected = booking.timeFrom === t;
                return (
                  <TouchableOpacity
                    key={t}
                    onPress={() => selectTimeFrom(t)}
                    style={[{
                      position: 'absolute', left: 0, right: 0,
                      top: topPos, height: HOUR_HEIGHT / 2,
                      justifyContent: 'center', paddingLeft: 8,
                      borderRadius: isSelected ? 8 : 0,
                      backgroundColor: isSelected ? '#2563eb' : 'transparent',
                      zIndex: isSelected ? 2 : 1,
                    }]}
                  >
                    {isSelected && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="time" size={14} color="#fff" />
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{t}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>— selected</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          </View>{/* end display:none */}
        </ScrollView>

        {/* Bottom bar */}
        <View style={[s.bottomBar, { paddingTop: 8 }]}>
          {/* Any day/time checkbox */}
          <TouchableOpacity
            onPress={() => {
              setAnyDayTime(v => !v);
              if (!anyDayTime) {
                // Clear specific selections when enabling "any"
                setBooking(b => ({ ...b, dates: [], date: '', timeFrom: '', timeTo: '', time: '' }));
              }
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, paddingHorizontal: 4 }}
          >
            <View style={{
              width: 22, height: 22, borderRadius: 6, borderWidth: 2,
              borderColor: anyDayTime ? '#2563eb' : '#d1d5db',
              backgroundColor: anyDayTime ? '#2563eb' : '#fff',
              alignItems: 'center', justifyContent: 'center'
            }}>
              {anyDayTime && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={{ fontSize: 14, color: anyDayTime ? '#2563eb' : '#374151', fontWeight: anyDayTime ? '700' : '500' }}>
              Any day and time works
            </Text>
          </TouchableOpacity>

          {!anyDayTime && booking.dates.length > 0 && booking.timeFrom && (
            <Text style={{ textAlign: 'center', fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
              📅 {booking.dates.map(v => { const d = dates.find(x => x.value === v); return d ? `${d.dayName} ${d.label}` : v; }).join(', ')}
              {'  '}⏰ {booking.timeFrom}{booking.timeTo ? `–${booking.timeTo}` : ''}
            </Text>
          )}
          {anyDayTime && (
            <Text style={{ textAlign: 'center', fontSize: 13, color: '#2563eb', marginBottom: 8, fontWeight: '600' }}>
              ✅ Any convenient time
            </Text>
          )}
          <TouchableOpacity
            style={[s.nextBtn, !canProceed && s.nextBtnDisabled]}
            disabled={!canProceed}
            onPress={() => { loadTaskers(); setStep('taskers'); }}
          >
            <Text style={s.nextBtnText}>Find pros</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // STEP: TASKERS LIST
  if (step === 'taskers') {
    return (
      <View style={s.container}>
        <View style={s.stepHeader}>
          <TouchableOpacity onPress={goBack} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={s.stepTitle}>Pros</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Summary bar */}
        <View style={s.summaryBar}>
          <Ionicons name="location-outline" size={16} color="#6b7280" />
          <Text style={s.summaryText}>{booking.city} · {booking.date} · {booking.time}</Text>
        </View>

        {loadingTaskers ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={{ marginTop: 12, color: '#6b7280' }}>Searching for pros near you...</Text>
          </View>
        ) : taskers.length === 0 ? (
          <View style={s.centered}>
            <Ionicons name="people-outline" size={64} color="#d1d5db" />
            <Text style={s.emptyTitle}>No pros found</Text>
            <Text style={s.emptyText}>Try changing the city or date</Text>
            <TouchableOpacity style={s.retryBtn} onPress={() => setStep('address')}>
              <Text style={s.retryBtnText}>Change address</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
            <Text style={s.taskerCount}>{taskers.length} pros in {booking.city}</Text>
            {taskers.map((tasker, idx) => {
              const profile = tasker.profile || {};
              // Use final_hourly_rate (includes commission) if available, otherwise apply 15% commission
              const baseRate = profile.hourly_rate || tasker.hourly_rate || 25;
              const rate = tasker.final_hourly_rate
                ? Math.round(tasker.final_hourly_rate)
                : Math.round(baseRate * 1.15);
              const rating = tasker.average_rating || tasker.rating || 0;
              const reviews = tasker.total_reviews || tasker.review_count || 0;
              const displayName = tasker.name || tasker.full_name || tasker.username || 'Pro';
              const skills = Array.isArray(profile.skills) ? profile.skills : [];
              return (
              <TouchableOpacity key={tasker.user_id || idx} style={s.taskerCard} onPress={() => { setBooking(b => ({ ...b, selectedTasker: tasker })); setStep('tasker_profile'); }}>
                <View style={s.taskerCardLeft}>
                  {tasker.picture && !tasker.picture.includes('base64') ? (
                    <Image source={{ uri: tasker.picture }} style={s.taskerAvatar} />
                  ) : (
                    <View style={[s.taskerAvatar, { backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ fontSize: 20, color: '#fff', fontWeight: '700' }}>{displayName[0]?.toUpperCase()}</Text>
                    </View>
                  )}
                  {profile.badges?.includes('elite') && (
                    <View style={s.eliteBadge}>
                      <Text style={s.eliteBadgeText}>ELITE</Text>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.taskerName}>{displayName}</Text>
                  <View style={s.ratingRow}>
                    <Ionicons name="star" size={14} color="#f59e0b" />
                    <Text style={s.ratingText}>{rating > 0 ? rating.toFixed(1) : 'New'}</Text>
                    <Text style={s.reviewCount}>({reviews} reviews)</Text>
                  </View>
                  <Text style={s.taskerSkills} numberOfLines={1}>
                    {skills.slice(0, 3).join(' · ') || 'Pro'}
                  </Text>
                </View>
                <View style={s.taskerCardRight}>
                  <Text style={s.taskerRate}>{rate} ₴</Text>
                  <Text style={s.taskerRateLabel}>/hr</Text>
                  <Ionicons name="chevron-forward" size={18} color="#9ca3af" style={{ marginTop: 4 }} />
                </View>
              </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  }

  // STEP: TASKER PROFILE
  if (step === 'tasker_profile' && booking.selectedTasker) {
    const tasker = booking.selectedTasker;
    const tProfile = tasker.profile || {};
    const tBaseRate = tProfile.hourly_rate || tasker.hourly_rate || 25;
    const tRate = tasker.final_hourly_rate
      ? Math.round(tasker.final_hourly_rate)
      : Math.round(tBaseRate * 1.15);
    const tRating = tasker.average_rating || tasker.rating || 0;
    const tReviews = tasker.total_reviews || tasker.review_count || 0;
    const tName = tasker.name || tasker.full_name || tasker.username || 'Pro';
    const tSkills = Array.isArray(tProfile.skills) ? tProfile.skills : [];
    const tPhotos = Array.isArray(tProfile.portfolio_photos) ? tProfile.portfolio_photos : [];
    return (
      <View style={s.container}>
        <View style={s.stepHeader}>
          <TouchableOpacity onPress={goBack} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={s.stepTitle}>Pro profile</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Hero */}
          <View style={s.taskerHero}>
            {tasker.picture && !tasker.picture.includes('base64') ? (
              <Image source={{ uri: tasker.picture }} style={s.taskerHeroAvatar} />
            ) : (
              <View style={[s.taskerHeroAvatar, { backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ fontSize: 40, color: '#fff', fontWeight: '700' }}>{tName[0]?.toUpperCase()}</Text>
              </View>
            )}
            <Text style={s.taskerHeroName}>{tName}</Text>
            <View style={s.ratingRow}>
              {[1,2,3,4,5].map(i => (
                <Ionicons key={i} name={i <= Math.round(tRating || 5) ? 'star' : 'star-outline'} size={18} color="#f59e0b" />
              ))}
              <Text style={[s.ratingText, { marginLeft: 6 }]}>{tRating > 0 ? tRating.toFixed(1) : 'New'} · {tReviews} reviews</Text>
            </View>
            <Text style={s.taskerHeroRate}>${tRate}/hr</Text>
          </View>

          {/* Task summary */}
          <View style={s.bookingSummaryCard}>
            <Text style={s.bookingSummaryTitle}>Order details</Text>
            <View style={s.bookingSummaryRow}>
              <Ionicons name="construct-outline" size={16} color="#6b7280" />
              <Text style={s.bookingSummaryText}>{booking.skillName}</Text>
            </View>
            <View style={s.bookingSummaryRow}>
              <Ionicons name="location-outline" size={16} color="#6b7280" />
              <Text style={s.bookingSummaryText}>{booking.address}, {booking.city}</Text>
            </View>
            <View style={s.bookingSummaryRow}>
              <Ionicons name="calendar-outline" size={16} color="#6b7280" />
              <Text style={s.bookingSummaryText}>{booking.date} at {booking.time}</Text>
            </View>
          </View>

          {/* Bio */}
          {tProfile.bio ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>About the pro</Text>
              <Text style={s.bioText}>{tProfile.bio}</Text>
            </View>
          ) : null}

          {/* Skills */}
          {tSkills.length > 0 ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Skills</Text>
              <View style={s.skillsWrap}>
                {tSkills.slice(0, 8).map((sk: any, i: number) => (
                  <View key={i} style={s.skillBadge}>
                    <Text style={s.skillBadgeText}>{typeof sk === 'string' ? sk : sk.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Portfolio */}
          {tPhotos.length > 0 ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Work photos</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {tPhotos.map((photo: string, i: number) => (
                  <Image key={i} source={{ uri: photo }} style={s.portfolioThumb} />
                ))}
              </ScrollView>
            </View>
          ) : null}
        </ScrollView>

        {/* Book button */}
        <View style={s.bottomBar}>
          <TouchableOpacity style={s.nextBtn} onPress={() => setStep('confirm')}>
            <Text style={s.nextBtnText}>Book</Text>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // STEP: CONFIRM
  if (step === 'confirm') {
    // Loading overlay while auto-submitting a resumed booking after register
    if (resumingBooking) {
      return (
        <View style={[s.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
          <View style={{ alignItems: 'center', gap: 16 }}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Finishing your booking…</Text>
            <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', maxWidth: 280 }}>
              Thanks for registering! We're handing the task to the pro.
            </Text>
          </View>
        </View>
      );
    }
    const tasker = booking.selectedTasker!;
    const cProfile = tasker.profile || {};
    const cBaseRate = cProfile.hourly_rate || tasker.hourly_rate || 25;
    const cRate = tasker.final_hourly_rate
      ? Math.round(tasker.final_hourly_rate)
      : Math.round(cBaseRate * 1.15);
    const cRating = tasker.average_rating || tasker.rating || 0;
    const cName = tasker.name || tasker.full_name || tasker.username || 'Pro';
    return (
      <View style={s.container}>
        <View style={s.stepHeader}>
          <TouchableOpacity onPress={goBack} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={s.stepTitle}>Confirmation</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
          <View style={s.confirmCard}>
            <Text style={s.confirmTitle}>Order details</Text>
            {[
              { icon: 'construct-outline', label: 'Service', value: booking.skillName },
              { icon: 'document-text-outline', label: 'Description', value: booking.taskDescription },
              { icon: 'location-outline', label: 'Address', value: `${booking.address}, ${booking.city}` },
              {
                icon: 'calendar-outline',
                label: 'Date',
                value: anyDayTime
                  ? 'Any convenient day'
                  : booking.dates.length > 1
                    ? booking.dates.join(', ')
                    : booking.date || booking.dates[0] || 'not specified'
              },
              {
                icon: 'time-outline',
                label: 'Time',
                value: anyDayTime
                  ? 'Any convenient time'
                  : booking.timeFrom
                    ? (booking.timeTo ? `${booking.timeFrom} – ${booking.timeTo}` : booking.timeFrom)
                    : booking.time || 'not specified'
              },
            ].map(row => (
              <View key={row.label} style={s.confirmRow}>
                <Ionicons name={row.icon as any} size={18} color="#6b7280" style={{ width: 24 }} />
                <View style={{ flex: 1 }}>
                  <Text style={s.confirmLabel}>{row.label}</Text>
                  <Text style={s.confirmValue}>{row.value}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Tasker card */}
          <View style={s.confirmTaskerCard}>
            {tasker.picture && !tasker.picture.includes('base64') ? (
              <Image source={{ uri: tasker.picture }} style={s.confirmTaskerAvatar} />
            ) : (
              <View style={[s.confirmTaskerAvatar, { backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ fontSize: 22, color: '#fff', fontWeight: '700' }}>{cName[0]?.toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.taskerName}>{cName}</Text>
              <View style={s.ratingRow}>
                <Ionicons name="star" size={14} color="#f59e0b" />
                <Text style={s.ratingText}>{cRating > 0 ? cRating.toFixed(1) : 'New'}</Text>
              </View>
            </View>
            <Text style={s.taskerRate}>${cRate}/hr</Text>
          </View>

          {/* Photos preview in confirm */}
          {booking.photos.length > 0 && (
            <View style={[s.confirmCard, { marginBottom: 16 }]}>
              <Text style={s.confirmTitle}>Task photos ({booking.photos.length})</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {booking.photos.map((photo, idx) => (
                    <Image
                      key={idx}
                      source={{ uri: `data:image/jpeg;base64,${photo}` }}
                      style={{ width: 80, height: 80, borderRadius: 10 }}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {!user ? (
            <View style={s.registerBanner}>
              <Ionicons name="information-circle" size={22} color="#1d4ed8" />
              <View style={{ flex: 1 }}>
                <Text style={s.registerBannerTitle}>Registration required</Text>
                <Text style={s.registerBannerText}>
                  To let a pro accept your task and contact you, create an account. It takes less than a minute — after registering we'll finish the booking automatically.
                </Text>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={s.bottomBar}>
          <TouchableOpacity style={s.nextBtn} onPress={submitBooking} disabled={booking_submitting}>
            {booking_submitting ? <ActivityIndicator color="#fff" /> : (
              <>
                <Text style={s.nextBtnText}>
                  {user ? 'Confirm booking' : 'Register and finish'}
                </Text>
                <Ionicons name={user ? 'checkmark-circle' : 'log-in'} size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── SUCCESS STEP ──────────────────────────────────────────────────────────
  if (step === 'success') {
    const tasker = booking.selectedTasker;
    const taskerName = tasker ? `${tasker.first_name || ''} ${tasker.last_name || ''}`.trim() : '';
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <View style={{ alignItems: 'center', gap: 20 }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark-circle" size={56} color="#10b981" />
          </View>
          <Text style={{ fontSize: 26, fontWeight: '800', color: '#111827', textAlign: 'center' }}>Booking confirmed!</Text>
          <Text style={{ fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22 }}>
            {taskerName ? `Pro ${taskerName} received your order.` : 'Your order has been accepted.'}{`\n`}Please wait for the pro to confirm.
          </Text>
          <View style={{ width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 10, borderWidth: 1, borderColor: '#e5e7eb' }}>
            <Text style={{ fontWeight: '700', fontSize: 15, color: '#111827' }}>Order details</Text>
            <Text style={{ color: '#6b7280' }}>📋 {booking.skillName || booking.categoryName}</Text>
            {booking.address ? <Text style={{ color: '#6b7280' }}>📍 {booking.address}, {booking.city}</Text> : null}
            {booking.date || (booking.dates.length > 0) ? <Text style={{ color: '#6b7280' }}>📅 {booking.dates.length > 0 ? booking.dates[0] : booking.date} at {booking.timeFrom || booking.time}</Text> : null}
          </View>
          <TouchableOpacity
            style={[s.nextBtn, { width: '100%', marginTop: 8 }]}
            onPress={() => {
              setStep('home');
              setBooking({ categoryId: '', categoryName: '', skillName: '', taskDescription: '', address: '', city: '', dates: [], date: '', timeFrom: '', timeTo: '', time: '', selectedTasker: null, photos: [] });
              router.replace('/(tabs)/bookings');
            }}
          >
            <Text style={s.nextBtnText}>View my orders</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={{ paddingVertical: 12 }}
            onPress={() => {
              setStep('home');
              setBooking({ categoryId: '', categoryName: '', skillName: '', taskDescription: '', address: '', city: '', dates: [], date: '', timeFrom: '', timeTo: '', time: '', selectedTasker: null, photos: [] });
            }}
          >
            <Text style={{ color: '#6b7280', fontSize: 14 }}>Back to home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return null;
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  greeting: { fontSize: 22, fontWeight: '700', color: '#111827' },
  headerSub: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 16, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', gap: 10 },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },
  searchCamBtn: { backgroundColor: '#2563eb', width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  photoCta: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginHorizontal: 16, marginTop: -6, marginBottom: 6, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#eff6ff', borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe' },
  photoCtaText: { color: '#1d4ed8', fontWeight: '700', fontSize: 13.5 },
  photoCtaBadge: { backgroundColor: '#2563eb', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  photoCtaBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  photoResultImg: { width: '100%', height: 200, borderRadius: 16, marginBottom: 16, backgroundColor: '#e5e7eb' },
  detectCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  detectSkill: { fontSize: 20, fontWeight: '800', color: '#111827', flex: 1 },
  confBadge: { backgroundColor: '#dcfce7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  confBadgeText: { color: '#15803d', fontSize: 12, fontWeight: '700' },
  detectCat: { fontSize: 13, color: '#2563eb', fontWeight: '600', marginTop: 4 },
  detectSummary: { fontSize: 14, color: '#374151', lineHeight: 20, marginTop: 10 },
  estRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  estTile: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'flex-start', gap: 6 },
  estLabel: { fontSize: 12, color: '#6b7280' },
  estValue: { fontSize: 18, fontWeight: '800', color: '#111827' },
  estNote: { fontSize: 12, color: '#9ca3af', marginTop: 8 },
  proMini: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 10 },
  proEmpty: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f3f4f6', borderRadius: 12, padding: 14, marginTop: 4 },
  proEmptyText: { flex: 1, fontSize: 13, color: '#6b7280', lineHeight: 18 },
  secondaryBtn: { marginTop: 10, alignItems: 'center', paddingVertical: 12 },
  secondaryBtnText: { color: '#2563eb', fontSize: 14, fontWeight: '700' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  catCard: { width: '47%', aspectRatio: 1, borderRadius: 16, padding: 16, justifyContent: 'space-between', gap: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  catIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  catName: { fontSize: 15, fontWeight: '700', lineHeight: 18 },
  catCount: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  popularRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#f3f4f6', gap: 12 },
  popularEmoji: { fontSize: 24 },
  popularName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  popularCat: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  stepTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  stepSubtitle: { fontSize: 16, color: '#374151', marginBottom: 20 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  skillRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#f3f4f6', gap: 12 },
  skillDot: { width: 10, height: 10, borderRadius: 5 },
  skillRowText: { flex: 1, fontSize: 16, color: '#111827' },
  selectedSkillBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 20, gap: 8, alignSelf: 'flex-start' },
  selectedSkillText: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 4 },
  input: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827', marginBottom: 16 },
  textArea: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827', minHeight: 120, marginBottom: 8 },
  hint: { fontSize: 13, color: '#9ca3af', marginBottom: 20 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  chipActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  chipText: { fontSize: 14, color: '#374151' },
  chipTextActive: { color: '#2563eb', fontWeight: '600' },
  dateChip: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', marginRight: 8, minWidth: 64 },
  dateChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  dateDayName: { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  dateLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  timesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timeChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  timeChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  timeChipText: { fontSize: 14, color: '#374151' },
  timeChipTextActive: { color: '#fff', fontWeight: '600' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 16, gap: 8 },
  nextBtnDisabled: { backgroundColor: '#93c5fd' },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  summaryBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 6 },
  summaryText: { fontSize: 13, color: '#6b7280' },
  taskerCount: { fontSize: 14, color: '#6b7280', marginBottom: 12 },
  taskerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#f3f4f6', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  taskerCardLeft: { position: 'relative' },
  taskerAvatar: { width: 56, height: 56, borderRadius: 28 },
  eliteBadge: { position: 'absolute', bottom: -4, left: 0, right: 0, backgroundColor: '#f59e0b', borderRadius: 4, alignItems: 'center' },
  eliteBadgeText: { fontSize: 8, fontWeight: '800', color: '#fff', paddingHorizontal: 2 },
  taskerName: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
  ratingText: { fontSize: 13, fontWeight: '600', color: '#111827' },
  reviewCount: { fontSize: 12, color: '#6b7280' },
  taskerSkills: { fontSize: 12, color: '#6b7280' },
  taskerCardRight: { alignItems: 'flex-end' },
  taskerRate: { fontSize: 18, fontWeight: '800', color: '#2563eb' },
  taskerRateLabel: { fontSize: 12, color: '#6b7280' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#9ca3af', marginTop: 6, textAlign: 'center' },
  retryBtn: { marginTop: 20, backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  taskerHero: { alignItems: 'center', backgroundColor: '#fff', paddingVertical: 28, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  taskerHeroAvatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 12 },
  taskerHeroName: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 6 },
  taskerHeroRate: { fontSize: 20, fontWeight: '700', color: '#2563eb', marginTop: 6 },
  bookingSummaryCard: { margin: 16, backgroundColor: '#eff6ff', borderRadius: 14, padding: 16 },
  bookingSummaryTitle: { fontSize: 14, fontWeight: '700', color: '#1d4ed8', marginBottom: 10 },
  bookingSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  bookingSummaryText: { fontSize: 14, color: '#374151' },
  section: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  bioText: { fontSize: 14, color: '#374151', lineHeight: 22 },
  skillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  skillBadge: { backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  skillBadgeText: { fontSize: 13, color: '#374151' },
  portfolioThumb: { width: 120, height: 90, borderRadius: 10, marginRight: 10 },
  confirmCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#f3f4f6' },
  confirmTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 14 },
  confirmRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  confirmLabel: { fontSize: 12, color: '#9ca3af', marginBottom: 2 },
  confirmValue: { fontSize: 14, color: '#111827', fontWeight: '500' },
  confirmTaskerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#f3f4f6' },
  confirmTaskerAvatar: { width: 52, height: 52, borderRadius: 26 },
  priceSummary: { backgroundColor: '#f0fdf4', borderRadius: 14, padding: 16, marginBottom: 16 },
  priceSummaryTitle: { fontSize: 15, fontWeight: '700', color: '#15803d', marginBottom: 4 },
  priceSummaryNote: { fontSize: 12, color: '#6b7280', marginBottom: 8 },
  priceSummaryRate: { fontSize: 24, fontWeight: '800', color: '#15803d' },
  geoBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#eff6ff', borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe', paddingHorizontal: 16, paddingVertical: 12, marginBottom: 20 },
  geoBtnText: { fontSize: 15, color: '#2563eb', fontWeight: '600', flex: 1 },
  suggestionsBox: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', marginTop: -12, marginBottom: 16, overflow: 'hidden' },
  suggestionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  suggestionText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 },
  // Photo upload styles
  photosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  photoThumbWrap: { position: 'relative', width: 80, height: 80 },
  photoThumb: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#f3f4f6' },
  photoRemoveBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: '#fff', borderRadius: 10 },
  photoAddBtn: { width: 80, height: 80, borderRadius: 12, borderWidth: 2, borderColor: '#bfdbfe', borderStyle: 'dashed', backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', gap: 4 },
  photoAddText: { fontSize: 11, color: '#2563eb', fontWeight: '600' },

  // Premium photo-cover category card
  catCardPhoto: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
    backgroundColor: '#e5e7eb',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  catCardPhotoImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  catCardPhotoOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  catCardPhotoBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#fff',
    borderRadius: 999,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catCardPhotoTextWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
  },
  catCardPhotoName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowRadius: 4,
  },
  catCardPhotoCount: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },

  // Landing hero (guest)
  heroHeader: { backgroundColor: '#2563eb', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 24 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  heroBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroLogo: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  heroBrandText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  heroAuthBtns: { flexDirection: 'row', gap: 8 },
  heroLoginBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  heroLoginBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  heroSignupBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#fff' },
  heroSignupBtnText: { color: '#2563eb', fontWeight: '700', fontSize: 14 },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '800', lineHeight: 30, marginBottom: 6 },
  heroSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20 },

  // How it works section (landing)
  howItWorks: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 8, borderWidth: 1, borderColor: '#f3f4f6' },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  stepCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stepNum: { fontSize: 16, fontWeight: '800' },
  stepTitleSm: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 2 },
  stepDesc: { fontSize: 13, color: '#6b7280', lineHeight: 18 },

  registerBanner: { flexDirection: 'row', gap: 10, backgroundColor: '#dbeafe', borderColor: '#bfdbfe', borderWidth: 1, padding: 14, borderRadius: 12, marginTop: 12, alignItems: 'flex-start' },
  registerBannerTitle: { fontSize: 15, fontWeight: '700', color: '#1d4ed8', marginBottom: 4 },
  registerBannerText: { fontSize: 13, color: '#1e40af', lineHeight: 18 },
});
