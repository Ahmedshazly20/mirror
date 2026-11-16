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
  getDocs,
  where,
  limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { Booking, RoomTransferRecord, Session } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { cleanData } from '../lib/utils';
import { checkRoomConflictInFirestore, isSamePhysicalRoom } from './roomAvailabilityService';

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
      const storeState = useWorkspaceStore.getState();
      let existingBookings: Booking[] = storeState.bookings || [];
      if (!storeState.bookingsLoaded) {
        const { recordFirestoreRead } = await import('../lib/firestore-metrics');
        const bookingsRef = collection(db, 'bookings');
        const snapshot = await getDocs(query(
          bookingsRef,
          where('status', 'in', ['confirmed', 'active']),
          where('startTime', '<', endTime),
          limit(30)
        ));
        recordFirestoreRead('createBooking:customerOverlapCheck', snapshot.size);
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
      const isCoveredBySubscription = Boolean(bookingData.isSubscribed && bookingData.subscriptionId);
      const total = isCoveredBySubscription ? 0 : (bookingData.totalPrice || 0);
      const paid = isCoveredBySubscription ? 0 : Math.min(bookingData.paidAmount || 0, total);
      const remaining = isCoveredBySubscription ? 0 : Math.max(0, total - paid);
      let paymentStatus: Booking['paymentStatus'] = 'unpaid';
      if (isCoveredBySubscription) {
        paymentStatus = 'paid';
      } else if (paid >= total && total > 0) {
        paymentStatus = 'paid';
      } else if (paid > 0) {
        paymentStatus = 'partially_paid';
      }

      const selectedPaymentMethod = bookingData.paymentMethod || 'cash';

      const data = cleanData({
        ...bookingData,
        totalPrice: total,
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
        let allBookings: Booking[] = storeBookings || [];
        if (allBookings.length === 0) {
          const bookingsRef = collection(db, 'bookings');
          const snapshot = await getDocs(query(
            bookingsRef,
            where('status', 'in', ['confirmed', 'active']),
            limit(50)
          ));
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

  /**
   * Transfers an existing booking (upcoming, ready, or active) to another available room.
   * Preserves original pricing, deposits, and customer subscriptions without charging again
   * or altering the subscription/package document.
   */
  async transferBookingRoom(
    bookingId: string,
    newRoom: {
      roomId: string;
      roomName: string;
      tableId?: string;
      tableNumber?: number;
      tableLabel?: string;
      groupSize?: number;
    },
    reason?: string,
    transferredBy?: string
  ): Promise<RoomTransferRecord> {
    try {
      const docRef = doc(db, 'bookings', bookingId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        throw new Error('Booking not found');
      }
      const booking = { id: snap.id, ...snap.data() } as Booking;

      if (booking.status === 'cancelled' || booking.status === 'completed') {
        throw new Error('CANNOT_TRANSFER_CLOSED_BOOKING');
      }

      if (isSamePhysicalRoom({ id: booking.roomId, name: booking.roomName }, { id: newRoom.roomId, name: newRoom.roomName })) {
        throw new Error('SAME_ROOM');
      }

      // Check conflict in target room for booking's time window
      const conflict = await checkRoomConflictInFirestore(
        newRoom.roomId,
        booking.startTime,
        booking.endTime,
        {
          excludeBookingId: bookingId,
          excludeSessionId: booking.activeSessionId || `booking_${bookingId}`,
          roomName: newRoom.roomName
        }
      );

      if (conflict.hasConflict) {
        const err = new Error(conflict.errorMessage || 'ROOM_OVERLAP');
        (err as any).conflictDetails = conflict;
        throw err;
      }

      // Resolve old room display name
      let oldRoomName = booking.roomName;
      if (!oldRoomName) {
        try {
          const { useWorkspaceStore } = await import('../store');
          const storeRooms = useWorkspaceStore.getState().rooms || [];
          oldRoomName = storeRooms.find(r => r.id === booking.roomId)?.name || booking.roomId;
        } catch {
          oldRoomName = booking.roomId;
        }
      }

      const now = Date.now();
      const transferRecord: RoomTransferRecord = {
        fromRoomId: booking.roomId,
        fromRoomName: oldRoomName,
        toRoomId: newRoom.roomId,
        toRoomName: newRoom.roomName,
        transferredAt: now,
        transferredBy: transferredBy || undefined,
        reason: reason?.trim() || undefined,
      };

      const nextHistory = [...(booking.transferHistory || []), transferRecord];

      await updateDoc(docRef, cleanData({
        roomId: newRoom.roomId,
        roomName: newRoom.roomName,
        originalRoomId: booking.originalRoomId || booking.roomId,
        originalRoomName: booking.originalRoomName || oldRoomName,
        transferredAt: now,
        transferReason: reason?.trim() || booking.transferReason,
        transferHistory: nextHistory,
      }));

      // If this booking already has an active session, update its roomAssignment too so UI/History/Reports reflect actual room
      const candidateSessionIds = new Set<string>();
      if (booking.activeSessionId) candidateSessionIds.add(booking.activeSessionId);
      candidateSessionIds.add(`booking_${bookingId}`);

      try {
        const activeQ = query(
          collection(db, 'sessions'),
          where('bookingId', '==', bookingId),
          where('status', '==', 'active'),
          limit(5)
        );
        const activeSnap = await getDocs(activeQ);
        activeSnap.docs.forEach(d => candidateSessionIds.add(d.id));
      } catch (_) {}

      for (const sessId of candidateSessionIds) {
        try {
          const sessRef = doc(db, 'sessions', sessId);
          const sessSnap = await getDoc(sessRef);
          if (sessSnap.exists()) {
            const sessData = sessSnap.data() as Session;
            if (sessData.status === 'active') {
              const newAssignment = {
                roomId: newRoom.roomId,
                roomName: newRoom.roomName,
                tableId: newRoom.tableId || sessData.roomAssignment?.tableId || 'tbl-1',
                tableNumber: newRoom.tableNumber || sessData.roomAssignment?.tableNumber || 1,
                tableLabel: newRoom.tableLabel || newRoom.roomName,
                groupSize: newRoom.groupSize || sessData.roomAssignment?.groupSize || 1,
              };
              const sessHistory = [...(sessData.transferHistory || []), transferRecord];
              await updateDoc(sessRef, cleanData({
                roomAssignment: newAssignment,
                originalRoomAssignment: sessData.originalRoomAssignment || sessData.roomAssignment,
                transferredAt: now,
                transferReason: reason?.trim() || sessData.transferReason,
                transferHistory: sessHistory,
              }));
            }
          }
        } catch (syncErr) {
          console.warn('Could not sync active session during booking transfer:', syncErr);
        }
      }

      return transferRecord;
    } catch (error: any) {
      if (error.message === 'ROOM_OVERLAP' || error.message === 'SAME_ROOM' || error.message === 'CANNOT_TRANSFER_CLOSED_BOOKING') {
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

  subscribeToBookings(callback: (bookings: Booking[]) => void, limitCount = 100) {
    const q = query(
      collection(db, 'bookings'),
      orderBy('startTime', 'desc'),
      limit(limitCount)
    );
    
    return onSnapshot(q, (snapshot) => {
      const bookings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Booking[];
      // Keep chronological order in UI
      bookings.sort((a, b) => a.startTime - b.startTime);
      callback(bookings);
    }, (error) => {
      console.error("Error subscribing to bookings:", error);
    });
  },

  /**
   * On-demand date range fetch for historical or future bookings outside the active real-time window.
   */
  async getBookingsByDateRange(startMs: number, endMs: number): Promise<Booking[]> {
    try {
      const { recordFirestoreRead } = await import('../lib/firestore-metrics');
      const q = query(
        collection(db, 'bookings'),
        where('startTime', '>=', startMs),
        where('startTime', '<=', endMs)
      );
      const snapshot = await getDocs(q);
      recordFirestoreRead('getBookingsByDateRange', snapshot.size);
      const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Booking[];
      const { useWorkspaceStore } = await import('../store');
      useWorkspaceStore.getState().mergeBookings(bookings);
      return bookings;
    } catch (e) {
      console.warn('Error fetching bookings by date range:', e);
      return [];
    }
  }
};
