import React from 'react';
import { Phone, Clock, Printer, ChevronRight, Package, Crown, Calendar, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDuration, toMillis } from '../../../lib/utils-workspace';
import { handleReprint } from '../utils/printReceipt';
import { cn } from '@/lib/utils';
import { Session } from '../../../types';
import { useWorkspaceStore } from '../../../store';

interface HistorySessionCardProps {
  session: Session;
  isRTL: boolean;
  onSelect: (session: Session) => void;
}

export const HistorySessionCard = React.memo(function HistorySessionCard({
  session,
  isRTL,
  onSelect
}: HistorySessionCardProps) {
  const { t } = useTranslation();
  const { subscriptions, packages } = useWorkspaceStore();

  const sub = session.subscriptionId ? subscriptions.find(s => s.id === session.subscriptionId) : null;
  const pkg = sub?.packageId ? packages.find(p => p.id === sub.packageId) : null;
  
  const isPackage = sub?.type === 'package' || !!session.deductedMinutes || !!session.deductedHours || ((session.pricingType as string) === 'package');
  const isMonthly = sub?.type === 'monthly' || session.pricingType === 'subscription' || ((session.pricingType as string) === 'monthly') || (!isPackage && Boolean(session.isSubscribed));
  const isBooking = Boolean(session.bookingId) || session.pricingType === 'booking';

  const handleCardClick = React.useCallback(() => {
    onSelect(session);
  }, [onSelect, session]);

  const handlePrintClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    handleReprint(session);
  }, [session]);

  const deductedTimeDisplay = React.useMemo(() => {
    if (session.deductedMinutes) {
      const h = Math.floor(session.deductedMinutes / 60);
      const m = Math.round(session.deductedMinutes % 60);
      if (h > 0 && m > 0) return `${h}س ${m}د`;
      if (h > 0) return `${h}ساعة`;
      return `${m}دقيقة`;
    }
    if (session.deductedHours) {
      return `${session.deductedHours}س`;
    }
    return null;
  }, [session.deductedMinutes, session.deductedHours]);

  return (
    <Card 
      className={cn(
        "bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 transition-all cursor-pointer group rounded-3xl overflow-hidden shadow-sm hover:shadow-md",
        isPackage 
          ? "hover:border-purple-500/40" 
          : isMonthly 
            ? "hover:border-indigo-500/40" 
            : isBooking 
              ? "hover:border-cyan-500/40" 
              : "hover:border-slate-400"
      )}
      onClick={handleCardClick}
    >
      <CardContent className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-4 sm:gap-5 min-w-0">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 shadow-inner",
            isPackage 
              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400" 
              : isMonthly 
                ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" 
                : isBooking 
                  ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" 
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          )}>
            {isPackage ? (
              <Package className="w-5 h-5" />
            ) : isMonthly ? (
              <Crown className="w-5 h-5" />
            ) : isBooking ? (
              <Calendar className="w-5 h-5" />
            ) : (
              session.userName?.[0] || 'U'
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg truncate">{session.userName}</h4>
              
              {/* Distinct Badge for Package / Monthly / Booking / Guest */}
              {isPackage ? (
                <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 text-[10px] py-0 px-2 h-5 flex items-center gap-1 font-extrabold rounded-lg">
                  <Package className="w-3 h-3" />
                  <span>{pkg?.name || (isRTL ? 'باقة ساعات' : 'Hour Package')}</span>
                </Badge>
              ) : isMonthly ? (
                <Badge className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-[10px] py-0 px-2 h-5 flex items-center gap-1 font-extrabold rounded-lg">
                  <Crown className="w-3 h-3" />
                  <span>{isRTL ? 'اشتراك شهري' : 'Monthly Sub'}</span>
                </Badge>
              ) : isBooking ? (
                <Badge className="bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60 text-[10px] py-0 px-2 h-5 flex items-center gap-1 font-extrabold rounded-lg">
                  <Calendar className="w-3 h-3" />
                  <span>{isRTL ? 'حجز قاعة' : 'Room Booking'}</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] py-0 px-2 h-5 flex items-center uppercase font-bold tracking-tighter border-slate-200 dark:border-slate-800 rounded-lg text-slate-500">
                  {t('sessions.guest')}
                </Badge>
              )}

              {/* Deducted Package Hours/Minutes tag */}
              {deductedTimeDisplay && (
                <span className="text-[10px] font-bold font-mono text-purple-700 dark:text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                  <span>⏱️</span>
                  <span>{isRTL ? `خصم ${deductedTimeDisplay}` : `-${deductedTimeDisplay}`}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 sm:gap-4 text-[10px] text-slate-500 font-medium mt-1 flex-wrap">
              <span className={cn("flex items-center gap-1.5 font-mono text-cyan-600 dark:text-cyan-400", isRTL && "flex-row-reverse")}>
                <Phone className="w-3 h-3" />
                {session.phoneNumber || '---'}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-500/70" />
                {format(toMillis(session.startTime), 'HH:mm')} - {session.endTime ? format(toMillis(session.endTime), 'HH:mm') : '...'}
              </span>
              {session.roomAssignment?.roomName && (
                <span className="text-slate-400 font-bold">
                  📍 {session.roomAssignment.roomName}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{t('sessions.duration')}</p>
            <p className="text-base font-mono font-black text-slate-700 dark:text-slate-200">{formatDuration(session.duration || 0)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{t('sessions.totalBill')}</p>
            {session.totalCost > 0 ? (
              <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{formatCurrency(session.totalCost)}</p>
            ) : (isPackage || isMonthly) ? (
              <p className="text-xs sm:text-sm font-black text-purple-600 dark:text-purple-400">
                {isPackage ? (isRTL ? 'مغطى بالباقة' : 'Package') : (isRTL ? 'مغطى بالاشتراك' : 'Subscription')}
              </p>
            ) : (
              <p className="text-xl sm:text-2xl font-black text-slate-400 font-mono">{formatCurrency(0)}</p>
            )}
          </div>
          {/* Quick print button */}
          <button
            onClick={handlePrintClick}
            className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center hover:bg-cyan-500/10 hover:text-cyan-600 text-slate-400 transition-colors cursor-pointer"
            title={isRTL ? "طباعة الفاتورة" : "Print Receipt"}
          >
            <Printer className="w-4 h-4" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-cyan-500 transition-colors">
            <ChevronRight className={cn(
              "w-5 h-5 text-slate-400 group-hover:text-white transition-colors",
              isRTL && "rotate-180"
            )} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
