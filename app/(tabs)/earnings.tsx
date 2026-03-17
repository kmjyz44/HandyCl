import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';

export default function Earnings() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [earnings, setEarnings] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [earningsRes, historyRes] = await Promise.all([
        api.getEarnings(),
        api.getEarningsHistory(20),
      ]);
      setEarnings(earningsRes);
      setHistory(historyRes || []);
    } catch (error) {
      console.error('Error loading earnings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
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
        <Text style={styles.headerTitle}>Заробіток</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statCardPrimary]}>
            <Ionicons name="wallet-outline" size={28} color="#fff" />
            <Text style={styles.statValue}>${earnings?.total_earnings?.toFixed(2) || '0.00'}</Text>
            <Text style={styles.statLabel}>Всього зароблено</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={24} color="#2563eb" />
            <Text style={styles.statValueDark}>${earnings?.pending_amount?.toFixed(2) || '0.00'}</Text>
            <Text style={styles.statLabelDark}>Очікує виплати</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.miniStatCard}>
            <Ionicons name="gift-outline" size={20} color="#10b981" />
            <Text style={styles.miniStatValue}>${earnings?.total_tips?.toFixed(2) || '0.00'}</Text>
            <Text style={styles.miniStatLabel}>Чайові</Text>
          </View>
          
          <View style={styles.miniStatCard}>
            <Ionicons name="briefcase-outline" size={20} color="#f59e0b" />
            <Text style={styles.miniStatValue}>{earnings?.total_jobs || 0}</Text>
            <Text style={styles.miniStatLabel}>Завдань</Text>
          </View>
          
          <View style={styles.miniStatCard}>
            <Ionicons name="hourglass-outline" size={20} color="#8b5cf6" />
            <Text style={styles.miniStatValue}>{earnings?.total_hours?.toFixed(1) || 0}</Text>
            <Text style={styles.miniStatLabel}>Годин</Text>
          </View>
        </View>

        {/* History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Історія</Text>
          
          {history.length > 0 ? (
            history.map((item) => (
              <TouchableOpacity
                key={item.task_id}
                style={styles.historyItem}
                onPress={() => router.push(`/task-detail?id=${item.task_id}`)}
              >
                <View style={styles.historyIcon}>
                  <Ionicons 
                    name={item.status === 'paid' ? 'checkmark-circle' : 'time'} 
                    size={24} 
                    color={item.status === 'paid' ? '#10b981' : '#f59e0b'} 
                  />
                </View>
                <View style={styles.historyContent}>
                  <Text style={styles.historyTitle}>{item.title}</Text>
                  <Text style={styles.historyDate}>
                    {new Date(item.completed_at).toLocaleDateString('uk-UA')}
                  </Text>
                  {item.client && (
                    <Text style={styles.historyClient}>{item.client.name}</Text>
                  )}
                </View>
                <View style={styles.historyAmount}>
                  <Text style={styles.amountValue}>${item.final_price?.toFixed(2)}</Text>
                  {item.tip_amount > 0 && (
                    <Text style={styles.tipValue}>+${item.tip_amount} чай</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>Поки немає завершених завдань</Text>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#fff', padding: 24, paddingTop: 60,
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#111827' },
  content: { flex: 1 },
  statsGrid: {
    flexDirection: 'row', padding: 16, gap: 12,
  },
  statCard: {
    flex: 1, backgroundColor: '#fff', padding: 20, borderRadius: 16,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  statCardPrimary: {
    backgroundColor: '#2563eb', borderColor: '#2563eb',
  },
  statValue: {
    fontSize: 28, fontWeight: 'bold', color: '#fff', marginTop: 12,
  },
  statLabel: {
    fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4,
  },
  statValueDark: {
    fontSize: 24, fontWeight: 'bold', color: '#111827', marginTop: 12,
  },
  statLabelDark: {
    fontSize: 13, color: '#6b7280', marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row', paddingHorizontal: 16, gap: 12,
  },
  miniStatCard: {
    flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb',
  },
  miniStatValue: {
    fontSize: 18, fontWeight: 'bold', color: '#111827', marginTop: 8,
  },
  miniStatLabel: {
    fontSize: 11, color: '#6b7280', marginTop: 2,
  },
  section: {
    backgroundColor: '#fff', marginTop: 16, padding: 20,
  },
  sectionTitle: {
    fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 16,
  },
  historyItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  historyIcon: { marginRight: 12 },
  historyContent: { flex: 1 },
  historyTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  historyDate: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  historyClient: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  historyAmount: { alignItems: 'flex-end' },
  amountValue: { fontSize: 16, fontWeight: 'bold', color: '#10b981' },
  tipValue: { fontSize: 12, color: '#f59e0b', marginTop: 2 },
  emptyState: {
    alignItems: 'center', paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14, color: '#6b7280', marginTop: 12,
  },
});
