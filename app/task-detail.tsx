import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal, Image, Switch, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { showAlert } from '../utils/alert';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; icon: string }> = {
  draft:                     { label: 'Draft',               color: '#9ca3af', icon: 'document-outline' },
  posted:                    { label: 'Awaiting pro',        color: '#3b82f6', icon: 'time-outline' },
  offering:                  { label: 'Receiving offers',    color: '#8b5cf6', icon: 'chatbubbles-outline' },
  pending_acceptance:        { label: 'Awaiting acceptance', color: '#a855f7', icon: 'hourglass-outline' },
  assigned:                  { label: 'Accepted',            color: '#f59e0b', icon: 'checkmark-circle-outline' },
  declined:                  { label: 'Declined by pro',     color: '#dc2626', icon: 'close-circle-outline' },
  on_the_way:                { label: 'Pro on the way',      color: '#06b6d4', icon: 'car-outline' },
  started:                   { label: 'In progress',         color: '#f97316', icon: 'construct-outline' },
  completed_pending_payment: { label: 'Done — awaiting payment', color: '#22c55e', icon: 'checkmark-done-circle-outline' },
  paid:                      { label: 'Paid',                color: '#10b981', icon: 'card-outline' },
  cancelled_by_client:       { label: 'Cancelled by client', color: '#ef4444', icon: 'close-circle-outline' },
  cancelled_by_tasker:       { label: 'Cancelled by pro',    color: '#ef4444', icon: 'close-circle-outline' },
};

// ─── 4 progress steps ────────────────────────────────────────────────────────
const STEPS = [
  { key: 'assigned',                  label: 'Accepted',    icon: 'checkmark-circle',      color: '#f59e0b', tsField: 'accepted_at' },
  { key: 'on_the_way',                label: 'On the way',  icon: 'car',                   color: '#06b6d4', tsField: 'on_the_way_at' },
  { key: 'started',                   label: 'Started',     icon: 'construct',             color: '#f97316', tsField: 'started_at' },
  { key: 'completed_pending_payment', label: 'Finished',    icon: 'checkmark-done-circle', color: '#22c55e', tsField: 'completed_at' },
];

const STEP_ORDER = ['posted','offering','pending_acceptance','assigned','on_the_way','started','completed_pending_payment','paid'];

