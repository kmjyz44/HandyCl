import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '../../utils/api';
import PaymentReminderBanner from '../../components/PaymentReminderBanner';
import { useAuthStore } from '../../store/authStore';

const CATEGORIES: Record<string, { name: string; icon: string }> = {
  handyman_plumbing: { name: 'Сантехніка', icon: 'water-outline' },
  handyman_electrical: { name: 'Електрика', icon: 'flash-outline' },
  handyman_carpentry: { name: 'Столярні роботи', icon: 'hammer-outline' },
  handyman_painting: { name: 'Фарбування', icon: 'color-palette-outline' },
  handyman_assembly: { name: 'Збирання меблів', icon: 'construct-outline' },
  handyman_mounting: { name: 'Монтаж', icon: 'build-outline' },
  cleaning_regular: { name: 'Прибирання', icon: 'sparkles-outline' },
  cleaning_deep: { name: 'Глибоке прибирання', icon: 'sparkles' },
  moving_local: { name: 'Переїзд', icon: 'car-outline' },
  delivery: { name: 'Доставка', icon: 'cube-outline' },
  gardening: { name: 'Садівництво', icon: 'leaf-outline' },
  other: { name: 'Інше', icon: 'ellipsis-horizontal-outline' },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  posted: { label: 'Нове', color: '#3b82f6' },
  offering: { label: 'Приймає пропозиції', color: '#8b5cf6' },
  assigned: { label: 'Призначено', color: '#f59e0b' },
  hold_placed: { label: 'Оплата підтверджена', color: '#10b981' },
  on_the_way: { label: 'В дорозі', color: '#06b6d4' },
  started: { label: 'В роботі', color: '#f97316' },
  completed_pending_payment: { label: 'Очікує оплати', color: '#eab308' },
  paid: { label: 'Оплачено', color: '#22c55e' },
};

interface Task {
  task_id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  address: string;
  scheduled_date: string;
  scheduled_time: string;
  estimated_price?: number;
  photos?: string[];
  client?: {
    user_id: string;
    name: string;
    photo_url?: string;
  };
  my_offer?: any;
  allow_offers: boolean;
  source?: string;
}

