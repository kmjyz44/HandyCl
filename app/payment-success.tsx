import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../utils/api';

export default function PaymentSuccess() {
  const router = useRouter();
  const { session_id } = useLocalSearchParams<{ session_id: string }>();
  const [status, setStatus] = useState<'checking' | 'paid' | 'pending' | 'failed'>('checking');
  const [details, setDetails] = useState<any>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!session_id) {
      setStatus('failed');
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await api.getPaymentStatus(session_id);
        if (cancelled) return;
        setDetails(r);
        if (r.payment_status === 'paid') {
          setStatus('paid');
          return;
        }
        if (attempts > 10) {
          setStatus('pending');
          return;
        }
        setAttempts((a) => a + 1);
        setTimeout(poll, 2000);
      } catch (e) {
        if (!cancelled) setStatus('failed');
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [session_id]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Payment', headerShown: false }} />
      <View style={styles.card}>
        {status === 'checking' && (
          <>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.title}>Verifying payment...</Text>
            <Text style={styles.sub}>This will take a few seconds.</Text>
          </>
        )}
        {status === 'paid' && (
          <>
            <View style={[styles.iconWrap, { backgroundColor: '#dcfce7' }]}>
              <Ionicons name="checkmark-circle" size={64} color="#16a34a" />
            </View>
            <Text style={styles.title}>Paid!</Text>
            <Text style={styles.sub}>
              Thank you! Your payment of{' '}
              <Text style={{ fontWeight: '700' }}>
                {details?.amount} {(details?.currency || '').toUpperCase()}
              </Text>{' '}
              was received successfully.
            </Text>
          </>
        )}
        {status === 'pending' && (
          <>
            <View style={[styles.iconWrap, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="time" size={64} color="#d97706" />
            </View>
            <Text style={styles.title}>Payment is processing</Text>
            <Text style={styles.sub}>This may take a few more minutes. We'll notify you when it's done.</Text>
          </>
        )}
        {status === 'failed' && (
          <>
            <View style={[styles.iconWrap, { backgroundColor: '#fee2e2' }]}>
              <Ionicons name="close-circle" size={64} color="#dc2626" />
            </View>
            <Text style={styles.title}>Could not verify the payment</Text>
            <Text style={styles.sub}>Try refreshing the page or returning to the task.</Text>
          </>
        )}
        <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(tabs)' as any)} data-testid="back-to-app-btn">
          <Text style={styles.btnText}>Back to the app</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 18,
    padding: 28, alignItems: 'center',
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  iconWrap: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#111827', marginTop: 16, textAlign: 'center' },
  sub: { fontSize: 14, color: '#6b7280', marginTop: 8, textAlign: 'center', lineHeight: 20 },
  btn: { marginTop: 24, backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
