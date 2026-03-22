import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { View, ActivityIndicator } from 'react-native';

export default function TabsLayout() {
  const { user, token, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/login" />;
  }

  if (!user) {
    return <Redirect href="/" />;
  }

  const role = user.role;
