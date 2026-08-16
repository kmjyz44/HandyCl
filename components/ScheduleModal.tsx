import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../utils/api';

const SCHED_TIMES = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];

function to12h(t?: string | null): string {
  if (!t) return '';
  const [hs, m] = String(t).split(':');
  let h = parseInt(hs, 10);
  if (isNaN(h)) return String(t);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m ?? '00'} ${ampm}`;
}

function nextDates(count = 14): { value: string; dayName: string; label: string }[] {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const out: { value: string; dayName: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    out.push({ value: d.toISOString().split('T')[0], dayName: days[d.getDay()], label: `${months[d.getMonth()]} ${d.getDate()}` });
  }
  return out;
}

function addHoursTo(hhmm: string, hours: number): string {
  const [h, m] = String(hhmm).split(':');
  let tot = parseInt(h, 10) * 60 + parseInt(m || '0', 10) + Math.round(hours * 60);
  tot = Math.max(0, Math.min(tot, 23 * 60 + 59));
  return `${String(Math.floor(tot / 60)).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;
}

export function ScheduleModal({ visible, task, onClose, onSaved, onPick }: {
  visible: boolean;
  task: any;
  onClose: () => void;
  onSaved?: () => void;
  onPick?: (dateISO: string, startTime12h: string, start24h: string) => void;
}) {
  const [date, setDate] = useState('');
  const [start, setStart] = useState('09:00');
  const [duration, setDuration] = useState(2);
  const [loading, setLoading] = useState(false);
  const confirmed = !!task?.schedule_confirmed;

  useEffect(() => {
    if (!visible) return;
    const d = task?.confirmed_date || task?.scheduled_date || task?.date || nextDates(1)[0].value;
    const st = task?.confirmed_start_time || task?.scheduled_time || task?.time || '09:00';
    setDate(String(d).slice(0, 10));
    setStart(SCHED_TIMES.includes(st) ? st : '09:00');
    setDuration(task?.duration_hours ? Number(task.duration_hours) : 2);
  }, [visible, task]);

  const save = async () => {
    if (!date || !start || duration <= 0) {
      Alert.alert('Missing info', 'Pick a date, start time and duration.');
      return;
    }
    // "Pick" mode — just return the selection to the caller (no API save).
    if (onPick) {
      onPick(date, to12h(start), start);
      onClose();
      return;
    }
    const tid = task?.task_id || task?.booking_id;
    if (!tid) { Alert.alert('Error', 'Task not found.'); return; }
    setLoading(true);
    try {
      await api.scheduleTask(tid, { date, start_time: start, duration_hours: duration });
      const msg = 'Appointment saved. The client has been notified.';
      if (Platform.OS === 'web') window.alert(msg); else Alert.alert('Saved', msg);
      onClose();
      onSaved?.();
    } catch (e: any) {
      const m = e?.response?.data?.detail || e.message || 'Error';
      if (Platform.OS === 'web') window.alert('Error: ' + m); else Alert.alert('Error', m);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={m.overlay}>
        <View style={m.box}>
          <View style={m.header}>
            <Text style={m.title}>{confirmed ? 'Reschedule appointment' : 'Set appointment time'}</Text>
            <TouchableOpacity onPress={onClose} data-testid="close-schedule-btn">
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ paddingHorizontal: 20 }} contentContainerStyle={{ paddingBottom: 8 }}>
            <Text style={m.hint}>
              Pick the day, start time and how long the job will take. This time is blocked in your calendar and the client is notified.
            </Text>

            <Text style={m.label}>Day</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 8 }}>
              {nextDates(14).map(d => {
                const active = date === d.value;
                return (
                  <TouchableOpacity
                    key={d.value}
                    onPress={() => setDate(d.value)}
                    data-testid={`sched-day-${d.value}`}
                    style={[m.dayCell, active && m.dayCellActive]}
                  >
                    <Text style={[m.dayDow, active && m.activeBlue]}>{d.dayName}</Text>
                    <Text style={[m.dayNum, active && m.activeBlue]}>{d.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={m.label}>Start time</Text>
            <View style={m.chipWrap}>
              {SCHED_TIMES.map(t => {
                const active = start === t;
                return (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setStart(t)}
                    data-testid={`sched-time-${t}`}
                    style={[m.timeChip, active && m.timeChipActive]}
                  >
                    <Text style={[m.timeChipText, active && { color: '#fff' }]}>{to12h(t)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={m.label}>Duration (hours)</Text>
            <View style={m.durRow}>
              <TouchableOpacity
                onPress={() => setDuration(d => Math.max(0.5, Math.round((d - 0.5) * 2) / 2))}
                data-testid="sched-duration-minus"
                style={m.stepBtn}
              >
                <Ionicons name="remove" size={22} color="#2563eb" />
              </TouchableOpacity>
              <Text style={m.durVal} data-testid="sched-duration-value">
                {duration} hr{duration > 1 ? 's' : ''}
              </Text>
              <TouchableOpacity
                onPress={() => setDuration(d => Math.min(12, Math.round((d + 0.5) * 2) / 2))}
                data-testid="sched-duration-plus"
                style={m.stepBtn}
              >
                <Ionicons name="add" size={22} color="#2563eb" />
              </TouchableOpacity>
            </View>

            <View style={m.summary}>
              <Text style={m.summaryText} data-testid="sched-summary">
                {date} · {to12h(start)}–{to12h(addHoursTo(start, duration))}
              </Text>
            </View>
          </ScrollView>

          <View style={m.footer}>
            <TouchableOpacity style={[m.btn, m.cancelBtn]} onPress={onClose}>
              <Text style={m.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[m.btn, { backgroundColor: '#2563eb', flex: 1 }, loading && { opacity: 0.6 }]}
              onPress={save}
              disabled={loading}
              data-testid="save-schedule-btn"
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={m.saveText}>{confirmed ? 'Update time' : 'Confirm time'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  box: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  hint: { fontSize: 12, color: '#6b7280', marginTop: 12, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  dayCell: { minWidth: 56, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  dayCellActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  dayDow: { fontSize: 11, color: '#6b7280', fontWeight: '600' },
  dayNum: { fontSize: 13, color: '#111827', fontWeight: '700', marginTop: 2 },
  activeBlue: { color: '#2563eb' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  timeChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  timeChipActive: { borderColor: '#2563eb', backgroundColor: '#2563eb' },
  timeChipText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  durRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  stepBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  durVal: { fontSize: 20, fontWeight: '800', color: '#111827', minWidth: 70, textAlign: 'center' },
  summary: { backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12, marginTop: 6 },
  summaryText: { fontSize: 13, color: '#166534', fontWeight: '600' },
  footer: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  btn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { paddingHorizontal: 20, backgroundColor: '#f3f4f6' },
  cancelText: { fontSize: 15, fontWeight: '700', color: '#374151' },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
