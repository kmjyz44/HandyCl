import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';

export default function Index() {
  const router = useRouter();
  const { token, isLoading, setUser, setToken } = useAuthStore();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      // Wait for initial token loading to complete
      if (isLoading) {
        return;
      }

      // If no token, redirect to login
      if (!token) {
        router.replace('/login');
        setAuthChecked(true);
        return;
      }

      // Token exists, fetch user data
      try {
        const user = await api.getMe();
        setUser(user);
        setAuthChecked(true);
        router.replace('/(tabs)');
      } catch (error) {
        console.error('Failed to fetch user:', error);
        await setToken(null);
        setUser(null);
        setAuthChecked(true);
        router.replace('/login');
      }
    };

    checkAuth();
  }, [token, isLoading, setUser, setToken, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
