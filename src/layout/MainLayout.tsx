import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Timer, 
  CalendarDays, 
  CreditCard, 
  Settings as SettingsIcon, 
  Plus,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  TrendingUp,
  History,
  Wallet,
  Wifi,
  WifiOff,
  AlertTriangle,
  Users,
  Boxes
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWorkspaceStore } from '../store';
import { authService } from '../services/authService';
import NewSessionModal from '../components/NewSessionModal';

export default function MainLayout() {
  const { t, i18n } = useTranslation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  
  // ── Online/Offline connection status checking ──
  const [networkStatus, setNetworkStatus] = useState({
    isOnline: navigator.onLine,
    isWeak: false
  });
  const [showOnlineToast, setShowOnlineToast] = useState(false);

  useEffect(() => {
    let timerId: any = null;

    const handleOnline = () => {
      setNetworkStatus(prev => ({ ...prev, isOnline: true }));
      setShowOnlineToast(true);
      if (timerId) clearTimeout(timerId);
      timerId = setTimeout(() => {
        setShowOnlineToast(false);
      }, 4000);
    };

    const handleOffline = () => {
      setNetworkStatus(prev => ({ ...prev, isOnline: false }));
      setShowOnlineToast(false);
      if (timerId) clearTimeout(timerId);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Connection quality indicator if supported
    const conn = (navigator as any).connection;
    const updateConnectionStatus = () => {
      if (conn) {
        const isWeak = conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g' || (conn.rtt && conn.rtt > 1200);
        setNetworkStatus(prev => ({ ...prev, isWeak }));
      }
    };

    if (conn) {
      conn.addEventListener('change', updateConnectionStatus);
      updateConnectionStatus();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (conn) {
        conn.removeEventListener('change', updateConnectionStatus);
      }
      if (timerId) clearTimeout(timerId);
    };
  }, []);
  
  const { 
    user, 
    sessions: activeSessions, 
    theme, 
    toggleTheme,
    isNewSessionModalOpen,
    setIsNewSessionModalOpen
  } = useWorkspaceStore();

  const activeSessionsCount = activeSessions.length;
  const isRTL = i18n.language.startsWith('ar');

  const navItems = [
    { path: '/', label: t('common.dashboard'), icon: LayoutDashboard },
    { path: '/sessions', label: t('common.activeSessions'), icon: Timer, badge: activeSessionsCount },
    { path: '/history', label: t('common.sessionHistory'), icon: History },
    { path: '/expenses', label: t('common.expenses'), icon: Wallet, roles: ['owner'] },
    { path: '/reports', label: t('common.reports'), icon: TrendingUp },
    { path: '/rooms', label: t('common.roomBookings'), icon: CalendarDays },
    { path: '/subscriptions', label: t('common.subscriptions'), icon: CreditCard },
    { path: '/customers', label: t('common.customers'), icon: Users },
    { path: '/inventory', label: t('common.inventory'), icon: Boxes, roles: ['owner'] },
    { path: '/settings', label: t('common.settings'), icon: SettingsIcon, roles: ['owner'] },
  ].filter(item => !user || !item.roles || item.roles.includes(user.role));

  const handleLogout = () => authService.logout();

  if (!user) return null;

  return (
    <div 
      className="min-h-screen bg-slate-50 dark:bg-[#0F172A] text-slate-900 dark:text-slate-200 font-sans selection:bg-cyan-500/30 transition-colors "
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Sidebar */}
      <aside 
        className={`fixed ${isRTL ? 'right-0 border-l' : 'left-0 border-r'} top-0 z-40 h-screen transition-transform ${
          isSidebarOpen ? 'translate-x-0' : isRTL ? 'translate-x-[100%]' : '-translate-x-full'
        } w-64 border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A]/80 backdrop-blur-xl shadow-sm dark:shadow-none`}
      >
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Timer className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Operix</h1>
          </div>

          <nav className="flex-1 space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all 
                  ${isActive 
                    ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 shadow-sm dark:shadow-[0_0_20px_rgba(6,182,212,0.1)]' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'}
                `}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <Badge className={`${isRTL ? 'mr-auto' : 'ml-auto'} bg-cyan-500 text-white border-none px-2 py-0.5 text-[10px]`}>
                    {item.badge}
                  </Badge>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto pt-6 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-850 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-white select-none">
                {(user.name || user.email).substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 overflow-hidden pointer-events-auto">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate" title={user.name || user.email}>
                  {user.name || user.email}
                </p>
                <p className="text-[10px] text-slate-500 truncate lowercase">
                  {user.name ? user.email : user.role}
                </p>
              </div>
              <LogOut 
                className={`w-4 h-4 text-slate-400 cursor-pointer hover:text-red-500 transition-colors ${isRTL ? 'rotate-180' : ''}`} 
                onClick={handleLogout}
              />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`transition-all duration-300 ${isSidebarOpen ? isRTL ? 'pr-64' : 'pl-64' : 'p-0'}`}>
        <header className="h-20 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 sticky top-0 bg-white/80 dark:bg-[#0F172A]/80 backdrop-blur-xl z-30 shadow-sm dark:shadow-none">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white capitalize">
              {t(`common.${location.pathname === '/' ? 'dashboard' : location.pathname.substring(1)}`)}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500 dark:text-slate-400"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <Button 
              onClick={() => setIsNewSessionModalOpen(true)}
              className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl px-6 shadow-lg shadow-cyan-500/20"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('common.newSession')}
            </Button>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
             
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <NewSessionModal 
        isOpen={isNewSessionModalOpen} 
        onClose={() => setIsNewSessionModalOpen(false)} 
      />

      {/* Floating Online/Offline/Weak Connection alert bottom left */}
      <div className="fixed bottom-4 left-4 z-50 pointer-events-none">
        <AnimatePresence mode="wait">
          {!networkStatus.isOnline ? (
            <motion.div
              key="offline"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-900/60 shadow-lg shadow-rose-500/10 text-rose-700 dark:text-rose-400 text-xs font-semibold pointer-events-auto select-none"
            >
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600 dark:bg-rose-500"></span>
              </div>
              <WifiOff className="w-4 h-4 text-rose-500 animate-bounce" />
              <span>{isRTL ? "أنت غير متصل بالإنترنت حالياً" : "You are currently offline"}</span>
            </motion.div>
          ) : networkStatus.isWeak ? (
            <motion.div
              key="weak"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-900/60 shadow-lg shadow-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-semibold pointer-events-auto select-none"
            >
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-600 dark:bg-amber-500"></span>
              </div>
              <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
              <span>{isRTL ? "اتصال الإنترنت ضعيف جداً" : "Internet connection is very weak"}</span>
            </motion.div>
          ) : showOnlineToast ? (
            <motion.div
              key="online"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-900/65 shadow-lg shadow-emerald-500/10 text-emerald-700 dark:text-emerald-450 text-xs font-semibold pointer-events-auto select-none"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <Wifi className="w-4 h-4 text-emerald-500" />
              <span>{isRTL ? "تم الاتصال بالإنترنت بنجاح" : "Connected online successfully"}</span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
