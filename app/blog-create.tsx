import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Image, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../utils/api';
import { showAlert } from '../utils/alert';
import { compressBase64Image } from '../utils/imageCompress';

const SUGGESTED_TAGS = [
  'repair', 'cleaning', 'plumbing', 'electrical', 'furniture',
  'moving', 'design', 'before-after', 'tip', 'review',
];

export default function BlogCreate() {
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const isEdit = !!edit;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const p = await api.getBlogPost(edit as string);
        setTitle(p.title || '');
        setDescription(p.description || '');
        setImages(p.images || []);
        setTags(p.tags || []);
      } catch (e: any) {
        showAlert('Error', 'Could not load the post');
      } finally { setLoading(false); }
    })();
  }, [edit]);

  const pickImage = async () => {
    if (images.length >= 10) {
      showAlert('Limit', 'Maximum 10 images per post');
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted && Platform.OS !== 'web') {
        showAlert('Permission', 'Gallery access is required');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
        allowsMultipleSelection: true,
        selectionLimit: 10 - images.length,
      });
      if (result.canceled) return;
      // Aggressively compress on web — phone cameras produce 5–10 MB photos
      // which bloat the JSON payload and cause "Could not publish" timeouts.
      const raw = (result.assets || [])
        .map((a) => a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri)
        .filter(Boolean) as string[];
      const compressed = await Promise.all(raw.map((r) => compressBase64Image(r, 1024, 0.8)));
      setImages((prev) => [...prev, ...compressed].slice(0, 10));
    } catch (e: any) {
      showAlert('Error', e?.message || 'Could not select a photo');
    }
  };

  const removeImage = (i: number) => {
    setImages((arr) => arr.filter((_, idx) => idx !== i));
  };

  const addTag = (t: string) => {
    const clean = t.trim().toLowerCase().replace(/[#\s,]+/g, '');
    if (!clean) return;
    if (tags.includes(clean) || tags.length >= 10) return;
    setTags((arr) => [...arr, clean]);
    setTagInput('');
  };

  const removeTag = (t: string) => {
    setTags((arr) => arr.filter((x) => x !== t));
  };

  const submit = async () => {
    if (title.trim().length < 3) { showAlert('Error', 'Title must be at least 3 characters'); return; }
    if (description.trim().length < 10) { showAlert('Error', 'Description must be at least 10 characters'); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await api.updateBlogPost(edit as string, {
          title: title.trim(),
          description: description.trim(),
          images,
          tags,
        });
        showAlert('Done', 'Post updated!');
        router.replace(`/blog/${edit}` as any);
      } else {
        const r = await api.createBlogPost({
          title: title.trim(),
          description: description.trim(),
          images,
          tags,
        });
        showAlert('Done', 'Post published!');
        router.replace(`/blog/${r.post_id}` as any);
      }
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || (isEdit ? 'Could not save' : 'Could not publish'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <Stack.Screen
        options={{
          title: isEdit ? 'Edit post' : 'New post',
          headerRight: () => (
            <TouchableOpacity
              onPress={submit}
              disabled={saving}
              style={{ paddingHorizontal: 12 }}
              data-testid="publish-btn"
            >
              {saving
                ? <ActivityIndicator color="#2563eb" size="small" />
                : <Text style={{ color: '#2563eb', fontWeight: '700', fontSize: 14 }}>{isEdit ? 'Save' : 'Publish'}</Text>}
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {/* Images */}
        <Text style={styles.label}>Photos ({images.length}/10)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {images.map((img, i) => (
            <View key={i} style={styles.imageWrap}>
              <Image source={{ uri: img }} style={styles.image} />
              <TouchableOpacity onPress={() => removeImage(i)} style={styles.removeImgBtn} data-testid={`remove-img-${i}`}>
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
          {images.length < 10 && (
            <TouchableOpacity onPress={pickImage} style={styles.addImg} data-testid="add-image-btn">
              <Ionicons name="add" size={32} color="#9ca3af" />
              <Text style={styles.addImgText}>Add</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Title */}
        <Text style={styles.label}>Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Before and after: restored old doors"
          style={styles.input}
          maxLength={200}
          data-testid="title-input"
        />

        {/* Description */}
        <Text style={styles.label}>Description / story</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Tell what you did, what materials, how long it took, and the result..."
          style={[styles.input, styles.textarea]}
          multiline
          numberOfLines={6}
          maxLength={5000}
          data-testid="description-input"
        />

        {/* Tags */}
        <Text style={styles.label}>Tags ({tags.length}/10)</Text>
        <View style={styles.tagRow}>
          {tags.map((t) => (
            <TouchableOpacity key={t} onPress={() => removeTag(t)} style={styles.tagChip} data-testid={`tag-${t}`}>
              <Text style={styles.tagText}>#{t}</Text>
              <Ionicons name="close" size={12} color="#2563eb" />
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={tagInput}
            onChangeText={setTagInput}
            onSubmitEditing={() => addTag(tagInput)}
            placeholder="Add a tag..."
            style={[styles.input, { flex: 1 }]}
            data-testid="tag-input"
          />
          <TouchableOpacity style={styles.addTagBtn} onPress={() => addTag(tagInput)} data-testid="add-tag-btn">
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sub, { marginTop: 8 }]}>Suggestions:</Text>
        <View style={styles.tagRow}>
          {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).map((t) => (
            <TouchableOpacity key={t} onPress={() => addTag(t)} style={styles.tagSuggest}>
              <Text style={styles.tagSuggestText}>#{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.publishBtn, saving && { opacity: 0.5 }]}
          onPress={submit}
          disabled={saving}
          data-testid="publish-bottom-btn"
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.publishBtnText}>{isEdit ? 'Save' : 'Publish'}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginTop: 16, marginBottom: 8 },
  sub: { fontSize: 11, color: '#6b7280' },

  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    backgroundColor: '#fff',
  },
  textarea: { minHeight: 140, textAlignVertical: 'top' },

  imageWrap: { width: 100, height: 100, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  image: { width: '100%', height: '100%', backgroundColor: '#f3f4f6' },
  removeImgBtn: {
    position: 'absolute', top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  addImg: {
    width: 100, height: 100, borderRadius: 10,
    borderWidth: 2, borderStyle: 'dashed', borderColor: '#d1d5db',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  addImgText: { fontSize: 11, color: '#9ca3af', marginTop: 4 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  tagText: { fontSize: 12, color: '#2563eb', fontWeight: '700' },
  tagSuggest: { backgroundColor: '#f3f4f6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tagSuggestText: { fontSize: 12, color: '#6b7280' },

  addTagBtn: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: '#2563eb',
    alignItems: 'center', justifyContent: 'center',
  },

  publishBtn: {
    marginTop: 24, backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 12,
    alignItems: 'center',
  },
  publishBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
