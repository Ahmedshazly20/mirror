import {
  collection,
  addDoc,
  setDoc,
  getDoc,
  updateDoc,
  doc,
  query,
  where,
  getDocs,
  onSnapshot,
  limit,
  deleteDoc,
  FirestoreError,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Session } from '../types';
import { toMillis } from '../lib/utils-workspace';
import { cleanData } from '../lib/utils';
import { checkRoomConflictInFirestore } from './roomAvailabilityService';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface ReceiptData {
  sessionId: string;
  userName: string;
  phoneNumber: string;
  roomName?: string;
  tableLabel?: string;
  groupSize?: number;
  startTime: number;
  endTime: number;
  duration: number;
  pricingType: string;
  timeCost: number;
  services: { name: string; price: number; quantity: number }[];
  servicesCost: number;
  serviceDiscountTotal?: number;
  totalCost: number;
  notes?: string;
  printedAt: number;
}

// ── Debounce helper ────────────────────────────────────────────────────────────
// يجمع كل التعديلات اللي بتحصل خلال 800ms في write واحدة بدل write على كل حرف
function createDebouncer(ms = 800) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  return function debounce(key: string, fn: () => void) {
    if (timers.has(key)) clearTimeout(timers.get(key)!);
    timers.set(key, setTimeout(() => { fn(); timers.delete(key); }, ms));
  };
}

const notesDebounce = createDebouncer(800);

// In-flight start locks for bookings to prevent concurrent duplicate session creation
const inFlightBookingStarts = new Map<string, Promise<string>>();

