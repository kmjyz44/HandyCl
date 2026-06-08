import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import { showAlert, showConfirm } from '../../utils/alert';

function fmt(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleString('uk-UA', { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return ''; }
}

const ROLE_LABEL: Record<string, { text: string; color: string }> = {
  client:   { text: 'Клієнт',     color: '#3b82f6' },
  provider: { text: 'Виконавець', color: '#16a34a' },
  admin:    { text: 'Адмін',      color: '#a855f7' },
};

export default function BlogPostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    if (!id) return;
    try {
      const p = await api.getBlogPost(id);
      setPost(p);
    } catch {
      setPost(null);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);

  const onLike = async () => {
    if (!user) { showAlert('Увійди', 'Щоб ставити лайки, треба увійти'); return; }
    try {
      const r = await api.toggleBlogLike(post.post_id);
      setPost((p: any) => ({ ...p, liked_by_me: r.liked, likes_count: r.likes_count }));
    } catch (e: any) {
      showAlert('Помилка', e?.message || 'Не вдалось');
    }
  };

  const onComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    if (!user) { showAlert('Увійди', 'Щоб коментувати, треба увійти'); return; }
    setSending(true);
    try {
      const c = await api.addBlogComment(post.post_id, text);
      setPost((p: any) => ({
        ...p,
        comments: [c, ...(p.comments || [])],
        comments_count: (p.comments_count || 0) + 1,
      }));
      setCommentText('');
    } catch (e: any) {
      showAlert('Помилка', e?.response?.data?.detail || 'Не вдалось');
    } finally { setSending(false); }
  };

  const onDelete = () => {
    showConfirm(
      'Видалити пост?',
      'Цю дію не можна скасувати.',
      async () => {
        try {
          await api.deleteBlogPost(post.post_id);
          router.back();
        } catch (e: any) {
          showAlert('Помилка', e?.response?.data?.detail || 'Не вдалось');
        }
      },
      'Видалити',
      'Скасувати',
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#2563eb" /></View>;
  }
  if (!post) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color="#9ca3af" />
        <Text style={styles.notFound}>Пост не знайдено</Text>
      </View>
    );
  }

  const role = ROLE_LABEL[post.author_role] || ROLE_LABEL.client;
  const canDelete = user && (user.user_id === post.author_id || (user as any).role === 'admin');

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#f9fafb' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: 'Публікація',
          headerRight: () => canDelete ? (
            <TouchableOpacity onPress={onDelete} style={{ paddingHorizontal: 12 }} data-testid="blog-delete-btn">
              <Ionicons name="trash-outline" size={20} color="#dc2626" />
            </TouchableOpacity>
          ) : null,
        }}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        {/* Author */}
        <View style={styles.author}>
          {post.author_avatar ? (
            <Image source={{ uri: post.author_avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="person" size={20} color="#6b7280" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.authorName}>{post.author_name || 'Користувач'}</Text>
            <Text style={styles.authorMeta}>
              <Text style={[styles.roleTag, { color: role.color }]}>{role.text}</Text>
              {' · '}{fmt(post.created_at)}
            </Text>
          </View>
        </View>

        {/* Images */}
        {post.images?.map((img: string, i: number) => (
          <Image key={i} source={{ uri: img }} style={styles.image} resizeMode="cover" />
        ))}

        {/* Body */}
        <View style={styles.body}>
          <Text style={styles.title}>{post.title}</Text>
          <Text style={styles.description}>{post.description}</Text>
          {post.tags?.length > 0 && (
            <View style={styles.tagRow}>
              {post.tags.map((t: string) => (
                <Text key={t} style={styles.tag}>#{t}</Text>
              ))}
            </View>
          )}
          <View style={styles.actions}>
            <TouchableOpacity onPress={onLike} style={styles.actionBtn} data-testid="like-btn">
              <Ionicons
                name={post.liked_by_me ? 'heart' : 'heart-outline'}
                size={22}
                color={post.liked_by_me ? '#dc2626' : '#6b7280'}
              />
              <Text style={[styles.actionText, post.liked_by_me && { color: '#dc2626' }]}>
                {post.likes_count || 0}
              </Text>
            </TouchableOpacity>
            <View style={styles.actionBtn}>
              <Ionicons name="chatbubble-outline" size={20} color="#6b7280" />
              <Text style={styles.actionText}>{post.comments_count || 0}</Text>
            </View>
          </View>
        </View>

        {/* Comments */}
        <View style={styles.commentsBlock}>
          <Text style={styles.commentsHeader}>Коментарі ({post.comments?.length || 0})</Text>
          {(post.comments || []).map((c: any) => (
            <View key={c.comment_id} style={styles.comment} data-testid={`comment-${c.comment_id}`}>
              {c.author_avatar ? (
                <Image source={{ uri: c.author_avatar }} style={styles.commentAvatar} />
              ) : (
                <View style={[styles.commentAvatar, { backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="person" size={14} color="#6b7280" />
                </View>
              )}
              <View style={styles.commentBubble}>
                <Text style={styles.commentAuthor}>{c.author_name || 'Користувач'}</Text>
                <Text style={styles.commentText}>{c.text}</Text>
                <Text style={styles.commentTime}>{fmt(c.created_at)}</Text>
              </View>
            </View>
          ))}
          {!post.comments?.length && (
            <Text style={styles.noComments}>Поки немає коментарів. Стань першим!</Text>
          )}
        </View>
      </ScrollView>

      {user && (
        <View style={styles.composer}>
          <TextInput
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Залишити коментар..."
            style={styles.composerInput}
            multiline
            data-testid="comment-input"
          />
          <TouchableOpacity
            style={[styles.composerBtn, (!commentText.trim() || sending) && { opacity: 0.4 }]}
            onPress={onComment}
            disabled={!commentText.trim() || sending}
            data-testid="send-comment-btn"
          >
            {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f9fafb' },
  notFound: { color: '#6b7280', fontSize: 14, marginTop: 12 },

  author: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  authorName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  authorMeta: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  roleTag: { fontWeight: '700' },

  image: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#f3f4f6' },

  body: { padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  description: { fontSize: 14, color: '#374151', marginTop: 10, lineHeight: 22 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  tag: { fontSize: 12, color: '#2563eb', backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 14, color: '#6b7280', fontWeight: '600' },

  commentsBlock: { padding: 16, backgroundColor: '#f9fafb' },
  commentsHeader: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 12 },
  comment: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16 },
  commentBubble: { flex: 1, backgroundColor: '#fff', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  commentAuthor: { fontSize: 12, fontWeight: '700', color: '#111827' },
  commentText: { fontSize: 13, color: '#374151', marginTop: 2, lineHeight: 18 },
  commentTime: { fontSize: 10, color: '#9ca3af', marginTop: 4 },
  noComments: { textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 12 },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 8, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#e5e7eb',
  },
  composerInput: {
    flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 18,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, maxHeight: 100,
    backgroundColor: '#f9fafb',
  },
  composerBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563eb',
    alignItems: 'center', justifyContent: 'center',
  },
});
