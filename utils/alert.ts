/**
 * Cross-platform alert helpers — now backed by modern in-app UI.
 *
 * `showAlert`  -> animated toast (success/error/info auto-detected)
 * `showConfirm`/`showAlertWithButtons` -> modern modal confirm dialog
 *
 * Works identically on web and native. The visual hosts (<ToastHost/> and
 * <ConfirmHost/>) are mounted once at the root layout.
 */
import { toast, type ToastType } from '../components/ToastHost';
import { confirmDialog } from '../components/ConfirmHost';

type Btn = { text: string; style?: 'cancel' | 'destructive' | 'default'; onPress?: () => void };

const SUCCESS_RE = /(success|успіх|готов|saved|збереж|надіслан|sent|verified|підтвердж|оновлен|updated|added|додан|deleted|видален)/i;
const ERROR_RE = /(error|помилк|fail|не вдал|invalid|невірн|denied|forbidden)/i;

function detectType(title: string, message?: string): ToastType {
  const text = `${title} ${message || ''}`;
  if (ERROR_RE.test(text)) return 'error';
  if (SUCCESS_RE.test(text)) return 'success';
  return 'info';
}

function isDestructive(label: string, btnStyle?: string): boolean {
  if (btnStyle === 'destructive') return true;
  return /(delete|remove|видал|зня|block|заблок|cancel booking)/i.test(label);
}

export function showAlert(title: string, message?: string) {
  toast.show({ type: detectType(title, message), title, message });
}

export function showConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmLabel: string = 'OK',
  cancelLabel: string = 'Скасувати',
) {
  confirmDialog({
    title,
    message,
    confirmLabel,
    cancelLabel,
    destructive: isDestructive(confirmLabel),
  }).then((ok) => {
    if (ok) onConfirm();
  });
}

/**
 * Generic multi-button alert. 1 button -> toast; 2+ -> modal confirm using
 * the first non-cancel button as the action.
 */
export function showAlertWithButtons(title: string, message: string, buttons: Btn[]) {
  if (!buttons || buttons.length <= 1) {
    showAlert(title, message);
    buttons?.[0]?.onPress?.();
    return;
  }
  const cancelBtn = buttons.find((b) => b.style === 'cancel');
  const actionBtn = buttons.find((b) => b.style !== 'cancel') || buttons[0];
  confirmDialog({
    title,
    message,
    confirmLabel: actionBtn.text,
    cancelLabel: cancelBtn?.text || 'Скасувати',
    destructive: isDestructive(actionBtn.text, actionBtn.style),
  }).then((ok) => {
    if (ok) actionBtn.onPress?.();
    else cancelBtn?.onPress?.();
  });
}
