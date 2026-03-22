import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';

export default function Index() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const checkAuth = async () => {
      if (!token) {
        router.replace('/login');
        return;
      }

      if (user) {
        router.replace('/(tabs)');
        return;
      }

      try {
        const me = await api.getMe();
        await setUser(me);
        router.replace('/(tabs)');
      } catch (error) {
        console.error('Auth bootstrap failed:', error);
        await logout();
        router.replace('/login');
      }
    };

    checkAuth();
  }, [token, user, isLoading, router, setUser, logout]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2563eb" />
      <Text style={styles.text}>Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
});
