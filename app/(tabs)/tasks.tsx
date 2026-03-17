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
  client?: any;
  my_offer?: any;
  allow_offers: boolean;
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

    return (
      <TouchableOpacity
        key={task.task_id}
        style={styles.taskCard}
        onPress={() => openTaskDetail(task)}
      >
        <View style={styles.taskHeader}>
          <View style={[styles.categoryBadge, { backgroundColor: `${status.color}15` }]}>
            <Ionicons name={category.icon as any} size={16} color={status.color} />
            <Text style={[styles.categoryText, { color: status.color }]}>
              {category.name}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
            <Text style={styles.statusText}>{status.label}</Text>
          </View>
        </View>

        <Text style={styles.taskTitle}>{task.title}</Text>
        <Text style={styles.taskDesc} numberOfLines={2}>{task.description}</Text>

        <View style={styles.taskInfo}>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color="#6b7280" />
            <Text style={styles.infoText}>{task.address}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color="#6b7280" />
            <Text style={styles.infoText}>
              {task.scheduled_date} о {task.scheduled_time}
            </Text>
          </View>
        </View>

        {task.estimated_price && (
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Орієнтовна ціна:</Text>
            <Text style={styles.priceValue}>${task.estimated_price}</Text>
          </View>
        )}

        {task.client && !isMyTask && (
          <View style={styles.clientInfo}>
            <Ionicons name="person-circle-outline" size={20} color="#6b7280" />
            <Text style={styles.clientName}>{task.client.name}</Text>
          </View>
        )}

        {task.my_offer && (
          <View style={styles.myOfferBadge}>
            <Ionicons name="paper-plane" size={14} color="#8b5cf6" />
            <Text style={styles.myOfferText}>
              Ваша пропозиція: ${task.my_offer.proposed_price}
            </Text>
          </View>
        )}

        <View style={styles.cardFooter}>
          <TouchableOpacity 
            style={styles.viewButton}
            onPress={() => openTaskDetail(task)}
          >
            <Text style={styles.viewButtonText}>
              {isMyTask ? 'Деталі' : task.allow_offers ? 'Надіслати пропозицію' : 'Переглянути'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#2563eb" />
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
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  taskDesc: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  taskInfo: {
    gap: 6,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    color: '#6b7280',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  priceLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  priceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  clientName: {
    fontSize: 14,
    color: '#374151',
  },
  myOfferBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    padding: 10,
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
    paddingTop: 12,
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
