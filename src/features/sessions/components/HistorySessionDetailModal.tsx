import React from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, MessageCircle, FileText, Printer, Trash2, DoorOpen, Users, Sparkles, Crown, CreditCard, Banknote, ShieldCheck } from 'lucide-react';
import { formatCurrency, formatDuration, toMillis, formatPackageBalance } from '../../../lib/utils-workspace';
import { handleReprint } from '../utils/printReceipt';
import { useWorkspaceStore } from '../../../store';
import { cn } from '@/lib/utils';
import { Session } from '../../../types';

interface HistorySessionDetailModalProps {
  session: Session | null;
  isOpen: boolean;
  onClose: () => void;
  dateLocale: any;
  isOwner: boolean;
  onDelete: (id: string) => Promise<void>;
}

export const HistorySessionDetailModal = React.memo(function HistorySessionDetailModal({
  session,
  isOpen,
  onClose,
  dateLocale,
  isOwner,
  onDelete
}: HistorySessionDetailModalProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language.startsWith('ar');
  const customers = useWorkspaceStore(state => state.customers);

  if (!session) return null;

  const handlePrint = () => {
    handleReprint(session);
  };

  const handleDelete = () => {
    onDelete(session.id);
  };

  const linkedCustomer = customers?.find(c => 
    (session.customerId && c.id === session.customerId) ||
    (session.customerNumericId && Number(c.customerId) === Number(session.customerNumericId)) ||
    (session.phoneNumber && c.phone === session.phoneNumber.trim())
  );

  const custNumId = session.customerNumericId || linkedCustomer?.customerId;

  const isBooking = !!session.bookingId || session.pricingType === 'booking';
  const isPackage = session.isSubscribed && (session.deductedHours !== undefined || session.deductedMinutes !== undefined || session.remainingMinutes !== undefined);
  const isSubscriber = session.isSubscribed && !isPackage;
  const numPersons = session.numberOfPersons || session.roomAssignment?.groupSize || 1;
  const roomName = session.roomAssignment?.roomName;
  const tableLabel = session.roomAssignment?.tableLabel || (session.roomAssignment?.tableNumber ? `Table ${session.roomAssignment.tableNumber}` : undefined);

  const startMillis = toMillis(session.startTime || session.createdAt);
  const endMillis = session.endTime ? toMillis(session.endTime) : (session.completedAt ? toMillis(session.completedAt) : null);

  const paidAmt = session.paidAmount !== undefined ? session.paidAmount : (session.paymentStatus === 'unpaid' ? 0 : session.totalCost);
  const remAmt = session.remainingAmount !== undefined ? session.remainingAmount : Math.max(0, session.totalCost - paidAmt);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white max-w-lg rounded-[2.5rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">{t('sessions.details')}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-5 py-3">
          {/* Customer Header Card */}
          <div className="flex items-center gap-4 p-5 rounded-[2rem] bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg shrink-0",
              isBooking 
                ? "bg-indigo-600 text-white shadow-indigo-600/20"
                : isPackage
                  ? "bg-amber-500 text-white shadow-amber-500/20"
                  : isSubscriber
                    ? "bg-violet-600 text-white shadow-violet-600/20"
                    : "bg-cyan-500 text-white shadow-cyan-500/20"
            )}>
              {isBooking ? <DoorOpen className="w-7 h-7" /> : (session.userName?.[0]?.toUpperCase() || 'U')}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {custNumId && (
                  <span className="text-xs font-black text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-lg font-mono">
                    #{custNumId}
                  </span>
                )}
                <h3 className="text-xl font-black truncate">{session.userName}</h3>
                {session.whatsappOptIn !== false && (
                  <MessageCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                )}
              </div>
              <p className="text-sm text-slate-500 font-medium font-mono mt-0.5">{session.phoneNumber || '---'}</p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">
                {format(startMillis, 'MMMM do, yyyy', { locale: dateLocale })}
              </p>
            </div>

            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <Badge className="bg-emerald-500 text-white border-0 py-1 px-2.5 rounded-xl font-bold text-[10px]">
                {t('sessions.completed')}
              </Badge>
              {isBooking ? (
                <Badge className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-0 text-[10px]">
                  {isRTL ? 'حجز غرفة' : 'Room Booking'}
                </Badge>
              ) : isPackage ? (
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0 text-[10px]">
                  {isRTL ? 'باقة ساعات' : 'Package'}
                </Badge>
              ) : isSubscriber ? (
                <Badge className="bg-violet-500/15 text-violet-700 dark:text-violet-300 border-0 text-[10px]">
                  {t('sessions.subscriber')}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-slate-500">
                  {t('sessions.guest')}
                </Badge>
              )}
            </div>
          </div>

          {/* Room / Table / Persons info if available */}
          {(roomName || tableLabel || numPersons > 1) && (
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs">
              {roomName && (
                <div className="flex items-center gap-2">
                  <DoorOpen className="w-4 h-4 text-cyan-500 shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{t('common.rooms')}</p>
                    <p className="font-bold text-slate-700 dark:text-slate-200">{roomName}</p>
                  </div>
                </div>
              )}
              {tableLabel && (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-cyan-500">#</span>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{t('rooms.tables')}</p>
                    <p className="font-bold text-slate-700 dark:text-slate-200">{tableLabel}</p>
                  </div>
                </div>
              )}
              {numPersons > 1 && (
                <div className="flex items-center gap-2 col-span-2">
                  <Users className="w-4 h-4 text-cyan-500 shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{isRTL ? 'عدد الأفراد' : 'Persons Count'}</p>
                    <p className="font-bold text-cyan-600 dark:text-cyan-400">{numPersons} {isRTL ? 'أفراد (مضاعفة سعر الوقت)' : 'Persons'}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Package deduction details if applicable */}
          {isPackage && (session.deductedHours !== undefined || session.deductedMinutes !== undefined) && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1.5">
              <p className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>{isRTL ? 'خصم باقة الساعات' : 'Package Hours Deducted'}</span>
              </p>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>{isRTL ? 'الوقت المخصوم من الباقة:' : 'Deducted from package:'}</span>
                <span className="font-bold font-mono">
                  {formatPackageBalance(session.deductedMinutes !== undefined ? session.deductedMinutes : (session.deductedHours || 0) * 60)}
                </span>
              </div>
              {session.remainingMinutes !== undefined && (
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>{isRTL ? 'الرصيد المتبقي للباقة:' : 'Remaining package balance:'}</span>
                  <span className="font-bold font-mono text-amber-600 dark:text-amber-400">
                    {formatPackageBalance(session.remainingMinutes)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Time & Duration */}
          <div className="grid grid-cols-2 gap-4 px-2">
            <div className="space-y-1">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-cyan-500" /> {t('sessions.timeRange')}
              </p>
              <p className="text-base font-black font-mono">
                {format(startMillis, 'HH:mm')} - {endMillis ? format(endMillis, 'HH:mm') : '...'}
              </p>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{t('sessions.duration')}</p>
              <p className="text-base font-black font-mono">{formatDuration(session.duration || 0)}</p>
            </div>
          </div>

          {/* Pricing Breakdown */}
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-bold">{t('sessions.pricingType')}</span>
              <Badge variant="secondary" className="font-black bg-slate-100 dark:bg-slate-800 uppercase text-[10px]">
                {session.pricingType || (session.durationMode === 'fixed' ? `${session.selectedHours} Hours` : 'Hourly')}
              </Badge>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-bold">{t('sessions.timeCost')}</span>
              <span className="font-black text-slate-700 dark:text-slate-300 font-mono">{formatCurrency(session.timeCost || 0)}</span>
            </div>
            
            {session.services && session.services.length > 0 && (
              <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/30 p-3.5 rounded-2xl">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-bold">{t('sessions.servicesCost')}</span>
                  <span className="font-black text-slate-700 dark:text-slate-300 font-mono">{formatCurrency(session.servicesCost || 0)}</span>
                </div>
                <div className="space-y-1.5">
                  {session.services.map((s: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs font-medium">
                      <span className="text-slate-500">{s.name} <span className="text-[10px] opacity-70">x{s.quantity || 1}</span></span>
                      <span className="text-slate-600 dark:text-slate-400 font-mono">{formatCurrency((s.price || 0) * (s.quantity || 1))}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {session.discountAmount ? (
              <div className="flex justify-between items-center text-sm text-rose-500">
                <span className="font-bold">{isRTL ? `خصم (${session.discountPercentage || 0}%)` : `Discount (${session.discountPercentage || 0}%)`}</span>
                <span className="font-black font-mono">-{formatCurrency(session.discountAmount)}</span>
              </div>
            ) : null}

            {session.serviceDiscountTotal ? (
              <div className="flex justify-between items-center text-sm text-emerald-500">
                <span className="font-bold">{isRTL ? 'خصم الخدمات' : 'Services Discount'}</span>
                <span className="font-black font-mono">-{formatCurrency(session.serviceDiscountTotal)}</span>
              </div>
            ) : null}

            {/* Total, Paid, Due */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-lg font-black">{t('sessions.totalBill')}</span>
                <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{formatCurrency(session.totalCost)}</span>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-500 font-medium pt-1">
                <span>{isRTL ? 'طريقة الدفع:' : 'Payment Method:'}</span>
                <span className="font-bold uppercase flex items-center gap-1">
                  {session.paymentMethod === 'instapay' ? (
                    <>
                      <CreditCard className="w-3.5 h-3.5 text-cyan-500" />
                      <span>InstaPay</span>
                    </>
                  ) : (
                    <>
                      <Banknote className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Cash</span>
                    </>
                  )}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                <span>{isRTL ? 'المسدد / المحصل:' : 'Paid Amount:'}</span>
                <span className="font-bold font-mono text-emerald-600">{formatCurrency(paidAmt)}</span>
              </div>

              {remAmt > 0 && (
                <div className="flex justify-between items-center text-xs text-rose-500 font-medium">
                  <span>{isRTL ? 'المتبقي المستحق:' : 'Remaining Due:'}</span>
                  <span className="font-bold font-mono">{formatCurrency(remAmt)}</span>
                </div>
              )}
            </div>
          </div>

          {session.notes && (
            <div className="space-y-1.5 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
              <p className="text-[10px] text-amber-600 uppercase font-black tracking-widest flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> {t('sessions.staffNotes')}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300 italic font-medium leading-relaxed">
                "{session.notes}"
              </p>
            </div>
          )}
        </div>

        <div className="pt-4 flex gap-3">
          <Button
            variant="outline"
            className="h-14 px-5 rounded-2xl border-cyan-500/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/50 transition-all active:scale-95 flex items-center gap-2 font-bold cursor-pointer"
            onClick={handlePrint}
          >
            <Printer className="w-5 h-5" />
            {t('common.print')}
          </Button>

          <Button 
            className="flex-1 bg-slate-900 border-0 hover:bg-slate-800 text-white h-14 rounded-2xl font-black text-lg shadow-xl shadow-slate-950/25 active:scale-95 transition-all cursor-pointer"
            onClick={onClose}
          >
            {t('sessions.close')}
          </Button>

          {isOwner && (
            <Button 
              variant="destructive"
              className="h-14 px-5 rounded-2xl bg-rose-500 border-0 hover:bg-rose-600 text-white font-black shadow-xl shadow-rose-500/20 active:scale-95 transition-all cursor-pointer"
              onClick={handleDelete}
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});