// ─── Executor action buttons ──────────────────────────────────────────────────
const EXEC_ACTIONS: Record<string, { action: string; label: string; color: string; icon: string }> = {
  posted:              { action: 'accept',     label: 'Accept task',  color: '#2563eb', icon: 'checkmark-circle' },
  offering:            { action: 'accept',     label: 'Accept task',  color: '#2563eb', icon: 'checkmark-circle' },
  pending_acceptance:  { action: 'accept',     label: 'Accept task',  color: '#2563eb', icon: 'checkmark-circle' },
  assigned:            { action: 'on_the_way', label: "I'm on the way",color: '#06b6d4', icon: 'car' },
  on_the_way:          { action: 'start',      label: 'Start work',   color: '#f97316', icon: 'construct' },
  started:             { action: 'complete',   label: 'Finish work',  color: '#22c55e', icon: 'checkmark-done-circle' },
  hold_placed:         { action: 'complete',   label: 'Finish work',  color: '#22c55e', icon: 'checkmark-done-circle' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    // Backend stores UTC without Z suffix — add it so JS parses as UTC, then displays in local time
    const normalized = /[Z+]/.test(iso) ? iso : iso + 'Z';
    const d = new Date(normalized);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getMonth()+1)}/${p(d.getDate())} ${((d.getHours()%12)||12)}:${p(d.getMinutes())} ${d.getHours()<12?'AM':'PM'}`;
  } catch { return '—'; }
}

function calcDuration(start?: string | null, end?: string | null): string {
  if (!start) return '—';
  try {
    const norm = (iso: string) => /[Z+]/.test(iso) ? iso : iso + 'Z';
    const s = new Date(norm(start)).getTime();
    const e = end ? new Date(norm(end)).getTime() : Date.now();
    const diff = e - s;
    if (diff <= 0) return '—';
    const h = Math.floor(diff / 3600000);
    const m = Math.round((diff % 3600000) / 60000);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  } catch { return '—'; }
}

// ─── Payment methods by country ───────────────────────────────────────────────
const UA_METHODS = [
  { id: 'stripe',      label: 'Card (Stripe — test)', icon: 'card', color: '#635bff' },
  { id: 'monobank',    label: 'Monobank',    icon: 'card', color: '#1a1a2e' },
  { id: 'privatbank',  label: 'PrivatBank',  icon: 'card', color: '#007bff' },
  { id: 'cash',        label: 'Cash',     icon: 'cash', color: '#22c55e' },
  { id: 'other_ua',    label: 'Other bank',  icon: 'wallet', color: '#6b7280' },
];
const US_METHODS = [
  { id: 'stripe', label: 'Credit/Debit Card (Stripe)', icon: 'card',   color: '#635bff' },
  { id: 'zelle',  label: 'Zelle',             icon: 'flash',  color: '#6d28d9' },
  { id: 'venmo',  label: 'Venmo',             icon: 'logo-venmo', color: '#008cff' },
  { id: 'cash',   label: 'Cash',              icon: 'cash',   color: '#22c55e' },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function TaskDetail() {
  const { id, autopay } = useLocalSearchParams<{ id: string; autopay?: string }>();
  const router = useRouter();
  const { user } = useAuthStore();

  const [task, setTask] = useState<any>(null);
  const [taskId, setTaskId] = useState<string>(id); // may update after accept
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Invoice modal
  const [showInvoice, setShowInvoice] = useState(false);
  const [hours, setHours] = useState('');
  const [materials, setMaterials] = useState('');
  const [closingMsg, setClosingMsg] = useState('Thank you for your trust! If you liked the work, please leave a review.');
  const [ongoingJob, setOngoingJob] = useState(false);

  // Payment modal
  const [showPayment, setShowPayment] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('');
  const [enabledMethods, setEnabledMethods] = useState<any[]>([]);
  const [showManualSplit, setShowManualSplit] = useState(false);
  const [manualInstructions, setManualInstructions] = useState<any>(null);
  // Tip the client decides to include with the manual payment (added on top of executor amount)
  const [manualTip, setManualTip] = useState<number>(0);
  // Finix card / wallet payment (web only)
  const [showFinix, setShowFinix] = useState(false);
  const [finixProcessing, setFinixProcessing] = useState(false);
  const [finixError, setFinixError] = useState('');
  const finixFormRef = useRef<any>(null);

  // Tokenization callback — receives (error, response) from Finix.js form.submit(cb).
  // We use Option 2 (custom Pay button): do NOT pass onSubmit in options (that makes
  // Finix render its OWN button and conflicts with a manual submit() → button hangs).
  const handleFinixToken = async (err: any, res: any) => {
    if (err) { setFinixError('Please check your card details'); setFinixProcessing(false); return; }
    const token = res?.data?.id;
    if (!token) { setFinixError('Could not get card token'); setFinixProcessing(false); return; }
    try {
      const bookingId = task?.booking_id || taskId;
      const r = await api.finixCharge({ booking_id: bookingId, source: token });
      if (r?.state === 'SUCCEEDED' || r?.state === 'PENDING' || r?.ok) {
        setShowFinix(false);
        setShowPayment(false);
        try { await loadTask(); } catch (_) {}
        setTimeout(() => setShowReview(true), 400);
      } else {
        setFinixError('Payment failed. Please try another card.');
      }
    } catch (e: any) {
      setFinixError(e?.response?.data?.detail || 'Finix payment error');
    } finally {
      setFinixProcessing(false);
    }
  };

  // Mount the Finix.js v2 PaymentForm when the Finix modal opens (web only)
  useEffect(() => {
    if (!showFinix || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const cfg = enabledMethods.find((m: any) => m.id === 'finix');
    if (!cfg?.application_id) { setFinixError('Finix is not configured'); return; }
    setFinixError('');
    setFinixProcessing(false);
    finixFormRef.current = null;
    let cancelled = false;
    let timer: any = null;

    // Mount once the SDK + the target <div> are both present in the DOM.
    const tryMount = (): boolean => {
      const Finix = (window as any).Finix;
      const el = document.getElementById('finix-card-form');
      if (!Finix || !el) return false;
      if (el.childElementCount > 0 || finixFormRef.current) return true; // already mounted
      try {
        const env = cfg.environment === 'live' ? 'prod' : 'sandbox';
        // No onSubmit — we submit manually from our own Pay button via form.submit(cb).
        finixFormRef.current = Finix.PaymentForm('finix-card-form', env, cfg.application_id, {
          paymentMethods: ['card'],
          showAddress: false,
        });
        return true;
      } catch (e) {
        setFinixError('Could not load the payment form');
        return true; // stop retrying on a hard error
      }
    };

    const ensureScript = (cb: () => void) => {
      if ((window as any).Finix) return cb();
      const id = 'finix-js-sdk';
      let sc = document.getElementById(id) as HTMLScriptElement | null;
      if (sc) { sc.addEventListener('load', cb); if ((window as any).Finix) cb(); return; }
      sc = document.createElement('script');
      sc.id = id;
      sc.src = 'https://js.finix.com/v/2/finix.js';
      sc.onload = cb;
      document.body.appendChild(sc);
    };

    let tries = 0;
    const tick = () => {
      if (cancelled) return;
      tries += 1;
      if (tryMount()) return;
      if (tries < 50) timer = setTimeout(tick, 100); // poll up to ~5s for the div/SDK
      else setFinixError('Could not load the payment form. Please close and reopen.');
    };
    ensureScript(() => { if (!cancelled) tick(); });

    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [showFinix]);

  const submitFinix = () => {
    if (!finixFormRef.current) {
      setFinixError('The card form is still loading — please wait a second and tap Pay again.');
      return;
    }
    setFinixError('');
    setFinixProcessing(true);
    try {
      // v2: pass the callback directly to submit() — it tokenizes then invokes cb(err, res).
      finixFormRef.current.submit(handleFinixToken);
    } catch (e) {
      setFinixError('Please enter your card details');
      setFinixProcessing(false);
    }
  };

  // Load enabled payment methods from backend (configurable by admin)
  useEffect(() => {
    api.getPaymentMethods()
      .then((r) => setEnabledMethods(r?.methods || []))
      .catch(() => setEnabledMethods([]));
  }, []);

  // Review modal (shown after payment)
  const [showReview, setShowReview] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewTip, setReviewTip] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Decline modal
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [decliningLoading, setDecliningLoading] = useState(false);

  useEffect(() => { loadTask(); }, [taskId]);

  // Auto-open payment modal if banner deep-linked here with ?autopay=1
  useEffect(() => {
    if (autopay === '1' && task && task.status === 'completed_pending_payment'
        && task.payment_status !== 'pending_verification'
        && task.client_id === user?.user_id) {
      setShowPayment(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autopay, task?.task_id, task?.status, task?.payment_status]);

  const loadTask = async () => {
    try {
      const data = await api.getTask(taskId);
      setTask(data);
      // If task was loaded by booking_id but has a real task_id, update
      if (data.task_id && data.task_id !== taskId) {
        setTaskId(data.task_id);
      }
    } catch (e: any) {
      Alert.alert('Error', 'Could not load the task');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string) => {
    if (action === 'complete') { setShowInvoice(true); return; }
    setActionLoading(true);
    try {
      let res: any;
      switch (action) {
        case 'accept':
          res = await api.acceptTask(taskId);
          // Use the new task_id returned from backend
          if (res?.new_task_id || res?.task_id) {
            const newId = res.new_task_id || res.task_id;
            setTaskId(newId);
          }
          Alert.alert('Success', 'You accepted the task!');
          break;
        case 'on_the_way':
          res = await api.onTheWayTask(taskId);
          if (res?.task_id) setTaskId(res.task_id);
          Alert.alert('Success', 'Status: On the way');
          break;
        case 'start':
          res = await api.startTask(taskId);
          if (res?.task_id) setTaskId(res.task_id);
          Alert.alert('Success', 'Work started!');
          break;
      }
      await loadTask();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e.message || 'Error';
      Alert.alert('Error', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const submitInvoice = async () => {
    setActionLoading(true);
    try {
      const res = await api.completeTask(taskId, {
        actual_hours: hours ? parseFloat(hours) : undefined,
        materials_cost: materials ? parseFloat(materials) : undefined,
        provider_notes: closingMsg || undefined,
      });
      const hrs = res?.actual_hours ?? hours ?? '—';
      setShowInvoice(false);
      if (Platform.OS === 'web') {
        window.alert(`✅ Task completed!\nHours worked: ${hrs} hr\nThe client will be notified to pay.`);
        router.replace('/(tabs)/bookings');
      } else {
        Alert.alert(
          'Task completed!',
          `Hours worked: ${hrs} hr\nThe client will be notified to pay.`,
          [{ text: 'OK', onPress: () => router.replace('/(tabs)/bookings') }]
        );
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e.message || 'Error';
      Alert.alert('Error', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const onMethodTap = (methodId: string) => {
    setSelectedMethod(methodId);
    // Trigger payment immediately — no extra confirm step
    setTimeout(() => submitPayment(methodId), 100);
  };

  const submitPayment = async (forceMethod?: string) => {
    const method = forceMethod || selectedMethod;
    if (!method) { showAlert('Select a payment method', ''); return; }
    const bookingId = task?.booking_id || taskId;

    if (method === 'stripe') {
      setActionLoading(true);
      try {
        const r = await api.startStripeCheckout(bookingId);
        if (!r?.url) throw new Error('Stripe: no checkout URL received');
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.location.href = r.url;
        } else {
          const { Linking } = await import('react-native');
          await Linking.openURL(r.url);
        }
        return;
      } catch (e: any) {
        showAlert('Payment error', e?.response?.data?.detail || e?.message || 'Could not start Stripe checkout');
        return;
      } finally { setActionLoading(false); }
    }

    if (['paypal', 'zelle', 'venmo', 'bank_transfer'].includes(method)) {
      setActionLoading(true);
      try {
        const inst = await api.getManualInstructions(bookingId, method);
        setManualInstructions(inst);
        setManualTip(0);
        setShowManualSplit(true);
      } catch (e: any) {
        showAlert('Error', e?.response?.data?.detail || 'Could not load payment details');
      } finally { setActionLoading(false); }
      return;
    }

    if (method === 'finix') {
      if (Platform.OS !== 'web' || typeof window === 'undefined') {
        showAlert('Unavailable', 'Card / Apple Pay / Google Pay payments are available on the website (web version).');
        return;
      }
      const cfg = enabledMethods.find((m: any) => m.id === 'finix');
      if (!cfg?.application_id) { showAlert('Error', 'Finix is not configured'); return; }
      setShowFinix(true);
      return;
    }

    // Legacy fallback (cash etc)
    setActionLoading(true);
    try { await api.payTask(taskId, { payment_method: method }); } catch (_) {}
    setActionLoading(false);
    setShowPayment(false);
    try { await loadTask(); } catch (_) {}
    setTimeout(() => setShowReview(true), 400);
  };

  const confirmManualSent = async () => {
    if (!manualInstructions) return;
    setActionLoading(true);
    try {
      await api.confirmManualPayment({
        booking_id: manualInstructions.booking_id,
        method: manualInstructions.method,
        tip_amount: manualTip || 0,
      });
      setShowManualSplit(false);
      setShowPayment(false);
      const tipMsg = manualTip > 0 ? ` Your tip of +$${manualTip} is included in the transfer to the pro.` : '';
      Alert.alert(
        'Thank you!',
        `The admin will verify your transfer and confirm the payment.${tipMsg} You will be notified. Please leave a review for the pro.`,
      );
      setManualTip(0);
      try { await loadTask(); } catch (_) {}
      // Auto-open the review modal so client can rate the executor immediately
      setTimeout(() => setShowReview(true), 350);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Helper: open an external payment app via deep link (web + native)
  const openPaymentApp = (method: string, handle: string, amount: number) => {
    if (!handle) {
      Alert.alert('Cannot open', 'The pro has not provided their account yet');
      return;
    }
    const note = encodeURIComponent('Ono-Fix');
    const amt = amount.toFixed(2);
    let url = '';
    let appName = '';
    switch (method) {
      case 'venmo': {
        const username = String(handle).replace(/^@/, '').trim();
        // Universal link — opens app on mobile, web fallback otherwise
        url = `https://venmo.com/${encodeURIComponent(username)}?txn=pay&amount=${amt}&note=${note}`;
        appName = 'Venmo';
        break;
      }
      case 'paypal': {
        // Strip 'paypal.me/' or '@' if user entered them
        let id = String(handle).replace(/^https?:\/\/(www\.)?paypal\.me\//i, '').replace(/^@/, '').trim();
        // If it's an email, use the email send link
        if (id.includes('@')) {
          url = `https://www.paypal.com/myaccount/transfer/homepage/external/topup?recipient=${encodeURIComponent(id)}&amount=${amt}`;
        } else {
          url = `https://paypal.me/${encodeURIComponent(id)}/${amt}`;
        }
        appName = 'PayPal';
        break;
      }
      default:
        return;
    }
    if (Platform.OS === 'web') {
      // @ts-ignore
      if (typeof window !== 'undefined') window.open(url, '_blank');
    } else {
      const { Linking } = require('react-native');
      Linking.openURL(url).catch(() => Alert.alert('Error', `Could not open ${appName}. Is the app installed?`));
    }
  };

  // Helper: copy a value to clipboard (web + native)
  const copyToClipboard = async (text: string, label?: string) => {    if (!text) return;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        // Native: use expo-clipboard if available, fall back gracefully
        try {
          const Clipboard = await import('expo-clipboard');
          await (Clipboard as any).setStringAsync(text);
        } catch {
          // Fallback: silently do nothing
        }
      }
      if (Platform.OS === 'web') {
        // Inline toast (web) — Alert.alert is no-op on RN-web
        // eslint-disable-next-line no-alert
        if (typeof window !== 'undefined') {
          // tiny in-place toast
          const id = `copy-toast-${Date.now()}`;
          const div = document.createElement('div');
          div.id = id;
          div.textContent = `Copied: ${label || text.slice(0, 30)}`;
          div.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#111827;color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;z-index:99999;opacity:0;transition:opacity .2s;';
          document.body.appendChild(div);
          requestAnimationFrame(() => { div.style.opacity = '1'; });
          setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 250); }, 1500);
        }
      } else {
        Alert.alert('Copied', `${label || text}`);
      }
    } catch (e: any) {
      Alert.alert('Error', 'Could not copy');
    }
  };

  const executorConfirmReceipt = async (action: 'confirm' | 'reject') => {
    const bookingId = task?.booking_id || task?.booking?.booking_id || taskId;
    if (!bookingId) {
      Alert.alert('Error', 'Could not find the booking ID');
      return;
    }
    if (action === 'reject') {
      const confirmed = Platform.OS === 'web'
        // eslint-disable-next-line no-alert
        ? (typeof window !== 'undefined' && window.confirm('Confirm that you did NOT receive the payment? The admin will open a dispute and contact the client.'))
        : await new Promise<boolean>(resolve => {
            Alert.alert(
              'Payment not received?',
              'The admin will open a dispute and contact the client to clarify.',
              [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Yes, not received', style: 'destructive', onPress: () => resolve(true) },
              ]
            );
          });
      if (!confirmed) return;
    }
    setActionLoading(true);
    try {
      await api.executorConfirmPayment({ booking_id: bookingId, action });
      if (action === 'confirm') {
        Alert.alert('Thank you!', 'You confirmed receipt. The admin will make the final confirmation.');
      } else {
        Alert.alert('Dispute opened', 'The admin will contact you to clarify.');
      }
      try { await loadTask(); } catch (_) {}
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed');
    } finally {
      setActionLoading(false);
    }
  };

  const submitReview = async () => {
    if (reviewRating < 1 || reviewRating > 5) { Alert.alert('Please select a rating from 1 to 5'); return; }
    setReviewSubmitting(true);
    try {
      // Use booking_id if available, otherwise task_id
      const bookingId = task.booking_id || task.booking?.booking_id || taskId;
      await api.createReview({
        booking_id: bookingId,
        rating: reviewRating,
        comment: reviewComment || undefined,
      });
      setShowReview(false);
      if (Platform.OS === 'web') {
        window.alert('Thank you for your review! Your rating helps other clients.');
      } else {
        Alert.alert('Thank you!', 'Your review has been saved.', [{ text: 'OK' }]);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e.message || 'Error';
      // If already reviewed, just close
      if (msg.includes('already reviewed') || msg.includes('already')) {
        setShowReview(false);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!declineReason.trim()) {
      Alert.alert('Please provide a reason', 'Please provide a short reason for declining.');
      return;
    }
    setDecliningLoading(true);
    try {
      await api.declineTask(taskId, declineReason.trim());
      // Close modal immediately
      setShowDecline(false);
      setDeclineReason('');
      if (Platform.OS === 'web') {
        window.alert('Task declined. The client will be notified.');
        router.replace('/(tabs)/tasks');
      } else {
        Alert.alert('Declined', 'Task declined. The client will be notified.', [
          { text: 'OK', onPress: () => router.replace('/(tabs)/tasks') },
        ]);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e.message || 'Error';
      if (Platform.OS === 'web') window.alert('Error: ' + msg);
      else Alert.alert('Error', msg);
    } finally {
      setDecliningLoading(false);
    }
  };

  if (loading) {
    return <View style={s.centered}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }
  if (!task) return null;

  const status = task.status || 'posted';
  const cfg = STATUS_CFG[status] || { label: status, color: '#6b7280', icon: 'help-circle-outline' };
  const isProvider = user?.role === 'provider';
  const isClient = user?.role === 'client';
  const isMyTask = task.provider_id === user?.user_id;
  const isOpenTask = !task.provider_id && (status === 'posted' || status === 'offering');
  const execAction = isProvider ? (isOpenTask ? EXEC_ACTIONS['posted'] : isMyTask ? EXEC_ACTIONS[status] : null) : null;
  // True when client has clicked "I've sent the manual payment" but admin hasn't verified yet.
  const isPaymentPending = task.payment_status === 'pending_verification';
  const executorAlreadyConfirmed = !!task.executor_confirmed;
  const adminAlreadyConfirmed = !!task.admin_confirmed;
  const showPayBtn = isClient && status === 'completed_pending_payment' && task.client_id === user?.user_id && !isPaymentPending;
  const showPendingPaymentCard = isClient && status === 'completed_pending_payment' && isPaymentPending;
  // For provider: show "I received my share" CTA when client has marked payment as sent
  // and provider has not yet self-confirmed.
  const showExecutorConfirmCard = isProvider && isMyTask && isPaymentPending && !executorAlreadyConfirmed;
  const showExecutorWaitingCard = isProvider && isMyTask && isPaymentPending && executorAlreadyConfirmed && !adminAlreadyConfirmed;

  const price = task.estimated_price || task.total_price;
  const hourlyRate = task.hourly_rate || 25;
  // Auto-calculate hours from started_at if not manually entered
  const autoHours = (() => {
    if (!task.started_at) return 0;
    try {
      const start = new Date(task.started_at.endsWith('Z') ? task.started_at : task.started_at + 'Z');
      const diff = (Date.now() - start.getTime()) / 3600000;
      return Math.max(0, Math.round(diff * 100) / 100);
    } catch { return 0; }
  })();
  const parsedHours = parseFloat(hours) || autoHours;
  const laborCost = Math.round(parsedHours * hourlyRate * 100) / 100;
  const matCost = parseFloat(materials) || 0;
  const totalEarnings = laborCost + matCost;
  const platformFee = Math.round(totalEarnings * 0.15 * 100) / 100;
  const providerEarnings = Math.round((totalEarnings - platformFee) * 100) / 100;

  const clientName = task.client?.name || 'Client';
  const clientPhoto = task.client?.picture || task.client?.photo_url;
  const taskPhotos = [...(task.photos || []), ...(task.problem_photos || [])];
  const stepIdx = STEP_ORDER.indexOf(status);
  const isUA = (task.country || user?.country || 'UA').toUpperCase().includes('UA');
  const ICON_BY_ID: Record<string, { icon: any; color: string }> = {
    stripe: { icon: 'card', color: '#635bff' },
    paypal: { icon: 'logo-paypal', color: '#0070ba' },
    zelle:  { icon: 'flash',  color: '#6d28d9' },
    venmo:  { icon: 'logo-venmo', color: '#008cff' },
    bank_transfer: { icon: 'wallet', color: '#0891b2' },
    cash:   { icon: 'cash',   color: '#22c55e' },
  };
  // Only show methods returned by /api/payments/methods (admin-controlled).
  // Fallback to Stripe-only if the API call hasn't completed yet — never to
  // hard-coded Monobank/PrivatBank list (those were removed per admin request).
  const payMethods = enabledMethods.length > 0
    ? enabledMethods.map((m) => ({
        id: m.id,
        label: m.label + (m.configured === false ? '  (not configured)' : ''),
        icon: ICON_BY_ID[m.id]?.icon || 'wallet',
        color: ICON_BY_ID[m.id]?.color || '#6b7280',
        configured: m.configured !== false,
      }))
    : [{ id: 'stripe', label: 'Card (Stripe — test)', icon: 'card', color: '#635bff', configured: true }];

  return (
    <View style={s.container}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Task details</Text>
        <TouchableOpacity
          style={s.chatBtn}
          onPress={() => router.push({ pathname: '/task-chat', params: { taskId, taskTitle: task.title } })}
        >
          <Ionicons name="chatbubble-ellipses" size={22} color="#2563eb" />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
        {/* ── Status Banner ── */}
        <View style={[s.statusBar, { backgroundColor: cfg.color }]}>
          <Ionicons name={cfg.icon as any} size={20} color="#fff" />
          <Text style={s.statusText}>{cfg.label}</Text>
        </View>

        {/* ── Title ── */}
        <View style={s.section}>
          <Text style={s.title}>{task.title || 'Untitled'}</Text>
          {!!task.description && <Text style={s.desc}>{task.description}</Text>}
        </View>

        {/* ── 4-Step Progress Bar ── */}
        {stepIdx >= STEP_ORDER.indexOf('assigned') && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Task progress</Text>
            <View style={s.stepsRow}>
              {STEPS.map((step, idx) => {
                const reached = stepIdx >= STEP_ORDER.indexOf(step.key);
                const isLast = idx === STEPS.length - 1;
                return (
                  <React.Fragment key={step.key}>
                    <View style={s.stepItem}>
                      <View style={[s.stepCircle, reached ? { backgroundColor: step.color } : s.stepCircleOff]}>
                        <Ionicons name={step.icon as any} size={18} color={reached ? '#fff' : '#9ca3af'} />
                      </View>
                      <Text style={[s.stepLabel, reached && { color: step.color, fontWeight: '700' }]}>
                        {step.label}
                      </Text>
                    </View>
                    {!isLast && (
                      <View style={[
                        s.stepLine,
                        stepIdx >= STEP_ORDER.indexOf(STEPS[idx+1].key) && { backgroundColor: STEPS[idx+1].color }
                      ]} />
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Timeline / Chronology ── */}
        {(task.accepted_at || task.on_the_way_at || task.started_at || task.completed_at) && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Timeline</Text>
            <View style={s.timeline}>
              {STEPS.map((step, idx) => {
                const ts = task[step.tsField];
                const reached = stepIdx >= STEP_ORDER.indexOf(step.key);
                if (!reached && !ts) return null;
                const isLast = idx === STEPS.length - 1;
                return (
                  <View key={step.key} style={s.tlRow}>
                    {/* Left: dot + vertical line */}
                    <View style={s.tlLeft}>
                      <View style={[s.tlDot, { backgroundColor: reached ? step.color : '#e5e7eb' }]}>
                        <Ionicons name={step.icon as any} size={14} color={reached ? '#fff' : '#9ca3af'} />
                      </View>
                      {!isLast && <View style={[s.tlLine, reached && { backgroundColor: step.color }]} />}
                    </View>
                    {/* Right: label + time */}
                    <View style={s.tlRight}>
                      <Text style={[s.tlLabel, reached && { color: '#111827', fontWeight: '600' }]}>
                        {step.label}
                      </Text>
                      <Text style={[s.tlTime, { color: reached ? step.color : '#9ca3af' }]}>
                        {fmtTime(ts)}
                      </Text>
                    </View>
                  </View>
                );
              })}

              {/* Duration summary */}
              {(task.on_the_way_at || task.started_at) && (
                <View style={s.durBox}>
                  {task.on_the_way_at && (
                    <View style={s.durRow}>
                      <Ionicons name="car-outline" size={16} color="#06b6d4" />
                      <Text style={s.durLabel}>Travel time</Text>
                      <Text style={[s.durVal, { color: '#06b6d4' }]}>
                        {calcDuration(task.on_the_way_at, task.started_at)}
                      </Text>
                    </View>
                  )}
                  {task.started_at && (
                    <View style={s.durRow}>
                      <Ionicons name="construct-outline" size={16} color="#f97316" />
                      <Text style={s.durLabel}>Work time</Text>
                      <Text style={[s.durVal, { color: '#f97316' }]}>
                        {calcDuration(task.started_at, task.completed_at)}
                        {!task.completed_at ? ' (now)' : ''}
                      </Text>
                    </View>
                  )}
                  {task.actual_hours != null && (
                    <View style={s.durRow}>
                      <Ionicons name="hourglass-outline" size={16} color="#2563eb" />
                      <Text style={s.durLabel}>Hours worked</Text>
                      <Text style={[s.durVal, { color: '#2563eb' }]}>{task.actual_hours} hr</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Details ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Details</Text>
          {!!task.address && (
            <View style={s.detailRow}>
              <Ionicons name="location-outline" size={20} color="#6b7280" />
              <View style={s.detailContent}>
                <Text style={s.detailLabel}>Address</Text>
                <Text style={s.detailVal}>{task.address}</Text>
              </View>
            </View>
          )}
          {(task.scheduled_date || task.date || task.scheduled_time || task.time) && (
            <View style={s.detailRow}>
              <Ionicons name="calendar-outline" size={20} color="#6b7280" />
              <View style={s.detailContent}>
                <Text style={s.detailLabel}>Date & time</Text>
                <Text style={s.detailVal}>
                  {task.scheduled_date || task.date || ''}
                  {(task.scheduled_date || task.date) && (task.scheduled_time || task.time) ? ' at ' : ''}
                  {task.scheduled_time || task.time || ''}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Pricing ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Price</Text>
          <View style={s.priceCard}>
            {/* After completion — show full breakdown */}
            {!!task.final_price && (
              <>
                {!!task.actual_hours && (
                  <View style={s.priceRow}>
                    <Text style={s.priceLabel}>Hours worked</Text>
                    <Text style={s.priceLabel}>{task.actual_hours} hr × ${task.hourly_rate || 0}/hr</Text>
                  </View>
                )}
                {!!task.labor_cost && (
                  <View style={s.priceRow}>
                    <Text style={s.priceLabel}>Labor cost</Text>
                    <Text style={s.priceLabel}>${task.labor_cost}</Text>
                  </View>
                )}
                {!!task.materials_cost && task.materials_cost > 0 && (
                  <View style={s.priceRow}>
                    <Text style={s.priceLabel}>Materials</Text>
                    <Text style={s.priceLabel}>${task.materials_cost}</Text>
                  </View>
                )}
                {!isProvider && (
                  <View style={[s.priceRow, { borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 8, paddingTop: 8 }]}>
                    <Text style={[s.priceLabel, { fontWeight: '700', fontSize: 15 }]}>Total due</Text>
                    <Text style={[s.priceGreen, { fontSize: 22, fontWeight: '800' }]}>${task.final_price}</Text>
                  </View>
                )}
                {/* Provider sees their payout — without showing commission */}
                {isProvider && isMyTask && !!task.provider_payout && (
                  <View style={[s.priceRow, { backgroundColor: '#f0fdf4', borderRadius: 8, padding: 8, marginTop: 8 }]}>
                    <Text style={[s.priceLabel, { color: '#16a34a' }]}>Your earnings</Text>
                    <Text style={[s.priceGreen, { color: '#16a34a', fontSize: 22, fontWeight: '800' }]}>${task.provider_payout}</Text>
                  </View>
                )}
              </>
            )}
            {/* Before completion — show the agreed rate the executor set */}
            {!task.final_price && (() => {
              const provRate = task.provider_hourly_rate || task.executor_take || task.hourly_rate || 0;
              const clientRate = task.estimated_price || task.total_price || 0;
              const shownRate = isProvider ? (provRate || clientRate) : (clientRate || provRate);
              if (shownRate) {
                return (
                  <>
                    <View style={s.priceRow}>
                      <Text style={s.priceLabel}>{isProvider ? 'Your rate' : 'Hourly rate'}</Text>
                      <Text style={[s.priceGreen, { fontSize: 20, fontWeight: '800' }]} data-testid="task-price-rate">${Math.round(shownRate)}/hr</Text>
                    </View>
                    <Text style={[s.noPrice, { marginTop: 6 }]}>Final total is calculated from the hours worked after the job is completed.</Text>
                  </>
                );
              }
              return <Text style={s.noPrice}>Price will be calculated after completion</Text>;
            })()}
          </View>
        </View>

        {/* ── Client ── */}
        {task.client && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Client</Text>
            <View style={s.clientCard}>
              {clientPhoto
                ? <Image source={{ uri: clientPhoto }} style={s.avatar} />
                : (
                  <View style={s.avatarPlaceholder}>
                    <Text style={s.avatarInitial}>{clientName.charAt(0).toUpperCase()}</Text>
                  </View>
                )
              }
              <View style={{ flex: 1 }}>
                <Text style={s.clientName}>{clientName}</Text>
                {task.client.phone && <Text style={s.clientPhone}>{task.client.phone}</Text>}
              </View>
            </View>
          </View>
        )}

        {/* ── Photos ── */}
        {taskPhotos.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Task photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {taskPhotos.map((p: string, i: number) => (
                <Image
                  key={i}
                  source={{ uri: p.startsWith('http') ? p : `data:image/jpeg;base64,${p}` }}
                  style={s.photo}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Provider notes ── */}
        {!!task.provider_notes && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Pro's note</Text>
            <View style={s.notesCard}>
              <Text style={s.notesText}>{task.provider_notes}</Text>
            </View>
          </View>
        )}

        <View style={{ height: 160 }} />
      </ScrollView>

      {/* ── Footer buttons ── */}
      <View style={s.footer}>
        {/* Chat button */}
        <TouchableOpacity
          style={s.chatFooterBtn}
          onPress={() => router.push({ pathname: '/task-chat', params: { taskId, taskTitle: task.title } })}
        >
          <Ionicons name="chatbubble-ellipses" size={20} color="#2563eb" />
          <Text style={s.chatFooterText}>Chat</Text>
        </TouchableOpacity>

        {/* Executor action + decline stacked vertically */}
        {(execAction || (isProvider && ['posted','offering','assigned','hold_placed'].includes(status))) && (
          <View style={{ flex: 1, gap: 8 }}>
            {execAction && (
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: execAction.color }, actionLoading && s.btnDisabled]}
                onPress={() => handleAction(execAction.action)}
                disabled={actionLoading}
              >
                {actionLoading
                  ? <ActivityIndicator color="#fff" />
                  : <>
                      <Ionicons name={execAction.icon as any} size={22} color="#fff" />
                      <Text style={s.actionBtnText}>{execAction.label}</Text>
                    </>
                }
              </TouchableOpacity>
            )}
            {isProvider && ['posted','offering','assigned','hold_placed'].includes(status) && (
              <TouchableOpacity
                style={s.declineBtnFull}
                onPress={() => setShowDecline(true)}
              >
                <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
                <Text style={s.declineBtnText}>Decline task</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Pending verification card — replaces pay button after manual payment sent */}
        {showPendingPaymentCard && (
          <View
            style={{
              flex: 1, flexDirection: 'row', alignItems: 'center',
              backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fcd34d',
              padding: 14, borderRadius: 12, gap: 12,
            }}
            data-testid="payment-pending-card"
          >
            <Ionicons name="time-outline" size={24} color="#b45309" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#92400e' }}>
                Awaiting payment confirmation
              </Text>
              <Text style={{ fontSize: 12, color: '#92400e', marginTop: 2, lineHeight: 16 }}>
                {executorAlreadyConfirmed
                  ? 'The pro confirmed receipt. Waiting for the admin.'
                  : adminAlreadyConfirmed
                  ? 'The admin confirmed the commission. Waiting for the pro.'
                  : `The admin and the pro are verifying your transfer (${(task.payment_method || '').toUpperCase()}).`}
              </Text>
              <View style={{ flexDirection: 'row', marginTop: 6, gap: 12 }}>
                <Text style={{ fontSize: 11, color: executorAlreadyConfirmed ? '#059669' : '#92400e', fontWeight: '600' }}>
                  {executorAlreadyConfirmed ? '✓ Pro' : '○ Pro'}
                </Text>
                <Text style={{ fontSize: 11, color: adminAlreadyConfirmed ? '#059669' : '#92400e', fontWeight: '600' }}>
                  {adminAlreadyConfirmed ? '✓ Admin' : '○ Admin'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Executor: confirm receipt of their share */}
        {showExecutorConfirmCard && (
          <View
            style={{
              flex: 1, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0',
              padding: 14, borderRadius: 12,
            }}
            data-testid="executor-confirm-card"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="cash-outline" size={22} color="#059669" />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#065f46', marginLeft: 8 }}>
                Client reported the payment
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: '#065f46', lineHeight: 17, marginBottom: 12 }}>
              Method: {(task.payment_method || '').toUpperCase()}. Check your {(task.payment_method || '').toUpperCase()} account and confirm receipt.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 10,
                  backgroundColor: '#10b981', alignItems: 'center',
                  flexDirection: 'row', justifyContent: 'center', gap: 6,
                }}
                onPress={() => executorConfirmReceipt('confirm')}
                disabled={actionLoading}
                data-testid="executor-confirm-receipt-btn"
              >
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>I received it</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 10,
                  backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#dc2626', alignItems: 'center',
                  flexDirection: 'row', justifyContent: 'center', gap: 6,
                }}
                onPress={() => executorConfirmReceipt('reject')}
                disabled={actionLoading}
                data-testid="executor-reject-receipt-btn"
              >
                <Ionicons name="close-circle-outline" size={18} color="#dc2626" />
                <Text style={{ color: '#dc2626', fontWeight: '700', fontSize: 13 }}>Not received</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Executor: already confirmed, waiting for admin */}
        {showExecutorWaitingCard && (
          <View
            style={{
              flex: 1, flexDirection: 'row', alignItems: 'center',
              backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe',
              padding: 14, borderRadius: 12, gap: 12,
            }}
            data-testid="executor-waiting-card"
          >
            <Ionicons name="checkmark-circle" size={24} color="#2563eb" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e3a8a' }}>
                You confirmed receipt
              </Text>
              <Text style={{ fontSize: 12, color: '#1e3a8a', marginTop: 2, lineHeight: 16 }}>
                Awaiting final confirmation from the admin.
              </Text>
            </View>
          </View>
        )}

        {/* Client payment button */}
        {showPayBtn && (
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: '#10b981', flex: 1 }]}
            onPress={() => setShowPayment(true)}
            data-testid="pay-task-btn"
          >
            <Ionicons name="card" size={22} color="#fff" />
            <Text style={s.actionBtnText}>Pay for task</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ═══════════════════════════════════════════════════════════════
          INVOICE MODAL (TaskRabbit-style)
      ═══════════════════════════════════════════════════════════════ */}
      <Modal visible={showInvoice} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Close task</Text>
              <TouchableOpacity onPress={() => setShowInvoice(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={s.modalBody}>
              {/* Client */}
              <View style={s.invoiceRow}>
                <Text style={s.invoiceLabel}>Client</Text>
                <Text style={s.invoiceVal}>{clientName}</Text>
              </View>

              {/* Hours */}
              <View style={s.invoiceRow}>
                <Text style={s.invoiceLabel}>Hours worked</Text>
                <View style={s.invoiceInput}>
                  <TextInput
                    style={s.invoiceInputText}
                    value={hours}
                    onChangeText={setHours}
                    keyboardType="numeric"
                    placeholder={task.started_at ? 'auto' : '0'}
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>
              {task.started_at && !hours && (
                <Text style={s.autoHint}>
                  Auto: {calcDuration(task.started_at, undefined)}
                </Text>
              )}

              {/* Materials */}
              <View style={s.invoiceRow}>
                <Text style={s.invoiceLabel}>Materials cost</Text>
                <View style={s.invoiceInput}>
                  <TextInput
                    style={s.invoiceInputText}
                    value={materials}
                    onChangeText={setMaterials}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>

              {/* Earnings preview — executor sees ONLY their own earnings (commission is added to client total, not deducted from executor) */}
              <View style={s.earningsCard}>
                <Text style={s.earningsTitle}>Earnings breakdown</Text>
                <View style={s.earningsRow}>
                  <Text style={s.earningsLabel}>Hourly rate</Text>
                  <Text style={s.earningsVal}>${hourlyRate}/hr</Text>
                </View>
                <View style={s.earningsRow}>
                  <Text style={s.earningsLabel}>Labor ({parsedHours.toFixed(2)} hr)</Text>
                  <Text style={s.earningsVal}>${laborCost}</Text>
                </View>
                {matCost > 0 && (
                  <View style={s.earningsRow}>
                    <Text style={s.earningsLabel}>Materials</Text>
                    <Text style={s.earningsVal}>${matCost}</Text>
                  </View>
                )}
                {/* Big highlighted payout — full amount, no commission deduction */}
                <View style={s.earningsPayoutBox}>
                  <Text style={s.earningsPayoutLabel}>Your earnings</Text>
                  <Text style={s.earningsPayoutValue}>${(parseFloat(laborCost) + matCost).toFixed(2)}</Text>
                </View>
              </View>

              {/* Closing message */}
              <Text style={s.inputLabel}>Message to client</Text>
              <TextInput
                style={[s.input, s.textArea]}
                value={closingMsg}
                onChangeText={setClosingMsg}
                multiline
                placeholder="Message after closing the task..."
              />

              {/* Ongoing job toggle */}
              <View style={s.toggleRow}>
                <Text style={s.toggleLabel}>Recurring job</Text>
                <Switch value={ongoingJob} onValueChange={setOngoingJob} trackColor={{ true: '#22c55e' }} />
              </View>
            </ScrollView>

            <View style={s.modalFooter}>
              <TouchableOpacity style={[s.modalBtn, s.cancelBtn]} onPress={() => setShowInvoice(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, s.submitBtn, actionLoading && s.btnDisabled]}
                onPress={submitInvoice}
                disabled={actionLoading}
              >
                {actionLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.submitBtnText}>Send invoice</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════
          PAYMENT MODAL (Client)
      ═══════════════════════════════════════════════════════════════ */}
      <Modal visible={showPayment} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Pay for task</Text>
              <TouchableOpacity onPress={() => setShowPayment(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={s.modalBody}>
              {/* Summary */}
              {(() => {
                // Calculate total for client: labor + materials + 15% platform fee (already included)
                const fp = task.final_price;
                const ah = task.actual_hours;
                const hr = task.hourly_rate || hourlyRate;
                const mc = task.materials_cost || 0;
                const laborBase = fp ? fp : (ah && hr ? Math.round(ah * hr * 100) / 100 : (price || 0));
                const totalBase = fp || (laborBase + mc);
                // Client pays total including 15% platform fee
                const clientTotal = Math.round(totalBase * 1.15 * 100) / 100;
                return (
                  <>
                    <View style={s.paymentSummary}>
                      <View style={s.payRow}>
                        <Text style={s.payLabel}>Pro</Text>
                        <Text style={s.payVal}>{task.provider?.name || 'Pro'}</Text>
                      </View>
                      {ah != null && (
                        <View style={s.payRow}>
                          <Text style={s.payLabel}>Hours worked</Text>
                          <Text style={[s.payVal, { color: '#2563eb' }]}>{ah} hr × ${hr}/hr = ${Math.round(ah * hr)}</Text>
                        </View>
                      )}
                      {mc > 0 && (
                        <View style={s.payRow}>
                          <Text style={s.payLabel}>Materials</Text>
                          <Text style={s.payVal}>${mc}</Text>
                        </View>
                      )}
                      <View style={[s.payRow, s.payTotal]}>
                        <Text style={s.payTotalLabel}>Total due</Text>
                        <Text style={[s.payTotalVal, { color: '#10b981', fontSize: 24, fontWeight: '700' }]}>{clientTotal > 0 ? '$' + clientTotal : '—'}</Text>
                      </View>
                    </View>
                  </>
                );
              })()}

              {/* Payment methods */}
              <Text style={[s.inputLabel, { marginTop: 16 }]}>Payment method</Text>
              {payMethods.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[s.methodCard, selectedMethod === m.id && { borderColor: m.color, borderWidth: 2 }]}
                  onPress={() => onMethodTap(m.id)}
                >
                  <View style={[s.methodIcon, { backgroundColor: m.color + '22' }]}>
                    <Ionicons name={m.icon as any} size={22} color={m.color} />
                  </View>
                  <Text style={s.methodLabel}>{m.label}</Text>
                  {selectedMethod === m.id && (
                    <Ionicons name="checkmark-circle" size={22} color={m.color} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={s.modalFooter}>
              <TouchableOpacity style={[s.modalBtn, s.cancelBtn]} onPress={() => setShowPayment(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, s.submitBtn, { backgroundColor: '#10b981' }, actionLoading && s.btnDisabled]}
                onPress={submitPayment}
                disabled={actionLoading}
              >
                {actionLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.submitBtnText}>Confirm payment</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════
          FINIX CARD / WALLET MODAL (Client, web only)
      ═══════════════════════════════════════════════════════════════ */}
      <Modal visible={showFinix} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Pay by card / wallet</Text>
              <TouchableOpacity onPress={() => { if (!finixProcessing) setShowFinix(false); }} data-testid="finix-close-btn">
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody}>
              <Text style={{ color: '#6b7280', fontSize: 13, marginBottom: 12 }}>
                Payment is processed by Finix. Part goes to the pro instantly, the commission goes to the platform.
              </Text>
              {/* Finix.js mounts its secure fields into this container (web renders a div) */}
              {Platform.OS === 'web'
                ? React.createElement('div', { id: 'finix-card-form', style: { minHeight: 220 } })
                : null}
              {!!finixError && (
                <Text style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }} data-testid="finix-error">{finixError}</Text>
              )}
            </ScrollView>
            <View style={s.modalFooter}>
              <TouchableOpacity style={[s.modalBtn, s.cancelBtn]} onPress={() => { if (!finixProcessing) setShowFinix(false); }}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, s.submitBtn, { backgroundColor: '#1a8917' }, finixProcessing && s.btnDisabled]}
                onPress={submitFinix}
                disabled={finixProcessing}
                data-testid="finix-pay-btn"
              >
                {finixProcessing
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.submitBtnText}>Pay</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      {/* ═══════════════════════════════════════════════════════════════
          MANUAL SPLIT MODAL (PayPal / Zelle / Venmo)
      ═══════════════════════════════════════════════════════════════ */}
      <Modal visible={showManualSplit} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Payment details ({(manualInstructions?.method || '').toUpperCase()})</Text>
              <TouchableOpacity onPress={() => setShowManualSplit(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody}>
              <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 12, lineHeight: 18 }}>
                The payment is split into 2 parts. Please send both amounts to the respective recipients in the app{' '}
                <Text style={{ fontWeight: '700' }}>{(manualInstructions?.method || '').toUpperCase()}</Text>.
              </Text>

              {(manualInstructions?.splits || []).map((sp: any) => {
                const displayAmount = sp.to === 'executor' ? (sp.amount + manualTip) : sp.amount;
                return (
                <View
                  key={sp.to}
                  style={{
                    borderWidth: 1, borderColor: sp.missing_handle ? '#fca5a5' : '#bfdbfe',
                    backgroundColor: sp.missing_handle ? '#fef2f2' : '#eff6ff',
                    borderRadius: 12, padding: 14, marginBottom: 12,
                  }}
                  data-testid={`manual-split-${sp.to}`}
                >
                  <Text style={{ fontSize: 11, color: '#6b7280', fontWeight: '700', textTransform: 'uppercase' }}>
                    {sp.label}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
                    <Text style={{ fontSize: 22, fontWeight: '800', color: '#111827', flex: 1 }}>
                      {displayAmount.toFixed(2)} {manualInstructions?.currency}
                    </Text>
                    <TouchableOpacity
                      onPress={() => copyToClipboard(displayAmount.toFixed(2), `Amount: ${displayAmount.toFixed(2)}`)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 4,
                        backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
                        borderWidth: 1, borderColor: '#bfdbfe',
                      }}
                      data-testid={`copy-amount-${sp.to}`}
                    >
                      <Ionicons name="copy-outline" size={14} color="#2563eb" />
                      <Text style={{ fontSize: 11, color: '#2563eb', fontWeight: '700' }}>Copy</Text>
                    </TouchableOpacity>
                  </View>
                  {sp.to === 'executor' && manualTip > 0 && (
                    <Text style={{ fontSize: 11, color: '#059669', marginTop: 2 }}>
                      = ${sp.amount.toFixed(2)} + ${manualTip.toFixed(2)} tip
                    </Text>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
                    <Text style={{ fontSize: 13, color: '#374151', flex: 1 }} selectable numberOfLines={2}>
                      {sp.handle}
                    </Text>
                    {!sp.missing_handle && (
                      <TouchableOpacity
                        onPress={() => copyToClipboard(String(sp.handle || ''), `${sp.label}: ${sp.handle}`)}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 4,
                          backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
                          borderWidth: 1, borderColor: '#bfdbfe',
                        }}
                        data-testid={`copy-handle-${sp.to}`}
                      >
                        <Ionicons name="copy-outline" size={14} color="#2563eb" />
                        <Text style={{ fontSize: 11, color: '#2563eb', fontWeight: '700' }}>Copy</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {sp.missing_handle && (
                    <Text style={{ fontSize: 11, color: '#dc2626', marginTop: 6 }}>
                      ⚠ The pro has not provided their account yet. Contact them in chat.
                    </Text>
                  )}
                  {!sp.missing_handle && sp.to === 'executor' &&
                    (manualInstructions?.method === 'venmo' || manualInstructions?.method === 'paypal') && (
                    <TouchableOpacity
                      onPress={() => openPaymentApp(manualInstructions.method, String(sp.handle || ''), displayAmount)}
                      style={{
                        marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                        backgroundColor: manualInstructions.method === 'venmo' ? '#3D95CE' : '#0070BA',
                        paddingVertical: 10, borderRadius: 10,
                      }}
                      data-testid={`open-app-${manualInstructions.method}-${sp.to}`}
                    >
                      <Ionicons
                        name={manualInstructions.method === 'venmo' ? 'logo-usd' : 'logo-paypal'}
                        size={16}
                        color="#fff"
                      />
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                        Open in {manualInstructions.method === 'venmo' ? 'Venmo' : 'PayPal'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                );
              })}

              {/* ── Optional Tip for executor ───────────────────────────── */}
              <View
                style={{
                  borderWidth: 1, borderColor: '#fde68a', backgroundColor: '#fffbeb',
                  borderRadius: 12, padding: 14, marginBottom: 12,
                }}
                data-testid="manual-tip-section"
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Ionicons name="gift-outline" size={18} color="#b45309" />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#92400e', marginLeft: 8 }}>
                    Tip for the pro (optional)
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: '#92400e', marginBottom: 10, lineHeight: 17 }}>
                  Add an amount above the rate — 100% goes to the pro together with the main transfer.
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {[0, 50, 100, 200, 500].map(val => {
                    const active = manualTip === val;
                    return (
                      <TouchableOpacity
                        key={`tip-${val}`}
                        style={{
                          paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
                          borderWidth: 1.5,
                          borderColor: active ? '#f59e0b' : '#fcd34d',
                          backgroundColor: active ? '#f59e0b' : '#fff',
                        }}
                        onPress={() => setManualTip(val)}
                        data-testid={`manual-tip-${val}`}
                      >
                        <Text style={{
                          fontSize: 13, fontWeight: '700',
                          color: active ? '#fff' : '#92400e',
                        }}>
                          {val === 0 ? 'No tip' : `+$${val}`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4, lineHeight: 17 }}>
                💡 After you send both payments, tap the button below — the admin will verify the funds
                in your bank account and confirm the order.
              </Text>
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 8, padding: 16 }}>
              <TouchableOpacity
                style={[s.modalBtn, s.cancelBtn]}
                onPress={() => setShowManualSplit(false)}
                data-testid="manual-cancel-btn"
              >
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, s.confirmBtn, actionLoading && { opacity: 0.5 }]}
                onPress={confirmManualSent}
                disabled={actionLoading}
                data-testid="manual-confirm-sent-btn"
              >
                {actionLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.confirmBtnText}>I sent both payments</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════
          REVIEW MODAL (after payment)
      ═══════════════════════════════════════════════════════════════ */}
      <Modal visible={showReview} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Review the pro</Text>
              <TouchableOpacity onPress={() => setShowReview(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={s.modalBody}>
              {/* Provider info */}
              <View style={s.reviewProviderRow}>
                {task.provider?.picture || task.provider?.photo_url ? (
                  <Image source={{ uri: task.provider.picture || task.provider.photo_url }} style={s.reviewAvatar} />
                ) : (
                  <View style={[s.reviewAvatar, s.reviewAvatarPlaceholder]}>
                    <Text style={s.reviewAvatarInitial}>
                      {(task.provider?.name || 'P')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.reviewProviderName}>{task.provider?.name || 'Pro'}</Text>
                  <Text style={s.reviewProviderSub}>{task.title || 'Task'}</Text>
                </View>
              </View>

              {/* Star rating */}
              <Text style={[s.inputLabel, { marginTop: 20, marginBottom: 12 }]}>Rate the pro</Text>
              <View style={s.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setReviewRating(star)} style={s.starBtn}>
                    <Ionicons
                      name={star <= reviewRating ? 'star' : 'star-outline'}
                      size={36}
                      color={star <= reviewRating ? '#f59e0b' : '#d1d5db'}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.ratingLabel}>
                {reviewRating === 1 ? 'Poor' : reviewRating === 2 ? 'Below average' : reviewRating === 3 ? 'Okay' : reviewRating === 4 ? 'Good' : 'Excellent'}
              </Text>

              {/* Comment */}
              <Text style={[s.inputLabel, { marginTop: 20 }]}>Comment (optional)</Text>
              <TextInput
                style={[s.input, s.textArea]}
                value={reviewComment}
                onChangeText={setReviewComment}
                multiline
                placeholder="Write your review..."
                placeholderTextColor="#9ca3af"
              />
            </ScrollView>

            <View style={s.modalFooter}>
              <TouchableOpacity
                style={[s.modalBtn, s.cancelBtn]}
                onPress={() => setShowReview(false)}
              >
                <Text style={s.cancelBtnText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, s.submitBtn, { backgroundColor: '#f59e0b' }, reviewSubmitting && s.btnDisabled]}
                onPress={submitReview}
                disabled={reviewSubmitting}
              >
                {reviewSubmitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.submitBtnText}>Submit review</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════
          DECLINE MODAL
      ═══════════════════════════════════════════════════════════════ */}
      <Modal visible={showDecline} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={[s.modalBox, { maxHeight: 380 }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Decline task</Text>
              <TouchableOpacity onPress={() => { setShowDecline(false); setDeclineReason(''); }}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={s.modalBody}>
              <Text style={[s.inputLabel, { marginBottom: 8 }]}>Reason for declining *</Text>
              <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                The client will be notified with the reason.
              </Text>
              {/* Quick reason chips */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {['Busy', 'Not my specialty', 'Inconvenient address', 'Other reason'].map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[s.tipAmtBtn, declineReason === r && s.tipAmtBtnActive, { borderColor: '#ef4444' }]}
                    onPress={() => setDeclineReason(declineReason === r ? '' : r)}
                  >
                    <Text style={[s.tipAmtText, declineReason === r && { color: '#fff' }]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[s.input, s.textArea, { minHeight: 80 }]}
                value={declineReason}
                onChangeText={setDeclineReason}
                multiline
                placeholder="Or write your own reason..."
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={s.modalFooter}>
              <TouchableOpacity
                style={[s.modalBtn, s.cancelBtn]}
                onPress={() => { setShowDecline(false); setDeclineReason(''); }}
              >
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: '#ef4444', flex: 1 }, decliningLoading && s.btnDisabled]}
                onPress={handleDecline}
                disabled={decliningLoading}
              >
                {decliningLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.submitBtnText}>Decline</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, paddingTop: 60, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  backBtn:     { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  chatBtn:     { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

  content: { flex: 1 },

  statusBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 14, gap: 8,
  },
  statusText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  section:      { backgroundColor: '#fff', padding: 20, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 16 },
  title:        { fontSize: 22, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  desc:         { fontSize: 15, color: '#4b5563', lineHeight: 22 },

  // ── Steps ──
  stepsRow:       { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  stepItem:       { alignItems: 'center', flex: 1 },
  stepCircle:     { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  stepCircleOff:  { backgroundColor: '#e5e7eb' },
  stepLabel:      { fontSize: 10, color: '#9ca3af', textAlign: 'center', lineHeight: 13 },
  stepLine:       { flex: 1, height: 3, backgroundColor: '#e5e7eb', marginTop: 18, marginHorizontal: -4 },

  // ── Timeline ──
  timeline: { gap: 0 },
  tlRow:    { flexDirection: 'row', alignItems: 'flex-start', minHeight: 56 },
  tlLeft:   { width: 36, alignItems: 'center' },
  tlDot:    { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  tlLine:   { width: 2, flex: 1, backgroundColor: '#e5e7eb', marginTop: 2, marginBottom: 2 },
  tlRight:  { flex: 1, paddingLeft: 12, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tlLabel:  { fontSize: 14, color: '#6b7280' },
  tlTime:   { fontSize: 13, fontWeight: '600' },

  durBox: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb', gap: 10 },
  durRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  durLabel: { fontSize: 13, color: '#6b7280', flex: 1 },
  durVal: { fontSize: 14, fontWeight: '700', color: '#111827' },

  // ── Details ──
  detailRow:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 12 },
  detailContent: { flex: 1 },
  detailLabel:   { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  detailVal:     { fontSize: 15, color: '#111827' },

  // ── Pricing ──
  priceCard:  { backgroundColor: '#f9fafb', padding: 16, borderRadius: 12 },
  priceRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  priceLabel: { fontSize: 14, color: '#6b7280' },
  priceGreen: { fontSize: 18, fontWeight: '700', color: '#10b981' },
  noPrice:    { fontSize: 14, color: '#9ca3af', fontStyle: 'italic' },

  // ── Client ──
  clientCard:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:            { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e5e7eb' },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center' },
  avatarInitial:     { fontSize: 20, fontWeight: '700', color: '#2563eb' },
  clientName:        { fontSize: 16, fontWeight: '600', color: '#111827' },
  clientPhone:       { fontSize: 14, color: '#6b7280', marginTop: 2 },

  // ── Photos ──
  photo: { width: 120, height: 120, borderRadius: 12, marginRight: 12 },

  // ── Notes ──
  notesCard: { backgroundColor: '#f0fdf4', padding: 14, borderRadius: 12 },
  notesText: { fontSize: 14, color: '#166534', lineHeight: 20 },

  // ── Footer ──
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 10, alignItems: 'flex-end',
    padding: 16, paddingBottom: 36, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#e5e7eb',
  },
  chatFooterBtn: {
    width: 56, height: 56, borderRadius: 14, backgroundColor: '#eff6ff',
    justifyContent: 'center', alignItems: 'center', gap: 2,
  },
  chatFooterText: { fontSize: 10, color: '#2563eb', fontWeight: '600' },
  actionBtn:     { flexDirection: 'row', padding: 16, borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 8 },
  btnDisabled:   { opacity: 0.6 },
  actionBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // ── Modal shared ──
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:    { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  modalTitle:  { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  modalBody:   { padding: 20 },
  modalFooter: { flexDirection: 'row', gap: 12, padding: 20, paddingTop: 0 },
  modalBtn:    { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  cancelBtn:   { backgroundColor: '#f3f4f6' },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  submitBtn:   { backgroundColor: '#22c55e' },
  submitBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  // ── Invoice ──
  invoiceRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  invoiceLabel: { fontSize: 15, color: '#374151' },
  invoiceVal:   { fontSize: 15, fontWeight: '600', color: '#111827' },
  invoiceInput: { backgroundColor: '#f9fafb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, minWidth: 80, alignItems: 'flex-end' },
  invoiceInputText: { fontSize: 15, fontWeight: '600', color: '#111827', textAlign: 'right' },
  autoHint: { fontSize: 12, color: '#9ca3af', textAlign: 'right', marginTop: -8, marginBottom: 8 },

  earningsCard: { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 16, marginTop: 16 },
  earningsTitle: { fontSize: 14, fontWeight: '700', color: '#166534', marginBottom: 12 },
  earningsRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  earningsDivider: { borderTopWidth: 1, borderTopColor: '#bbf7d0', marginTop: 6, paddingTop: 10 },
  earningsLabel: { fontSize: 14, color: '#374151' },
  earningsVal:   { fontSize: 14, fontWeight: '600', color: '#111827' },
  earningsPayoutBox: {
    marginTop: 14, backgroundColor: '#22c55e', borderRadius: 12, padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  earningsPayoutLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },
  earningsPayoutValue: { fontSize: 28, fontWeight: '900', color: '#fff' },

  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input:      { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 16 },
  textArea:   { height: 100, textAlignVertical: 'top' },

  toggleRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  toggleLabel: { fontSize: 15, color: '#374151' },

  // ── Payment ──
  paymentSummary: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 16, marginBottom: 16 },
  payRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  payLabel:   { fontSize: 14, color: '#6b7280' },
  payVal:     { fontSize: 14, fontWeight: '600', color: '#111827' },
  payTotal:   { borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 8, paddingTop: 12 },
  payTotalLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },
  payTotalVal:   { fontSize: 20, fontWeight: '700', color: '#10b981' },

  splitCard:  { backgroundColor: '#eff6ff', borderRadius: 12, padding: 16, marginBottom: 8 },
  splitTitle: { fontSize: 14, fontWeight: '700', color: '#1e40af', marginBottom: 10 },
  splitRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  splitLabel: { flex: 1, fontSize: 13, color: '#374151' },
  splitVal:   { fontSize: 14, fontWeight: '600', color: '#374151' },

  methodCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: '#f9fafb', marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  methodIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  methodLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },

  // ── Review ──
  reviewProviderRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  reviewAvatar: { width: 56, height: 56, borderRadius: 28 },
  reviewAvatarPlaceholder: { backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center' },
  reviewAvatarInitial: { fontSize: 22, fontWeight: '700', color: '#2563eb' },
  reviewProviderName: { fontSize: 17, fontWeight: '700', color: '#111827' },
  reviewProviderSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 },
  starBtn: { padding: 4 },
  ratingLabel: { textAlign: 'center', fontSize: 15, fontWeight: '600', color: '#f59e0b', marginBottom: 8 },

  // ── Tip ──
  tipCard: { backgroundColor: '#fffbeb', borderRadius: 12, padding: 16, marginTop: 8, borderWidth: 1, borderColor: '#fde68a' },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  tipTitle: { fontSize: 15, fontWeight: '700', color: '#92400e' },
  tipHint: { fontSize: 12, color: '#78350f', marginBottom: 12 },
  tipBtns: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  tipAmtBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#fde68a', alignItems: 'center' },
  tipAmtBtnActive: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  tipAmtText: { fontSize: 13, fontWeight: '600', color: '#92400e' },
  tipAmtTextActive: { color: '#fff' },

  // ── Decline ──
  declineBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1.5, borderColor: '#ef4444',
    backgroundColor: '#fff5f5',
  },
  declineBtnFull: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#ef4444', backgroundColor: '#fff5f5',
  },
  declineBtnText: { fontSize: 14, fontWeight: '700', color: '#ef4444' },
});
