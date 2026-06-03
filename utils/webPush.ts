// Web Push subscription helper. Browser-only (no-op on native).
// Usage:
//   import { registerWebPush } from '../utils/webPush';
//   useEffect(() => { registerWebPush(); }, []);

import { Platform } from 'react-native';
import { api } from './api';

const SW_URL = '/sw.js';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registerWebPush(): Promise<{ ok: boolean; reason?: string }> {
  if (Platform.OS !== 'web') return { ok: false, reason: 'not-web' };
  if (typeof window === 'undefined') return { ok: false, reason: 'ssr' };
  if (!('serviceWorker' in navigator)) return { ok: false, reason: 'no-sw' };
  if (!('PushManager' in window)) return { ok: false, reason: 'no-push-manager' };
  if (!('Notification' in window)) return { ok: false, reason: 'no-notifications' };

  // Ask permission if not yet granted/denied
  let perm = Notification.permission;
  if (perm === 'default') {
    try {
      perm = await Notification.requestPermission();
    } catch {
      return { ok: false, reason: 'permission-error' };
    }
  }
  if (perm !== 'granted') return { ok: false, reason: 'permission-denied' };

  // Get VAPID public key from backend
  let publicKey: string;
  try {
    const r = await api.getVapidPublicKey();
    publicKey = r.public_key;
    if (!publicKey) return { ok: false, reason: 'no-key' };
  } catch (e: any) {
    return { ok: false, reason: 'fetch-key-failed: ' + (e?.message || e) };
  }

  // Register the service worker
  let reg: ServiceWorkerRegistration;
  try {
    reg = await navigator.serviceWorker.register(SW_URL);
    await navigator.serviceWorker.ready;
  } catch (e: any) {
    return { ok: false, reason: 'sw-register-failed: ' + (e?.message || e) };
  }

  // Subscribe (or reuse)
  let sub: PushSubscription | null;
  try {
    sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }
  } catch (e: any) {
    return { ok: false, reason: 'subscribe-failed: ' + (e?.message || e) };
  }

  // Send subscription to backend
  try {
    const json = sub.toJSON();
    await api.subscribeWebPush({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      user_agent: navigator.userAgent,
    });
  } catch (e: any) {
    return { ok: false, reason: 'register-with-backend-failed: ' + (e?.message || e) };
  }

  return { ok: true };
}

export async function unsubscribeWebPush(): Promise<{ ok: boolean }> {
  if (Platform.OS !== 'web' || !('serviceWorker' in navigator)) return { ok: false };
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_URL);
    if (!reg) return { ok: false };
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      try {
        await api.unsubscribeWebPush({ endpoint: sub.endpoint });
      } catch {}
      await sub.unsubscribe();
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function pushDiagnosticInfo() {
  if (Platform.OS !== 'web') return { platform: 'native' };
  const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unknown';
  let hasSub = false;
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_URL);
    if (reg) {
      const s = await reg.pushManager.getSubscription();
      hasSub = !!s;
    }
  } catch {}
  return {
    platform: 'web',
    permission: perm,
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: typeof window !== 'undefined' && 'PushManager' in window,
    hasSubscription: hasSub,
  };
}
