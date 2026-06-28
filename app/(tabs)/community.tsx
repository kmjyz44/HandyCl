import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { api } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import { showAlert } from '../../utils/alert';

function fmt(ts: string) {
  try {
    const d = new Date(ts);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString('en-US');
  } catch {
    return '';
  }
}

const ROLE_LABEL: Record<string, { text: string; color: string }> = {
  client:   { text: 'Client',   color: '#3b82f6' },
  provider: { text: 'Pro',      color: '#16a34a' },
  admin:    { text: 'Admin',    color: '#a855f7' },
};

export default function BlogFeed() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.listBlogPosts({ limit: 30 });
      setPosts(r?.posts || []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onLike = async (post: any) => {
    if (!user) { showAlert('Log in', 'You need to log in to like posts'); return; }
    // optimistic
    const liked = !post.liked_by_me;
    setPosts((arr) => arr.map((p) => p.post_id === post.post_id
      ? { ...p, liked_by_me: liked, likes_count: Math.max(0, (p.likes_count || 0) + (liked ? 1 : -1)) }
      : p
    ));
    try {
      const r = await api.toggleBlogLike(post.post_id);
      setPosts((arr) => arr.map((p) => p.post_id === post.post_id
        ? { ...p, liked_by_me: r.liked, likes_count: r.likes_count }
        : p
      ));
    } catch (e: any) {
      // revert
      setPosts((arr) => arr.map((p) => p.post_id === post.post_id
        ? { ...p, liked_by_me: !liked, likes_count: post.likes_count }
        : p
      ));
      showAlert('Error', e?.response?.data?.detail || 'Failed');
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Community',
          headerRight: () => user ? (
            <TouchableOpacity
              onPress={() => router.push('/blog-create' as any)}
              data-testid="blog-create-btn"
              style={{ paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Ionicons name="add-circle" size={22} color="#2563eb" />
              <Text style={{ color: '#2563eb', fontSize: 13, fontWeight: '700' }}>Create</Text>
            </TouchableOpacity>
          ) : null,
        }}
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#2563eb" />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.post_id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={posts.length === 0 ? styles.emptyWrap : { paddingBottom: 24 }}
          ListHeaderComponent={
            <View style={styles.intro}>
              <Text style={styles.introTitle}>Community feed</Text>
              <Text style={styles.introSub}>
                Pros and clients share work results, photos, tips, and reviews.
              </Text>
              {user && (
                <TouchableOpacity
                  style={styles.createCta}
                  onPress={() => router.push('/blog-create' as any)}
                  data-testid="blog-create-cta"
                >
                  <Ionicons name="image" size={18} color="#fff" />
                  <Text style={styles.createCtaText}>Share your experience</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="newspaper-outline" size={48} color="#9ca3af" />
              <Text style={styles.emptyText}>No posts yet</Text>
              <Text style={styles.emptySub}>Be the first — share a photo of your work!</Text>
            </View>
          }
          renderItem={({ item }) => {
            const role = ROLE_LABEL[item.author_role] || ROLE_LABEL.client;
            const cover = item.images?.[0];
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => router.push(`/blog/${item.post_id}` as any)}
                data-testid={`blog-post-${item.post_id}`}
                activeOpacity={0.85}
              >
                {cover ? <Image source={{ uri: cover }} style={styles.cover} resizeMode="cover" /> : null}
                <View style={styles.cardBody}>
                  <View style={styles.authorRow}>
                    {item.author_avatar ? (
                      <Image source={{ uri: item.author_avatar }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, { backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="person" size={16} color="#6b7280" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.authorName}>{item.author_name || 'User'}</Text>
                      <Text style={styles.authorMeta}>
                        <Text style={[styles.roleTag, { color: role.color }]}>{role.text}</Text>
                        {' · '}{fmt(item.created_at)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.descPreview} numberOfLines={3}>{item.description}</Text>
                  {item.tags?.length > 0 && (
                    <View style={styles.tagRow}>
                      {item.tags.slice(0, 5).map((t: string) => (
                        <Text key={t} style={styles.tag}>#{t}</Text>
                      ))}
                    </View>
                  )}
                  <View style={styles.actions}>
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation?.(); onLike(item); }}
                      style={styles.actionBtn}
                      data-testid={`like-${item.post_id}`}
                    >
                      <Ionicons
                        name={item.liked_by_me ? 'heart' : 'heart-outline'}
                        size={20}
                        color={item.liked_by_me ? '#dc2626' : '#6b7280'}
                      />
                      <Text style={[styles.actionText, item.liked_by_me && { color: '#dc2626' }]}>
                        {item.likes_count || 0}
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.actionBtn}>
                      <Ionicons name="chatbubble-outline" size={18} color="#6b7280" />
                      <Text style={styles.actionText}>{item.comments_count || 0}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  intro: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  introTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  introSub: { fontSize: 13, color: '#6b7280', marginTop: 4, lineHeight: 18 },
  createCta: {
    marginTop: 12, backgroundColor: '#2563eb', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 10,
  },
  createCtaText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  card: {
    backgroundColor: '#fff', marginHorizontal: 12, marginTop: 12,
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  cover: { width: '100%', height: 200, backgroundColor: '#f3f4f6' },
  cardBody: { padding: 14 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  authorName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  authorMeta: { fontSize: 11, color: '#6b7280', marginTop: 1 },
  roleTag: { fontWeight: '700' },

  title: { fontSize: 16, fontWeight: '800', color: '#111827', marginTop: 4 },
  descPreview: { fontSize: 13, color: '#4b5563', marginTop: 6, lineHeight: 18 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { fontSize: 11, color: '#2563eb', backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 13, color: '#6b7280', fontWeight: '600' },

  emptyWrap: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 16, color: '#374151', fontWeight: '700', marginTop: 12 },
  emptySub: { fontSize: 12, color: '#6b7280', marginTop: 4, textAlign: 'center' },
});
