import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';


export default function Index() {
    const router = useRouter();
    const { token, isLoading, setUser, setToken, loadToken } = useAuthStore();


  useEffect(() => {
        const initAuth = async () => {
                // If still loading, wait for loadToken to complete
                if (isLoading) {
                          return;
                }


                // If no token, redirect to login
                if (!token) {
                          router.replace('/login');
                          return;
                }


                // Token exists, fetch user data
                try {
                          const user = await api.getMe();
                          setUser(user);
                          router.replace('/(tabs)');
                } catch (e) {
                          console.error('Failed to fetch user:', e);
                          await setToken(null);
                          setUser(null);
                          router.replace('/login');
                }
        };


                initAuth();
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



