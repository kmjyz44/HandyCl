import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';

export default function AuthCallback() {
  const router = useRouter();
  const { session_id } = useLocalSearchParams();
  const { setUser, setToken } = useAuthStore();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        if (!session_id || typeof session_id !== 'string') {
          throw new Error('Invalid session ID');
        }

        // Exchange OAuth session_id for user session
        const response = await api.createSessionFromOAuth(session_id);
        
        // Store token and user data
        await setToken(response.session_token);
        setUser(response.user);

        // Redirect to main app
        router.replace('/(tabs)');
      } catch (error: any) {
        console.error('OAuth callback error:', error);
        // Redirect back to login on error
        router.replace('/login');
      }
    };

    handleOAuthCallback();
  }, [session_id]);

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
