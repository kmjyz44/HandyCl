// US-locale formatting helpers. Use these everywhere instead of hardcoding ₴/грн or date strings.

export function formatMoney(amount: number | string | null | undefined, currency = 'USD'): string {
  const n = Number(amount || 0);
  const symbol = currency === 'UAH' ? '₴' : '$';
  return `${symbol}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// MM/DD/YYYY
export function formatDate(value: string | number | Date | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()}`;
}

// 12-hour clock with AM/PM
export function formatTime(value: string | number | Date | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// MM/DD/YYYY, h:mm AM/PM
export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return `${formatDate(d)}, ${formatTime(d)}`;
}

// Distance: meters/km -> miles or feet (US units)
export function formatDistance(meters: number | null | undefined): string {
  const m = Number(meters || 0);
  const miles = m / 1609.344;
  if (miles < 0.1) {
    const feet = Math.round(m * 3.28084);
    return `${feet} ft`;
  }
  return `${miles.toFixed(1)} mi`;
}

// Convert km value to miles string (when source data is already in km)
export function kmToMiles(km: number | null | undefined): string {
  const miles = Number(km || 0) * 0.621371;
  return `${miles.toFixed(1)} mi`;
}
