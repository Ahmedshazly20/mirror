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

export function calculateDurationMinutes(startTime: any, endTime?: any): number {
  const start = toMillis(startTime);
  const end = endTime ? toMillis(endTime) : Date.now();
  const diffMs = Math.max(0, end - start);
  return Math.max(0, Math.floor(diffMs / (1000 * 60)));
}

export function formatPackageBalance(minutesOrHours: number | undefined | null, isMinutes: boolean = true): string {
  if (minutesOrHours === undefined || minutesOrHours === null || isNaN(minutesOrHours)) return '0h';
  const totalMinutes = isMinutes ? Math.round(minutesOrHours) : Math.round(minutesOrHours * 60);
  if (totalMinutes <= 0) return '0h';
  
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function getSubscriptionRemainingMinutes(sub: { 
  remainingMinutes?: number | null; 
  remainingHours?: number | null; 
  totalHours?: number | null;
  totalMinutes?: number | null;
} | null | undefined): number {
  if (!sub) return 0;
  if (typeof sub.remainingMinutes === 'number') {
    return Math.max(0, Math.round(sub.remainingMinutes));
  }
  if (typeof sub.remainingHours === 'number') {
    return Math.max(0, Math.round(sub.remainingHours * 60));
  }
  if (typeof sub.totalMinutes === 'number') {
    return Math.max(0, Math.round(sub.totalMinutes));
  }
  if (typeof sub.totalHours === 'number') {
    return Math.max(0, Math.round(sub.totalHours * 60));
  }
  return 0;
}

export function getSubscriptionTotalMinutes(sub: {
  totalMinutes?: number | null;
  totalHours?: number | null;
} | null | undefined): number {
  if (!sub) return 0;
  if (typeof sub.totalMinutes === 'number') {
    return Math.max(0, Math.round(sub.totalMinutes));
  }
  if (typeof sub.totalHours === 'number') {
    return Math.max(0, Math.round(sub.totalHours * 60));
  }
  return 0;
}

export function getTimeElapsed(startTime: any): string {
  return formatDistanceToNow(toMillis(startTime), { addSuffix: false });
}


