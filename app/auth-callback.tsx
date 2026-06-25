import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { setUser, setToken } = useAuthStore();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Emergent Auth returns session_id in URL HASH (#session_id=...), not query.
        // Fall back to query param for backwards compat.
        let session_id: string | null = (params.session_id as string) || null;
        if (!session_id && typeof window !== 'undefined' && window.location?.hash) {
          const m = window.location.hash.match(/session_id=([^&]+)/);
          if (m) session_id = decodeURIComponent(m[1]);
        }
        if (!session_id) throw new Error('Invalid session ID');

        const response = await api.createSessionFromOAuth(session_id);
        await setToken(response.session_token);
        setUser(response.user);
        router.replace('/(tabs)');
      } catch (error: any) {
        console.error('OAuth callback error:', error);
        router.replace('/login');
      }
    };
    handleOAuthCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2563eb" />
      <Text style={styles.text}>Completing login...</Text>
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
