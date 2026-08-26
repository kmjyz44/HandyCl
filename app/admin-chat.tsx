import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { showAlert } from '../utils/alert';

function fmt(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleString('en-US', { month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true });
  } catch { return ''; }
}

// Admin-side direct chat with any platform user.
export default function AdminChat() {
  const router = useRouter();
  const { user } = useAuthStore();
  const params = useLocalSearchParams<{ user_id?: string; name?: string }>();
  const targetId = params.user_id as string;
  const targetName = (params.name as string) || 'User';

  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = async () => {
    try {
      const msgs = await api.getDirectMessages(targetId);
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Could not load the chat');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!targetId) { setLoading(false); return; }
    load();
    const id = setInterval(async () => {
      try {
        const msgs = await api.getDirectMessages(targetId);
        setMessages(Array.isArray(msgs) ? msgs : []);
      } catch {}
    }, 8000);
    return () => clearInterval(id);
  }, [targetId]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setSending(true);
    try {
      const sent = await api.sendMessage({ to_user_id: targetId, text: t });
      setMessages((arr) => [...arr, sent]);
      setText('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Could not send');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#2563eb" /></View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#f3f4f6' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: targetName }} />

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.message_id}
        contentContainerStyle={{ padding: 12, paddingBottom: 20 }}
        ListEmptyComponent={
          <View style={styles.intro} data-testid="admin-chat-empty">
            <View style={styles.introIcon}><Ionicons name="chatbubbles" size={28} color="#fff" /></View>
            <Text style={styles.introTitle}>Message {targetName}</Text>
            <Text style={styles.introText}>Start the conversation. Your message will appear in the user's chat with support.</Text>
          </View>
        }
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const fromMe = item.from_user_id === user?.user_id;
          return (
            <View style={[styles.bubbleRow, fromMe ? styles.bubbleRowMe : styles.bubbleRowThem]} data-testid={`msg-${item.message_id}`}>
              <View style={[styles.bubble, fromMe ? styles.bubbleMe : styles.bubbleThem]}>
                <Text style={[styles.bubbleText, fromMe && { color: '#fff' }]}>{item.text}</Text>
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
          placeholder={`Message ${targetName}...`}
          style={styles.input}
          multiline
          data-testid="admin-chat-input"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.4 }]}
          onPress={send}
          disabled={!text.trim() || sending}
          data-testid="admin-chat-send-btn"
        >
          {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f3f4f6' },
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
