import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  getDoc,
  query, 
  onSnapshot,
  orderBy,
  Timestamp,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import { Booking } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { cleanData } from '../lib/utils';
import { checkRoomConflictInFirestore } from './roomAvailabilityService';

export const bookingService = {
  async createBooking(bookingData: Omit<Booking, 'id' | 'createdAt'>) {
    try {
      const { roomId, userName, phoneNumber, startTime, endTime } = bookingData;

      // 1. Comprehensive Room conflict check (Against both active Sessions and Bookings)
      const conflict = await checkRoomConflictInFirestore(roomId, startTime, endTime);
      if (conflict.hasConflict) {
        const err = new Error(conflict.errorMessage || 'ROOM_OVERLAP');
        (err as any).conflictDetails = conflict;
        throw err;
      }

      // 2. Check customer overlap (using phone or name in bookings)
      const { useWorkspaceStore } = await import('../store');
      const storeBookings = useWorkspaceStore.getState().bookings;
      let existingBookings: Booking[] = storeBookings;
      if (!existingBookings || existingBookings.length === 0) {
        const bookingsRef = collection(db, 'bookings');
        const snapshot = await getDocs(query(bookingsRef));
        existingBookings = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Booking[];
      }

      const customerOverlap = existingBookings.find(b => 
        b.status !== 'cancelled' &&
        (b.phoneNumber === phoneNumber || b.userName.trim().toLowerCase() === userName.trim().toLowerCase()) &&
        startTime < b.endTime && 
        endTime > b.startTime
      );

      if (customerOverlap) {
        throw new Error('CUSTOMER_OVERLAP_ERR');
      }

      // If checks pass, create the booking
      const total = bookingData.totalPrice || 0;
      const paid = Math.min(bookingData.paidAmount || 0, total);
      const remaining = Math.max(0, total - paid);
      let paymentStatus: Booking['paymentStatus'] = 'unpaid';
      if (paid >= total && total > 0) paymentStatus = 'paid';
      else if (paid > 0) paymentStatus = 'partially_paid';

      const selectedPaymentMethod = bookingData.paymentMethod || 'cash';

      const data = cleanData({
        ...bookingData,
        paidAmount: paid,
        remainingAmount: remaining,
        paymentStatus,
        paymentMethod: selectedPaymentMethod,
        createdAt: Date.now()
      });
      const docRef = await addDoc(collection(db, 'bookings'), data);

      // Record customer visit if customerId present or phone available
      try {
        const { visitService } = await import('./visitService');
        const { paymentService } = await import('./paymentService');

        if (bookingData.customerId) {
          await visitService.recordVisit({
            customerId: bookingData.customerId,
            customerName: bookingData.userName,
            customerPhone: bookingData.phoneNumber,
            date: bookingData.startTime,
            type: 'booking',
            referenceId: docRef.id,
            notes: `Room Booking ID: ${docRef.id}`
          });
        }

        if (paid > 0) {
          await paymentService.addPayment({
            bookingId: docRef.id,
            customerId: bookingData.customerId,
            amount: paid,
            paymentMethod: selectedPaymentMethod,
            date: Date.now(),
            notes: `عربون حجز غرفة (${bookingData.userName})`,
            skipBookingPaidUpdate: true
          });
        }
      } catch (e) {
        console.warn('Could not record booking visit/payment:', e);
      }

      return docRef.id;
    } catch (error: any) {
      if (error.message === 'ROOM_OVERLAP' || error.message === 'CUSTOMER_OVERLAP_ERR') {
        throw error;
      }
      handleFirestoreError(error, OperationType.CREATE, 'bookings');
    }
  },

  async updateBooking(id: string, data: Partial<Booking>) {
    try {
      const docRef = doc(db, 'bookings', id);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        throw new Error('Booking not found');
      }
      const current = snap.data() as Booking;
      const now = Date.now();

      // Check if trying to edit after start time
      if (current.startTime <= now) {
        throw new Error('BOOKING_ALREADY_STARTED');
      }

      // If time or room is being updated, check overlaps
      if (data.startTime || data.endTime || data.roomId) {
        const checkStartTime = data.startTime || current.startTime;
        const checkEndTime = data.endTime || current.endTime;
        const checkRoomId = data.roomId || current.roomId;
        const checkPhone = data.phoneNumber || current.phoneNumber;
        const checkName = data.userName || current.userName;

        const { useWorkspaceStore } = await import('../store');
        const storeBookings = useWorkspaceStore.getState().bookings;
        let allBookings: Booking[] = storeBookings;
        if (!allBookings || allBookings.length === 0) {
          const bookingsRef = collection(db, 'bookings');
          const snapshot = await getDocs(query(bookingsRef));
          allBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
        }
        const otherBookings = allBookings.filter(b => b.id !== id && b.status !== 'cancelled');

        // Check room overlap against bookings and active sessions
        const conflict = await checkRoomConflictInFirestore(checkRoomId, checkStartTime, checkEndTime, {
          excludeBookingId: id,
        });

        if (conflict.hasConflict) {
          const err = new Error(conflict.errorMessage || 'ROOM_OVERLAP');
          (err as any).conflictDetails = conflict;
          throw err;
        }

        const customerOverlap = otherBookings.find(b => 
          (b.phoneNumber === checkPhone || b.userName.trim().toLowerCase() === checkName.trim().toLowerCase()) &&
          checkStartTime < b.endTime && 
          checkEndTime > b.startTime
        );

        if (customerOverlap) {
          throw new Error('CUSTOMER_OVERLAP_ERR');
        }
      }

      await updateDoc(docRef, cleanData(data));
    } catch (error: any) {
      if (error.message === 'BOOKING_ALREADY_STARTED' || error.message === 'ROOM_OVERLAP' || error.message === 'CUSTOMER_OVERLAP_ERR') {
        throw error;
      }
      handleFirestoreError(error, OperationType.UPDATE, 'bookings');
      throw error;
    }
  },

  async cancelBooking(id: string, reason?: string) {
    try {
      const docRef = doc(db, 'bookings', id);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return;
      const booking = snap.data() as Booking;

      const lostDeposit = booking.paidAmount || 0;

      await updateDoc(docRef, cleanData({
        status: 'cancelled',
        cancellationReason: reason || 'Cancelled by user before start',
        cancelledAt: Date.now(),
        lostDeposit: lostDeposit,
      }));

      // Delete payments from payments collection so deposit does not count as active revenue
      if (lostDeposit > 0) {
        try {
          const { paymentService } = await import('./paymentService');
          await paymentService.deletePaymentsByBookingId(id);
        } catch (err) {
          console.warn('Could not remove payment record on booking cancellation:', err);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'bookings');
      throw error;
    }
  },

  async deleteBooking(id: string) {
    try {
      const docRef = doc(db, 'bookings', id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const booking = snap.data() as Booking;
        // Clean up linked payments if booking is deleted
        if (booking.paidAmount && booking.paidAmount > 0) {
          try {
            const { paymentService } = await import('./paymentService');
            await paymentService.deletePaymentsByBookingId(id);
          } catch (err) {
            console.warn('Could not remove payment record on booking deletion:', err);
          }
        }
      }

      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'bookings');
      throw error;
    }
  },

  subscribeToBookings(callback: (bookings: Booking[]) => void) {
    const q = query(
      collection(db, 'bookings'),
      orderBy('startTime', 'asc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const bookings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Booking[];
      callback(bookings);
    }, (error) => {
      console.error("Error subscribing to bookings:", error);
    });
  }
};
