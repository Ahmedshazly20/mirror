import { Customer, Payment, Session } from '../../../types';
import {
  getSessionDateMillis,
  isSameCalendarDay,
  parseTimestampToMillis,
} from '../../../lib/utils-workspace';

export type HistoryCategoryFilter =
  | 'all'
  | 'guests'
  | 'subscribers'
  | 'rooms'
  | 'product_orders';

export type HistoryTransaction =
  | {
      kind: 'session';
      id: string;
      timestampMs: number;
      session: Session;
    }
  | {
      kind: 'product_order';
      id: string;
      timestampMs: number;
      payment: Payment;
    };

export interface CustomerLookupMaps {
  byId: Map<string, Customer>;
  byPhone: Map<string, Customer>;
  byNumericId: Map<number, Customer>;
  byName: Map<string, Customer>;
}

export function buildCustomerLookupMaps(customers: Customer[] = []): CustomerLookupMaps {
  const byId = new Map<string, Customer>();
  const byPhone = new Map<string, Customer>();
  const byNumericId = new Map<number, Customer>();
  const byName = new Map<string, Customer>();

  customers.forEach((c) => {
    if (c.id) byId.set(c.id, c);
    if (c.phone) byPhone.set(c.phone.trim(), c);
    if (c.customerId !== undefined && c.customerId !== null) {
      byNumericId.set(Number(c.customerId), c);
    }
    if (c.name) byName.set(c.name.trim().toLowerCase(), c);
  });

  return { byId, byPhone, byNumericId, byName };
}

export function isRoomSession(session: Session): boolean {
  if (session.bookingId || session.pricingType === 'booking') return true;
  if (session.roomAssignment && (session.roomAssignment.roomId || session.roomAssignment.roomName)) {
    return true;
  }
  if ((session as any).roomId || (session as any).roomName) return true;
  return false;
}

export function isSubscriberSession(session: Session): boolean {
  return Boolean(
    session.isSubscribed || session.subscriptionId || session.pricingType === 'subscription',
  );
}

export function isGuestSession(session: Session): boolean {
  return !isRoomSession(session) && !isSubscriberSession(session);
}

export function isProductOrderPayment(payment: Payment | null | undefined): boolean {
  return Boolean(payment && payment.id && payment.paymentType === 'product_order');
}

export function getPaymentDateMillis(payment: Payment | null | undefined): number | null {
  if (!payment) return null;
  return parseTimestampToMillis(payment.date ?? payment.createdAt);
}

export function getDayCompletedSessions(
  completedSessions: Session[],
  selectedDate: Date,
): Session[] {
  const seen = new Set<string>();
  const result: Session[] = [];

  for (const session of completedSessions || []) {
    if (!session || !session.id || session.status === 'active') continue;
    if (seen.has(session.id)) continue;
    const sessionDateMs = getSessionDateMillis(session);
    if (sessionDateMs === null) continue;
    if (!isSameCalendarDay(sessionDateMs, selectedDate)) continue;
    seen.add(session.id);
    result.push(session);
  }

  return result;
}

export function getDayProductOrders(
  payments: Payment[],
  selectedDate: Date,
): Payment[] {
  const seen = new Set<string>();
  const result: Payment[] = [];

  for (const payment of payments || []) {
    if (!isProductOrderPayment(payment)) continue;
    if (seen.has(payment.id)) continue;
    const paymentDateMs = getPaymentDateMillis(payment);
    if (paymentDateMs === null) continue;
    if (!isSameCalendarDay(paymentDateMs, selectedDate)) continue;
    seen.add(payment.id);
    result.push(payment);
  }

  return result;
}

export function resolveCustomerForSession(
  session: Session,
  customerMaps: CustomerLookupMaps,
): Customer | undefined {
  return (
    (session.customerId && customerMaps.byId.get(session.customerId)) ||
    ((session as any).customerNumericId !== undefined &&
      customerMaps.byNumericId.get(Number((session as any).customerNumericId))) ||
    (session.phoneNumber && customerMaps.byPhone.get(session.phoneNumber.trim())) ||
    (session.userName && customerMaps.byName.get(session.userName.trim().toLowerCase())) ||
    undefined
  );
}

export function resolveCustomerForPayment(
  payment: Payment,
  customerMaps: CustomerLookupMaps,
): Customer | undefined {
  return (
    (payment.customerId && customerMaps.byId.get(payment.customerId)) ||
    (payment.customerPhone && customerMaps.byPhone.get(payment.customerPhone.trim())) ||
    (payment.customerName && customerMaps.byName.get(payment.customerName.trim().toLowerCase())) ||
    undefined
  );
}