// ── Service ───────────────────────────────────────────────────────────────────
export const sessionService = {

  async startSession(
    userName: string,
    phoneNumber: string,
    pricingType: Session['pricingType'],
    isSubscribed: boolean = false,
    whatsappOptIn: boolean = true,
    roomAssignment?: {
      roomId: string;
      roomName: string;
      tableId: string;
      tableNumber: number;
      tableLabel?: string;
      groupSize: number;
    } | null,
    subscriptionId?: string,
    existingCustomerId?: string,
    bookingId?: string,
    initialBookingPrice?: number,
    initialDeposit?: number,
    durationMode?: 'fixed' | 'full_day' | 'open',
    selectedHours?: number,
  ): Promise<string> {
    // If started from a booking and a start request is already processing, await and return it
    if (bookingId && inFlightBookingStarts.has(bookingId)) {
      return inFlightBookingStarts.get(bookingId)!;
    }

    const startPromise = (async () => {
      try {
        const deterministicSessionId = bookingId ? `booking_${bookingId}` : '';

        // If bookingId is provided, check if an active session already exists for this booking in Firestore
        if (bookingId) {
          try {
            // 1. Direct deterministic doc check
            const directDocRef = doc(db, 'sessions', deterministicSessionId);
            const directSnap = await getDoc(directDocRef);
            if (directSnap.exists()) {
              const existingData = directSnap.data() as Session;
              if (existingData.status === 'active') {
                console.log(`[sessionService] Deterministic active session already exists: ${deterministicSessionId}`);
                try {
                  await updateDoc(doc(db, 'bookings', bookingId), cleanData({
                    status: 'active',
                    activeSessionId: deterministicSessionId,
                  }));
                } catch (_) {}
                return deterministicSessionId;
              }
            }

            // 2. Query check for legacy or existing sessions with same bookingId
            const existingActiveQ = query(
              collection(db, 'sessions'),
              where('bookingId', '==', bookingId),
              where('status', '==', 'active')
            );
            const existingSnap = await getDocs(existingActiveQ);
            if (!existingSnap.empty) {
              const existingSessionId = existingSnap.docs[0].id;
              console.log(`[sessionService] Active session found for booking ${bookingId}: ${existingSessionId}`);
              
              // If multiple duplicate sessions exist in Firestore for this booking, clean up the duplicates
              if (existingSnap.docs.length > 1) {
                for (let i = 1; i < existingSnap.docs.length; i++) {
                  const dupDoc = existingSnap.docs[i];
                  try {
                    await deleteDoc(doc(db, 'sessions', dupDoc.id));
                  } catch (dupErr) {
                    console.warn('Could not delete duplicate active session:', dupErr);
                  }
                }
              }

              try {
                await updateDoc(doc(db, 'bookings', bookingId), cleanData({
                  status: 'active',
                  activeSessionId: existingSessionId,
                }));
              } catch (_) {}
              return existingSessionId;
            }
          } catch (checkErr) {
            console.warn('Could not query existing active sessions for booking:', checkErr);
          }
        }

        // Auto-register or update customer in customers collection
        let linkedCustomerId = existingCustomerId;
        try {
          const { customerService } = await import('./customerService');
          const customer = await customerService.findOrCreateCustomer(userName, phoneNumber);
          if (customer) {
            linkedCustomerId = customer.id;
          }
        } catch (custErr) {
          console.warn('Could not auto-register customer on session start:', custErr);
        }

        // Ensure roomAssignment fields are clean and defined if provided
        const normalizedRoomAssignment = roomAssignment
          ? {
              roomId: roomAssignment.roomId || '',
              roomName: roomAssignment.roomName || '',
              tableId: roomAssignment.tableId || '',
              tableNumber: roomAssignment.tableNumber || 0,
              tableLabel: roomAssignment.tableLabel || roomAssignment.roomName || '',
              groupSize: roomAssignment.groupSize || 1,
            }
          : null;

        // Check room conflict if room is specified and session is not created from a pre-confirmed booking
        if (normalizedRoomAssignment?.roomId && !bookingId) {
          const reqStart = Date.now();
          const durationHours = durationMode === 'fixed' && selectedHours ? selectedHours : (durationMode === 'full_day' ? 8 : 1);
          const reqEnd = reqStart + durationHours * 3600 * 1000;
          const conflict = await checkRoomConflictInFirestore(
            normalizedRoomAssignment.roomId,
            reqStart,
            reqEnd,
            { roomName: normalizedRoomAssignment.roomName }
          );

          if (conflict.hasConflict) {
            const err = new Error(conflict.errorMessage || 'ROOM_OVERLAP');
            (err as any).conflictDetails = conflict;
            throw err;
          }
        }

        const rawSessionData: Omit<Session, 'id'> = {
          userName: userName.trim(),
          phoneNumber: phoneNumber.trim(),
          customerId: linkedCustomerId || null,
          whatsappOptIn,
          startTime: Timestamp.now(),
          endTime: null,
          status: 'active',
          services: [],
          pricingType: bookingId ? 'booking' : pricingType,
          durationMode: bookingId ? undefined : durationMode,
          selectedHours: bookingId ? undefined : selectedHours,
          isSubscribed,
          subscriptionId: subscriptionId || null,
          bookingId: bookingId || null,
          timeCost: initialBookingPrice || 0,
          paidAmount: initialDeposit || 0,
          remainingAmount: Math.max(0, (initialBookingPrice || 0) - (initialDeposit || 0)),
          paymentStatus: (initialDeposit || 0) >= (initialBookingPrice || 0) && (initialBookingPrice || 0) > 0 ? 'paid' : ((initialDeposit || 0) > 0 ? 'partially_paid' : 'unpaid'),
          servicesCost: 0,
          serviceDiscountTotal: 0,
          totalCost: initialBookingPrice || 0,
          notes: '',
          createdAt: Timestamp.now(),
          roomAssignment: normalizedRoomAssignment,
        };

        const sessionData = cleanData(rawSessionData);
        let finalSessionId: string;

        if (bookingId) {
          const sessionDocRef = doc(db, 'sessions', deterministicSessionId);
          await setDoc(sessionDocRef, sessionData, { merge: true });
          finalSessionId = deterministicSessionId;
        } else {
          const docRef = await addDoc(collection(db, 'sessions'), sessionData);
          finalSessionId = docRef.id;
        }

        // If started from a booking, update booking status to 'active'
        if (bookingId) {
          try {
            await updateDoc(doc(db, 'bookings', bookingId), cleanData({
              status: 'active',
              activeSessionId: finalSessionId,
            }));
          } catch (e) {
            console.warn('Could not link booking to active session:', e);
          }
        }

        if (linkedCustomerId) {
          try {
            const { customerService } = await import('./customerService');
            await customerService.recordVisit({
              customerId: linkedCustomerId,
              customerName: userName.trim(),
              customerPhone: phoneNumber.trim(),
              type: 'session',
              referenceId: finalSessionId,
              notes: normalizedRoomAssignment ? `غرفة: ${normalizedRoomAssignment.roomName}` : '',
            });
          } catch (e) {
            console.warn('Error recording visit for session:', e);
          }
        }

        return finalSessionId;
      } catch (error) {
        this._handleFirebaseError(error, 'Start Session');
        throw error;
      } finally {
        if (bookingId) {
          inFlightBookingStarts.delete(bookingId);
        }
      }
    })();

    if (bookingId) {
      inFlightBookingStarts.set(bookingId, startPromise);
    }

    return startPromise;
  },

  async updateRoomAssignment(
    sessionId: string,
    roomAssignment: Session['roomAssignment'],
  ) {
    try {
      const normalizedAssignment = roomAssignment
        ? {
            roomId: roomAssignment.roomId || '',
            roomName: roomAssignment.roomName || '',
            tableId: roomAssignment.tableId || '',
            tableNumber: roomAssignment.tableNumber || 0,
            tableLabel: roomAssignment.tableLabel || roomAssignment.roomName || '',
            groupSize: roomAssignment.groupSize || 1,
          }
        : null;

      await updateDoc(doc(db, 'sessions', sessionId), {
        roomAssignment: normalizedAssignment ? cleanData(normalizedAssignment) : null,
      });
    } catch (error) {
      this._handleFirebaseError(error, 'Update Room Assignment');
      throw error;
    }
  },

  async updateSessionDuration(
    sessionId: string,
    durationMode: 'fixed' | 'full_day' | 'open',
    selectedHours?: number,
  ) {
    try {
      await updateDoc(doc(db, 'sessions', sessionId), cleanData({
        durationMode,
        selectedHours: durationMode === 'fixed' ? (selectedHours || 1) : null,
        pricingType: durationMode === 'full_day' ? 'daily' : 'hourly'
      }));
    } catch (error) {
      this._handleFirebaseError(error, 'Update Session Duration');
      throw error;
    }
  },

  async endSession(sessionId: string, finalData: Partial<Session>) {
    try {
      const dataToUpdate = cleanData({
        ...finalData,
        status: 'completed',
        endTime: Timestamp.now(),
      });
      await updateDoc(doc(db, 'sessions', sessionId), dataToUpdate);

      // If this session was linked to a booking, mark the booking as completed and sync paid amount
      if (finalData.bookingId) {
        try {
          await updateDoc(doc(db, 'bookings', finalData.bookingId), cleanData({
            status: 'completed',
            paidAmount: finalData.paidAmount,
            remainingAmount: finalData.remainingAmount,
            paymentStatus: finalData.paymentStatus
          }));
        } catch (e) {
          console.warn('Could not mark linked booking as completed:', e);
        }
      }

      if (finalData.subscriptionId && (finalData.deductedMinutes !== undefined || finalData.deductedHours !== undefined)) {
        const { subscriptionService } = await import('./subscriptionService');
        const minsToDeduct = finalData.deductedMinutes !== undefined 
          ? finalData.deductedMinutes 
          : Math.round((finalData.deductedHours || 0) * 60);
        if (minsToDeduct > 0) {
          await subscriptionService.deductMinutes(
            finalData.subscriptionId,
            minsToDeduct,
          );
        }
      }

      // Deduct inventory stock for services sold in session
      if (finalData.services && finalData.services.length > 0) {
        try {
          const { inventoryService } = await import('./inventoryService');
          await inventoryService.deductStockForServices(finalData.services, 'session', sessionId);
        } catch (e) {
          console.warn('Could not deduct inventory stock for session:', e);
        }
      }
    } catch (error) {
      this._handleFirebaseError(error, 'End Session');
      throw error;
    }
  },

  // ── Debounced notes ── كانت بترسل write على كل حرف → دلوقتي write واحدة بعد 800ms
  updateSessionNotes(sessionId: string, notes: string) {
    notesDebounce(sessionId, async () => {
      try {
        await updateDoc(doc(db, 'sessions', sessionId), cleanData({ notes }));
      } catch (error) {
        this._handleFirebaseError(error, 'Update Notes');
      }
    });
  },

  async deleteSession(sessionId: string, bookingId?: string) {
    try {
      await deleteDoc(doc(db, 'sessions', sessionId));
      if (bookingId) {
        try {
          await updateDoc(doc(db, 'bookings', bookingId), cleanData({
            status: 'confirmed',
            activeSessionId: null
          }));
        } catch (e) {
          console.warn('Could not reset booking status after deleting session:', e);
        }
      }
    } catch (error) {
      this._handleFirebaseError(error, 'Delete Session');
      throw error;
    }
  },

  // ── Services ── write واحدة بس بدل ما تحسب cost مرتين
  async addServiceToSession(
    sessionId: string,
    services: Session['services'],
    totalCost: number,
  ) {
    try {
      await updateDoc(doc(db, 'sessions', sessionId), cleanData({ services, totalCost }));
    } catch (error) {
      this._handleFirebaseError(error, 'Add Service');
      throw error;
    }
  },

  // ── Subscriptions ─────────────────────────────────────────────────────────────
  // الـ onSnapshot بيستخدم الـ offline cache أوتوماتيك بسبب الـ persistence
  // يعني أول load من IndexedDB (zero network reads) وبعدين sync التغييرات بس

  subscribeToActiveSessions(callback: (sessions: Session[]) => void) {
    const q = query(
      collection(db, 'sessions'),
      where('status', '==', 'active'),
    );
    return onSnapshot(
      q,
      { includeMetadataChanges: false },
      (snapshot) => {
        const rawActive = snapshot.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Session),
        );

        // Sort newest first
        rawActive.sort((a, b) => toMillis(b.startTime) - toMillis(a.startTime));

        // Deduplicate and detect ghost/duplicate documents in Firestore to purge them
        const seenDocIds = new Set<string>();
        const seenBookingIds = new Set<string>();
        const seenRoomKeys = new Set<string>();
        const cleanActive: Session[] = [];
        const duplicateDocIdsToDelete: string[] = [];

        for (const session of rawActive) {
          if (!session || !session.id || session.status !== 'active') {
            continue;
          }

          let isDuplicate = false;

          // 1. Direct ID duplicate
          if (seenDocIds.has(session.id)) {
            isDuplicate = true;
          }

          // 2. Booking ID duplicate (multiple sessions for same booking)
          if (!isDuplicate && session.bookingId) {
            if (seenBookingIds.has(session.bookingId)) {
              isDuplicate = true;
              duplicateDocIdsToDelete.push(session.id);
            } else {
              seenBookingIds.add(session.bookingId);
            }
          }

          // 3. Room active duplicate (same room, same customer/booking)
          if (!isDuplicate && session.roomAssignment?.roomId) {
            const roomKey = `${session.roomAssignment.roomId}_${session.bookingId || session.userName.trim().toLowerCase()}`;
            if (seenRoomKeys.has(roomKey)) {
              isDuplicate = true;
              duplicateDocIdsToDelete.push(session.id);
            } else {
              seenRoomKeys.add(roomKey);
            }
          }

          if (!isDuplicate) {
            seenDocIds.add(session.id);
            cleanActive.push(session);
          }
        }

        // Proactively clean up duplicate documents from Firestore in the background
        if (duplicateDocIdsToDelete.length > 0) {
          duplicateDocIdsToDelete.forEach(async (dupId) => {
            try {
              await deleteDoc(doc(db, 'sessions', dupId));
              console.log(`[sessionService] Purged duplicate active session from Firestore: ${dupId}`);
            } catch (err) {
              console.warn(`[sessionService] Failed to purge duplicate session ${dupId}:`, err);
            }
          });
        }

        callback(cleanActive);
      },
      (error) => console.error('🔴 Subscription Error (Active):', error),
    );
  },

  // limit(30) بدل (50) — في معظم الحالات مش محتاج أكتر من كده
  // الـ offline cache بيخلي الـ re-read من الـ cache مش من الـ network
  subscribeToRecentSessions(callback: (sessions: Session[]) => void) {
    const q = query(
      collection(db, 'sessions'),
      where('status', '==', 'completed'),
      limit(30),
    );
    return onSnapshot(
      q,
      { includeMetadataChanges: false },
      (snapshot) => {
        const completed = snapshot.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Session),
        );
        completed.sort((a, b) => {
          const aEnd = a.endTime ? toMillis(a.endTime) : 0;
          const bEnd = b.endTime ? toMillis(b.endTime) : 0;
          return bEnd - aEnd;
        });
        callback(completed);
      },
      (error) => console.error('🔴 Subscription Error (Recent):', error),
    );
  },

  // ── Print ─────────────────────────────────────────────────────────────────────
  async printReceipt(data: ReceiptData) {
    const formatTime = (ms: number) =>
      new Date(ms).toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    const formatDate = (ms: number) =>
      new Date(ms).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    const formatDur = (minutes: number) => {
      const h = Math.floor(minutes / 60);
      const m = Math.round(minutes % 60);
      return h > 0
        ? `${h} ساعة ${m > 0 ? `و ${m} دقيقة` : ''}`
        : `${m} دقيقة`;
    };

    const servicesRows = data.services
      .map(
        (s) => `
      <tr>
        <td>${s.name}</td>
        <td style="text-align:center">${s.quantity}</td>
        <td style="text-align:left">${(s.price * s.quantity).toFixed(2)} ج.م</td>
      </tr>`,
      )
      .join('');

    const roomInfo = data.roomName
      ? `<div class="row"><span>الغرفة:</span><span>${data.roomName}</span></div>
         ${data.tableLabel ? `<div class="row"><span>الترابيزة:</span><span>${data.tableLabel}</span></div>` : ''}
         ${data.groupSize ? `<div class="row"><span>عدد الأفراد:</span><span>${data.groupSize}</span></div>` : ''}`
      : '';

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8" />
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
          body { font-family: 'Cairo', sans-serif; width: 80mm; margin: 0; padding: 10px; font-size: 12px; }
          .center { text-align: center; }
          .logo { font-size: 22px; font-weight: 900; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; padding: 2px 0; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #eee; font-size: 10px; text-align: right; padding: 4px; }
          .total { font-size: 16px; font-weight: bold; margin-top: 10px; border-top: 2px solid #000; padding-top: 5px; }
        </style>
      </head>
      <body>
        <div class="center">
          <div class="logo">Operix</div>
          <div>فواتير مساحة العمل</div>
        </div>
        <div class="divider"></div>
        <div class="row"><span>التاريخ:</span><span>${formatDate(data.printedAt)}</span></div>
        <div class="row"><span>العميل:</span><strong>${data.userName}</strong></div>
        <div class="row"><span>الهاتف:</span><span dir="ltr">${data.phoneNumber}</span></div>
        ${roomInfo}
        <div class="divider"></div>
        <div class="row"><span>بدء:</span><span>${formatTime(data.startTime)}</span></div>
        <div class="row"><span>انتهاء:</span><span>${formatTime(data.endTime)}</span></div>
        <div class="row"><span>المدة:</span><span>${formatDur(data.duration)}</span></div>
        <div class="divider"></div>
        <div class="row"><span>تكلفة الوقت:</span><span>${data.timeCost.toFixed(2)} ج.م</span></div>
        ${
          data.services.length > 0
            ? `
          <table>
            <thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th></tr></thead>
            <tbody>${servicesRows}</tbody>
          </table>
          <div class="row"><span>تكلفة الخدمات:</span><span>${data.servicesCost.toFixed(2)} ج.م</span></div>
          ${data.serviceDiscountTotal ? `<div class="row" style="color:green"><span>خصم الخدمات:</span><span>-${data.serviceDiscountTotal.toFixed(2)} ج.م</span></div>` : ''}
        `
            : ''
        }
        <div class="row total"><span>الإجمالي:</span><span>${data.totalCost.toFixed(2)} ج.م</span></div>
        <div class="center" style="margin-top:20px">شكراً لزيارتكم!</div>
        <script>window.onload = () => { window.print(); window.close(); }</script>
      </body>
      </html>
    `;

    // Electron → IPC
    if ((window as any).electronAPI?.printReceipt) {
      try {
        await (window as any).electronAPI.printReceipt(html);
      } catch (err) {
        console.error('فشل الطباعة:', err);
      }
    } else {
      // Browser fallback
      const pw = window.open('', '_blank', 'width=400,height=600');
      pw?.document.write(html);
      pw?.document.close();
    }
  },

  _handleFirebaseError(error: any, action: string) {
    if (error && typeof error === 'object' && 'code' in error) {
      const ferr = error as FirestoreError;
      console.error(`❌ Firebase Error [${action}]:`, {
        code: ferr.code,
        message: ferr.message,
      });
      if (ferr.code === 'permission-denied') {
        console.warn('🛡️ تم رفض العملية بسبب قواعد الحماية.');
      }
    } else {
      console.error(`Unexpected Error [${action}]:`, error);
    }
  },
};
