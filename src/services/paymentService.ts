import { 
  collection, 
  addDoc, 
  setDoc,
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  doc, 
  getDoc, 
  getDocs,
  updateDoc,
  deleteDoc,
  limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { Payment, PaymentOrderItem, Booking } from '../types';
import { cleanData } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export interface AddPaymentOptions extends Omit<Payment, 'id' | 'createdAt'> {
  skipBookingPaidUpdate?: boolean;
}

export interface CreateProductOrderInput {
  items: PaymentOrderItem[];
  subtotal: number;
  serviceDiscountTotal?: number;
  amount: number;
  paymentMethod: 'cash' | 'instapay' | 'card';
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  createdBy?: string;
}

export const paymentService = {
  async addPayment(paymentData: AddPaymentOptions): Promise<string> {
    try {
      const { skipBookingPaidUpdate, ...rawPayment } = paymentData;
      const data = cleanData({
        ...rawPayment,
        date: rawPayment.date || Date.now(),
        createdAt: Date.now()
      });

      const docRef = await addDoc(collection(db, 'payments'), data);

      // If associated with a booking and not instructed to skip (e.g. when booking/session already computed paidAmount), update booking payment state
      if (rawPayment.bookingId && !skipBookingPaidUpdate) {
        const bookingRef = doc(db, 'bookings', rawPayment.bookingId);
        const bookingSnap = await getDoc(bookingRef);
        if (bookingSnap.exists()) {
          const booking = bookingSnap.data() as Booking;
          const currentPaid = booking.paidAmount || 0;
          const newPaid = currentPaid + rawPayment.amount;
          const total = booking.totalPrice || 0;
          const remaining = Math.max(0, total - newPaid);
          
          let paymentStatus: Booking['paymentStatus'] = 'unpaid';
          if (newPaid >= total) {
            paymentStatus = 'paid';
          } else if (newPaid > 0) {
            paymentStatus = 'partially_paid';
          }

          await updateDoc(bookingRef, {
            paidAmount: newPaid,
            remainingAmount: remaining,
            paymentStatus
          });
        }
      }

      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'payments');
      throw error;
    }
  },

  /**
   * Creates a standalone product-only order (quick sale) without creating a session,
   * starting a timer, consuming package minutes, or charging room fees.
   */
  async createProductOrder(orderInput: CreateProductOrderInput): Promise<Payment> {
    try {
      if (!orderInput.items || orderInput.items.length === 0) {
        throw new Error('EMPTY_ORDER');
      }

      const paymentRef = doc(collection(db, 'payments'));
      const now = Date.now();
      const customerLabel = (orderInput.customerName || '').trim() || 'عميل سريع';

      // 1. Validate and deduct inventory atomically BEFORE writing payment
      const { inventoryService } = await import('./inventoryService');
      const stockRes = await inventoryService.validateAndDeductOrderStock(
        orderInput.items,
        'product_order',
        paymentRef.id,
        `طلب منتجات مباشر (${customerLabel})`
      );

      if (!stockRes.success) {
        throw new Error(stockRes.error || 'INSUFFICIENT_STOCK');
      }

      // 2. Write payment record cleanly marked as product_order
      const itemSummary = orderInput.items.map(i => `${i.name} ×${i.quantity}`).join('، ');
      const paymentPayload = cleanData({
        paymentType: 'product_order' as const,
        customerId: orderInput.customerId || undefined,
        customerName: customerLabel,
        customerPhone: orderInput.customerPhone?.trim() || undefined,
        items: orderInput.items,
        subtotal: orderInput.subtotal,
        serviceDiscountTotal: orderInput.serviceDiscountTotal || 0,
        amount: orderInput.amount,
        paymentMethod: orderInput.paymentMethod,
        date: now,
        createdAt: now,
        createdBy: orderInput.createdBy || undefined,
        notes: orderInput.notes?.trim()
          ? `${orderInput.notes.trim()} | ${itemSummary}`
          : `طلب منتجات مباشر (${customerLabel}): ${itemSummary}`,
      });

      await setDoc(paymentRef, paymentPayload);

      // 3. Update customer totalSpent if registered customer was linked
      if (orderInput.customerId && orderInput.amount > 0) {
        try {
          const { customerService } = await import('./customerService');
          const cust = await customerService.getCustomerById(orderInput.customerId);
          if (cust) {
            await customerService.updateCustomer(orderInput.customerId, {
              totalSpent: (cust.totalSpent || 0) + orderInput.amount
            });
          }
        } catch (custErr) {
          console.warn('Could not update customer totalSpent for product order:', custErr);
        }
      }

      return { id: paymentRef.id, ...paymentPayload } as Payment;
    } catch (error) {
      if (error instanceof Error && (error.message === 'EMPTY_ORDER' || error.message.includes('المخزون'))) {
        throw error;
      }
      handleFirestoreError(error, OperationType.CREATE, 'payments');
      throw error;
    }
  },

  async deletePaymentsByBookingId(bookingId: string) {
    try {
      const q = query(collection(db, 'payments'), where('bookingId', '==', bookingId));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'payments', d.id)));
      await Promise.all(deletePromises);
    } catch (error) {
      console.warn('Error deleting payments for booking:', error);
    }
  },

  subscribeToPayments(callback: (payments: Payment[]) => void, limitCount = 100) {
    const q = query(collection(db, 'payments'), orderBy('date', 'desc'), limit(limitCount));
    return onSnapshot(q, (snapshot) => {
      const payments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Payment[];
      callback(payments);
    }, (error) => {
      console.error('Error subscribing to payments:', error);
    });
  },

  /**
   * On-demand date range fetch for Reports and Financial Audits.
   */
  async getPaymentsByDateRange(startMs: number, endMs: number): Promise<Payment[]> {
    try {
      const { recordFirestoreRead } = await import('../lib/firestore-metrics');
      const q = query(
        collection(db, 'payments'),
        where('date', '>=', startMs),
        where('date', '<=', endMs)
      );
      const snapshot = await getDocs(q);
      recordFirestoreRead('getPaymentsByDateRange', snapshot.size);
      const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Payment[];
      const { useWorkspaceStore } = await import('../store');
      useWorkspaceStore.getState().mergePayments(payments);
      return payments;
    } catch (e) {
      console.warn('Error fetching payments by date range:', e);
      return [];
    }
  }
};
