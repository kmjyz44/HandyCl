import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { showAlert } from '../utils/alert';

function fmt(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleString('uk-UA', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
  } catch { return ''; }
}

export default function SupportChat() {
  const { user } = useAuthStore();
  const [admin, setAdmin] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = async () => {
    try {
      const a = await api.getAdminContact();
      setAdmin(a);
      const msgs = await api.getDirectMessages(a.user_id);
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch (e: any) {
      showAlert('Помилка', e?.response?.data?.detail || 'Не вдалось завантажити чат');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      showAlert('Увійди', 'Щоб писати у підтримку, треба увійти в обліковий запис');
      setLoading(false);
      return;
    }
    load();
    const id = setInterval(async () => {
      if (admin?.user_id) {
        try {
          const msgs = await api.getDirectMessages(admin.user_id);
          setMessages(Array.isArray(msgs) ? msgs : []);
        } catch {}
      }
    }, 8000);
    return () => clearInterval(id);
  }, [user]);

  const send = async () => {
    const t = text.trim();
    if (!t || !admin) return;
    setSending(true);
    try {
      const sent = await api.sendDirectMessage(admin.user_id, t);
      setMessages((arr) => [...arr, sent]);
      setText('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (e: any) {
      showAlert('Помилка', e?.response?.data?.detail || 'Не вдалось надіслати');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#2563eb" /></View>;
  }
  if (!user) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={48} color="#9ca3af" />
        <Text style={styles.empty}>Увійди, щоб писати в підтримку</Text>
      </View>
    );
  }
  if (!admin) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color="#9ca3af" />
        <Text style={styles.empty}>Адміна поки не призначено</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#f3f4f6' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: admin.name || 'Підтримка',
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {admin.avatar ? (
                <Image source={{ uri: admin.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="shield-checkmark" size={16} color="#fff" />
                </View>
              )}
              <View>
                <Text style={styles.headerName}>{admin.name}</Text>
                <Text style={styles.headerStatus}>Підтримка HandyHub</Text>
              </View>
            </View>
          ),
        }}
      />

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.message_id}
        contentContainerStyle={{ padding: 12, paddingBottom: 20 }}
        ListEmptyComponent={
          <View style={styles.intro}>
            <View style={styles.introIcon}>
              <Ionicons name="chatbubbles" size={28} color="#fff" />
            </View>
            <Text style={styles.introTitle}>Привіт! 👋</Text>
            <Text style={styles.introText}>
              Напиши коротко, що сталось — наш адмін прочитає й відповість тут.
              Зазвичай відповідаємо протягом кількох годин.
            </Text>
          </View>
        }
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const fromMe = item.from_user_id === user!.user_id;
          return (
            <View style={[styles.bubbleRow, fromMe ? styles.bubbleRowMe : styles.bubbleRowThem]} data-testid={`msg-${item.message_id}`}>
              <View style={[styles.bubble, fromMe ? styles.bubbleMe : styles.bubbleThem]}>
                <Text style={[styles.bubbleText, fromMe && { color: '#fff' }]}>{item.message}</Text>
                <Text style={[styles.bubbleTime, fromMe && { color: '#dbeafe' }]}>{fmt(item.created_at)}</Text>
              </View>
            </View>
          );
        }}
      />

      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Опиши свою проблему..."
          style={styles.input}
          multiline
          data-testid="support-chat-input"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.4 }]}
          onPress={send}
          disabled={!text.trim() || sending}
          data-testid="support-chat-send-btn"
        >
          {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f3f4f6' },
  empty: { color: '#6b7280', fontSize: 14, marginTop: 12 },

  avatar: { width: 32, height: 32, borderRadius: 16 },
  headerName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  headerStatus: { fontSize: 11, color: '#16a34a' },

  intro: { alignItems: 'center', padding: 24, marginTop: 20 },
  introIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  introTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  introText: { fontSize: 13, color: '#6b7280', marginTop: 6, textAlign: 'center', lineHeight: 18 },

  bubbleRow: { width: '100%', marginVertical: 4 },
  bubbleRowMe: { alignItems: 'flex-end' },
  bubbleRowThem: { alignItems: 'flex-start' },
  bubble: { maxWidth: '78%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  bubbleMe: { backgroundColor: '#2563eb', borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#e5e7eb' },
  bubbleText: { color: '#111827', fontSize: 14, lineHeight: 19 },
  bubbleTime: { color: '#9ca3af', fontSize: 10, marginTop: 4 },

  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  input: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, maxHeight: 100, backgroundColor: '#f9fafb' },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
});
