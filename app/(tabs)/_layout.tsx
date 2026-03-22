import React, { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';

export default function TabsLayout() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role;
  const router = useRouter();

  useEffect(() => {
    if (!user || !role) {
      router.replace('/login');
    }
  }, [user, role]);

  if (!user || !role) {
    return null;
  }

  if (role === 'admin') {
    return (
      <Tabs screenOptions={{ tabBarActiveTintColor: '#2563eb', tabBarInactiveTintColor: '#6b7280', headerShown: false }}>
        <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} /> }} />
        <Tabs.Screen name="users" options={{ title: 'Users', tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} /> }} />
        <Tabs.Screen name="services" options={{ title: 'Services', tabBarIcon: ({ color, size }) => <Ionicons name="build-outline" size={size} color={color} /> }} />
        <Tabs.Screen name="bookings" options={{ title: 'Bookings', tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} /> }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} /> }} />
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="tasks" options={{ href: null }} />
        <Tabs.Screen name="messages" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="service-detail" options={{ href: null }} />
        <Tabs.Screen name="booking-detail" options={{ href: null }} />
        <Tabs.Screen name="executors" options={{ href: null }} />
        <Tabs.Screen name="availability" options={{ href: null }} />
        <Tabs.Screen name="my-profile" options={{ href: null }} />
        <Tabs.Screen name="earnings" options={{ href: null }} />
      </Tabs>
    );
  }

  if (role === 'provider') {
    return (
      <Tabs screenOptions={{ tabBarActiveTintColor: '#2563eb', tabBarInactiveTintColor: '#6b7280', headerShown: false }}>
        <Tabs.Screen name="tasks" options={{ title: 'Завдання', tabBarIcon: ({ color, size }) => <Ionicons name="clipboard-outline" size={size} color={color} /> }} />
        <Tabs.Screen name="earnings" options={{ title: 'Заробіток', tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" size={size} color={color} /> }} />
        <Tabs.Screen name="availability" options={{ title: 'Графік', tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} /> }} />
        <Tabs.Screen name="messages" options={{ title: 'Чат', tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-outline" size={size} color={color} /> }} />
        <Tabs.Screen name="profile" options={{ title: 'Профіль', tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} /> }} />
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="dashboard" options={{ href: null }} />
        <Tabs.Screen name="users" options={{ href: null }} />
        <Tabs.Screen name="services" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="service-detail" options={{ href: null }} />
        <Tabs.Screen name="booking-detail" options={{ href: null }} />
        <Tabs.Screen name="bookings" options={{ href: null }} />
        <Tabs.Screen name="executors" options={{ href: null }} />
        <Tabs.Screen name="my-profile" options={{ href: null }} />
      </Tabs>
    );
  }

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#2563eb', tabBarInactiveTintColor: '#6b7280', headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Послуги', tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="executors" options={{ title: 'Виконавці', tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="bookings" options={{ title: 'Замовлення', tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="messages" options={{ title: 'Чат', tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Профіль', tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="dashboard" options={{ href: null }} />
      <Tabs.Screen name="users" options={{ href: null }} />
      <Tabs.Screen name="services" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="tasks" options={{ href: null }} />
      <Tabs.Screen name="service-detail" options={{ href: null }} />
      <Tabs.Screen name="booking-detail" options={{ href: null }} />
      <Tabs.Screen name="availability" options={{ href: null }} />
      <Tabs.Screen name="my-profile" options={{ href: null }} />
      <Tabs.Screen name="earnings" options={{ href: null }} />
    </Tabs>
  );
}
