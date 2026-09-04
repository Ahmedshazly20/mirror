import React, { useState, useEffect } from 'react';
import { Timer, Coffee, CheckCircle2, MoreVertical, Trash2, Phone, Wifi, Clock, X, DoorOpen, Zap, PlusCircle, Calculator } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useWorkspaceStore } from '../../../store';
import { formatCurrency, formatDuration, toMillis } from '../../../lib/utils-workspace';
import { sessionService } from '../../../services/sessionService';
import { pricingService, DEFAULT_PRICING_TABLE } from '../../../services/pricingService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Session } from '../../../types';

interface ActiveSessionCardProps {
  session: Session;
  onEnd: (session: Session) => void;
  onAddService: (sessionId: string) => void;
  onRemoveService?: (sessionId: string, serviceIndex: number) => void;
  onDelete: (sessionId: string) => void;
}

export const ActiveSessionCard = React.memo(function ActiveSessionCard({ 
  session, 
  onEnd, 
  onAddService, 
  onRemoveService,
  onDelete 
}: ActiveSessionCardProps) {
  const { t, i18n } = useTranslation();
  const [elapsed, setElapsed] = useState(0);
  const [isExtendOpen, setIsExtendOpen] = useState(false);
  
  // High-performance Zustand selectors
  const calculateSessionCost = useWorkspaceStore(state => state.calculateSessionCost);
  const subscriptions = useWorkspaceStore(state => state.subscriptions);
  const settings = useWorkspaceStore(state => state.settings);
  const rooms = useWorkspaceStore(state => state.rooms);
  const user = useWorkspaceStore(state => state.user);

  const isRTL = i18n.language.startsWith('ar');
  const isOwner = user?.role === 'owner';

  useEffect(() => {
    // Keep local timer update contained to this card
    setElapsed(Date.now() - toMillis(session.startTime));
    
    const timer = setInterval(() => {
      setElapsed(Date.now() - toMillis(session.startTime));
    }, 1000);
    return () => clearInterval(timer);
  }, [session.startTime]);

  const minutes = Math.floor(elapsed / (1000 * 60));
  const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);
  
  // Multi-cost calculation
  const { total, subtotal, timeCost, type, serviceDiscountTotal, bookingDeposit, bookingTotal } = calculateSessionCost(session);
  const isSubscriber = type === 'subscription';
  const isBooking = type === 'booking' || !!session.bookingId;

  const sub = session.subscriptionId ? subscriptions.find(s => s.id === session.subscriptionId) : null;
  const isPackage = sub?.type === 'package';
  const neededHours = Math.ceil(minutes / 60);
  const isInsufficient = isPackage && sub && sub.remainingHours !== undefined && sub.remainingHours < neededHours;

  const activeRules = settings.pricingRules || DEFAULT_PRICING_TABLE;
  const activeRoom = (session.roomAssignment && rooms.find(r => r.id === session.roomAssignment?.roomId)) || 'shared_space';
  const mode = session.durationMode || (session.pricingType === 'daily' ? 'full_day' : 'open');
  const selectedHours = session.selectedHours || 4;

  const handleEndClick = React.useCallback(() => {
    onEnd(session);
  }, [onEnd, session]);

  const handleAddServiceClick = React.useCallback(() => {
    onAddService(session.id);
  }, [onAddService, session.id]);

  const handleDeleteClick = React.useCallback(() => {
    onDelete(session.id);
  }, [onDelete, session.id]);

  const handleNotesChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    sessionService.updateSessionNotes(session.id, e.target.value);
  }, [session.id]);

  const handleUpdateDuration = async (newMode: 'fixed' | 'full_day' | 'open', newHours?: number) => {
    try {
      await sessionService.updateSessionDuration(session.id, newMode, newHours);
      toast.success(isRTL ? 'تم تحديث مدة الجلسة وإعادة حساب السعر' : 'Session duration updated and price recalculated');
      setIsExtendOpen(false);
    } catch (e) {
      toast.error(isRTL ? 'حدث خطأ أثناء تحديث الجلسة' : 'Failed to update session');
    }
  };

  return (
    <Card className={cn(
      "bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_20px_rgba(0,0,0,0.3)] overflow-hidden rounded-2xl hover:shadow-[0_4px_20px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_4px_28px_rgba(0,0,0,0.4)] transition-shadow duration-200",
      isInsufficient && "ring-2 ring-rose-500 animate-pulse"
    )}>
      <CardContent className="p-0">

        {/* ── Header strip ── */}
        <div className={cn(
          "flex items-center justify-between px-4 py-3.5",
          isBooking
            ? "bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-cyan-500/10 border-b border-indigo-500/20"
            : isSubscriber 
              ? "bg-gradient-to-r from-violet-500/5 to-violet-500/10 border-b border-violet-500/15" 
              : "bg-gradient-to-r from-cyan-500/5 to-cyan-500/10 border-b border-cyan-500/15"
        )}>
          <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
            <div className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center font-bold text-base text-white shadow-sm",
              isBooking ? "bg-indigo-600" : isSubscriber ? "bg-violet-500" : "bg-cyan-500"
            )}>
              {session.userName?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{session.userName}</p>
              <div className={cn("flex items-center gap-1 text-[11px] text-slate-500 font-mono mt-0.5", isRTL && "flex-row-reverse")}>
                <Phone className="w-2.5 h-2.5" />
                {session.phoneNumber || '—'}
              </div>
            </div>
          </div>

          <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <span className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1",
              isBooking
                ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30"
                : isSubscriber 
                  ? "bg-violet-500/20 text-violet-600 dark:text-violet-400" 
                  : "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400"
            )}>
              {isBooking ? (
                <>
                  <DoorOpen className="w-3 h-3 text-indigo-500" />
                  <span>{isRTL ? 'حجز غرفة' : 'Room Booking'}</span>
                </>
              ) : isSubscriber ? (
                t('sessions.subscriber')
              ) : (
                t('sessions.guest')
              )}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800 rounded-lg transition-colors outline-none cursor-pointer">
                <MoreVertical className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <DropdownMenuItem onClick={handleAddServiceClick} className={cn("cursor-pointer", isRTL && "flex-row-reverse")}>
                  <Coffee className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} /> {t('sessions.addService')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleEndClick} className={cn("cursor-pointer text-rose-600 dark:text-rose-400", isRTL && "flex-row-reverse")}>
                  <CheckCircle2 className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} /> {t('sessions.checkout')}
                </DropdownMenuItem>
                {isOwner && (
                  <DropdownMenuItem onClick={handleDeleteClick} className={cn("cursor-pointer text-rose-600 dark:text-rose-400", isRTL && "flex-row-reverse")}>
                    <Trash2 className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} /> {t('common.delete')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── Timer + Bill row ── */}
        <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col items-center justify-center py-4 gap-1">
            <div className={cn("flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold text-slate-400", isRTL && "flex-row-reverse")}>
              <Clock className="w-3 h-3" />
              {isBooking ? (isRTL ? 'مدة التواجد' : 'Time in Room') : t('sessions.duration')}
            </div>
            <p className="text-2xl font-mono font-black text-slate-800 dark:text-white tabular-nums">
              {formatDuration(minutes)}
              <span className="text-sm font-mono text-slate-400">:{String(seconds).padStart(2, '0')}</span>
            </p>
          </div>
          <div className="flex flex-col items-center justify-center py-4 gap-1">
            <div className={cn("flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold text-slate-400", isRTL && "flex-row-reverse")}>
              <Wifi className="w-3 h-3 text-emerald-500 animate-pulse" />
              {isBooking ? (isRTL ? 'إجمالي الحساب' : 'Total Bill') : t('sessions.currentBill')}
            </div>
            <p className="text-2xl font-mono font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatCurrency(total)}
            </p>
          </div>
        </div>

        {/* ── Guest Duration & Extend Banner ── */}
        {!isBooking && !isSubscriber && (
          <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold">
              {mode === 'fixed' ? (
                <>
                  <Clock className="w-3.5 h-3.5 text-cyan-500" />
                  <span className="text-slate-700 dark:text-slate-300">
                    {isRTL ? `مدة محددة: ${selectedHours} ساعات` : `Fixed: ${selectedHours} Hours`}
                  </span>
                  <span className="font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded text-[11px]">
                    {timeCost} EGP
                  </span>
                </>
              ) : mode === 'full_day' ? (
                <>
                  <Zap className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-indigo-700 dark:text-indigo-300">
                    {isRTL ? 'يوم كامل (8 ساعات)' : 'Full Day (8h)'}
                  </span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded text-[11px]">
                    {timeCost} EGP
                  </span>
                </>
              ) : (
                <>
                  <Calculator className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-amber-700 dark:text-amber-300">
                    {isRTL ? 'جلسة مفتوحة' : 'Open Session'}
                  </span>
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-mono">
                    ({pricingService.getHourlyRate(activeRoom, activeRules)} EGP/h)
                  </span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsExtendOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] font-black text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 px-2.5 py-1 rounded-lg transition-colors cursor-pointer active:scale-95"
            >
              <PlusCircle className="w-3 h-3" />
              <span>{isRTL ? 'تمديد / تعديل' : 'Extend'}</span>
            </button>
          </div>
        )}

        {/* ── Booking Fixed Price Information Banner ── */}
        {isBooking && (
          <div className="px-4 py-2.5 bg-indigo-50/70 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/50 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 font-bold">
              <DoorOpen className="w-3.5 h-3.5" />
              <span>{isRTL ? 'حجز بسعر ثابت:' : 'Fixed Rate:'}</span>
              <span className="font-mono text-indigo-950 dark:text-indigo-100 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                {formatCurrency(bookingTotal || session.timeCost || 0)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-semibold">
              <span className="text-emerald-700 dark:text-emerald-400">
                {isRTL ? 'المقدم: ' : 'Paid: '}{formatCurrency(bookingDeposit || 0)}
              </span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="text-amber-700 dark:text-amber-400 font-bold">
                {isRTL ? 'المتبقي: ' : 'Due: '}{formatCurrency(Math.max(0, total - (bookingDeposit || 0)))}
              </span>
            </div>
          </div>
        )}

        {/* ── Bill summary if discount ── */}
        {serviceDiscountTotal > 0 && (
          <div className="px-4 py-2 bg-emerald-500/5 border-b border-emerald-500/10 flex justify-between items-center text-[11px]">
             <span className="text-emerald-600 font-bold">{t('settings.globalDiscount')}</span>
             <span className="text-emerald-600 font-bold">-{formatCurrency(serviceDiscountTotal)}</span>
          </div>
        )}

        {/* ── Package hours info ── */}
        {isPackage && sub && sub.remainingHours !== undefined && (
          <div className="px-4 py-3 bg-amber-500/5 border-b border-amber-500/10 space-y-2">
            <div className="flex justify-between items-center text-[11px]">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-500" />
                <span className="text-slate-500">{t('subs.remainingHours')}</span>
              </div>
              <span className={cn("font-bold", isInsufficient ? 'text-rose-500' : 'text-amber-600')}>
                {sub.remainingHours} {t('common.hours')}
              </span>
            </div>
            <Progress value={Math.max(0, (sub.remainingHours / (sub.totalHours || 1)) * 100)} className="h-1.5 bg-slate-200 dark:bg-slate-800" />
            {isInsufficient && (
              <p className="text-[10px] text-rose-500 font-bold text-center">⚠️ {t('packages.insufficientHours')}</p>
            )}
          </div>
        )}

        {/* ── Room info (if any) ── */}
        {session.roomAssignment && (
          <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500">
            <span className="font-medium text-slate-700 dark:text-slate-300">{session.roomAssignment.roomName}</span>
            {session.roomAssignment.tableLabel && (
              <>
                <span>·</span>
                <span>{session.roomAssignment.tableLabel}</span>
              </>
            )}
          </div>
        )}

        {/* ── Services badges ── */}
        {session.services && session.services.length > 0 && (
          <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1.5">{t('common.services')}</p>
            <div className={cn("flex flex-wrap gap-1.5", isRTL && "flex-row-reverse")}>
              {session.services.map((s, i) => (
                <span 
                  key={i} 
                  className="text-[11px] pl-2 pr-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium inline-flex items-center gap-1.5 group/badge shadow-2xs"
                >
                  <span>{s.name} ×{s.quantity}</span>
                  {onRemoveService && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(isRTL ? `هل تريد إلغاء "${s.name}" واسترجاع الكمية (${s.quantity}) للمخزون؟` : `Remove "${s.name}" and restore stock?`)) {
                          onRemoveService(session.id, i);
                        }
                      }}
                      className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition-all cursor-pointer"
                      title={isRTL ? 'إلغاء الطلب واسترجاع المخزون' : 'Remove & return to stock'}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Notes (compact inline) ── */}
        <div className="px-4 pt-3 pb-1">
          <Textarea 
            placeholder={t('sessions.addNotes')}
            defaultValue={session.notes || ''}
            onChange={handleNotesChange}
            rows={2}
            className={cn(
              "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 rounded-xl text-xs resize-none focus:ring-1 focus:ring-cyan-500/30 placeholder:text-slate-300 dark:placeholder:text-slate-600",
              isRTL ? "text-right" : "text-left"
            )}
          />
        </div>

        {/* ── Action footer ── */}
        <div className="px-4 py-3 space-y-2">
          {/* Primary — End Session */}
          <button
            onClick={handleEndClick}
            className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] transition-all duration-150 text-white font-semibold text-sm shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            {t('sessions.checkout')}
          </button>

          {/* Secondary — Add Order */}
          <button
            onClick={handleAddServiceClick}
            className="w-full h-9 flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] transition-all duration-150 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium text-xs cursor-pointer"
          >
            <Coffee className="w-3.5 h-3.5" />
            {t('sessions.addOrder')}
          </button>
        </div>

      </CardContent>

      {/* ── Extend / Modify Duration Dialog ── */}
      <Dialog open={isExtendOpen} onOpenChange={setIsExtendOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-500" />
              <span>{isRTL ? 'تمديد / تعديل مدة الجلسة' : 'Extend / Change Duration'}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="p-3.5 rounded-2xl bg-cyan-500/5 border border-cyan-500/15 flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400 font-medium">
                {isRTL ? 'العميل:' : 'Customer:'} <strong className="text-slate-900 dark:text-white font-bold">{session.userName}</strong>
              </span>
              <span className="text-cyan-700 dark:text-cyan-300 font-bold">
                {isRTL ? 'الوضع الحالي: ' : 'Current: '}
                {mode === 'fixed' ? `${selectedHours} ${isRTL ? 'ساعات' : 'h'}` : mode === 'full_day' ? (isRTL ? 'يوم كامل' : 'Full Day') : (isRTL ? 'مفتوح' : 'Open')}
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isRTL 
                ? 'اختر المدة الجديدة؛ يتم حساب السعر الإجمالي مباشرة من جدول الأسعار وفرق التمديد يُضاف للحساب:'
                : 'Select the new duration; the total price is recalculated directly from the pricing matrix:'}
            </p>

            {/* Hours Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((h) => {
                const targetPrice = pricingService.calculateSessionModeCost(activeRoom, 'fixed', h, h * 60, activeRules);
                const isCurrent = mode === 'fixed' && selectedHours === h;
                const diff = mode === 'fixed' ? targetPrice - timeCost : 0;

                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleUpdateDuration('fixed', h)}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1
                      ${isCurrent
                        ? 'bg-cyan-500 text-white border-cyan-500 shadow-md shadow-cyan-500/20'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-cyan-500/60 hover:bg-white dark:hover:bg-slate-800'
                      }`}
                  >
                    <span className="text-xs font-black">{h} {isRTL ? (h === 1 ? 'ساعة' : h === 2 ? 'ساعتان' : h <= 10 ? 'ساعات' : 'ساعة') : 'Hours'}</span>
                    <span className={`text-[11px] font-mono font-bold ${isCurrent ? 'text-cyan-100' : 'text-cyan-600 dark:text-cyan-400'}`}>
                      {targetPrice} EGP
                    </span>
                    {!isCurrent && mode === 'fixed' && diff !== 0 && (
                      <span className={`text-[9px] font-bold ${diff > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                        {diff > 0 ? `+${diff} EGP` : `${diff} EGP`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Other Modes */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleUpdateDuration('full_day')}
                className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1
                  ${mode === 'full_day'
                    ? 'bg-indigo-500 text-white border-indigo-500 shadow-md shadow-indigo-500/20'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-indigo-500/60'
                  }`}
              >
                <span className="text-xs font-black">{isRTL ? 'يوم كامل (8س)' : 'Full Day (8h)'}</span>
                <span className={`text-[11px] font-mono font-bold ${mode === 'full_day' ? 'text-indigo-100' : 'text-indigo-600 dark:text-indigo-400'}`}>
                  {pricingService.getFullDayPrice(activeRoom, activeRules)} EGP
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleUpdateDuration('open')}
                className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1
                  ${mode === 'open'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-amber-500/60'
                  }`}
              >
                <span className="text-xs font-black">{isRTL ? 'جلسة مفتوحة' : 'Open Session'}</span>
                <span className={`text-[11px] font-mono font-bold ${mode === 'open' ? 'text-amber-100' : 'text-amber-600 dark:text-amber-400'}`}>
                  {pricingService.getHourlyRate(activeRoom, activeRules)} EGP/h
                </span>
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
});
