import React, { useEffect, useState } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View, Text } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../utils/api';

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={{
      position: 'absolute',
      top: -4,
      right: -8,
      backgroundColor: '#ef4444',
      borderRadius: 10,
      minWidth: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    }}>
      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [unreadCount, setUnreadCount] = useState(0);

  // Poll for unread messages every 15 seconds
  useEffect(() => {
    if (!token || !user) return;
    const fetchUnread = async () => {
      try {
        const count = await api.getUnreadMessagesCount();
        setUnreadCount(count);
      } catch {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [token, user]);

  // If still loading initial auth state, show loading indicator
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const role = user?.role || 'guest';
  const isGuest = role === 'guest';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Hide the bottom tab bar entirely for unauthenticated visitors so
        // the landing page looks like a public marketing page (no provider
        // tabs like "Tasks"/"Earnings" leaking through).
        tabBarStyle: isGuest ? { display: 'none' } : undefined,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          href: (role === 'client' || isGuest) ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="executors"
        options={{
          title: 'Pros',
          href: role === 'client' ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Orders',
          href: role === 'client' ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          href: role === 'provider' ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="service-area"
        options={{
          title: 'Location',
          href: role === 'provider' ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="location-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="availability"
        options={{
          title: 'Schedule',
          href: role === 'provider' ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          href: role === 'provider' ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Messages tab — chats. Surfaced for support role (chats with users). */}
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Chats',
          href: role === 'support' ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="chatbubbles-outline" size={size} color={color} />
              <UnreadBadge count={unreadCount} />
            </View>
          ),
        }}
      />

      {/* Support inbox — support role + admin */}
      <Tabs.Screen
        name="support-inbox"
        options={{
          title: 'Support',
          href: role === 'support' || role === 'admin' ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="headset-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          href: role === 'admin' || role === 'moderator' ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Community blog — visible to everyone (clients, providers, admins, guests) */}
      <Tabs.Screen
        name="community"
        options={{
          title: 'Blog',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="newspaper-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="users"
        options={{
          title: 'Users',
          href: role === 'admin' || role === 'moderator' ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-circle-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="services"
        options={{
          title: 'Services',
          href: role === 'admin' || role === 'moderator' ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="construct-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="payment-settings"
        options={{
          title: 'Payment',
          href: role === 'admin' ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          href: role === 'admin' ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="my-profile"
        options={{
          title: 'Profile',
          href: role === 'client' || role === 'provider' ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="booking-detail"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="service-detail"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="settings"
        options={{ href: null }}
      />
    </Tabs>
  );
}
