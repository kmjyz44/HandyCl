import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Switch, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';
import { showAlert } from '../utils/alert';

type Zone = { label: string; lat: number; lng: number; radius_miles: number };

export default function AdminServiceAreaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState('');
  const [zones, setZones] = useState<Zone[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [newState, setNewState] = useState('');
  const [newCity, setNewCity] = useState('');

  useEffect(() => { load(); }, []);
  const load = async () => {
    try {
      const d = await api.adminGetServiceArea();
      setEnabled(!!d.enabled);
      setMessage(d.message || '');
      setZones(d.centers || []);
      setStates(d.states || []);
      setCities(d.cities || []);
    } catch { showAlert('Error', 'Failed to load service area'); }
    finally { setLoading(false); }
  };

  // The map iframe posts {type:'save', lat, lng, radius} — append it as a new zone.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data && data.type === 'save' && data.lat != null && data.lng != null) {
          setZones((prev) => [...prev, { label: `Zone ${prev.length + 1}`, lat: data.lat, lng: data.lng, radius_miles: data.radius || 30 }]);
          showAlert('Zone added', 'Press "Save all" to apply your changes.');
        }
      } catch {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const saveAll = async () => {
    setSaving(true);
    try {
      await api.adminUpdateServiceArea({ enabled, message, states, cities, centers: zones });
      showAlert('Saved', 'Service area updated');
    } catch { showAlert('Error', 'Failed to save'); }
    finally { setSaving(false); }
  };

  const addState = () => { const v = newState.trim(); if (v) { setStates([...states, v]); setNewState(''); } };
  const addCity = () => { const v = newCity.trim(); if (v) { setCities([...cities, v]); setNewCity(''); } };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" /></View>;

  const last = zones[zones.length - 1];
  const mapCenter = last || { lat: 41.8781, lng: -87.6298, radius_miles: 30 };
  const mapSrc = `/map.html?mode=admin&unit=mi&lat=${mapCenter.lat}&lng=${mapCenter.lng}&radius=${Math.round(mapCenter.radius_miles || 30)}`;

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
            <Text style={s.hint}>When on, bookings outside every zone/state/city below are blocked and the person joins the waitlist.</Text>
          </View>
          <Switch value={enabled} onValueChange={setEnabled} data-testid="service-area-enabled" />
        </View>

        {/* Map: add radius zones */}
        <Text style={s.section}>Radius zones</Text>
        <Text style={s.hint}>Tap the map to place a center, pick a radius, press "Save zone" — it's added to the list. Add as many zones (even in other states) as you like.</Text>
        {Platform.OS === 'web' ? (
          <View style={s.mapWrap}>
            {/* @ts-ignore web iframe */}
            <iframe title="admin-service-area" src={mapSrc} style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12 } as any} />
          </View>
        ) : (
          <View style={s.mapFallback}><Ionicons name="map-outline" size={30} color="#9ca3af" /><Text style={s.hint}>Open the web dashboard to set zones on the map.</Text></View>
        )}

        {zones.length === 0 ? <Text style={s.emptyHint}>No zones yet.</Text> : zones.map((z, i) => (
          <View key={i} style={s.zoneRow} data-testid={`zone-${i}`}>
            <Ionicons name="location" size={16} color="#2563eb" />
            <Text style={s.zoneText}>{z.label}: {z.radius_miles} mi ({Number(z.lat).toFixed(3)}, {Number(z.lng).toFixed(3)})</Text>
            <TouchableOpacity onPress={() => setZones(zones.filter((_, x) => x !== i))} data-testid={`remove-zone-${i}`}><Ionicons name="trash-outline" size={18} color="#dc2626" /></TouchableOpacity>
          </View>
        ))}

        {/* Whole states */}
        <Text style={s.section}>Allowed states (whole state)</Text>
        <View style={s.chips}>
          {states.map((st, i) => (
            <View key={i} style={s.chip}><Text style={s.chipText}>{st}</Text><TouchableOpacity onPress={() => setStates(states.filter((_, x) => x !== i))}><Ionicons name="close" size={14} color="#1e40af" /></TouchableOpacity></View>
          ))}
        </View>
        <View style={s.addRow}>
          <TextInput style={s.input} placeholder="e.g. Wisconsin" value={newState} onChangeText={setNewState} onSubmitEditing={addState} data-testid="input-new-state" />
          <TouchableOpacity style={s.addBtn} onPress={addState} data-testid="add-state-btn"><Ionicons name="add" size={20} color="#fff" /></TouchableOpacity>
        </View>

        {/* Specific cities */}
        <Text style={s.section}>Allowed cities (any state)</Text>
        <View style={s.chips}>
          {cities.map((ct, i) => (
            <View key={i} style={s.chip}><Text style={s.chipText}>{ct}</Text><TouchableOpacity onPress={() => setCities(cities.filter((_, x) => x !== i))}><Ionicons name="close" size={14} color="#1e40af" /></TouchableOpacity></View>
          ))}
        </View>
        <View style={s.addRow}>
          <TextInput style={s.input} placeholder="e.g. Milwaukee" value={newCity} onChangeText={setNewCity} onSubmitEditing={addCity} data-testid="input-new-city" />
          <TouchableOpacity style={s.addBtn} onPress={addCity} data-testid="add-city-btn"><Ionicons name="add" size={20} color="#fff" /></TouchableOpacity>
        </View>

        {/* Message */}
        <Text style={s.section}>Out-of-area message</Text>
        <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]} multiline placeholder="Message shown to users outside the area" value={message} onChangeText={setMessage} data-testid="input-oos-message" />

        <TouchableOpacity style={[s.save, saving && { opacity: 0.6 }]} onPress={saveAll} disabled={saving} data-testid="save-service-area-btn">
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Save all</Text>}
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
  emptyHint: { fontSize: 12, color: '#9ca3af', marginTop: 10, fontStyle: 'italic' },
  section: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 26, marginBottom: 6 },
  mapWrap: { height: 420, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb', marginTop: 10 },
  mapFallback: { height: 160, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, padding: 16 },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f9fafb', borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  zoneText: { flex: 1, fontSize: 13, color: '#111827' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#eff6ff', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  chipText: { fontSize: 13, color: '#1e40af', fontWeight: '600' },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  input: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: '#f9fafb' },
  addBtn: { width: 46, borderRadius: 10, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  save: { backgroundColor: '#2563eb', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 28 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
