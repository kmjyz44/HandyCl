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
    skills: ['Збірка меблів IKEA', 'Збірка офісних меблів', 'Збірка ліжок', 'Збірка шаф', 'Збірка кухні', 'Збірка дитячих меблів'],
  },
  {
    id: 'cleaning', name: 'Прибирання', icon: 'sparkles-outline' as const,
    color: '#0891b2', bg: '#ecfeff',
    skills: ['Регулярне прибирання', 'Генеральне прибирання', 'Прибирання після ремонту', 'Прибирання офісу', 'Прибирання після переїзду', 'Миття вікон'],
  },
  {
    id: 'repair', name: 'Ремонт будинку', icon: 'hammer-outline' as const,
    color: '#d97706', bg: '#fffbeb',
    skills: ['Дрібний ремонт', 'Сантехніка', 'Електрика', 'Фарбування стін', 'Укладання плитки', 'Монтаж полиць', 'Встановлення дверей', 'Ремонт підлоги'],
  },
  {
    id: 'moving', name: 'Переїзд', icon: 'car-outline' as const,
    color: '#7c3aed', bg: '#f5f3ff',
    skills: ['Допомога з переїздом', 'Пакування речей', 'Вантажні послуги', 'Розпакування', 'Утилізація меблів'],
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
type BookingStep = 'home' | 'skills' | 'details' | 'address' | 'datetime' | 'taskers' | 'tasker_profile' | 'confirm';

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

      {/* Stats row */}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 12 }}>
        {[
          { label: 'Нові', count: tasks.length, color: '#2563eb', bg: '#eff6ff' },
          { label: 'Мої', count: myTasks.filter(t => ['assigned','on_the_way','started'].includes(t.status)).length, color: '#059669', bg: '#ecfdf5' },
          { label: 'Виконано', count: myTasks.filter(t => ['paid','completed_pending_payment'].includes(t.status)).length, color: '#7c3aed', bg: '#f5f3ff' },
        ].map(stat => (
          <View key={stat.label} style={{ flex: 1, backgroundColor: stat.bg, borderRadius: 14, padding: 14, alignItems: 'center' }}>
            <Text style={{ fontSize: 26, fontWeight: '800', color: stat.color }}>{stat.count}</Text>
            <Text style={{ fontSize: 12, color: stat.color, fontWeight: '600', marginTop: 2 }}>{stat.label}</Text>
          </View>
        ))}
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

  // Providers see their own tasks dashboard, not the client booking flow
  if (user?.role === 'provider') {
    return <ProviderDashboard />;
  }
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
      const data = await api.getExecutorsBySkill({
        skill: booking.skillName,
        category: booking.categoryId,
        city: booking.city,
      });
      setTaskers(Array.isArray(data) ? data : []);
    } catch {
      // Fallback: load all executors
      try {
        const data = await api.getExecutors();
        setTaskers(Array.isArray(data) ? data : []);
      } catch {
        setTaskers([]);
      }
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
          setBooking(b => ({ ...b, city, address: streetAddr }));
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
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ua&limit=5&accept-language=uk`,
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
    try {
      const tasker = booking.selectedTasker;
      const rate = tasker.profile?.hourly_rate || tasker.hourly_rate || 0;
      const primaryDate = booking.dates.length > 0 ? booking.dates[0] : booking.date;
      const result = await api.createBooking({
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
        notes: booking.dates.length > 1
          ? `Зручні дати: ${booking.dates.join(', ')}. Час: ${booking.timeFrom}–${booking.timeTo}`
          : booking.timeTo ? `Час: ${booking.timeFrom}–${booking.timeTo}` : undefined,
        total_price: rate,
      });
      // Add to local store so Bookings tab updates immediately
      addBooking({
        booking_id: result?.booking_id || `local_${Date.now()}`,
        client_id: user?.user_id || '',
        provider_id: tasker.user_id,
        service_id: '',
        date: primaryDate,
        time: booking.timeFrom || booking.time,
        address: `${booking.address}, ${booking.city}`,
        status: 'pending',
        total_price: rate,
        payment_status: 'pending',
      });
      // Reset and redirect immediately — no Alert
      submittingRef.current = false;
      setBookingSubmitting(false);
      setStep('home');
      setBooking({ categoryId: '', categoryName: '', skillName: '', taskDescription: '', address: '', city: '', dates: [], date: '', timeFrom: '', timeTo: '', time: '', selectedTasker: null, photos: [] });
      router.replace('/(tabs)/bookings');
    } catch (e: any) {
      Alert.alert('Помилка бронювання', e.message || 'Не вдалося створити бронювання. Спробуйте ще раз.');
      submittingRef.current = false;
      setBookingSubmitting(false); // re-enable only on error
    }
  };

  const filteredCategories = SKILL_CATEGORIES.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.skills.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // ── RENDER STEPS ──────────────────────────────────────────────────────────

  // STEP: HOME — category grid
  if (step === 'home') {
    return (
      <View style={s.container}>
        {/* Header */}
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

        {/* Search */}
        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={20} color="#9ca3af" />
          <TextInput
            style={s.searchInput}
            placeholder="Пошук послуги..."
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
            {filteredCategories.map(cat => (
              <TouchableOpacity key={cat.id} style={[s.catCard, { backgroundColor: cat.bg }]} onPress={() => selectCategory(cat)}>
                <View style={[s.catIcon, { backgroundColor: cat.color + '22' }]}>
                  <Ionicons name={cat.icon} size={28} color={cat.color} />
                </View>
                <Text style={[s.catName, { color: cat.color }]}>{cat.name}</Text>
                <Text style={s.catCount}>{cat.skills.length} послуг</Text>
              </TouchableOpacity>
            ))}
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
                    const city = parts[2]?.trim() || parts[1]?.trim() || '';
                    setBooking(b => ({ ...b, address: street, city: city || b.city }));
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
    const toggleDate = (val: string) => {
      setBooking(b => {
        const already = b.dates.includes(val);
        const newDates = already ? b.dates.filter(d => d !== val) : [...b.dates, val];
        return { ...b, dates: newDates, date: newDates[0] || '' };
      });
    };
    const canProceed = booking.dates.length > 0 && !!booking.timeFrom;
    return (
      <View style={s.container}>
        <View style={s.stepHeader}>
          <TouchableOpacity onPress={goBack} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={s.stepTitle}>Дата і час</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <Text style={s.stepSubtitle}>Коли вам зручно? Можна вибрати кілька дат</Text>

          {/* Multi-date picker */}
          <Text style={s.fieldLabel}>Дата {booking.dates.length > 0 && <Text style={{ color: '#2563eb', fontWeight: '700' }}>(вибрано: {booking.dates.length})</Text>}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
            {dates.map(d => {
              const active = booking.dates.includes(d.value);
              return (
                <TouchableOpacity key={d.value} style={[s.dateChip, active && s.dateChipActive]} onPress={() => toggleDate(d.value)}>
                  <Text style={[s.dateDayName, active && { color: '#fff' }]}>{d.dayName}</Text>
                  <Text style={[s.dateLabel, active && { color: '#fff', fontWeight: '700' }]}>{d.label}</Text>
                  {active && <Ionicons name="checkmark" size={12} color="#fff" style={{ marginTop: 2 }} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Time FROM */}
          <Text style={s.fieldLabel}>Час початку (з)</Text>
          <View style={s.timesGrid}>
            {TIMES.map(t => (
              <TouchableOpacity key={t} style={[s.timeChip, booking.timeFrom === t && s.timeChipActive]}
                onPress={() => setBooking(b => ({ ...b, timeFrom: t, time: t, timeTo: b.timeTo && b.timeTo <= t ? '' : b.timeTo }))}>
                <Text style={[s.timeChipText, booking.timeFrom === t && s.timeChipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Time TO */}
          <Text style={[s.fieldLabel, { marginTop: 16 }]}>Час закінчення (до) — необов'язково</Text>
          <View style={s.timesGrid}>
            {TIMES.filter(t => !booking.timeFrom || t > booking.timeFrom).map(t => (
              <TouchableOpacity key={t} style={[s.timeChip, booking.timeTo === t && s.timeChipActive]}
                onPress={() => setBooking(b => ({ ...b, timeTo: b.timeTo === t ? '' : t }))}>
                <Text style={[s.timeChipText, booking.timeTo === t && s.timeChipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Summary */}
          {(booking.dates.length > 0 || booking.timeFrom) && (
            <View style={{ marginTop: 20, padding: 14, backgroundColor: '#eff6ff', borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe' }}>
              <Text style={{ fontWeight: '700', color: '#1e40af', marginBottom: 6 }}>Вибраний час</Text>
              {booking.dates.length > 0 && <Text style={{ color: '#374151', fontSize: 14 }}>📅 {booking.dates.map(v => { const d = dates.find(x => x.value === v); return d ? `${d.dayName} ${d.label}` : v; }).join(', ')}</Text>}
              {booking.timeFrom && <Text style={{ color: '#374151', fontSize: 14, marginTop: 4 }}>⏰ {booking.timeFrom}{booking.timeTo ? ` – ${booking.timeTo}` : ''}</Text>}
            </View>
          )}
        </ScrollView>
        <View style={s.bottomBar}>
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
              const rate = profile.hourly_rate || tasker.hourly_rate || 25;
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
    const tRate = tProfile.hourly_rate || tasker.hourly_rate || 25;
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
    const cRate = cProfile.hourly_rate || tasker.hourly_rate || 25;
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
              { icon: 'calendar-outline', label: 'Дата', value: booking.date },
              { icon: 'time-outline', label: 'Час', value: booking.time },
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
  catCard: { width: '47%', borderRadius: 16, padding: 16, alignItems: 'flex-start', gap: 8 },
  catIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  catName: { fontSize: 14, fontWeight: '700' },
  catCount: { fontSize: 12, color: '#6b7280' },
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
});
