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

// ─── SKILL CATEGORIES (same as provider profile) ─────────────────────────────
const SKILL_CATEGORIES = [
  {
    id: 'assembly', name: 'Збірка меблів', icon: 'cube-outline' as const,
    color: '#2563eb', bg: '#eff6ff',
    skills: ['Збірка меблів IKEA', 'Збірка офісних меблів', 'Збірка ліжок', 'Збірка шаф', 'Монтаж полиць', 'Монтаж телевізора'],
  },
  {
    id: 'cleaning', name: 'Прибирання', icon: 'sparkles-outline' as const,
    color: '#0891b2', bg: '#ecfeff',
    skills: ['Прибирання будинку', 'Генеральне прибирання', 'Прибирання офісу', 'Прибирання при переїзді', 'Миття вікон', 'Чищення килимів'],
  },
  {
    id: 'home_improvements', name: 'Ремонт будинку', icon: 'hammer-outline' as const,
    color: '#7c3aed', bg: '#f5f3ff',
    skills: ['Встановлення техніки', 'Ремонт дверей та меблів', 'Фарбування', 'Укладання плитки', 'Укладання підлоги', 'Гіпсокартон', 'Сантехніка', 'Електрика'],
  },
  {
    id: 'moving', name: 'Переїзд та доставка', icon: 'car-outline' as const,
    color: '#d97706', bg: '#fffbeb',
    skills: ['Допомога з переїздом', 'Пакування речей', 'Перенесення меблів', 'Доставка', 'Вивіз сміття'],
  },
  {
    id: 'outdoor', name: 'Зовнішні роботи', icon: 'leaf-outline' as const,
    color: '#16a34a', bg: '#f0fdf4',
    skills: ['Догляд за газоном', 'Прибирання снігу', 'Садівництво', 'Миття під тиском', 'Встановлення огорожі'],
  },
  {
    id: 'personal', name: 'Особиста допомога', icon: 'person-outline' as const,
    color: '#db2777', bg: '#fdf2f8',
    skills: ['Доручення', 'Шопінг-асистент', 'Догляд за тваринами', 'Допомога літнім людям'],
  },
  {
    id: 'it_tech', name: 'IT та техніка', icon: 'laptop-outline' as const,
    color: '#0f766e', bg: '#f0fdfa',
    skills: ['Налаштування комп\'ютера', 'Налаштування Smart TV', 'Ремонт телефонів', 'Налаштування мережі', 'Відновлення даних'],
  },
  {
    id: 'events', name: 'Заходи та свята', icon: 'balloon-outline' as const,
    color: '#9333ea', bg: '#faf5ff',
    skills: ['Організація заходів', 'Фотографія', 'Допомога на кухні', 'Бармен'],
  },
  {
    id: 'other', name: 'Інше', icon: 'ellipsis-horizontal-outline' as const,
    color: '#6b7280', bg: '#f9fafb',
    skills: ['Майстер на всі руки', 'Репетиторство', 'Переклад', 'Водій'],
  },
];

