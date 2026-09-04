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
  Calendar,
  Filter,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  FileSpreadsheet,
  Banknote,
  Sparkles
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWorkspaceStore } from '../store';
import { formatCurrency, formatDuration, toMillis } from '../lib/utils-workspace';
import { exportToExcel, formatSessionForExport, formatSubscriptionForExport, formatExpenseForExport } from '../lib/exportUtils';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";

const COLORS = ['#06b6d4', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'];
const EXPENSE_COLOR = '#ef4444';
const REVENUE_COLOR = '#10b981';

type TimeRange = 'today' | '7days' | '30days' | '90days';

export default function Reports() {
  const { t, i18n } = useTranslation();
  const { completedSessions, subscriptions, expenses, packages, theme } = useWorkspaceStore();
  const [timeRange, setTimeRange] = useState<TimeRange>('7days');

  const isDark = theme === 'dark';
  const contrastColor = isDark ? '#64748b' : '#94a3b8';
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';
  const tooltipBg = isDark ? '#0f172a' : '#ffffff';
  const tooltipBorder = isDark ? '#1e293b' : '#e2e8f0';
  const textColor = isDark ? '#f8fafc' : '#0f172a';

  const analyticsData = useMemo(() => {
    const now = new Date();
    let startDate = new Date();
    let daysToDisplay = 7;

    switch (timeRange) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        daysToDisplay = 1;
        break;
      case '7days':
        startDate.setDate(now.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        daysToDisplay = 7;
        break;
      case '30days':
        startDate.setDate(now.getDate() - 29);
        startDate.setHours(0, 0, 0, 0);
        daysToDisplay = 30;
        break;
      case '90days':
        startDate.setDate(now.getDate() - 89);
        startDate.setHours(0, 0, 0, 0);
        daysToDisplay = 90;
        break;
    }

    const displayDates = timeRange === 'today' 
      ? [new Date(startDate)] 
      : Array.from({ length: daysToDisplay }, (_, i) => {
          const d = new Date(startDate);
          d.setDate(d.getDate() + i);
          return d;
        });

    const trendData = displayDates.map(date => {
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);

      const daySessions = completedSessions.filter(s => {
        const sDate = toMillis(s.startTime);
        return sDate >= date.getTime() && sDate < nextDate.getTime();
      });

      const dayExpenses = expenses.filter(e => {
        const eDate = toMillis(e.date);
        return eDate >= date.getTime() && eDate < nextDate.getTime();
      });

      const dayRevenue = daySessions.reduce((acc, s) => acc + s.totalCost, 0);
      const dayExpenseAmount = dayExpenses.reduce((acc, e) => acc + e.amount, 0);
      
      return {
        name: daysToDisplay > 7 
          ? date.toLocaleDateString(i18n.language, { month: 'numeric', day: 'numeric' })
          : date.toLocaleDateString(i18n.language, { weekday: 'short' }),
        revenue: dayRevenue,
        expenses: dayExpenseAmount,
        sessions: daySessions.length
      };
    });

    // Subscriptions count as revenue (start date within range)
    const filteredSubscriptions = subscriptions.filter(s => {
      const sDate = toMillis(s.startDate);
      return sDate >= startDate.getTime();
    });

    const subscriptionTotal = filteredSubscriptions.reduce((acc, s) => acc + s.price, 0);

    // Filtered Sessions for range
    const sessionsInRange = completedSessions.filter(s => toMillis(s.startTime) >= startDate.getTime());
    const sessionsTotal = sessionsInRange.reduce((acc, s) => acc + s.totalCost, 0);

    // Calculate Cash and InstaPay Breakdown
    let totalCashPayment = 0;
    let totalInstapayPayment = 0;
    let cashCount = 0;
    let instapayCount = 0;

    sessionsInRange.forEach(s => {
      if (!s.paymentMethod || s.paymentMethod === 'cash') {
        totalCashPayment += s.totalCost;
        cashCount++;
      } else if (s.paymentMethod === 'instapay') {
        totalInstapayPayment += s.totalCost;
        instapayCount++;
      }
    });

    // Filtered Expenses for range
    const expensesInRange = expenses.filter(e => toMillis(e.date) >= startDate.getTime());
    const totalExpenses = expensesInRange.reduce((acc, e) => acc + e.amount, 0);

    // Service popularity
    const serviceMap: Record<string, number> = {};
    sessionsInRange.forEach(s => {
      s.services.forEach(svc => {
        serviceMap[svc.name] = (serviceMap[svc.name] || 0) + svc.quantity;
      });
    });

    const serviceData = Object.entries(serviceMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // KPIs
    const totalRevenue = sessionsTotal + subscriptionTotal;
    const netProfit = totalRevenue - totalExpenses;
    const avgDuration = sessionsInRange.length > 0 
      ? sessionsInRange.reduce((acc, s) => acc + (s.duration || 0), 0) / sessionsInRange.length 
      : 0;

    return {
      trendData,
      serviceData,
      kpis: {
        totalRevenue,
        totalExpenses,
        netProfit,
        avgDuration,
        totalSessions: sessionsInRange.length,
        activeSubscribers: subscriptions.filter(s => s.isActive).length,
        totalCashPayment,
        totalInstapayPayment,
        cashCount,
        instapayCount,
      }
    };
  }, [completedSessions, subscriptions, expenses, timeRange, i18n.language]);

  const isRTL = i18n.language.startsWith('ar');

  const handleExport = (type: 'sessions' | 'subscriptions' | 'expenses' | 'packages') => {
    let dataToExport: any[] = [];
    let fileName = '';

    switch (type) {
      case 'sessions':
        dataToExport = formatSessionForExport(completedSessions, t);
        fileName = 'Sessions_Report';
        break;
      case 'subscriptions':
        dataToExport = formatSubscriptionForExport(subscriptions, t);
        fileName = 'Subscriptions_Report';
        break;
      case 'expenses':
        dataToExport = formatExpenseForExport(expenses, t);
        fileName = 'Expenses_Report';
        break;
      case 'packages':
        dataToExport = packages.map(p => ({
          [t('packages.packageName')]: p.name,
          [t('packages.hours')]: p.totalHours,
          [t('packages.price')]: p.price,
          [t('common.status')]: p.isActive ? t('common.active') : t('common.inactive')
        }));
        fileName = 'Packages_Report';
        break;
    }

    if (dataToExport.length > 0) {
      exportToExcel(dataToExport, fileName);
      toast.success(t('common.success'));
    } else {
      toast.error(t('sessions.noSessions'));
    }
  };

  const rangeLabels: Record<TimeRange, string> = {
    today: t('reports.today') || 'Today',
    '7days': t('reports.last7Days'),
    '30days': t('reports.last30Days') || 'Last 30 Days',
    '90days': t('reports.last90Days') || 'Last 90 Days',
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('reports.title')}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t('reports.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 px-3 h-10 text-sm font-medium text-slate-600 dark:text-slate-300 gap-2 min-w-[140px] hover:bg-slate-50 transition-colors outline-none cursor-pointer">
              <Filter className="w-4 h-4 text-cyan-500" />
              {rangeLabels[timeRange]}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[160px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <DropdownMenuItem onClick={() => setTimeRange('today')}>{rangeLabels.today}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimeRange('7days')}>{rangeLabels['7days']}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimeRange('30days')}>{rangeLabels['30days']}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimeRange('90days')}>{rangeLabels['90days']}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white px-4 h-10 text-sm font-medium gap-2 shadow-lg shadow-cyan-500/20 transition-all outline-none cursor-pointer">
              <Download className="w-4 h-4" />
              {t('reports.export')}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <DropdownMenuLabel>{t('reports.export')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport('sessions')} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                {t('common.sessions')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('subscriptions')} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 text-violet-500" />
                {t('settings.subscriptions')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('expenses')} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 text-rose-500" />
                {t('common.expenses')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('packages')} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 text-amber-500" />
                {t('settings.packages')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden group">
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-emerald-500/10 rounded-lg group-hover:scale-110 transition-transform">
                <DollarSign className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{t('reports.totalRevenue')}</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {formatCurrency(analyticsData.kpis.totalRevenue)}
            </h3>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500/20" />
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden group">
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-rose-500/10 rounded-lg group-hover:scale-110 transition-transform">
                <Wallet className="w-5 h-5 text-rose-500 dark:text-rose-400" />
              </div>
              <ArrowDownRight className="w-4 h-4 text-rose-500 dark:text-rose-400" />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{t('reports.totalExpenses') || 'Total Expenses'}</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {formatCurrency(analyticsData.kpis.totalExpenses)}
            </h3>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-rose-500/20" />
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden group">
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-cyan-500/10 rounded-lg group-hover:scale-110 transition-transform">
                <TrendingUp className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{t('reports.netProfit') || 'Net Profit'}</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {formatCurrency(analyticsData.kpis.netProfit)}
            </h3>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-cyan-500/20" />
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden group">
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-500/10 rounded-lg group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5 text-purple-500 dark:text-purple-400" />
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{t('reports.totalSessions')}</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{analyticsData.kpis.totalSessions}</h3>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-purple-500/20" />
          </CardContent>
        </Card>
      </div>

      {/* Payment Methods Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden group">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1 text-left">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Banknote className="w-4 h-4 text-emerald-500" />
                {isRTL ? "إجمالي الكاش" : "Total Cash"}
              </span>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white pt-1">
                {formatCurrency(analyticsData.kpis.totalCashPayment)}
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {isRTL 
                  ? `عدد العمليات الكاش: ${analyticsData.kpis.cashCount} عملية` 
                  : `${analyticsData.kpis.cashCount} cash operations`}
              </p>
            </div>
            <div className="h-12 px-3 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-extrabold text-xs border border-emerald-500/10 gap-1.5 select-none">
              💵 {isRTL ? "كاش" : "Cash"}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden group">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1 text-left">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-500" />
                {isRTL ? "إجمالي إنستا باي" : "Total InstaPay"}
              </span>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white pt-1">
                {formatCurrency(analyticsData.kpis.totalInstapayPayment)}
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {isRTL 
                  ? `عدد عمليات إنستا باي: ${analyticsData.kpis.instapayCount} عملية` 
                  : `${analyticsData.kpis.instapayCount} InstaPay operations`}
              </p>
            </div>
            <div className="h-12 px-3 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-600 dark:text-cyan-400 font-extrabold text-xs border border-cyan-500/10 gap-1.5 select-none">
              ⚡ InstaPay
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Financial Movement Track */}
        <Card className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white text-lg">{t('reports.revenueTrend')}</CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">{t('reports.revenueTrendDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
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
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  reversed={isRTL}
                />
                <YAxis 
                  stroke={contrastColor} 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => `${value}`}
                  orientation={isRTL ? 'right' : 'left'}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '12px', textAlign: isRTL ? 'right' : 'left', color: textColor, boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="top" height={36}/>
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  name={t('reports.totalRevenue')}
                  stroke={REVENUE_COLOR} 
                  fillOpacity={1} 
                  fill="url(#colorRev)" 
                  strokeWidth={3}
                />
                <Area 
                  type="monotone" 
                  dataKey="expenses" 
                  name={t('reports.totalExpenses') || 'Expenses'}
                  stroke={EXPENSE_COLOR} 
                  fillOpacity={1} 
                  fill="url(#colorExp)" 
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Sessions Count */}
        <Card className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white text-lg">{t('reports.sessionsCount')}</CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">{t('reports.sessionsCountDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke={contrastColor} 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  reversed={isRTL}
                />
                <YAxis 
                  stroke={contrastColor} 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                  orientation={isRTL ? 'right' : 'left'}
                />
                <Tooltip 
                  cursor={{ fill: contrastColor, opacity: 0.1 }}
                  contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '12px', textAlign: isRTL ? 'right' : 'left', color: textColor }}
                />
                <Bar dataKey="sessions" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={timeRange === 'today' ? 60 : 20} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Service Popularity */}
        <Card className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white text-lg">{t('reports.topServices')}</CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">{t('reports.topServicesDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analyticsData.serviceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {analyticsData.serviceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '12px', textAlign: isRTL ? 'right' : 'left', color: textColor }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className={`w-1/3 space-y-2 ${isRTL ? 'mr-4 text-right' : 'ml-4'}`}>
              {analyticsData.serviceData.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-xs text-slate-500 dark:text-slate-400 truncate flex-1">{item.name}</span>
                  <span className="text-xs text-slate-900 dark:text-white font-bold">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Financial Health Pie */}
        <Card className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white text-lg">{t('reports.revenueBreakdown')}</CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">{t('reports.revenueBreakdownDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: t('reports.totalRevenue'), value: analyticsData.kpis.totalRevenue },
                    { name: t('reports.totalExpenses') || 'Expenses', value: analyticsData.kpis.totalExpenses }
                  ]}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  <Cell fill={REVENUE_COLOR} />
                  <Cell fill={EXPENSE_COLOR} />
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

