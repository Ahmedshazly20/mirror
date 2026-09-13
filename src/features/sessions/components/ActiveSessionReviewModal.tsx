import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Receipt, Banknote, Sparkles, DoorOpen, CheckCircle2, Coffee, Clock, Percent, ShieldCheck } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useWorkspaceStore } from '../../../store';
import { formatCurrency, formatDuration, formatPackageBalance, getSubscriptionRemainingMinutes } from '../../../lib/utils-workspace';
import { printThermalReceipt } from '../utils/printReceipt';
import { sessionService } from '../../../services/sessionService';
import { paymentService } from '../../../services/paymentService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Session } from '../../../types';

interface ActiveSessionReviewModalProps {
  session: Session | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ActiveSessionReviewModal = React.memo(function ActiveSessionReviewModal({
  session,
  isOpen,
  onClose
}: ActiveSessionReviewModalProps) {
  const { t, i18n } = useTranslation();
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'instapay'>('cash');
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);
  const [paidInput, setPaidInput] = useState<string>('');

  const calculateSessionCost = useWorkspaceStore(state => state.calculateSessionCost);
  const subscriptions = useWorkspaceStore(state => state.subscriptions);
  const bookings = useWorkspaceStore(state => state.bookings);
  const user = useWorkspaceStore(state => state.user);

  const isRTL = i18n.language.startsWith('ar');

  // Role permissions: User/Staff max 10%, Admin/Owner max 50%
  const isOwnerOrAdmin = user?.role === 'owner' || (user as any)?.role === 'admin';
  const maxAllowedDiscount = isOwnerOrAdmin ? 50 : 10;

  // Check if session is a room booking
  const linkedBooking = session?.bookingId ? bookings.find(b => b.id === session.bookingId) : null;
  const isBookingSession = !!session?.bookingId || session?.pricingType === 'booking';

  // Base calculations
  const baseCostResult = session ? calculateSessionCost({
    ...session,
    endTime: { seconds: Date.now() / 1000, nanoseconds: 0 } as any,
    discountPercentage: 0,
    timeDiscount: 0
  }) : { total: 0, timeCost: 0, servicesCost: 0, duration: 0, type: 'hourly' as const, serviceDiscountTotal: 0, bookingDeposit: 0, bookingTotal: 0 };

  const { 
    timeCost, 
    servicesCost, 
    duration, 
    type, 
    serviceDiscountTotal,
    bookingDeposit: storeDeposit,
    bookingTotal: storeBookingTotal
  } = baseCostResult;

  const bookingDeposit = linkedBooking?.paidAmount ?? storeDeposit ?? (session?.paidAmount || 0);
  const effectiveTimeCost = isBookingSession 
    ? (linkedBooking?.totalPrice ?? storeBookingTotal ?? (session?.timeCost || timeCost))
    : timeCost;

  // Subtotal before invoice-level discount
  const subtotal = Math.max(0, effectiveTimeCost + servicesCost - (serviceDiscountTotal || 0));

  // Clamped discount percentage
  const clampedDiscountPercent = Math.min(maxAllowedDiscount, Math.max(0, discountPercentage));
  const discountAmount = Math.round((subtotal * clampedDiscountPercent) / 100);
  const grandTotal = Math.max(0, subtotal - discountAmount);
  const remainingDueToCollect = isBookingSession ? Math.max(0, grandTotal - bookingDeposit) : grandTotal;

  // Reset defaults when modal opens/closes
  useEffect(() => {
    if (isOpen && session) {
      setPaymentMethod('cash');
      setDiscountPercentage(0);
      if (isBookingSession) {
        const deposit = linkedBooking?.paidAmount ?? (session.paidAmount || 0);
        const due = Math.max(0, subtotal - deposit);
        setPaidInput(due.toString());
      } else {
        setPaidInput(subtotal.toString());
      }
    }
  }, [isOpen, session?.id, isBookingSession, subtotal]);

  // Update paidInput when discount changes if it was matching total
  const handleDiscountChange = (newPercent: number) => {
    const clamped = Math.min(maxAllowedDiscount, Math.max(0, newPercent));
    setDiscountPercentage(clamped);
    const newDiscountAmt = Math.round((subtotal * clamped) / 100);
    const newTotal = Math.max(0, subtotal - newDiscountAmt);
    const newDue = isBookingSession ? Math.max(0, newTotal - bookingDeposit) : newTotal;
    setPaidInput(newDue.toString());
  };

  if (!session) return null;

  // Calculate actual paid now and final balance
  const amountCollectedNow = paidInput === '' 
    ? (isBookingSession ? remainingDueToCollect : grandTotal) 
    : (parseFloat(paidInput) || 0);

  const totalPaid = isBookingSession ? (bookingDeposit + amountCollectedNow) : amountCollectedNow;
  const remainingBalance = Math.max(0, grandTotal - totalPaid);
  const paymentStatus = remainingBalance === 0 ? 'paid' : (totalPaid > 0 ? 'partially_paid' : 'unpaid');

  const sub = session.subscriptionId ? subscriptions.find(s => s.id === session.subscriptionId) : null;
  const isPackage = sub?.type === 'package';
  const durationMinutes = Math.round(duration);
  const remainingMinutesBefore = getSubscriptionRemainingMinutes(sub);

  const handleConfirmEndSession = async () => {
    if (discountPercentage > maxAllowedDiscount) {
      toast.error(isRTL 
        ? `الحد الأقصى للخصم المسموح به لرتبتك هو ${maxAllowedDiscount}%` 
        : `Maximum discount allowed for your role is ${maxAllowedDiscount}%`);
      return;
    }

    let deductedMinutes = 0;
    let deductedHours = 0;
    let newRemainingMins = 0;

    if (session.subscriptionId && sub?.type === 'package') {
      deductedMinutes = Math.round(duration);
      deductedHours = Number((deductedMinutes / 60).toFixed(2));
      const remMins = getSubscriptionRemainingMinutes(sub);
      if (remMins < deductedMinutes) {
        toast.warning(t('packages.insufficientHours') || 'رصيد الباقة أقل من وقت الجلسة', {
          description: `${t('packages.needed') || 'المطلوب'}: ${formatPackageBalance(deductedMinutes)}, ${t('packages.available') || 'المتاح'}: ${formatPackageBalance(remMins)}`
        });
      }
      newRemainingMins = Math.max(0, remMins - deductedMinutes);
    }

    try {
      await sessionService.endSession(session.id, {
        timeCost: effectiveTimeCost,
        servicesCost,
        serviceDiscountTotal,
        subtotal,
        discountPercentage: clampedDiscountPercent,
        discountAmount,
        totalCost: grandTotal,
        paidAmount: totalPaid,
        remainingAmount: remainingBalance,
        paymentStatus,
        duration: durationMinutes,
        pricingType: (isBookingSession ? 'booking' : type) as any,
        notes: session.notes || '',
        bookingId: session.bookingId || undefined,
        subscriptionId: session.subscriptionId || undefined,
        deductedMinutes: deductedMinutes || undefined,
        deductedHours: deductedHours || undefined,
        remainingMinutes: isPackage ? newRemainingMins : undefined,
        paymentMethod,
        timeDiscount: discountAmount
      });

      // Update customer spent and outstanding balance if linked
      if (session.customerId) {
        try {
          const { customerService } = await import('../../../services/customerService');
          const cust = await customerService.getCustomerById(session.customerId);
          if (cust) {
            const addedSpent = isBookingSession ? amountCollectedNow : totalPaid;
            const currentOutstanding = cust.outstandingBalance || 0;
            const newOutstanding = Math.max(0, currentOutstanding + remainingBalance);
            await customerService.updateCustomer(session.customerId, {
              totalSpent: (cust.totalSpent || 0) + addedSpent,
              outstandingBalance: newOutstanding
            });
          }
        } catch (custErr) {
          console.warn('Could not update customer spending summary:', custErr);
        }
      }

      // If user paid an amount now, record a payment in payments collection
      if (amountCollectedNow > 0) {
        try {
          await paymentService.addPayment({
            bookingId: session.bookingId || undefined,
            sessionId: session.id,
            customerId: session.customerId,
            amount: amountCollectedNow,
            paymentMethod,
            notes: isBookingSession
              ? `تحصيل متبقي حجز الغرفة (${session.roomAssignment?.roomName || 'الغرفة'}) والخدمات - العميل ${session.userName}`
              : `تحصيل جلسة - العميل ${session.userName}`,
            date: Date.now(),
            skipBookingPaidUpdate: true,
          });
        } catch (payErr) {
          console.warn('Could not add payment record for checkout:', payErr);
        }
      }

      // Fire off physical/virtual ticket printing receipt
      printThermalReceipt({
        userName: session.userName,
        phoneNumber: session.phoneNumber || '',
        roomName: session.roomAssignment?.roomName,
        tableNumber: session.roomAssignment?.tableLabel,
        startTime: session.startTime,
        endTime: Date.now(),
        duration: durationMinutes,
        timeCost: effectiveTimeCost,
        servicesCost,
        serviceDiscountTotal,
        subtotal,
        discountPercentage: clampedDiscountPercent,
        discountAmount,
        totalCost: grandTotal,
        paidAmount: totalPaid,
        remainingAmount: remainingBalance,
        services: session.services || [],
        isSubscribed: session.isSubscribed,
        notes: session.notes || '',
        remainingMinutes: isPackage ? newRemainingMins : undefined,
        remainingHours: isPackage ? Number((newRemainingMins / 60).toFixed(2)) : undefined,
        deductedMinutes: deductedMinutes || undefined,
        deductedHours: deductedHours || undefined,
        paymentMethod,
        timeDiscount: discountAmount,
        isBookingSession,
        bookingTotal: isBookingSession ? effectiveTimeCost : undefined,
        depositAmount: isBookingSession ? bookingDeposit : undefined,
        collectedNow: isBookingSession ? amountCollectedNow : undefined
      });

      toast.success(isRTL ? 'تم إنهاء الجلسة وإصدار الفاتورة بنجاح' : 'Session ended and invoice generated');
      onClose();
    } catch (err: any) {
      console.error('Error ending session:', err);
      toast.error(t('sessions.errorLoading'));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Receipt className="w-5 h-5 text-cyan-500" />
            {isBookingSession 
              ? (isRTL ? 'فاتورة إنهاء حجز الغرفة' : 'Room Booking Invoice & Checkout')
              : t('sessions.summary')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-3">
          {/* Customer and Room Summary Header */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{t('sessions.customer')}</p>
              <p className="text-base font-bold text-slate-900 dark:text-white truncate">{session.userName}</p>
              <p className="text-xs font-mono text-slate-500 mt-0.5">{session.phoneNumber || '—'}</p>
              <Badge variant="outline" className={cn(
                "mt-2 border-cyan-500/30 font-bold uppercase text-[9px] flex items-center gap-1 w-fit",
                isBookingSession 
                  ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30" 
                  : session.isSubscribed 
                    ? "bg-violet-500/10 text-violet-600" 
                    : "bg-cyan-500/10 text-cyan-600"
              )}>
                {isBookingSession ? (
                  <>
                    <DoorOpen className="w-3 h-3 text-indigo-500" />
                    <span>{isRTL ? 'حجز غرفة (سعر ثابت)' : 'Room Booking'}</span>
                  </>
                ) : session.isSubscribed ? (
                  isPackage ? t('subs.package') : t('sessions.subscriber')
                ) : (
                  t('sessions.guest')
                )}
              </Badge>
            </div>
            
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">
                  {isBookingSession ? (isRTL ? 'الغرفة والمكان' : 'Room & Space') : t('sessions.totalDuration')}
                </p>
                <p className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {session.roomAssignment?.roomName || (isRTL ? 'المساحة العامة' : 'Open Space')}
                </p>
                {session.roomAssignment?.tableLabel && (
                  <p className="text-xs text-slate-500 mt-0.5">{session.roomAssignment.tableLabel}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-1">
                <Clock className="w-3.5 h-3.5 text-cyan-500" />
                <span>{isRTL ? 'مدة التواجد: ' : 'Duration: '}{formatDuration(duration)}</span>
              </div>
            </div>
          </div>

          {/* ── Detailed Cost Breakdown ── */}
          <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {isRTL ? 'تفاصيل الحساب والمشتريات' : 'Bill Breakdown'}
            </p>

            {/* Room Booking Fixed Price or Time Cost */}
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-1.5">
                <DoorOpen className="w-4 h-4 text-indigo-500" />
                <span className="text-slate-700 dark:text-slate-300 font-semibold">
                  {isBookingSession 
                    ? (isRTL ? 'قيمة حجز الغرفة (سعر ثابت)' : 'Room Booking (Fixed Price)')
                    : `${t('sessions.timeCost')} (${isPackage ? t('subs.package') : type})`}
                </span>
              </div>
              <span className="font-bold text-slate-900 dark:text-white font-mono">
                {isPackage ? `${formatPackageBalance(durationMinutes)} (${isRTL ? 'خصم من الباقة' : 'Deducted from package'})` : formatCurrency(effectiveTimeCost)}
              </span>
            </div>

            {/* Services Cost & Items */}
            {session.services && session.services.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-1.5">
                    <Coffee className="w-4 h-4 text-amber-500" />
                    <span className="text-slate-700 dark:text-slate-300 font-semibold">{t('sessions.servicesCost')}</span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">{formatCurrency(servicesCost)}</span>
                </div>
                
                <div className={cn(isRTL ? "pr-5" : "pl-5", "space-y-1.5 bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800")}>
                  {session.services.map((s, i) => (
                    <div key={i} className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                      <span>{s.name} × {s.quantity}</span>
                      <span className="font-mono">{formatCurrency(s.price * s.quantity)}</span>
                    </div>
                  ))}
                </div>

                {serviceDiscountTotal > 0 && (
                  <div className="flex justify-between items-center text-xs text-emerald-600 font-bold bg-emerald-500/10 p-2 rounded-lg">
                    <span>{t('settings.globalDiscount')}</span>
                    <span>-{formatCurrency(serviceDiscountTotal)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Subtotal (الإجمالي قبل الخصم) */}
            <div className="flex justify-between items-center text-sm pt-3 border-t border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-400">
              <span>{isRTL ? 'المجموع الفرعي (Subtotal)' : 'Subtotal'}</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{formatCurrency(subtotal)}</span>
            </div>

            {/* Discount Section (الخصم) */}
            {discountAmount > 0 && (
              <div className="flex justify-between items-center text-sm bg-rose-500/10 text-rose-600 dark:text-rose-400 p-2.5 rounded-xl border border-rose-500/20 font-bold">
                <div className="flex items-center gap-1.5">
                  <Percent className="w-4 h-4" />
                  <span>{isRTL ? `قيمة الخصم (${clampedDiscountPercent}%)` : `Discount (${clampedDiscountPercent}%)`}</span>
                </div>
                <span className="font-mono">-{formatCurrency(discountAmount)}</span>
              </div>
            )}

            {/* Final Total (الإجمالي النهائي) */}
            <div className="flex justify-between items-center text-base pt-2 border-t border-slate-200 dark:border-slate-700 font-bold">
              <span className="text-slate-900 dark:text-white">{isRTL ? 'الإجمالي النهائي (Final Total)' : 'Final Total'}</span>
              <span className="text-slate-900 dark:text-white font-mono text-lg">{formatCurrency(grandTotal)}</span>
            </div>

            {/* Deposit / Paid Previously (For Booking) */}
            {isBookingSession && bookingDeposit > 0 && (
              <div className="flex justify-between items-center text-sm bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 font-semibold">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{isRTL ? 'المقدم / العربون المدفوع مسبقاً' : 'Prepaid Deposit'}</span>
                </div>
                <span className="font-mono font-bold">-{formatCurrency(bookingDeposit)}</span>
              </div>
            )}

            {/* Remaining Due to Collect */}
            {isBookingSession && (
              <div className="flex justify-between items-center text-sm bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 font-bold">
                <span>{isRTL ? 'المتبقي المطلوب تحصيله الآن:' : 'Net Due to Collect Now:'}</span>
                <span className="font-mono text-base">{formatCurrency(remainingDueToCollect)}</span>
              </div>
            )}
          </div>

          {/* ── Role-based Discount System ── */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                <Percent className="w-4 h-4 text-cyan-500" />
                <span>{isRTL ? 'نظام الخصم على الفاتورة' : 'Invoice Discount'}</span>
              </div>
              <Badge variant="secondary" className={cn(
                "text-[10px] font-bold flex items-center gap-1",
                isOwnerOrAdmin 
                  ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                  : "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20"
              )}>
                <ShieldCheck className="w-3 h-3" />
                <span>
                  {isOwnerOrAdmin 
                    ? (isRTL ? 'أقصى خصم لك: 50% (Admin/Owner)' : 'Max: 50% (Admin/Owner)')
                    : (isRTL ? 'أقصى خصم لك: 10% (Staff)' : 'Max: 10% (Staff)')}
                </span>
              </Badge>
            </div>

            {/* Quick Percentage Presets */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleDiscountChange(0)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                  discountPercentage === 0
                    ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                )}
              >
                0%
              </button>

              <button
                type="button"
                onClick={() => handleDiscountChange(5)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                  discountPercentage === 5
                    ? "bg-cyan-500 text-white border-cyan-500 shadow-sm"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-cyan-500/10"
                )}
              >
                5% ({Math.round(subtotal * 0.05)} EGP)
              </button>

              <button
                type="button"
                onClick={() => handleDiscountChange(10)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                  discountPercentage === 10
                    ? "bg-cyan-500 text-white border-cyan-500 shadow-sm"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-cyan-500/10"
                )}
              >
                10% ({Math.round(subtotal * 0.10)} EGP)
              </button>

              {isOwnerOrAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => handleDiscountChange(20)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                      discountPercentage === 20
                        ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-purple-500/10"
                    )}
                  >
                    20% ({Math.round(subtotal * 0.20)} EGP)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDiscountChange(30)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                      discountPercentage === 30
                        ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-purple-500/10"
                    )}
                  >
                    30% ({Math.round(subtotal * 0.30)} EGP)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDiscountChange(50)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border",
                      discountPercentage === 50
                        ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-purple-500/10"
                    )}
                  >
                    50% ({Math.round(subtotal * 0.50)} EGP)
                  </button>
                </>
              )}
            </div>

            {/* Custom Discount Input */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <Label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {isRTL ? "نسبة الخصم (%)" : "Discount %"}
                </Label>
                <div className="relative mt-1">
                  <Input
                    type="number"
                    min="0"
                    max={maxAllowedDiscount}
                    value={discountPercentage || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      handleDiscountChange(isNaN(val) ? 0 : val);
                    }}
                    placeholder="0"
                    className={cn(
                      "h-10 rounded-xl bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-sm font-bold font-mono",
                      discountPercentage > maxAllowedDiscount && "border-rose-500 text-rose-600"
                    )}
                    style={{ paddingInlineEnd: '2.5rem' }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    %
                  </span>
                </div>
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {isRTL ? "مبلغ الخصم الناتج (ج.م)" : "Discount Amount (EGP)"}
                </Label>
                <div className="h-10 mt-1 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center px-3 text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  -{formatCurrency(discountAmount)}
                </div>
              </div>
            </div>
          </div>

          {/* ── Payment Method ── */}
          <div className="space-y-1.5 text-left">
            <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {isRTL ? "طريقة الدفع" : "Payment Method"}
            </Label>
            <div className="flex gap-2 h-10">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={cn(
                  "flex-1 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer",
                  paymentMethod === 'cash'
                    ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white shadow-sm"
                    : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                )}
              >
                <Banknote className="w-4 h-4 text-emerald-500" />
                <span>{isRTL ? "كاش" : "Cash"}</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('instapay')}
                className={cn(
                  "flex-1 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer",
                  paymentMethod === 'instapay'
                    ? "bg-cyan-500 text-white border-cyan-500 shadow-lg shadow-cyan-500/20"
                    : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                )}
              >
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>InstaPay</span>
              </button>
            </div>
          </div>

          {/* ── Paid Amount Input & Final Status ── */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
            {/* Paid Amount Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isBookingSession 
                    ? (isRTL ? "المبلغ المدفوع الآن للتحصيل (ج.م)" : "Amount Collected Now (EGP)")
                    : (isRTL ? "المبلغ المدفوع الآن (ج.م)" : "Amount Paid Now (EGP)")}
                </Label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setPaidInput((isBookingSession ? remainingDueToCollect : grandTotal).toString())}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 cursor-pointer"
                  >
                    {isBookingSession 
                      ? (isRTL ? `المتبقي (${remainingDueToCollect})` : `Full Due (${remainingDueToCollect})`)
                      : (isRTL ? "الكل (100%)" : "Full (100%)")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const target = isBookingSession ? remainingDueToCollect : grandTotal;
                      setPaidInput((Math.round(target * 0.5)).toString());
                    }}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 cursor-pointer"
                  >
                    {isRTL ? "النصف (50%)" : "Half (50%)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaidInput('0')}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 cursor-pointer"
                  >
                    {isRTL ? "بدون دفع (0)" : "0"}
                  </button>
                </div>
              </div>

              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={paidInput}
                  onChange={(e) => setPaidInput(e.target.value)}
                  className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 font-bold text-base focus:border-cyan-500"
                  style={{ paddingInlineEnd: '3.5rem' }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  EGP
                </span>
              </div>
            </div>

            {/* Remaining Balance Display */}
            <div className={cn(
              "p-3.5 rounded-2xl border flex justify-between items-center transition-all",
              remainingBalance > 0
                ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
            )}>
              <div className="space-y-0.5">
                <span className="text-xs font-bold uppercase tracking-wider">
                  {remainingBalance > 0 
                    ? (isRTL ? "المبلغ المتبقي النهائي على العميل" : "Remaining Balance (Pending)") 
                    : (isRTL ? "حالة الحساب" : "Payment Status")}
                </span>
                <p className="text-[11px] opacity-80">
                  {remainingBalance > 0 
                    ? (isRTL ? "سيتم تسجيل المتبقي في سجل المعاملات" : "Will remain on ledger")
                    : (isRTL ? "تم تسديد كامل الفاتورة بنجاح ✓" : "Fully paid in full ✓")}
                </p>
              </div>
              <div className="text-right">
                <span className={cn(
                  "text-xl font-black font-mono",
                  remainingBalance > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                )}>
                  {remainingBalance > 0 ? formatCurrency(remainingBalance) : (isRTL ? 'خالص 0 ج.م' : '0 EGP')}
                </span>
              </div>
            </div>
          </div>

          {session.notes && (
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">{t('sessions.notes')}</Label>
              <p className="text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 italic">
                {session.notes}
              </p>
            </div>
          )}

          <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5">
            <Receipt className="w-3.5 h-3.5" />
            {t('sessions.autoPrintNote')}
          </p>
        </div>

        <DialogFooter className="gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
            {t('sessions.goBack')}
          </Button>
          <Button 
            onClick={handleConfirmEndSession} 
            disabled={discountPercentage > maxAllowedDiscount}
            className={cn(
              "bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-8 gap-2 shadow-lg shadow-emerald-500/20 font-bold",
              discountPercentage > maxAllowedDiscount && "opacity-50 cursor-not-allowed pointer-events-none"
            )}
          >
            <Receipt className="w-4 h-4" />
            {isBookingSession ? (isRTL ? 'إغلاق الغرفة وإصدار الفاتورة' : 'Close Room & Print Invoice') : t('sessions.confirmCheckout')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
