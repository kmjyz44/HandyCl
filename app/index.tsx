import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';

export default function Index() {
  const router = useRouter();
  const { token, isLoading, setUser, setToken } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;

    const checkAuth = async () => {
      if (!token) {
        router.replace('/login');
        return;
      }

      try {
        const user = await api.getMe();
        setUser(user);
        router.replace('/(tabs)');
      } catch (e) {
        await setToken(null);
        setUser(null);
        router.replace('/login');
      }
    };

    checkAuth();
  }, [token, isLoading]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
