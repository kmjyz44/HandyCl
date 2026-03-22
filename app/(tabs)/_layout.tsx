import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../../store/authStore';

export default function TabsLayout() {
    const token = useAuthStore((state) => state.token);
    const user = useAuthStore((state) => state.user);
    const isLoading = useAuthStore((state) => state.isLoading);

  // If still loading initial auth state, show loading indicator
  if (isLoading) {
        return (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                          <ActivityIndicator size="large" />
                </View>View>
              );
  }

  // If no token, redirect to login
  if (!token) {
        return <Redirect href="/login" />;
  }

  // If token exists but user data not loaded yet, let app/index.tsx handle it
  // This should rarely happen if app/index.tsx is working correctly
  if (!user) {
        return (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                          <ActivityIndicator size="large" />
                </View>View>
              );
  }

  const role = user.role;

  return (
        <Tabs screenOptions={{ headerShown: false }}>
                <Tabs.Screen
                          name="index"
                          options={{
                                      title: 'Home',
                                      href: role === 'client' ? undefined : null,
                                      tabBarIcon: ({ color, size }) => (
                                                    <Ionicons name="home-outline" size={size} color={color} />
                                                  ),
                          }}
                        />

                <Tabs.Screen
                          name="executors"
                          options={{
                                      title: 'Executors',
                                      href: role === 'client' ? undefined : null,
                                      tabBarIcon: ({ color, size }) => (
                                                    <Ionicons name="people-outline" size={size} color={color} />
                                                  ),
                          }}
                        />

                <Tabs.Screen
                          name="bookings"
                          options={{
                                      title: 'Bookings',
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
                          name="availability"
                          options={{
                                      title: 'Availability',
                                      href: role ===
