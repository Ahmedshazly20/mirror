/**
 * Lightweight Development-Only Firestore Metrics & Telemetry
 * Tracks read and write calls without writing any data to Firestore.
 */

interface MetricsSummary {
  reads: number;
  writes: number;
  listenerEvents: number;
  operations: { [type: string]: number };
}

const metrics: MetricsSummary = {
  reads: 0,
  writes: 0,
  listenerEvents: 0,
  operations: {}
};

const isDev = Boolean((import.meta as any).env?.DEV);

export function recordFirestoreRead(source: string, docCount = 1) {
  if (!isDev) return;
  metrics.reads += docCount;
  metrics.operations[source] = (metrics.operations[source] || 0) + docCount;
  console.debug(`[Firestore Metrics] Read: ${source} (+${docCount} docs, Total: ${metrics.reads})`);
}

export function recordFirestoreWrite(source: string, docCount = 1) {
  if (!isDev) return;
  metrics.writes += docCount;
  metrics.operations[source] = (metrics.operations[source] || 0) + docCount;
  console.debug(`[Firestore Metrics] Write: ${source} (+${docCount} docs, Total: ${metrics.writes})`);
}

export function recordListenerSnapshot(source: string, docCount = 1) {
  if (!isDev) return;
  metrics.listenerEvents += 1;
  metrics.reads += docCount;
  console.debug(`[Firestore Metrics] Listener Sync: ${source} (${docCount} docs synced)`);
}

export function getFirestoreMetrics(): MetricsSummary {
  return { ...metrics, operations: { ...metrics.operations } };
}

export function resetFirestoreMetrics() {
  metrics.reads = 0;
  metrics.writes = 0;
  metrics.listenerEvents = 0;
  metrics.operations = {};
}

if (isDev && typeof window !== 'undefined') {
  (window as any).__firestoreMetrics = {
    get: getFirestoreMetrics,
    reset: resetFirestoreMetrics
  };
}
