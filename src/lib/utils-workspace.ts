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

export function parseTimestampToMillis(timestamp: any): number | null {
  if (timestamp === undefined || timestamp === null || timestamp === '') return null;
  if (typeof timestamp === 'number') {
    return !isNaN(timestamp) && timestamp > 0 ? timestamp : null;
  }
  if (typeof timestamp.toMillis === 'function') {
    try {
      const ms = timestamp.toMillis();
      return typeof ms === 'number' && !isNaN(ms) && ms > 0 ? ms : null;
    } catch (_) {
      return null;
    }
  }
  if (typeof timestamp.toDate === 'function') {
    try {
      const d = timestamp.toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d.getTime() : null;
    } catch (_) {
      return null;
    }
  }
  if (typeof timestamp.seconds === 'number') {
    const ms = timestamp.seconds * 1000 + (timestamp.nanoseconds ? Math.floor(timestamp.nanoseconds / 1000000) : 0);
    return !isNaN(ms) && ms > 0 ? ms : null;
  }
  if (typeof timestamp._seconds === 'number') {
    const ms = timestamp._seconds * 1000;
    return !isNaN(ms) && ms > 0 ? ms : null;
  }
  if (timestamp instanceof Date) {
    const ms = timestamp.getTime();
    return !isNaN(ms) && ms > 0 ? ms : null;
  }
  if (typeof timestamp === 'string') {
    const trimmed = timestamp.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    if (!isNaN(num) && num > 0) return num;
    const parsed = new Date(trimmed).getTime();
    return !isNaN(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

export function toMillis(timestamp: any, fallback = Date.now()): number {
  const parsed = parseTimestampToMillis(timestamp);
  return parsed !== null ? parsed : fallback;
}

/**
 * Gets the canonical session start date in milliseconds.
 * Primary source is session.startTime. Fallback is session.createdAt.
 * Does NOT use endTime or completedAt.
 */
export function getSessionDateMillis(session: any): number | null {
  if (!session) return null;
  return parseTimestampToMillis(session.startTime ?? session.createdAt);
}

export function getSessionTimestamp(session: any): number {
  const dateMs = getSessionDateMillis(session);
  return dateMs !== null ? dateMs : Date.now();
}

/**
 * Compares whether two timestamps belong to the exact same calendar day in the local timezone.
 * Returns false if either date is null or invalid.
 */
export function isSameCalendarDay(dateA: any, dateB: any): boolean {
  const msA = parseTimestampToMillis(dateA);
  const msB = parseTimestampToMillis(dateB);
  if (msA === null || msB === null) return false;

  const d1 = new Date(msA);
  const d2 = new Date(msB);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
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


