import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';

type Reminders = {
  role: string;
  needs_pay?: number;
  needs_executor_confirm?: number;
  needs_admin_verify?: number;
  disputed?: number;
  first_pending_id?: string | null;
  first_pending_kind?: string | null;
};

export default function PaymentReminderBanner() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  const [data, setData] = useState<Reminders | null>(null);

  const fetchCounts = useCallback(async () => {
    if (!token || !user) return;
    try {
      const r = await api.getPaymentReminders();
      setData(r);
    } catch {}
  }, [token, user]);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  if (!data || !user) return null;

  let title = '';
  let message = '';
  let color = '#f59e0b';
  let bg = '#fffbeb';
  let border = '#fde68a';
  let icon: any = 'alert-circle';
  let onPress: () => void = () => {};
  let testId = '';

  if (data.role === 'client' && (data.needs_pay || 0) > 0) {
    title = `Оплатіть завдання (${data.needs_pay})`;
    message = 'Виконавці чекають на оплату виконаних робіт';
    icon = 'card-outline';
    color = '#dc2626';
    bg = '#fef2f2';
    border = '#fca5a5';
    onPress = () => {
      // Deep-link to the first pending task's detail (where Pay button lives).
      // Fall back to /bookings list if no task_id available.
      if (data.first_pending_id) {
        router.push(`/task-detail?id=${data.first_pending_id}&autopay=1` as any);
      } else {
        router.push('/(tabs)/bookings' as any);
      }
    };
    testId = 'reminder-client-pay';
  } else if (data.role === 'provider' && (data.needs_executor_confirm || 0) > 0) {
    title = `Підтвердьте отримання (${data.needs_executor_confirm})`;
    message = 'Клієнт повідомив про оплату — перевірте і підтвердьте';
    icon = 'cash-outline';
    color = '#059669';
    bg = '#ecfdf5';
    border = '#a7f3d0';
    onPress = () => {
      if (data.first_pending_id) {
        router.push(`/task-detail?id=${data.first_pending_id}` as any);
      } else {
        router.push('/(tabs)/tasks?tab=pending' as any);
      }
    };
    testId = 'reminder-provider-confirm';
  } else if (data.role === 'admin' && ((data.needs_admin_verify || 0) > 0 || (data.disputed || 0) > 0)) {
    const total = (data.needs_admin_verify || 0) + (data.disputed || 0);
    title = (data.disputed || 0) > 0
      ? `Перевірте платежі (${total}) ⚠`
      : `Перевірте платежі (${total})`;
    message = (data.disputed || 0) > 0
      ? `${data.disputed} спір очікує розгляду`
      : 'Платежі чекають на підтвердження';
    icon = 'shield-checkmark-outline';
    color = (data.disputed || 0) > 0 ? '#dc2626' : '#2563eb';
    bg = (data.disputed || 0) > 0 ? '#fef2f2' : '#eff6ff';
    border = (data.disputed || 0) > 0 ? '#fca5a5' : '#bfdbfe';
    onPress = () => router.push('/admin-payments' as any);
    testId = 'reminder-admin-verify';
  } else {
    return null;
  }

  return (
    <TouchableOpacity
      style={[styles.banner, { backgroundColor: bg, borderColor: border }]}
      onPress={onPress}
      activeOpacity={0.8}
      data-testid={testId}
    >
      <View style={[styles.iconWrap, { backgroundColor: color }]}>
        <Ionicons name={icon} size={20} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color }]}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 14, fontWeight: '800' },
  message: { fontSize: 12, color: '#374151', marginTop: 2, lineHeight: 16 },
});
