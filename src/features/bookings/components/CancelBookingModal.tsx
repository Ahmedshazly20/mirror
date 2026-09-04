import React, { useState } from 'react';
import { 
  XCircle, 
  AlertTriangle, 
  DollarSign, 
  Trash2, 
  Ban,
  Check
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Booking, Room } from '../../../types';
import { bookingService } from '../../../services/bookingService';
import { toast } from 'sonner';

interface CancelBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  room?: Room;
}

export function CancelBookingModal({
  isOpen,
  onClose,
  booking,
  room
}: CancelBookingModalProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language.startsWith('ar');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!booking) return null;

  const deposit = booking.paidAmount || 0;
  const isBeforeStart = booking.startTime > Date.now();

  const handleConfirmCancel = async () => {
    setIsLoading(true);
    try {
      await bookingService.cancelBooking(booking.id, reason.trim() || undefined);
      toast.success(
        deposit > 0 
          ? (isRTL ? `تم إلغاء الحجز واحتساب العربون (${deposit} ج.م) كـ ضائع/ملغي واستبعاده من الإيرادات` : `Booking cancelled. Deposit of ${deposit} EGP marked as cancelled/lost and removed from revenue.`)
          : (isRTL ? 'تم إلغاء الحجز بنجاح' : 'Booking cancelled successfully')
      );
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(isRTL ? 'فشل إلغاء الحجز' : 'Failed to cancel booking');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="text-lg font-black text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <XCircle className="w-5 h-5" />
            <span>{isRTL ? 'إلغاء حجز الغرفة' : 'Cancel Room Booking'}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {isRTL 
              ? `إلغاء حجز ${room?.name || 'الغرفة'} للعميل ${booking.userName}` 
              : `Cancel reservation for ${booking.userName} in ${room?.name || 'Room'}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* Deposit forfeiture warning */}
          {deposit > 0 ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{isRTL ? 'سياسة العربون عند الإلغاء:' : 'Cancellation Deposit Policy:'}</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {isRTL 
                  ? `قام العميل بسداد عربون بقيمة `
                  : `Customer paid a deposit of `}
                <strong className="text-rose-600 font-black">{deposit} {isRTL ? 'ج.م' : 'EGP'}</strong>.
                {isRTL 
                  ? ` عند الإلغاء، يضيع العربون على العميل وفقاً للنظام، وسيتم إزالة المبلغ من تقرير إيرادات العمليات النشطة.`
                  : ` Upon cancellation, the deposit is recorded as lost/cancelled and deducted from active revenue.`}
              </p>
            </div>
          ) : (
            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-xs text-slate-600 dark:text-slate-400">
              {isRTL 
                ? 'لم يتم دفع أي عربون مسبق لهذا الحجز. سيتم إلغاء الحجز وإتاحة الغرفة فوراً.' 
                : 'No deposit was paid for this booking. The room will be released immediately.'}
            </div>
          )}

          {/* Reason input */}
          <div className="space-y-1.5 text-left">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {isRTL ? 'سبب الإلغاء (اختياري)' : 'Cancellation Reason (Optional)'}
            </Label>
            <Input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={isRTL ? 'مثال: اعتذار العميل، ظرف طارئ...' : 'e.g., Customer requested cancellation...'}
              className="h-10 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 font-medium"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-10 rounded-xl font-bold text-xs"
            >
              {isRTL ? 'تراجع' : 'Keep Booking'}
            </Button>
            <Button
              type="button"
              onClick={handleConfirmCancel}
              disabled={isLoading}
              className="flex-1 h-10 rounded-xl font-bold text-xs bg-rose-500 hover:bg-rose-600 text-white"
            >
              {isLoading ? (isRTL ? 'جاري الإلغاء...' : 'Cancelling...') : (isRTL ? 'تأكيد الإلغاء' : 'Confirm Cancel')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
