import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  doc, 
  getDoc, 
  getDocs,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { Payment, Booking } from '../types';
import { cleanData } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export interface AddPaymentOptions extends Omit<Payment, 'id' | 'createdAt'> {
  skipBookingPaidUpdate?: boolean;
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

  subscribeToPayments(callback: (payments: Payment[]) => void) {
    const q = query(collection(db, 'payments'), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const payments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Payment[];
      callback(payments);
    }, (error) => {
      console.error('Error subscribing to payments:', error);
    });
  }
};
