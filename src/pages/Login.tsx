import React, { useState } from 'react';
import { authService } from '../services/authService';
import { Button } from '@/components/ui/button';
import { Timer, Mail, Lock, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

export default function Login() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRTL = i18n.language.startsWith('ar');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await authService.login(email, password);
    } catch (err: any) {
      const errorCode = err?.code || '';
      const errorMessage = err?.message || '';
      if (
        errorCode.startsWith('auth/') ||
        errorMessage.includes('auth/') ||
        errorMessage.includes('invalid-credential') ||
        errorMessage.includes('wrong-password') ||
        errorMessage.includes('user-not-found') ||
        errorMessage.includes('invalid-email')
      ) {
        setError(t('login.invalidCredentials'));
      } else {
        setError(errorMessage || t('login.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0F172A] p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20 mb-4">
            <Timer className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('login.welcome')}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t('login.subtitle')}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('login.email')}</label>
            <div className="relative">
              <Mail className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none transition-all`}
                placeholder="admin@operix.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('login.password')}</label>
            <div className="relative">
              <Lock className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none transition-all`}
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-xs text-center">
              {error}
            </div>
          )}

          <Button 
            type="submit" 
            disabled={loading}
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-6 rounded-xl font-semibold shadow-lg shadow-cyan-500/20 transition-all"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('login.signIn')}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-xs text-slate-500">
            {t('login.help')}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
