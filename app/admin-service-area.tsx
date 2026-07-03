import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Switch, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../utils/api';
import { showAlert } from '../utils/alert';

type Center = { label: string; lat: number; lng: number; radius_miles: number };

export default function AdminServiceAreaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [states, setStates] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [message, setMessage] = useState('');
  const [newState, setNewState] = useState('');
  const [newCity, setNewCity] = useState('');

  useEffect(() => { load(); }, []);
  const load = async () => {
    try {
      const d = await api.adminGetServiceArea();
      setEnabled(!!d.enabled);
      setStates(d.states || []);
      setCities(d.cities || []);
      setCenters(d.centers || []);
      setMessage(d.message || '');
    } catch (e) { showAlert('Error', 'Failed to load service area'); }
    finally { setLoading(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.adminUpdateServiceArea({ enabled, states, cities, centers, message });
      showAlert('Saved', 'Service area updated');
    } catch (e) { showAlert('Error', 'Failed to save'); }
    finally { setSaving(false); }
  };

  const addState = () => { if (newState.trim()) { setStates([...states, newState.trim()]); setNewState(''); } };
  const addCity = () => { if (newCity.trim()) { setCities([...cities, newCity.trim()]); setNewCity(''); } };
  const updateCenter = (i: number, key: keyof Center, val: string) => {
    const next = [...centers];
    (next[i] as any)[key] = key === 'label' ? val : parseFloat(val) || 0;
    setCenters(next);
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" /></View>;

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
          <Switch value={enabled} onValueChange={setEnabled} data-testid="service-area-enabled" />
        </View>

        {/* States */}
        <Text style={s.section}>Allowed states</Text>
        <View style={s.chips}>
          {states.map((st, i) => (
            <View key={i} style={s.chip}>
              <Text style={s.chipText}>{st}</Text>
              <TouchableOpacity onPress={() => setStates(states.filter((_, x) => x !== i))}><Ionicons name="close" size={14} color="#6b7280" /></TouchableOpacity>
            </View>
          ))}
        </View>
        <View style={s.addRow}>
          <TextInput style={s.input} placeholder="e.g. Illinois" value={newState} onChangeText={setNewState} data-testid="input-new-state" />
          <TouchableOpacity style={s.addBtn} onPress={addState} data-testid="add-state-btn"><Ionicons name="add" size={20} color="#fff" /></TouchableOpacity>
        </View>

        {/* Cities */}
        <Text style={s.section}>Allowed cities</Text>
        <View style={s.chips}>
          {cities.map((ct, i) => (
            <View key={i} style={s.chip}>
              <Text style={s.chipText}>{ct}</Text>
              <TouchableOpacity onPress={() => setCities(cities.filter((_, x) => x !== i))}><Ionicons name="close" size={14} color="#6b7280" /></TouchableOpacity>
            </View>
          ))}
        </View>
        <View style={s.addRow}>
          <TextInput style={s.input} placeholder="e.g. Chicago" value={newCity} onChangeText={setNewCity} data-testid="input-new-city" />
          <TouchableOpacity style={s.addBtn} onPress={addCity} data-testid="add-city-btn"><Ionicons name="add" size={20} color="#fff" /></TouchableOpacity>
        </View>

        {/* Radius zones */}
        <Text style={s.section}>Radius zones (miles)</Text>
        <Text style={s.hint}>Bookings within the radius of any center are allowed (needs address coordinates).</Text>
        {centers.map((c, i) => (
          <View key={i} style={s.centerCard} data-testid={`center-${i}`}>
            <TextInput style={s.centerInput} placeholder="Label" value={c.label} onChangeText={(v) => updateCenter(i, 'label', v)} />
            <View style={s.centerRow}>
              <TextInput style={[s.centerInput, s.flex1]} placeholder="Lat" keyboardType="numeric" value={String(c.lat)} onChangeText={(v) => updateCenter(i, 'lat', v)} />
              <TextInput style={[s.centerInput, s.flex1]} placeholder="Lng" keyboardType="numeric" value={String(c.lng)} onChangeText={(v) => updateCenter(i, 'lng', v)} />
              <TextInput style={[s.centerInput, s.flex1]} placeholder="Miles" keyboardType="numeric" value={String(c.radius_miles)} onChangeText={(v) => updateCenter(i, 'radius_miles', v)} />
            </View>
            <TouchableOpacity onPress={() => setCenters(centers.filter((_, x) => x !== i))} style={s.removeCenter}><Text style={s.removeCenterText}>Remove</Text></TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={s.addCenter} onPress={() => setCenters([...centers, { label: 'Zone', lat: 41.8781, lng: -87.6298, radius_miles: 30 }])} data-testid="add-center-btn">
          <Ionicons name="add-circle-outline" size={18} color="#2563eb" />
          <Text style={s.addCenterText}>Add radius zone</Text>
        </TouchableOpacity>

        {/* Message */}
        <Text style={s.section}>Out-of-area message</Text>
        <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]} multiline placeholder="Message shown to users outside the area" value={message} onChangeText={setMessage} data-testid="input-oos-message" />

        <TouchableOpacity style={[s.save, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} data-testid="save-service-area-btn">
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Save</Text>}
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
  section: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 26, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#eff6ff', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  chipText: { fontSize: 13, color: '#1e40af', fontWeight: '600' },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  input: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: '#f9fafb' },
  addBtn: { width: 46, borderRadius: 10, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  centerCard: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, marginBottom: 10 },
  centerInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, fontSize: 13, backgroundColor: '#f9fafb', marginBottom: 8 },
  centerRow: { flexDirection: 'row', gap: 8 },
  flex1: { flex: 1 },
  removeCenter: { alignSelf: 'flex-start', marginTop: 2 },
  removeCenterText: { color: '#dc2626', fontSize: 13, fontWeight: '600' },
  addCenter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  addCenterText: { color: '#2563eb', fontSize: 14, fontWeight: '700' },
  save: { backgroundColor: '#2563eb', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 30 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
