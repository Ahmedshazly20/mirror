import React, { useState, useMemo, useCallback } from 'react';
import { 
  Calendar as CalendarIcon, 
  Search, 
  ChevronRight,
  ChevronLeft,
  CalendarDays,
  Download
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useWorkspaceStore } from '../store';
import { formatCurrency, toMillis } from '../lib/utils-workspace';
import { format } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';
import { sessionService } from '../services/sessionService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { exportToExcel, formatSessionForExport } from '../lib/exportUtils';
import { HistorySessionCard } from '../features/sessions/components/HistorySessionCard';
import { HistorySessionDetailModal } from '../features/sessions/components/HistorySessionDetailModal';
import { Session } from '../types';

export default function SessionHistory() {
  const { t, i18n } = useTranslation();
  const { completedSessions, user } = useWorkspaceStore();
  const isOwner = user?.role === 'owner';
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  const isRTL = i18n.language.startsWith('ar');
  const dateLocale = isRTL ? arSA : enUS;

  const handlePrevDate = useCallback(() => {
    setSelectedDate(prev => {
      const copy = new Date(prev);
      copy.setDate(copy.getDate() - 1);
      return copy;
    });
  }, []);

  const handleNextDate = useCallback(() => {
    setSelectedDate(prev => {
      const copy = new Date(prev);
      copy.setDate(copy.getDate() + 1);
      return copy;
    });
  }, []);

  const filteredSessions = useMemo(() => {
    const searchLower = searchQuery.toLowerCase().trim();
    const formattedSelected = format(selectedDate, 'yyyy-MM-dd');

    return completedSessions.filter(session => {
      const sessionDate = new Date(toMillis(session.startTime));
      const isSameDay = format(sessionDate, 'yyyy-MM-dd') === formattedSelected;
      const matchesSearch = 
        session.userName.toLowerCase().includes(searchLower) ||
        (session.phoneNumber && session.phoneNumber.includes(searchLower));
      return isSameDay && matchesSearch;
    }).sort((a, b) => toMillis(b.startTime) - toMillis(a.startTime));
  }, [completedSessions, selectedDate, searchQuery]);

  const handleDeleteSession = useCallback(async (id: string) => {
    if (window.confirm(t('sessions.deleteConfirm'))) {
      try {
        await sessionService.deleteSession(id);
        toast.success(t('common.delete') + ' ' + t('common.success'));
        setSelectedSession(null);
      } catch (err) {
        toast.error(t('sessions.errorLoading'));
      }
    }
  }, [t]);

  const dailyTotal = useMemo(() => {
    return filteredSessions.reduce((acc, s) => acc + s.totalCost, 0);
  }, [filteredSessions]);

  const handleSelectSession = useCallback((session: Session) => {
    setSelectedSession(session);
  }, []);

  const handleCloseDetailModal = useCallback(() => {
    setSelectedSession(null);
  }, []);

  const handleExport = useCallback(() => {
    if (filteredSessions.length > 0) {
      exportToExcel(formatSessionForExport(filteredSessions, t), 'History_Sessions');
      toast.success(t('common.success'));
    } else {
      toast.error(t('sessions.noSessions'));
    }
  }, [filteredSessions, t]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Redesigned Premium Filters & Stats Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 bg-white dark:bg-slate-900/40 p-5 rounded-[2.5rem] border border-slate-250/80 dark:border-slate-800 shadow-sm items-center">
        
        {/* Col 1: Date Navigation (Prev, Pick, Next) + Quick Toggles + Search */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 xl:col-span-2">
          
          {/* Day Stepper & Popover Date Picker */}
          <div className="flex items-center bg-slate-55 dark:bg-slate-800/40 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800/60 shadow-sm shrink-0">
            <button
              onClick={handlePrevDate}
              className="p-2 rounded-xl text-slate-500 hover:text-cyan-500 dark:hover:text-cyan-400 hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer"
              title={isRTL ? "اليوم السابق" : "Previous Day"}
            >
              <ChevronLeft className="w-5 h-5 shrink-0" />
            </button>

            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="px-4 py-2 inline-flex items-center gap-3 outline-none cursor-pointer hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all font-bold min-w-[190px] text-right"
                >
                  <CalendarIcon className="h-5 w-5 text-cyan-500 shrink-0" />
                  <div className="flex flex-col items-start leading-none">
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                      {t('sessions.selectDate')}
                    </span>
                    <span className="text-xs text-slate-800 dark:text-slate-200 font-extrabold whitespace-nowrap">
                      {selectedDate ? format(selectedDate, "PP", { locale: dateLocale }) : t('sessions.pickDate')}
                    </span>
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl" align="center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                  locale={dateLocale}
                  className="p-3"
                />
              </PopoverContent>
            </Popover>

            <button
              onClick={handleNextDate}
              className="p-2 rounded-xl text-slate-500 hover:text-cyan-500 dark:hover:text-cyan-400 hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer"
              title={isRTL ? "اليوم التالي" : "Next Day"}
            >
              <ChevronRight className="w-5 h-5 shrink-0" />
            </button>
          </div>

          {/* Quick Date Tabs */}
          <div className="flex gap-1.5 bg-slate-55 dark:bg-slate-800/40 p-1 rounded-2xl border border-slate-200/50 dark:border-slate-800/60 shadow-sm shrink-0">
            <button
              type="button"
              onClick={() => setSelectedDate(new Date())}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer",
                format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                  ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/10"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
              )}
            >
              {isRTL ? "اليوم" : "Today"}
            </button>
            <button
              type="button"
              onClick={() => {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                setSelectedDate(yesterday);
              }}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer",
                format(selectedDate, 'yyyy-MM-dd') === format(new Date(Date.now() - 86400000), 'yyyy-MM-dd')
                  ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/10"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
              )}
            >
              {isRTL ? "أمس" : "Yesterday"}
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[150px]">
            <Search className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400", isRTL ? 'right-4' : 'left-4')} />
            <Input 
              placeholder={t('common.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn("bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 w-full h-[52px] rounded-2xl text-xs font-semibold focus:ring-4 focus:ring-cyan-500/10 transition-all", isRTL ? 'pr-11' : 'pl-11')}
            />
          </div>
        </div>

        {/* Col 2: Action Button (Excel Export) & Stats */}
        <div className="flex flex-row items-center justify-between gap-4 border-t xl:border-t-0 xl:border-r border-slate-100 dark:border-slate-800/80 pt-4 xl:pt-0 xl:pr-6 w-full xl:w-auto">
          <Button
            variant="outline"
            className="h-[52px] rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm px-5 flex items-center justify-center gap-2 hover:bg-slate-50 active:scale-95 transition-all text-xs font-bold cursor-pointer"
            onClick={handleExport}
          >
            <Download className="w-4 h-4 text-cyan-500" />
            <span>{t('reports.export')}</span>
          </Button>

          <div className="px-5 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl select-none text-right">
            <p className="text-[9px] text-emerald-600 dark:text-emerald-400 uppercase font-black tracking-widest leading-none font-sans">
              {t('sessions.dailyRevenue')}
            </p>
            <p className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1.5 leading-none">
              {formatCurrency(dailyTotal)}
            </p>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredSessions.map((session) => (
          <HistorySessionCard 
            key={session.id}
            session={session}
            isRTL={isRTL}
            onSelect={handleSelectSession}
          />
        ))}

        {filteredSessions.length === 0 && (
          <div className="py-24 text-center bg-white dark:bg-slate-900/10 border border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem]">
            <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mx-auto mb-6">
              <CalendarDays className="w-10 h-10 text-slate-300 opacity-40" />
            </div>
            <p className="text-slate-500 font-bold text-lg">{t('sessions.noSessionsFound')}</p>
            <p className="text-slate-400 text-sm mt-1">{t('sessions.selectDate')}</p>
          </div>
        )}
      </div>

      <HistorySessionDetailModal
        session={selectedSession}
        isOpen={selectedSession !== null}
        onClose={handleCloseDetailModal}
        dateLocale={dateLocale}
        isOwner={isOwner}
        onDelete={handleDeleteSession}
      />
    </div>
  );
}
