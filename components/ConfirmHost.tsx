import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type InternalState = (ConfirmOptions & { resolve: (v: boolean) => void }) | null;

let _open: ((opts: ConfirmOptions & { resolve: (v: boolean) => void }) => void) | null = null;

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!_open) { resolve(false); return; }
    _open({ ...opts, resolve });
  });
}

export default function ConfirmHost() {
  const [state, setState] = useState<InternalState>(null);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    _open = (opts) => setState(opts);
    return () => { _open = null; };
  }, []);

  useEffect(() => {
    if (state) {
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, useNativeDriver: Platform.OS !== 'web', tension: 90, friction: 13 }).start();
    }
  }, [state]);

  const close = (result: boolean) => {
    state?.resolve(result);
    setState(null);
  };

  if (!state) return null;
  const destructive = state.destructive;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => close(false)}>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            { opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] },
          ]}
          data-testid="confirm-dialog"
        >
          <View style={[styles.iconCircle, { backgroundColor: destructive ? '#fef2f2' : '#eff6ff' }]}>
            <Ionicons
              name={destructive ? 'trash-outline' : 'help-circle-outline'}
              size={26}
              color={destructive ? '#dc2626' : '#2563eb'}
            />
          </View>
          <Text style={styles.title}>{state.title}</Text>
          {!!state.message && <Text style={styles.message}>{state.message}</Text>}
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => close(false)} data-testid="confirm-cancel-btn">
              <Text style={styles.btnCancelText}>{state.cancelLabel || 'Cancel'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, destructive ? styles.btnDanger : styles.btnPrimary]}
              onPress={() => close(true)}
              data-testid="confirm-accept-btn"
            >
              <Text style={styles.btnConfirmText}>{state.confirmLabel || 'OK'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%', maxWidth: 380, backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 30, shadowOffset: { width: 0, height: 12 }, elevation: 10,
  },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 8 },
  message: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  actions: { flexDirection: 'row', gap: 12, width: '100%' },
  btn: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnCancel: { backgroundColor: '#f3f4f6' },
  btnCancelText: { fontSize: 15, fontWeight: '700', color: '#374151' },
  btnPrimary: { backgroundColor: '#2563eb' },
  btnDanger: { backgroundColor: '#dc2626' },
  btnConfirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
