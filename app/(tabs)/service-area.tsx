import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Platform, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { api } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';

export default function ServiceAreaScreen() {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<any>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'save') {
          api.updateExecutorProfile({
            latitude: data.lat,
            longitude: data.lng,
            service_radius_km: data.radius,
          }).then(() => {
            loadProfile();
            Alert.alert('Saved', `Service area: ${data.radius} mi`);
          }).catch((err: any) => {
            Alert.alert('Error', err.message || 'Could not save');
          });
        }
      } catch {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const loadProfile = async () => {
    try {
      const data = await api.getMyExecutorProfile();
      setProfile(data);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Service area</Text>
        <Text style={styles.subtitle}>
          Open the website in a browser to set your service area on the map.
        </Text>
      </View>
    );
  }

  const lat = profile?.latitude || '';
  const lng = profile?.longitude || '';
  const radius = profile?.service_radius_km || 10;
  const src = lat && lng
    ? `/map.html?unit=mi&lat=${lat}&lng=${lng}&radius=${radius}`
    : `/map.html?unit=mi`;

  return (
    <View style={{ flex: 1 }}>
      <iframe
        ref={iframeRef}
        title="service-area"
        src={src}
        style={{ width: '100%', height: '100%', border: 'none' } as any}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
});