export function matchesSessionSearch(
  session: Session,
  searchQuery: string,
  customerMaps: CustomerLookupMaps,
): boolean {
  const searchLower = searchQuery.toLowerCase().trim();
  if (!searchLower) return true;
  const cleanSearch = searchLower.replace(/^#/, '');

  const sessionCust = resolveCustomerForSession(session, customerMaps);
  const custNumId =
    sessionCust?.customerId?.toString() ||
    ((session as any).customerNumericId?.toString() || '');

  const matchesCustomerId =
    Boolean(custNumId && (custNumId === cleanSearch || custNumId.includes(cleanSearch))) ||
    Boolean(session.customerId && session.customerId.toLowerCase().includes(searchLower));

  const matchesName =
    Boolean(session.userName?.toLowerCase().includes(searchLower)) ||
    Boolean(sessionCust?.name && sessionCust.name.toLowerCase().includes(searchLower));

  const matchesPhone =
    Boolean(session.phoneNumber && session.phoneNumber.includes(cleanSearch)) ||
    Boolean(sessionCust?.phone && sessionCust.phone.includes(cleanSearch));

  const roomNameStr = (
    session.roomAssignment?.roomName ||
    (session as any).roomName ||
    ''
  ).toLowerCase();
  const tableLabelStr = (
    session.roomAssignment?.tableLabel ||
    (session as any).tableLabel ||
    ''
  ).toLowerCase();
  const tableNumberStr =
    session.roomAssignment?.tableNumber?.toString() ||
    (session as any).tableNumber?.toString() ||
    '';
  const notesStr = (session.notes || '').toLowerCase();

  const matchesRoom = roomNameStr.includes(searchLower);
  const matchesTable =
    tableLabelStr.includes(searchLower) ||
    Boolean(cleanSearch && tableNumberStr.includes(cleanSearch));
  const matchesNotes = notesStr.includes(searchLower);

  return (
    matchesCustomerId ||
    matchesName ||
    matchesPhone ||
    matchesRoom ||
    matchesTable ||
    matchesNotes
  );
}

export function matchesProductOrderSearch(
  payment: Payment,
  searchQuery: string,
  customerMaps: CustomerLookupMaps,
): boolean {
  const searchLower = searchQuery.toLowerCase().trim();
  if (!searchLower) return true;
  const cleanSearch = searchLower.replace(/^#/, '');

  const linkedCust = resolveCustomerForPayment(payment, customerMaps);
  const custNumId = linkedCust?.customerId?.toString() || '';

  const matchesOrderId =
    payment.id.toLowerCase().includes(cleanSearch) ||
    payment.id.toLowerCase().includes(searchLower);

  const matchesCustomerId =
    Boolean(custNumId && (custNumId === cleanSearch || custNumId.includes(cleanSearch))) ||
    Boolean(payment.customerId && payment.customerId.toLowerCase().includes(searchLower));

  const isWalkIn =
    !payment.customerName || payment.customerName.trim() === 'عميل سريع';

  const matchesName =
    Boolean(payment.customerName?.toLowerCase().includes(searchLower)) ||
    Boolean(linkedCust?.name && linkedCust.name.toLowerCase().includes(searchLower)) ||
    (isWalkIn && 'walk-in customer'.includes(searchLower));

  const matchesPhone =
    Boolean(payment.customerPhone && payment.customerPhone.includes(cleanSearch)) ||
    Boolean(linkedCust?.phone && linkedCust.phone.includes(cleanSearch));

  const matchesProducts = (payment.items || []).some((item) =>
    item.name?.toLowerCase().includes(searchLower),
  );

  const matchesNotes = Boolean(payment.notes?.toLowerCase().includes(searchLower));
  const matchesCreatedBy = Boolean(payment.createdBy?.toLowerCase().includes(searchLower));
  const matchesMethod = Boolean(payment.paymentMethod?.toLowerCase().includes(searchLower));

  return (
    matchesOrderId ||
    matchesCustomerId ||
    matchesName ||
    matchesPhone ||
    matchesProducts ||
    matchesNotes ||
    matchesCreatedBy ||
    matchesMethod
  );
}

/**
 * Combines completed sessions and standalone product orders for the selected day,
 * applies category + room + search filters, and sorts newest first.
 *
 * Important:
 * - Room filter ('rooms') applies to sessions only; standalone product orders have no room
 *   and are preserved when 'rooms' filter is active.
 */
export function buildHistoryTransactions(params: {
  daySessions: Session[];
  dayProductOrders: Payment[];
  categoryFilter: HistoryCategoryFilter;
  searchQuery: string;
  customerMaps: CustomerLookupMaps;
}): HistoryTransaction[] {
  const {
    daySessions,
    dayProductOrders,
    categoryFilter,
    searchQuery,
    customerMaps,
  } = params;

  const transactions: HistoryTransaction[] = [];

  if (categoryFilter !== 'product_orders') {
    for (const session of daySessions) {
      if (categoryFilter === 'guests' && !isGuestSession(session)) continue;
      if (categoryFilter === 'subscribers' && !isSubscriberSession(session)) continue;
      if (categoryFilter === 'rooms' && !isRoomSession(session)) continue;
      if (!matchesSessionSearch(session, searchQuery, customerMaps)) continue;

      const timestampMs = getSessionDateMillis(session) ?? 0;
      transactions.push({
        kind: 'session',
        id: session.id,
        timestampMs,
        session,
      });
    }
  }

  // Product orders appear in 'all', 'product_orders', and 'rooms' (room filters apply to sessions only)
  const includeProductOrders =
    categoryFilter === 'all' ||
    categoryFilter === 'product_orders' ||
    categoryFilter === 'rooms';

  if (includeProductOrders) {
    for (const payment of dayProductOrders) {
      if (!matchesProductOrderSearch(payment, searchQuery, customerMaps)) continue;
      const timestampMs = getPaymentDateMillis(payment) ?? 0;
      transactions.push({
        kind: 'product_order',
        id: payment.id,
        timestampMs,
        payment,
      });
    }
  }

  transactions.sort((a, b) => {
    if (b.timestampMs !== a.timestampMs) {
      return b.timestampMs - a.timestampMs;
    }
    return a.id.localeCompare(b.id);
  });

  return transactions;
}
