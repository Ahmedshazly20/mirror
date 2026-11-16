import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeftRight,
  DoorOpen,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Clock,
  User,
  Sparkles
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Booking, Room, Session } from '../../../types';
import { useWorkspaceStore } from '../../../store';
import { bookingService } from '../../../services/bookingService';
import { sessionService } from '../../../services/sessionService';
import {
  checkRoomConflictInMemory,
  getSessionTimeRange,
  isSamePhysicalRoom
} from '../../../services/roomAvailabilityService';
import { toast } from 'sonner';

interface TransferRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'booking' | 'session';
  booking?: Booking | null;
  session?: Session | null;
  rooms: Room[];
}

export function TransferRoomModal({
  isOpen,
  onClose,
  mode,
  booking,
  session,
  rooms
}: TransferRoomModalProps) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language.startsWith('ar');
  const { bookings, sessions, subscriptions, user } = useWorkspaceStore();

  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedRoomId('');
      setReason('');
    }
  }, [isOpen, booking?.id, session?.id]);

  const targetCustomerName = mode === 'booking' ? booking?.userName : session?.userName;
  const currentRoomId = mode === 'booking' ? booking?.roomId : session?.roomAssignment?.roomId;
  const currentRoomObj = rooms.find(r => r.id === currentRoomId);
  const currentRoomName =
    (mode === 'booking'
      ? booking?.roomName || currentRoomObj?.name
      : session?.roomAssignment?.roomName || currentRoomObj?.name) ||
    (isRTL ? 'المساحة الحالية' : 'Current Room');

  const subscriptionId = mode === 'booking' ? booking?.subscriptionId : session?.subscriptionId;
  const linkedSub = subscriptionId ? subscriptions.find(s => s.id === subscriptionId) : null;

  const timeWindow = useMemo(() => {
    if (mode === 'booking' && booking) {
      return { start: booking.startTime, end: booking.endTime };
    }
    if (mode === 'session' && session) {
      const linkedBooking = session.bookingId
        ? bookings.find(b => b.id === session.bookingId)
        : null;
      return getSessionTimeRange(session, linkedBooking);
    }
    const now = Date.now();
    return { start: now, end: now + 3600 * 1000 };
  }, [mode, booking, session, bookings]);

  const activeRoomsList = useMemo(() => {
    return (rooms || []).filter(r => r.active !== false);
  }, [rooms]);

  const roomEvaluations = useMemo(() => {
    return activeRoomsList.map(room => {
      const isCurrent = isSamePhysicalRoom(
        { id: currentRoomId, name: currentRoomName },
        { id: room.id, name: room.name }
      );

      const conflict = isCurrent
        ? { hasConflict: false }
        : checkRoomConflictInMemory(
            room.id,
            timeWindow.start,
            timeWindow.end,
            bookings,
            sessions,
            {
              excludeBookingId: mode === 'booking' ? booking?.id : session?.bookingId,
              excludeSessionId: mode === 'session' ? session?.id : booking?.activeSessionId,
              roomName: room.name
            }
          );

      return {
        room,
        isCurrent,
        conflict
      };
    });
  }, [activeRoomsList, currentRoomId, currentRoomName, timeWindow, bookings, sessions, mode, booking, session]);

  const selectedRoomObj = rooms.find(r => r.id === selectedRoomId) || null;
  const isDiffersFromPackageRoom = Boolean(
    linkedSub?.roomId &&
      selectedRoomObj &&
      !isSamePhysicalRoom(
        { id: linkedSub.roomId, name: linkedSub.roomName },
        { id: selectedRoomObj.id, name: selectedRoomObj.name }
      )
  );

  const quickReasons = isRTL
    ? ['الغرفة الأصلية مشغولة', 'طلب وتفضيل العميل', 'صيانة / جاهزية الغرفة']
    : ['Original room occupied', 'Customer preference', 'Room maintenance'];

  const handleConfirmTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomObj || isSubmitting) return;

    const transferredBy = user?.name || user?.email || 'staff';
    setIsSubmitting(true);
    try {
      if (mode === 'booking' && booking) {
        await bookingService.transferBookingRoom(
          booking.id,
          {
            roomId: selectedRoomObj.id,
            roomName: selectedRoomObj.name,
            tableId: selectedRoomObj.tables?.[0]?.id || 'tbl-1',
            tableNumber: selectedRoomObj.tables?.[0]?.number || 1,
            tableLabel: selectedRoomObj.name,
            groupSize: selectedRoomObj.capacity || 1
          },
          reason,
          transferredBy
        );
      } else if (mode === 'session' && session) {
        await sessionService.transferSessionRoom(
          session.id,
          {
            roomId: selectedRoomObj.id,
            roomName: selectedRoomObj.name,
            tableId: selectedRoomObj.tables?.[0]?.id || 'tbl-1',
            tableNumber: selectedRoomObj.tables?.[0]?.number || 1,
            tableLabel: selectedRoomObj.name,
            groupSize: session.roomAssignment?.groupSize || selectedRoomObj.capacity || 1
          },
          reason,
          transferredBy
        );
      }

      toast.success(
        isRTL
          ? `تم النقل بنجاح من "${currentRoomName}" إلى "${selectedRoomObj.name}"`
          : `Transferred successfully from "${currentRoomName}" to "${selectedRoomObj.name}"`
      );
      onClose();
    } catch (err: any) {
      console.error('Transfer room error:', err);
      if (err.message === 'SAME_ROOM') {
        toast.error(isRTL ? 'تم اختيار نفس الغرفة الحالية' : 'Selected room is the same as current room');
      } else if (err.conflictDetails || err.message === 'ROOM_OVERLAP' || err.message?.includes('تعارض')) {
        toast.error(err.message || (isRTL ? 'الغرفة المختارة غير متاحة في هذا التوقيت' : 'Selected room has a schedule conflict'));
      } else {
        toast.error(err.message || (isRTL ? 'تعذر إتمام نقل الغرفة' : 'Failed to transfer room'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if ((mode === 'booking' && !booking) || (mode === 'session' && !session)) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-w-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1 text-right" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogTitle className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <span>{isRTL ? 'نقل إلى غرفة متاحة أخرى' : 'Transfer to Another Room'}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {isRTL
              ? 'اختر غرفة بديلة متاحة بنفس التوقيت والسعر دون التأثير على الباقة أو فرض رسوم جديدة'
              : 'Move to an available room keeping original price, deposit, and package configuration intact'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleConfirmTransfer} className="space-y-4 mt-2" dir={isRTL ? 'rtl' : 'ltr'}>
          {/* Current assignment summary */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
                <User className="w-3.5 h-3.5 text-cyan-500" />
                {targetCustomerName}
              </span>
              <Badge variant="outline" className="text-[10px] font-bold bg-white dark:bg-slate-900">
                {mode === 'booking' ? (isRTL ? 'حجز غرفة' : 'Booking') : (isRTL ? 'جلسة نشطة' : 'Active Session')}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1 font-semibold">
                <DoorOpen className="w-3.5 h-3.5 text-amber-500" />
                {isRTL ? 'الغرفة الحالية:' : 'Current Room:'} <strong className="text-slate-800 dark:text-white">{currentRoomName}</strong>
              </span>
              <span className="flex items-center gap-1 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {format(new Date(timeWindow.start), 'HH:mm')} - {format(new Date(timeWindow.end), 'HH:mm')}
              </span>
            </div>
          </div>

          {/* Room selection grid */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {isRTL ? 'اختر الغرفة البديلة المتاحة:' : 'Select Available Destination Room:'}
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
              {roomEvaluations.map(({ room, isCurrent, conflict }) => {
                const isDisabled = isCurrent || conflict.hasConflict;
                const isSelected = selectedRoomId === room.id;

                return (
                  <button
                    key={room.id}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={cn(
                      'p-3 rounded-2xl border-2 text-right transition-all flex flex-col gap-1.5',
                      isRTL ? 'text-right' : 'text-left',
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500 shadow-sm'
                        : isCurrent
                          ? 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed'
                          : conflict.hasConflict
                            ? 'bg-rose-500/5 border-rose-500/25 opacity-65 cursor-not-allowed'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-cyan-500/60 cursor-pointer'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {room.name}
                      </span>
                      {isCurrent ? (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                          {isRTL ? 'الحالية' : 'Current'}
                        </Badge>
                      ) : conflict.hasConflict ? (
                        <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-0 text-[9px] px-1.5 py-0">
                          {isRTL ? 'مشغولة' : 'Busy'}
                        </Badge>
                      ) : isSelected ? (
                        <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0" />
                      ) : (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0 text-[9px] px-1.5 py-0">
                          {isRTL ? 'متاحة' : 'Free'}
                        </Badge>
                      )}
                    </div>

                    <span className="text-[10px] text-slate-400">
                      {isRTL ? `السعة: ${room.capacity} أفراد` : `Capacity: ${room.capacity}`}
                    </span>

                    {conflict.hasConflict && conflict.userName && (
                      <span className="text-[10px] text-rose-500 truncate">
                        {isRTL ? `محجوزة لـ ${conflict.userName}` : `Occupied by ${conflict.userName}`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Package note if transferred room differs from package room */}
          {isDiffersFromPackageRoom && linkedSub && (
            <div className="p-3 rounded-2xl bg-violet-500/10 border border-violet-500/25 text-violet-700 dark:text-violet-300 text-[11px] flex items-start gap-2">
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-violet-500" />
              <span>
                {isRTL
                  ? `باقة العميل مرتبطة افتراضياً بـ "${linkedSub.roomName || 'الغرفة الأصلية'}". النقل مسموح وسيُسجل أن الجلسة استُخدمت في "${selectedRoomObj?.name}" دون تغيير بيانات الباقة.`
                  : `Customer's package is normally assigned to "${linkedSub.roomName}". Transfer is allowed and logs actual room used without altering the package.`}
              </span>
            </div>
          )}

          {/* Transfer reason */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {isRTL ? 'سبب النقل (اختياري):' : 'Transfer Reason (Optional):'}
            </Label>
            <Input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={isRTL ? 'مثال: الغرفة الأصلية مشغولة حالياً...' : 'e.g. Original room currently occupied...'}
              className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs"
            />
            <div className="flex flex-wrap gap-1.5">
              {quickReasons.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={cn(
                    'text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer',
                    reason === r
                      ? 'bg-cyan-500 text-white border-cyan-500'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-cyan-500/50'
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Financial protection guarantee notice */}
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] flex items-center gap-2 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              {isRTL
                ? 'يتم نقل الموعد بنفس السعر والعربون السابقين دون تحصيل أي رسوم إضافية.'
                : 'Room change preserves the original booking price, deposit, and package balance with zero extra fee.'}
            </span>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 h-10 rounded-xl font-bold text-xs"
            >
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              disabled={!selectedRoomObj || isSubmitting}
              className="flex-1 h-10 rounded-xl font-bold text-xs bg-cyan-500 hover:bg-cyan-600 text-white"
            >
              {isSubmitting
                ? (isRTL ? 'جاري النقل...' : 'Transferring...')
                : (isRTL ? 'تأكيد نقل الغرفة' : 'Confirm Room Transfer')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