// ─── BOOKING FLOW STEPS ───────────────────────────────────────────────────────
type BookingStep = 'home' | 'skills' | 'details' | 'address' | 'datetime' | 'taskers' | 'tasker_profile' | 'confirm' | 'success';

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
  const days = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const months = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру'];
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
  posted:                    { label: 'Нове',              color: '#2563eb', bg: '#eff6ff' },
  offering:                  { label: 'Пропозиції',        color: '#7c3aed', bg: '#f5f3ff' },
  assigned:                  { label: 'Призначено',        color: '#d97706', bg: '#fffbeb' },
  hold_placed:               { label: 'Оплата підтвердж.', color: '#059669', bg: '#ecfdf5' },
  on_the_way:                { label: 'В дорозі',          color: '#0891b2', bg: '#ecfeff' },
  started:                   { label: 'В роботі',          color: '#ea580c', bg: '#fff7ed' },
  completed_pending_payment: { label: 'Очікує оплати',     color: '#ca8a04', bg: '#fefce8' },
  paid:                      { label: 'Оплачено',          color: '#16a34a', bg: '#f0fdf4' },
  cancelled:                 { label: 'Скасовано',         color: '#dc2626', bg: '#fef2f2' },
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

  const displayed = activeTab === 'available' ? tasks : myTasks;

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header */}
      <View style={{ paddingTop: 56, paddingHorizontal: 20, paddingBottom: 12, backgroundColor: '#fff' }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: '#111827' }}>
          Привіт, {user?.name?.split(' ')[0] || 'Виконавцю'} 👋
        </Text>
        <Text style={{ fontSize: 14, color: '#6b7280', marginTop: 2 }}>Ваші завдання на сьогодні</Text>
      </View>

      {/* Stats row — clickable tiles */}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 12 }}>
        {[
          { label: 'Нові', count: tasks.length, color: '#2563eb', bg: '#eff6ff', tab: 'available' },
          { label: 'Мої', count: myTasks.filter(t => ['assigned','on_the_way','started'].includes(t.status)).length, color: '#059669', bg: '#ecfdf5', tab: 'my' },
          { label: 'Виконано', count: myTasks.filter(t => ['paid','completed_pending_payment','completed'].includes(t.status)).length, color: '#7c3aed', bg: '#f5f3ff', tab: 'done' },
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
              {tab === 'available' ? '🔍 Доступні' : '📋 Мої завдання'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#9ca3af' }}>Завдань немає</Text>
              <Text style={{ fontSize: 14, color: '#9ca3af', textAlign: 'center' }}>
                {activeTab === 'available' ? 'Нових завдань у вашій зоні поки немає' : 'Ви ще не прийняли жодного завдання'}
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
                  {task.estimated_price ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="cash-outline" size={13} color="#9ca3af" /><Text style={{ fontSize: 12, color: '#9ca3af' }}>{task.estimated_price} ₴/год</Text></View> : null}
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
  const submittingRef = useRef(false); // synchronous guard against rapid double-taps
  const [searchQuery, setSearchQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [userCountry, setUserCountry] = useState<string>('UA'); // default Ukraine
  const [quickCities, setQuickCities] = useState<string[]>(['Київ', 'Харків', 'Одеса', 'Дніпро', 'Львів', 'Запоріжжя']);
  const [calDayIdx, setCalDayIdx] = useState(0); // for datetime step — must be here (Rules of Hooks)
  const [anyDayTime, setAnyDayTime] = useState(false); // "any day and time" checkbox
  const dates = getDates();

  // Detect user country via IP on mount
  React.useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(data => {
        const country = data.country_code || 'UA';
        const city = data.city || '';
        setUserCountry(country);
        const CITIES_BY_COUNTRY: Record<string, string[]> = {
          UA: ['Київ', 'Харків', 'Одеса', 'Дніпро', 'Львів', 'Запоріжжя'],
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
    setStep('skills');
  };

  const selectSkill = (skill: string) => {
    setBooking(b => ({ ...b, skillName: skill }));
    setStep('details');
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
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(booking.city)}&limit=1&accept-language=uk`,
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
      Alert.alert('Геолокація', 'Геолокація не підтримується у цьому браузері');
      return;
    }
    setLoadingGeo(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=uk`,
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
          Alert.alert('Помилка', 'Не вдалося визначити адресу');
        } finally {
          setLoadingGeo(false);
        }
      },
      () => {
        setLoadingGeo(false);
        Alert.alert('Геолокація', 'Не вдалося отримати доступ до геолокації. Введіть адресу вручну.');
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
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&accept-language=uk,en&addressdetails=1`,
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
    submittingRef.current = true;
    setBookingSubmitting(true);

    const tasker = booking.selectedTasker;
    const rate = tasker.profile?.hourly_rate || tasker.hourly_rate || 0;
    const primaryDate = booking.dates.length > 0 ? booking.dates[0] : booking.date;

    // Build notes with date/time info
    let notes = '';
    if ((booking as any)._anyDayTime) {
      notes = 'Підходить будь-який день і час';
    } else if (booking.dates.length > 1) {
      notes = `Зручні дати: ${booking.dates.join(', ')}. Час: ${booking.timeFrom}${booking.timeTo ? '–' + booking.timeTo : ''}`;
    } else if (booking.timeTo) {
      notes = `Час: ${booking.timeFrom}–${booking.timeTo}`;
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

  const filteredCategories = SKILL_CATEGORIES.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.skills.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
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
                  <Text style={s.heroLoginBtnText}>Увійти</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/register')} style={s.heroSignupBtn}>
                  <Text style={s.heroSignupBtnText}>Реєстрація</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={s.heroTitle}>Знайдіть надійного майстра поряд</Text>
            <Text style={s.heroSubtitle}>Замовляйте послуги в кілька кліків. Реєстрація не обов'язкова.</Text>
          </View>
        ) : (
          <View style={s.header}>
            <View>
              <Text style={s.greeting}>Привіт, {user?.full_name?.split(' ')[0] || user?.username || 'Клієнт'} 👋</Text>
              <Text style={s.headerSub}>Що потрібно зробити сьогодні?</Text>
            </View>
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
        )}

        {/* Search */}
        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={20} color="#9ca3af" />
          <TextInput
            style={s.searchInput}
            placeholder={isGuest ? 'Що потрібно зробити? (наприклад: збірка меблів)' : 'Пошук послуги...'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9ca3af"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Category grid */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          <Text style={s.sectionTitle}>Оберіть категорію</Text>
          <View style={s.grid}>
            {filteredCategories.map(cat => {
              const dbCat = dbCatById[cat.id];
              const coverImage = dbCat?.image;
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
                      <Text style={s.catCardPhotoCount}>{cat.skills.length} послуг</Text>
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
                  <Text style={s.catCount}>{cat.skills.length} послуг</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Popular tasks */}
          <Text style={[s.sectionTitle, { marginTop: 24 }]}>Популярні завдання</Text>
          {[
            { skill: 'Збірка меблів IKEA', cat: SKILL_CATEGORIES[0], emoji: '🪑' },
            { skill: 'Регулярне прибирання', cat: SKILL_CATEGORIES[1], emoji: '🧹' },
            { skill: 'Дрібний ремонт', cat: SKILL_CATEGORIES[2], emoji: '🔧' },
            { skill: 'Допомога з переїздом', cat: SKILL_CATEGORIES[3], emoji: '📦' },
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
              <Text style={[s.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>Як це працює</Text>
              <View style={s.stepRow}>
                <View style={[s.stepCircle, { backgroundColor: '#eff6ff' }]}>
                  <Text style={[s.stepNum, { color: '#2563eb' }]}>1</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.stepTitleSm}>Опишіть завдання</Text>
                  <Text style={s.stepDesc}>Оберіть категорію та коротко опишіть, що треба зробити.</Text>
                </View>
              </View>
              <View style={s.stepRow}>
                <View style={[s.stepCircle, { backgroundColor: '#f0fdf4' }]}>
                  <Text style={[s.stepNum, { color: '#16a34a' }]}>2</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.stepTitleSm}>Оберіть виконавця</Text>
                  <Text style={s.stepDesc}>Перегляньте профілі, рейтинги та ціни — оберіть кращого.</Text>
                </View>
              </View>
              <View style={s.stepRow}>
                <View style={[s.stepCircle, { backgroundColor: '#fef3c7' }]}>
                  <Text style={[s.stepNum, { color: '#d97706' }]}>3</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.stepTitleSm}>Замовте без реєстрації</Text>
                  <Text style={s.stepDesc}>Підтвердіть бронювання — рахунок створиться автоматично.</Text>
                </View>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  // STEP: SKILLS — list of skills in category
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
          <Text style={s.stepSubtitle}>Яку послугу вам потрібно?</Text>
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
          <Text style={s.stepTitle}>Деталі завдання</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
          <View style={s.selectedSkillBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#2563eb" />
            <Text style={s.selectedSkillText}>{booking.skillName}</Text>
          </View>
          <Text style={s.fieldLabel}>Опишіть завдання</Text>
          <TextInput
            style={[s.textArea]}
            placeholder="Наприклад: Потрібно зібрати диван IKEA FRIHETEN, є всі деталі та інструкція..."
            value={booking.taskDescription}
            onChangeText={v => setBooking(b => ({ ...b, taskDescription: v }))}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            placeholderTextColor="#9ca3af"
          />
          <Text style={s.hint}>Чим детальніше опис — тим точніше виконавець оцінить завдання</Text>

          {/* Photo upload section */}
          <Text style={[s.fieldLabel, { marginTop: 20 }]}>Фото проблеми (необов'язково)</Text>
          <Text style={[s.hint, { marginBottom: 12 }]}>Додайте до 5 фото, щоб виконавець краще зрозумів завдання</Text>
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
                  <Text style={s.photoAddText}>Додати{booking.photos.length > 0 ? ' ще' : ''}</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={s.photoAddBtn}
                  onPress={() => {
                    Alert.alert('Додати фото', 'Виберіть джерело', [
                      {
                        text: 'Камера',
                        onPress: async () => {
                          const perm = await ImagePicker.requestCameraPermissionsAsync();
                          if (!perm.granted) { Alert.alert('Помилка', 'Потрібен доступ до камери'); return; }
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
                        text: 'Галерея',
                        onPress: async () => {
                          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                          if (!perm.granted) { Alert.alert('Помилка', 'Потрібен доступ до галереї'); return; }
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
                      { text: 'Скасувати', style: 'cancel' },
                    ]);
                  }}
                >
                  <Ionicons name="camera-outline" size={28} color="#2563eb" />
                  <Text style={s.photoAddText}>Додати{booking.photos.length > 0 ? ' ще' : ''}</Text>
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
            <Text style={s.nextBtnText}>Далі — Адреса</Text>
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
          <Text style={s.stepTitle}>Адреса</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          <Text style={s.stepSubtitle}>Де потрібно виконати завдання?</Text>

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
              {loadingGeo ? 'Визначаємо місцезнаходження...' : 'Визначити моє місцезнаходження'}
            </Text>
          </TouchableOpacity>

          <Text style={s.fieldLabel}>Місто</Text>
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
            placeholder="або введіть місто..."
            value={booking.city}
            onChangeText={v => setBooking(b => ({ ...b, city: v }))}
            placeholderTextColor="#9ca3af"
          />

          <Text style={s.fieldLabel}>Вулиця та номер будинку</Text>
          <TextInput
            style={s.input}
            placeholder="вул. Хрещатик, 1"
            value={booking.address}
            onChangeText={v => {
              setBooking(b => ({ ...b, address: v }));
              searchAddress(`${v}, ${booking.city}`);
            }}
            placeholderTextColor="#9ca3af"
          />
          {/* Address autocomplete suggestions */}
          {addressSuggestions.length > 0 && (
            <View style={s.suggestionsBox}>
              {addressSuggestions.map((s2: any, i: number) => (
                <TouchableOpacity
                  key={i}
                  style={s.suggestionRow}
                  onPress={() => {
                    const parts = s2.display_name.split(',');
                    const street = parts[0]?.trim() || s2.display_name;
                    // Try to extract city from address components
                    const addr = s2.address || {};
                    const city = addr.city || addr.town || addr.village || addr.county || parts[2]?.trim() || parts[1]?.trim() || '';
                    // Save lat/lng from Nominatim result so radius search works
                    const selLat = s2.lat ? parseFloat(s2.lat) : undefined;
                    const selLng = s2.lon ? parseFloat(s2.lon) : undefined;
                    setBooking(b => ({ ...b, address: street, city: city || b.city, lat: selLat ?? b.lat, lng: selLng ?? b.lng }));
                    setAddressSuggestions([]);
                  }}
                >
                  <Ionicons name="location-outline" size={16} color="#6b7280" />
                  <Text style={s.suggestionText} numberOfLines={2}>{s2.display_name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
        <View style={s.bottomBar}>
          <TouchableOpacity
            style={[s.nextBtn, (!booking.address.trim() || !booking.city.trim()) && s.nextBtnDisabled]}
            disabled={!booking.address.trim() || !booking.city.trim()}
            onPress={() => { setAddressSuggestions([]); setStep('datetime'); }}
          >
            <Text style={s.nextBtnText}>Далі — Дата і час</Text>
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
          <Text style={s.stepTitle}>Дата і час</Text>
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
              {isDateSelected ? 'Вибрано' : 'Вибрати день'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Time range selector: from / to */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
          {/* Two-column header */}
          <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, gap: 8 }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151' }}>З (початок)</Text>
              {booking.timeFrom ? (
                <View style={{ backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, marginTop: 4 }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{booking.timeFrom}</Text>
                </View>
              ) : (
                <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>не вибрано</Text>
              )}
            </View>
            <View style={{ width: 1, backgroundColor: '#e5e7eb' }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151' }}>До (кінець)</Text>
              {booking.timeTo ? (
                <View style={{ backgroundColor: '#059669', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, marginTop: 4 }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{booking.timeTo}</Text>
                </View>
              ) : (
                <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>не вибрано</Text>
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
                        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>— обрано</Text>
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
              Підходить будь-який день і час
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
              ✅ Будь-який зручний час
            </Text>
          )}
          <TouchableOpacity
            style={[s.nextBtn, !canProceed && s.nextBtnDisabled]}
            disabled={!canProceed}
            onPress={() => { loadTaskers(); setStep('taskers'); }}
          >
            <Text style={s.nextBtnText}>Знайти виконавців</Text>
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
          <Text style={s.stepTitle}>Виконавці</Text>
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
            <Text style={{ marginTop: 12, color: '#6b7280' }}>Шукаємо виконавців поблизу...</Text>
          </View>
        ) : taskers.length === 0 ? (
          <View style={s.centered}>
            <Ionicons name="people-outline" size={64} color="#d1d5db" />
            <Text style={s.emptyTitle}>Виконавців не знайдено</Text>
            <Text style={s.emptyText}>Спробуйте змінити місто або дату</Text>
            <TouchableOpacity style={s.retryBtn} onPress={() => setStep('address')}>
              <Text style={s.retryBtnText}>Змінити адресу</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
            <Text style={s.taskerCount}>{taskers.length} виконавців у {booking.city}</Text>
            {taskers.map((tasker, idx) => {
              const profile = tasker.profile || {};
              // Use final_hourly_rate (includes commission) if available, otherwise apply 15% commission
              const baseRate = profile.hourly_rate || tasker.hourly_rate || 25;
              const rate = tasker.final_hourly_rate
                ? Math.round(tasker.final_hourly_rate)
                : Math.round(baseRate * 1.15);
              const rating = tasker.average_rating || tasker.rating || 0;
              const reviews = tasker.total_reviews || tasker.review_count || 0;
              const displayName = tasker.name || tasker.full_name || tasker.username || 'Виконавець';
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
                    <Text style={s.ratingText}>{rating > 0 ? rating.toFixed(1) : 'Новий'}</Text>
                    <Text style={s.reviewCount}>({reviews} відгуків)</Text>
                  </View>
                  <Text style={s.taskerSkills} numberOfLines={1}>
                    {skills.slice(0, 3).join(' · ') || 'Виконавець'}
                  </Text>
                </View>
                <View style={s.taskerCardRight}>
                  <Text style={s.taskerRate}>{rate} ₴</Text>
                  <Text style={s.taskerRateLabel}>/год</Text>
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
    const tName = tasker.name || tasker.full_name || tasker.username || 'Виконавець';
    const tSkills = Array.isArray(tProfile.skills) ? tProfile.skills : [];
    const tPhotos = Array.isArray(tProfile.portfolio_photos) ? tProfile.portfolio_photos : [];
    return (
      <View style={s.container}>
        <View style={s.stepHeader}>
          <TouchableOpacity onPress={goBack} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={s.stepTitle}>Профіль виконавця</Text>
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
              <Text style={[s.ratingText, { marginLeft: 6 }]}>{tRating > 0 ? tRating.toFixed(1) : 'Новий'} · {tReviews} відгуків</Text>
            </View>
            <Text style={s.taskerHeroRate}>{tRate} ₴/год</Text>
          </View>

          {/* Task summary */}
          <View style={s.bookingSummaryCard}>
            <Text style={s.bookingSummaryTitle}>Деталі замовлення</Text>
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
              <Text style={s.bookingSummaryText}>{booking.date} о {booking.time}</Text>
            </View>
          </View>

          {/* Bio */}
          {tProfile.bio ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Про виконавця</Text>
              <Text style={s.bioText}>{tProfile.bio}</Text>
            </View>
          ) : null}

          {/* Skills */}
          {tSkills.length > 0 ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Навички</Text>
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
              <Text style={s.sectionTitle}>Фото робіт</Text>
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
            <Text style={s.nextBtnText}>Забронювати</Text>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // STEP: CONFIRM
  if (step === 'confirm') {
    const tasker = booking.selectedTasker!;
    const cProfile = tasker.profile || {};
    const cBaseRate = cProfile.hourly_rate || tasker.hourly_rate || 25;
    const cRate = tasker.final_hourly_rate
      ? Math.round(tasker.final_hourly_rate)
      : Math.round(cBaseRate * 1.15);
    const cRating = tasker.average_rating || tasker.rating || 0;
    const cName = tasker.name || tasker.full_name || tasker.username || 'Виконавець';
    return (
      <View style={s.container}>
        <View style={s.stepHeader}>
          <TouchableOpacity onPress={goBack} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={s.stepTitle}>Підтвердження</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
          <View style={s.confirmCard}>
            <Text style={s.confirmTitle}>Деталі замовлення</Text>
            {[
              { icon: 'construct-outline', label: 'Послуга', value: booking.skillName },
              { icon: 'document-text-outline', label: 'Опис', value: booking.taskDescription },
              { icon: 'location-outline', label: 'Адреса', value: `${booking.address}, ${booking.city}` },
              {
                icon: 'calendar-outline',
                label: 'Дата',
                value: anyDayTime
                  ? 'Будь-який зручний день'
                  : booking.dates.length > 1
                    ? booking.dates.join(', ')
                    : booking.date || booking.dates[0] || 'не вказано'
              },
              {
                icon: 'time-outline',
                label: 'Час',
                value: anyDayTime
                  ? 'Будь-який зручний час'
                  : booking.timeFrom
                    ? (booking.timeTo ? `${booking.timeFrom} – ${booking.timeTo}` : booking.timeFrom)
                    : booking.time || 'не вказано'
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
                <Text style={s.ratingText}>{cRating > 0 ? cRating.toFixed(1) : 'Новий'}</Text>
              </View>
            </View>
            <Text style={s.taskerRate}>{cRate} ₴/год</Text>
          </View>

          {/* Photos preview in confirm */}
          {booking.photos.length > 0 && (
            <View style={[s.confirmCard, { marginBottom: 16 }]}>
              <Text style={s.confirmTitle}>Фото завдання ({booking.photos.length})</Text>
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

          <View style={s.priceSummary}>
            <Text style={s.priceSummaryTitle}>Орієнтовна вартість</Text>
            <Text style={s.priceSummaryNote}>Фінальна ціна узгоджується з виконавцем</Text>
            <Text style={s.priceSummaryRate}>{cRate} ₴/год</Text>
          </View>
        </ScrollView>

        <View style={s.bottomBar}>
          <TouchableOpacity style={s.nextBtn} onPress={submitBooking} disabled={booking_submitting}>
            {booking_submitting ? <ActivityIndicator color="#fff" /> : (
              <>
                <Text style={s.nextBtnText}>Підтвердити бронювання</Text>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
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
          <Text style={{ fontSize: 26, fontWeight: '800', color: '#111827', textAlign: 'center' }}>Бронювання підтверджено!</Text>
          <Text style={{ fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22 }}>
            {taskerName ? `Виконавець ${taskerName} отримав ваше замовлення.` : 'Ваше замовлення прийнято.'}{`\n`}Очікуйте підтвердження від виконавця.
          </Text>
          <View style={{ width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 10, borderWidth: 1, borderColor: '#e5e7eb' }}>
            <Text style={{ fontWeight: '700', fontSize: 15, color: '#111827' }}>Деталі замовлення</Text>
            <Text style={{ color: '#6b7280' }}>📋 {booking.skillName || booking.categoryName}</Text>
            {booking.address ? <Text style={{ color: '#6b7280' }}>📍 {booking.address}, {booking.city}</Text> : null}
            {booking.date || (booking.dates.length > 0) ? <Text style={{ color: '#6b7280' }}>📅 {booking.dates.length > 0 ? booking.dates[0] : booking.date} о {booking.timeFrom || booking.time}</Text> : null}
          </View>
          <TouchableOpacity
            style={[s.nextBtn, { width: '100%', marginTop: 8 }]}
            onPress={() => {
              setStep('home');
              setBooking({ categoryId: '', categoryName: '', skillName: '', taskDescription: '', address: '', city: '', dates: [], date: '', timeFrom: '', timeTo: '', time: '', selectedTasker: null, photos: [] });
              router.replace('/(tabs)/bookings');
            }}
          >
            <Text style={s.nextBtnText}>Переглянути мої замовлення</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={{ paddingVertical: 12 }}
            onPress={() => {
              setStep('home');
              setBooking({ categoryId: '', categoryName: '', skillName: '', taskDescription: '', address: '', city: '', dates: [], date: '', timeFrom: '', timeTo: '', time: '', selectedTasker: null, photos: [] });
            }}
          >
            <Text style={{ color: '#6b7280', fontSize: 14 }}>Повернутися на головну</Text>
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
});
