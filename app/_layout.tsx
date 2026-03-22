import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useAuthStore } from '../store/authStore';

export default function RootLayout() {
  const loadToken = useAuthStore((state) => state.loadToken);

  useEffect(() => {
    loadToken();
  }, [loadToken]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="auth-callback" />
      <Stack.Screen name="create-task" />
      <Stack.Screen name="task-detail" />
      <Stack.Screen name="service" />
      <Stack.Screen name="executor" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
