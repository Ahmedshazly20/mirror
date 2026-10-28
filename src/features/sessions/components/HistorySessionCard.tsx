import React from 'react';
import { Phone, Clock, Printer, ChevronRight, DoorOpen, Users, Coffee, Sparkles, Crown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDuration, toMillis, getSessionTimestamp } from '../../../lib/utils-workspace';
import { handleReprint } from '../utils/printReceipt';
import { useWorkspaceStore } from '../../../store';
import { cn } from '@/lib/utils';
import { Session } from '../../../types';

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
  const customers = useWorkspaceStore(state => state.customers);

  const handleCardClick = React.useCallback(() => {
    onSelect(session);
  }, [onSelect, session]);

  const handlePrintClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    handleReprint(session);
  }, [session]);

  const linkedCustomer = React.useMemo(() => {
    if (!customers || customers.length === 0) return null;
    if (session.customerId) {
      const found = customers.find(c => c.id === session.customerId);
      if (found) return found;
    }
    if (session.customerNumericId) {
      const found = customers.find(c => Number(c.customerId) === Number(session.customerNumericId));
      if (found) return found;
    }
    if (session.phoneNumber) {
      const found = customers.find(c => c.phone === session.phoneNumber.trim());
      if (found) return found;
    }
    return null;
  }, [customers, session.customerId, session.customerNumericId, session.phoneNumber]);

  const custNumId = session.customerNumericId || linkedCustomer?.customerId;

  const isBooking = !!session.bookingId || session.pricingType === 'booking';
  const isPackage = session.isSubscribed && (session.deductedHours !== undefined || session.deductedMinutes !== undefined || session.remainingMinutes !== undefined);
  const isSubscriber = session.isSubscribed && !isPackage;
  const numPersons = session.numberOfPersons || session.roomAssignment?.groupSize || 1;
  const roomName = session.roomAssignment?.roomName || session.roomAssignment?.tableLabel || (session as any).roomName;
  const servicesCount = session.services?.reduce((sum, s) => sum + (s.quantity || 1), 0) || 0;

  const sessionStartMillis = toMillis(session.startTime || session.createdAt);
  const sessionEndMillis = session.endTime ? toMillis(session.endTime) : (session.completedAt ? toMillis(session.completedAt) : null);

  return (
    <Card 
      className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-cyan-500/40 transition-all cursor-pointer group rounded-3xl overflow-hidden shadow-sm hover:shadow-md"
      onClick={handleCardClick}
    >
      <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start md:items-center gap-4">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 shadow-sm",
            isBooking 
              ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
              : isPackage
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : isSubscriber
                  ? "bg-violet-500/10 text-violet-600 dark:text-violet-400"
                  : "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
          )}>
            {isBooking ? <DoorOpen className="w-6 h-6" /> : (session.userName?.[0]?.toUpperCase() || 'U')}
          </div>

          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              {custNumId && (
                <span className="text-[11px] font-black text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-lg font-mono">
                  #{custNumId}
                </span>
              )}
              <h4 className="font-bold text-slate-900 dark:text-white text-base md:text-lg leading-tight truncate">
                {session.userName}
              </h4>

              {/* Status/Type Badges */}
              {isBooking ? (
                <Badge className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 text-[10px] py-0 px-2 h-5 font-bold flex items-center gap-1 rounded-lg">
                  <DoorOpen className="w-3 h-3" />
                  <span>{isRTL ? 'حجز غرفة' : 'Room Booking'}</span>
                </Badge>
              ) : isPackage ? (
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] py-0 px-2 h-5 font-bold flex items-center gap-1 rounded-lg">
                  <Sparkles className="w-3 h-3" />
                  <span>{isRTL ? 'باقة ساعات' : 'Hours Package'}</span>
                </Badge>
              ) : isSubscriber ? (
                <Badge className="bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30 text-[10px] py-0 px-2 h-5 font-bold flex items-center gap-1 rounded-lg">
                  <Crown className="w-3 h-3" />
                  <span>{t('sessions.subscriber')}</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] py-0 px-2 h-5 flex items-center uppercase font-bold tracking-tighter border-slate-200 dark:border-slate-800 rounded-lg text-slate-500">
                  {t('sessions.guest')}
                </Badge>
              )}

              {roomName && (
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <DoorOpen className="w-3 h-3 text-cyan-500" />
                  {roomName}
                </span>
              )}

              {numPersons > 1 && (
                <span className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {numPersons} {isRTL ? 'أفراد' : 'persons'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3.5 text-[11px] text-slate-500 font-medium flex-wrap">
              <span className={cn("flex items-center gap-1.5 font-mono text-cyan-600 dark:text-cyan-400", isRTL && "flex-row-reverse")}>
                <Phone className="w-3 h-3" />
                {session.phoneNumber || '---'}
              </span>

              <span className="flex items-center gap-1.5 font-mono">
                <Clock className="w-3.5 h-3.5 text-cyan-500/70" />
                {format(sessionStartMillis, 'HH:mm')} - {sessionEndMillis ? format(sessionEndMillis, 'HH:mm') : '...'}
              </span>

              {servicesCount > 0 && (
                <span className="flex items-center gap-1 text-slate-400">
                  <Coffee className="w-3 h-3 text-amber-500" />
                  {servicesCount} {isRTL ? 'خدمات' : 'items'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-4 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{t('sessions.duration')}</p>
            <p className="text-sm md:text-base font-mono font-black text-slate-700 dark:text-slate-200">{formatDuration(session.duration || 0)}</p>
          </div>

          <div className="text-right">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{t('sessions.totalBill')}</p>
            <p className="text-xl md:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{formatCurrency(session.totalCost)}</p>
          </div>

          {/* Quick print button */}
          <button
            type="button"
            onClick={handlePrintClick}
            className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center hover:bg-cyan-500/10 hover:text-cyan-600 text-slate-400 transition-colors cursor-pointer shrink-0"
            title="طباعة الفاتورة"
          >
            <Printer className="w-4 h-4" />
          </button>

          <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-cyan-500 group-hover:text-white text-slate-400 transition-colors shrink-0">
            <ChevronRight className={cn(
              "w-5 h-5 transition-transform",
              isRTL && "rotate-180"
            )} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
