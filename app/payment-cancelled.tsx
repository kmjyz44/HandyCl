import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';

export default function PaymentCancelled() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Оплата скасована', headerShown: false }} />
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="close-circle" size={64} color="#dc2626" />
        </View>
        <Text style={styles.title}>Оплату скасовано</Text>
        <Text style={styles.sub}>Ти повернувся з Stripe без завершення платежу. Завдання залишається у статусі «очікує оплати».</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(tabs)' as any)} data-testid="back-to-app-btn">
          <Text style={styles.btnText}>Повернутись</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 18, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  iconWrap: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fee2e2' },
  title: { fontSize: 22, fontWeight: '800', color: '#111827', marginTop: 16, textAlign: 'center' },
  sub: { fontSize: 14, color: '#6b7280', marginTop: 8, textAlign: 'center', lineHeight: 20 },
  btn: { marginTop: 24, backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
