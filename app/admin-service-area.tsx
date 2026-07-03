import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Switch, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';
import { showAlert } from '../utils/alert';

export default function AdminServiceAreaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sa, setSa] = useState<any>(null);
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => { load(); }, []);
  const load = async () => {
    try {
      const d = await api.adminGetServiceArea();
      setSa(d);
      setEnabled(!!d.enabled);
      setMessage(d.message || '');
    } catch { showAlert('Error', 'Failed to load service area'); }
    finally { setLoading(false); }
  };

  // Persist the zone chosen on the map (center + radius in miles).
  const saveZone = async (lat: number, lng: number, radiusMiles: number) => {
    setSaving(true);
    try {
      const updated = await api.adminUpdateServiceArea({
        enabled: true,
        message,
        states: sa?.states || [],
        cities: sa?.cities || [],
        centers: [{ label: 'Service zone', lat, lng, radius_miles: radiusMiles }],
      });
      setSa(updated);
      setEnabled(true);
      showAlert('Saved', `Working zone set: ${radiusMiles} mi radius`);
    } catch { showAlert('Error', 'Could not save zone'); }
    finally { setSaving(false); }
  };

  // Listen for the map iframe's save message (web only).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data && data.type === 'save' && data.lat != null && data.lng != null) {
          saveZone(data.lat, data.lng, data.radius || 30);
        }
      } catch {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [message, sa]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const updated = await api.adminUpdateServiceArea({ enabled, message });
      setSa(updated);
      showAlert('Saved', 'Settings updated');
    } catch { showAlert('Error', 'Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" /></View>;

  const center = (sa?.centers && sa.centers[0]) || { lat: 41.8781, lng: -87.6298, radius_miles: 30 };
  const mapSrc = `/map.html?mode=admin&unit=mi&lat=${center.lat}&lng=${center.lng}&radius=${Math.round(center.radius_miles || 30)}`;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><Ionicons name="arrow-back" size={24} color="#111827" /></TouchableOpacity>
        <Text style={s.title}>Service Area</Text>
      </View>
      <ScrollView contentContainerStyle={s.content} data-testid="admin-service-area-screen">
        <View style={s.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Restrict to service area</Text>
            <Text style={s.hint}>When on, bookings outside the zone are blocked and the person is added to the waitlist.</Text>
          </View>
          <Switch value={enabled} onValueChange={(v) => { setEnabled(v); }} data-testid="service-area-enabled" />
        </View>

        <Text style={s.section}>Working zone</Text>
        <Text style={s.hint}>Tap the map to set the center, pick a radius, then press "Save zone". Bookings inside the circle are accepted.</Text>

        {Platform.OS === 'web' ? (
          <View style={s.mapWrap}>
            {/* @ts-ignore web iframe */}
            <iframe title="admin-service-area" src={mapSrc} style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12 } as any} />
          </View>
        ) : (
          <View style={s.mapFallback}>
            <Ionicons name="map-outline" size={30} color="#9ca3af" />
            <Text style={s.hint}>Open the web dashboard in a browser to set the zone on the map.</Text>
          </View>
        )}

        <View style={s.summary} data-testid="zone-summary">
          <Ionicons name="location" size={16} color="#2563eb" />
          <Text style={s.summaryText}>
            Current: {center.radius_miles || 30} mi around ({Number(center.lat).toFixed(3)}, {Number(center.lng).toFixed(3)})
          </Text>
        </View>

        <Text style={s.section}>Out-of-area message</Text>
        <TextInput
          style={[s.input, { height: 80, textAlignVertical: 'top' }]}
          multiline
          placeholder="Message shown to users outside the area"
          value={message}
          onChangeText={setMessage}
          data-testid="input-oos-message"
        />

        <TouchableOpacity style={[s.save, saving && { opacity: 0.6 }]} onPress={saveSettings} disabled={saving} data-testid="save-settings-btn">
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Save settings</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  back: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  content: { padding: 20, paddingBottom: 60 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { fontSize: 15, fontWeight: '700', color: '#111827' },
  hint: { fontSize: 12, color: '#6b7280', marginTop: 4, lineHeight: 17 },
  section: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 26, marginBottom: 6 },
  mapWrap: { height: 440, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb', marginTop: 10 },
  mapFallback: { height: 160, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, padding: 16 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: '#eff6ff', borderRadius: 10, padding: 12 },
  summaryText: { flex: 1, fontSize: 13, color: '#1e40af', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: '#f9fafb', marginTop: 8 },
  save: { backgroundColor: '#2563eb', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
