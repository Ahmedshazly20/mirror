import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Booking, Session } from '../types';
import { toMillis } from '../lib/utils-workspace';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';

export interface RoomConflictInfo {
  hasConflict: boolean;
  conflictType?: 'booking' | 'active_session';
  conflictSourceId?: string;
  userName?: string;
  startTime?: number;
  endTime?: number;
  roomName?: string;
  errorMessage?: string;
}

/**
 * Calculates the active/projected time window [start, end] for a session.
 */
export function getSessionTimeRange(session: Session, linkedBooking?: Booking | null): { start: number; end: number } {
  const start = session.startTime ? toMillis(session.startTime) : Date.now();
  
  if (session.endTime) {
    const end = toMillis(session.endTime);
    if (end > start) return { start, end };
  }

  if (linkedBooking && linkedBooking.endTime && linkedBooking.endTime > start) {
    return { start, end: linkedBooking.endTime };
  }

  if (session.durationMode === 'fixed' && session.selectedHours && session.selectedHours > 0) {
    return { start, end: start + session.selectedHours * 3600 * 1000 };
  }

  if (session.durationMode === 'full_day') {
    return { start, end: start + 8 * 3600 * 1000 };
  }

  // Open-ended / default active session: occupied now until at least 1 hour or projected current time
  const minOngoingEnd = Math.max(Date.now() + 30 * 60 * 1000, start + 60 * 60 * 1000);
  return { start, end: minOngoingEnd };
}

/**
 * Checks if two time intervals [startA, endA] and [startB, endB] overlap.
 * Strictly: startA < endB && endA > startB
 * Adjacent intervals (e.g. 10:00-14:00 and 14:00-17:00) do NOT overlap.
 */
export function isTimeOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && endA > startB;
}

/**
 * Checks room conflict synchronously against in-memory lists of bookings & sessions.
 */
export function checkRoomConflictInMemory(
  roomId: string,
  startTime: number,
  endTime: number,
  allBookings: Booking[],
  allSessions: Session[],
  options?: {
    excludeBookingId?: string;
    excludeSessionId?: string;
    roomName?: string;
  }
): RoomConflictInfo {
  if (!roomId || startTime >= endTime) {
    return { hasConflict: false };
  }

  // 1. Check against active sessions for this specific room
  for (const session of allSessions) {
    if (!session || session.status !== 'active') continue;
    if (options?.excludeSessionId && session.id === options.excludeSessionId) continue;
    if (options?.excludeBookingId && session.bookingId === options.excludeBookingId) continue;

    const sessionRoomId = session.roomAssignment?.roomId;
    const sessionRoomName = session.roomAssignment?.roomName;

    const matchesRoom = (sessionRoomId && sessionRoomId === roomId) ||
      (options?.roomName && sessionRoomName && sessionRoomName.trim().toLowerCase() === options.roomName.trim().toLowerCase());

    if (!matchesRoom) continue;

    const linkedBooking = session.bookingId ? allBookings.find(b => b.id === session.bookingId) : null;
    const { start: sessionStart, end: sessionEnd } = getSessionTimeRange(session, linkedBooking);

    if (isTimeOverlap(startTime, endTime, sessionStart, sessionEnd)) {
      const startFmt = format(new Date(sessionStart), 'hh:mm a');
      const endFmt = format(new Date(sessionEnd), 'hh:mm a');
      const rName = session.roomAssignment?.roomName || options?.roomName || 'الغرفة';
      
      return {
        hasConflict: true,
        conflictType: 'active_session',
        conflictSourceId: session.id,
        userName: session.userName,
        startTime: sessionStart,
        endTime: sessionEnd,
        roomName: rName,
        errorMessage: `الغرفة (${rName}) قيد الاستخدام حالياً في جلسة نشطة لـ (${session.userName}) من ${startFmt} إلى ${endFmt}`
      };
    }
  }

  // 2. Check against other bookings for this specific room
  for (const booking of allBookings) {
    if (!booking || booking.status === 'cancelled') continue;
    if (options?.excludeBookingId && booking.id === options.excludeBookingId) continue;
    if (booking.roomId !== roomId) continue;

    if (isTimeOverlap(startTime, endTime, booking.startTime, booking.endTime)) {
      const startFmt = format(new Date(booking.startTime), 'hh:mm a');
      const endFmt = format(new Date(booking.endTime), 'hh:mm a');
      const rName = options?.roomName || 'الغرفة';

      return {
        hasConflict: true,
        conflictType: 'booking',
        conflictSourceId: booking.id,
        userName: booking.userName,
        startTime: booking.startTime,
        endTime: booking.endTime,
        roomName: rName,
        errorMessage: `تعارض في المواعيد: الغرفة (${rName}) محجوزة مسبقاً لـ (${booking.userName}) من ${startFmt} إلى ${endFmt}`
      };
    }
  }

  return { hasConflict: false };
}

/**
 * Checks room conflict asynchronously directly against Firestore.
 * Used inside server/service operations before creating bookings or sessions.
 */
export async function checkRoomConflictInFirestore(
  roomId: string,
  startTime: number,
  endTime: number,
  options?: {
    excludeBookingId?: string;
    excludeSessionId?: string;
    roomName?: string;
  }
): Promise<RoomConflictInfo> {
  if (!roomId || startTime >= endTime) {
    return { hasConflict: false };
  }

  try {
    // 1. Fetch bookings
    const bookingsRef = collection(db, 'bookings');
    const bookingsSnap = await getDocs(query(bookingsRef));
    const allBookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Booking[];

    // 2. Fetch active sessions
    const sessionsRef = collection(db, 'sessions');
    const sessionsSnap = await getDocs(query(sessionsRef, where('status', '==', 'active')));
    const allSessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Session[];

    return checkRoomConflictInMemory(roomId, startTime, endTime, allBookings, allSessions, options);
  } catch (error) {
    console.error('Error checking room conflict in Firestore:', error);
    return { hasConflict: false };
  }
}
