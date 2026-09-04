import { formatDistanceToNow } from 'date-fns';

// ── Cached High-Performance Formatters ───────────────────────────────────────
// Creating Intl formatters is CPU-heavy. Caching instances yields 10x-50x faster execution in lists.
const currencyFormatters = new Map<string, Intl.NumberFormat>();

export function getCachedCurrencyFormatter(locale = 'en-EG', currency = 'EGP'): Intl.NumberFormat {
  const key = `${locale}_${currency}`;
  let formatter = currencyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 1,
    });
    currencyFormatters.set(key, formatter);
  }
  return formatter;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function formatCurrency(amount: number): string {
  if (typeof amount !== 'number' || isNaN(amount)) return '0 EGP';
  return getCachedCurrencyFormatter('en-EG', 'EGP').format(amount);
}

export function toMillis(timestamp: any): number {
  if (!timestamp) return Date.now();
  if (typeof timestamp === 'number') return timestamp;
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
  if (typeof timestamp.seconds === 'number') return timestamp.seconds * 1000;
  if (timestamp instanceof Date) return timestamp.getTime();
  return Date.now();
}

export function getTimeElapsed(startTime: any): string {
  return formatDistanceToNow(toMillis(startTime), { addSuffix: false });
}

