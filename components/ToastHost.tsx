import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type ToastType = 'success' | 'error' | 'info';
type ToastItem = { id: number; type: ToastType; title?: string; message?: string };

let _emit: ((t: Omit<ToastItem, 'id'>) => void) | null = null;
let _counter = 0;

export const toast = {
  show: (t: { type?: ToastType; title?: string; message?: string }) =>
    _emit?.({ type: t.type || 'info', title: t.title, message: t.message }),
  success: (title: string, message?: string) => _emit?.({ type: 'success', title, message }),
  error: (title: string, message?: string) => _emit?.({ type: 'error', title, message }),
  info: (title: string, message?: string) => _emit?.({ type: 'info', title, message }),
};

const THEME: Record<ToastType, { bg: string; border: string; icon: any; iconColor: string; title: string }> = {
  success: { bg: '#ecfdf5', border: '#a7f3d0', icon: 'checkmark-circle', iconColor: '#059669', title: '#065f46' },
  error: { bg: '#fef2f2', border: '#fecaca', icon: 'alert-circle', iconColor: '#dc2626', title: '#991b1b' },
  info: { bg: '#eff6ff', border: '#bfdbfe', icon: 'information-circle', iconColor: '#2563eb', title: '#1e40af' },
};

function ToastRow({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  const anim = useRef(new Animated.Value(0)).current;
  const t = THEME[item.type];

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: Platform.OS !== 'web', tension: 80, friction: 12 }).start();
    const timer = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start(() => onDone(item.id));
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: t.bg, borderColor: t.border },
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
        },
      ]}
      data-testid="app-toast"
    >
      <Ionicons name={t.icon} size={22} color={t.iconColor} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        {!!item.title && <Text style={[styles.title, { color: t.title }]} numberOfLines={2}>{item.title}</Text>}
        {!!item.message && <Text style={styles.message} numberOfLines={3}>{item.message}</Text>}
      </View>
      <TouchableOpacity onPress={() => onDone(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={16} color="#9ca3af" />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    _emit = (t) => {
      const id = ++_counter;
      setItems((prev) => [...prev.slice(-3), { ...t, id }]);
    };
    return () => { _emit = null; };
  }, []);

  const remove = (id: number) => setItems((prev) => prev.filter((i) => i.id !== id));

  if (!items.length) return null;

  return (
    <View pointerEvents="box-none" style={styles.host}>
      {items.map((item) => (
        <ToastRow key={item.id} item={item} onDone={remove} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 16 : 52,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    gap: 8,
    paddingHorizontal: 16,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    width: '100%',
    maxWidth: 440,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  title: { fontSize: 14, fontWeight: '700' },
  message: { fontSize: 13, color: '#4b5563', marginTop: 1, lineHeight: 18 },
});
