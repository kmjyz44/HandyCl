import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Platform, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';

// Renders the Soro-hosted blog by injecting their embed widget (<div id="soro-blog"> + script) on web.
export default function SoroBlog() {
  const router = useRouter();
  const hostRef = useRef<any>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.getSoroEmbed();
        setEmbedUrl(r?.embed_url || null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || !embedUrl) return;
    const host = hostRef.current;
    if (!host || typeof document === 'undefined') return;
    host.innerHTML = '<div id="soro-blog"></div>';
    const sc = document.createElement('script');
    sc.src = embedUrl;
    sc.defer = true;
    host.appendChild(sc);
    return () => { try { host.innerHTML = ''; } catch {} };
  }, [embedUrl]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} data-testid="soro-blog-back">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Blog</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#2563eb" />
      ) : !embedUrl ? (
        <View style={styles.empty}>
          <Ionicons name="newspaper-outline" size={40} color="#9ca3af" />
          <Text style={styles.emptyTitle}>Blog not set up yet</Text>
          <Text style={styles.emptyText}>An admin can connect the Soro blog under Admin → Integrations → Soro.</Text>
        </View>
      ) : Platform.OS === 'web' ? (
        <ScrollView contentContainerStyle={{ padding: 16 }} data-testid="soro-blog-screen">
          {/* Soro injects the blog into this host element */}
          <View ref={hostRef} />
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <Ionicons name="globe-outline" size={40} color="#9ca3af" />
          <Text style={styles.emptyTitle}>Open on the web</Text>
          <Text style={styles.emptyText}>Our blog is best viewed in a web browser.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  back: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  empty: { alignItems: 'center', padding: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginTop: 8 },
  emptyText: { fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 19 },
});
