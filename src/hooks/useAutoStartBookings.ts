import { useEffect } from 'react';
import { useWorkspaceStore } from '../store';
import { sessionService } from '../services/sessionService';
import { SessionRoomAssignment } from '../types';
import { toast } from 'sonner';

// Module-level guard set to persist across re-renders and component mounts
const inFlightOrProcessedBookings = new Set<string>();

/**
 * Hook to automatically check upcoming and current bookings.
 * When a booking's startTime is reached (startTime <= Date.now() < endTime),
 * and the booking has not yet transitioned to an active session,
 * this hook auto-starts an Active Room Session for it.
 */
export function useAutoStartBookings() {
  const { bookings, rooms, customers, sessions } = useWorkspaceStore();

  useEffect(() => {
    let isMounted = true;

    const checkAndStartBookings = async () => {
      const now = Date.now();

      // Find bookings whose start time has arrived, not yet active, not completed, and not cancelled
      const dueBookings = bookings.filter(b => {
        // Skip cancelled, completed, or already marked active
        if (b.status === 'cancelled' || b.status === 'completed' || b.status === 'active' || b.activeSessionId) {
          return false;
        }

        // Also check if sessions already contains an active session with this bookingId or deterministic ID
        if (sessions.some(s => (s.bookingId === b.id || s.id === `booking_${b.id}` || s.id === b.activeSessionId) && s.status === 'active')) {
          return false;
        }

        // Start time reached and hasn't expired past end time by more than a reasonable buffer (e.g. 24h)
        const isTimeDue = b.startTime <= now && (b.endTime > now || now - b.endTime < 24 * 60 * 60 * 1000);
        return isTimeDue;
      });

      for (const booking of dueBookings) {
        if (inFlightOrProcessedBookings.has(booking.id)) {
          continue;
        }

        inFlightOrProcessedBookings.add(booking.id);

        try {
          // Double check with latest state in store
          const currentSessions = useWorkspaceStore.getState().sessions;
          if (currentSessions.some(s => (s.bookingId === booking.id || s.id === `booking_${booking.id}` || s.id === booking.activeSessionId) && s.status === 'active')) {
            continue;
          }

          const room = rooms.find(r => r.id === booking.roomId);
          const roomAssignment: SessionRoomAssignment = {
            roomId: booking.roomId,
            roomName: room?.name || 'غرفة محجوزة',
            tableId: room?.tables?.[0]?.id || 'tbl-1',
            tableNumber: room?.tables?.[0]?.number || 1,
            tableLabel: room?.name || 'غرفة محجوزة',
            groupSize: room?.capacity || 1,
          };

          // Find customer if exists
          const customer = customers.find(c => 
            c.id === booking.customerId || 
            c.phone === booking.phoneNumber ||
            c.name.trim().toLowerCase() === booking.userName.trim().toLowerCase()
          );

          const sessionId = await sessionService.startSession(
            booking.userName,
            booking.phoneNumber,
            'booking',
            false,
            true,
            roomAssignment,
            undefined,
            customer?.id || booking.customerId,
            booking.id,
            booking.totalPrice,
            booking.paidAmount
          );

          if (isMounted) {
            console.log(`[Auto-Start Booking] Successfully auto-started session ${sessionId} for booking ${booking.id} (${booking.userName})`);
            toast.info(`بدأ حجز ${room?.name || 'الغرفة'} تلقائيًا للعميل ${booking.userName}`, {
              duration: 4000
            });
          }
        } catch (err) {
          console.error(`[Auto-Start Booking] Error auto-starting booking ${booking.id}:`, err);
          inFlightOrProcessedBookings.delete(booking.id);
        }
      }
    };

    // Run check immediately
    checkAndStartBookings();

    // Check periodically every 15 seconds
    const interval = setInterval(checkAndStartBookings, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [bookings, rooms, customers, sessions]);
}
