import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Slot = { day_of_week: number; specific_date?: string; start_time?: string; end_time?: string; is_active?: boolean };

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const to12 = (t?: string) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

// Upcoming days (next `days`) with the pro's working hours for each.
export function upcomingAvailability(slots: Slot[] = [], days = 14) {
  const out: { key: string; label: string; times: string[] }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const key = ymd(d);
    const dow = (d.getDay() + 6) % 7;
    const times = slots
      .filter(s => s.is_active !== false && (s.specific_date ? String(s.specific_date).slice(0, 10) === key : s.day_of_week === dow))
      .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
      .map(s => `${to12(s.start_time)} – ${to12(s.end_time)}`);
    const uniq = Array.from(new Set(times));
    if (uniq.length) out.push({ key, label: `${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DAY[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`, times: uniq });
  }
  return out;
}

export function ProAvailabilityModal({ visible, name, slots, onClose, onBook }: {
  visible: boolean; name: string; slots: Slot[]; onClose: () => void; onBook: () => void;
}) {
  const list = upcomingAvailability(slots);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.overlay}>
        <View style={st.sheet} data-testid="pro-availability-modal">
          <View style={st.head}>
            <Text style={st.title} numberOfLines={1}>{name} · available dates</Text>
            <TouchableOpacity onPress={onClose} data-testid="pro-availability-close"><Ionicons name="close" size={24} color="#374151" /></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 380 }}>
            {list.length === 0 ? (
              <Text style={st.empty} data-testid="pro-availability-empty">No free dates in the next 2 weeks.</Text>
            ) : list.map(d => (
              <View key={d.key} style={st.row} data-testid={`pro-availability-day-${d.key}`}>
                <Text style={st.day}>{d.label}</Text>
                <Text style={st.times}>{d.times.join(', ')}</Text>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={st.btn} onPress={onBook} data-testid="pro-availability-book-btn">
            <Ionicons name="calendar-outline" size={18} color="#fff" />
            <Text style={st.btnText}>Open profile & book</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 28 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 },
  title: { flex: 1, fontSize: 17, fontWeight: '800', color: '#111827' },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  day: { fontSize: 14, fontWeight: '700', color: '#111827' },
  times: { fontSize: 13, color: '#059669', marginTop: 2 },
  empty: { fontSize: 14, color: '#6b7280', paddingVertical: 24, textAlign: 'center' },
  btn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, marginTop: 16 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
