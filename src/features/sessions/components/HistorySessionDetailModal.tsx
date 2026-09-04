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
import { Clock, MessageCircle, FileText, Printer, Trash2 } from 'lucide-react';
import { formatCurrency, formatDuration, toMillis } from '../../../lib/utils-workspace';
import { handleReprint } from '../utils/printReceipt';
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
  const { t } = useTranslation();

  if (!session) return null;

  const handlePrint = () => {
    handleReprint(session);
  };

  const handleDelete = () => {
    onDelete(session.id);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white max-w-lg rounded-[2.5rem]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">{t('sessions.details')}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="flex items-center gap-5 p-5 rounded-[2rem] bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-cyan-500/20">
              {session.userName?.[0] || 'U'}
            </div>
            <div>
              <h3 className="text-xl font-black">{session.userName}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm text-slate-500 font-medium font-mono">{session.phoneNumber || '---'}</p>
                {session.whatsappOptIn !== false && (
                  <MessageCircle className="w-4 h-4 text-emerald-500" />
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-1">
                {format(toMillis(session.startTime), 'MMMM do, yyyy', { locale: dateLocale })}
              </p>
            </div>
            <Badge className="ml-auto bg-emerald-500 text-white border-0 py-1 px-3 rounded-xl font-bold">
              {t('sessions.completed')}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-6 px-2">
            <div className="space-y-1">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest flex items-center gap-2">
                <Clock className="w-3 h-3 text-cyan-500" /> {t('sessions.timeRange')}
              </p>
              <p className="text-base font-black">
                {format(toMillis(session.startTime), 'HH:mm')} - {session.endTime ? format(toMillis(session.endTime), 'HH:mm') : '...'}
              </p>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{t('sessions.duration')}</p>
              <p className="text-base font-black font-mono">{formatDuration(session.duration || 0)}</p>
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-bold">{t('sessions.pricingType')}</span>
              <Badge variant="secondary" className="font-black bg-slate-100 dark:bg-slate-800 uppercase text-[10px]">{session.pricingType}</Badge>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-bold">{t('sessions.timeCost')}</span>
              <span className="font-black text-slate-700 dark:text-slate-300 font-mono">{formatCurrency(session.timeCost || 0)}</span>
            </div>
            
            {session.services && session.services.length > 0 && (
              <div className="space-y-3 bg-slate-50 dark:bg-slate-800/30 p-4 rounded-2xl">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-bold">{t('sessions.servicesCost')}</span>
                  <span className="font-black text-slate-700 dark:text-slate-300 font-mono">{formatCurrency(session.servicesCost || 0)}</span>
                </div>
                <div className="space-y-2">
                  {session.services.map((s: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs font-medium">
                      <span className="text-slate-400">{s.name} <span className="text-[10px] opacity-70">x{s.quantity}</span></span>
                      <span className="text-slate-500">{formatCurrency(s.price * s.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-end">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">{t('sessions.totalBill')}</p>
                <span className="text-lg font-black">{t('sessions.totalBill')}</span>
              </div>
              <span className="text-4xl font-black text-emerald-600 font-mono">{formatCurrency(session.totalCost)}</span>
            </div>
          </div>

          {session.notes && (
            <div className="space-y-2 p-5 rounded-[1.5rem] bg-amber-500/5 border border-amber-500/10">
              <p className="text-[10px] text-amber-600 uppercase font-black tracking-widest flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> {t('sessions.staffNotes')}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300 italic font-medium leading-relaxed">
                "{session.notes}"
              </p>
            </div>
          )}
        </div>

        <div className="pt-6 flex gap-3">
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
