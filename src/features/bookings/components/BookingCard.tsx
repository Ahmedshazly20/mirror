import React, { useState } from 'react';
import { 
  DoorOpen, 
  User, 
  Phone, 
  Trash2, 
  CalendarDays, 
  Clock, 
  Wallet, 
  CheckCircle2, 
  AlertCircle,
  Edit,
  Ban,
  Radio
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Booking, Room } from '../../../types';

interface BookingCardProps {
  booking: Booking;
  room?: Room;
  onDelete: (id: string) => void;
  onCancel?: (booking: Booking) => void;
  onEdit?: (booking: Booking) => void;
  onStartSession?: (booking: Booking, room?: Room) => void;
  showDelete: boolean;
}

export const BookingCard = React.memo(function BookingCard({ 
  booking, 
  room, 
  onDelete,
  onCancel,
  onEdit,
  onStartSession,
  showDelete
}: BookingCardProps) {
  const { t, i18n } = useTranslation();
  const [isConfirming, setIsConfirming] = useState(false);
  const isRTL = i18n.language.startsWith('ar');
  const dateLocale = isRTL ? arSA : enUS;

  const now = Date.now();
  const isPastStart = booking.startTime <= now;
  const isCancelled = booking.status === 'cancelled';
  const isActive = booking.status === 'active';
  const isCompleted = booking.status === 'completed';

  const bookingDate = new Date(booking.startTime);
  const formattedDateStr = isNaN(bookingDate.getTime()) ? '---' : format(bookingDate, 'PP', { locale: dateLocale });
  const formattedStartStr = isNaN(bookingDate.getTime()) ? '---' : format(bookingDate, 'HH:mm');
  const formattedEndStr = isNaN(new Date(booking.endTime).getTime()) ? '---' : format(new Date(booking.endTime), 'HH:mm');

  const handleDeleteClick = React.useCallback(() => {
    setIsConfirming(true);
  }, []);

  return (
    <Card className={cn(
      "relative bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 overflow-hidden group hover:shadow-md hover:border-slate-350 dark:hover:border-slate-700 transition-all duration-300 rounded-3xl",
      isCancelled && "opacity-60 bg-slate-50 dark:bg-slate-950 border-dashed border-rose-300 dark:border-rose-900/40"
    )}>
      {/* Top accent border based on status */}
      <div className={cn(
        "h-1.5",
        isCancelled ? "bg-rose-500" : (isActive ? "bg-emerald-500 animate-pulse" : (isPastStart ? "bg-amber-500" : "bg-cyan-500"))
      )} />
      
      {/* Delete Confirmation Overlay */}
      {isConfirming && (
        <div className="absolute inset-0 bg-white/95 dark:bg-slate-950/95 flex flex-col items-center justify-center p-4 text-center z-10 animate-in fade-in duration-200">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-full text-rose-500 mb-2">
            <Trash2 className="w-6 h-6 animate-pulse" />
          </div>
          <h4 className="font-extrabold text-[13px] text-slate-900 dark:text-white mb-1">
            {isRTL ? 'حذف الحجز بالكامل؟' : 'Delete Booking?'}
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 max-w-[220px] leading-relaxed">
            {isRTL 
              ? `سيتم إزالة الحجز${booking.paidAmount && booking.paidAmount > 0 ? ` واستبعاد العربون (${booking.paidAmount} ج.م) من الإيرادات` : ''}.`
              : `Booking will be removed${booking.paidAmount && booking.paidAmount > 0 ? ` and deposit of ${booking.paidAmount} EGP removed from revenue` : ''}.`}
          </p>
          <div className="flex gap-2 w-full max-w-[200px]">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 rounded-xl text-xs font-bold h-9 border-slate-200 dark:border-slate-850" 
              onClick={() => setIsConfirming(false)}
            >
              {isRTL ? 'إلغاء' : 'Back'}
            </Button>
            <Button 
              variant="destructive" 
              size="sm" 
              className="flex-1 rounded-xl text-xs font-bold h-9 text-white bg-rose-500 hover:bg-rose-600 border-none" 
              onClick={() => {
                onDelete(booking.id);
                setIsConfirming(false);
              }}
            >
              {isRTL ? 'حذف' : 'Delete'}
            </Button>
          </div>
        </div>
      )}

      <CardContent className="p-5">
        <div className="flex justify-between items-start gap-2 mb-3">
          <div className="space-y-1 col-span-1 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 leading-tight truncate">
                <DoorOpen className="w-4 h-4 text-cyan-500 shrink-0" />
                <span className="truncate">{room?.name || t('bookings.unknown')}</span>
              </h3>

              {/* Status Badge */}
              {isCancelled && (
                <Badge variant="outline" className="text-[10px] font-extrabold bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20">
                  {isRTL ? 'ملغي' : 'Cancelled'}
                </Badge>
              )}
              {isActive && (
                <Badge variant="outline" className="text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  {isRTL ? 'نشط الآن في الغرفة' : 'Active Room'}
                </Badge>
              )}
              {isCompleted && (
                <Badge variant="outline" className="text-[10px] font-extrabold bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20">
                  {isRTL ? 'مكتمل' : 'Completed'}
                </Badge>
              )}
              {!isCancelled && !isActive && !isCompleted && isPastStart && (
                <Badge variant="outline" className="text-[10px] font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                  {isRTL ? 'حان موعد البدء' : 'Ready to Start'}
                </Badge>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-450 shrink-0" />
              <span className="font-semibold truncate max-w-[150px]" title={booking.userName}>{booking.userName}</span>
            </p>
            <p className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-450 shrink-0" />
              <span>{booking.phoneNumber || '---'}</span>
            </p>
          </div>
          
          <div className="flex items-center gap-1">
            {/* Edit Button - Only permitted BEFORE start time and not cancelled */}
            {!isCancelled && onEdit && (
              <Button 
                variant="ghost" 
                size="icon" 
                disabled={isPastStart}
                onClick={() => onEdit(booking)}
                title={isPastStart ? (isRTL ? 'لا يمكن التعديل بعد موعد البداية' : 'Cannot edit after start time') : (isRTL ? 'تعديل موعد الحجز' : 'Edit Booking')}
                className={cn(
                  "text-slate-500 hover:text-cyan-600 hover:bg-cyan-500/10 dark:hover:bg-cyan-500/10 transition-all duration-200 w-8 h-8 rounded-xl shrink-0",
                  isPastStart && "opacity-30 cursor-not-allowed hover:bg-transparent hover:text-slate-500"
                )}
              >
                <Edit className="w-4 h-4" />
              </Button>
            )}

            {/* Cancel Button - Only permitted BEFORE start time and not cancelled */}
            {!isCancelled && !isActive && !isCompleted && onCancel && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => onCancel(booking)}
                title={isRTL ? 'إلغاء الحجز قبل البداية' : 'Cancel booking'}
                className="text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 dark:hover:bg-amber-500/10 transition-all duration-200 w-8 h-8 rounded-xl shrink-0"
              >
                <Ban className="w-4 h-4" />
              </Button>
            )}

            {/* Delete button (Owner only) */}
            {showDelete && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleDeleteClick}
                title={isRTL ? 'حذف الحجز' : 'Delete'}
                className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 dark:hover:bg-rose-500/10 transition-all duration-200 w-8 h-8 rounded-xl shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Cancellation Notice if cancelled */}
        {isCancelled && (
          <div className="my-2 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-700 dark:text-rose-300">
            <div className="font-bold flex items-center justify-between">
              <span>{isRTL ? 'تم إلغاء الحجز قبل البدء' : 'Booking Cancelled'}</span>
              {booking.lostDeposit ? (
                <span className="text-[10px] bg-rose-500/20 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded font-black">
                  {isRTL ? `عربون ضائع: ${booking.lostDeposit} ج.م` : `Lost Deposit: ${booking.lostDeposit} EGP`}
                </span>
              ) : null}
            </div>
            {booking.cancellationReason && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{booking.cancellationReason}</p>
            )}
          </div>
        )}

        <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{formattedDateStr}</span>
            </div>
            {booking.paidAmount !== undefined && (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-md",
                  isCancelled
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                    : booking.paidAmount >= booking.totalPrice && booking.totalPrice > 0
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : booking.paidAmount > 0
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                )}
              >
                {isCancelled
                  ? (isRTL ? 'عربون ملغي/ضائع' : 'Lost Deposit')
                  : booking.paidAmount >= booking.totalPrice && booking.totalPrice > 0
                  ? (isRTL ? 'مدفوع بالكامل' : 'Paid')
                  : booking.paidAmount > 0
                  ? (isRTL ? `عربون: ${booking.paidAmount}` : `Deposit: ${booking.paidAmount}`)
                  : (isRTL ? 'غير مسدد' : 'Unpaid')}
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-semibold">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{formattedStartStr} - {formattedEndStr}</span>
            </div>
            <div className="text-right flex flex-col items-end">
              <span className="font-black text-slate-900 dark:text-white">
                {booking.totalPrice} {t('common.currency')}
              </span>
              {!isCancelled && booking.paidAmount !== undefined && booking.paidAmount > 0 && booking.paidAmount < booking.totalPrice && (
                <span className="text-[10px] font-bold text-amber-500">
                  {isRTL ? `المتبقي: ${booking.totalPrice - booking.paidAmount}` : `Due: ${booking.totalPrice - booking.paidAmount}`} {t('common.currency')}
                </span>
              )}
            </div>
          </div>

          {/* Quick Start Room button if not started/cancelled */}
          {!isCancelled && !isActive && !isCompleted && onStartSession && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                size="sm"
                onClick={() => onStartSession(booking, room)}
                className="w-full h-8 rounded-xl font-bold text-xs bg-cyan-500/10 hover:bg-cyan-500 hover:text-white text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 transition-all flex items-center justify-center gap-1.5"
              >
                <DoorOpen className="w-3.5 h-3.5" />
                <span>{isRTL ? 'بدء الجلسة في الغرفة الآن' : 'Start Room Session Now'}</span>
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