export default function AvailableTasks() {
  const router = useRouter();
  const { user } = useAuthStore();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  useEffect(() => {
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
  }, []);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const COMPLETED_STATUSES = ['completed_pending_payment', 'paid', 'completed'];
  // A task is in "pending payment confirmation" stage when the client has
  // marked the payment as sent but it isn't yet fully confirmed by BOTH
  // executor and admin.
  const isPendingConfirmation = (t: Task): boolean => {
    const ps = (t as any).payment_status;
    if (t.status === 'paid' || t.status === 'completed') return false;
    return ps === 'pending_verification' || ps === 'executor_confirmed' || ps === 'admin_confirmed' || ps === 'disputed';
  };
  const activeMyTasks = myTasks.filter(t => !COMPLETED_STATUSES.includes(t.status));
  const pendingPayTasks = myTasks.filter(isPendingConfirmation);
  const doneTasks = myTasks.filter(t => COMPLETED_STATUSES.includes(t.status) && !isPendingConfirmation(t));
  // Support deep-link tab param from dashboard tiles
  const initialTab = (params.tab === 'my' || params.tab === 'done' || params.tab === 'pending')
    ? params.tab
    : 'available';
  const [activeTab, setActiveTab] = useState<'available' | 'my' | 'pending' | 'done'>(initialTab as any);

  const loadTasks = async () => {
    try {
      const [availableRes, myTasksRes] = await Promise.all([
        api.getAvailableTasks(),
        api.getTasks(),
      ]);
      setTasks(availableRes || []);
      setMyTasks(myTasksRes || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadTasks();
  };

  const openTaskDetail = (task: Task) => {
    router.push(`/task-detail?id=${task.task_id}`);
  };

  const getStatusInfo = (status: string) => {
    return STATUS_LABELS[status] || { label: status, color: '#6b7280' };
  };

  const getCategoryInfo = (category: string) => {
    return CATEGORIES[category] || { name: category, icon: 'help-outline' };
  };

  const renderTaskCard = (task: Task, isMyTask: boolean = false) => {
    const status = getStatusInfo(task.status);
    const category = getCategoryInfo(task.category);
    const clientName = task.client?.name || 'Клієнт';
    const clientPhoto = task.client?.photo_url;
    const t = task as any;
    // Show best available price: final_price > hours×rate > estimated_price
    const calcPrice = t.final_price
      ? t.final_price
      : (t.actual_hours && t.hourly_rate)
        ? Math.round(t.actual_hours * t.hourly_rate * 100) / 100
        : t.estimated_price;
    const price = calcPrice;
    const priceLabel = t.final_price
      ? `${t.final_price} грн`
      : (t.actual_hours && t.hourly_rate)
        ? `${Math.round(t.actual_hours * t.hourly_rate)} грн (${t.actual_hours}год × ${t.hourly_rate}грн)`
        : t.estimated_price ? `${t.estimated_price} грн` : null;
    const taskPhotos = task.photos || [];

    return (
      <TouchableOpacity
        key={task.task_id}
        style={styles.taskCard}
        onPress={() => openTaskDetail(task)}
        activeOpacity={0.85}
      >
        {/* Header row: category badge + status */}
        <View style={styles.taskHeader}>
          <View style={[styles.categoryBadge, { backgroundColor: `${status.color}18` }]}>
            <Ionicons name={category.icon as any} size={15} color={status.color} />
            <Text style={[styles.categoryText, { color: status.color }]}>
              {category.name}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
            <Text style={styles.statusText}>{status.label}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.taskTitle}>{task.title || 'Без назви'}</Text>

        {/* Description */}
        {!!task.description && (
          <Text style={styles.taskDesc} numberOfLines={2}>{task.description}</Text>
        )}

        {/* Task photos strip */}
        {taskPhotos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosStrip}>
            {taskPhotos.slice(0, 5).map((uri, idx) => (
              <Image key={idx} source={{ uri }} style={styles.taskPhoto} />
            ))}
          </ScrollView>
        )}

        {/* Location + date */}
        <View style={styles.taskInfo}>
          {!!task.address && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={15} color="#6b7280" />
              <Text style={styles.infoText} numberOfLines={1}>{task.address}</Text>
            </View>
          )}
          {(!!task.scheduled_date || !!task.scheduled_time) && (
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={15} color="#6b7280" />
              <Text style={styles.infoText}>
                {task.scheduled_date}{task.scheduled_date && task.scheduled_time ? ' о ' : ''}{task.scheduled_time}
              </Text>
            </View>
          )}
        </View>

        {/* Price + client row */}
        <View style={styles.bottomRow}>
          {/* Client avatar + name */}
          {task.client && !isMyTask && (
            <View style={styles.clientInfo}>
              {clientPhoto ? (
                <Image source={{ uri: clientPhoto }} style={styles.clientAvatar} />
              ) : (
                <View style={styles.clientAvatarPlaceholder}>
                  <Text style={styles.clientAvatarInitial}>
                    {clientName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.clientName} numberOfLines={1}>{clientName}</Text>
            </View>
          )}

          {/* Price */}
          {priceLabel ? (
            <View style={styles.priceChip}>
              <Ionicons name="cash-outline" size={14} color="#10b981" />
              <Text style={styles.priceValue}>{priceLabel}</Text>
            </View>
          ) : (
            <View style={styles.priceChip}>
              <Ionicons name="cash-outline" size={14} color="#9ca3af" />
              <Text style={[styles.priceValue, { color: '#9ca3af' }]}>Ціна не вказана</Text>
            </View>
          )}
        </View>

        {/* My offer badge */}
        {task.my_offer && (
          <View style={styles.myOfferBadge}>
            <Ionicons name="paper-plane" size={13} color="#8b5cf6" />
            <Text style={styles.myOfferText}>
              Ваша пропозиція: {task.my_offer.proposed_price} грн
            </Text>
          </View>
        )}

        {/* Footer CTA */}
        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.viewButton}
            onPress={() => openTaskDetail(task)}
          >
            <Text style={styles.viewButtonText}>
              {isMyTask ? 'Деталі' : task.allow_offers ? 'Надіслати пропозицію' : 'Переглянути'}
            </Text>
            <Ionicons name="chevron-forward" size={17} color="#2563eb" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
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
        <Text style={styles.headerTitle}>Завдання</Text>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/community' as any)}
          data-testid="open-blog-btn-tasks"
          style={{ position: 'absolute', right: 60, top: 16 }}
        >
          <Ionicons name="newspaper-outline" size={26} color="#111827" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/notifications' as any)}
          data-testid="open-notifications-btn-tasks"
          style={{ position: 'absolute', right: 16, top: 16 }}
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
      </View>

      <PaymentReminderBanner />

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'available' && styles.tabActive]}
          onPress={() => setActiveTab('available')}
        >
          <Text style={[styles.tabText, activeTab === 'available' && styles.tabTextActive]}>
            Доступні ({tasks.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my' && styles.tabActive]}
          onPress={() => setActiveTab('my')}
        >
          <Text style={[styles.tabText, activeTab === 'my' && styles.tabTextActive]}>
            Мої ({activeMyTasks.length})
          </Text>
        </TouchableOpacity>
        {pendingPayTasks.length > 0 && (
          <TouchableOpacity
            style={[styles.tab, activeTab === 'pending' && styles.tabActivePending]}
            onPress={() => setActiveTab('pending')}
            data-testid="tab-pending-confirmation"
          >
            <Ionicons name="time-outline" size={14} color={activeTab === 'pending' ? '#b45309' : '#9ca3af'} style={{ marginRight: 3 }} />
            <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextPending]} numberOfLines={1}>
              Підтвердж. ({pendingPayTasks.length})
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.tab, activeTab === 'done' && styles.tabActiveDone]}
          onPress={() => setActiveTab('done')}
        >
          <Ionicons name="checkmark-done-circle" size={14} color={activeTab === 'done' ? '#22c55e' : '#9ca3af'} style={{ marginRight: 3 }} />
          <Text style={[styles.tabText, activeTab === 'done' && styles.tabTextDone]}>
            Виконані ({doneTasks.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'available' ? (
          tasks.length > 0 ? (
            tasks.map(task => renderTaskCard(task, false))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="clipboard-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyTitle}>Немає доступних завдань</Text>
              <Text style={styles.emptySubtitle}>Нові завдання з'являться тут</Text>
            </View>
          )
        ) : activeTab === 'my' ? (
          activeMyTasks.length > 0 ? (
            activeMyTasks.map(task => renderTaskCard(task, true))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="briefcase-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyTitle}>У вас немає активних завдань</Text>
              <Text style={styles.emptySubtitle}>Прийміть завдання зі списку доступних</Text>
            </View>
          )
        ) : activeTab === 'pending' ? (
          pendingPayTasks.length > 0 ? (
            <>
              <View style={styles.pendingBanner} data-testid="pending-verification-banner">
                <View style={styles.pendingBannerHeader}>
                  <Ionicons name="time-outline" size={20} color="#b45309" />
                  <Text style={styles.pendingBannerTitle}>
                    Очікують підтвердження ({pendingPayTasks.length})
                  </Text>
                </View>
                <Text style={styles.pendingBannerSubtitle}>
                  Клієнт надіслав платіж. Завдання буде закрите, коли і виконавець, і адмін підтвердять отримання.
                </Text>
              </View>
              {pendingPayTasks.map(task => {
                const execOk = !!(task as any).executor_confirmed;
                const adminOk = !!(task as any).admin_confirmed;
                const isDisputed = (task as any).payment_status === 'disputed';
                return (
                  <TouchableOpacity
                    key={task.task_id}
                    style={[
                      styles.pendingItemBig,
                      isDisputed && { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
                    ]}
                    onPress={() => router.push(`/task-detail?id=${task.task_id}` as any)}
                    data-testid={`pending-task-${task.task_id}`}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pendingItemTitle} numberOfLines={2}>
                        {task.title || 'Завдання'}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: 12, color: execOk ? '#059669' : '#92400e', fontWeight: '700' }}>
                          {execOk ? '✓' : '○'} Виконавець
                        </Text>
                        <Text style={{ fontSize: 12, color: adminOk ? '#059669' : '#92400e', fontWeight: '700' }}>
                          {adminOk ? '✓' : '○'} Адмін
                        </Text>
                        <Text style={{ fontSize: 12, color: '#92400e', fontWeight: '600' }}>
                          {((task as any).payment_method || '').toUpperCase()}
                        </Text>
                      </View>
                      {isDisputed && (
                        <Text style={{ fontSize: 12, color: '#dc2626', marginTop: 6, fontWeight: '600' }}>
                          ⚠ Виник спір. Адмін розгляне.
                        </Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={22} color="#b45309" />
                  </TouchableOpacity>
                );
              })}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyTitle}>Немає платежів в очікуванні</Text>
              <Text style={styles.emptySubtitle}>Тут з'являться завдання після того як клієнт надішле платіж</Text>
            </View>
          )
        ) : (
          doneTasks.length > 0 ? (
            <>
              {/* Summary card for paid/completed tasks */}
              {(() => {
                const paidTasks = doneTasks.filter(t => t.status === 'paid');
                const totalHours = paidTasks.reduce((s, t) => s + ((t as any).actual_hours || 0), 0);
                const totalAmount = paidTasks.reduce((s, t) => s + ((t as any).final_price || (t as any).estimated_price || 0), 0);
                const totalTips = paidTasks.reduce((s, t) => s + ((t as any).tip_amount || 0), 0);
                if (paidTasks.length === 0) return null;
                return (
                  <View style={styles.doneSummaryCard}>
                    <Text style={styles.doneSummaryTitle}>Загальна статистика оплачених</Text>
                    <View style={styles.doneSummaryRow}>
                      <View style={styles.doneSummaryItem}>
                        <Ionicons name="hourglass-outline" size={22} color="#2563eb" />
                        <Text style={styles.doneSummaryValue}>{totalHours > 0 ? `${totalHours.toFixed(1)} год` : '—'}</Text>
                        <Text style={styles.doneSummaryLabel}>Години</Text>
                      </View>
                      <View style={styles.doneSummaryItem}>
                        <Ionicons name="cash-outline" size={22} color="#10b981" />
                        <Text style={styles.doneSummaryValue}>{totalAmount > 0 ? `${totalAmount.toFixed(0)} грн` : '—'}</Text>
                        <Text style={styles.doneSummaryLabel}>Сума</Text>
                      </View>
                      <View style={styles.doneSummaryItem}>
                        <Ionicons name="gift-outline" size={22} color="#f59e0b" />
                        <Text style={styles.doneSummaryValue}>{totalTips > 0 ? `${totalTips.toFixed(0)} грн` : '—'}</Text>
                        <Text style={styles.doneSummaryLabel}>Чайові</Text>
                      </View>
                      <View style={styles.doneSummaryItem}>
                        <Ionicons name="checkmark-circle-outline" size={22} color="#7c3aed" />
                        <Text style={styles.doneSummaryValue}>{totalAmount + totalTips > 0 ? `${(totalAmount + totalTips).toFixed(0)} грн` : '—'}</Text>
                        <Text style={styles.doneSummaryLabel}>Всього</Text>
                      </View>
                    </View>
                  </View>
                );
              })()}
              {doneTasks.map(task => renderTaskCard(task, true))}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-done-circle-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyTitle}>Немає виконаних завдань</Text>
              <Text style={styles.emptySubtitle}>Завершені завдання з'являться тут</Text>
            </View>
          )
        )}
        <View style={{ height: 40 }} />
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#2563eb',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#fff',
  },
  tabActiveDone: {
    backgroundColor: '#dcfce7',
  },
  tabTextDone: {
    color: '#22c55e',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  taskTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  taskDesc: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 19,
    marginBottom: 10,
  },
  photosStrip: {
    marginBottom: 10,
  },
  taskPhoto: {
    width: 72,
    height: 72,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#f3f4f6',
  },
  taskInfo: {
    gap: 5,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  infoText: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    marginBottom: 4,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  clientAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
  },
  clientAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563eb',
  },
  clientName: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
    flex: 1,
  },
  priceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10b981',
  },
  myOfferBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    padding: 9,
    backgroundColor: '#f3e8ff',
    borderRadius: 8,
  },
  myOfferText: {
    fontSize: 13,
    color: '#7c3aed',
    fontWeight: '500',
  },
  cardFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  pendingBanner: {
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#fcd34d',
  },
  pendingBannerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pendingBannerTitle: { fontSize: 15, fontWeight: '800', color: '#92400e' },
  pendingBannerSubtitle: { fontSize: 12, color: '#92400e', marginTop: 4, marginBottom: 10, lineHeight: 16 },
  pendingItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 10, padding: 12, marginTop: 8,
    borderWidth: 1, borderColor: '#fde68a', gap: 12,
  },
  pendingItemTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  pendingItemBig: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fffbeb', borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1.5, borderColor: '#fcd34d', gap: 12,
  },
  tabActivePending: {
    borderBottomWidth: 2,
    borderBottomColor: '#b45309',
  },
  tabTextPending: { color: '#b45309', fontWeight: '700' },

  doneSummaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  doneSummaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
    textAlign: 'center',
  },
  doneSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  doneSummaryItem: {
    alignItems: 'center',
    gap: 4,
  },
  doneSummaryValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  doneSummaryLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
});
