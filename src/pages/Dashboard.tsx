import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Timer, 
  CreditCard, 
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  CalendarDays
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWorkspaceStore } from '../store';
import { formatCurrency, toMillis } from '../lib/utils-workspace';

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { 
    sessions: activeSessions, 
    completedSessions, 
    subscriptions, 
    bookings, 
    payments, 
    setIsNewSessionModalOpen 
  } = useWorkspaceStore();
  
  const isRTL = i18n.language.startsWith('ar');

  const { todayRevenue, todayCash, todayInstapay, todayCompletedCount } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStartMs = today.getTime();
    const todayEndMs = todayStartMs + 24 * 60 * 60 * 1000 - 1;

    // Filter payments recorded today (Single Source of Truth)
    const todayPayments = (payments || []).filter(p => {
      const pTime = toMillis(p.date || p.createdAt);
      return pTime >= todayStartMs && pTime <= todayEndMs;
    });

    const coveredSessionIds = new Set<string>();
    const coveredSubscriptionIds = new Set<string>();
    const coveredBookingIds = new Set<string>();

    let cash = 0;
    let insta = 0;

    // 1. Process all direct payments collected today
    todayPayments.forEach(p => {
      const amt = p.amount || 0;
      if (amt <= 0) return;

      if (p.paymentMethod === 'instapay') {
        insta += amt;
      } else {
        cash += amt;
      }

      if (p.sessionId) coveredSessionIds.add(p.sessionId);
      if (p.subscriptionId) coveredSubscriptionIds.add(p.subscriptionId);
      if (p.bookingId) coveredBookingIds.add(p.bookingId);
    });

    // 2. Count completed sessions today
    let count = 0;
    completedSessions.forEach(s => {
      const sTime = toMillis(s.endTime || s.startTime);
      if (sTime >= todayStartMs && sTime <= todayEndMs) {
        count++;
        // Reconcile legacy sessions if not in payments collection
        const paid = s.paidAmount !== undefined ? s.paidAmount : (s.paymentStatus === 'unpaid' ? 0 : (s.totalCost || 0));
        if (paid > 0 && !coveredSessionIds.has(s.id)) {
          if (s.paymentMethod === 'instapay') {
            insta += paid;
          } else {
            cash += paid;
          }
        }
      }
    });

    // 3. Reconcile legacy subscriptions started today not in payments
    (subscriptions || []).forEach(sub => {
      const subTime = toMillis(sub.startDate || sub.createdAt);
      if (subTime >= todayStartMs && subTime <= todayEndMs) {
        const paid = sub.paidAmount !== undefined ? sub.paidAmount : (sub.paymentStatus === 'unpaid' ? 0 : (sub.price || 0));
        if (paid > 0 && !coveredSubscriptionIds.has(sub.id)) {
          if (sub.paymentMethod === 'instapay') {
            insta += paid;
          } else {
            cash += paid;
          }
        }
      }
    });

    // 4. Reconcile legacy bookings made today not in payments
    (bookings || []).forEach(b => {
      if (b.activeSessionId && coveredSessionIds.has(b.activeSessionId)) return;
      const bTime = toMillis(b.createdAt || b.startTime);
      if (bTime >= todayStartMs && bTime <= todayEndMs) {
        const paid = b.paidAmount || 0;
        if (paid > 0 && !coveredBookingIds.has(b.id)) {
          if (b.paymentMethod === 'instapay') {
            insta += paid;
          } else {
            cash += paid;
          }
        }
      }
    });

    const rev = cash + insta;

    return {
      todayRevenue: rev,
      todayCash: cash,
      todayInstapay: insta,
      todayCompletedCount: count,
    };
  }, [completedSessions, payments, subscriptions, bookings]);

  const allRecentSessions = useMemo(() => {
    return [...activeSessions, ...completedSessions]
      .sort((a, b) => toMillis(b.startTime) - toMillis(a.startTime))
      .slice(0, 5);
  }, [activeSessions, completedSessions]);

  const stats = useMemo(() => [
    {
      title: t('dashboard.activeSessionsCount'),
      value: activeSessions.length,
      icon: Timer,
      color: 'text-cyan-600 dark:text-cyan-400',
      bg: 'bg-cyan-500/10',
      trend: '+12%',
      trendUp: true
    },
    {
      title: t('dashboard.todayRevenue'),
      value: formatCurrency(todayRevenue),
      extra: `💵 ${formatCurrency(todayCash)} • ⚡ ${formatCurrency(todayInstapay)}`,
      icon: CreditCard,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10',
      trend: '+5.4%',
      trendUp: true
    },
    {
      title: t('dashboard.totalSessions'),
      value: todayCompletedCount + activeSessions.length,
      icon: Users,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-500/10',
      trend: '-2%',
      trendUp: false
    },
    {
      title: t('dashboard.occupancy'),
      value: '68%',
      icon: TrendingUp,
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-500/10',
      trend: '+8%',
      trendUp: true
    }
  ], [activeSessions.length, todayRevenue, todayCash, todayInstapay, todayCompletedCount, t]);


  return (
    <div className="space-y-8" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <Card key={i} className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div className={`flex items-center gap-1 text-xs font-medium ${stat.trendUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {stat.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {stat.trend}
                </div>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{stat.title}</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stat.value}</h3>
              {('extra' in stat) && stat.extra && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1 font-mono">
                  {stat.extra}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white text-lg">{t('dashboard.recentActivity')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {allRecentSessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800/50">
                  <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-700 dark:text-white">
                      {session.userName?.[0] || 'U'}
                    </div>
                    <div className={isRTL ? 'text-right' : 'text-left'}>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{session.userName}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(toMillis(session.startTime)).toLocaleTimeString()} • {session.status}
                      </p>
                    </div>
                  </div>
                  <div className={isRTL ? 'text-left' : 'text-right'}>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(session.totalCost)}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">{session.pricingType}</p>
                  </div>
                </div>
              ))}
              {allRecentSessions.length === 0 && (
                <div className="text-center py-10 text-slate-500">
                  {t('dashboard.noActivity')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white text-lg font-bold">{t('dashboard.quickActions')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <button 
              onClick={() => {
                navigate('/sessions');
                setIsNewSessionModalOpen(true);
              }}
              className="w-full p-4 rounded-2xl bg-cyan-500/5 dark:bg-cyan-500/10 border border-cyan-500/10 dark:border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-sm font-bold hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-cyan-500 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 group-hover:rotate-12 transition-transform">
                <Plus className="w-5 h-5" />
              </div>
              <span>{t('common.newSession')}</span>
            </button>
            
            <button 
              onClick={() => navigate('/subscriptions')}
              className="w-full p-4 rounded-2xl bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/10 dark:border-purple-500/20 text-purple-600 dark:text-purple-400 text-sm font-bold hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20 group-hover:rotate-12 transition-transform">
                <CreditCard className="w-5 h-5" />
              </div>
              <span>{t('dashboard.renewSub')}</span>
            </button>
            
            <button 
              onClick={() => navigate('/rooms')}
              className="w-full p-4 rounded-2xl bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/10 dark:border-orange-500/20 text-orange-600 dark:text-orange-400 text-sm font-bold hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20 group-hover:rotate-12 transition-transform">
                <CalendarDays className="w-5 h-5" />
              </div>
              <span>{t('dashboard.bookRoom')}</span>
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
