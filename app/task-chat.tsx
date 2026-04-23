import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Alert,
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

/** Play a short notification beep using Web Audio API */
function playNotificationSound() {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch {}
}

/** Show a browser push notification */
function showBrowserNotification(title: string, body: string) {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((perm) => {
      if (perm === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' });
      }
    });
  }
}

/** Pick image via hidden <input type="file"> on web, returns base64 data URI */
function pickImageWeb(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      if (file.size > 5 * 1024 * 1024) {
        Alert.alert('Файл занадто великий', 'Максимальний розмір фото — 5 МБ');
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

export default function TaskChat() {
  const { taskId, taskTitle } = useLocalSearchParams<{ taskId: string; taskTitle: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevMsgCountRef = useRef<number>(0);
  const isFirstLoadRef = useRef(true);

  // Request browser notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const data = await api.getTaskMessages(taskId);
      const msgList = Array.isArray(data) ? data : (data?.messages ?? []);
      setMessages(msgList);

      // Detect new messages from others (not first load)
      if (!isFirstLoadRef.current) {
        const newCount = msgList.length;
        const prevCount = prevMsgCountRef.current;
        if (newCount > prevCount) {
          // Check if any new messages are from others
          const newMsgs = msgList.slice(prevCount);
          const othersNewMsgs = newMsgs.filter((m: any) => m.from_user_id !== user?.user_id);
          if (othersNewMsgs.length > 0) {
            const lastNew = othersNewMsgs[othersNewMsgs.length - 1];
            const senderName = lastNew.sender?.name || 'Новe повідомлення';
            playNotificationSound();
            showBrowserNotification(
              senderName,
              lastNew.text || (lastNew.image_url ? '📷 Фото' : 'Нове повідомлення')
            );
          }
        }
      }

      prevMsgCountRef.current = msgList.length;
      isFirstLoadRef.current = false;

      // Mark messages as read
      if (msgList.length > 0) {
        api.markTaskMessagesRead(taskId).catch(() => {});
      }
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  }, [taskId, user?.user_id]);

  useEffect(() => {
    loadMessages();
    pollRef.current = setInterval(loadMessages, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadMessages]);

  const sendMessage = async () => {
    if (!text.trim() && !pendingImage) return;
    setSending(true);
    const msgText = text.trim();
    const imgData = pendingImage;
    setText('');
    setPendingImage(null);
    try {
      const msg = await api.sendTaskMessage(taskId, msgText, imgData || undefined);
      setMessages(prev => {
        const updated = [...prev, msg];
        prevMsgCountRef.current = updated.length;
        return updated;
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      setText(msgText);
      setPendingImage(imgData);
      Alert.alert('Помилка', e?.response?.data?.detail || e.message || 'Не вдалося відправити');
    } finally {
      setSending(false);
    }
  };

  const handlePickImage = async () => {
    if (Platform.OS === 'web') {
      const img = await pickImageWeb();
      if (img) setPendingImage(img);
    } else {
      Alert.alert('Фото', 'Функція доступна у веб-версії додатку');
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
          {/* Image attachment */}
          {item.image_url && (
            <Image
              source={{ uri: item.image_url }}
              style={s.msgImage}
              resizeMode="cover"
            />
          )}
          {/* Text */}
          {!!item.text && (
            <Text style={[s.msgText, isMe && s.msgTextMe]}>{item.text}</Text>
          )}
          <View style={s.msgFooter}>
            <Text style={[s.msgTime, isMe && s.msgTimeMe]}>{fmtTime(item.created_at)}</Text>
            {isMe && (
              <Ionicons
                name={item.read ? 'checkmark-done' : 'checkmark'}
                size={14}
                color={item.read ? '#93c5fd' : 'rgba(255,255,255,0.5)'}
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
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

      {/* Pending image preview */}
      {pendingImage && (
        <View style={s.pendingImgRow}>
          <Image source={{ uri: pendingImage }} style={s.pendingImg} resizeMode="cover" />
          <TouchableOpacity style={s.pendingImgRemove} onPress={() => setPendingImage(null)}>
            <Ionicons name="close-circle" size={22} color="#ef4444" />
          </TouchableOpacity>
          <Text style={s.pendingImgLabel}>Фото готове до відправки</Text>
        </View>
      )}

      {/* Input */}
      <View style={s.inputRow}>
        {/* Photo attach button */}
        <TouchableOpacity style={s.attachBtn} onPress={handlePickImage}>
          <Ionicons name="image-outline" size={24} color="#2563eb" />
        </TouchableOpacity>

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
          style={[s.sendBtn, (!text.trim() && !pendingImage || sending) && s.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={(!text.trim() && !pendingImage) || sending}
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

  msgImage: { width: 200, height: 150, borderRadius: 10, marginBottom: 6 },
  msgText:   { fontSize: 15, color: '#111827', lineHeight: 20 },
  msgTextMe: { color: '#fff' },
  msgFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  msgTime:   { fontSize: 11, color: '#9ca3af' },
  msgTimeMe: { color: 'rgba(255,255,255,0.7)' },

  emptyBox:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#9ca3af' },
  emptyHint: { fontSize: 14, color: '#d1d5db' },

  // Pending image preview bar
  pendingImgRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#eff6ff', borderTopWidth: 1, borderTopColor: '#bfdbfe',
  },
  pendingImg: { width: 48, height: 48, borderRadius: 8 },
  pendingImgRemove: { position: 'absolute', top: 4, left: 44 },
  pendingImgLabel: { flex: 1, fontSize: 13, color: '#2563eb', fontWeight: '600' },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 12, paddingBottom: 28, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#e5e7eb',
  },
  attachBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#eff6ff',
    justifyContent: 'center', alignItems: 'center',
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
