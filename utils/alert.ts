/**
 * Cross-platform alert helpers.
 *
 * React Native's built-in `Alert.alert` is a no-op on web — buttons never
 * fire and the user sees nothing. We use `window.alert` / `window.confirm`
 * on the web and fall back to the native module on iOS/Android.
 */
import { Alert, Platform } from 'react-native';

type Btn = { text: string; style?: 'cancel' | 'destructive' | 'default'; onPress?: () => void };

export function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export function showConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmLabel: string = 'OK',
  cancelLabel: string = 'Cancel',
) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    const ok = window.confirm(`${title}\n\n${message}`);
    if (ok) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

/**
 * Generic multi-button alert that works on web by chaining confirms.
 * Use sparingly — prefer showConfirm for yes/no.
 */
export function showAlertWithButtons(title: string, message: string, buttons: Btn[]) {
  if (Platform.OS === 'web') {
    // Build a numbered prompt fallback
    if (buttons.length <= 1) {
      // eslint-disable-next-line no-alert
      window.alert(`${title}\n\n${message}`);
      buttons[0]?.onPress?.();
      return;
    }
    // 2-button: confirm = first non-cancel button
    const actionBtn = buttons.find((b) => b.style !== 'cancel') || buttons[0];
    // eslint-disable-next-line no-alert
    const ok = window.confirm(`${title}\n\n${message}\n\nOK = ${actionBtn.text}`);
    if (ok) actionBtn.onPress?.();
    return;
  }
  Alert.alert(title, message, buttons as any);
}
