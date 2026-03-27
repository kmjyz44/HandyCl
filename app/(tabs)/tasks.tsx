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
import { useRouter } from 'expo-router';
import { api } from '../../utils/api';
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'available' | 'my'>('available');

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
    const price = task.estimated_price;
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
          {price != null && price > 0 ? (
            <View style={styles.priceChip}>
              <Ionicons name="cash-outline" size={14} color="#10b981" />
              <Text style={styles.priceValue}>{price} грн</Text>
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
      </View>

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
            Мої ({myTasks.length})
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
        ) : (
          myTasks.length > 0 ? (
            myTasks.map(task => renderTaskCard(task, true))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="briefcase-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyTitle}>У вас немає завдань</Text>
              <Text style={styles.emptySubtitle}>Прийміть завдання зі списку доступних</Text>
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
});
