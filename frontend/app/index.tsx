import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';

export default function Index() {
  const router = useRouter();
  const { token, isLoading, setUser } = useAuthStore();

  useEffect(() => {
    const checkAuth = async () => {
      if (isLoading) return;

      if (!token) {
        router.replace('/login');
        return;
      }

      try {
        const user = await api.getMe();
        setUser(user);
        router.replace('/(tabs)');
      } catch (error) {
        console.error('Auth check failed:', error);
        router.replace('/login');
      }
    };

    checkAuth();
  }, [token, isLoading]);

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
