import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Search, 
  ChevronRight, 
  ChevronLeft, 
  CalendarDays, 
  Download,
  RotateCw,
  Clock,
  Coffee,
  Sparkles,
  Users,
  DoorOpen,
  Receipt
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
import { formatCurrency, toMillis, getSessionTimestamp, isSameCalendarDay, getSessionDateMillis } from '../lib/utils-workspace';
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
  const { completedSessions, setCompletedSessions, user, customers } = useWorkspaceStore();
  const isOwner = user?.role === 'owner';
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'guests' | 'subscribers' | 'rooms'>('all');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isRTL = i18n.language.startsWith('ar');
  const dateLocale = isRTL ? arSA : enUS;

  // On-demand date range query whenever selectedDate changes
  useEffect(() => {
    if (!selectedDate) return;
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);

    sessionService.getCompletedSessionsByDateRange(dayStart.getTime(), dayEnd.getTime()).catch(err => {
      console.warn('Could not fetch sessions for date:', err);
    });
  }, [selectedDate]);

  // Real-time listener fallback & manual refresh for the selected day
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const dayStart = new Date(selectedDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(selectedDate);
      dayEnd.setHours(23, 59, 59, 999);
      await sessionService.getCompletedSessionsByDateRange(dayStart.getTime(), dayEnd.getTime());
      toast.success(isRTL ? 'تم تحديث سجل الجلسات' : 'History updated');
    } catch (e) {
      console.warn('Could not refresh completed sessions:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedDate, isRTL]);

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

  // Precompute customer lookups for super fast and accurate customer ID searches
  const customerMaps = useMemo(() => {
    const byId = new Map<string, typeof customers[0]>();
    const byPhone = new Map<string, typeof customers[0]>();
    const byNumericId = new Map<number, typeof customers[0]>();
    const byName = new Map<string, typeof customers[0]>();

    (customers || []).forEach(c => {
      if (c.id) byId.set(c.id, c);
      if (c.phone) byPhone.set(c.phone.trim(), c);
      if (c.customerId !== undefined && c.customerId !== null) {
        byNumericId.set(Number(c.customerId), c);
      }
      if (c.name) byName.set(c.name.trim().toLowerCase(), c);
    });

    return { byId, byPhone, byNumericId, byName };
  }, [customers]);

  // Filtered Sessions with robust date matching & search
  const filteredSessions = useMemo(() => {
    const searchLower = searchQuery.toLowerCase().trim();
    const cleanSearch = searchLower.replace(/^#/, '');

    return completedSessions.filter(session => {
      if (!session) return false;

      // 1. Precise Calendar Day Check: session start date (startTime with createdAt fallback only)
      const sessionDateMs = getSessionDateMillis(session);
      if (sessionDateMs === null) return false;

      const dateMatches = isSameCalendarDay(sessionDateMs, selectedDate);
      if (!dateMatches) return false;

      // 2. Category Filter
      const isBooking = !!session.bookingId || session.pricingType === 'booking';
      const isPackageOrSub = !!session.isSubscribed || !!session.subscriptionId;

      if (categoryFilter === 'guests' && (isBooking || isPackageOrSub)) return false;
      if (categoryFilter === 'subscribers' && !isPackageOrSub) return false;
      if (categoryFilter === 'rooms' && !isBooking && (!session.roomAssignment || !session.roomAssignment.roomId)) return false;

      // 3. Search Query Filter
      if (searchLower) {
        // Resolve linked customer profile
        const sessionCust = 
          (session.customerId && customerMaps.byId.get(session.customerId)) ||
          ((session as any).customerNumericId && customerMaps.byNumericId.get(Number((session as any).customerNumericId))) ||
          (session.phoneNumber && customerMaps.byPhone.get(session.phoneNumber.trim())) ||
          (session.userName && customerMaps.byName.get(session.userName.trim().toLowerCase()));

        const custNumId = sessionCust?.customerId?.toString() || ((session as any).customerNumericId?.toString() || '');

        // Match by customer ID: e.g. "12", "#12"
        const matchesCustomerId = 
          Boolean(custNumId && (custNumId === cleanSearch || custNumId.includes(cleanSearch))) ||
          Boolean(session.customerId && session.customerId.toLowerCase().includes(searchLower));

        // Match by Name
        const matchesName = 
          session.userName?.toLowerCase().includes(searchLower) ||
          (sessionCust?.name && sessionCust.name.toLowerCase().includes(searchLower));

        // Match by Phone
        const matchesPhone = 
          (session.phoneNumber && session.phoneNumber.includes(cleanSearch)) ||
          (sessionCust?.phone && sessionCust.phone.includes(cleanSearch));

        // Match by Room / Table / Notes
        const matchesRoom = session.roomAssignment?.roomName?.toLowerCase().includes(searchLower);
        const matchesTable = session.roomAssignment?.tableLabel?.toLowerCase().includes(searchLower);
        const matchesNotes = session.notes && session.notes.toLowerCase().includes(searchLower);

        if (!matchesCustomerId && !matchesName && !matchesPhone && !matchesRoom && !matchesTable && !matchesNotes) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      const aTime = a.endTime ? toMillis(a.endTime) : (a.startTime ? toMillis(a.startTime) : toMillis(a.createdAt));
      const bTime = b.endTime ? toMillis(b.endTime) : (b.startTime ? toMillis(b.startTime) : toMillis(b.createdAt));
      return bTime - aTime;
    });
  }, [completedSessions, selectedDate, searchQuery, categoryFilter, customerMaps]);

  // Daily Metrics
  const dailyStats = useMemo(() => {
    let totalRevenue = 0;
    let totalTimeCost = 0;
    let totalServicesCost = 0;
    let guestCount = 0;
    let subscriberCount = 0;
    let roomCount = 0;

    filteredSessions.forEach(s => {
      totalRevenue += s.totalCost || 0;
      totalTimeCost += s.timeCost || 0;
      totalServicesCost += s.servicesCost || 0;

      const isBooking = !!s.bookingId || s.pricingType === 'booking';
      const isSub = !!s.isSubscribed || !!s.subscriptionId;

      if (isBooking || (s.roomAssignment && s.roomAssignment.roomId)) {
        roomCount++;
      } else if (isSub) {
        subscriberCount++;
      } else {
        guestCount++;
      }
    });

    return {
      totalRevenue,
      totalTimeCost,
      totalServicesCost,
      totalCount: filteredSessions.length,
      guestCount,
      subscriberCount,
      roomCount
    };
  }, [filteredSessions]);

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

  const handleSelectSession = useCallback((session: Session) => {
    setSelectedSession(session);
  }, []);

  const handleCloseDetailModal = useCallback(() => {
    setSelectedSession(null);
  }, []);

  const handleExport = useCallback(() => {
    if (filteredSessions.length > 0) {
      exportToExcel(formatSessionForExport(filteredSessions, t), `History_Sessions_${format(selectedDate, 'yyyy-MM-dd')}`);
      toast.success(t('common.success'));
    } else {
      toast.error(t('sessions.noSessions'));
    }
  }, [filteredSessions, selectedDate, t]);

  const isTodaySelected = isSameCalendarDay(selectedDate, new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const isYesterdaySelected = isSameCalendarDay(selectedDate, yesterdayDate);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ── Filters, Date Bar & Search ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 bg-white dark:bg-slate-900/40 p-5 rounded-[2.5rem] border border-slate-200/80 dark:border-slate-800 shadow-sm items-center">
        
        {/* Col 1: Date Navigation (Prev, Pick, Next) + Quick Toggles + Search */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3.5 xl:col-span-2">
          
          {/* Day Stepper & Popover Date Picker */}
          <div className="flex items-center bg-slate-100/80 dark:bg-slate-800/60 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm shrink-0">
            <button
              type="button"
              onClick={handlePrevDate}
              className="p-2.5 rounded-xl text-slate-500 hover:text-cyan-500 dark:hover:text-cyan-400 hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer"
              title={isRTL ? "اليوم السابق" : "Previous Day"}
            >
              <ChevronLeft className="w-5 h-5 shrink-0" />
            </button>

            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
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
              type="button"
              onClick={handleNextDate}
              className="p-2.5 rounded-xl text-slate-500 hover:text-cyan-500 dark:hover:text-cyan-400 hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer"
              title={isRTL ? "اليوم التالي" : "Next Day"}
            >
              <ChevronRight className="w-5 h-5 shrink-0" />
            </button>
          </div>

          {/* Quick Date Tabs: Today & Yesterday */}
          <div className="flex gap-1.5 bg-slate-100/80 dark:bg-slate-800/60 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm shrink-0">
            <button
              type="button"
              onClick={() => setSelectedDate(new Date())}
              className={cn(
                "px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer",
                isTodaySelected
                  ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/20"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              {isRTL ? "اليوم" : "Today"}
            </button>
            <button
              type="button"
              onClick={() => {
                const y = new Date();
                y.setDate(y.getDate() - 1);
                setSelectedDate(y);
              }}
              className={cn(
                "px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer",
                isYesterdaySelected
                  ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/20"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              {isRTL ? "أمس" : "Yesterday"}
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[150px]">
            <Search className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400", isRTL ? 'right-4' : 'left-4')} />
            <Input 
              placeholder={isRTL ? "بحث بالاسم، الهاتف، الغرفة..." : "Search by name, phone, room..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn("bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 w-full h-[52px] rounded-2xl text-xs font-semibold focus:ring-4 focus:ring-cyan-500/10 transition-all", isRTL ? 'pr-11' : 'pl-11')}
            />
          </div>
        </div>

        {/* Col 2: Action Buttons & Refresh */}
        <div className="flex flex-row items-center justify-between gap-3 border-t xl:border-t-0 xl:border-r border-slate-100 dark:border-slate-800/80 pt-4 xl:pt-0 xl:pr-5 w-full xl:w-auto">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-[52px] w-12 p-0 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all text-slate-500 cursor-pointer"
            title={isRTL ? "تحديث" : "Refresh"}
          >
            <RotateCw className={cn("w-4 h-4 text-cyan-500", isRefreshing && "animate-spin")} />
          </Button>

          <Button
            variant="outline"
            className="h-[52px] flex-1 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm px-4 flex items-center justify-center gap-2 hover:bg-slate-50 active:scale-95 transition-all text-xs font-bold cursor-pointer"
            onClick={handleExport}
          >
            <Download className="w-4 h-4 text-cyan-500" />
            <span>{t('reports.export')}</span>
          </Button>

          <div className="px-5 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl select-none text-right shrink-0">
            <p className="text-[9px] text-emerald-600 dark:text-emerald-400 uppercase font-black tracking-widest leading-none font-sans">
              {t('sessions.dailyRevenue')}
            </p>
            <p className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1.5 leading-none">
              {formatCurrency(dailyStats.totalRevenue)}
            </p>
          </div>
        </div>

      </div>

      {/* ── Summary Stats Bar & Category Filter Toggles ── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900/50 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 self-start">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              categoryFilter === 'all'
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            {isRTL ? `جميع الجلسات (${dailyStats.totalCount})` : `All (${dailyStats.totalCount})`}
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('guests')}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              categoryFilter === 'guests'
                ? "bg-cyan-500 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            {isRTL ? `عملاء (${dailyStats.guestCount})` : `Guests (${dailyStats.guestCount})`}
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('subscribers')}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              categoryFilter === 'subscribers'
                ? "bg-violet-500 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            {isRTL ? `مشتركين وباقات (${dailyStats.subscriberCount})` : `Subscribers (${dailyStats.subscriberCount})`}
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('rooms')}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              categoryFilter === 'rooms'
                ? "bg-indigo-500 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            {isRTL ? `غرف (${dailyStats.roomCount})` : `Rooms (${dailyStats.roomCount})`}
          </button>
        </div>

        {/* Breakdown Badges */}
        <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
          <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl">
            <Clock className="w-3.5 h-3.5 text-cyan-500" />
            <span>{isRTL ? 'الوقت:' : 'Time:'} <strong className="text-slate-800 dark:text-slate-200 font-mono">{formatCurrency(dailyStats.totalTimeCost)}</strong></span>
          </span>
          {dailyStats.totalServicesCost > 0 && (
            <span className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-xl">
              <Coffee className="w-3.5 h-3.5 text-amber-500" />
              <span>{isRTL ? 'الخدمات:' : 'Services:'} <strong className="font-mono">{formatCurrency(dailyStats.totalServicesCost)}</strong></span>
            </span>
          )}
        </div>
      </div>

      {/* ── Sessions List ── */}
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
          <div className="py-24 text-center bg-white dark:bg-slate-900/10 border border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem]">
            <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mx-auto mb-5 text-slate-400">
              <CalendarDays className="w-10 h-10 opacity-40" />
            </div>
            <p className="text-slate-700 dark:text-slate-300 font-bold text-lg">
              {searchQuery ? (isRTL ? 'لا توجد جلسات تطابق البحث' : 'No matching sessions found') : t('sessions.noSessionsFound')}
            </p>
            <p className="text-slate-400 text-sm mt-1.5">
              {format(selectedDate, "PP", { locale: dateLocale })}
            </p>
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
