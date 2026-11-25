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
  ShoppingBag
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
import { formatCurrency, isSameCalendarDay } from '../lib/utils-workspace';
import { format } from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';
import { sessionService } from '../services/sessionService';
import { paymentService } from '../services/paymentService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { exportToExcel, formatSessionForExport, formatProductOrderForExport } from '../lib/exportUtils';
import { HistorySessionCard } from '../features/sessions/components/HistorySessionCard';
import { HistorySessionDetailModal } from '../features/sessions/components/HistorySessionDetailModal';
import { HistoryProductOrderCard } from '../features/sessions/components/HistoryProductOrderCard';
import { HistoryProductOrderDetailModal } from '../features/sessions/components/HistoryProductOrderDetailModal';
import {
  buildCustomerLookupMaps,
  buildHistoryTransactions,
  getDayCompletedSessions,
  getDayProductOrders,
  HistoryCategoryFilter,
  isRoomSession,
  isSubscriberSession,
} from '../features/sessions/utils/historyTransactions';
import { Payment, Session } from '../types';

export default function SessionHistory() {
  const { t, i18n } = useTranslation();
  const { completedSessions, payments, user, customers } = useWorkspaceStore();
  const isOwner = user?.role === 'owner';
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<HistoryCategoryFilter>('all');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [selectedProductOrder, setSelectedProductOrder] = useState<Payment | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingDate, setIsLoadingDate] = useState(false);

  const isRTL = i18n.language.startsWith('ar');
  const dateLocale = isRTL ? arSA : enUS;
  const selectedDayKey = format(selectedDate, 'yyyy-MM-dd');

  // On-demand date range query for both completed sessions and payments whenever selected calendar day changes
  const loadDateTransactions = useCallback(async (date: Date) => {
    if (!date) return;
    setIsLoadingDate(true);
    try {
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
      const startMs = dayStart.getTime();
      const endMs = dayEnd.getTime();

      await Promise.allSettled([
        sessionService.getCompletedSessionsByDateRange(startMs, endMs),
        paymentService.getPaymentsByDateRange(startMs, endMs),
      ]);
    } catch (err) {
      console.warn('Could not fetch history for date:', err);
    } finally {
      setIsLoadingDate(false);
    }
  }, []);

  useEffect(() => {
    loadDateTransactions(selectedDate);
    // Intentionally keyed by calendar day so selecting the same date or changing local filters avoids duplicate reads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDayKey, loadDateTransactions]);

  // Manual refresh for the selected day
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadDateTransactions(selectedDate);
      toast.success(isRTL ? 'تم تحديث سجل المعاملات' : 'History updated');
    } catch (e) {
      console.warn('Could not refresh history:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedDate, loadDateTransactions, isRTL]);

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

  // Precompute customer lookups for super fast and accurate customer ID/name/phone searches
  const customerMaps = useMemo(() => buildCustomerLookupMaps(customers), [customers]);

  // Completed sessions strictly on the selected local calendar day (startTime primary, createdAt fallback)
  const daySessions = useMemo(
    () => getDayCompletedSessions(completedSessions, selectedDate),
    [completedSessions, selectedDate],
  );

  // Standalone product orders strictly on the selected local calendar day (paymentType === 'product_order')
  const dayProductOrders = useMemo(
    () => getDayProductOrders(payments, selectedDate),
    [payments, selectedDate],
  );

  // Daily Metrics computed across the entire selected day (stable regardless of active filter)
  const dailyStats = useMemo(() => {
    let sessionsRevenue = 0;
    let totalTimeCost = 0;
    let totalServicesCost = 0;
    let guestCount = 0;
    let subscriberCount = 0;
    let roomCount = 0;

    daySessions.forEach(s => {
      sessionsRevenue += s.totalCost || 0;
      totalTimeCost += s.timeCost || 0;
      totalServicesCost += s.servicesCost || 0;

      if (isRoomSession(s)) {
        roomCount++;
      } else if (isSubscriberSession(s)) {
        subscriberCount++;
      } else {
        guestCount++;
      }
    });

    let productOrdersRevenue = 0;
    dayProductOrders.forEach(p => {
      productOrdersRevenue += Number(p.amount) || 0;
    });

    return {
      totalRevenue: sessionsRevenue + productOrdersRevenue,
      sessionsRevenue,
      productOrdersRevenue,
      totalTimeCost,
      totalServicesCost,
      totalCount: daySessions.length + dayProductOrders.length,
      sessionsCount: daySessions.length,
      productOrderCount: dayProductOrders.length,
      guestCount,
      subscriberCount,
      roomCount
    };
  }, [daySessions, dayProductOrders]);

  // Combined, filtered, and newest-first sorted transactions (sessions + standalone product orders)
  const filteredTransactions = useMemo(
    () =>
      buildHistoryTransactions({
        daySessions,
        dayProductOrders,
        categoryFilter,
        searchQuery,
        customerMaps,
      }),
    [daySessions, dayProductOrders, categoryFilter, searchQuery, customerMaps],
  );

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

  const handleSelectProductOrder = useCallback((payment: Payment) => {
    setSelectedProductOrder(payment);
  }, []);

  const handleCloseProductOrderModal = useCallback(() => {
    setSelectedProductOrder(null);
  }, []);

  const handleExport = useCallback(() => {
    const filteredSessionsList = filteredTransactions
      .filter((tx): tx is Extract<typeof tx, { kind: 'session' }> => tx.kind === 'session')
      .map((tx) => tx.session);
    const filteredOrdersList = filteredTransactions
      .filter((tx): tx is Extract<typeof tx, { kind: 'product_order' }> => tx.kind === 'product_order')
      .map((tx) => tx.payment);

    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    if (categoryFilter === 'product_orders' || (filteredSessionsList.length === 0 && filteredOrdersList.length > 0)) {
      if (filteredOrdersList.length > 0) {
        exportToExcel(formatProductOrderForExport(filteredOrdersList), `History_Product_Orders_${dateStr}`);
        toast.success(t('common.success'));
      } else {
        toast.error(t('sessions.noSessions'));
      }
      return;
    }

    if (filteredSessionsList.length > 0) {
      exportToExcel(formatSessionForExport(filteredSessionsList, t), `History_Sessions_${dateStr}`);
      toast.success(t('common.success'));
    } else {
      toast.error(t('sessions.noSessions'));
    }
  }, [filteredTransactions, categoryFilter, selectedDate, t]);

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
              placeholder={isRTL ? "بحث بالاسم، الهاتف، الغرفة، أو المنتج..." : "Search by name, phone, room, or product..."}
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
        <div className="flex flex-wrap items-center gap-1 bg-white dark:bg-slate-900/50 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 self-start">
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
            {isRTL ? `الكل (${dailyStats.totalCount})` : `All (${dailyStats.totalCount})`}
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
          <button
            type="button"
            onClick={() => setCategoryFilter('product_orders')}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1",
              categoryFilter === 'product_orders'
                ? "bg-amber-500 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <ShoppingBag className="w-3 h-3" />
            <span>{isRTL ? `طلبات منتجات (${dailyStats.productOrderCount})` : `Product Orders (${dailyStats.productOrderCount})`}</span>
          </button>
        </div>

        {/* Breakdown Badges */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
          <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl">
            <Clock className="w-3.5 h-3.5 text-cyan-500" />
            <span>{isRTL ? 'الوقت:' : 'Time:'} <strong className="text-slate-800 dark:text-slate-200 font-mono">{formatCurrency(dailyStats.totalTimeCost)}</strong></span>
          </span>
          {dailyStats.totalServicesCost > 0 && (
            <span className="flex items-center gap-1.5 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20 px-3 py-1.5 rounded-xl">
              <Coffee className="w-3.5 h-3.5 text-cyan-500" />
              <span>{isRTL ? 'خدمات الجلسات:' : 'Session Services:'} <strong className="font-mono">{formatCurrency(dailyStats.totalServicesCost)}</strong></span>
            </span>
          )}
          {dailyStats.productOrdersRevenue > 0 && (
            <span className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-xl">
              <ShoppingBag className="w-3.5 h-3.5 text-amber-500" />
              <span>{isRTL ? 'طلبات المنتجات:' : 'Product Orders:'} <strong className="font-mono">{formatCurrency(dailyStats.productOrdersRevenue)}</strong></span>
            </span>
          )}
        </div>
      </div>

      {/* ── Transactions List (Sessions + Standalone Product Orders) ── */}
      <div className="grid grid-cols-1 gap-4">
        {isLoadingDate && daySessions.length === 0 && dayProductOrders.length === 0 ? (
          <div className="py-24 text-center bg-white dark:bg-slate-900/10 border border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem]">
            <RotateCw className="w-8 h-8 text-cyan-500 animate-spin mx-auto mb-3" />
            <p className="text-slate-600 dark:text-slate-400 font-bold text-sm">
              {isRTL ? 'جاري تحميل السجل...' : 'Loading history...'}
            </p>
          </div>
        ) : (
          <>
            {filteredTransactions.map((tx) =>
              tx.kind === 'session' ? (
                <HistorySessionCard
                  key={`session_${tx.id}`}
                  session={tx.session}
                  isRTL={isRTL}
                  onSelect={handleSelectSession}
                />
              ) : (
                <HistoryProductOrderCard
                  key={`order_${tx.id}`}
                  payment={tx.payment}
                  isRTL={isRTL}
                  onSelect={handleSelectProductOrder}
                />
              ),
            )}

            {filteredTransactions.length === 0 && (
              <div className="py-24 text-center bg-white dark:bg-slate-900/10 border border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem]">
                <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mx-auto mb-5 text-slate-400">
                  <CalendarDays className="w-10 h-10 opacity-40" />
                </div>
                <p className="text-slate-700 dark:text-slate-300 font-bold text-lg">
                  {searchQuery
                    ? (isRTL ? 'لا توجد معاملات تطابق البحث' : 'No matching transactions found')
                    : (isRTL ? 'لا توجد جلسات أو طلبات في هذا التاريخ' : t('sessions.noSessionsFound'))}
                </p>
                <p className="text-slate-400 text-sm mt-1.5">
                  {format(selectedDate, "PP", { locale: dateLocale })}
                </p>
              </div>
            )}
          </>
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

      <HistoryProductOrderDetailModal
        payment={selectedProductOrder}
        isOpen={selectedProductOrder !== null}
        onClose={handleCloseProductOrderModal}
        dateLocale={dateLocale}
      />
    </div>
  );
}
