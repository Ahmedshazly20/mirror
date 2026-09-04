import React from 'react';
import { Phone, Clock, Printer, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDuration, toMillis } from '../../../lib/utils-workspace';
import { handleReprint } from '../utils/printReceipt';
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

  const handleCardClick = React.useCallback(() => {
    onSelect(session);
  }, [onSelect, session]);

  const handlePrintClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    handleReprint(session);
  }, [session]);

  return (
    <Card 
      className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-cyan-500/40 transition-all cursor-pointer group rounded-3xl overflow-hidden shadow-sm hover:shadow-md"
      onClick={handleCardClick}
    >
      <CardContent className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-600 font-black text-lg">
            {session.userName?.[0] || 'U'}
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white text-lg">{session.userName}</h4>
            <div className="flex items-center gap-4 text-[10px] text-slate-500 font-medium">
              <span className={cn("flex items-center gap-1.5 font-mono text-cyan-600 dark:text-cyan-400", isRTL && "flex-row-reverse")}>
                <Phone className="w-3 h-3" />
                {session.phoneNumber || '---'}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-500/70" />
                {format(toMillis(session.startTime), 'HH:mm')} - {session.endTime ? format(toMillis(session.endTime), 'HH:mm') : '...'}
              </span>
              <Badge variant="outline" className="text-[10px] py-0 px-2 h-5 flex items-center uppercase font-bold tracking-tighter border-slate-200 dark:border-slate-800 rounded-lg">
                {session.isSubscribed ? t('sessions.subscriber') : t('sessions.guest')}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden lg:block">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{t('sessions.duration')}</p>
            <p className="text-base font-mono font-black text-slate-700 dark:text-slate-200">{formatDuration(session.duration || 0)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{t('sessions.totalBill')}</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{formatCurrency(session.totalCost)}</p>
          </div>
          {/* Quick print button */}
          <button
            onClick={handlePrintClick}
            className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center hover:bg-cyan-500/10 hover:text-cyan-600 text-slate-400 transition-colors cursor-pointer"
            title="طباعة الفاتورة"
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
