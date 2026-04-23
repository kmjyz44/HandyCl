import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../utils/api';

interface ChatItem {
  taskId: string;
  title: string;
  status: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  otherPartyName?: string;
}

export default function Messages() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadChats = useCallback(async () => {
    try {
      let tasks: any[] = [];
      if (user?.role === 'provider') {
        const data = await api.getTasks();
        tasks = Array.isArray(data) ? data : (data?.tasks ?? []);
      } else {
        // client — get bookings that have tasks
        const bookings = await api.getBookings();
        tasks = (Array.isArray(bookings) ? bookings : []).filter(
          (b: any) => b.task_id || b.task?.task_id
        );
      }

      // For each task, get last message and unread count
      const chatItems: ChatItem[] = await Promise.all(
        tasks.map(async (t: any) => {
          const taskId = t.task_id || t.task?.task_id || t.booking_id;
          const title = t.title || t.service_name || t.category || 'Завдання';
          let lastMessage = '';
          let lastMessageTime = '';
          let unreadCount = 0;

          try {
            const msgs = await api.getTaskMessages(taskId);
            const msgList = Array.isArray(msgs) ? msgs : (msgs?.messages ?? []);
            if (msgList.length > 0) {
              const last = msgList[msgList.length - 1];
              lastMessage = last.text || (last.image_url ? '📷 Фото' : '');
              lastMessageTime = last.created_at ? new Date(last.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : '';
              unreadCount = msgList.filter(
                (m: any) => !m.read && m.from_user_id !== user?.user_id
              ).length;
            }
          } catch {}

          // Determine other party name
          let otherPartyName = '';
          if (user?.role === 'client') {
            otherPartyName = t.provider_name || t.executor_name || 'Виконавець';
          } else {
            otherPartyName = t.client_name || 'Клієнт';
          }

          return {
            taskId,
            title,
            status: t.status || '',
            lastMessage,
            lastMessageTime,
            unreadCount,
            otherPartyName,
          };
        })
      );

      // Sort: unread first, then by last message time
      chatItems.sort((a, b) => {
        if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
        return (b.lastMessageTime || '').localeCompare(a.lastMessageTime || '');
      });

      setChats(chatItems);
    } catch (e) {
      console.error('loadChats error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadChats();
    // Refresh every 30 seconds
    const interval = setInterval(loadChats, 30000);
    return () => clearInterval(interval);
  }, [loadChats]);

  const onRefresh = () => {
    setRefreshing(true);
    loadChats();
  };

  const renderItem = ({ item }: { item: ChatItem }) => (
    <TouchableOpacity
      style={[styles.chatCard, item.unreadCount > 0 && styles.chatCardUnread]}
      onPress={() =>
        router.push({
          pathname: '/task-chat',
          params: { taskId: item.taskId, taskTitle: item.title },
        })
      }
      activeOpacity={0.8}
    >
      <View style={styles.avatarContainer}>
        <View style={[styles.avatar, item.unreadCount > 0 && styles.avatarUnread]}>
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={item.unreadCount > 0 ? '#fff' : '#6b7280'} />
        </View>
        {item.unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
          </View>
        )}
      </View>

      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={[styles.chatTitle, item.unreadCount > 0 && styles.chatTitleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          {!!item.lastMessageTime && (
            <Text style={styles.chatTime}>{item.lastMessageTime}</Text>
          )}
        </View>
        {!!item.otherPartyName && (
          <Text style={styles.chatParty} numberOfLines={1}>
            <Ionicons name="person-outline" size={12} color="#9ca3af" /> {item.otherPartyName}
          </Text>
        )}
        <Text style={[styles.chatLastMsg, item.unreadCount > 0 && styles.chatLastMsgUnread]} numberOfLines={1}>
          {item.lastMessage || 'Натисніть щоб відкрити чат'}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
    </TouchableOpacity>
  );

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
        <Text style={styles.headerTitle}>Повідомлення</Text>
        <Text style={styles.headerSubtitle}>Чати по вашим завданням</Text>
      </View>

      {chats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color="#d1d5db" />
          <Text style={styles.emptyText}>Немає повідомлень</Text>
          <Text style={styles.emptySubtext}>Чати з'являться після бронювання</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.taskId}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#111827' },
  headerSubtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  list: { padding: 16, gap: 8 },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  chatCardUnread: {
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
  },
  avatarContainer: { position: 'relative', marginRight: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarUnread: { backgroundColor: '#2563eb' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  chatInfo: { flex: 1 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  chatTitle: { fontSize: 15, fontWeight: '600', color: '#374151', flex: 1, marginRight: 8 },
  chatTitleUnread: { color: '#1d4ed8', fontWeight: '700' },
  chatTime: { fontSize: 12, color: '#9ca3af' },
  chatParty: { fontSize: 12, color: '#9ca3af', marginBottom: 2 },
  chatLastMsg: { fontSize: 13, color: '#6b7280' },
  chatLastMsgUnread: { color: '#1d4ed8', fontWeight: '600' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { marginTop: 16, fontSize: 18, fontWeight: '600', color: '#6b7280' },
  emptySubtext: { marginTop: 8, fontSize: 14, color: '#9ca3af', textAlign: 'center' },
});
