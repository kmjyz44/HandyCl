import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';

const ROLE_LABELS: Record<string, string> = {
  client:    'Клієнт',
  provider:  'Виконавець',
  admin:     'Адмін',
  moderator: 'Модератор',
};

const ROLE_COLORS: Record<string, string> = {
  client:    '#2563eb',
  provider:  '#f97316',
  admin:     '#7c3aed',
  moderator: '#0891b2',
};

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch { return ''; }
}

export default function TaskChat() {
  const { taskId, taskTitle } = useLocalSearchParams<{ taskId: string; taskTitle: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadMessages();
    // Poll every 3 seconds for new messages
    pollRef.current = setInterval(loadMessages, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [taskId]);

  const loadMessages = async () => {
    try {
      const data = await api.getTaskMessages(taskId);
      setMessages(data);
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!text.trim()) return;
    setSending(true);
    const msgText = text.trim();
    setText('');
    try {
      const msg = await api.sendTaskMessage(taskId, msgText);
      setMessages(prev => [...prev, msg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      setText(msgText); // restore on error
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.from_user_id === user?.user_id;
    const senderName = item.sender?.name || 'Користувач';
    const senderRole = item.sender?.role || 'client';
    const senderPhoto = item.sender?.picture;
    const roleColor = ROLE_COLORS[senderRole] || '#6b7280';
    const roleLabel = ROLE_LABELS[senderRole] || senderRole;

    return (
      <View style={[s.msgRow, isMe && s.msgRowMe]}>
        {/* Avatar (only for others) */}
        {!isMe && (
          <View style={[s.msgAvatar, { backgroundColor: roleColor + '22' }]}>
            {senderPhoto
              ? <Image source={{ uri: senderPhoto }} style={s.msgAvatarImg} />
              : <Text style={[s.msgAvatarInitial, { color: roleColor }]}>
                  {senderName.charAt(0).toUpperCase()}
                </Text>
            }
          </View>
        )}

        <View style={[s.msgBubble, isMe ? s.msgBubbleMe : s.msgBubbleOther]}>
          {/* Sender name + role badge */}
          {!isMe && (
            <View style={s.msgMeta}>
              <Text style={[s.msgSender, { color: roleColor }]}>{senderName}</Text>
              <View style={[s.roleBadge, { backgroundColor: roleColor + '22' }]}>
                <Text style={[s.roleBadgeText, { color: roleColor }]}>{roleLabel}</Text>
              </View>
            </View>
          )}
          <Text style={[s.msgText, isMe && s.msgTextMe]}>{item.text}</Text>
          <Text style={[s.msgTime, isMe && s.msgTimeMe]}>{fmtTime(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <Text style={s.headerTitle} numberOfLines={1}>
            {taskTitle || 'Чат завдання'}
          </Text>
          <Text style={s.headerSub}>Клієнт · Виконавець · Підтримка</Text>
        </View>
        <View style={s.headerAvatars}>
          {['client', 'provider', 'admin'].map((role) => (
            <View key={role} style={[s.miniAvatar, { backgroundColor: ROLE_COLORS[role] }]}>
              <Ionicons
                name={role === 'client' ? 'person' : role === 'provider' ? 'construct' : 'shield-checkmark'}
                size={10} color="#fff"
              />
            </View>
          ))}
        </View>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={s.centered}><ActivityIndicator size="large" color="#2563eb" /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.message_id}
          renderItem={renderMessage}
          contentContainerStyle={s.msgList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={s.emptyBox}>
              <Ionicons name="chatbubbles-outline" size={48} color="#d1d5db" />
              <Text style={s.emptyText}>Поки немає повідомлень</Text>
              <Text style={s.emptyHint}>Напишіть першим!</Text>
            </View>
          }
        />
      )}

      {/* Input */}
      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          value={text}
          onChangeText={setText}
          placeholder="Написати повідомлення..."
          placeholderTextColor="#9ca3af"
          multiline
          maxLength={1000}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[s.sendBtn, (!text.trim() || sending) && s.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!text.trim() || sending}
        >
          {sending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="send" size={20} color="#fff" />
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, paddingTop: 60, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  backBtn:    { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  headerSub:   { fontSize: 12, color: '#6b7280', marginTop: 2 },
  headerAvatars: { flexDirection: 'row', gap: -6 },
  miniAvatar: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff' },

  msgList: { padding: 16, gap: 12, paddingBottom: 8 },

  msgRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 8 },
  msgRowMe: { flexDirection: 'row-reverse' },

  msgAvatar:        { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  msgAvatarImg:     { width: 36, height: 36, borderRadius: 18 },
  msgAvatarInitial: { fontSize: 15, fontWeight: '700' },

  msgBubble:      { maxWidth: '75%', borderRadius: 16, padding: 12, paddingBottom: 8 },
  msgBubbleOther: { backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  msgBubbleMe:    { backgroundColor: '#2563eb', borderBottomRightRadius: 4 },

  msgMeta:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  msgSender: { fontSize: 12, fontWeight: '700' },
  roleBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  roleBadgeText: { fontSize: 10, fontWeight: '600' },

  msgText:   { fontSize: 15, color: '#111827', lineHeight: 20 },
  msgTextMe: { color: '#fff' },
  msgTime:   { fontSize: 11, color: '#9ca3af', marginTop: 4, textAlign: 'right' },
  msgTimeMe: { color: 'rgba(255,255,255,0.7)' },

  emptyBox:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#9ca3af' },
  emptyHint: { fontSize: 14, color: '#d1d5db' },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    padding: 12, paddingBottom: 28, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#e5e7eb',
  },
  input: {
    flex: 1, backgroundColor: '#f3f4f6', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15,
    maxHeight: 120, color: '#111827',
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#2563eb',
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#93c5fd' },
});
