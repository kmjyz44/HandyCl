import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { registerWebPush } from '../utils/webPush';

export default function RootLayout() {
  const loadToken = useAuthStore((state) => state.loadToken);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    loadToken();
  }, [loadToken]);

  // Register the browser for web push notifications once the user is logged in.
  // No-op on native platforms or browsers that don't support PushManager.
  useEffect(() => {
    if (!token) return;
    // small delay so the auth header is ready before the first /push API call
    const t = setTimeout(() => {
      registerWebPush().then((r) => {
        if (!r.ok) console.log('[push] not registered:', r.reason);
        else console.log('[push] registered ok');
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [token]);

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
      <Stack.Screen name="notifications" />
      <Stack.Screen name="payout-setup" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
