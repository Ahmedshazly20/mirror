import React, { useState, useEffect, useMemo } from 'react';
import { 
  CalendarDays, 
  Clock, 
  DoorOpen, 
  User, 
  Phone, 
  Check, 
  X, 
  AlertTriangle,
  Sparkles,
  DollarSign
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Booking, Room } from '../../../types';
import { pricingService, mapRoomToPricingKey } from '../../../services/pricingService';
import { bookingService } from '../../../services/bookingService';
import { toast } from 'sonner';

interface EditBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  rooms: Room[];
  allBookings: Booking[];
}

export function EditBookingModal({
  isOpen,
  onClose,
  booking,
  rooms,
  allBookings
}: EditBookingModalProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language.startsWith('ar');

  const [dateStr, setDateStr] = useState('');
  const [startTimeStr, setStartTimeStr] = useState('10:00');
  const [endTimeStr, setEndTimeStr] = useState('12:00');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (booking) {
      const startDate = new Date(booking.startTime);
      const endDate = new Date(booking.endTime);
      setDateStr(format(startDate, 'yyyy-MM-dd'));
      setStartTimeStr(format(startDate, 'HH:mm'));
      setEndTimeStr(format(endDate, 'HH:mm'));
      setSelectedRoomId(booking.roomId);
      setUserName(booking.userName);
      setPhoneNumber(booking.phoneNumber);
      setNotes(booking.notes || '');
    }
  }, [booking]);

  const selectedRoom = useMemo(() => {
    return rooms.find(r => r.id === selectedRoomId) || rooms[0];
  }, [rooms, selectedRoomId]);

  // Compute start and end timestamps
  const { startTimestamp, endTimestamp, durationHours, isPast, isTimeInvalid } = useMemo(() => {
    if (!dateStr || !startTimeStr || !endTimeStr) {
      return { startTimestamp: 0, endTimestamp: 0, durationHours: 0, isPast: false, isTimeInvalid: true };
    }
    const [year, month, day] = dateStr.split('-').map(Number);
    const [startH, startM] = startTimeStr.split(':').map(Number);
    const [endH, endM] = endTimeStr.split(':').map(Number);

    const start = new Date(year, month - 1, day, startH, startM, 0, 0).getTime();
    const end = new Date(year, month - 1, day, endH, endM, 0, 0).getTime();

    const diffMs = end - start;
    const hours = diffMs / (1000 * 60 * 60);

    return {
      startTimestamp: start,
      endTimestamp: end,
      durationHours: Math.max(0, hours),
      isPast: start <= Date.now(),
      isTimeInvalid: start >= end
    };
  }, [dateStr, startTimeStr, endTimeStr]);

  // Calculated updated price
  const calculatedPrice = useMemo(() => {
    if (!selectedRoom || durationHours <= 0) return 0;
    return pricingService.calculateRoomPrice(selectedRoom, durationHours);
  }, [selectedRoom, durationHours]);

  // Overlap check
  const conflict = useMemo(() => {
    if (!booking || !startTimestamp || !endTimestamp || isTimeInvalid) return null;
    return allBookings.find(b => 
      b.id !== booking.id &&
      b.roomId === selectedRoomId &&
      b.status !== 'cancelled' &&
      startTimestamp < b.endTime &&
      endTimestamp > b.startTime
    );
  }, [booking, allBookings, selectedRoomId, startTimestamp, endTimestamp, isTimeInvalid]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;

    if (booking.startTime <= Date.now()) {
      toast.error(isRTL ? 'لا يمكن تعديل الحجز بعد بدء موعده!' : 'Cannot modify a booking after its start time!');
      return;
    }

    if (isTimeInvalid) {
      toast.error(t('bookings.durationError'));
      return;
    }

    if (isPast) {
      toast.error(t('bookings.pastTimeError'));
      return;
    }

    if (conflict) {
      toast.error(t('bookings.roomReservedError'));
      return;
    }

    setIsLoading(true);
    try {
      const newPaid = booking.paidAmount || 0;
      const newRemaining = Math.max(0, calculatedPrice - newPaid);
      let newPaymentStatus = booking.paymentStatus;
      if (newPaid >= calculatedPrice && calculatedPrice > 0) {
        newPaymentStatus = 'paid';
      } else if (newPaid > 0) {
        newPaymentStatus = 'partially_paid';
      } else {
        newPaymentStatus = 'unpaid';
      }

      await bookingService.updateBooking(booking.id, {
        roomId: selectedRoomId,
        userName: userName.trim(),
        phoneNumber: phoneNumber.trim(),
        startTime: startTimestamp,
        endTime: endTimestamp,
        totalPrice: calculatedPrice,
        remainingAmount: newRemaining,
        paymentStatus: newPaymentStatus,
        notes: notes.trim(),
      });

      toast.success(isRTL ? 'تم تعديل موعد وبيانات الحجز بنجاح' : 'Booking modified successfully');
      onClose();
    } catch (err: any) {
      console.error(err);
      if (err.message === 'BOOKING_ALREADY_STARTED') {
        toast.error(isRTL ? 'عذراً، موعد الحجز بدأ بالفعل ولا يمكن تعديله' : 'Booking has already started and cannot be modified');
      } else if (err.conflictDetails || err.message === 'ROOM_OVERLAP' || err.message?.includes('تعارض')) {
        toast.error(err.message || t('bookings.roomReservedError'));
      } else {
        toast.error(err.message || (isRTL ? 'فشل تعديل الحجز' : 'Failed to update booking'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!booking) return null;

  const isAlreadyStarted = booking.startTime <= Date.now();

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-cyan-500" />
            <span>{isRTL ? 'تعديل موعد وبيانات الحجز' : 'Edit Booking Details'}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {isRTL ? 'مسموح بتعديل الموعد والغرفة قبل بداية الحجز فقط' : 'Modifications are allowed only before the booking start time'}
          </DialogDescription>
        </DialogHeader>

        {isAlreadyStarted ? (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3 my-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-600 dark:text-amber-400">
                {isRTL ? 'الحجز بدأ بالفعل' : 'Booking Has Started'}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {isRTL 
                  ? 'لا يمكن تعديل موعد أو تفاصيل الحجز بعد أن حان وقت البداية. يمكنك بدء الجلسة مباشرة أو إدارتها.'
                  : 'Cannot modify time or details after the booking start time has passed.'}
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 mt-2">
            {/* Room selection */}
            <div className="space-y-1.5 text-left">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isRTL ? 'الغرفة' : 'Room'}
              </Label>
              <select
                value={selectedRoomId}
                onChange={e => setSelectedRoomId(e.target.value)}
                className="w-full h-11 px-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.capacity} {isRTL ? 'أفراد' : 'cap'})
                  </option>
                ))}
              </select>
            </div>

            {/* Date & Times */}
            <div className="grid grid-cols-3 gap-2 text-left">
              <div className="space-y-1 col-span-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isRTL ? 'التاريخ' : 'Date'}
                </Label>
                <Input
                  type="date"
                  value={dateStr}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  onChange={e => setDateStr(e.target.value)}
                  className="h-10 text-xs rounded-xl font-semibold bg-slate-50 dark:bg-slate-800"
                  required
                />
              </div>
              <div className="space-y-1 col-span-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isRTL ? 'من' : 'From'}
                </Label>
                <Input
                  type="time"
                  value={startTimeStr}
                  onChange={e => setStartTimeStr(e.target.value)}
                  className="h-10 text-xs rounded-xl font-semibold bg-slate-50 dark:bg-slate-800"
                  required
                />
              </div>
              <div className="space-y-1 col-span-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isRTL ? 'إلى' : 'To'}
                </Label>
                <Input
                  type="time"
                  value={endTimeStr}
                  onChange={e => setEndTimeStr(e.target.value)}
                  className="h-10 text-xs rounded-xl font-semibold bg-slate-50 dark:bg-slate-800"
                  required
                />
              </div>
            </div>

            {/* Duration and Price Preview */}
            <div className="p-3 bg-cyan-500/5 dark:bg-cyan-500/10 border border-cyan-500/20 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isRTL ? `المدة: ${durationHours.toFixed(1)} ساعة` : `Duration: ${durationHours.toFixed(1)} hrs`}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 mr-1">{isRTL ? 'الإجمالي الجديد:' : 'New Total:'}</span>
                <span className="text-sm font-black text-cyan-600 dark:text-cyan-400">
                  {calculatedPrice} {isRTL ? 'ج.م' : 'EGP'}
                </span>
              </div>
            </div>

            {/* Conflict Alert */}
            {conflict && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{isRTL ? 'يوجد تعارض في الموعد مع حجز آخر لهذه الغرفة!' : 'Conflicting booking exists for this slot!'}</span>
              </div>
            )}

            {/* Customer Details */}
            <div className="grid grid-cols-2 gap-2 text-left">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isRTL ? 'اسم العميل' : 'Customer Name'}
                </Label>
                <Input
                  value={userName}
                  onChange={e => setUserName(e.target.value)}
                  className="h-10 text-xs rounded-xl font-semibold bg-slate-50 dark:bg-slate-800"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isRTL ? 'رقم الهاتف' : 'Phone'}
                </Label>
                <Input
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  className="h-10 text-xs rounded-xl font-semibold bg-slate-50 dark:bg-slate-800"
                  required
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1 h-10 rounded-xl font-bold text-xs"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                type="submit"
                disabled={isLoading || isTimeInvalid || isPast || !!conflict}
                className="flex-1 h-10 rounded-xl font-bold text-xs bg-cyan-500 hover:bg-cyan-600 text-white"
              >
                {isLoading ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ التعديلات' : 'Save Changes')}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
