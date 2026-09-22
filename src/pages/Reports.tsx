import React, { useMemo, useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  Clock, 
  DollarSign, 
  Calendar as CalendarIcon,
  Filter, 
  Download, 
  ArrowUpRight, 
  ArrowDownRight, 
  Wallet, 
  FileSpreadsheet, 
  Banknote, 
  Sparkles,
  CheckCircle,
  AlertCircle,
  CalendarDays,
  Layers,
  Check
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWorkspaceStore } from '../store';
import { formatCurrency, formatDuration, toMillis } from '../lib/utils-workspace';
import { 
  exportToExcel, 
  formatSessionForExport, 
  formatSubscriptionForExport, 
  formatExpenseForExport 
} from '../lib/exportUtils';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { 
  format, 
  startOfDay, 
  endOfDay, 
  subDays, 
  startOfMonth, 
  endOfMonth, 
  subMonths, 
  eachDayOfInterval, 
  differenceInDays 
} from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const COLORS = ['#06b6d4', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'];
const EXPENSE_COLOR = '#ef4444';
const REVENUE_COLOR = '#10b981';

type PresetRange = 'today' | '7days' | '30days' | 'thisMonth' | 'lastMonth' | 'custom';

export default function Reports() {
  const { t, i18n } = useTranslation();
  const { completedSessions, subscriptions, expenses, packages, payments, bookings, theme } = useWorkspaceStore();
  
  const [selectedPreset, setSelectedPreset] = useState<PresetRange>('7days');
  const [customStartDate, setCustomStartDate] = useState<Date>(subDays(new Date(), 6));
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());

  const isDark = theme === 'dark';
  const contrastColor = isDark ? '#64748b' : '#94a3b8';
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';
  const tooltipBg = isDark ? '#0f172a' : '#ffffff';
  const tooltipBorder = isDark ? '#1e293b' : '#e2e8f0';
  const textColor = isDark ? '#f8fafc' : '#0f172a';

  const isRTL = i18n.language.startsWith('ar');
  const dateLocale = isRTL ? arSA : enUS;

  // Resolve Effective Start and End Dates based on Preset or Custom
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = endOfDay(now);

    switch (selectedPreset) {
      case 'today':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case '7days':
        start = startOfDay(subDays(now, 6));
        break;
      case '30days':
        start = startOfDay(subDays(now, 29));
        break;
      case 'thisMonth':
        start = startOfMonth(now);
        end = endOfDay(now);
        break;
      case 'lastMonth': {
        const prevMonth = subMonths(now, 1);
        start = startOfMonth(prevMonth);
        end = endOfMonth(prevMonth);
        break;
      }
      case 'custom':
        start = startOfDay(customStartDate || subDays(now, 6));
        end = endOfDay(customEndDate || now);
        break;
      default:
        start = startOfDay(subDays(now, 6));
        break;
    }

    // Ensure start <= end
    if (start.getTime() > end.getTime()) {
      start = startOfDay(end);
    }

    return { startDate: start, endDate: end };
  }, [selectedPreset, customStartDate, customEndDate]);

  // Main Analytics & Accounting Calculation Engine (Single Source of Truth)
  const analyticsData = useMemo(() => {
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    // 1. Filter completed sessions in range
    const sessionsInRange = completedSessions.filter(s => {
      const sTime = toMillis(s.startTime);
      return sTime >= startMs && sTime <= endMs;
    });

    // 2. Filter subscriptions & packages created/activated in range
    const subscriptionsInRange = subscriptions.filter(sub => {
      const sTime = toMillis(sub.startDate || sub.createdAt);
      return sTime >= startMs && sTime <= endMs;
    });

    // 3. Filter bookings created or occurring in range
    const bookingsInRange = (bookings || []).filter(b => {
      const bTime = toMillis(b.startTime || b.createdAt);
      return bTime >= startMs && bTime <= endMs;
    });

    // 4. Filter expenses in range
    const expensesInRange = expenses.filter(e => {
      const eTime = toMillis(e.date);
      return eTime >= startMs && eTime <= endMs;
    });

    // 5. Filter direct payments recorded in range (Unified Payment Stream)
    const paymentsInRange = (payments || []).filter(p => {
      const pTime = toMillis(p.date || p.createdAt);
      return pTime >= startMs && pTime <= endMs;
    });

    // ── FINANCIAL BREAKDOWN & UNIFIED REVENUE RECOGNITION ──
    const coveredSessionIds = new Set<string>();
    const coveredSubscriptionIds = new Set<string>();
    const coveredBookingIds = new Set<string>();

    let totalCashPayment = 0;
    let totalInstapayPayment = 0;
    let cashCount = 0;
    let instapayCount = 0;

    let sessionReceivedTotal = 0;
    let subscriptionReceivedTotal = 0;
    let bookingReceivedTotal = 0;
    let otherReceivedTotal = 0;

    // 1. Process all explicit payment records in range (Direct Source of Truth)
    paymentsInRange.forEach(p => {
      const amount = p.amount || 0;
      if (amount <= 0) return;

      const isInstapay = p.paymentMethod === 'instapay';
      if (isInstapay) {
        totalInstapayPayment += amount;
        instapayCount++;
      } else {
        totalCashPayment += amount;
        cashCount++;
      }

      if (p.sessionId) {
        coveredSessionIds.add(p.sessionId);
        sessionReceivedTotal += amount;
      } else if (p.subscriptionId) {
        coveredSubscriptionIds.add(p.subscriptionId);
        subscriptionReceivedTotal += amount;
      } else if (p.bookingId) {
        coveredBookingIds.add(p.bookingId);
        bookingReceivedTotal += amount;
      } else {
        otherReceivedTotal += amount;
      }
    });

    // 2. Reconcile legacy/direct sessions in range not in payments collection
    let sessionBilledTotal = 0;
    let sessionOutstandingTotal = 0;

    sessionsInRange.forEach(s => {
      const total = s.totalCost || 0;
      sessionBilledTotal += total;

      const paid = s.paidAmount !== undefined 
        ? s.paidAmount 
        : (s.paymentStatus === 'unpaid' ? 0 : total);
      
      const remaining = s.remainingAmount !== undefined 
        ? s.remainingAmount 
        : Math.max(0, total - paid);

      sessionOutstandingTotal += remaining;

      if (paid > 0 && !coveredSessionIds.has(s.id)) {
        sessionReceivedTotal += paid;
        if (s.paymentMethod === 'instapay') {
          totalInstapayPayment += paid;
          instapayCount++;
        } else {
          totalCashPayment += paid;
          cashCount++;
        }
      }
    });

    // 3. Reconcile legacy/direct subscriptions in range not in payments collection
    let subscriptionBilledTotal = 0;
    let subscriptionOutstandingTotal = 0;

    subscriptionsInRange.forEach(sub => {
      const price = sub.price || 0;
      subscriptionBilledTotal += price;

      const paid = sub.paidAmount !== undefined 
        ? sub.paidAmount 
        : (sub.paymentStatus === 'unpaid' ? 0 : price);
      
      const remaining = sub.remainingAmount !== undefined 
        ? sub.remainingAmount 
        : Math.max(0, price - paid);

      subscriptionOutstandingTotal += remaining;

      if (paid > 0 && !coveredSubscriptionIds.has(sub.id)) {
        subscriptionReceivedTotal += paid;
        if (sub.paymentMethod === 'instapay') {
          totalInstapayPayment += paid;
          instapayCount++;
        } else {
          totalCashPayment += paid;
          cashCount++;
        }
      }
    });

    // 4. Reconcile room bookings in range not in payments collection
    let bookingBilledTotal = 0;
    let bookingOutstandingTotal = 0;

    bookingsInRange.forEach(b => {
      if (b.activeSessionId && coveredSessionIds.has(b.activeSessionId)) return;
      const total = b.totalPrice || 0;
      bookingBilledTotal += total;

      const paid = b.paidAmount || 0;
      const remaining = b.remainingAmount !== undefined ? b.remainingAmount : Math.max(0, total - paid);
      bookingOutstandingTotal += remaining;

      if (paid > 0 && !coveredBookingIds.has(b.id)) {
        bookingReceivedTotal += paid;
        if (b.paymentMethod === 'instapay') {
          totalInstapayPayment += paid;
          instapayCount++;
        } else {
          totalCashPayment += paid;
          cashCount++;
        }
      }
    });

    const totalRevenueReceived = totalCashPayment + totalInstapayPayment;
    const totalBilled = sessionBilledTotal + subscriptionBilledTotal + bookingBilledTotal;
    const totalOutstanding = sessionOutstandingTotal + subscriptionOutstandingTotal + bookingOutstandingTotal;
    const totalExpenses = expensesInRange.reduce((acc, e) => acc + (e.amount || 0), 0);
    const netProfit = totalRevenueReceived - totalExpenses;

    // ── TRENDS CALCULATION (Day by Day Realized Cash Flow) ──
    const diffDays = Math.max(1, differenceInDays(endDate, startDate) + 1);
    
    // Generate dates for trend chart
    let dateIntervals: Date[] = [];
    try {
      dateIntervals = eachDayOfInterval({ start: startDate, end: endDate });
    } catch {
      dateIntervals = [startDate];
    }

    const trendData = dateIntervals.map(day => {
      const dayStart = startOfDay(day).getTime();
      const dayEnd = endOfDay(day).getTime();

      const dayPayments = paymentsInRange.filter(p => {
        const pTime = toMillis(p.date || p.createdAt);
        return pTime >= dayStart && pTime <= dayEnd;
      });

      const dayExpenses = expensesInRange.filter(e => {
        const eTime = toMillis(e.date);
        return eTime >= dayStart && eTime <= dayEnd;
      });

      const daySessions = sessionsInRange.filter(s => {
        const sTime = toMillis(s.startTime);
        return sTime >= dayStart && sTime <= dayEnd;
      });

      // Daily payment revenue sum
      let dayRev = dayPayments.reduce((acc, p) => acc + (p.amount || 0), 0);

      // If no payments recorded for a day session (legacy), add its paid amount
      daySessions.forEach(s => {
        if (!coveredSessionIds.has(s.id)) {
          const paid = s.paidAmount !== undefined ? s.paidAmount : (s.paymentStatus === 'unpaid' ? 0 : (s.totalCost || 0));
          dayRev += paid;
        }
      });

      const dayExpenseAmount = dayExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);

      return {
        name: diffDays > 7 
          ? format(day, 'MMM dd', { locale: dateLocale })
          : format(day, 'EEE dd', { locale: dateLocale }),
        revenue: dayRev,
        expenses: dayExpenseAmount,
        sessions: daySessions.length
      };
    });

    // ── TOP SERVICES POPULARITY ──
    const serviceMap: Record<string, number> = {};
    sessionsInRange.forEach(s => {
      (s.services || []).forEach(svc => {
        serviceMap[svc.name] = (serviceMap[svc.name] || 0) + (svc.quantity || 1);
      });
    });

    const serviceData = Object.entries(serviceMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Average duration in minutes
    const avgDuration = sessionsInRange.length > 0 
      ? Math.round(sessionsInRange.reduce((acc, s) => acc + (s.duration || 0), 0) / sessionsInRange.length) 
      : 0;

    return {
      trendData,
      serviceData,
      filteredSessions: sessionsInRange,
      filteredSubscriptions: subscriptionsInRange,
      filteredExpenses: expensesInRange,
      filteredBookings: bookingsInRange,
      kpis: {
        totalRevenueReceived,
        totalBilled,
        totalOutstanding,
        totalExpenses,
        netProfit,
        avgDuration,
        totalSessions: sessionsInRange.length,
        totalSubscriptionsCount: subscriptionsInRange.length,
        totalBookingsCount: bookingsInRange.length,
        activeSubscribers: subscriptions.filter(s => s.isActive).length,
        totalCashPayment,
        totalInstapayPayment,
        cashCount,
        instapayCount,
        sessionReceivedTotal,
        subscriptionReceivedTotal,
        bookingReceivedTotal,
        otherReceivedTotal
      }
    };
  }, [completedSessions, subscriptions, expenses, payments, bookings, startDate, endDate, dateLocale]);

  // Excel Export Handler with exact active filtered data
  const handleExport = (type: 'sessions' | 'subscriptions' | 'expenses' | 'packages' | 'financialSummary') => {
    let dataToExport: any[] = [];
    let fileName = '';

    const rangeStr = `${format(startDate, 'yyyy-MM-dd')}_to_${format(endDate, 'yyyy-MM-dd')}`;

    switch (type) {
      case 'sessions':
        dataToExport = formatSessionForExport(analyticsData.filteredSessions, t);
        fileName = `Sessions_Report_${rangeStr}`;
        break;
      case 'subscriptions':
        dataToExport = formatSubscriptionForExport(analyticsData.filteredSubscriptions, t);
        fileName = `Subscriptions_Report_${rangeStr}`;
        break;
      case 'expenses':
        dataToExport = formatExpenseForExport(analyticsData.filteredExpenses, t);
        fileName = `Expenses_Report_${rangeStr}`;
        break;
      case 'packages':
        dataToExport = packages.map(p => ({
          [t('packages.packageName')]: p.name,
          [t('packages.hours')]: p.totalHours,
          [t('packages.price')]: p.price,
          [t('common.status')]: p.isActive ? t('common.active') : t('common.inactive')
        }));
        fileName = `Packages_Report`;
        break;
      case 'financialSummary':
        dataToExport = [{
          'الفترة من': format(startDate, 'yyyy-MM-dd'),
          'الفترة إلى': format(endDate, 'yyyy-MM-dd'),
          'إجمالي الإيرادات المحصلة (Cash In)': analyticsData.kpis.totalRevenueReceived,
          'إجمالي المبيعات المستحقة (Total Billed)': analyticsData.kpis.totalBilled,
          'المستحقات غير المحصلة (Outstanding)': analyticsData.kpis.totalOutstanding,
          'إجمالي المصروفات (Total Expenses)': analyticsData.kpis.totalExpenses,
          'صافي الربح الفعلي (Net Profit)': analyticsData.kpis.netProfit,
          'إجمالي الكاش': analyticsData.kpis.totalCashPayment,
          'إجمالي إنستا باي': analyticsData.kpis.totalInstapayPayment,
          'عدد الجلسات': analyticsData.kpis.totalSessions,
          'عدد الباقات والاشتراكات': analyticsData.kpis.totalSubscriptionsCount
        }];
        fileName = `Financial_Summary_${rangeStr}`;
        break;
    }

    if (dataToExport.length > 0) {
      exportToExcel(dataToExport, fileName);
      toast.success(isRTL ? 'تم تصدير ملف الإكسيل بنجاح' : 'Excel report exported successfully');
    } else {
      toast.error(isRTL ? 'لا توجد بيانات متاحة للتصدير في هذه الفترة' : 'No data available to export for this period');
    }
  };

  const presetLabels: Record<PresetRange, string> = {
    today: isRTL ? 'اليوم' : 'Today',
    '7days': isRTL ? 'آخر 7 أيام' : 'Last 7 Days',
    '30days': isRTL ? 'آخر 30 يوم' : 'Last 30 Days',
    thisMonth: isRTL ? 'هذا الشهر' : 'This Month',
    lastMonth: isRTL ? 'الشهر السابق' : 'Last Month',
    custom: isRTL ? 'نطاق مخصص' : 'Custom Date Range'
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header & Date Range Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-cyan-500" />
            <span>{t('reports.title')}</span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mt-0.5">
            {t('reports.subtitle')} • {format(startDate, 'dd MMM yyyy', { locale: dateLocale })} - {format(endDate, 'dd MMM yyyy', { locale: dateLocale })}
          </p>
        </div>

        {/* Action Controls & Date Picker */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
            {(['today', '7days', '30days', 'thisMonth', 'lastMonth'] as PresetRange[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setSelectedPreset(preset)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                  selectedPreset === preset
                    ? "bg-cyan-500 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                {presetLabels[preset]}
              </button>
            ))}
          </div>

          {/* Custom Date Range Picker Button */}
          <Popover>
            <PopoverTrigger
              type="button"
              className={cn(
                "inline-flex items-center gap-2 px-3.5 h-10 rounded-2xl border text-xs font-bold transition-all shadow-sm cursor-pointer",
                selectedPreset === 'custom'
                  ? "bg-cyan-500/10 border-cyan-500 text-cyan-600 dark:text-cyan-400"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              <CalendarIcon className="w-4 h-4 text-cyan-500" />
              <span>
                {selectedPreset === 'custom'
                  ? `${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`
                  : (isRTL ? 'اختيار تاريخ مخصص' : 'Custom Range')}
              </span>
            </PopoverTrigger>
            <PopoverContent 
              className="w-auto p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl z-50 space-y-3" 
              align="end"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-cyan-500" />
                  {isRTL ? 'تحديد فترة التقرير' : 'Select Custom Date Range'}
                </span>
                <span className="text-[11px] font-mono text-cyan-500 font-bold">
                  {differenceInDays(customEndDate, customStartDate) + 1} {isRTL ? 'يوم' : 'days'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* From Date */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500">{isRTL ? 'من تاريخ:' : 'From Date:'}</label>
                  <CalendarComponent
                    mode="single"
                    selected={customStartDate}
                    onSelect={(d) => {
                      if (d) {
                        setCustomStartDate(d);
                        setSelectedPreset('custom');
                      }
                    }}
                    initialFocus
                    locale={dateLocale}
                    className="border border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900/50"
                  />
                </div>

                {/* To Date */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500">{isRTL ? 'إلى تاريخ:' : 'To Date:'}</label>
                  <CalendarComponent
                    mode="single"
                    selected={customEndDate}
                    onSelect={(d) => {
                      if (d) {
                        setCustomEndDate(d);
                        setSelectedPreset('custom');
                      }
                    }}
                    locale={dateLocale}
                    className="border border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900/50"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  size="sm"
                  onClick={() => setSelectedPreset('custom')}
                  className="rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-white"
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  {isRTL ? 'تطبيق النطاق' : 'Apply Range'}
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-4 h-10 text-xs font-bold gap-2 shadow-md transition-all outline-none cursor-pointer">
              <Download className="w-4 h-4" />
              <span>{isRTL ? 'تصدير إكسيل' : 'Export Excel'}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[220px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5">
              <DropdownMenuLabel className="text-xs font-bold text-slate-400 px-2 py-1">{t('reports.export')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport('financialSummary')} className="gap-2 text-xs font-bold rounded-xl cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 text-cyan-500" />
                <span>{isRTL ? 'ملخص مالي شامل' : 'Financial Summary'}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('sessions')} className="gap-2 text-xs font-bold rounded-xl cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                <span>{t('common.sessions')} ({analyticsData.filteredSessions.length})</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('subscriptions')} className="gap-2 text-xs font-bold rounded-xl cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 text-violet-500" />
                <span>{t('settings.subscriptions')} ({analyticsData.filteredSubscriptions.length})</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('expenses')} className="gap-2 text-xs font-bold rounded-xl cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 text-rose-500" />
                <span>{t('common.expenses')} ({analyticsData.filteredExpenses.length})</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('packages')} className="gap-2 text-xs font-bold rounded-xl cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 text-amber-500" />
                <span>{t('settings.packages')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Primary Financial KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue Received (Cash In) */}
        <Card className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl overflow-hidden group hover:border-emerald-500/40 transition-all">
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                <DollarSign className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg">
                {isRTL ? 'المحصل فعلياً' : 'Cash In'}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{isRTL ? 'إجمالي الإيرادات المحصلة' : 'Revenue Received'}</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
              {formatCurrency(analyticsData.kpis.totalRevenueReceived)}
            </h3>
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
              <span>{isRTL ? 'جلسات: ' : 'Sessions: '}{formatCurrency(analyticsData.kpis.sessionReceivedTotal)}</span>
              <span>{isRTL ? 'باقات: ' : 'Packages: '}{formatCurrency(analyticsData.kpis.subscriptionReceivedTotal)}</span>
              {analyticsData.kpis.bookingReceivedTotal > 0 && (
                <span>{isRTL ? 'حجوزات: ' : 'Bookings: '}{formatCurrency(analyticsData.kpis.bookingReceivedTotal)}</span>
              )}
            </div>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500" />
          </CardContent>
        </Card>

        {/* Total Expenses */}
        <Card className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl overflow-hidden group hover:border-rose-500/40 transition-all">
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Wallet className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-black text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-lg">
                {isRTL ? 'مصروفات' : 'Expenses'}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{isRTL ? 'إجمالي المصروفات' : 'Total Expenses'}</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
              {formatCurrency(analyticsData.kpis.totalExpenses)}
            </h3>
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
              <span>{isRTL ? 'عدد العمليات: ' : 'Count: '}{analyticsData.filteredExpenses.length}</span>
              <span>{isRTL ? 'صافي التدفق' : 'Cash Flow'}</span>
            </div>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-rose-500" />
          </CardContent>
        </Card>

        {/* Net Realized Profit */}
        <Card className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl overflow-hidden group hover:border-cyan-500/40 transition-all">
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className={cn(
                "text-[11px] font-black px-2 py-0.5 rounded-lg",
                analyticsData.kpis.netProfit >= 0 
                  ? "text-cyan-600 dark:text-cyan-400 bg-cyan-500/10" 
                  : "text-rose-600 dark:text-rose-400 bg-rose-500/10"
              )}>
                {analyticsData.kpis.netProfit >= 0 ? (isRTL ? 'ربح صافي' : 'Net Profit') : (isRTL ? 'عجز' : 'Deficit')}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{isRTL ? 'صافي الربح الفعلي المحصل' : 'Net Realized Profit'}</p>
            <h3 className={cn(
              "text-2xl font-black mt-1 font-mono",
              analyticsData.kpis.netProfit >= 0 ? "text-cyan-600 dark:text-cyan-400" : "text-rose-600 dark:text-rose-400"
            )}>
              {formatCurrency(analyticsData.kpis.netProfit)}
            </h3>
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
              <span>{isRTL ? 'الإيراد المحصل - المصروفات' : 'Received - Expenses'}</span>
            </div>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-cyan-500" />
          </CardContent>
        </Card>

        {/* Outstanding Receivables / Due */}
        <Card className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl overflow-hidden group hover:border-amber-500/40 transition-all">
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                <AlertCircle className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg">
                {isRTL ? 'مستحق غير محصل' : 'Outstanding'}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{isRTL ? 'الذمم والمستحقات المتبقية' : 'Outstanding Balances'}</p>
            <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono">
              {formatCurrency(analyticsData.kpis.totalOutstanding)}
            </h3>
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
              <span>{isRTL ? 'إجمالي المبيعات: ' : 'Total Billed: '}{formatCurrency(analyticsData.kpis.totalBilled)}</span>
            </div>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-amber-500" />
          </CardContent>
        </Card>
      </div>

      {/* Payment Methods & Operational Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cash Breakdown */}
        <Card className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1 text-left">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Banknote className="w-4 h-4 text-emerald-500" />
                {isRTL ? "إجمالي الكاش المحصل" : "Total Cash Collected"}
              </span>
              <h3 className="text-xl font-black text-slate-900 dark:text-white font-mono">
                {formatCurrency(analyticsData.kpis.totalCashPayment)}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isRTL ? `${analyticsData.kpis.cashCount} معاملة نقدية` : `${analyticsData.kpis.cashCount} cash transactions`}
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-lg">
              💵
            </div>
          </CardContent>
        </Card>

        {/* InstaPay Breakdown */}
        <Card className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1 text-left">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-500" />
                {isRTL ? "إجمالي إنستا باي" : "Total InstaPay"}
              </span>
              <h3 className="text-xl font-black text-slate-900 dark:text-white font-mono">
                {formatCurrency(analyticsData.kpis.totalInstapayPayment)}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isRTL ? `${analyticsData.kpis.instapayCount} معاملة إلكترونية` : `${analyticsData.kpis.instapayCount} InstaPay transactions`}
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center text-lg">
              ⚡
            </div>
          </CardContent>
        </Card>

        {/* Sessions Count & Duration */}
        <Card className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1 text-left">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-cyan-500" />
                {isRTL ? "الجلسات المكتملة" : "Completed Sessions"}
              </span>
              <h3 className="text-xl font-black text-slate-900 dark:text-white font-mono">
                {analyticsData.kpis.totalSessions} {isRTL ? 'جلسة' : 'sessions'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isRTL ? `متوسط الجلسة: ${analyticsData.kpis.avgDuration} دقيقة` : `Avg: ${analyticsData.kpis.avgDuration} mins`}
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-500">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Subscriptions & Packages Count */}
        <Card className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1 text-left">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-violet-500" />
                {isRTL ? "الباقات والاشتراكات" : "Packages & Subs"}
              </span>
              <h3 className="text-xl font-black text-slate-900 dark:text-white font-mono">
                {analyticsData.kpis.totalSubscriptionsCount} {isRTL ? 'اشتراك/باقة' : 'subs'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isRTL ? `الأعضاء النشطون حالياً: ${analyticsData.kpis.activeSubscribers}` : `${analyticsData.kpis.activeSubscribers} active subscribers`}
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-500">
              <Layers className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visual Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financial Movement Track (Revenue vs Expenses) */}
        <Card className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white text-base font-black flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              <span>{t('reports.revenueTrend')}</span>
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400 text-xs">
              {isRTL ? 'حركة الإيرادات المحصلة (جلسات وباقات) مقابل المصروفات خلال الفترة' : 'Cash revenue vs expenses over selected period'}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analyticsData.trendData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={REVENUE_COLOR} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={REVENUE_COLOR} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={EXPENSE_COLOR} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={EXPENSE_COLOR} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke={contrastColor} 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false} 
                  reversed={isRTL}
                />
                <YAxis 
                  stroke={contrastColor} 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => `${value}`}
                  orientation={isRTL ? 'right' : 'left'}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '16px', textAlign: isRTL ? 'right' : 'left', color: textColor, boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="top" height={36}/>
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  name={isRTL ? 'الإيراد المحصل' : 'Collected Revenue'}
                  stroke={REVENUE_COLOR} 
                  fillOpacity={1} 
                  fill="url(#colorRev)" 
                  strokeWidth={3}
                />
                <Area 
                  type="monotone" 
                  dataKey="expenses" 
                  name={isRTL ? 'المصروفات' : 'Expenses'}
                  stroke={EXPENSE_COLOR} 
                  fillOpacity={1} 
                  fill="url(#colorExp)" 
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Sessions Activity Histogram */}
        <Card className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white text-base font-black flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-500" />
              <span>{t('reports.sessionsCount')}</span>
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400 text-xs">
              {isRTL ? 'توزيع عدد الجلسات المكتملة عبر أيام الفترة المحددة' : 'Completed sessions volume across the period'}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke={contrastColor} 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false} 
                  reversed={isRTL}
                />
                <YAxis 
                  stroke={contrastColor} 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false}
                  orientation={isRTL ? 'right' : 'left'}
                />
                <Tooltip 
                  cursor={{ fill: contrastColor, opacity: 0.1 }}
                  contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '16px', textAlign: isRTL ? 'right' : 'left', color: textColor }}
                />
                <Bar 
                  dataKey="sessions" 
                  name={isRTL ? 'عدد الجلسات' : 'Sessions'} 
                  fill="#8b5cf6" 
                  radius={[8, 8, 0, 0]} 
                  barSize={analyticsData.trendData.length > 15 ? 12 : 24} 
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Services & Drinks Popularity */}
        <Card className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white text-base font-black flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-500" />
              <span>{t('reports.topServices')}</span>
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400 text-xs">
              {isRTL ? 'المشروبات والخدمات الأكثر طلباً من قبل العملاء' : 'Most requested beverages and workspace services'}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] flex items-center justify-between">
            {analyticsData.serviceData.length > 0 ? (
              <>
                <div className="w-1/2 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analyticsData.serviceData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {analyticsData.serviceData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '12px', textAlign: isRTL ? 'right' : 'left', color: textColor }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 space-y-2.5 pl-2">
                  {analyticsData.serviceData.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="font-bold text-slate-700 dark:text-slate-300 truncate">{item.name}</span>
                      </div>
                      <span className="font-mono font-black text-slate-900 dark:text-white shrink-0 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        {item.value} {isRTL ? 'طلب' : 'orders'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="w-full text-center text-slate-400 text-xs font-bold py-12">
                {isRTL ? 'لا توجد طلبات خدمات مسجلة في هذه الفترة' : 'No service orders in this period'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financial Flow Composition */}
        <Card className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white text-base font-black flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-500" />
              <span>{t('reports.revenueBreakdown')}</span>
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400 text-xs">
              {isRTL ? 'توزيع مصادر الإيراد المحصل (جلسات / باقات) مقابل المصروفات' : 'Cash in sources vs expenses composition'}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: isRTL ? 'إيراد الجلسات' : 'Sessions Revenue', value: analyticsData.kpis.sessionReceivedTotal, fill: '#10b981' },
                    { name: isRTL ? 'إيراد الباقات' : 'Packages Revenue', value: analyticsData.kpis.subscriptionReceivedTotal, fill: '#8b5cf6' },
                    { name: isRTL ? 'إيراد الحجوزات' : 'Bookings Revenue', value: analyticsData.kpis.bookingReceivedTotal, fill: '#06b6d4' },
                    { name: isRTL ? 'إيرادات أخرى' : 'Other Revenue', value: analyticsData.kpis.otherReceivedTotal, fill: '#3b82f6' },
                    { name: isRTL ? 'المصروفات' : 'Expenses', value: analyticsData.kpis.totalExpenses, fill: '#ef4444' }
                  ].filter(item => item.value > 0)}
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  innerRadius={45}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {[
                    { name: isRTL ? 'إيراد الجلسات' : 'Sessions Revenue', value: analyticsData.kpis.sessionReceivedTotal, fill: '#10b981' },
                    { name: isRTL ? 'إيراد الباقات' : 'Packages Revenue', value: analyticsData.kpis.subscriptionReceivedTotal, fill: '#8b5cf6' },
                    { name: isRTL ? 'إيراد الحجوزات' : 'Bookings Revenue', value: analyticsData.kpis.bookingReceivedTotal, fill: '#06b6d4' },
                    { name: isRTL ? 'إيرادات أخرى' : 'Other Revenue', value: analyticsData.kpis.otherReceivedTotal, fill: '#3b82f6' },
                    { name: isRTL ? 'المصروفات' : 'Expenses', value: analyticsData.kpis.totalExpenses, fill: '#ef4444' }
                  ].filter(item => item.value > 0).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '12px', textAlign: isRTL ? 'right' : 'left', color: textColor }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
