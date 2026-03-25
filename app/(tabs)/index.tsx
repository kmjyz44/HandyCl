import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Image, ActivityIndicator, Alert, Platform, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
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
  date: string;
  time: string;
  selectedTasker: any | null;
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

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [step, setStep] = useState<BookingStep>('home');
  const [booking, setBooking] = useState<BookingState>({
    categoryId: '', categoryName: '', skillName: '', taskDescription: '',
    address: '', city: '', date: '', time: '', selectedTasker: null,
  });
  const [taskers, setTaskers] = useState<any[]>([]);
  const [loadingTaskers, setLoadingTaskers] = useState(false);
  const [booking_submitting, setBookingSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dates = getDates();

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

  const submitBooking = async () => {
    if (!booking.selectedTasker) return;
    setBookingSubmitting(true);
    try {
      await api.createBooking({
        provider_id: booking.selectedTasker.user_id || booking.selectedTasker.provider_id,
        skill: booking.skillName,
        category: booking.categoryId,
        description: booking.taskDescription,
        address: booking.address,
        city: booking.city,
        scheduled_date: booking.date,
        scheduled_time: booking.time,
      });
      Alert.alert('Успіх! 🎉', `Завдання "${booking.skillName}" успішно заброньовано!\n\nВиконавець ${booking.selectedTasker.full_name || booking.selectedTasker.username} отримає сповіщення.`, [
        { text: 'OK', onPress: () => { setStep('home'); setBooking({ categoryId: '', categoryName: '', skillName: '', taskDescription: '', address: '', city: '', date: '', time: '', selectedTasker: null }); } }
      ]);
    } catch (e: any) {
      Alert.alert('Помилка', e.message || 'Не вдалося створити бронювання');
    } finally {
      setBookingSubmitting(false);
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
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
          <Text style={s.stepSubtitle}>Де потрібно виконати завдання?</Text>

          <Text style={s.fieldLabel}>Місто</Text>
          <TextInput
            style={s.input}
            placeholder="Київ"
            value={booking.city}
            onChangeText={v => setBooking(b => ({ ...b, city: v }))}
            placeholderTextColor="#9ca3af"
          />

          <Text style={s.fieldLabel}>Вулиця та номер будинку</Text>
          <TextInput
            style={s.input}
            placeholder="вул. Хрещатик, 1"
            value={booking.address}
            onChangeText={v => setBooking(b => ({ ...b, address: v }))}
            placeholderTextColor="#9ca3af"
          />

          {/* Quick city chips */}
          <Text style={s.fieldLabel}>Популярні міста</Text>
          <View style={s.chipsRow}>
            {['Київ', 'Харків', 'Одеса', 'Дніпро', 'Львів', 'Запоріжжя'].map(city => (
              <TouchableOpacity key={city} style={[s.chip, booking.city === city && s.chipActive]} onPress={() => setBooking(b => ({ ...b, city }))}>
                <Text style={[s.chipText, booking.city === city && s.chipTextActive]}>{city}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <View style={s.bottomBar}>
          <TouchableOpacity
            style={[s.nextBtn, (!booking.address.trim() || !booking.city.trim()) && s.nextBtnDisabled]}
            disabled={!booking.address.trim() || !booking.city.trim()}
            onPress={() => setStep('datetime')}
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
          <Text style={s.stepSubtitle}>Коли вам зручно?</Text>

          {/* Date picker */}
          <Text style={s.fieldLabel}>Дата</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
            {dates.map(d => (
              <TouchableOpacity key={d.value} style={[s.dateChip, booking.date === d.value && s.dateChipActive]} onPress={() => setBooking(b => ({ ...b, date: d.value }))}>
                <Text style={[s.dateDayName, booking.date === d.value && { color: '#fff' }]}>{d.dayName}</Text>
                <Text style={[s.dateLabel, booking.date === d.value && { color: '#fff', fontWeight: '700' }]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Time picker */}
          <Text style={s.fieldLabel}>Час початку</Text>
          <View style={s.timesGrid}>
            {TIMES.map(t => (
              <TouchableOpacity key={t} style={[s.timeChip, booking.time === t && s.timeChipActive]} onPress={() => setBooking(b => ({ ...b, time: t }))}>
                <Text style={[s.timeChipText, booking.time === t && s.timeChipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <View style={s.bottomBar}>
          <TouchableOpacity
            style={[s.nextBtn, (!booking.date || !booking.time) && s.nextBtnDisabled]}
            disabled={!booking.date || !booking.time}
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
            {taskers.map((tasker, idx) => (
              <TouchableOpacity key={tasker.user_id || idx} style={s.taskerCard} onPress={() => { setBooking(b => ({ ...b, selectedTasker: tasker })); setStep('tasker_profile'); }}>
                <View style={s.taskerCardLeft}>
                  {tasker.picture ? (
                    <Image source={{ uri: tasker.picture }} style={s.taskerAvatar} />
                  ) : (
                    <View style={[s.taskerAvatar, { backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="person" size={24} color="#fff" />
                    </View>
                  )}
                  {tasker.is_elite && (
                    <View style={s.eliteBadge}>
                      <Text style={s.eliteBadgeText}>ELITE</Text>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.taskerName}>{tasker.full_name || tasker.username || 'Виконавець'}</Text>
                  <View style={s.ratingRow}>
                    <Ionicons name="star" size={14} color="#f59e0b" />
                    <Text style={s.ratingText}>{tasker.rating ? tasker.rating.toFixed(1) : '5.0'}</Text>
                    <Text style={s.reviewCount}>({tasker.review_count || 0} відгуків)</Text>
                  </View>
                  <Text style={s.taskerSkills} numberOfLines={1}>
                    {(tasker.skills || []).slice(0, 3).map((sk: any) => typeof sk === 'string' ? sk : sk.name).join(' · ')}
                  </Text>
                </View>
                <View style={s.taskerCardRight}>
                  <Text style={s.taskerRate}>{tasker.hourly_rate || 25} ₴</Text>
                  <Text style={s.taskerRateLabel}>/год</Text>
                  <Ionicons name="chevron-forward" size={18} color="#9ca3af" style={{ marginTop: 4 }} />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  // STEP: TASKER PROFILE
  if (step === 'tasker_profile' && booking.selectedTasker) {
    const tasker = booking.selectedTasker;
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
            {tasker.picture ? (
              <Image source={{ uri: tasker.picture }} style={s.taskerHeroAvatar} />
            ) : (
              <View style={[s.taskerHeroAvatar, { backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="person" size={48} color="#fff" />
              </View>
            )}
            <Text style={s.taskerHeroName}>{tasker.full_name || tasker.username || 'Виконавець'}</Text>
            <View style={s.ratingRow}>
              {[1,2,3,4,5].map(i => (
                <Ionicons key={i} name={i <= Math.round(tasker.rating || 5) ? 'star' : 'star-outline'} size={18} color="#f59e0b" />
              ))}
              <Text style={[s.ratingText, { marginLeft: 6 }]}>{tasker.rating ? tasker.rating.toFixed(1) : '5.0'} · {tasker.review_count || 0} відгуків</Text>
            </View>
            <Text style={s.taskerHeroRate}>{tasker.hourly_rate || 25} ₴/год</Text>
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
          {tasker.bio ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Про виконавця</Text>
              <Text style={s.bioText}>{tasker.bio}</Text>
            </View>
          ) : null}

          {/* Skills */}
          {tasker.skills && tasker.skills.length > 0 ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Навички</Text>
              <View style={s.skillsWrap}>
                {tasker.skills.slice(0, 8).map((sk: any, i: number) => (
                  <View key={i} style={s.skillBadge}>
                    <Text style={s.skillBadgeText}>{typeof sk === 'string' ? sk : sk.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Portfolio */}
          {tasker.portfolio_photos && tasker.portfolio_photos.length > 0 ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Фото робіт</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {tasker.portfolio_photos.map((photo: string, i: number) => (
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
            {tasker.picture ? (
              <Image source={{ uri: tasker.picture }} style={s.confirmTaskerAvatar} />
            ) : (
              <View style={[s.confirmTaskerAvatar, { backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="person" size={28} color="#fff" />
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.taskerName}>{tasker.full_name || tasker.username}</Text>
              <View style={s.ratingRow}>
                <Ionicons name="star" size={14} color="#f59e0b" />
                <Text style={s.ratingText}>{tasker.rating ? tasker.rating.toFixed(1) : '5.0'}</Text>
              </View>
            </View>
            <Text style={s.taskerRate}>{tasker.hourly_rate || 25} ₴/год</Text>
          </View>

          <View style={s.priceSummary}>
            <Text style={s.priceSummaryTitle}>Орієнтовна вартість</Text>
            <Text style={s.priceSummaryNote}>Фінальна ціна узгоджується з виконавцем</Text>
            <Text style={s.priceSummaryRate}>{tasker.hourly_rate || 25} ₴/год</Text>
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
});
